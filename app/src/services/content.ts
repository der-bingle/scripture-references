
import {FetchClient} from '@gracious.tech/fetch-client'

import {state} from './state'

import type {BibleIndex} from '@gracious.tech/fetch-search'
import type {FetchCollection, GetResourcesItem, GetLanguagesItem,
} from '@gracious.tech/fetch-client'


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
export async function search(query:string){
    const index = await content.index
    return index.search(query)
}


// Change the translations in use while ensuring ids are valid
export function update_trans(requested:string[]):void{

    // Filter down to only valid ids
    const valid_trans = requested.filter(code => code in content.translations)

    // Update state with valid ids, or otherwise the default preferred translation
    state.trans = valid_trans.length ? (valid_trans as [string, ...string[]])
        : [content.collection.bibles.get_preferred_resource().id]
}
