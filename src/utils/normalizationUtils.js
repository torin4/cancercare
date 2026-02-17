// Brief descriptions for common lab values
// Vital Value Normalization System
// Maps all variations to canonical keys for consistent display and descriptions
export const vitalSynonymMap = {
  'blood_pressure': ['bloodpressure', 'bp', 'blood pressure', 'systolic', 'diastolic', 'bp_systolic', 'bp_diastolic'],
  'heart_rate': ['heartrate', 'hr', 'heart rate', 'pulse', 'pulse rate', 'bpm'],
  'temperature': ['temp', 'temperature', 'body temperature', 'body temp', 'fever'],
  'weight': ['weight', 'body weight', 'bodyweight', 'mass'],
  'oxygen_saturation': ['o2sat', 'o2 saturation', 'spo2', 'oxygen saturation', 'o2', 'sat'],
  'respiratory_rate': ['rr', 'respiratory rate', 'breathing rate', 'respiration', 'breathing'],
  'sleep_score': ['sleep_score', 'sleepscore', 'sleep score', 'sleep', 'sleep quality', 'oura sleep', 'garmin sleep', 'apple sleep']
  };

// Reverse map: create lookup from any variation to canonical key
export const vitalKeyMap = {};
Object.entries(vitalSynonymMap).forEach(([canonicalKey, variations]) => {
  variations.forEach(variation => {
    vitalKeyMap[variation.toLowerCase()] = canonicalKey;
  });
});

// Display name mapping: canonical key -> user-friendly display name
export const vitalDisplayNames = {
  'blood_pressure': 'Blood Pressure',
  'heart_rate': 'Resting Heart Rate',
  'temperature': 'Temperature',
  'weight': 'Weight',
  'oxygen_saturation': 'Oxygen Saturation',
  'respiratory_rate': 'Respiratory Rate',
  'sleep_score': 'Sleep Score'
  };

// Vital descriptions
export const vitalDescriptions = {
  'blood_pressure': 'Blood pressure measures the force of blood against artery walls. Systolic (top number) is pressure when heart beats, diastolic (bottom number) is pressure when heart rests. Normal is typically <120/80 mmHg.',
  'heart_rate': 'Resting heart rate (pulse) measures how many times your heart beats per minute when at rest. Normal resting heart rate is typically 60-100 beats per minute for adults. Note: Heart rate can vary significantly with activity, so this should be measured when resting.',
  'temperature': 'Body temperature indicates whether you have a fever or hypothermia. Normal body temperature is typically 97.5-99.5°F (36.4-37.5°C).',
  'weight': 'Body weight is an important vital sign that can indicate fluid retention, nutritional status, or response to treatment. Significant changes may require medical attention.',
  'oxygen_saturation': 'Oxygen saturation (SpO2) measures how much oxygen your blood is carrying. Normal levels are typically >95%. Low levels may indicate breathing problems or lung issues.',
  'respiratory_rate': 'Respiratory rate measures how many breaths you take per minute. Normal rate is typically 12-20 breaths per minute for adults at rest.',
  'sleep_score': 'Daily sleep quality score (0-100) from wearables like Apple Health, Garmin Connect, or Oura Ring. Scores above 70 generally indicate good sleep quality. Adequate sleep supports immune function and recovery during cancer treatment.'
  };

// Normalize vital name to canonical key
export const normalizeVitalName = (rawName) => {
  if (!rawName) return null;
  
  // Clean the raw name
  const cleaned = rawName.toString().toLowerCase().trim()
    .replace(/[^\w\s]/g, ' ') // Replace special chars with spaces
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
  
  // Look up in vital key map
  if (vitalKeyMap[cleaned]) {
    return vitalKeyMap[cleaned];
  }
  
  // Try partial matches
  for (const [canonicalKey, variations] of Object.entries(vitalSynonymMap)) {
    if (variations.some(v => cleaned.includes(v) || v.includes(cleaned))) {
    return canonicalKey;
    }
  }
  
  return null; // Unknown vital
  };

// Get display name for vital
export const getVitalDisplayName = (vitalKeyOrName) => {
  // First try to normalize
  const canonicalKey = normalizeVitalName(vitalKeyOrName);
  if (canonicalKey && vitalDisplayNames[canonicalKey]) {
    return vitalDisplayNames[canonicalKey];
  }
  
  // Fallback: return original with basic formatting
  if (!vitalKeyOrName) return 'Unknown Vital';
  const name = vitalKeyOrName.toString();
  return name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, ' ');
  };

// Lab Value Normalization System
// Maps all variations to canonical keys for consistent categorization and descriptions
  
// Synonym mapping: all variations -> canonical key
export const labSynonymMap = {
  // Disease-Specific Markers
  'ca125': ['ca125', 'ca-125', 'ca 125', 'ca_125'],
  'ca199': ['ca199', 'ca 19-9', 'ca-19-9', 'ca19-9', 'ca 19 9'],
  'ca153': ['ca153', 'ca 15-3', 'ca-15-3', 'ca15-3', 'ca 15 3'],
  'ca724': ['ca724', 'ca 72-4', 'ca-72-4', 'ca72-4', 'ca 72 4'],
  'ca242': ['ca242', 'ca 242', 'ca-242'],
  'ca50': ['ca50', 'ca 50', 'ca-50'],
  'cea': ['cea'],
  'afp': ['afp'],
  'psa': ['psa'],
  'he4': ['he4'],
  'inhibinb': ['inhibinb', 'inhibin b'],
  'romaindex': ['romaindex', 'roma index', 'roma'],
  'ca2729': ['ca2729', 'ca 27-29', 'ca-27-29', 'ca27-29', 'ca 27 29'],
  'scc_antigen': ['scc antigen', 'scc', 'squamous cell carcinoma antigen'],
  'cyfra211': ['cyfra211', 'cyfra 21-1', 'cyfra-21-1', 'cyfra21-1'],
  'nse': ['nse', 'neuron-specific enolase', 'neuron specific enolase'],
  'betahcg': ['betahcg', 'beta-hcg', 'β-hcg', 'bhcg', 'b-hcg', 'beta hcg'],
  
  // Liver Function
  'alt': ['alt', 'gpt'],
  'ast': ['ast', 'got'],
  'ast_alt_ratio': ['astalt', 'ast/alt', 'ast alt ratio', 'ast_alt'],
  'ag_ratio': ['agratio', 'a/g', 'a g ratio', 'a/g ratio', 'albumin/globulin ratio', 'albumin globulin ratio', 'ag比', 'a/g比'],
  'albi_score': ['albiscore', 'albi score', 'albi'],
  'alp': ['alp', 'alkphos', 'alkalinephosphatase', 'alkaline phosphatase'],
  'alp_ifcc': ['alpifcc', 'alp ifcc', 'alp (ifcc)'],
  'bilirubin_total': ['tbil', 't-bil', 'totalbilirubin', 'total bilirubin', 'bilirubin'],
  'bilirubin_direct': ['direct bilirubin', 'conjugated bilirubin', 'dbil', 'd-bil'],
  'bilirubin_indirect': ['indirect bilirubin', 'unconjugated bilirubin', 'ibil', 'i-bil'],
  'albumin': ['alb', 'albumin'],
  'ggt': ['ggt', 'γgt', 'gamma gt', 'gamma gtp', 'gammagtp', 'ggtp', 'gamma-glutamyl transpeptidase'],
  'ck': ['ck', 'cpk', 'creatine kinase', 'creatine phosphokinase'],
  'ldh': ['ldh', 'ld', 'ldifcc', 'ld ifcc'],
  'amylase': ['amylase', 'amy'],
  
  // Kidney Function
  'creatinine': ['creatinine', 'cre'],
  'egfr': ['egfr', 'e gfr', 'e-gfr', 'estimated gfr', 'estimated glomerular filtration rate', 'gfr', 'glomerular filtration rate', 'egfr estimated', 'egfr-estimated', 'egfr (estimated)', 'egfr(estimated)'],
  'bun': ['bun', 'un', 'urea nitrogen'],
  'urea': ['urea'],
  'uric_acid': ['uric acid', 'uricacid', 'ua'],
  'urineprotein': ['urineprotein', 'urine protein', 'protein urine'],
  'urinecreatinine': ['urinecreatinine', 'urine creatinine'],
  'urine_wbc': ['urinewbc', 'urinewbcvisual', 'urine wbc', 'urine wbc visual', 'urine white blood cells'],
  'urine_rbc': ['urinerbc', 'urinerbcvisual', 'urine rbc', 'urine rbc visual', 'urine red blood cells'],
  'urine_hyaline_casts': ['urinehyalinecasts', 'urinehyalinecastsvisual', 'urine hyaline casts', 'hyaline casts urine'],
  'urine_renal_tubular_epithelial': ['urinerenaltubularepithelialcells', 'urinerenaltubularepithelialcellsvisual', 'urine renal tubular epithelial cells', 'rtecs urine'],
  'urine_squamous_epithelial': ['urinesquamousepithelialcells', 'urinesquamousepithelialcellsvisual', 'urine squamous epithelial cells', 'squamous epithelial urine'],
  'urine_bacteria': ['urinebacteria', 'urinebacteriavisual', 'urine bacteria'],
  'urine_yeast': ['urineyeast', 'urineyeastvisual', 'urine yeast'],
  'urine_crystals': ['urinecrystals', 'urinecrystalsvisual', 'urine crystals'],
  'urine_mucus': ['urinemucus', 'urinemucusvisual', 'urine mucus'],
  'urine_color': ['urinecolor', 'urine color'],
  'urine_appearance': ['urineappearance', 'urine appearance'],
  'urine_glucose': ['urineglucose', 'urine glucose'],
  'urine_ketones': ['urineketones', 'urine ketones', 'urineketone', 'urine ketone'],
  'urine_bilirubin': ['urinebilirubin', 'urine bilirubin'],
  'urine_blood': ['urineblood', 'urine blood', 'urine occult blood'],
  'urine_nitrite': ['urinenitrite', 'urine nitrite'],
  'urine_leukocyte_esterase': ['urineleukocyteesterase', 'urine leukocyte esterase'],
  'urine_specific_gravity': ['urinespecificgravity', 'urine specific gravity', 'specific gravity urine', 'specific gravity (urine)', 'urine sg'],
  'urine_ph': ['urineph', 'urine ph', 'urine ph value', 'ph (urine)', 'ph urine'],
  'urine_urobilinogen': ['urineurobilinogen', 'urine urobilinogen', 'urobilinogen urine', 'urobilinogen'],

  // Blood Counts
  'wbc': [
    'wbc',
    'wbc count',
    'wbccount',
    'white blood cell count',
    'white blood cells',
    'white blood cell',
    'whitebloodcellcount',
    'whitebloodcells',
    'whitebloodcell',
    'leukocytes',
    'leukocyte count',
    'leucocytes',
    'leucocyte count'
  ],
  'rbc': ['rbc', 'rbc count', 'rbccount', 'red blood cell count', 'red blood cells', 'red blood cell', 'redbloodcellcount', 'redbloodcells', 'redbloodcell', 'erythrocytes', 'erythrocyte count'],
  'hemoglobin': ['hemoglobin', 'hgb'],
  'hematocrit': ['hematocrit', 'hct'],
  'platelets': ['platelets', 'plt'],
  'anc': ['anc'],
  'neutrophils_abs': [
    'neutro#',
    'neut#',
    'neutrophilsabs',
    'neutrophil abs',
    'neutrophils abs',
    'neutrophil absolute count',
    'neutrophils absolute count',
    'absolute neutrophil count'
  ],
  'neutrophils_pct': [
    'neutro%',
    'neut%',
    'neutrophil%',
    'neutrophils%',
    'neutrophil percent',
    'neutrophils percent',
    'neutrophil percentage',
    'neutrophils percentage',
    'neutrophil pct',
    'neutrophils pct',
    'neutrophils (during chemotherapy)',
    'neutrophils during chemotherapy',
    'neutrophilsduringchemotherapy'
  ],
  'lymphocytes_abs': [
    'lymph#',
    'lym#',
    'lymphocytesabs',
    'lymphocyte abs',
    'lymphocytes abs',
    'lymphocyte absolute count',
    'lymphocytes absolute count',
    'absolute lymphocyte count'
  ],
  'lymphocytes_pct': [
    'lymph%',
    'lym%',
    'lymphocyte%',
    'lymphocytes%',
    'lymphocyte percent',
    'lymphocytes percent',
    'lymphocyte percentage',
    'lymphocytes percentage',
    'lymphocyte pct',
    'lymphocytes pct'
  ],
  'monocytes_abs': [
    'mono#',
    'mon#',
    'monocytesabs',
    'monocyte abs',
    'monocytes abs',
    'monocyte absolute count',
    'monocytes absolute count',
    'absolute monocyte count'
  ],
  'monocytes_pct': [
    'mono%',
    'mon%',
    'monocyte%',
    'monocytes%',
    'monocyte percent',
    'monocytes percent',
    'monocyte percentage',
    'monocytes percentage',
    'monocyte pct',
    'monocytes pct'
  ],
  'eosinophils_abs': [
    'eo#',
    'eosinophilsabs',
    'eosinophil abs',
    'eosinophils abs',
    'eosinophil absolute count',
    'eosinophils absolute count',
    'absolute eosinophil count'
  ],
  'eosinophils_pct': [
    'eo%',
    'eosinophil%',
    'eosinophils%',
    'eosinophil percent',
    'eosinophils percent',
    'eosinophil percentage',
    'eosinophils percentage',
    'eosinophil pct',
    'eosinophils pct'
  ],
  'basophils_abs': [
    'ba#',
    'basophilsabs',
    'basophil abs',
    'basophils abs',
    'basophil absolute count',
    'basophils absolute count',
    'absolute basophil count'
  ],
  'basophils_pct': [
    'ba%',
    'basophil%',
    'basophils%',
    'basophil percent',
    'basophils percent',
    'basophil percentage',
    'basophils percentage',
    'basophil pct',
    'basophils pct'
  ],
  'mcv': ['mcv'],
  'mch': ['mch'],
  'mchc': ['mchc'],
  'rdw': ['rdw', 'red cell distribution width', 'red blood cell distribution width'],
  'rdw_cv': ['rdwcv', 'rdw-cv'],
  'mpv': ['mpv', 'mean platelet volume'],
  'platelet_crit': ['plateletcrit', 'platelet crit', 'plateletcrit%', 'pct'],
  'pdw_sd': ['pdwsd', 'pdw-sd', 'pdw sd', 'platelet distribution width sd'],
  'nrbc': ['nrbc', 'nucleated red blood cells', 'nucleated rbc'],
  'nrbc_pct': ['nrbc%', 'nrbc percentage', 'nrbc percent'],
  'reticulocyte_count': ['reticulocyte count', 'retic count', 'reticulocytes'],
  'reticulocyte_pct': ['reticulocyte%', 'reticulocyte percentage', 'reticulocyte percent', 'retic%'],
  
  // Thyroid Function
  'tsh': ['tsh'],
  't3': ['t3'],
  't4': ['t4'],
  'ft3': ['ft3', 'free t3', 'freet3'],
  'ft4': ['ft4', 'free t4', 'freet4'],
  'thyroglobulin': ['thyroglobulin', 'tg'],
  
  // Cardiac Markers
  'troponin': ['troponin', 'trop'],
  'bnp': ['bnp'],
  'ntprobnp': ['ntprobnp', 'nt-probnp'],
  'ckmb': ['ckmb', 'ck-mb'],
  'myoglobin': ['myoglobin'],
  
  // Inflammation
  'ferritin': ['ferritin', 'フェリチン', 'ferritinjapanese'],
  'crp': ['crp'],
  'esr': ['esr'],
  
  // Electrolytes
  'sodium': ['sodium', 'na'],
  'potassium': ['potassium', 'k'],
  'chloride': ['chloride', 'cl', 'ci'],
  'bicarbonate': ['bicarbonate', 'hco3', 'bicarb'],
  'co2': ['co2'],
  'magnesium': ['magnesium', 'mg'],
  'phosphorus': ['phosphorus', 'p', 'phos', 'p (phosphorus)', 'p(phosphorus)'],
  'calcium': ['calcium', 'ca'],
  'calcium_ionized': ['ionized calcium', 'ca2+', 'ca²⁺', 'ca++', 'ionized ca'],
  'phosphate': ['phosphate', 'phosphorus', 'p', 'phos', 'po4'],
  
  // Coagulation
  'pt': ['pt', 'ptactivity', 'pt activity', 'pt活性値', 'pt activity value'],
  'inr': ['inr'],
  'aptt': ['aptt'],
  'ddimer': ['ddimer', 'd-dimer', 'dimer', 'd-ダイマー'],
  'fdp': ['fdp'],
  'fibrinogen': ['fibrinogen', 'fbg'],
  'iron': ['fe', 'iron', 'serum iron'],
  'fib4_index': ['fib4', 'fib 4', 'fib-4', 'fib 4 index', 'fib-4 index', 'fib4 index'],
  'hcv_screening': ['hcv screening', 'hcvscreening', 'hcv antibody', 'anti hcv', 'hcv ab', 'hcv'],
  'antithrombin_iii': ['antithrombin iii', 'at-iii', 'at3', 'antithrombin'],
  'protein_c': ['protein c', 'proteinc'],
  'protein_s': ['protein s', 'proteins'],
  
  // Other
  'glucose': ['glucose', 'glu', '血糖'],
  'hba1c': ['hba1c'],
  'iga': ['iga'],
  'igg': ['igg'],
  'igm': ['igm'],
  'vitamin_d': ['vitamin d', 'vitamind', '25(oh)d', '25ohd'],
  'beta2_microglobulin': ['beta2 microglobulin', 'beta-2 microglobulin', 'β2 microglobulin', 'b2m'],
  'procalcitonin': ['procalcitonin', 'procalcitonin pct', 'pct procalcitonin'],
  'il6': ['il6', 'il-6', 'interleukin-6', 'interleukin 6']
  };

// Helper function to normalize a string the same way normalizeLabName does
const normalizeForLookup = (str) => {
  if (!str) return '';
  let cleaned = str.toString().trim().toLowerCase();
  // Remove common separators (same as normalizeLabName)
  cleaned = cleaned.replace(/[\s\-_\/\.]/g, '');
  return cleaned;
};

// Reverse map: create lookup from any variation to canonical key
// Normalize variations the same way normalizeLabName does for consistent matching
export const labKeyMap = {};
Object.entries(labSynonymMap).forEach(([canonicalKey, variations]) => {
  variations.forEach(variation => {
    const normalized = normalizeForLookup(variation);
    labKeyMap[normalized] = canonicalKey;
  });
});

// Display name mapping: canonical key -> user-friendly display name
export const labDisplayNames = {
  'ca125': 'CA-125',
  'ca199': 'CA 19-9',
  'ca153': 'CA 15-3',
  'ca724': 'CA 72-4',
  'ca242': 'CA 242',
  'ca50': 'CA 50',
  'cea': 'CEA',
  'afp': 'AFP',
  'psa': 'PSA',
  'he4': 'HE4',
  'inhibinb': 'Inhibin B',
  'romaindex': 'ROMA Index',
  'ca2729': 'CA 27-29',
  'scc_antigen': 'SCC Antigen',
  'cyfra211': 'CYFRA 21-1',
  'nse': 'NSE',
  'betahcg': 'Beta-hCG',
  'alt': 'ALT',
  'ast': 'AST',
  'ast_alt_ratio': 'AST/ALT Ratio',
  'ag_ratio': 'A/G Ratio',
  'albi_score': 'ALBI Score',
  'alp': 'ALP',
  'alp_ifcc': 'ALP (IFCC)',
  'bilirubin_total': 'Total Bilirubin',
  'bilirubin_direct': 'Direct Bilirubin',
  'bilirubin_indirect': 'Indirect Bilirubin',
  'albumin': 'Albumin',
  'ggt': 'GGT',
  'ck': 'CK',
  'ldh': 'LDH',
  'amylase': 'Amylase',
  'creatinine': 'Creatinine',
  'egfr': 'eGFR',
  'bun': 'BUN',
  'urea': 'Urea',
  'uric_acid': 'Uric Acid',
  'urineprotein': 'Urine Protein',
  'urinecreatinine': 'Urine Creatinine',
  'urine_wbc': 'Urine WBC',
  'urine_rbc': 'Urine RBC',
  'urine_hyaline_casts': 'Urine Hyaline Casts',
  'urine_renal_tubular_epithelial': 'Urine Renal Tubular Epithelial Cells',
  'urine_squamous_epithelial': 'Urine Squamous Epithelial Cells',
  'urine_bacteria': 'Urine Bacteria',
  'urine_yeast': 'Urine Yeast',
  'urine_crystals': 'Urine Crystals',
  'urine_mucus': 'Urine Mucus',
  'urine_color': 'Urine Color',
  'urine_appearance': 'Urine Appearance',
  'urine_glucose': 'Urine Glucose',
  'urine_ketones': 'Urine Ketones',
  'urine_bilirubin': 'Urine Bilirubin',
  'urine_blood': 'Urine Blood',
  'urine_nitrite': 'Urine Nitrite',
  'urine_leukocyte_esterase': 'Urine Leukocyte Esterase',
  'urine_specific_gravity': 'Urine Specific Gravity',
  'urine_ph': 'Urine pH',
  'urine_urobilinogen': 'Urine Urobilinogen',
  'wbc': 'WBC',
  'rbc': 'RBC',
  'hemoglobin': 'Hemoglobin',
  'hematocrit': 'Hematocrit',
  'platelets': 'Platelets',
  'anc': 'ANC',
  'neutrophils_abs': 'Neutrophil Absolute Count',
  'neutrophils_pct': 'Neutrophil Percentage',
  'lymphocytes_abs': 'Lymphocyte Absolute Count',
  'lymphocytes_pct': 'Lymphocyte Percentage',
  'monocytes_abs': 'Monocyte Absolute Count',
  'monocytes_pct': 'Monocyte Percentage',
  'eosinophils_abs': 'Eosinophil Absolute Count',
  'eosinophils_pct': 'Eosinophil Percentage',
  'basophils_abs': 'Basophil Absolute Count',
  'basophils_pct': 'Basophil Percentage',
  'mcv': 'MCV',
  'mch': 'MCH',
  'mchc': 'MCHC',
  'rdw': 'RDW',
  'rdw_cv': 'RDW-CV',
  'mpv': 'MPV',
  'platelet_crit': 'Platelet Crit',
  'pdw_sd': 'PDW-SD',
  'nrbc': 'NRBC',
  'nrbc_pct': 'NRBC Percentage',
  'reticulocyte_count': 'Reticulocyte Count',
  'reticulocyte_pct': 'Reticulocyte Percentage',
  'tsh': 'TSH',
  't3': 'T3',
  't4': 'T4',
  'ft3': 'Free T3',
  'ft4': 'Free T4',
  'thyroglobulin': 'Thyroglobulin',
  'troponin': 'Troponin',
  'bnp': 'BNP',
  'ntprobnp': 'NT-proBNP',
  'ckmb': 'CK-MB',
  'myoglobin': 'Myoglobin',
  'ferritin': 'Ferritin',
  'crp': 'CRP',
  'esr': 'ESR',
  'sodium': 'Sodium',
  'potassium': 'Potassium',
  'chloride': 'Chloride',
  'bicarbonate': 'Bicarbonate',
  'co2': 'CO2',
  'magnesium': 'Magnesium',
  'phosphorus': 'Phosphorus',
  'calcium': 'Calcium',
  'calcium_ionized': 'Ionized Calcium',
  'phosphate': 'Phosphate',
  'pt': 'PT',
  'inr': 'INR',
  'aptt': 'APTT',
  'ddimer': 'D-dimer',
  'fdp': 'FDP',
  'fibrinogen': 'Fibrinogen',
  'iron': 'Iron (Fe)',
  'fib4_index': 'FIB-4 Index',
  'hcv_screening': 'HCV Screening',
  'antithrombin_iii': 'Antithrombin III',
  'protein_c': 'Protein C',
  'protein_s': 'Protein S',
  'glucose': 'Glucose',
  'hba1c': 'HbA1c',
  'iga': 'IgA',
  'igg': 'IgG',
  'igm': 'IgM',
  'vitamin_d': 'Vitamin D',
  'beta2_microglobulin': 'Beta-2 Microglobulin',
  'procalcitonin': 'Procalcitonin',
  'il6': 'IL-6'
  };

// Normalize lab name to canonical key
export const normalizeLabName = (rawName) => {
  if (!rawName) return null;
  
  // Clean the raw name
  let cleaned = rawName.toString().trim();
  
  // Convert to lowercase for matching
  cleaned = cleaned.toLowerCase();
  
  // Remove common separators
  cleaned = cleaned.replace(/[\s\-_\/\.]/g, '');
  
  // Normalize common variants
  cleaned = cleaned.replace(/ntprobnp/g, 'ntprobnp');
  cleaned = cleaned.replace(/ckmb/g, 'ckmb');
  cleaned = cleaned.replace(/ca199/g, 'ca199');
  cleaned = cleaned.replace(/ca125/g, 'ca125');
  cleaned = cleaned.replace(/freet3/g, 'ft3');
  cleaned = cleaned.replace(/freet4/g, 'ft4');
  
  // Normalize red blood cell variations to rbc (before labKeyMap lookup)
  if (cleaned.includes('redbloodcell') || cleaned.includes('erythrocyte') || cleaned === 'rbc' || cleaned === 'rbccount') {
    cleaned = 'rbc';
  }
  
  // Normalize white blood cell variations to wbc (before labKeyMap lookup)
  if (cleaned.includes('whitebloodcell') || cleaned.includes('leukocyte') || cleaned.includes('leucocyte') || cleaned === 'wbc' || cleaned === 'wbccount') {
    cleaned = 'wbc';
  }
  
  // Look up in synonym map
  const canonicalKey = labKeyMap[cleaned];
  if (canonicalKey) {
    return canonicalKey;
  }
  
  // If not found in synonym map, return the cleaned version for partial matching
  // This allows "color" and "urinecolor" to be compared
  return cleaned;
  };

// Check if two lab names should be considered the same (for merging)
export const shouldMergeLabNames = (name1, name2) => {
  if (!name1 || !name2) return false;
  
  // Normalize both names
  const normalized1 = normalizeLabName(name1);
  const normalized2 = normalizeLabName(name2);
  
  // If they normalize to the same thing, merge them
  if (normalized1 === normalized2) {
    return true;
  }

  // Do not merge urine cell counts with blood cell counts.
  // These are clinically distinct metrics and should remain separate cards.
  const nonMergePairs = new Set([
    'urine_wbc::wbc',
    'wbc::urine_wbc',
    'urine_rbc::rbc',
    'rbc::urine_rbc'
  ]);
  if (nonMergePairs.has(`${normalized1}::${normalized2}`)) {
    return false;
  }
  
  // Check if one contains the other (for cases like "Color" and "Urine Color")
  // Remove common prefixes that might cause false matches
  const removeCommonPrefixes = (str) => {
    return str
      .replace(/^urine/, '')
      .replace(/^blood/, '')
      .replace(/^serum/, '')
      .replace(/^plasma/, '')
      .trim();
  };
  
  const cleaned1 = removeCommonPrefixes(normalized1);
  const cleaned2 = removeCommonPrefixes(normalized2);
  
  // If one is empty after removing prefixes, use the original
  const final1 = cleaned1 || normalized1;
  const final2 = cleaned2 || normalized2;
  
  // Check if one contains the other (and they're not too different in length)
  if (final1.includes(final2) || final2.includes(final1)) {
    // Only merge if the shorter one is at least 3 characters and the difference is reasonable
    const shorter = final1.length < final2.length ? final1 : final2;
    const longer = final1.length >= final2.length ? final1 : final2;
    
    if (shorter.length >= 3 && longer.length <= shorter.length * 2) {
      return true;
    }
  }
  
  return false;
  };

// Get display name for a lab (canonical key or raw name)
export const getLabDisplayName = (labKeyOrName) => {
  if (!labKeyOrName) return 'Unknown Lab';
  
  // If the input is already a well-formatted display name (starts with capital, has proper spacing),
  // and it's not a canonical key, prefer to use it as-is to preserve original labels like "HGB"
  const str = labKeyOrName.toString().trim();
  
  // Check if it looks like a display name (has capital letters, not all lowercase)
  const looksLikeDisplayName = /^[A-Z]/.test(str) && str !== str.toLowerCase();
  
  // First try to normalize to see if it maps to a canonical key
  const canonicalKey = normalizeLabName(labKeyOrName);
  
  // If it normalizes to a canonical key, check if the original is already a good display name
  // For cases like "HGB" -> "hemoglobin", we want to preserve "HGB" if it's the original label
  if (canonicalKey && labDisplayNames[canonicalKey]) {
    // If the original looks like a display name and is different from the normalized display name,
    // prefer the original (e.g., "HGB" should stay "HGB", not become "Hemoglobin")
    if (looksLikeDisplayName && str !== labDisplayNames[canonicalKey]) {
      // But only if it's a reasonable length and format (not too long, has proper casing)
      if (str.length <= 20 && /^[A-Z][A-Z0-9\-\s]*$/.test(str)) {
        return str;
      }
    }
    return labDisplayNames[canonicalKey];
  }
  
  // If no canonical key found, try to break up concatenated lowercase (e.g. urinehyalinecastsvisual)
  const hasSeparators = /[\s\-_]/.test(str);
  if (!hasSeparators && str.length > 4) {
    const subwords = ['urine', 'blood', 'wbc', 'rbc', 'visual', 'casts', 'cells', 'epithelial', 'squamous', 'renal', 'tubular', 'hyaline', 'bacteria', 'yeast', 'crystals', 'mucus', 'protein', 'creatinine', 'glucose', 'ketones', 'bilirubin', 'nitrite', 'esterase', 'leukocyte', 'specific', 'gravity', 'appearance', 'hemoglobin', 'platelet', 'white', 'red'];
    let spaced = str.toLowerCase();
    subwords.forEach(w => {
      const re = new RegExp(w, 'gi');
      spaced = spaced.replace(re, ' ' + w + ' ');
    });
    spaced = spaced.replace(/\s+/g, ' ').trim();
    if (spaced !== str) {
      return spaced.split(' ').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join(' ');
    }
  }
  return str.split(/[\s\-_]/).map(word =>
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ');
  };

// Lab value descriptions - using ONLY canonical keys
export const labValueDescriptions = {
  // Disease-Specific Markers
  'ca125': 'Tumor marker for ovarian cancer. Elevated levels may indicate disease activity or recurrence.',
  'ca199': 'Tumor marker for pancreatic and gastrointestinal cancers. Used to monitor treatment response.',
  'ca153': 'Tumor marker for breast cancer. Helps monitor disease progression and treatment effectiveness.',
  'ca724': 'Tumor marker for gastrointestinal cancers, particularly gastric cancer. Used to monitor treatment response and recurrence.',
  'ca242': 'Tumor marker for pancreatic and colorectal cancers. Used in combination with other markers for diagnosis and monitoring.',
  'ca50': 'Tumor marker for pancreatic and gastrointestinal cancers. Elevated levels may indicate disease activity.',
  'cea': 'Carcinoembryonic antigen. Used to monitor colorectal, lung, and other cancers. Elevated levels may indicate recurrence.',
  'afp': 'Alpha-fetoprotein. Marker for liver cancer and germ cell tumors. Also elevated in pregnancy.',
  'psa': 'Prostate-specific antigen. Used to screen and monitor prostate cancer. Age-specific normal ranges apply.',
  'he4': 'Human epididymis protein 4. Ovarian cancer biomarker, often used with CA-125 for better accuracy.',
  'inhibinb': 'Hormone marker for ovarian cancer, particularly granulosa cell tumors. Also used in fertility assessment.',
  'romaindex': 'Risk of Ovarian Malignancy Algorithm. Combines CA-125 and HE4 levels to assess ovarian cancer risk.',
  'ca2729': 'CA 27-29. A tumor marker primarily used in breast cancer to monitor treatment response and detect disease recurrence.',
  'scc_antigen': 'SCC Antigen (Squamous Cell Carcinoma Antigen). A tumor marker associated with squamous cell carcinomas, including cervical, lung, and head and neck cancers.',
  'cyfra211': 'CYFRA 21-1. A fragment of cytokeratin 19 commonly elevated in non-small cell lung cancer and used to assess tumor burden.',
  'nse': 'NSE (Neuron-Specific Enolase). A marker associated with neuroendocrine tumors and small cell lung cancer, often reflecting disease activity.',
  'betahcg': 'Beta-hCG (β-hCG). A tumor marker used in germ cell tumors and trophoblastic disease, and occasionally elevated in other malignancies.',
  // Blood Counts
  'wbc': 'White blood cell count. Measures immune system cells. Low counts (neutropenia) increase infection risk during chemotherapy.',
  'rbc': 'Red blood cell count. Measures oxygen-carrying cells. Low levels indicate anemia.',
  'hemoglobin': 'Protein in red blood cells that carries oxygen. Low levels (anemia) cause fatigue and weakness.',
  'hematocrit': 'Percentage of red blood cells in blood. Low levels indicate anemia.',
  'platelets': 'Blood cells that help with clotting. Low levels (thrombocytopenia) increase bleeding risk.',
  'anc': 'Absolute neutrophil count. Critical for infection risk. Should be >1500/μL to reduce infection risk.',
  'neutrophils_abs': 'Neutrophil absolute count. Total number of neutrophils in blood. Critical for fighting bacterial infections. Low levels (neutropenia) increase infection risk.',
  'neutrophils_pct': 'Neutrophil percentage. Percentage of white blood cells that are neutrophils. Normal range is typically 48.0-61.0%. Low levels increase infection risk.',
  'lymphocytes_abs': 'Lymphocyte absolute count. Total number of lymphocytes in blood. Important for immune function. Low levels may indicate immune suppression.',
  'lymphocytes_pct': 'Lymphocyte percentage. Percentage of white blood cells that are lymphocytes. Normal range is typically 25.0-45.0%. Low levels may indicate immune suppression.',
  'monocytes_abs': 'Monocyte absolute count. Total number of monocytes in blood. Elevated in chronic infections or inflammatory conditions.',
  'monocytes_pct': 'Monocyte percentage. Percentage of white blood cells that are monocytes. Normal range is typically 4.0-7.0%. Elevated in chronic infections or inflammatory conditions.',
  'eosinophils_abs': 'Eosinophil absolute count. Total number of eosinophils in blood. Elevated in allergies, asthma, or parasitic infections.',
  'eosinophils_pct': 'Eosinophil percentage. Percentage of white blood cells that are eosinophils. Normal range is typically 1.0-5.0%. Elevated in allergies or parasitic infections.',
  'basophils_abs': 'Basophil absolute count. Total number of basophils in blood. Usually very low. Elevated in rare conditions like chronic myeloid leukemia.',
  'basophils_pct': 'Basophil percentage. Percentage of white blood cells that are basophils. Normal range is typically 0.0-1.0%.',
  'mcv': 'Mean corpuscular volume. Average size of red blood cells. Used to classify types of anemia.',
  'mch': 'Mean corpuscular hemoglobin. Average amount of hemoglobin per red blood cell. Low in iron deficiency anemia.',
  'mchc': 'Mean corpuscular hemoglobin concentration. Average concentration of hemoglobin in red blood cells. Used in anemia diagnosis.',
  'rdw': 'Red cell distribution width. Measures variation in red blood cell size. Elevated in iron deficiency or other anemias.',
  'rdw_cv': 'Red cell distribution width - coefficient of variation. Measures variation in red blood cell size as a percentage. Elevated in iron deficiency or other anemias.',
  'mpv': 'Mean platelet volume. Average size of platelets in the blood. Changes can indicate altered bone marrow activity, platelet destruction, or effects of chemotherapy.',
  'platelet_crit': 'Platelet crit (PCT). Percentage of blood volume occupied by platelets. Helps assess overall platelet mass and marrow recovery.',
  'pdw_sd': 'Platelet distribution width (SD). Reflects variability in platelet size. Higher values can indicate platelet activation or recovery after chemotherapy.',
  'nrbc': 'Nucleated red blood cells. Immature red blood cells circulating in the bloodstream. Their presence suggests severe bone marrow stress, hypoxia, or marrow infiltration by cancer.',
  'nrbc_pct': 'NRBC percentage. Proportion of nucleated red blood cells relative to total white blood cells. Used to assess bone marrow response or failure during intensive cancer treatment.',
  'reticulocyte_count': 'Reticulocyte count. Number of immature red blood cells released from the bone marrow. Reflects marrow response to anemia, bleeding, or chemotherapy-induced suppression.',
  'reticulocyte_pct': 'Reticulocyte percentage. Percentage of reticulocytes among total red blood cells. Helps distinguish whether anemia is due to decreased production or increased destruction.',
  // Kidney Function
  'creatinine': 'Waste product filtered by kidneys. High levels indicate kidney dysfunction or dehydration.',
  'egfr': 'Estimated glomerular filtration rate. Measures kidney filtering capacity. Adjusted for age, gender, and race. Normal is typically ≥90 mL/min/1.73m². Values 60-89 indicate mild kidney dysfunction, <60 indicates chronic kidney disease.',
  'bun': 'Blood urea nitrogen. Waste product from protein breakdown. High levels may indicate kidney dysfunction.',
  'urea': 'Waste product from protein metabolism. Filtered by kidneys. High levels indicate kidney dysfunction or dehydration.',
  'uric_acid': 'Uric acid. End product of purine metabolism. Elevated values may occur with kidney dysfunction, dehydration, tumor lysis, or gout risk.',
  'urineprotein': 'Protein in urine. Normally minimal. Elevated levels (proteinuria) indicate kidney damage or disease.',
  'urinecreatinine': 'Creatinine in urine. Used with blood creatinine to calculate kidney function and detect kidney disease.',
  'urine_glucose': 'Urine glucose. Sugar in urine is usually absent; positive results may indicate hyperglycemia, diabetes, or renal tubular dysfunction.',
  'urine_ketones': 'Urine ketones. Byproducts of fat metabolism; elevated levels may occur with fasting, poor oral intake, uncontrolled diabetes, or metabolic stress.',
  'urine_bilirubin': 'Urine bilirubin. Conjugated bilirubin in urine may suggest liver dysfunction or biliary obstruction.',
  'urine_blood': 'Urine blood. Presence of hemoglobin or red blood cells in urine can indicate urinary tract irritation, infection, stones, or bleeding.',
  'urine_nitrite': 'Urine nitrite. Positive nitrite can indicate nitrate-reducing bacterial urinary tract infection.',
  'urine_specific_gravity': 'Urine specific gravity. Reflects urine concentration and hydration status; abnormal values may indicate dehydration, overhydration, or kidney concentrating defects.',
  'urine_ph': 'Urine pH. Measures urine acidity/alkalinity and can help assess metabolic conditions, diet effects, stone risk, and some infections.',
  // Liver Function
  'alt': 'Alanine aminotransferase. Liver enzyme. Elevated levels indicate liver damage, often from medications or disease.',
  'ast': 'Aspartate aminotransferase. Liver enzyme. Elevated levels indicate liver or muscle damage.',
  'ast_alt_ratio': 'Ratio of aspartate aminotransferase to alanine aminotransferase. Used to assess patterns of liver injury; abnormal values may suggest specific liver conditions such as alcoholic liver disease or advanced fibrosis.',
  'ag_ratio': 'Albumin/globulin (A/G) ratio. Compares albumin to globulins in blood. Abnormal ratios may reflect liver dysfunction, chronic inflammation, or immune protein changes.',
  'albi_score': 'ALBI score. Albumin-bilirubin–based index used to estimate liver functional reserve, often in oncology and hepatology care.',
  'alp': 'Alkaline phosphatase. Liver and bone enzyme. Elevated in liver disease or bone disorders.',
  'alp_ifcc': 'Alkaline phosphatase (IFCC method). Liver and bone enzyme. Abnormal levels may indicate bile duct obstruction, liver disease, or bone disorders.',
  'bilirubin_total': 'Total bilirubin. Breakdown product of red blood cells. High levels cause jaundice and indicate liver dysfunction.',
  'bilirubin_direct': 'Direct bilirubin (conjugated bilirubin). Bilirubin that has been processed by the liver. Elevated levels suggest bile duct obstruction, liver metastases, or impaired hepatic excretion.',
  'bilirubin_indirect': 'Indirect bilirubin (unconjugated bilirubin). Bilirubin prior to liver conjugation. Elevation may indicate hemolysis, ineffective erythropoiesis, or impaired hepatic uptake.',
  'albumin': 'Main protein in blood. Low levels indicate malnutrition, liver disease, or kidney disease.',
  'ggt': 'Gamma-glutamyl transferase. Liver enzyme. Elevated levels indicate liver disease, bile duct obstruction, or alcohol use.',
  'ck': 'Creatine kinase (CK/CPK). Enzyme from muscle tissue. Elevated levels can indicate muscle injury, inflammation, medication effects, or less commonly cardiac stress.',
  'ldh': 'Lactate dehydrogenase. Enzyme found in many tissues. Elevated in tissue damage, hemolysis, or cancer.',
  'amylase': 'Amylase. Digestive enzyme mainly from pancreas and salivary glands. Elevated levels may suggest pancreatic or salivary inflammation.',
  // Thyroid Function
  'tsh': 'Thyroid-stimulating hormone. Regulates thyroid function. High levels indicate hypothyroidism, low levels indicate hyperthyroidism.',
  't3': 'Triiodothyronine. Active thyroid hormone. Regulates metabolism.',
  't4': 'Thyroxine. Thyroid hormone. Regulates metabolism and energy.',
  'ft3': 'Free triiodothyronine. Unbound active thyroid hormone. More accurate than total T3 for assessing thyroid function.',
  'ft4': 'Free thyroxine. Unbound thyroid hormone. More accurate than total T4 for assessing thyroid function.',
  'thyroglobulin': 'Protein produced by thyroid gland. Used as tumor marker for thyroid cancer monitoring after treatment.',
  // Cardiac Markers
  'troponin': 'Heart muscle protein. Elevated levels indicate heart damage from heart attack or other cardiac events.',
  'bnp': 'B-type natriuretic peptide. Marker for heart failure. Elevated levels indicate heart stress.',
  'ntprobnp': 'N-terminal pro-B-type natriuretic peptide. More stable marker for heart failure than BNP. Used for diagnosis and monitoring.',
  'ckmb': 'Creatine kinase-MB. Heart muscle enzyme. Elevated levels indicate heart muscle damage from heart attack.',
  'myoglobin': 'Protein found in heart and skeletal muscle. Rapidly elevated after heart attack or muscle injury.',
  // Inflammation
  'crp': 'C-reactive protein. Measures inflammation in the body. Elevated in infection, inflammation, or autoimmune conditions.',
  'esr': 'Erythrocyte sedimentation rate. Non-specific marker of inflammation. Elevated in many conditions including infection and autoimmune disease.',
  'ferritin': 'Iron storage protein. Low levels indicate iron deficiency. High levels may indicate iron overload or inflammation.',
  // Coagulation
  'pt': 'Prothrombin time. Measures blood clotting function. Important for monitoring anticoagulant medications.',
  'inr': 'International normalized ratio. Standardized measure of blood clotting. Used to monitor warfarin therapy.',
  'aptt': 'Activated partial thromboplastin time. Measures intrinsic clotting pathway. Used to monitor heparin therapy.',
  'ddimer': 'D-dimer. Fragment from blood clots. Elevated in deep vein thrombosis, pulmonary embolism, and DIC.',
  'fdp': 'Fibrin degradation products. Fragments from blood clot breakdown. Elevated in conditions involving blood clotting such as DIC, deep vein thrombosis, or pulmonary embolism.',
  'fibrinogen': 'Blood clotting protein. Elevated in inflammation or infection. Low levels increase bleeding risk.',
  'iron': 'Iron (Fe). Measures circulating iron available for red blood cell production. Low values suggest iron deficiency; high values can occur with overload or inflammation.',
  'fib4_index': 'FIB-4 index. Non-invasive liver fibrosis risk score derived from age, AST, ALT, and platelets.',
  'hcv_screening': 'HCV screening test. Evaluates for hepatitis C exposure/infection, which can affect liver health and treatment planning.',
  'antithrombin_iii': 'Antithrombin III. A natural anticoagulant protein that inhibits clot formation. Reduced levels increase thrombosis risk and are common in cancer and during chemotherapy.',
  'protein_c': 'Protein C. A vitamin K-dependent anticoagulant protein. Deficiency contributes to hypercoagulable states frequently seen in malignancy.',
  'protein_s': 'Protein S. A cofactor for Protein C that enhances anticoagulant activity. Low levels increase the risk of venous thromboembolism in cancer patients.',
  // Electrolytes
  'sodium': 'Essential electrolyte. Regulates fluid balance and nerve function. Imbalances can cause confusion or seizures.',
  'potassium': 'Essential electrolyte. Important for heart and muscle function. Dangerous if too high or too low.',
  'calcium': 'Mineral essential for bones, muscles, and nerve function. Regulated by parathyroid hormone and vitamin D.',
  'calcium_ionized': 'Ionized calcium (Ca²⁺). The biologically active form of calcium in the blood. Abnormal levels are common in bone metastases, multiple myeloma, and paraneoplastic syndromes.',
  'phosphate': 'Phosphate. An essential electrolyte involved in cellular energy and bone metabolism. Abnormalities are common in tumor lysis syndrome and advanced malignancy.',
  'magnesium': 'Essential mineral for muscle and nerve function. Low levels can cause muscle cramps and irregular heartbeat.',
  'chloride': 'Essential electrolyte. Works with sodium to maintain fluid balance and acid-base balance in the body.',
  'bicarbonate': 'Buffer that maintains blood pH. Low levels indicate acidosis. High levels indicate alkalosis.',
  'co2': 'Carbon dioxide. Reflects acid-base balance and respiratory function. Used to assess metabolic and respiratory status.',
  'phosphorus': 'Essential mineral for bone health, energy production, and cell function. Imbalances can affect multiple body systems.',
  'urine_urobilinogen': 'Urine urobilinogen. Byproduct of bilirubin metabolism. Abnormal values can be associated with liver dysfunction or hemolysis.',
  // Other
  'glucose': 'Blood sugar. High levels indicate diabetes or prediabetes. Low levels (hypoglycemia) can be dangerous.',
  'hba1c': 'Hemoglobin A1c. Average blood sugar over 2-3 months. Used to diagnose and monitor diabetes.',
  'iga': 'Immunoglobulin A. Antibody found in mucous membranes and blood. Important for immune defense in respiratory and digestive tracts. Abnormal levels may indicate immune disorders.',
  'igg': 'Immunoglobulin G. Most abundant antibody in blood. Provides long-term immunity against infections. Elevated in chronic infections or autoimmune conditions. Low levels increase infection risk.',
  'igm': 'Immunoglobulin M. First antibody produced in response to infection. Elevated in acute infections. Low levels may indicate immune deficiency.',
  'vitamin_d': 'Essential vitamin for bone health and immune function. Low levels are common and may require supplementation.',
  'beta2_microglobulin': 'Beta-2 Microglobulin. A protein associated with tumor burden and prognosis in lymphomas and multiple myeloma.',
  'procalcitonin': 'Procalcitonin. A biomarker of bacterial infection that helps distinguish infection from inflammation or immune-related adverse events in cancer patients.',
  'il6': 'IL-6 (Interleukin-6). An inflammatory cytokine often elevated in cancer, infection, and cytokine release syndromes, useful for monitoring immune-related toxicity.'
  };

/**
 * Default normal ranges for known labs when not stored (e.g. imported data).
 * Used by getLabStatus so metric cards show Normal/Low/High instead of Unknown.
 * Keys: canonical lab keys. Values: normal range strings (e.g. ">60", "0-35").
 */
export const labDefaultNormalRanges = {
  'egfr': '>60',
  'creatinine': '0.6-1.2',
  'bun': '7-20',
  'ca125': '<35',
  'hemoglobin': '12-16',
  'platelets': '150-400',
  'wbc': '4.5-11',
  'alt': '7-56',
  'ast': '10-40',
  'albumin': '3.4-5.4',
  'ldh': '140-280',
  'crp': '<10',
  'tsh': '0.4-4.0'
};

// Categorize labs by organ function and type
export const categorizeLabs = (labs) => {
  // Predefined lab types by category (including common abbreviations and variations)
  const diseaseMarkers = ['ca125', 'cea', 'afp', 'psa', 'he4', 'ca199', 'ca153', 'ca724', 'ca242', 'ca50', 'inhibinb', 'romaindex', 'ca-125', 'ca 19-9', 'ca 15-3'];
  const liverFunction = ['alt', 'ast', 'bilirubin', 'albumin', 'alkalinephosphatase', 'alp', 'ggt', 'ldh', 'pt', 'inr', 'aptt', 'alb', 'ast/alt', 'alp ifcc', 'pt活性値', 'pt activity', 'pt activity value', 'ag ratio', 'ag比', 'albi score', 'ck', 'gamma gtp', 'amylase'];
  const kidneyFunction = ['creatinine', 'egfr', 'bun', 'urea', 'uric acid', 'urineprotein', 'urinecreatinine', 'cre', 'urinewbc', 'urinerbc', 'urinehyalinecasts', 'urinerenaltubularepithelial', 'urinesquamousepithelial', 'urinebacteria', 'urineyeast', 'urinecrystals', 'urinemucus', 'urinecolor', 'urineappearance', 'urineglucose', 'urineketones', 'urinebilirubin', 'urineblood', 'urinenitrite', 'urineleukocyteesterase', 'urinespecificgravity', 'urineph', 'urineurobilinogen'];
  const bloodCounts = ['wbc', 'rbc', 'hemoglobin', 'hematocrit', 'platelets', 'anc', 'lymphocytes', 'lymphocyte', 'neutrophils', 'neutrophil', 'monocytes', 'monocyte', 'eosinophils', 'eosinophil', 'basophils', 'basophil', 'mcv', 'mch', 'mchc', 'rdw', 'rdw-cv', 'red cell distribution width', 'hgb', 'hct', 'plt', 'ba#', 'ba%', 'eo#', 'eo%', 'lymph#', 'lymph%', 'mono#', 'mono%', 'neutro#', 'neutro%', 'absolute neutrophil count', 'absolute lymphocyte count', 'absolute monocyte count', 'absolute eosinophil count', 'absolute basophil count', 'platelet crit', 'platelet distribution width sd', 'pdw sd', 'pdw-sd'];
  const thyroidFunction = ['tsh', 't3', 't4', 'ft3', 'ft4', 'thyroglobulin', 'free t3', 'free t4'];
  const cardiacMarkers = ['troponin', 'bnp', 'ntprobnp', 'ckmb', 'myoglobin', 'nt-probnp', 'ck-mb'];
  const inflammation = ['crp', 'esr', 'ferritin', 'fibrinogen', 'フェリチン', 'fbg', 'ferritin (japanese)'];
  const electrolytes = ['sodium', 'potassium', 'chloride', 'bicarbonate', 'co2', 'magnesium', 'phosphorus', 'calcium', 'na', 'k', 'ci', 'ca', 'mg', 'p', 'phos'];
  const coagulation = ['pt', 'inr', 'aptt', 'dimer', 'ddimer', 'fibrinogen', 'd-dimer', 'fbg', 'fe', 'iron', 'fib 4', 'fib-4', 'hcv screening'];
  const tumorMarkers = ['ca125', 'cea', 'afp', 'psa', 'ca199', 'ca153', 'ca724', 'ca242', 'ca50', 'he4', 'inhibinb', 'romaindex', 'ca2729', 'ca549', 'ca195'];

  const categories = {
    'Disease-Specific Markers': [],
    'Liver Function': [],
    'Kidney Function': [],
    'Blood Counts': [],
    'Thyroid Function': [],
    'Cardiac Markers': [],
    'Inflammation': [],
    'Electrolytes': [],
    'Coagulation': [],
    'Custom Values': [],
    'Others': []
  };

  // Known lab types (for detecting custom values)
  const allKnownTypes = [
    ...diseaseMarkers, ...liverFunction, ...kidneyFunction, ...bloodCounts,
    ...thyroidFunction, ...cardiacMarkers, ...inflammation, ...electrolytes, ...coagulation
  ];

  // Track categorized labs to prevent duplicates
  const categorizedKeys = new Set();

  // Category mapping: canonical key -> category name
  const categoryMap = {
    'disease_specific_markers': 'Disease-Specific Markers',
    'liver_function': 'Liver Function',
    'kidney_function': 'Kidney Function',
    'blood_counts': 'Blood Counts',
    'thyroid_function': 'Thyroid Function',
    'cardiac_markers': 'Cardiac Markers',
    'inflammation': 'Inflammation',
    'electrolytes': 'Electrolytes',
    'coagulation': 'Coagulation',
    'other': 'Others'
  };

  // Map canonical keys to categories
  const canonicalKeyToCategory = {
    // Disease-Specific Markers
    'ca125': 'disease_specific_markers', 'ca199': 'disease_specific_markers', 'ca153': 'disease_specific_markers',
    'ca724': 'disease_specific_markers', 'ca242': 'disease_specific_markers', 'ca50': 'disease_specific_markers',
    'ca2729': 'disease_specific_markers', 'cea': 'disease_specific_markers', 'afp': 'disease_specific_markers',
    'psa': 'disease_specific_markers', 'he4': 'disease_specific_markers', 'inhibinb': 'disease_specific_markers',
    'romaindex': 'disease_specific_markers', 'scc_antigen': 'disease_specific_markers',
    'cyfra211': 'disease_specific_markers', 'nse': 'disease_specific_markers', 'betahcg': 'disease_specific_markers',
    
    // Liver Function
    'alt': 'liver_function', 'ast': 'liver_function', 'ast_alt_ratio': 'liver_function',
    'ag_ratio': 'liver_function', 'albi_score': 'liver_function',
    'alp': 'liver_function', 'alp_ifcc': 'liver_function', 'bilirubin_total': 'liver_function',
    'bilirubin_direct': 'liver_function', 'bilirubin_indirect': 'liver_function',
    'albumin': 'liver_function', 'ggt': 'liver_function', 'ck': 'liver_function',
    'ldh': 'liver_function', 'amylase': 'liver_function',
    
    // Kidney Function
    'creatinine': 'kidney_function', 'egfr': 'kidney_function', 'bun': 'kidney_function',
    'urea': 'kidney_function', 'urineprotein': 'kidney_function', 'urinecreatinine': 'kidney_function',
    'uric_acid': 'kidney_function',
    'urine_wbc': 'kidney_function', 'urine_rbc': 'kidney_function', 'urine_hyaline_casts': 'kidney_function',
    'urine_renal_tubular_epithelial': 'kidney_function', 'urine_squamous_epithelial': 'kidney_function',
    'urine_bacteria': 'kidney_function', 'urine_yeast': 'kidney_function', 'urine_crystals': 'kidney_function',
    'urine_mucus': 'kidney_function', 'urine_color': 'kidney_function', 'urine_appearance': 'kidney_function',
    'urine_glucose': 'kidney_function', 'urine_ketones': 'kidney_function', 'urine_bilirubin': 'kidney_function',
    'urine_blood': 'kidney_function', 'urine_nitrite': 'kidney_function', 'urine_leukocyte_esterase': 'kidney_function',
    'urine_specific_gravity': 'kidney_function', 'urine_ph': 'kidney_function', 'urine_urobilinogen': 'kidney_function',
    // Blood Counts
    'wbc': 'blood_counts', 'rbc': 'blood_counts', 'hemoglobin': 'blood_counts',
    'hematocrit': 'blood_counts', 'platelets': 'blood_counts', 'anc': 'blood_counts',
    'neutrophils_abs': 'blood_counts', 'neutrophils_pct': 'blood_counts',
    'lymphocytes_abs': 'blood_counts', 'lymphocytes_pct': 'blood_counts',
    'monocytes_abs': 'blood_counts', 'monocytes_pct': 'blood_counts',
    'eosinophils_abs': 'blood_counts', 'eosinophils_pct': 'blood_counts',
    'basophils_abs': 'blood_counts', 'basophils_pct': 'blood_counts',
    'neutrophil_count': 'blood_counts', 'neutrophil_percent': 'blood_counts',
    'lymphocyte_count': 'blood_counts', 'lymphocyte_percent': 'blood_counts',
    'monocyte_count': 'blood_counts', 'monocyte_percent': 'blood_counts',
    'eosinophil_count': 'blood_counts', 'eosinophil_percent': 'blood_counts',
    'basophil_count': 'blood_counts', 'basophil_percent': 'blood_counts',
    'mcv': 'blood_counts', 'mch': 'blood_counts', 'mchc': 'blood_counts',
    'rdw': 'blood_counts', 'rdw_cv': 'blood_counts',
    'mpv': 'blood_counts', 'platelet_crit': 'blood_counts', 'pdw_sd': 'blood_counts',
    'nrbc': 'blood_counts', 'nrbc_pct': 'blood_counts',
    'reticulocyte_count': 'blood_counts', 'reticulocyte_pct': 'blood_counts',
    
    // Thyroid Function
    'tsh': 'thyroid_function', 't3': 'thyroid_function', 't4': 'thyroid_function',
    'ft3': 'thyroid_function', 'ft4': 'thyroid_function', 'thyroglobulin': 'thyroid_function',
    
    // Cardiac Markers
    'troponin': 'cardiac_markers', 'bnp': 'cardiac_markers', 'ntprobnp': 'cardiac_markers',
    'ckmb': 'cardiac_markers', 'myoglobin': 'cardiac_markers',
    
    // Inflammation
    'crp': 'inflammation', 'esr': 'inflammation', 'ferritin': 'inflammation',
    'il6': 'inflammation',
    
    // Electrolytes
    'sodium': 'electrolytes', 'potassium': 'electrolytes', 'chloride': 'electrolytes',
    'bicarbonate': 'electrolytes', 'co2': 'electrolytes', 'magnesium': 'electrolytes',
    'phosphorus': 'electrolytes', 'calcium': 'electrolytes', 'calcium_ionized': 'electrolytes',
    'phosphate': 'electrolytes',
    
    // Coagulation (precedence: coagulation wins over liver_function for PT, INR, APTT, etc.)
    'pt': 'coagulation', 'inr': 'coagulation', 'aptt': 'coagulation',
    'ddimer': 'coagulation', 'fdp': 'coagulation', 'fibrinogen': 'coagulation',
    'iron': 'coagulation', 'fib4_index': 'coagulation', 'hcv_screening': 'coagulation',
    'antithrombin_iii': 'coagulation', 'protein_c': 'coagulation', 'protein_s': 'coagulation',
    'prothrombin_time_activity': 'coagulation', 'pt_activity': 'coagulation',
    
    // Other
    'glucose': 'other', 'hba1c': 'other', 'iga': 'other', 'igg': 'other', 'igm': 'other', 'vitamin_d': 'other',
    'beta2_microglobulin': 'other', 'procalcitonin': 'other'
  };

  Object.entries(labs).forEach(([key, lab]) => {
    // Skip if already categorized
    if (categorizedKeys.has(key)) return;

    // Normalize lab name to canonical key
    const canonicalKey = normalizeLabName(lab.name || key);
    
    // Determine category
    let category = 'other';
    if (canonicalKey && canonicalKeyToCategory[canonicalKey]) {
    category = canonicalKeyToCategory[canonicalKey];
    } else {
    // Fallback: try to match by name/key patterns
    const labKey = key.toLowerCase();
    const labName = (lab.name || '').toLowerCase();
    
    if (diseaseMarkers.some(m => labKey.includes(m) || labName.includes(m)) ||
      tumorMarkers.some(m => labKey.includes(m) || labName.includes(m))) {
      category = 'disease_specific_markers';
    } else if (coagulation.some(m => labKey.includes(m) || labName.includes(m))) {
      // Coagulation has precedence
      category = 'coagulation';
    } else if (liverFunction.some(m => labKey.includes(m) || labName.includes(m))) {
      category = 'liver_function';
    } else if (kidneyFunction.some(m => labKey.includes(m) || labName.includes(m))) {
      category = 'kidney_function';
    } else if (bloodCounts.some(m => labKey.includes(m) || labName.includes(m))) {
      category = 'blood_counts';
    } else if (thyroidFunction.some(m => labKey.includes(m) || labName.includes(m))) {
      category = 'thyroid_function';
    } else if (cardiacMarkers.some(m => labKey.includes(m) || labName.includes(m))) {
      category = 'cardiac_markers';
    } else if (inflammation.some(m => labKey.includes(m) || labName.includes(m))) {
      category = 'inflammation';
    } else if (electrolytes.some(m => labKey.includes(m) || labName.includes(m))) {
      category = 'electrolytes';
    }
    }

    // Map to UI category name
    const uiCategory = categoryMap[category] || 'Others';
    
    // Note: "Custom Values" should only contain manually added labs (via Add Lab modal)
    // Document-extracted labs that don't fit categories go to "Others"
    categories[uiCategory].push([key, lab]);
    categorizedKeys.add(key);
  });

  // Remove duplicates within each category (same lab type/key, not name)
  // We deduplicate by key (labType) because the same lab type should only appear once
  // Different lab types with the same name should both be shown
  Object.keys(categories).forEach(category => {
    const seen = new Set();
    categories[category] = categories[category].filter(([key, lab]) => {
    const labKey = key.toLowerCase();
    if (seen.has(labKey)) {
      return false; // Duplicate lab type
    }
    seen.add(labKey);
    return true;
    });
  });

  // Sort labs within each category by relevance score, then alphabetically
  Object.keys(categories).forEach(category => {
    categories[category].sort(([keyA, labA], [keyB, labB]) => {
    const scoreA = labA.relevanceScore || 0;
    const scoreB = labB.relevanceScore || 0;
    if (scoreB !== scoreA) return scoreB - scoreA;
    const nameA = (labA.name || labA.labType || keyA || '').toString();
    const nameB = (labB.name || labB.labType || keyB || '').toString();
    return nameA.localeCompare(nameB);
    });
  });

  return categories;
  };
