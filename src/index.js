// Modern exports with clear function names
export { PassageReference } from './passage.js'
export { detectReferences } from './detect.js'
export { transformReferences, toObsidianWikilink } from './transform.js'
export { getChapterNumbers, getVerseNumbers } from './stats.js'
export { safeParseInt, parseIntWithBounds } from './utils.js'
export { 
    parseVerseReference, 
    detectBookCode
} from './passage.js'

// Data exports
export {
    book_names_english, 
    book_abbrev_english, 
    books_ordered, 
    english_abbrev_include,
    english_abbrev_exclude
} from './data.js'
export { last_verse } from './last_verse.js'