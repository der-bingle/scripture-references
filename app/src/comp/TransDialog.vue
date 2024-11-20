
<template lang='pug'>

v-dialog(v-model='state.show_trans_dialog' :fullscreen='!state.wide' :max-width='dialog_max_width'
        max-height='1000px' height='100%')

    v-card(height='100%')

        v-tabs(v-model='selected_trans_index' color='primary')
            v-tab(v-for='(item, i) of chosen_translations' :key='item.id + i')
                | {{ item.name_abbrev }}
                v-btn(v-if='chosen_translations.length > 1' icon variant='text' color='#888f'
                        @click.stop='remove_trans(i)')
                    app-icon(name='close_small')
            v-btn.add(v-if='edited_trans.length < 3' icon variant='text' @click='add_trans')
                app-icon(name='add_circle')
            v-btn.close(icon variant='text' @click='confirm_changes')
                app-icon(name='check')

        div.subbar
            v-text-field.search(v-if='show_languages' v-model='languages_search' variant='outlined'
                type='search' placeholder="Search..." density='compact' hide-details single-line)
            v-btn(v-else color='primary' variant='text' @click='show_languages = true')
                app-icon(name='arrow_back' style='margin-right: 12px')
                | {{ displayed_language_name }}

        v-list(v-if='show_languages' ref='lang_list_comp')
            v-list-item(v-for='lang of languages_filtered' :key='lang.code' density='compact'
                    @click='change_lang(lang.code)')
                v-list-item-title {{ lang.bilingual }}
            v-btn(v-if='!languages_search && !languages_show_all' variant='text' color='primary'
                    @click='languages_show_all = true')
                app-icon(name='expand_circle_down')
                | &nbsp;
                | + {{ languages.length - languages_filtered.length }}
        v-list(v-else)
            v-list-item(v-for='trans of translations' :key='trans.id' color='primary'
                    :active='trans.id === selected_trans.id' density='compact'
                    @click='confirm_trans(trans.id)')
                v-list-item-title
                    | {{ trans.name_abbrev }} &mdash; {{ trans.name_local || trans.name_english }}

</template>


<script lang='ts' setup>

import {computed, onUnmounted, reactive, ref, watch} from 'vue'

import {state, langs, dialog_max_width} from '@/services/state'
import {content} from '@/services/content'


// Contants
const languages = content.collection.get_languages()
// NOTE Just show 10 initially as scanning too many wastes time since not initially in ABC order
const languages_by_pop = content.collection.get_languages({sort_by: 'population'}).slice(0, 10)


// State
// NOTE Don't apply changes until dialog closed to prevent laggy UI
const edited_trans = reactive([...state.trans] as [string, ...string[]])
const selected_trans_index = ref(0)
const show_languages = ref(false)
const displayed_language = ref(langs.value[0])
const languages_search = ref('')
const languages_show_all = ref(false)
const lang_list_comp = ref<{$el: HTMLElement}>()


// Computes
const chosen_translations = computed(() => edited_trans.map(id => content.translations[id]!))
const selected_trans = computed(() => chosen_translations.value[selected_trans_index.value]!)
const displayed_language_name = computed(() => {
    return content.languages[displayed_language.value]!.name_local
})
const translations = computed(() => {
    return content.collection.get_translations({language: displayed_language.value})
})
const languages_filtered = computed(() => {
    if (languages_search.value){
        return content.collection.get_languages({search: languages_search.value})
    }
    return languages_show_all.value ? languages : languages_by_pop
})


// Watches
watch(selected_trans_index, () => {
    displayed_language.value = chosen_translations.value[selected_trans_index.value]!.language
    show_languages.value = false
})
watch(languages_show_all, () => {
    // Scroll back to top of lang list when showing all, as new items will be added to top
    lang_list_comp.value?.$el.scroll({top: 0})
})


// Methods

const change_lang = (code:string) => {
    displayed_language.value = code
    if (translations.value.length === 1){
        confirm_trans(translations.value[0]!.id)
    }
    show_languages.value = false
}

const confirm_trans = (id:string) => {
    edited_trans[selected_trans_index.value] = id
    confirm_changes()
}

const add_trans = () => {
    edited_trans.push(edited_trans[edited_trans.length-1]!)
    selected_trans_index.value = edited_trans.length - 1
}

const remove_trans = (i:number) => {
    edited_trans.splice(i, 1)
    if (selected_trans_index.value >= edited_trans.length){
        selected_trans_index.value = edited_trans.length - 1
    }
}


const confirm_changes = () => {
    // Closing dialog always applies changes
    state.show_trans_dialog = false
}


onUnmounted(() => {
    // Always apply changes, however the dialog is closed
    // NOTE Slight delay so dialog animation closes instead of lagging
    setTimeout(() => {
        state.trans = [...edited_trans] as [string, ...string[]]
    }, 10)
})


</script>


<style lang='sass' scoped>

.subbar
    display: flex
    align-items: center
    justify-content: space-between
    padding: 12px 0

    .v-text-field
        margin: 0 12px

.close
    margin-left: auto

.v-tabs
    min-height: var(--v-tabs-height)  // Safari bug fix

.v-tab
    padding-right: 0

    .v-btn--icon
        margin-left: 48px

</style>
