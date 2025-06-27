
// Export everything intended for direct use (code and types)


// Re-export everything from bible-references for convenience
export * from '@gracious.tech/bible-references'
export type * from '@gracious.tech/bible-references'


// Code
// NOTE Don't export classes not meant to be initiated directly, export them as types instead
export {BibleClient} from './client.js'
export {substantial_poetry} from './data.js'


// Types (only expose those relevant to the user and willing to support going forward)
export type {
    GetPassageOptions,
    GetTxtOptions,
    IndividualVerse,
    BibleBook,
    BibleBookHtml,
    BibleBookTxt,
    BibleBookUsfm,
    BibleBookUsx,
} from './book.js'

export type {BibleClientConfig} from './client.js'

export type {
    GetLanguagesOptions,
    GetLanguagesItem,
    GetTranslationsOptions,
    GetTranslationsItem,
    GetBooksOptions,
    GetBooksItem,
    GetCompletionReturn,
    BibleCollection,
} from './collection.js'

export type {
    BookCrossref,
} from './crossref.js'

export type {
    GlossesBook,
} from './glosses.js'

export type {
    UsageConfig,
    UsageOptions,
    RuntimeLicense,
    RuntimeCopyright,
    RuntimeTranslation,
    RuntimeManifest,
} from './types.js'

export type {
    BookNames,
    BibleJsonHtml,
    TxtHeading,
    TxtNote,
    TxtContent,
    BibleJsonTxt,
    GlossesData,
    GlossesDataWord,
} from './shared_types.js'
