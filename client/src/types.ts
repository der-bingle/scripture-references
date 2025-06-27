
// General types specific to the client

import type {MetaCopyright, DistManifest, MetaRestrictions, DistManifestItem} from './shared_types'


export interface UsageConfig {
    commercial:boolean
    attributionless:boolean
    limitless:boolean
    derivatives:boolean|'same-license'
}


export type UsageOptions = Partial<UsageConfig>


// Runtime representation of manifests differs in that it combines multiple and resolves references

export interface RuntimeLicense {
    id:string|null
    name:string
    restrictions:MetaRestrictions
    url:string
}

export type RuntimeCopyright = Omit<MetaCopyright, 'licenses'> & {
    licenses:RuntimeLicense[]
}

export type RuntimeManifestItem = Omit<DistManifestItem, 'copyright'> & {
    // These fields have refined types during runtime
    copyright:RuntimeCopyright
    books_ot_list:string[]
    books_nt_list:string[]
}

export type RuntimeTranslation = RuntimeManifestItem
export type RuntimeGloss = RuntimeManifestItem
export type RuntimeNotes = RuntimeManifestItem

export type RuntimeManifest = Omit<DistManifest,
        'translations'|'glosses'|'notes'|'books_ordered'|'book_names_english'> & {
    translations:Record<string, RuntimeTranslation>
    glosses:Record<string, RuntimeGloss>
    notes:Record<string, RuntimeNotes>
}
