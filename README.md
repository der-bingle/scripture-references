# Bible References

Functional Bible reference detection & parsing,


```js
import { PassageReference, detectReferences, book_abbrev_english, transformReferences, toObsidianWikilink }
    from 'scripture-references'

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

## Spoken references

`detectSpokenReferences(text)` recognizes English references written as they might be said aloud. It is a pure detector: it leaves the input alone and does not create links or depend on a transcription service.

```js
import { detectSpokenReferences } from 'scripture-references'

const text = 'Read Jude three, then First Corinthians fifteen verses 56 and 57.'
const matches = detectSpokenReferences(text)

for (const match of matches) {
    console.log(match.text, match.ref?.toString(), match.interpretation)
    // "Jude three" "Jude 1:3" "explicit"
    // "First Corinthians fifteen verses 56 and 57" "1 Corinthians 15:56-57" "explicit"
}
```

Results are ordered and non-overlapping. Each result has:

- `text`, `index`, `end`: the exact input slice, its UTF-16 start offset, and exclusive end offset. `text === input.slice(index, end)`.
- `ref`: one canonical `PassageReference`, or `null` when the phrase cannot be represented safely as one passage.
- `references`: the individual `PassageReference` members. A range has one member; a spoken list has one member per listed reference. Adjacent listed verses also yield a contiguous `ref`, while nonadjacent verses leave `ref` null.
- `interpretation`: `explicit`, `inferred`, `ambiguous`, or `invalid`. This describes the words' parse, not the reliability of the speaker or any speech recognizer.
- `reasons`: stable reason codes for inference, ambiguity, or invalid input. Current codes include `uncued_chapter_verse`, `uncued_repeated_tens`, `uncertain_spoken_number`, `missing_chapter`, `missing_chapter_number`, `missing_verse_number`, `chapter_out_of_bounds`, `verse_out_of_bounds`, `descending_range`, and `invalid_reference`.
- `evidence`: plain data containing `bookForm`, `numberForms` (`digits` or `spoken`), and observed `cues`.

“Jude three” means Jude 1:3 because Jude has one chapter. The same rule applies to Obadiah, Philemon, 2 John, and 3 John. An explicit impossible chapter such as “Jude chapter three” is returned as `invalid`; it is not reinterpreted as a verse. “John three sixteen” is returned as `inferred`, while “John chapter three verse sixteen” is `explicit`. “Verses 56 and 58” returns two members and no invented range.

`ambiguous` and `invalid` candidates have `ref: null` and an empty `references` array, so no uncertain interpretation appears as a resolved member.

The first version recognizes complete English book names, numbered-book word forms, `Psalm`, and `Song of Solomon`; compositional spoken numbers, chapter/verse cues, and common range/list wording. It does not correct misheard or misspelled book names, infer a book from distant context, or interpret document markup. Callers working with Markdown, HTML, subtitles, or timed transcripts should select the text they want scanned and map the returned offsets to their own source structure. When combining this with `detectReferences()`, compare source spans and keep one result for each overlapping written phrase.

Single-reference parsing accepts one numeric reference and returns `null` for
lists or malformed numeric tails. Use `detectReferences` for lists, including
comma, semicolon and `and` continuations. Each continuation inherits the most
recent chapter. A dash after a complete range can introduce another
chapter-and-verse reference (`John 14:1-5– 20:30-31`). Match text and offsets
always refer to the original input.

An oversized verse range end is clamped to its chapter's last verse
(`1 Peter 5:1–40` becomes `1 Peter 5:1-14`). Invalid starts or chapters still
fail `args_valid`. `f` and `ff` suffixes anchor to the starting verse and remain
in the match's display text; they do not imply a known range endpoint.
