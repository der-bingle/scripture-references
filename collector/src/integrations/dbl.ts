
import {join} from 'node:path'
import {existsSync, mkdirSync} from 'node:fs'

import {request, concurrent, write_json} from '../parts/utils.js'
import {LICENSES} from '../parts/license.js'
import {get_language_data} from '../parts/languages.js'

import type {TranslationSourceMeta} from '../parts/types'


// Translations that can be sourced from a better location (or other issue)
const IGNORE:string[] = []


interface ListItem {
    // NOTE Only relevant items included
    id:string  // A random chars id
    entrytype:string  // 'text' or other...
    revision:string  // Incrementing number that identifies if an update has been issued
    dateUpdated:string // YYYY-MM-DD[T...] Date of latest update
    dateArchived:string  // YYYY-MM-DD[T...] First date added to DBL
    dateCompleted:string  // YYYY-MM-DD[T...] This is often blank for partial translations
    rightsHolder:{link:string, name:string}[]
    languageCode:string  // 3 char
    nameCommon:string
    nameCommonLocal:string
    nameAbbreviation:string
    nameAbbreviationLocal:string
    languageScriptDirection:string
    copyrightStatement:string
}


interface ListResp {
    entries:ListItem[]
}


interface OrgItem {
    full_name:string
    local_name:string
    contact_url:string
}


interface OrgResp {
    orgs: OrgItem[]
}


export async function discover(discover_specific_id?:string):Promise<void>{
    // Discover translations that are available

    // Get list of translations
    // NOTE Alternate URL with `_list` appended only gets basic info, not all required props
    const url = 'https://app.thedigitalbiblelibrary.org/api/open_access_entries'
    const resp = await request<ListResp>(url, 'json')

    // Filter out non-text entries (if any)
    let items = resp.entries.filter(item => item.entrytype === 'text')

    // Filter out translations from eBible as better to get straight from eBible
    items = items.filter(item => item.rightsHolder[0]!.name !== 'eBible.org')

    // Prepare to record stats for rest of tests
    const num_total = items.length
    let num_existing = 0
    let num_added = 0

    // Filter out ignored translations
    items = items.filter(item => !IGNORE.includes(item.id))
    let num_ignored = num_total - items.length

    // Load language data
    const language_data = get_language_data()

    // Process each translation
    // Do concurrently since each involves a network request
    await concurrent(items.map(item => async () => {

        // Prepare english abbreviation first as will use for id
        const lang_code = language_data.normalise(item.languageCode)
        let eng_abbrev = item.nameAbbreviation.toLowerCase().replace(/[^a-z]/gi, '')
        if (lang_code && eng_abbrev.startsWith(lang_code)){
            // Some translations start abbreviations with the language code which isn't helpful
            eng_abbrev = eng_abbrev.slice(lang_code.length)
        }

        // Determine ids
        const trans_id = `${lang_code ?? ''}_${eng_abbrev}`
        const log_ids = `${trans_id}/${item.id}`

        // Skip if only want to discover a single translation
        if (discover_specific_id && trans_id !== discover_specific_id){
            return
        }

        // Ignore if invalid language
        if (!lang_code){
            console.error(`INVALID ${log_ids} (unknown language)`)
            num_ignored += 1
            return
        }

        // Skip if already discovered
        const trans_dir = join('sources', 'bibles', trans_id)
        const meta_file = join(trans_dir, 'meta.json')
        if (existsSync(meta_file)){
            num_existing += 1
            return
        }

        // Detect the license
        const html_url = `https://app.thedigitalbiblelibrary.org/entry?id=${item.id}`
        const html_resp = await request(html_url, 'text')
        let license:string|null = null
        let license_url = html_url
        const cc_abbrev = /cc (by[a-z-]*)/i.exec(html_resp)
        if (cc_abbrev){
            const conditions = cc_abbrev[1]!.toLowerCase()
            license = `cc-${conditions}`
            if (license in LICENSES){
                // NOTE DBL doesn't specify license version so 4.0 can only be assumed
                license_url = `https://creativecommons.org/licenses/${conditions}/4.0/`
            } else {
                console.warn(`Failed to detect CC license "${license}" (${log_ids})`)
                license = null
            }
        } else if (/public domain/i.test(html_resp) && !/not public domain/i.test(html_resp)){
            license = 'public'
        }

        // Get owner details
        let org:OrgItem = {contact_url: '', full_name: '', local_name: ''}
        try {
            org = (await request<OrgResp>(item.rightsHolder[0]!.link, 'json')).orgs[0]!
        } catch {
            // Some orgs will throw 403
        }

        // Work out earliest year of publication
        const date_archived = parseInt(item.dateArchived.slice(0, 4)) || 9999
        const date_completed = parseInt(item.dateCompleted.slice(0, 4)) || 9999

        // Prepare the meta data
        const meta:TranslationSourceMeta = {
            name: {
                local: item.nameCommonLocal,
                local_abbrev: item.nameAbbreviationLocal,
                english: item.nameCommon,
                english_abbrev: eng_abbrev.toUpperCase(),
            },
            year: Math.min(date_archived, date_completed),
            direction: item.languageScriptDirection.toLowerCase() === 'rtl' ? 'rtl' : 'ltr',
            copyright: {
                licenses: license ? [{license, url: license_url}] : [],
                attribution: org.full_name || org.local_name || item.rightsHolder[0]!.name,
                attribution_url: org.contact_url ||
                    `https://app.thedigitalbiblelibrary.org/entry?id=${item.id}`,
            },
            ids: {
                dbl: item.id,
            },
            source: {
                service: 'dbl',
                format: 'usx',
                url: 'https://app.thedigitalbiblelibrary.org/entry/download_archive'
                    + `?id=${item.id}&type=release`,
                updated: item.dateUpdated.slice(0, 10),
                revision: parseInt(item.revision),
            },
            literalness: null,
            tags: [],
            published: false,
        }

        // Save meta file
        mkdirSync(trans_dir, {recursive: true})
        write_json(meta_file, meta, true)
        num_added += 1
    }))

    // Report stats
    console.info(`DBL new: ${num_added}`)
    console.info(`DBL existing: ${num_existing}`)
    console.info(`DBL ignored: ${num_ignored}`)
    console.info(`DBL total: ${num_total}`)
}


export {generic_update_sources as update_sources} from './generic.js'
