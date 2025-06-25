
import {reactive, computed, watch} from 'vue'
import {IndividualVerse, BookCrossref, PassageReference, PassageArgs, BibleBookHtml,
    book_names_english, book_abbrev_english} from '@gracious.tech/fetch-client'

import {parse_int} from './utils.js'

import type {SearchResult} from '@gracious.tech/fetch-search'


// LOCAL STORAGE


// Prefix all storage keys with the parent's origin so settings not shared between sites
// NOTE Firefox still doesn't support `ancestorOrigins` so fallback to sharing settings
const STORAGE_PREFIX =
    self.location.ancestorOrigins?.[0] ?? (self.parent === self ? self.location.origin : 'unknown')


export const local_storage = {
    // Wrap localStorage to prevent error throws when not available
    // NOTE Might not be available in incognito tabs, iframe cookie blocking, etc

    getItem(key:string):string|null{
        try {
            return localStorage.getItem(`${STORAGE_PREFIX} ${key}`)
        } catch {
            return null
        }
    },

    setItem(key:string, value:string):void{
        try {
            localStorage.setItem(`${STORAGE_PREFIX} ${key}`, value)
        } catch {
            // pass
        }
    },
}


// STATE

// Create media query for screen width
const wide_query = self.matchMedia('(min-width: 1000px)')


// Parse initial config from URL fragment
const params = new URLSearchParams(self.location.hash.slice(1))
// Will process this in `init.ts` so have access to collection etc.
export const initial_search_param = params.get('search')


// Init default state
const init_dark = params.get('dark') ?? local_storage.getItem('dark')
export const state = reactive({

    // CONFIGURABLE BY THIRD-PARTY
    // NOTE Also update message listener in `watches.ts` if any of these change

    // Settings
    dark: init_dark ? init_dark === 'true' : null,  // null = auto

    // Customise
    status: params.get('status') ?? '',
    hue: parse_int(params.get('hue') ?? '290'),
    saturation: parse_int(params.get('saturation') ?? '70'),
    back: (params.get('back') === 'true' || params.get('back')) ?? false,  // true|'url'|false
    button1_icon: params.get('button1_icon') ?? '',  // i.e. disabled
    button1_color: params.get('button1_color') ?? 'currentColor',

    // Passage
    // NOTE init.ts will ensure this has at least one translation before app loads
    trans: ((params.get('trans') ?? local_storage.getItem('trans'))?.split(',') ?? []
        ) as unknown as [string, ...string[]],
    search: '',

    // NOT DIRECTLY CONFIGURABLE BY THIRD-PARTY

    // Settings
    show_headings: local_storage.getItem('show_headings') !== 'false',
    show_chapters: local_storage.getItem('show_chapters') !== 'false',
    show_verses: local_storage.getItem('show_verses') !== 'false',
    show_notes: local_storage.getItem('show_notes') !== 'false',
    show_redletter: local_storage.getItem('show_redletter') !== 'false',
    font_size: local_storage.getItem('font_size') ?? 'regular',

    // Preserved state
    search_history: (local_storage.getItem('search_history') ?? '').split('\n').filter(i => i),

    // Temporary state
    book: 'gen',
    chapter: 1,  // Currently being viewed
    verse: 1,  // Currently being viewed
    passage: null as null|PassageReference,  // Targeted/highlighted ()
    offline: false,
    content: '',
    content_verses: [] as IndividualVerse<string>[][],
    book_names: {...book_names_english} as Record<string, string>,
    book_abbrev: {...book_abbrev_english} as Record<string, string>,
    show_nav: false,
    show_trans_dialog: false,
    show_style_dialog: false,
    show_about_dialog: false,
    wide: wide_query.matches,
    study: null as null|[string, number, number],
    crossref: null as BookCrossref|null,
    notes: null as Record<string, Record<string, string>>|null,
    original: null as BibleBookHtml|null,
    search_filter: null as null|'ot'|'nt'|'book',
    search_results: null as SearchResult[]|null,  // null = loading
})


// Update wide property whenever screen width changes
const wide_query_handler = (event:MediaQueryListEvent) => {
    state.wide = event.matches
}
if ('addEventListener' in wide_query){
    wide_query.addEventListener('change', wide_query_handler)
} else {
    // @ts-ignore Legacy code for Safari less than 14
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    wide_query.addListener(wide_query_handler)
}


// COMPUTES

// Array of language codes to match currently selected translations
export const langs = computed(() => {
    return state.trans.map(id => id.split('_')[0]!) as [string, ...string[]]
})

// Density value for toolbars etc
export const density = computed(() => {
    return state.wide ? 'default' : 'compact'
})

// Max-width for dialogs, so they don't look silly taking up whole screen
export const dialog_max_width = computed(() => {
    return state.wide ? '800px' : ''
})

// Safe HSL color for theme
export const safe_hsl = computed(() => {
    // NOTE values is state are forced to be numbers but not restricted in amount yet
    const safe_hue = parse_int(state.hue, 0, 360)
    const safe_sat = parse_int(state.saturation, 20, 80)  // Very high/low harder to see
    // NOTE lightness set slightly about 50% since dark mode needs more contrast than light mode
    return `hsl(${safe_hue}, ${safe_sat}%, 60%)`
})


// METHODS


// Change passage within same book
export const change_passage = (start_chapter:number, start_verse?:number|null,
        end_chapter?:number|null, end_verse?:number|null) => {
    state.chapter = start_chapter
    state.verse = start_verse ?? 1
    state.passage = new PassageReference(
        {book: state.book, start_chapter, start_verse, end_chapter, end_verse})
}


// Change book
export const change_book = (ref:PassageArgs) => {
    state.book = ref.book
    change_passage(ref.start_chapter ?? 1, ref.start_verse, ref.end_chapter, ref.end_verse)
}


// WATCHES

// Save some config to local_storage when it changes
watch(() => state.trans, () => {
    local_storage.setItem('trans', state.trans.join(','))
}, {deep: true})
watch([() => state.book, () => state.chapter, () => state.verse], () => {
    // NOTE Saving what search should be to reproduce the current view (not actual search value)
    // E.g. If user searched for "example" and then navigated to Gen 1:1, saved value is "gen1:1"
    // TODO Temporarily not saving verse so doesn't highlight it when reload
    local_storage.setItem('search', `${state.book}${state.chapter}`)
})
watch(() => state.dark, () => {
    local_storage.setItem('dark', String(state.dark))
})
watch(() => state.show_headings, () => {
    local_storage.setItem('show_headings', String(state.show_headings))
})
watch(() => state.show_chapters, () => {
    local_storage.setItem('show_chapters', String(state.show_chapters))
})
watch(() => state.show_verses, () => {
    local_storage.setItem('show_verses', String(state.show_verses))
})
watch(() => state.show_notes, () => {
    local_storage.setItem('show_notes', String(state.show_notes))
})
watch(() => state.show_redletter, () => {
    local_storage.setItem('show_redletter', String(state.show_redletter))
})
watch(() => state.font_size, () => {
    local_storage.setItem('font_size', state.font_size)
})
watch(() => state.search_history, () => {
    local_storage.setItem('search_history', state.search_history.join('\n'))
})
