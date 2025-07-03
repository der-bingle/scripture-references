
// UTILS


export type OneOrMore<T> = [T, ...T[]]


// GENERIC META STRUCTURES (common to sources and dist)


export interface MetaLanguage {
    local:string
    english:string
    pop:number|null  // Null for confirmed dead languages
    direction:'ltr'|'rtl'
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

    // There are limits on how much may be quoted for digital use
    // NOTE Print restrictions should be manually reviewed by developers and don't apply here
    forbid_limitless:boolean

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


// Common to bibles/glosses/notes/etc
export interface DistManifestItem {
    name:MetaTranslationName
    year:number
    books_ot:true|string[]
    books_nt:true|string[]
    copyright:MetaCopyright
    direction:'ltr'|'rtl'
    tags:MetaTag[]
}

export interface DistTranslation extends DistManifestItem {
}

export interface DistGloss extends DistManifestItem {
}

export interface DistNotes extends DistManifestItem {
}


/* Tags:
    recommended: Only one per language, the best default resource for most people
    archaic: Uses old language (only used when year is modern as can assume all old are archaic)
    questionable: Substantial criticism or concerning origins
    niche: Only useful for academic study or for people with a certain ideology

    Literalness score from 1 (high) to 5 (low)
    1: So literal that it is not gramatically correct at times (e.g. LSV)
    2: Readable English but awkward and hard to understand at times (e.g. ESV/NASB)
    3: Easily readable with rephrasing only when necessary (e.g. BSB/NIV)
    4: Frequent rephrasing to help modern readers (e.g. NLT)
    5: Constant rephrasing that is highly interpretive (e.g. MSG)
*/
export type MetaTag = 'recommended'|'archaic'|'questionable'|'niche'
    |'literal1'|'literal2'|'literal3'|'literal4'|'literal5'


export interface DistManifest {
    bibles:Record<string, DistTranslation>
    glosses:Record<string, DistGloss>
    notes:Record<string, DistNotes>
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

export interface GlossesData {
    trans_id:string
    book:string
    // NOTE Compact format used not just for transport but to reduce memory use in clients
    //      As glosses with original words are basically 2x a whole bible
    // NOTE word should include diacritics and punctuation if any (can strip in client)
    contents:[string, string][][][]  // chapters > verses > words > [word, gloss]
}

export interface MultiVerseNote {
    start_chapter:number
    start_verse:number
    end_chapter:number
    end_verse:number
    contents:string
}

export interface NotesData {
    notes_id:string
    book:string
    verses:Record<string, Record<string, string>>  // Single verses organised by chapter and verse
    // NOTE No separate prop for chapters as more logical to break down by section than chapter
    ranges:MultiVerseNote[]  // Notes that span multiple verses and/or chapters
}
