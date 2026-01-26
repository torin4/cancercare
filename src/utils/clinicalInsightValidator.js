/**
 * Clinical Insight Validator
 * 
 * Filters pattern insights to only include research-backed, clinically meaningful correlations
 * and ensures insights are written in plain language with actionable discussion points.
 * 
 * This prevents showing meaningless correlations like "when lab changes happen, symptoms follow"
 * and focuses on specific, research-supported relationships that patients can discuss with doctors.
 */

/**
 * Research-backed clinical correlations
 * Only insights matching these patterns will be shown
 */
const CLINICALLY_MEANINGFUL_CORRELATIONS = {
  // Anemia-related correlations
  'hemoglobin-fatigue': {
    threshold: { metric: 'hemoglobin', operator: '<', value: 10 },
    symptom: 'fatigue',
    description: 'Low hemoglobin (anemia) and fatigue',
    discussionPoint: 'Ask your doctor if your fatigue might be related to low hemoglobin levels and whether treatment for anemia could help.',
    researchNote: 'Anemia is a well-documented cause of fatigue in cancer patients.'
  },
  'hemoglobin-weakness': {
    threshold: { metric: 'hemoglobin', operator: '<', value: 10 },
    symptom: 'weakness',
    description: 'Low hemoglobin (anemia) and weakness',
    discussionPoint: 'Discuss with your doctor whether your weakness could be related to low hemoglobin and if anemia treatment might improve your energy.',
    researchNote: 'Anemia commonly causes weakness and reduced energy levels.'
  },
  'hemoglobin-shortness of breath': {
    threshold: { metric: 'hemoglobin', operator: '<', value: 10 },
    symptom: 'shortness of breath',
    description: 'Low hemoglobin (anemia) and shortness of breath',
    discussionPoint: 'Ask your doctor if your shortness of breath might be related to low hemoglobin levels and whether addressing anemia could help.',
    researchNote: 'Anemia reduces oxygen-carrying capacity, which can cause shortness of breath.'
  },
  
  // Platelet-related correlations
  'platelets-bruising': {
    threshold: { metric: 'platelets', operator: '<', value: 100 },
    symptom: 'bruising',
    description: 'Low platelets and increased bruising',
    discussionPoint: 'Discuss with your doctor whether your increased bruising might be related to low platelet counts and if any precautions are needed.',
    researchNote: 'Thrombocytopenia (low platelets) is a known cause of easy bruising.'
  },
  'platelets-bleeding': {
    threshold: { metric: 'platelets', operator: '<', value: 50 },
    symptom: 'bleeding',
    description: 'Very low platelets and bleeding',
    discussionPoint: 'This is important to discuss immediately with your doctor, as very low platelets can increase bleeding risk.',
    researchNote: 'Severe thrombocytopenia significantly increases bleeding risk.'
  },
  
  // Kidney function correlations
  'creatinine-nausea': {
    threshold: { metric: 'creatinine', operator: '>', value: 1.5 },
    symptom: 'nausea',
    description: 'Elevated creatinine (kidney function) and nausea',
    discussionPoint: 'Ask your doctor if your nausea could be related to changes in kidney function and whether any medication adjustments are needed.',
    researchNote: 'Kidney dysfunction can cause nausea and other gastrointestinal symptoms.'
  },
  'egfr-fatigue': {
    threshold: { metric: 'egfr', operator: '<', value: 60 },
    symptom: 'fatigue',
    description: 'Low eGFR (kidney function) and fatigue',
    discussionPoint: 'Discuss with your doctor whether your fatigue might be related to reduced kidney function and what monitoring or treatment might be appropriate.',
    researchNote: 'Reduced kidney function can contribute to fatigue and overall feeling of unwellness.'
  },
  
  // Liver function correlations
  'bilirubin-jaundice': {
    threshold: { metric: 'bilirubin', operator: '>', value: 2.0 },
    symptom: 'jaundice',
    description: 'Elevated bilirubin and jaundice',
    discussionPoint: 'This is important to discuss with your doctor, as elevated bilirubin can cause yellowing of the skin and eyes.',
    researchNote: 'Hyperbilirubinemia is the direct cause of jaundice.'
  },
  'alt-ast-fatigue': {
    threshold: { metric: 'alt', operator: '>', value: 100 },
    symptom: 'fatigue',
    description: 'Elevated liver enzymes and fatigue',
    discussionPoint: 'Ask your doctor if your fatigue might be related to changes in liver function and whether any treatment adjustments are needed.',
    researchNote: 'Liver dysfunction can cause fatigue and general malaise.'
  },
  
  // White blood cell correlations
  'wbc-fever': {
    threshold: { metric: 'wbc', operator: '<', value: 3.0 },
    symptom: 'fever',
    description: 'Low white blood cells and fever',
    discussionPoint: 'This is important to discuss with your doctor immediately, as low white blood cells with fever can indicate infection requiring prompt treatment.',
    researchNote: 'Neutropenic fever is a medical emergency requiring immediate attention.'
  },
  'wbc-infection': {
    threshold: { metric: 'wbc', operator: '<', value: 3.0 },
    symptom: 'infection',
    description: 'Low white blood cells and signs of infection',
    discussionPoint: 'Discuss with your doctor immediately, as low white blood cells increase infection risk and may require preventive measures or treatment.',
    researchNote: 'Neutropenia significantly increases infection risk.'
  },
  
  // Tumor marker correlations (only for significant changes)
  'ca125-abdominal pain': {
    threshold: { metric: 'ca125', operator: '>', value: 35, change: 'increasing' },
    symptom: 'abdominal pain',
    description: 'Rising CA-125 and abdominal pain',
    discussionPoint: 'Ask your doctor if your abdominal pain might be related to changes in your CA-125 levels and whether additional imaging or evaluation is needed.',
    researchNote: 'Rising tumor markers with new symptoms may indicate disease progression.'
  },
  
  // Treatment-related patterns (these are always meaningful)
  'treatment-cycle': {
    type: 'cycle',
    description: 'Pattern matching treatment schedule',
    discussionPoint: 'Discuss with your doctor whether this pattern aligns with your treatment schedule and if any adjustments to timing or supportive care might help.',
    researchNote: 'Understanding treatment-related patterns helps optimize care timing.'
  }
};

/**
 * Convert metric name to key for correlation lookup
 */
function normalizeMetricForCorrelation(metric) {
  if (!metric) return null;
  const normalized = String(metric).toLowerCase().trim();
  // Handle common variations
  const mappings = {
    'hgb': 'hemoglobin',
    'hgb (hemoglobin)': 'hemoglobin',
    'plt': 'platelets',
    'platelet count': 'platelets',
    'cre': 'creatinine',
    'creatinine (serum)': 'creatinine',
    'ca-125': 'ca125',
    'ca 125': 'ca125'
  };
  return mappings[normalized] || normalized;
}

/**
 * Normalize symptom name for correlation lookup
 */
function normalizeSymptomForCorrelation(symptom) {
  if (!symptom) return null;
  const normalized = String(symptom).toLowerCase().trim();
  const mappings = {
    'tired': 'fatigue',
    'tiredness': 'fatigue',
    'low energy': 'fatigue',
    'weak': 'weakness',
    'weakness/fatigue': 'weakness',
    'short of breath': 'shortness of breath',
    'sob': 'shortness of breath',
    'difficulty breathing': 'shortness of breath',
    'easy bruising': 'bruising',
    'increased bruising': 'bruising',
    'yellow skin': 'jaundice',
    'yellow eyes': 'jaundice',
    'yellowing': 'jaundice',
    'high temperature': 'fever',
    'temp': 'fever',
    'stomach pain': 'abdominal pain',
    'belly pain': 'abdominal pain'
  };
  return mappings[normalized] || normalized;
}

/**
 * Check if a correlation is clinically meaningful
 * @param {Object} correlation - Correlation pattern object
 * @returns {Object|null} - Clinical correlation info if valid, null otherwise
 */
export function validateCorrelation(correlation) {
  if (correlation.type !== 'correlation') return null;
  
  const event1 = normalizeMetricForCorrelation(correlation.event1);
  const event2 = normalizeSymptomForCorrelation(correlation.event2);
  
  if (!event1 || !event2) return null;
  
  // Check for exact match
  const key = `${event1}-${event2}`;
  if (CLINICALLY_MEANINGFUL_CORRELATIONS[key]) {
    return {
      ...CLINICALLY_MEANINGFUL_CORRELATIONS[key],
      correlationKey: key
    };
  }
  
  // Check reverse (symptom-lab correlation)
  const reverseKey = `${event2}-${event1}`;
  if (CLINICALLY_MEANINGFUL_CORRELATIONS[reverseKey]) {
    return {
      ...CLINICALLY_MEANINGFUL_CORRELATIONS[reverseKey],
      correlationKey: reverseKey
    };
  }
  
  // Not a clinically meaningful correlation
  return null;
}

/**
 * Check if a cycle pattern is meaningful
 */
export function validateCycle(cycle) {
  if (cycle.type !== 'cycle') return null;
  
  // Treatment cycles are always meaningful
  if (cycle.matchesMedication) {
    return {
      ...CLINICALLY_MEANINGFUL_CORRELATIONS['treatment-cycle'],
      cycleData: cycle
    };
  }
  
  // Other cycles need to be significant (e.g., regular lab monitoring patterns)
  // For now, only show treatment-related cycles
  return null;
}

/**
 * Check if a cluster is meaningful
 * Clusters are only meaningful if they represent known symptom clusters
 */
export function validateCluster(cluster) {
  if (cluster.type !== 'cluster') return null;
  
  // Known symptom clusters (e.g., fatigue + nausea + weakness)
  const knownClusters = [
    ['fatigue', 'nausea', 'weakness'],
    ['fatigue', 'weakness'],
    ['nausea', 'vomiting'],
    ['pain', 'fatigue'],
    ['shortness of breath', 'fatigue']
  ];
  
  const clusterTypes = (cluster.types || []).map(t => normalizeSymptomForCorrelation(t));
  
  // Check if this matches a known cluster
  for (const knownCluster of knownClusters) {
    const normalizedKnown = knownCluster.map(normalizeSymptomForCorrelation);
    const matches = normalizedKnown.every(symptom => clusterTypes.includes(symptom));
    if (matches && clusterTypes.length <= normalizedKnown.length + 1) {
      return {
        description: `These symptoms often occur together: ${cluster.types?.join(', ') || 'multiple symptoms'}`,
        discussionPoint: 'Ask your doctor about managing these symptoms together, as they may be related and could benefit from coordinated treatment approaches.',
        researchNote: 'Some symptoms commonly occur together and may share underlying causes.'
      };
    }
  }
  
  // Generic clusters are not meaningful enough
  return null;
}

/**
 * Validate temporal patterns
 */
export function validateTemporalPattern(temporal) {
  if (temporal.type !== 'temporal') return null;
  
  // Treatment-relative patterns are meaningful
  if (temporal.subtype === 'treatment-relative' && temporal.medication) {
    return {
      description: `Pattern detected around ${temporal.medication} treatment cycles`,
      discussionPoint: `Discuss with your doctor whether this timing pattern is expected with your ${temporal.medication} treatment and if any preventive or supportive care measures might help.`,
      researchNote: 'Understanding treatment-related timing helps optimize supportive care.'
    };
  }
  
  return null;
}

/**
 * Main validation function - filters insights to only clinically meaningful ones
 * @param {Array} insights - Array of translated insights (already processed by insightLanguage.js)
 * @returns {Array} - Filtered and enhanced insights with plain language and discussion points
 */
export function validateAndEnhanceInsights(insights) {
  if (!Array.isArray(insights) || insights.length === 0) return [];
  
  const validated = [];
  
  for (const insight of insights) {
    let validatedInsight = null;
    
    // Check rawData first, then insight itself
    const rawData = insight.rawData || insight;
    
    switch (insight.type) {
      case 'correlation':
        validatedInsight = validateCorrelation(rawData);
        break;
      case 'cycle':
        validatedInsight = validateCycle(rawData);
        break;
      case 'cluster':
        validatedInsight = validateCluster(rawData);
        break;
      case 'temporal':
        validatedInsight = validateTemporalPattern(rawData);
        break;
      default:
        // Other types (trend, multi-variable) - skip for now as they're often not actionable
        continue;
    }
    
    if (validatedInsight) {
      // Enhance with plain language and discussion points
      validated.push({
        ...insight,
        headline: validatedInsight.description || insight.headline,
        explanation: validatedInsight.description || insight.explanation,
        discussionPoint: validatedInsight.discussionPoint,
        researchNote: validatedInsight.researchNote,
        actionable: validatedInsight.discussionPoint || insight.actionable,
        isClinicallyValidated: true
      });
    }
  }
  
  return validated;
}
