# Bible References

Bible reference detection, parsing, and rendering for English.

It's designed for use with [fetch(bible)](https://fetch.bible) but can be used independently of it. See it in action via the [fetch(bible) enhancer](https://fetch.bible/access/enhancer/).


```js
import { PassageReference, detectReferences, book_abbrev_english, transformReferences, toObsidianWikilink }
    from '@gracious.tech/bible-references'

// Simple args
const ref1 = new PassageReference('jhn', 3, 16)

// Complex args that can specify a range of verses
const ref2 = new PassageReference({
    book: 'jhn',
    start_chapter: 3,
    start_verse: 16,
    end_chapter: 3,
    end_verse: 17,
})

// Parse a string
const ref3 = PassageReference.fromString("John 3:16-17")

// Convert to string
console.log(`See ${ref1}`)  // Defaults to English ("See John 3:16")
console.log(new PassageReference('ezk').toString())  // Full names ("Ezekiel")

// Detecting references in a block of text
for (const match of detectReferences("Multiple refs like Gen 2:3 or John 3:16 and Matt 10:8")){
    console.log(match.text)  // "Gen 2:3", "John 3:16", "Matt 10:8"
}

// Transform references in text (function is curried for functional composition)
const text = "Read John 3:16 and Romans 8:28 today."
const transformed = transformReferences(toObsidianWikilink, text)
console.log(transformed)  // "Read [[Bible/CSB/John 3#16|John 3:16]] and [[Bible/CSB/Romans 8#28|Romans 8:28]] today."

// Functional composition with curried transformReferences
import { pipe } from 'ramda'
const toLinks = transformReferences(toObsidianWikilink)
const processText = pipe(
    // other text transformations...
    toLinks
)
```

Bible book codes are the [same as USX](https://ubsicap.github.io/usx/vocabularies.html#usx-vocab-bookcode) but lowercase.

See your editor's auto-suggestions or the source code for the variety of methods available for inspecting and manipulating references.
