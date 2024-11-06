
import {basename} from 'node:path'
import {readFileSync} from 'node:fs'

import xpath from 'xpath'
import {DOMParser} from '@xmldom/xmldom'
import {last_verse} from '@gracious.tech/bible-references'

import type {BookExtracts} from './types'


export function extract_meta(path:string):BookExtracts{
    // Extract meta data from a single USX book

    const book = basename(path, '.usx')
    const meta:BookExtracts = {
        name: null,
        sections: [],  // TODO
        chapter_headings: [],  // TODO
    }

    // Parse the file
    const doc = new DOMParser().parseFromString(readFileSync(path, 'utf-8'))

    // Extract local for book
    // WARN Keep consistent with converters/usx-to-json/src/common.ts
    type Xout = Element|undefined
    meta.name =
        (xpath.select('(//para[@style="toc2"]/text())[1]', doc)[0] as Xout)?.nodeValue
        || (xpath.select('(//para[@style="h"]/text())[1]', doc)[0] as Xout)?.nodeValue
        || (xpath.select('(//para[@style="toc1"]/text())[1]', doc)[0] as Xout)?.nodeValue
        || null

    return meta
}
