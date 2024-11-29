
import {join} from 'path'
import {existsSync, mkdirSync} from 'fs'

import {parse as csv_parse} from 'csv-parse/sync'

import {request, concurrent, write_json, read_json} from '../parts/utils.js'
import {LICENSES, detect_year} from '../parts/license.js'
import {get_language_data} from '../parts/languages.js'
import type {TranslationSourceMeta} from '../parts/types'


interface EbibleRow {
    translationId:string
    FCBHID:string
    title:string
    description:string
    shortTitle:string
    languageCode:string
    textDirection:string
    Copyright:string
    UpdateDate:string
    swordName:string
}


// Translations that can be sourced from a better location (or other issue)
const IGNORE = ['engnet']


export async function discover(existing:string[], discover_specific_id?:string):Promise<void>{
    // Discover translations that are available

    // Parse eBible CSV to get translations list and useful metadata
    const csv_buffer =
        await request('https://ebible.org/Scriptures/translations.csv', 'arrayBuffer')
    const rows = csv_parse(Buffer.from(csv_buffer), {
        bom: true,
        columns: true,
        skip_empty_lines: true,
        trim: true,
    }) as EbibleRow[]

    // Load language data
    const language_data = get_language_data()

    // Track changes
    const added:string[] = []
    const exists:string[] = []
    const ignored:string[] = []

    // Add each translation in the CSV file
    // Do concurrently since each involves a network request
    await concurrent(rows.map(row => async () => {

        // Determine ids
        const ebible_id = row['translationId']
        const lang_code = language_data.normalise(row['languageCode'])
        const trans_abbr = row['FCBHID'].slice(3).toLowerCase()
        const trans_id = `${lang_code ?? ''}_${trans_abbr}`
        const log_ids = `${trans_id}/${ebible_id}`

        // Skip if only want to discover a single translation
        if (discover_specific_id && trans_id !== discover_specific_id){
            return
        }

        // Skip if already exists
        if (existing.includes(ebible_id)){
            exists.push(ebible_id)
            return
        }

        // Ignore if invalid language or in ignored list
        if (!lang_code){
            console.error(`INVALID ${log_ids} (unknown language)`)
            ignored.push(ebible_id)
            return
        } else if (IGNORE.includes(ebible_id)){
            ignored.push(ebible_id)
            return
        }

        // If already added via another service, add ebible id to it
        const trans_dir = join('sources', 'bibles', trans_id)
        const meta_file = join(trans_dir, 'meta.json')
        if (existsSync(meta_file)){
            const existing_meta = read_json<TranslationSourceMeta>(meta_file)
            existing_meta.ids.ebible = ebible_id
            write_json(meta_file, existing_meta, true)
            exists.push(ebible_id)
            return
        }

        // Get translation's details page to see what data formats are available
        const ebible_url = `https://ebible.org/Scriptures/details.php?id=${ebible_id}`
        let page_resp = await request(ebible_url, 'text')

        // Some pages have broken license links
        page_resp = page_resp.replaceAll('/by4.0/', '/by/4.0/')

        // Detect the license
        let license:string|null = null
        let license_url = ebible_url
        const cc_url = /creativecommons.org\/licenses\/([a-z-]+)\/(\d+\.\d+)/i.exec(page_resp)
        if (cc_url){
            license = `cc-${cc_url[1]!}`
            if (license in LICENSES){
                license_url = `https://creativecommons.org/licenses/${cc_url[1]!}/${cc_url[2]!}/`
            } else {
                console.warn(`Failed to detect CC license "${license}" (${log_ids})`)
                license = null
            }
        } else if (/public domain/i.test(page_resp) && !/not public domain/i.test(page_resp)){
            license = 'public'
        }

        // Ignore if no USFM source (almost always because license is restrictive)
        if (!page_resp.includes('usfm.zip')){
            if (license){
                console.error(`INVALID ${log_ids} (no USFM even though unrestricted license?)`)
            } else {
                console.warn(`INVALID ${log_ids} (probably restricted)`)
            }
            ignored.push(ebible_id)
            return
        }

        // Guess if title is in English or native language (printable ASCII)
        const title_is_english = /^[\x20-\x7F]*$/.test(row['title'])

        // Prepare the meta data
        const meta:TranslationSourceMeta = {
            name: {
                local: title_is_english ? '' : row['title'],
                local_abbrev: '',
                english: title_is_english ? row['title'] : '',
                english_abbrev: trans_abbr.toUpperCase(),
            },
            year: detect_year(row['title'], row['shortTitle'], row['translationId'],
                row['swordName'], row['Copyright'], row['description']),
            direction: row['textDirection'] === 'rtl' ? 'rtl' : 'ltr',
            copyright: {
                licenses: license ? [{license, url: license_url}] : [],
                attribution: row['Copyright'],
                attribution_url: ebible_url,
            },
            ids: {
                ebible: ebible_id,
            },
            source: {
                service: 'ebible',
                format: 'usfm',
                url: `https://ebible.org/Scriptures/${ebible_id}_usfm.zip`,
                updated: row['UpdateDate'],
                revision: 0,  // Unused
            },
            literalness: null,
            tags: [],
        }

        // Save meta file
        mkdirSync(trans_dir, {recursive: true})
        write_json(meta_file, meta, true)
        added.push(ebible_id)
    }))

    // Report stats
    console.info(`EBIBLE new: ${added.length}`)
    console.info(`EBIBLE existing: ${exists.length}`)
    console.info(`EBIBLE ignored: ${ignored.length}`)
    console.info(`EBIBLE total: ${added.length + exists.length + ignored.length}`)
}


// Generic method is compatible with this service's source format
export {generic_update_sources as update_sources} from './generic.js'
