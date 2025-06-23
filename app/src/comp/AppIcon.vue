
<template lang='pug'>

component.icon(:is='icons[name]' :class='{small}')

</template>


<script lang='ts' setup>

import type {FunctionalComponent} from 'vue'

import add_circle_fill from '@material-symbols/svg-400/outlined/add_circle-fill.svg?component'
import close from '@material-symbols/svg-400/outlined/close.svg?component'
import close_small from '@material-symbols/svg-400/outlined/close_small.svg?component'
import search from '@material-symbols/svg-400/outlined/search.svg?component'
import more_vert from '@material-symbols/svg-400/outlined/more_vert.svg?component'
import arrow_back from '@material-symbols/svg-400/outlined/arrow_back.svg?component'
import expand_circle_down from '@material-symbols/svg-400/outlined/expand_circle_down.svg?component'
import settings from '@material-symbols/svg-400/outlined/settings.svg?component'
import info from '@material-symbols/svg-400/outlined/info.svg?component'
import dark_mode from '@material-symbols/svg-400/outlined/dark_mode.svg?component'
import light_mode from '@material-symbols/svg-400/outlined/light_mode.svg?component'
import cloud_off from '@material-symbols/svg-400/outlined/cloud_off.svg?component'
import sync from '@material-symbols/svg-400/outlined/sync.svg?component'
import arrow_outward from '@material-symbols/svg-400/outlined/arrow_outward.svg?component'


defineProps({
    name: {required: true, type: String},
    small: {type: Boolean},
})


const icons = {
    close, search, more_vert, arrow_back, add_circle_fill, expand_circle_down,
    settings, info, dark_mode, light_mode, cloud_off, sync, close_small, arrow_outward,
} as Record<string, FunctionalComponent>


</script>


<style lang='sass' scoped>


.icon
    height: 24px
    width: 24px
    fill: currentColor

    &.small
        height: 18px
        width: 18px


</style>
