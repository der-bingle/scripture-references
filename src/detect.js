import { detectReferences as detectPlain } from './detect_original.js'
import { normalizeRomanChapters, originalIndex } from './roman.js'

// Chapters in Roman numerals ("John vi. 37") are detected in the text with
// them rewritten, and each match is mapped back to its place in the original.
// `normalized_text` is the match as the parser read it ("John 6:37").
export const detectReferences = (text) => {
    const { text: normalized, edits } = normalizeRomanChapters(text)
    if (!edits.length) return detectPlain(text)
    let end = 0
    return detectPlain(normalized).map((match) => {
        const index = originalIndex(edits, match.index)
        const matched = String(text).slice(index, originalIndex(edits, match.index + match.text.length))
        const found = { ...match, text: matched, normalized_text: match.text, index, index_from_prev_match: index - end }
        end = index + matched.length
        return found
    })
}
