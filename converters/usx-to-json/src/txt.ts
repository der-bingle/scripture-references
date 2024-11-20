
import {parse_usx} from './common.js'
import {ignored_elements, ignored_para_styles, ignored_char_styles, ignored_note_styles,
    headings_major, headings_regular, headings_minor, non_para_para} from './elements.js'

import type {BibleJsonTxt, TxtContent} from './shared_types'


interface ParserState {
    chapter:number
    verse:number
    prev_para_type:'para'|'break'|null
    unknown_owner:TxtContent[]
    contents:BibleJsonTxt['contents']
}


export function usx_to_json_txt(xml:string, parser=DOMParser):BibleJsonTxt{

    // Parse USX
    const {usx_element, num_verses, book_code, book_name} = parse_usx(xml, parser)

    // Prepare state tracking
    const state:ParserState = {
        chapter: 0,
        verse: 0,
        prev_para_type: null,  // Whether previous para was not actually a para (e.g. poetry)
        unknown_owner: [],  // Content that should be prepended to next verse if current verse done
        // Prepare output with empty array for every verse
        contents: [
            [],  // Chapter 0
            ...num_verses.map(num_verses_in_ch => {
                const array = []
                // NOTE +1 for verse 0
                for (let i = 0; i < num_verses_in_ch + 1; i++){
                    array.push([])
                }
                return array
            }),
        ] as BibleJsonTxt['contents'],
    }

    // Iterate over <usx> children (elements only, text nodes not allowed at root level)
    for (const child of Array.from(usx_element.children)){

        // Get style for <para> in advance, as linebreaking logic needs it
        const style = child.getAttribute('style') || ''

        // Only know how many newlines to add once know next <para> type
        if (state.prev_para_type !== null){
            // Previously just added a <para> element
            if (state.prev_para_type === 'para' || !non_para_para.includes(style)){
                // Either previous was a para or current is, so add extra line break
                // i.e. Do not have two lines of poetry next to each other
                add_content(state, '\n')
            }
            // Reset para type until know that this para won't be ignored (adding too many newlines)
            state.prev_para_type = null
        }

        // Ignore extra-biblical elements
        if (ignored_elements.includes(child.nodeName)){
            continue
        }

        // Handle chapter markers
        // NOTE Paragraphs never flow over chapters in USX
        if (child.nodeName === 'chapter') {

            if (child.hasAttribute('eid')){
                continue  // Ignore chapter end markers
            }

            const chapter_number = parseInt(child.getAttribute('number') ?? '0', 10)
            if (chapter_number < 1 || chapter_number >= state.contents.length){
                throw new Error(`Chapter number isn't valid for the book: ${chapter_number}`)
            }
            if (chapter_number !== state.chapter + 1){
                throw new Error(`Chapter ${chapter_number} isn't +1 previous ${state.chapter}`)
            }
            state.chapter = chapter_number
            state.verse = 0
            continue
        }

        // Ignore any nodes before the first chapter marker
        if (state.chapter === 0){
            continue
        }

        // The only element type remaining should be <para>, so skip all others to keep logic simple
        // NOTE <para> elements cannot be nested
        if (child.nodeName !== 'para'){
            console.warn(`Ignoring non-para element at document root level: ${child.nodeName}`)
            continue
        }

        // Ignore extra-biblical content
        // NOTE <para style=b> only useful for forcing gap between poetry
        //      This is already achieved in newline logic above, so can now ignore it
        if (ignored_para_styles.includes(style) || style === 'b'){
            continue
        }

        // Detect major headings
        if (headings_major.includes(style)){
            add_content(state, {type: 'heading', contents: child.textContent!, level: 1}, true)
            continue
        }

        // Detect section headings
        if (headings_regular.includes(style)){
            add_content(state, {type: 'heading', contents: child.textContent!, level: 2}, true)
            continue
        }

        // Detect minor headings
        // NOTE Also classifying original superscriptions in psalms (`d`) as a minor heading
        //      Since most users wouldn't want them quoted as part of first verse
        if (headings_minor.includes(style) || (book_code === 'psa' && style === 'd')){
            add_content(state, {type: 'heading', contents: child.textContent!, level: 3}, true)
            continue
        }

        // All other styles are standard <p> elements, so start one
        process_contents(state, child.childNodes)
        add_content(state, '\n')  // Always add at least one newline after each <para>
        state.prev_para_type = non_para_para.includes(style) ? 'break' : 'para'
    }

    // Verify no content ended up in chapter 0 or a verse 0, as they should never be used
    if (state.contents[0]!.length){
        state.contents[0] = []
        console.warn(`Content exists before chapter 1 marker (${book_code})`)
    }
    for (let ch = 1; ch < state.contents.length; ch++){
        if (state.contents[ch]![0]!.length){
            state.contents[ch]![0] = []
            console.warn(`Content exists before verse 1 marker for chapter ${ch} (${book_code})`)
        }
    }

    return {
        book: book_code,
        name: book_name,
        contents: state.contents,
    }
}


// Process the contents of a node (nested or not) within a <para> element
function process_contents(state:ParserState, nodes:NodeListOf<ChildNode>){

    for (let index = 0; index < nodes.length; index++){
        const node = nodes[index]!

        // If first node is not a verse element, then any headings/etc being held in unknown_owner
        //     belong to current verse and not the next one
        if (index === 0 && node.nodeName !== 'verse'){
            state.contents[state.chapter]![state.verse]!.push(...state.unknown_owner)
            state.unknown_owner = []
        }

        // Handle text nodes
        if (node.nodeType === 3){
            add_content(state, node.textContent!)
        }

        // Ignore all other node types that aren't elements (e.g. comments), or on ignored list
        if (node.nodeType !== 1 || ignored_elements.includes(node.nodeName)){
            continue
        }
        const element = node as Element

        // Handle verse elements
        if (element.nodeName === 'verse'){

            // Ignore verse end markers
            // TODO Could ignore non-header content until next next start marker to be extra safe
            if (element.hasAttribute('eid')){
                continue
            }

            // Get the new verse number
            // NOTE If a range, stick everything in the first verse of the range (e.g. 17-18 -> 17)
            const new_number = parseInt(element.getAttribute('number')?.split('-')[0] ?? '0', 10)
            if (new_number < 0 || new_number >= state.contents[state.chapter]!.length){
                throw new Error(`Verse number isn't valid for the book: ${new_number}`)
            }
            if (new_number <= state.verse){
                throw new Error(`Verse ${new_number} is not greater than previous ${state.verse}`)
            }

            // Switch to new verse
            state.verse = new_number

            // Any unknown owner data is now known to belong to the new verse
            state.contents[state.chapter]![state.verse]!.push(...state.unknown_owner)
            state.unknown_owner = []
        }

        // Recurse through char elements
        // NOTE Not just getting textContent in case <note> or <verse> elements exist within
        if (element.nodeName === 'char'){
            // Some chars have non-biblical content
            if (ignored_char_styles.includes(element.getAttribute('style') ?? '')){
                continue
            }
            process_contents(state, element.childNodes)
        }

        // Transform note elements to note objects
        if (element.nodeName === 'note'){
            if (ignored_note_styles.includes(element.getAttribute('style') ?? '')){
                continue
            }
            // NOTE textContent will include all elements (so is immune to ignore lists)
            add_content(state, {type: 'note', contents: element.textContent!})
        }
    }
}


// Add content to current verse, possibly buffering if may belong to next verse
function add_content(state:ParserState, content:TxtContent, may_belong_to_next_verse=false):void{

    // Strip any newlines that might be present in the HTML but not intended to be a line break
    if (typeof content !== 'string'){
        content.contents = single_space(content.contents)
    }

    // Decide whether to add to unknown_owner or actual verse
    if (state.unknown_owner.length || may_belong_to_next_verse){
        add_or_join(state.unknown_owner, content)
    } else {
        add_or_join(state.contents[state.chapter]![state.verse]!, content)
    }
}


// Add verse content to an array, but join if it is a string and so was the previous item
function add_or_join(array:TxtContent[], item:TxtContent){
    if (typeof array.at(-1) === 'string' && typeof item === 'string'){
        array[array.length - 1] += item
    } else {
        array.push(item)
    }
}


// Ensure words are separated by a single space only
function single_space(text:string){
    return text.replaceAll('\n', ' ').replaceAll(/\s{2,}/g, ' ').trim()
}
