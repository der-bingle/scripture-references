import { detectReferences as detectReferencesGenerator } from './detect.js'

/**
 * Detect passage references in text and return as array
 * @param {string} text - Text to search
 * @returns {PassageReferenceMatch[]} Found references
 */
export const detectReferences = (text) => [...detectReferencesGenerator(text)]

