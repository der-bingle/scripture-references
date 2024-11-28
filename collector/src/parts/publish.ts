
import fs from 'node:fs'
import {join} from 'node:path'

import {concurrent, read_json, type_from_path, write_json, read_dir_deep} from './utils.js'
import {PublisherAWS} from '../integrations/aws.js'
import {generate_index_content} from './indexes.js'

import type {TranslationSourceMeta} from './types'
import type {DistManifest} from './shared_types'


export class Publisher extends PublisherAWS {
    // Interface for publishing collection to server

    async upload_file(path:string){
        // Upload a single file
        const server_path = path.slice('dist/'.length)
        await this.upload(server_path, fs.readFileSync(path), type_from_path(path))
    }

    async upload_dir(dir:string){
        // Upload all files in dir and also upload generated indexes for the dir and subdirs
        const dir_contents = read_dir_deep(dir)

        // Upload files
        await concurrent(dir_contents.files.map(path => async () => {
            await this.upload_file(path)
        }))

        // Upload dir indexes
        await concurrent(dir_contents.dirs.map(path => async () => {
            const server_path = join(path.slice('dist/'.length), 'index.html')
            await this.upload(server_path, generate_index_content(path), 'text/html')
        }))
    }
}


export async function publish(type?:'bible'|'notes'|'data', id?:string){
    // Publish files to server
    const publisher = new Publisher()
    const invalidations = []
    if (!type || type === 'bible'){
        invalidations.push(...await _publish_bible(publisher, id))
    }
    if (!type || type === 'notes'){
        invalidations.push(...await _publish_notes(publisher, id))
    }
    if (!type || type === 'data'){
        invalidations.push(...await _publish_data(publisher, id))
    }

    // Always update root index file, just in case
    await publisher.upload('index.html', generate_index_content('dist'), 'text/html')
    invalidations.push('/')

    await publisher.invalidate(invalidations)
}


async function _publish_bible(publisher:Publisher, translation?:string):Promise<string[]>{
    // Publish bibles and return paths needing invalidation

    // Detect translations from manifest so know they passed review
    const manifest_path = join('dist', 'bibles', 'manifest.json')
    const manifest = read_json<DistManifest>(manifest_path)

    // Add translations if not published yet
    const invalidations:string[] = []
    for (const id in manifest.translations){
        if (translation && id !== translation){
            continue  // Only publishing a single translation
        }

        // See if translation's latest changes have been published yet
        const meta_file_path = join('sources', 'bibles', id, 'meta.json')
        const bible_meta = read_json<TranslationSourceMeta>(meta_file_path)
        if (bible_meta.published && !translation){
            continue  // Skip if published but force if only publishing this translation
        }

        // Upload bible's files and dir indexes
        await publisher.upload_dir(join('dist', 'bibles', id))
        invalidations.push(`/bibles/${id}/*`)

        // Mark as published in sources meta
        bible_meta.published = true
        write_json(meta_file_path, bible_meta, true)
    }

    // Upload manifest last so assets are ready before it is used
    // NOTE Always uploaded so no changes are missed with included translations
    await publisher.upload_file(manifest_path)
    invalidations.push('/bibles/manifest.json')

    // Also always republish bibles dir index in case any changes
    await publisher.upload('bibles/index.html', generate_index_content('dist/bibles'), 'text/html')
    invalidations.push('/bibles/')

    return invalidations
}


async function _publish_notes(publisher:Publisher, id?:string):Promise<string[]>{
    // Publish study notes and return paths for invalidation
    // TODO Currently uploading everything as no manifest yet
    await publisher.upload_dir(join('dist', 'notes'))
    return ['/notes/*']
}

async function _publish_data(publisher:Publisher, id?:string):Promise<string[]>{
    // Publish data and return paths for invalidation
    await publisher.upload_dir(join('dist', 'crossref'))
    return ['/crossref/*']
}
