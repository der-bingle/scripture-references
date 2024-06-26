
import {BibleClient, passage_str_to_obj} from '@gracious.tech/fetch-client'

import type {PassageRef} from '@gracious.tech/fetch-client/dist/esm/extras'


// Form regex for identifying verse references in text
const book_num_prefix = '(?:(?:[123]|I{1,3}) ?)?'
const book_name = '[\\p{Letter}\\p{Dash} ]{2,18}\\.? ?'
const integer_with_opt_colon = '\\d{1,3}[abc]?(?: ?: ?\\d{1,3}[abc]?)?'
const verse_range = integer_with_opt_colon + '(?: ?\\p{Dash} ?' + integer_with_opt_colon + ')?'
const trailing = '(?!\\d)'
const ref_regex = new RegExp(book_num_prefix + book_name + verse_range + trailing, 'uig')


export class BibleEnhancer {

    client:BibleClient
    _app_origin:string
    _app_div:HTMLDivElement
    _app_iframe:HTMLIFrameElement
    _history:boolean
    _translations:string[]
    _before_history_push:()=>void
    _hover_divs:[HTMLDivElement, PassageRef][] = []
    // Detect whether device can hover (without emulation)
    _can_hover = self.matchMedia('(hover: hover)').matches

    constructor(options:{client?:BibleClient, app_origin?:string, history?:boolean,
            translations?:string[], before_history_push?:()=>void}={}){

        // Set defaults
        this.client = options.client ?? new BibleClient()
        this._app_origin = options.app_origin ?? 'https://app.fetch.bible'
        this._history = options.history !== false
        this._translations = options.translations ?? []
        this._before_history_push = options.before_history_push ?? (() => {})

        // Pre-generate app DOM so it is ready to go once user clicks a reference
        this._app_div = document.createElement('div')
        this._app_div.classList.add('fb-enhancer-app')
        this._app_iframe = document.createElement('iframe')
        this._app_iframe.src = `${this._app_origin}#back=true&trans=${this._translations.join(',')}`
        this._app_div.appendChild(this._app_iframe)
        document.body.appendChild(this._app_div)
        this._app_div.addEventListener('click', () => {
            this.hide_app()
        })

        // Hide app when the back button (within app) is clicked
        self.addEventListener('message', event => {
            if (event.origin !== this._app_origin){
                return  // Website could get message from any source so ensure it's from fetch app
            }
            if ((event.data as {type:string})['type'] === 'back'){
                this.hide_app()
            }
        })

        // Whenever page changed, hide app (regardless if history option enabled or not)
        self.addEventListener('popstate', event => {
            this._app_div.classList.remove('fb-show')
        })
    }

    // Show app and display given passage
    show_app(passage:PassageRef){
        this._app_div.classList.add('fb-show')
        this._app_iframe.contentWindow?.postMessage({
            type: 'update',
            book: passage.book,
            verse: `${passage.chapter_start ?? 1}:${passage.verse_start ?? 1}`,
            trans: this._translations.join(','),
        }, this._app_origin)

        // Optionally push item to history so browser back hides app rather than changing page
        if (this._history){
            // NOTE fetch_enhancer_app isn't used, just given in case developer wants to identify it
            this._before_history_push()
            window.history.pushState({fetch_enhancer_app: true}, '')
        }
    }

    // Hide app
    hide_app(){
        this._app_div.classList.remove('fb-show')

        // If history enabled and current state is own, go back to non-app-showing state
        const owned = (window.history.state as null|Record<string, unknown>)?.['fetch_enhancer_app']
        if (this._history && !!owned){
            window.history.back()
        }
    }

    // Request and set passage contents of a hover div
    async _set_hover_contents(div:HTMLDivElement, ref:PassageRef){
        const collection = await this.client.fetch_collection()

        // If translation hasn't been set yet, choose sensible default
        if (!this._translations.length){
            this._translations = [collection.get_preferred_translation()]
        }

        let html = ''
        for (const trans of this._translations){
            const book = await collection.fetch_book(trans, ref.book)
            // Append custom attribution which is just the translation's abbreviation
            html += book.get_passage_from_obj(ref, {attribute: false})
                + `<p class='fb-attribution'>${book._translation.name.abbrev}</p>`
        }
        div.innerHTML = html
    }

    // Enhance an element by showing passage on hover and triggering app display on click
    enhance_element(element:HTMLElement, ref:PassageRef){

        // Open app when element clicked
        element.addEventListener('click', event => {
            event.preventDefault()  // Important if a link
            this.show_app(ref)
        })

        // The rest relates to hover box functionality, so skip if a touch device
        if (!this._can_hover){
            return
        }

        // Create hover box div
        const hover_box = document.createElement('div')
        this._hover_divs.push([hover_box, ref])
        hover_box.setAttribute('class',
            'fb-enhancer-hover fetch-bible no-chapters no-headings no-notes no-red-letter')

        // Request passage contents and fill div when ready
        void this._set_hover_contents(hover_box, ref)

        // Helper for removing the hover box from the DOM (fading out)
        let remove_timeout_id:number|undefined
        const rm_hover_box = () => {
            if (remove_timeout_id === undefined){  // Prevent creating multiple timeouts
                hover_box.style.opacity = '0'  // Start fading (via transition)
                remove_timeout_id = setTimeout(() => {
                    if (hover_box.parentNode){  // Ensure actually attached when time to rm
                        hover_box.parentNode.removeChild(hover_box)
                    }
                    remove_timeout_id = undefined  // Reset so will timeout again when reattached
                }, 400)  // WARN Update stylesheet transition if changed
            }
        }

        // Helper for cancelling any removal of the hover box
        const preserve_hover_box = () => {
            clearTimeout(remove_timeout_id)
            remove_timeout_id = undefined
            hover_box.style.opacity = '1'
        }

        // Attach the box to DOM when hover over the chosen element
        element.addEventListener('mouseenter', event => {

            // If hovering back over after leaving, just cancel any rm timeout
            if (hover_box.parentNode){
                preserve_hover_box()
            } else {
                // Instantly remove any other hover boxes for any other reference
                for (const body_child of document.body.children){
                    if (body_child.classList.contains('fb-enhancer-hover')){
                        document.body.removeChild(body_child)
                    }
                }
                // Position box under element and to right of cursor
                const rect = element.getBoundingClientRect()
                const hover_width = 350  // WARN Update stylesheet if change
                const max_left = document.documentElement.clientWidth - hover_width - 4
                hover_box.style.top = `${window.scrollY + rect.top + rect.height + 4}px`
                hover_box.style.left = `${Math.min(max_left, event.clientX + 4)}px`

                // Attach and ensure visible
                hover_box.style.opacity = '1'
                document.body.appendChild(hover_box)
            }
        })

        // Begin removal when stop hovering over element
        element.addEventListener('mouseleave', () => {
            rm_hover_box()
        })

        // Preserve box when hovering over the box itself
        hover_box.addEventListener('mouseenter', () => {
            preserve_hover_box()
        })
        hover_box.addEventListener('mouseleave', () => {
            rm_hover_box()
        })

        // Open app when click hover box
        hover_box.addEventListener('click', () => {
            this.show_app(ref)
        })
    }

    // Auto-discover references in text of page and transform into links
    async discover_bible_references(root:HTMLElement=document.body,
            filter:(element:Element) => boolean=e=>true, forget_existing=true){

        // Don't want to keep updating contents of divs that are no longer needed
        // But will want to preserve them if still visible and targeting a different area of page
        if (forget_existing){
            this._hover_divs = []
        }

        // Get book names so can parse references
        // Only use english names and first translation's names (as assumed to be primary language)
        const collection = await this.client.fetch_collection()
        if (!this._translations.length){
            this._translations = [collection.get_preferred_translation()]
        }
        const trans_books = collection.get_books(this._translations[0]!)
        const english_books = collection._manifest.book_names_english

        // Create DOM walker that will ignore subtrees identified by filter arg
        // NOTE Not excluding non-text nodes initially so can filter out whole subtrees if needed
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_ALL, node => {

            // Process all text nodes
            if (node.nodeType === node.TEXT_NODE){
                return NodeFilter.FILTER_ACCEPT
            }

            // Test all element nodes against user-supplied filter
            if (node.nodeType === node.ELEMENT_NODE){
                if (node.nodeName === 'A'){
                    return NodeFilter.FILTER_REJECT  // Ignore all existing links
                }
                return filter(node as Element) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
            }

            // Reject all other node types (comments etc.)
            return NodeFilter.FILTER_REJECT
        })

        // Util for getting offset and ref for next valid reference
        function next_ref(text_node:Text):[RegExpExecArray, PassageRef]|null{

            // Create fresh regex each time so lastIndex is new
            const fresh_regex = new RegExp(ref_regex)

            while (true){
                const match = fresh_regex.exec(text_node.textContent!)
                if (!match){
                    return null  // Either no matches or no valid matches...
                }

                // Confirm match is actually a valid ref
                let ref = passage_str_to_obj(match[0], trans_books)
                if (ref && ref.chapter_start !== null){  // No whole book refs
                    return [match, ref]
                }

                // Try english names as well since so common
                ref = passage_str_to_obj(match[0], english_books)
                if (ref && ref.chapter_start !== null){  // No whole book refs
                    return [match, ref]
                }

                // If invalid, try next word as match might still have included a partial ref
                // e.g. "in 1 Corinthians 9" -> "in 1" -> "1 Corinthians 9"
                const chars_to_next_word = match[0].indexOf(' ', 1)
                if (chars_to_next_word >= 1){
                    // Backtrack to exclude just first word of previous match
                    fresh_regex.lastIndex -= (match[0].length - chars_to_next_word - 1)
                }
            }
        }

        // Get all relevant text nodes in advance (as modifying DOM will interrupt walk)
        const nodes:[Text, RegExpExecArray, PassageRef][] = []  // [node, first_match, first_ref]
        while (walker.nextNode()){
            if (walker.currentNode.nodeType === Node.TEXT_NODE){
                const match = next_ref(walker.currentNode as Text)
                if (match){
                    nodes.push([walker.currentNode as Text, ...match])
                }
            }
        }

        // Util for turning a passage ref into an <a> element (returns trailing text node)
        const linkify_ref = (node:Text, match:RegExpExecArray, ref:PassageRef) => {

            // Separate ref text from preceeding text
            const ref_node = node.splitText(match.index)

            // Separate ref text from trailing text
            const remainder = ref_node.splitText(match[0].length)

            // Turn ref text into a link
            const ref_a = document.createElement('a')
            ref_a.setAttribute('href', `${this._app_origin}#trans=${this._translations.join(',')}`
                + `&book=${ref.book}&verse=${ref.chapter_start ?? 1}:${ref.verse_start ?? 1}`)
            ref_a.setAttribute('target', '_blank')
            ref_a.setAttribute('class', 'fb-enhancer-link')
            ref_a.textContent = match[0]
            ref_node.replaceWith(ref_a)

            // Enhance the new <a> element
            this.enhance_element(ref_a, ref)

            // Return newly-created trailing text node
            return remainder
        }

        // Modify collected text nodes
        for (const [orig_node, first_valid_match, first_valid_ref] of nodes){

            // Linkify the first match
            let remainder = linkify_ref(orig_node, first_valid_match, first_valid_ref)

            // Linkify any remaining matches too
            while (true){
                const next_ref_result = next_ref(remainder)
                if (next_ref_result){
                    remainder = linkify_ref(remainder, ...next_ref_result)
                } else {
                    break
                }
            }
        }
    }

    // Change translations used for hover boxes and app
    change_translation(...trans:string[]){
        this._translations = trans
        for (const [div, ref] of this._hover_divs){
            void this._set_hover_contents(div, ref)
        }
    }
}
