
import {FetchClient} from '@gracious.tech/fetch-client'

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
    // This will be set and resolve when index has fully loaded
    index: null as unknown as Promise<BibleIndex>,
}


// Search the current index (waits for it to be ready if necessary)
export async function search(query:string){
    const index = await content.index
    return index.search(query)
}
