
<script lang='ts' setup>

import {ref, onMounted} from 'vue'


function get_btn_text(){
    return self.fetch_enhancer?._translations[0] === 'vie_vcb' ? "Change to English" : "Change to Vietnamese"
}

// Avoid executing for SSR
const btn_text = ref('')
onMounted(() => {
    btn_text.value = get_btn_text()
})

const toggle_language = () => {
    const new_trans = self.fetch_enhancer._translations[0] === 'vie_vcb' ? ['eng_bsb', 'grc_sr'] : ['vie_vcb']
    self.fetch_enhancer.change_translation(...new_trans)
    self.fetch_enhancer.discover_bible_references(document.querySelector('.vp-doc'))
    btn_text.value = get_btn_text()
}

</script>


# Web enhancer (UI)

The fetch(bible) web enhancer is a quick and easy way to enhance existing webpages with the power of the fetch(bible) platform. It can automatically turn Bible references into links that display the passage on hover and open an embedded Bible study app on click.

_Also see the [web app](/access/app/)_


## Examples

References like Jn 3:16 and John 3:16 can be automatically discovered within text and clicking on them opens an embedded study app without taking users away from your page.

Supported formats:

 * Matt. 10:8
 * Matthew 10:7-8
 * Matt 10:7a-8b (letters are valid but don't affect passage contents)
 * Matt 9:37-10:8
 * Matt 10
 * Matt 9-10

It also works with references in other languages, as long as a translation of that language is specified when constructing `BibleEnhancer`. Change the language below and it will discover the following references, accounting for a variety of different reference styles.

 * Công vụ 13.38    (period)
 * Công vụ 13:38&mdash;39 (long-dash)
 * Công vụ 13：38   (full-width colon)

<VPButton :text='btn_text' @click='toggle_language' theme='alt' />

## Usage

Supports browsers with ES2019+

```js
import {BibleEnhancer} from '@gracious.tech/fetch-enhancer'

// Stylesheets for both the fetch(bible) client and enhancer are required
// If you don't use a bundler you can add them via a standard <link>
import '@gracious.tech/fetch-client/client.css'
import '@gracious.tech/fetch-enhancer/styles.css'

new BibleEnhancer().discover_bible_references()

```

### Advanced Usage

```js
// Available settings for BibleEnhancer
const enhancer = new BibleEnhancer({
    translations: ['eng_bsb', 'grc_sr'],  // Set the translations to be used
    client: new BibleClient(),  // Provide a custom fetch(bible) client
    app_origin: 'https://app.fetch.bible',  // Use a custom fetch app
    history: false,  // Don't intercept browser "back" to hide app modal
    // Do something before enhancer pushes to browser history
    // E.g. Some SPAs need to store scroll position
    before_history_push: () => {
        history.replaceState({scrollPosition: window.scrollY}, '')
    },
})

// Control which elements are evaluated for bible reference discovery
enhancer.discover_bible_references(
    document.querySelector('.article'),  // Root element for discovery
    element => element.classList.contains('refs'),  // Custom filter
)

// Call discover method whenever content is dynamically replaced
my_router.onRouteChanged(() => {
    enhancer.discover_bible_references()
})

// Manually trigger display of embedded app
enhancer.show_app({book: 'gen', chapter_start: 2, verse_start: 5})
enhancer.hide_app()

// Manually enhance any element (e.g. button, span)
enhancer.enhance_element(element,
    {book: 'gen', chapter_start: 2, verse_start: 5, verse_end: 6})

// Change the translations used
enhancer.change_translation('eng_bsb', 'grc_sr')

```

### Real example with SPA

The following is an example of how the enhancer can be used in a SPA framework like [VitePress](https://vitepress.dev/).

```js
// Within a root component that only renders once
onMounted(() => {

    // Init enhancer with support for VitePress' router
    const enhancer = new BibleEnhancer({
        translations: ['eng_bsb', 'grc_sr'],
        before_history_push: () => {
            // Store scroll position for VitePress to prevent page jump
            history.replaceState({scrollPosition: window.scrollY}, '')
        },
    })

    // Initial discovery
    enhancer.discover_bible_references()

    // Discover for every page visited
    useRouter().onAfterRouteChanged = to => {
        enhancer.discover_bible_references()
    }
})
```


### Styles

```css
.fb-enhancer-link {
    /* Style Bible reference links */
}
.fb-enhancer-hover {
    /* Style box shown on link hover */
}
.fb-enhancer-app {
    /* Style app modal */
}

```
