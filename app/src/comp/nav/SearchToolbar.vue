
<template lang='pug'>

v-toolbar(:density='density')

    //- autocomplete=off tells browser not to show its own suggestions which would overlap own
    v-combobox.input(ref='combobox' v-model='state.search' hide-details autocomplete='off'
            density='compact' variant='outlined' autofocus :items='state.search_history')
        template(#prepend-inner)
            app-icon.placeholder(v-if='!state.search' name='search')
        template(#append-inner)
            v-btn(v-if='state.search' @click='clear_search' icon size='small')
                app-icon(name='close' small)

    v-btn-toggle(v-model='search_filter' color='primary' density='compact'
            :class='{"mr-2": state.wide}')
        v-btn(size='x-small' value='ot') Old
        v-btn(size='x-small' value='nt') New
        v-btn(size='x-small' value='book') {{ current_book_abbrev }}
    v-btn(v-if='!state.wide' icon variant='text' @click='state.show_nav = false')
        app-icon(name='close')

</template>


<script lang='ts' setup>

import {computed, useTemplateRef} from 'vue'

import {density, state} from '@/services/state'
import {current_book_abbrev} from '@/services/computes'

import type {VCombobox} from 'vuetify/lib/components'


const comboxbox = useTemplateRef<VCombobox>('combobox')


// Proxy so save null rather than undefined
const search_filter = computed({
    get(){
        return state.search_filter
    },
    set(value:'ot'|'nt'|'book'|undefined){
        state.search_filter = value ?? null
    },
})


const clear_search = () => {
    state.search = ""
    // Ensure don't start showing search suggestions if box still has focus
    comboxbox.value?.blur()
}

</script>


<style lang='sass' scoped>

.input
    margin: 0 8px

    :deep(.v-field)
        padding-right: 0 !important

    :deep(.v-field__prepend-inner)  // Container of search icon placeholder
        pointer-events: none

    :deep(.v-combobox__menu-icon)
        display: none  // Hide Vuetify's dropdown button that comes with combobox

.placeholder
    opacity: 0.5

.v-toolbar__content > .v-btn:last-child
    margin-inline-end: 0  // Override Vuetify


</style>
