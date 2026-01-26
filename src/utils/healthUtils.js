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

// Calculate detailed status with color coding based on normal range
export const getLabStatus = (value, normalRange) => {
  const num = typeof value === 'number' ? value : parseFloat(value);
  if (!normalRange || (typeof num !== 'number' || isNaN(num))) {
    return { status: 'unknown', color: 'gray', label: 'Unknown' };
  }

  // Parse different normal range formats
  const rangeMatch = normalRange.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/);
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1]);
    const max = parseFloat(rangeMatch[2]);
    const range = max - min;
    const warningThreshold = range * 0.1; // 10% buffer zone

    if (num < min) {
      // Below normal range
      if (num >= min - warningThreshold) {
        return { status: 'warning-low', color: 'yellow', label: 'Slightly Low' };
      }
      return { status: 'abnormal-low', color: 'red', label: 'Low' };
    } else if (num > max) {
      // Above normal range
      if (num <= max + warningThreshold) {
        return { status: 'warning-high', color: 'yellow', label: 'Slightly High' };
      }
      return { status: 'abnormal-high', color: 'red', label: 'High' };
    } else {
      // Within normal range
      return { status: 'normal', color: 'green', label: 'Normal' };
    }
  }

  // Handle "< X" format (e.g., D-dimer: "< 0.5")
  const lessThanMatch = normalRange.match(/<\s*(\d+\.?\d*)/);
  if (lessThanMatch) {
    const threshold = parseFloat(lessThanMatch[1]);
    const warningThreshold = threshold * 0.1;

    if (num <= threshold) {
      return { status: 'normal', color: 'green', label: 'Normal' };
    } else if (num < threshold + warningThreshold) {
      return { status: 'warning-high', color: 'yellow', label: 'Slightly High' };
    } else {
      return { status: 'abnormal-high', color: 'red', label: 'High' };
    }
  }

  // Handle "> X" format (e.g., eGFR: "> 60")
  const greaterThanMatch = normalRange.match(/>\s*(\d+\.?\d*)/);
  if (greaterThanMatch) {
    const threshold = parseFloat(greaterThanMatch[1]);
    const warningThreshold = threshold * 0.1;

    if (num >= threshold) {
      return { status: 'normal', color: 'green', label: 'Normal' };
    } else if (num > threshold - warningThreshold) {
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
        } else if (systolic <= normSystolic && diastolic <= normDiastolic) {
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

  // Parse different normal range formats
  const rangeMatch = normalRange.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/);
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

  // Handle "< X" format (e.g., D-dimer: "< 0.5")
  const lessThanMatch = normalRange.match(/<\s*(\d+\.?\d*)/);
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

  // Handle "> X" format (e.g., eGFR: "> 60" or SpO2: ">95")
  const greaterThanMatch = normalRange.match(/>\s*(\d+\.?\d*)/);
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

