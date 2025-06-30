
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


export type TransServiceId = 'ebible'|'dbl'|'door43'
export type GlossesServiceId = 'gbt'
export type GeneralServiceId = TransServiceId|GlossesServiceId


export interface TranslationSource {
    service:GeneralServiceId|'manual'
    format:'usfm'|'usx'|null  // null if format is non-standard and specific to service
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
    ids:Partial<Record<GeneralServiceId, string>>
    source:TranslationSource
    notes?:string  // Notes relevant to sourcing the translation and any issues that came up
    modified?:boolean  // Whether have modified source files (e.g. to fix bugs)
}


export interface TranslationSourceMeta extends CommonSourceMeta {
}

export interface GlossesSourceMeta extends CommonSourceMeta {
}

export interface NotesSourceMeta extends CommonSourceMeta {
}
