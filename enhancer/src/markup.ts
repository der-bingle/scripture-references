
import type {BibleCollection, PassageReference, PassageReferenceMatch}
    from '@gracious.tech/fetch-client'


// Util for turning a passage ref into an <a> element
function _linkify_ref(node:Text, match:PassageReferenceMatch){

    // Separate ref text from preceeding text
    const ref_node = node.splitText(match.index_from_prev_match)

    // Separate ref text from trailing text
    const remainder = ref_node.splitText(match.text.length)

    // Turn ref text into a link
    const ref_a = document.createElement('a')
    ref_a.setAttribute('class', 'fb-enhancer-link')
    ref_a.textContent = match.text
    ref_node.replaceWith(ref_a)

    // Return new <a> element and newly-created trailing text node
    return {element: ref_a, ref: match.ref, remainder}
}


// Default filter that excludes headings from reference detection
export function default_filter(element:Element):boolean{
    return !['H1','H2','H3','H4','H5','H6'].includes(element.tagName)
}


// Auto-discover references in provided DOM and transform into links
export async function markup_references(collection:BibleCollection, root:HTMLElement,
        translations:string[]=[], always_detect_english=true, filter=default_filter)
        :Promise<{element: HTMLAnchorElement, ref:PassageReference}[]>{

    // Create DOM walker that will ignore subtrees identified by filter arg
    // NOTE Not excluding non-text nodes initially so can filter out whole subtrees if needed
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ALL, node => {

        // Process all text nodes
        if (node.nodeType === node.TEXT_NODE){
            return NodeFilter.FILTER_ACCEPT
        }

        // Test all element nodes against user-supplied filter
        if (node.nodeType === node.ELEMENT_NODE){
            if (node.nodeName === 'A'){
                return NodeFilter.FILTER_REJECT  // Ignore all existing links
            }
            return filter(node as Element) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
        }

        // Reject all other node types (comments etc.)
        return NodeFilter.FILTER_REJECT
    })

    // Get all relevant text nodes in advance (as modifying DOM will interrupt walk)
    const nodes:[Text, Generator<PassageReferenceMatch, null>, PassageReferenceMatch][] = []
    while (walker.nextNode()){
        if (walker.currentNode.nodeType === Node.TEXT_NODE){
            const detector = collection.detect_references(walker.currentNode.textContent!,
                translations, always_detect_english)
            const match = detector.next().value
            if (match){
                // NOTE Must include detector as it preserves state for relative matches
                nodes.push([walker.currentNode as Text, detector, match])
            }
        }
    }

    // Modify collected text nodes
    const elements:{element: HTMLAnchorElement, ref:PassageReference}[] = []
    for (const [orig_node, detector, first_valid_match] of nodes){

        // Linkify the first match
        let {element, ref, remainder} = _linkify_ref(orig_node, first_valid_match)
        elements.push({element, ref})

        // Linkify any remaining matches too
        while (true){
            const next_ref_result = detector.next().value
            if (next_ref_result){
                const next = _linkify_ref(remainder, next_ref_result)
                remainder = next.remainder
                elements.push({element: next.element, ref: next.ref})
            } else {
                break
            }
        }
    }

    return elements
}
