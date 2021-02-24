#!/usr/bin/env node

'use strict'

const packageDetails = require('./package')
const program = require('commander')
const translator = require('./src/translator')

process.title = packageDetails.name
console.info(packageDetails.name, packageDetails.version)
console.info('')

program.version(packageDetails.version).description(packageDetails.description)

/**
 * Command line that translates an SFCC inventory file into an OCI inventory file ready to be importer into OCI
 *
 * @alias module:cli
 *
 * @param {String} tooci The command name
 * @param {String} source The SFCC inventory source file
 * @param {String} target The path where to store the generated file
 */
program.command('tooci <source> <target>')
    .option('-o, --override', 'Override the target file.')
    .option('-m, --mode <mode>', 'The import mode. Default: UPDATE')
    .option('-s, --safety <safety>', 'The safety stock count applied to all records within the file. Default: 0')
    .option('-sout, --skipout', 'Skip out-of-stock products.')
    .action((source, target, options) => {
        Promise.resolve().then(() => translator.toOCI(source, target, options))
            .then(({ recordsCount, inventoriesCount }) => {
                console.info(`End process: ${recordsCount} records translated from ${inventoriesCount} inventories.`)
                process.exit(0)
            })
            .catch(e => {
                console.error(e)
                process.exit(-1)
            })
    })

/**
 * Command line that translates an OCI inventory file into an SFCC inventory file ready to be importer into SFCC
 *
 * @alias module:cli
 *
 * @param {String} tooci The command name
 * @param {String} source The OCI inventory source file
 * @param {String} target The path where to store the generated file
 */
program.command('tosfcc <source> <target>')
    .option('-o, --override', 'Override the target file.')
    .option('-sout, --skipout', 'Skip out-of-stock products.')
    .action((source, target, options) => {
        Promise.resolve().then(() => translator.toSFCC(source, target, options))
            .then(({ recordsCount, inventoriesCount }) => {
                console.info(`End process: ${recordsCount} records translated from ${inventoriesCount} inventories.`)
                process.exit(0)
            })
            .catch(e => {
                console.error(e)
                process.exit(-1)
            })
    })

// parse CLI arguments
program.parse(process.argv)

// output help message if no arguments provided
if (!process.argv.slice(2).length) {
    program.help()
}
