
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
const IGNORE = [
    'daf',  // Not open and causes language code error
    'dud',  // Not open and causes language code error
    'eng-kjv',  // Same as 'eng-kjv2006' with Apoc.
    'eng-web',  // Copy of existing translation with added deuterocanon
    'eng-webbe',  // Copy of existing translation with added deuterocanon
    'eng-web-c',  // Copy of existing translation with added deuterocanon
    'aka',  // An incorrect mix of twiasante and twi
    'hbo',  // Assumed to be same text as hboWLC
    'hltmcsb',  // 'hlt' is the same but includes strongs
    'kld',  // Old collection of snippets, not complete books
    'pon2006a',  // Same as pon2006 but with Apoc.
    'kud2014',  // Not openly licensed
    'bbr2013',  // Not openly licensed
    'spav1602p',  // A KJV update of the original Valera from 1602
]


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
        // NOTE Using FCBHID which is usually LANG+ORG or abbrev of title if org small
        const ebible_id = row['translationId']
        const ebible_url = `https://ebible.org/Scriptures/details.php?id=${ebible_id}`
        const lang_code = language_data.normalise(row['languageCode'])
        let fcbhid_end = row['FCBHID'].slice(3).toLowerCase()
        if (fcbhid_end === 'twf'){
            fcbhid_end = 'wft'  // eBible is inconsistent and sometimes uses 'twf' for same org
        }
        let trans_id = `${lang_code ?? ''}_${fcbhid_end}`
        const log_ids = `${trans_id}/${ebible_id}`

        // Skip if only want to discover a single translation
        if (discover_specific_id && ebible_id !== discover_specific_id){
            return
        }

        // Skip if in ignored list
        if (IGNORE.includes(ebible_id)){
            ignored.push(ebible_id)
            return
        }

        // Skip if already exists
        if (existing.includes(ebible_id)){
            exists.push(ebible_id)
            return
        }

        // Warn if invalid language or id and fallback on ebible's id
        if (!lang_code || !fcbhid_end){
            trans_id = '_' + row['FCBHID'].toLowerCase()
            console.error(`INVALID Id ${trans_id} ${ebible_url}`)
        }

        // Get translation's details page to see what data formats are available
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
                console.error(`INVALID No USFM available ${ebible_url}`)
            }
            ignored.push(ebible_id)
            return
        }

        // If already added via another service, add ebible id to it
        // NOTE Do after license detection as some restricted versions will match a prev open one
        const trans_dir = join('sources', 'bibles', trans_id)
        const meta_file = join(trans_dir, 'meta.json')
        if (existsSync(meta_file)){
            const existing_meta = read_json<TranslationSourceMeta>(meta_file)
            if (existing_meta.ids.ebible){
                // Translation already has a different eBible id so need to resolve manually
                console.error(`INVALID Matched ${ebible_id} to ${trans_id} but it already has `
                    + existing_meta.ids.ebible)
                return
            }
            existing_meta.ids.ebible = ebible_id
            write_json(meta_file, existing_meta, true)
            exists.push(ebible_id)
            return
        }

        // Short title is usually in English, but remove any diacritics if present
        const english_name = row['shortTitle'].normalize('NFKD').replace(/\p{Diacritic}/gu, '')

        // Form abbreviation from uppercase letters of English name
        const english_abbrev = english_name.replace(/[^A-Z]/g, '').slice(0, 5)

        // Prepare the meta data
        const meta:TranslationSourceMeta = {
            name: {
                local: row['title'],  // Usually in local language
                local_abbrev: '',
                english: lang_code === 'eng' ? row['title'] : english_name,
                english_abbrev: english_abbrev,
            },
            year: detect_year(row['title'], row['shortTitle'], row['translationId'],
                row['swordName'], row['Copyright'], row['description']),
            direction: row['textDirection'] === 'rtl' ? 'rtl' : 'ltr',
            copyright: {
                licenses: license ? [{license, url: license_url}] : [],
                attribution: row['Copyright'],
                // Use eBible URL so can point to specific translation and not generic org
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
