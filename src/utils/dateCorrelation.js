/**
 * Date Correlation Utility Module
 * 
 * CRITICAL FOUNDATION for all pattern detection.
 * Centralizes date normalization and correlation logic for efficiency and consistency.
 * 
 * All date operations for pattern recognition should use this module.
 */

import { formatDateString } from './helpers';

/**
 * Normalize a date to day-level (YYYY-MM-DD) regardless of source
 * @param {Date|string|FirestoreTimestamp} date - Date to normalize
 * @returns {string|null} - Normalized date string (YYYY-MM-DD) or null
 */
export function normalizeDate(date) {
  return formatDateString(date);
}

/**
 * Normalize an array of dates in a single pass for efficiency
 * @param {Array} dates - Array of dates to normalize
 * @returns {Array<string>} - Array of normalized date strings (YYYY-MM-DD)
 */
export function normalizeDates(dates) {
  return dates.map(date => normalizeDate(date)).filter(Boolean);
}

/**
 * Check if two dates are on the same day
 * @param {Date|string|FirestoreTimestamp} date1 - First date
 * @param {Date|string|FirestoreTimestamp} date2 - Second date
 * @returns {boolean} - True if dates are on the same day
 */
export function isSameDay(date1, date2) {
  const normalized1 = normalizeDate(date1);
  const normalized2 = normalizeDate(date2);
  return normalized1 && normalized2 && normalized1 === normalized2;
}

/**
 * Check if two dates are within a time window of each other
 * @param {Date|string|FirestoreTimestamp} date1 - First date
 * @param {Date|string|FirestoreTimestamp} date2 - Second date
 * @param {number} windowDays - Number of days for the time window (default: 7)
 * @returns {boolean} - True if dates are within the window
 */
export function isWithinTimeWindow(date1, date2, windowDays = 7) {
  const normalized1 = normalizeDate(date1);
  const normalized2 = normalizeDate(date2);
  if (!normalized1 || !normalized2) return false;
  
  const d1 = new Date(normalized1);
  const d2 = new Date(normalized2);
  const diffDays = Math.abs((d1 - d2) / (1000 * 60 * 60 * 24));
  return diffDays <= windowDays;
}

/**
 * Calculate the number of days between two dates
 * @param {Date|string|FirestoreTimestamp} date1 - First date
 * @param {Date|string|FirestoreTimestamp} date2 - Second date
 * @returns {number|null} - Number of days difference, or null if dates are invalid
 */
export function daysBetween(date1, date2) {
  const normalized1 = normalizeDate(date1);
  const normalized2 = normalizeDate(date2);
  if (!normalized1 || !normalized2) return null;
  
  const d1 = new Date(normalized1);
  const d2 = new Date(normalized2);
  return Math.round((d1 - d2) / (1000 * 60 * 60 * 24));
}

/**
 * Build an indexed date map for O(1) lookups
 * @param {Array} events - Array of events with date property
 * @param {Function} getDate - Function to extract date from event (default: event.date)
 * @returns {Map<string, Array>} - Map of dateString -> events[] for that date
 */
export function buildDateIndex(events, getDate = (event) => event.date) {
  const index = new Map();
  
  events.forEach(event => {
    const dateStr = normalizeDate(getDate(event));
    if (dateStr) {
      if (!index.has(dateStr)) {
        index.set(dateStr, []);
      }
      index.get(dateStr).push(event);
    }
  });
  
  return index;
}

/**
 * Find all events that occurred on the same date across different data types
 * @param {Map<string, Array>} dateIndex - Date index built with buildDateIndex
 * @returns {Array<Object>} - Array of same-day correlation objects
 */
export function findSameDayCorrelations(dateIndex) {
  const correlations = [];
  
  dateIndex.forEach((events, dateStr) => {
    if (events.length > 1) {
      // Group events by type to identify cross-type correlations
      const eventsByType = new Map();
      events.forEach(event => {
        const type = event.type || 'unknown';
        if (!eventsByType.has(type)) {
          eventsByType.set(type, []);
        }
        eventsByType.get(type).push(event);
      });
      
      // Only include if multiple types on same day
      if (eventsByType.size > 1) {
        correlations.push({
          date: dateStr,
          events: events,
          types: Array.from(eventsByType.keys())
        });
      }
    }
  });
  
  return correlations.sort((a, b) => b.date.localeCompare(a.date)); // Newest first
}

/**
 * Find events within a time window of each other across data types
 * @param {Array} events1 - First set of events
 * @param {Array} events2 - Second set of events
 * @param {Function} getDate1 - Function to extract date from event1
 * @param {Function} getDate2 - Function to extract date from event2
 * @param {number} windowDays - Time window in days (default: 7)
 * @returns {Array<Object>} - Array of time-window correlation objects
 */
export function findTimeWindowCorrelations(events1, events2, getDate1 = (e) => e.date, getDate2 = (e) => e.date, windowDays = 7) {
  const correlations = [];
  
  events1.forEach(event1 => {
    const date1 = normalizeDate(getDate1(event1));
    if (!date1) return;
    
    events2.forEach(event2 => {
      const date2 = normalizeDate(getDate2(event2));
      if (!date2) return;
      
      if (isWithinTimeWindow(date1, date2, windowDays) && !isSameDay(date1, date2)) {
        const daysDiff = daysBetween(date1, date2);
        correlations.push({
          event1,
          event2,
          date1,
          date2,
          daysDiff: Math.abs(daysDiff),
          direction: daysDiff > 0 ? 'event1-first' : 'event2-first'
        });
      }
    });
  });
  
  return correlations;
}

/**
 * Group events by date for chronological views
 * @param {Array} events - Array of events with date property
 * @param {Function} getDate - Function to extract date from event (default: event.date)
 * @returns {Array<Object>} - Array of { date, events } objects, sorted by date (newest first)
 */
export function groupEventsByDate(events, getDate = (event) => event.date) {
  const grouped = new Map();
  
  events.forEach(event => {
    const dateStr = normalizeDate(getDate(event));
    if (dateStr) {
      if (!grouped.has(dateStr)) {
        grouped.set(dateStr, []);
      }
      grouped.get(dateStr).push(event);
    }
  });
  
  return Array.from(grouped.entries())
    .map(([date, events]) => ({ date, events }))
    .sort((a, b) => b.date.localeCompare(a.date)); // Newest first
}

/**
 * Filter events by date range
 * @param {Array} events - Array of events with date property
 * @param {Date|string} startDate - Start date (inclusive)
 * @param {Date|string} endDate - End date (inclusive)
 * @param {Function} getDate - Function to extract date from event (default: event.date)
 * @returns {Array} - Filtered events within date range
 */
export function filterByDateRange(events, startDate, endDate, getDate = (event) => event.date) {
  const start = normalizeDate(startDate);
  const end = normalizeDate(endDate);
  if (!start || !end) return events;
  
  return events.filter(event => {
    const eventDate = normalizeDate(getDate(event));
    if (!eventDate) return false;
    return eventDate >= start && eventDate <= end;
  });
}

/**
 * Calculate date relative to a treatment start date
 * @param {Date|string|FirestoreTimestamp} treatmentStartDate - Treatment start date
 * @param {Date|string|FirestoreTimestamp} eventDate - Event date
 * @returns {number|null} - Days since treatment start (positive = after, negative = before)
 */
export function daysSinceTreatmentStart(treatmentStartDate, eventDate) {
  return daysBetween(eventDate, treatmentStartDate);
}

/**
 * Get date range for last N months
 * @param {number} months - Number of months to go back (default: 18)
 * @returns {Object} - { startDate: string, endDate: string } in YYYY-MM-DD format
 */
export function getLastNMonthsRange(months = 18) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);
  
  return {
    startDate: normalizeDate(startDate),
    endDate: normalizeDate(endDate)
  };
}
