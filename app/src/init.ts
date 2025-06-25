
import {createApp} from 'vue'
import {createVuetify} from 'vuetify'
import {md3} from 'vuetify/blueprints'

import AppRoot from './comp/AppRoot.vue'
import AppIcon from '@/comp/AppIcon.vue'
import {enable_watches, apply_search_param} from '@/services/watches'
import {state, safe_hsl, initial_search_param} from '@/services/state'
import {content} from '@/services/content'
import {post_message} from '@/services/post'


// Embed global styles
import './styles.sass'
import '@gracious.tech/fetch-client/client.css'
import 'vuetify/styles'


// Create app
const app = createApp(AppRoot)


// Add Vuetify
const dark_val = state.dark ?? matchMedia('(prefers-color-scheme: dark)').matches
app.use(createVuetify({
    blueprint: md3,
    defaults: {
        VDialog: {
            scrollable: true,  // Stops toolbars in dialogs from scrolling with contents
        },
    },
    theme: {
        defaultTheme: dark_val ? 'dark' : 'light',
        themes: {
            dark: {
                dark: true,
                colors: {
                    primary: safe_hsl.value,
                },
            },
            light: {
                dark: false,
                colors: {
                    primary: safe_hsl.value,
                },
            },
        },
    },
}))


// Add global components
app.component('AppIcon', AppIcon)


// Wait for collection to load before mounting app (need for even basic UI)
void content.client.fetch_collection().then(collection => {

    // Init content state
    content.collection = collection
    content.translations = collection.get_translations({object: true})
    content.languages = collection.get_languages({object: true})

    // Ensure all trans codes are valid
    // NOTE Changing also triggers content to load for the first time
    const valid_trans = state.trans.filter(code => code in content.translations)
    state.trans = valid_trans.length ? (valid_trans as [string, ...string[]])
        : [content.collection.get_preferred_translation().id]

    // Enable watches
    enable_watches()

    // Apply search param from hash if given
    // NOTE Must come after `enable_watches()` as translation load will clear search value
    if (initial_search_param){
        apply_search_param(initial_search_param)
    }

    // Tell parent ready to communicate (once a trans has been set)
    post_message('ready')

    // Mount app
    app.mount('#app')
})
