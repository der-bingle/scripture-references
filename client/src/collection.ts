
import {book_names_english, books_ordered, PassageReference, detect_references,
    english_abbrev_include, english_abbrev_exclude, book_abbrev_english,
} from '@gracious.tech/bible-references'

import {BibleBook, BibleBookHtml, BibleBookUsx, BibleBookUsfm, BibleBookTxt} from './book.js'
import {filter_licenses} from './licenses.js'
import {deep_copy, fuzzy_search, request} from './utils.js'
import {TranslationExtra} from './translation.js'

import type {BookNames, DistManifest, DistTranslationExtra, MetaCopyright, OneOrMore,
    MetaTag} from './shared_types'
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
    name_local:string
    name_english:string
    name_bilingual:string
    population:number|null
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
    attribution:string
    attribution_url:string
    licenses:RuntimeLicense[]
    tags:MetaTag[]
    // Local name of translation (falls back to English)
    name:string
    // Local abbreviation of translation (falls back to English)
    name_abbrev:string
    // English name of translation (may not exist)
    name_english:string
    // English abbreviation of translation (may not exist)
    name_english_abbrev:string
    // Local name of translation (may not exist)
    name_local:string
    // Local abbreviation of translation (may not exist)
    name_local_abbrev:string
    // Local name of translation with the English name in brackets when it differs
    name_bilingual:string
    // Local abbreviation of translation with the English abbreviation in brackets when it differs
    name_bilingual_abbrev:string
}

export interface GetBooksOptions {
    object?:boolean
    sort_by_name?:boolean
    testament?:'ot'|'nt'
    whole?:boolean  // Include even those unavailable
}

export interface GetBooksItem {
    id:string
    ot:boolean
    nt:boolean
    available:boolean
    // Local name of book (falls back to English)
    name:string
    // Local abbreviation of book (falls back to English)
    name_abbrev:string
    // English name of book (always exists)
    name_english:string
    // English abbreviation of book (always exists)
    name_english_abbrev:string
    // Local name of book (may be empty string)
    name_local:string
    // Local abbreviation of book (may be empty string)
    name_local_abbrev:string
    // Local long name of book (may be empty string)
    name_local_long:string
    // Local name of book with the English name in brackets when it differs
    name_bilingual:string
    // Local abbreviation of book with the English abbreviation in brackets when it differs
    name_bilingual_abbrev:string
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
    _fetch_extras_cache:Record<string, Promise<TranslationExtra>> = {}
    // @internal
    _local_book_names:Record<string, Record<string, BookNames>> = {}
    // @internal
    _manifest:RuntimeManifest
    // @internal
    _endpoints:Record<string, string> = {}  // Map translation ids to endpoints
    // @internal
    _endpoints_gloss:Record<string, string> = {}
    // @internal
    _endpoints_notes:Record<string, string> = {}
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
            glosses: {},
            notes: {},
        }

        // Keep track of included languages as may be less than in collection due to usage config
        const languages = new Set()

        // Process manifests in reverse such that the first will have priority
        for (const [endpoint, manifest] of manifests.reverse()){

            // Resolve raw license data to usable form
            const resolve_license_data = (copyright:MetaCopyright) => {
                const licenses:RuntimeLicense[] = copyright.licenses.map(item => {
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
                return filter_licenses(licenses, this._usage)
            }

            // Resolve books data to list of books
            const resolve_books = (ot:true|string[], nt:true|string[]) => {
                // Work out exactly what books are included (interpret `true` for whole testament)
                return {
                    books_ot_list: ot === true ? books_ordered.slice(0, 39) : ot,
                    books_nt_list: nt === true ? books_ordered.slice(39) : nt,
                }
            }

            // Loop through endpoint's translations
            for (const [trans, trans_data] of Object.entries(manifest.translations)){

                const licenses = resolve_license_data(trans_data.copyright)
                if (!licenses.length){
                    continue  // No compatible licenses so exclude translation
                }

                // Ensure this translation's language's data is included
                languages.add(trans.slice(0, 3))

                // Add the translation to the combined collection
                this._manifest.translations[trans] = {
                    ...trans_data,
                    ...resolve_books(trans_data.books_ot, trans_data.books_nt),
                    copyright: {
                        ...trans_data.copyright,
                        licenses,
                    },
                }

                // Remember which endpoint has which translation
                this._endpoints[trans] = endpoint
            }

            // Loop through endpoint's glosses
            for (const [gloss_id, gloss_data] of Object.entries(manifest.glosses)){

                const licenses = resolve_license_data(gloss_data.copyright)
                if (!licenses.length){
                    continue  // No compatible licenses so exclude gloss
                }

                // Add the gloss to the combined collection
                this._manifest.glosses[gloss_id] = {
                    ...gloss_data,
                    ...resolve_books(gloss_data.books_ot, gloss_data.books_nt),
                    copyright: {
                        ...gloss_data.copyright,
                        licenses,
                    },
                }

                // Remember which endpoint has which gloss
                this._endpoints_gloss[gloss_id] = endpoint
            }

            // Loop through endpoint's notes
            for (const [notes_id, notes_data] of Object.entries(manifest.notes)){

                const licenses = resolve_license_data(notes_data.copyright)
                if (!licenses.length){
                    continue  // No compatible licenses so exclude notes
                }

                // Add the notes to the combined collection
                this._manifest.notes[notes_id] = {
                    ...notes_data,
                    ...resolve_books(notes_data.books_ot, notes_data.books_nt),
                    copyright: {
                        ...notes_data.copyright,
                        licenses,
                    },
                }

                // Remember which endpoint has which notes
                this._endpoints_notes[notes_id] = endpoint
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
        this._ensure_trans_exists(translation)
        const trans_meta = this._manifest.translations[translation]!
        return trans_meta.books_ot_list.includes(book) || trans_meta.books_nt_list.includes(book)
    }

    // Get a language's metadata
    get_language(code:string):GetLanguagesItem|undefined{
        const data = this._manifest.languages[code]
        if (!data){
            return undefined
        }
        return {
            code,
            name_local: data.local,
            name_english: data.english,
            name_bilingual:
                data.english === data.local ? data.local : `${data.local} (${data.english})`,
            population: data.pop,
        }
    }

    // Get available languages as either a list or an object
    get_languages(options:ObjT<GetLanguagesOptions>):Record<string, GetLanguagesItem>
    get_languages(options?:ObjF<GetLanguagesOptions>):GetLanguagesItem[]
    get_languages({object, exclude_old, sort_by, search}:GetLanguagesOptions={}):
            GetLanguagesItem[]|Record<string, GetLanguagesItem>{

        // Start with list and dereference internal objects so manifest can't be modified
        let list = Object.keys(this._manifest.languages).map(code => this.get_language(code)!)

        // Optionally exclude non-living languages
        if (exclude_old){
            list = list.filter(item => item.population !== null)
        }

        // Optionally apply search
        if (search !== undefined){
            list = fuzzy_search(search, list, c => c.name_local + ' ' + c.name_english)
        }

        // Return object if desired
        if (object){
            return Object.fromEntries(list.map(item => [item.code, item]))
        }

        // Sort list and return it
        if (!search){
            if (sort_by === 'population_L1'){
                list.sort((a, b) => {
                    return (b.population ?? -1) - (a.population ?? -1)
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
                    return item.population ?? -1  // Fallback on L1-only pop data
                }
                list.sort((a, b) => {
                    return item_to_pop(b) - item_to_pop(a)
                })
            } else {
                list.sort((a, b) => {
                    // Defaults to sorting by local name
                    const name_key = sort_by === 'english' ? 'name_english' : 'name_local'
                    return a[name_key].localeCompare(b[name_key])
                })
            }
        }
        return list
    }

    // Get the user's preferred available language (no arg required when used in browser)
    get_preferred_language(preferences:string[]=[]):GetLanguagesItem{
        return this.get_language(this._get_preferred_language_code(preferences))!
    }

    // @internal Get preferred language code
    _get_preferred_language_code(preferences:string[]=[]):string{

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

    // Get a translation's metadata
    get_translation(id:string):GetTranslationsItem|undefined{
        return this._get_translation(id)
    }

    // @internal Version that takes a `usage` arg which is only useful for `get_translations()`
    _get_translation(id:string, usage?:UsageOptions):GetTranslationsItem|undefined{
        const trans = this._manifest.translations[id]
        if (!trans){
            return undefined
        }

        // Work out bilingual names
        let bilingual = trans.name.local || trans.name.english
        if (trans.name.local && trans.name.english &&
                trans.name.local.toLowerCase() !== trans.name.english.toLowerCase()){
            bilingual = `${trans.name.local} (${trans.name.english})`
        }
        let bilingual_abbrev = trans.name.local_abbrev || trans.name.english_abbrev
        if (trans.name.local_abbrev && trans.name.english_abbrev &&
                trans.name.local_abbrev !== trans.name.english_abbrev){
            bilingual_abbrev = `${trans.name.local_abbrev} (${trans.name.english_abbrev})`
        }

        return {
            id,
            language: id.slice(0, 3),
            direction: trans.direction,
            year: trans.year,

            name: trans.name.local || trans.name.english,
            name_abbrev: trans.name.local_abbrev || trans.name.english_abbrev,
            name_english: trans.name.english,
            name_english_abbrev: trans.name.english_abbrev,
            name_local: trans.name.local,
            name_local_abbrev: trans.name.local_abbrev,
            name_bilingual: bilingual,
            name_bilingual_abbrev: bilingual_abbrev,

            attribution: trans.copyright.attribution,
            attribution_url: trans.copyright.attribution_url,
            licenses: deep_copy(
                filter_licenses(trans.copyright.licenses, {...this._usage, ...usage})),
            liternalness: trans.literalness,
            tags: [...trans.tags],
        } as GetTranslationsItem
    }

    // Get available translations as either a list or an object
    get_translations(options:ObjT<GetTranslationsOptions>):Record<string, GetTranslationsItem>
    get_translations(options?:ObjF<GetTranslationsOptions>):GetTranslationsItem[]
    get_translations({language, object, sort_by_year, usage, exclude_obsolete, exclude_incomplete}:
            GetTranslationsOptions={}):GetTranslationsItem[]|Record<string, GetTranslationsItem>{

        // Start with list of translations, extracting properties that don't need extra processing
        // NOTE Filters out translations not compatible with usage config
        // WARN Careful to unpack all objects so originals can't be modified
        let list = Object.keys(this._manifest.translations).map(id => {
            return this._get_translation(id, usage)!
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
            for (const tag of ['archaic', 'questionable', 'niche'] as MetaTag[]){
                const reduced_list = list.filter(item => !item.tags.includes(tag))
                if (reduced_list.length){
                    list = reduced_list
                }
            }
        }

        // Optionally exclude incomplete translations
        if (exclude_incomplete){
            list = list.filter(item => {
                const trans_meta = this._manifest.translations[item.id]!
                return trans_meta.books_ot === true && trans_meta.books_nt === true
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
    get_preferred_translation(languages:string[]=[]):GetTranslationsItem{
        return this.get_translation(this._get_preferred_translation_id(languages))!
    }

    // @internal Get preferred translation id
    _get_preferred_translation_id(languages:string[]=[]):string{

        // First get preferred language
        const language = this._get_preferred_language_code(languages)

        // Return recommended translation, or otherwise the most modern full translation
        let candidate:string|null = null
        let candidate_full = false
        let candidate_year = -9999
        for (const [id, data] of Object.entries(this._manifest.translations)){

            // Obviously must be desired language
            if (id.slice(0, 3) === language){

                // If recommended, don't bother checking any others
                if (data.tags.includes('recommended')){
                    return id
                }

                // Consider as a candidate until something better comes up
                // NOTE Not considering tags as if any tagged then one would be recommended already
                const full = data.books_ot === true && data.books_nt === true
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

    // Get which books are available for a translation.
    // If no translation is given, all books will be listed but marked as unavailable.
    // If `fetch_translation_extras()` has already been called for the translation then local name
    // data will also be available (otherwise only English book names will be available).
    get_books(translation:string|undefined,
        options:ObjT<GetBooksOptions>):Record<string, GetBooksItem>
    get_books(translation?:string, options?:ObjF<GetBooksOptions>):GetBooksItem[]
    get_books(translation?:string, {object, sort_by_name, testament, whole}:GetBooksOptions={}):
            GetBooksItem[]|Record<string, GetBooksItem>{

        // Determine what books are available if given a translation (otherwise list all)
        let available = books_ordered
        if (translation){
            this._ensure_trans_exists(translation)
            const trans_meta = this._manifest.translations[translation]!
            available = [...trans_meta.books_ot_list, ...trans_meta.books_nt_list]
        }

        // Get local book names if available
        let local:Record<string, BookNames> = {}
        if (translation && translation in this._local_book_names){
            local = this._local_book_names[translation]!
        }

        // Create a list of the available books in traditional order
        const slice = testament ? (testament === 'ot' ? [0, 39] : [39]) : []
        const list = books_ordered.slice(...slice)
            .filter(id => whole || available.includes(id))
            .map(id => {
                const ot = books_ordered.indexOf(id) < 39

                // Work out bilingual names
                const local_name = local[id]?.normal
                let bilingual = book_names_english[id]!
                if (local_name && bilingual.toLowerCase() !== local_name.toLowerCase()){
                    bilingual = `${local_name} (${bilingual})`
                }
                const local_abbrev = local[id]?.abbrev
                let bilingual_abbrev = book_abbrev_english[id]!
                if (local_abbrev && bilingual_abbrev.toLowerCase() !== local_abbrev.toLowerCase()){
                    bilingual_abbrev = `${local_abbrev} (${bilingual_abbrev})`
                }

                return {
                    id,
                    name: local_name || book_names_english[id]!,
                    name_abbrev: local_abbrev || book_abbrev_english[id]!,
                    name_english: book_names_english[id]!,
                    name_english_abbrev: book_abbrev_english[id]!,
                    name_local: local_name ?? '',
                    name_local_abbrev: local_abbrev ?? '',
                    name_local_long: local[id]?.long ?? '',
                    name_bilingual: bilingual,
                    name_bilingual_abbrev: bilingual_abbrev,
                    ot,
                    nt: !ot,
                    available: !!translation && available.includes(id),
                }
            })

        // Return as object if desired
        if (object){
            return Object.fromEntries(list.map(item => [item.id, item]))
        }

        // Optionally sort by name instead of traditional order
        if (sort_by_name){
            list.sort((a, b) => a.name_english.localeCompare(b.name_english))
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
        const trans_meta = this._manifest.translations[translation]!
        const trans_books = [...trans_meta.books_ot_list, ...trans_meta.books_nt_list]
        let testament:'ot'|'nt' = 'ot'
        for (const book of books_ordered){
            if (book === 'mat'){
                testament = 'nt'  // Switch testament when reach Matthew (books ordered)
            }
            const status = trans_books.includes(book) ? 'available' : 'missing'
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

    // Make request for extra metadata for a translation (such as book names and section headings).
    // This will also auto-provide local book names for future calls of `get_books()`.
    async fetch_translation_extras(translation:string):Promise<TranslationExtra>{

        // Check args valid
        this._ensure_trans_exists(translation)

        // Don't fetch if already have a result or request pending
        if (translation in this._fetch_extras_cache){
            return this._fetch_extras_cache[translation]!
        }

        // Fetch data
        const url = `${this._endpoints[translation]!}bibles/${translation}/extra.json`
        const promise = request(url).then(contents => {
            const data = JSON.parse(contents) as DistTranslationExtra
            // Extract local book names when done (regardless of `remember_fetches` setting)
            this._local_book_names[translation] = data.book_names
            return new TranslationExtra(data)
        })

        // Cache request promise if desired
        if (this._remember_fetches){
            this._fetch_extras_cache[translation] = promise
            // Clear if unsuccessful so can retry if desired
            promise.catch(() => {
                delete this._fetch_book_cache[translation]
            })
        }

        return promise
    }

    // @internal Auto-prepare args for from_string/detect_references based on translation
    _from_string_args(translation:string|string[]=[], always_detect_english=true){

        // Get book names and abbreviations for translations (if available)
        const book_names:[string, string][] = []
        const translations = typeof translation === 'string' ? [translation] : translation
        for (const trans of translations){
            for (const [code, name_types] of Object.entries(this._local_book_names[trans] ?? {})){
                if (name_types.normal){
                    book_names.push([code, name_types.normal])
                }
                if (name_types.abbrev){
                    book_names.push([code, name_types.abbrev])
                }
            }
        }

        // Optionally add English last so is lowest priority
        if (always_detect_english){
            for (const [code, name] of Object.entries(book_names_english)){
                book_names.push([code, name])
            }
            for (const [code, name] of english_abbrev_include){
                book_names.push([code, name])
            }
        }

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

    // Detect bible references in a block of text using book names of given translation(s).
    // A generator is returned and can be passed updated text each time it yields a result.
    // You must have first awaited a call to `fetch_translation_extras()` to be able to parse
    //     non-English references.
    detect_references(text:string, translation:string|string[]=[], always_detect_english=true){
        return detect_references(text,
            ...this._from_string_args(translation, always_detect_english))
    }

    // Parse a single bible reference string into a PassageReference object (validating it).
    // Supports only single passages (for e.g. Matt 10:6,8 use `detect_references`).
    // You must have first awaited a call to `fetch_translation_extras()` to be able to parse
    //     non-English references.
    string_to_reference(text:string, translation:string|string[]=[], always_detect_english=true){
        return PassageReference.from_string(text,
            ...this._from_string_args(translation, always_detect_english))
    }

    // Render a PassageReference object as a string using the given translation's book names.
    // You must have first awaited a call to `fetch_translation_extras()` for the translation,
    // or English will be used by default.
    reference_to_string(reference:PassageReference, translation?:string, abbreviate?:boolean){

        // Start with English names as `toString()` default will not account for `abbreviate` option
        const book_names = {... abbreviate ? book_abbrev_english : book_names_english}

        // Overwrite English defaults with translation's names if they are available
        if (translation){
            const name_prop = abbreviate ? 'abbrev' : 'normal'
            for (const [book, props] of Object.entries(this._local_book_names[translation] ?? {})){
                if (props[name_prop]){
                    book_names[book] = props[name_prop]
                }
            }
        }
        return reference.toString(book_names)
    }
}
