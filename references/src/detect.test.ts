
import {describe, it} from 'vitest'

import {detect_references} from './detect.js'


describe('detect_references', () => {

    it("Detects a single reference", ({expect}) => {
        expect(detect_references("Titus 2:3").next().value?.text).toBe("Titus 2:3")
    })

    it("Detects all reference types (except book)", ({expect}) => {
        for (const ref of ["Tit 2", "Tit 2:3", "Tit 2-3", "Tit 2:2-3", "Tit 2:2-3:3"]){
            expect(detect_references(ref).next().value?.text).toBe(ref)
        }
    })

    it("Does not detect whole books", ({expect}) => {
        expect(detect_references("Titus").next().value).toBe(null)
    })

    it("Does not detect invalid references", ({expect}) => {
        expect(detect_references("Titus 9").next().value).toBe(null)
    })

    it("Detects a reference deep in text", ({expect}) => {
        expect(detect_references("About Titus 2:3 and more").next().value?.text).toBe("Titus 2:3")
        expect(detect_references("About (Titus 2:3) and more").next().value?.text).toBe("Titus 2:3")
    })

    it("Detects multiple references", ({expect}) => {
        const text = "Multiple Gen 2:3 refs like John 3:16 and Matt 10:8"
        const detector = detect_references(text)
        expect(detector.next().value?.text).toBe("Gen 2:3")
        expect(detector.next().value?.text).toBe("John 3:16")
        expect(detector.next().value?.text).toBe("Matt 10:8")
    })

    it("Loops through multiple references", ({expect}) => {
        const text = "Multiple Gen 2:3 refs like John 3:16 and Matt 10:8"
        const results = ["Gen 2:3", "John 3:16", "Matt 10:8"]
        for (const ref of detect_references(text)){
            expect(ref.text).toBe(results.shift())
        }
    })

    it("Provides accurate indexing from last match", ({expect}) => {
        let text = "Multiple Gen 2:3 refs like John 3:16 and Matt 10:8"
        let result = ""
        const detector = detect_references(text)

        const ref1 = detector.next().value!
        expect(ref1.text).toBe("Gen 2:3")
        expect(ref1.index_from_prev_match).toBe(9)
        result += text.slice(0, ref1.index_from_prev_match) + "X"
        text = text.slice(ref1.index_from_prev_match + ref1.text.length)

        const ref2 = detector.next().value!
        expect(ref2.text).toBe("John 3:16")
        expect(ref2.index_from_prev_match).toBe(11)
        result += text.slice(0, ref2.index_from_prev_match) + "X"
        text = text.slice(ref2.index_from_prev_match + ref2.text.length)

        const ref3 = detector.next().value!
        expect(ref3.text).toBe("Matt 10:8")
        expect(ref3.index_from_prev_match).toBe(5)
        result += text.slice(0, ref3.index_from_prev_match) + "X"
        text = text.slice(ref3.index_from_prev_match + ref3.text.length)

        expect(detector.next().value).toBe(null)
        expect(result).toBe("Multiple X refs like X and X")
    })

    it("Detects relative references", ({expect}) => {

        const relative = (text:string, type:string, start_chapter:number, start_verse:number) => {
            const detector = detect_references(text)
            detector.next()
            const match = detector.next().value!
            expect(match.ref).toMatchObject({type, start_chapter, start_verse})
        }

        // Single number for chapter
        relative("Gen 1,6", 'chapter', 6, 1)
        relative("Gen 1-2,6", 'chapter', 6, 1)

        // Single number for verse
        relative("Gen 1:1,6", 'verse', 1, 6)
        relative("Gen 1:1-2,6", 'verse', 1, 6)
        relative("Gen 1:1-2:2,6", 'verse', 2, 6)

        // Chapter:verse
        relative("Gen 1,6:1", 'verse', 6, 1)
        relative("Gen 1-2,6:1", 'verse', 6, 1)
        relative("Gen 1:1,6:1", 'verse', 6, 1)
        relative("Gen 1:1-2,6:1", 'verse', 6, 1)
        relative("Gen 1:1-2:2,6:1", 'verse', 6, 1)
    })

    it("Allows 0-2 spaces between segments", ({expect}) => {
        expect(detect_references("Tit1:1-2:2").next().value?.ref.toString())
            .toBe("Titus 1:1-2:2")
        expect(detect_references("Tit  1  :  1  -  2  :  2").next().value?.ref.toString())
            .toBe("Titus 1:1-2:2")
        expect(detect_references("Tit   1:1-2:2").next().value).toBe(null)
    })
})
