/**
 * Utility functions for chart calculations and rendering
 */

import { numericValueForChart } from '../../../../utils/healthUtils';

/** ~3–4 months of data points visible in viewport when scrolling (ALL view) - desktop */
export const POINTS_PER_VIEWPORT = 60;
/** ~1 month visible on mobile - fewer dots for readability */
export const POINTS_PER_VIEWPORT_MOBILE = 20;
/** When "All" is selected and data exceeds this, use scrollable chart */
export const SCROLL_THRESHOLD = POINTS_PER_VIEWPORT;
/** Base chart width (no scroll) */
const BASE_CHART_WIDTH = 400;

/**
 * Get chart width - when "All" with scroll, use dataLength for SVG coords (CSS handles 6mo viewport)
 * @param {number} dataLength - Number of data points
 * @param {string} timeRange - '7d' | '30d' | '90d' | 'all'
 * @returns {number} Chart width (pixels for non-scroll, dataLength for scroll SVG coords)
 */
export function getChartWidth(dataLength, timeRange) {
  if (timeRange !== 'all' || dataLength <= SCROLL_THRESHOLD) {
    return BASE_CHART_WIDTH;
  }
  // Scroll mode: use 1 unit per point for SVG; CSS calc ensures ~6mo visible in viewport
  return dataLength;
}

/**
 * Calculate Y-axis bounds for a chart based on data and normal range
 * @param {Array} data - Array of data points with value property
 * @param {string} normalRange - Normal range string (e.g., "0-35", "< 0.5", "> 60")
 * @returns {Object} - { yMin, yMax, yRange }
 */
export function calculateYAxisBounds(data, normalRange = null) {
  const values = data
    .map(d => numericValueForChart(d.value))
    .filter(v => typeof v === 'number' && !isNaN(v) && isFinite(v));

  if (values.length === 0) {
    return { yMin: 0, yMax: 100, yRange: 100 };
  }

  let minVal = Math.min(...values);
  let maxVal = Math.max(...values);

  // Parse normal range if available (supports negative numbers and zero)
  if (normalRange) {
    // Try standard range format "X-Y" (e.g., "-5-5", "0-10", "-10--5")
    let rangeMatch = normalRange.match(/(-?\d+\.?\d*)\s*-\s*(-?\d+\.?\d*)/);
    if (rangeMatch) {
      const normMin = parseFloat(rangeMatch[1]);
      const normMax = parseFloat(rangeMatch[2]);
      if (!isNaN(normMin) && !isNaN(normMax)) {
        minVal = Math.min(minVal, normMin);
        maxVal = Math.max(maxVal, normMax);
      }
    } else {
      // Try "< X" format (e.g., "< 0.5", "< -5")
      const lessThanMatch = normalRange.match(/<\s*(-?\d+\.?\d*)/);
      if (lessThanMatch) {
        const threshold = parseFloat(lessThanMatch[1]);
        if (!isNaN(threshold)) {
          minVal = Math.min(minVal, 0);
          maxVal = Math.max(maxVal, threshold);
        }
      } else {
        // Try "> X" format (e.g., "> 60", "> -10")
        const greaterThanMatch = normalRange.match(/>\s*(-?\d+\.?\d*)/);
        if (greaterThanMatch) {
          const threshold = parseFloat(greaterThanMatch[1]);
          if (!isNaN(threshold)) {
            minVal = Math.min(minVal, threshold);
          }
        }
      }
    }
  }

  const range = maxVal - minVal;
  const padding = range * 0.2 || 10; // Fallback if range is 0
  const yMin = Math.floor(minVal - padding);
  const yMax = Math.ceil(maxVal + padding);
  const yRange = yMax - yMin || 1; // Prevent division by zero

  return { yMin, yMax, yRange };
}

/**
 * Calculate Y-axis bounds for blood pressure (systolic + diastolic)
 * @param {Array} data - Array of { value (systolic), diastolic }
 * @param {string} normalRange - e.g. "<140/90"
 * @returns {Object} - { yMin, yMax, yRange }
 */
export function calculateYAxisBoundsForBloodPressure(data, normalRange = null) {
  const values = [];
  data.forEach((d) => {
    let sys = numericValueForChart(d.systolic ?? d.value);
    let dia = numericValueForChart(d.diastolic);
    // Parse "136/85" from value when systolic/diastolic not stored (legacy data)
    if ((d.systolic == null || d.diastolic == null) && typeof d.value === 'string') {
      const parts = d.value.trim().split('/');
      if (parts.length === 2) {
        const s = parseFloat(parts[0].trim());
        const di = parseFloat(parts[1].trim());
        if (!isNaN(s)) sys = s;
        if (!isNaN(di)) dia = di;
      }
    }
    if (typeof sys === 'number' && !isNaN(sys)) values.push(sys);
    if (typeof dia === 'number' && !isNaN(dia)) values.push(dia);
  });

  if (values.length === 0) return { yMin: 50, yMax: 180, yRange: 130 };

  let minVal = Math.min(...values);
  let maxVal = Math.max(...values);

  if (normalRange) {
    const bpMatch = normalRange.match(/<\s*(\d+)\/(\d+)/);
    if (bpMatch) {
      const sysThresh = parseFloat(bpMatch[1]);
      const diaThresh = parseFloat(bpMatch[2]);
      if (!isNaN(sysThresh)) maxVal = Math.max(maxVal, sysThresh);
      if (!isNaN(diaThresh)) maxVal = Math.max(maxVal, diaThresh);
      minVal = Math.min(minVal, 50, diaThresh ? diaThresh - 30 : 50);
    }
  }

  const range = maxVal - minVal;
  const padding = Math.max(range * 0.1, 10);
  const yMin = Math.max(0, Math.floor(minVal - padding));
  const yMax = Math.ceil(maxVal + padding);

  return { yMin, yMax, yRange: yMax - yMin };
}

/**
 * Generate Y-axis labels for a chart
 * @param {number} yMin - Minimum Y value
 * @param {number} yMax - Maximum Y value
 * @returns {Array<number>} - Array of Y-axis label values
 */
export function generateYAxisLabels(yMin, yMax) {
  const step = (yMax - yMin) / 4;
  return [4, 3, 2, 1, 0].map(i => yMin + (step * i));
}

/**
 * Parse normal range for chart rendering
 * Returns object with bounds for rendering normal range area
 * @param {string} normalRange - Normal range string
 * @param {number} yMin - Chart minimum Y value
 * @param {number} yRange - Chart Y range
 * @returns {Object|null} - { normMinY, normMaxY, thresholdY, type } or null
 */
export function parseNormalRangeForChart(normalRange, yMin, yRange) {
  if (!normalRange) return null;

  // Try standard range format "X-Y" (supports negative numbers and zero)
  let rangeMatch = normalRange.match(/(-?\d+\.?\d*)\s*-\s*(-?\d+\.?\d*)/);
  if (rangeMatch) {
    const normMin = parseFloat(rangeMatch[1]);
    const normMax = parseFloat(rangeMatch[2]);
    if (!isNaN(normMin) && !isNaN(normMax) && isFinite(normMin) && isFinite(normMax)) {
      const normMinY = 160 - ((normMin - yMin) / yRange) * 160;
      const normMaxY = 160 - ((normMax - yMin) / yRange) * 160;
      return { normMinY, normMaxY, type: 'range' };
    }
  }

  // Try "< X" format (e.g., "< 0.5", "< -5")
  const lessThanMatch = normalRange.match(/<\s*(-?\d+\.?\d*)/);
  if (lessThanMatch) {
    const threshold = parseFloat(lessThanMatch[1]);
    if (!isNaN(threshold) && isFinite(threshold)) {
      const thresholdY = 160 - ((threshold - yMin) / yRange) * 160;
      return { thresholdY, type: 'lessThan' };
    }
  }

  // Try "> X" format (e.g., "> 60", "> -10")
  const greaterThanMatch = normalRange.match(/>\s*(-?\d+\.?\d*)/);
  if (greaterThanMatch) {
    const threshold = parseFloat(greaterThanMatch[1]);
    if (!isNaN(threshold) && isFinite(threshold)) {
      const thresholdY = 160 - ((threshold - yMin) / yRange) * 160;
      return { thresholdY, type: 'greaterThan' };
    }
  }

  return null;
}

/**
 * Parse normal range for Recharts ReferenceArea/ReferenceLine
 * Returns config for rendering normal range on Recharts (uses Y-axis domain values)
 * @param {string} normalRange - Normal range string (e.g., "0-35", "< 0.5", "> 60", "<140/90")
 * @param {number} yMin - Chart minimum Y value
 * @param {number} yMax - Chart maximum Y value
 * @param {boolean} isBloodPressure - If true, parse BP format "<140/90" for systolic
 * @returns {Object|null} - { type: 'range'|'lessThan'|'greaterThan', area: { y1, y2 }, line?: { y } } or null
 */
export function parseNormalRangeForRecharts(normalRange, yMin, yMax, isBloodPressure = false) {
  if (!normalRange) return null;

  // BP format "<140/90" - return both systolic and diastolic thresholds
  const bpMatch = isBloodPressure && normalRange.match(/<\s*(\d+)\/(\d+)/);
  if (bpMatch) {
    const systolicThresh = parseFloat(bpMatch[1]);
    const diastolicThresh = parseFloat(bpMatch[2]);
    if (!isNaN(systolicThresh) && isFinite(systolicThresh)) {
      return {
        type: 'bloodPressure',
        line: { y: systolicThresh, label: 'Systolic' },
        line2: !isNaN(diastolicThresh) && isFinite(diastolicThresh)
          ? { y: diastolicThresh, label: 'Diastolic' }
          : null
      };
    }
  }

  // Standard range "X-Y"
  const rangeMatch = normalRange.match(/(-?\d+\.?\d*)\s*-\s*(-?\d+\.?\d*)/);
  if (rangeMatch) {
    const normMin = parseFloat(rangeMatch[1]);
    const normMax = parseFloat(rangeMatch[2]);
    if (!isNaN(normMin) && !isNaN(normMax) && isFinite(normMin) && isFinite(normMax)) {
      return {
        type: 'range',
        area: { y1: normMin, y2: normMax },
        line: null
      };
    }
  }

  // "< X" format
  const lessThanMatch = normalRange.match(/<\s*(-?\d+\.?\d*)/);
  if (lessThanMatch) {
    const threshold = parseFloat(lessThanMatch[1]);
    if (!isNaN(threshold) && isFinite(threshold)) {
      return {
        type: 'lessThan',
        area: { y1: yMin, y2: threshold },
        line: { y: threshold }
      };
    }
  }

  // "> X" format
  const greaterThanMatch = normalRange.match(/>\s*(-?\d+\.?\d*)/);
  if (greaterThanMatch) {
    const threshold = parseFloat(greaterThanMatch[1]);
    if (!isNaN(threshold) && isFinite(threshold)) {
      return {
        type: 'greaterThan',
        area: { y1: threshold, y2: yMax },
        line: { y: threshold }
      };
    }
  }

  return null;
}

/**
 * Generate chart SVG path points
 * @param {Array} data - Array of data points
 * @param {number} yMin - Minimum Y value
 * @param {number} yRange - Y range
 * @param {number} width - Chart width (default 400)
 * @returns {string} - SVG path points string
 */
export function generateChartPoints(data, yMin, yRange, width = 400) {
  const dataLength = Math.max(data.length - 1, 1); // Prevent division by zero
  return data.map((d, i) => {
    const val = numericValueForChart(d.value);
    const v = (typeof val === 'number' && !isNaN(val)) ? val : 0;
    const x = (i / dataLength) * width;
    const y = 160 - ((v - yMin) / yRange) * 160;
    return `${x},${y}`;
  }).join(' ');
}