
import type {TxtContent} from '@gracious.tech/fetch-client'


// Strip fetch(bible) HTML of tags and return only the actual biblical content (no headings/notes)
// NOTE Using regex for speed since needs to run thousands of times during search indexing
export function strip_tags_and_commentary(html:string):string{
    return html.replace(/<span class="fb-note"><span>.*?<\/span><\/span>/gs, '')
        .replace(/<sup.*?>.*?<\/sup>/gs, '')
        .replace(/<h[1-6].*?>.*?<\/h[1-6]>/gs, ' ')
        .replace(/<.*?>/g, ' ')
}


// Reduce JSON txt format to plain string of just biblical content (ignore heading/note objects)
export function strip_objects_from_txt(txt:TxtContent[]):string{
    return txt.filter(part => typeof part === 'string').join('')
}
