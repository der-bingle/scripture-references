
import {FetchClient} from '@gracious.tech/fetch-client'


// Use localhost endpoint during dev
const endpoint = import.meta.env.PROD ? 'https://v1.fetch.bible/' : 'http://localhost:8430/'


// Get collection
const client = new FetchClient({endpoints: [endpoint]})
const collection = await client.fetch_collection()


export {client, collection}
