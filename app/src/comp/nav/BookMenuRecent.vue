
<template lang='pug'>

v-chip(@click='go_to_ref' size='small' rounded) {{ ref_title }}

</template>


<script lang='ts' setup>

import {computed} from 'vue'
import {PassageReference} from '@gracious.tech/fetch-client'

import {change_to_ref, state} from '@/services/state'
import {content} from '@/services/content'



const props = defineProps<{reference:string}>()


const passage_ref = computed(() => {
    return PassageReference.from_serialized(props.reference)
})


const ref_title = computed(() => {
    return content.collection.bibles.reference_to_string(passage_ref.value, state.trans[0], true)
})


const go_to_ref = () => {
    change_to_ref(passage_ref.value)
    state.show_nav = false
}

</script>


<style lang='sass' scoped>

</style>
