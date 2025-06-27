// Integrations with Global Bible Tools
// https://github.com/globalbibletools

import {join} from 'node:path'
import {writeFileSync} from 'node:fs'

import StreamZip from 'node-stream-zip'
import {last_verse} from '@gracious.tech/bible-references'

import {list_dirs, list_files, mkdir_exist, read_json, request, write_json} from '../parts/utils.js'
import {books_ordered} from '../parts/bible.js'
import {get_language_data} from '../parts/languages.js'

import type {GlossesData, GlossesDataWord} from '../parts/shared_types.js'


interface GbtWordOriginal {
    id:string
    text:string
    grammar:string
    lemma:string  // Actually a strong code
}

interface GbtWordGloss {
    id:string
    gloss:string|null
}

interface GbtDataOriginal {
    chapters:{
        verses:{
            words:GbtWordOriginal[]
        }[]
    }[]
}

interface GbtDataGloss {
    chapters:{
        verses:{
            words:GbtWordGloss[]
        }[]
    }[]
}


export const gbt_source_dir = join('sources', 'glosses', 'gbt')


// Download
export async function download_glosses(){

    // Download zip
    const zip_file_path = join(gbt_source_dir, 'git.zip')
    const url = 'https://github.com/globalbibletools/data/archive/refs/heads/main.zip'
    const zip_buffer = await request(url, 'arrayBuffer')
    mkdir_exist(gbt_source_dir)
    writeFileSync(zip_file_path, Buffer.from(zip_buffer))

    // Extract to dir
    await new StreamZip.async({file: zip_file_path}).extract('data-main', gbt_source_dir)
}


export async function sources_to_dist(){

    // Access to language data
    const language_data = get_language_data()

    // Get original language data
    const original_books:Record<string, GbtDataOriginal> = {}
    const originals_path = join(gbt_source_dir, 'hbo+grc')
    for (const filename of list_files(originals_path)){
        const book = filename.slice(3, 6).toLowerCase()
        if (!books_ordered.includes(book)){
            throw new Error("Unexpected book id: " + book)
        }
        original_books[book] = read_json(join(originals_path, filename))
    }
    if (Object.keys(original_books).length !== books_ordered.length){
        throw new Error("Missing book for original data?")
    }

    // Combine with glosses and put in dist dir
    for (const lang of list_dirs(gbt_source_dir)){
        const trans_id = lang + '_gbt'

        // Deal with exceptions
        if (['test', 'hbo+grc', 'idn'].includes(lang)){  // TODO idn meant to be ind?
            continue  // Skip special dirs
        }
        if (language_data.normalise(lang) !== lang){
            throw new Error("Unexpected language id: " + lang)
        }

        // Process each book
        const lang_path = join(gbt_source_dir, lang)
        for (const filename of list_files(lang_path)){

            // Get USX book id
            const book = filename.slice(3, 6).toLowerCase()
            if (!books_ordered.includes(book)){
                throw new Error("Unexpected book id: " + book)
            }

            // Read data
            const book_words = original_books[book]!
            const book_glosses = read_json<GbtDataGloss>(join(lang_path, filename))

            // 3JN 1:15 is common in only half of bibles, so insert empty verse
            if (book === '3jn'){
                book_words.chapters[0]!.verses[15-1] ??= {words: []}
                book_glosses.chapters[0]!.verses[15-1] ??= {words: []}
            }
            // REV 12:18 is common in only half of bibles, so insert empty verse
            if (book === 'rev'){
                book_words.chapters[12-1]!.verses[18-1] ??= {words: []}
                book_glosses.chapters[12-1]!.verses[18-1] ??= {words: []}
            }

            // Verify same number of chapters and verses as expected (for both original and gloss)
            for (const gbt_data of [book_words, book_glosses]){
                const last_verses_for_book = last_verse[book]!
                if (last_verses_for_book.length !== gbt_data.chapters.length){
                    throw new Error(`Different number of chapters for ${lang} ${book}`)
                }
                for (let i = 0; i < last_verses_for_book.length; i++){
                    const num_verses = gbt_data.chapters[i]!.verses.length
                    const num_verses_expected = last_verses_for_book[i]!
                    if (num_verses !== num_verses_expected){
                        throw new Error(`Chapter has ${num_verses} verses but expected`
                            + ` ${num_verses_expected} (${lang} ${book} ch${i+1})`)
                    }
                }
            }

            // Count how many words have a gloss
            let word_total = 0
            let gloss_total = 0

            // Compile data
            const processed_data:GlossesData = {
                trans_id,
                book,
                contents: [[]],  // Start with chapter 0
            }
            for (let chapter_i = 0; chapter_i < last_verse[book]!.length; chapter_i++){
                const current_chapter:GlossesDataWord[][] = [[]]  // Start with verse 0
                processed_data.contents.push(current_chapter)
                for (let verse_i = 0; verse_i < last_verse[book]![chapter_i]!; verse_i++){
                    const current_verse:GlossesDataWord[] = []
                    current_chapter.push(current_verse)

                    // Get data for verse
                    const verse_words = book_words.chapters[chapter_i]!.verses[verse_i]!.words
                    const verse_glosses = book_glosses.chapters[chapter_i]!.verses[verse_i]!.words

                    // Confirm same number of words (GBT's data integrity check)
                    if (verse_words.length !== verse_glosses.length){
                        throw new Error("GBT data has different number of words in verse")
                    }

                    // Add verse
                    for (let word_i = 0; word_i < verse_words.length; word_i++){

                        // May be missing gloss but should never miss word or lemma
                        const word = verse_words[word_i]!.text.trim()
                        const gloss = (verse_glosses[word_i]!.gloss ?? '').trim()
                        const strong = verse_words[word_i]!.lemma.trim()
                        if (!word || !strong){
                            throw new Error(`Missing word data`)
                        }

                        // Add word
                        current_verse.push({word, gloss, strong})
                        word_total += 1
                        if (gloss){
                            gloss_total += 1
                        }
                    }
                }
            }

            // Get percent of how many words have been glossed for the book
            const percent_glossed = Math.floor(gloss_total / word_total * 100)

            // Save book's data if almost complete
            // NOTE When can't translate, will be '-' so still counts as glossed
            if (percent_glossed > 95){
                const lang_dist_dir = join('dist', 'glosses', trans_id)
                mkdir_exist(lang_dist_dir)
                write_json(join(lang_dist_dir, `${book}.json`), processed_data)
            }
        }
    }
}
