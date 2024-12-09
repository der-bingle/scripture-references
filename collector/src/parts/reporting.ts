
import {join} from 'path'
import {existsSync} from 'fs'

import {read_json, read_dir} from './utils.js'
import type {TranslationSourceMeta} from './types'


export function _missing_meta(meta:TranslationSourceMeta){
    // True if important meta data missing (and so shouldn't publish)
    return !meta.year
        || !meta.copyright.licenses.length
        || !(meta.name.local || meta.name.english)
        || !(meta.name.local_abbrev || meta.name.english_abbrev)
}


export function report_items(mode?:'missing'){
    // Output a list of all included translations
    for (const id of read_dir(join('sources', 'bibles'))){
        const meta = read_json<TranslationSourceMeta>(join('sources', 'bibles', id, 'meta.json'))

        // Ignore depending on mode
        if (mode === 'missing' && !_missing_meta(meta)){
            continue
        }

        // Report the first license if any
        let license = meta.copyright.licenses[0]?.license
        if (!license){
            license = 'none'
        } else if (typeof license === 'object'){
            license = 'custom'
        }

        // Get URL for source's page for translation
        let url = ''
        if (meta.source.service === 'dbl'){
            url = `https://app.thedigitalbiblelibrary.org/entry?id=${meta.ids.dbl!}`
        } else if (meta.source.service === 'ebible'){
            url = `https://ebible.org/Scriptures/details.php?id=${meta.ids.ebible!}`
        }

        // Output fields in columns
        const fields = [id, meta.year, license, url]
        console.info(fields.map(field => `${field ?? 'null'}`.padEnd(16)).join(' '))
    }
}


export function report_unprocessed(){
    // Report which translations haven't been processed to distributable forms yet
    // TODO Option to require all books or just any book
    for (const trans of read_dir(join('dist', 'bibles'))){
        if (trans === 'manifest.json'){
            continue
        }
        const html_dir = join('dist', 'bibles', trans, 'html')
        const html_books = existsSync(html_dir) ? read_dir(html_dir) : []
        if (html_books.length === 0){
            console.error(`BOOKLESS ${trans}`)
        }
    }
}
