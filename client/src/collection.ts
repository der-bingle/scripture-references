
import {book_names_english, books_ordered, PassageReference, detect_references,
    english_abbrev_include, english_abbrev_exclude,
} from '@gracious.tech/bible-references'

import {BibleBook, BibleBookHtml, BibleBookUsx, BibleBookUsfm, BibleBookTxt} from './book.js'
import {filter_licenses} from './licenses.js'
import {deep_copy, fuzzy_search, request} from './utils.js'

import type {DistManifest, OneOrMore, TranslationLiteralness, TranslationTag} from './shared_types'
import type {UsageOptions, UsageConfig, RuntimeManifest, RuntimeLicense} from './types'


// No browser types since may be running in Node, so define as possibly existing
declare const self:{navigator: {language:string, languages: string[]}}|undefined


// Utils for forcing an interface's `object` property to be true or falsey
type ObjT<T> = Omit<T, 'object'> & {object:true}
type ObjF<T> = Omit<T, 'object'> & {object?:false}


// Types for collection methods

export interface GetLanguagesOptions {
    object?:boolean
    exclude_old?:boolean
    sort_by?:'local'|'english'|'population'|'population_L1'
    search?:string
}

export interface GetLanguagesItem {
    code:string
    local:string
    english:string
    pop:number|null
}

export interface GetTranslationsOptions {
    language?:string
    object?:boolean
    sort_by_year?:boolean
    usage?:UsageOptions
    // Basic filtering using combination of factors (manually filter for more fine-tuned results)
    exclude_obsolete?:boolean
    exclude_incomplete?:boolean
}

export interface GetTranslationsItem {
    // NOTE Keeps flat structure for better dev experience
    id:string
    language:string
    direction:'ltr'|'rtl',
    year:number
    name_local:string
    name_english:string
    name_abbrev:string
    attribution:string
    attribution_url:string
    licenses:RuntimeLicense[]
    tags:TranslationTag[]
    liternalness:TranslationLiteralness
}

export interface GetBooksOptions {
    object?:boolean
    sort_by_name?:boolean
    testament?:'ot'|'nt'
    whole?:boolean  // Include even those unavailable
}

export interface GetBooksItem {
    id:string
    name:string
    name_local:string  // WARN May be empty string
    name_english:string
    available:boolean
}

export interface GetCompletionReturn {
    ot:{
        available:string[]
        missing:string[]
    }
    nt:{
        available:string[]
        missing:string[]
    }
}


// Access to a collection's meta data, including languages and translations available
export class BibleCollection {

    // @internal
    _usage:UsageConfig
    // @internal
    _remember_fetches:boolean
    // @internal
    _fetch_book_cache:Record<string, Promise<BibleBook>> = {}
    // @internal
    _manifest:RuntimeManifest
    // @internal
    _endpoints:Record<string, string> = {}  // Map translation ids to endpoints
    // @internal
    _modern_year = new Date().getFullYear() - 70

    // @internal
    constructor(usage:UsageConfig, remember_fetches:boolean,
            manifests:OneOrMore<[string, DistManifest]>){
        // Merge the manifests given into a combined collection while remembering endpoints
        // WARN Original manifests are not dereferenced and assumed to not be used outside here

        this._usage = usage
        this._remember_fetches = remember_fetches

        // Start with an empty manifest with common metadata extracted from first manifest
        this._manifest = {
            licenses: manifests[0][1].licenses,  // Still useful even if resolved within transl.s
            languages: {},
            language2to3: {},
            // NOTE If first manifest is sparse then may not include all possible codes
            //      But this is a non-essential array just used to slightly improve sorting
            languages_most_spoken: manifests[0][1].languages_most_spoken,
            translations: {},
        }

        // Keep track of included languages as may be less than in collection due to usage config
        const languages = new Set()

        // Process manifests in reverse such that the first will have priority
        for (const [endpoint, manifest] of manifests.reverse()){

            // Loop through endpoint's translations
            for (const [trans, trans_data] of Object.entries(manifest.translations)){

                // Resolve licenses
                let licenses:RuntimeLicense[] = trans_data.copyright.licenses.map(item => {
                    if (typeof item.license === 'string'){
                        return {
                            id: item.license,
                            name: manifest.licenses[item.license]!.name,
                            restrictions: manifest.licenses[item.license]!.restrictions,
                            url: item.url,
                        }
                    } else {
                        return {
                            id: null,
                            name: "Custom license",
                            restrictions: item.license,
                            url: item.url,
                        }
                    }
                })

                // Remove licenses not compatible with the given usage restrictions
                licenses = filter_licenses(licenses, this._usage)
                if (!licenses.length){
                    continue  // No compatible licenses so exclude translation
                }
                languages.add(trans_data.language)

                // Add the translation to the combined collection
                this._manifest.translations[trans] = {
                    ...trans_data,
                    copyright: {
                        ...trans_data.copyright,
                        licenses,
                    },
                }

                // Remember which endpoint has which translation
                this._endpoints[trans] = endpoint
            }

            // Only add languages that have translations (may have been excluded if usage config)
            for (const lang in manifest.languages){
                if (languages.has(lang)){
                    this._manifest.languages[lang] = manifest.languages[lang]!
                }
            }
            for (const [lang2, lang3] of Object.entries(manifest.language2to3)){
                if (languages.has(lang3)){
                    this._manifest.language2to3[lang2] = manifest.language2to3[lang2]!
                }
            }
        }
    }

    // @internal
    _ensure_trans_exists(translation:string){
        // Util that throws if translation doesn't exist
        if (! this.has_translation(translation)){
            throw new Error(`Translation with id "${translation}" does not exist in collection(s)`)
        }
    }

    // @internal
    _ensure_book_exists(translation:string, book:string){
        // Util that throws if book doesn't exist
        this._ensure_trans_exists(translation)
        if (!books_ordered.includes(book)){
            throw new Error(`Book id "${book}" is not valid (should be 3 letters lowercase)`)
        }
        if (! this.has_book(translation, book)){
            throw new Error(`Translation "${translation}" does not have book "${book}"`)
        }
    }

    // Check if a language exists (must be 3 character id)
    has_language(language:string):boolean{
        return language in this._manifest.languages
    }

    // Check if a translation exists
    has_translation(translation:string):boolean{
        return translation in this._manifest.translations
    }

    // Check if a book exists within a translation
    has_book(translation:string, book:string):boolean{
        return this._manifest.translations[translation]?.books[book] !== undefined
    }

    // Get available languages as either a list or an object
    get_languages(options:ObjT<GetLanguagesOptions>):Record<string, GetLanguagesItem>
    get_languages(options?:ObjF<GetLanguagesOptions>):GetLanguagesItem[]
    get_languages({object, exclude_old, sort_by, search}:GetLanguagesOptions={}):
            GetLanguagesItem[]|Record<string, GetLanguagesItem>{

        // Start with list and dereference internal objects so manifest can't be modified
        let list = Object.entries(this._manifest.languages).map(([code, data]) => ({...data, code}))

        // Optionally exclude non-living languages
        if (exclude_old){
            list = list.filter(item => item.pop !== null)
        }

        // Optionally apply search
        if (search !== undefined){
            list = fuzzy_search(search, list, c => c.local + ' ' + c.english)
        }

        // Return object if desired
        if (object){
            return Object.fromEntries(list.map(item => [item.code, item]))
        }

        // Sort list and return it
        if (!search){
            if (sort_by === 'population_L1'){
                list.sort((a, b) => {
                    return (b.pop ?? -1) - (a.pop ?? -1)
                })
            } else if (sort_by === 'population'){
                // Sorting by total speakers (L1+L2) so need to consult extra array
                const item_to_pop = (item:typeof list[number]) => {
                    const most_spoken_i = this._manifest.languages_most_spoken.indexOf(item.code)
                    if (most_spoken_i !== -1){
                        // First in most spoken list needs largest number
                        // They all need to exceed 1 billion too, to override standard pop data
                        const list_len = this._manifest.languages_most_spoken.length
                        return (list_len - most_spoken_i) * 9999999999  // 10 billion - 1
                    }
                    return item.pop ?? -1  // Fallback on L1-only pop data
                }
                list.sort((a, b) => {
                    return item_to_pop(b) - item_to_pop(a)
                })
            } else {
                list.sort((a, b) => {
                    const name_key = sort_by === 'english' ? 'english' : 'local'  // Local default
                    return a[name_key].localeCompare(b[name_key])
                })
            }
        }
        return list
    }

    // Get the user's preferred available language (no arg required when used in browser)
    get_preferred_language(preferences:string[]=[]):string{

        // Default to navigator property when in browser
        if (preferences.length === 0 && typeof self !== 'undefined'){
            preferences = [...(self.navigator.languages ?? [self.navigator.language ?? 'eng'])]
        }

        // Loop through user's preferences (first is most preferred)
        for (let code of preferences){

            // Normalise the code to 2/3 lowercase char
            code = code.toLowerCase().split('-')[0] ?? ''

            // If 3 char exists use it
            if (code in this._manifest.languages){
                return code
            }

            // If 2 char mode known then return 3 char version
            if (code in this._manifest.language2to3){
                return this._manifest.language2to3[code]!
            }
        }

        // Default to English if available, else random language
        return 'eng' in this._manifest.languages ? 'eng' : Object.keys(this._manifest.languages)[0]!
    }

    // Get available translations as either a list or an object
    get_translations(options:ObjT<GetTranslationsOptions>):Record<string, GetTranslationsItem>
    get_translations(options?:ObjF<GetTranslationsOptions>):GetTranslationsItem[]
    get_translations({language, object, sort_by_year, usage, exclude_obsolete, exclude_incomplete}:
            GetTranslationsOptions={}):GetTranslationsItem[]|Record<string, GetTranslationsItem>{

        // Start with list of translations, extracting properties that don't need extra processing
        // NOTE Filters out translations not compatible with usage config
        // WARN Careful to unpack all objects so originals can't be modified
        let list = Object.entries(this._manifest.translations).map(([id, trans]) => {
            return {
                id,
                language: trans.language,
                direction: trans.direction,
                year: trans.year,
                name_local: trans.name.local,
                name_english: trans.name.english,
                name_abbrev: trans.name.abbrev,
                attribution: trans.copyright.attribution,
                attribution_url: trans.copyright.attribution_url,
                licenses: deep_copy(
                    filter_licenses(trans.copyright.licenses, {...this._usage, ...usage})),
                liternalness: trans.literalness,
                tags: [...trans.tags],
            } as GetTranslationsItem
        }).filter(trans => trans.licenses.length)

        // Optionally limit to single language
        if (language){
            list = list.filter(item => item.language === language)
        }

        // Optionally exclude obsolete translations (as long as better alternative exists)
        // For each test, only apply if 1 translation remains (else try other tests)
        if (exclude_obsolete){

            // First filter out very old translations
            const modern = list.filter(item => item.year >= this._modern_year)
            if (modern.length){
                list = modern
            }

            // Then try filter out obsolete-like tags
            for (const tag of ['archaic', 'questionable', 'niche'] as TranslationTag[]){
                const reduced_list = list.filter(item => !item.tags.includes(tag))
                if (reduced_list.length){
                    list = reduced_list
                }
            }
        }

        // Optionally exclude incomplete translations
        if (exclude_incomplete){
            list = list.filter(item => {
                const count = Object.keys(this._manifest.translations[item.id]!.books).length
                return count === books_ordered.length
            })
        }

        // Reform as object if desired
        if (object){
            return Object.fromEntries(list.map(item => [item.id, item]))
        }

        // Sort list and return it
        list.sort((a, b) => {
            return sort_by_year ? b.year - a.year : a.name_local.localeCompare(b.name_local)
        })
        return list
    }

    // Get user's preferred available translation (provide language preferences if not in browser)
    get_preferred_translation(languages:string[]=[]):string{

        // First get preferred language
        const language = this.get_preferred_language(languages)

        // Return recommended translation, or otherwise the most modern full translation
        let candidate:string|null = null
        let candidate_full = false
        let candidate_year = -9999
        for (const [id, data] of Object.entries(this._manifest.translations)){

            // Obviously must be desired language
            if (data.language === language){

                // If recommended, don't bother checking any others
                if (data.tags.includes('recommended')){
                    return id
                }

                // Consider as a candidate until something better comes up
                // NOTE Not considering tags as if any tagged then one would be recommended already
                const full = Object.keys(data.books).length === books_ordered.length
                if (
                    !candidate  // Something better than nothing
                    || (!candidate_full && full)  // Full translation better than partial
                    // Otherwise only consider if more modern
                    || (full && data.year > candidate_year)
                ){
                    candidate = id
                    candidate_year = data.year
                    candidate_full = full
                }
            }
        }

        // If no candidate for this language, just return the first translation whatever that is
        return candidate ?? Object.keys(this._manifest.translations)[0]!
    }

    // Get which books are available for a translation
    // If no translation is given, all books will be listed but marked as unavailable
    get_books(translation:string|undefined,
        options:ObjT<GetBooksOptions>):Record<string, GetBooksItem>
    get_books(translation?:string, options?:ObjF<GetBooksOptions>):GetBooksItem[]
    get_books(translation?:string, {object, sort_by_name, testament, whole}:GetBooksOptions={}):
            GetBooksItem[]|Record<string, GetBooksItem>{

        // Get book names from translation (or standard English if no translation given)
        let available = book_names_english
        if (translation){
            this._ensure_trans_exists(translation)
            available = this._manifest.translations[translation]!.books
        }

        // Create a list of the available books in traditional order
        const slice = testament ? (testament === 'ot' ? [0, 39] : [39]) : []
        const list = books_ordered.slice(...slice)
            .filter(id => whole || id in available)
            .map(id => {
                return {
                    id,
                    name: available[id] ?? book_names_english[id]!,
                    name_local: available[id] ?? '',
                    name_english: book_names_english[id]!,
                    available: !!translation && id in available,
                }
            })

        // Return as object if desired
        if (object){
            return Object.fromEntries(list.map(item => [item.id, item]))
        }

        // Optionally sort by name instead of traditional order
        if (sort_by_name){
            list.sort((a, b) => a.name.localeCompare(b.name))
        }

        return list
    }

    // Get the URL for a book's content (useful for caching and manual retrieval)
    get_book_url(translation:string, book:string, format:'html'|'usx'|'usfm'|'txt'='html'){
        const ext = ['html', 'txt'].includes(format) ? 'json' : format
        return `${this._endpoints[translation]!}bibles/${translation}/${format}/${book}.${ext}`
    }

    // Get book ids that are available/missing for a translation for each testament
    get_completion(translation:string):GetCompletionReturn{

        this._ensure_trans_exists(translation)

        // Form object that will be returned
        const data:GetCompletionReturn = {
            nt: {available: [], missing: []},
            ot: {available: [], missing: []},
        }

        // Look through books adding to either `available` or `missing`
        const trans_books = this._manifest.translations[translation]!.books
        let testament:'ot'|'nt' = 'ot'
        for (const book of books_ordered){
            if (book === 'mat'){
                testament = 'nt'  // Switch testament when reach Matthew (books ordered)
            }
            const status = book in trans_books ? 'available' : 'missing'
            data[testament][status].push(book)
        }

        return data
    }

    // Make request for the text for a book of a translation (returns object for accessing it)
    async fetch_book(translation:string, book:string, format?:'html'):Promise<BibleBookHtml>
    async fetch_book(translation:string, book:string, format:'usx'):Promise<BibleBookUsx>
    async fetch_book(translation:string, book:string, format:'usfm'):Promise<BibleBookUsfm>
    async fetch_book(translation:string, book:string, format:'txt'):Promise<BibleBookTxt>
    async fetch_book(translation:string, book:string, format:'html'|'usx'|'usfm'|'txt'='html'):
            Promise<BibleBook>{

        // Check args valid
        this._ensure_book_exists(translation, book)

        // Don't fetch if already have a result or request pending
        const key = `${translation} ${book} ${format}`
        if (key in this._fetch_book_cache){
            return this._fetch_book_cache[key]!
        }

        // Fetch book in desired format
        const promise = request(this.get_book_url(translation, book, format)).then(contents => {
            const format_class = {
                html: BibleBookHtml,
                usx: BibleBookUsx,
                usfm: BibleBookUsfm,
                txt: BibleBookTxt,
            }[format]
            return new format_class(contents, this._manifest.translations[translation]!.copyright)
        })

        // Cache request promise if desired
        if (this._remember_fetches){
            this._fetch_book_cache[key] = promise
            // Clear if unsuccessful so can retry if desired
            promise.catch(() => {
                delete this._fetch_book_cache[key]
            })
        }
        return promise
    }

    // @internal Auto-prepare args for from_string/detect_references based on translation
    _from_string_args(translation:string|string[]=[], always_detect_english=true){

        // Key by name so can support multiple names for single book and ensure no duplicate names
        const name_to_code:Record<string, string> = {}

        // Give first translations priority (JS orders keys by first assigned)
        const translations = typeof translation === 'string' ? [translation] : translation
        for (const trans of translations){
            this._ensure_trans_exists(trans)
            const books = this._manifest.translations[trans]!.books
            for (const [code, name] of Object.entries(books)){
                name_to_code[name] = code  // Reassigning shouldn't affect order of keys
            }
        }

        // Optionally add English last so is lowest priority
        if (always_detect_english){
            for (const [code, name] of Object.entries(book_names_english)){
                name_to_code[name] = code
            }
            for (const [code, name] of english_abbrev_include){
                name_to_code[name] = code
            }
        }

        // Return list reversed (code -> name) as expected by references module
        const book_names =
            Object.entries(name_to_code).map(([name, code]) => [code, name] as [string, string])

        // Languages with Chinese-like characters
        const chinese_like = [
            'zho',  // Chinese macrolanguage group
            'lzh', 'gan', 'hak', 'czh', 'cjy', 'cmn', 'mnp', 'cdo',  // Part of 'zho' group
            'nan', 'czo', 'cnp', 'cpx', 'csp', 'wuu', 'hsn', 'yue',  // Part of 'zho' group
            'jpn',  // Japanese
            'kor',  // Korean
        ]

        // Detect language as whatever first translation given has
        const lang = translations[0]?.split('_')[0] ?? 'eng'

        // Set args based on whether a Chinese script or not
        const exclude_book_names:string[]|undefined =
            lang === 'eng' ? [...english_abbrev_exclude] : []
        const min_chars:number = chinese_like.includes(lang) ? 1 : 2
        const match_from_start = !chinese_like.includes(lang)

        return [book_names, exclude_book_names, min_chars, match_from_start,
        ] as [[string, string][], string[], number, boolean]
    }

    // Detect bible references in a block of text using book names of given translation(s)
    // A generator is returned and can be passed updated text each time it yields a result
    detect_references(text:string, translation:string|string[]=[], always_detect_english=true){
        return detect_references(text,
            ...this._from_string_args(translation, always_detect_english))
    }

    // Parse a single bible reference string into a PassageReference object (validating it)
    // Supports only single passages (for e.g. Matt 10:6,8 use `detect_references`)
    string_to_reference(text:string, translation:string|string[]=[],
            always_detect_english=true){
        return PassageReference.from_string(text,
            ...this._from_string_args(translation, always_detect_english))
    }

    // Render a PassageReference object as a string using the given translation's book names
    reference_to_string(reference:PassageReference, translation?:string){
        let book_names = book_names_english
        if (translation){
            this._ensure_trans_exists(translation)
            book_names = this._manifest.translations[translation]!.books
        }
        return reference.toString(book_names)
    }
}
