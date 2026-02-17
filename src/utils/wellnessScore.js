/**
 * Cancer Treatment Wellness Score
 *
 * Aggregates available health data into a single 0-100 headline score
 * with five clinical pillars weighted for cancer treatment relevance.
 *
 * Pillars:
 *   Lab Safety        (35%) – CTCAE-graded organ function & blood counts
 *   Vitals Stability  (15%) – vital sign status (BP, HR, temp, O2, etc.)
 *   Symptom Burden    (20%) – recent symptom count × severity
 *   Disease Markers   (20%) – tumor marker trend direction
 *   Medication Adherence (10%) – active meds vs logged doses
 *
 * Pillars without data are excluded and their weight is redistributed.
 */

import { calculateSectionInsight } from './sectionInsights';
import { categorizeLabs } from './normalizationUtils';
import { getVitalStatus } from './healthUtils';

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * Return a staleness discount factor based on how old the newest data point is.
 * Fresh data (<30 days) = 1.0, aging data = 0.9 / 0.75, stale (>90 days) = 0.6.
 */
function stalenessFactor(newestTimestampMs) {
  if (!newestTimestampMs) return 1;
  const ageMs = Date.now() - newestTimestampMs;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  if (ageDays <= 30) return 1;
  if (ageDays <= 60) return 0.9;
  if (ageDays <= 90) return 0.75;
  return 0.6;
}

function stalenessLabel(newestTimestampMs) {
  if (!newestTimestampMs) return null;
  const ageDays = (Date.now() - newestTimestampMs) / (1000 * 60 * 60 * 24);
  if (ageDays <= 30) return null;
  if (ageDays <= 60) return 'Aging data';
  if (ageDays <= 90) return 'Stale data';
  return 'Very stale';
}

function scoreLabel(score) {
  if (score >= 80) return 'Good';
  if (score >= 60) return 'Fair';
  if (score >= 40) return 'Needs Attention';
  return 'Concerning';
}

function scoreColor(score) {
  if (score >= 80) return 'green';
  if (score >= 60) return 'yellow';
  if (score >= 40) return 'orange';
  return 'red';
}

const PILLAR_WEIGHTS = {
  labSafety: 0.35,
  vitals: 0.15,
  symptoms: 0.20,
  diseaseMarkers: 0.20,
  medications: 0.10,
};

// CTCAE-gradable categories that contribute to the Lab Safety pillar
const LAB_SAFETY_CATEGORIES = new Set([
  'Liver Function',
  'Kidney Function',
  'Blood Counts',
  'Electrolytes',
  'Coagulation',
  'Inflammation',
]);

// Vital keys we recognise (lowercased)
const KNOWN_VITAL_KEYS = new Set([
  'bp', 'blood_pressure', 'bloodpressure',
  'heartrate', 'hr', 'heart_rate', 'pulse',
  'temperature', 'temp',
  'oxygen_saturation', 'o2sat', 'spo2',
  'respiratory_rate', 'rr', 'respiratoryrate',
  'weight',
  'sleep_score', 'sleepscore',
]);

// ── Pillar Scorers ───────────────────────────────────────────────────────

/**
 * Lab Safety: average section insight scores for CTCAE-gradable categories.
 */
function scoreLabSafety(labsData) {
  if (!labsData || typeof labsData !== 'object' || Object.keys(labsData).length === 0) {
    return null;
  }

  const categorized = categorizeLabs(labsData);
  if (!categorized || Object.keys(categorized).length === 0) return null;

  let totalScore = 0;
  let count = 0;
  let worstGradeOverall = 0;
  const categoryScores = {};

  for (const [category, metrics] of Object.entries(categorized)) {
    if (!LAB_SAFETY_CATEGORIES.has(category)) continue;
    if (!metrics || metrics.length === 0) continue;

    const insight = calculateSectionInsight(category, metrics);
    if (insight.score == null) continue;

    categoryScores[category] = insight.score;
    totalScore += insight.score;
    count++;

    // Track worst CTCAE grade across all categories
    if (insight.worstGrade != null && insight.worstGrade > worstGradeOverall) {
      worstGradeOverall = insight.worstGrade;
    }
  }

  if (count === 0) return null;

  let score = Math.round(totalScore / count);

  // Cap score when any critical CTCAE grade is present —
  // a single Grade 4 lab should not be hidden by otherwise-normal results
  if (worstGradeOverall >= 4) {
    score = Math.min(score, 25);
  } else if (worstGradeOverall >= 3) {
    score = Math.min(score, 50);
  }

  return {
    score,
    details: { categoryScores, categoryCount: count, worstGrade: worstGradeOverall },
  };
}

/**
 * Vitals Stability: map each vital's status → points, average across vitals with data.
 */
function scoreVitals(vitalsData) {
  if (!vitalsData || typeof vitalsData !== 'object') return null;

  const STATUS_POINTS = {
    normal: 100,
    'warning-high': 70,
    'warning-low': 70,
    'abnormal-high': 30,
    'abnormal-low': 30,
    unknown: null, // excluded
  };

  // Clinical importance weights — O2 and BP are more urgent than weight/sleep
  const CLINICAL_WEIGHTS = {
    oxygen_saturation: 1.5, o2sat: 1.5, spo2: 1.5,
    bp: 1.3, blood_pressure: 1.3, bloodpressure: 1.3,
    heartrate: 1.2, hr: 1.2, heart_rate: 1.2, pulse: 1.2,
    temperature: 1.2, temp: 1.2,
    respiratory_rate: 1.1, rr: 1.1, respiratoryrate: 1.1,
    weight: 0.8,
    sleep_score: 0.8, sleepscore: 0.8,
  };

  let weightedTotal = 0;
  let totalWeight = 0;
  const vitalScores = {};

  for (const [key, vital] of Object.entries(vitalsData)) {
    if (!KNOWN_VITAL_KEYS.has(key.toLowerCase())) continue;
    if (!vital) continue;

    const value = vital.current ?? vital.currentValue;
    const normalRange = vital.normalRange;
    if (value == null || !normalRange) continue;

    const vitalType = key.toLowerCase();
    const { status } = getVitalStatus(value, normalRange, vitalType);
    const points = STATUS_POINTS[status];
    if (points == null) continue;

    const clinicalWeight = CLINICAL_WEIGHTS[vitalType] || 1;
    vitalScores[key] = { value, status, points };
    weightedTotal += points * clinicalWeight;
    totalWeight += clinicalWeight;
  }

  if (totalWeight === 0) return null;

  return {
    score: Math.round(weightedTotal / totalWeight),
    details: { vitalScores, vitalCount: Object.keys(vitalScores).length },
  };
}

/**
 * Symptom Burden: penalty per recent symptom based on severity.
 * No symptoms = 100 (positive signal).
 */
function scoreSymptoms(symptoms) {
  // No symptom data at all → pillar excluded
  if (!Array.isArray(symptoms)) return null;

  // Empty array = user has tracking but no symptoms → positive
  if (symptoms.length === 0) {
    return { score: 100, details: { recentCount: 0, penaltyTotal: 0 } };
  }

  const SEVERITY_PENALTY = {
    mild: 5,
    moderate: 15,
    severe: 30,
    'very severe': 40,
  };

  const TAG_MULTIPLIERS = {
    emergency: 2.0,
    worsening: 1.5,
    'treatment-related': 1.25,
    'side-effect': 1.25,
  };

  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  const recent = symptoms.filter((s) => {
    if (!s.date) return false;
    const d = s.date instanceof Date ? s.date : new Date(s.date);
    return !isNaN(d.getTime()) && d >= twoWeeksAgo;
  });

  if (recent.length === 0) {
    return { score: 100, details: { recentCount: 0, penaltyTotal: 0 } };
  }

  const now = Date.now();
  let penalty = 0;
  for (const s of recent) {
    const sev = (s.severity || 'moderate').toLowerCase();
    let basePenalty = SEVERITY_PENALTY[sev] ?? SEVERITY_PENALTY.moderate;

    // Apply highest tag multiplier (tags carry clinical weight)
    if (Array.isArray(s.tags) && s.tags.length > 0) {
      const maxMultiplier = Math.max(...s.tags.map((t) => TAG_MULTIPLIERS[t] || 1));
      basePenalty = Math.round(basePenalty * maxMultiplier);
    }

    // Time-decay: today = full penalty, 14 days ago = 25% penalty
    const symDate = s.date instanceof Date ? s.date : new Date(s.date);
    const daysAgo = (now - symDate.getTime()) / (1000 * 60 * 60 * 24);
    const decayFactor = Math.max(0.25, 1 - (daysAgo / 14) * 0.75);
    basePenalty = Math.round(basePenalty * decayFactor);

    penalty += basePenalty;
  }

  const score = Math.max(0, 100 - penalty);
  return {
    score,
    details: { recentCount: recent.length, penaltyTotal: penalty },
  };
}

/**
 * Disease Markers: score from tumor marker data + trend alert directions.
 *
 * Uses two sources:
 *   1. labsData — to find which tumor markers the patient is tracking
 *   2. trendAlerts — to check if any markers have triggered alerts
 *
 * Markers with data but no triggered alert are treated as stable (score 90).
 * This ensures stable markers contribute positively instead of being invisible.
 */
function scoreDiseaseMarkers(labsData, trendAlerts) {
  const TUMOR_MARKER_KEYS = new Set([
    'ca125', 'cea', 'afp', 'psa', 'ca199', 'ca153', 'ca724',
    'ca242', 'ca50', 'he4', 'ca2729', 'ca549',
  ]);

  // Find tumor markers present in labsData
  const trackedMarkers = new Set();
  if (labsData && typeof labsData === 'object') {
    const categorized = categorizeLabs(labsData);
    const diseaseMetrics = categorized['Disease-Specific Markers'] || [];
    for (const [key] of diseaseMetrics) {
      const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (TUMOR_MARKER_KEYS.has(normalized)) {
        trackedMarkers.add(normalized);
      }
    }
  }

  if (trackedMarkers.size === 0) return null;

  // Build a map of triggered alerts by marker key
  const alertByKey = {};
  if (Array.isArray(trendAlerts)) {
    for (const a of trendAlerts) {
      if (a.metricType !== 'lab') continue;
      const key = (a.metricKey || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      if (TUMOR_MARKER_KEYS.has(key)) {
        alertByKey[key] = a;
      }
    }
  }

  const SIGNAL_SCORES = {
    improving: 100,
    stable: 90,
    notable: 60,
    concerning: 25,
  };

  let total = 0;
  let scoredCount = 0;
  for (const markerKey of trackedMarkers) {
    const alert = alertByKey[markerKey];
    if (alert) {
      // Has a triggered trend alert
      const signalType = alert.signalType || 'notable';
      let base = SIGNAL_SCORES[signalType] ?? 60;
      if (signalType === 'concerning') {
        // Scale by percent change magnitude — a 200% spike is far worse than a 6% rise
        const pct = Math.abs(alert.percentChange || 0);
        if (pct > 100) base = 5;
        else if (pct > 50) base = 15;
        else if (pct > 25) base = 25;
        else base = 40;
      }
      total += base;
    } else {
      // No triggered alert — marker is stable
      total += SIGNAL_SCORES.stable;
    }
    scoredCount++;
  }

  const score = Math.round(total / scoredCount);
  return {
    score,
    details: { markerCount: scoredCount, alertedCount: Object.keys(alertByKey).length },
  };
}

/**
 * Parse medication frequency string into doses per week.
 * Returns 7 (once daily) as default for unrecognized formats.
 */
function parseDosesPerWeek(frequency) {
  if (!frequency) return 7;
  const f = frequency.toLowerCase().trim();

  // Common abbreviations
  if (/\b(bid|b\.i\.d)\b/.test(f) || /twice\s+(a\s+)?dai?ly/.test(f) || /2\s*x?\s*(a\s+)?dai?ly/.test(f)) return 14;
  if (/\b(tid|t\.i\.d)\b/.test(f) || /three\s+times\s+(a\s+)?dai?ly/.test(f) || /3\s*x?\s*(a\s+)?dai?ly/.test(f) || /every\s+8\s*h/.test(f)) return 21;
  if (/\b(qid|q\.i\.d)\b/.test(f) || /four\s+times\s+(a\s+)?dai?ly/.test(f) || /4\s*x?\s*(a\s+)?dai?ly/.test(f) || /every\s+6\s*h/.test(f)) return 28;
  if (/\b(qd|q\.d)\b/.test(f) || /once\s+(a\s+)?dai?ly/.test(f) || /1\s*x?\s*(a\s+)?dai?ly/.test(f) || /\bdai?ly\b/.test(f)) return 7;
  if (/every\s+12\s*h/.test(f)) return 14;
  if (/every\s+other\s+day/.test(f) || /\bqod\b/.test(f)) return 3.5;
  if (/\bweekly\b/.test(f) || /once\s+(a\s+)?week/.test(f)) return 1;
  if (/\bbiweekly\b/.test(f) || /every\s+(2|two)\s+weeks?/.test(f)) return 0.5;
  if (/\bmonthly\b/.test(f) || /once\s+(a\s+)?month/.test(f)) return 0.25;

  return 7; // default: once daily
}

/**
 * Medication Adherence: compares active medications to recent log entries.
 */
function scoreMedications(medications, medicationLogs) {
  if (!Array.isArray(medications) || medications.length === 0) return null;

  const active = medications.filter((m) => m.active !== false && m.status !== 'stopped');
  if (active.length === 0) return null;

  // No logs at all → unknown adherence
  if (!Array.isArray(medicationLogs) || medicationLogs.length === 0) {
    return {
      score: 50,
      details: { activeMedCount: active.length, recentLogCount: 0, adherenceRatio: 0 },
    };
  }

  // Count logs in last 7 days
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const recentLogs = medicationLogs.filter((log) => {
    const d = log.takenAt instanceof Date ? log.takenAt : new Date(log.takenAt);
    return !isNaN(d.getTime()) && d >= oneWeekAgo;
  });

  // Sum expected doses based on each medication's frequency
  const expectedDoses = active.reduce((sum, m) => sum + parseDosesPerWeek(m.frequency), 0);
  const adherenceRatio = Math.min(1, recentLogs.length / Math.max(1, expectedDoses));
  const score = Math.round(adherenceRatio * 100);

  return {
    score,
    details: {
      activeMedCount: active.length,
      recentLogCount: recentLogs.length,
      expectedDoses: Math.round(expectedDoses * 10) / 10,
      adherenceRatio: Math.round(adherenceRatio * 100) / 100,
    },
  };
}

// ── Composite Score ──────────────────────────────────────────────────────

/**
 * Calculate the composite wellness score from all available health data.
 *
 * @param {object} params
 * @param {object}  params.labsData        – labs keyed by type from HealthContext
 * @param {object}  params.vitalsData      – vitals keyed by type from HealthContext
 * @param {Array}   params.symptoms        – symptom documents (or null if not loaded)
 * @param {Array}   params.medications     – medication documents (or null if not loaded)
 * @param {Array}   params.medicationLogs  – medication log documents (or null if not loaded)
 * @param {Array}   params.trendAlerts     – trend alerts from buildTrendIntelligence
 * @returns {object} { overall, pillars, dataCompleteness, generatedAt }
 */
/**
 * Extract the newest timestamp (ms) from a keyed data object (labsData or vitalsData).
 * Each entry has a `data` array whose items have `timestamp` (ms).
 */
function newestTimestampFromKeyedData(keyedData) {
  if (!keyedData || typeof keyedData !== 'object') return null;
  let newest = 0;
  for (const entry of Object.values(keyedData)) {
    if (!entry?.data) continue;
    for (const d of entry.data) {
      if (d.timestamp > newest) newest = d.timestamp;
    }
  }
  return newest || null;
}

/**
 * Extract the newest date (ms) from an array of documents with a date field.
 */
function newestTimestampFromDocs(docs, dateField) {
  if (!Array.isArray(docs) || docs.length === 0) return null;
  let newest = 0;
  for (const d of docs) {
    const raw = d[dateField];
    if (!raw) continue;
    const ms = raw instanceof Date ? raw.getTime() : new Date(raw).getTime();
    if (!isNaN(ms) && ms > newest) newest = ms;
  }
  return newest || null;
}

export function calculateWellnessScore({
  labsData,
  vitalsData,
  symptoms,
  medications,
  medicationLogs,
  trendAlerts,
} = {}) {
  const pillarResults = {
    labSafety: scoreLabSafety(labsData),
    vitals: scoreVitals(vitalsData),
    symptoms: scoreSymptoms(symptoms),
    diseaseMarkers: scoreDiseaseMarkers(labsData, trendAlerts),
    medications: scoreMedications(medications, medicationLogs),
  };

  // Determine newest data timestamp per pillar for staleness discount
  const pillarNewest = {
    labSafety: newestTimestampFromKeyedData(labsData),
    vitals: newestTimestampFromKeyedData(vitalsData),
    symptoms: newestTimestampFromDocs(symptoms, 'date'),
    diseaseMarkers: newestTimestampFromKeyedData(labsData), // shares lab timestamps
    medications: newestTimestampFromDocs(medicationLogs, 'takenAt'),
  };

  // Build pillar output with labels/colors
  const pillars = {};
  let weightedSum = 0;
  let activeWeight = 0;
  let activePillarCount = 0;

  for (const [key, result] of Object.entries(pillarResults)) {
    const weight = PILLAR_WEIGHTS[key];
    if (result && result.score != null) {
      const newest = pillarNewest[key];
      const freshness = stalenessFactor(newest);
      const adjustedScore = Math.round(result.score * freshness);
      const stale = stalenessLabel(newest);

      pillars[key] = {
        score: adjustedScore,
        weight,
        label: scoreLabel(adjustedScore),
        color: scoreColor(adjustedScore),
        details: result.details,
        stale, // null if fresh, otherwise 'Aging data' / 'Stale data' / 'Very stale'
      };
      weightedSum += adjustedScore * weight;
      activeWeight += weight;
      activePillarCount++;
    } else {
      pillars[key] = {
        score: null,
        weight,
        label: 'No data',
        color: 'gray',
        details: null,
        stale: null,
      };
    }
  }

  // Need at least 1 pillar with data
  if (activePillarCount === 0 || activeWeight === 0) {
    return {
      overall: { score: null, label: 'Insufficient data', color: 'gray' },
      pillars,
      dataCompleteness: 0,
      generatedAt: new Date().toISOString(),
    };
  }

  // Redistribute weight across active pillars
  const compositeScore = Math.round(weightedSum / activeWeight);

  return {
    overall: {
      score: compositeScore,
      label: scoreLabel(compositeScore),
      color: scoreColor(compositeScore),
    },
    pillars,
    dataCompleteness: activePillarCount / Object.keys(PILLAR_WEIGHTS).length,
    generatedAt: new Date().toISOString(),
  };
}
