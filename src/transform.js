import { pipe, reverse, reduce } from 'ramda'
import { detectReferences } from './detect.js'

/**
 * Transform all detected references in text using a transformation function
 * @param {string} text - Text containing references to transform
 * @param {function} transformFn - Function that takes a match object and returns transformed string
 * @returns {string} Text with all references transformed
 */
export const transformReferences = (text, transformFn) => pipe(
  detectReferences,           // Get all matches
  reverse,                   // Process from end to beginning to preserve indices
  reduce((acc, match) => {   // Transform text with each match
    const before = acc.slice(0, match.index)
    const after = acc.slice(match.index + match.text.length)
    const transformed = transformFn(match)
    return before + transformed + after
  }, text)
)(text)

/**
 * Transform reference match to Obsidian wikilink format
 * Links to first verse of ranges with full Bible/CSB/ path
 * @param {Object} match - Reference match object from detectReferences
 * @returns {string} Obsidian wikilink format
 */
export const toObsidianWikilink = (match) => {
  const ref = match.ref
  const displayText = match.text
  const bookName = ref.getBookName()
  const chapter = ref.start_chapter
  const verse = ref.start_verse
  
  // Always link to first verse, even for ranges
  const linkTarget = `Bible/CSB/${bookName} ${chapter}#${verse}`
  
  return `[[${linkTarget}|${displayText}]]`
}