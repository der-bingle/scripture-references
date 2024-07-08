// Watches that mix data sources

import {nextTick, watch} from 'vue'
import {PassageReference} from '@gracious.tech/fetch-client'

import {state} from './state'
import {content} from './content'
import {post_message} from './post'
import {wait} from './utils'


export function apply_search(){
    const match = content.collection.detect_references(state.search ?? '', state.trans).next().value
    if (match){
        state.book = match.ref.book
        state.chapter = match.ref.start_chapter
        state.verse = match.ref.start_verse
        state.passage = match.ref
    }
}


export function enable_watches(){

    // Cache entire translation whenever it changes
    watch(() => state.trans, async () => {

        // Avoid delaying render of whatever triggered this
        await wait(3000)

        // Trigger SW cache by fetching assets (and ignoring response)
        void self.caches.open('fetch-collection').then(cache => {
            for (const trans of state.trans){
                for (const book of content.collection.get_books(trans)){
                    const url = content.collection.get_book_url(trans, book.id, 'html')
                    void cache.match(url).then(resp => {
                        if (!resp){
                            void fetch(url)
                        }
                    })
                }
            }
        })
    }, {deep: true, immediate: true})


    // Auto-load content as translations/book changes
    watch([() => state.trans, () => state.book], async () => {

        // Reset content so don't show old while waiting to load
        state.offline = false
        state.content = ''
        state.content_verses = []
        state.crossref = null
        state.notes = null
        state.original = null

        // If first/primary trans doesn't have current book, change to a valid book
        if (!content.collection.has_book(state.trans[0], state.book)){
            state.book = content.collection.get_books(state.trans[0])[0]!.id
            return  // Will have triggered re-execution of this function
        }

        // Fetch book for each translation
        const books = await Promise.all(state.trans.map(async trans => {
            if (!content.collection.has_book(trans, state.book)){
                return null
            }
            try {
                return await content.collection.fetch_book(trans, state.book)
            } catch {
                state.offline = true
                return null
            }
        }))

        // If offline, no point updating content
        if (state.offline){
            return
        }

        // Start fetching study data now, so haven't delayed display of actual Scripture
        void content.client.fetch_crossref(state.book, 'small').then(crossref => {
            state.crossref = crossref
        })
        void fetch(`${content.client._data_endpoint}notes/eng_tyndale/html/${state.book}.json`)
            .then(async resp => {
                type RespJson = {verses: Record<string, Record<string, string>>}
                state.notes = (await resp.json() as RespJson)['verses']
            })
        const orig_trans = new PassageReference(state.book).ot ? 'hbo_wlc' : 'grc_sr'
        // TODO Only need to check has book since hbo_wlc lacking some books due to parsing issues
        if (content.collection.has_book(orig_trans, state.book)){
            void content.collection.fetch_book(orig_trans, state.book).then(book => {
                state.original = book
            })
        }

        // Get either plain HTML or separated verses
        if (books.length === 1){
            state.content = books[0]!.get_whole()
        } else {
            state.content_verses = books.map(book => {
                if (!book){
                    return []
                }
                const verses = book.get_list()
                // `get_list()` doesn't auto-add attribution so create fake verses for it
                verses.push({id: 0, chapter: 0, verse: 0, content: book.get_attribution()})
                return verses
            })
        }
    }, {deep: true, immediate: true})


    // Listen to messages from a parent frame
    // SECURITY Any origin can embed fetch(bible) so never trust the data
    self.addEventListener('message', event => {

        // Ensure data is always an object
        const data = (typeof event.data === 'object' ? event.data : {}) as Record<string, unknown>

        // Handle update commands
        // NOTE Also update initial load config in `state.ts` if any of these change
        if (data['type'] === 'update'){
            if (typeof data['dark'] === 'boolean' || data['dark'] === null){
                state.dark = data['dark']
            }
            if (typeof data['status'] === 'string'){
                state.status = data['status']
            }
            if (typeof data['color'] === 'string'){
                state.color = data['color']
            }
            if (typeof data['back'] === 'boolean' || typeof data['back'] === 'string'){
                state.back = data['back']
            }
            if (typeof data['button1_icon'] === 'string'){
                state.button1_icon = data['button1_icon']
            }
            if (typeof data['button1_color'] === 'string'){
                state.button1_color = data['button1_color']
            }
            if (typeof data['trans'] === 'string'){
                state.trans = data['trans'].split(',') as [string, ...string[]]
            }
            if (typeof data['search'] === 'string'){
                state.search = data['search']
                // Trigger parsing and then reset so search toolbar doesn't appear
                void nextTick(() => {
                    state.search = null
                })
            }
        }
    })


    // Report to parent whenever translations change
    watch(() => state.trans, () => {
        post_message('translation')
    }, {deep: true})


    // Report to parent whenever currently displayed verse changes
    watch([() => state.book, () => state.chapter, () => state.verse], () => {
        post_message('verse')
    })


    // Report to parent whenever dark changes
    watch(() => state.dark, () => {
        post_message('dark')
    })


    // Try to navigate to verse when search changes
    watch(() => state.search, apply_search)
}
