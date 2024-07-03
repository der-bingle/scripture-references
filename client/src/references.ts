
import {parse_int} from './utils.js'
import {last_verse, books_ordered} from './data.js'

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

export type BookNames = Record<string, string>|Record<string, GetBooksItem>|GetBooksItem[]

export type ReferenceType = 'book'|'chapter'|'verse'|'range_verses'|'range_chapters'|'range_multi'

export interface SanitizedReference {
    type:ReferenceType
    range:boolean
    book:string
    start_chapter:number
    start_verse:number
    end_chapter:number
    end_verse:number
}

export interface SanitizedReferenceMatch {
    ref:SanitizedReference
    text:string
    index:number
}


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

    // If a direct match to a code, just return it
    if (input in simple_book_names){
        return input
    }

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


/* Force a given passage reference to be valid (providing as much or as little as desired)
    Chapter and verse numbers will be forced to their closest valid equivalent.
    All properties are returned and `type`/`range` signifies what kind of reference it is.
*/
export function sanitize_reference(book:string, chapter?:number, verse?:number):SanitizedReference
export function sanitize_reference(reference:PassageRef|SanitizedReference):SanitizedReference
export function sanitize_reference(book_or_obj:string|PassageRef|SanitizedReference,
        chapter?:number, verse?:number):SanitizedReference{

    // Detect what props are provided (will use later)
    let chapters_given:boolean
    let verses_given:boolean

    // Normalise args
    let ref:Omit<SanitizedReference, 'type'|'range'>
    if (typeof book_or_obj === 'string'){
        chapters_given = chapter !== undefined
        verses_given = verse !== undefined
        ref = {
            book: book_or_obj,
            start_chapter: chapter ?? 1,
            start_verse: verse ?? 1,
            // Following will increase to whatever start is later
            end_chapter: 1,
            end_verse: 1,
        }
    } else {
        chapters_given = book_or_obj.start_chapter !== undefined
            || book_or_obj.end_chapter !== undefined
        verses_given = book_or_obj.start_verse !== undefined
            || book_or_obj.end_verse !== undefined
        ref = {
            book: book_or_obj.book,
            start_chapter: book_or_obj.start_chapter ?? 1,
            start_verse: book_or_obj.start_verse ?? 1,
            // Unlike simple args, obj arg may be a range so need to default more carefully
            end_chapter: book_or_obj.end_chapter ?? book_or_obj.start_chapter ?? 1,
            // If end_chapter given then dealing with whole chapters, otherwise a non-range
            end_verse: book_or_obj.end_verse ?? (book_or_obj.end_chapter ? 999 : 1),
        }
        // If was given a pre-sanitized reference, still recheck, but need to correct below
        if ('type' in book_or_obj){
            verses_given = !['book', 'chapter', 'range_chapters'].includes(book_or_obj.type)
            chapters_given = book_or_obj.type !== 'book'
        }
    }

    // Validate book
    if (books_ordered.indexOf(ref.book) === -1){
        ref.book = 'gen'
    }

    // Ensure start chapter is valid
    const last_verse_book = last_verse[ref.book]!
    if (ref.start_chapter < 1){
        ref.start_chapter = 1
        ref.start_verse = 1
    } else if (ref.start_chapter > last_verse_book.length){
        ref.start_chapter = last_verse_book.length
        ref.start_verse = last_verse_book[last_verse_book.length-1]!
    }

    // Ensure start verse is valid
    ref.start_verse = Math.min(Math.max(ref.start_verse, 1),
        last_verse_book[ref.start_chapter-1]!)

    // Ensure end is not before start
    if (ref.end_chapter < ref.start_chapter ||
            (ref.end_chapter === ref.start_chapter && ref.end_verse < ref.start_verse)){
        ref.end_chapter = ref.start_chapter
        ref.end_verse = ref.start_verse
    }

    // Ensure end chapter is not invalid (already know is same or later than start)
    if (ref.end_chapter > last_verse_book.length){
        ref.end_chapter = last_verse_book.length
        ref.end_verse = last_verse_book[last_verse_book.length-1]!
    }

    // Ensure end verse is valid
    ref.end_verse = Math.min(Math.max(ref.end_verse, 1), last_verse_book[ref.end_chapter-1]!)

    // Determine type
    const chapters_same = ref.start_chapter === ref.end_chapter
    const verses_same = ref.start_verse === ref.end_verse
    let type:ReferenceType
    if (chapters_same && verses_same){
        type = chapters_given ? (verses_given ? 'verse' : 'chapter') : 'book'
    } else {
        type = chapters_same ? 'range_verses' : (verses_given ? 'range_multi': 'range_chapters')
    }

    // Identify if range completes chapters
    if (type === 'range_multi' && ref.start_verse === 1
            && ref.end_verse === last_verse_book[ref.end_chapter-1]){
        type = 'range_chapters'
    }

    return {type, range: type.startsWith('range_'), ...ref}
}


// Confirm if a passage reference is valid, verifying book code and chapter/verse numbers
export function valid_reference(book:string, chapter?:number, verse?:number):boolean
export function valid_reference(reference:PassageRef):boolean
export function valid_reference(book_or_obj:string|PassageRef, chapter?:number, verse?:number)
        :boolean{

    // Normalize args
    let ref:PassageRef
    if (typeof book_or_obj !== 'string'){
        ref = book_or_obj
    } else {
        ref = {
            book: book_or_obj,
            start_chapter: chapter,
            start_verse: verse,
        }
    }

    // Get sanitized reference
    const sanitized = sanitize_reference(ref)

    // Verify parts stayed same, but only those provided (ignoring undefined)
    if (ref.book !== sanitized.book){
        return false
    }
    for (const prop of ['start_chapter', 'start_verse', 'end_chapter', 'end_verse'] as const){
        if (Number.isInteger(ref[prop]) && ref[prop] !== sanitized[prop]){
            return false
        }
    }

    // Also fail if provided args don't make sense
    // NOTE Already know that no numbers in ref are 0/false due to above
    if (!ref.start_chapter && (ref.end_chapter || ref.start_verse || ref.end_verse)){
        return false  // e.g. Matt :1
    }
    if (ref.end_verse && !ref.start_verse){
        return false  // e.g. Matt 1:-1
    }
    if (ref.start_verse && ref.end_chapter && !ref.end_verse){
        return false  // e.g. Matt 1:1-2:
    }

    return true
}


// Confirm if given book is within the specified testament
export function valid_testament(book:string, testament:'ot'|'nt'):boolean{
    const index = books_ordered.indexOf(book)
    if (index === -1){
        return false
    } else if (testament === 'nt' && index >= 39){
        return true
    } else if (testament === 'ot' && index < 39){
        return true
    }
    return false
}


// Get a reference for the verse previous to the one supplied in input (accounting for chapters)
// If a reference object is given, the end verse can optionally be used as input instead
// but the output will always be for a single verse (ranges ignored).
export function get_prev_verse(book:string, chapter:number, verse:number):SanitizedReference|null
export function get_prev_verse(reference:PassageRef|SanitizedReference, end?:boolean)
    :SanitizedReference|null
export function get_prev_verse(book_or_obj:string|PassageRef|SanitizedReference,
        chapter_or_end?:number|boolean, verse_arg?:number):SanitizedReference|null{

    // Handle different arg options
    let ref:PassageRef
    let end = false
    if (typeof book_or_obj === 'string'){
        ref = {book: book_or_obj, start_chapter: Number(chapter_or_end), start_verse: verse_arg}
    } else {
        ref = {...book_or_obj}  // Avoid modifying input
        end = chapter_or_end === true
    }

    // When passing a reference object, the end verse can optionally be used instead of start
    let chapter = end ? ref.end_chapter : ref.start_chapter
    let verse = end ? ref.end_verse : ref.start_verse

    // Ensure ref valid
    if (!valid_reference(ref) || !chapter || !verse){
        return null
    }

    // Ensure action possible
    if (chapter === 1 && verse === 1){
        return null
    }

    // Go back a verse
    if (verse === 1){
        chapter -= 1
        verse = last_verse[ref.book]![chapter-1]!
    } else {
        verse -= 1
    }

    return {
        type: 'verse',
        range: false,
        book: ref.book,
        start_chapter: chapter,
        start_verse: verse,
        end_chapter: chapter,
        end_verse: verse,
    }
}


// Get a reference for the next verse for the one supplied in input (accounting for chapters)
// If a reference object is given, the end verse can optionally be used as input instead
// but the output will always be for a single verse (ranges ignored).
export function get_next_verse(book:string, chapter:number, verse:number):SanitizedReference|null
export function get_next_verse(reference:PassageRef|SanitizedReference, end?:boolean)
    :SanitizedReference|null
export function get_next_verse(book_or_obj:string|PassageRef|SanitizedReference,
        chapter_or_end?:number|boolean, verse_arg?:number):SanitizedReference|null{

    // Handle different arg options
    let ref:PassageRef
    let end = false
    if (typeof book_or_obj === 'string'){
        ref = {book: book_or_obj, start_chapter: Number(chapter_or_end), start_verse: verse_arg}
    } else {
        ref = {...book_or_obj}  // Avoid modifying input
        end = chapter_or_end === true
    }

    // When passing a reference object, the end verse can optionally be used instead of start
    let chapter = end ? ref.end_chapter : ref.start_chapter
    let verse = end ? ref.end_verse : ref.start_verse

    // Ensure ref valid
    if (!valid_reference(ref) || !chapter || !verse){
        return null
    }

    // Ensure action possible
    const last_verse_book = last_verse[ref.book]!
    if (chapter === last_verse_book.length
            && verse === last_verse_book[last_verse_book.length-1]){
        return null
    }

    // Go forward a verse
    if (verse === last_verse_book[chapter-1]){
        chapter += 1
        verse = 1
    } else {
        verse += 1
    }

    return {
        type: 'verse',
        range: false,
        book: ref.book,
        start_chapter: chapter,
        start_verse: verse,
        end_chapter: chapter,
        end_verse: verse,
    }
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
