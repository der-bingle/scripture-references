

// Request handler that has internal cache
export class RequestHandler {

    readonly _remember:boolean  // Whether to save results of responses
    _respond_from_cache = true  // Whether to serve cached responses (still saving them regardless)
    _cache:Record<string, Promise<string>> = {}

    constructor(remember:boolean){
        this._remember = remember
    }

    // Request (text response)
    request(url:string):Promise<string>{

        // Return cached promise if available and caching enabled
        if (url in this._cache && this._respond_from_cache){
            return this._cache[url]!
        }

        // Send request
        const promise = fetch(url, {mode: 'cors'}).catch(() => {
            // Rethrow network errors as own type for clarity
            throw new FetchNetworkError(url)
        }).then(resp => {
            if (resp.ok){
                return resp.text()
            }
            throw new Error(`${resp.status} ${resp.statusText}: ${url}`)
        })

        // Cache request promise if desired
        // NOTE Caching promise so that concurrent requests for same url result in one network call
        if (this._remember){
            this._cache[url] = promise
            // Clear if unsuccessful so can retry if desired
            promise.catch(() => {
                delete this._cache[url]
            })
        }

        // Return original request promise
        return promise
    }

    // Clear cache
    clear_cache(){
        this._cache = {}
    }

    // Disable responding from cache to force fresh requests (which are still remembered)
    disable_responding_from_cache(){
        this._respond_from_cache = false
    }

    // Re-enable returning responses from cache
    enable_responding_from_cache(){
        this._respond_from_cache = true
    }
}


// Custom error for network failure so can be easily caught separate to all other errors
export class FetchNetworkError extends Error {
    constructor(message?:string){
        super(message)
        this.name = new.target.name
    }
}
