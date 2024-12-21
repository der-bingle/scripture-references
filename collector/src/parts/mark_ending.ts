
// Remove second ending of Mark if given (16:21-22)
// Including long or short is ok at 16:9-20 but adding both is illogical
export function rm_mark_second_ending(xml:string){
    const last_eid = '<verse eid="MRK 16:20"/>'
    const last_eid_i = xml.indexOf(last_eid)
    const after_eid = last_eid_i + last_eid.length
    if (last_eid_i !== -1 && xml.slice(after_eid).includes('<verse')){
        // Verse markers exist after long ending (whether 16:21 or a repeat of 16:9)
        const ending = '</para>\n  <chapter eid="MRK 16"/>\n</usx>'
        xml = xml.slice(0, after_eid) + ending
    }
    return xml
}
