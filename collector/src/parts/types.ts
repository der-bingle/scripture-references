
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
    id:string
    url:string|null
}


export interface CommonSourceMeta {
    name:MetaTranslationName
    year:number|null
    language:string
    direction:'ltr'|'rtl'
    copyright:MetaCopyright
    tags:TranslationTag[]
    reviewed:boolean
    published:boolean
}


export interface TranslationSourceMeta extends CommonSourceMeta {
    literalness:TranslationLiteralness
    source:TranslationSource
}


export interface NotesSourceMeta extends CommonSourceMeta {
    // pass
}
