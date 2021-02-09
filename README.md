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
node cli.js tooci "/path/to/sfcc/inventorylist.xml" "/path/to/oci/availabilityrecords.json"
# after an npm link
sfcc-oci-translator tooci "/path/to/sfcc/inventorylist.xml" "/path/to/oci/availabilityrecords.json"
# override the target file if it exists
sfcc-oci-translator tooci "/path/to/sfcc/inventorylist.xml" "/path/to/oci/availabilityrecords.json" --override
# apply a safety stock of 10 quantities to all the translated records
sfcc-oci-translator tooci "/path/to/sfcc/inventorylist.xml" "/path/to/oci/availabilityrecords.json" --safety 10
# apply an import mode (OCI only accepts UPDATE when writing this, which is the default value of the option)
sfcc-oci-translator tooci "/path/to/sfcc/inventorylist.xml" "/path/to/oci/availabilityrecords.json" --mode "UPDATE"
```

## OCI to B2C Commerce

In order to migrate your OCI availability records exports into a B2C Commerce inventory list file, please run the following command. Please note that the script automatically understands if you exported location groups, or locations:

```bash
# prior to an npm link
node cli.js tosfcc "/path/to/oci/availabilityrecords.json" "/path/to/sfcc/inventorylist.xml"
# override the target file if it exists
sfcc-oci-translator tosfcc "/path/to/oci/availabilityrecords.json" "/path/to/sfcc/inventorylist.xml" --override
```

# Change log

## 0.0.1

Introduce the tool with the following commands:
1. `tooci`: which allows to translate a B2C Commerce file into an OCI file (-o, -s, -m options)
2. `tosfcc`: which allows to translate an OCI file into a B2C Commerce file (-o option)