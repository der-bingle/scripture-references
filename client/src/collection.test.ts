
import {describe, it} from 'vitest'

import {BibleCollection} from './collection.js'


describe('BibleCollection', () => {

    const collection = new BibleCollection({}, false, [['test', {
        translations: {},
        language2to3: {},
    }]])

    it("get_prev_verse", ({expect}) => {

        const gen_result = (chapter:number, verse:number) => {
            return {
                type: 'verse',
                range: false,
                book: '2th',
                start_chapter: chapter,
                start_verse: verse,
                end_chapter: chapter,
                end_verse: verse,
            }
        }

        expect(collection.get_prev_verse('2th', 1, 1)).toEqual(null)
        expect(collection.get_prev_verse('2th', 1, 2)).toEqual(gen_result(1, 1))
        expect(collection.get_prev_verse('2th', 2, 1)).toEqual(gen_result(1, 12))
        expect(collection.get_prev_verse({book: '2th', start_chapter: 2, start_verse: 1}))
            .toEqual(gen_result(1, 12))
        expect(collection.get_prev_verse({book: '2th', start_chapter: 1, start_verse: 1,
            end_chapter: 2, end_verse: 1}, true)).toEqual(gen_result(1, 12))
    })

    it("get_next_verse", ({expect}) => {

        const gen_result = (chapter:number, verse:number) => {
            return {
                type: 'verse',
                range: false,
                book: '2th',
                start_chapter: chapter,
                start_verse: verse,
                end_chapter: chapter,
                end_verse: verse,
            }
        }

        expect(collection.get_next_verse('2th', 1, 1)).toEqual(gen_result(1, 2))
        expect(collection.get_next_verse('2th', 1, 12)).toEqual(gen_result(2, 1))
        expect(collection.get_next_verse('2th', 3, 18)).toEqual(null)
        expect(collection.get_next_verse({book: '2th', start_chapter: 2, start_verse: 1}))
            .toEqual(gen_result(2, 2))
        expect(collection.get_next_verse({book: '2th', start_chapter: 1, start_verse: 1,
            end_chapter: 2, end_verse: 1}, true)).toEqual(gen_result(2, 2))
    })

    it("sanitize_reference", ({expect}) => {

        // Valid basic args
        expect(collection.sanitize_reference('2th')).toEqual({type: 'book', range: false,
            book: '2th', start_chapter: 1, start_verse: 1, end_chapter: 1, end_verse: 1})
        expect(collection.sanitize_reference('2th', 1)).toEqual({type: 'chapter', range: false,
            book: '2th', start_chapter: 1, start_verse: 1, end_chapter: 1, end_verse: 1})
        expect(collection.sanitize_reference('2th', 1, 1)).toEqual({type: 'verse', range: false,
            book: '2th', start_chapter: 1, start_verse: 1, end_chapter: 1, end_verse: 1})

        // Invalid basic args
        expect(collection.sanitize_reference('invalid')).toEqual({type: 'book', range: false,
            book: 'gen', start_chapter: 1, start_verse: 1, end_chapter: 1, end_verse: 1})
        expect(collection.sanitize_reference('2th', -1)).toEqual({type: 'chapter', range: false,
            book: '2th', start_chapter: 1, start_verse: 1, end_chapter: 1, end_verse: 1})
        expect(collection.sanitize_reference('2th', 99)).toEqual({type: 'chapter', range: false,
            book: '2th', start_chapter: 3, start_verse: 18, end_chapter: 3, end_verse: 18})
        expect(collection.sanitize_reference('2th', 2, -1)).toEqual({type: 'verse', range: false,
            book: '2th', start_chapter: 2, start_verse: 1, end_chapter: 2, end_verse: 1})
        expect(collection.sanitize_reference('2th', 2, 99)).toEqual({type: 'verse', range: false,
            book: '2th', start_chapter: 2, start_verse: 17, end_chapter: 2, end_verse: 17})

        // Valid range
        expect(collection.sanitize_reference(
            {book: '2th', start_chapter: 2, end_chapter: 3}
        )).toEqual({type: 'range_chapters', range: true,
            book: '2th', start_chapter: 2, start_verse: 1, end_chapter: 3, end_verse: 18}
        )
        expect(collection.sanitize_reference(
            {book: '2th', start_chapter: 2, start_verse: 1, end_chapter: 2, end_verse: 2}
        )).toEqual({type: 'range_verses', range: true,
            book: '2th', start_chapter: 2, start_verse: 1, end_chapter: 2, end_verse: 2}
        )
        expect(collection.sanitize_reference(
            {book: '2th', start_chapter: 1, start_verse: 1, end_chapter: 2, end_verse: 1}
        )).toEqual({type: 'range_multi', range: true,
            book: '2th', start_chapter: 1, start_verse: 1, end_chapter: 2, end_verse: 1}
        )

        // Simplify if range is really a single verse or a range of chapters
        // NOTE book/chapter types are for navigating to a position rather than specifying a range
        expect(collection.sanitize_reference(
            {book: '2th', start_chapter: 1, start_verse: 1, end_chapter: 1, end_verse: 1}
        )).toEqual({type: 'verse', range: false,
            book: '2th', start_chapter: 1, start_verse: 1, end_chapter: 1, end_verse: 1}
        )
        expect(collection.sanitize_reference(
            {book: '2th', start_chapter: 1, start_verse: 1, end_chapter: 2, end_verse: 17}
        )).toEqual({type: 'range_chapters', range: true,
            book: '2th', start_chapter: 1, start_verse: 1, end_chapter: 2, end_verse: 17}
        )

        // Invalid range
        expect(collection.sanitize_reference(
            {book: '2th', start_chapter: 2, end_chapter: 1}
        )).toEqual({type: 'chapter', range: false,
            book: '2th', start_chapter: 2, start_verse: 1, end_chapter: 2, end_verse: 1}
        )
        expect(collection.sanitize_reference(
            {book: '2th', start_chapter: 2, start_verse: 1, end_chapter: 2, end_verse: 99}
        )).toEqual({type: 'range_verses', range: true,
            book: '2th', start_chapter: 2, start_verse: 1, end_chapter: 2, end_verse: 17}
        )

        // Sanitizing again does not change values
        expect(collection.sanitize_reference(collection.sanitize_reference({book: '2th'})))
            .toEqual({type: 'book', range: false, book: '2th', start_chapter: 1, start_verse: 1,
            end_chapter: 1, end_verse: 1})
    })

    it("valid_reference", ({expect}) => {

        // Valid basic args
        expect(collection.valid_reference('2th')).toBe(true)
        expect(collection.valid_reference('2th', 1)).toBe(true)
        expect(collection.valid_reference('2th', 1, 1)).toBe(true)

        // Invalid basic args
        expect(collection.valid_reference('invalid')).toBe(false)
        expect(collection.valid_reference('2th', -1)).toBe(false)
        expect(collection.valid_reference('2th', 99)).toBe(false)
        expect(collection.valid_reference('2th', 2, -1)).toBe(false)
        expect(collection.valid_reference('2th', 2, 99)).toBe(false)

        // Valid range
        expect(collection.valid_reference({book: '2th', start_chapter: 2, end_chapter: 2}))
            .toBe(true)
        expect(collection.valid_reference({book: '2th', start_chapter: 2, end_chapter: 3}))
            .toBe(true)
        expect(collection.valid_reference({book: '2th',
            start_chapter: 2, start_verse: 1, end_verse: 2})).toBe(true)
        expect(collection.valid_reference({book: '2th',
            start_chapter: 2, start_verse: 1, end_chapter: 2, end_verse: 2})).toBe(true)

        // Invalid range
        expect(collection.valid_reference({book: '2th', start_chapter: 2, end_chapter: 1}))
            .toBe(false)
        expect(collection.valid_reference({book: '2th',
            start_chapter: 2, start_verse: 1, end_chapter: 2, end_verse: 99})).toBe(false)

        // Nonsensical args
        expect(collection.valid_reference({book: '2th', start_verse: 1})).toBe(false)
        expect(collection.valid_reference({book: '2th', start_chapter: 1, end_verse: 1}))
            .toBe(false)
        expect(collection.valid_reference({book: '2th',
            start_chapter: 1, start_verse: 1, end_chapter: 2})).toBe(false)
    })

    it("generate_passage_reference", ({expect}) => {

        const ref = {
            range: false,
            book: 'tit',
            start_chapter: 1,
            start_verse: 1,
            end_chapter: 1,
            end_verse: 1,
        }

        // Interpret reference type property
        expect(collection.generate_passage_reference({type: 'book', ...ref})).toBe('Titus')
        expect(collection.generate_passage_reference({type: 'chapter', ...ref})).toBe('Titus 1')
        expect(collection.generate_passage_reference({type: 'verse', ...ref})).toBe('Titus 1:1')
        expect(collection.generate_passage_reference({type: 'range_verses', ...ref,
            range: true, end_verse: 2})).toBe('Titus 1:1-2')
        expect(collection.generate_passage_reference({type: 'range_chapters', ...ref,
            range: true, end_chapter: 2})).toBe('Titus 1-2')
        expect(collection.generate_passage_reference({type: 'range_multi', ...ref,
            range: true, end_chapter: 2})).toBe('Titus 1:1-2:1')
    })

})
