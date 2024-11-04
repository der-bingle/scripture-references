
import {last_verse} from '@gracious.tech/bible-references'


// Create parser for USX and return required elements for traversing doc
export function parse_usx(xml:string, parser:typeof DOMParser){

    // Create parser
    const doc = new parser().parseFromString(xml, 'application/xml')
    const usx_element = doc.documentElement as Element

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

    // Detect name of book
    // WARN Keep consistent with collector/src/parts/usx.ts
    const name_element = usx_element.querySelector(':root > para[style="toc2"]')
        ?? usx_element.querySelector(':root > para[style="h"]')
        ?? usx_element.querySelector(':root > para[style="toc1"]')
        ?? book_element

    // Return elements
    return {
        doc,
        usx_element,
        book_code,
        book_name: name_element.textContent ?? "Unknown",
        num_verses: last_verse[book_code]!,
    }
}
