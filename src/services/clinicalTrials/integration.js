import axios from 'axios';
import fs from 'fs';
import AdmZip from 'adm-zip';

const NEW_JSON_ENDPOINT = 'https://clinicaltrials.gov/api/v2/studies/download?format=json.zip';
const LEGACY_XML_ENDPOINT = 'https://clinicaltrials.gov/api/legacy/public-xml?format=zip';

// Download JSON Data
export async function downloadAndExtractJSON() {
    try {
        const response = await axios.get(NEW_JSON_ENDPOINT, { responseType: 'arraybuffer' });

        const zipBuffer = Buffer.from(response.data);
        const zip = new AdmZip(zipBuffer);

        const outputDir = './data/json';
        zip.extractAllTo(outputDir, true);

    } catch (error) {
    }
}

// Download XML Data (Legacy)
export async function downloadAndExtractXML() {
    try {
        const response = await axios.get(LEGACY_XML_ENDPOINT, { responseType: 'arraybuffer' });

        const zipBuffer = Buffer.from(response.data);
        const zip = new AdmZip(zipBuffer);

        const outputDir = './data/xml';
        zip.extractAllTo(outputDir, true);

    } catch (error) {
    }
}