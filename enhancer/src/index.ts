
import {BibleClient, passage_str_to_obj} from '@gracious.tech/fetch-client'

import type {BibleCollection} from '@gracious.tech/fetch-client/dist/esm/collection'
import type {PassageRef} from '@gracious.tech/fetch-client/dist/esm/extras'


// Form regex for identifying verse references in text
const book_num_prefix = '(?:(?:[123]|I{1,3}) ?)?'
const book_name = '[\\p{Letter}-]{2,18}\\.? ?'
const integer_with_opt_colon = '\\d{1,3}[abc]?(?: ?: ?\\d{1,3}[abc]?)?'
const verse_range = integer_with_opt_colon + '(?: ?\\p{Dash} ?' + integer_with_opt_colon + ')?'
const trailing = '(?!\\d)'
export const ref_regex = new RegExp(book_num_prefix + book_name + verse_range + trailing, 'uig')


export class BibleEnhancer {

    client:BibleClient
    collection:Promise<BibleCollection>
    app_origin:string
    app_div:HTMLDivElement
    app_iframe:HTMLIFrameElement
    history:boolean

    constructor(options:{client?:BibleClient, app_origin?:string, history?:boolean}={}){

        // Set defaults
        this.client = options.client ?? new BibleClient()
        this.collection = this.client.fetch_collection()
        this.app_origin = options.app_origin ?? 'https://app.fetch.bible'
        this.history = options.history !== false

        // Pre-generate app DOM so it is ready to go once user clicks a reference
        this.app_div = document.createElement('div')
        this.app_div.classList.add('fb-enhancer-app')
        this.app_iframe = document.createElement('iframe')
        this.app_iframe.src = `${this.app_origin}#back=true`
        this.app_div.appendChild(this.app_iframe)
        document.body.appendChild(this.app_div)
        this.app_div.addEventListener('click', () => {
            this.hide_app()
        })

        // Hide app when the back button (within app) is clicked
        self.addEventListener('message', event => {
            if (event.origin !== this.app_origin){
                return  // Website could get message from any source so ensure it's from fetch app
            }
            if ((event.data as {type:string})['type'] === 'back'){
                this.hide_app()
            }
        })

        // Whenever page changed, hide app (regardless if history option enabled or not)
        self.addEventListener('popstate', event => {
            this.app_div.classList.remove('fb-show')
        })
    }

    show_app(passage:PassageRef){
        // Show app and display given passage
        this.app_div.classList.add('fb-show')
        this.app_iframe.contentWindow?.postMessage({
            type: 'update',
            book: passage.book,
            verse: `${passage.chapter_start ?? 1}:${passage.verse_start ?? 1}`,
        }, this.app_origin)

        // Optionally push item to history so browser back hides app rather than changing page
        if (this.history){
            // NOTE fetch_enhancer_app isn't used, just given in case developer wants to identify it
            window.history.pushState({fetch_enhancer_app: true}, '')
        }
    }

    hide_app(){
        // Hide app
        this.app_div.classList.remove('fb-show')

        // If history enabled and current state is own, go back to non-app-showing state
        const owned = (window.history.state as null|Record<string, unknown>)?.['fetch_enhancer_app']
        if (this.history && !!owned){
            window.history.back()
        }
    }

    enhance_element(element:HTMLElement, ref:PassageRef){
        // Enhance an element by showing passage on hover and triggering app display on click

        // Open app when element is clicked
        element.addEventListener('click', event => {
            event.preventDefault()
            this.show_app(ref)
        })
