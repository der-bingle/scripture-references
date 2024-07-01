
import {parse_int} from './utils.js'

import type {GetBooksItem} from './collection'


export interface VersesRef {
    start_chapter?:number|undefined
    start_verse?:number|undefined
    end_chapter?:number|undefined
    end_verse?:number|undefined
}

export interface PassageRef extends VersesRef {
    book:string
}

export interface PassageRefMatch {
    ref:PassageRef
    text:string
    index:number
}

export type BookNames = Record<string, string>|Record<string, GetBooksItem>|GetBooksItem[]


// Util for normalising book_names input to a simple record
function _normalise_book_names(book_names:BookNames):Record<string, string>{
    if (Array.isArray(book_names)){
        return Object.fromEntries(book_names.map(item => ([item.id, item.name])))
    }
    if (typeof Object.values(book_names)[0] === 'string'){
        return book_names as Record<string, string>
    }
    return Object.fromEntries(Object.values(book_names as Record<string, GetBooksItem>)
        .map(item => ([item.id, item.name])))
}


// Format verses reference to a readable string (but doesn't validate the numbers)
// Supports: Gen | Gen 1 | 1-2 | 1:1 | 1:1-2 | 1:1-2:2
// If a whole book then chapters must be und., if whole chapters then verses must be und.
export function verses_obj_to_str(ref:VersesRef, verse_sep=':', range_sep='-'){

    // If no chapters then ref must be for whole book
    if (!ref.start_chapter && !ref.end_chapter){
        return ''
    }

    // Assign defaults for missing properties
    ref.start_chapter ??= ref.end_chapter!
    ref.end_chapter ??= ref.start_chapter
    if (ref.start_verse || ref.end_verse){
        ref.start_verse ??= ref.start_chapter !== ref.end_chapter ? 1 : (ref.end_verse ?? 1)
        ref.end_verse ??= ref.start_verse
    }

    // If only a chapter ref, logic is much simpler
    if (!ref.start_verse){
        return ref.start_chapter === ref.end_chapter ? `${ref.start_chapter}`
            : `${ref.start_chapter}${range_sep}${ref.end_chapter}`
    }

    // See if a single verse
    if (ref.start_chapter === ref.end_chapter && ref.start_verse === ref.end_verse){
        return `${ref.start_chapter}${verse_sep}${ref.start_verse}`
    }

    // Dealing with a range...
    let out = `${ref.start_chapter}${verse_sep}${ref.start_verse}${range_sep}`
    if (ref.end_chapter !== ref.start_chapter){
        out += `${ref.end_chapter}${verse_sep}`
    }
    return out + `${ref.end_verse!}`
}


// Parse verses reference string into an object (but does not validate numbers)
export function verses_str_to_obj(ref:string):VersesRef{

    // Clean ref
    ref = ref.replace(/ /g, '')  // Remove spaces
        .replace(/\./g, ':').replace(/：/gu, ':')  // Normalise chap/verse seperators to common colon
        .replace(/\p{Dash}/gu, '-')  // Normalise range separators to common hyphen

    // Init props
    let start_chapter:number|undefined
    let start_verse:number|undefined
    let end_chapter:number|undefined
    let end_verse:number|undefined

    if (!ref.includes(':')){
        // Dealing with chapters only
        const parts = ref.split('-')
        start_chapter = parse_int(parts[0]!) ?? undefined
        end_chapter = parse_int(parts[1] ?? '') ?? undefined
    } else {
        // Includes verses
        const parts = ref.split('-')
        const start_parts = parts[0]!.split(':')
        start_chapter = parse_int(start_parts[0]!) ?? undefined
        start_verse = parse_int(start_parts[1] ?? '') ?? undefined
        if (parts[1]){
            // Is a range
            const end_parts = parts[1].split(':')
            if (end_parts.length > 1){
                // Specifies end chapter
                end_chapter = parse_int(end_parts[0]!) ?? undefined
                end_verse = parse_int(end_parts[1]!) ?? undefined
            } else {
                // End verse is in same chapter
                end_verse = parse_int(end_parts[0]!) ?? undefined
            }
        }
    }

    return {start_chapter, start_verse, end_chapter, end_verse}
}


// Get book USX code from the book name or an abbreviation of it
// This should be language neutral (though some English special cases are included)
export function book_name_to_code(input:string, book_names:BookNames):string|null{

    const simple_book_names = _normalise_book_names(book_names)

    // Clean util to be used for both input and book names
    const clean = (string:string) => {
        return string
            .trim().toLowerCase()
            .replace(/^i /, '1').replace('1st ', '1').replace('first ', '1')
            .replace(/^ii /, '2').replace('2nd ', '2').replace('second ', '2')
            .replace(/^iii /, '3').replace('3rd ', '3').replace('third ', '3')
            .replace(/[^\d\p{Letter}]/gui, '')
    }

    // Clean the input
    input = clean(input)

    // Normalise book names
    const normalised = Object.entries(simple_book_names)
        .map(([code, name]) => ([code, clean(name)] as [string, string]))

    // See if input matches or abbreviates any book name
    const matches = normalised.filter(([code, name]) => name.startsWith(input))

    // Only return if unique match
    if (matches.length === 1){
        return matches[0]![0]
    }

    // Try fuzzy regex, since vowels are often removed in abbreviations
    const fuzzy = normalised.filter(([code, name]) => {
        const input_with_gaps = input.split('').join('.{0,4}')
        return new RegExp(`^${input_with_gaps}.*`).test(name)
    })
    if (fuzzy.length === 1){
        return fuzzy[0]![0]
    }

    // Handle English special cases
    // These could in theory abbreviate multiple books, and are only specified because of convention
    // See https://www.logos.com/bible-book-abbreviations
    const special_cases:Record<string, string> = {
        nm: 'num',
        ez: 'ezr',
        mc: 'mic',
        hb: 'hab',
        jn: 'jhn',
        phil: 'php',
        pm: 'phm',
        jm: 'jas',
        jud: 'jud',
        jd: 'jud',
    }
    if (input in special_cases){
        return special_cases[input]!
    }

    return null
}


// Parse passage reference string into an object (but does not validate chapter/verse numbers)
export function passage_str_to_obj(ref:string, ...book_names:BookNames[]):PassageRef|null{
    ref = ref.trim()

    // Find start of first digit, except if start of string (e.g. 1 Sam)
    let verses_start = ref.slice(1).search(/\d/) + 1
    if (verses_start === 0){  // NOTE +1 above means never -1 and 0 is a no match
        verses_start = ref.length
    }

    // If book can be parsed, ref is valid even if verse range can't be parsed
    let book_code:string|null = null
    // Try each set separately, so that order sets priority
    for (const book_names_set of book_names){
        book_code = book_name_to_code(ref.slice(0, verses_start), book_names_set)
        if (book_code){
            break
        }
    }
    if (!book_code){
        return null
    }

    // Parse verses
    const verses = verses_str_to_obj(ref.slice(verses_start))
    return {book: book_code, ...verses}
}


// Format passage reference to a readable string
export function passage_obj_to_str(ref:PassageRef, book_names:BookNames, verse_sep=':',
        range_sep='-'):string{
    const simple_book_names = _normalise_book_names(book_names)
    let text = simple_book_names[ref.book] ?? ''
    const verses = verses_obj_to_str(ref, verse_sep, range_sep)
    if (verses){
        text += ' ' + verses
    }
    return text
}


// Create new regex object for identifying passage references in text
export function passage_str_regex(){
    const book_num_prefix = '(?:(?:[123]|I{1,3}) ?)?'
    const book_name = '[\\p{Letter}\\p{Dash} ]{2,18}\\.? ?'
    const integer_with_opt_sep = '\\d{1,3}[abc]?(?: ?[:：\\.] ?\\d{1,3}[abc]?)?'
    const verse_range = integer_with_opt_sep + '(?: ?\\p{Dash} ?' + integer_with_opt_sep + ')?'
    const trailing = '(?![\\d\\p{Letter}@#$%])'  // Doesn't make sense to be followed by these
    return new RegExp(book_num_prefix + book_name + verse_range + trailing, 'uig')
}


// Discover a passage reference in a block of text
// Only the first match is returned (call again with remaining text to get subsequent ones)
export function find_passage_str(input:string, ...book_names:BookNames[]):PassageRefMatch|null{

    // Create regex (will manually manipulate lastIndex property of it)
    const regex = passage_str_regex()

    // Loop until find a valid ref (not all regex matches will be valid)
    while (true){
        const match = regex.exec(input)
        if (!match){
            return null  // Either no matches or no valid matches...
        }

        // Confirm match is actually a valid ref
        const ref = passage_str_to_obj(match[0], ...book_names)
        if (ref && ref.start_chapter !== null){  // No whole book refs
            return {ref, text: match[0], index: match.index}
        }

        // If invalid, try next word as match might still have included a partial ref
        // e.g. "in 1 Corinthians 9" -> "in 1" -> "1 Corinthians 9"
        const chars_to_next_word = match[0].indexOf(' ', 1)
        if (chars_to_next_word >= 1){
            // Backtrack to exclude just first word of previous match
            regex.lastIndex -= (match[0].length - chars_to_next_word - 1)
        }
    }
}


// Discover all passage references in a block of text
export function find_passage_str_all(input:string, ...book_names:BookNames[]):PassageRefMatch[]{
    const matches:PassageRefMatch[] = []
    while (true){
        const match = find_passage_str(input, ...book_names)
        if (match){
            matches.push(match)
            input = input.slice(match.index + match.text.length)
        } else {
            break
        }
    }
    return matches
}
