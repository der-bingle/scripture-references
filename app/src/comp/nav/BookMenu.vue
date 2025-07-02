
<template lang='pug'>

div.recent
    BookMenuRecent(v-for='reference of state.read_history' :key='reference' :reference='reference')

v-list(density='compact' color='primary')

    //- Loop through OT books since has more than NT so indexes will still work
    template(v-for='(item, i) of ot_books' :key='item.id')

        div.row
            v-list-item(:active='book === item.id' :disabled='!item.available'
                    @click='select_book(item.id)')
                v-list-item-title {{ item.name }}
            v-list-item(v-if='i < nt_books.length' :active='book === nt_books[i]?.id'
                    :disabled='!nt_books[i]?.available' @click='select_book(nt_books[i]?.id)')
                v-list-item-title {{ nt_books[i]?.name }}

        div.chapters(v-if='(book === item.id || book === nt_books[i]?.id) && chapters.length > 1'
                :class='{nt: book === nt_books[i]?.id}')
            v-btn(v-for='ch of chapters' :key='ch' :active='chapter === ch' icon variant='text'
                    :color='chapter === ch ? "primary" : ""' @click='select_ch(ch)')
                | {{ ch }}

</template>


<script lang='ts' setup>

import {computed} from 'vue'
import {PassageReference} from '@gracious.tech/fetch-client'

import BookMenuRecent from './BookMenuRecent.vue'
import {state, change_passage, add_to_read_history, change_to_ref} from '@/services/state'
import {content} from '@/services/content'
import {chapters} from '@/services/computes'


// State shortcuts
const book = computed(() => state.book)
const chapter = computed(() => state.chapter)


// Get lists of OT and NT books
// NOTE Get book name from state object or it may be outdated if extras not fetched yet
const ot_books = computed(() => {
    return content.collection.bibles.get_books(state.trans[0], {testament: 'ot', whole: true})
        .map(b => ({id: b.id, available: b.available, name: state.book_names[b.id]}))
})
const nt_books = computed(() => {
    return content.collection.bibles.get_books(state.trans[0], {testament: 'nt', whole: true})
        .map(b => ({id: b.id, available: b.available, name: state.book_names[b.id]}))
})


// Change book
const select_book = (id?:string) => {
    // NOTE Only optional above to get around typings in template
    change_to_ref(new PassageReference({book: id!}))
    if (chapters.value.length === 1){
        state.show_nav = false
        add_to_read_history(state.passage!)
    }
}


// Change chapter
const select_ch = (num:number) => {
    change_passage(num)
    state.show_nav = false
    add_to_read_history(state.passage!)
}


</script>


<style lang='sass' scoped>

.recent
    display: flex
    flex-wrap: wrap
    gap: 8px
    padding: 12px

.row
    display: flex

    // Make OT/NT columns equal width
    > *
        flex-grow: 1
        flex-basis: 0

.chapters
    &.nt
        text-align: right

.v-list-item--disabled
    opacity: 0.2  // Make clearer when a book is not available

</style>
