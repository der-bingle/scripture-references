
// Types specific to collector

import type {MetaTranslationName, MetaCopyright, TranslationLiteralness,
    TranslationTag} from './shared_types'


export interface CollectionConfig {
    integrations: {
        aws: {
            bucket:string,
            region:string,
            cloudfront:string,
        },
    },
}


export interface TranslationSource {
    service:'ebible'|'dbl'|'door43'|'manual'
    format:'usfm'|'usx'
    updated:string  // yyyy-mm-dd
    revision:number  // 0 if not used
    url:string|null
}


export interface CommonSourceMeta {
    name:MetaTranslationName
    year:number|null
    direction:'ltr'|'rtl'
    copyright:MetaCopyright
    tags:TranslationTag[]
    published:boolean
}


export interface TranslationSourceMeta extends CommonSourceMeta {
    ids:Partial<Record<'ebible'|'dbl'|'door43', string>>
    literalness:TranslationLiteralness
    source:TranslationSource
}


export interface NotesSourceMeta extends CommonSourceMeta {
    // pass
}
