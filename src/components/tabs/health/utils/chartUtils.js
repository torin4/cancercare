/**
 * Utility functions for chart calculations and rendering
 */

/**
 * Calculate Y-axis bounds for a chart based on data and normal range
 * @param {Array} data - Array of data points with value property
 * @param {string} normalRange - Normal range string (e.g., "0-35", "< 0.5", "> 60")
 * @returns {Object} - { yMin, yMax, yRange }
 */
export function calculateYAxisBounds(data, normalRange = null) {
  // Filter out non-numeric values and ensure we have valid numbers
  const values = data
    .map(d => parseFloat(d.value))
    .filter(v => !isNaN(v) && isFinite(v));

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
    const val = parseFloat(d.value);
    const x = (i / dataLength) * width;
    const y = 160 - ((val - yMin) / yRange) * 160;
    return `${x},${y}`;
  }).join(' ');
}