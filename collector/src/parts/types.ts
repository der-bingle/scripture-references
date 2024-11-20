
// Types specific to collector

import type {MetaTranslationName, MetaCopyright, TranslationLiteralness,
    TranslationTag} from './shared_types'


export interface CollectionConfig {
    integrations: {
        dbl: {
            token:string,
            key:string,
        },
        aws: {
            bucket:string,
            region:string,
            cloudfront:string,
        },
    },
}


export interface TranslationSource {
    service:'ebible'|'dbl'|'door43'|'manual'
    format:'usfm'|'usx1-2'|'usx3+'
    updated:string  // yyyy-mm-dd
    id:string|null
    url:string|null
}


export interface CommonSourceMeta {
    name:MetaTranslationName
    year:number|null
    language:string
    direction:'ltr'|'rtl'
    copyright:MetaCopyright
}


export interface TranslationSourceMeta extends CommonSourceMeta {
    literalness:TranslationLiteralness
    tags:TranslationTag[]
    source:TranslationSource
    reviewed:boolean
}


export interface NotesSourceMeta extends CommonSourceMeta {
    // pass
}
