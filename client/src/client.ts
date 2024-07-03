
import {request} from './utils.js'
import {BibleCollection} from './collection.js'
import {BookCrossref} from './crossref.js'

import type {UsageOptions, UsageConfig} from './types'
import type {CrossrefData, DistManifest, OneOrMore} from './shared_types'


// The options available for configuring a BibleClient
export interface BibleClientConfig {

    /* A list of CDN endpoints to connect to that defaults to the official CDN
        (https://collection.fetch.bible/).
    You can optionally host your own fetch(bible) collection and use that instead, or you could
    use it in addition to the official CDN by listing it first.
    The values can be relative URLs but all must end in a slash.
    */
    endpoints?:string[]

    /* The endpoint desired for generic data like crossrefs, defaulting to the first endpoint. */
    data_endpoint?:string

    /* Configure how you'll be using Bible translations to automatically filter out those
        which have incompatible licenses. You can alternatively do this per translation when
        fetching actual passages.

        All options default to `false` which results in having access to the most translations.

         * `commercial`: `true` if you will use translations in a commercial manner
         * `attributionless`: `true` if you will be using Bible translations without including
                attribution to the owners
         * `limitless`: `true` if you will be using translations in full without any limitations
                to the number of verses that can be quoted
         * `derivatives`: `true` if you'll be modifying the translations, or `same-license` if
                you'll be sharing modifications under the same license as the original
     */
    usage?:UsageOptions

    /* Whether to store internally the results of `fetch_*` methods (default true).

    This client will auto-preserve the results of `fetch_*` methods to avoid duplicate network
    requests. This is convenient for most users but may result in a large use of memory if a
    significant amount of resources are requested. In such cases it is best to rely on service
    worker caching, or self-preserving frequently used results of requests.

    It is best practice to use service worker caching either way, as this will not only speed up
    runtime execution but also revisits to your app.

    Note that `fetch_collection()` results will always be preserved due to its frequency of use.
    */
    remember_fetches?:boolean
}


// A client for interacting with a fetch(bible) CDN
export class BibleClient {

    // @internal
    _endpoints:string[]
    // @internal
    _data_endpoint:string
    // @internal
    _usage:UsageConfig = {
        commercial: false,
        attributionless: false,
        limitless: false,
        derivatives: false,
    }
    // @internal
    _remember_fetches:boolean
    // @internal
    _collection_promise:Promise<BibleCollection>|undefined
    // @internal
    _crossref_cache:Record<string, Promise<BookCrossref>> = {}
    // Synchronous access to collection if it has already been fetched with `fetch_collection()`
    collection:BibleCollection|undefined

    // Create a new BibleClient, defaulting to the official fetch(bible) collection
    constructor(config:BibleClientConfig={}){
        this._endpoints = config.endpoints ?? ['https://collection.fetch.bible/']
        this._data_endpoint = config.data_endpoint ?? this._endpoints[0]!
        this._usage = {...this._usage, ...config.usage}
        this._remember_fetches = config.remember_fetches !== false
    }

    // Fetch the collection's manifest and return a BibleCollection object for interacting with it
    async fetch_collection():Promise<BibleCollection>{

        // If have already requested, return previous promise (this.collection may not be ready yet)
        if (this._collection_promise){
            return this._collection_promise
        }

        // Request all manifests and combine into a single BibleCollection instance
        this._collection_promise = Promise.all(this._endpoints.map(async endpoint => {
            return [
                endpoint,
                JSON.parse(await request(endpoint + 'bibles/manifest.json')) as DistManifest,
            ]
        })).then(manifests => {
            // Store instance in `this.collection` for synchronous access
            this.collection = new BibleCollection(this._usage, this._remember_fetches,
                manifests as OneOrMore<[string, DistManifest]>)
            return this.collection
        })

        // Clear promise var if unsuccessful so can retry if desired
        this._collection_promise.catch(() => {
            this._collection_promise = undefined
        })

        // Return the promise
        return this._collection_promise
    }

    // Fetch cross-reference data for a book
    async fetch_crossref(book:string, size:'small'|'medium'|'large'='medium'):Promise<BookCrossref>{

        // If existing request, return that
        const key = `${book} ${size}`
        if (key in this._crossref_cache){
            return this._crossref_cache[key]!
        }

        // Initiate request
        const url = this._data_endpoint + `crossref/${size}/${book}.json`
        const promise = request(url).then(data => {
            return new BookCrossref(JSON.parse(data) as CrossrefData)
        })

        // Cache request promise if desired
        if (this._remember_fetches){
            this._crossref_cache[key] = promise
            // Clear if unsuccessful so can retry if desired
            promise.catch(() => {
                delete this._crossref_cache[key]
            })
        }
        return promise
    }
}
