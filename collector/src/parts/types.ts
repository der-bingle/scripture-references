
// Types specific to collector

import type {MetaTranslationName, MetaCopyright, MetaTag} from './shared_types'


export interface CollectionConfig {
    integrations: {
        aws: {
            bucket:string,
            region:string,
            cloudfront:string,
        },
    },
}


export type ServiceId = 'ebible'|'dbl'|'door43'


export interface TranslationSource {
    service:ServiceId|'manual'
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
    tags:MetaTag[]
    notes?:string  // Notes relevant to sourcing the translation and any issues that came up
    modified?:boolean  // Whether have modified source files (e.g. to fix bugs)
}


export interface TranslationSourceMeta extends CommonSourceMeta {
    ids:Partial<Record<ServiceId, string>>
    source:TranslationSource
}


export interface NotesSourceMeta extends CommonSourceMeta {
    // pass
}
