
import path from 'path'

import {partition} from 'lodash-es'

import {DirectoryEntry, get_dir_entries} from './utils.js'


/**
 * Generate the HTML content using the specific directory path content
 *
 * @param directory             The path to generate an index content for
 * @param exclude_breadcrumbs   An array of folders in the directory that should not be included
 *                              in the breadcrumbs
 * @param whitelist             Only include given names
 *
 * @returns The html content
 */
export function generate_index_content(directory:string, exclude_breadcrumbs:string[]=[],
        whitelist?:string[]):string {

    // Create the breadcrumbs
    // Filter removes any empty values if the path.sep is at the end
    // Also remove any paths passed in exclude_breadcrumbs
    const pieces = directory
        .split(path.sep)
        .filter((n: string) => n)
        .filter((n: string) => !exclude_breadcrumbs.includes(n))
        .reverse()

    let crumb_path = ''
    const crumbs = []
    for (let index = 0; index < pieces.length; index++) {
        const crumb = pieces[index] ?? ''
        let li = ''
        if (index === 0) {
            // We are in reverse, so 0 is the last item
            li = `<li class="last">${crumb}</li>`
        } else {
            crumb_path += `../`
            li = `<li><a href="${crumb_path}">${crumb}</a></li>`
        }
        crumbs.push(li)
    }

    // Attach the root directory
    crumb_path += `../`
    crumbs.push(`<li><a href="${crumb_path}">/</a></li>`)
    const breadcrumbs = `<ul>${crumbs.reverse().join('')}</ul>`

    // Collect the files and folders from the given path
    const sorter = (a: DirectoryEntry, b: DirectoryEntry) => a.name.localeCompare(b.name)
    let contents = get_dir_entries(directory)

    // Apply whitelist if given
    if (whitelist){
        contents = contents.filter(item => whitelist.includes(item.name))
    }

    // lodash partition seperates the array based on predicate
    // @link https://lodash.com/docs/4.17.15#partition
    const results = partition(contents, (content: DirectoryEntry) => content.isDirectory)
    const dirs = results[0].sort(sorter)
    const files = results[1].sort(sorter)

    // Now create a table with columns: folders | content size | files | file size
    const max = Math.max(dirs.length, files.length)
    const rows = []
    for (let index = 0; index < max; index++) {
        let folder_text = ''
        let folder_size = ''
        let file_text = ''
        let file_size = ''
        if (dirs[index] !== undefined) {
            const name = dirs[index]!.name
            folder_text = `<a href="./${name}/">${name}</a>`
            folder_size = `<span data-entry-name="${name}">${dirs[index]!.dirSize!}</span>`
        }
        if (files[index] !== undefined) {
            const name = files[index]!.name
            file_text = `<a href="./${name}">${name}</a>`
            file_size = `<span data-entry-name="${name}">`
                + files[index]!.fileSize!.toLocaleString() + ` bytes</span>`
        }
        rows.push(`<tr>
            <td>${folder_text}</td>
            <td>${folder_size}</td>
            <td></td>
            <td>${file_text}</td>
            <td>${file_size}</td>
        </tr>`)
    }
    const table = `<table class="entry-list">
        <thead>
            <tr>
                <th>Folders</th>
                <th>Items</th>
                <th></th>
                <th>Files</th>
                <th>Size</th>
            </tr>
        </thead>
        <tbody>${rows.join('')}</tbody>
    </table>`

    // Return the HTML
    return `<!DOCTYPE html>
        <html>
        <head>
            <meta charset='utf-8'>
            <style>
                body {
                    font-family: monospace, monospace;
                    font-size: 16px;
                    background-color: black;
                    color: #ddd;
                }
                a {
                    color: #c12bdb;
                    text-decoration: none;
                }
                #breadcrumbs ul {
                  padding: 10px 16px;
                  list-style: none;
                  background-color: #333;
                }
                #breadcrumbs ul li {
                  display: inline;
                  font-size: 18px;
                }
                #breadcrumbs ul li+li:before {
                  padding: 8px;
                  color: #fff3;
                  content: '⟩';
                }
                th, td {
                    border-bottom: 1px solid #fff3;
                }
                th:nth-child(3), td:nth-child(3) {
                    border-bottom-style: none;
                }
                th, td {
                    padding: .5rem;
                }
                table {
                    border-collapse: collapse;
                }
                td:nth-child(1), td:nth-child(4) {
                    width: 300px;
                }
                td:nth-child(2), td:nth-child(5) {
                    width: 200px;
                    text-align: end;
                }
            </style>
        </head>
        <body>
            <div id="breadcrumbs">${breadcrumbs}</div>
            ${table}
        </body>
        </html>`
}


// Generate index files for the dirs of given files
export function generate_indexes_for_files(files:string[]){

    // Get dirs for all files
    let dirs = files.map(file => path.dirname(file) + '/')

    // Make dirs unique as will have a lot of duplicates
    dirs = [...new Set(dirs)]

    // Generate an index for each
    return dirs.map(dir => {
        return {
            path: dir.slice('dist/'.length).replaceAll(path.sep, '/') + 'index.html',
            html: generate_index_content(dir, ['dist']),
        }
    })
}
