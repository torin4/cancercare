import { GoogleGenerativeAI } from '@google/generative-ai';
import { labService, vitalService, medicationService, genomicProfileService } from '../firebase/services';
import { parseLocalDate } from '../utils/helpers';

const genAI = new GoogleGenerativeAI(process.env.REACT_APP_GEMINI_API_KEY || process.env.GEMINI_API_KEY);

/**
 * Process an uploaded medical document
 * - Identifies document type
 * - Extracts medical data
 * - Saves to appropriate Firestore collections
 * @param {File} file - The document file
 * @param {string} userId - User ID
 * @param {Object} patientProfile - Patient demographics (age, gender, weight) for normal range adjustments
 * @param {string|null} documentDate - Optional date provided by user (YYYY-MM-DD format)
 */
export async function processDocument(file, userId, patientProfile = null, documentDate = null, documentNote = null, documentId = null) {
  try {
    // Convert file to base64 for Gemini API
    const base64Data = await fileToBase64(file);

    // Step 1: Analyze document and extract data
    const extractedData = await analyzeDocument(base64Data, file.type, patientProfile, documentDate);

    // Step 2: Save extracted data to Firestore
    const savedData = await saveExtractedData(extractedData, userId, documentDate, documentNote, documentId);

    // Count total data points extracted (metric + value = 1 data point)
    const dataPointCount = countDataPoints(savedData);

    return {
      success: true,
      documentType: extractedData.documentType,
      extractedData: savedData,
      summary: extractedData.summary,
      dataPointCount
    };
  } catch (error) {
    console.error('Error processing document:', error);
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
async function analyzeDocument(base64Data, mimeType, patientProfile = null, documentDate = null) {
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
DOCUMENT DATE PROVIDED BY USER: ${documentDate}
═══════════════════════════════════════════════════════════════════════════════

The user has provided the document date: ${documentDate}
- FIRST, try to extract the date from the document itself (test date, collection date, report date)
- If the document shows a different date, prefer the date from the document itself
- If NO date is found in the document after thorough search, use the user-provided date: ${documentDate}
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
- If no date is found, use today's date as a last resort: ${new Date().toISOString().split('T')[0]}
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
${documentDate ? `- If NO date is found after thorough search, use the user-provided date: ${documentDate}` : `- If NO date is found after thorough search, ONLY THEN use: ${new Date().toISOString().split('T')[0]}`}

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

    CRITICAL RULE FOR ALL LAB VALUES:
    - ALL lab values in the "labs" array MUST use the SAME date - the collection/test date from the document
    - Do NOT use different dates for different lab values from the same report
    - Do NOT skip the date field - it is MANDATORY
    - Example: If document shows "採取日時: 2025/12/25" or "Collection Date: 12/25/2025", ALL labs should have "date": "2025-12-25"
    - If you cannot find a date after searching the entire document, use today's date: ${new Date().toISOString().split('T')[0]}

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
- If you cannot find dates after thorough search, you MUST still include date fields using today's date: ${new Date().toISOString().split('T')[0]}`;

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: mimeType,
        data: base64Data
      }
    },
    { text: prompt }
  ]);

  const response = await result.response;
  const text = response.text();

  // Parse JSON response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse AI response');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  // Validate that dates were extracted
  if (parsed.data?.labs) {
    const labsWithoutDates = parsed.data.labs.filter(lab => !lab.date);
    if (labsWithoutDates.length > 0) {
      console.warn(`WARNING: ${labsWithoutDates.length} lab value(s) missing dates:`, labsWithoutDates.map(l => l.label));
    }
  }

  if (parsed.data?.vitals) {
    const vitalsWithoutDates = parsed.data.vitals.filter(vital => !vital.date);
    if (vitalsWithoutDates.length > 0) {
      console.warn(`WARNING: ${vitalsWithoutDates.length} vital(s) missing dates:`, vitalsWithoutDates.map(v => v.label));
    }
  }

  if (parsed.data?.genomic?.testInfo && !parsed.data.genomic.testInfo.testDate) {
    console.warn('WARNING: Genomic test missing testDate');
  }

  return parsed;
}

/**
 * Save extracted data to Firestore collections
 * @param {Object} extractedData - Extracted data from AI
 * @param {string} userId - User ID
 * @param {string|null} documentDate - Optional date provided by user (YYYY-MM-DD format)
 */
async function saveExtractedData(extractedData, userId, documentDate = null, documentNote = null, documentId = null) {
  const savedData = {
    labs: [],
    vitals: [],
    medications: [],
    genomic: null
  };

  try {
    // If reprocessing (documentId provided), delete ALL existing values from this document first
    // This prevents duplicates when reprocessing the same document
    if (documentId) {
      console.log(`Reprocessing document ${documentId} - deleting existing values...`);
      
      // Track labs that might become orphaned after deletion
      const labsToCheck = new Set();
      
      // Delete all lab values with this documentId
      const allLabs = await labService.getLabs(userId);
      for (const labDoc of allLabs) {
        const values = await labService.getLabValues(labDoc.id);
        let deletedCount = 0;
        for (const value of values) {
          if (value.documentId === documentId) {
            try {
              await labService.deleteLabValue(labDoc.id, value.id);
              console.log(`Deleted lab value ${value.id} from document ${documentId}`);
              deletedCount++;
            } catch (error) {
              console.warn(`Error deleting lab value ${value.id}:`, error);
            }
          }
        }
        // If we deleted values, check if the lab is now empty
        if (deletedCount > 0) {
          labsToCheck.add(labDoc.id);
        }
      }
      
      // Delete all vital values with this documentId
      const allVitals = await vitalService.getVitals(userId);
      for (const vitalDoc of allVitals) {
        const values = await vitalService.getVitalValues(vitalDoc.id);
        for (const value of values) {
          if (value.documentId === documentId) {
            try {
              await vitalService.deleteVitalValue(vitalDoc.id, value.id);
              console.log(`Deleted vital value ${value.id} from document ${documentId}`);
            } catch (error) {
              console.warn(`Error deleting vital value ${value.id}:`, error);
            }
          }
        }
      }
      
      // Clean up any labs that became orphaned (no values left)
      for (const labId of labsToCheck) {
        try {
          const remainingValues = await labService.getLabValues(labId);
          if (!remainingValues || remainingValues.length === 0) {
            console.log(`Lab ${labId} is now orphaned (no values), deleting...`);
            await labService.deleteLab(labId);
            console.log(`Deleted orphaned lab ${labId}`);
          }
        } catch (error) {
          console.warn(`Error checking/deleting orphaned lab ${labId}:`, error);
        }
      }
      
      // Also run full cleanup to catch any other orphaned labs
      try {
        const orphanedCount = await labService.cleanupOrphanedLabs(userId);
        if (orphanedCount > 0) {
          console.log(`Cleaned up ${orphanedCount} orphaned labs after reprocessing`);
        }
      } catch (error) {
        console.warn('Error running orphaned labs cleanup:', error);
      }
      
      console.log(`Finished deleting existing values from document ${documentId}`);
    }

    // Save Lab Results
    if (extractedData.data?.labs) {
      for (const lab of extractedData.data.labs) {
        // Parse date - try multiple formats and fallback to user-provided date or today if missing
        // Use parseLocalDate to avoid timezone issues (prevents dates from shifting by one day)
        let labDate = new Date();
        if (lab.date) {
          // Try parsing the date string as local date
          const parsedDate = parseLocalDate(lab.date);
          if (!isNaN(parsedDate.getTime())) {
            labDate = parsedDate;
          } else {
            console.warn(`Could not parse lab date "${lab.date}" for ${lab.label}, using fallback date`);
            // Try user-provided date, otherwise use today
            if (documentDate) {
              const userDate = parseLocalDate(documentDate);
              if (!isNaN(userDate.getTime())) {
                labDate = userDate;
              }
            }
          }
        } else {
          console.warn(`Lab ${lab.label} missing date field, using fallback date`);
          // Use user-provided date if available, otherwise use today
          if (documentDate) {
            const userDate = parseLocalDate(documentDate);
            if (!isNaN(userDate.getTime())) {
              labDate = userDate;
            }
          }
        }

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
          labData.normalRange = lab.normalRange;
        }

        // Get or create lab document
        let labId;
        const existingLab = await labService.getLabByType(userId, lab.labType || 'other');
        if (existingLab) {
          labId = existingLab.id;
        } else {
          labId = await labService.saveLab(labData);
        }
        
        // Create new lab value (existing values with this documentId were already deleted above if reprocessing)
        await labService.addLabValue(labId, {
          value: lab.value,
          date: labDate,
          notes: documentNote ? `Extracted from document. Context: ${documentNote}` : `Extracted from document`,
          documentId: documentId || null
        });

        savedData.labs.push({ labId, ...lab });
      }
    }

    // Save Vitals
    if (extractedData.data?.vitals) {
      for (const vital of extractedData.data.vitals) {
        // Parse date - try multiple formats and fallback to user-provided date or today if missing
        // Use parseLocalDate to avoid timezone issues (prevents dates from shifting by one day)
        let vitalDate = new Date();
        if (vital.date) {
          const parsedDate = parseLocalDate(vital.date);
          if (!isNaN(parsedDate.getTime())) {
            vitalDate = parsedDate;
          } else {
            console.warn(`Could not parse vital date "${vital.date}" for ${vital.label}, using fallback date`);
            // Try user-provided date, otherwise use today
            if (documentDate) {
              const userDate = parseLocalDate(documentDate);
              if (!isNaN(userDate.getTime())) {
                vitalDate = userDate;
              }
            }
          }
        } else {
          console.warn(`Vital ${vital.label} missing date field, using fallback date`);
          // Use user-provided date if available, otherwise use today
          if (documentDate) {
            const userDate = parseLocalDate(documentDate);
            if (!isNaN(userDate.getTime())) {
              vitalDate = userDate;
            }
          }
        }

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
        
        // Create new vital value (existing values with this documentId were already deleted above if reprocessing)
        await vitalService.addVitalValue(vitalId, {
          value: vital.value,
          date: vitalDate,
          notes: documentNote ? `Extracted from document. Context: ${documentNote}` : `Extracted from document`,
          documentId: documentId || null
        });

        savedData.vitals.push({ vitalId, ...vital });
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

        lastUpdated: new Date()
      };

      // Only include test info fields if they have defined values
      if (genomicData.testInfo?.testName) {
        genomicProfile.testName = genomicData.testInfo.testName;
      }
      if (genomicData.testInfo?.testDate) {
        const parsedTestDate = new Date(genomicData.testInfo.testDate);
        if (!isNaN(parsedTestDate.getTime())) {
          genomicProfile.testDate = parsedTestDate;
        } else {
          console.warn(`Could not parse genomic testDate "${genomicData.testInfo.testDate}", using today's date`);
          genomicProfile.testDate = new Date();
        }
      } else {
        console.warn('Genomic test missing testDate field, using today\'s date');
        genomicProfile.testDate = new Date();
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
          startDate: new Date(med.startDate),
          active: true
        });

        savedData.medications.push({ medId, ...med });
      }
    }

    return savedData;
  } catch (error) {
    console.error('Error saving extracted data:', error);
    throw error;
  }
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
