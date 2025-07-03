
import {PassageReference} from '@gracious.tech/bible-references'

import type {SearchData} from '../assets/shared_types'


export interface SearchWordsResults {
    verse:PassageReference
    word_indexes:number[]
}


// A generic class for searching any kind of representation of words over multiple books
// This can be used for a single book, a testament, or the whole Bible
// This can be used to search for strongs, lemmas, or original words
// WARN Searching both testaments will be wasteful unless both are using same language/codes
export class SearchWords {

    _books:Record<string, string[][][]>

    readonly id:string
    readonly source:string
    readonly source_url:string

    constructor(json:string){
        const data = JSON.parse(json) as SearchData
        this.id = data.id
        this.source = data.source
        this.source_url = data.url

        // Verses are encoded as space-separated string, so separate words
        this._books = Object.fromEntries(Object.entries(data.books).map(([book, chapters]) => {
            return [book, chapters.map(c => c.map(v => v ? v.split(' ') : []))]
        }))
    }

    // Get words for given verse reference (the values that represent the words that is)
    get_words_for_ref(ref:PassageReference):string[]{
        const words = this._books[ref.book]?.[ref.start_chapter]?.[ref.start_verse] ?? []
        return [...words]  // Prevent accidental modification
    }

    // Search for given values (i.e. strongs codes or lemmas)
    search(...values:string[]):SearchWordsResults[]{
        const results:SearchWordsResults[] = []

        // Make values to search for a set for slight performance boost
        const find = new Set(values)

        // Loop through books/chapters/verses
        for (const book in this._books){
            for (let chapter = 1; chapter < this._books[book]!.length; chapter++){
                for (let verse = 1; verse < this._books[book]![chapter]!.length; verse++){

                    // Collect indexes of matching words (to any value searching for)
                    const matched_indexes = []

                    // Add index of matching words
                    const words = this._books[book]![chapter]![verse]!
                    for (let word_i = 0; word_i < words.length; word_i++){
                        if (find.has(words[word_i]!)){
                            matched_indexes.push(word_i)
                        }
                    }

                    // Add to results if a word matched
                    if (matched_indexes.length){
                        results.push({
                            verse: new PassageReference(book, chapter, verse),
                            word_indexes: matched_indexes,
                        })
                    }
                }
            }
        }

        // Sort results by frequency
        results.sort((a, b) => {
            return b.word_indexes.length - a.word_indexes.length
        })

        return results
    }
}
