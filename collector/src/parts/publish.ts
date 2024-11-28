
import fs from 'node:fs'
import {join} from 'node:path'

import {concurrent, read_json, type_from_path, read_files_deep, write_json} from './utils.js'
import {PublisherAWS} from '../integrations/aws.js'
import {update_indexes} from './indexes.js'

import type {TranslationSourceMeta} from './types'
import type {DistManifest} from './shared_types'


export class Publisher extends PublisherAWS {
    // Interface for publishing collection to server

    async upload_files(paths:string[]){
        // Upload multiple files concurrently
        await concurrent(paths.map(path => async () => {
            const server_path = path.slice('dist/'.length)
            await this.upload(server_path, fs.readFileSync(path), type_from_path(path))
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
        files.push(...read_files_deep(join('dist', 'bibles', id)))
        invalidations.push(`/bibles/${id}/*`)
    }

    // Add other data
    files.push(...read_files_deep(join('dist', 'notes')))
    invalidations.push('/notes/*')
    files.push(...read_files_deep(join('dist', 'crossref')))
    invalidations.push('/crossref/*')

    // Add manifest last so assets are ready before it is used
    files.push(manifest_path)
    invalidations.push('/bibles/manifest.json')

    // Publish
    const publisher = new Publisher()
    await publisher.upload_files(files)
    await publisher.invalidate(invalidations)
}
