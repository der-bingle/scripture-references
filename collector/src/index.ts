#!/usr/bin/env node

import yargs from 'yargs'

import {report_invalid_books, report_incomplete, report_items, report_unprocessed,
    report_invalid_meta} from './commands/report.js'
import {publish} from './commands/publish.js'
import {serve} from './commands/serve.js'
import {update_dist} from './commands/process.js'
import {download_source} from './commands/download.js'
import {clean_collection} from './commands/clean.js'
import {discover_translations} from './commands/discover.js'
import {gen_language_data} from './parts/languages.js'
import {update_bmc} from './parts/bmc.js'
import {init_config} from './parts/config.js'
import {update_manifest} from './parts/manifest.js'
import {notes_process} from './resources/notes.js'
import {update_glosses} from './resources/gloss.js'
import {crossref_process} from './data/crossref.js'

import type {TranslationServiceId} from './parts/types'

import './parts/console_colors.js'


// Process CLI args
await yargs(process.argv.slice(2))
    .scriptName('fetch-collector')

    .command('setup', "Setup new collection", {},
        async argv => {await Promise.all([init_config(), gen_language_data(), update_bmc()])})
    .command('setup-data', "Update data on world's languages", {},
        argv => gen_language_data())
    .command('setup-bmc [version]', "Update Bible Multi Converter", {},
        argv => update_bmc(argv['version'] as string))

    // Bibles
    .command('discover [service] [id]', "Discover what translations are available", {},
        argv => discover_translations(
            argv['service'] as TranslationServiceId, argv['id'] as string))

    .command('download [id]', "Download source files (--recheck for updating existing)",
        {recheck: {type: 'boolean'}, force: {type: 'boolean'}},
        argv => download_source(!!argv['recheck'], !!argv['force'], argv['id'] as string))

    .command('process [id]', "Convert source files to distributable formats", {},
        argv => update_dist(argv['id'] as string))
    .command('process-manifest', "Update manifest (without updating actual translations)", {},
        argv => update_manifest())

    .command('serve [port]', "Serve the collection for testing", {},
        argv => serve(argv['port'] ? parseInt(argv['port'] as string) : undefined))

    .command('publish', "Publish all changes to server", {},
        argv => publish())
    .command('publish-bible [ids]', "Publish translations to server", {},
        argv => publish('bible', argv['ids'] as string))
    .command('publish-notes [id]', "Publish study notes to server", {},
        argv => publish('notes', argv['id'] as string))
    .command('publish-glosses [id]', "Publish glosses to server", {},
        argv => publish('glosses', argv['id'] as string))
    .command('publish-data [id]', "Publish other data to server", {},
        argv => publish('data', argv['id'] as string))

    .command('clean', "Remove any unnecessary files from the collection", {},
        argv => clean_collection())

    .command('report', "Report the status of included translations", {},
        argv => report_items())
    .command('report-invalid-meta', "Report translations with invalid metadata", {},
        argv => report_invalid_meta())
    .command('report-bookless', "Report translations with no valid books", {},
        argv => report_invalid_books(true))
    .command('report-invalid-books', "Report translations with invalid books", {},
        argv => report_invalid_books())
    .command('report-incomplete', "Report translations with almost complete testaments", {},
        argv => report_incomplete())
    .command('report-unprocessed [type]', "Report translations yet to be processed", {},
        argv => report_unprocessed(argv['type'] as 'usfmx'|'other'|undefined))

    // Language-based resources
    .command('notes-process', "Convert study notes to standard format", {}, argv => notes_process())
    .command('gloss-update', "Redownload and update glosses", {redownload: {type: 'boolean'}},
        argv => update_glosses(!!argv['redownload']))

    // Data
    .command('data-crossref', "Generate cross-references data", {}, argv => crossref_process())

    // Show help when no command
    .demandCommand()
    .strict()
    .help()

    // Trigger processing
    .argv
