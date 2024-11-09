
// General types specific to the client

import type {MetaCopyright, DistManifest, DistTranslation, MetaRestrictions} from './shared_types'


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

export type RuntimeTranslation = Omit<DistTranslation, 'copyright'> & {
    copyright:RuntimeCopyright
    books_ot_list:string[]
    books_nt_list:string[]
}

export type RuntimeManifest = Omit<DistManifest, 'translations'> & {
    translations:Record<string, RuntimeTranslation>
}
