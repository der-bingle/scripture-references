
<template>

<Layout />

</template>


<script lang='ts' setup>

import {onMounted} from 'vue'
import {useRouter} from 'vitepress'
import DefaultTheme from 'vitepress/theme'

import {BibleEnhancer} from '@gracious.tech/fetch-enhancer'


const {Layout} = DefaultTheme

const app_origin = import.meta.env.PROD ? 'https://app.fetch.bible' : 'http://localhost:8431'


onMounted(() => {

    const enhancer = new BibleEnhancer({app_origin, translations: ['eng_bsb', 'grc_sr']})
    self.fetch_enhancer = enhancer  // Expose so can use in /access/enhancer/

    useRouter().onAfterRouteChanged = to => {
        const doc = document.querySelector('.vp-doc')
        if (doc){
            enhancer.discover_bible_references(doc)
        }
    }

    const doc = document.querySelector('.vp-doc')
    if (doc){
        enhancer.discover_bible_references(doc)
    }
})


</script>
