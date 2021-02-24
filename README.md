# sfcc-oci-translator

Version 0.0.1

# Introduction

This tool is a CLI Tool that helps you to migrate Salesforce B2C Commerce Inventory List files to the Salesforce Omnichannel Inventory format, and vice-versa

# How to

You can run the `npm link` command before using this tool. This will allows you to directly run the `sfcc-oci-translator` command in your command line directly.

## B2C Commerce to OCI

In order to migrate your B2C Commerce inventory files into an OCI availability records import file, please run the following command:

```bash
# prior to an npm link
npm run tooci "/path/to/sfcc/inventorylist.xml" "/path/to/oci/availabilityrecords.json" -- --override
# after an npm link
sfcc-oci-translator tooci "/path/to/sfcc/inventorylist.xml" "/path/to/oci/availabilityrecords.json"
# override the target file if it exists
sfcc-oci-translator tooci "/path/to/sfcc/inventorylist.xml" "/path/to/oci/availabilityrecords.json" --override
# apply a safety stock of 10 quantities to all the translated records
sfcc-oci-translator tooci "/path/to/sfcc/inventorylist.xml" "/path/to/oci/availabilityrecords.json" --safety 10
# apply an import mode (OCI only accepts UPDATE when writing this, which is the default value of the option)
sfcc-oci-translator tooci "/path/to/sfcc/inventorylist.xml" "/path/to/oci/availabilityrecords.json" --mode "UPDATE"
# skip the products with a 0 allocation value
sfcc-oci-translator tooci "/path/to/sfcc/inventorylist.xml" "/path/to/oci/availabilityrecords.json" --skipout
```

## OCI to B2C Commerce

In order to migrate your OCI availability records exports into a B2C Commerce inventory list file, please run the following command. Please note that the script automatically understands if you exported location groups, or locations:

```bash
# prior to an npm link
npm run tosfcc "/path/to/oci/availabilityrecords.json" "/path/to/sfcc/inventorylist.xml" -- --override
# override the target file if it exists
sfcc-oci-translator tosfcc "/path/to/oci/availabilityrecords.json" "/path/to/sfcc/inventorylist.xml" --override
# skip the products with a 0 onHand value
sfcc-oci-translator tosfcc "/path/to/oci/availabilityrecords.json" "/path/to/sfcc/inventorylist.xml" --skipout
```

# Change log

## 0.0.1

Introduce the tool with the following commands:
1. `tooci`: which allows to translate a B2C Commerce file into an OCI file (-o, -s, -m, -sout options)
2. `tosfcc`: which allows to translate an OCI file into a B2C Commerce file (-o, -sout options)