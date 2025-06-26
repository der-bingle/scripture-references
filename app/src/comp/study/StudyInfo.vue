
<template lang='pug'>


h3
    span.ref(@click='return_to_verse') {{ verse_label }}
template(v-if='crossrefs.length')
    h5(class='mb-2') Cross references
    div.crossrefs
        StudyCrossref(v-for='crossref of crossrefs' :key='crossref.to_serialized()'
            :reference='crossref')
template(v-if='original')
    h5 Original language
    div.orig(v-html='original'
        class='fetch-bible no-verses no-chapters no-headings no-notes no-red-letter')
div(v-if='variants_url' class='mb-4')
    v-btn(:href='variants_url' target='variants' color='' size='small' variant='tonal' rounded)
        | Variants &amp; Manuscripts
        app-icon(name='arrow_outward' small class='ml-1')
template(v-if='notes && state.study_notes && has_english_translation')
    h5 Tyndale Open Study Notes
    div.notes(ref='notes_div' class='text-body-2 fetch-bible' v-html='notes')

</template>


<script lang='ts' setup>

import {computed, watch, ref, nextTick} from 'vue'
import {books_ordered, PassageReference} from '@gracious.tech/fetch-client'

import StudyCrossref from './StudyCrossref.vue'
import {change_to_ref, state, add_to_read_history} from '@/services/state'


const verse_label = computed(() => {
    if (!state.study){
        return ''
    }
    return state.study.toString(state.book_names)
})


const has_english_translation = computed(() => {
    // Only show English study notes if user is reading at least one English translation
    return state.trans.some(t => t.startsWith('eng_'))
})


// WARN Using watch instead of compute so that only updated when `study` changes
// Otherwise `state.crossref` will refer to the wrong book since study is disconnected from main
const crossrefs = ref<PassageReference[]>([])
watch(() => state.study, () => {
    if (!state.study || !state.crossref){
        crossrefs.value = []
        return
    }
    // NOTE Don't show more than 8 to not overwhelm users
    crossrefs.value = state.crossref.get_refs(state.study).slice(0, 8)
}, {immediate: true})


// WARN Using watch instead of compute so that only updated when `study` changes
const notes = ref<string|undefined>('')
const notes_div = ref<HTMLDivElement>()
watch(() => state.study, () => {
    if (!state.notes || !state.study){
        notes.value = undefined
        return
    }
    notes.value = state.notes[state.study.start_chapter]?.[state.study.start_verse]
    // Make all passage references in notes clickable
    void nextTick(() => {
        for (const ref_span of notes_div.value?.querySelectorAll('span[data-ref]') ?? []){
            ref_span.addEventListener('click', event => {
                const parts = (event.target as HTMLDivElement).dataset['ref']?.split(',') ?? []
                const book = parts[0]
                if (book){
                    const [start_chapter, start_verse, end_chapter, end_verse] = parts.slice(1)
                        .map(part => part === undefined ? undefined : parseInt(part))
                    const note_ref = new PassageReference(
                        {book, start_chapter, start_verse, end_chapter, end_verse})
                    add_to_read_history(state.study!)  // First save study verse leaving from
                    add_to_read_history(note_ref)
                    change_to_ref(note_ref)
                }
            })
        }
    })

}, {immediate: true})


// WARN Using watch instead of compute so that only updated when `study` changes
const original = ref('')
watch(() => state.study, () => {
    if (!state.study || !state.original){
        original.value = ''
        return
    }
    original.value = state.original.get_passage_from_ref(state.study, {attribute: false})
}, {immediate: true})


// Link to variants
const variants_url = ref('')
watch(() => state.study, () => {
    if (!state.study){
        variants_url.value = ''
        return
    }

    // Determine CNTR code for verse
    const book_index = books_ordered.findIndex(b => b === state.study!.book)
    if (book_index < books_ordered.findIndex(b => b === 'mat')){
        variants_url.value = ''
        return  // No link for OT
    }
    const padded_book = String(book_index + 1).padStart(2, '0')  // CNTR indexes from 1
    const padded_ch = String(state.study.start_chapter).padStart(3, '0')
    const padded_v = String(state.study.start_verse).padStart(3, '0')
    const cntr_code = padded_book + padded_ch + padded_v

    // Set URL
    variants_url.value = `https://greekcntr.org/collation/index.htm?v=${cntr_code}`

}, {immediate: true})


const return_to_verse = () => {
    change_to_ref(state.study!)
    add_to_read_history(state.study!)
}


</script>


<style lang='sass' scoped>

h3
    display: flex
    justify-content: space-between

h5
    margin-top: 12px
    margin-bottom: 0

.ref
    cursor: pointer

.crossrefs
    display: flex
    flex-wrap: wrap
    gap: 8px

.notes :deep() span[data-ref]
    color: rgb(var(--v-theme-primary))
    cursor: pointer

.orig
    margin-bottom: 8px
    font-size: 16px !important

</style>
