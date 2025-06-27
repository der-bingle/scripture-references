
import {existsSync} from 'node:fs'

import * as gbt from '../integrations/gbt.js'


// At the moment only have support for Global Bible Tools glosses, so pretty simple...
export async function update_glosses(redownload:boolean){
    if (!existsSync(gbt.gbt_source_dir) || redownload){
        await gbt.download_glosses()
    }
    await gbt.sources_to_dist()
}
