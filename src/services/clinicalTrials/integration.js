import axios from 'axios';
import fs from 'fs';
import AdmZip from 'adm-zip';

const NEW_JSON_ENDPOINT = 'https://clinicaltrials.gov/api/v2/studies/download?format=json.zip';
const LEGACY_XML_ENDPOINT = 'https://clinicaltrials.gov/api/legacy/public-xml?format=zip';

// Download JSON Data
export async function downloadAndExtractJSON() {
    try {
        console.log('Downloading JSON format data...');
        const response = await axios.get(NEW_JSON_ENDPOINT, { responseType: 'arraybuffer' });

        const zipBuffer = Buffer.from(response.data);
        const zip = new AdmZip(zipBuffer);

        console.log('Extracting files...');
        const outputDir = './data/json';
        zip.extractAllTo(outputDir, true);

        console.log(`Extracted JSON files to ${outputDir}`);
    } catch (error) {
        console.error('Failed to download or extract JSON:', error);
    }
}

// Download XML Data (Legacy)
export async function downloadAndExtractXML() {
    try {
        console.log('Downloading XML format data...');
        const response = await axios.get(LEGACY_XML_ENDPOINT, { responseType: 'arraybuffer' });

        const zipBuffer = Buffer.from(response.data);
        const zip = new AdmZip(zipBuffer);

        console.log('Extracting files...');
        const outputDir = './data/xml';
        zip.extractAllTo(outputDir, true);

        console.log(`Extracted XML files to ${outputDir}`);
    } catch (error) {
        console.error('Failed to download or extract XML:', error);
    }
}