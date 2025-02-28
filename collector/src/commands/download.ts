
import {join} from 'path'
import {writeFileSync} from 'fs'

import StreamZip from 'node-stream-zip'
import {last_verse} from '@gracious.tech/bible-references'

import {books_ordered} from '../parts/bible.js'
import {clean_dir, concurrent, request, read_json, list_dirs, list_files} from '../parts/utils.js'
import {TranslationSourceMeta} from '../parts/types.js'


export async function download_source(recheck:boolean, force:boolean, trans_id?:string){
    // Update the source files for all translations (or single if given)
    // TODO Don't update if update date unchanged

    // Collect meta files by service to better manage concurrency
    const manual_sourced:Record<string, TranslationSourceMeta> = {}
    const door43_sourced:Record<string, TranslationSourceMeta> = {}
    const ebible_sourced:Record<string, TranslationSourceMeta> = {}
    const dbl_sourced:Record<string, TranslationSourceMeta> = {}

    for (const id of list_dirs(join('sources', 'bibles'))){

        if (trans_id && id !== trans_id){
            continue  // Only updating a single translation
        }

        // Get translation's meta data
        const meta = read_json<TranslationSourceMeta>(join('sources', 'bibles', id, 'meta.json'))

        // Don't redownload if already downloaded (unless --recheck enabled)
        if (!recheck && list_files(join('sources', 'bibles', id, meta.source.format)).length){
            continue  // Already downloaded
        }

        // Don't download or re-extract from zip if have modified source (unless forcing)
        if (meta.modified && !force){
            console.warn(`Skipping ${id} as source has been modified (--force if needed)`)
            continue
        }

        // Allocate to correct service
        if (meta.source.service === 'manual'){
            manual_sourced[id] = meta
        } else if (meta.source.service === 'door43'){
            door43_sourced[id] = meta
        } else if (meta.source.service === 'ebible'){
            ebible_sourced[id] = meta
        } else if (meta.source.service === 'dbl'){
            dbl_sourced[id] = meta
        }
    }

    // Fail if nothing matched
    if ([manual_sourced, door43_sourced, ebible_sourced, dbl_sourced]
        .every(source => !Object.keys(source).length)){
        console.error("No translations identified")
    }

    // Wait for all to be updated
    // NOTE Currently all use same generic method, but a service may need a custom one in future
    // NOTE Even though same generic method, separating still helps to limit requests per server
    await Promise.all([
        generic_update_sources(manual_sourced),
        generic_update_sources(door43_sourced),
        generic_update_sources(ebible_sourced),
        generic_update_sources(dbl_sourced),
    ])
}


async function generic_update_sources(sources:Record<string, TranslationSourceMeta>){
    // Update the source files for given translation
    await concurrent(Object.entries(sources).map(([id, meta]) => async () => {
        console.info(`Downloading source files for ${id}`)
        try {
            await _update_source(id, meta)
        } catch (error){
            console.error(`FAILED to update source for: ${id}`)
            console.error(`${error as string}`)
        }
    }))
}


async function _update_source(id:string, meta:TranslationSourceMeta):Promise<void>{
    // Update the source files for the given translation

    // Paths
    const src_dir = join('sources', 'bibles', id)
    const zip_path = join(src_dir, 'source.zip')
    const format_dir = join(src_dir, meta.source.format)

    // Download zip (unless manually saved to repo)
    if (meta.source.url){
        const zip = await request(meta.source.url, 'arrayBuffer')
        writeFileSync(zip_path, Buffer.from(zip))
    }

    // Empty format dir
    clean_dir(format_dir)

    // Util for getting normalized extension
    const norm_ext = (name:string) => name.toLowerCase().split('.').at(-1)!

    // Extract file names from zip
    // skipEntryNameValidation enabled due to eng_net zip issues (we verify names below anyway)
    const extractor = new StreamZip.async({file: zip_path, skipEntryNameValidation: true})
    const zip_entries = Object.values(await extractor.entries())

    // Detect which file extention the source files have
    // E.g. If source files all have '.xml' detect them, but if '.usx' exists then ignore '.xml'
    const has_official_ext = !!zip_entries.find(e => norm_ext(e.name) === meta.source.format)
    const src_ext = has_official_ext ? meta.source.format
        : {usfm: 'sfm', usx: 'xml'}[meta.source.format]

    // Extract format files
    for (const entry of zip_entries){

        // Ignore if not in a compatible format
        if (norm_ext(entry.name) !== src_ext){
            continue
        }

        // Extract the contents to buffer
        const contents = await extractor.entryData(entry)

        // Identify what book the file is for
        const contents_str = contents.toString('utf-8')
        let book:string|undefined = undefined
        if (meta.source.format === 'usfm'){
            book = /^\\id (\w\w\w)/m.exec(contents_str)?.[1]?.toLowerCase()
        } else if (/<usx/.test(contents_str)){  // Ensure a USX book and not BookNames.xml
            book = /<book[^>]+code="(\w\w\w)"/.exec(contents_str)?.[1]?.toLowerCase()
        }

        // Confirm is in protestant canon
        if (!book){
            console.error(`Valid format but couldn't identify book: ${entry.name}`)
            continue
        } else if (!books_ordered.includes(book)){
            continue  // Probably Apoc.
        }

        // Append '.invalid' to file name if a partial book
        // NOTE File still extracted so can debug easier, but won't be used in platform
        let file_name = `${book}.${meta.source.format}`
        let regex:RegExp
        if (meta.source.format === 'usfm'){
            regex = /^\c (\d+)/mg
        } else {
            regex = /<chapter[^>]+number="(\d+)"/g
        }

        // Identify place of chapters
        const chapters:[number, number][] = []  // [chapter number, index]
        while (true){
            const result = regex.exec(contents_str)
            if (!result){
                break
            }
            chapters.push([parseInt(result[1] ?? ''), regex.lastIndex])
        }

        // Ensure all expected chapters are present
        /* WARN Shouldn't mark as invalid if different versification
            Some systems have longer books which won't be affected
                e.g. LXX Adds Nehemiah to end of Ezra making it longer
                Also Psalm 151, Joel 4, 2 Chron 37, Dan 14
            Only book that may get shorter is Malachi (English 4, others 3)
        */
        for (let ch=1; ch <= last_verse[book]!.length; ch++){
            if (book === 'mal' && ch === 4){
                continue  // Malachi only has 3 chapters in some versification systems
            }
            if (chapters[ch-1]?.[0] !== ch){
                file_name += '.invalid'
                break
            }

            // If chapter is just full of empty verse references, mark book as invalid
            // NOTE Only testing USFM for now as haven't found any issues with USX sources yet
            if (meta.source.format !== 'usfm'){
                continue
            }
            const ch_contents = contents_str.slice(chapters[ch-1]![1], chapters[ch]?.[1])
            const max_line_len = Math.max(...ch_contents.split('\n').map(l => l.trim().length))
            if (max_line_len < 10){
                file_name += '.invalid'
                break
            }
        }

        writeFileSync(join(format_dir, file_name), contents)
    }
}
