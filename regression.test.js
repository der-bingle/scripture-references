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
