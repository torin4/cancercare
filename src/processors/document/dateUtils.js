import { parseLocalDate } from '../../utils/helpers';

/**
 * Extract a date from extracted data for filename use
 * Priority: user-provided date > first lab date > first vital date > genomic test date > today
 * @param {string|null} documentDate - User-provided date (YYYY-MM-DD format)
 * @param {Object} extractedData - Extracted data from AI
 * @returns {string|null} - Extracted date in YYYY-MM-DD format, or null
 */
export function extractDateFromDocument(documentDate, extractedData) {
  // Priority 1: User-provided date takes precedence
  if (documentDate) {
    return documentDate;
  }
  
  // Priority 2: First lab date
  if (extractedData?.data?.labs && extractedData.data.labs.length > 0) {
    const firstLab = extractedData.data.labs[0];
    if (firstLab.date) {
      return firstLab.date;
    }
  }
  
  // Priority 3: First vital date
  if (extractedData?.data?.vitals && extractedData.data.vitals.length > 0) {
    const firstVital = extractedData.data.vitals[0];
    if (firstVital.date) {
      return firstVital.date;
    }
  }
  
  // Priority 4: Genomic test date
  if (extractedData?.data?.genomic?.testInfo?.testDate) {
    return extractedData.data.genomic.testInfo.testDate;
  }
  
  // No date found - return null (will default to today in uploadDocument)
  return null;
}

/**
 * Format date string for display
 * @param {Date|string|FirestoreTimestamp} date - Date to format
 * @returns {string} - Formatted date string (YYYY-MM-DD)
 */
export function formatDateString(date) {
  if (!date) return null;
  try {
    // Handle Firestore Timestamp
    if (date.toDate) {
      const d = date.toDate();
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    // Handle Date object
    if (date instanceof Date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    // Handle string (already in YYYY-MM-DD format or needs parsing)
    if (typeof date === 'string') {
      // If already in YYYY-MM-DD format, return as is
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return date;
      }
      // Otherwise parse it
      const d = new Date(date);
      if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}
