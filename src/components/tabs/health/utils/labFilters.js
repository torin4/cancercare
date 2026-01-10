/**
 * Utility functions for filtering and processing lab data
 */

import { normalizeLabName, getLabDisplayName } from '../../../../utils/normalizationUtils';

/**
 * Check if a lab is empty (has no valid data points)
 * @param {Object} lab - Lab object with data array
 * @returns {boolean} - True if lab is empty
 */
export function isLabEmpty(lab) {
  if (!lab) return true;
  if (!lab.data || !Array.isArray(lab.data) || lab.data.length === 0) {
    return true; // No data at all
  }
  
  const labDocIds = lab.labDocumentIds || [lab.id];
  const allDataIdsAreFallback = lab.data.every(d => labDocIds.includes(d.id));
  
  const hasValidValues = lab.data.some(d => {
    const value = d.value;
    if (value == null || value === undefined || value === '') return false;
    const valueStr = String(value).trim().toLowerCase();
    if (valueStr === '-' || valueStr === '—' || valueStr === 'n/a' || valueStr === 'na' || 
        valueStr === '未測定' || valueStr === '測定なし' || valueStr === '--') {
      return false;
    }
    if (lab.isNumeric && isNaN(parseFloat(value))) {
      return false;
    }
    return true;
  });
  
  return allDataIdsAreFallback || !hasValidValues;
}

/**
 * Filter labs by search query and empty metrics option
 * @param {Array<[string, Object]>} labs - Array of [key, lab] tuples
 * @param {string} query - Search query string
 * @param {boolean} hideEmpty - Whether to hide labs with no values
 * @returns {Array<[string, Object]>} - Filtered labs
 */
export function filterLabsBySearch(labs, query, hideEmpty) {
  let filtered = labs;
  
  // Filter by search query
  if (query && query.trim() !== '') {
    const searchLower = query.toLowerCase().trim();
    filtered = filtered.filter(([key, lab]) => {
      const displayName = getLabDisplayName(lab.name);
      const labName = lab.name || '';
      return displayName.toLowerCase().includes(searchLower) || 
             labName.toLowerCase().includes(searchLower);
    });
  }
  
  // Filter out metrics with no values if hideEmpty is true
  if (hideEmpty) {
    filtered = filtered.filter(([key, lab]) => {
      if (!lab.data || !Array.isArray(lab.data) || lab.data.length === 0) {
        return false; // No data at all
      }
      
      const labDocIds = lab.labDocumentIds || [lab.id];
      const allDataIdsAreFallback = lab.data.every(d => labDocIds.includes(d.id));
      
      const hasValidValues = lab.data.some(d => {
        const value = d.value;
        if (value == null || value === undefined || value === '') return false;
        const valueStr = String(value).trim().toLowerCase();
        if (valueStr === '-' || valueStr === '—' || valueStr === 'n/a' || valueStr === 'na' || 
            valueStr === '未測定' || valueStr === '測定なし' || valueStr === '--') {
          return false;
        }
        if (lab.isNumeric && isNaN(parseFloat(value))) {
          return false;
        }
        return true;
      });
      
      const hasRealValidValues = !allDataIdsAreFallback && hasValidValues;
      return hasRealValidValues;
    });
  }
  
  return filtered;
}

/**
 * Get lab category for a given lab key
 * @param {string} labKey - Lab key to categorize
 * @param {Object} categorizedLabs - Categorized labs object
 * @returns {string|null} - Category name or null
 */
export function getLabCategory(labKey, categorizedLabs) {
  for (const [category, labs] of Object.entries(categorizedLabs)) {
    if (labs.some(([key]) => key === labKey)) {
      return category;
    }
  }
  return null;
}