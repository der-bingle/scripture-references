
import {PublisherAWS} from '../integrations/aws.js'
import {update_manifest} from '../parts/manifest.js'


export async function publish(type?:'bibles'|'glosses'|'notes'|'data', ids?:string){

    // ids can be comma separated
    const ids_array = ids ? ids.split(',') : undefined

    // Update manifest in case forgot to
    await update_manifest()

    const publisher = new PublisherAWS()
    await publisher.publish(type, ids_array)
}
