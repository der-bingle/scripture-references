import assert from 'node:assert/strict'
import test from 'node:test'
import { PassageReference, detectReferences, transformReferences, toObsidianWikilink } from './src/index.js'
import { normalizeRomanChapters, romanToInteger } from './src/roman.js'

test('Roman numerals read as chapters up to 150, and only canonical ones', () => {
    assert.deepEqual(['i', 'iv', 'ix', 'xiv', 'xxxviii', 'xl', 'xc', 'cxix', 'cl'].map(romanToInteger), [1, 4, 9, 14, 38, 40, 90, 119, 150])
    for (const bad of ['iiii', 'vx', 'cli', 'ic', 'cc']) assert.equal(romanToInteger(bad), null, bad)
})

test('a chapter in lower-case Roman numerals parses and is detected as Arabic', () => {
    assert.equal(PassageReference.fromString('John vi. 37').toString(), 'John 6:37')
    const [match] = detectReferences('See Heb. xi. 6 for faith.')
    assert.equal(match.text, 'Heb. xi. 6')
    assert.equal(match.normalized_text, 'Heb. 11:6')
    assert.equal(match.index, 4)
    assert.equal(match.ref.toString(), 'Hebrews 11:6')
})

test('later verses of the chapter and later references keep their place in the original text', () => {
    const text = 'Read Acts iv. 2, 9; then 1 Cor. xv. 3-5 and Psalm cxix.105.'
    const found = detectReferences(text).map((match) => [match.text, match.ref.toString(), text.slice(match.index, match.index + match.text.length) === match.text])
    assert.deepEqual(found, [
        ['Acts iv. 2', 'Acts 4:2', true],
        ['9', 'Acts 4:9', true],
        ['1 Cor. xv. 3-5', '1 Corinthians 15:3-5', true],
        ['Psalm cxix.105', 'Psalms 119:105', true]
    ])
    assert.equal(transformReferences((match) => `<${match.ref.toString()}>`, 'Look at John vi. 37 now.'), 'Look at <John 6:37> now.')
    assert.equal(transformReferences(toObsidianWikilink, 'x John vi.44,65).').startsWith('x [['), true)
})

test('a numeral that no book precedes, or that is not followed by a verse, is left alone', () => {
    assert.equal(normalizeRomanChapters('Smith v. 3 was decided').edits.length, 0)
    assert.equal(normalizeRomanChapters('the case of John vi. The man').edits.length, 0)
    assert.equal(detectReferences('Smith v. 3 was decided').length, 0)
    assert.equal(detectReferences('John 3:16').length, 1)
})
