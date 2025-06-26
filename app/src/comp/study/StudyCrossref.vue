
<template lang='pug'>

v-chip(rounded size='small' @click='go_to_ref') {{ label }}

</template>


<script lang='ts' setup>

import {computed} from 'vue'
import {PassageReference} from '@gracious.tech/fetch-client'

import {change_to_ref, state, add_to_read_history} from '@/services/state'


const props = defineProps<{reference:PassageReference}>()


const label = computed(() => {
    return props.reference.toString(state.book_names)
})


const go_to_ref = () => {
    add_to_read_history(state.study!)  // First save study verse that user is navigating from
    add_to_read_history(props.reference)
    change_to_ref(props.reference)
}

</script>


<style lang='sass' scoped>


</style>
