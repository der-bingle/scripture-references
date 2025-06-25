
<template lang='pug'>

v-card(class='mb-4' density='compact' @click='go_to_ref')
    v-card-item
        v-card-title(class='text-subtitle-2 font-weight-bold') {{ ref_title }}
    v-card-text
        div.scripture(v-html='result.contents')

</template>


<script lang='ts' setup>

import {computed} from 'vue'

import {add_to_read_history, change_book, state} from '@/services/state'
import {content} from '@/services/content'

import type {SearchResult} from '@gracious.tech/fetch-search'


const props = defineProps<{result:SearchResult}>()


const ref_title = computed(() => {
    return content.collection.reference_to_string(props.result.ref, state.trans[0])
})


const go_to_ref = () => {
    change_book(props.result.ref)
    state.show_nav = false
    // Since have made use of these search results, save the query to history
    const query = state.search.trim()
    state.search_history = [query, ...state.search_history.filter(q => q !== query)].slice(0, 10)
    add_to_read_history(props.result.ref)
}


</script>


<style lang='sass' scoped>

.scripture
    line-height: 1.2
    max-height: 200px  // Limit height of results
    font-size: 14px
    @media (min-width: 800px)
        font-size: 15px

    // Fade out when exceed height by adding gradient to bottom edge
    &::after
        content: ""
        position: absolute
        bottom: 0
        left: 0
        right: 0
        height: 1.5rem
        background: linear-gradient(to bottom, transparent, rgb(var(--v-theme-surface)))

    :deep(mark)
        color: inherit
        background-color: rgb(var(--v-theme-primary), 0.5)


</style>
