
import {join} from 'node:path'
import {readFileSync} from 'node:fs'

import {describe, it} from 'vitest'

import {reverse_usx} from './reverse.js'


const samples_dir = join(__dirname, '..', 'samples')


function norm_whitespace(string:string){
    return string.split('\n').map(l => l.trimEnd()).join('\n').replace(/\n+/g, '\n').trim()
}


/**
 * @vitest-environment jsdom
 */
describe("reverse_usx", () => {

    it("Renumbers Psalms correctly", async ({expect}) => {
        const psa = readFileSync(join(samples_dir, 'psa.usx'), {encoding: 'utf8'})
        const psa_done = readFileSync(join(samples_dir, 'psa_done.usx'), {encoding: 'utf8'})
        expect(norm_whitespace(reverse_usx(psa))).toEqual(norm_whitespace(psa_done))
    })

    it("Renumbers Joel correctly", async ({expect}) => {
        const jol = readFileSync(join(samples_dir, 'jol.usx'), {encoding: 'utf8'})
        const jol_done = readFileSync(join(samples_dir, 'jol_done.usx'), {encoding: 'utf8'})
        expect(norm_whitespace(reverse_usx(jol))).toEqual(norm_whitespace(jol_done))
    })

    it("Renumbers Malachi correctly", async ({expect}) => {
        const mal = readFileSync(join(samples_dir, 'mal.usx'), {encoding: 'utf8'})
        const mal_done = readFileSync(join(samples_dir, 'mal_done.usx'), {encoding: 'utf8'})
        expect(norm_whitespace(reverse_usx(mal))).toEqual(norm_whitespace(mal_done))
    })

    it("Renumbers Romans correctly", async ({expect}) => {
        const rom = readFileSync(join(samples_dir, 'rom.usx'), {encoding: 'utf8'})
        const rom_done = readFileSync(join(samples_dir, 'rom_done.usx'), {encoding: 'utf8'})
        expect(norm_whitespace(reverse_usx(rom))).toEqual(norm_whitespace(rom_done))
    })

})
