// Computed values that mix data sources

import {computed} from 'vue'

import {get_chapters} from '@gracious.tech/bible-references'

import {content} from '@/services/content'
import {state} from '@/services/state'


// Displayable text for currently selected book
export const current_book_name = computed(() => {
    return state.book_names[state.book]!
})


// Displayable abbreviation for currently selected book
export const current_book_abbrev = computed(() => {
    return state.book_abbrev[state.book]!
})


// List of chapters for current book
export const chapters = computed(() => {
    if (content.collection.has_book(state.trans[0], state.book)){
        return get_chapters(state.book)
    }
    return []
})


// Displayable text for currently selected chapter (with book name)
export const chapter_display = computed(() => {
    // Only show book name if only has one chapter
    if (chapters.value.length === 1){
        return current_book_name.value
    }
    return `${current_book_name.value} ${state.chapter}`
})


// Displayable text for currently selected chapter (with book abbreviation)
export const chapter_display_abbrev = computed(() => {
    // Only show book if only has one chapter
    if (chapters.value.length === 1){
        return current_book_abbrev.value
    }
    return `${current_book_abbrev.value} ${state.chapter}`
})


// The text direction for the current bibles
export const direction = computed(() => {
    return state.trans.map(trans => content.translations[trans]?.direction ?? 'ltr')
})
