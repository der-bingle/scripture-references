
<template lang='pug'>


h3
    span.ref(@click='return_to_verse') {{ verse_label }}
template(v-if='notes')
    h5 Notes
    div.notes(ref='notes_div' class='text-body-2 fetch-bible' v-html='notes')
template(v-if='crossrefs.length')
    h5(class='mb-2') Cross references
    template(v-for='crossref of crossrefs' :key='crossref.label')
        v-chip(class='mr-2 mb-2' size='small' @click='crossref.view') {{ crossref.label }}

</template>


<script lang='ts' setup>

import {computed, watch, ref, nextTick} from 'vue'

import {PassageReference} from '@gracious.tech/fetch-client'

import {change_book, state} from '@/services/state'
import {book_names} from '@/services/computes'


const verse_label = computed(() => {
    if (!state.study){
        return ''
    }
    const [book, chapter, verse] = state.study
    return new PassageReference(book, chapter, verse).toString(book_names.value)
})


// WARN Using watch instead of compute so that only updated when `study` changes
// Otherwise `state.crossref` will refer to the wrong book since study is disconnected from main
const crossrefs = ref<{label:string, view:()=>void}[]>([])
watch(() => state.study, () => {
    if (!state.study || !state.crossref){
        crossrefs.value = []
        return
    }
    crossrefs.value = state.crossref.get_refs(state.study[1], state.study[2]).map(crossref => {
        const ref = new PassageReference(crossref)
        return {
            label: ref.toString(book_names.value),
            view(){
                change_book(crossref)
            },
        }
    })
}, {immediate: true})


// WARN Using watch instead of compute so that only updated when `study` changes
const notes = ref<string|undefined>('')
const notes_div = ref<HTMLDivElement>()
watch(() => state.study, () => {
    if (!state.notes || !state.study){
        notes.value = undefined
        return
    }
    notes.value = state.notes[state.study[1]]?.[state.study[2]]
    // Make all passage references in notes clickable
    void nextTick(() => {
        for (const ref_span of notes_div.value?.querySelectorAll('span[data-ref]') ?? []){
            ref_span.addEventListener('click', event => {
                const parts = (event.target as HTMLDivElement).dataset['ref']?.split(',') ?? []
                const book = parts[0]
                if (book){
                    const [start_chapter, start_verse, end_chapter, end_verse] = parts.slice(1)
                        .map(part => part === undefined ? undefined : parseInt(part))
                    change_book({book, start_chapter, start_verse, end_chapter, end_verse})
                }
            })
        }
    })

}, {immediate: true})


const return_to_verse = () => {
    const [book, start_chapter, start_verse] = state.study!
    change_book({book, start_chapter, start_verse})
}


</script>


<style lang='sass' scoped>

h3
    display: flex
    justify-content: space-between

h5
    margin-top: 6px

.ref
    cursor: pointer

.notes :deep() span[data-ref]
    color: rgb(var(--v-theme-primary))
    cursor: pointer

</style>
