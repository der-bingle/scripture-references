
import {rm_diacritics} from '../assets/utils.js'

import type {PassageReference} from '@gracious.tech/bible-references'
import type {GlossesData} from '../assets/shared_types'


export interface GlossesWord {
    word:string
    original:string
    gloss:string
}


export class GlossesBook {

    _data:GlossesData

    constructor(json:string){
        this._data = JSON.parse(json) as GlossesData
    }

    // Get words with glosses for given verse of book
    get_words(reference:PassageReference):GlossesWord[]
    get_words(chapter:number, verse:number):GlossesWord[]
    get_words(ch_or_ref:number|PassageReference, verse=1):GlossesWord[]{

        // Get chapter/verse from ref if given
        if (typeof ch_or_ref !== 'number'){
            verse = ch_or_ref.start_verse
            ch_or_ref = ch_or_ref.start_chapter
        }
        // NOTE Clones objects before returning
        return (this._data.contents[ch_or_ref]?.[verse] ?? [])
            .map(([word, gloss]) => ({
                word,
                gloss,
                // NOTE Hebrew is unicase, but harmless...
                original: strip_unoriginal_chars(word),
            }))
    }
}


// Get original word, without any diacritics or punctuation etc.
function strip_unoriginal_chars(word:string){

    // Remove diacritics
    word = rm_diacritics(word)

    // Make uppercase (for Greek)
    word = word.toUpperCase()

    // Remove all punctuation and non-orig chars
    // Greek \u0391-\u03A9 = Α Β Γ Δ Ε Ζ Η Θ Ι Κ Λ Μ Ν Ξ Ο Π Ρ Σ Τ Υ Φ Χ Ψ Ω
    // Hebrew \u05D0-\u05EA = א ב ג ד ה ו ז ח ט י כ ל מ נ ס ע פ צ ק ר ש ת
    word = word.replace(/[^\u0391-\u03A9\u05D0-\u05EA]+/g, '')

    return word
}
