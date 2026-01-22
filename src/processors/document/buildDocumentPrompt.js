import { parseLocalDate } from '../../utils/helpers';

/**
 * Build shared date instruction section (de-duplicated, used across all prompt types)
 * @param {string|null} documentDate - User-provided date (YYYY-MM-DD format)
 * @returns {string} - Date instruction section
 */
function buildDateInstruction(documentDate) {
  const todayDate = parseLocalDate(new Date().toISOString().split('T')[0]).toISOString().split('T')[0];
  
  if (documentDate) {
    return `## DATE HANDLING

**USER-PROVIDED DATE: ${documentDate}** (takes absolute precedence)

Priority:
1. User-provided date (${documentDate}) - use for ALL lab/vital/genomic dates
2. Document date (only if clearly different and more accurate)
3. Fallback: ${documentDate}

Format: YYYY-MM-DD`;
  } else {
    return `## DATE HANDLING

Extract dates from document:
- Search: header, "Report Date", "Collection Date", "Test Date", "採取日時", "検査日"
- Formats: YYYY/MM/DD, YYYY-MM-DD, MM/DD/YYYY, "December 25, 2024", "令和6年12月25日"
- Convert all to YYYY-MM-DD
- Fallback: ${todayDate}

Validation: Every lab/vital MUST have "date" field, genomic MUST have "testDate"`;
  }
}

/**
 * Build patient demographics section
 * @param {Object} patientProfile - Patient demographics
 * @returns {string} - Demographics section
 */
function buildPatientDemographics(patientProfile) {
  if (!patientProfile) return '';
  
  const age = patientProfile.age || null;
  const gender = patientProfile.gender || patientProfile.sex || null;
  const weight = patientProfile.weight || null;
  const height = patientProfile.height || null;
  
  if (!age && !gender && !weight && !height) return '';
  
  return `## PATIENT DEMOGRAPHICS

${age ? `- Age: ${age} years` : ''}
${gender ? `- Gender: ${gender}` : ''}
${weight ? `- Weight: ${weight} kg` : ''}
${height ? `- Height: ${height} cm` : ''}

**Normal Range Adjustment:**
- Use document range if shown, otherwise provide age/gender-appropriate ranges
- Examples: Hemoglobin (men 13.5-17.5, women 12.0-15.5), PSA (age-specific)`;
}

/**
 * Build shared language support section
 * @returns {string} - Language support instructions
 */
function buildLanguageSupport() {
  return `## LANGUAGE SUPPORT

- Supports Japanese, English, mixed languages
- Translate Japanese terms to English in JSON output
- Japanese dates: "令和6年12月25日" → "2024-12-25"
- Japanese lab labels: "CA125" → "ca125"
- For Japanese tables: values may be in separate columns`;
}

/**
 * Build shared output format structure
 * @returns {string} - JSON structure template
 */
function buildOutputFormat() {
  return `## OUTPUT FORMAT

Return JSON:
{
  "documentType": "Lab|Scan|Report|Genomic|Vitals|Medication",
  "summary": "Brief summary",
  "data": { ... }
}

Rules:
- Omit empty sections
- No null/undefined fields
- Dates: YYYY-MM-DD format
- Return ONLY valid JSON`;
}

/**
 * Build LAB-specific prompt
 * @param {Object} params - Prompt parameters
 * @returns {string} - Lab extraction prompt
 */
export function buildLabPrompt({ documentDate, patientProfile }) {
  const dateInstruction = buildDateInstruction(documentDate);
  const demographics = buildPatientDemographics(patientProfile);
  const languageSupport = buildLanguageSupport();
  const outputFormat = buildOutputFormat();
  const todayDate = parseLocalDate(new Date().toISOString().split('T')[0]).toISOString().split('T')[0];
  
  return `You are a medical document processing AI. Extract lab results from this document.

${languageSupport}

${demographics}

${dateInstruction}

## LAB EXTRACTION RULES

**Value Extraction (BE AGGRESSIVE):**
- Extract ANY numeric value: percentages (45.2%), decimals (1.5), whole numbers (100), ratios (1.2)
- Look in: same row, adjacent columns, tables, Japanese text
- If test name exists but no value found → skip that test (don't include in labs array)
- Only skip if explicitly marked: "-", "N/A", "未測定", "測定なし", or completely blank

**Lab Types to Recognize:**
- Immunology: CD19+, CD16+56+, CD3+, CD4+, CD8+, CD4/CD8 ratio
- Normalize: "CD19+" → "cd19", "CD4/CD8" → "cd4cd8"
- Common acronyms: HGB/Hb → "hemoglobin", HCT → "hematocrit", WBC → "wbc", PLT → "platelets", CA-125/CA125 → "ca125", CEA → "cea", ALT/GPT → "alt", AST/GOT → "ast", BUN → "bun", Cr/CRE → "creatinine", eGFR → "egfr", LDH → "ldh", ALB → "albumin", CRP → "crp", TSH → "tsh", T3 → "t3", T4 → "t4", PSA → "psa", AFP → "afp"

**Lab Structure:**
\`\`\`json
"labs": [
  {
    "labType": "ca125|cea|wbc|hemoglobin|platelets|cd19|etc",
    "label": "CA-125",
    "value": 68,  // MANDATORY - numeric value required
    "unit": "U/mL",
    "date": "2024-12-14",  // MANDATORY - YYYY-MM-DD format
    "normalRange": "0-35",  // Only if shown in document
    "status": "high|normal|low"
  }
]
\`\`\`

**Date Rules:**
- Each lab MUST have "date" field
- Extract date from: test-specific date, date column, section header, or document header
- If no date found: use ${todayDate}
- Example: "CA-125: 68 (2025/12/14)" → date: "2025-12-14"

${outputFormat}`;
}

/**
 * Build GENOMIC-specific prompt
 * @param {Object} params - Prompt parameters
 * @returns {string} - Genomic extraction prompt
 */
export function buildGenomicPrompt({ documentDate, patientProfile }) {
  const dateInstruction = buildDateInstruction(documentDate);
  const demographics = buildPatientDemographics(patientProfile);
  const languageSupport = buildLanguageSupport();
  const outputFormat = buildOutputFormat();
  const todayDate = parseLocalDate(new Date().toISOString().split('T')[0]).toISOString().split('T')[0];
  
  return `You are a medical document processing AI. Extract genomic test results from this document.

${languageSupport}

${demographics}

${dateInstruction}

## GENOMIC EXTRACTION RULES

**General:**
- Extract EVERY mutation (not just significant ones)
- Use official HUGO gene names (BRCA1, TP53, CCNE1 - not lowercase)
- Include exact alteration notation (c.5266dupC, p.Arg273His, E545K)
- For Japanese: "DNA変化" → DNA notation, "変異アレル頻度" → VAF percentage

**Variant Allele Frequency (VAF) - MANDATORY:**
- Extract from: "VAF" column, "変異アレル頻度" column, number in same row, percentage value
- Match VAF to mutations by row position
- Convert decimals (0.485) to percentage (48.5)
- Always include variantAlleleFrequency field

**Critical Genes (always extract if present):**
- CCNE1: amplification/gain (platinum resistance marker - CRITICAL for ovarian cancer)
- BRCA1, BRCA2: all variants (germline or somatic)
- TP53, PIK3CA, ATM, BRD4, KRAS, EGFR, CCND1

**Genomic Structure:**
\`\`\`json
"genomic": {
  "testInfo": {
    "testName": "FoundationOne CDx|Guardant360|Tempus xT|Tempus TOP|BRCA Testing",
    "testDate": "2024-12-15",  // MANDATORY - YYYY-MM-DD format
    "laboratoryName": "Foundation Medicine|Tempus Labs",
    "specimenType": "FFPE tissue|Blood (ctDNA)|Germline blood",
    "tumorPurity": "70%",
    "genesCovered": 324
  },
  "mutations": [
    {
      "gene": "BRCA1",
      "alteration": "c.5266dupC (p.Gln1756Profs*74)",
      "dna": "c.5266dupC",
      "significance": "pathogenic|likely_pathogenic|VUS|benign",
      "variantAlleleFrequency": 48.5,  // MANDATORY
      "mutationType": "somatic|germline",
      "therapyImplication": "PARP inhibitors",
      "fdaApprovedTherapy": "Olaparib, Rucaparib, Niraparib",
      "trialEligible": true
    }
  ],
  "copyNumberVariants": [
    {
      "gene": "CCNE1",
      "type": "amplification|deletion",
      "copyNumber": 6,
      "significance": "pathogenic",
      "note": "Platinum resistance marker"
    }
  ],
  "fusions": [
    {
      "fusion": "EML4-ALK",
      "gene1": "EML4",
      "gene2": "ALK",
      "significance": "pathogenic",
      "therapyImplication": "ALK inhibitors (Crizotinib)"
    }
  ],
  "biomarkers": {
    "tumorMutationalBurden": { "value": 12.5, "unit": "mutations/megabase", "interpretation": "high|intermediate|low" },
    "microsatelliteInstability": { "status": "MSI-H|MSS|MSI-L" },
    "hrdScore": { "value": 48, "threshold": "≥42", "interpretation": "HRD-positive|HRD-negative", "components": { "LOH": 18, "TAI": 15, "LST": 21 } },
    "pdl1Expression": { "value": 85, "unit": "percentage", "interpretation": "high|low" }
  },
  "germlineFindings": [
    {
      "gene": "BRCA1",
      "variant": "c.5266dupC",
      "classification": "pathogenic",
      "familyRisk": true,
      "counselingRecommended": true
    }
  ],
  "fdaApprovedTherapies": ["Olaparib", "Pembrolizumab"],
  "clinicalTrialEligible": true
}
\`\`\`

**Biomarkers:**
- TMB: numeric value with unit (e.g., 12.5 mutations/megabase)
- MSI: exact status (MSI-H, MSS, MSI-L)
- HRD: numeric value with threshold (e.g., 48, threshold ≥42)
- PD-L1: value with unit and interpretation

**Tempus-Specific:**
- Distinguish somatic vs germline (mutationType field)
- Extract RNA-detected fusions
- Extract CCNE1 amplification (critical for ovarian cancer)

**CNVs:**
- ALWAYS extract CCNE1 if: "amplified", "copy number gain", "CNV", "amplification", "copy number > 2"
- Extract ALL CNVs, not just significant ones
- Include copy number value if available

${outputFormat}`;
}

/**
 * Build IMAGING-specific prompt
 * @param {Object} params - Prompt parameters
 * @returns {string} - Imaging extraction prompt
 */
export function buildImagingPrompt({ documentDate, patientProfile }) {
  const dateInstruction = buildDateInstruction(documentDate);
  const demographics = buildPatientDemographics(patientProfile);
  const languageSupport = buildLanguageSupport();
  const outputFormat = buildOutputFormat();
  
  return `You are a medical document processing AI. Extract imaging/scan results from this document.

${languageSupport}

${demographics}

${dateInstruction}

## IMAGING EXTRACTION RULES

**Extract:**
- Scan type: CT, MRI, PET, X-ray, Ultrasound
- Body part scanned
- Findings: key observations
- Measurements: tumor sizes, dimensions
- Impression: radiologist's conclusion

**Imaging Structure:**
\`\`\`json
"imaging": {
  "scanType": "CT|MRI|PET|X-ray|Ultrasound",
  "bodyPart": "Abdomen & Pelvis",
  "findings": "Stable disease, no new lesions",
  "measurements": "Tumor measurements if available",
  "impression": "Radiologist impression"
}
\`\`\`

${outputFormat}`;
}

/**
 * Build GENERIC prompt (fallback with all rules)
 * @param {Object} params - Prompt parameters
 * @returns {string} - Generic extraction prompt
 */
export function buildGenericPrompt({ documentDate, patientProfile }) {
  const dateInstruction = buildDateInstruction(documentDate);
  const demographics = buildPatientDemographics(patientProfile);
  const languageSupport = buildLanguageSupport();
  const outputFormat = buildOutputFormat();
  const todayDate = parseLocalDate(new Date().toISOString().split('T')[0]).toISOString().split('T')[0];
  
  // Generic prompt includes all document types but compressed
  return `You are a medical document processing AI. Analyze this medical document and extract all relevant information.

${languageSupport}

${demographics}

${dateInstruction}

## DOCUMENT TYPES
Identify: Lab Results, Imaging/Scan, Clinical Report, Genomic Test, Vital Signs, Medication

## EXTRACTION RULES

**Lab Results:**
- Extract: labType, label, value (MANDATORY), unit, date (MANDATORY), normalRange (if shown), status
- Be aggressive: extract values from tables, adjacent columns, Japanese text
- Common types: ca125, cea, wbc, hemoglobin, platelets, cd19, cd4, cd8, etc.
- Normalize: "CD19+" → "cd19", "HGB" → "hemoglobin"

**Genomic Tests:**
- Extract: testInfo (testName, testDate MANDATORY, laboratoryName, specimenType), mutations (with variantAlleleFrequency MANDATORY), copyNumberVariants, fusions, biomarkers, germlineFindings
- Critical genes: CCNE1 (always extract if amplification/gain), BRCA1, BRCA2, TP53, PIK3CA
- Use HUGO gene names (BRCA1 not brca1)

**Vital Signs:**
- Extract: vitalType (bp|hr|temp|weight|oxygen), label, value, unit, date (MANDATORY), normalRange (if shown)

**Medications:**
- Extract: name, dosage, frequency, startDate

**Imaging:**
- Extract: scanType, bodyPart, findings, measurements, impression

## OUTPUT STRUCTURE
\`\`\`json
{
  "documentType": "Lab|Scan|Report|Genomic|Vitals|Medication",
  "summary": "Brief summary",
  "data": {
    "labs": [...],
    "vitals": [...],
    "genomic": {...},
    "medications": [...],
    "imaging": {...}
  }
}
\`\`\`

${outputFormat}`;
}

/**
 * Main prompt builder - routes to type-specific prompt
 * @param {Object} params - Prompt parameters
 * @param {string} docType - Document type: 'lab' | 'genomic' | 'imaging' | 'unknown'
 * @param {string} customInstructions - Optional custom instructions from user
 * @returns {string} - Complete prompt
 */
export function buildDocumentPrompt({ documentDate, patientProfile, customInstructions }, docType = 'unknown') {
  const params = { documentDate, patientProfile, customInstructions };
  
  // Build custom instructions section if provided
  const customInstructionsSection = customInstructions
    ? `
═══════════════════════════════════════════════════════════════════════════════
⚠️ USER CUSTOM INSTRUCTIONS - FOLLOW THESE PRECISELY ⚠️
═══════════════════════════════════════════════════════════════════════════════

${customInstructions}

CRITICAL: These custom instructions override default extraction behavior. Follow them exactly as specified by the user. Examples:
- "Only extract CA-125" → Extract ONLY CA-125 values, skip all other labs
- "Skip all labs except tumor markers" → Only extract tumor markers (CA-125, CEA, etc.), skip other labs
- "Only extract platelet counts" → Extract ONLY platelet/PLT values, skip everything else
- "Focus on CD markers" → Extract only CD19+, CD4+, CD8+, etc., skip other labs

═══════════════════════════════════════════════════════════════════════════════`
    : '';
  
  let basePrompt = '';
  switch (docType) {
    case 'lab':
      basePrompt = buildLabPrompt(params);
      break;
    case 'genomic':
      basePrompt = buildGenomicPrompt(params);
      break;
    case 'imaging':
      basePrompt = buildImagingPrompt(params);
      break;
    default:
      basePrompt = buildGenericPrompt(params);
  }
  
  // Inject custom instructions after the initial instructions but before extraction rules
  if (customInstructionsSection) {
    // Find a good insertion point (after date/demographics, before extraction rules)
    const insertionPoint = basePrompt.indexOf('## LAB EXTRACTION RULES') || 
                          basePrompt.indexOf('## GENOMIC EXTRACTION RULES') ||
                          basePrompt.indexOf('## IMAGING EXTRACTION RULES') ||
                          basePrompt.indexOf('## EXTRACTION RULES');
    
    if (insertionPoint > 0) {
      return basePrompt.slice(0, insertionPoint) + customInstructionsSection + '\n\n' + basePrompt.slice(insertionPoint);
    } else {
      // Fallback: append at the beginning
      return customInstructionsSection + '\n\n' + basePrompt;
    }
  }
  
  return basePrompt;
}

