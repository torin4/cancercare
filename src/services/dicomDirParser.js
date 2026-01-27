/**
 * DICOMDIR Parser Service
 *
 * Parses DICOMDIR files to extract the hierarchical structure:
 * Patient → Study → Series → Image
 *
 * DICOMDIR is a special DICOM file that indexes a collection of DICOM files,
 * providing study/series organization and file paths.
 */

import dicomParser from 'dicom-parser';
import { convertBytes } from 'dicom-character-set';

/** DICOM tags */
const TAGS = {
  DIRECTORY_RECORD_SEQUENCE: 'x00041220',
  DIRECTORY_RECORD_TYPE: 'x00041430',
  REFERENCED_FILE_ID: 'x00041500',
  REFERENCED_SOP_INSTANCE_UID: 'x00041511',
  // Patient
  PATIENT_ID: 'x00100020',
  PATIENT_NAME: 'x00100010',
  PATIENT_BIRTH_DATE: 'x00100030',
  PATIENT_SEX: 'x00100040',
  // Study
  STUDY_INSTANCE_UID: 'x0020000d',
  STUDY_DATE: 'x00080020',
  STUDY_TIME: 'x00080030',
  STUDY_DESCRIPTION: 'x00081030',
  STUDY_ID: 'x00200010',
  ACCESSION_NUMBER: 'x00080050',
  // Series
  SERIES_INSTANCE_UID: 'x0020000e',
  SERIES_NUMBER: 'x00200011',
  SERIES_DESCRIPTION: 'x0008103e',
  MODALITY: 'x00080060',
  BODY_PART_EXAMINED: 'x00180015',
  SERIES_DATE: 'x00080021',
  SERIES_TIME: 'x00080031',
  // Institution (may be at study or series level)
  INSTITUTION_NAME: 'x00080080',
  INSTITUTION_ADDRESS: 'x00080081',
  // Image
  INSTANCE_NUMBER: 'x00200013',
  SLICE_LOCATION: 'x00201041',
};

const RECORD_TYPES = {
  PATIENT: 'PATIENT',
  STUDY: 'STUDY',
  SERIES: 'SERIES',
  IMAGE: 'IMAGE',
};

/**
 * Decode ISO-2022-JP encoded bytes to UTF-8 string
 * Handles common escape sequences manually
 * @param {Uint8Array} bytes - raw bytes
 * @returns {string|null}
 */
function decodeISO2022JP(bytes) {
  try {
    let result = '';
    let i = 0;
    let inKanji = false;

    while (i < bytes.length) {
      // ESC $ B - Switch to JIS X 0208 (Kanji)
      if (bytes[i] === 0x1B && i + 2 < bytes.length && bytes[i + 1] === 0x24 && bytes[i + 2] === 0x42) {
        inKanji = true;
        i += 3;
        continue;
      }

      // ESC ( J - Switch to JIS X 0201 Roman
      // ESC ( I - Switch to JIS X 0201 Katakana
      // ESC ( B - Switch to ASCII
      if (bytes[i] === 0x1B && i + 2 < bytes.length && bytes[i + 1] === 0x28) {
        inKanji = false;
        i += 3;
        continue;
      }

      if (inKanji && i + 1 < bytes.length) {
        // Two-byte Kanji character
        const jisCode = ((bytes[i] & 0x7F) << 8) | (bytes[i + 1] & 0x7F);

        // Convert JIS X 0208 to Unicode
        // This is a simplified conversion - add 0x8080 to get EUC-JP, then decode
        const eucJP = new Uint8Array([bytes[i] | 0x80, bytes[i + 1] | 0x80]);
        try {
          const decoder = new TextDecoder('euc-jp');
          result += decoder.decode(eucJP);
        } catch {
          result += '??';
        }
        i += 2;
      } else {
        // ASCII character
        result += String.fromCharCode(bytes[i]);
        i++;
      }
    }

    return result;
  } catch (e) {
    console.warn('[DICOMDIR] Failed to manually decode ISO-2022-JP:', e);
    return null;
  }
}

/**
 * Safely get string from a directory record dataSet
 * @param {Object} ds - dataSet (sequence item)
 * @param {string} tag - DICOM tag
 * @returns {string|null}
 */
function getString(ds, tag, characterSet = null) {
  try {
    const el = ds.elements[tag];
    if (!el || el.length === 0) return null;

    let s = ds.string(tag);

    // If we detect Japanese encoding (ISO-2022-JP escape sequences), decode it
    // Even if character set tag is missing, try to decode based on escape sequences
    if (s && (s.includes('\x1B') || s.includes('$B') || s.includes('(J') || s.includes('(I'))) {
      try {
        // Get raw bytes for proper decoding
        const rawBytes = ds.byteArray.subarray(el.dataOffset, el.dataOffset + el.length);

        const decoded = decodeISO2022JP(rawBytes);
        if (decoded && decoded.trim() && !decoded.includes('?')) {
          s = decoded;
        }
      } catch (decodeError) {
        console.warn(`[DICOMDIR] Failed to decode Japanese text for tag ${tag}:`, decodeError);
      }
    }

    return s && typeof s === 'string' ? s.trim() || null : null;
  } catch {
    return null;
  }
}

/**
 * Get Referenced File ID as path. DICOM uses backslash; we normalize to / for ZIP.
 * @param {Object} ds - dataSet
 * @returns {string|null}
 */
function getReferencedFileIdPath(ds) {
  try {
    const n = ds.numStringValues ? ds.numStringValues(TAGS.REFERENCED_FILE_ID) : 1;
    if (!n || n < 1) return getString(ds, TAGS.REFERENCED_FILE_ID);
    const parts = [];
    for (let i = 0; i < n; i++) {
      const p = ds.string(TAGS.REFERENCED_FILE_ID, i);
      if (p != null && p.trim()) parts.push(p.trim());
    }
    if (parts.length === 0) return null;
    return parts.join('/').replace(/\\/g, '/');
  } catch {
    return getString(ds, TAGS.REFERENCED_FILE_ID);
  }
}

/**
 * Parse a DICOMDIR file and return the hierarchical structure.
 *
 * @param {ArrayBuffer|Uint8Array|File} dicomDirInput - DICOMDIR as ArrayBuffer, Uint8Array, or File
 * @returns {Promise<{ success: boolean, error?: string, structure?: Object }>}
 *
 * structure:
 * {
 *   patients: [{
 *     patientId, patientName, patientBirthDate, patientSex,
 *     studies: [{
 *       studyInstanceUID, studyDate, studyTime, studyDescription, studyID, accessionNumber,
 *       series: [{
 *         seriesInstanceUID, seriesNumber, seriesDescription, modality, bodyPartExamined,
 *         images: [{ filePath, instanceNumber, sliceLocation, sopInstanceUID }]
 *       }]
 *     }]
 *   }]
 * }
 */
export async function parseDicomDir(dicomDirInput) {
  try {
    let byteArray;
    if (dicomDirInput instanceof ArrayBuffer) {
      byteArray = new Uint8Array(dicomDirInput);
    } else if (dicomDirInput instanceof Uint8Array) {
      byteArray = dicomDirInput;
    } else if (dicomDirInput instanceof File) {
      const ab = await dicomDirInput.arrayBuffer();
      byteArray = new Uint8Array(ab);
    } else {
      throw new Error('DICOMDIR input must be ArrayBuffer, Uint8Array, or File');
    }

    const dataSet = dicomParser.parseDicom(byteArray);

    // Check for Specific Character Set (0008,0005)
    const specificCharacterSet = dataSet.string('x00080005') || '';

    const seqEl = dataSet.elements[TAGS.DIRECTORY_RECORD_SEQUENCE];
    if (!seqEl || !seqEl.items || seqEl.items.length === 0) {
      return { success: false, error: 'DICOMDIR has no Directory Record Sequence' };
    }

    const patients = [];
    let curPatient = null;
    let curStudy = null;
    let curSeries = null;

    for (let i = 0; i < seqEl.items.length; i++) {
      const item = seqEl.items[i];
      const ds = item.dataSet;
      if (!ds) continue;

      const recordType = (getString(ds, TAGS.DIRECTORY_RECORD_TYPE, specificCharacterSet) || '').toUpperCase();

      switch (recordType) {
        case RECORD_TYPES.PATIENT: {
          curStudy = null;
          curSeries = null;
          curPatient = {
            patientId: getString(ds, TAGS.PATIENT_ID, specificCharacterSet),
            patientName: getString(ds, TAGS.PATIENT_NAME, specificCharacterSet),
            patientBirthDate: getString(ds, TAGS.PATIENT_BIRTH_DATE, specificCharacterSet),
            patientSex: getString(ds, TAGS.PATIENT_SEX, specificCharacterSet),
            studies: [],
          };
          patients.push(curPatient);
          break;
        }
        case RECORD_TYPES.STUDY: {
          if (!curPatient) {
            curPatient = {
              patientId: null,
              patientName: null,
              patientBirthDate: null,
              patientSex: null,
              studies: [],
            };
            patients.push(curPatient);
          }
          curSeries = null;
          curStudy = {
            studyInstanceUID: getString(ds, TAGS.STUDY_INSTANCE_UID, specificCharacterSet),
            studyDate: getString(ds, TAGS.STUDY_DATE, specificCharacterSet),
            studyTime: getString(ds, TAGS.STUDY_TIME, specificCharacterSet),
            studyDescription: getString(ds, TAGS.STUDY_DESCRIPTION, specificCharacterSet),
            studyID: getString(ds, TAGS.STUDY_ID, specificCharacterSet),
            accessionNumber: getString(ds, TAGS.ACCESSION_NUMBER, specificCharacterSet),
            institutionName: getString(ds, TAGS.INSTITUTION_NAME, specificCharacterSet),
            institutionAddress: getString(ds, TAGS.INSTITUTION_ADDRESS, specificCharacterSet),
            series: [],
          };
          curPatient.studies.push(curStudy);
          break;
        }
        case RECORD_TYPES.SERIES: {
          if (!curStudy) {
            curStudy = {
              studyInstanceUID: null,
              studyDate: null,
              studyTime: null,
              studyDescription: null,
              studyID: null,
              accessionNumber: null,
              series: [],
            };
            if (curPatient) curPatient.studies.push(curStudy);
            else {
              curPatient = {
                patientId: null,
                patientName: null,
                patientBirthDate: null,
                patientSex: null,
                studies: [curStudy],
              };
              patients.push(curPatient);
            }
          }
          curSeries = {
            seriesInstanceUID: getString(ds, TAGS.SERIES_INSTANCE_UID, specificCharacterSet),
            seriesNumber: getString(ds, TAGS.SERIES_NUMBER, specificCharacterSet),
            seriesDescription: getString(ds, TAGS.SERIES_DESCRIPTION, specificCharacterSet),
            modality: getString(ds, TAGS.MODALITY, specificCharacterSet),
            bodyPartExamined: getString(ds, TAGS.BODY_PART_EXAMINED, specificCharacterSet),
            seriesDate: getString(ds, TAGS.SERIES_DATE, specificCharacterSet),
            seriesTime: getString(ds, TAGS.SERIES_TIME, specificCharacterSet),
            institutionName: getString(ds, TAGS.INSTITUTION_NAME, specificCharacterSet),
            images: [],
          };
          curStudy.series.push(curSeries);
          break;
        }
        case RECORD_TYPES.IMAGE: {
          const filePath = getReferencedFileIdPath(ds);
          if (!filePath) continue;
          const img = {
            filePath,
            instanceNumber: getString(ds, TAGS.INSTANCE_NUMBER, specificCharacterSet),
            sliceLocation: getString(ds, TAGS.SLICE_LOCATION, specificCharacterSet),
            sopInstanceUID: getString(ds, TAGS.REFERENCED_SOP_INSTANCE_UID, specificCharacterSet),
          };
          if (curSeries) {
            curSeries.images.push(img);
          } else if (curStudy) {
            curSeries = {
              seriesInstanceUID: null,
              seriesNumber: null,
              seriesDescription: null,
              modality: null,
              bodyPartExamined: null,
              images: [img],
            };
            curStudy.series.push(curSeries);
          } else {
            curSeries = {
              seriesInstanceUID: null,
              seriesNumber: null,
              seriesDescription: null,
              modality: null,
              bodyPartExamined: null,
              images: [img],
            };
            curStudy = {
              studyInstanceUID: null,
              studyDate: null,
              studyTime: null,
              studyDescription: null,
              studyID: null,
              accessionNumber: null,
              series: [curSeries],
            };
            if (!curPatient) {
              curPatient = {
                patientId: null,
                patientName: null,
                patientBirthDate: null,
                patientSex: null,
                studies: [curStudy],
              };
              patients.push(curPatient);
            } else {
              curPatient.studies.push(curStudy);
            }
          }
          break;
        }
        default:
          break;
      }
    }

    return {
      success: true,
      structure: { patients },
    };
  } catch (e) {
    return {
      success: false,
      error: e && e.message ? e.message : 'Failed to parse DICOMDIR',
    };
  }
}

/**
 * Flatten structure to a list of { filePath, study*, series*, ... } for matching with ZIP entries.
 * Normalizes paths to lowercase for case-insensitive matching.
 *
 * @param {Object} structure - Result of parseDicomDir
 * @returns {Array<{ filePath: string, filePathLower: string, study, series, image }>}
 */
export function flattenDicomDirStructure(structure) {
  if (!structure || !structure.patients || !Array.isArray(structure.patients)) return [];
  const out = [];
  for (const p of structure.patients) {
    for (const s of p.studies || []) {
      for (const r of s.series || []) {
        for (const img of r.images || []) {
          const fp = img.filePath;
          if (!fp) continue;
          const fpLower = fp.toLowerCase().replace(/\\/g, '/');
          out.push({
            filePath: fp,
            filePathLower: fpLower,
            study: {
              studyInstanceUID: s.studyInstanceUID,
              studyDate: s.studyDate,
              studyTime: s.studyTime,
              studyDescription: s.studyDescription,
              studyID: s.studyID,
              accessionNumber: s.accessionNumber,
              institutionName: s.institutionName,
              institutionAddress: s.institutionAddress,
            },
            series: {
              seriesInstanceUID: r.seriesInstanceUID,
              seriesNumber: r.seriesNumber,
              seriesDescription: r.seriesDescription,
              modality: r.modality,
              bodyPartExamined: r.bodyPartExamined,
              seriesDate: r.seriesDate,
              seriesTime: r.seriesTime,
              institutionName: r.institutionName,
            },
            image: {
              instanceNumber: img.instanceNumber,
              sliceLocation: img.sliceLocation,
              sopInstanceUID: img.sopInstanceUID,
            },
          });
        }
      }
    }
  }
  return out;
}
