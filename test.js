// example-usage.js
import { detectReferences, PassageReference, transformReferences, toObsidianWikilink } from './src/index.js'

// Basic usage - detect references in English text
const text = `
  In today's sermon, we'll explore John 3:16-17, which speaks of God's love.
  We'll also look at Romans 8:28 and compare it with Matthew 5:3-12.
  Don't forget to read Genesis 1:1-3 for homework.
  `

console.log('Detected references:')
const res = detectReferences(text)
console.log(res)

console.log('\nTransformed to Obsidian wikilinks:')
const transformed = transformReferences(toObsidianWikilink, text)
console.log(transformed)

// Example with simple text
console.log('\nSimple example:')
const simple = "The most famous scripture is probably John 3:16."
console.log('Original:', simple)
console.log('Transformed:', transformReferences(toObsidianWikilink, simple))