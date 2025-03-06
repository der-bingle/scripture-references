
import fs from 'node:fs'
import {join} from 'node:path'

import {concurrent, read_json, type_from_path, read_dir_deep} from '../parts/utils.js'
import {PublisherAWS} from '../integrations/aws.js'
import {generate_index_content} from '../parts/indexes.js'

import type {DistManifest} from '../parts/shared_types'


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


export async function publish(type?:'bible'|'notes'|'data', ids?:string){
    // Publish files to server
    const publisher = new Publisher()
    const invalidations = []
    if (!type || type === 'bible'){
        invalidations.push(...await _publish_bible(publisher, ids))
    }
    if (!type || type === 'notes'){
        invalidations.push(...await _publish_notes(publisher, ids))
    }
    if (!type || type === 'data'){
        invalidations.push(...await _publish_data(publisher, ids))
    }

    // Always update root index file, just in case
    await publisher.upload('index.html', generate_index_content('dist'), 'text/html')
    invalidations.push('/')

    await publisher.invalidate(invalidations)
}


async function _publish_bible(publisher:Publisher, translations?:string):Promise<string[]>{
    // Publish bibles and return paths needing invalidation

    // Detect translations from manifest so know they passed review
    const manifest_path = join('dist', 'bibles', 'manifest.json')
    const manifest = read_json<DistManifest>(manifest_path)

    // Add translations if not published yet
    const trans_ids = translations ? translations.split(',') : null
    const invalidations:string[] = []
    for (const id in manifest.translations){
        if (trans_ids && !trans_ids.includes(id)){
            continue  // Only publishing certain translations
        }

        // Upload bible's files and dir indexes
        console.info(`Publishing bible: ${id}`)
        await publisher.upload_dir(join('dist', 'bibles', id))
        invalidations.push(`/bibles/${id}/*`)
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
