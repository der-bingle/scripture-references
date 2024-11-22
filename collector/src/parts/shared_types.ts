
// UTILS


export type OneOrMore<T> = [T, ...T[]]


// GENERIC META STRUCTURES (common to sources and dist)


export interface MetaLanguage {
    local:string
    english:string
    pop:number|null  // Null for confirmed dead languages
}

export interface MetaTranslationName {
    // NOTE Guaranteed to have either local or english (but might not be both) when published
    local:string
    local_abbrev:string
    english:string
    english_abbrev:string
}

export interface MetaRestrictions {
    /* Restrictions that (1) commonly apply to translations and (2) commonly affect users

    These are designed to aid automated selection/elimination of translations for most use cases
        but are not exhaustive and users will still need to take responsibility themselves for
        appropriately using/not using translations.

    If there are complex interactions between conditions
        e.g. Verse limitations apply to commercial use but not other uses
        Then create multiple custom licenses to account for the various possibilities

    Not all conditions are included
        For example some translations forbid unchristian use
            e.g. https://ebible.org/Scriptures/details.php?id=ukr1996
        But such conditions are too vague and varied to usefully categorise and this service is
        already expected to be almost exclusively used by mainline Christians.
        If a condition _is_ "likely" to affect users then the `forbid_other` should be true.

    */

    // Limit on how many verses can be quoted in a single "work"
    // NOTE Inclusive (1000 means 1000 is ok but 1001 is a violation)
    limit_verses:number|null

    // Limit on how much of a single Bible "book" can be quoted
    // NOTE Inclusive (50 means 50% of book is ok but 51% is not)
    limit_book_ratio:number|null

    // Limit on how much of the total "work" can be made up of quotations
    // NOTE Exclusive (50 means 50% is a violation but 49% isn't)
    limit_content_ratio:number|null

    // Commercial use is forbidden
    forbid_commercial:boolean

    // Modifying the text is forbidden either entirely or if publishing under a different license
    forbid_derivatives:boolean|'same-license'

    // The owner of the translation must be attributed whenever the text is used
    forbid_attributionless:boolean

    // Other conditions that are significant enough to potentially be an issue for some users
    // NOTE Licenses will always have slight variations so this should only be used if "significant"
    forbid_other:boolean
}

export interface MetaStandardLicense {
    name:string
    restrictions:MetaRestrictions
}

export interface MetaCopyright {
    attribution:string  // The minimum required by the licenses (or just owner name if not required)
    attribution_url:string  // Link to translation on owner's website
    licenses:{license: string|MetaRestrictions, url:string}[]
}


// DIST


// Common to bibles/notes/etc
export interface DistManifestItem {
    language:string
    name:MetaTranslationName
    year:number
    direction:'ltr'|'rtl'
    copyright:MetaCopyright
}


// 1-unnatural 2-literal 3-balanced 4-dynamic 5-paraphrase
export type TranslationLiteralness = 1|2|3|4|5|null
/* Tags:
    recommended: Only one per language, the best default translation for most people
    archaic: Uses old language (even if a relatively new version)
    questionable: Substantial criticism or concerning origins
    niche: Only useful for academic study or for people with a certain ideology
*/
export type TranslationTag = 'recommended'|'archaic'|'questionable'|'niche'


export interface DistTranslation extends DistManifestItem {
    literalness:TranslationLiteralness
    tags:TranslationTag[]
    books_ot:true|string[]
    books_nt:true|string[]
}


export interface DistManifest {
    translations:Record<string, DistTranslation>
    languages:Record<string, MetaLanguage>
    language2to3:Record<string, string>
    languages_most_spoken:string[]
    books_ordered:string[]
    book_names_english:Record<string, string>
    licenses:Record<string, MetaStandardLicense>
}


export interface BookSection {
    start_chapter:number
    start_verse:number
    end_chapter:number
    end_verse:number
    heading:string|null  // null if same as chapter heading (to reduce data transfer required)
}


export interface DistTranslationExtra {
    book_names:Record<string, BookNames>
    chapter_headings:Record<string, string[]>
    sections:Record<string, BookSection[]>
}


export interface DistNotes extends DistManifestItem {
    books:string[]
}


export interface DistNotesManifest {
    notes:Record<string, DistNotes>
}


// FORMATS

export interface BookNames {
    // WARN All of these may be an empty string if the data isn't available
    normal:string
    long:string
    abbrev:string
}


export interface BibleJsonHtml {
    book:string
    name:BookNames
    contents: string[][][]
}

export interface TxtHeading {
    type:'heading'
    contents:string
    level:1|2|3
}

export interface TxtNote {
    type:'note'
    contents:string
}

export type TxtContent = string|TxtHeading|TxtNote

export interface BibleJsonTxt {
    book:string
    name:BookNames
    contents: TxtContent[][][]
}

export type CrossrefSingle = [string, number, number]
export type CrossrefRange = [...CrossrefSingle, number, number]
export type CrossrefData = Record<string, Record<string, (CrossrefSingle|CrossrefRange)[]>>
