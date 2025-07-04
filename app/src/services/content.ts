
import {FetchClient} from '@gracious.tech/fetch-client'
import {strip_tags_and_commentary} from '@gracious.tech/fetch-search'

import {state} from './state'

import type {BibleIndex} from '@gracious.tech/fetch-search'
import type {FetchCollection, GetResourcesItem, GetLanguagesItem, SearchWords,
    BibleBookHtml} from '@gracious.tech/fetch-client'


const endpoint = import.meta.env.PROD ? 'https://v1.fetch.bible/' : 'http://localhost:8430/'


export const content = {
    client: new FetchClient({endpoints: [endpoint]}),
    // These will be set before app loads, so force types
    collection: null as unknown as FetchCollection,
    translations: null as unknown as Record<string, GetResourcesItem>,
    languages: null as unknown as Record<string, GetLanguagesItem>,
    // These will be set before app loads, but resolve when complete
    // TODO Should `index` be in state since it changes and the rest here don't?
    index: null as unknown as Promise<BibleIndex>,
    search_orig_ot: null as unknown as Promise<SearchWords>,
    search_orig_nt: null as unknown as Promise<SearchWords>,
}


// Search the current index (waits for it to be ready if necessary)
export async function search_translation(){
    const index = await content.index
    state.search_results = await index.search(state.search)
}

export async function search_orig(){

    // Set on state object now so that it can update as texts load
    // WARN Decouple var so if search changes it will not update the new array if still going
    state.search_results = []
    const results = state.search_results

    // Collect books as they load to avoid refetching
    const books:Record<string, BibleBookHtml> = {}

    // Work out which index to look through
    const testament =
        await (state.search_orig?.ot ? content.search_orig_ot : content.search_orig_nt)

    // Fetch text for each result
    const tokens = state.search_orig!.words.map(w => w[state.search_orig_mode])
    // TODO Work out how to virtual scroll for unlimited results
    for (const result of testament.search(...tokens).slice(0, 25)){

        // Ensure book in available
        const book = result.verse.book
        if (! (book in books)){
            books[book] = await content.collection.bibles.fetch_book(state.trans[0], book)
        }

        // Get text from book
        const verse_html = books[book]!.get_verse(result.verse.start_chapter,
            result.verse.start_verse, {attribute: false})

        // Add to list
        results.push({
            ref: result.verse,
            contents: strip_tags_and_commentary(verse_html),
        })
    }
}


// Change the translations in use while ensuring ids are valid
export function update_trans(requested:string[]):void{

    // Filter down to only valid ids
    const valid_trans = requested.filter(code => code in content.translations)

    // Update state with valid ids, or otherwise the default preferred translation
    state.trans = valid_trans.length ? (valid_trans as [string, ...string[]])
        : [content.collection.bibles.get_preferred_resource().id]
}
