
import {join} from 'node:path'
import {existsSync, mkdirSync} from 'node:fs'

import {request, concurrent, write_json, read_json} from '../parts/utils.js'
import {LICENSES} from '../parts/license.js'
import {get_language_data} from '../parts/languages.js'

import type {TranslationSourceMeta} from '../parts/types'


// Translations that can be sourced from a better location (or other issue)
const IGNORE:string[] = []

// Some language codes are outdated
const OUTDATED_LANG:Record<string, string> = {cug: 'cnq'}


interface ListItem {
    // NOTE Only relevant items included
    id:string  // A random chars id
    entrytype:string  // 'text' or other...
    revision:string  // Incrementing number that identifies if an update has been issued
    dateUpdated:string // YYYY-MM-DD[T...] Date of latest update
    dateArchived:string  // YYYY-MM-DD[T...] First date added to DBL
    dateCompleted:string  // YYYY-MM-DD[T...] This is often blank for partial translations
    rightsHolder:{link:string, name:string}[]  // Link for API request for org, not URL of org
    languageCode:string  // 3 char
    nameCommon:string
    nameCommonLocal:string
    nameAbbreviation:string
    nameAbbreviationLocal:string
    languageScriptDirection:string
    copyrightStatement:string
    confidential:'true'|'false'  // Whether can view HTML meta or not (can still download, lol)
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


// Short abbreviations for orgs that have many translations
const org_abbreviations:Record<string, string> = {
    '545d2cb05f032bce5404dab8': 'wfw',
    '545d2cb013cb53cafc2bad91': 'pbt',
    '545d2cb007eaee5131ab123a': 'ubs',
    '545d2cb00fd5dca263562474': 'bib',
    '545d2cb00be06579ca809b57': 'wbt',
    '54650d065117ad695d428986': 'seed',
    '019217aaaebdd5e7e372cf90': 'love',
}


export async function discover(existing:string[], discover_specific_id?:string):Promise<void>{
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

        // Skip if only want to discover a single translation
        if (discover_specific_id && item.id !== discover_specific_id){
            return
        }

        // Get org abbrev if any
        const org_id = item.rightsHolder[0]!.link.split('/').at(-1) ?? ''
        const org_abbrev = org_abbreviations[org_id]

        // Prepare english abbreviation first as may need to use for id
        const lang_code = language_data.normalise(
            OUTDATED_LANG[item.languageCode] ?? item.languageCode)
        let eng_abbrev = item.nameAbbreviation.toLowerCase().replace(/[^a-z]/gi, '')
        if (lang_code && eng_abbrev.includes(lang_code)){
            // Some translations include the language code in the abbreviation which isn't helpful
            eng_abbrev = eng_abbrev.replace(lang_code, '')
        }

        // Determine ids
        // NOTE Use org abbreviation when available (fallback on 'a' for later manual correction)
        const trans_id = `${lang_code ?? ''}_${org_abbrev || eng_abbrev || 'a'}`
        const log_ids = `${trans_id}/${item.id}`

        // Skip if already exists
        if (existing.includes(item.id)){
            num_existing += 1
            return
        }

        // Ignore if invalid language
        if (!lang_code){
            console.error(`INVALID ${item.languageCode} (unknown language)`)
            num_ignored += 1
            return
        }

        // If already added via another service, add dbl id to it
        const trans_dir = join('sources', 'bibles', trans_id)
        const meta_file = join(trans_dir, 'meta.json')
        if (existsSync(meta_file)){
            const existing_meta = read_json<TranslationSourceMeta>(meta_file)
            if (!existing_meta.ids.dbl){
                existing_meta.ids.dbl = item.id
                write_json(meta_file, existing_meta, true)
            }
            num_existing += 1
            return
        }

        // Search for the license
        const html_url = `https://app.thedigitalbiblelibrary.org/entry?id=${item.id}`
        const html_resp = await request(html_url, 'text')
        let license:string|null = null
        let license_url = html_url

        // Get unique CC license types mentioned
        // WARN Won't detect some versions which have "confidential" true yet still appear in list
        //      As these require logging into the DBL despite having an open license
        const cc_abbrev =
            new Set([...html_resp.matchAll(/cc (by[a-z-]*)/ig)].map(r => r[1]!.toLowerCase()))

        // Determine what the license is
        if (/public domain/i.test(html_resp) && !/not public domain/i.test(html_resp)){
            license = 'public'
            if (html_resp.includes('creativecommons.org/publicdomain/zero/1.0')){
                license_url = 'https://creativecommons.org/publicdomain/zero/1.0/'
            }
        } else if (cc_abbrev.size === 1){
            // Only auto-add if one license type (otherwise manually review which is best)
            const conditions = [...cc_abbrev.values()][0]!
            license = `cc-${conditions}`
            if (license in LICENSES){
                // NOTE DBL doesn't specify license version so 4.0 can only be assumed
                license_url = `https://creativecommons.org/licenses/${conditions}/4.0/`
            } else {
                console.warn(`Failed to detect CC license "${license}" (${log_ids})`)
                license = null
            }
        }

        // Get owner details
        let org:OrgItem = {contact_url: '', full_name: '', local_name: ''}
        try {
            org = (await request<OrgResp>(item.rightsHolder[0]!.link, 'json')).orgs[0]!
            // Some entries have a domain without a scheme
            if (org.contact_url && !org.contact_url.startsWith('http')){
                org.contact_url = 'https://' + org.contact_url
            }
        } catch {
            // Some orgs will throw 403 (not related to translation's `confidential` prop)
        }

        // Determine most useful URL for a user to learn more about the translation
        const attr_url = item.confidential === 'true' ? org.contact_url : html_url

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
                attribution_url: attr_url,
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
