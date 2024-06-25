
import DefaultTheme from 'vitepress/theme'
import VPButton from 'vitepress/dist/client/theme-default/components/VPButton.vue'
import {Theme} from 'vitepress'

import CustomLayout from './CustomLayout.vue'

import './custom.sass'
import '@gracious.tech/fetch-client/client.css'
import '@gracious.tech/fetch-enhancer/styles.css'


export default {
    ...DefaultTheme,
    Layout: CustomLayout,
    enhanceApp(ctx){
        ctx.app.component('VPButton', VPButton)
    },
} as Theme
