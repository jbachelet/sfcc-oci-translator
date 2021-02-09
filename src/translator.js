'use strict'

const fs = require('fs')
const XmlStream = require('xml-stream')
const { v4: uuidv4 } = require('uuid')
const lineReader = require('line-reader')
const XmlWriter = require('xml-writer')

const ENCODING = 'UTF-8'


/**
 * Translates an SFCC inventory file into an OCI inventory file ready to be importer into OCI
 *
 * @param {String} source The SFCC inventory source file
 * @param {String} target The path where to store the generated file
 * @param {Object} options The options of the command line
 */
module.exports.toOCI = (source, target, options) => new Promise((resolve, reject) => {
    if (!fs.existsSync(source)) {
        reject(`The source file "${source}" does not exist. Abort...`)
        return
    }

    if (fs.existsSync(target) && !options.override) {
        reject(`The target file "${target}" exists. Abort...`)
        return
    }

    const importMode = options.mode || 'UPDATE'
    const safetyStock = options.safetyStock || 0
    let recordsCount = 0
    let inventoriesCount = 0

    // Open the source file
    const readStream = fs.createReadStream(source)
    const xmlStream = new XmlStream(readStream)

    // Open the target file
    const writeStream = fs.createWriteStream(target)

    // Write the inventory list header
    xmlStream.on('endElement: header', header => {
        const locationHeader = {
            location: header.$['list-id'],
            mode: importMode
        }
        writeStream.write(`${JSON.stringify(locationHeader)}\n`, ENCODING)
        inventoriesCount++

        if (process.env.DEBUG) {
            console.debug(`Inventory header "${header.$['list-id']}" written`)
        }
    })

    // Write the inventory record
    xmlStream.on('endElement: record', record => {
        const availabilityRecord = {
            recordId: uuidv4(),
            onHand: parseInt(record.allocation, 10),
            sku: record.$['product-id'],
            effectiveDate: record['allocation-timestamp'],
            safetyStockCount: safetyStock
        }

        if (record['preorder-backorder-handling'] && record['preorder-backorder-handling'] !== 'none') {
            availabilityRecord.futures = [{
                quantity: parseInt(record['preorder-backorder-allocation'], 10),
                expectedDate: record['in-stock-datetime']
            }]
        }

        writeStream.write(`${JSON.stringify(availabilityRecord)}\n`, ENCODING)
        recordsCount++

        if (process.env.DEBUG) {
            console.debug(`Inventory record "${record.$['product-id']}" written`)
        }
    })

    xmlStream.on('end', () => {
        writeStream.end()
        resolve({
            recordsCount,
            inventoriesCount
        })
    })
})
/**
 * Translates an OCI inventory file into an SFCC inventory file ready to be importer into SFCC
 *
 * @param {String} source The OCI inventory source file
 * @param {String} target The path where to store the generated file
 * @param {Object} options The options of the command line
 */
module.exports.toSFCC = (source, target, options) => new Promise((resolve, reject) => {
    if (!fs.existsSync(source)) {
        reject(`The source file "${source}" does not exist. Abort...`)
        return
    }

    if (fs.existsSync(target) && !options.override) {
        reject(`The target file "${target}" exists. Abort...`)
        return
    }

    let recordsCount = 0
    let inventoriesCount = 0
    let inventoryListOpened = false

    // Open the target file
    const writeStream = fs.createWriteStream(target)
    // Writer the header in the target file
    const xmlWriterStream = new XmlWriter(true, (string, encoding) => {
        writeStream.write(string, encoding)
    })
    xmlWriterStream
        .startDocument('1.0', ENCODING)
        .startElement('inventory').writeAttribute('xmlns', 'http://www.demandware.com/xml/impex/inventory/2007-05-31')

    // Open the source file, and for each line of it
    lineReader.eachLine(source, (line, last) => {
        try {
            if (line.length > 0) {
                const parsedLine = JSON.parse(line)

                if (parsedLine.groupId || parsedLine.locationId) { // On header
                    if (inventoryListOpened) {
                        // Close the records and inventory-list XML nodes in case one was previously opened
                        xmlWriterStream
                            .endElement()
                            .endElement()
                    }

                    const headerId = parsedLine.groupId || parsedLine.locationId
                    const isByGroup = parsedLine.groupId !== undefined

                    // Open the inventory-list XML node
                    xmlWriterStream.startElement('inventory-list')
                    // Write the header
                    xmlWriterStream
                        .startElement('header').writeAttribute('list-id', headerId)
                            .writeElement('description', `${headerId} ${isByGroup ? 'group' : 'location'}`)
                        .endElement()
                        .startElement('records')

                    inventoryListOpened = true
                    inventoriesCount++
                } else if (parsedLine.sku) { // On record
                    xmlWriterStream
                        .startElement('record').writeAttribute('product-id', parsedLine.sku)
                            .writeElement('allocation', parsedLine.onHand)
                            .writeElement('ats', parsedLine.ato)
                            .writeElement('stock-level', parsedLine.atf)
                            .writeElement('allocation-timestamp', parsedLine.effectiveDate)
                            .writeElement('perpetual', 'false')
                            .writeElement('preorder-backorder-handling', parsedLine.futures && parsedLine.futures.length === 0 ? 'none' : 'backorder')

                    if (parsedLine.futures && parsedLine.futures.length > 0) {
                        // Sum-up the quantities of all futures
                        const futureAllocation = parsedLine.futures.reduce((acc, future) => acc + future.quantity, 0)
                        xmlWriterStream
                            .writeElement('preorder-backorder-allocation', futureAllocation)
                            .writeElement('in-stock-datetime', parsedLine.futures[0].expectedDate)
                    }

                    xmlWriterStream.endElement() // Close record XML node

                    recordsCount++
                }
            }

            if (last) {
                if (inventoryListOpened) {
                    // Close the records and inventory-list XML nodes in case one was previously opened
                    xmlWriterStream
                        .endElement()
                        .endElement()
                }
                // Close the inventory element
                xmlWriterStream.endElement().endDocument()
                writeStream.end()

                writeStream.on('close', () => {
                    resolve({
                        recordsCount,
                        inventoriesCount
                    })
                });
            }
        } catch (e) {
            reject(e)
            return
        }
    })
})