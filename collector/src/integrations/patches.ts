// Patches for translations that should really be fixed upstream


// Books that have a substantial amount of poetry (not just a stanza here and there)
// NOTE Taken from paper.bible
const lots_of_poetry = [
    'job',  // Job
    'psa',  // Psalms
    'pro',  // Proverbs
    'ecc',  // Ecclesiastes
    'sng',  // Song of Songs
    'isa',  // Isaiah
    'jer',  // Jeremiah
    'lam',  // Lamentations
    'ezk',  // Ezekiel
    // 'dan',  Daniel       (some stanzas but still part of the narrative)
    'hos',  // Hosea
    'jol',  // Joel
    'amo',  // Amos
    'oba',  // Obadiah
    // 'jon',  Jonah        (just one prayer)
    'mic',  // Micah
    'nam',  // Nahum
    'hab',  // Habakkuk
    'zep',  // Zephaniah
    'hag',  // Haggai
    'zec',  // Zechariah
    // 'mal',  Malachi      (dialogue, not stanzas)
]


export function pre_usx_to_json(translation:string, book:string, usx:string){

    // BSB uses blank lines between titles and paragraphs etc. resulting in too much space
    // But they are important to preserve for poetry, so target only non-poetry books
    if (translation === 'eng_bsb' && !lots_of_poetry.includes(book)){
        usx = usx.replaceAll('<para style="b"/>', '')
    }

    // cmn_bib has moved ISA 38:21-22 to after ISA 38:6 for text critical reasons
    // Preserve their text but merge the verses into 38:6 so numbering stays sequential
    if (translation === 'cmn_bib' && book === 'isa'){
        usx = usx
            .replace('<verse eid="ISA 38:6"/>', '')
            .replace('<verse number="21" style="v" sid="ISA 38:21"/>', '')
            .replace('<verse eid="ISA 38:21"/>', '')
            .replace('<verse number="22" style="v" sid="ISA 38:22"/>', '')
            .replace('<verse eid="ISA 38:22"/>', '<verse eid="ISA 38:6"/>')
    }

    return usx
}
