/**
 * Clinical Condition Detection
 *
 * Maps a metric key + current value to a named clinical condition (or null).
 * Uses CTCAE grading (Grade 2+) for labs and vital status thresholds for vitals.
 *
 * Returns: { name: string, severity: 'warning'|'critical', color: 'orange'|'red' } | null
 */

import { calculateCTCAEGrade, parseNormalRange, hasCTCAEGrading } from './ctcaeGrading';
import { getVitalStatus } from './healthUtils';
import { normalizeVitalName, normalizeLabName, labDefaultNormalRanges } from './normalizationUtils';

// ── Lab Condition Map ────────────────────────────────────────────────────
// Each entry: { name, minGrade } or { directionMap, minGrade } for bidirectional electrolytes

const LAB_CONDITIONS = {
  hemoglobin:      { name: 'Anemia',                 minGrade: 2 },
  anc:             { name: 'Neutropenia',             minGrade: 2 },
  neutrophils_abs: { name: 'Neutropenia',             minGrade: 2 },
  platelets:       { name: 'Thrombocytopenia',        minGrade: 2 },
  wbc:             { name: 'Leukopenia',              minGrade: 2 },
  lymphocytes_abs: { name: 'Lymphopenia',             minGrade: 2 },
  alt:             { name: 'Elevated Liver Enzymes',  minGrade: 2 },
  ast:             { name: 'Elevated Liver Enzymes',  minGrade: 2 },
  bilirubin_total: { name: 'Jaundice Risk',           minGrade: 2 },
  egfr:            { name: 'Reduced Kidney Function', minGrade: 2 },
  albumin:         { name: 'Hypoalbuminemia',         minGrade: 2 },
  creatinine:      { name: 'Elevated Creatinine',     minGrade: 2 },
  // Bidirectional electrolytes — condition name depends on direction (low vs high)
  sodium:    { directionMap: { low: 'Hyponatremia',      high: 'Hypernatremia' },      minGrade: 2 },
  potassium: { directionMap: { low: 'Hypokalemia',       high: 'Hyperkalemia' },       minGrade: 2 },
  calcium:   { directionMap: { low: 'Hypocalcemia',      high: 'Hypercalcemia' },      minGrade: 2 },
  magnesium: { directionMap: { low: 'Hypomagnesemia',    high: 'Hypermagnesemia' },    minGrade: 2 },
  phosphorus: { directionMap: { low: 'Hypophosphatemia', high: 'Hyperphosphatemia' },  minGrade: 2 },
  phosphate:  { directionMap: { low: 'Hypophosphatemia', high: 'Hyperphosphatemia' },  minGrade: 2 },
};

// ── Vital Condition Detectors ────────────────────────────────────────────

const VITAL_DETECTORS = {
  blood_pressure: (value, normalRange) => {
    const status = getVitalStatus(value, normalRange, 'bp');
    if (status.status === 'abnormal-low') return { name: 'Hypotension', severity: 'critical', color: 'red' };
    if (status.status === 'warning-low') return { name: 'Hypotension', severity: 'warning', color: 'orange' };
    return null;
  },

  temperature: (value) => {
    const num = parseFloat(value);
    if (isNaN(num)) return null;
    // Heuristic: if value > 50 assume Fahrenheit, otherwise Celsius
    const isCelsius = num <= 50;
    const fever = isCelsius ? num >= 38.0 : num >= 100.4;
    const highFever = isCelsius ? num >= 39.0 : num >= 102.2;
    if (fever) {
      return {
        name: 'Fever',
        severity: highFever ? 'critical' : 'warning',
        color: highFever ? 'red' : 'orange',
      };
    }
    return null;
  },

  oxygen_saturation: (value, normalRange) => {
    const status = getVitalStatus(value, normalRange, 'oxygen_saturation');
    if (status.status === 'abnormal-low') return { name: 'Hypoxia', severity: 'critical', color: 'red' };
    if (status.status === 'warning-low') return { name: 'Hypoxia', severity: 'warning', color: 'orange' };
    return null;
  },

  heart_rate: (value, normalRange) => {
    const status = getVitalStatus(value, normalRange, 'heart_rate');
    if (status.status === 'abnormal-high') return { name: 'Tachycardia', severity: 'critical', color: 'red' };
    if (status.status === 'warning-high') return { name: 'Tachycardia', severity: 'warning', color: 'orange' };
    return null;
  },
};

// ── Tooltip descriptions for condition badges ─────────────────────────────
// Shown on hover in metric cards and category cards.

const CONDITION_DESCRIPTIONS = {
  // Labs
  'Anemia': 'Low red blood cells or hemoglobin; can cause fatigue and shortness of breath.',
  'Neutropenia': 'Low neutrophil count; increases risk of infection.',
  'Thrombocytopenia': 'Low platelet count; may increase bleeding or bruising risk.',
  'Leukopenia': 'Low white blood cell count; can weaken the immune response.',
  'Lymphopenia': 'Low lymphocyte count; may affect immune function.',
  'Elevated Liver Enzymes': 'ALT/AST above normal; may indicate liver stress or injury.',
  'Jaundice Risk': 'Elevated bilirubin; can cause yellowing of skin or eyes.',
  'Reduced Kidney Function': 'Low eGFR; indicates the kidneys may not be filtering waste as well.',
  'Hypoalbuminemia': 'Low blood albumin; can affect fluid balance and nutrition.',
  'Elevated Creatinine': 'May indicate reduced kidney function or dehydration.',
  // Electrolytes
  'Hyponatremia': 'Low sodium in blood; can affect brain and muscle function.',
  'Hypernatremia': 'High sodium in blood; often related to fluid balance.',
  'Hypokalemia': 'Low potassium; can affect heart rhythm and muscles.',
  'Hyperkalemia': 'High potassium; may affect heart rhythm and needs monitoring.',
  'Hypocalcemia': 'Low calcium; can affect bones, muscles, and nerves.',
  'Hypercalcemia': 'High calcium; may affect heart, kidneys, and bones.',
  'Hypomagnesemia': 'Low magnesium; can affect muscles and heart rhythm.',
  'Hypermagnesemia': 'High magnesium; uncommon; may affect nerves and heart.',
  'Hypophosphatemia': 'Low phosphorus; can affect energy and cell function.',
  'Hyperphosphatemia': 'High phosphorus; often seen with kidney function changes.',
  // Vitals
  'Hypotension': 'Blood pressure below normal; may cause dizziness or fatigue.',
  'Fever': 'Elevated body temperature; often a sign of infection or inflammation.',
  'Hypoxia': 'Low blood oxygen; can cause shortness of breath or confusion.',
  'Tachycardia': 'Heart rate above normal at rest; may need monitoring.',
};

/**
 * Returns a short tooltip description for a condition name, or the name itself if unknown.
 * @param {string} conditionName
 * @returns {string}
 */
export function getConditionDescription(conditionName) {
  if (!conditionName || typeof conditionName !== 'string') return '';
  return CONDITION_DESCRIPTIONS[conditionName.trim()] || conditionName;
}

// ── Grade → Severity Mapping ─────────────────────────────────────────────

function gradeSeverity(grade) {
  if (grade >= 3) return { severity: 'critical', color: 'red' };
  return { severity: 'warning', color: 'orange' };
}

// ── Main Export ──────────────────────────────────────────────────────────

/**
 * Detect a clinical condition from a single metric's current value.
 *
 * @param {'lab'|'vital'} metricType
 * @param {string}        metricKey    – canonical key (e.g. 'hemoglobin', 'blood_pressure')
 * @param {*}             value        – current value (number or string like '128/82')
 * @param {string|null}   normalRange  – range string (e.g. '12-16', '<140/90')
 * @returns {{ name: string, severity: string, color: string } | null}
 */
export function detectCondition(metricType, metricKey, value, normalRange) {
  if (value == null || value === '') return null;

  if (metricType === 'lab') {
    return detectLabCondition(metricKey, value, normalRange);
  }

  if (metricType === 'vital') {
    return detectVitalCondition(metricKey, value, normalRange);
  }

  return null;
}

// ── Internal ─────────────────────────────────────────────────────────────

function detectLabCondition(metricKey, value, normalRange) {
  const key = (metricKey || '').toLowerCase();
  const entry = LAB_CONDITIONS[key];
  if (!entry) return null;
  if (!hasCTCAEGrading(key)) return null;

  const numValue = typeof value === 'number' ? value : parseFloat(value);
  if (isNaN(numValue)) return null;

  const { uln, lln } = parseNormalRange(normalRange);
  const gradeResult = calculateCTCAEGrade(key, numValue, { uln, lln });

  if (gradeResult.grade == null || gradeResult.grade < entry.minGrade) return null;

  // Determine condition name
  let conditionName;
  if (entry.directionMap) {
    conditionName = entry.directionMap[gradeResult.direction];
    if (!conditionName) return null; // safety — unknown direction
  } else {
    conditionName = entry.name;
  }

  return {
    name: conditionName,
    ...gradeSeverity(gradeResult.grade),
  };
}

function detectVitalCondition(metricKey, value, normalRange) {
  // Normalize to canonical vital key
  const normalized = normalizeVitalName(metricKey) || metricKey;
  const detector = VITAL_DETECTORS[normalized];
  if (!detector) return null;

  return detector(value, normalRange);
}

// ── Category-Level Detection ─────────────────────────────────────────────

const SEVERITY_RANK = { red: 2, orange: 1, yellow: 0 };

/**
 * Scan all labs in a category and return deduplicated condition badges.
 * Same condition name at multiple severities → worst severity wins.
 *
 * @param {Array<[string, object]>} labsInCategory — [key, lab] tuples from categorizeLabs()
 * @returns {Array<{ name: string, severity: string, color: string }>}
 */
export function detectCategoryConditions(labsInCategory) {
  if (!Array.isArray(labsInCategory) || labsInCategory.length === 0) return [];

  const conditionMap = new Map(); // name → { name, severity, color }

  for (const [key, lab] of labsInCategory) {
    const canonicalKey = normalizeLabName(lab.name || key);
    const effectiveRange = lab.normalRange || (canonicalKey && labDefaultNormalRanges[canonicalKey]);
    const condition = detectCondition('lab', canonicalKey, lab.current ?? lab.currentValue, effectiveRange);
    if (!condition) continue;

    const existing = conditionMap.get(condition.name);
    if (!existing || (SEVERITY_RANK[condition.color] || 0) > (SEVERITY_RANK[existing.color] || 0)) {
      conditionMap.set(condition.name, condition);
    }
  }

  // Sort: red (critical) first, then orange (warning)
  return Array.from(conditionMap.values()).sort(
    (a, b) => (SEVERITY_RANK[b.color] || 0) - (SEVERITY_RANK[a.color] || 0)
  );
}
