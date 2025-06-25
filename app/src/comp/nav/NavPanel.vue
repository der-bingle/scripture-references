
<template lang='pug'>

div.panel
    SearchToolbar
    div.scrollable
        SearchResults(v-if='state.search')
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

.scrollable
    overflow-y: auto
    height: 100%

</style>
