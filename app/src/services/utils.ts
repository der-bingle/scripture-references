

export function wait(ms:number):Promise<void>{
    // Wait given ms before resolving promise
    return new Promise(resolve => {setTimeout(resolve, ms)})
}


// Safer integer parsing
export function parse_int(input:string|number, min?:number, max?:number):number{
    let int = typeof input === 'number' ? input : parseInt(input, 10)
    if (Number.isNaN(int)){
        int = 0
    }
    if (min !== undefined){
        int = Math.max(int, min)
    }
    if (max !== undefined){
        int = Math.min(int, max)
    }
    return int
}
