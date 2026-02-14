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
]);

// Vital keys we recognise (lowercased)
const KNOWN_VITAL_KEYS = new Set([
  'bp', 'blood_pressure', 'bloodpressure',
  'heartrate', 'hr', 'heart_rate', 'pulse',
  'temperature', 'temp',
  'oxygen_saturation', 'o2sat', 'spo2',
  'respiratory_rate', 'rr', 'respiratoryrate',
  'weight',
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
  const categoryScores = {};

  for (const [category, metrics] of Object.entries(categorized)) {
    if (!LAB_SAFETY_CATEGORIES.has(category)) continue;
    if (!metrics || metrics.length === 0) continue;

    const insight = calculateSectionInsight(category, metrics);
    if (insight.score == null) continue;

    categoryScores[category] = insight.score;
    totalScore += insight.score;
    count++;
  }

  if (count === 0) return null;

  return {
    score: Math.round(totalScore / count),
    details: { categoryScores, categoryCount: count },
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

  let total = 0;
  let count = 0;
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

    vitalScores[key] = { value, status, points };
    total += points;
    count++;
  }

  if (count === 0) return null;

  return {
    score: Math.round(total / count),
    details: { vitalScores, vitalCount: count },
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

  let penalty = 0;
  for (const s of recent) {
    const sev = (s.severity || 'moderate').toLowerCase();
    penalty += SEVERITY_PENALTY[sev] ?? SEVERITY_PENALTY.moderate;
  }

  const score = Math.max(0, 100 - penalty);
  return {
    score,
    details: { recentCount: recent.length, penaltyTotal: penalty },
  };
}

/**
 * Disease Markers: score from trend alert directions.
 * Uses trendAlerts already computed by DashboardTab.
 */
function scoreDiseaseMarkers(trendAlerts) {
  if (!Array.isArray(trendAlerts) || trendAlerts.length === 0) return null;

  // Filter to tumor marker alerts only (metricType === 'lab' + cancer-relevant keys)
  const TUMOR_MARKER_KEYS = new Set([
    'ca125', 'cea', 'afp', 'psa', 'ca199', 'ca153', 'ca724',
    'ca242', 'ca50', 'he4', 'ca2729', 'ca549',
  ]);

  const markerAlerts = trendAlerts.filter((a) => {
    if (a.metricType !== 'lab') return false;
    const key = (a.key || a.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return TUMOR_MARKER_KEYS.has(key);
  });

  if (markerAlerts.length === 0) return null;

  // Score each alert
  const SIGNAL_SCORES = {
    improving: 100,
    stable: 90,
    notable: 60,
    concerning: 25,
  };

  let total = 0;
  for (const alert of markerAlerts) {
    const signalType = alert.signalType || 'notable';
    let base = SIGNAL_SCORES[signalType] ?? 60;

    // Refine based on severity
    if (signalType === 'concerning' && alert.severity === 'high') {
      base = 10;
    } else if (signalType === 'concerning' && alert.severity === 'medium') {
      base = 25;
    }

    total += base;
  }

  const score = Math.round(total / markerAlerts.length);
  return {
    score,
    details: { markerAlertCount: markerAlerts.length },
  };
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

  // Simple ratio: recent logs / (active meds × 7 days)
  // Clamped to 1.0 (some patients log > 1x/day)
  const expectedDoses = active.length * 7;
  const adherenceRatio = Math.min(1, recentLogs.length / expectedDoses);
  const score = Math.round(adherenceRatio * 100);

  return {
    score,
    details: {
      activeMedCount: active.length,
      recentLogCount: recentLogs.length,
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
    diseaseMarkers: scoreDiseaseMarkers(trendAlerts),
    medications: scoreMedications(medications, medicationLogs),
  };

  // Build pillar output with labels/colors
  const pillars = {};
  let weightedSum = 0;
  let activeWeight = 0;
  let activePillarCount = 0;

  for (const [key, result] of Object.entries(pillarResults)) {
    const weight = PILLAR_WEIGHTS[key];
    if (result && result.score != null) {
      pillars[key] = {
        score: result.score,
        weight,
        label: scoreLabel(result.score),
        color: scoreColor(result.score),
        details: result.details,
      };
      weightedSum += result.score * weight;
      activeWeight += weight;
      activePillarCount++;
    } else {
      pillars[key] = {
        score: null,
        weight,
        label: 'No data',
        color: 'gray',
        details: null,
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
