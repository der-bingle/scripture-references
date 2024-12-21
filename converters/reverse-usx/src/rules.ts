
import {eng_to_org} from './systems.js'


export interface BookRuleSet {
    test:string  // If this verse exists then these rules should be applied
    renumber:Record<string, string>  // 'GEN 1:1': 'GEN 1:2'
    subtitle?:Record<string, number>  // 'PSA 52': 2  (first 2 verses are original subtitle)
}


// Default rules that cover most common versification issues
// NOTE Copenhagen Alliance 'org' system will be auto-added to this as well
export const default_rules:Record<string, BookRuleSet[]> = {
    'JHN': [{
        test: 'JHN 13:39',
        renumber: {
            'JHN 13:39': 'JHN 14:1',  // Some manuscripts have 13:39 that should be merged into 14:1
        },
    }],
    '1TI': [{
        test: '1TI 6:22',
        renumber: {
            '1TI 6:22': '1TI 6:21',  // arb_bib and a couple others put end of 6:21 as new verse
        },
    }],
    'PSA': [
        // WARN These tests must be checked after 'org' rules as 'org' also has 47:10
        // However, bibles for these rules don't have an issue with any other psalms like 'org' does
        {
            test: 'PSA 47:10',
            renumber: {
                'PSA 47:10': 'PSA 47:9',  // Some bibles like nhe_tbl split v9 into 9-10
            },
        },
    ],
}


// Override the test used to apply Copenhagen Alliance 'org' rules
const override_org_test:Record<string, string> = {
    'ISA': 'ISA 8:23',  // Would auto-default to ISA 64:1 but that is present in English bibles
}


// Turn a range like GEN 1:1-3 into [GEN 1:1, GEN 1:2, GEN 1:3]
function individualise_range(range:string){
    const book = range.slice(0, 3)
    const [chapter, verses] = range.slice(4).split(':') as [string, string]
    let [verse_start, verse_end] = verses.split('-').map(n => parseInt(n))
    verse_end ??= verse_start
    const results:string[] = []
    for (let v = verse_start!; v <= verse_end!; v++){
        results.push(`${book} ${chapter}:${v}`)
    }
    return results
}


// Populate `default_rules` using data from Copenhagen Alliance
for (const system of [eng_to_org]){

    const system_rules:Record<string, BookRuleSet> = {}

    for (const [correct_ref, incorrect_ref] of Object.entries(system)){

        // Break up the ranges
        const corrects = individualise_range(correct_ref)
        const incorrects = individualise_range(incorrect_ref)

        // Ensure Copenhagen Alliance data always specifies a 1-1 mapping of verses
        if (corrects.length !== incorrects.length){
            throw new Error(`Different length: ${correct_ref} ${incorrect_ref}`)
        }

        // Add book to rules if not present yet
        const book = correct_ref.slice(0, 3)
        if (!(book in system_rules)){
            system_rules[book] = {
                test: '',
                renumber: {},
                subtitle: {},
            }
        }

        // Convert Copenhagen Alliance data to own rules
        for (let i = 0; i < corrects.length; i++){
            const correct = corrects[i]!
            const incorrect = incorrects[i]!
            // Handle special case for beginning of some psalms which have intros un-numbered
            // In such cases need to remove verse markers and form a subtitle instead
            // NOTE Merging many-to-one is not yet supported by the spec
            // For now these Psalms just have 51:2 -> 51:0
            // https://github.com/Copenhagen-Alliance/versification-specification/issues/15
            if (correct.endsWith(':0')){
                system_rules[book]!.subtitle![incorrect.split(':')[0]!]
                    = parseInt(incorrect.at(-1)!)
            } else {
                system_rules[book]!.renumber[incorrect] = correct
            }
        }
    }


    // Determine a test for each book to detect if rules should apply
    for (const [book, rules] of Object.entries(system_rules)){
        // Find a verse ref that won't be restored anywhere else, as test for versification sys.
        if (book in override_org_test){
            rules.test = override_org_test[book]!
            continue
        }
        rules.test = Object.keys(rules.renumber)
            .findLast(i => !Object.values(rules.renumber).includes(i))!
        if (!rules.test){
            throw new Error(`Couldn't determine test for ${book}`)
        }
    }

    // Add to default_rules
    for (const [book, rules] of Object.entries(system_rules)){
        default_rules[book] ??= []
        default_rules[book]!.unshift(rules)
    }
}
