
import {PassageReference} from './passage.js'


export interface PassageReferenceMatch {
    ref:PassageReference
    text:string
    index:number
    index_from_prev_match:number
}


// Regex strings used for identifying passage references in blocks of text
// NOTE Allow two spaces but no more, to be forgiving but not match weird text
const regex_verse_sep = '[:：\\.]'
const regex_book_num_prefix = '(?:(?:[123]|I{1,3}) ? ?)?'
const regex_book_name = '\\p{Letter}[\\p{Letter}\\p{Dash} ]{0,16}\\p{Letter}\\.? ? ?'
const regex_integer_with_opt_sep =
    '\\d{1,3}[abc]?(?: ? ?' + regex_verse_sep + ' ? ?\\d{1,3}[abc]?)?'
const regex_verse_range = regex_integer_with_opt_sep + '(?: ? ?\\p{Dash} ? ?'
    + regex_integer_with_opt_sep + ')?'
const regex_trailing = '(?![\\d\\p{Letter}@#$%])'  // Doesn't make sense to be followed by these
const regex_complete = regex_book_num_prefix + regex_book_name + regex_verse_range + regex_trailing

const regex_between_ranges = ' ? ?[,;] ? ?'
const regex_additional_range = regex_between_ranges + '(' + regex_verse_range + ')' + regex_trailing

const regex_book_check = regex_between_ranges + '(' + regex_book_num_prefix + regex_book_name + ')'


// Detect the text and position of passage references in a block of text
// Whole books aren't detected (e.g. Philemon) only references with a range (e.g. Philemon 1)
export function* detect_references(text:string,
        book_names?:Record<string, string>|[string, string][])
        :Generator<PassageReferenceMatch, null, undefined>{

    // Create regex (will manually manipulate lastIndex property of it)
    const regex = new RegExp(regex_complete, 'uig')

    // Keep track of end of last match
    // This is useful for callers to know if they modify the text as they go (changing its length)
    let end_of_prev_match = 0

    // Loop until find a valid ref (not all regex matches will be valid)
    while (true){
        const match = regex.exec(text)
        if (!match){
            return null  // Either no matches or no valid matches...
        }

        // Confirm match is actually a valid ref
        const ref = PassageReference.from_string(match[0], book_names)
        if (ref && ref.args_valid){
            yield {
                ref,
                text: match[0],
                index: match.index,
                index_from_prev_match: match.index - end_of_prev_match,
            }
            end_of_prev_match = match.index + match[0].length

            // If immediately followed by a valid book name, skip check for additional ranges
            // E.g. (Gen 1:1,2 Cor 1:1)
            // WARN Sticky flag 'y' needed to ensure match is at start of lastIndex
            const book_look_ahead = new RegExp(regex_book_check, 'uiy')
            book_look_ahead.lastIndex = regex.lastIndex
            const possible_book = book_look_ahead.exec(text)
            if (possible_book && PassageReference.from_string(possible_book[1]!)){
                continue
            }

            // See if additional ranges immediately after this ref
            // WARN Sticky flag 'y' needed to ensure match is at start of lastIndex
            const add_regex = new RegExp(regex_additional_range, 'uiy')
            add_regex.lastIndex = regex.lastIndex  // Move up to where main regex is up to
            while (true){
                const add_match = add_regex.exec(text)
                if (!add_match){
                    break
                }

                // Since this regex uses a capture group, need to get index of capture
                const add_match_real_index = add_match.index + add_match[0].indexOf(add_match[1]!)

                // Confirm valid ref, prefixing with book (and opt end chapter) from main ref
                let prefix = ref.book
                const has_verse_sep = new RegExp(regex_verse_sep).test(add_match[1]!)
                if (!has_verse_sep && ['verse', 'range_verses', 'range_multi'].includes(ref.type)){
                    prefix += `${ref.end_chapter}:`
                }
                const add_ref = PassageReference.from_string(prefix + add_match[1]!, book_names)
                if (!add_ref || !add_ref.args_valid){
                    break
                }
                yield {
                    ref: add_ref,
                    text: add_match[1]!,
                    index: add_match_real_index,
                    index_from_prev_match: add_match_real_index - end_of_prev_match,
                }
                end_of_prev_match = add_match_real_index + add_match[1]!.length

                // Move main regex up to where successful additional ranges regex is up to
                // WARN Only if larger as lastIndex will reset to 0 at end of string
                if (add_regex.lastIndex > regex.lastIndex){
                    regex.lastIndex = add_regex.lastIndex
                }
            }

        } else {
            // If invalid, try next word as match might still have included a partial ref
            // e.g. "in 1 Corinthians 9" -> "in 1" -> "1 Corinthians 9"
            const chars_to_next_word = match[0].indexOf(' ', 1)
            if (chars_to_next_word >= 1){
                // Backtrack to exclude just first word of previous match
                regex.lastIndex -= (match[0].length - chars_to_next_word - 1)
            }
        }
    }
}
