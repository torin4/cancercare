/**
 * Notebook Service
 *
 * Date-centric Health Journal - Organizes all health information by date
 * Each journal entry represents a single day with:
 * - Notes (from chat, manual entry, or document annotations)
 * - Documents uploaded on that day
 * - Symptoms logged on that day
 */

import { documentService, symptomService, journalNoteService } from '../firebase/services';

/**
 * Safely parse a date from various formats and normalize to day-level
 */
function parseDate(dateValue) {
  if (!dateValue) return new Date();

  let date;
  if (dateValue?.toDate) {
    date = dateValue.toDate();
  } else if (dateValue instanceof Date) {
    date = dateValue;
  } else {
    date = new Date(dateValue);
  }

  // Normalize to start of day (midnight) for consistent grouping
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Format a date to a string key for grouping (YYYY-MM-DD)
 */
function formatDateKey(date) {
  const d = parseDate(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format document type for display
 */
function formatDocumentType(type) {
  if (!type) return 'Document';

  const normalizedType = type.toLowerCase();

  const typeMap = {
    'lab-report': 'Lab Report',
    'lab': 'Lab Report',
    'imaging': 'Imaging',
    'scan': 'Imaging',
    'clinical-note': 'Clinical Note',
    'genomic': 'Genomic Profile',
    'pathology': 'Pathology Report',
    'prescription': 'Prescription',
    'report': 'Medical Report',
    'general': 'Document',
    'blood-test': 'Lab Report',
    'vitals': 'Vital Signs'
  };

  return typeMap[normalizedType] || type;
}

/**
 * Get date-based journal entries for a patient
 * Returns entries grouped by date, with all activities for that date
 *
 * @param {string} patientId - Patient ID
 * @param {Object} options - Filtering options
 * @returns {Promise<Array>} - Array of date-based entries
 */
export async function getNotebookEntries(patientId, options = {}) {
  const {
    startDate = null,
    endDate = null,
    limit = 100
  } = options;

  try {
    // Fetch all data sources
    const [allDocuments, allSymptoms, allJournalNotes] = await Promise.all([
      documentService.getDocuments(patientId),
      symptomService.getSymptoms(patientId),
      journalNoteService.getJournalNotes(patientId)
    ]);


    // Group everything by date
    const entriesByDate = {};

    // Process documents - include ALL documents, notes optional
    allDocuments.forEach(doc => {
      const date = parseDate(doc.date);
      const dateKey = formatDateKey(date);

      // Filter out invalid future dates (beyond 2 years from now)
      const maxValidDate = new Date();
      maxValidDate.setFullYear(maxValidDate.getFullYear() + 2);
      if (date > maxValidDate) {
        return;
      }

      if (!entriesByDate[dateKey]) {
        entriesByDate[dateKey] = {
          date: date,
          dateKey: dateKey,
          notes: [],
          documents: [],
          symptoms: []
        };
      }

      // Add document note if it exists
      if (doc.note && doc.note.trim()) {
        entriesByDate[dateKey].notes.push({
          id: `doc-note-${doc.id}`,
          content: doc.note,
          source: 'document',
          sourceId: doc.id,
          sourceName: doc.name || 'Document'
        });
      }

      // Add document to the date's document list
      const docType = doc.documentType || doc.type;
      entriesByDate[dateKey].documents.push({
        id: doc.id,
        name: doc.name || 'Untitled Document',
        type: formatDocumentType(docType),
        typeRaw: docType,
        fileUrl: doc.fileUrl,
        note: doc.note || null,
        dataPointCount: doc.dataPointCount || 0
      });
    });

    // Process symptoms
    allSymptoms.forEach(symptom => {
      const date = parseDate(symptom.date);
      const dateKey = formatDateKey(date);

      // Filter out invalid future dates (beyond 2 years from now)
      const maxValidDate = new Date();
      maxValidDate.setFullYear(maxValidDate.getFullYear() + 2);
      if (date > maxValidDate) {
        return;
      }

      if (!entriesByDate[dateKey]) {
        entriesByDate[dateKey] = {
          date: date,
          dateKey: dateKey,
          notes: [],
          documents: [],
          symptoms: []
        };
      }

      // Add symptom (use type or name - Day One imports use name)
      const symptomLabel = symptom.type || symptom.name || 'Symptom';
      entriesByDate[dateKey].symptoms.push({
        id: symptom.id,
        type: symptomLabel,
        severity: symptom.severity,
        notes: symptom.notes || null,
        tags: symptom.tags || []
      });

      // Add symptom note if it exists
      if (symptom.notes && symptom.notes.trim()) {
        entriesByDate[dateKey].notes.push({
          id: `symptom-note-${symptom.id}`,
          content: symptom.notes,
          source: 'symptom',
          sourceId: symptom.id,
          sourceName: `${symptomLabel} (${symptom.severity || 'Moderate'})`
        });
      }
    });

    // Process journal notes
    allJournalNotes.forEach(journalNote => {
      const date = parseDate(journalNote.date);
      const dateKey = formatDateKey(date);

      // Filter out invalid dates (before 1900 or after 2100)
      const minValidDate = new Date(1900, 0, 1);
      const maxValidDate = new Date(2100, 11, 31, 23, 59, 59);
      if (date < minValidDate || date > maxValidDate) {
        return;
      }

      if (!entriesByDate[dateKey]) {
        entriesByDate[dateKey] = {
          date: date,
          dateKey: dateKey,
          notes: [],
          documents: [],
          symptoms: []
        };
      }

      // Add journal note
      if (journalNote.content && journalNote.content.trim()) {
        entriesByDate[dateKey].notes.push({
          id: `journal-note-${journalNote.id}`,
          content: journalNote.content,
          source: 'journal',
          sourceId: journalNote.id,
          sourceName: 'Journal Entry'
        });
      }
    });

    // Convert to array and filter
    let entries = Object.values(entriesByDate);

    // Filter by date range if provided
    if (startDate) {
      entries = entries.filter(entry => entry.date >= startDate);
    }
    if (endDate) {
      entries = entries.filter(entry => entry.date <= endDate);
    }

    // Sort by date (most recent first)
    entries.sort((a, b) => b.date - a.date);

    // Apply limit
    if (limit) {
      entries = entries.slice(0, limit);
    }


    return entries;
  } catch (error) {
    throw error;
  }
}

/**
 * Get stats about the journal
 * @param {string} patientId - Patient ID
 * @returns {Promise<Object>} - Journal statistics
 */
export async function getNotebookStats(patientId) {
  try {
    const entries = await getNotebookEntries(patientId, { limit: null });

    const stats = {
      totalDates: entries.length,
      totalNotes: 0,
      totalDocuments: 0,
      totalSymptoms: 0,
      byMonth: {}
    };

    entries.forEach(entry => {
      stats.totalNotes += entry.notes.length;
      stats.totalDocuments += entry.documents.length;
      stats.totalSymptoms += entry.symptoms.length;

      const monthKey = entry.date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      if (!stats.byMonth[monthKey]) {
        stats.byMonth[monthKey] = 0;
      }
      stats.byMonth[monthKey]++;
    });

    return stats;
  } catch (error) {
    return {
      totalDates: 0,
      totalNotes: 0,
      totalDocuments: 0,
      totalSymptoms: 0,
      byMonth: {}
    };
  }
}

