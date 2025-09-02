import { describe, it, expect } from 'vitest'
import { transformReferences, toObsidianWikilink } from '../src/transform.js'

describe('transformReferences', () => {
  it('transforms single reference', () => {
    const text = "The most famous scripture is probably John 3:16."
    const result = transformReferences(text, toObsidianWikilink)
    expect(result).toBe("The most famous scripture is probably [[Bible/CSB/John 3#16|John 3:16]].")
  })

  it('transforms multiple references', () => {
    const text = "Compare John 3:16 with Romans 8:28 and Matthew 5:3."
    const result = transformReferences(text, toObsidianWikilink)
    expect(result).toBe("Compare [[Bible/CSB/John 3#16|John 3:16]] with [[Bible/CSB/Romans 8#28|Romans 8:28]] and [[Bible/CSB/Matthew 5#3|Matthew 5:3]].")
  })

  it('handles ranges by linking to first verse', () => {
    const text = "Read Genesis 1:1-3 for homework."
    const result = transformReferences(text, toObsidianWikilink)
    expect(result).toBe("Read [[Bible/CSB/Genesis 1#1|Genesis 1:1-3]] for homework.")
  })

  it('handles chapter ranges', () => {
    const text = "Study Matthew 5-7 this week."
    const result = transformReferences(text, toObsidianWikilink)
    expect(result).toBe("Study [[Bible/CSB/Matthew 5#1|Matthew 5-7]] this week.")
  })

  it('handles verse ranges within chapter', () => {
    const text = "The Beatitudes are in Matthew 5:3-12."
    const result = transformReferences(text, toObsidianWikilink)
    expect(result).toBe("The Beatitudes are in [[Bible/CSB/Matthew 5#3|Matthew 5:3-12]].")
  })

  it('handles book-only references', () => {
    const text = "The book of Philemon is short."
    const result = transformReferences(text, toObsidianWikilink)
    expect(result).toBe("The book of [[Bible/CSB/Philemon 1#1|Philemon]] is short.")
  })

  it('handles chapter-only references', () => {
    const text = "John 3 contains the famous verse."
    const result = transformReferences(text, toObsidianWikilink)
    expect(result).toBe("[[Bible/CSB/John 3#1|John 3]] contains the famous verse.")
  })

  it('preserves text without references', () => {
    const text = "This is just regular text without any references."
    const result = transformReferences(text, toObsidianWikilink)
    expect(result).toBe(text)
  })

  it('works with custom transform function', () => {
    const text = "See John 3:16 for details."
    const customTransform = (match) => `**${match.text}**`
    const result = transformReferences(text, customTransform)
    expect(result).toBe("See **John 3:16** for details.")
  })

  it('handles overlapping and adjacent references correctly', () => {
    const text = "Read John 3:16, 17 and then Romans 8:28."
    const result = transformReferences(text, toObsidianWikilink)
    expect(result).toBe("Read [[Bible/CSB/John 3#16|John 3:16]], [[Bible/CSB/John 3#17|17]] and then [[Bible/CSB/Romans 8#28|Romans 8:28]].")
  })
})

describe('toObsidianWikilink', () => {
  it('creates proper wikilink format', () => {
    const match = {
      ref: {
        getBookName: () => 'John',
        start_chapter: 3,
        start_verse: 16
      },
      text: 'John 3:16'
    }
    const result = toObsidianWikilink(match)
    expect(result).toBe('[[Bible/CSB/John 3#16|John 3:16]]')
  })

  it('handles ranges by using first verse in link', () => {
    const match = {
      ref: {
        getBookName: () => 'Genesis',
        start_chapter: 1,
        start_verse: 1,
        end_chapter: 1,
        end_verse: 3
      },
      text: 'Genesis 1:1-3'
    }
    const result = toObsidianWikilink(match)
    expect(result).toBe('[[Bible/CSB/Genesis 1#1|Genesis 1:1-3]]')
  })

  it('handles single chapter books', () => {
    const match = {
      ref: {
        getBookName: () => 'Philemon',
        start_chapter: 1,
        start_verse: 1
      },
      text: 'Philemon 1'
    }
    const result = toObsidianWikilink(match)
    expect(result).toBe('[[Bible/CSB/Philemon 1#1|Philemon 1]]')
  })
})