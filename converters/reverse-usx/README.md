# Re-verse USX

Ensure a USX document follows the standard versification used in modern bibles.

In browser:
```js
import {reverse_usx} from 'reverse-usx'

const usx_string = '...'
const result = reverse_usx(usx_string)
```

In Node:
```js
import {JSDOM} from 'jsdom'
import {reverse_usx} from 'reverse-usx'

// Get access to DOM parsing classes that are globally available in browsers
const DOM = new JSDOM()

const usx_string = '...'
const result = reverse_usx(usx_string, DOM.window.DOMParser, DOM.window.XMLSerializer)
```

Most modern translations use the same system for numbering chapters and verses, [originally created by Robert Estienne](https://en.wikipedia.org/wiki/Chapters_and_verses_of_the_Bible#Verses) in 1551 AD and later popularized by the KJV.

Bibles based on other manuscripts (such as the Septuagint) or from other Christian traditions (such as Orthodox and Catholic) were given somewhat [different systems of numbering verses](https://github.com/Copenhagen-Alliance/versification-specification/tree/master/versification-mappings/standard-mappings).

This module converts USX documents that use alternate versification systems to the standard "KJV" numbering. It mainly only supports converting from the alternate BHS versification for the OT, but may in future support other systems as well.
