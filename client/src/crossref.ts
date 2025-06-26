
import {PassageReference} from '@gracious.tech/bible-references'

import type {CrossrefData} from './shared_types'


// Access to cross-reference data for a book
export class BookCrossref {

    _data:CrossrefData

    constructor(data:CrossrefData){
        this._data = data
    }

    // Get cross-references for given verse of book
    get_refs(reference:PassageReference):PassageReference[]
    get_refs(chapter:number, verse:number):PassageReference[]
    get_refs(ch_or_ref:number|PassageReference, verse=1):PassageReference[]{

        // Get chapter/verse from ref if given
        if (typeof ch_or_ref !== 'number'){
            verse = ch_or_ref.start_verse
            ch_or_ref = ch_or_ref.start_chapter
        }
        return this._data[ch_or_ref]?.[verse]?.map(crossref => {
            return new PassageReference({
                book: crossref[0],
                start_chapter: crossref[1],
                start_verse: crossref[2],
                end_chapter: crossref[3],
                end_verse: crossref[4],
            })
        }) ?? []
    }
}
