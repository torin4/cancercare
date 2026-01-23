/**
 * DICOM Service
 * 
 * Handles DICOM file metadata extraction using dicom-parser
 * Supports Japanese character encoding (ISO 2022 IR 87) via dicom-character-set
 */

import dicomParser from 'dicom-parser';
import { convertBytes } from 'dicom-character-set';

/**
 * Extract metadata from a DICOM file
 * @param {File|ArrayBuffer} file - DICOM file or ArrayBuffer
 * @returns {Promise<Object>} - Extracted DICOM metadata
 */
export async function extractDicomMetadata(file) {
  try {
    // Convert File to ArrayBuffer if needed
    let arrayBuffer;
    if (file instanceof File) {
      arrayBuffer = await file.arrayBuffer();
    } else if (file instanceof ArrayBuffer) {
      arrayBuffer = file;
    } else {
      throw new Error('Invalid file type. Expected File or ArrayBuffer.');
    }

    // Parse DICOM file
    const byteArray = new Uint8Array(arrayBuffer);
    const dataSet = dicomParser.parseDicom(byteArray);

    // Check for Specific Character Set tag (0008,0005) to detect Japanese encoding
    // Get this first without Japanese encoding check (to avoid circular dependency)
    const specificCharacterSetRaw = dataSet.string('x00080005') || '';
    const specificCharacterSet = specificCharacterSetRaw.trim() || '';
    const hasJapaneseEncoding = specificCharacterSet.includes('ISO 2022 IR 87') || 
                                specificCharacterSet.includes('ISO_IR 87') ||
                                specificCharacterSet.includes('ISO\\2022\\IR 87') ||
                                specificCharacterSet.includes('ISO_2022_IR_87');

    // Extract standard DICOM tags (pass hasJapaneseEncoding and characterSet for proper decoding)
    const metadata = {
      // Patient Information
      patientId: getTagValue(dataSet, 'x00100020', hasJapaneseEncoding, specificCharacterSet) || null,
      patientName: getTagValue(dataSet, 'x00100010', hasJapaneseEncoding, specificCharacterSet) || null,
      patientBirthDate: getTagValue(dataSet, 'x00100030', hasJapaneseEncoding, specificCharacterSet) || null,
      patientSex: getTagValue(dataSet, 'x00100040', hasJapaneseEncoding, specificCharacterSet) || null,
      patientAge: getTagValue(dataSet, 'x00101010', hasJapaneseEncoding, specificCharacterSet) || null,

      // Study Information
      studyInstanceUID: getTagValue(dataSet, 'x0020000d', hasJapaneseEncoding, specificCharacterSet) || null,
      studyDate: getTagValue(dataSet, 'x00080020', hasJapaneseEncoding, specificCharacterSet) || null,
      studyTime: getTagValue(dataSet, 'x00080030', hasJapaneseEncoding, specificCharacterSet) || null,
      studyDescription: getTagValue(dataSet, 'x00081030', hasJapaneseEncoding, specificCharacterSet) || null,
      studyID: getTagValue(dataSet, 'x00200010', hasJapaneseEncoding, specificCharacterSet) || null,
      accessionNumber: getTagValue(dataSet, 'x00080050', hasJapaneseEncoding, specificCharacterSet) || null,

      // Series Information
      seriesInstanceUID: getTagValue(dataSet, 'x0020000e', hasJapaneseEncoding, specificCharacterSet) || null,
      seriesNumber: getTagValue(dataSet, 'x00200011', hasJapaneseEncoding, specificCharacterSet) || null,
      seriesDescription: getTagValue(dataSet, 'x0008103e', hasJapaneseEncoding, specificCharacterSet) || null,
      modality: getTagValue(dataSet, 'x00080060', hasJapaneseEncoding, specificCharacterSet) || null,
      bodyPartExamined: getTagValue(dataSet, 'x00180015', hasJapaneseEncoding, specificCharacterSet) || null,

      // Image Information
      instanceNumber: getTagValue(dataSet, 'x00200013', hasJapaneseEncoding, specificCharacterSet) || null,
      numberOfFrames: getTagValue(dataSet, 'x00280008', hasJapaneseEncoding, specificCharacterSet) || '1',
      rows: getTagValue(dataSet, 'x00280010', hasJapaneseEncoding, specificCharacterSet) || null,
      columns: getTagValue(dataSet, 'x00280011', hasJapaneseEncoding, specificCharacterSet) || null,
      bitsAllocated: getTagValue(dataSet, 'x00280100', hasJapaneseEncoding, specificCharacterSet) || null,
      bitsStored: getTagValue(dataSet, 'x00280101', hasJapaneseEncoding, specificCharacterSet) || null,
      pixelSpacing: getTagValue(dataSet, 'x00280030', hasJapaneseEncoding, specificCharacterSet) || null,
      sliceThickness: getTagValue(dataSet, 'x00180050', hasJapaneseEncoding, specificCharacterSet) || null,

      // Institution and Equipment
      institutionName: getTagValue(dataSet, 'x00080080', hasJapaneseEncoding, specificCharacterSet) || null,
      manufacturer: getTagValue(dataSet, 'x00080070', hasJapaneseEncoding, specificCharacterSet) || null,
      manufacturerModelName: getTagValue(dataSet, 'x00081090', hasJapaneseEncoding, specificCharacterSet) || null,
      stationName: getTagValue(dataSet, 'x00081010', hasJapaneseEncoding, specificCharacterSet) || null,

      // Referring Physician
      referringPhysicianName: getTagValue(dataSet, 'x00080090', hasJapaneseEncoding, specificCharacterSet) || null,

      // Additional metadata
      patientPosition: getTagValue(dataSet, 'x00185100', hasJapaneseEncoding, specificCharacterSet) || null,
      contrastBolusAgent: getTagValue(dataSet, 'x00180010', hasJapaneseEncoding, specificCharacterSet) || null,
      kvp: getTagValue(dataSet, 'x00180060', hasJapaneseEncoding, specificCharacterSet) || null,
      exposureTime: getTagValue(dataSet, 'x00181150', hasJapaneseEncoding, specificCharacterSet) || null,
      
      // Store character set info for reference
      specificCharacterSet: specificCharacterSet || null,
    };

    // Format dates if present
    if (metadata.studyDate) {
      metadata.studyDateFormatted = formatDicomDate(metadata.studyDate);
    }
    if (metadata.patientBirthDate) {
      metadata.patientBirthDateFormatted = formatDicomDate(metadata.patientBirthDate);
    }

    return {
      success: true,
      metadata
    };
  } catch (error) {
    console.error('Error extracting DICOM metadata:', error);
    return {
      success: false,
      error: error.message || 'Failed to extract DICOM metadata',
      metadata: null
    };
  }
}

/**
 * Decode DICOM text using proper character set encoding
 * Uses dicom-character-set library for ISO 2022 IR 87 (Japanese) and other encodings
 * @param {Object} dataSet - Parsed DICOM data set
 * @param {string} tag - DICOM tag in format 'xggggeeee'
 * @param {string} characterSet - Character set string from DICOM (e.g., 'ISO 2022 IR 87')
 * @param {string} vr - Value Representation (e.g., 'PN', 'LO', 'SH', 'LT')
 * @returns {string|null} - Decoded string or null if not found
 */
function decodeDicomText(dataSet, tag, characterSet, vr = 'LO') {
  try {
    const element = dataSet.elements[tag];
    if (!element) {
      return null;
    }

    // Get raw bytes for this tag
    const rawBytes = dataSet.byteArray.subarray(element.dataOffset, element.dataOffset + element.length);
    
    // Use dicom-character-set library to properly decode
    try {
      const decoded = convertBytes(characterSet, rawBytes, { vr });
      return decoded && decoded.trim() ? decoded.trim() : null;
    } catch (decodeError) {
      console.warn(`Failed to decode with dicom-character-set for tag ${tag}:`, decodeError);
      // Fallback to default string() method
      const value = dataSet.string(tag);
      return value && value.trim() ? value.trim() : null;
    }
  } catch (error) {
    console.warn(`Error decoding DICOM text for tag ${tag}:`, error);
    return null;
  }
}

/**
 * Get DICOM tag value safely with proper character encoding support
 * @param {Object} dataSet - Parsed DICOM data set
 * @param {string} tag - DICOM tag in format 'xggggeeee'
 * @param {boolean} hasJapaneseEncoding - Whether the file uses Japanese encoding
 * @param {string} specificCharacterSet - Character set string from DICOM (e.g., 'ISO 2022 IR 87')
 * @returns {string|null} - Tag value or null if not found
 */
function getTagValue(dataSet, tag, hasJapaneseEncoding = false, specificCharacterSet = '') {
  try {
    const element = dataSet.elements[tag];
    if (!element) {
      return null;
    }

    // Handle different VR (Value Representation) types
    if (element.vr === 'SQ') {
      // Sequence - return null for now
      return null;
    } else {
      // For most types, use string() method
      // This works for PN (Person Name), DA (Date), TM (Time), DS (Decimal String), IS (Integer String), etc.
      let value = dataSet.string(tag);
      
      // If we have Japanese encoding, use dicom-character-set library for proper decoding
      if (hasJapaneseEncoding && value) {
        // Check if value looks corrupted (contains mojibake patterns)
        const mojibakePattern = /[\x00-\x1F][$B\(\)]|\\x1B|[$B\(\)]/;
        if (mojibakePattern.test(value) || value.includes('$B') || value.includes('(J') || value.includes('\\x1B')) {
          try {
            // Use dicom-character-set library to properly decode
            const decoded = decodeDicomText(dataSet, tag, specificCharacterSet, element.vr || 'LO');
            if (decoded && decoded.trim().length > 0 && decoded !== value) {
              console.log(`Successfully decoded Japanese text for tag ${tag}: "${value}" -> "${decoded}"`);
              value = decoded;
            }
          } catch (decodeError) {
            console.warn(`Failed to decode Japanese text for tag ${tag} with dicom-character-set:`, decodeError);
            // Keep original value as fallback
          }
        }
      }
      
      return value && value.trim() ? value.trim() : null;
    }
  } catch (error) {
    // Tag not found or error reading - return null
    return null;
  }
}

/**
 * Format DICOM date from YYYYMMDD to YYYY-MM-DD
 * @param {string} dicomDate - DICOM date string (YYYYMMDD)
 * @returns {string} - Formatted date (YYYY-MM-DD)
 */
function formatDicomDate(dicomDate) {
  if (!dicomDate || dicomDate.length !== 8) {
    return dicomDate;
  }
  return `${dicomDate.substring(0, 4)}-${dicomDate.substring(4, 6)}-${dicomDate.substring(6, 8)}`;
}

/**
 * Check if a file is a DICOM file by reading its header
 * DICOM files start with a 128-byte preamble followed by "DICM"
 * @param {File} file - File to check
 * @returns {Promise<boolean>} - True if file appears to be DICOM
 */
export async function isDicomFile(file) {
  if (!file) return false;
  
  const fileName = file.name || '';
  const lowerName = fileName.toLowerCase();
  
  // Check extension first (fast path)
  if (lowerName.endsWith('.dcm') || lowerName.endsWith('.dicom')) {
    return true;
  }
  
  // Check MIME type
  if (file.type === 'application/dicom' || file.type === 'application/x-dicom') {
    return true;
  }
  
  // Check file header for DICOM signature
  // DICOM files have a 128-byte preamble followed by "DICM" (4 bytes)
  try {
    const arrayBuffer = await file.slice(0, 132).arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Check for DICOM signature at offset 128: "DICM"
    if (uint8Array.length >= 132) {
      const dicomSignature = String.fromCharCode(
        uint8Array[128],
        uint8Array[129],
        uint8Array[130],
        uint8Array[131]
      );
      
      if (dicomSignature === 'DICM') {
        return true;
      }
    }
  } catch (error) {
    // If we can't read the header, fall back to false
    console.warn('Could not read file header to check DICOM signature:', error);
  }
  
  return false;
}

/**
 * Synchronous check for DICOM file (for quick filtering)
 * Uses extension and MIME type only - use isDicomFile() for definitive check
 * @param {File} file - File to check
 * @returns {boolean} - True if file might be DICOM
 */
export function mightBeDicomFile(file) {
  if (!file) return false;
  
  const fileName = file.name || '';
  const lowerName = fileName.toLowerCase();
  
  // Check extension
  if (lowerName.endsWith('.dcm') || lowerName.endsWith('.dicom')) {
    return true;
  }
  
  // Check MIME type
  if (file.type === 'application/dicom' || file.type === 'application/x-dicom') {
    return true;
  }
  
  // Check if file is in a DICOM-related folder (heuristic)
  // Files without extensions in folders named DCMDT, DICOM, etc. might be DICOM
  if (!fileName.includes('.')) {
    // No extension - could be DICOM, but we'll need to check header
    return null; // Return null to indicate "maybe, check header"
  }
  
  return false;
}
