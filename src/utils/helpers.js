// Helper: extract DNA and protein change from mutation strings
export const parseMutation = (mutation) => {
  const raw = (mutation.variant || '') + ' ' + (mutation.type || '');
  const dnaMatch = raw.match(/c\.[^\s,;)]*/i);
  const proteinMatch = raw.match(/p\.[^\s,;)]*/i);
  const dna = mutation.dna || mutation.dnaChange || (dnaMatch ? dnaMatch[0] : null);
  const protein = mutation.protein || mutation.aminoAcidChange || (proteinMatch ? proteinMatch[0] : null);
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

