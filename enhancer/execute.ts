// Script for auto-executing on page load so can be included in a regular HTML site without config

import {BibleEnhancer} from './src/enhance.js'

// @ts-ignore Esbuild configured to load CSS as a raw string
import client_styles from '../client/dist/client.css'
import enhancer_styles from './dist/styles.css'


function enhance(){

    // Attach styles
    for (const styles of [client_styles, enhancer_styles]){
        const style_element = document.createElement('style')
        style_element.append(styles as string)
        document.head.append(style_element)
    }

    // Find script element that included this script itself
    const element:HTMLScriptElement|null =
        document.querySelector('script[src="https://fetch.bible/enhance.js"]')

    // If `data-trans` attribute on script element, use it to configure enhancer
    const translations = element?.dataset['trans']?.split(',')

    // Discover
    void new BibleEnhancer({translations}).discover_bible_references()
}


// Execute immediately if DOM ready, otherwise wait for it
if (document.readyState === 'loading'){
    window.addEventListener('DOMContentLoaded', enhance)
} else {
    enhance()
}
