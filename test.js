import assert from 'node:assert/strict'
import { transformReferences } from './src/index.js'

const toCanonicalReference = ({ ref }) => ref.toString()

const assertTransformsTo = (input, expected) =>
    assert.equal(transformReferences(toCanonicalReference, input), expected)

assertTransformsTo('1\u00a0Pet. 5:7', '1 Peter 5:7')
assertTransformsTo('Gen.\u202f1:31', 'Genesis 1:31')
assertTransformsTo('1\u202fCor. 12:3', '1 Corinthians 12:3')
assertTransformsTo('2\u00a0Tim 4:11', '2 Timothy 4:11')

assertTransformsTo('John 3:16', 'John 3:16')
assertTransformsTo(
    'Read Gen. 1:1, 1\u00a0Pet. 5:7, and John 3:16.',
    'Read Genesis 1:1, 1 Peter 5:7, and John 3:16.'
)

console.log('All scripture reference tests passed.')
