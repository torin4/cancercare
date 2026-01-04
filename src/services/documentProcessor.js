import { GoogleGenerativeAI } from '@google/generative-ai';
import { labService, vitalService, medicationService, genomicProfileService } from '../firebase/services';
import { parseLocalDate } from '../utils/helpers';
import { cleanupDocumentData, verifyCleanupComplete } from './documentCleanupService';

// Check if API key is available
const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
if (!apiKey) {
}

const genAI = new GoogleGenerativeAI(apiKey || '');

/**
 * Process an uploaded medical document
 * - Identifies document type
 * - Extracts medical data
 * - Saves to appropriate Firestore collections
 * @param {File} file - The document file
 * @param {string} userId - User ID
 * @param {Object} patientProfile - Patient demographics (age, gender, weight) for normal range adjustments
 * @param {string|null} documentDate - Optional date provided by user (YYYY-MM-DD format)
 * @param {Function|null} onProgress - Optional callback for progress updates (message, aiStatus)
 */
export async function processDocument(file, userId, patientProfile = null, documentDate = null, documentNote = null, documentId = null, onProgress = null, onlyExistingMetrics = false) {
  try {
    // Convert file to base64 for Gemini API
    const base64Data = await fileToBase64(file);

    // Step 1: Analyze document and extract data
    const extractedData = await analyzeDocument(base64Data, file.type, patientProfile, documentDate, onProgress);

    // Step 2: Extract a date from the document (for filename if user didn't provide one)
    // Priority: user-provided date > first lab date > first vital date > genomic test date > today
    let extractedDate = null;
    if (documentDate) {
      extractedDate = documentDate; // User-provided takes precedence
    } else if (extractedData.data?.labs && extractedData.data.labs.length > 0) {
      // Use the first lab's date
      const firstLab = extractedData.data.labs[0];
      if (firstLab.date) {
        extractedDate = firstLab.date;
      }
    } else if (extractedData.data?.vitals && extractedData.data.vitals.length > 0) {
      // Use the first vital's date
      const firstVital = extractedData.data.vitals[0];
      if (firstVital.date) {
        extractedDate = firstVital.date;
      }
    } else if (extractedData.data?.genomic?.testInfo?.testDate) {
      // Use genomic test date
      extractedDate = extractedData.data.genomic.testInfo.testDate;
    }
    // If no date found, extractedDate remains null (will default to today in uploadDocument)

    // Step 3: Save extracted data to Firestore
    const savedData = await saveExtractedData(extractedData, userId, documentDate, documentNote, documentId, onlyExistingMetrics);

    // Count total data points extracted (metric + value = 1 data point)
    const dataPointCount = countDataPoints(savedData);

    return {
      success: true,
      documentType: extractedData.documentType,
      extractedData: savedData,
      summary: extractedData.summary,
      dataPointCount,
      extractedDate // Return the extracted date for filename use
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Convert file to base64 string
 */
async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Analyze document using Gemini AI
 * @param {string} base64Data - Base64 encoded document
 * @param {string} mimeType - MIME type of the document
 * @param {Object} patientProfile - Patient demographics for normal range adjustments
 * @param {string|null} documentDate - Optional date provided by user (YYYY-MM-DD format)
 */
async function analyzeDocument(base64Data, mimeType, patientProfile = null, documentDate = null, onProgress = null) {
  if (!apiKey) {
    throw new Error('Gemini API key is not configured. Please set REACT_APP_GEMINI_API_KEY in Vercel environment variables and redeploy.');
  }
  
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  // Build patient demographics section if provided
  let patientDemographicsSection = '';
  if (patientProfile) {
    const age = patientProfile.age || null;
    const gender = patientProfile.gender || patientProfile.sex || null;
    const weight = patientProfile.weight || null;
    const height = patientProfile.height || null;
    
    if (age || gender || weight || height) {
      patientDemographicsSection = `

═══════════════════════════════════════════════════════════════════════════════
PATIENT DEMOGRAPHICS: Use these to adjust normal ranges appropriately
═══════════════════════════════════════════════════════════════════════════════

${age ? `- Age: ${age} years` : ''}
${gender ? `- Gender: ${gender}` : ''}
${weight ? `- Weight: ${weight} kg` : ''}
${height ? `- Height: ${height} cm` : ''}

IMPORTANT FOR NORMAL RANGES:
- If the document shows a normal range, use that exact range
- If the document does NOT show a normal range, provide the appropriate normal range based on these patient demographics
- Adjust normal ranges based on:
  * Age (e.g., children vs adults, elderly patients have different ranges)
  * Gender (e.g., hemoglobin: men 13.5-17.5 g/dL, women 12.0-15.5 g/dL)
  * Body size when relevant (e.g., BMI-related calculations)
- Use age-appropriate and gender-appropriate normal ranges when the document doesn't specify
- Examples:
  * Hemoglobin: Men 13.5-17.5 g/dL, Women 12.0-15.5 g/dL
  * Creatinine: Varies by age and gender
  * eGFR: Adjusted for age, gender, and race
  * PSA: Age-specific ranges (higher normal ranges for older men)

═══════════════════════════════════════════════════════════════════════════════`;
    }
  }

  // Add document date information to prompt if provided
  let dateInstruction = '';
  if (documentDate) {
    dateInstruction = `

═══════════════════════════════════════════════════════════════════════════════
⚠️ USER-PROVIDED DATE TAKES ABSOLUTE PRECEDENCE ⚠️
═══════════════════════════════════════════════════════════════════════════════

THE USER HAS PROVIDED A DOCUMENT DATE: ${documentDate}

CRITICAL RULE: USE THIS USER-PROVIDED DATE FOR ALL VALUES.

DATE ASSIGNMENT PRIORITY:
1. **USER-PROVIDED DATE (${documentDate})** - USE THIS AS THE PRIMARY DATE FOR ALL LAB VALUES, VITAL VALUES, AND GENOMIC TEST DATE
2. Only if the document explicitly shows a DIFFERENT date that is clearly more accurate (e.g., document shows test was performed on a different date than the user entered), you may use that date instead
3. If no date is found in the document, ALWAYS use the user-provided date: ${documentDate}

FOR ALL LAB VALUES: Use ${documentDate} unless the document clearly shows a different collection/test date
FOR ALL VITAL VALUES: Use ${documentDate} unless the document clearly shows a different measurement date  
FOR GENOMIC TEST DATE: Use ${documentDate} unless the document clearly shows a different test date
- Format dates consistently as YYYY-MM-DD

═══════════════════════════════════════════════════════════════════════════════`;
  } else {
    dateInstruction = `

═══════════════════════════════════════════════════════════════════════════════
DOCUMENT DATE: NOT PROVIDED BY USER
═══════════════════════════════════════════════════════════════════════════════

The user did not provide a document date. You MUST extract the date from the document itself.
- Look for dates in the document (test date, report date, collection date, etc.)
- Use the most relevant date for the medical data (prefer test/collection date over report date)
- If no date is found, use today's date as a last resort: ${parseLocalDate(new Date().toISOString().split('T')[0]).toISOString().split('T')[0]}
- Format dates consistently as YYYY-MM-DD

═══════════════════════════════════════════════════════════════════════════════`;
  }

  const prompt = `You are a medical document processing AI. Analyze this medical document and extract all relevant information.

═══════════════════════════════════════════════════════════════════════════════
LANGUAGE SUPPORT: This document may be in Japanese, English, or other languages
═══════════════════════════════════════════════════════════════════════════════

- The document may be written in Japanese, English, or mixed languages
- You MUST read and understand Japanese medical documents
- Extract ALL data regardless of the document's language
- Translate Japanese medical terms to English for the JSON output
- For Japanese genomic reports, look for:
  * "DNA変化" or "DNA change" → extract the DNA notation (e.g., "c.3403-1G>C")
  * "変異アレル頻度" or "VAF" or "variant allele frequency" → extract the percentage number
  * "遺伝子" or "gene" → extract gene names
  * "タンパク質変化" or "protein change" → extract protein notation
- Extract variant allele frequency (VAF) percentages even if shown in Japanese format
- Japanese dates: "令和6年12月25日" or "2024年12月25日" → convert to "2024-12-25"
- Japanese lab labels: "CA-125" may appear as "CA125" or "CA 125" - normalize to "ca125"

${patientDemographicsSection}
${dateInstruction}

═══════════════════════════════════════════════════════════════════════════════
CRITICAL: DATE EXTRACTION IS MANDATORY - DO NOT SKIP THIS STEP
═══════════════════════════════════════════════════════════════════════════════

${documentDate ? `
═══════════════════════════════════════════════════════════════════════════════
⚠️ USER-PROVIDED DATE TAKES ABSOLUTE PRECEDENCE ⚠️
═══════════════════════════════════════════════════════════════════════════════

THE USER HAS PROVIDED A DOCUMENT DATE: ${documentDate}

CRITICAL RULE: USE THIS USER-PROVIDED DATE FOR ALL VALUES UNLESS THERE IS A COMPELLING REASON NOT TO.

DATE ASSIGNMENT PRIORITY (in order):
1. **USER-PROVIDED DATE (${documentDate})** - USE THIS AS THE PRIMARY DATE FOR ALL LAB VALUES, VITAL VALUES, AND GENOMIC TEST DATE
2. Only if the document explicitly shows a DIFFERENT date that is clearly more accurate (e.g., document shows test was performed on a different date than the user entered), you may use that date instead
3. If no date is found in the document, ALWAYS use the user-provided date: ${documentDate}

FOR ALL LAB VALUES: Use ${documentDate} unless the document clearly shows a different collection/test date
FOR ALL VITAL VALUES: Use ${documentDate} unless the document clearly shows a different measurement date  
FOR GENOMIC TEST DATE: Use ${documentDate} unless the document clearly shows a different test date

═══════════════════════════════════════════════════════════════════════════════
` : `
BEFORE extracting any other data, you MUST find and extract dates from the document.

STEP 1: SEARCH FOR DATES IN THESE LOCATIONS (in order of priority):
1. Document header/top section (most common location)
2. Report date fields: "Report Date", "Date of Report", "Reported", "報告日"
3. Test/Collection date fields: "Collection Date", "Test Date", "Specimen Date", "Date Collected", "Date of Service", "採取日時", "検査日"
4. Any date field in the document metadata
5. Dates in formats: YYYY/MM/DD, YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY, or written dates like "December 25, 2024"

STEP 2: DATE FORMATS TO LOOK FOR:
- "2025/12/25" or "2025/12/25 11:09:48" → convert to "2025-12-25"
- "2025-12-25" → use as "2025-12-25"
- "12/25/2025" or "25/12/2025" → convert to "2025-12-25"
- "December 25, 2024" or "Dec 25, 2024" → convert to "2024-12-25"
- Japanese dates: "令和6年12月25日" or "2024年12月25日" → convert to "2024-12-25"
- Any timestamp with date component → extract just the date part

STEP 3: DATE ASSIGNMENT RULES:
- For LAB REPORTS: Use the collection/test date (採取日時/検査日) for ALL lab values
- For GENOMIC REPORTS: Use the test date (testDate) from testInfo section
- For VITALS: Use the measurement date
- If multiple dates exist, use the MOST RECENT test/collection date
- If NO date is found after thorough search, ONLY THEN use: ${parseLocalDate(new Date().toISOString().split('T')[0]).toISOString().split('T')[0]}
`}

STEP 4: VALIDATION:
- Every lab value MUST have a "date" field
- Every vital MUST have a "date" field  
- Genomic testInfo MUST have a "testDate" field
- Dates MUST be in YYYY-MM-DD format (e.g., "2024-12-25")
- DO NOT use placeholder dates or "unknown" - extract the actual date from the document

═══════════════════════════════════════════════════════════════════════════════

DOCUMENT TYPES TO IDENTIFY:
1. Lab Results - Blood work, tumor markers (CA-125, CEA, etc.), chemistry panels
2. Imaging/Scan - CT, MRI, PET scans, X-rays, ultrasounds
3. Clinical Report - Progress notes, consultation notes, treatment summaries
4. Genomic Test - Foundation One, Guardant360, BRCA testing, mutation panels
5. Vital Signs - Blood pressure, heart rate, temperature, weight
6. Medication - Prescriptions, medication lists

EXTRACTION REQUIREMENTS:
Return a JSON object with this EXACT structure:

{
  "documentType": "Lab|Scan|Report|Genomic|Vitals|Medication",
  "summary": "Brief summary of key findings",
  "data": {
    // For Lab Results:
    "labs": [
      {
        "labType": "ca125|cea|wbc|hemoglobin|platelets|etc",
        "label": "CA-125",
        "value": 68,
        "unit": "U/mL",
        "date": "2024-12-14",  // MANDATORY: Extract the ACTUAL collection/test date. Search document header, look for "Collection Date", "Test Date", "採取日時", "検査日", or any date field. MUST be in YYYY-MM-DD format.
        "normalRange": "0-35",  // CRITICAL: If document shows a range, use that. Otherwise, provide age/gender-appropriate normal range based on patient demographics.
        "status": "high|normal|low"
      }
    ],

    ═══════════════════════════════════════════════════════════════════════════════
    CRITICAL: DO NOT INCLUDE METRICS WITHOUT VALUES
    ═══════════════════════════════════════════════════════════════════════════════
    
    - If a metric name appears in the document but the value is missing, empty, or shows:
      * "-" (dash/hyphen)
      * "—" (em dash)
      * "N/A" or "NA" or "n/a"
      * Empty space or blank
      * "未測定" (Japanese: not measured)
      * "測定なし" (Japanese: no measurement)
      * Any placeholder indicating no value
    - DO NOT include that metric in the labs or vitals array
    - Only extract metrics that have actual numeric or text values
    - If you see "CA-125: -" or "CA-125: (blank)", skip it entirely
    - If you see "WBC: N/A", skip it entirely
    - Only include metrics where you can extract a real, meaningful value

    CRITICAL RULE FOR ALL LAB VALUES:
    - ALL lab values in the "labs" array MUST use the SAME date - the collection/test date from the document
    - Do NOT use different dates for different lab values from the same report
    - Do NOT skip the date field - it is MANDATORY
- Example: If document shows "採取日時: 2025/12/25" or "Collection Date: 12/25/2025", ALL labs should have "date": "2025-12-25"
     - If you cannot find a date after searching the entire document, use today's date: ${parseLocalDate(new Date().toISOString().split('T')[0]).toISOString().split('T')[0]}

    // For Vitals:
    "vitals": [
      {
        "vitalType": "bp|hr|temp|weight|oxygen",
        "label": "Blood Pressure",
        "value": "125/80",
        "unit": "mmHg",
        "date": "2024-12-14",  // USE ACTUAL MEASUREMENT DATE FROM DOCUMENT
        "normalRange": "90-120/60-80"  // If not shown, omit this field entirely
      }
    ],

    // For Genomic Tests (Foundation One, Guardant360, Tempus xT, Tempus TOP, BRCA testing, etc.):
    "genomic": {
      // Test Information
      "testInfo": {
        "testName": "FoundationOne CDx|Guardant360|Tempus xT|Tempus TOP|BRCA Testing|etc",
        "testDate": "2024-12-15",  // MANDATORY: Extract the ACTUAL test date from the genomic report. Look for "Test Date", "Report Date", "Date of Test", or any date in the report header/metadata. MUST be in YYYY-MM-DD format.
        "laboratoryName": "Foundation Medicine|Tempus Labs|etc",
        "specimenType": "FFPE tissue|Blood (ctDNA)|Germline blood",
        "tumorPurity": "70%",
        "genesCovered": 324
      },

      // ALL Genomic Alterations (extract every mutation with full details)
      // For Tempus: separate somatic from germline - use mutationType field
      // For Japanese documents: "DNA変化" column contains the DNA notation, VAF may be in a separate column
      "mutations": [
        {
          "gene": "BRCA1",
          "alteration": "c.5266dupC (p.Gln1756Profs*74)",
          "dna": "c.5266dupC",  // Extract from "DNA変化" column
          "significance": "pathogenic|likely_pathogenic|VUS|benign",
          "variantAlleleFrequency": 48.5,  // CRITICAL: Extract from VAF column or number next to mutation
          "mutationType": "somatic|germline",
          "therapyImplication": "PARP inhibitors",
          "fdaApprovedTherapy": "Olaparib, Rucaparib, Niraparib",
          "trialEligible": true
        }
      ],

      // Copy Number Variants (CRITICAL: Always extract CCNE1 if mentioned as amplification/gain)
      "copyNumberVariants": [
        {
          "gene": "CCNE1",
          "type": "amplification|deletion",
          "copyNumber": 6,
          "significance": "pathogenic",
          "note": "Platinum resistance marker"
        }
      ],

      // Gene Fusions
      "fusions": [
        {
          "fusion": "EML4-ALK",
          "gene1": "EML4",
          "gene2": "ALK",
          "significance": "pathogenic",
          "therapyImplication": "ALK inhibitors (Crizotinib)"
        }
      ],

      // Biomarkers (extract with full numeric values and interpretations)
      "biomarkers": {
        "tumorMutationalBurden": {
          "value": 12.5,
          "unit": "mutations/megabase",
          "interpretation": "high|intermediate|low",
          "therapyEligible": "Pembrolizumab"
        },
        "microsatelliteInstability": {
          "status": "MSI-H|MSS|MSI-L",
          "interpretation": "Microsatellite Instability-High"
        },
        "hrdScore": {
          "value": 48,
          "threshold": "≥42",
          "interpretation": "HRD-positive|HRD-negative",
          "components": {
            "LOH": 18,
            "TAI": 15,
            "LST": 21
          },
          "therapyEligible": "PARP inhibitors",
          "clinicalSignificance": "Eligible for Olaparib, Rucaparib, Niraparib"
        },
        "pdl1Expression": {
          "value": 85,
          "unit": "percentage",
          "interpretation": "high|low"
        }
      },

      // Germline Findings (if germline testing or germline variants found)
      "germlineFindings": [
        {
          "gene": "BRCA1",
          "variant": "c.5266dupC",
          "classification": "pathogenic",
          "familyRisk": true,
          "counselingRecommended": true
        }
      ],

      // Therapy Matches from report
      "fdaApprovedTherapies": ["Olaparib", "Pembrolizumab"],
      "clinicalTrialEligible": true,

      // Legacy fields (for backward compatibility - still extract these)
      "tumorMutationalBurden": "high",
      "microsatelliteStatus": "MSS",
      "hrdScore": 48,
      "additionalFindings": "Any other relevant clinical findings"
    },

    // For Medications:
    "medications": [
      {
        "name": "Paclitaxel",
        "dosage": "175 mg/m²",
        "frequency": "Every 3 weeks",
        "startDate": "2024-11-01"
      }
    ],

    // For Imaging/Scans:
    "imaging": {
      "scanType": "CT|MRI|PET|X-ray|Ultrasound",
      "bodyPart": "Abdomen & Pelvis",
      "findings": "Stable disease, no new lesions",
      "measurements": "Any tumor measurements",
      "impression": "Radiologist impression"
    }
  }
}

IMPORTANT GENOMIC EXTRACTION RULES:
For genomic/genetic test reports (FoundationOne, Guardant360, Tempus xT, Tempus TOP, etc.):

GENERAL EXTRACTION:
- Extract EVERY mutation listed, not just significant ones
- Use official HUGO gene names (BRCA1 not brca1, TP53 not p53, CCNE1 not ccne1)
- Include exact alteration notation (c.5266dupC, p.Arg273His, E545K, etc.)
- CRITICAL: Capture Variant Allele Frequency (VAF) percentages - this is MANDATORY
  * Look for VAF in these locations:
    1. A separate column titled "VAF", "変異アレル頻度", "Variant Allele Frequency", or similar
    2. Numbers in the same row as the mutation (even if in a different column)
    3. Numbers next to "DNA変化" column entries
    4. Percentage values (e.g., "48.5%", "48.5", "0.485") associated with each mutation
  * Extract the percentage number (e.g., if you see "48.5%" or "48.5" or "変異アレル頻度: 48.5%", extract 48.5)
  * For Japanese documents with "DNA変化" column: The VAF is likely in a separate column in the same row
  * Match VAF values to mutations by row position - each mutation row should have a corresponding VAF value
  * Always include variantAlleleFrequency field in mutations array - DO NOT omit this field
  * If VAF is shown as a decimal (0.485), convert to percentage (48.5)
- Note ALL FDA-approved therapies mentioned
- Flag genes/biomarkers that make patient eligible for trials
- Capture test name, lab, dates, specimen type, tumor purity

CRITICAL GENES TO ALWAYS EXTRACT (if present):
- CCNE1: Extract if mentioned as amplification, copy number gain, or any alteration (CRITICAL for ovarian cancer - platinum resistance marker)
- BRCA1, BRCA2: Extract all variants (germline or somatic)
- TP53: Extract all variants
- PIK3CA: Extract all variants
- Any gene from the important genes list: CCNE1, BRCA1, BRCA2, PIK3CA, ATM, BRD4, TP53, KRAS, EGFR, CCND1
- If CCNE1 appears as "amplified", "copy number gain", "CNV", or similar - extract it in copyNumberVariants array
- If CCNE1 appears as a mutation/variant - extract it in mutations array

BIOMARKERS:
- Extract TMB as numeric value with unit (e.g., 12.5 mutations/megabase)
- Extract MSI as exact status (MSI-H, MSS, MSI-L)
- Extract HRD score as numeric value (e.g., 48) with threshold
- For Tempus: extract HRD components (LOH, TAI, LST) if provided
- Extract PD-L1 if reported

TEMPUS-SPECIFIC:
- Distinguish somatic vs germline mutations (use mutationType field)
- Extract RNA-detected fusions (mark source as "RNA sequencing")
- Note gene expression data if mentioned
- Extract CCNE1 amplification status (platinum resistance marker) - CRITICAL for ovarian cancer
- Capture ovarian-specific markers for TOP panel

COPY NUMBER VARIANTS (CNVs) - CRITICAL EXTRACTION:
- ALWAYS extract CCNE1 if it appears as: "amplified", "copy number gain", "CNV", "amplification", "copy number > 2", or similar
- Extract ALL copy number variants, not just significant ones
- For CCNE1 specifically: This is a critical platinum resistance marker in ovarian cancer - extract it even if copy number is not explicitly stated
- Include copy number value if available (e.g., 6, 8, 10+)
- Note if it's an amplification (gain) or deletion (loss)
- Extract clinical significance if mentioned

GERMLINE FINDINGS:
- Separate germline findings in germlineFindings array
- Include family risk assessment
- Note counseling recommendations
- Include cancer risk percentages if mentioned

GENERAL RULES:
- Only include sections that are present in the document
- Extract ALL numerical values with proper units
- Use standardized field names (ca125, wbc, bp, BRCA1, TP53, etc.)
- Return ONLY valid JSON, no markdown or explanations
- If a field is not present, omit it entirely (DO NOT include fields with null or undefined values)
- CRITICAL: For normalRange field - only include if explicitly shown in the document. If not shown, DO NOT include the field at all
- CRITICAL: For date fields - ALWAYS extract the actual test/collection/report date from the document. Look carefully for date labels
- VALIDATION: Before returning JSON, verify that EVERY lab has a "date" field, EVERY vital has a "date" field, and genomic testInfo has a "testDate" field
- If you cannot find dates after thorough search, you MUST still include date fields using today's date: ${parseLocalDate(new Date().toISOString().split('T')[0]).toISOString().split('T')[0]}`;

  // Update progress: Starting AI analysis
  if (onProgress) {
    onProgress(null, 'Identifying document type and structure...');
  }

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: mimeType,
        data: base64Data
      }
    },
    { text: prompt }
  ]);

  // Update progress: AI is processing
  if (onProgress) {
    onProgress(null, 'Extracting dates and metadata...');
  }

  const response = await result.response;
  
  // Update progress: Parsing AI response
  if (onProgress) {
    onProgress(null, 'Parsing extracted data...');
  }
  
  const text = response.text();

  // Parse JSON response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse AI response');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  // Update progress: Validating extracted data
  if (onProgress) {
    const dataTypes = [];
    if (parsed.data?.labs?.length) dataTypes.push(`${parsed.data.labs.length} lab${parsed.data.labs.length !== 1 ? 's' : ''}`);
    if (parsed.data?.vitals?.length) dataTypes.push(`${parsed.data.vitals.length} vital${parsed.data.vitals.length !== 1 ? 's' : ''}`);
    if (parsed.data?.genomic) dataTypes.push('genomic profile');
    if (parsed.data?.medications?.length) dataTypes.push(`${parsed.data.medications.length} medication${parsed.data.medications.length !== 1 ? 's' : ''}`);
    
    const statusText = dataTypes.length > 0 
      ? `Validating ${dataTypes.join(', ')}...`
      : 'Validating extracted data...';
    onProgress(null, statusText);
  }

  // Validate that dates were extracted
  if (parsed.data?.labs) {
    const labsWithoutDates = parsed.data.labs.filter(lab => !lab.date);
    if (labsWithoutDates.length > 0) {
    }
  }

  if (parsed.data?.vitals) {
    const vitalsWithoutDates = parsed.data.vitals.filter(vital => !vital.date);
    if (vitalsWithoutDates.length > 0) {
    }
  }

  if (parsed.data?.genomic?.testInfo && !parsed.data.genomic.testInfo.testDate) {
  }

  return parsed;
}

/**
 * Adjust normal range based on unit to handle unit mismatches
 * For example, CRP standard is mg/dL (normal <0.3 mg/dL), but some documents may use mg/L
 * @param {string} normalRange - The normal range string (e.g., "<0.3", "<3")
 * @param {string} unit - The unit of the value (e.g., "mg/dL", "mg/L")
 * @param {string} labType - The lab type (e.g., "crp")
 * @returns {string} - Adjusted normal range
 */
function adjustNormalRangeForUnit(normalRange, unit, labType) {
  if (!normalRange || !unit || !labType) {
    return normalRange;
  }
  
  const normalizedLabType = (labType || '').toLowerCase().replace(/[\s\-_]/g, '');
  const normalizedUnit = (unit || '').toLowerCase();
  
  // CRP unit conversion: mg/L vs mg/dL (1 mg/dL = 10 mg/L)
  if (normalizedLabType === 'crp') {
    // If unit is mg/dL but normal range looks like it's in mg/L (e.g., "0-3", "<3")
    if (normalizedUnit.includes('mg/dl') || normalizedUnit.includes('mg/dl')) {
      // Check if the normal range values are typical for mg/L (0-3, <3, 0-10, etc.)
      const rangeMatch = normalRange.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/);
      if (rangeMatch) {
        const min = parseFloat(rangeMatch[1]);
        const max = parseFloat(rangeMatch[2]);
        // If max is <= 10, it's likely in mg/L and needs conversion to mg/dL
        if (max <= 10) {
          const adjustedMin = (min / 10).toFixed(1);
          const adjustedMax = (max / 10).toFixed(1);
          return `${adjustedMin}-${adjustedMax}`;
        }
      }
      
      // Handle "< X" format (e.g., "<3" in mg/L should be "<0.3" in mg/dL)
      const lessThanMatch = normalRange.match(/<\s*(\d+\.?\d*)/);
      if (lessThanMatch) {
        const threshold = parseFloat(lessThanMatch[1]);
        // If threshold is <= 10, it's likely in mg/L and needs conversion
        if (threshold <= 10) {
          const adjustedThreshold = (threshold / 10).toFixed(1);
          return `<${adjustedThreshold}`;
        }
      }
    }
    
    // If unit is mg/L but normal range looks like it's in mg/dL (e.g., "0-0.3", "<0.3")
    if (normalizedUnit.includes('mg/l')) {
      // Check if the normal range values are typical for mg/dL (0-0.3, <0.3, etc.)
      const rangeMatch = normalRange.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/);
      if (rangeMatch) {
        const min = parseFloat(rangeMatch[1]);
        const max = parseFloat(rangeMatch[2]);
        // If max is < 1, it's likely in mg/dL and needs conversion to mg/L
        if (max < 1) {
          const adjustedMin = (min * 10).toFixed(1);
          const adjustedMax = (max * 10).toFixed(1);
          return `${adjustedMin}-${adjustedMax}`;
        }
      }
      
      // Handle "< X" format (e.g., "<0.3" in mg/dL should be "<3" in mg/L)
      const lessThanMatch = normalRange.match(/<\s*(\d+\.?\d*)/);
      if (lessThanMatch) {
        const threshold = parseFloat(lessThanMatch[1]);
        // If threshold is < 1, it's likely in mg/dL and needs conversion
        if (threshold < 1) {
          const adjustedThreshold = (threshold * 10).toFixed(1);
          return `<${adjustedThreshold}`;
        }
      }
    }
  }
  
  return normalRange;
}

/**
 * Save extracted data to Firestore collections
 * @param {Object} extractedData - Extracted data from AI
 * @param {string} userId - User ID
 * @param {string|null} documentDate - Optional date provided by user (YYYY-MM-DD format)
 */
async function saveExtractedData(extractedData, userId, documentDate = null, documentNote = null, documentId = null, onlyExistingMetrics = false) {
  const startTime = Date.now();
  const savedData = {
    labs: [],
    vitals: [],
    medications: [],
    genomic: null
  };


    try {
      // If onlyExistingMetrics is enabled, get existing labs and vitals to filter against
      let existingLabTypes = new Set();
      let existingVitalTypes = new Set();
      
      if (onlyExistingMetrics) {
        const existingLabs = await labService.getLabs(userId);
        const existingVitals = await vitalService.getVitals(userId);
        
        existingLabTypes = new Set(existingLabs.map(lab => (lab.labType || 'other').toLowerCase()));
        existingVitalTypes = new Set(existingVitals.map(vital => (vital.vitalType || 'other').toLowerCase()));
        
      }
    // If reprocessing (documentId provided), delete ALL existing values from this document first
    // This prevents duplicates when reprocessing the same document
    if (documentId) {

      try {
        // Use the comprehensive cleanup service
        // Use non-aggressive cleanup - only delete values with matching documentId (not all values)
        const cleanupResults = await cleanupDocumentData(documentId, userId, false);


        // Verify cleanup was successful
        const verification = await verifyCleanupComplete(documentId, userId);
        if (!verification.isComplete) {
        } else {
        }
      } catch (cleanupError) {
        // Don't throw - continue with reprocessing even if cleanup had issues
      }
    }

    // Save Lab Results
    if (extractedData.data?.labs) {
      // Deduplicate labs from the same upload by labType + value + date
      // This prevents the AI from creating duplicate entries if it extracts the same lab multiple times
      const seenLabs = new Map(); // key: `${labType}_${value}_${date}`, value: lab object
      const uniqueLabs = [];
      
      for (const lab of extractedData.data.labs) {
        // If onlyExistingMetrics is enabled, skip labs that don't already exist
        if (onlyExistingMetrics) {
          const labTypeKey = (lab.labType || 'other').toLowerCase();
          if (!existingLabTypes.has(labTypeKey)) {
            continue;
          }
        }
        
        // Validate that lab has a meaningful value (not empty, "-", "N/A", etc.)
        const value = lab.value;
        if (value === null || value === undefined) {
          continue;
        }
        
        // Convert to string for validation
        const valueStr = String(value).trim();
        
        // Check for empty/invalid value indicators
        const emptyIndicators = ['-', '—', 'n/a', 'na', 'n.a.', '未測定', '測定なし', '', 'null', 'undefined'];
        if (emptyIndicators.includes(valueStr.toLowerCase())) {
          continue;
        }
        
        // For numeric labs, check if value is actually a number
        if (lab.labType && ['ca125', 'cea', 'wbc', 'hemoglobin', 'platelets', 'creatinine', 'alt', 'ast', 'albumin', 'ldh'].includes(lab.labType.toLowerCase())) {
          const numValue = parseFloat(valueStr);
          if (isNaN(numValue)) {
            continue;
          }
        }
        
        // Parse date first to create deduplication key
        // USER-PROVIDED DATE TAKES PRECEDENCE - use it first if available
        let labDate = parseLocalDate(new Date().toISOString().split('T')[0]);
        
        // Priority 1: User-provided date (takes absolute precedence)
        if (documentDate) {
          const userDate = parseLocalDate(documentDate);
          if (!isNaN(userDate.getTime())) {
            labDate = userDate;
          }
        }
        // Priority 2: AI-extracted date from document (only if user didn't provide one)
        else if (lab.date) {
          const parsedDate = parseLocalDate(lab.date);
          if (!isNaN(parsedDate.getTime())) {
            labDate = parsedDate;
          }
        }
        
        // Create deduplication key: labType + value + date (day level)
        const dateKey = labDate.toISOString().split('T')[0]; // YYYY-MM-DD
        const dedupKey = `${(lab.labType || 'other').toLowerCase()}_${valueStr}_${dateKey}`;
        
        if (!seenLabs.has(dedupKey)) {
          seenLabs.set(dedupKey, lab);
          uniqueLabs.push({ ...lab, _parsedDate: labDate }); // Store parsed date for later use
        } else {
        }
      }
      
      
      for (const lab of uniqueLabs) {
        // Use the pre-parsed date
        const labDate = lab._parsedDate;
        // Date already parsed during deduplication, use it directly

        // Ensure all fields have defined values (Firestore doesn't accept undefined)
        const labData = {
          patientId: userId,
          labType: lab.labType || 'other',
          label: lab.label || 'Unknown Lab',
          currentValue: lab.value,
          unit: lab.unit || '',
          status: lab.status || 'unknown',
          createdAt: labDate
        };

        // Only include normalRange if it's defined
        if (lab.normalRange !== undefined && lab.normalRange !== null) {
          // Adjust normal range for unit mismatches (e.g., CRP: mg/L vs mg/dL)
          labData.normalRange = adjustNormalRangeForUnit(lab.normalRange, lab.unit, lab.labType);
        }

        // Get or create lab document
        let labId;
        const existingLab = await labService.getLabByType(userId, lab.labType || 'other');
        if (existingLab) {
          labId = existingLab.id;
        } else {
          labId = await labService.saveLab(labData);
        }
        
        // Cross-document deduplication: Check if same lab+value+date already exists
        // Convert date to timestamp for comparison (day-level precision, using local time)
        const dayStart = new Date(labDate.getFullYear(), labDate.getMonth(), labDate.getDate()).getTime();
        const existingValues = await labService.getLabValues(labId);
        const duplicateValue = existingValues.find(v => {
          // Convert Firestore Timestamp to local date (avoid timezone shift)
          let vDate = null;
          if (v.date?.toDate) {
            const firestoreDate = v.date.toDate();
            // Use local date components to avoid timezone shift
            vDate = new Date(firestoreDate.getFullYear(), firestoreDate.getMonth(), firestoreDate.getDate());
          } else if (v.date) {
            if (v.date instanceof Date) {
              vDate = new Date(v.date.getFullYear(), v.date.getMonth(), v.date.getDate());
            } else {
              // String date - parse as local
              const parsed = parseLocalDate(v.date);
              vDate = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
            }
          }
          if (!vDate) return false;
          const vDayStart = new Date(vDate.getFullYear(), vDate.getMonth(), vDate.getDate()).getTime();
          return vDayStart === dayStart && v.value === lab.value;
        });
        
        let valueId;
        if (duplicateValue) {
          // Update existing value with new documentId and note if different
          valueId = duplicateValue.id;
          const newNote = documentNote ? `Extracted from document. Context: ${documentNote}` : `Extracted from document`;
          if (duplicateValue.documentId !== documentId || duplicateValue.notes !== newNote) {
            await labService.updateLabValue(labId, valueId, {
              value: lab.value,
              date: labDate,
              notes: newNote,
              documentId: documentId || null
            });
          } else {
          }
        } else {
          // Create new lab value (existing values with this documentId were already deleted above if reprocessing)
          valueId = await labService.addLabValue(labId, {
            value: lab.value,
            date: labDate,
            notes: documentNote ? `Extracted from document. Context: ${documentNote}` : `Extracted from document`,
            documentId: documentId || null
          });
        }

        savedData.labs.push({ labId, valueId, ...lab });
      }
    }

    // Save Vitals
    if (extractedData.data?.vitals) {
      // Deduplicate vitals from the same upload by vitalType + value + date
      const seenVitals = new Map(); // key: `${vitalType}_${value}_${date}`, value: vital object
      const uniqueVitals = [];
      
      for (const vital of extractedData.data.vitals) {
        // If onlyExistingMetrics is enabled, skip vitals that don't already exist
        if (onlyExistingMetrics) {
          const vitalTypeKey = (vital.vitalType || 'other').toLowerCase();
          if (!existingVitalTypes.has(vitalTypeKey)) {
            continue;
          }
        }
        
        // Validate that vital has a meaningful value (not empty, "-", "N/A", etc.)
        const value = vital.value;
        if (value === null || value === undefined) {
          continue;
        }
        
        // Convert to string for validation
        const valueStr = String(value).trim();
        
        // Check for empty/invalid value indicators
        const emptyIndicators = ['-', '—', 'n/a', 'na', 'n.a.', '未測定', '測定なし', '', 'null', 'undefined'];
        if (emptyIndicators.includes(valueStr.toLowerCase())) {
          continue;
        }
        
        // For BP, check both systolic and diastolic
        if ((vital.vitalType === 'bp' || vital.vitalType === 'bloodpressure') && vital.systolic) {
          const systolicStr = String(vital.systolic).trim();
          const diastolicStr = vital.diastolic ? String(vital.diastolic).trim() : '';
          if (emptyIndicators.includes(systolicStr.toLowerCase()) || (diastolicStr && emptyIndicators.includes(diastolicStr.toLowerCase()))) {
            continue;
          }
        }
        
        // Parse date first to create deduplication key
        // USER-PROVIDED DATE TAKES PRECEDENCE - use it first if available
        let vitalDate = parseLocalDate(new Date().toISOString().split('T')[0]);
        
        // Priority 1: User-provided date (takes absolute precedence)
        if (documentDate) {
          const userDate = parseLocalDate(documentDate);
          if (!isNaN(userDate.getTime())) {
            vitalDate = userDate;
          }
        }
        // Priority 2: AI-extracted date from document (only if user didn't provide one)
        else if (vital.date) {
          const parsedDate = parseLocalDate(vital.date);
          if (!isNaN(parsedDate.getTime())) {
            vitalDate = parsedDate;
          }
        }
        
        // Create deduplication key: vitalType + value + date (day level)
        // For BP, include systolic/diastolic in the key
        const dateKey = vitalDate.toISOString().split('T')[0]; // YYYY-MM-DD
        const valueKey = vital.vitalType === 'bp' || vital.vitalType === 'bloodpressure'
          ? `${vital.systolic || valueStr}_${vital.diastolic || ''}`
          : valueStr;
        const dedupKey = `${(vital.vitalType || 'other').toLowerCase()}_${valueKey}_${dateKey}`;
        
        if (!seenVitals.has(dedupKey)) {
          seenVitals.set(dedupKey, vital);
          uniqueVitals.push({ ...vital, _parsedDate: vitalDate }); // Store parsed date for later use
        } else {
        }
      }
      
      
      for (const vital of uniqueVitals) {
        // Use the pre-parsed date
        const vitalDate = vital._parsedDate;
        // Date already parsed during deduplication, use it directly

        // Ensure all fields have defined values (Firestore doesn't accept undefined)
        const vitalData = {
          patientId: userId,
          vitalType: vital.vitalType || 'other',
          label: vital.label || 'Unknown Vital',
          currentValue: vital.value,
          unit: vital.unit || '',
          createdAt: vitalDate
        };

        // Only include normalRange if it's defined
        if (vital.normalRange !== undefined && vital.normalRange !== null) {
          vitalData.normalRange = vital.normalRange;
        }

        // Get or create vital document
        let vitalId;
        const existingVital = await vitalService.getVitalByType(userId, vital.vitalType || 'other');
        if (existingVital) {
          vitalId = existingVital.id;
        } else {
          vitalId = await vitalService.saveVital(vitalData);
        }
        
        // Cross-document deduplication: Check if same vital+value+date already exists
        // Convert date to timestamp for comparison (day-level precision, using local time)
        const dayStart = new Date(vitalDate.getFullYear(), vitalDate.getMonth(), vitalDate.getDate()).getTime();
        const existingValues = await vitalService.getVitalValues(vitalId);
        const duplicateValue = existingValues.find(v => {
          // Convert Firestore Timestamp to local date (avoid timezone shift)
          let vDate = null;
          if (v.date?.toDate) {
            const firestoreDate = v.date.toDate();
            // Use local date components to avoid timezone shift
            vDate = new Date(firestoreDate.getFullYear(), firestoreDate.getMonth(), firestoreDate.getDate());
          } else if (v.date) {
            if (v.date instanceof Date) {
              vDate = new Date(v.date.getFullYear(), v.date.getMonth(), v.date.getDate());
            } else {
              // String date - parse as local
              const parsed = parseLocalDate(v.date);
              vDate = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
            }
          }
          if (!vDate) return false;
          const vDayStart = new Date(vDate.getFullYear(), vDate.getMonth(), vDate.getDate()).getTime();
          // For BP, also check systolic/diastolic
          if (vital.vitalType === 'bp' || vital.vitalType === 'bloodpressure') {
            return vDayStart === dayStart && 
                   v.systolic === vital.systolic && 
                   v.diastolic === vital.diastolic;
          }
          return vDayStart === dayStart && v.value === vital.value;
        });
        
        let valueId;
        if (duplicateValue) {
          // Update existing value with new documentId and note if different
          valueId = duplicateValue.id;
          const newNote = documentNote ? `Extracted from document. Context: ${documentNote}` : `Extracted from document`;
          if (duplicateValue.documentId !== documentId || duplicateValue.notes !== newNote) {
            await vitalService.updateVitalValue(vitalId, valueId, {
              value: vital.value,
              date: vitalDate,
              notes: newNote,
              systolic: vital.systolic,
              diastolic: vital.diastolic,
              documentId: documentId || null
            });
          } else {
          }
        } else {
          // Create new vital value (existing values with this documentId were already deleted above if reprocessing)
          valueId = await vitalService.addVitalValue(vitalId, {
            value: vital.value,
            date: vitalDate,
            notes: documentNote ? `Extracted from document. Context: ${documentNote}` : `Extracted from document`,
            documentId: documentId || null
          });
        }

        savedData.vitals.push({ vitalId, valueId, ...vital });
      }
    }

    // Save Genomic Profile
    if (extractedData.data?.genomic) {
      const genomicData = extractedData.data.genomic;


      // Build genomic profile object, only including defined fields
      const genomicProfile = {
        // Mutations (detailed array)
        mutations: genomicData.mutations || [],

        // Copy Number Variants (normalized to `cnvs` for storage)
        cnvs: (genomicData.copyNumberVariants || []).map(c => ({ gene: c.gene || c.symbol, copyNumber: c.copyNumber || c.cn || c.value, type: c.type || 'amplification', significance: c.significance })),

        // Also keep legacy field if present
        copyNumberVariants: genomicData.copyNumberVariants || [],

        // Gene Fusions
        fusions: genomicData.fusions || [],

        // Biomarkers (enhanced structure)
        biomarkers: genomicData.biomarkers || {},

        // Germline Findings
        germlineFindings: genomicData.germlineFindings || [],

        // Therapy Matches
        fdaApprovedTherapies: genomicData.fdaApprovedTherapies || [],
        clinicalTrialEligible: genomicData.clinicalTrialEligible || false,

        lastUpdated: parseLocalDate(new Date().toISOString().split('T')[0])
      };

      // Only include test info fields if they have defined values
      if (genomicData.testInfo?.testName) {
        genomicProfile.testName = genomicData.testInfo.testName;
      }
      // USER-PROVIDED DATE TAKES PRECEDENCE for genomic test date
      if (documentDate) {
        const userDate = parseLocalDate(documentDate);
        if (!isNaN(userDate.getTime())) {
          genomicProfile.testDate = userDate;
        } else if (genomicData.testInfo?.testDate) {
          const parsedTestDate = parseLocalDate(genomicData.testInfo.testDate);
          if (!isNaN(parsedTestDate.getTime())) {
            genomicProfile.testDate = parsedTestDate;
          } else {
            genomicProfile.testDate = parseLocalDate(new Date().toISOString().split('T')[0]);
          }
        } else {
          genomicProfile.testDate = parseLocalDate(new Date().toISOString().split('T')[0]);
        }
      } else if (genomicData.testInfo?.testDate) {
        const parsedTestDate = parseLocalDate(genomicData.testInfo.testDate);
        if (!isNaN(parsedTestDate.getTime())) {
          genomicProfile.testDate = parsedTestDate;
        } else {
          genomicProfile.testDate = parseLocalDate(new Date().toISOString().split('T')[0]);
        }
      } else {
        genomicProfile.testDate = parseLocalDate(new Date().toISOString().split('T')[0]);
      }
      if (genomicData.testInfo?.laboratoryName) {
        genomicProfile.laboratoryName = genomicData.testInfo.laboratoryName;
      }
      if (genomicData.testInfo?.specimenType) {
        genomicProfile.specimenType = genomicData.testInfo.specimenType;
      }
      if (genomicData.testInfo?.tumorPurity !== undefined && genomicData.testInfo?.tumorPurity !== null) {
        genomicProfile.tumorPurity = genomicData.testInfo.tumorPurity;
      }

      // Only include legacy fields if they have values
      // Normalize biomarkers into top-level fields for compatibility with normalization
      if (genomicData.biomarkers?.tumorMutationalBurden?.value !== undefined) {
        genomicProfile.tmbValue = genomicData.biomarkers.tumorMutationalBurden.value;
        genomicProfile.tmb = genomicData.biomarkers.tumorMutationalBurden.interpretation || null;
      } else if (genomicData.tumorMutationalBurden !== undefined) {
        // legacy string
        genomicProfile.tmb = genomicData.tumorMutationalBurden;
        const numMatch = String(genomicData.tumorMutationalBurden).match(/[0-9.]+/);
        if (numMatch) genomicProfile.tmbValue = parseFloat(numMatch[0]);
      }

      if (genomicData.biomarkers?.microsatelliteInstability?.status) {
        genomicProfile.msi = genomicData.biomarkers.microsatelliteInstability.status;
      } else if (genomicData.microsatelliteStatus) {
        genomicProfile.msi = genomicData.microsatelliteStatus;
      }
      // Prefer explicit checks to avoid treating valid falsy values (e.g. 0) as missing.
      if (genomicData.hrdScore !== undefined && genomicData.hrdScore !== null) {
        genomicProfile.hrdScore = genomicData.hrdScore;
      } else if (genomicData.biomarkers?.hrdScore?.value !== undefined && genomicData.biomarkers?.hrdScore?.value !== null) {
        genomicProfile.hrdScore = genomicData.biomarkers.hrdScore.value;
      }
      // PD-L1
      if (genomicData.biomarkers?.pdl1Expression?.value !== undefined) {
        genomicProfile.pdl1 = genomicData.biomarkers.pdl1Expression.value;
      } else if (genomicData.pdl1 !== undefined) {
        genomicProfile.pdl1 = genomicData.pdl1;
      }

      // If the extractor provided a copyNumberMap, include it
      if (genomicData.copyNumberMap && typeof genomicData.copyNumberMap === 'object') {
        genomicProfile.copyNumberMap = genomicData.copyNumberMap;
      }
      if (genomicData.additionalFindings) {
        genomicProfile.additionalFindings = genomicData.additionalFindings;
      }

      // Remove any undefined fields (Firestore rejects undefined values).
      function removeUndefinedFields(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (Array.isArray(obj)) return obj.map(removeUndefinedFields);
        const out = {};
        for (const [k, v] of Object.entries(obj)) {
          if (v === undefined) continue;
          if (v === null) {
            out[k] = null;
            continue;
          }
          if (typeof v === 'object') {
            const cleaned = removeUndefinedFields(v);
            // Only include objects/arrays that are not empty
            if (cleaned !== undefined && (typeof cleaned !== 'object' || (Array.isArray(cleaned) ? cleaned.length > 0 : Object.keys(cleaned).length > 0) )) {
              out[k] = cleaned;
            }
          } else {
            out[k] = v;
          }
        }
        return out;
      }

      const sanitizedGenomicProfile = removeUndefinedFields(genomicProfile);

      await genomicProfileService.saveGenomicProfile(userId, sanitizedGenomicProfile);

      // Include both raw genomicData and normalized cnvs field for counting
      savedData.genomic = {
        ...genomicData,
        cnvs: genomicProfile.cnvs || genomicData.copyNumberVariants || []
      };
    }

    // Save Medications
    if (extractedData.data?.medications) {
      for (const med of extractedData.data.medications) {
        const medId = await medicationService.saveMedication({
          patientId: userId,
          name: med.name,
          dosage: med.dosage,
          frequency: med.frequency,
          startDate: med.startDate ? parseLocalDate(med.startDate) : new Date(),
          active: true,
          documentId: documentId || null,  // Track which document this came from
          extractedFromDocument: true      // Flag that this was auto-extracted
        });

        savedData.medications.push({ medId, ...med });
      }
    }

    const duration = Date.now() - startTime;
    const totalValues = savedData.labs.length + savedData.vitals.length;

    return savedData;
  } catch (error) {
    const duration = Date.now() - startTime;
    throw error;
  }
}

/**
 * Link all values created during processing to a document ID
 * This is used for new uploads where document is created AFTER processing
 * @param {Object} savedData - The saved data returned from saveExtractedData
 * @param {string} documentId - The document ID to link values to
 * @param {string} userId - User ID
 */
export async function linkValuesToDocument(savedData, documentId, userId) {
  if (!documentId) {
    return { linked: 0, errors: [] };
  }

  const startTime = Date.now();
  let linkedCount = 0;
  const errors = [];

  try {
    // Link lab values
    if (savedData.labs && savedData.labs.length > 0) {
      for (const lab of savedData.labs) {
        if (lab.labId && lab.valueId) {
          try {
            await labService.updateLabValueDocumentId(lab.labId, lab.valueId, documentId);
            linkedCount++;
          } catch (error) {
            const errorMsg = `Error linking lab value ${lab.valueId}: ${error.message}`;
            errors.push(errorMsg);
          }
        } else {
        }
      }
    } else {
    }

    // Link vital values
    if (savedData.vitals && savedData.vitals.length > 0) {
      for (const vital of savedData.vitals) {
        if (vital.vitalId && vital.valueId) {
          try {
            await vitalService.updateVitalValueDocumentId(vital.vitalId, vital.valueId, documentId);
            linkedCount++;
          } catch (error) {
            const errorMsg = `Error linking vital value ${vital.valueId}: ${error.message}`;
            errors.push(errorMsg);
          }
        } else {
        }
      }
    } else {
    }

    const duration = Date.now() - startTime;
    if (errors.length > 0) {
    }
    
    return { linked: linkedCount, errors, duration };
  } catch (error) {
    throw error;
  }
}

/**
 * Generate a chat-friendly summary with navigation links for document upload
 */
export function generateChatSummary(extractedData, savedData) {
  const parts = [];
  
  // Start with a success message
  parts.push(`**Document uploaded successfully!**`);
  parts.push(``);
  
  // Document type and summary
  if (extractedData.documentType) {
    parts.push(`**Document Type:** ${extractedData.documentType}`);
  }
  if (extractedData.summary) {
    parts.push(`**Summary:** ${extractedData.summary}`);
  }
  parts.push(``);

  // Labs section
  if (savedData.labs && savedData.labs.length > 0) {
    parts.push(`**Lab Results (${savedData.labs.length})**`);
    savedData.labs.slice(0, 5).forEach(lab => {
      const status = lab.status ? ` (${lab.status})` : '';
      parts.push(`• ${lab.label}: ${lab.value} ${lab.unit || ''}${status}`);
    });
    if (savedData.labs.length > 5) {
      parts.push(`• ... and ${savedData.labs.length - 5} more values`);
    }
    parts.push(`Navigate to **Health Tab** → Labs section to view details`);
    parts.push(``);
  }

  // Vitals section
  if (savedData.vitals && savedData.vitals.length > 0) {
    parts.push(`**Vital Signs (${savedData.vitals.length})**`);
    savedData.vitals.forEach(vital => {
      parts.push(`• ${vital.label}: ${vital.value} ${vital.unit || ''}`);
    });
    parts.push(`Navigate to **Health Tab** → Vitals section to view details`);
    parts.push(``);
  }

  // Genomic section
  if (savedData.genomic) {
    parts.push(`**Genomic Profile Updated**`);
    
    if (savedData.genomic.testInfo?.testName) {
      parts.push(`• Test: ${savedData.genomic.testInfo.testName}`);
    }
    
    if (savedData.genomic.mutations && savedData.genomic.mutations.length > 0) {
      parts.push(`• Mutations: ${savedData.genomic.mutations.map(m => m.gene).join(', ')}`);
    }
    
    if (savedData.genomic.biomarkers) {
      const biomarkers = [];
      if (savedData.genomic.biomarkers.tumorMutationalBurden) biomarkers.push('TMB');
      if (savedData.genomic.biomarkers.microsatelliteInstability) biomarkers.push('MSI');
      if (savedData.genomic.biomarkers.hrdScore) biomarkers.push('HRD');
      if (biomarkers.length > 0) {
        parts.push(`• Biomarkers: ${biomarkers.join(', ')}`);
      }
    }
    
    parts.push(`Navigate to **Profile Tab** → Genomic section to view details`);
    parts.push(``);
  }

  // Medications section
  if (savedData.medications && savedData.medications.length > 0) {
    parts.push(`**Medications (${savedData.medications.length})**`);
    savedData.medications.forEach(med => {
      parts.push(`• ${med.name} - ${med.dosage || ''}`);
    });
    parts.push(`Navigate to **Health Tab** → Medications section to view details`);
    parts.push(``);
  }

  // Data point count
  const totalDataPoints = countDataPoints(savedData);
  parts.push(`**Total Data Points Extracted:** ${totalDataPoints}`);
  parts.push(``);

  // Quick actions
  parts.push(`**Try asking:**`);
  if (savedData.labs && savedData.labs.length > 0) {
    parts.push(`• "Analyze my lab trends"`);
  }
  if (savedData.vitals && savedData.vitals.length > 0) {
    parts.push(`• "How are my vital signs trending?"`);
  }
  if (savedData.genomic) {
    parts.push(`• "What treatments match my genomic profile?"`);
  }
  parts.push(`• "Show me what's most important"`);
  
  return parts.join('\n');
}

/**
 * Generate a user-friendly summary of what was extracted
 */
export function generateExtractionSummary(extractedData, savedData) {
  const parts = [];

  if (savedData.labs.length > 0) {
    parts.push(`Extracted ${savedData.labs.length} lab value(s):`);
    savedData.labs.forEach(lab => {
      parts.push(`  • ${lab.label}: ${lab.value} ${lab.unit} (${lab.status || 'recorded'})`);
    });
  }

  if (savedData.vitals.length > 0) {
    parts.push(`\nExtracted ${savedData.vitals.length} vital sign(s):`);
    savedData.vitals.forEach(vital => {
      parts.push(`  • ${vital.label}: ${vital.value} ${vital.unit}`);
    });
  }

  if (savedData.genomic) {
    parts.push(`\nGenomic Profile Updated:`);

    // Test Information
    if (savedData.genomic.testInfo?.testName) {
      parts.push(`  • Test: ${savedData.genomic.testInfo.testName}`);
    }

    // Mutations
    if (savedData.genomic.mutations?.length > 0) {
      parts.push(`  • Mutations detected (${savedData.genomic.mutations.length}):`);
      savedData.genomic.mutations.forEach(mut => {
        const therapyInfo = mut.fdaApprovedTherapy ? ` → ${mut.fdaApprovedTherapy}` : '';
        parts.push(`    - ${mut.gene}: ${mut.alteration || mut.significance}${therapyInfo}`);
      });
    }

    // Biomarkers
    if (savedData.genomic.biomarkers) {
      const bio = savedData.genomic.biomarkers;
      if (bio.tumorMutationalBurden) {
        const tmb = bio.tumorMutationalBurden;
        parts.push(`  • TMB: ${tmb.value || ''} ${tmb.unit || ''} (${tmb.interpretation}) ${tmb.therapyEligible ? '→ ' + tmb.therapyEligible : ''}`);
      }
      if (bio.microsatelliteInstability) {
        parts.push(`  • MSI: ${bio.microsatelliteInstability.status}`);
      }
      if (bio.hrdScore) {
        parts.push(`  • HRD Score: ${bio.hrdScore.value} (${bio.hrdScore.interpretation}) ${bio.hrdScore.therapyEligible ? '→ ' + bio.hrdScore.therapyEligible : ''}`);
      }
    }

    // FDA-Approved Therapies
    if (savedData.genomic.fdaApprovedTherapies?.length > 0) {
      parts.push(`  • FDA-Approved Options: ${savedData.genomic.fdaApprovedTherapies.join(', ')}`);
    }

    // Germline Findings
    if (savedData.genomic.germlineFindings?.length > 0) {
      parts.push(`  • Germline Findings: ${savedData.genomic.germlineFindings.map(g => g.gene).join(', ')} (genetic counseling recommended)`);
    }

    // Clinical Trial Eligibility
    if (savedData.genomic.clinicalTrialEligible) {
      parts.push(`  • Eligible for clinical trials based on genomic profile`);
    }
  }

  if (savedData.medications.length > 0) {
    parts.push(`\nExtracted ${savedData.medications.length} medication(s):`);
    savedData.medications.forEach(med => {
      parts.push(`  • ${med.name} - ${med.dosage}`);
    });
  }

  if (parts.length === 0) {
    parts.push('Document processed successfully. No structured data extracted.');
  }

  return parts.join('\n');
}

/**
 * Count total data points extracted from a document
 * A data point = metric and value(s) (e.g., one lab value, one vital, one mutation)
 * @param {Object} savedData - Saved data from document processing
 * @returns {number} - Total number of data points
 */
function countDataPoints(savedData) {
  let count = 0;

  // Count labs (each lab = 1 data point)
  if (savedData.labs && Array.isArray(savedData.labs)) {
    count += savedData.labs.length;
  }

  // Count vitals (each vital = 1 data point)
  if (savedData.vitals && Array.isArray(savedData.vitals)) {
    count += savedData.vitals.length;
  }

  // Count medications (each medication = 1 data point)
  if (savedData.medications && Array.isArray(savedData.medications)) {
    count += savedData.medications.length;
  }

  // Count genomic data points
  if (savedData.genomic) {
    // Each mutation = 1 data point
    if (savedData.genomic.mutations && Array.isArray(savedData.genomic.mutations)) {
      count += savedData.genomic.mutations.length;
    }

    // Each CNV = 1 data point
    if (savedData.genomic.cnvs && Array.isArray(savedData.genomic.cnvs)) {
      count += savedData.genomic.cnvs.length;
    } else if (savedData.genomic.copyNumberVariants && Array.isArray(savedData.genomic.copyNumberVariants)) {
      // Fallback to check copyNumberVariants (raw field name from AI extraction)
      count += savedData.genomic.copyNumberVariants.length;
    }

    // Each fusion = 1 data point
    if (savedData.genomic.fusions && Array.isArray(savedData.genomic.fusions)) {
      count += savedData.genomic.fusions.length;
    }

    // Each biomarker = 1 data point (TMB, MSI, HRD, PD-L1)
    if (savedData.genomic.biomarkers) {
      if (savedData.genomic.biomarkers.tumorMutationalBurden) count += 1;
      if (savedData.genomic.biomarkers.microsatelliteInstability) count += 1;
      if (savedData.genomic.biomarkers.hrdScore) count += 1;
      if (savedData.genomic.biomarkers.pdl1Expression) count += 1;
    } else {
      // Check legacy fields
      if (savedData.genomic.tmb || savedData.genomic.tmbValue) count += 1;
      if (savedData.genomic.msi) count += 1;
      if (savedData.genomic.hrdScore !== undefined && savedData.genomic.hrdScore !== null) count += 1;
      if (savedData.genomic.pdl1 !== undefined && savedData.genomic.pdl1 !== null) count += 1;
    }

    // Each germline finding = 1 data point
    if (savedData.genomic.germlineFindings && Array.isArray(savedData.genomic.germlineFindings)) {
      count += savedData.genomic.germlineFindings.length;
    }
  }

  return count;
}
