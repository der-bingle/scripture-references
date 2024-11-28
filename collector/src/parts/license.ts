
import {MetaStandardLicense} from './shared_types'


// Standard licenses that multiple translations may use
export const LICENSES:Record<string, MetaStandardLicense> = {
    // NOTE URLs not given as should include version of license (same restrictions between versions)
    'public': {
        name: "Public domain",
        restrictions: {
            forbid_commercial: false,
            forbid_derivatives: false,
            forbid_attributionless: false,
            forbid_limitless: false,
            forbid_other: false,
        },
    },
    'cc-by': {
        name: "CC BY",
        restrictions: {
            forbid_commercial: false,
            forbid_derivatives: false,
            forbid_attributionless: true,
            forbid_limitless: false,
            forbid_other: false,
        },
    },
    'cc-by-sa': {
        name: "CC BY-SA",
        restrictions: {
            forbid_commercial: false,
            forbid_derivatives: 'same-license',
            forbid_attributionless: true,
            forbid_limitless: false,
            forbid_other: false,
        },
    },
    'cc-by-nc': {
        name: "CC BY-NC",
        restrictions: {
            forbid_commercial: true,
            forbid_derivatives: false,
            forbid_attributionless: true,
            forbid_limitless: false,
            forbid_other: false,
        },
    },
    'cc-by-nc-sa': {
        name: "CC BY-NC-SA",
        restrictions: {
            forbid_commercial: true,
            forbid_derivatives: 'same-license',
            forbid_attributionless: true,
            forbid_limitless: false,
            forbid_other: false,
        },
    },
    'cc-by-nd': {
        name: "CC BY-ND",
        restrictions: {
            forbid_commercial: false,
            forbid_derivatives: true,
            forbid_attributionless: true,
            forbid_limitless: false,
            forbid_other: false,
        },
    },
    'cc-by-nc-nd': {
        name: "CC BY-NC-ND",
        restrictions: {
            forbid_commercial: true,
            forbid_derivatives: true,
            forbid_attributionless: true,
            forbid_limitless: false,
            forbid_other: false,
        },
    },
}


export function detect_year(...sources:string[]):number|null{
    // Detect the most likely year of publication (most reliable sources to be first in list)
    for (const source of sources){

        // Find all candidates in the source
        const candidates:number[] = []
        // NOTE regex ensures 4 digits are not next to any other digits
        for (const match of source.matchAll(/^(?:.*[^\d])?(\d\d\d\d)(?:[^\d].*)?$/g)){
            candidates.push(parseInt(match[1]!))
        }

        // Return lowest number (if any) which will be the publication year (rather than revision)
        if (candidates.length){
            return Math.min(...candidates)
        }
    }
    return null
}
