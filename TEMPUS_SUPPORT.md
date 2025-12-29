# Tempus xT / Tempus TOP (Ovarian Panel) Support

## Overview

Full support for Tempus genomic testing reports, including the ovarian cancer-specific TOP panel.

---

## Tempus Tests Supported

### 1. **Tempus xT**
- **Description:** 648-gene DNA panel + whole transcriptome RNA sequencing
- **Analysis Type:** Tumor + Germline
- **Specimen:** FFPE tumor tissue
- **Key Features:**
  - Comprehensive genomic profiling
  - RNA sequencing for fusions
  - TMB and MSI analysis
  - Dual tumor/germline analysis

### 2. **Tempus TOP (Ovarian Panel)**
- **Description:** Ovarian cancer-specific panel with DNA + RNA
- **Analysis Type:** Tumor + Germline
- **Specimen:** FFPE tumor tissue
- **Key Features:**
  - HRD score with LOH, TAI, LST components
  - BRCA1/BRCA2 somatic + germline testing
  - Homologous recombination pathway genes
  - Platinum sensitivity markers
  - CCNE1 amplification status

---

## What Gets Extracted from Tempus Reports

### DNA Alterations (Somatic)
✅ Point mutations (SNVs)
✅ Insertions/deletions (indels)
✅ Copy number alterations
- Amplifications (e.g., CCNE1, MYC)
- Deletions (e.g., PTEN)
✅ Variant Allele Frequency (VAF) for each mutation

### RNA Analysis
✅ Gene fusions detected via RNA sequencing
- NTRK fusions (Larotrectinib/Entrectinib eligible)
- ALK fusions (Crizotinib eligible)
- ROS1 fusions
- FGFR fusions
✅ Marked with source: "RNA sequencing"

### Germline Findings
✅ Separate germline section
✅ BRCA1/BRCA2 pathogenic variants
✅ ATM, PALB2, RAD51C, RAD51D, BRIP1
✅ Family risk assessment
✅ Genetic counseling recommendations
✅ Cancer risk percentages

### Biomarkers

**Tumor Mutational Burden (TMB):**
```json
{
  "value": 6.8,
  "unit": "mutations/megabase",
  "interpretation": "low|intermediate|high"
}
```

**Microsatellite Instability (MSI):**
```json
{
  "status": "MSI-H|MSS|MSI-L",
  "interpretation": "Microsatellite Stable"
}
```

**HRD Score (Ovarian/Breast Cancer):**
```json
{
  "value": 54,
  "threshold": "≥42",
  "interpretation": "HRD-positive",
  "components": {
    "LOH": 18,   // Loss of Heterozygosity
    "TAI": 15,   // Telomeric Allelic Imbalance
    "LST": 21    // Large-scale State Transitions
  },
  "therapyEligible": "PARP inhibitors",
  "clinicalSignificance": "Eligible for Olaparib, Rucaparib, Niraparib"
}
```

### Therapy Matches
✅ FDA-approved therapies
✅ NCCN guideline recommendations
✅ Clinical trial suggestions
✅ Tempus-specific trial network matches

---

## Example: Tempus TOP Report Extraction

**Input:** Tempus TOP (Ovarian Panel) PDF report

**Extracted Data:**

```json
{
  "testInfo": {
    "testName": "Tempus TOP (Ovarian Panel)",
    "laboratoryName": "Tempus Labs",
    "testDate": "2024-12-15",
    "specimenType": "FFPE tumor tissue",
    "tumorPurity": "70%",
    "genesCovered": 648
  },

  "mutations": [
    {
      "gene": "BRCA1",
      "alteration": "c.5266dupC (p.Gln1756Profs*74)",
      "significance": "pathogenic",
      "variantAlleleFrequency": 45.2,
      "mutationType": "somatic",
      "therapyImplication": "PARP inhibitors",
      "fdaApprovedTherapy": "Olaparib, Rucaparib, Niraparib",
      "trialEligible": true
    },
    {
      "gene": "TP53",
      "alteration": "c.742C>T (p.Arg248Trp)",
      "significance": "pathogenic",
      "variantAlleleFrequency": 58.1,
      "mutationType": "somatic"
    },
    {
      "gene": "PIK3CA",
      "alteration": "E545K",
      "significance": "pathogenic",
      "variantAlleleFrequency": 32.5,
      "mutationType": "somatic",
      "therapyImplication": "PI3K inhibitors"
    }
  ],

  "copyNumberVariants": [
    {
      "gene": "CCNE1",
      "type": "amplification",
      "copyNumber": 8,
      "significance": "pathogenic",
      "clinicalNote": "Associated with platinum resistance and poor prognosis"
    }
  ],

  "fusions": [],

  "biomarkers": {
    "tumorMutationalBurden": {
      "value": 6.8,
      "unit": "mutations/megabase",
      "interpretation": "low-intermediate"
    },
    "microsatelliteInstability": {
      "status": "MSS",
      "interpretation": "Microsatellite Stable"
    },
    "hrdScore": {
      "value": 54,
      "threshold": "≥42",
      "interpretation": "HRD-positive",
      "components": {
        "LOH": 18,
        "TAI": 15,
        "LST": 21
      },
      "therapyEligible": "PARP inhibitors",
      "clinicalSignificance": "Eligible for Olaparib, Rucaparib, Niraparib in ovarian cancer"
    }
  },

  "germlineFindings": [
    {
      "gene": "BRCA2",
      "variant": "c.5946delT (p.Ser1982Argfs*22)",
      "classification": "pathogenic",
      "inheritance": "autosomal dominant",
      "familyRisk": true,
      "counselingRecommended": true,
      "ovarianCancerRisk": "15-40% lifetime risk",
      "breastCancerRisk": "45-85% lifetime risk",
      "source": "germline analysis"
    }
  ],

  "fdaApprovedTherapies": [
    "Olaparib (PARP inhibitor - BRCA1 somatic + HRD+)",
    "Rucaparib (PARP inhibitor - BRCA1/2)",
    "Niraparib (PARP inhibitor - HRD+)"
  ],

  "clinicalTrialEligible": true
}
```

**Chat Display:**

```
🧬 Genomic Profile Updated:
• Test: Tempus TOP (Ovarian Panel)
• Mutations detected (3):
  - BRCA1: c.5266dupC (somatic) → Olaparib, Rucaparib, Niraparib
  - TP53: c.742C>T (somatic)
  - PIK3CA: E545K (somatic)
• Copy Number Variants: CCNE1 amplification
• TMB: 6.8 mutations/megabase (low-intermediate)
• MSI: MSS
• HRD Score: 54 (HRD-positive) → PARP inhibitors
  Components: LOH=18, TAI=15, LST=21
• FDA-Approved Options: Olaparib, Rucaparib, Niraparib
• Germline Findings: BRCA2 (genetic counseling recommended)
• ✅ Eligible for clinical trials based on genomic profile
```

---

## Key Tempus Features Captured

### 1. Somatic vs Germline Distinction
- **Somatic mutations:** Found only in tumor tissue
- **Germline mutations:** Inherited, present in all cells
- Critical for treatment decisions and family counseling

**Example:**
- BRCA1 somatic mutation → PARP inhibitor for patient only
- BRCA2 germline mutation → PARP inhibitor for patient + family testing recommended

### 2. RNA-Detected Fusions
- Tempus uses RNA sequencing to detect fusions
- More sensitive than DNA-only testing
- Marked with `source: "RNA sequencing"`

**Example:**
```json
{
  "fusion": "NTRK1-TPM3",
  "gene1": "NTRK1",
  "gene2": "TPM3",
  "significance": "pathogenic",
  "therapyImplication": "TRK inhibitors",
  "fdaApprovedTherapy": "Larotrectinib, Entrectinib",
  "source": "RNA sequencing"
}
```

### 3. Detailed HRD Score
- **LOH:** Loss of Heterozygosity score
- **TAI:** Telomeric Allelic Imbalance score
- **LST:** Large-scale State Transitions score
- **Total HRD:** Sum of LOH + TAI + LST

**Interpretation:**
- HRD ≥42 → HRD-positive → PARP inhibitor eligible
- HRD <42 → HRD-negative → PARP inhibitor less likely to work

### 4. CCNE1 Amplification
- Copy number gain in CCNE1 gene
- Associated with platinum resistance
- Important for treatment planning in ovarian cancer
- May suggest alternative therapies

### 5. Clinical Trial Matching
- Tempus has proprietary clinical trial network
- Extract trial suggestions from report
- Flag genes/biomarkers that enable trial enrollment

---

## Ovarian Cancer-Specific Insights (TOP Panel)

### PARP Inhibitor Eligibility

**Patient is eligible for PARP inhibitors if ANY of:**
✅ BRCA1 mutation (somatic or germline)
✅ BRCA2 mutation (somatic or germline)
✅ HRD-positive (score ≥42)
✅ Other HR pathway genes (PALB2, RAD51C, RAD51D, BRIP1)

**Example:**
```
Mutations: BRCA1 somatic (pathogenic)
HRD Score: 54 (HRD-positive)
Result: Eligible for Olaparib, Rucaparib, Niraparib
```

### Platinum Sensitivity Markers

**Predicts response to platinum chemotherapy:**
- BRCA1/BRCA2 mutations → Platinum sensitive
- HRD-positive → Platinum sensitive
- CCNE1 amplification → Platinum resistant
- TP53 wild-type → Better prognosis

**Example:**
```
BRCA1: Pathogenic mutation (platinum sensitive)
CCNE1: Amplified (platinum resistant)
Clinical Decision: Consider PARP inhibitor over platinum rechallenge
```

### Maintenance Therapy Decisions

**After platinum-based chemotherapy:**
- HRD-positive → Niraparib maintenance FDA-approved
- BRCA1/2 mutation → Olaparib or Rucaparib maintenance
- CCNE1 amplification → Consider alternative maintenance strategies

---

## Chat Interface Support

Users can also report Tempus findings via chat:

**Example 1:**
```
User: "Her Tempus test showed BRCA1 mutation, HRD score of 52, and CCNE1 amplification"

AI Response:
✅ Updated genomic profile:
• BRCA1 mutation detected → PARP inhibitors eligible
• HRD Score: 52 (HRD-positive) → PARP inhibitors eligible
• CCNE1 amplification detected → Platinum resistance marker

Treatment implications:
• PARP inhibitors: Olaparib, Rucaparib, Niraparib (FDA-approved)
• Consider PARP inhibitor over platinum due to CCNE1 amplification
• Eligible for clinical trials
```

**Example 2:**
```
User: "Tempus TOP found germline BRCA2 mutation"

AI Response:
✅ Updated genomic profile:
• Germline BRCA2 mutation detected

Important:
• ⚠️ Genetic counseling strongly recommended
• Family members (first-degree relatives) should be offered testing
• 50% chance of passing to offspring
• Ovarian cancer risk: 15-40% lifetime
• Breast cancer risk: 45-85% lifetime
• Treatment: PARP inhibitors approved (Olaparib, Rucaparib, Niraparib)
```

---

## Benefits of Tempus Support

### 1. Comprehensive Genomic Profiling
- 648 genes analyzed (vs 324 for FoundationOne)
- RNA sequencing for fusion detection
- Dual tumor + germline analysis

### 2. Ovarian Cancer Optimization
- HRD score with detailed components
- Platinum sensitivity predictions
- PARP inhibitor eligibility determination
- CCNE1 status for treatment planning

### 3. Family Risk Assessment
- Germline findings clearly separated
- Cancer risk percentages provided
- Genetic counseling recommendations
- Family testing guidance

### 4. Clinical Trial Matching
- Tempus trial network integration
- Gene-based trial eligibility
- Biomarker-based trial matching
- FDA-approved therapy alternatives

---

## Testing Tempus Integration

### Test 1: Upload Tempus xT Report
```
1. Navigate to Chat tab
2. Upload Tempus xT PDF report
3. Expected: All mutations extracted with somatic/germline distinction
4. Expected: RNA fusions marked with source
5. Expected: TMB, MSI, HRD scores extracted
6. Expected: Germline findings separated
7. Verify: Firestore has mutations with mutationType field
```

### Test 2: Upload Tempus TOP Report
```
1. Navigate to Chat tab
2. Upload Tempus TOP (Ovarian Panel) PDF
3. Expected: HRD score with LOH, TAI, LST components
4. Expected: CCNE1 amplification extracted
5. Expected: BRCA1/BRCA2 with somatic vs germline distinction
6. Expected: Germline findings with family risk assessment
7. Verify: Firestore has comprehensive biomarkers object
```

### Test 3: Chat-Based Tempus Entry
```
1. Type: "Tempus showed BRCA1 somatic, HRD 54, CCNE1 amp"
2. Expected: All three findings extracted
3. Expected: PARP inhibitor eligibility noted
4. Expected: Platinum resistance marker flagged
5. Verify: Data saved to genomicProfiles collection
```

---

## Summary

✅ **Full Tempus xT support** - 648-gene panel with RNA sequencing
✅ **Tempus TOP support** - Ovarian cancer-specific panel
✅ **Somatic vs germline distinction** - Critical for treatment decisions
✅ **RNA fusion detection** - More sensitive than DNA-only
✅ **Detailed HRD scoring** - LOH, TAI, LST components
✅ **CCNE1 amplification** - Platinum resistance marker
✅ **Germline risk assessment** - Family counseling guidance
✅ **PARP inhibitor eligibility** - FDA-approved therapy matching
✅ **Clinical trial matching** - Gene and biomarker-based
✅ **Chat interface support** - Natural language entry

**Result:** Comprehensive Tempus genomic report processing for precision oncology and clinical trial matching! 🧬
