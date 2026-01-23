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
 * Safely get string from a directory record dataSet
 * @param {Object} ds - dataSet (sequence item)
 * @param {string} tag - DICOM tag
 * @returns {string|null}
 */
function getString(ds, tag) {
  try {
    const el = ds.elements[tag];
    if (!el || el.length === 0) return null;
    const s = ds.string(tag);
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

      const recordType = (getString(ds, TAGS.DIRECTORY_RECORD_TYPE) || '').toUpperCase();

      switch (recordType) {
        case RECORD_TYPES.PATIENT: {
          curStudy = null;
          curSeries = null;
          curPatient = {
            patientId: getString(ds, TAGS.PATIENT_ID),
            patientName: getString(ds, TAGS.PATIENT_NAME),
            patientBirthDate: getString(ds, TAGS.PATIENT_BIRTH_DATE),
            patientSex: getString(ds, TAGS.PATIENT_SEX),
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
            studyInstanceUID: getString(ds, TAGS.STUDY_INSTANCE_UID),
            studyDate: getString(ds, TAGS.STUDY_DATE),
            studyTime: getString(ds, TAGS.STUDY_TIME),
            studyDescription: getString(ds, TAGS.STUDY_DESCRIPTION),
            studyID: getString(ds, TAGS.STUDY_ID),
            accessionNumber: getString(ds, TAGS.ACCESSION_NUMBER),
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
            seriesInstanceUID: getString(ds, TAGS.SERIES_INSTANCE_UID),
            seriesNumber: getString(ds, TAGS.SERIES_NUMBER),
            seriesDescription: getString(ds, TAGS.SERIES_DESCRIPTION),
            modality: getString(ds, TAGS.MODALITY),
            bodyPartExamined: getString(ds, TAGS.BODY_PART_EXAMINED),
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
            instanceNumber: getString(ds, TAGS.INSTANCE_NUMBER),
            sliceLocation: getString(ds, TAGS.SLICE_LOCATION),
            sopInstanceUID: getString(ds, TAGS.REFERENCED_SOP_INSTANCE_UID),
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
            },
            series: {
              seriesInstanceUID: r.seriesInstanceUID,
              seriesNumber: r.seriesNumber,
              seriesDescription: r.seriesDescription,
              modality: r.modality,
              bodyPartExamined: r.bodyPartExamined,
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
