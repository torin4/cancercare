/**
 * Pattern Recognition Utility Module
 * 
 * Practical pattern detection without heavy statistical libraries.
 * All functions are adaptive - work with whatever data is available.
 * Uses dateCorrelation.js for all date operations.
 */

import {
  normalizeDate,
  buildDateIndex,
  findSameDayCorrelations,
  findTimeWindowCorrelations,
  groupEventsByDate,
  filterByDateRange,
  daysSinceTreatmentStart,
  getLastNMonthsRange,
  isWithinTimeWindow,
  daysBetween
} from './dateCorrelation';

/**
 * Check if data has sufficient entries for pattern detection
 * @param {Array} data - Data array to check
 * @param {number} minEntries - Minimum entries required (default: 5)
 * @returns {boolean} - True if sufficient data
 */
function hasSufficientData(data, minEntries = 5) {
  return Array.isArray(data) && data.length >= minEntries;
}

/**
 * Detect treatment cycle patterns (interval-based)
 * Works for ANY data type with ≥5 entries
 * @param {Array} events - Array of events with date property
 * @param {Function} getDate - Function to extract date from event
 * @param {Array} medications - Array of medications with start dates (optional)
 * @returns {Array} - Array of cycle pattern objects
 */
export function detectTreatmentCycles(events, getDate = (e) => e.date, medications = []) {
  if (!hasSufficientData(events, 5)) return [];
  
  const normalizedEvents = events
    .map(event => ({
      ...event,
      normalizedDate: normalizeDate(getDate(event))
    }))
    .filter(e => e.normalizedDate)
    .sort((a, b) => a.normalizedDate.localeCompare(b.normalizedDate));
  
  if (normalizedEvents.length < 5) return [];
  
  // Calculate intervals between consecutive events
  const intervals = [];
  for (let i = 1; i < normalizedEvents.length; i++) {
    const days = daysBetween(normalizedEvents[i].normalizedDate, normalizedEvents[i - 1].normalizedDate);
    if (days > 0) intervals.push(days);
  }
  
  if (intervals.length < 3) return [];
  
  // Find most common interval (within ±3 days tolerance)
  const intervalGroups = new Map();
  intervals.forEach(interval => {
    // Group similar intervals (within 3 days)
    let found = false;
    for (const [key, group] of intervalGroups.entries()) {
      if (Math.abs(interval - key) <= 3) {
        group.push(interval);
        found = true;
        break;
      }
    }
    if (!found) {
      intervalGroups.set(interval, [interval]);
    }
  });
  
  // Find largest group
  let largestGroup = null;
  let maxCount = 0;
  intervalGroups.forEach((group, key) => {
    if (group.length > maxCount) {
      maxCount = group.length;
      largestGroup = { avgInterval: key, intervals: group };
    }
  });
  
  if (!largestGroup || maxCount < 3) return [];

  // Calculate average and range
  const avgInterval = largestGroup.intervals.reduce((a, b) => a + b, 0) / largestGroup.intervals.length;
  const minInterval = Math.min(...largestGroup.intervals);
  const maxInterval = Math.max(...largestGroup.intervals);

  // Filter out meaningless patterns:
  // - Require at least 5 occurrences for statistical significance
  // - Require at least 5 days average interval (very short intervals are just frequent data entry, not patterns)
  // - Require the pattern to cover at least 3 weeks total span
  const occurrences = maxCount + 1;
  const totalSpanDays = avgInterval * occurrences;
  if (occurrences < 5 || avgInterval < 5 || totalSpanDays < 21) {
    return [];
  }

  // Check if matches medication frequency
  let matchesMedication = null;
  if (medications.length > 0) {
    medications.forEach(med => {
      const freq = med.frequency || '';
      if (freq.includes('3 week') || freq.includes('21 day')) {
        if (Math.abs(avgInterval - 21) <= 3) matchesMedication = med;
      } else if (freq.includes('2 week') || freq.includes('14 day')) {
        if (Math.abs(avgInterval - 14) <= 3) matchesMedication = med;
      } else if (freq.includes('week')) {
        const weekMatch = freq.match(/(\d+)\s*week/);
        if (weekMatch) {
          const expectedDays = parseInt(weekMatch[1]) * 7;
          if (Math.abs(avgInterval - expectedDays) <= 3) matchesMedication = med;
        }
      }
    });
  }
  
  return [{
    type: 'cycle',
    avgInterval: Math.round(avgInterval),
    minInterval,
    maxInterval,
    occurrences: maxCount + 1, // +1 for the first event
    matchesMedication,
    confidence: maxCount / intervals.length
  }];
}

/**
 * Detect clusters (co-occurring events within time windows)
 * Works for symptoms, vitals, labs, or notes (only if ≥5 entries exist)
 * @param {Array} events - Array of events with date and type/name property
 * @param {Function} getDate - Function to extract date from event
 * @param {Function} getType - Function to extract type/name from event
 * @param {number} windowDays - Time window for co-occurrence (default: 3)
 * @returns {Array} - Array of cluster pattern objects
 */
export function detectClusters(events, getDate = (e) => e.date, getType = (e) => e.type || e.name, windowDays = 3) {
  if (!hasSufficientData(events, 5)) return [];
  
  const dateIndex = buildDateIndex(events, getDate);
  const clusters = [];
  const clusterMap = new Map();
  
  // Find events that co-occur within time window
  dateIndex.forEach((sameDayEvents, dateStr) => {
    if (sameDayEvents.length > 1) {
      const types = sameDayEvents.map(getType).filter(Boolean);
      if (types.length > 1) {
        const clusterKey = types.sort().join('+');
        if (!clusterMap.has(clusterKey)) {
          clusterMap.set(clusterKey, {
            types,
            occurrences: [],
            dates: []
          });
        }
        clusterMap.get(clusterKey).occurrences.push(sameDayEvents);
        clusterMap.get(clusterKey).dates.push(dateStr);
      }
    }
  });
  
  // Also check time-window correlations
  const allEvents = Array.from(dateIndex.values()).flat();
  for (let i = 0; i < allEvents.length; i++) {
    for (let j = i + 1; j < allEvents.length; j++) {
      const date1 = normalizeDate(getDate(allEvents[i]));
      const date2 = normalizeDate(getDate(allEvents[j]));
      if (isWithinTimeWindow(date1, date2, windowDays) && !isWithinTimeWindow(date1, date2, 0)) {
        const type1 = getType(allEvents[i]);
        const type2 = getType(allEvents[j]);
        if (type1 && type2 && type1 !== type2) {
          const clusterKey = [type1, type2].sort().join('+');
          if (!clusterMap.has(clusterKey)) {
            clusterMap.set(clusterKey, {
              types: [type1, type2],
              occurrences: [],
              dates: []
            });
          }
          const cluster = clusterMap.get(clusterKey);
          if (!cluster.dates.includes(date1) && !cluster.dates.includes(date2)) {
            cluster.occurrences.push([allEvents[i], allEvents[j]]);
            cluster.dates.push(date1 < date2 ? date1 : date2);
          }
        }
      }
    }
  }
  
  // Convert to pattern objects
  clusterMap.forEach((cluster, key) => {
    if (cluster.occurrences.length >= 3) {
      clusters.push({
        type: 'cluster',
        types: cluster.types,
        occurrences: cluster.occurrences.length,
        dates: cluster.dates.slice(0, 5) // Sample dates
      });
    }
  });
  
  return clusters;
}

/**
 * Detect temporal correlations between two data types
 * Works for ANY combination of available data types
 * @param {Array} events1 - First set of events
 * @param {Array} events2 - Second set of events
 * @param {Function} getDate1 - Function to extract date from event1
 * @param {Function} getDate2 - Function to extract date from event2
 * @param {Function} checkCondition1 - Function to check if event1 meets threshold condition
 * @param {Function} checkCondition2 - Function to check if event2 meets threshold condition
 * @param {number} windowDays - Time window for correlation (default: 7)
 * @param {string} event1Name - Name/label for event type 1 (e.g., "lab changes", "low hemoglobin")
 * @param {string} event2Name - Name/label for event type 2 (e.g., "symptoms", "fatigue")
 * @returns {Array} - Array of correlation pattern objects
 */
export function detectTemporalCorrelations(events1, events2, getDate1 = (e) => e.date, getDate2 = (e) => e.date, checkCondition1 = () => true, checkCondition2 = () => true, windowDays = 7, event1Name = null, event2Name = null) {
  if (!hasSufficientData(events1, 3) || !hasSufficientData(events2, 3)) return [];

  const correlations = findTimeWindowCorrelations(
    events1.filter(checkCondition1),
    events2.filter(checkCondition2),
    getDate1,
    getDate2,
    windowDays
  );

  if (correlations.length < 3) return [];

  // Group by direction and calculate average lag
  const forward = correlations.filter(c => c.direction === 'event1-first');
  const backward = correlations.filter(c => c.direction === 'event2-first');

  const patterns = [];

  if (forward.length >= 3) {
    const avgLag = forward.reduce((sum, c) => sum + c.daysDiff, 0) / forward.length;
    patterns.push({
      type: 'correlation',
      direction: 'forward',
      event1: event1Name,
      event2: event2Name,
      avgLag: Math.round(avgLag),
      occurrences: forward.length,
      lagRange: {
        min: Math.min(...forward.map(c => c.daysDiff)),
        max: Math.max(...forward.map(c => c.daysDiff))
      }
    });
  }

  if (backward.length >= 3) {
    const avgLag = backward.reduce((sum, c) => sum + c.daysDiff, 0) / backward.length;
    patterns.push({
      type: 'correlation',
      direction: 'backward',
      event1: event2Name, // Swap for backward - event2 comes first
      event2: event1Name,
      avgLag: Math.round(avgLag),
      occurrences: backward.length,
      lagRange: {
        min: Math.min(...backward.map(c => c.daysDiff)),
        max: Math.max(...backward.map(c => c.daysDiff))
      }
    });
  }

  return patterns;
}

/**
 * Detect multi-variable patterns across any combination of data types
 * @param {Object} dataSources - Object with data sources { labs, vitals, symptoms, notes }
 * @param {Object} options - Configuration options
 * @returns {Array} - Array of multi-variable pattern objects
 */
export function detectMultiVariablePatterns(dataSources, options = {}) {
  const patterns = [];
  const { labs = [], vitals = [], symptoms = [], notes = [] } = dataSources;
  
  // Lab-only patterns
  if (hasSufficientData(labs, 3)) {
    // Simple pattern: detect when multiple labs change significantly on same day
    const labDateIndex = buildDateIndex(labs.flatMap(lab => 
      (lab.values || []).map(v => ({ ...v, labType: lab.labType, type: 'lab' }))
    ));
    
    labDateIndex.forEach((events, dateStr) => {
      if (events.length >= 2) {
        // Check for significant changes
        const significantChanges = events.filter(e => {
          // Simple threshold check - can be enhanced
          return true; // Placeholder
        });
        if (significantChanges.length >= 2) {
          patterns.push({
            type: 'multi-variable',
            dataTypes: ['lab'],
            date: dateStr,
            events: significantChanges
          });
        }
      }
    });
  }
  
  // Cross-type patterns (lab + symptom, lab + vital, etc.)
  // Implementation would check for co-occurrence across types
  // Simplified for now - can be enhanced based on specific needs
  
  return patterns;
}

/**
 * Detect temporal patterns (day-of-week, treatment-relative)
 * @param {Array} events - Array of events with date property
 * @param {Function} getDate - Function to extract date from event
 * @param {Array} medications - Array of medications with start dates (optional)
 * @returns {Array} - Array of temporal pattern objects
 */
export function detectTemporalPatterns(events, getDate = (e) => e.date, medications = []) {
  if (!hasSufficientData(events, 5)) return [];
  
  const patterns = [];
  
  // Treatment-relative patterns
  if (medications.length > 0) {
    medications.forEach(med => {
      const startDate = normalizeDate(med.createdAt || med.startDate);
      if (!startDate) return;
      
      const relativeDays = events
        .map(event => {
          const eventDate = normalizeDate(getDate(event));
          if (!eventDate) return null;
          return daysSinceTreatmentStart(startDate, eventDate);
        })
        .filter(Boolean);
      
      if (relativeDays.length < 5) return;
      
      // Find most common relative day
      const dayGroups = new Map();
      relativeDays.forEach(day => {
        const rounded = Math.round(day / 7) * 7; // Round to nearest week
        if (!dayGroups.has(rounded)) {
          dayGroups.set(rounded, []);
        }
        dayGroups.get(rounded).push(day);
      });
      
      let maxGroup = null;
      let maxCount = 0;
      dayGroups.forEach((group, key) => {
        if (group.length > maxCount) {
          maxCount = group.length;
          maxGroup = { day: key, days: group };
        }
      });
      
      if (maxGroup && maxCount >= 3) {
        const avgDay = maxGroup.days.reduce((a, b) => a + b, 0) / maxGroup.days.length;
        patterns.push({
          type: 'temporal',
          subtype: 'treatment-relative',
          avgDaysAfterTreatment: Math.round(avgDay),
          minDays: Math.min(...maxGroup.days),
          maxDays: Math.max(...maxGroup.days),
          occurrences: maxCount,
          medication: med.name
        });
      }
    });
  }
  
  return patterns;
}

/**
 * Detect predictive patterns (early warning indicators)
 * @param {Array} events - Array of events with date and value properties
 * @param {Function} getDate - Function to extract date from event
 * @param {Function} getValue - Function to extract value from event
 * @param {Function} checkThreshold - Function to check if value meets threshold
 * @returns {Array} - Array of predictive pattern objects
 */
export function detectPredictivePatterns(events, getDate = (e) => e.date, getValue = (e) => e.value, checkThreshold = () => false) {
  if (!hasSufficientData(events, 5)) return [];
  
  const patterns = [];
  const thresholdEvents = events.filter(e => checkThreshold(getValue(e)));
  
  if (thresholdEvents.length < 3) return [];
  
  // Simple pattern: threshold events that precede other significant events
  // This is a simplified version - can be enhanced with more sophisticated logic
  
  return patterns;
}

/**
 * Prioritize insights by importance
 * @param {Array} insights - Array of insight objects
 * @returns {Array} - Sorted insights (most important first)
 */
export function prioritizeInsights(insights) {
  return insights.sort((a, b) => {
    // Priority based on: actionability, confidence, recency
    const priorityA = (a.priority || 5) - (a.confidence || 0) * 0.1;
    const priorityB = (b.priority || 5) - (b.confidence || 0) * 0.1;
    return priorityA - priorityB;
  });
}

/**
 * Filter insights by depth level
 * @param {Array} insights - Array of insight objects
 * @param {string} depthLevel - 'basic' | 'standard' | 'advanced' | 'expert'
 * @returns {Array} - Filtered insights
 */
export function filterByInsightDepth(insights, depthLevel = 'standard') {
  if (depthLevel === 'basic') {
    return insights.filter(i => i.type === 'trend' || i.type === 'cycle');
  } else if (depthLevel === 'standard') {
    return insights; // All insights
  } else if (depthLevel === 'advanced') {
    return insights; // All insights (no filtering for advanced)
  } else if (depthLevel === 'expert') {
    return insights; // All insights (no filtering for expert)
  }
  return insights;
}

/**
 * Main function to detect all patterns and return structured insights
 * This orchestrates all pattern detection and returns structured insight objects
 * @param {Object} healthData - Health data object with labs, vitals, symptoms, medications, notes
 * @param {Object} options - Options including insightDepth, timeWindow, etc.
 * @returns {Array} - Array of structured insight objects ready for UI
 */
export async function detectAllPatterns(healthData, options = {}) {
  const {
    insightDepth = 'standard',
    timeWindowMonths = 18,
    medications = [],
    patientProfile = null
  } = options;
  
  const insights = [];
  const { labs = [], vitals = [], symptoms = [], notes = [] } = healthData;
  
  // Filter data by time window first (efficiency)
  const { startDate, endDate } = getLastNMonthsRange(timeWindowMonths);
  const filteredLabs = labs.map(lab => ({
    ...lab,
    values: (lab.values || []).filter(v => {
      const date = normalizeDate(v.date);
      return date && date >= startDate && date <= endDate;
    })
  }));
  
  // Note: Generic symptom cycle detection disabled because "symptoms" as a category
  // is too vague to be actionable. In the future, this could detect cycles for
  // specific symptom types (e.g., "fatigue tends to occur every 3 weeks").
  
  // Detect cycles for labs (per lab type)
  filteredLabs.forEach(lab => {
    if (hasSufficientData(lab.values, 5)) {
      const cycles = detectTreatmentCycles(lab.values, (v) => v.date, medications);
      cycles.forEach(cycle => {
        insights.push({
          type: 'cycle',
          priority: 3,
          metric: lab.label || lab.labType,
          rawData: { ...cycle, labType: lab.labType },
          confidence: `Based on ${cycle.occurrences} occurrences`
        });
      });
    }
  });
  
  // Detect clusters for symptoms
  if (hasSufficientData(symptoms, 5)) {
    const clusters = detectClusters(symptoms, (s) => s.date, (s) => s.name);
    clusters.forEach(cluster => {
      insights.push({
        type: 'cluster',
        priority: 4,
        rawData: cluster,
        confidence: `Based on ${cluster.occurrences} occurrences`
      });
    });
  }
  
  // Note: Generic lab-symptom correlations have been disabled because they produce
  // meaningless insights like "when lab changes happen, symptoms follow" which is
  // always true and not actionable. In the future, this could be improved to detect
  // specific correlations like "when hemoglobin drops below X, fatigue follows".
  
  // Detect temporal patterns (treatment-relative)
  if (medications.length > 0) {
    if (hasSufficientData(symptoms, 5)) {
      const temporal = detectTemporalPatterns(symptoms, (s) => s.date, medications);
      temporal.forEach(temp => {
        insights.push({
          type: 'temporal',
          priority: 3,
          rawData: temp,
          confidence: `Based on ${temp.occurrences} occurrences`
        });
      });
    }
  }
  
  // Prioritize insights
  const prioritized = prioritizeInsights(insights);
  
  // Filter by insight depth
  const filtered = filterByInsightDepth(prioritized, insightDepth);
  
  // Note: Translation to plain language will happen in chatProcessor.js using insightLanguage.js
  // This function returns raw structured insights that can be translated later
  return filtered;
}
