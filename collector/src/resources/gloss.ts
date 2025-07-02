
import {existsSync} from 'node:fs'

import * as gbt from '../integrations/gbt.js'
import {update_manifest} from '../parts/manifest.js'


// At the moment only have support for Global Bible Tools glosses, so pretty simple...
export async function update_glosses(redownload:boolean){
    if (!existsSync(gbt.gbt_source_dir) || redownload){
        await gbt.download_glosses()
    }
    await gbt.sources_to_dist()

    // Update manifest whenever dist files change
    await update_manifest()
}
