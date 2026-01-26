/**
 * CTCAE v5.0 Lab Grading Criteria
 *
 * Source: National Cancer Institute Common Terminology Criteria for Adverse Events (CTCAE) v5.0
 * Published: November 27, 2017
 * Reference: https://ctep.cancer.gov/protocoldevelopment/electronic_applications/ctcae.htm
 *
 * Additional sources:
 * - eviQ (Cancer Institute NSW): https://www.eviq.org.au/dose-mod-gradings/standard-ctcae
 * - LiverTox (NCBI): https://www.ncbi.nlm.nih.gov/books/NBK548241/
 *
 * Grading Scale:
 * - Grade 0: Normal (within reference range)
 * - Grade 1: Mild
 * - Grade 2: Moderate
 * - Grade 3: Severe
 * - Grade 4: Life-threatening
 *
 * Note: ULN = Upper Limit of Normal, LLN = Lower Limit of Normal
 * Thresholds are expressed as multipliers of ULN/LLN or absolute values
 */

/**
 * CTCAE grading criteria by lab type
 * Each entry defines how to calculate the CTCAE grade for that lab
 *
 * Types:
 * - 'uln_multiplier': Value compared to Upper Limit of Normal (for "increased" labs)
 * - 'lln_multiplier': Value compared to Lower Limit of Normal (for "decreased" labs)
 * - 'absolute_high': Absolute value thresholds for high values
 * - 'absolute_low': Absolute value thresholds for low values
 * - 'absolute_range': Different thresholds for high and low
 */
export const ctcaeGradingCriteria = {
  // ============================================
  // LIVER FUNCTION
  // Source: eviQ, CTCAE v5.0, LiverTox (NCBI)
  // ============================================

  alt: {
    type: 'uln_multiplier',
    direction: 'high',
    grades: {
      1: { min: 1, max: 3 },      // >ULN - 3× ULN
      2: { min: 3, max: 5 },      // >3× - 5× ULN
      3: { min: 5, max: 20 },     // >5× - 20× ULN
      4: { min: 20, max: Infinity } // >20× ULN
    },
    description: 'Alanine aminotransferase increased'
  },

  ast: {
    type: 'uln_multiplier',
    direction: 'high',
    grades: {
      1: { min: 1, max: 3 },
      2: { min: 3, max: 5 },
      3: { min: 5, max: 20 },
      4: { min: 20, max: Infinity }
    },
    description: 'Aspartate aminotransferase increased'
  },

  bilirubin_total: {
    type: 'uln_multiplier',
    direction: 'high',
    grades: {
      1: { min: 1, max: 1.5 },    // >ULN - 1.5× ULN
      2: { min: 1.5, max: 3 },    // >1.5× - 3× ULN
      3: { min: 3, max: 10 },     // >3× - 10× ULN
      4: { min: 10, max: Infinity } // >10× ULN
    },
    description: 'Blood bilirubin increased'
  },

  alp: {
    type: 'uln_multiplier',
    direction: 'high',
    grades: {
      1: { min: 1, max: 2.5 },    // >ULN - 2.5× ULN
      2: { min: 2.5, max: 5 },    // >2.5× - 5× ULN
      3: { min: 5, max: 20 },     // >5× - 20× ULN
      4: { min: 20, max: Infinity } // >20× ULN
    },
    description: 'Alkaline phosphatase increased'
  },

  ggt: {
    type: 'uln_multiplier',
    direction: 'high',
    grades: {
      1: { min: 1, max: 2.5 },
      2: { min: 2.5, max: 5 },
      3: { min: 5, max: 20 },
      4: { min: 20, max: Infinity }
    },
    description: 'GGT increased'
  },

  albumin: {
    type: 'absolute_low',
    direction: 'low',
    unit: 'g/dL',
    grades: {
      1: { min: 3, max: 3.5 },      // <LLN - 3 g/dL (LLN typically ~3.5)
      2: { min: 2, max: 3 },        // <3 - 2 g/dL
      3: { min: 0, max: 2 },        // <2 g/dL
      4: null                        // Not applicable
    },
    description: 'Hypoalbuminemia'
  },

  // ============================================
  // KIDNEY FUNCTION
  // Source: eviQ, CTCAE v5.0
  // ============================================

  creatinine: {
    type: 'uln_multiplier',
    direction: 'high',
    grades: {
      1: { min: 1, max: 1.5 },    // >ULN - 1.5× ULN
      2: { min: 1.5, max: 3 },    // >1.5× - 3× ULN
      3: { min: 3, max: 6 },      // >3× - 6× ULN
      4: { min: 6, max: Infinity } // >6× ULN
    },
    description: 'Creatinine increased'
  },

  // eGFR uses inverse logic - lower is worse
  egfr: {
    type: 'absolute_low',
    direction: 'low',
    unit: 'mL/min/1.73m²',
    grades: {
      1: { min: 60, max: 89 },    // Mild decrease (CKD Stage 2)
      2: { min: 30, max: 59 },    // Moderate decrease (CKD Stage 3)
      3: { min: 15, max: 29 },    // Severe decrease (CKD Stage 4)
      4: { min: 0, max: 15 }      // Kidney failure (CKD Stage 5)
    },
    description: 'Chronic kidney disease based on eGFR'
  },

  // ============================================
  // BLOOD COUNTS (Hematologic)
  // Source: eviQ, CTCAE v5.0
  // ============================================

  hemoglobin: {
    type: 'absolute_low',
    direction: 'low',
    unit: 'g/dL',
    grades: {
      1: { min: 10, max: null },  // <LLN - 10 g/dL (LLN varies by sex)
      2: { min: 8, max: 10 },     // <10 - 8 g/dL
      3: { min: 0, max: 8 },      // <8 g/dL; transfusion indicated
      4: null                      // Life-threatening (clinical)
    },
    useLLN: true,  // Grade 1 requires comparison to LLN
    description: 'Anemia'
  },

  platelets: {
    type: 'absolute_low',
    direction: 'low',
    unit: '/mm³',
    grades: {
      1: { min: 75000, max: null },   // <LLN - 75,000
      2: { min: 50000, max: 75000 },  // <75,000 - 50,000
      3: { min: 25000, max: 50000 },  // <50,000 - 25,000
      4: { min: 0, max: 25000 }       // <25,000
    },
    useLLN: true,
    description: 'Platelet count decreased'
  },

  wbc: {
    type: 'absolute_low',
    direction: 'low',
    unit: '/mm³',
    grades: {
      1: { min: 3000, max: null },    // <LLN - 3,000
      2: { min: 2000, max: 3000 },    // <3,000 - 2,000
      3: { min: 1000, max: 2000 },    // <2,000 - 1,000
      4: { min: 0, max: 1000 }        // <1,000
    },
    useLLN: true,
    description: 'White blood cell decreased'
  },

  anc: {
    type: 'absolute_low',
    direction: 'low',
    unit: '/mm³',
    grades: {
      1: { min: 1500, max: null },    // <LLN - 1,500
      2: { min: 1000, max: 1500 },    // <1,500 - 1,000
      3: { min: 500, max: 1000 },     // <1,000 - 500
      4: { min: 0, max: 500 }         // <500
    },
    useLLN: true,
    description: 'Neutrophil count decreased'
  },

  neutrophils_abs: {
    type: 'absolute_low',
    direction: 'low',
    unit: '/mm³',
    grades: {
      1: { min: 1500, max: null },
      2: { min: 1000, max: 1500 },
      3: { min: 500, max: 1000 },
      4: { min: 0, max: 500 }
    },
    useLLN: true,
    description: 'Neutrophil count decreased'
  },

  lymphocytes_abs: {
    type: 'absolute_low',
    direction: 'low',
    unit: '/mm³',
    grades: {
      1: { min: 800, max: null },     // <LLN - 800
      2: { min: 500, max: 800 },      // <800 - 500
      3: { min: 200, max: 500 },      // <500 - 200
      4: { min: 0, max: 200 }         // <200
    },
    useLLN: true,
    description: 'Lymphocyte count decreased'
  },

  // ============================================
  // ELECTROLYTES
  // Source: CTCAE v5.0, FDA Toxicity Grading Scale
  // ============================================

  // Sodium
  sodium: {
    type: 'absolute_range',
    unit: 'mEq/L',
    low: {  // Hyponatremia
      grades: {
        1: { min: 130, max: 135 },    // 130-134 mEq/L (using LLN ~135)
        2: { min: 125, max: 130 },    // 125-129 mEq/L
        3: { min: 120, max: 125 },    // 120-124 mEq/L
        4: { min: 0, max: 120 }       // <120 mEq/L
      }
    },
    high: { // Hypernatremia
      grades: {
        1: { min: 146, max: 150 },    // >ULN - 150 mEq/L
        2: { min: 150, max: 155 },    // >150 - 155 mEq/L
        3: { min: 155, max: 160 },    // >155 - 160 mEq/L
        4: { min: 160, max: Infinity } // >160 mEq/L
      }
    },
    normalRange: { min: 135, max: 145 },
    description: 'Sodium abnormality'
  },

  // Potassium
  potassium: {
    type: 'absolute_range',
    unit: 'mEq/L',
    low: {  // Hypokalemia
      grades: {
        1: { min: 3.0, max: 3.5 },    // 3.0-3.4 mEq/L (LLN ~3.5)
        2: { min: 2.5, max: 3.0 },    // 2.5-2.9 mEq/L
        3: { min: 2.0, max: 2.5 },    // 2.0-2.4 mEq/L
        4: { min: 0, max: 2.0 }       // <2.0 mEq/L
      }
    },
    high: { // Hyperkalemia
      grades: {
        1: { min: 5.1, max: 5.5 },    // >ULN - 5.5 mEq/L
        2: { min: 5.5, max: 6.0 },    // >5.5 - 6.0 mEq/L
        3: { min: 6.0, max: 7.0 },    // >6.0 - 7.0 mEq/L
        4: { min: 7.0, max: Infinity } // >7.0 mEq/L
      }
    },
    normalRange: { min: 3.5, max: 5.0 },
    description: 'Potassium abnormality'
  },

  // Calcium (corrected/total)
  calcium: {
    type: 'absolute_range',
    unit: 'mg/dL',
    low: {  // Hypocalcemia
      grades: {
        1: { min: 8.0, max: 8.5 },    // 8.0-8.4 mg/dL (LLN ~8.5)
        2: { min: 7.0, max: 8.0 },    // 7.0-7.9 mg/dL
        3: { min: 6.0, max: 7.0 },    // 6.0-6.9 mg/dL
        4: { min: 0, max: 6.0 }       // <6.0 mg/dL
      }
    },
    high: { // Hypercalcemia
      grades: {
        1: { min: 10.6, max: 11.5 },  // >ULN - 11.5 mg/dL
        2: { min: 11.5, max: 12.5 },  // >11.5 - 12.5 mg/dL
        3: { min: 12.5, max: 13.5 },  // >12.5 - 13.5 mg/dL
        4: { min: 13.5, max: Infinity } // >13.5 mg/dL
      }
    },
    normalRange: { min: 8.5, max: 10.5 },
    description: 'Calcium abnormality'
  },

  // Magnesium
  magnesium: {
    type: 'absolute_range',
    unit: 'mg/dL',
    low: {  // Hypomagnesemia
      grades: {
        1: { min: 1.2, max: 1.7 },    // 1.2-1.6 mg/dL (LLN ~1.7)
        2: { min: 0.9, max: 1.2 },    // 0.9-1.1 mg/dL
        3: { min: 0.6, max: 0.9 },    // 0.6-0.8 mg/dL
        4: { min: 0, max: 0.6 }       // <0.6 mg/dL
      }
    },
    high: { // Hypermagnesemia
      grades: {
        1: { min: 2.5, max: 3.0 },    // >ULN - 3.0 mg/dL
        2: { min: 3.0, max: 8.0 },    // Not well defined in CTCAE
        3: { min: 8.0, max: Infinity }, // Severe
        4: null
      }
    },
    normalRange: { min: 1.7, max: 2.4 },
    description: 'Magnesium abnormality'
  },

  // Phosphorus/Phosphate
  phosphorus: {
    type: 'absolute_range',
    unit: 'mg/dL',
    low: {  // Hypophosphatemia
      grades: {
        1: { min: 2.0, max: 2.5 },    // 2.0-2.4 mg/dL (LLN ~2.5)
        2: { min: 1.0, max: 2.0 },    // 1.0-1.9 mg/dL
        3: { min: 0, max: 1.0 },      // <1.0 mg/dL
        4: null
      }
    },
    high: { // Hyperphosphatemia
      grades: {
        1: { min: 4.6, max: 5.5 },    // >ULN - 5.5 mg/dL
        2: { min: 5.5, max: 6.5 },    // >5.5 - 6.5 mg/dL
        3: { min: 6.5, max: 8.5 },    // >6.5 - 8.5 mg/dL
        4: { min: 8.5, max: Infinity } // >8.5 mg/dL
      }
    },
    normalRange: { min: 2.5, max: 4.5 },
    description: 'Phosphorus abnormality'
  },

  phosphate: {
    // Alias for phosphorus
    type: 'absolute_range',
    unit: 'mg/dL',
    low: {
      grades: {
        1: { min: 2.0, max: 2.5 },
        2: { min: 1.0, max: 2.0 },
        3: { min: 0, max: 1.0 },
        4: null
      }
    },
    high: {
      grades: {
        1: { min: 4.6, max: 5.5 },
        2: { min: 5.5, max: 6.5 },
        3: { min: 6.5, max: 8.5 },
        4: { min: 8.5, max: Infinity }
      }
    },
    normalRange: { min: 2.5, max: 4.5 },
    description: 'Phosphate abnormality'
  },

  // ============================================
  // COAGULATION (Partial coverage)
  // Source: CTCAE v5.0
  // ============================================

  inr: {
    type: 'uln_multiplier',
    direction: 'high',
    grades: {
      1: { min: 1, max: 1.5 },    // >ULN - 1.5× ULN
      2: { min: 1.5, max: 2.5 },  // >1.5× - 2.5× ULN
      3: { min: 2.5, max: Infinity }, // >2.5× ULN
      4: null                      // Clinical bleeding
    },
    description: 'INR increased'
  },

  fibrinogen: {
    type: 'absolute_low',
    direction: 'low',
    unit: 'mg/dL',
    grades: {
      1: { min: 150, max: 200 },  // Slightly decreased (LLN ~200)
      2: { min: 100, max: 150 },  // Moderately decreased
      3: { min: 50, max: 100 },   // Severely decreased
      4: { min: 0, max: 50 }      // Critically low
    },
    description: 'Fibrinogen decreased'
  }
};

/**
 * Categories that support CTCAE grading
 */
export const ctcaeGradableCategories = [
  'Liver Function',
  'Kidney Function',
  'Blood Counts',
  'Electrolytes',
  'Coagulation'
];

/**
 * Categories that use simple status-based insights
 */
export const statusBasedCategories = [
  'Inflammation',
  'Thyroid Function',
  'Cardiac Markers',
  'Custom Values',
  'Others'
];

/**
 * Categories that use trend-based insights (tumor markers)
 */
export const trendBasedCategories = [
  'Disease-Specific Markers'
];

/**
 * Calculate CTCAE grade for a lab value
 *
 * @param {string} labType - The canonical lab type (e.g., 'alt', 'sodium')
 * @param {number} value - The lab value
 * @param {object} options - Optional parameters
 * @param {number} options.uln - Upper limit of normal (required for ULN-based grading)
 * @param {number} options.lln - Lower limit of normal (required for some labs)
 * @returns {object} { grade: 0-4, description: string, direction: 'high'|'low'|null }
 */
export function calculateCTCAEGrade(labType, value, options = {}) {
  const criteria = ctcaeGradingCriteria[labType];

  if (!criteria || value === null || value === undefined || isNaN(value)) {
    return { grade: null, description: null, direction: null };
  }

  const { uln, lln } = options;

  // Handle different grading types
  if (criteria.type === 'uln_multiplier') {
    // Value expressed as multiple of ULN
    if (!uln || uln <= 0) {
      return { grade: null, description: 'ULN required', direction: null };
    }

    const multiplier = value / uln;

    if (multiplier <= 1) {
      return { grade: 0, description: 'Normal', direction: null };
    }

    for (let g = 1; g <= 4; g++) {
      const range = criteria.grades[g];
      if (range && multiplier > range.min && multiplier <= range.max) {
        return {
          grade: g,
          description: criteria.description,
          direction: 'high'
        };
      }
    }

    // If above all ranges, return grade 4
    if (multiplier > 1) {
      return { grade: 4, description: criteria.description, direction: 'high' };
    }
  }

  if (criteria.type === 'absolute_low') {
    // Check if above LLN (normal)
    if (criteria.useLLN && lln && value >= lln) {
      return { grade: 0, description: 'Normal', direction: null };
    }

    // For grade 1, max is null means "up to LLN"
    for (let g = 4; g >= 1; g--) {
      const range = criteria.grades[g];
      if (range && value >= range.min && (range.max === null || value < range.max)) {
        return {
          grade: g,
          description: criteria.description,
          direction: 'low'
        };
      }
    }

    return { grade: 0, description: 'Normal', direction: null };
  }

  if (criteria.type === 'absolute_range') {
    const { normalRange, low, high } = criteria;

    // Check if within normal range
    if (normalRange && value >= normalRange.min && value <= normalRange.max) {
      return { grade: 0, description: 'Normal', direction: null };
    }

    // Check low values
    if (low && value < normalRange.min) {
      for (let g = 4; g >= 1; g--) {
        const range = low.grades[g];
        if (range && value >= range.min && value < range.max) {
          return {
            grade: g,
            description: criteria.description,
            direction: 'low'
          };
        }
      }
    }

    // Check high values
    if (high && value > normalRange.max) {
      for (let g = 1; g <= 4; g++) {
        const range = high.grades[g];
        if (range && value > range.min && value <= range.max) {
          return {
            grade: g,
            description: criteria.description,
            direction: 'high'
          };
        }
      }
      // If above all defined ranges
      return { grade: 4, description: criteria.description, direction: 'high' };
    }

    return { grade: 0, description: 'Normal', direction: null };
  }

  return { grade: null, description: null, direction: null };
}

/**
 * Parse a normal range string to extract ULN and LLN
 *
 * @param {string} normalRange - Range string like "10-40", "<35", ">60"
 * @returns {object} { uln: number|null, lln: number|null }
 */
export function parseNormalRange(normalRange) {
  if (!normalRange || typeof normalRange !== 'string') {
    return { uln: null, lln: null };
  }

  const cleaned = normalRange.trim();

  // Handle "X-Y" format
  const rangeMatch = cleaned.match(/^(\d+\.?\d*)\s*[-–—]\s*(\d+\.?\d*)$/);
  if (rangeMatch) {
    return {
      lln: parseFloat(rangeMatch[1]),
      uln: parseFloat(rangeMatch[2])
    };
  }

  // Handle "<X" format (only ULN)
  const lessThanMatch = cleaned.match(/^[<≤]\s*(\d+\.?\d*)$/);
  if (lessThanMatch) {
    return {
      lln: null,
      uln: parseFloat(lessThanMatch[1])
    };
  }

  // Handle ">X" format (only LLN)
  const greaterThanMatch = cleaned.match(/^[>≥]\s*(\d+\.?\d*)$/);
  if (greaterThanMatch) {
    return {
      lln: parseFloat(greaterThanMatch[1]),
      uln: null
    };
  }

  return { uln: null, lln: null };
}

/**
 * Check if a lab type has CTCAE grading criteria defined
 *
 * @param {string} labType - The canonical lab type
 * @returns {boolean}
 */
export function hasCTCAEGrading(labType) {
  return labType && ctcaeGradingCriteria.hasOwnProperty(labType);
}

/**
 * Get the insight type for a category
 *
 * @param {string} category - Category name
 * @returns {'ctcae'|'status'|'trend'}
 */
export function getCategoryInsightType(category) {
  if (ctcaeGradableCategories.includes(category)) {
    return 'ctcae';
  }
  if (trendBasedCategories.includes(category)) {
    return 'trend';
  }
  return 'status';
}
