# Genomic Report Processing Protocol

## Overview

This protocol defines how genomic/genetic test reports are processed, what information is extracted, and how it's stored for clinical trial matching and treatment guidance.

---

## Supported Genomic Test Types

### 1. **Comprehensive Genomic Profiling (CGP)**
- Foundation One (F1CDx)
- Guardant360
- Tempus xT
- Caris Molecular Intelligence
- OmniSeq

### 2. **Germline Testing**
- BRCA1/BRCA2
- Lynch Syndrome panel
- Hereditary cancer panels
- Family history risk assessment

### 3. **Liquid Biopsy**
- Guardant360 CDx
- FoundationOne Liquid CDx
- ctDNA testing

### 4. **Targeted Gene Panels**
- HRD (Homologous Recombination Deficiency)
- MSI (Microsatellite Instability)
- TMB (Tumor Mutational Burden)
- PD-L1 testing

---

## Critical Information to Extract

### A. **Mutations & Alterations**

Extract ALL gene mutations/alterations with details:

```json
{
  "mutations": [
    {
      "gene": "BRCA1",
      "alteration": "c.5266dupC (p.Gln1756Profs*74)",
      "alterationType": "pathogenic|likely_pathogenic|VUS|benign",
      "variantAlleleFrequency": 48.5,
      "significance": "pathogenic",
      "therapyImplications": "PARP inhibitors",
      "trialEligibility": true,
      "fdaApprovedTherapy": "Olaparib, Rucaparib, Niraparib"
    },
    {
      "gene": "TP53",
      "alteration": "c.818G>A (p.Arg273His)",
      "alterationType": "pathogenic",
      "variantAlleleFrequency": 52.3,
      "significance": "pathogenic",
      "therapyImplications": "Potential resistance to platinum therapy",
      "trialEligibility": true
    },
    {
      "gene": "PIK3CA",
      "alteration": "E545K",
      "alterationType": "pathogenic",
      "variantAlleleFrequency": 38.2,
      "significance": "pathogenic",
      "therapyImplications": "PI3K inhibitors",
      "fdaApprovedTherapy": "Alpelisib (for breast cancer)"
    }
  ]
}
```

**Key Fields:**
- Gene name (standardized: BRCA1, not brca1 or Brca1)
- Specific alteration/variant
- Type (SNV, indel, CNV, fusion, etc.)
- Variant Allele Frequency (VAF %)
- Clinical significance
- Therapy implications
- Trial eligibility relevance

### B. **Biomarkers**

```json
{
  "biomarkers": {
    "tumorMutationalBurden": {
      "value": 12.5,
      "unit": "mutations/megabase",
      "interpretation": "high|intermediate|low",
      "threshold": "≥10 mutations/Mb",
      "therapyImplication": "Pembrolizumab eligible"
    },
    "microsatelliteInstability": {
      "status": "MSI-H|MSS|MSI-L",
      "interpretation": "Microsatellite Instability-High",
      "therapyImplication": "Immunotherapy eligible"
    },
    "pdl1Expression": {
      "value": 85,
      "unit": "percentage",
      "method": "22C3 antibody",
      "interpretation": "High expression",
      "therapyImplication": "Pembrolizumab eligible"
    },
    "hrdScore": {
      "value": 45,
      "threshold": "≥42",
      "interpretation": "HRD-positive",
      "therapyImplication": "PARP inhibitor eligible"
    }
  }
}
```

### C. **Copy Number Variants (CNVs)**

```json
{
  "copyNumberVariants": [
    {
      "gene": "ERBB2",
      "type": "amplification",
      "copyNumber": 8,
      "significance": "pathogenic",
      "therapyImplication": "HER2-targeted therapy"
    },
    {
      "gene": "CDKN2A",
      "type": "deletion",
      "significance": "pathogenic"
    }
  ]
}
```

### D. **Gene Fusions**

```json
{
  "fusions": [
    {
      "fusion": "EML4-ALK",
      "gene1": "EML4",
      "gene2": "ALK",
      "significance": "pathogenic",
      "therapyImplication": "ALK inhibitors (Crizotinib, Alectinib)",
      "fdaApproved": true
    },
    {
      "fusion": "NTRK1-TPM3",
      "gene1": "NTRK1",
      "gene2": "TPM3",
      "significance": "pathogenic",
      "therapyImplication": "TRK inhibitors (Larotrectinib, Entrectinib)",
      "fdaApproved": true
    }
  ]
}
```

### E. **Germline vs Somatic**

```json
{
  "mutationType": "somatic|germline|unknown",
  "germlineFindings": [
    {
      "gene": "BRCA1",
      "variant": "c.5266dupC",
      "classification": "pathogenic",
      "inheritance": "autosomal dominant",
      "familyRisk": "50% chance of passing to offspring",
      "recommendedTesting": "Family members should consider genetic counseling"
    }
  ]
}
```

### F. **Therapy Matches**

```json
{
  "therapyMatches": {
    "fdaApproved": [
      {
        "therapy": "Olaparib",
        "gene": "BRCA1",
        "indication": "Ovarian Cancer",
        "evidenceLevel": "FDA-approved",
        "source": "FDA label"
      },
      {
        "therapy": "Pembrolizumab",
        "biomarker": "TMB-High",
        "indication": "Solid tumors",
        "evidenceLevel": "FDA-approved",
        "source": "FDA tissue-agnostic approval"
      }
    ],
    "clinicalTrials": [
      {
        "therapy": "PARP inhibitor + immunotherapy combination",
        "gene": "BRCA1",
        "phase": "Phase II/III",
        "reasoning": "BRCA1 mutation + HRD-positive"
      }
    ],
    "offLabel": [
      {
        "therapy": "Bevacizumab + PARP inhibitor",
        "gene": "BRCA1",
        "evidenceLevel": "NCCN guideline",
        "reasoning": "HRD-positive tumors"
      }
    ]
  }
}
```

### G. **Test Metadata**

```json
{
  "testInfo": {
    "testName": "FoundationOne CDx",
    "laboratoryName": "Foundation Medicine, Inc.",
    "testDate": "2024-12-15",
    "reportDate": "2024-12-22",
    "specimenType": "FFPE tumor tissue",
    "specimenSite": "Ovarian mass",
    "collectionDate": "2024-12-10",
    "tumorPurity": "70%",
    "genesCovered": 324,
    "meanCoverage": "685x"
  }
}
```

---

## Complete Extraction Schema

### Full JSON Structure for Genomic Reports

```json
{
  "documentType": "Genomic",
  "summary": "FoundationOne CDx testing reveals BRCA1 pathogenic mutation, TP53 mutation, TMB-high, and MSI-stable status. Multiple FDA-approved therapy options available.",
  "data": {
    "genomic": {
      // Test Information
      "testInfo": {
        "testName": "FoundationOne CDx",
        "laboratoryName": "Foundation Medicine, Inc.",
        "testDate": "2024-12-15",
        "reportDate": "2024-12-22",
        "specimenType": "FFPE tumor tissue",
        "specimenSite": "Ovarian mass",
        "collectionDate": "2024-12-10",
        "tumorPurity": "70%",
        "genesCovered": 324,
        "meanCoverage": "685x"
      },

      // Genomic Alterations
      "mutations": [
        {
          "gene": "BRCA1",
          "alteration": "c.5266dupC (p.Gln1756Profs*74)",
          "alterationType": "pathogenic",
          "variantAlleleFrequency": 48.5,
          "significance": "pathogenic",
          "therapyImplications": "PARP inhibitors",
          "fdaApprovedTherapy": "Olaparib, Rucaparib, Niraparib",
          "trialEligibility": true
        },
        {
          "gene": "TP53",
          "alteration": "c.818G>A (p.Arg273His)",
          "alterationType": "pathogenic",
          "variantAlleleFrequency": 52.3,
          "significance": "pathogenic"
        }
      ],

      // Copy Number Variants
      "copyNumberVariants": [
        {
          "gene": "CCNE1",
          "type": "amplification",
          "copyNumber": 6,
          "significance": "pathogenic"
        }
      ],

      // Gene Fusions
      "fusions": [],

      // Biomarkers
      "biomarkers": {
        "tumorMutationalBurden": {
          "value": 12.5,
          "unit": "mutations/megabase",
          "interpretation": "high",
          "threshold": "≥10 mutations/Mb",
          "therapyImplication": "Pembrolizumab eligible"
        },
        "microsatelliteInstability": {
          "status": "MSS",
          "interpretation": "Microsatellite Stable"
        },
        "hrdScore": {
          "value": 48,
          "threshold": "≥42",
          "interpretation": "HRD-positive",
          "therapyImplication": "PARP inhibitor eligible"
        }
      },

      // Germline Findings
      "germlineFindings": [
        {
          "gene": "BRCA1",
          "variant": "c.5266dupC",
          "classification": "pathogenic",
          "inheritance": "autosomal dominant",
          "familyRisk": "First-degree relatives have 50% chance",
          "recommendation": "Genetic counseling recommended for family members"
        }
      ],

      // Therapy Matches
      "therapyMatches": {
        "fdaApproved": [
          {
            "therapy": "Olaparib",
            "gene": "BRCA1",
            "indication": "Ovarian Cancer",
            "evidenceLevel": "FDA-approved"
          },
          {
            "therapy": "Rucaparib",
            "gene": "BRCA1",
            "indication": "Ovarian Cancer",
            "evidenceLevel": "FDA-approved"
          },
          {
            "therapy": "Pembrolizumab",
            "biomarker": "TMB-High",
            "indication": "Solid tumors",
            "evidenceLevel": "FDA tissue-agnostic"
          }
        ],
        "clinicalTrials": [
          {
            "therapy": "PARP + Immunotherapy",
            "reasoning": "BRCA1 mutation + TMB-high"
          }
        ]
      },

      // Additional Clinical Context
      "clinicalSignificance": "Pathogenic BRCA1 mutation with HRD-positive status indicates high likelihood of response to PARP inhibitors",
      "recommendations": [
        "Consider PARP inhibitor therapy",
        "Genetic counseling for germline BRCA1",
        "Family members should consider testing",
        "Eligible for immunotherapy based on TMB-high status"
      ]
    }
  }
}
```

---

## Report-Specific Extraction Guidelines

### Foundation One / Foundation One CDx

**What to Extract:**
1. All genomic alterations (SNVs, indels, CNVs, fusions)
2. TMB score and interpretation
3. MSI status
4. Genomically-matched therapies (tiers 1-4)
5. Clinical trials matches
6. Germline variants (if reported)
7. Specimen information

**Example Section Mapping:**
- "Genomic Findings" → mutations array
- "Biomarkers" → biomarkers object
- "Therapy Matches" → therapyMatches object
- "Known Germline Variants" → germlineFindings array

### Guardant360

**What to Extract:**
1. Circulating tumor DNA (ctDNA) alterations
2. Variant allele frequency for each mutation
3. Copy number amplifications
4. Gene fusions
5. MSI status
6. Therapy matches
7. Blood draw date and collection info

**Key Difference:** Liquid biopsy - note in testInfo.specimenType: "Blood (ctDNA)"

### Tempus xT / Tempus xT (TOP - Tempus Ovarian Panel)

**Test Overview:**
- Tempus xT: 648-gene DNA panel + whole transcriptome RNA sequencing
- Tempus TOP: Ovarian cancer-specific panel with DNA + RNA analysis
- Combined tumor and germline analysis
- Comprehensive biomarker assessment

**What to Extract:**

**1. DNA Alterations (Somatic):**
- Point mutations (SNVs)
- Small insertions/deletions (indels)
- Copy number alterations (amplifications/deletions)
- Microsatellite instability (MSI)
- Tumor mutational burden (TMB)

**2. RNA Analysis:**
- Gene fusions (detected via RNA sequencing)
- Gene expression levels
- Splice variants
- HRD score (for ovarian/breast cancer)

**3. Germline Findings:**
- Pathogenic/likely pathogenic variants
- Separate section from somatic findings
- Family risk implications
- Genes: BRCA1, BRCA2, ATM, PALB2, RAD51C, RAD51D, BRIP1, etc.

**4. Immunotherapy Biomarkers:**
- TMB (mutations/megabase)
- MSI status (MSI-H, MSS)
- PD-L1 expression (if available)
- Immune infiltration markers

**5. Therapy Matches:**
- FDA-approved therapies
- NCCN-guided therapies
- Clinical trial matches (Tempus-specific trials)
- Off-label considerations

**6. Ovarian-Specific (Tempus TOP):**
- HRD score (essential for PARP inhibitor eligibility)
- Homologous recombination pathway genes
- Platinum sensitivity markers
- BRCA1/BRCA2 status (somatic + germline)

**Example Extraction for Tempus xT:**
```json
{
  "testInfo": {
    "testName": "Tempus xT",
    "laboratoryName": "Tempus Labs",
    "testDate": "2024-12-15",
    "specimenType": "FFPE tumor tissue",
    "tumorPurity": "65%",
    "genesCovered": 648
  },
  "mutations": [
    {
      "gene": "TP53",
      "alteration": "c.818G>A (p.Arg273His)",
      "significance": "pathogenic",
      "variantAlleleFrequency": 52.3,
      "mutationType": "somatic"
    },
    {
      "gene": "PIK3CA",
      "alteration": "E545K",
      "significance": "pathogenic",
      "variantAlleleFrequency": 38.2,
      "therapyImplication": "PI3K inhibitors",
      "fdaApprovedTherapy": "Alpelisib (breast cancer)"
    }
  ],
  "fusions": [
    {
      "fusion": "NTRK1-TPM3",
      "gene1": "NTRK1",
      "gene2": "TPM3",
      "significance": "pathogenic",
      "therapyImplication": "TRK inhibitors",
      "fdaApprovedTherapy": "Larotrectinib, Entrectinib",
      "source": "RNA sequencing"
    }
  ],
  "biomarkers": {
    "tumorMutationalBurden": {
      "value": 8.2,
      "unit": "mutations/megabase",
      "interpretation": "intermediate"
    },
    "microsatelliteInstability": {
      "status": "MSS"
    },
    "hrdScore": {
      "value": 52,
      "interpretation": "HRD-positive",
      "therapyEligible": "PARP inhibitors"
    }
  },
  "germlineFindings": [
    {
      "gene": "BRCA1",
      "variant": "c.5266dupC",
      "classification": "pathogenic",
      "inheritance": "autosomal dominant",
      "familyRisk": true,
      "counselingRecommended": true,
      "source": "germline analysis"
    }
  ]
}
```

**Example Extraction for Tempus TOP (Ovarian Panel):**
```json
{
  "testInfo": {
    "testName": "Tempus TOP (Ovarian Panel)",
    "laboratoryName": "Tempus Labs",
    "testDate": "2024-12-15",
    "specimenType": "FFPE tumor tissue",
    "tumorPurity": "70%",
    "panelType": "ovarian-specific"
  },
  "mutations": [
    {
      "gene": "BRCA1",
      "alteration": "c.5266dupC",
      "significance": "pathogenic",
      "variantAlleleFrequency": 45.2,
      "mutationType": "somatic",
      "therapyImplication": "PARP inhibitors",
      "fdaApprovedTherapy": "Olaparib, Rucaparib, Niraparib"
    },
    {
      "gene": "TP53",
      "alteration": "c.742C>T (p.Arg248Trp)",
      "significance": "pathogenic",
      "variantAlleleFrequency": 58.1,
      "mutationType": "somatic"
    }
  ],
  "copyNumberVariants": [
    {
      "gene": "CCNE1",
      "type": "amplification",
      "copyNumber": 8,
      "significance": "pathogenic",
      "clinicalNote": "Associated with platinum resistance"
    }
  ],
  "biomarkers": {
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
    },
    "tumorMutationalBurden": {
      "value": 6.8,
      "unit": "mutations/megabase",
      "interpretation": "low-intermediate"
    },
    "microsatelliteInstability": {
      "status": "MSS"
    }
  },
  "germlineFindings": [
    {
      "gene": "BRCA2",
      "variant": "c.5946delT",
      "classification": "pathogenic",
      "inheritance": "autosomal dominant",
      "familyRisk": true,
      "counselingRecommended": true,
      "ovarianCancerRisk": "15-40% lifetime risk",
      "breastCancerRisk": "45-85% lifetime risk"
    }
  ],
  "fdaApprovedTherapies": [
    "Olaparib (PARP inhibitor - HRD+)",
    "Rucaparib (PARP inhibitor - BRCA1/2)",
    "Niraparib (PARP inhibitor - HRD+)"
  ],
  "clinicalTrialEligible": true
}
```

**Key Tempus-Specific Features:**

1. **Dual Analysis:**
   - Tumor DNA sequencing (somatic mutations)
   - Germline DNA sequencing (inherited variants)
   - Clearly separate somatic vs germline findings

2. **RNA Sequencing:**
   - Gene fusions detected via RNA (not just DNA)
   - More sensitive fusion detection than DNA-only tests
   - Gene expression data (sometimes reported)

3. **HRD Score Detail:**
   - Tempus provides detailed HRD score breakdown
   - LOH (Loss of Heterozygosity)
   - TAI (Telomeric Allelic Imbalance)
   - LST (Large-scale State Transitions)
   - Combined score determines PARP inhibitor eligibility

4. **Ovarian-Specific Insights (TOP):**
   - Platinum sensitivity predictions
   - PARP inhibitor eligibility (HRD score)
   - Homologous recombination pathway gene status
   - CCNE1 amplification (platinum resistance marker)

5. **Clinical Trial Matching:**
   - Tempus has proprietary trial matching
   - Extract trial suggestions from report
   - Note Tempus-specific trial networks

### BRCA1/BRCA2 Testing (Germline)

**What to Extract:**
1. BRCA1 variant(s)
2. BRCA2 variant(s)
3. Classification (pathogenic, VUS, benign)
4. Inheritance pattern
5. Family testing recommendations
6. Risk assessment
7. Management recommendations

**Example:**
```json
{
  "germlineFindings": [
    {
      "gene": "BRCA1",
      "variant": "c.68_69delAG (p.Glu23Valfs*17)",
      "classification": "pathogenic",
      "inheritance": "autosomal dominant",
      "cancerRisks": {
        "ovarianCancer": "39-46% lifetime risk",
        "breastCancer": "55-72% lifetime risk"
      },
      "management": "Consider risk-reducing surgery, enhanced screening",
      "familyTesting": "First-degree relatives should be offered testing"
    }
  ]
}
```

### HRD Testing

**What to Extract:**
1. HRD score
2. LOH (Loss of Heterozygosity) score
3. TAI (Telomeric Allelic Imbalance) score
4. LST (Large-scale State Transitions) score
5. Overall HRD status (positive/negative)
6. BRCA1/BRCA2 status
7. Therapy implications (PARP inhibitors)

### MSI/MMR Testing

**What to Extract:**
1. MSI status (MSI-H, MSI-L, MSS)
2. MMR protein expression (MLH1, MSH2, MSH6, PMS2)
3. Immunotherapy eligibility
4. Lynch syndrome screening recommendation

---

## Trial Matching Implications

### How Genomic Data Enables Trial Matching

**1. Gene-Specific Trials:**
```
User has: BRCA1 pathogenic mutation
Search for: trials requiring "BRCA1" OR "BRCA1/2" OR "homologous recombination deficiency"
```

**2. Biomarker-Based Trials:**
```
User has: TMB-High (12.5 mut/Mb)
Search for: trials requiring "TMB ≥10" OR "high tumor mutational burden"
```

**3. Combination Criteria:**
```
User has: BRCA1 + TMB-High + MSS
Search for: trials combining PARP inhibitors + immunotherapy
```

**4. Exclusion Criteria:**
```
User has: TP53 mutation
Some trials exclude: TP53 wild-type required
```

### Standardized Gene Names for Trial Matching

Always use official HUGO Gene Nomenclature:
- ✅ "BRCA1" (not "brca1", "Brca1", "BRCA-1")
- ✅ "TP53" (not "p53", "tp53")
- ✅ "ERBB2" (not "HER2", though HER2 alias is acceptable)
- ✅ "PIK3CA" (not "PI3K")
- ✅ "KRAS" (not "K-RAS")

---

## Storage in Firestore

### Genomic Profile Document

```javascript
genomicProfiles/{userId}
{
  id: "{userId}",
  patientId: "{userId}",

  // Test Information
  testName: "FoundationOne CDx",
  testDate: Timestamp(2024-12-15),
  reportDate: Timestamp(2024-12-22),
  laboratoryName: "Foundation Medicine, Inc.",
  specimenType: "FFPE tumor tissue",

  // Mutations Array
  mutations: [
    {
      gene: "BRCA1",
      alteration: "c.5266dupC",
      significance: "pathogenic",
      vaf: 48.5,
      therapyImplication: "PARP inhibitors",
      fdaApprovedTherapy: ["Olaparib", "Rucaparib", "Niraparib"],
      trialEligible: true
    }
  ],

  // Biomarkers
  tumorMutationalBurden: {
    value: 12.5,
    unit: "mutations/megabase",
    interpretation: "high",
    therapyEligible: "Pembrolizumab"
  },

  microsatelliteStatus: "MSS",

  hrdScore: {
    value: 48,
    interpretation: "HRD-positive",
    therapyEligible: "PARP inhibitors"
  },

  // Germline
  germlineFindings: [
    {
      gene: "BRCA1",
      variant: "c.5266dupC",
      classification: "pathogenic",
      familyRisk: true,
      counselingRecommended: true
    }
  ],

  // Therapy Matches
  fdaApprovedTherapies: [
    "Olaparib",
    "Rucaparib",
    "Niraparib",
    "Pembrolizumab"
  ],

  // Clinical Trials Eligibility
  trialEligibleGenes: ["BRCA1"],
  trialEligibleBiomarkers: ["TMB-High", "HRD-Positive"],

  // Metadata
  createdAt: Timestamp,
  updatedAt: Timestamp,
  lastUpdated: Timestamp
}
```

---

## AI Prompt Enhancement for Genomic Reports

Update the document processor prompt to include detailed genomic extraction:

```javascript
const genomicPrompt = `
GENOMIC REPORT EXTRACTION:

You are analyzing a genomic/genetic test report. Extract ALL of the following information:

1. TEST INFORMATION:
   - Test name (e.g., FoundationOne CDx, Guardant360)
   - Laboratory name
   - Test date and report date
   - Specimen type (tissue, blood, liquid biopsy)
   - Tumor purity percentage
   - Coverage metrics

2. GENOMIC ALTERATIONS:
   For EACH mutation/alteration, extract:
   - Gene name (use official HUGO nomenclature: BRCA1, TP53, PIK3CA, etc.)
   - Specific alteration (e.g., c.5266dupC, p.Arg273His, E545K)
   - Alteration type (SNV, indel, CNV, fusion)
   - Variant Allele Frequency (VAF %)
   - Clinical significance (pathogenic, likely pathogenic, VUS, benign)
   - Therapy implications
   - FDA-approved therapies (if mentioned)
   - Trial eligibility relevance

3. BIOMARKERS:
   - Tumor Mutational Burden (TMB): value, unit, interpretation, threshold
   - Microsatellite Instability (MSI): status (MSI-H, MSI-L, MSS)
   - PD-L1 expression: value, method, interpretation
   - HRD Score: value, threshold, interpretation
   - Any other biomarkers mentioned

4. COPY NUMBER VARIANTS:
   - Gene name
   - Type (amplification, deletion)
   - Copy number value
   - Clinical significance

5. GENE FUSIONS:
   - Fusion name (e.g., EML4-ALK)
   - Partner genes
   - Clinical significance
   - Therapy implications

6. GERMLINE FINDINGS:
   - Gene and variant
   - Classification
   - Inheritance pattern
   - Family risk assessment
   - Recommendations for family testing

7. THERAPY MATCHES:
   - FDA-approved therapies with genes/biomarkers
   - Clinical trial suggestions
   - Off-label considerations
   - NCCN guideline recommendations

8. CLINICAL RECOMMENDATIONS:
   - Treatment recommendations
   - Genetic counseling recommendations
   - Family testing recommendations
   - Follow-up testing needs

IMPORTANT:
- Use standardized gene names (BRCA1, not brca1)
- Include ALL mutations, not just the most significant
- Extract exact numeric values (VAF, TMB, HRD scores)
- Preserve therapy-gene relationships
- Note FDA-approved vs investigational therapies
- Flag variants eligible for clinical trials
`;
```

---

## Chat Interface Genomic Updates

Users should also be able to add genomic findings via chat:

**Example:**
```
User: "Her Foundation One test showed BRCA1 mutation, TMB of 12, and MSI-stable"

AI extracts:
{
  "genomic": {
    "testName": "FoundationOne",
    "mutations": [{"gene": "BRCA1", "significance": "pathogenic"}],
    "tumorMutationalBurden": {"value": 12, "interpretation": "high"},
    "microsatelliteStatus": "MSS"
  }
}

Response: "✅ Updated genomic profile:
• BRCA1 mutation detected
• TMB: 12 mutations/Mb (High - eligible for immunotherapy)
• MSI: Stable

Treatment implications:
• PARP inhibitors (Olaparib, Rucaparib, Niraparib)
• Immunotherapy eligible (Pembrolizumab for TMB-high)
• Multiple clinical trial options available"
```

---

## Testing Genomic Extraction

### Test Case 1: Foundation One Report

1. Upload sample F1CDx report PDF
2. **Expected extraction:**
   - All mutations with VAF
   - TMB score and interpretation
   - MSI status
   - FDA-approved therapy matches
   - Clinical trial eligibility flags

### Test Case 2: BRCA Testing Report

1. Upload germline BRCA report
2. **Expected extraction:**
   - BRCA1/BRCA2 variants
   - Pathogenic classification
   - Family risk assessment
   - Genetic counseling recommendation

### Test Case 3: Guardant360 Liquid Biopsy

1. Upload Guardant360 report
2. **Expected extraction:**
   - ctDNA alterations
   - VAF for tracking over time
   - Therapy matches
   - Note "liquid biopsy" in specimen type

---

## Benefits for Clinical Trials

### Trial Matching Accuracy

**Before genomic extraction:**
- Manual review of reports
- Missed trial opportunities
- Inconsistent gene naming

**After genomic extraction:**
```javascript
// Automatic trial matching query
const matchingTrials = await searchTrials({
  genes: patient.genomicProfile.mutations.map(m => m.gene), // ["BRCA1", "TP53"]
  biomarkers: {
    tmb: patient.genomicProfile.tumorMutationalBurden.interpretation, // "high"
    msi: patient.genomicProfile.microsatelliteStatus, // "MSS"
    hrd: patient.genomicProfile.hrdScore.interpretation // "HRD-positive"
  },
  diagnosis: patient.diagnosis // "Ovarian Cancer"
});

// Results: Trials requiring BRCA1 + TMB-high + HRD-positive for ovarian cancer
```

---

## Summary

This protocol ensures comprehensive extraction of genomic data for:

1. ✅ **Accurate trial matching** - Standardized gene names and biomarkers
2. ✅ **Treatment guidance** - FDA-approved and investigational therapies
3. ✅ **Family risk assessment** - Germline findings and counseling needs
4. ✅ **Longitudinal tracking** - Monitor mutations over time with liquid biopsies
5. ✅ **Personalized care** - Therapy recommendations based on molecular profile

**Next Steps:**
1. Update document processor prompt with detailed genomic extraction
2. Test with sample genomic reports
3. Verify Firestore storage structure
4. Build trial matching algorithm using genomic data
5. Display genomic findings in UI (Profile or Health tab)
