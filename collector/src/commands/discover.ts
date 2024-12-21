
import {join} from 'node:path'

import * as door43 from '../integrations/door43.js'
import * as ebible from '../integrations/ebible.js'
import * as dbl from '../integrations/dbl.js'
import {list_dirs, read_json} from '../parts/utils.js'

import type {ServiceId, TranslationSourceMeta} from '../parts/types.js'


export async function discover_translations(service:ServiceId, discover_specific_id?:string){
    // Discover translations and save their meta data

    // Warn if service arg invalid
    const services:ServiceId[] = ['door43', 'ebible', 'dbl']
    if (service && !services.includes(service)){
        console.error(`Service must be one of: ` + services.join(', '))
        return
    }

    // Get service ids for all existing translations so know if already discovered
    const ids = Object.fromEntries(services.map(
        service => [service, [] as string[]])) as Record<ServiceId, string[]>
    for (const trans of list_dirs(join('sources', 'bibles'))){
        const meta = read_json<TranslationSourceMeta>(join('sources', 'bibles', trans, 'meta.json'))
        for (const service of Object.keys(meta.ids) as ServiceId[]){
            ids[service].push(meta.ids[service]!)
        }
    }

    // Consult one or more services
    // NOTE Order is from most->least likely to have original sources
    if (!service || service === 'dbl'){
        await dbl.discover(ids.dbl, discover_specific_id)
    }
    if (!service || service === 'ebible'){
        await ebible.discover(ids.ebible, discover_specific_id)
    }

    // Only check door43 if specifically requested
    // TODO Parse their unusual USFM format and confirm quality/readiness of translations
    if (service === 'door43'){
        await door43.discover(ids.door43, discover_specific_id)
    }
}
