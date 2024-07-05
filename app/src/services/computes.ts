// Computed values that mix data sources

import {computed} from 'vue'

import {get_chapters} from '@gracious.tech/bible-references'

import {content} from '@/services/content'
import {state} from '@/services/state'


// Displayable text for books of currently selected translation
export const book_names = computed(() => {
    return Object.fromEntries(content.collection.get_books(state.trans[0], {whole: true})
        .map(book => ([book.id, book.name])))
})


// Displayable text for currently selected book
export const current_book_name = computed(() => {
    return book_names.value[state.book]!
})


// List of chapters for current book
export const chapters = computed(() => {
    if (content.collection.has_book(state.trans[0], state.book)){
        return get_chapters(state.book)
    }
    return []
})


// Displayable text for currently selected chapter (includes book name)
export const chapter_display = computed(() => {
    // Only show book name if only has one chapter
    if (chapters.value.length === 1){
        return current_book_name.value
    }
    return `${current_book_name.value} ${state.chapter}`
})


// The text direction for the current bibles
export const direction = computed(() => {
    return state.trans.map(trans => content.translations[trans]?.direction ?? 'ltr')
})
