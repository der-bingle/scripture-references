
import {existsSync, rmSync, unlinkSync} from 'fs'
import {join} from 'path'

import {list_dirs, list_files} from '../parts/utils.js'


export async function clean_collection(){

    // Remove dist dir for translation if source dir has been removed
    const trans_ids = list_dirs(join('sources', 'bibles'))
    for (const id of list_dirs(join('dist', 'bibles'))){
        if (!trans_ids.includes(id)){
            rmSync(join('dist', 'bibles', id), {recursive: true})
        }
    }

    // Remove dist books if src books do not exist or are invalid
    for (const id of list_dirs(join('sources', 'bibles'))){
        const src_format = existsSync(join('sources', 'bibles', id, 'usx')) ? 'usx' : 'usfm'
        const books = list_files(join('sources', 'bibles', id, src_format))
            .filter(b => !b.endsWith('.invalid'))
            .map(b => b.slice(0, 3))
        for (const format of ['usx', 'usfm', 'html', 'txt']){
            for (const file of list_files(join('dist', 'bibles', id, format))){
                if (!books.includes(file.slice(0, 3))){
                    unlinkSync(join('dist', 'bibles', id, format, file))
                }
            }
        }
    }
}
