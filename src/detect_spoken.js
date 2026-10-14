import { book_names_english } from './data.js'
import { last_verse } from './last_verse.js'
import { PassageReference } from './passage.js'

const numberedBookWords = Object.freeze({
    1: ['first', 'one', '1st', '1'],
    2: ['second', 'two', '2nd', '2'],
    3: ['third', 'three', '3rd', '3'],
})

const singleChapterBooks = new Set(['oba', 'phm', '2jn', '3jn', 'jud'])
const ones = Object.freeze({ one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 })
const teens = Object.freeze({ ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 })
const tens = Object.freeze({ twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 })
const dash = new Set(['-', '‐', '‑', '–', '—', '−'])
const rangeWords = new Set(['through', 'to'])
const chapterCues = new Set(['chapter', 'chapters'])
const verseCues = new Set(['verse', 'verses'])
const countNouns = new Set(['items', 'things', 'people', 'years', 'weeks', 'days', 'hours', 'dollars', 'times', 'applicants'])

const normalize = (value) => value.toLowerCase()
const wordsOf = (value) => value.toLowerCase().split(/\s+/u)

const namedBookForms = Object.entries(book_names_english).flatMap(([book, name]) => {
    const numbered = name.match(/^([123]) (.+)$/u)
    return numbered
        ? numberedBookWords[numbered[1]].map((prefix) => ({ book, words: [prefix, ...wordsOf(numbered[2])] }))
        : [{ book, words: wordsOf(name) }]
})

const bookForms = [
    ...namedBookForms,
    { book: 'psa', words: ['psalm'] },
    { book: 'sng', words: ['song', 'of', 'solomon'] },
].toSorted((left, right) => right.words.length - left.words.length)

const tokenize = (text) => Array.from(
    text.matchAll(/\d+(?:st|nd|rd|th)?|[\p{L}]+(?:['’][\p{L}]+)?|[:.,;‐‑–—−-]/giu),
    (match) => ({ raw: match[0], norm: normalize(match[0]), start: match.index, end: match.index + match[0].length })
)

const at = (tokens, index) => tokens[index]?.norm
const isBookFormAt = (tokens, index, form) =>
    form.words.every((word, offset) => at(tokens, index + offset) === word)

const bookAt = (tokens, index) => {
    const cueLength = at(tokens, index) === 'the' && at(tokens, index + 1) === 'book' && at(tokens, index + 2) === 'of'
        ? 3
        : at(tokens, index) === 'book' && at(tokens, index + 1) === 'of' ? 2 : 0
    const bookIndex = index + cueLength
    const form = bookForms.find((value) => isBookFormAt(tokens, bookIndex, value))
    return form ? {
        book: form.book,
        startToken: index,
        endToken: bookIndex + form.words.length,
        bookForm: tokens.slice(bookIndex, bookIndex + form.words.length).map(({ raw }) => raw).join(' '),
        bookCue: cueLength > 0,
    } : null
}

const numberAt = (tokens, index) => {
    const word = at(tokens, index)
    if (!word) return null
    if (/^\d+$/u.test(word)) return { value: Number(word), endToken: index + 1, form: 'digits' }
    if (Object.hasOwn(teens, word)) return { value: teens[word], endToken: index + 1, form: 'spoken' }
    if (Object.hasOwn(tens, word)) {
        const unitIndex = dash.has(at(tokens, index + 1)) ? index + 2 : index + 1
        const unit = ones[at(tokens, unitIndex)]
        return { value: tens[word] + (unit ?? 0), endToken: unit ? unitIndex + 1 : index + 1, form: 'spoken' }
    }
    if (Object.hasOwn(ones, word) && at(tokens, index + 1) === 'hundred') {
        const restIndex = index + (at(tokens, index + 2) === 'and' ? 3 : 2)
        const rest = numberAt(tokens, restIndex)
        return rest && rest.form === 'spoken' && rest.value < 100
            ? { value: ones[word] * 100 + rest.value, endToken: rest.endToken, form: 'spoken' }
            : { value: ones[word] * 100, endToken: index + 2, form: 'spoken' }
    }
    return Object.hasOwn(ones, word) ? { value: ones[word], endToken: index + 1, form: 'spoken' } : null
}

const afterOptionalComma = (tokens, index) => at(tokens, index) === ',' ? index + 1 : index
const isRangeAt = (tokens, index) => rangeWords.has(at(tokens, index)) || dash.has(at(tokens, index))
const isListAt = (tokens, index) => at(tokens, index) === 'and' || at(tokens, index) === ','

const validateArgs = (args) => {
    const chapters = last_verse[args.book]
    const chapterFields = [args.start_chapter, args.end_chapter].filter((value) => value !== undefined)
    if (chapterFields.some((value) => !Number.isInteger(value) || value < 1 || value > chapters.length)) {
        return { ref: null, reason: 'chapter_out_of_bounds' }
    }
    const startChapter = args.start_chapter ?? 1
    const endChapter = args.end_chapter ?? startChapter
    if (args.start_verse !== undefined && (!Number.isInteger(args.start_verse) || args.start_verse < 1 || args.start_verse > chapters[startChapter - 1])) {
        return { ref: null, reason: 'verse_out_of_bounds' }
    }
    if (args.end_verse !== undefined && (!Number.isInteger(args.end_verse) || args.end_verse < 1 || args.end_verse > chapters[endChapter - 1])) {
        return { ref: null, reason: 'verse_out_of_bounds' }
    }
    if (endChapter < startChapter || (endChapter === startChapter && args.end_verse !== undefined && args.end_verse < (args.start_verse ?? 1))) {
        return { ref: null, reason: 'descending_range' }
    }
    const ref = new PassageReference(args)
    return ref.args_valid ? { ref, reason: null } : { ref: null, reason: 'invalid_reference' }
}

const contiguousList = (refs) => refs.length > 1
    && refs.every((ref, index) => index === 0 || (
        ref.book === refs[0].book
        && ref.start_chapter === refs[0].start_chapter
        && ref.start_verse === refs[index - 1].start_verse + 1
    ))

const candidateFrom = (text, tokens, bookMatch, parsed) => {
    const validations = parsed.items.map(validateArgs)
    const invalid = validations.find(({ reason }) => reason)
    const references = invalid || parsed.interpretation === 'ambiguous'
        ? [] : validations.map(({ ref }) => ref)
    const ref = invalid || parsed.interpretation === 'ambiguous' ? null
        : references.length === 1 ? references[0]
            : contiguousList(references) ? validateArgs({
                book: bookMatch.book,
                start_chapter: references[0].start_chapter,
                start_verse: references[0].start_verse,
                end_verse: references.at(-1).start_verse,
            }).ref : null
    const start = tokens[bookMatch.startToken].start
    const end = tokens[parsed.endToken - 1].end
    return {
        text: text.slice(start, end),
        index: start,
        end,
        ref,
        references,
        interpretation: invalid ? 'invalid' : parsed.interpretation,
        reasons: invalid ? [invalid.reason] : parsed.reasons,
        evidence: {
            bookForm: bookMatch.bookForm,
            numberForms: parsed.numberForms,
            cues: bookMatch.bookCue && !parsed.cues.includes('book of')
                ? ['book of', ...parsed.cues] : parsed.cues,
        },
    }
}

const parsed = (items, endToken, numberForms, cues, interpretation = 'explicit', reasons = []) => ({
    items, endToken, numberForms, cues, interpretation, reasons,
})

const verseItem = (book, chapter, verse) => ({ book, start_chapter: chapter, start_verse: verse })
const chapterItem = (book, chapter) => ({ book, start_chapter: chapter })

const listTail = (tokens, index, items, numberForms, count = 0) => {
    if (count >= 20 || !isListAt(tokens, index)) return { items, endToken: index, numberForms }
    const numberIndex = at(tokens, index) === ',' && at(tokens, index + 1) === 'and' ? index + 2 : index + 1
    const next = numberAt(tokens, numberIndex)
    return next
        ? listTail(tokens, next.endToken, [...items, next.value], [...numberForms, next.form], count + 1)
        : { items, endToken: index, numberForms }
}

const rangeEndpoint = (tokens, index, chapter, kind) => {
    const cue = at(tokens, index)
    if (kind === 'verse' && verseCues.has(cue)) {
        const verse = numberAt(tokens, index + 1)
        return verse ? {
            chapter, verse: verse.value, endToken: verse.endToken,
            numberForms: [verse.form], cues: [cue],
        } : null
    }
    if (chapterCues.has(cue)) {
        const endChapter = numberAt(tokens, index + 1)
        if (!endChapter) return null
        const verseCueIndex = afterOptionalComma(tokens, endChapter.endToken)
        const verseIndex = verseCues.has(at(tokens, verseCueIndex)) ? verseCueIndex + 1
            : at(tokens, verseCueIndex) === ':' ? verseCueIndex + 1 : null
        const endVerse = verseIndex === null ? null : numberAt(tokens, verseIndex)
        if (kind === 'verse' && !endVerse) return null
        return {
            chapter: endChapter.value,
            verse: endVerse?.value,
            endToken: endVerse?.endToken ?? endChapter.endToken,
            numberForms: endVerse ? [endChapter.form, endVerse.form] : [endChapter.form],
            cues: endVerse ? [cue, at(tokens, verseCueIndex)] : [cue],
        }
    }
    const first = numberAt(tokens, index)
    if (!first) return null
    if (at(tokens, first.endToken) === ':') {
        const second = numberAt(tokens, first.endToken + 1)
        return second ? {
            chapter: first.value, verse: second.value, endToken: second.endToken,
            numberForms: [first.form, second.form], cues: [':'],
        } : null
    }
    return {
        chapter: kind === 'chapter' ? first.value : chapter,
        verse: kind === 'verse' ? first.value : undefined,
        endToken: first.endToken,
        numberForms: [first.form], cues: [],
    }
}

const finishChapter = (tokens, index, book, chapter, forms, cues) => {
    if (!isRangeAt(tokens, index)) return parsed([chapterItem(book, chapter)], index, forms, cues)
    const endpoint = rangeEndpoint(tokens, index + 1, chapter, 'chapter')
    return endpoint ? parsed([{
        book, start_chapter: chapter,
        ...(endpoint.verse === undefined ? {} : { start_verse: 1 }),
        end_chapter: endpoint.chapter,
        ...(endpoint.verse === undefined ? {} : { end_verse: endpoint.verse }),
    }], endpoint.endToken, [...forms, ...endpoint.numberForms], [...cues, at(tokens, index), ...endpoint.cues])
        : parsed([chapterItem(book, chapter)], index, forms, cues)
}

const finishVerse = (tokens, index, book, chapter, verse, forms, cues, interpretation = 'explicit', reasons = []) => {
    if (isRangeAt(tokens, index)) {
        const endpoint = rangeEndpoint(tokens, index + 1, chapter, 'verse')
        if (endpoint) return parsed([{
            book, start_chapter: chapter, start_verse: verse,
            ...(endpoint.chapter === chapter ? {} : { end_chapter: endpoint.chapter }),
            end_verse: endpoint.verse,
        }], endpoint.endToken, [...forms, ...endpoint.numberForms], [...cues, at(tokens, index), ...endpoint.cues], interpretation, reasons)
    }
    if (cues.some((cue) => verseCues.has(cue))) {
        const list = listTail(tokens, index, [verse], forms)
        if (list.items.length > 1) return parsed(
            list.items.map((value) => verseItem(book, chapter, value)),
            list.endToken, list.numberForms, [...cues, 'list'], interpretation, reasons
        )
    }
    return parsed([verseItem(book, chapter, verse)], index, forms, cues, interpretation, reasons)
}

const afterChapter = (tokens, index, book, chapterNumber, cues) => {
    const verseCueIndex = afterOptionalComma(tokens, index)
    const verseCue = at(tokens, verseCueIndex)
    const marker = verseCues.has(verseCue) || verseCue === ':'
    if (marker) {
        const verse = numberAt(tokens, verseCueIndex + 1)
        return verse ? finishVerse(
            tokens, verse.endToken, book, chapterNumber.value, verse.value,
            [chapterNumber.form, verse.form], [...cues, verseCue]
        ) : parsed([], verseCueIndex + 1, [chapterNumber.form], [...cues, verseCue], 'ambiguous', ['missing_verse_number'])
    }
    const uncuedVerse = numberAt(tokens, index)
    if (uncuedVerse) {
        const uncertainRepeatedTens = chapterNumber.form === 'spoken' && uncuedVerse.form === 'spoken'
            && chapterNumber.value >= 20 && chapterNumber.value % 10 === 0
            && uncuedVerse.value >= 20 && uncuedVerse.value % 10 === 0
        return finishVerse(
            tokens, uncuedVerse.endToken, book, chapterNumber.value, uncuedVerse.value,
            [chapterNumber.form, uncuedVerse.form], cues,
            uncertainRepeatedTens ? 'ambiguous' : 'inferred',
            [uncertainRepeatedTens ? 'uncued_repeated_tens' : 'uncued_chapter_verse']
        )
    }
    return finishChapter(tokens, index, book, chapterNumber.value, [chapterNumber.form], cues)
}

const parseAtBook = (tokens, bookMatch) => {
    const book = bookMatch.book
    const firstIndex = afterOptionalComma(tokens, bookMatch.endToken)
    const first = at(tokens, firstIndex)
    if (first === 'oh' || first === 'o') {
        const possibleNumber = numberAt(tokens, firstIndex + 1)
        return parsed([], possibleNumber?.endToken ?? firstIndex + 1, [], [], 'ambiguous', ['uncertain_spoken_number'])
    }
    if (chapterCues.has(first)) {
        const chapter = numberAt(tokens, firstIndex + 1)
        return chapter ? afterChapter(tokens, chapter.endToken, book, chapter, [first])
            : parsed([], firstIndex + 1, [], [first], 'ambiguous', ['missing_chapter_number'])
    }
    if (verseCues.has(first)) {
        const verse = numberAt(tokens, firstIndex + 1)
        if (!verse) return parsed([], firstIndex + 1, [], [first], 'ambiguous', ['missing_verse_number'])
        return singleChapterBooks.has(book)
            ? finishVerse(tokens, verse.endToken, book, 1, verse.value, [verse.form], [first])
            : parsed([], verse.endToken, [verse.form], [first], 'ambiguous', ['missing_chapter'])
    }
    const firstNumber = numberAt(tokens, firstIndex)
    if (!firstNumber) return bookMatch.bookCue
        ? parsed([{ book }], bookMatch.endToken, [], ['book of']) : null
    if (singleChapterBooks.has(book) && at(tokens, firstNumber.endToken) === ':') {
        return afterChapter(tokens, firstNumber.endToken, book, firstNumber, [])
    }
    const result = singleChapterBooks.has(book)
        ? finishVerse(tokens, firstNumber.endToken, book, 1, firstNumber.value, [firstNumber.form], [])
        : afterChapter(tokens, firstNumber.endToken, book, firstNumber, [])
    return result.cues.length === 0 && countNouns.has(at(tokens, result.endToken)) ? null : result
}

/**
 * Detect English spoken-style Scripture references without changing the input.
 * Offsets are UTF-16 string indices; `end` is exclusive.
 * @param {string} text
 * @returns {Array<{text: string, index: number, end: number, ref: PassageReference|null,
 *   references: PassageReference[], interpretation: string, reasons: string[], evidence: object}>}
 */
export const detectSpokenReferences = (text) => {
    const tokens = tokenize(text)
    return tokens.reduce((state, token, index) => {
        if (index < state.nextToken) return state
        const bookMatch = bookAt(tokens, index)
        if (!bookMatch) return state
        const result = parseAtBook(tokens, bookMatch)
        return {
            nextToken: result?.endToken ?? bookMatch.endToken,
            matches: result
                ? [...state.matches, candidateFrom(text, tokens, bookMatch, result)]
                : state.matches,
        }
    }, { nextToken: 0, matches: [] }).matches
}
