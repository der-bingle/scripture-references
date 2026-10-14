import assert from 'node:assert/strict'
import test from 'node:test'
import { book_names_english, detectReferences, detectSpokenReferences } from './src/index.js'

const summary = ({ text, index, end, ref, references, interpretation, reasons }) => ({
    text,
    index,
    end,
    ref: ref?.toString() ?? null,
    references: references.map((value) => value.toString()),
    interpretation,
    reasons,
})

const one = (source) => {
    const matches = detectSpokenReferences(source)
    assert.equal(matches.length, 1, source)
    assert.equal(matches[0].text, source.slice(matches[0].index, matches[0].end))
    return summary(matches[0])
}

test('single-chapter books use their implied first chapter', () => {
    const cases = [
        ['Jude three', 'Jude 1:3'],
        ['Jude verse three', 'Jude 1:3'],
        ['Jude 1:3', 'Jude 1:3'],
        ['Obadiah five', 'Obadiah 1:5'],
        ['Philemon six', 'Philemon 1:6'],
        ['Second John four', '2 John 1:4'],
        ['Second John 1:4', '2 John 1:4'],
        ['Third John seven', '3 John 1:7'],
    ]
    cases.forEach(([source, expected]) => {
        const found = one(source)
        assert.equal(found.ref, expected, source)
        assert.deepEqual(found.references, [expected], source)
        assert.equal(found.interpretation, 'explicit', source)
    })
    assert.deepEqual(one('Jude chapter three'), {
        text: 'Jude chapter three', index: 0, end: 18, ref: null,
        references: [], interpretation: 'invalid', reasons: ['chapter_out_of_bounds'],
    })
    assert.equal(one('Jude chapter one').ref, 'Jude')
})

test('spoken book names, mixed numbers, and cues resolve canonically', () => {
    const cases = [
        ['First Corinthians fifteen verses 56 and 57', '1 Corinthians 15:56-57'],
        ['Second Samuel chapter eighteen', '2 Samuel 18'],
        ['1 Samuel eighteen', '1 Samuel 18'],
        ['Two Corinthians 3:18', '2 Corinthians 3:18'],
        ['John chapter three verse sixteen through eighteen', 'John 3:16-18'],
        ['John chapter three verse sixteen through verse eighteen', 'John 3:16-18'],
        ['John chapter three verse sixteen through chapter four verse two', 'John 3:16-4:2'],
        ['John chapter three through chapter four verse two', 'John 3:1-4:2'],
        ['Romans chapter one', 'Romans 1'],
        ['Romans chapters three through five', 'Romans 3-5'],
        ['Psalm one hundred and nineteen verse one hundred and seventy six', 'Psalms 119:176'],
        ['John chapter twenty-one verse one', 'John 21:1'],
        ['the book of James', 'James'],
    ]
    cases.forEach(([source, expected]) => {
        const found = one(source)
        assert.equal(found.ref, expected, source)
        assert.equal(found.interpretation, 'explicit', source)
    })
})

test('every canonical book name is a valid spoken anchor', () => {
    Object.entries(book_names_english).forEach(([book, name]) => {
        const source = `${name} one`
        const found = one(source)
        assert.equal(found.index, 0, source)
        assert.equal(found.end, source.length, source)
        assert.equal(detectSpokenReferences(source)[0].ref.book, book, source)
    })
    const variants = [
        ['One Samuel chapter three', '1 Samuel 3'],
        ['1st Corinthians chapter fifteen', '1 Corinthians 15'],
        ['2nd Samuel chapter eighteen', '2 Samuel 18'],
        ['3rd John verse seven', '3 John 1:7'],
        ['the book of Acts', 'Acts'],
    ]
    variants.forEach(([source, expected]) => assert.equal(one(source).ref, expected, source))
})

test('verse lists keep members and do not invent intervening verses', () => {
    assert.deepEqual(one('First Corinthians fifteen verses 56 and 57').references, [
        '1 Corinthians 15:56', '1 Corinthians 15:57',
    ])
    const nonconsecutive = one('First Corinthians fifteen verses 56 and 58')
    assert.equal(nonconsecutive.ref, null)
    assert.deepEqual(nonconsecutive.references, [
        '1 Corinthians 15:56', '1 Corinthians 15:58',
    ])
    assert.equal(nonconsecutive.interpretation, 'explicit')
    assert.deepEqual(one('John chapter three verses sixteen, seventeen, and eighteen').references, [
        'John 3:16', 'John 3:17', 'John 3:18',
    ])
    assert.deepEqual(one('John chapter three verse sixteen and seventeen').references, [
        'John 3:16', 'John 3:17',
    ])
})

test('inference, ambiguity, and impossible references remain distinct', () => {
    assert.deepEqual(one('John three sixteen'), {
        text: 'John three sixteen', index: 0, end: 18, ref: 'John 3:16',
        references: ['John 3:16'], interpretation: 'inferred',
        reasons: ['uncued_chapter_verse'],
    })
    assert.equal(one('John twenty twenty').interpretation, 'ambiguous')
    assert.equal(one('John twenty twenty').ref, null)
    assert.deepEqual(one('John twenty twenty').references, [])
    assert.deepEqual(one('John chapter 999'), {
        text: 'John chapter 999', index: 0, end: 16, ref: null,
        references: [], interpretation: 'invalid', reasons: ['chapter_out_of_bounds'],
    })
    assert.equal(one('John chapter three verse 999').interpretation, 'invalid')
    assert.equal(one('Jude 26').interpretation, 'invalid')
    assert.deepEqual(one('John chapter three verse eighteen through sixteen').reasons, ['descending_range'])
    assert.equal(one('John chapter three verse').interpretation, 'ambiguous')
    assert.equal(one('John chapter three verse').ref, null)
    assert.deepEqual(one('John chapter').reasons, ['missing_chapter_number'])
    assert.deepEqual(one('Jude verse').reasons, ['missing_verse_number'])
})

test('ordinary prose does not become a Scripture reference', () => {
    [
        'the first two chapters in eighteen weeks',
        'Mark the first three items; the job took two hours',
        'John said three things about love',
        'Numbers are important in this job',
        'Mark three items are missing',
        'John three things happened yesterday',
    ].forEach((source) => assert.deepEqual(detectSpokenReferences(source), [], source))
})

test('spans preserve the exact input and stay ordered', () => {
    const source = '😀 Read Jude three, then\nSecond Samuel chapter eighteen.'
    const found = detectSpokenReferences(source)
    assert.deepEqual(found.map(({ text }) => text), ['Jude three', 'Second Samuel chapter eighteen'])
    assert.deepEqual(found.map(({ index }) => index), [8, 25])
    found.forEach(({ index, end, text }) => assert.equal(source.slice(index, end), text))
    assert.ok(found[0].end < found[1].index)
    assert.equal(source, '😀 Read Jude three, then\nSecond Samuel chapter eighteen.')
})

test('written and spoken scanners agree on an unchanged written phrase', () => {
    const source = 'John 3:16'
    const [written] = detectReferences(source)
    const [spoken] = detectSpokenReferences(source)
    assert.equal(spoken.text, written.text)
    assert.equal(spoken.index, written.index)
    assert.equal(spoken.ref.toString(), written.ref.toString())
})

test('a failed book phrase does not hide a later valid reference', () => {
    const source = 'John said three things. Read Romans chapter eight.'
    assert.deepEqual(detectSpokenReferences(source).map(({ text }) => text), ['Romans chapter eight'])
    assert.deepEqual(
        detectSpokenReferences('John chapter 999. Romans chapter eight.').map(({ interpretation }) => interpretation),
        ['invalid', 'explicit'],
    )
})
