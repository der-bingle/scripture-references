
// Types specific to collector

import type {MetaTranslationName, MetaCopyright, MetaBookSection} from './shared_types'


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


export interface BookExtracts {
    name:string|null
    sections:MetaBookSection[]
    missing_verses:Record<number, Record<number, [number, number]|null>>
    chapter_headings:Record<number, string|null>  // Null if a section provides a better heading
}


export interface CommonSourceMeta {
    name:MetaTranslationName
    year:number|null
    version:string
    language:string
    direction:'ltr'|'rtl'
    copyright:MetaCopyright
}


export interface TranslationSourceMeta extends CommonSourceMeta {
    // Recommended is used to further customise the exclude_obsolete filter and default translation
    // They are usually based on year, but this can manually account for other factors
    // Set to false to consider even a modern translation obsolete
    // Set to true to consider a translation the best available even if others newer
    recommended:boolean|null  // Only one per language should be true
    source:TranslationSource
    reviewed:boolean
}


export interface NotesSourceMeta extends CommonSourceMeta {
    // pass
}
