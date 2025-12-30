import fs from 'fs';
import path from 'path';
import { XMLParser, XMLValidator } from 'fast-xml-parser';

const PUBLIC_XSD_SCHEMA = path.resolve('./public.xsd');

export function validateXML(xmlString) {
    // Basic validation if XML structure is correct
    const isValid = XMLValidator.validate(xmlString);
    if (isValid !== true) {
        throw new Error('Invalid XML format');
    }
    // For strict XSD validation, additional libraries and setups are needed
    // This example limits to basic validation and schema-based validation could be added.
}

export function parseClinicalTrialXML(xmlString) {
    const options = {
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        parseNodeValue: true,
        parseAttributeValue: true,
        trimValues: true
    };

    const parser = new XMLParser(options);
    const jsonObj = parser.parse(xmlString);

    return jsonObj;
}

// Example: Load XML file and parse
export function loadAndParseXMLFile(filePath) {
    const xmlData = fs.readFileSync(filePath, 'utf-8');
    validateXML(xmlData);
    return parseClinicalTrialXML(xmlData);
}
