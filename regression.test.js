import assert from 'node:assert/strict'
import test from 'node:test'
import { detectBookCode, detectReferences, toObsidianWikilink } from './src/index.js'

test('f and ff references stay anchored at their starting verse and preserve source text', () => {
    for (const source of ['Romans 8:38f', 'Romans 8:38ff']) {
        const [match] = detectReferences(source)

        assert.ok(match, `${source} should be detected`)
        assert.equal(match.text, source)
        assert.equal(match.ref.toString(), 'Romans 8:38')
        assert.equal(toObsidianWikilink(match), `[[Bible/CSB/Romans 8#38|${source}]]`)
    }
})

test('Song of Solomon names resolve canonically to Song of Songs', () => {
    for (const source of ['Song of Solomon 1:4', 'Song of Sol. 1:4']) {
        const [match] = detectReferences(source)

        assert.ok(match, `${source} should be detected`)
        assert.equal(match.text, source)
        assert.equal(match.ref.toString(), 'Song of Songs 1:4')
        assert.equal(detectBookCode(source.slice(0, source.lastIndexOf(' '))), 'sng')
    }
})

test('Song resolves to Song of Songs though it prefixes several names of that one book', () => {
    assert.equal(detectBookCode('Song'), 'sng')
    for (const [source, ref] of [
        ['Song 1:2', 'Song of Songs 1:2'],
        ['Song 1:2–4', 'Song of Songs 1:2-4'],
    ]) {
        const [match] = detectReferences(source)
        assert.ok(match, `${source} should be detected`)
        assert.equal(match.text, source)
        assert.equal(match.ref.toString(), ref)
    }
    const [inText] = detectReferences('As Song 2:3 says, the vine is sweet.')
    assert.equal(inText.text, 'Song 2:3')
    assert.equal(inText.ref.toString(), 'Song of Songs 2:3')
})

test('short names that prefix several different books stay as they were', () => {
    const codes = {
        John: 'jhn', '1 John': '1jn', '1 Sam': '1sa', '1 Kings': '1ki', '1 Cor': '1co',
        Phil: 'php', Philem: 'phm', Jude: 'jud', Judges: 'jdg', Ps: 'psa', Psalms: 'psa',
    }
    for (const [name, code] of Object.entries(codes)) assert.equal(detectBookCode(name), code, name)
    for (const name of ['Sam', 'Kings', 'Cor', 'Tim', 'Pet']) assert.equal(detectBookCode(name), null, name)
})

test('"number 10" is the word, not the book of Numbers; "Numbers 10" and "Num 10" still are', () => {
    assert.deepEqual([...detectReferences('point number 10, then Number 11')], [])
    assert.equal(detectBookCode('number'), null)
    for (const source of ['Numbers 10', 'numbers 10', 'Num 10']) {
        assert.equal([...detectReferences(source)][0]?.ref.toString(), 'Numbers 10', source)
    }
})

test('lists inherit the most recent chapter and keep source spans', () => {
    const cases = [
        ['Proverbs 16:9 and 33', ['Proverbs 16:9', 'Proverbs 16:33']],
        ['Matthew 7:15-23; 24:10-11,24', ['Matthew 7:15-23', 'Matthew 24:10-11', 'Matthew 24:24']],
        ['Rev. 11:1-2; 12:6,14-17', ['Revelation 11:1-2', 'Revelation 12:6', 'Revelation 12:14-17']],
        ['John 14:1-5– 20:30-31', ['John 14:1-5', 'John 20:30-31']],
        ['John 3:16-4:2', ['John 3:16-4:2']],
        ['John 3:16 and Romans 8:28', ['John 3:16', 'Romans 8:28']],
    ]
    for (const [source, expected] of cases) {
        const matches = detectReferences(source)
        assert.deepEqual(matches.map(({ ref }) => ref.toString()), expected, source)
        matches.forEach((match, index) => {
            assert.equal(source.slice(match.index, match.index + match.text.length), match.text)
            const previousEnd = index ? matches[index - 1].index + matches[index - 1].text.length : 0
            assert.equal(match.index_from_prev_match, match.index - previousEnd)
        })
    }
})

test('single-reference parsing rejects lists and malformed numeric tails', async () => {
    const { PassageReference } = await import('./src/index.js')
    for (const source of ['John 1:1-5; 20:30-31', 'John 14:1-5– 20:30-31', 'John 3:16,18', 'Proverbs 16:9 and 33', 'John 3:16 garbage', 'John 3:16-17-18']) {
        assert.equal(PassageReference.fromString(source), null, source)
    }
})

test('oversized range ends clamp, but invalid starts and chapters remain invalid', async () => {
    const { PassageReference } = await import('./src/index.js')
    const [match] = detectReferences('1 Peter 5:1–40')
    assert.equal(match.text, '1 Peter 5:1–40')
    assert.equal(match.ref.toString(), '1 Peter 5:1-14')
    assert.equal(match.ref.args_valid, true)
    for (const source of ['1 Peter 5:40', '1 Peter 5:40-50', '1 Peter 6:1-40', 'John 3:16-99:40']) {
        assert.equal(PassageReference.fromString(source)?.args_valid, false, source)
    }
})
