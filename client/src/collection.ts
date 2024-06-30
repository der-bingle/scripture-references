
import {BibleBook, BibleBookHtml, BibleBookUsx, BibleBookUsfm, BibleBookTxt} from './book.js'
import {filter_licenses} from './licenses.js'
import {deep_copy, fuzzy_search, request} from './utils.js'
import {BookNames, PassageRefArg, book_name_to_code, find_passage_str, find_passage_str_all,
    passage_obj_to_str, passage_str_to_obj} from './references.js'
import type {DistManifest} from './shared_types'
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
    sort_by?:'local'|'english'|'population'
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

export interface SanitizedReference {
    book:string
    start_chapter:number
    start_verse:number
    end_chapter:number
    end_verse:number
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
            book_names_english: manifests[0][1].book_names_english,
            books_ordered: manifests[0][1].books_ordered,
            licenses: manifests[0][1].licenses,  // Still useful even if resolved within transl.s
            last_verse: manifests[0][1].last_verse,
            languages: {},
            language2to3: {},
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
        if (!this._manifest.books_ordered.includes(book)){
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
            if (sort_by === 'population'){
                list.sort((a, b) => {
                    return (b.pop ?? -1) - (a.pop ?? -1)
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
            }
        }).filter(trans => trans.licenses.length)

        // Optionally limit to single language
        if (language){
            list = list.filter(item => item.language === language)
        }

        // Optionally exclude obsolete translations (as long as better alternative exists)
        if (exclude_obsolete){
            const decent = list.filter(item => {
                const recommended = this._manifest.translations[item.id]!.recommended
                return recommended === null ? item.year >= this._modern_year : recommended
            })
            if (decent.length){
                list = decent  // Only filter out obsolete if at least one translation will remain
            }
        }

        // Optionally exclude incomplete translations
        if (exclude_incomplete){
            list = list.filter(item => {
                const count = Object.keys(this._manifest.translations[item.id]!.books).length
                return count === this._manifest.books_ordered.length
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
                if (data.recommended){
                    return id
                }

                // Consider as a candidate until something better comes up
                const full = Object.keys(data.books).length === this._manifest.books_ordered.length
                if (
                    !candidate  // Something better than nothing
                    || (!candidate_full && full)  // Full translation better than partial
                    // Otherwise only consider if more modern
                    || (full && data.year > candidate_year && data.recommended !== false)
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
        let available = this._manifest.book_names_english
        if (translation){
            this._ensure_trans_exists(translation)
            available = this._manifest.translations[translation]!.books
        }

        // Create a list of the available books in traditional order
        const slice = testament ? (testament === 'ot' ? [0, 39] : [39]) : []
        const list = this._manifest.books_ordered.slice(...slice)
            .filter(id => whole || id in available)
            .map(id => {
                return {
                    id,
                    name: available[id] ?? this._manifest.book_names_english[id]!,
                    name_local: available[id] ?? '',
                    name_english: this._manifest.book_names_english[id]!,
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
        for (const book of this._manifest.books_ordered){
            if (book === 'mat'){
                testament = 'nt'  // Switch testament when reach Matthew (books ordered)
            }
            const status = book in trans_books ? 'available' : 'missing'
            data[testament][status].push(book)
        }

        return data
    }

    // Get chapter numbers for a book
    get_chapters(book:string):number[]{
        const last_verse = this._manifest.last_verse
        // NOTE Need to +1 since chapter numbers are derived from place in last_verse array
        return [...Array(last_verse[book]!.length).keys()].map(i => i + 1)
    }

    // Get verse numbers for a chapter
    get_verses(book:string, chapter:number):number[]{
        const last_verse = this._manifest.last_verse
        // WARN Position of each chapter is chapter-1 due to starting from 0
        return [...Array(last_verse[book]![chapter-1]).keys()].map(i => i + 1)
    }

    /* Force a given passage reference to be valid (providing as much or as little as desired)
        Chapter and verse numbers will be forced to their closest valid equivalent
        If validating only the book/chapter/verse simply extract the desired info and ignore the
        rest of the results, as end values will default to same as start when not present.
    */
    sanitize_reference(book:string, chapter?:number, verse?:number):SanitizedReference
    sanitize_reference(reference:PassageRefArg):SanitizedReference
    sanitize_reference(book_or_obj:string|PassageRefArg, chapter?:number, verse?:number)
            :SanitizedReference{

        // Normalise args
        let ref:SanitizedReference
        if (typeof book_or_obj === 'string'){
            ref = {
                book: book_or_obj,
                start_chapter: chapter ?? 1,
                start_verse: verse ?? 1,
                // Following will increase to whatever start is later
                end_chapter: 1,
                end_verse: 1,
            }
        } else {
            ref = {
                book: book_or_obj.book,
                start_chapter: book_or_obj.start_chapter ?? 1,
                start_verse: book_or_obj.start_verse ?? 1,
                end_chapter: book_or_obj.end_chapter ?? book_or_obj.start_chapter ?? 1,
                end_verse: book_or_obj.end_verse ?? book_or_obj.start_verse ?? 1,
            }
            // If didn't specify start_verse then dealing with whole chapters...
            if (!book_or_obj.start_verse){
                ref.end_verse = 999  // Will correct to last verse of chapter later
            }
        }

        // Validate book
        if (this._manifest.books_ordered.indexOf(ref.book) === -1){
            ref.book = 'gen'
        }

        // Ensure start chapter is valid
        const last_verse = this._manifest.last_verse[ref.book]!
        if (ref.start_chapter < 1){
            ref.start_chapter = 1
            ref.start_verse = 1
        } else if (ref.start_chapter > last_verse.length){
            ref.start_chapter = last_verse.length
            ref.start_verse = last_verse[last_verse.length-1]!
        }

        // Ensure start verse is valid
        ref.start_verse = Math.min(Math.max(ref.start_verse, 1), last_verse[ref.start_chapter-1]!)

        // Ensure end is not before start
        if (ref.end_chapter < ref.start_chapter ||
                (ref.end_chapter === ref.start_chapter && ref.end_verse < ref.start_verse)){
            ref.end_chapter = ref.start_chapter
            ref.end_verse = ref.start_verse
        }

        // Ensure end chapter is not invalid (already know is same or later than start)
        if (ref.end_chapter > last_verse.length){
            ref.end_chapter = last_verse.length
            ref.end_verse = last_verse[last_verse.length-1]!
        }

        // Ensure end verse is valid
        ref.end_verse = Math.min(Math.max(ref.end_verse, 1), last_verse[ref.end_chapter-1]!)

        return ref
    }

    // Confirm if a passage reference is valid, verifying book code and chapter/verse numbers
    valid_reference(book:string, chapter?:number, verse?:number):boolean
    valid_reference(reference:PassageRefArg):boolean
    valid_reference(book_or_obj:string|PassageRefArg, chapter?:number, verse?:number):boolean{

        // Normalize args
        let ref:PassageRefArg
        if (typeof book_or_obj !== 'string'){
            ref = book_or_obj
        } else {
            ref = {
                book: book_or_obj,
                start_chapter: chapter ?? null,
                start_verse: verse ?? null,
            }
        }

        // Get sanitized reference
        const sanitized = this.sanitize_reference(ref)

        // Verify parts stayed same, but only those provided (ignoring null/undefined)
        if (ref.book !== sanitized.book){
            return false
        }
        for (const prop of ['start_chapter', 'start_verse', 'end_chapter', 'end_verse'] as const){
            if (Number.isInteger(ref[prop]) && ref[prop] !== sanitized[prop]){
                return false
            }
        }

        // Also fail if provided args don't make sense
        // NOTE Already know that no numbers in ref are 0/false due to above
        if (!ref.start_chapter && (ref.end_chapter || ref.start_verse || ref.end_verse)){
            return false  // e.g. Matt :1
        }
        if (ref.end_verse && !ref.start_verse){
            return false  // e.g. Matt 1:-1
        }
        if (ref.start_verse && ref.end_chapter && !ref.end_verse){
            return false  // e.g. Matt 1:1-2:
        }

        return true
    }

    // Confirm if given book is within the specified testament
    valid_testament(book:string, testament:'ot'|'nt'):boolean{
        const index = this._manifest.books_ordered.indexOf(book)
        if (index === -1){
            return false
        } else if (testament === 'nt' && index >= 39){
            return true
        } else if (testament === 'ot' && index < 39){
            return true
        }
        return false
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
            return new format_class(this._manifest.translations[translation]!, contents)
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

    // Detect which book a name refers to (defaults to English, pass translation for other language)
    detect_book(name:string, translation?:string){
        return book_name_to_code(name,
            translation ? this.get_books(translation) : this._manifest.book_names_english)
    }

    // @internal
    _book_names_list(translation?:string){
        const book_names:BookNames[] = [this._manifest.book_names_english]
        if (translation){
            book_names.unshift(this.get_books(translation))
        }
        return book_names
    }

    // Detect which passage a human text passage reference refers to
    // Pass translation arg to correctly detect book names/abbreviations for that language/version
    detect_passage(reference:string, translation?:string){
        return passage_str_to_obj(reference, ...this._book_names_list(translation))
    }

    // Detect the text and position of first passage reference in a block of text
    // Pass translation arg to correctly detect book names/abbreviations for that language/version
    detect_passage_reference(text:string, translation?:string){
        return find_passage_str(text, ...this._book_names_list(translation))
    }

    // Detect the text and position of all passage references in a block of text
    // Pass translation arg to correctly detect book names/abbreviations for that language/version
    detect_passage_references(text:string, translation?:string){
        return find_passage_str_all(text, ...this._book_names_list(translation))
    }

    // Generate a human-readable passage reference from a data object
    // `book_names` can either be a translation id or a mapping of book codes to names
    // This allows you to pass abbreviated names if you prefer (defaults to English names)
    generate_passage_reference(reference:PassageRefArg, book_names?:string|BookNames, verse_sep=':',
            range_sep='-'){
        let book_names_data:BookNames = this._manifest.book_names_english
        if (typeof book_names === 'string'){
            book_names_data = this.get_books(book_names)
        } else if (typeof book_names === 'object'){
            book_names_data = book_names
        }
        return passage_obj_to_str(reference, book_names_data, verse_sep, range_sep)
    }
}
