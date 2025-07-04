
import fs from 'node:fs'
import {join} from 'node:path'

import {concurrent, read_json, type_from_path, read_dir_deep} from '../parts/utils.js'
import {generate_index_content} from '../parts/indexes.js'

import type {DistManifest} from './shared_types'


export class Publisher {
    // Interface for publishing collection to server

    _manifest:DistManifest

    constructor(){
        // Detect resources from manifest so know they passed review
        this._manifest = read_json<DistManifest>(join('dist', 'manifest.json'))
    }

    async upload(key:string, body:Buffer|string, type:string):Promise<void>{
        throw new Error("Needs to be implemented")
    }

    async invalidate(paths:string[]):Promise<void>{
        throw new Error("Needs to be implemented")
    }

    // Upload a single file
    // WARN This doesn't update the parent dir's index (since should do after all children done)
    async upload_file(path:string):Promise<void>{
        const server_path = path.slice('dist/'.length)
        await this.upload(server_path, fs.readFileSync(path), type_from_path(path))
    }

    // Upload all files in dir and also upload generated indexes for the dir and subdirs
    // WARN This doesn't update the parent dir's index (since should do after all children done)
    async upload_dir(dir:string):Promise<void>{
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

    // Publish the manifest
    async publish_manifest():Promise<string[]>{
        const manifest_path = join('dist', 'manifest.json')
        await this.upload_file(manifest_path)

        // Also upload manifest to old location for clients < 1.1.0 with old prop name for bibles
        // This won't be listed in index.html
        const manifest = fs.readFileSync(manifest_path, {encoding: 'utf8'})
            .replace('"bibles":{', '"translations":{')
        await this.upload('bibles/manifest.json', manifest, 'application/json')
        return ['/manifest.json', '/bibles/manifest.json']
    }

    // Publish resources and return paths needing invalidation
    // WARN This doesn't update the root dir's index (since should do after all children done)
    async publish_resources(category:'bibles'|'glosses'|'notes', resources?:string|string[]):
            Promise<string[]>{

        // Can be passed a single string or an array of ids
        const resource_ids = typeof resources === 'string' ? [resources] : resources

        // Upload resources desired to be published (but only if in manifest, i.e. ready)
        const invalidations:string[] = []
        for (const id in this._manifest[category]){
            if (resource_ids && !resource_ids.includes(id)){
                continue  // Only publishing certain resources
            }

            // Upload files and dir indexes
            console.info(`Publishing: ${id}`)
            await this.upload_dir(join('dist', category, id))
            invalidations.push(`/${category}/${id}/*`)
        }

        // Also always republish category's dir index in case any changes
        const category_index = generate_index_content(`dist/${category}`)
        await this.upload(`${category}/index.html`, category_index, 'text/html')
        invalidations.push(`/${category}/`)

        return invalidations
    }

    // Publish everything, or a specific category, or id
    async publish(type?:'bibles'|'glosses'|'notes'|'data', ids?:string|string[]){

        // Publish the various types of resources
        const invalidations:string[] = []
        if (!type || type === 'bibles'){
            invalidations.push(...await this.publish_resources('bibles', ids))
        }
        if (!type || type === 'glosses'){
            invalidations.push(...await this.publish_resources('glosses', ids))
        }
        if (!type || type === 'notes'){
            invalidations.push(...await this.publish_resources('notes', ids))
        }
        if (!type || type === 'data'){
            // Resources that aren't listed in the manifest since are singular
            await this.upload_dir(join('dist', 'crossref'))
            invalidations.push('/crossref/*')
            // TODO Eventually get search into manifest and upload based on that
            await this.upload_dir(join('dist', 'search'))
            invalidations.push('/search/*')
        }

        // Always upload fresh manifest in case any changes, and do last so assets ready before used
        invalidations.push(...await this.publish_manifest())

        // Always update root index file in case any changes
        await this.upload('index.html', generate_index_content('dist'), 'text/html')
        invalidations.push('/')

        await this.invalidate(invalidations)
    }
}
