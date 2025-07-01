
<template lang='pug'>

div.column
    div.word(@click='search_original' :class='{ot: state.study?.ot}') {{ word.word }}
    a.gloss(:href='research_url' target='research') {{ gloss }}

</template>


<script lang='ts' setup>

import {computed} from 'vue'

import {state} from '@/services/state'

import type {GlossesDataWord} from '@gracious.tech/fetch-client'


const props = defineProps<{word:GlossesDataWord}>()

const gloss = computed(() => {
    // If blank or hyphen, replace with mdash so easier to click
    if (!props.word.gloss || props.word.gloss === '-'){
        return '—'  // mdash
    }
    return props.word.gloss
})

const research_url = computed(() => {
    const lang_path = props.word.strong.startsWith('H') ? 'hebrew' : 'greek'
    // NOTE Sometimes has letter at end (e.g. 1254a)
    //   Bible Hub seems to support these but with less info, so removing
    const strong_num = parseInt(props.word.strong.slice(1).replace(/\D/, ''))
    return `https://biblehub.com/${lang_path}/${strong_num}.htm`
})

const search_original = () => {
}

</script>


<style lang='sass' scoped>

.column
    display: flex
    flex-direction: column
    align-items: center
    text-align: center

.word
    &.ot
        direction: rtl

.gloss
    max-width: 100px
    font-size: 14px

</style>
