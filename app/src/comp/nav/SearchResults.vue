
<template lang='pug'>

div.results(class='pa-4')

    //- Show buttons to clear search/filter if no results
    div(v-if='!filtered_results.length' class='text-center mt-4')
        template(v-if='!state.search_results')
            //- Will rapidly show/hide so make light weight to not cause any further delay
            div . . .
        template(v-else-if='state.search_results.length')
            div No results (some hidden)
            div(class='mt-4')
                v-btn(@click='state.search_filter = null' color='' variant='tonal') Remove Filter
        template(v-else)
            div No results
            div(class='mt-4')
                v-btn(@click='state.search = ""' color='' variant='tonal') Show Books

    SearchResultsItem(v-for='result of filtered_results' :key='result.ref.to_serialized()'
        :result='result')

</template>


<script lang='ts' setup>

import {computed} from 'vue'

import SearchResultsItem from './SearchResultsItem.vue'
import {state} from '@/services/state'


const filtered_results = computed(() => {
    return (state.search_results ?? []).filter(result => {
        if (state.search_filter === 'ot'){
            return result.ref.ot
        } else if (state.search_filter === 'nt'){
            return result.ref.nt
        } else if (state.search_filter === 'book'){
            return result.ref.book === state.book
        }
        return true
    })
})

</script>


<style lang='sass' scoped>

.results
    overflow-y: auto
    background-color: rgb(var(--v-theme-background))

</style>
