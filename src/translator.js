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

    // The mode is assumed to be UPDATE since it's currently the only mode supported.
    // const importMode = options.mode || 'UPDATE'

    const safetyStock = options.safetyStock || 0
    const skipOutOfStockProducts = options.skipout || false
    let recordsCount = 0
    let inventoriesCount = 0
    let locationId = null

    // create a sku map for high-performance file layout
    // in order to realize the performance improvement, the file must be constructed
    // such that the SKUs are grouped together
    const skuMap = new Map()

    // Open the source file
    const readStream = fs.createReadStream(source)
    const xmlStream = new XmlStream(readStream)

    // Open the target file
    const writeStream = fs.createWriteStream(target)

    // set the location ID
    xmlStream.on('endElement: header', header => {
        locationId = header.$['list-id'] || null;
        inventoriesCount++

        if (process.env.DEBUG) {
            console.debug(`Inventory location ID: "${locationId}"`)
        }
    })

    // Write the inventory record
    xmlStream.on('endElement: record', record => {
        if (!locationId) {
            reject(`The "locationId" could not be derived from the SFCC inventory list. Abort...`)
            return
        }

        if (!record.allocation) {
            if (process.env.DEBUG) {
                console.debug(`Inventory record "${record.$['product-id']}" skipped because of undefined allocation.`)
            }
            return
        }

        if (skipOutOfStockProducts && parseInt(record.allocation, 10) === 0) {
            if (process.env.DEBUG) {
                console.debug(`Inventory record "${record.$['product-id']}" skipped because of 0 allocation.`)
            }
            return
        }

        let sku = record.$['product-id']
        let availabilityRecords = skuMap.get(sku) || [];

        const availabilityRecord = {
            recordId: uuidv4(),
            onHand: parseInt(record.allocation, 10),
            sku: sku,
            effectiveDate: record['allocation-timestamp'] || new Date().toISOString(), // Set current date time as default value
            safetyStockCount: safetyStock,
            locationId: locationId
        }

        if (record['preorder-backorder-handling'] && record['preorder-backorder-handling'] !== 'none') {
            let expectedDate = record['in-stock-datetime']
            if (!expectedDate && record['in-stock-date']) {
                expectedDate = new Date(record['in-stock-date']).toISOString()
            }

            availabilityRecord.futures = [{
                quantity: parseInt(record['preorder-backorder-allocation'], 10),
                expectedDate: expectedDate
            }]
        }

        availabilityRecords.push(availabilityRecord);
        skuMap.set(sku, availabilityRecords);
        recordsCount++
    })

    xmlStream.on('end',  () => {
        if (skuMap.size > 0) {
            for (let records of skuMap.values()) {
                records.forEach((record) => {
                    writeStream.write(`${JSON.stringify(record)}\n`, ENCODING)

                    if (process.env.DEBUG) {
                        console.debug(`Inventory record "${record.sku}" for locationId "${locationId}" written.`)
                    }
                });
            }
        }
        writeStream.end()
    })

    writeStream.on('finish', () => {
        resolve({
            recordsCount,
            inventoriesCount
        })
    });
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
    const skipOutOfStockProducts = options.skipout || false

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
                    if (!parsedLine.onHand) {
                        if (process.env.DEBUG) {
                            console.debug(`Inventory record "${parsedLine.sku}" skipped because of undefined allocation.`)
                        }
                        return
                    }

                    if (skipOutOfStockProducts && parsedLine.onHand === 0) {
                        if (process.env.DEBUG) {
                            console.debug(`Inventory record "${parsedLine.sku}" skipped because of 0 allocation.`)
                        }
                        return
                    }

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

                    if (process.env.DEBUG) {
                        console.debug(`Inventory record "${parsedLine.sku}" written.`)
                    }
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
