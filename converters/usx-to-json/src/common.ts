
import {last_verse} from '@gracious.tech/bible-references'


// Detect book and expected number of verses
export function get_num_verses(usx_element:Element){

    // Confirm was given a USX doc
    if (!usx_element || usx_element.nodeName !== 'usx') {
        throw new Error("Contents is not USX (missing <usx> root element)")
    }

    // Identity book so can determine expected chapter/verse numbers
    const book_element = usx_element.getElementsByTagName('book')[0]
    if (!book_element){
        throw new Error("USX is missing <book> element")
    }
    const book_code = book_element.getAttribute('code')?.toLowerCase()
    if (!book_code || !(book_code in last_verse)){
        throw Error(`Book code invalid: ${book_code!}`)
    }

    return last_verse[book_code]!
}
