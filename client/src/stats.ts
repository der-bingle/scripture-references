
import {last_verse} from './data.js'


// Get chapter numbers for a book
export function get_chapters(book:string):number[]{
    // NOTE Need to +1 since chapter numbers are derived from place in last_verse array
    return [...Array(last_verse[book]!.length).keys()].map(i => i + 1)
}


// Get verse numbers for a chapter
export function get_verses(book:string, chapter:number):number[]{
    // WARN Position of each chapter is chapter-1 due to starting from 0
    return [...Array(last_verse[book]![chapter-1]).keys()].map(i => i + 1)
}
