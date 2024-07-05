
// Safer integer parsing that returns null for invalid instead of NaN
export function parse_int(input:string, min?:number, max?:number):number|null{
    let int = parseInt(input, 10)
    if (Number.isNaN(int)){
        return null
    }
    if (min !== undefined){
        int = Math.max(int, min)
    }
    if (max !== undefined){
        int = Math.min(int, max)
    }
    return int
}
