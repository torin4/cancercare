// Health-related utility functions

// Cancer relevance scoring for labs
export const cancerRelevantLabs = {
  critical: ['cea', 'ca125', 'ca199', 'afp', 'psa', 'ca153', 'ca2729', 'tumor_markers', 'wbc', 'hemoglobin', 'platelets', 'neutrophils', 'lymphocytes', 'anc'],
  important: ['alt', 'ast', 'creatinine', 'egfr', 'bilirubin', 'albumin', 'alp', 'ldh', 'd-dimer'],
  monitoring: ['glucose', 'sodium', 'potassium', 'calcium', 'magnesium', 'phosphate']
};

export const getCancerRelevanceScore = (labType) => {
  if (cancerRelevantLabs.critical.includes(labType.toLowerCase())) return 3;
  if (cancerRelevantLabs.important.includes(labType.toLowerCase())) return 2;
  if (cancerRelevantLabs.monitoring.includes(labType.toLowerCase())) return 1;
  return 0;
};

/**
 * Normalize lab value for status comparison.
 * Maps "negative", "-", "—", 0, "0" → { num: 0, semantic: 'negative' }
 * Maps "positive", "+" → { num: 1, semantic: 'positive' }
 * Numeric values → { num, semantic: 'numeric' }
 */
function normalizeLabValueForStatus(value) {
  if (value == null || value === '') {
    return { num: null, semantic: null };
  }
  const s = String(value).trim().toLowerCase();
  if (s === 'negative' || s === 'neg' || s === '-' || s === '—' || s === 'n/a' || s === 'na') {
    return { num: 0, semantic: 'negative' };
  }
  if (s === 'positive' || s === 'pos' || s === '+') {
    return { num: 1, semantic: 'positive' };
  }
  const num = typeof value === 'number' ? value : parseFloat(value);
  if (typeof num === 'number' && !isNaN(num)) {
    if (num === 0) {
      return { num: 0, semantic: 'negative' };
    }
    return { num, semantic: 'numeric' };
  }
  return { num: null, semantic: null };
}

/**
 * Numeric value for chart Y positioning. Use raw value for getLabStatus.
 * Maps "negative", "-", 0, etc. → 0; other numerics → as-is; unparseable → NaN.
 */
export function numericValueForChart(value) {
  const p = normalizeLabValueForStatus(value);
  if (p.num != null && typeof p.num === 'number' && !isNaN(p.num)) return p.num;
  return NaN;
}

/**
 * Parse "Negative or 0", "0, Negative, or -" style normal ranges.
 * Returns Set of 'negative' | '0' | 'positive' | string (numeric) or null if not this format.
 */
function parseMultiOptionNormalRange(normalRange) {
  const lower = normalRange.toLowerCase().trim();
  // Split on common separators: comma, slash, "or", "and" (with spaces or word boundaries)
  const tokens = lower.split(/\s*(?:[,/]|\s+or\s+|\s+and\s+)\s*/i).map(t => t.trim()).filter(Boolean);
  if (tokens.length < 2) return null;

  const allowed = new Set();
  for (const t of tokens) {
    if (t === 'negative' || t === 'neg' || t === '-' || t === '—') {
      allowed.add('negative');
    } else if (t === 'positive' || t === 'pos' || t === '+') {
      allowed.add('positive');
    } else if (t === '0' || t === '0.0') {
      allowed.add('0');
    } else {
      const n = parseFloat(t);
      if (!isNaN(n)) allowed.add(String(n));
    }
  }
  return allowed.size >= 1 ? allowed : null;
}

// Calculate detailed status with color coding based on normal range
export const getLabStatus = (value, normalRange) => {
  if (!normalRange) {
    return { status: 'unknown', color: 'gray', label: 'Unknown' };
  }

  const parsed = normalizeLabValueForStatus(value);
  const { num, semantic } = parsed;

  const normalRangeLower = normalRange.toLowerCase().trim();

  // Handle normal range of just "0" - means "normal is 0 or negative"
  if (normalRangeLower === '0' || normalRangeLower === '0.0') {
    const isNegativeOrZero = semantic === 'negative' || (num != null && num <= 0);
    if (isNegativeOrZero) {
      return { status: 'normal', color: 'green', label: 'Normal' };
    }
    // If value is > 0, it's abnormal (high)
    if (num != null && num > 0) {
      return { status: 'abnormal-high', color: 'red', label: 'High' };
    }
    return { status: 'unknown', color: 'gray', label: 'Unknown' };
  }

  // Handle "Negative or 0", "0, Negative, or -", "Negative / 0" etc.
  const multiAllowed = parseMultiOptionNormalRange(normalRange);
  if (multiAllowed) {
    const isNegativeOrZero = semantic === 'negative' || (num != null && num <= 0);
    const acceptsNegativeOrZero = multiAllowed.has('negative') || multiAllowed.has('0');

    if (isNegativeOrZero && acceptsNegativeOrZero) {
      return { status: 'normal', color: 'green', label: 'Normal' };
    }
    if (semantic === 'positive' || (num != null && num > 0 && semantic === 'numeric')) {
      if (multiAllowed.has('positive')) {
        return { status: 'normal', color: 'green', label: 'Normal' };
      }
      return { status: 'abnormal-high', color: 'red', label: 'High' };
    }
    if (num != null && multiAllowed.has(String(num))) {
      return { status: 'normal', color: 'green', label: 'Normal' };
    }
    return { status: 'unknown', color: 'gray', label: 'Unknown' };
  }

  // From here on we need a numeric value for numeric range parsing
  const numForRanges = parsed.num;
  if (numForRanges == null || (typeof numForRanges !== 'number' || isNaN(numForRanges))) {
    return { status: 'unknown', color: 'gray', label: 'Unknown' };
  }

  // Handle text-based formats: "Negative", "Positive", "Negative to X", "X to Positive"
  if (normalRangeLower === 'negative') {
    if (numForRanges < 0.5) {
      return { status: 'normal', color: 'green', label: 'Normal' };
    } else if (numForRanges < 1.0) {
      return { status: 'warning-high', color: 'yellow', label: 'Slightly High' };
    } else {
      return { status: 'abnormal-high', color: 'red', label: 'High' };
    }
  }

  if (normalRangeLower === 'positive') {
    if (numForRanges > 0) {
      return { status: 'normal', color: 'green', label: 'Normal' };
    } else {
      return { status: 'abnormal-low', color: 'red', label: 'Low' };
    }
  }

  // Handle "Negative to X" format (e.g., "Negative to 0.5")
  const negativeToMatch = normalRangeLower.match(/negative\s+to\s+(-?\d+\.?\d*)/);
  if (negativeToMatch) {
    const max = parseFloat(negativeToMatch[1]);
    if (!isNaN(max)) {
      if (numForRanges <= max) {
        return { status: 'normal', color: 'green', label: 'Normal' };
      } else if (numForRanges <= max * 1.2) {
        return { status: 'warning-high', color: 'yellow', label: 'Slightly High' };
      } else {
        return { status: 'abnormal-high', color: 'red', label: 'High' };
      }
    }
  }

  // Handle "X to Positive" format (e.g., "0 to Positive", "1.0 to Positive")
  const toPositiveMatch = normalRangeLower.match(/(-?\d+\.?\d*)\s+to\s+positive/);
  if (toPositiveMatch) {
    const min = parseFloat(toPositiveMatch[1]);
    if (!isNaN(min)) {
      if (numForRanges >= min) {
        return { status: 'normal', color: 'green', label: 'Normal' };
      } else if (numForRanges >= min * 0.8) {
        return { status: 'warning-low', color: 'yellow', label: 'Slightly Low' };
      } else {
        return { status: 'abnormal-low', color: 'red', label: 'Low' };
      }
    }
  }

  // Parse different normal range formats (supports negative numbers and zero)
  const rangeMatch = normalRange.match(/(-?\d+\.?\d*)\s*-\s*(-?\d+\.?\d*)/);
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1]);
    const max = parseFloat(rangeMatch[2]);
    const range = max - min;
    const warningThreshold = range * 0.1; // 10% buffer zone

    if (numForRanges < min) {
      if (numForRanges >= min - warningThreshold) {
        return { status: 'warning-low', color: 'yellow', label: 'Slightly Low' };
      }
      return { status: 'abnormal-low', color: 'red', label: 'Low' };
    } else if (numForRanges > max) {
      if (numForRanges <= max + warningThreshold) {
        return { status: 'warning-high', color: 'yellow', label: 'Slightly High' };
      }
      return { status: 'abnormal-high', color: 'red', label: 'High' };
    } else {
      return { status: 'normal', color: 'green', label: 'Normal' };
    }
  }

  // Handle "< X" format (e.g., D-dimer: "< 0.5", or "< -5")
  const lessThanMatch = normalRange.match(/<\s*(-?\d+\.?\d*)/);
  if (lessThanMatch) {
    const threshold = parseFloat(lessThanMatch[1]);
    const warningThreshold = threshold * 0.1;

    if (numForRanges <= threshold) {
      return { status: 'normal', color: 'green', label: 'Normal' };
    } else if (numForRanges < threshold + warningThreshold) {
      return { status: 'warning-high', color: 'yellow', label: 'Slightly High' };
    } else {
      return { status: 'abnormal-high', color: 'red', label: 'High' };
    }
  }

  // Handle "> X" format (e.g., eGFR: "> 60", or "> -10")
  const greaterThanMatch = normalRange.match(/>\s*(-?\d+\.?\d*)/);
  if (greaterThanMatch) {
    const threshold = parseFloat(greaterThanMatch[1]);
    const warningThreshold = threshold * 0.1;

    if (numForRanges >= threshold) {
      return { status: 'normal', color: 'green', label: 'Normal' };
    } else if (numForRanges > threshold - warningThreshold) {
      return { status: 'warning-low', color: 'yellow', label: 'Slightly Low' };
    } else {
      return { status: 'abnormal-low', color: 'red', label: 'Low' };
    }
  }

  return { status: 'unknown', color: 'gray', label: 'Unknown' };
};

// Calculate detailed status with color coding for vitals based on normal range
export const getVitalStatus = (value, normalRange, vitalType = null) => {
  if (!normalRange) {
    return { status: 'unknown', color: 'gray', label: 'Unknown' };
  }

  // Special handling for blood pressure (systolic/diastolic format)
  if (vitalType === 'bp' || vitalType === 'blood_pressure' || (typeof value === 'string' && value.includes('/'))) {
    // Parse blood pressure value (e.g., "128/82")
    const bpMatch = typeof value === 'string' ? value.match(/(\d+)\/(\d+)/) : null;
    if (bpMatch) {
      const systolic = parseFloat(bpMatch[1]);
      const diastolic = parseFloat(bpMatch[2]);
      
      // Parse normal range (e.g., "<140/90" or "<120/80")
      const rangeMatch = normalRange.match(/<\s*(\d+)\/(\d+)/);
      if (rangeMatch) {
        const normSystolic = parseFloat(rangeMatch[1]);
        const normDiastolic = parseFloat(rangeMatch[2]);
        const warningThreshold = 10; // 10 mmHg buffer
        
        // Check if either value is high (BP is abnormal if either is high)
        const systolicHigh = systolic > normSystolic;
        const diastolicHigh = diastolic > normDiastolic;
        const systolicWarning = systolic > normSystolic - warningThreshold && systolic <= normSystolic;
        const diastolicWarning = diastolic > normDiastolic - warningThreshold && diastolic <= normDiastolic;
        
        if (systolicHigh || diastolicHigh) {
          // If either is clearly high, it's abnormal
          if (systolicHigh && diastolicHigh) {
            return { status: 'abnormal-high', color: 'red', label: 'High' };
          }
          // If one is in warning zone and other is normal, it's slightly high
          if ((systolicWarning && !systolicHigh && diastolic <= normDiastolic) ||
              (diastolicWarning && !diastolicHigh && systolic <= normSystolic)) {
            return { status: 'warning-high', color: 'yellow', label: 'Slightly High' };
          }
          // Otherwise it's high
          return { status: 'abnormal-high', color: 'red', label: 'High' };
        }

        // Check for hypotension (common during chemo)
        if (systolic < 90) {
          return { status: 'abnormal-low', color: 'red', label: 'Low' };
        }
        if (systolic < 100) {
          return { status: 'warning-low', color: 'yellow', label: 'Slightly Low' };
        }

        if (systolic <= normSystolic && diastolic <= normDiastolic) {
          return { status: 'normal', color: 'green', label: 'Normal' };
        }
      }
    }
    // Fallback for BP if parsing fails
    return { status: 'unknown', color: 'gray', label: 'Unknown' };
  }

  // For numeric vitals, use similar logic to labs
  const numValue = typeof value === 'number' ? value : parseFloat(value);
  if (isNaN(numValue)) {
    return { status: 'unknown', color: 'gray', label: 'Unknown' };
  }

  const normalRangeLower = normalRange.toLowerCase().trim();

  // Handle text-based formats: "Negative", "Positive", "Negative to X", "X to Positive"
  if (normalRangeLower === 'negative') {
    if (numValue < 0.5) {
      return { status: 'normal', color: 'green', label: 'Normal' };
    } else if (numValue < 1.0) {
      return { status: 'warning-high', color: 'yellow', label: 'Slightly High' };
    } else {
      return { status: 'abnormal-high', color: 'red', label: 'High' };
    }
  }

  if (normalRangeLower === 'positive') {
    if (numValue > 0) {
      return { status: 'normal', color: 'green', label: 'Normal' };
    } else {
      return { status: 'abnormal-low', color: 'red', label: 'Low' };
    }
  }

  // Handle "Negative to X" format
  const negativeToMatch = normalRangeLower.match(/negative\s+to\s+(-?\d+\.?\d*)/);
  if (negativeToMatch) {
    const max = parseFloat(negativeToMatch[1]);
    if (!isNaN(max)) {
      if (numValue <= max) {
        return { status: 'normal', color: 'green', label: 'Normal' };
      } else if (numValue <= max * 1.2) {
        return { status: 'warning-high', color: 'yellow', label: 'Slightly High' };
      } else {
        return { status: 'abnormal-high', color: 'red', label: 'High' };
      }
    }
  }

  // Handle "X to Positive" format
  const toPositiveMatch = normalRangeLower.match(/(-?\d+\.?\d*)\s+to\s+positive/);
  if (toPositiveMatch) {
    const min = parseFloat(toPositiveMatch[1]);
    if (!isNaN(min)) {
      if (numValue >= min) {
        return { status: 'normal', color: 'green', label: 'Normal' };
      } else if (numValue >= min * 0.8) {
        return { status: 'warning-low', color: 'yellow', label: 'Slightly Low' };
      } else {
        return { status: 'abnormal-low', color: 'red', label: 'Low' };
      }
    }
  }

  // Parse different normal range formats (supports negative numbers and zero)
  const rangeMatch = normalRange.match(/(-?\d+\.?\d*)\s*-\s*(-?\d+\.?\d*)/);
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1]);
    const max = parseFloat(rangeMatch[2]);
    const range = max - min;
    const warningThreshold = range * 0.1; // 10% buffer zone

    if (numValue < min) {
      // Below normal range
      if (numValue >= min - warningThreshold) {
        return { status: 'warning-low', color: 'yellow', label: 'Slightly Low' };
      }
      return { status: 'abnormal-low', color: 'red', label: 'Low' };
    } else if (numValue > max) {
      // Above normal range
      if (numValue <= max + warningThreshold) {
        return { status: 'warning-high', color: 'yellow', label: 'Slightly High' };
      }
      return { status: 'abnormal-high', color: 'red', label: 'High' };
    } else {
      // Within normal range
      return { status: 'normal', color: 'green', label: 'Normal' };
    }
  }

  // Handle "< X" format (e.g., D-dimer: "< 0.5", or "< -5")
  const lessThanMatch = normalRange.match(/<\s*(-?\d+\.?\d*)/);
  if (lessThanMatch) {
    const threshold = parseFloat(lessThanMatch[1]);
    const warningThreshold = threshold * 0.1;

    if (numValue <= threshold) {
      return { status: 'normal', color: 'green', label: 'Normal' };
    } else if (numValue < threshold + warningThreshold) {
      return { status: 'warning-high', color: 'yellow', label: 'Slightly High' };
    } else {
      return { status: 'abnormal-high', color: 'red', label: 'High' };
    }
  }

  // Handle "> X" format (e.g., eGFR: "> 60", or "> -10")
  const greaterThanMatch = normalRange.match(/>\s*(-?\d+\.?\d*)/);
  if (greaterThanMatch) {
    const threshold = parseFloat(greaterThanMatch[1]);
    const warningThreshold = threshold * 0.1;

    if (numValue >= threshold) {
      return { status: 'normal', color: 'green', label: 'Normal' };
    } else if (numValue > threshold - warningThreshold) {
      return { status: 'warning-low', color: 'yellow', label: 'Slightly Low' };
    } else {
      return { status: 'abnormal-low', color: 'red', label: 'Low' };
    }
  }

  return { status: 'unknown', color: 'gray', label: 'Unknown' };
};

// Calculate weight normal range based on BMI (18.5-24.9) using height
export const getWeightNormalRange = (height, gender = null) => {
  if (!height || height <= 0) {
    return null;
  }
  
  // Convert height to meters (assuming cm input)
  const heightM = height / 100;
  
  // BMI normal range: 18.5-24.9
  // Weight = BMI * height² (in meters)
  const minWeight = 18.5 * (heightM * heightM);
  const maxWeight = 24.9 * (heightM * heightM);
  
  // Round to 1 decimal place
  return `${minWeight.toFixed(1)}-${maxWeight.toFixed(1)}`;
};

