
<template lang='pug'>

v-app(:style='{"max-width": max_width}' @mousemove='resize_study_move' @mouseup='resize_study_end'
        @mouseleave='resize_study_end'
        @touchmove.passive='resize_study_move_touch' @touchend.passive='resize_study_end')

    //- Show book menu in drawer for narrow screens
    //- NOTE touchless disables swiping right from screen edge to open (conflicts with prev ch)
    v-navigation-drawer(v-if='!state.wide' v-model='state.show_nav' temporary touchless
            width='450')
        NavPanel

    v-main
        NavPanel.sidebar(v-if='state.wide')
        div.main
            AppToolbar.toolbar
            BibleContent.content
            div.resize(v-if='state.study' @mousedown='resize_study_start'
                    @touchstart.passive='resize_study_start')
                div.handle
                v-btn.close(icon variant='flat' color='' @click='state.study = null')
                    app-icon(name='close')
            div.study(v-if='state.study' ref='study_div' class='pa-4 pt-0')
                StudyInfo

TransDialog(v-if='state.show_trans_dialog')
SettingsDialog(v-if='state.show_style_dialog')
AboutDialog(v-if='state.show_about_dialog')

</template>


<script lang='ts' setup>

import {watch, onMounted, computed, ref} from 'vue'
import {useTheme} from 'vuetify'

import NavPanel from './nav/NavPanel.vue'
import StudyInfo from './study/StudyInfo.vue'
import BibleContent from './BibleContent.vue'
import AppToolbar from './AppToolbar.vue'
import TransDialog from './TransDialog.vue'
import SettingsDialog from './SettingsDialog.vue'
import AboutDialog from './AboutDialog.vue'
import {state, safe_hsl} from '@/services/state'
import {chapter_display} from '@/services/computes'


// Increase max width of app depending on number of translations being shown
const max_width = computed(() => {
    const pixels = 1000 + 500 * state.trans.length
    return `${pixels}px`
})


// Resize study pane
let resize_study_active = false
const study_div = ref<HTMLDivElement>()
const resize_study_start = () => {
    resize_study_active = true
}
const resize_study_end = () => {
    resize_study_active = false
}
const resize_study_move_touch = (event:TouchEvent) => {
    resize_study_move({pageY: event.touches[0]!.pageY})
}
const resize_study_move = (event:{pageY:number}) => {
    if (resize_study_active && study_div.value){
        const resize_bar_height = 16 / 2
        let new_height = self.innerHeight - event.pageY - resize_bar_height
        const smallest = 100
        const largest = self.innerHeight - 200
        new_height = Math.max(smallest, Math.min(largest, new_height))
        study_div.value.style.minHeight = `${new_height}px`
    }
}


const theme = useTheme()

// Update Vuetify and bg whenever color config changes
// NOTE Done here since `useTheme` can only be called within a setup fn
watch([() => state.hue, () => state.saturation], () => {
    theme.themes.value['dark']!.colors.primary = safe_hsl.value
    theme.themes.value['light']!.colors.primary = safe_hsl.value
    self.document.body.parentElement!.style.backgroundColor = safe_hsl.value
}, {immediate: true})
watch(() => state.dark, value => {
    theme.global.name.value = value ? 'dark' : 'light'
})

onMounted(() => {
    // Register SW once app mounted so doesn't slow down initial render
    if (import.meta.env.PROD){
        void self.navigator.serviceWorker.register('/sw.js')
    }
})

</script>


<style lang='sass' scoped>

.v-application
    height: 100%
    width: 100%
    margin: 0 auto

    :deep(.v-application__wrap)
        min-height: auto  // Override Vuetify 100vh

        .v-main
            display: flex
            flex-direction: row
            height: 100%

.toolbar
    flex-grow: 0  // Don't exceed desired height

.sidebar
    min-width: 450px  // Keep same as drawer width above
    max-width: 450px
    display: flex
    flex-direction: column
    border-right: 1px solid #8883

.main
    display: flex
    flex-direction: column
    overflow: hidden
    flex-grow: 1

.content, .study
    flex-basis: 0  // So don't crush toolbar
    overflow-y: auto
    overflow-x: hidden
    overflow-wrap: anywhere

.content
    flex-grow: 1

.resize
    border-top: 2px solid hsl(0, 0%, 50%)
    height: 16px
    background-color: rgb(var(--v-theme-surface))
    cursor: ns-resize
    text-align: center
    user-select: none
    z-index: 1

    &:hover
        border-top-color: rgb(var(--v-theme-primary))
        .handle
            background-color: rgb(var(--v-theme-primary))

    .handle
        display: inline-block
        min-width: 42px
        height: 24px
        border-radius: 0 0 50% 50%
        background-color: hsl(0, 0%, 50%)

    .close
        position: absolute
        right: 0

.study
    min-height: 30%
    background-color: rgb(var(--v-theme-surface))

</style>
