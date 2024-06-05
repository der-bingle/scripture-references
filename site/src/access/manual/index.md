
# Manual access

It's recommended to use the official client if able to save you a lot of time, but fetch(bible) can also be accessed manually if the need arises. For example, you may want to access the collection via a language other than Javascript.

## Manifest
There is a single JSON document that contains all the metadata for all Bible translations. You can [inspect the structure](https://collection.fetch.bible/bibles/manifest.json) and parse it as needed.

## Sources
If you need the original source files for Bible translations they are available in the [official collection](https://github.com/gracious-tech/fetch_collection) repository.

## Available formats
All bibles are provided in USX 3+, USFM, HTML, and plain text. You can access each format by providing the translation ID and book ID. The following links will take you to an example of 3 John from the BSB.

 * [`https://collection.fetch.bible/bibles/{id}/usx/{book}.usx`](https://collection.fetch.bible/bibles/eng_bsb/usx/3jn.usx)
 * [`https://collection.fetch.bible/bibles/{id}/usfm/{book}.usfm`](https://collection.fetch.bible/bibles/eng_bsb/usfm/3jn.usfm)
 * [`https://collection.fetch.bible/bibles/{id}/html/{book}.json`](https://collection.fetch.bible/bibles/eng_bsb/html/3jn.json)
 * [`https://collection.fetch.bible/bibles/{id}/txt/{book}.json`](https://collection.fetch.bible/bibles/eng_bsb/txt/3jn.json)

The HTML and plain text formats are broken into verses and stored within a JSON structure. This allows easy extraction of specific passages and also easy reassembly. Please see the [converter's documentation](https://github.com/gracious-tech/fetch/tree/master/converters/usx-to-json) on the structure.

The HTML is standard HTML with custom classes which are designed to be used with the [fetch(bible) client's stylesheet](https://github.com/gracious-tech/fetch/tree/master/client/src/css). The classes are based on the USX elements the HTML was converted from.

Book ids [match the USX standard](https://ubsicap.github.io/usx/vocabularies.html#usx-vocab-bookcode) but are lowercase only.
