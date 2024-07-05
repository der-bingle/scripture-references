// Script for auto-executing on page load so can be included in a regular HTML site without config

import {BibleEnhancer} from './src/enhance.js'

// @ts-ignore Esbuild configured to load CSS as a raw string
import client_styles from '../client/dist/client.css'
import enhancer_styles from './dist/styles.css'


window.addEventListener('DOMContentLoaded', () => {

    // Attach styles
    for (const styles of [client_styles, enhancer_styles]){
        const style_element = document.createElement('style')
        style_element.append(styles as string)
        document.head.append(style_element)
    }

    // Discover
    void new BibleEnhancer().discover_bible_references()
})
