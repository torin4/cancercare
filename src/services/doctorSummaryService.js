/**
 * Doctor Summary Service
 *
 * Exports a clinician-friendly subset of patient health data with optional
 * sections and date range filtering. Used for PDF report and JSON export.
 */

import {
  labService,
  vitalService,
  medicationService,
  medicationLogService,
  symptomService,
  journalNoteService,
  documentService,
  genomicProfileService,
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
 * Get a Date from a value (Firestore Timestamp, Date, or ISO string)
 */
function toDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (val.toDate && typeof val.toDate === 'function') return val.toDate();
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Get start/end dates for filtering
 * @param {string} dateRange - '3m'|'6m'|'12m'|'all'|'custom'
 * @param {string} [customStart] - ISO date string for custom range start
 * @param {string} [customEnd] - ISO date string for custom range end
 * @returns {{ start: Date|null, end: Date|null }} start inclusive, end inclusive; null means no bound
 */
function getDateBounds(dateRange, customStart, customEnd) {
  if (dateRange === 'all') return { start: null, end: null };
  if (dateRange === 'custom') {
    const start = customStart ? toDate(customStart) : null;
    const end = customEnd ? toDate(customEnd) : null;
    return { start, end };
  }
  const now = new Date();
  const d = new Date(now);
  if (dateRange === '3m') d.setMonth(d.getMonth() - 3);
  else if (dateRange === '6m') d.setMonth(d.getMonth() - 6);
  else if (dateRange === '12m') d.setFullYear(d.getFullYear() - 1);
  else return { start: null, end: null };
  return { start: d, end: null };
}

function inDateBounds(dateVal, bounds) {
  const d = toDate(dateVal);
  if (!d) return false;
  if (bounds.start && d < bounds.start) return false;
  if (bounds.end && d > bounds.end) return false;
  return true;
}

/**
 * Default sections: all on except journalNotes
 */
const DEFAULT_SECTIONS = {
  demographics: true,
  labs: true,
  vitals: true,
  medications: true,
  symptoms: true,
  genomic: true,
  documents: true,
  journalNotes: false
};

/**
 * Export doctor-facing summary with section and date filters
 * @param {string} userId - Patient/user ID
 * @param {Object} options
 * @param {Object} [options.sections] - Which sections to include (default: all except journalNotes)
 * @param {'3m'|'6m'|'12m'|'all'|'custom'} [options.dateRange] - Date range for time-based data (default: '6m')
 * @param {string} [options.customStart] - ISO date for custom range start (when dateRange === 'custom')
 * @param {string} [options.customEnd] - ISO date for custom range end (when dateRange === 'custom')
 * @param {string[]} [options.selectedLabIds] - If non-empty, only include these lab ids
 * @param {string[]} [options.selectedVitalIds] - If non-empty, only include these vital ids
 * @returns {Promise<Object>} Summary payload: { exportedAt, dateRange, sectionsIncluded, data: { ... } }
 */
export async function exportDoctorSummary(userId, options = {}) {
  const sections = { ...DEFAULT_SECTIONS, ...(options.sections || {}) };
  const dateRange = options.dateRange || '6m';
  const bounds = getDateBounds(dateRange, options.customStart, options.customEnd);
  const selectedLabIds = options.selectedLabIds === undefined ? null : new Set(options.selectedLabIds || []);
  const selectedVitalIds = options.selectedVitalIds === undefined ? null : new Set(options.selectedVitalIds || []);

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

  // Load lab values and filter by date
  const labsWithValues = await Promise.all(
    labs.map(async (lab) => {
      const values = await labService.getLabValues(lab.id);
      const raw = values || [];
      const filtered = (bounds.start || bounds.end)
        ? raw.filter((v) => inDateBounds(v.date, bounds))
        : raw;
      return { ...lab, values: filtered };
    })
  );

  // Load vital values and filter by date
  const vitalsWithValues = await Promise.all(
    vitals.map(async (vital) => {
      const values = await vitalService.getVitalValues(vital.id);
      const raw = values || [];
      const filtered = (bounds.start || bounds.end)
        ? raw.filter((v) => inDateBounds(v.date || v.dateTime, bounds))
        : raw;
      return { ...vital, values: filtered };
    })
  );

  // Filter medication logs by takenAt
  const filteredMedicationLogs = (bounds.start || bounds.end)
    ? medicationLogs.filter((log) => inDateBounds(log.takenAt || log.createdAt, bounds))
    : medicationLogs;

  // Filter symptoms by date
  const filteredSymptoms = (bounds.start || bounds.end)
    ? symptoms.filter((s) => inDateBounds(s.date, bounds))
    : symptoms;

  // Filter journal notes by date (only if section included)
  const filteredJournalNotes =
    sections.journalNotes && (bounds.start || bounds.end)
      ? journalNotes.filter((n) => inDateBounds(n.date, bounds))
      : sections.journalNotes
        ? journalNotes
        : [];

  // Filter documents by date
  const filteredDocuments = (bounds.start || bounds.end)
    ? documents.filter((doc) => inDateBounds(doc.date, bounds))
    : documents;

  // Apply lab/vital selection filter (null = include all; empty Set = include none)
  const labsToInclude = selectedLabIds !== null ? labsWithValues.filter((lab) => selectedLabIds.has(lab.id)) : labsWithValues;
  const vitalsToInclude = selectedVitalIds !== null ? vitalsWithValues.filter((v) => selectedVitalIds.has(v.id)) : vitalsWithValues;

  const data = {};
  if (sections.demographics && patientProfile) {
    data.patientProfile = patientProfile;
  }
  if (sections.labs) {
    data.labs = labsToInclude;
  }
  if (sections.vitals) {
    data.vitals = vitalsToInclude;
  }
  if (sections.medications) {
    data.medications = medications;
    data.medicationLogs = filteredMedicationLogs;
  }
  if (sections.symptoms) {
    data.symptoms = filteredSymptoms;
  }
  if (sections.journalNotes) {
    data.journalNotes = filteredJournalNotes;
  }
  if (sections.documents) {
    data.documents = filteredDocuments;
  }
  if (sections.genomic && genomicProfile) {
    data.genomicProfile = genomicProfile;
  }

  const sectionsIncluded = Object.keys(sections).filter((k) => sections[k]);
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    app: 'CancerCare',
    dateRange,
    customStart: options.customStart || null,
    customEnd: options.customEnd || null,
    sectionsIncluded,
    data
  };

  return serializeForExport(payload);
}
