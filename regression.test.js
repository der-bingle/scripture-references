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
