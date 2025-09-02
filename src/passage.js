/* THEORY OF RANGES
    When presented with "Titus", does it refer to the beginning of the book or whole contents?
        E.g. When highlighting verses, should the whole book be highlighted or just first verse?
    Likewise, does "Titus 1" refer to the start of the chapter or the whole chapter?

    This module defaults to assuming "Titus" and "Titus 1" are _identifiers_ rather than ranges
    And if a range is intended, then it should be presented as "Titus 1-3" or "Titus 1:1-16"

    As for the other types, anything with a hyphen is obviously a range (1:1-2, 1-2, 1:1-2:2)
    That only leaves single verses (1:1) which are identifiers and can never be a range
    So it makes sense to consider books and chapters (no hyphens) as identifiers as well
*/


import { pipe, replace, split, map, includes, filter, find } from 'ramda'
import { safeParseInt } from './utils.js'
import {books_ordered, book_names_english, english_abbrev_include,
    english_abbrev_exclude} from './data.js'
import {last_verse} from './last_verse.js'

/**
 * @typedef {Object} PassageArgs
 * @property {string} book
 * @property {number|undefined|null} [start_chapter]
 * @property {number|undefined|null} [start_verse]  
 * @property {number|undefined|null} [end_chapter]
 * @property {number|undefined|null} [end_verse]
 */

/**
 * @typedef {'book'|'chapter'|'verse'|'range_verses'|'range_chapters'|'range_multi'} ReferenceType
 */


const single_chapter_books = ['2jn', '3jn', 'jud', 'oba', 'phm']


// Clean and normalize verse reference string
const cleanVerseRef = pipe(
    replace(/ /g, ''),                    // Remove spaces
    replace(/\./g, ':'),                  // Normalize chapter/verse separators
    replace(/：/gu, ':'),                 // Normalize Unicode colons
    replace(/\p{Dash}/gu, '-')            // Normalize range separators
)

/**
 * Parse verses reference string into an object (functional approach)
 * @param {string} ref - Reference string to parse
 * @returns {PassageArgs} Parsed reference object
 */
export const parseVerseReference = (ref) => {
    const cleanedRef = cleanVerseRef(ref)
    
    const parseChapterOnlyRef = (cleanRef) => {
        const parts = split('-', cleanRef)
        return {
            start_chapter: safeParseInt(parts[0]),
            start_verse: undefined,
            end_chapter: safeParseInt(parts[1] ?? ''),
            end_verse: undefined
        }
    }
    
    const parseVerseRef = (cleanRef) => {
        const parts = split('-', cleanRef)
        const startParts = split(':', parts[0])
        
        const result = {
            start_chapter: safeParseInt(startParts[0]),
            start_verse: safeParseInt(startParts[1] ?? ''),
            end_chapter: undefined,
            end_verse: undefined
        }
        
        if (parts[1]) {
            const endParts = split(':', parts[1])
            if (endParts.length > 1) {
                result.end_chapter = safeParseInt(endParts[0])
                result.end_verse = safeParseInt(endParts[1])
            } else {
                result.end_verse = safeParseInt(endParts[0])
            }
        }
        
        return result
    }
    
    return cleanedRef.includes(':') 
        ? parseVerseRef(cleanedRef)
        : parseChapterOnlyRef(cleanedRef)
}



// Clean and normalize book name strings using functional composition
const cleanBookName = pipe(
    (s) => s.trim().toLowerCase(),
    replace(/^i /, '1'),
    replace(/1st /, '1'),
    replace(/first /, '1'),
    replace(/^ii /, '2'),
    replace(/2nd /, '2'),
    replace(/second /, '2'),
    replace(/^iii /, '3'),
    replace(/3rd /, '3'),
    replace(/third /, '3'),
    replace(/[^\d\p{Letter}]/gui, '')
)

// Check if input matches exactly or abbreviates a book name
const findBookMatches = (input, normalizedBookNames) => {
    const exactMatch = find(([code, name]) => name === input, normalizedBookNames)
    if (exactMatch) return { exact: exactMatch[0], partial: [] }
    
    const partialMatches = filter(([code, name]) => name.startsWith(input), normalizedBookNames)
    return { exact: null, partial: partialMatches }
}

// Create fuzzy regex for book name matching
const createFuzzyRegex = (input, matchFromStart) => {
    let regexStr = input.split('').join('.{0,4}')
    
    if (matchFromStart) {
        const firstChar = input[0]
        if (['1', '2', '3'].includes(firstChar)) {
            regexStr = '^' + firstChar + input.slice(1).split('').join('.{0,4}')
        } else {
            regexStr = '^' + regexStr
        }
    }
    
    return new RegExp(regexStr)
}

/**
 * Detect book code from name or abbreviation using functional approach
 * @param {string} input - Input string to match
 * @returns {string|null} Book code or null if no match
 */
export const detectBookCode = (input) => {
    const cleanedInput = cleanBookName(input)
    if (!cleanedInput) return null
    
    if (includes(cleanedInput, map(cleanBookName, english_abbrev_exclude))) return null
    
    // Direct book code match
    if (includes(cleanedInput, books_ordered)) return cleanedInput
    
    // Use English book names and abbreviations
    const bookNames = [...Object.entries(book_names_english), ...english_abbrev_include]
    const normalizedNames = pipe(
        map(([code, name]) => [code, cleanBookName(name)]),
        filter(([code, name]) => Boolean(name))
    )(bookNames)
    
    // Check for exact and partial matches
    const { exact, partial } = findBookMatches(cleanedInput, normalizedNames)
    if (exact) return exact
    if (partial.length === 1) return partial[0][0]
    if (partial.length > 1) return null // Too ambiguous
    
    // Try fuzzy matching (always from start for English)
    const fuzzyRegex = createFuzzyRegex(cleanedInput, true)
    const fuzzyMatches = filter(([code, name]) => fuzzyRegex.test(name), normalizedNames)
    
    return fuzzyMatches.length === 1 ? fuzzyMatches[0][0] : null
}



export class PassageReference {

    /**
     * Force a given passage reference to be valid (providing as much or as little as desired)
     * Chapter and verse numbers will be forced to their closest valid equivalent.
     * All properties are returned and `type`/`range` signifies what kind of reference it is.
     * @param {string|PassageArgs} bookOrObj - Book code or passage args object
     * @param {number} [chapter] - Chapter number (if first param is string)
     * @param {number} [verse] - Verse number (if first param is string)
     */
    constructor(bookOrObj, chapter, verse) {
        // Normalize args
        if (typeof bookOrObj !== 'string') {
            // Destructure so extraneous properties aren't preserved in `this._args`
            this._args = {
                book: bookOrObj.book,
                start_chapter: bookOrObj.start_chapter,
                start_verse: bookOrObj.start_verse,
                end_chapter: bookOrObj.end_chapter,
                end_verse: bookOrObj.end_verse,
            }
        } else {
            this._args = {
                book: bookOrObj,
                start_chapter: chapter,
                start_verse: verse,
            }
        }

        // Detect what props are provided (will use later)
        const chapters_given = typeof this._args.start_chapter === 'number'
            || typeof this._args.end_chapter === 'number'
        const verses_given = typeof this._args.start_verse === 'number'
            || typeof this._args.end_verse === 'number'

        // Provide defaults
        this.book = this._args.book
        this.start_chapter = this._args.start_chapter ?? 1
        this.start_verse = this._args.start_verse ?? 1
        this.end_chapter = this._args.end_chapter ?? this._args.start_chapter ?? 1
        // If end_chapter given then dealing with whole chapters, otherwise a non-range
        this.end_verse = this._args.end_verse ?? (this._args.end_chapter ? 999 : 1)

        // Validate book
        if (books_ordered.indexOf(this.book) === -1) {
            this.book = 'gen'
        }

        // Ensure start chapter is valid
        const last_verse_book = last_verse[this.book]
        if (this.start_chapter < 1) {
            this.start_chapter = 1
            this.start_verse = 1
        } else if (this.start_chapter > last_verse_book.length) {
            this.start_chapter = last_verse_book.length
            this.start_verse = last_verse_book[last_verse_book.length-1]
        }

        // Ensure start verse is valid
        this.start_verse = Math.min(Math.max(this.start_verse, 1),
            last_verse_book[this.start_chapter-1])

        // Ensure end is not before start
        if (this.end_chapter < this.start_chapter ||
                (this.end_chapter === this.start_chapter && this.end_verse < this.start_verse)) {
            this.end_chapter = this.start_chapter
            this.end_verse = this.start_verse
        }

        // Ensure end chapter is not invalid (already know is same or later than start)
        if (this.end_chapter > last_verse_book.length) {
            this.end_chapter = last_verse_book.length
            this.end_verse = last_verse_book[last_verse_book.length-1]
        }

        // Ensure end verse is valid
        this.end_verse = Math.min(Math.max(this.end_verse, 1), last_verse_book[this.end_chapter-1])

        // Determine type
        const chapters_same = this.start_chapter === this.end_chapter
        const verses_same = this.start_verse === this.end_verse
        if (chapters_same && verses_same) {
            this.type = chapters_given ? (verses_given ? 'verse' : 'chapter') : 'book'
        } else {
            this.type = chapters_same ? 'range_verses' :
                (verses_given ? 'range_multi': 'range_chapters')
        }

        // Identify if range completes chapters
        if (this.type === 'range_multi' && this.start_verse === 1
                && this.end_verse === last_verse_book[this.end_chapter-1]) {
            this.type = 'range_chapters'
        }

        // A chapter for a single chapter book is just the book
        if (single_chapter_books.includes(this.book) && this.type === 'chapter') {
            this.type = 'book'
        }

        // Determine range and testament properties
        this.range = this.type.startsWith('range_')
        this.ot = books_ordered.indexOf(this.book) < 39
        this.nt = !this.ot

        // Determine if original input was valid
        const determine_args_valid = () => {

            // Verify parts stayed same, but only those provided (ignoring undefined)
            if (this._args.book !== this.book) {
                return false
            }
            const props = ['start_chapter', 'start_verse', 'end_chapter', 'end_verse']
            for (const prop of props) {
                if (Number.isInteger(this._args[prop]) && this._args[prop] !== this[prop]) {
                    return false
                }
            }

            // Also fail if provided args don't make sense
            // NOTE Already know that no numbers in ref are 0/false due to above
            if (!this._args.start_chapter && (this._args.end_chapter || this._args.start_verse
                    || this._args.end_verse)) {
                return false  // e.g. Matt :1
            }
            if (this._args.end_verse && !this._args.start_verse) {
                return false  // e.g. Matt 1:-1
            }
            if (this._args.start_verse && this._args.end_chapter && !this._args.end_verse) {
                return false  // e.g. Matt 1:1-2:
            }

            return true
        }
        this.args_valid = determine_args_valid()
    }

    /**
     * Parse passage reference string using functional approach
     * @param {string} reference - Reference string to parse
     * @returns {PassageReference|null} Parsed reference or null
     */
    static fromString(reference) {
        
        
        const trimmedRef = reference.trim()
        
        // Find where verses start (after first digit that's not at the beginning)
        const versesStartIndex = pipe(
            (ref) => ref.slice(1).search(/\d/),
            (index) => index === -1 ? trimmedRef.length : index + 1
        )(trimmedRef)
        
        const bookStr = trimmedRef.slice(0, versesStartIndex).trim()
        
        // Check minimum character requirement (2 for English)
        if (bookStr.length < 2) return null
        
        // Detect book code
        const bookCode = detectBookCode(bookStr)
        if (!bookCode) return null
        
        // Parse verses portion
        const versesStr = trimmedRef.slice(versesStartIndex)
        let verses = parseVerseReference(versesStr)
        
        // Special handling for single chapter books
        if (includes(bookCode, single_chapter_books) && 
            verses.start_chapter && 
            !verses.start_verse && 
            !verses.end_verse) {
            verses = parseVerseReference('1:' + versesStr)
        }
        
        return new PassageReference({ book: bookCode, ...verses })
    }


    /**
     * Create a new reference spanning from start of first to end of second reference
     * @param {PassageReference} start - Starting reference
     * @param {PassageReference} end - Ending reference
     * @returns {PassageReference} Combined reference
     */
    static fromRefs(start, end) {
        return new PassageReference({
            book: start.book,
            start_chapter: start.start_chapter,
            start_verse: start.start_verse,
            end_chapter: end.end_chapter,
            end_verse: end.end_verse,
        })
    }

    /**
     * Restore reference from serialized form using functional approach
     * @param {string} code - Serialized reference code
     * @returns {PassageReference} Restored reference
     */
    static fromSerialized(code) {
        const bookCode = code.slice(0, 3)
        const versesStr = code.slice(3)
        const verses = parseVerseReference(versesStr)
        return new PassageReference({ book: bookCode, ...verses })
    }


    /**
     * Get book name using functional approach
     * @returns {string} Book name
     */
    getBookName() {
        return book_names_english[this.book]
    }

    /**
     * Get string representation of verses using functional approach
     * @param {string} [verseSep=':'] - Verse separator
     * @param {string} [rangeSep='-'] - Range separator
     * @returns {string} Verses string
     */
    getVersesString(verseSep = ':', rangeSep = '-') {
        const formatters = {
            book: () => '',
            chapter: () => `${this.start_chapter}`,
            range_chapters: () => `${this.start_chapter}${rangeSep}${this.end_chapter}`,
            verse: () => `${this.start_chapter}${verseSep}${this.start_verse}`,
            range_verses: () => {
                let result = `${this.start_chapter}${verseSep}${this.start_verse}${rangeSep}`
                if (this.end_chapter !== this.start_chapter) {
                    result += `${this.end_chapter}${verseSep}`
                }
                return result + `${this.end_verse}`
            },
            range_multi: () => {
                let result = `${this.start_chapter}${verseSep}${this.start_verse}${rangeSep}`
                if (this.end_chapter !== this.start_chapter) {
                    result += `${this.end_chapter}${verseSep}`
                }
                return result + `${this.end_verse}`
            }
        }
        
        return formatters[this.type]()
    }

    /**
     * Format passage reference to readable string using functional approach
     * @param {string} [verseSep=':'] - Verse separator
     * @param {string} [rangeSep='-'] - Range separator
     * @returns {string} Formatted string
     */
    toString(verseSep = ':', rangeSep = '-') {
        return pipe(
            () => this.getBookName() + ' ' + this.getVersesString(verseSep, rangeSep),
            (str) => str.trim()
        )()
    }

    /**
     * Serialize reference to string for restoration
     * @returns {string} Serialized reference
     */
    toSerialized() {
        return this.book + this.getVersesString()
    }


    /**
     * Whether this reference is the same as the one provided
     * @param {PassageReference} ref - Reference to compare
     * @returns {boolean} True if equal
     */
    equals(ref) {
        return this.type === ref.type
            && this.book === ref.book
            && this.start_chapter === ref.start_chapter
            && this.start_verse === ref.start_verse
            && this.end_chapter === ref.end_chapter
            && this.end_verse === ref.end_verse
    }

    /**
     * Whether this reference ends before the given chapter/verse or not
     * @param {number} chapter - Chapter to compare
     * @param {number} verse - Verse to compare
     * @returns {boolean} True if this reference ends before given position
     */
    is_before(chapter, verse) {
        return this.end_chapter < chapter ||
            (this.end_chapter === chapter && this.end_verse < verse)
    }

    /**
     * Whether this reference starts after the given chapter/verse or not
     * @param {number} chapter - Chapter to compare
     * @param {number} verse - Verse to compare
     * @returns {boolean} True if this reference starts after given position
     */
    is_after(chapter, verse) {
        return this.start_chapter > chapter ||
            (this.start_chapter === chapter && this.start_verse > verse)
    }

    /**
     * Whether this reference includes the given chapter/verse or not
     * @param {number} chapter - Chapter to check
     * @param {number} verse - Verse to check
     * @returns {boolean} True if reference includes the position
     */
    includes(chapter, verse) {
        return !this.is_before(chapter, verse) && !this.is_after(chapter, verse)
    }

    /**
     * Get the total number of verses included in the range
     * @returns {number} Total verse count
     */
    total_verses() {

        // If a book or chapter, will expect range even though they are identifiers
        const {end_chapter, end_verse} = this.get_end()

        // Handle same chapter case
        if (this.start_chapter === end_chapter) {
            return end_verse - this.start_verse + 1
        }

        // First add verses from first chapter
        const last_verse_book = last_verse[this.book]
        let count = last_verse_book[this.start_chapter-1] - this.start_verse + 1

        // Then add verses from middle chapters
        for (let ch=this.start_chapter+1; ch < end_chapter; ch++) {
            count += last_verse_book[ch-1]
        }

        // Finally add verses from last chapter
        return count + end_verse
    }

    /**
     * Get a reference for just the start verse of this reference (no effect if single verse)
     * @returns {PassageReference} Start reference
     */
    get_start() {
        return new PassageReference({
            book: this.book,
            start_chapter: this.start_chapter,
            start_verse: this.start_verse,
        })
    }

    /**
     * Get a reference for just the end verse of this reference (no effect if single verse)
     * @returns {PassageReference} End reference
     */
    get_end() {
        const last_verse_book = last_verse[this.book]
        if (this.type === 'book') {
            // User will expect end of book, even though this type is an identifier and not range
            return new PassageReference({
                book: this.book,
                start_chapter: last_verse_book.length,
                start_verse: last_verse_book[last_verse_book.length-1],
            })
        } else if (this.type === 'chapter') {
            // User will expect end of chapter, even though this type is an identifier and not range
            return new PassageReference({
                book: this.book,
                start_chapter: this.start_chapter,
                start_verse: last_verse_book[this.start_chapter-1],
            })
        }
        return new PassageReference({
            book: this.book,
            start_chapter: this.end_chapter,
            start_verse: this.end_verse,
        })
    }

    /**
     * Get a reference for the verse previous to this one (accounting for chapters)
     * It can optionally be relative to the end verse, but a range is never returned (single verse)
     * @param {boolean} [prevToEnd=false] - Whether to get previous to end verse
     * @returns {PassageReference|null} Previous verse reference or null if at beginning
     */
    get_prev_verse(prevToEnd = false) {

        // Optionally relative to end rather than start
        let chapter = prevToEnd ? this.end_chapter : this.start_chapter
        let verse = prevToEnd ? this.end_verse : this.start_verse

        // Ensure action possible
        if (chapter === 1 && verse === 1) {
            return null
        }

        // Go back a verse
        if (verse === 1) {
            chapter -= 1
            verse = last_verse[this.book][chapter-1]
        } else {
            verse -= 1
        }

        return new PassageReference({
            book: this.book,
            start_chapter: chapter,
            start_verse: verse,
        })
    }

    /**
     * Get a reference for the verse after this one (accounting for chapters)
     * It can optionally be relative to the end verse, but a range is never returned (single verse)
     * @param {boolean} [afterEnd=false] - Whether to get next after end verse
     * @returns {PassageReference|null} Next verse reference or null if at end
     */
    get_next_verse(afterEnd = false) {

        // Optionally relative to end rather than start
        let chapter = afterEnd ? this.end_chapter : this.start_chapter
        let verse = afterEnd ? this.end_verse : this.start_verse

        // Ensure action possible
        const last_verse_book = last_verse[this.book]
        if (chapter === last_verse_book.length
                && verse === last_verse_book[last_verse_book.length-1]) {
            return null
        }

        // Go forward a verse
        if (verse === last_verse_book[chapter-1]) {
            chapter += 1
            verse = 1
        } else {
            verse += 1
        }

        return new PassageReference({
            book: this.book,
            start_chapter: chapter,
            start_verse: verse,
        })
    }
}