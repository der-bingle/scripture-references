
import {join} from 'node:path'
import {existsSync, rmSync} from 'node:fs'

import {book_names_english, books_ordered} from './bible.js'
import {languages_by_total_speakers} from '../data/languages.js'
import {get_language_data} from './languages.js'
import {LICENSES} from './license.js'
import {read_json, write_json, list_dirs, list_files} from './utils.js'
import type {DistManifest, DistManifestItem} from './shared_types'
import type {TranslationSourceMeta} from './types'


// See if any important meta data missing
export function _missing_meta(meta:TranslationSourceMeta){
    // True if missing (and so shouldn't publish)
    return !meta.year
        || !meta.copyright.licenses.length
        || !(meta.name.local || meta.name.english)
        || !(meta.name.local_abbrev || meta.name.english_abbrev)
}


// Get the meta data for a resource that is to be added to the manifest
function _process_resource_meta(sources_path:string, dist_path:string){

    // Load the meta data for the translation
    const meta = read_json<TranslationSourceMeta>(join(sources_path, 'meta.json'))

    // Skip if meta data missing
    if (_missing_meta(meta)){
        console.error(`IGNORING ${sources_path} (missing year, license, name, etc)`)
        return
    }

    // Detect what books are available (must be in all formats)
    let available_books:string[]|null = null
    for (const format of list_dirs(dist_path)){
        const format_dir = join(dist_path, format)
        const format_books = list_files(format_dir).map(name => name.slice(0, 3))
        if (available_books === null){
            available_books = format_books  // First format checked
        } else if (available_books.length !== format_books.length){
            console.error(`IGNORING ${sources_path} (not all formats available)`)
            return
        }
    }
    if (!available_books || !available_books.length){
        console.error(`IGNORING ${sources_path} (no books)`)
        return
    }

    // Determine what books are included
    const books_ot = books_ordered.slice(0, 39).filter(b => available_books.includes(b))
    const books_nt = books_ordered.slice(39).filter(b => available_books.includes(b))

    // Put it all together
    // NOTE Not including meta data that client doesn't need (users can still check git repo)
    return {
        name: meta.name,
        year: meta.year as number,  // Verified to exist above
        direction: meta.direction,
        copyright: meta.copyright,
        tags: meta.tags,
        // Record as `true` if whole testament to reduce data size
        books_ot: books_ot.length === 39 ? true : books_ot,
        books_nt: books_nt.length === 27 ? true : books_nt,
    } as DistManifestItem
}


// Add all resources of given category to manifest
function _add_resources(manifest:DistManifest, included_languages:Set<string>,
        category:'translations'|'glosses'|'notes'){

    // Bible translations are 'translations' in manifest but 'bibles' in paths
    const category_path = category === 'translations' ? 'bibles' : category

    // Get list of service dirs (bibles don't have and are flat)
    const service_dirs =
        category === 'translations' ? [''] : list_dirs(join('sources', category_path))

    for (const service_dir of service_dirs){
        for (const id of list_dirs(join('sources', category_path, service_dir))){
            if (id === '.original'){
                continue  // Skip special dir in glosses
            }
            const sources_path = join('sources', category_path, service_dir, id)
            const dist_path = join('dist', category_path, id)
            if (!existsSync(dist_path)){
                continue  // Haven't processed dist files yet
            }
            const processed_meta = _process_resource_meta(sources_path, dist_path)
            if (processed_meta){
                manifest[category][id] = processed_meta
                // Language is to be added to manifest
                // NOTE Languages for certain resource types will be filtered in client
                included_languages.add(id.slice(0, 3))
            }
        }
    }
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
        notes: {},
        languages: {},
        language2to3: {},
        languages_most_spoken: [],
        books_ordered,
        book_names_english,
        licenses: LICENSES,
    }

    // Keep track of what languages are included
    const included_languages:Set<string> = new Set()

    // Ensure manifest does not exist at old location
    rmSync(join('dist', 'bibles', 'manifest.json'), {force: true})

    // Detect and add resources
    _add_resources(manifest, included_languages, 'translations')
    _add_resources(manifest, included_languages, 'glosses')
    _add_resources(manifest, included_languages, 'notes')

    // Populate language data
    // NOTE Only include languages that have a resource
    manifest.languages = Object.fromEntries(Object.entries(language_data.data.languages)
        .filter(([code]) => included_languages.has(code)))
    manifest.language2to3 = Object.fromEntries(Object.entries(language_data.data.language2to3)
        .filter(([, three]) => included_languages.has(three)))
    manifest.languages_most_spoken =
        languages_by_total_speakers.filter(l => included_languages.has(l))

    // Save the manifest to dist dir
    write_json(join('dist', 'manifest.json'), manifest)
}
