/**
 * Backup Export Service
 *
 * Exports all user health data to a JSON backup file.
 * Optionally includes document files in a ZIP archive.
 * Used for Google Drive backup and local download.
 */

import JSZip from 'jszip';
import {
  labService,
  vitalService,
  medicationService,
  medicationLogService,
  symptomService,
  journalNoteService,
  documentService,
  genomicProfileService,
  emergencyContactService,
  patientService
} from '../firebase/services';

/**
 * Convert Firestore data to JSON-serializable format (dates to ISO strings)
 */
function serializeForExport(obj) {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) return obj.map(serializeForExport);
  if (typeof obj === 'object' && obj.toDate && typeof obj.toDate === 'function') {
    return obj.toDate().toISOString();
  }
  if (typeof obj === 'object') {
    const result = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = serializeForExport(v);
    }
    return result;
  }
  return obj;
}

/**
 * Safe filename for documents folder (avoid path traversal, special chars)
 */
function safeDocumentFilename(doc) {
  const name = doc.name || doc.fileName || doc.id || 'document';
  const ext = name.includes('.') ? name.substring(name.lastIndexOf('.')) : '';
  const base = name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
  return `${doc.id}_${base}${ext}`;
}

/**
 * Export all user data for backup
 * @param {string} userId - Patient/user ID
 * @returns {Promise<Object>} Backup data object
 */
export async function exportUserBackup(userId) {
  const [
    labs,
    vitals,
    medications,
    medicationLogs,
    symptoms,
    journalNotes,
    documents,
    genomicProfile,
    patientProfile
  ] = await Promise.all([
    labService.getLabs(userId),
    vitalService.getVitals(userId),
    medicationService.getMedications(userId),
    medicationLogService.getMedicationLogs(userId),
    symptomService.getSymptoms(userId),
    journalNoteService.getJournalNotes(userId),
    documentService.getDocuments(userId),
    genomicProfileService.getGenomicProfile(userId),
    patientService.getPatient(userId)
  ]);

  // Load lab values for each lab
  const labsWithValues = await Promise.all(
    labs.map(async (lab) => {
      const values = await labService.getLabValues(lab.id);
      return { ...lab, values: values || [] };
    })
  );

  // Load vital values for each vital
  const vitalsWithValues = await Promise.all(
    vitals.map(async (vital) => {
      const values = await vitalService.getVitalValues(vital.id);
      return { ...vital, values: values || [] };
    })
  );

  // Load emergency contacts
  let emergencyContacts = [];
  try {
    emergencyContacts = await emergencyContactService.getEmergencyContacts(userId) || [];
  } catch {
    // Ignore if no contacts
  }

  const backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    app: 'CancerCare',
    data: {
      patientProfile: patientProfile || null,
      labs: labsWithValues,
      vitals: vitalsWithValues,
      medications,
      medicationLogs,
      symptoms,
      journalNotes,
      documents,
      genomicProfile: genomicProfile || null,
      emergencyContacts
    }
  };

  return serializeForExport(backup);
}

/**
 * Download a document file for backup.
 * Uses proxy first (avoids CORS) when storagePath is available; otherwise tries fetch.
 * @param {Object} doc - Document with fileUrl and optionally storagePath
 * @param {string} userId - User ID
 * @returns {Promise<Blob|null>} Blob or null if download failed
 */
async function downloadDocumentForBackup(doc, userId) {
  if (!doc.fileUrl) return null;

  // 1. Use proxy first when we have storagePath - avoids CORS (proxy fetches server-side)
  if (doc.storagePath) {
    try {
      const { downloadFileAsBlob } = await import('../firebase/storage');
      return await downloadFileAsBlob(doc.storagePath, doc.fileUrl, userId, doc.id, false);
    } catch {
      // Proxy not running or other error
    }
  }

  // 2. Fallback: try fetch (works in production when Firebase CORS allows the deployed domain)
  try {
    const res = await fetch(doc.fileUrl, { mode: 'cors' });
    if (res.ok) return await res.blob();
  } catch {
    // CORS or network error
  }

  return null;
}

/**
 * Create a ZIP backup including document files
 * @param {string} userId - Patient/user ID
 * @returns {Promise<{zip: Blob, documentsIncluded: number, documentsSkipped: number}>}
 */
export async function createBackupZip(userId) {
  const backup = await exportUserBackup(userId);
  const zip = new JSZip();

  // Add backup.json
  zip.file('backup.json', JSON.stringify(backup, null, 2));

  // Add document files
  const documents = backup?.data?.documents || [];
  const docsWithFiles = documents.filter((d) => d.storagePath || d.fileUrl);
  let documentsIncluded = 0;
  let documentsSkipped = 0;

  for (const doc of docsWithFiles) {
    try {
      const blob = await downloadDocumentForBackup(doc, userId);
      if (blob) {
        const filename = safeDocumentFilename(doc);
        zip.file(`documents/${filename}`, blob);
        documentsIncluded++;
      } else {
        documentsSkipped++;
      }
    } catch (err) {
      documentsSkipped++;
      console.warn(`[Backup] Could not include document ${doc.id}:`, err.message);
    }
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  return { zip: zipBlob, documentsIncluded, documentsSkipped };
}

/**
 * Create a downloadable backup file
 * @param {string} userId - Patient/user ID
 * @param {Object} options - { includeDocuments?: boolean, filename?: string }
 * @returns {Promise<{documentsIncluded?: number, documentsSkipped?: number}>} Counts when includeDocuments is true
 */
export async function downloadBackup(userId, options = {}) {
  const { includeDocuments = false, filename = null } = typeof options === 'string' ? { filename: options } : options;

  if (includeDocuments) {
    const { zip: zipBlob, documentsIncluded, documentsSkipped } = await createBackupZip(userId);
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `CancerCare-backup-${new Date().toISOString().slice(0, 10)}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return { documentsIncluded, documentsSkipped };
  } else {
    const backup = await exportUserBackup(userId);
    const json = JSON.stringify(backup, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `CancerCare-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return {};
  }
}
