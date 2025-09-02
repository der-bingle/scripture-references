import { PassageReference } from './passage.js'

/**
 * @typedef {Object} PassageReferenceMatch
 * @property {PassageReference} ref - The parsed reference
 * @property {string} text - The matched text
 * @property {number} index - Position in original text
 * @property {number} index_from_prev_match - Position relative to previous match
 * @property {boolean} whole - Whether this is a complete reference or partial
 */

// Regex strings used for identifying passage references in blocks of text
// NOTE Allow two spaces but no more, to be forgiving but not match weird text
const regex_verse_sep = '[:：\\.]'
const regex_book_num_prefix = '(?:(?:[123]|I{1,3}) ? ?)?'
const regex_book_name_tmpl = '\\p{Letter}[\\p{Letter}\\p{Dash} ]{MIN_MID,16}END_LETTER\\.? ? ?'
const regex_integer_with_opt_sep =
    '\\d{1,3}[abc]?(?: ? ?' + regex_verse_sep + ' ? ?\\d{1,3}[abc]?)?'
const regex_verse_range = regex_integer_with_opt_sep + '(?: ? ?\\p{Dash} ? ?'
    + regex_integer_with_opt_sep + ')?'
const regex_trailing = '(?![\\d\\p{Letter}@#$%])'  // Doesn't make sense to be followed by these

const regex_between_ranges = ' ? ?[,;] ? ?'
const regex_additional_range = regex_between_ranges + '(' + regex_verse_range + ')' + regex_trailing


/**
 * Build regex patterns using functional composition for English
 * @returns {{complete: string, bookCheck: string, additional: string}} Regex patterns
 */
const buildRegexPattern = () => {
    // English book names require minimum 2 characters
    const minMid = 0
    const endLetter = '\\p{Letter}'
    
    const regexBookName = regex_book_name_tmpl
        .replace('MIN_MID', String(minMid))
        .replace('END_LETTER', endLetter)
    
    return {
        complete: regex_book_num_prefix + regexBookName + regex_verse_range + regex_trailing,
        bookCheck: regex_between_ranges + '(' + regex_book_num_prefix + regexBookName + ')',
        additional: regex_additional_range
    }
}

/**
 * Create a reference parser
 * @returns {function(string): PassageReference|null} Parser function
 */
const createReferenceParser = () => (value) => 
    PassageReference.fromString(value)

/**
 * Process additional ranges after a main reference
 * @param {string} text - Text to search
 * @param {PassageReference} mainRef - Main reference
 * @param {RegExp} regex - Main regex
 * @param {ReturnType<typeof buildRegexPattern>} patterns - Regex patterns
 * @param {function(string): PassageReference|null} parseReference - Reference parser
 * @param {number} endOfPrevMatch - End position of previous match
 * @returns {Generator<{match: PassageReferenceMatch, newEndIndex: number}>} Additional matches
 */
const processAdditionalRanges = function*(
    text,
    mainRef,
    regex,
    patterns,
    parseReference,
    endOfPrevMatch
) {
    const addRegex = new RegExp(patterns.additional, 'uiy')
    addRegex.lastIndex = regex.lastIndex
    
    while (true) {
        // Check for book look-ahead
        const bookLookAhead = new RegExp(patterns.bookCheck, 'uiy')
        bookLookAhead.lastIndex = addRegex.lastIndex
        const possibleBook = bookLookAhead.exec(text)
        
        if (possibleBook && parseReference(possibleBook[1])) {
            break
        }
        
        const addMatch = addRegex.exec(text)
        if (!addMatch) break
        
        const addMatchRealIndex = addMatch.index + addMatch[0].indexOf(addMatch[1])
        
        // Build prefix for additional reference
        let prefix = mainRef.book
        const hasVerseSep = new RegExp(regex_verse_sep).test(addMatch[1])
        if (!hasVerseSep && ['verse', 'range_verses', 'range_multi'].includes(mainRef.type)) {
            prefix += `${mainRef.end_chapter}:`
        }
        
        const addRef = parseReference(prefix + addMatch[1])
        if (!addRef || !addRef.args_valid) break
        
        const newEndIndex = addMatchRealIndex + addMatch[1].length
        
        yield {
            match: {
                ref: addRef,
                text: addMatch[1],
                index: addMatchRealIndex,
                index_from_prev_match: addMatchRealIndex - endOfPrevMatch,
                whole: false,
            },
            newEndIndex
        }
        
        // Update main regex position if needed
        if (addRegex.lastIndex > regex.lastIndex) {
            regex.lastIndex = addRegex.lastIndex
        }
    }
}

/**
 * Detect passage references in text using generator
 * @param {string} text - Text to search
 * @returns {Generator<PassageReferenceMatch, null, undefined>} Found references
 */
export function* detectReferencesGenerator(text) {
    
    const patterns = buildRegexPattern()
    const parseReference = createReferenceParser()
    const regex = new RegExp(patterns.complete, 'uig')
    
    let endOfPrevMatch = 0
    
    while (true) {
        const match = regex.exec(text)
        if (!match) return null
        
        const ref = parseReference(match[0])
        
        if (ref && ref.args_valid) {
            // Yield main reference
            yield {
                ref,
                text: match[0],
                index: match.index,
                index_from_prev_match: match.index - endOfPrevMatch,
                whole: true,
            }
            
            endOfPrevMatch = match.index + match[0].length
            
            // Process additional ranges
            for (const { match: additionalMatch, newEndIndex } of processAdditionalRanges(
                text, ref, regex, patterns, parseReference, endOfPrevMatch
            )) {
                yield additionalMatch
                endOfPrevMatch = newEndIndex
            }
        } else {
            // Backtrack to try next word if invalid match
            const charsToNextWord = match[0].indexOf(' ', 1)
            if (charsToNextWord >= 1) {
                regex.lastIndex -= (match[0].length - charsToNextWord - 1)
            }
        }
    }
}

/**
 * Detect passage references in text and return as array
 * @param {string} text - Text to search
 * @returns {PassageReferenceMatch[]} Found references
 */
export const detectReferences = (text) => [...detectReferencesGenerator(text)]

