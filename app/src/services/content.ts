
import {BibleClient} from '@gracious.tech/fetch-client'

import {wait} from '@/services/utils'

import type {BibleIndex} from '@gracious.tech/fetch-search'
import type {BibleCollection, GetTranslationsItem, GetLanguagesItem,
} from '@gracious.tech/fetch-client'


const endpoint = import.meta.env.PROD ? 'https://v1.fetch.bible/' : 'http://localhost:8430/'


export const content = {
    client: new BibleClient({endpoints: [endpoint]}),
    // These will be set before app loads, so force types
    collection: null as unknown as BibleCollection,
    translations: null as unknown as Record<string, GetTranslationsItem>,
    languages: null as unknown as Record<string, GetLanguagesItem>,
    // This will exist when ready
    index: null as null|BibleIndex,
}


// Search the current index (waits for it to be ready if necessary)
export async function search(query:string){

    // Wait if index not ready yet (up to 4 seconds)
    for (let n = 0; n < 40 && !content.index; n++){
        console.warn("Waiting for search indexing")
        await wait(100)
    }

    if (content.index){
        return content.index.search(query)
    }
    return []
}
