// Helper: extract DNA and protein change from mutation strings
export const parseMutation = (mutation) => {
  // Check multiple fields for DNA/protein notation: variant, alteration, dna, dnaChange
  const raw = (mutation.variant || '') + ' ' + (mutation.alteration || '') + ' ' + (mutation.type || '') + ' ' + (mutation.note || '');
  const dnaMatch = raw.match(/c\.[^\s,;)]*/i);
  const proteinMatch = raw.match(/p\.[^\s,;)]*/i);

  // Check alteration field first if it contains DNA notation
  let dna = mutation.dna || mutation.dnaChange;
  if (!dna && mutation.alteration) {
    const altDnaMatch = mutation.alteration.match(/c\.[^\s,;)]*/i);
    if (altDnaMatch) {
      dna = altDnaMatch[0];
    } else if (mutation.alteration.match(/^c\./i)) {
      // If alteration starts with c., use it as DNA
      dna = mutation.alteration;
    }
  }
  if (!dna && dnaMatch) {
    dna = dnaMatch[0];
  }

  let protein = mutation.protein || mutation.aminoAcidChange;
  if (!protein && mutation.alteration) {
    const altProteinMatch = mutation.alteration.match(/p\.[^\s,;)]*/i);
    if (altProteinMatch) {
      protein = altProteinMatch[0];
    }
  }
  if (!protein && proteinMatch) {
    protein = proteinMatch[0];
  }

  const kind = mutation.type || (mutation.germline ? 'Germline' : mutation.somatic ? 'Somatic' : null);
  return { dna, protein, kind };
};

// Helper function to get today's date in local timezone (YYYY-MM-DD)
export const getTodayLocalDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper: current date and time in local timezone for datetime-local input (YYYY-MM-DDTHH:mm)
export const getCurrentDateTimeLocal = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

/**
 * Parse a date string in YYYY-MM-DD format as a local date (not UTC)
 * This prevents timezone issues where dates shift by one day
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @returns {Date} - Date object in local timezone
 */
export const parseLocalDate = (dateString) => {
  if (!dateString) return new Date();

  // If already a Date object, return it
  if (dateString instanceof Date) return dateString;

  // Parse YYYY-MM-DD format as local date
  const parts = dateString.split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
    const day = parseInt(parts[2], 10);

    // Create date in local timezone (not UTC)
    const localDate = new Date(year, month, day);
    if (!isNaN(localDate.getTime())) {
      return localDate;
    }
  }

  // Fallback to standard Date parsing
  return new Date(dateString);
};

/**
 * Format a date as YYYY-MM-DD string (avoids timezone issues)
 * This ensures dates are displayed consistently regardless of timezone
 * @param {Date|string|FirestoreTimestamp} date - Date to format
 * @returns {string} - Date string in YYYY-MM-DD format
 */
export const formatDateString = (date) => {
  if (!date) return null;
  try {
    let d;

    // Handle Firestore Timestamp
    if (date.toDate) {
      d = date.toDate();
    }
    // Handle Date object
    else if (date instanceof Date) {
      d = date;
    }
    // Handle string (already in YYYY-MM-DD format or needs parsing)
    else if (typeof date === 'string') {
      // If already in YYYY-MM-DD format, return as is
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return date;
      }
      // Otherwise parse it using parseLocalDate to avoid timezone issues
      d = parseLocalDate(date);
    }
    // Handle number (timestamp)
    else if (typeof date === 'number') {
      d = new Date(date);
    }
    else {
      return null;
    }

    if (!d || isNaN(d.getTime())) {
      return null;
    }

    // Format as YYYY-MM-DD using local date components (not UTC)
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (e) {
    return null;
  }
};

// Helpers for country-specific address labels/placeholders
export const getStateLabel = (country) => {
  if (!country) return 'State/Region';
  const c = country.toLowerCase();
  if (c.includes('japan')) return 'Prefecture';
  if (c.includes('canada') || c.includes('australia')) return 'Province/State';
  if (c.includes('united kingdom') || c.includes('uk')) return 'County/Region';
  return 'State/Region';
};

export const getStatePlaceholder = (country) => {
  if (!country) return '';
  const c = country.toLowerCase();
  if (c.includes('japan')) return 'Tokyo';
  if (c.includes('canada')) return 'BC';
  if (c.includes('united states') || c.includes('united states of america')) return 'WA';
  return '';
};

export const getPostalLabel = (country) => {
  if (!country) return 'Postal Code';
  const c = country.toLowerCase();
  if (c.includes('united states')) return 'ZIP Code';
  return 'Postal Code';
};

export const getPostalPlaceholder = (country) => {
  if (!country) return '';
  const c = country.toLowerCase();
  if (c.includes('japan')) return '100-0001';
  if (c.includes('united states')) return '98109';
  if (c.includes('canada')) return 'V6B 1A1';
  return '';
};

/**
 * Split text by search query (case-insensitive) for highlight rendering.
 * Returns array of { type: 'text'|'match', value: string }.
 * Use with: parts.map((part, i) => part.type === 'match' ? <mark key={i}>{part.value}</mark> : part.value)
 */
export function highlightSearchMatches(text, query) {
  if (!text || typeof text !== 'string') return [{ type: 'text', value: text || '' }];
  if (!query || !String(query).trim()) return [{ type: 'text', value: text }];
  const q = String(query).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(${q})`, 'gi');
  const parts = text.split(re);
  const result = [];
  for (let i = 0; i < parts.length; i++) {
    result.push({
      type: i % 2 === 1 ? 'match' : 'text',
      value: parts[i],
    });
  }
  return result;
}
