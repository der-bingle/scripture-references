
// Bible book ids in traditional order
export const books_ordered:readonly string[] = Object.freeze([
    'gen', 'exo', 'lev', 'num', 'deu', 'jos', 'jdg', 'rut', '1sa', '2sa', '1ki', '2ki', '1ch',
    '2ch', 'ezr', 'neh', 'est', 'job', 'psa', 'pro', 'ecc', 'sng', 'isa', 'jer', 'lam', 'ezk',
    'dan', 'hos', 'jol', 'amo', 'oba', 'jon', 'mic', 'nam', 'hab', 'zep', 'hag', 'zec', 'mal',
    'mat', 'mrk', 'luk', 'jhn', 'act', 'rom', '1co', '2co', 'gal', 'eph', 'php', 'col', '1th',
    '2th', '1ti', '2ti', 'tit', 'phm', 'heb', 'jas', '1pe', '2pe', '1jn', '2jn', '3jn', 'jud',
    'rev',
])


// Usual English names of Bible books
export const book_names_english:Readonly<Record<string, string>> = Object.freeze({
    'gen': "Genesis",
    'exo': "Exodus",
    'lev': "Leviticus",
    'num': "Numbers",
    'deu': "Deuteronomy",
    'jos': "Joshua",
    'jdg': "Judges",
    'rut': "Ruth",
    '1sa': "1 Samuel",
    '2sa': "2 Samuel",
    '1ki': "1 Kings",
    '2ki': "2 Kings",
    '1ch': "1 Chronicles",
    '2ch': "2 Chronicles",
    'ezr': "Ezra",
    'neh': "Nehemiah",
    'est': "Esther",
    'job': "Job",
    'psa': "Psalms",
    'pro': "Proverbs",
    'ecc': "Ecclesiastes",
    'sng': "Song of Songs",
    'isa': "Isaiah",
    'jer': "Jeremiah",
    'lam': "Lamentations",
    'ezk': "Ezekiel",
    'dan': "Daniel",
    'hos': "Hosea",
    'jol': "Joel",
    'amo': "Amos",
    'oba': "Obadiah",
    'jon': "Jonah",
    'mic': "Micah",
    'nam': "Nahum",
    'hab': "Habakkuk",
    'zep': "Zephaniah",
    'hag': "Haggai",
    'zec': "Zechariah",
    'mal': "Malachi",
    'mat': "Matthew",
    'mrk': "Mark",
    'luk': "Luke",
    'jhn': "John",
    'act': "Acts",
    'rom': "Romans",
    '1co': "1 Corinthians",
    '2co': "2 Corinthians",
    'gal': "Galatians",
    'eph': "Ephesians",
    'php': "Philippians",
    'col': "Colossians",
    '1th': "1 Thessalonians",
    '2th': "2 Thessalonians",
    '1ti': "1 Timothy",
    '2ti': "2 Timothy",
    'tit': "Titus",
    'phm': "Philemon",
    'heb': "Hebrews",
    'jas': "James",
    '1pe': "1 Peter",
    '2pe': "2 Peter",
    '1jn': "1 John",
    '2jn': "2 John",
    '3jn': "3 John",
    'jud': "Jude",
    'rev': "Revelation",
})


// Special English abbreviations of book names
// These could in theory abbreviate multiple books, and are only specified because of convention
// See https://www.logos.com/bible-book-abbreviations
// These are hard-coded so that they will result in a correct match if English default is kept
export const special_english_abbrev_include:readonly [string, string][] = Object.freeze([
    // [code, abbrev]
    ['num', "nm"],
    ['ezr', "ez"],
    ['mic', "mc"],
    ['hab', "hb"],
    ['jhn', "jn"],
    ['php', "phil"],
    ['phm', "pm"],
    ['jas', "jm"],
    ['jud', "jud"],
    ['jud', "jd"],
])


// Abbreviations that should be ignored for being too vague
// Words are only added if (1) common and (2) could actually match a book
// E.g. "So. 1" is ok but not "So 1 cat"
export const special_english_abbrev_exclude:readonly string[] =
    Object.freeze(["is", "so", "at", "am", "me", "he", "hi", "at"])
