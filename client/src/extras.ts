
import type {GetBooksItem} from './collection'


export interface VersesRefPartialBook {
    chapter_start:number
    chapter_end:number
    verse_start:number|null  // If null then range is entire chapters
    verse_end:number|null  // If null then range is entire chapters
}

export type VersesRef = VersesRefPartialBook|null  // null if whole book

export interface VersesRefArg {
    chapter_start?:number|null  // Whole book if doesn't exist
    chapter_end?:number|null  // Defaults to chapter_start
    verse_start?:number|null  // If null then range is entire chapters
    verse_end?:number|null  // Default to verse_start
}

export interface PassageRef {
    book:string
    chapter_start:number|null
    chapter_end:number|null
    verse_start:number|null
    verse_end:number|null
}

export interface PassageRefArg extends VersesRefArg {
    book:string
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


// Format verses reference to a readable string
// Supports: Gen | Gen 1 | 1-2 | 1:1 | 1:1-2 | 1:1-2:2
export function verses_obj_to_str(ref:VersesRefArg){

    // If no chapter_start then ref must be for whole book
    if (!ref.chapter_start){
        return ''
    }

    // Assign defaults for missing properties
    if (!ref.chapter_end){
        ref.chapter_end = ref.chapter_start
    }
    if (ref.verse_start && !ref.verse_end){
        ref.verse_end = ref.verse_start
    }

    // Return null if invalid properties
    if ((ref.verse_end && !ref.verse_start) || (ref.chapter_end < ref.chapter_start)
            || (ref.chapter_start === ref.chapter_end && ref.verse_start
            && ref.verse_end! < ref.verse_start)){
        return null
    }

    // If only a chapter ref, logic is much simpler
    if (!ref.verse_start){
        return ref.chapter_start === ref.chapter_end ? `${ref.chapter_start}`
            : `${ref.chapter_start}-${ref.chapter_end}`
    }

    // See if a single verse
    if (ref.chapter_start === ref.chapter_end && ref.verse_start === ref.verse_end){
        return `${ref.chapter_start}:${ref.verse_start}`
    }

    // Dealing with a range...
    let out = `${ref.chapter_start}:${ref.verse_start}-`
    if (ref.chapter_end !== ref.chapter_start){
        out += `${ref.chapter_end}:`
    }
    return out + `${ref.verse_end!}`
}


// Parse verses reference string into an object
export function verses_str_to_obj(ref:string):VersesRef{

    // Clean ref
    ref = ref.replace(/ /g, '')  // Remove spaces
        .replace(/\./g, ':').replace(/：/gu, ':')  // Normalise chap/verse seperators to common colon
        .replace(/\p{Dash}/gu, '-')  // Normalise range separators to common hyphen

    // Init props
    let chapter_start:number
    let verse_start:number|null = null
    let chapter_end:number|null = null
    let verse_end:number|null = null

    if (!ref.includes(':')){
        // Dealing with chapters only
        const parts = ref.split('-')
        chapter_start = parseInt(parts[0]!)
        if (parts[1]){
            chapter_end = parseInt(parts[1])
        }
    } else {
        // Includes verses
        const parts = ref.split('-')
        const start_parts = parts[0]!.split(':')
        chapter_start = parseInt(start_parts[0]!)
        if (start_parts[1]){
            verse_start = parseInt(start_parts[1])
        }
        if (parts[1]){
            // Is a range
            const end_parts = parts[1].split(':')
            if (end_parts.length > 1){
                chapter_end = parseInt(end_parts[0]!)
                verse_end = parseInt(end_parts[1]!)
            } else {
                chapter_end = chapter_start
                verse_end = parseInt(end_parts[0]!)
            }
        }
    }

    // Chapter start should always be present
    if (!chapter_start){
        return null
    }

    return {
        chapter_start,
        chapter_end: chapter_end ?? chapter_start,
        verse_start,
        verse_end: verse_end ?? verse_start,
    }
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
            .replace(/[^\da-zA-Z]/g, '')
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


// Parse passage reference string into an object
export function passage_str_to_obj(ref:string, book_names:BookNames):PassageRef|null{
    ref = ref.trim()

    // Find start of first digit, except if start of string (e.g. 1 Sam)
    let verses_start = ref.slice(1).search(/\d/) + 1
    if (verses_start === 0){  // NOTE +1 above means never -1 and 0 is a no match
        verses_start = ref.length
    }

    // If book can be parsed, ref is valid even if verse range can't be parsed
    const book_code = book_name_to_code(ref.slice(0, verses_start), book_names)
    if (!book_code){
        return null
    }

    // If verses can't be parsed, assume whole book
    const verses = verses_str_to_obj(ref.slice(verses_start))
    if (verses){
        return {book: book_code, ...verses}
    }
    return {
        book: book_code,
        chapter_start: null,
        chapter_end: null,
        verse_start: null,
        verse_end: null,
    }
}


// Format passage reference to a readable string
export function passage_obj_to_str(ref:PassageRefArg, book_names:BookNames):string{
    const simple_book_names = _normalise_book_names(book_names)
    let text = simple_book_names[ref.book] ?? ''
    const verses = verses_obj_to_str(ref)
    if (verses){
        text += ' ' + verses
    }
    return text
}
