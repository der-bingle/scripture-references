# Bible References

Bible reference detection, parsing, and rendering that supports any human language.

It's designed for use with [fetch(bible)](https://fetch.bible) but can be used independently of it. See it in action via the [fetch(bible) enhancer](https://fetch.bible/access/enhancer/).


```js

import {PassageReference, detect_references} from '@gracious.tech/bible-references'

// Simple args
const ref1 = new PassageReference('jhn', 3, 16)

// Complex args
const ref2 = new PassageReference({
    book: 'jhn',
    start_chapter: 3,
    start_verse: 16,
    end_chapter: 3,
    end_verse: 17,
})

// Parse string
const ref3 = PassageReference.from_string("John 3:16-17")

// i18n
const ref4 = PassageReference.from_string("Giăng 3.16-17", {jhn: "Giăng"})

// Convert to string
const ref1_str = `See ${ref1}`  // See John 3:16
const ref4_str = ref4.toString({jhn: "Giăng"}, '.')  // "Giăng 3.16-17"

// Detecting references in a block of text
for (const match of detect_references("Multiple refs like Gen 2:3 or John 3:16 and Matt 10:8")){
    console.log(match.text)  // "Gen 2:3", "John 3:16", "Matt 10:8"
}

```

Bible book codes are the [same as USX](https://ubsicap.github.io/usx/vocabularies.html#usx-vocab-bookcode) but lowercase.

See your editor's auto-suggestions or the source code for the variety of methods available for
inspecting and manipulating references. The [fetch(bible) client](https://fetch.bible/access/client/) will automatically supply the names of books from existing translations so that you don't have to. See methods:

 * `BibleCollection.detect_references(text, translation_id)`
 * `BibleCollection.string_to_reference(string, translation_id)`
 * `BibleCollection.reference_to_string(ref, translation_id)`
