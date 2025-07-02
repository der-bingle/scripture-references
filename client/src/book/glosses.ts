
import {rm_diacritics} from '../assets/utils.js'

import type {PassageReference} from '@gracious.tech/bible-references'
import type {GlossesData, GlossesDataWord} from '../assets/shared_types'


interface GlossesWord extends GlossesDataWord {
    original:string
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
            .map(w => ({
                ...w,
                // NOTE Hebrew is unicase, but harmless...
                original: rm_diacritics(w.word).toUpperCase(),
            }))
    }
}
