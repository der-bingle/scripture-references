
import path from 'path'
import {closeSync, existsSync, mkdirSync, openSync, rmSync, statSync} from 'fs'

import {afterEach, beforeEach, describe, it} from 'vitest'

import {read_dir, get_dir_entries, DirectoryEntry} from './utils'


describe('read_dir', () => {
    const contents = read_dir(path.join('dist', 'bibles', 'eng_bsb'))

    it('should return all the resources by default', ({expect}) => {
        expect(contents.length).not.toEqual(0)
        expect(contents.includes('html')).toBe(true)
        expect(contents.includes('txt')).toBe(true)
        expect(contents.includes('usfm')).toBe(true)
    })

})

describe('get_dir_entries', () => {
    const contents = get_dir_entries(path.join('dist', 'bibles'))

    it('should return a correct directory entry', ({expect}) => {
        expect(contents.length).not.toEqual(0)
        const bsb = contents.find((item: DirectoryEntry) => item.name === 'eng_bsb')
        expect(bsb).not.toEqual(undefined)
        expect(bsb!.name).toEqual('eng_bsb')
        expect(bsb!.isDirectory).toBe(true)
        expect(bsb!.fileSize).toEqual(undefined)
        expect(bsb!.dirSize).toEqual(5)
    })

    it('should return a correct file entry', ({expect}) => {
        const expected_size = statSync(path.join('dist', 'manifest.json')).size
        expect(contents.length).not.toEqual(0)
        const manifest = contents.find((item: DirectoryEntry) => item.name === 'manifest.json')
        expect(manifest).not.toEqual(undefined)
        expect(manifest!.name).toEqual('manifest.json')
        expect(manifest!.isDirectory).toBe(false)
        expect(manifest!.fileSize).toEqual(expected_size)
        expect(manifest!.dirSize).toEqual(undefined)
    })

})
