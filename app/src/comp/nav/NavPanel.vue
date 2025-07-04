
<template lang='pug'>

div.panel
    SearchToolbar
    div.scrollable
        SearchResults(v-if='state.search_results')
        BookMenu(v-else)

</template>


<script lang='ts' setup>

import BookMenu from './BookMenu.vue'
import SearchToolbar from './SearchToolbar.vue'
import SearchResults from './SearchResults.vue'
import {state} from '@/services/state'


</script>


<style lang='sass' scoped>

.panel
    background-color: rgb(var(--v-theme-surface))
    display: flex
    flex-direction: column
    height: 100%

.scrollable
    overflow-y: auto
    height: 100%

</style>
