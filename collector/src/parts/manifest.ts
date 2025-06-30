
import {join} from 'node:path'
import {existsSync, rmSync} from 'node:fs'

import {book_names_english, books_ordered} from './bible.js'
import {languages_by_total_speakers} from '../data/languages.js'
import {get_language_data} from './languages.js'
import {LICENSES} from './license.js'
import {read_json, write_json, list_dirs, list_files} from './utils.js'
import type {DistManifest} from './shared_types'
import type {TranslationSourceMeta} from './types'


export function _missing_meta(meta:TranslationSourceMeta){
    // True if important meta data missing (and so shouldn't publish)
    return !meta.year
        || !meta.copyright.licenses.length
        || !(meta.name.local || meta.name.english)
        || !(meta.name.local_abbrev || meta.name.english_abbrev)
}


export async function update_manifest(){
    // Generate the manifest for the collection and save to file
    // NOTE This only considers translations already output to dist dir
    console.info("Generating manifest...")

    // Load language data
    const language_data = get_language_data()

    // Init manifest
    const manifest:DistManifest = {
        translations: {},
        glosses: {},
        languages: {},
        language2to3: {},
        languages_most_spoken: [],
        books_ordered,
        book_names_english,
        licenses: LICENSES,
    }

    // Keep track of what languages are included
    const included_languages:Set<string> = new Set()

    // Keep track of what languages have what direction
    const directions:Record<string, 'rtl'|'ltr'> = {}

    // Loop through published translations in dist dir
    for (const trans of list_dirs(join('dist', 'bibles'))){

        // Remove manifest from old location if present
        if (trans === 'manifest.json'){
            rmSync(join('dist', 'bibles', 'manifest.json'))
            continue
        }

        // Load the meta data for the translation
        const meta = read_json<TranslationSourceMeta>(join('sources', 'bibles', trans, 'meta.json'))

        // Skip if meta data missing
        if (_missing_meta(meta)){
            console.error(`IGNORING ${trans} (missing year, license, name, etc)`)
            continue
        }

        // Detect what books are available
        // TODO Ensure all formats available, not just HTML
        const html_dir = join('dist', 'bibles', trans, 'html')
        const html_books = existsSync(html_dir) ?
            list_files(html_dir).map(name => name.slice(0, 3)) : []
        if (html_books.length === 0){
            console.error(`IGNORING ${trans} (no books)`)
            continue
        }

        // Determine what books are included
        const books_ot = books_ordered.slice(0, 39).filter(b => html_books.includes(b))
        const books_nt = books_ordered.slice(39).filter(b => html_books.includes(b))

        // Put it all together
        // NOTE Not including meta data that client doesn't need (users can still check git repo)
        manifest.translations[trans] = {
            name: meta.name,
            year: meta.year as number,  // Verified to exist above
            direction: meta.direction,
            copyright: meta.copyright,
            tags: meta.tags,
            // Record as `true` if whole testament to reduce data size
            books_ot: books_ot.length === 39 ? true : books_ot,
            books_nt: books_nt.length === 27 ? true : books_nt,
        }

        // Record the language as being included
        const trans_lang = trans.slice(0, 3)
        included_languages.add(trans_lang)

        // Set direction for language if missing
        directions[trans_lang] ??= meta.direction
    }

    // Loop through published glosses in dist dir
    for (const trans of list_dirs(join('dist', 'glosses'))){

        // Detect what books are available
        const dist_dir = join('dist', 'glosses', trans)
        const books = existsSync(dist_dir) ?
            list_files(dist_dir).map(name => name.slice(0, 3)) : []
        if (books.length === 0){
            console.error(`IGNORING gloss ${trans} (no books)`)
            continue
        }

        // Determine what books are included
        const books_ot = books_ordered.slice(0, 39).filter(b => books.includes(b))
        const books_nt = books_ordered.slice(39).filter(b => books.includes(b))

        // Put it all together
        // NOTE Currently only including glosses from GBT, so meta hardcoded
        const trans_lang = trans.slice(0, 3)
        const lang_meta = language_data.data.languages[trans_lang]!
        manifest.glosses[trans] = {
            name: {
                english: `Global Bible Tools glosses (${lang_meta.english})`,
                english_abbrev: `GBT${lang_meta.english[0]!}`,
                local: '',
                local_abbrev: '',
            },
            year: new Date().getFullYear(),
            direction: directions[trans_lang] ?? 'ltr',
            tags: [],
            copyright: {
                attribution: "Global Bible Tools",
                attribution_url: 'https://globalbibletools.com/',
                licenses: [{
                    license: 'public',
                    url: 'https://sellingjesus.org/free',
                }],
            },
            // Record as `true` if whole testament to reduce data size
            books_ot: books_ot.length === 39 ? true : books_ot,
            books_nt: books_nt.length === 27 ? true : books_nt,
        }
    }

    // Populate language data
    // NOTE Only included languages that have a translation
    manifest.languages = Object.fromEntries(Object.entries(language_data.data.languages)
        .filter(([code]) => included_languages.has(code)))
    manifest.language2to3 = Object.fromEntries(Object.entries(language_data.data.language2to3)
        .filter(([, three]) => included_languages.has(three)))
    manifest.languages_most_spoken =
        languages_by_total_speakers.filter(l => included_languages.has(l))

    // Save the manifest to dist dir
    write_json(join('dist', 'manifest.json'), manifest)
}
