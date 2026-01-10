/**
 * Shared utility function to convert Firestore timestamps to JavaScript dates
 * Used across all Firebase services
 */

/**
 * Converts Firestore Timestamps in an object to JavaScript Date objects
 * @param {Object} data - The data object that may contain Firestore Timestamps
 * @returns {Object} - The data object with Timestamps converted to Dates
 */
export const convertTimestamps = (data) => {
  if (!data) return data;
  const converted = { ...data };
  Object.keys(converted).forEach(key => {
    const value = converted[key];
    // Handle Firestore Timestamps (has toDate method)
    if (value && typeof value === 'object' && value.toDate && typeof value.toDate === 'function') {
      converted[key] = value.toDate();
    }
    // Handle Date objects (already converted, keep as is)
    else if (value instanceof Date) {
      converted[key] = value;
    }
    // Handle null/undefined (keep as is - no conversion needed)
  });
  return converted;
};
