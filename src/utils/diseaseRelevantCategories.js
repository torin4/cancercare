/**
 * Disease-Relevant Lab Categories Mapping
 * 
 * Based on NCCN Guidelines, ASCO Guidelines, and clinical practice:
 * Maps cancer types to lab categories that are clinically relevant for monitoring.
 * Categories NOT in this list are considered less relevant and can be hidden.
 * 
 * Source References:
 * - NCCN Clinical Practice Guidelines
 * - ASCO Guidelines
 * - Cancer.gov Tumor Markers List
 */

// All available lab categories
const ALL_CATEGORIES = [
  'Disease-Specific Markers',
  'Liver Function',
  'Kidney Function',
  'Blood Counts',
  'Thyroid Function',
  'Cardiac Markers',
  'Inflammation',
  'Electrolytes',
  'Coagulation',
  'Custom Values',
  'Others'
];

// Categories that are almost always relevant for all cancer types (treatment monitoring)
const ALWAYS_RELEVANT = [
  'Blood Counts',      // CBC - always relevant for treatment monitoring
  'Liver Function',    // Always relevant (chemo toxicity monitoring)
  'Kidney Function',   // Always relevant (chemo toxicity monitoring)
  'Coagulation',       // Often relevant (DVT risk, bleeding risk)
  'Inflammation'       // Often relevant (CRP, ESR for monitoring)
];

/**
 * Maps cancer type -> array of relevant category names
 * Categories NOT in this list are considered irrelevant and can be hidden
 */
export const DISEASE_RELEVANT_CATEGORIES = {
  // Gynecological Cancers
  'Ovarian Cancer': [
    'Disease-Specific Markers', // CA-125, HE4, ROMA Index (NCCN recommended)
    ...ALWAYS_RELEVANT
  ],
  'Endometrial Cancer': [
    'Disease-Specific Markers', // CA-125 (sometimes used)
    ...ALWAYS_RELEVANT
  ],
  'Cervical Cancer': [
    'Disease-Specific Markers', // SCC Antigen
    ...ALWAYS_RELEVANT
  ],
  'Uterine Cancer': [
    'Disease-Specific Markers', // CA-125
    ...ALWAYS_RELEVANT
  ],
  'Vaginal Cancer': [
    'Disease-Specific Markers', // SCC Antigen
    ...ALWAYS_RELEVANT
  ],
  'Vulvar Cancer': [
    'Disease-Specific Markers', // SCC Antigen
    ...ALWAYS_RELEVANT
  ],
  'Fallopian Tube Cancer': [
    'Disease-Specific Markers', // CA-125, HE4
    ...ALWAYS_RELEVANT
  ],

  // Breast Cancer
  'Breast Cancer': [
    'Disease-Specific Markers', // CA 15-3, CA 27-29 (NCCN/ASCO recommended)
    ...ALWAYS_RELEVANT
  ],
  'Male Breast Cancer': [
    'Disease-Specific Markers', // CA 15-3, CA 27-29
    ...ALWAYS_RELEVANT
  ],
  'Inflammatory Breast Cancer': [
    'Disease-Specific Markers', // CA 15-3, CA 27-29
    ...ALWAYS_RELEVANT
  ],
  'Triple-Negative Breast Cancer': [
    'Disease-Specific Markers', // CA 15-3, CA 27-29
    ...ALWAYS_RELEVANT
  ],

  // Lung Cancer
  'Lung Cancer': [
    'Disease-Specific Markers', // CYFRA 21-1, NSE, CEA (NCCN recommended)
    ...ALWAYS_RELEVANT
  ],
  'Non-Small Cell Lung Cancer': [
    'Disease-Specific Markers', // CYFRA 21-1, CEA
    ...ALWAYS_RELEVANT
  ],
  'Small Cell Lung Cancer': [
    'Disease-Specific Markers', // NSE (neuron-specific enolase)
    ...ALWAYS_RELEVANT
  ],
  'Mesothelioma': [
    'Disease-Specific Markers', // Limited markers
    ...ALWAYS_RELEVANT
  ],

  // Gastrointestinal Cancers
  'Colorectal Cancer': [
    'Disease-Specific Markers', // CEA, CA 19-9 (NCCN recommended)
    ...ALWAYS_RELEVANT
  ],
  'Colon Cancer': [
    'Disease-Specific Markers', // CEA, CA 19-9
    ...ALWAYS_RELEVANT
  ],
  'Rectal Cancer': [
    'Disease-Specific Markers', // CEA, CA 19-9
    ...ALWAYS_RELEVANT
  ],
  'Stomach Cancer': [
    'Disease-Specific Markers', // CA 19-9, CEA
    ...ALWAYS_RELEVANT
  ],
  'Esophageal Cancer': [
    'Disease-Specific Markers', // Limited markers
    ...ALWAYS_RELEVANT
  ],
  'Pancreatic Cancer': [
    'Disease-Specific Markers', // CA 19-9 (NCCN recommended)
    ...ALWAYS_RELEVANT
  ],
  'Liver Cancer': [
    'Disease-Specific Markers', // AFP (alpha-fetoprotein)
    'Liver Function', // Critical for liver cancer
    ...ALWAYS_RELEVANT.filter(cat => cat !== 'Liver Function') // Already included
  ],
  'Gallbladder Cancer': [
    'Disease-Specific Markers', // CA 19-9
    ...ALWAYS_RELEVANT
  ],
  'Bile Duct Cancer': [
    'Disease-Specific Markers', // CA 19-9
    ...ALWAYS_RELEVANT
  ],
  'Anal Cancer': [
    'Disease-Specific Markers', // Limited markers
    ...ALWAYS_RELEVANT
  ],
  'Gastrointestinal Stromal Tumor (GIST)': [
    'Disease-Specific Markers', // Limited markers
    ...ALWAYS_RELEVANT
  ],

  // Blood Cancers
  'Leukemia': [
    'Blood Counts', // Critical for blood cancers
    'Liver Function',
    'Kidney Function',
    'Coagulation',
    'Inflammation'
    // Disease-Specific Markers less relevant (no standard tumor markers)
  ],
  'Acute Lymphoblastic Leukemia (ALL)': [
    'Blood Counts',
    'Liver Function',
    'Kidney Function',
    'Coagulation',
    'Inflammation'
  ],
  'Acute Myeloid Leukemia (AML)': [
    'Blood Counts',
    'Liver Function',
    'Kidney Function',
    'Coagulation',
    'Inflammation'
  ],
  'Chronic Lymphocytic Leukemia (CLL)': [
    'Blood Counts',
    'Liver Function',
    'Kidney Function',
    'Coagulation',
    'Inflammation'
  ],
  'Chronic Myeloid Leukemia (CML)': [
    'Blood Counts',
    'Liver Function',
    'Kidney Function',
    'Coagulation',
    'Inflammation'
  ],
  'Lymphoma': [
    'Blood Counts',
    'Liver Function',
    'Kidney Function',
    'Coagulation',
    'Inflammation'
  ],
  'Hodgkin Lymphoma': [
    'Blood Counts',
    'Liver Function',
    'Kidney Function',
    'Coagulation',
    'Inflammation'
  ],
  'Non-Hodgkin Lymphoma': [
    'Blood Counts',
    'Liver Function',
    'Kidney Function',
    'Coagulation',
    'Inflammation'
  ],
  'Multiple Myeloma': [
    'Blood Counts',
    'Liver Function',
    'Kidney Function',
    'Coagulation',
    'Inflammation'
  ],
  'Myelodysplastic Syndrome': [
    'Blood Counts',
    'Liver Function',
    'Kidney Function',
    'Coagulation',
    'Inflammation'
  ],

  // Skin Cancer
  'Melanoma': [
    'Disease-Specific Markers', // Limited markers (LDH sometimes)
    ...ALWAYS_RELEVANT
  ],
  'Basal Cell Carcinoma': [
    ...ALWAYS_RELEVANT
    // No standard tumor markers
  ],
  'Squamous Cell Carcinoma': [
    'Disease-Specific Markers', // SCC Antigen (if applicable)
    ...ALWAYS_RELEVANT
  ],
  'Merkel Cell Carcinoma': [
    ...ALWAYS_RELEVANT
  ],

  // Genitourinary Cancers
  'Prostate Cancer': [
    'Disease-Specific Markers', // PSA (NCCN recommended - primary marker)
    ...ALWAYS_RELEVANT
  ],
  'Bladder Cancer': [
    'Disease-Specific Markers', // Limited markers
    ...ALWAYS_RELEVANT
  ],
  'Kidney Cancer': [
    'Disease-Specific Markers', // Limited markers
    ...ALWAYS_RELEVANT
  ],
  'Renal Cell Carcinoma': [
    'Disease-Specific Markers', // Limited markers
    ...ALWAYS_RELEVANT
  ],
  'Testicular Cancer': [
    'Disease-Specific Markers', // AFP, Beta-hCG, LDH (NCCN recommended)
    ...ALWAYS_RELEVANT
  ],
  'Penile Cancer': [
    'Disease-Specific Markers', // SCC Antigen
    ...ALWAYS_RELEVANT
  ],

  // Head and Neck Cancers
  'Head and Neck Cancer': [
    'Disease-Specific Markers', // SCC Antigen
    ...ALWAYS_RELEVANT
  ],
  'Thyroid Cancer': [
    'Disease-Specific Markers', // Thyroglobulin
    'Thyroid Function', // Critical for thyroid cancer
    ...ALWAYS_RELEVANT
  ],
  'Oral Cancer': [
    'Disease-Specific Markers', // SCC Antigen
    ...ALWAYS_RELEVANT
  ],
  'Throat Cancer': [
    'Disease-Specific Markers', // SCC Antigen
    ...ALWAYS_RELEVANT
  ],
  'Laryngeal Cancer': [
    'Disease-Specific Markers', // SCC Antigen
    ...ALWAYS_RELEVANT
  ],
  'Nasopharyngeal Cancer': [
    'Disease-Specific Markers', // Limited markers
    ...ALWAYS_RELEVANT
  ],
  'Salivary Gland Cancer': [
    ...ALWAYS_RELEVANT
  ],

  // Brain and Nervous System
  'Brain Cancer': [
    ...ALWAYS_RELEVANT
    // No standard tumor markers
  ],
  'Glioblastoma': [
    ...ALWAYS_RELEVANT
  ],
  'Astrocytoma': [
    ...ALWAYS_RELEVANT
  ],
  'Oligodendroglioma': [
    ...ALWAYS_RELEVANT
  ],
  'Meningioma': [
    ...ALWAYS_RELEVANT
  ],
  'Neuroblastoma': [
    ...ALWAYS_RELEVANT
  ],
  'Spinal Cord Tumor': [
    ...ALWAYS_RELEVANT
  ],

  // Bone and Soft Tissue
  'Bone Cancer': [
    ...ALWAYS_RELEVANT
  ],
  'Osteosarcoma': [
    ...ALWAYS_RELEVANT
  ],
  'Ewing Sarcoma': [
    ...ALWAYS_RELEVANT
  ],
  'Soft Tissue Sarcoma': [
    ...ALWAYS_RELEVANT
  ],
  'Rhabdomyosarcoma': [
    ...ALWAYS_RELEVANT
  ],

  // Endocrine Cancers
  'Adrenal Cancer': [
    ...ALWAYS_RELEVANT
  ],
  'Pituitary Tumor': [
    ...ALWAYS_RELEVANT
  ],
  'Parathyroid Cancer': [
    ...ALWAYS_RELEVANT
  ],
  'Neuroendocrine Tumor': [
    'Disease-Specific Markers', // Chromogranin A (sometimes)
    ...ALWAYS_RELEVANT
  ],
  'Carcinoid Tumor': [
    'Disease-Specific Markers', // Chromogranin A
    ...ALWAYS_RELEVANT
  ],

  // Pediatric Cancers
  'Wilms Tumor': [
    ...ALWAYS_RELEVANT
  ],
  'Retinoblastoma': [
    ...ALWAYS_RELEVANT
  ],

  // Other Cancers
  'Thymoma': [
    ...ALWAYS_RELEVANT
  ],
  'Carcinoma of Unknown Primary': [
    'Disease-Specific Markers', // Various markers may be used
    ...ALWAYS_RELEVANT
  ]
};

/**
 * Get irrelevant categories for a cancer type
 * @param {string} cancerType - Cancer type name (e.g., "Ovarian Cancer")
 * @returns {string[]} Array of category names that are irrelevant for this cancer type
 */
export function getIrrelevantCategories(cancerType) {
  if (!cancerType || !DISEASE_RELEVANT_CATEGORIES[cancerType]) {
    return []; // Unknown cancer type - don't hide anything (conservative)
  }
  
  const relevantCategories = DISEASE_RELEVANT_CATEGORIES[cancerType];
  
  // Filter out categories that are NOT in the relevant list
  // Exclude 'Custom Values' and 'Others' from auto-hiding (user-added, assume relevant)
  return ALL_CATEGORIES.filter(cat => 
    !relevantCategories.includes(cat) && 
    cat !== 'Custom Values' && 
    cat !== 'Others'
  );
}

/**
 * Extract cancer type from diagnosis string
 * @param {string} diagnosis - Diagnosis string (e.g., "Stage IIIC Ovarian Cancer")
 * @param {string[]} cancerTypes - Array of valid cancer type names
 * @returns {string|null} Matched cancer type or null
 */
export function extractCancerTypeFromDiagnosis(diagnosis, cancerTypes) {
  if (!diagnosis) return null;
  
  const diagnosisLower = diagnosis.toLowerCase();
  
  // Try exact matches first (longer names first for specificity)
  const sortedTypes = [...cancerTypes].sort((a, b) => b.length - a.length);
  
  for (const type of sortedTypes) {
    const typeLower = type.toLowerCase();
    // Check if diagnosis contains the cancer type
    if (diagnosisLower.includes(typeLower)) {
      return type;
    }
  }
  
  return null;
}
