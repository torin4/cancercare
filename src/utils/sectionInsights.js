/**
 * Section Insights Calculation Utilities
 *
 * Calculates health insights for each lab category section.
 * Uses CTCAE grading for applicable categories, status-based
 * summaries for others, and trend analysis for tumor markers.
 *
 * Labels use PRO-CTCAE (Patient-Reported Outcomes) terminology:
 * - Normal, Mild, Moderate, Severe, Very severe
 * Source: NCI PRO-CTCAE https://healthcaredelivery.cancer.gov/pro-ctcae/
 */

import {
  calculateCTCAEGrade,
  parseNormalRange,
  hasCTCAEGrading,
  getCategoryInsightType,
  ctcaeGradableCategories
} from './ctcaeGrading';
import { normalizeLabName } from './normalizationUtils';

/**
 * PRO-CTCAE severity labels based on score ranges
 * Source: NCI PRO-CTCAE https://healthcaredelivery.cancer.gov/pro-ctcae/
 *
 * @param {number} score - Health score (0-100)
 * @param {number} worstGrade - Worst CTCAE grade in the section (0-4)
 * @returns {string} PRO-CTCAE severity label
 */
function getSeverityLabel(score, worstGrade = 0) {
  // If we have a worst grade, use that to determine label
  if (worstGrade >= 4) return 'Very severe';
  if (worstGrade >= 3) return 'Severe';
  if (worstGrade >= 2) return 'Moderate';
  if (worstGrade >= 1) return 'Mild';

  // Fallback to score-based label
  if (score >= 100) return 'Normal';
  if (score >= 75) return 'Mild';
  if (score >= 50) return 'Moderate';
  if (score >= 25) return 'Severe';
  return 'Very severe';
}

/**
 * Calculate section insight for a category
 *
 * @param {string} category - Category name (e.g., "Liver Function")
 * @param {Array} metrics - Array of [key, labData] tuples for this category
 * @returns {object} Insight object with score, counts, and display info
 */
export function calculateSectionInsight(category, metrics) {
  if (!metrics || metrics.length === 0) {
    return {
      type: 'empty',
      score: null,
      label: 'No data',
      color: 'gray',
      details: null
    };
  }

  const insightType = getCategoryInsightType(category);

  switch (insightType) {
    case 'ctcae':
      return calculateCTCAEInsight(category, metrics);
    case 'trend':
      return calculateTrendInsight(category, metrics);
    case 'status':
    default:
      return calculateStatusInsight(category, metrics);
  }
}

/**
 * Calculate CTCAE-based insight for gradable categories
 * Uses CTCAE grades to compute a weighted health score
 *
 * @param {string} category - Category name
 * @param {Array} metrics - Array of [key, labData] tuples
 * @returns {object} Insight with score (0-100), grade distribution, etc.
 */
function calculateCTCAEInsight(category, metrics) {
  const gradeResults = [];
  let gradableCount = 0;
  let totalScore = 0;

  for (const [key, lab] of metrics) {
    const labType = normalizeLabName(lab.labType || lab.name || key);
    const value = lab.currentValue ?? lab.current;
    const normalRange = lab.normalRange;

    // Skip if no value
    if (value === null || value === undefined || isNaN(parseFloat(value))) {
      continue;
    }

    const numericValue = parseFloat(value);

    // Try to get CTCAE grade
    if (hasCTCAEGrading(labType)) {
      const { uln, lln } = parseNormalRange(normalRange);
      const gradeResult = calculateCTCAEGrade(labType, numericValue, { uln, lln });

      if (gradeResult.grade !== null) {
        gradeResults.push({
          labType,
          name: lab.name,
          value: numericValue,
          grade: gradeResult.grade,
          direction: gradeResult.direction
        });

        gradableCount++;
        // Score: Grade 0 = 100%, Grade 1 = 75%, Grade 2 = 50%, Grade 3 = 25%, Grade 4 = 0%
        totalScore += Math.max(0, 100 - (gradeResult.grade * 25));
      }
    } else {
      // Fallback to status-based for labs without CTCAE criteria
      const statusScore = getScoreFromStatus(lab.status);
      if (statusScore !== null) {
        gradeResults.push({
          labType,
          name: lab.name,
          value: numericValue,
          grade: statusScore === 100 ? 0 : (statusScore === 50 ? 2 : 3),
          direction: lab.status === 'high' ? 'high' : (lab.status === 'low' ? 'low' : null)
        });
        gradableCount++;
        totalScore += statusScore;
      }
    }
  }

  if (gradableCount === 0) {
    return {
      type: 'ctcae',
      score: null,
      label: 'No gradable labs',
      color: 'gray',
      details: { gradableCount: 0, gradeResults: [] }
    };
  }

  const averageScore = Math.round(totalScore / gradableCount);

  // Count grades
  const gradeCounts = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
  gradeResults.forEach(r => {
    if (r.grade >= 0 && r.grade <= 4) {
      gradeCounts[r.grade]++;
    }
  });

  // Determine overall color based on worst grade
  const worstGrade = Math.max(...gradeResults.map(r => r.grade));
  const color = getColorFromScore(averageScore, worstGrade);

  // Generate label using PRO-CTCAE terminology
  const abnormalCount = gradeResults.filter(r => r.grade > 0).length;
  const label = abnormalCount === 0
    ? 'Normal'
    : getSeverityLabel(averageScore, worstGrade);

  return {
    type: 'ctcae',
    score: averageScore,
    label,
    color,
    worstGrade,
    details: {
      gradableCount,
      gradeResults,
      gradeCounts,
      abnormalCount
    }
  };
}

/**
 * Calculate status-based insight for non-CTCAE categories
 * Simply counts normal/abnormal/unknown statuses
 *
 * @param {string} category - Category name
 * @param {Array} metrics - Array of [key, labData] tuples
 * @returns {object} Insight with status counts
 */
function calculateStatusInsight(category, metrics) {
  const statusCounts = {
    normal: 0,
    high: 0,
    low: 0,
    unknown: 0
  };

  let validCount = 0;

  for (const [key, lab] of metrics) {
    const status = lab.status || 'unknown';
    if (statusCounts.hasOwnProperty(status)) {
      statusCounts[status]++;
    } else {
      statusCounts.unknown++;
    }

    if (status !== 'unknown') {
      validCount++;
    }
  }

  const totalWithStatus = statusCounts.normal + statusCounts.high + statusCounts.low;
  const abnormalCount = statusCounts.high + statusCounts.low;

  // Calculate score: normal = 100, abnormal = 0, unknown excluded
  let score = null;
  if (totalWithStatus > 0) {
    score = Math.round((statusCounts.normal / totalWithStatus) * 100);
  }

  // Determine color and severity based on proportion of abnormal results
  let color = 'gray';
  let severityGrade = 0;
  if (totalWithStatus > 0) {
    const abnormalRatio = abnormalCount / totalWithStatus;
    if (abnormalCount === 0) {
      color = 'green';
      severityGrade = 0;
    } else if (abnormalRatio >= 0.75) {
      color = 'red';
      severityGrade = 4; // Very severe
    } else if (abnormalRatio >= 0.5) {
      color = 'red';
      severityGrade = 3; // Severe
    } else if (abnormalRatio >= 0.25) {
      color = 'yellow';
      severityGrade = 2; // Moderate
    } else {
      color = 'yellow';
      severityGrade = 1; // Mild
    }
  }

  // Generate label using PRO-CTCAE terminology
  let label = 'No data';
  if (totalWithStatus > 0) {
    label = abnormalCount === 0
      ? 'Normal'
      : getSeverityLabel(score, severityGrade);
  }

  return {
    type: 'status',
    score,
    label,
    color,
    details: {
      statusCounts,
      totalWithStatus,
      abnormalCount
    }
  };
}

/**
 * Calculate trend-based insight for tumor markers
 * Focuses on whether markers are trending up, down, or stable
 *
 * @param {string} category - Category name
 * @param {Array} metrics - Array of [key, labData] tuples
 * @returns {object} Insight with trend summary
 */
function calculateTrendInsight(category, metrics) {
  const trends = {
    increasing: 0,
    decreasing: 0,
    stable: 0,
    unknown: 0
  };

  const statusCounts = {
    normal: 0,
    high: 0,
    low: 0,
    unknown: 0
  };

  for (const [key, lab] of metrics) {
    // Count trends
    const trend = lab.trend || 'unknown';
    if (trends.hasOwnProperty(trend)) {
      trends[trend]++;
    } else {
      trends.unknown++;
    }

    // Also count statuses for color
    const status = lab.status || 'unknown';
    if (statusCounts.hasOwnProperty(status)) {
      statusCounts[status]++;
    }
  }

  const totalWithTrend = trends.increasing + trends.decreasing + trends.stable;

  // For tumor markers, "increasing" is concerning, "decreasing" or "stable" is good
  // Color based on trends: increasing = red, stable = green, decreasing = green
  let color = 'gray';
  let label = 'No trend data';

  if (totalWithTrend > 0) {
    if (trends.increasing > 0) {
      color = 'red';
      label = trends.increasing === 1
        ? '1 marker rising'
        : `${trends.increasing} markers rising`;
    } else if (trends.decreasing > 0) {
      color = 'green';
      label = trends.decreasing === 1
        ? '1 marker falling'
        : `${trends.decreasing} markers falling`;
    } else {
      color = 'green';
      label = 'All stable';
    }
  } else if (metrics.length > 0) {
    // No trend data, fall back to status
    const abnormalCount = statusCounts.high + statusCounts.low;
    const normalCount = statusCounts.normal;
    const total = abnormalCount + normalCount;

    if (total > 0) {
      if (abnormalCount === 0) {
        color = 'green';
        label = 'All in range';
      } else {
        color = statusCounts.high > 0 ? 'yellow' : 'gray';
        label = `${abnormalCount} elevated`;
      }
    }
  }

  return {
    type: 'trend',
    score: null, // Trends don't have a numeric score
    label,
    color,
    details: {
      trends,
      statusCounts,
      totalWithTrend
    }
  };
}

/**
 * Convert a status string to a score
 *
 * @param {string} status - 'normal', 'high', 'low', 'unknown'
 * @returns {number|null} Score (0-100) or null if unknown
 */
function getScoreFromStatus(status) {
  switch (status) {
    case 'normal':
      return 100;
    case 'high':
    case 'low':
      return 0;
    default:
      return null;
  }
}

/**
 * Determine display color based on score and worst grade
 *
 * @param {number} score - Average score (0-100)
 * @param {number} worstGrade - Worst CTCAE grade in the section
 * @returns {'green'|'yellow'|'red'|'gray'}
 */
function getColorFromScore(score, worstGrade = 0) {
  // If any grade 3 or 4, show red
  if (worstGrade >= 3) {
    return 'red';
  }

  // If any grade 2, show yellow even if score is decent
  if (worstGrade >= 2) {
    return 'yellow';
  }

  // Otherwise base on score
  if (score >= 80) {
    return 'green';
  } else if (score >= 50) {
    return 'yellow';
  } else {
    return 'red';
  }
}

/**
 * Get all section insights for a set of categorized labs
 *
 * @param {object} categorizedLabs - Object with category names as keys, arrays of [key, lab] as values
 * @returns {object} Object with category names as keys, insight objects as values
 */
export function getAllSectionInsights(categorizedLabs) {
  const insights = {};

  for (const [category, metrics] of Object.entries(categorizedLabs)) {
    insights[category] = calculateSectionInsight(category, metrics);
  }

  return insights;
}
