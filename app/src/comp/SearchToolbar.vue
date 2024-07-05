
<template lang='pug'>

v-toolbar(:density='density')
    v-text-field.input(v-model='state.search' placeholder="E.g. John 3:16" hide-details
        density='compact' variant='outlined' autofocus @blur='state.search = null')

    template(#append)
        //- v-btn-toggle(color='secondary' density='compact')
        //-     v-btn {{ current_book_name }}
        //-     v-btn OT
        //-     v-btn NT
        //-     v-btn All
        v-btn(icon @click='state.search = null')
            app-icon(name='close')

</template>


<script lang='ts' setup>


import {density, state} from '@/services/state'


</script>


<style lang='sass' scoped>

.input
    margin: 8px

</style>
