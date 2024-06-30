
import type {CrossrefData} from './shared_types'


export interface CrossrefItem {
    book:string
    start_chapter:number
    end_chapter:number
    start_verse:number|null
    end_verse:number|null
    single_verse:boolean
}


// Access to cross-reference data for a book
export class BookCrossref {

    _data:CrossrefData

    constructor(data:CrossrefData){
        this._data = data
    }

    // Get cross-references for given verse of book
    get_refs(chapter:number, verse:number):CrossrefItem[]{
        return this._data[chapter]?.[verse]?.map(ref => {
            return {
                book: ref[0],
                start_chapter: ref[1],
                start_verse: ref[2],
                end_chapter: ref[3] ?? ref[1],
                end_verse: ref[4] ?? ref[2],
                single_verse: !!ref[2] && ref[3] === undefined,
            }
        }) ?? []
    }
}
