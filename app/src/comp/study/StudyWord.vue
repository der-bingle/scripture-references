
<template lang='pug'>

div.column
    div(@click='search_original') {{ word }}
    div gloss

</template>


<script lang='ts' setup>

import {computed} from 'vue'

import {state} from '@/services/state'


const props = defineProps<{word:string}>()


const search_original = () => {
}

</script>


<style lang='sass' scoped>

.column
    display: flex
    flex-direction: column
    align-items: center

</style>
