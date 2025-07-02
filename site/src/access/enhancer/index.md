
<script lang='ts' setup>

import {ref, onMounted} from 'vue'


function get_btn_text(){
    return self.fetch_enhancer?._translations[0] === 'vie_bib' ? "Change to English" : "Change to Vietnamese"
}

// Avoid executing for SSR
const btn_text = ref('')
onMounted(() => {
    btn_text.value = get_btn_text()
})

const toggle_language = () => {
    const new_trans = self.fetch_enhancer._translations[0] === 'vie_bib' ? ['eng_bsb', 'grc_sr'] : ['vie_bib']
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
 * Philemon 2-3  (numbers refer to verses when only one chapter)

Multi-passage detection:

 * Matt 10:6,8
 * Matt 10:8,11:1
 * Matt 10:8, John 3:16
 * Matt 10:8,10; John 3:16

It also works with references in other languages, as long as a translation of that language is specified when constructing `BibleEnhancer`. Change the language below and it will discover the following references, accounting for a variety of different reference styles.

 * Công vụ 13.38    (period)
 * Công vụ 13:38&mdash;39 (long-dash)
 * Công vụ 13：38   (full-width colon)

<VPButton :text='btn_text' @click='toggle_language' theme='alt' />

It does not detect whole book or multi-book references as there would be too many false-positives.

 * Luke is my friend.
 * Gen-Exo
 * 1-3 John


## Usage

Supports browsers with ES2019+


### Express Usage

Add the following to the `<head>` of your page:

`<script type="module" crossorigin src="https://collection.fetch.bible/enhance.js"></script>`

It will automatically execute and transform all references it finds in the user's language, using the default translation for that language. Add the following attribute to force it to use the given bibles `data-trans="eng_bsb,grc_sr"`, or `data-plain` to disable the default theme and make links look like regular links. To configure any additional settings, use the standard import method below.

::: info TIP -- Transform other people's websites

For your own personal use you can add the following as a bookmark in your browser. Clicking it will transform whatever page you are currently viewing. Specify what bibles you would like at the end of the bookmark like so:

`javascript:(trans=>{var s=document.createElement('script');s.crossOrigin='';s.dataset.trans=trans;s.src='https://collection.fetch.bible/enhance.js';document.head.appendChild(s)})("eng_bsb,grc_sr")`

:::


### Standard Usage

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
    default_theme: false,  // Disable default styling of links
    translations: ['eng_bsb', 'grc_sr'],  // Set the translations to be used
    always_detect_english: false,  // Disable auto-detection of English refs
    client: new FetchClient(),  // Provide a custom fetch(bible) client
    app_origin: 'https://app.fetch.bible',  // Use a custom fetch app
    app_args: {hue: '120'},  // Pass args to embedded app (see app docs)
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
    // A custom filter (default excludes headings)
    element => element.classList.contains('refs'),
)

// Call discover method whenever content is dynamically replaced
my_router.onRouteChanged(() => {
    enhancer.discover_bible_references()
})

// Manually trigger display of embedded app
enhancer.show_app({book: 'gen', start_chapter: 2, start_verse: 5})
enhancer.hide_app()

// Manually enhance any element (e.g. button, span)
enhancer.enhance_element(element,
    {book: 'gen', start_chapter: 2, start_verse: 5, end_verse: 6})

// Change the translations used
enhancer.change_translation('eng_bsb', 'grc_sr')

```

### Real example with SPA

The following is an example of how the enhancer can be used in a SPA framework like [VitePress](https://vitepress.dev/), which will change URL/content without reloading the page.

The following code should be run within VitePress' [`enhanceApp(ctx)`](https://vitepress.dev/guide/custom-theme) function.

```js
// Enhancer is not needed/compatible with Server-Side Rendering
if (!import.meta.env.SSR){
    let enhancer
    ctx.router.onAfterPageLoad = to => {
        // Init enhancer after first page mounted and DOM ready
        if (!enhancer){
            enhancer = new BibleEnhancer({
                before_history_push: () => {
                    // VitePress expects scroll value to prevent page jump
                    history.replaceState({
                        scrollPosition: window.scrollY,
                    }, '')
                },
            })
        }
        // Discover new references whenever a new page is loaded
        enhancer.discover_bible_references()
    }
}
```


### Styles

The following classes are added to the respective elements so they can be styled:

```css
.fb-enhancer-link {
    /* Style Bible reference links */
}
.fb-enhancer-multi {
    /* Wraps multiple ranges together, e.g.
    <span class='fb-enhancer-multi'><a>Gen 1:1</a>, <a>2:5</a></span>
    */
}
.fb-enhancer-hover {
    /* Style box shown on link hover */
}
.fb-enhancer-app {
    /* Style app modal */
}

```

For example, the following styles are set when the default theme is enabled:

```css
.fb-enhancer-theme .fb-enhancer-link {
    color: inherit;
    text-decoration: none;
    background-color: hsla(60, 100%, 45%, 0.15);
}
/* Prevent references from being broken by line-wrapping,
    like "Genesis 1:1" compared to "Genesis
    1:1"
*/
.fb-enhancer-theme .fb-enhancer-multi,
.fb-enhancer-theme .fb-enhancer-link {
    white-space: nowrap;
}
```
