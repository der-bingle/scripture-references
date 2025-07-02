
import {books_ordered} from '@gracious.tech/bible-references'

import {filter_licenses} from './licenses.js'
import {BibleCollection} from './bibles.js'

import type {DistManifest, MetaCopyright, MetaStandardLicense, OneOrMore} from './shared_types'
import type {UsageConfig, RuntimeManifest, RuntimeLicense} from './types'
import type {RequestHandler} from './request'


// Access to a collection's meta data, including languages and translations available
export class FetchCollection {

    // @internal
    _usage:UsageConfig
    // @internal
    _manifest:RuntimeManifest

    requester:RequestHandler
    bibles:BibleCollection

    // @internal
    constructor(usage:UsageConfig, requester:RequestHandler,
            manifests:OneOrMore<[string, DistManifest]>){
        // Merge the manifests given into a combined collection while remembering endpoints
        // WARN Original manifests are not dereferenced and assumed to not be used outside here

        this._usage = usage
        this.requester = requester

        // Start with an empty manifest with common metadata extracted from first manifest
        this._manifest = {
            translations: {},
            glosses: {},
            notes: {},
            languages: {},
            language2to3: {},
            // The following are the same in all manifests
            languages_most_spoken: manifests[0][1].languages_most_spoken,  // Not filtered like ^
            licenses: manifests[0][1].licenses,
        }

        // Process manifests in reverse such that the first will have priority
        const manifests_reversed = [...manifests].reverse()  // reverse() modifies original
        for (const [endpoint, manifest] of manifests_reversed){

            // Combine language data
            Object.assign(this._manifest.languages, manifest.languages)
            Object.assign(this._manifest.language2to3, manifest.language2to3)

            // Loop through endpoint's resources
            const resource_types = ['translations', 'glosses', 'notes'] as const
            for (const type of resource_types){
                for (const [trans, trans_data] of Object.entries(manifest[type])){

                    // Get data for licenses compatible with _usage
                    const licenses = resolve_license_data(manifest.licenses, this._usage,
                        trans_data.copyright)
                    if (!licenses.length){
                        continue  // No compatible licenses so exclude translation
                    }

                    // Add the translation to the combined collection
                    this._manifest[type][trans] = {
                        ...trans_data,
                        ...resolve_books(trans_data.books_ot, trans_data.books_nt),
                        copyright: {
                            ...trans_data.copyright,
                            licenses,
                        },
                        endpoint,
                    }
                }
            }
        }

        // Init resource subcollections
        this.bibles = new BibleCollection(
            this._manifest.translations,
            this.requester,
            this._manifest.languages,
            this._manifest.language2to3,
            this._manifest.languages_most_spoken,
            this._usage,
        )
    }
}


// Resolve books data to list of books
function resolve_books(ot:true|string[], nt:true|string[]){
    // Work out exactly what books are included (interpret `true` for whole testament)
    return {
        books_ot_list: ot === true ? books_ordered.slice(0, 39) : ot,
        books_nt_list: nt === true ? books_ordered.slice(39) : nt,
    }
}


// Resolve raw license data to usable form
function resolve_license_data(standard_licenses:Record<string, MetaStandardLicense>,
        usage:UsageConfig, copyright:MetaCopyright){
    const licenses:RuntimeLicense[] = copyright.licenses.map(item => {
        if (typeof item.license === 'string'){
            return {
                id: item.license,
                name: standard_licenses[item.license]!.name,
                restrictions: standard_licenses[item.license]!.restrictions,
                url: item.url,
            }
        } else {
            return {
                id: null,
                name: "Custom license",
                restrictions: item.license,
                url: item.url,
            }
        }
    })

    // Remove licenses not compatible with the given usage restrictions
    return filter_licenses(licenses, usage)
}
