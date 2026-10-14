# Plan: detect spoken Scripture references

## Goal

Add a pure, opt-in `detectSpokenReferences(text)` API for finding Scripture references expressed in natural speech. It should work on text from dictation, subtitles, transcripts, notes, or other sources. It returns canonical references and exact spans of the input. It does not rewrite text, format links, decide what a caller should accept, or depend on any one transcription engine or application.

The API should recognize spoken book names, chapter and verse numbers, ranges, lists, and mixtures of words and digits. It should also expose ambiguity and invalid input rather than silently guessing or correcting it. The first parser profile is English; keep language-specific vocabulary and number grammar separate so other languages can be added without changing the result contract.

`detectReferences()` remains the existing written-reference API. The new detector has its own grammar, but both should use the same canonical book data and `PassageReference` model. A caller can use either detector or reconcile both outputs without receiving duplicate spans for the same phrase.

## Existing code to reuse and constraints to respect

- `src/detect_original.js` scans written references and returns `ref`, original `text`, and `index`. `src/detect.js` and `src/index.js` expose it. Keep that behavior compatible.
- `src/passage.js` holds book resolution and `PassageReference`. It already interprets numeric `Jude 3` as verse 3 of its implied first chapter. The same rule should apply to spoken `Jude three`, and likewise to Obadiah, Philemon, 2 John, and 3 John.
- `PassageReference` can clamp numbers outside a book's bounds. Validate the parsed numbers and range order before accepting a reference, then check `args_valid`; never return a clamped replacement for what the speaker said.
- `src/data.js` has canonical names and aliases. `detectBookCode()` also permits partial/fuzzy matches. Spoken scanning should start with complete names and reviewed aliases at word boundaries, because fuzzy matching inside free prose creates false positives.
- The checkout has unrelated edits in `src/data.js`, `src/detect_original.js`, and `test.js`, plus untracked files. Preserve them during implementation.

## Public result contract

```js
import { detectSpokenReferences } from 'scripture-references'

const candidates = detectSpokenReferences('Jude three and First Corinthians fifteen verses 56 and 57')
// First candidate:
// {
//   text: 'Jude three',
//   index: 0,
//   end: 10,                   // exclusive; input.slice(index, end) === text
//   ref: PassageReference(...), // Jude 1:3
//   references: [/* Jude 1:3 */],
//   interpretation: 'explicit',
//   reasons: [],
//   evidence: { /* observed book form, number form, and cues */ }
// }
```

Return an array ordered by `index`, with non-overlapping spans. Offsets use JavaScript string indices (UTF-16 code units). `text` is always the exact source slice, including its original spelling and spacing. Do not normalize the input or return offsets into a normalized copy.

`ref` is the single canonical passage represented by the phrase, or `null` if there is no safe single passage. `references` retains the individual references in a list. For “verses 56 and 57,” keep both members and allow `ref` to be their contiguous range. For “verses 56 and 58,” keep both members and set `ref: null`; verse 57 was not spoken. A range expressed with “through” remains a range rather than a list. Callers may use `ref`, `references`, or both according to their needs.

`interpretation` has four values:

- `explicit`: the words, together with fixed facts about a book, determine one reading. “Jude three” is explicit: Jude has one chapter, so 3 can only be its third verse. “Second Samuel chapter eighteen” is also explicit.
- `inferred`: a conventional reading exists but is not uniquely marked by cues, as in “John three sixteen.” Return the proposed `ref` and a reason such as `uncued_chapter_verse`.
- `ambiguous`: two or more plausible readings remain. Set `ref: null`, keep any resolved members or alternatives where useful, and explain the ambiguity with stable reason codes.
- `invalid`: the words specify an impossible reference, such as “John chapter 999.” Set `ref: null` and give a stable reason such as `chapter_out_of_bounds`.

These values describe **parse evidence**, not the accuracy of speech recognition and not a policy for displaying or accepting a result. Avoid a numerical confidence score until there is a labeled corpus suitable for calibration. Document stable reason codes and evidence fields. Prefer plain data for metadata so callers can serialize it; `PassageReference` values retain the library's existing object model.

Do not make the detector responsible for Markdown, HTML, links, audio timing, or any other source-specific structure. Consumers can select the text spans they want scanned and translate returned offsets to their own source representation. The detector itself must not mutate input or perform I/O.

## English recognition grammar

1. **Book anchors.** Match the longest complete canonical book name or reviewed alias at word boundaries. Handle `First`/`Second`/`Third`, `1st`/`2nd`/`3rd`, and digit prefixes for numbered books. Include `One`/`Two`/`Three` before numbered books as a documented speech/ASR variant, without treating those words as general book prefixes. Do not use fuzzy book correction as the default grammar.
2. **Numbers.** Parse digit tokens and compositional spoken numbers: ones, teens, tens, tens plus ones, and hundreds up to valid biblical chapter/verse bounds. Allow mixed words and digits within a phrase. Do not join isolated digits into a guessed year or silently interpret “oh,” “o,” and similar uncertain forms. Preserve such cases as ambiguous candidates when a book anchor makes them plausible references.
3. **Chapter and verse cues.** Recognize `chapter`, `chapters`, `verse`, `verses`, and written punctuation such as `:` when it appears in an otherwise spoken phrase. A full book plus one number normally denotes a chapter in a multi-chapter book. A full single-chapter book plus one number denotes a verse of chapter 1, with or without the word `verse`: “Jude three” and “Jude verse three” both mean Jude 1:3. “Jude chapter three” is invalid because that chapter does not exist; “Jude chapter one” denotes its sole chapter. Apply the same rule to the other single-chapter books.
4. **Ranges and lists.** Parse `through`, `to`, and dash as ranges when both endpoints fit the same book/chapter context; parse `and` or commas as lists when the phrase supplies a verse-list cue. Support a clearly stated cross-chapter range, such as “John chapter three verse sixteen through chapter four verse two.” Do not turn a nonconsecutive list into a range, or consume an unrelated conjunction as part of a reference.
5. **Book-only references.** Recognize strong book cues such as “the book of James” as book-level references. A bare title that is also a common word or person's name (“Mark,” “Job,” “Numbers,” “Acts,” “James,” “John”) needs surrounding reference grammar or a strong book cue. Do not produce a flood of candidates for ordinary mentions of those words.
6. **Boundaries and context.** Stop before trailing punctuation, a new book anchor, a sentence boundary, or ordinary prose. Use only local context with a bounded, documented window for omitted chapter/verse words; never infer a book from an unrelated earlier sentence. Leave room for a later context-aware API without making hidden discourse state part of `detectSpokenReferences(text)`.

Treat this as a grammar to test and refine, not a closed list of ASR quirks. Add fillers, repeats, self-corrections, and further aliases only when representative examples justify an explicit rule. Distinguish recoverable uncertainty from impossible references.

## Implementation steps

### 1. Specify behavior with table-driven tests

Add `node:test` fixtures that assert exact source spans, canonical `ref` and `references`, interpretation, and reason codes. Include positive, negative, ambiguous, and invalid cases. Verify `text === input.slice(index, end)`, sorted non-overlapping results, unchanged input, and that a rejected phrase does not hide a later valid one. Check UTF-16 offsets with an emoji before a match, plus punctuation, line breaks, mixed case, and multiple references in one paragraph.

| Input fragment | Expected result |
| --- | --- |
| `Jude three` and `Jude verse three` | explicit `Jude 1:3` in both cases |
| `Obadiah five`, `Philemon six`, `Second John four`, `Third John seven` | explicit verse of chapter 1 |
| `Jude chapter three` | invalid chapter; never reinterpret as verse 3 |
| `First Corinthians fifteen verses 56 and 57` | explicit `1 Corinthians 15:56–57`; two list members |
| `First Corinthians fifteen verses 56 and 58` | two members; no single range |
| `Second Samuel chapter eighteen` | explicit `2 Samuel 18` |
| `1 Samuel eighteen` | explicit `1 Samuel 18` |
| `Two Corinthians 3:18` | numbered book with mixed numeric form |
| `John chapter three verse sixteen through eighteen` | explicit `John 3:16–18` |
| `John three sixteen` | inferred `John 3:16` |
| `the book of James` | explicit book-level `James` |
| `John chapter 999` | invalid; no clamped chapter |
| `the first two chapters in eighteen weeks` | no candidate |
| `Mark the first three items; the job took two hours` | no candidate |

Also test each single-chapter book near its first and last verse, all numbered book families, descending ranges, out-of-bounds verses, nonadjacent lists, ambiguous spoken numbers, and overlap with the written detector. Keep the existing written-reference tests as a regression gate.

### 2. Implement a span-preserving scanner

Add a separate `src/detect_spoken.js`. Tokenize words, numbers, and relevant punctuation into immutable records carrying their original start/end offsets. Normalize token values only. From each book anchor, parse the longest bounded phrase with small pure functions for book forms, number words, chapter/verse grammar, and list/range grammar. On failure, resume scanning at the next possible anchor rather than swallowing the rest of a sentence.

Use canonical book codes to construct `PassageReference`s. Check the spoken values against chapter and verse limits and range ordering **before** accepting constructor output. Verify that the resulting fields match the source values and `args_valid` is true. Apply the single-chapter convention deliberately, based on book metadata, instead of a generic guess about missing chapters. Keep the parser deterministic, without network or model dependencies.

### 3. Resolve overlap with written references

Define a predictable relationship between the two APIs. `detectSpokenReferences()` should not require calling `detectReferences()`, but a shared helper can classify a phrase already wholly covered by the written grammar. When both detectors are used, a fully written reference should produce one canonical span; a larger spoken phrase should retain its own full span and meaning. Expose or document a small pure reconciliation function only if actual consumers need it, with tests for adjacent and overlapping spans. Do not silently change `detectReferences()` or `transformReferences()`.

### 4. Document and validate the general API

Export the function through `src/index.js` and document examples for plain strings and for callers that map returned offsets into a richer document. Specify the result schema, offset units, one-chapter behavior, list/range semantics, ambiguity codes, and unsupported forms. Keep formatting and acceptance decisions outside the library.

Test with a varied, labeled corpus of spoken-style text from more than one source type, including human dictation and machine transcripts where available. Label true references, hard-negative book/number contexts, and unresolved utterances; verify uncertain cases against the originating audio or writer when possible. Report precision and recall by pattern and source type, plus invalid/ambiguous counts. Use errors to refine the grammar without overfitting to one speaker or ASR engine. A release candidate should have no known silently corrected out-of-bounds references, exact offsets, stable result ordering, and no regression in written-reference detection. Record remaining unsupported patterns for later iterations.

## Completion criteria

- `detectSpokenReferences()` is exported as a pure, source-independent API and returns canonical results with exact source spans and documented interpretation metadata.
- Single-chapter book shorthand, including `Jude three`, resolves to verse 3 of chapter 1; explicit impossible chapter cues stay invalid.
- Tests cover the grammar, ambiguity, invalid bounds, list semantics, overlap, Unicode offsets, and representative negative prose. `node --test` and `node test.js` continue to pass.
- Documentation tells any caller how to use the results without requiring a particular formatter, transcription engine, or application.
