import { range, pipe, length } from 'ramda'
import { last_verse } from './last_verse.js'

/**
 * Get chapter numbers for a book using functional approach
 * @param {string} book - Bible book code
 * @returns {number[]} Array of chapter numbers
 */
export const getChapterNumbers = (book) => 
    pipe(
        () => last_verse[book],
        length,
        (len) => range(1, len + 1)
    )()

/**
 * Get verse numbers for a chapter using functional approach
 * @param {string} book - Bible book code
 * @param {number} chapter - Chapter number
 * @returns {number[]} Array of verse numbers
 */
export const getVerseNumbers = (book, chapter) =>
    pipe(
        () => last_verse[book][chapter - 1],
        (verseCount) => range(1, verseCount + 1)
    )()

