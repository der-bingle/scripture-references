import { detectBookCode } from './passage.js'

// Older English prints a chapter in lower-case Roman numerals ("John vi. 37",
// "Heb. xi. 6,7", "Psalm cxix. 105"). A reference is read as the same text with
// the chapter in Arabic and the dot after it a colon ("John 6:37"); edits keep
// where each change sat so a match can point back into the original text.

const romanValues = Object.freeze({ i: 1, v: 5, x: 10, l: 50, c: 100 })

// "viii" → 8, null for anything that is not a canonical numeral up to 150
// (the longest book, Psalms): "iiii" and "vx" are not chapters.
export const romanToInteger = (numeral) => {
    const digits = [...numeral].map((letter) => romanValues[letter])
    const total = digits.reduce((sum, value, index) => sum + (value < (digits[index + 1] ?? 0) ? -value : value), 0)
    const canonical = [[100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']]
        .reduce(({ rest, text }, [value, letters]) => ({ rest: rest % value, text: text + letters.repeat(Math.floor(rest / value)) }), { rest: total, text: '' }).text
    return digits.every(Boolean) && total >= 1 && total <= 150 && canonical === numeral ? total : null
}

// A lower-case numeral, its dot and any spaces, right before a verse number.
// The word(s) before it must be a book: "Smith v. 3" is not a reference.
const candidate = /(?<=[\p{Letter}.]\s+)([ivxlc]{1,7})\.[  ]*(?=\d)/gu
const bookAhead = /(?:(?:[123]|I{1,3})[  ]?)?\p{Letter}[\p{Letter}.]*(?:[  ]\p{Letter}[\p{Letter}.]*){0,2}[  ]+$/u

const endsWithBook = (before) => {
    const words = before.match(bookAhead)?.[0]
    if (!words) return false
    // Try the shortest tail first, so "I read John" yields "John".
    const pieces = words.trimEnd().split(/[  ]+/)
    return pieces.some((_, start) => {
        const name = pieces.slice(start).join(' ')
        return /^\p{Letter}|^[123I]/u.test(name) && detectBookCode(name) !== null
    })
}

/**
 * Rewrite Roman-numeral chapters as Arabic ("John vi. 37" → "John 6:37").
 * @param {string} text - Text that may hold such references
 * @returns {{text: string, edits: {from: number, to: number, length: number}[]}} The new text, and each
 *   change as its span in the original and the length of what replaced it
 */
export const normalizeRomanChapters = (text) => {
    const source = String(text ?? '')
    const edits = []
    const pieces = []
    let last = 0
    for (const match of source.matchAll(candidate)) {
        const chapter = romanToInteger(match[1])
        if (!chapter || !endsWithBook(source.slice(0, match.index))) continue
        const replacement = `${chapter}:`
        pieces.push(source.slice(last, match.index), replacement)
        edits.push({ from: match.index, to: match.index + match[0].length, length: replacement.length })
        last = match.index + match[0].length
    }
    return { text: pieces.join('') + source.slice(last), edits }
}

/**
 * Where a position of the rewritten text sits in the original.
 * @param {{from: number, to: number, length: number}[]} edits - From normalizeRomanChapters
 * @param {number} position - Index into the rewritten text
 * @returns {number} Index into the original text
 */
export const originalIndex = (edits, position) => {
    const shift = edits.reduce(({ delta, done }, edit) => {
        const start = edit.from + delta
        if (done || position < start + edit.length) return { delta, done: true }
        return { delta: delta + edit.length - (edit.to - edit.from), done: false }
    }, { delta: 0, done: false }).delta
    return position - shift
}
