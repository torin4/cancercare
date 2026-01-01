# Lab Value Categories and Descriptions Checklist

**Last Updated:** Based on normalization system implementation

## System Overview
The lab value system now uses a **normalization pipeline** that:
- Maps all variations to canonical keys (e.g., `CA-125`, `ca125`, `CA 125` → `ca125`)
- Uses canonical keys for descriptions (one description per lab type)
- Provides consistent display names across the app
- Handles case-insensitive matching automatically

---

## Disease-Specific Markers
**Category Description:** Tumor markers and cancer-specific biomarkers used to monitor disease progression and treatment response

**Canonical Keys with Descriptions:**
- ✅ `ca125` - CA-125 (Ovarian cancer marker)
- ✅ `ca199` - CA 19-9 (Pancreatic/GI cancers)
- ✅ `ca153` - CA 15-3 (Breast cancer marker)
- ✅ `ca724` - CA 72-4 (Gastrointestinal cancers)
- ✅ `ca242` - CA 242 (Pancreatic/Colorectal cancers)
- ✅ `ca50` - CA 50 (Pancreatic/GI cancers)
- ✅ `ca2729` - CA 27-29 (Breast cancer marker)
- ✅ `cea` - CEA (Colorectal/Lung cancers)
- ✅ `afp` - AFP (Liver cancer/Germ cell tumors)
- ✅ `psa` - PSA (Prostate cancer)
- ✅ `he4` - HE4 (Ovarian cancer biomarker)
- ✅ `inhibinb` - Inhibin B (Ovarian cancer)
- ✅ `romaindex` - ROMA Index (Ovarian cancer risk)
- ✅ `scc_antigen` - SCC Antigen (Squamous cell carcinomas)
- ✅ `cyfra211` - CYFRA 21-1 (Non-small cell lung cancer)
- ✅ `nse` - NSE (Neuroendocrine tumors/Small cell lung cancer)
- ✅ `betahcg` - Beta-hCG (Germ cell tumors/Trophoblastic disease)

**Variations Handled:** All case variations, spacing, hyphens (e.g., `CA-125`, `ca125`, `CA 125`)

---

## Blood Counts
**Category Description:** Complete blood count (CBC) components including white cells, red cells, and platelets

**Canonical Keys with Descriptions:**
- ✅ `wbc` - White Blood Cell Count
- ✅ `rbc` - Red Blood Cell Count
- ✅ `hemoglobin` - Hemoglobin
- ✅ `hematocrit` - Hematocrit
- ✅ `platelets` - Platelets
- ✅ `anc` - Absolute Neutrophil Count
- ✅ `neutrophils_abs` - Neutrophil Absolute Count
- ✅ `neutrophils_pct` - Neutrophil Percentage
- ✅ `lymphocytes_abs` - Lymphocyte Absolute Count
- ✅ `lymphocytes_pct` - Lymphocyte Percentage
- ✅ `monocytes_abs` - Monocyte Absolute Count
- ✅ `monocytes_pct` - Monocyte Percentage
- ✅ `eosinophils_abs` - Eosinophil Absolute Count
- ✅ `eosinophils_pct` - Eosinophil Percentage
- ✅ `basophils_abs` - Basophil Absolute Count
- ✅ `basophils_pct` - Basophil Percentage
- ✅ `mcv` - Mean Corpuscular Volume
- ✅ `mch` - Mean Corpuscular Hemoglobin
- ✅ `mchc` - Mean Corpuscular Hemoglobin Concentration
- ✅ `rdw` - Red Cell Distribution Width
- ✅ `rdw_cv` - RDW-CV (Coefficient of Variation)
- ✅ `mpv` - Mean Platelet Volume
- ✅ `nrbc` - Nucleated Red Blood Cells
- ✅ `nrbc_pct` - NRBC Percentage
- ✅ `reticulocyte_count` - Reticulocyte Count
- ✅ `reticulocyte_pct` - Reticulocyte Percentage

**Variations Handled:** HGB, HCT, PLT, NEUTRO#, NEUTRO%, LYMPH#, LYMPH%, MONO#, MONO%, EO#, EO%, BA#, BA%, etc.

---

## Liver Function
**Category Description:** Enzymes and proteins that assess liver health and detect liver damage or dysfunction

**Canonical Keys with Descriptions:**
- ✅ `alt` - ALT (Alanine Aminotransferase)
- ✅ `ast` - AST (Aspartate Aminotransferase)
- ✅ `ast_alt_ratio` - AST/ALT Ratio
- ✅ `alp` - ALP (Alkaline Phosphatase)
- ✅ `alp_ifcc` - ALP (IFCC method)
- ✅ `bilirubin_total` - Total Bilirubin
- ✅ `bilirubin_direct` - Direct Bilirubin (Conjugated)
- ✅ `bilirubin_indirect` - Indirect Bilirubin (Unconjugated)
- ✅ `albumin` - Albumin
- ✅ `ggt` - GGT (Gamma-glutamyl Transferase)
- ✅ `ldh` - LDH (Lactate Dehydrogenase)

**Variations Handled:** ALB, T-Bil, Total Bilirubin, LD, LD IFCC, etc.

---

## Kidney Function
**Category Description:** Markers that evaluate kidney health and filtration capacity

**Canonical Keys with Descriptions:**
- ✅ `creatinine` - Creatinine
- ✅ `egfr` - eGFR (Estimated Glomerular Filtration Rate)
- ✅ `bun` - BUN (Blood Urea Nitrogen)
- ✅ `urea` - Urea
- ✅ `urineprotein` - Urine Protein
- ✅ `urinecreatinine` - Urine Creatinine

**Variations Handled:** CRE, etc.

---

## Thyroid Function
**Category Description:** Hormones and markers that assess thyroid gland function and metabolism

**Canonical Keys with Descriptions:**
- ✅ `tsh` - TSH (Thyroid-Stimulating Hormone)
- ✅ `t3` - T3 (Triiodothyronine)
- ✅ `t4` - T4 (Thyroxine)
- ✅ `ft3` - Free T3
- ✅ `ft4` - Free T4
- ✅ `thyroglobulin` - Thyroglobulin

**Variations Handled:** Free T3, Free T4, etc.

---

## Cardiac Markers
**Category Description:** Biomarkers used to detect heart damage, heart failure, or cardiac events

**Canonical Keys with Descriptions:**
- ✅ `troponin` - Troponin
- ✅ `bnp` - BNP (B-type Natriuretic Peptide)
- ✅ `ntprobnp` - NT-proBNP
- ✅ `ckmb` - CK-MB (Creatine Kinase-MB)
- ✅ `myoglobin` - Myoglobin

**Variations Handled:** NT-proBNP, CK-MB, etc.

---

## Inflammation
**Category Description:** Markers that indicate inflammation, infection, or immune system activity

**Canonical Keys with Descriptions:**
- ✅ `crp` - CRP (C-Reactive Protein)
- ✅ `esr` - ESR (Erythrocyte Sedimentation Rate)
- ✅ `ferritin` - Ferritin
- ✅ `il6` - IL-6 (Interleukin-6)

**Variations Handled:** フェリチン (Japanese), etc.

---

## Electrolytes
**Category Description:** Essential minerals and salts that maintain fluid balance and cellular function

**Canonical Keys with Descriptions:**
- ✅ `sodium` - Sodium
- ✅ `potassium` - Potassium
- ✅ `chloride` - Chloride
- ✅ `bicarbonate` - Bicarbonate
- ✅ `co2` - CO2 (Carbon Dioxide)
- ✅ `magnesium` - Magnesium
- ✅ `phosphorus` - Phosphorus
- ✅ `calcium` - Calcium
- ✅ `calcium_ionized` - Ionized Calcium (Ca²⁺)
- ✅ `phosphate` - Phosphate

**Variations Handled:** NA, K, CI, CA, Mg, P, Phos, etc.

---

## Coagulation
**Category Description:** Tests that evaluate blood clotting function and bleeding risk

**Canonical Keys with Descriptions:**
- ✅ `pt` - PT (Prothrombin Time)
- ✅ `inr` - INR (International Normalized Ratio)
- ✅ `aptt` - APTT (Activated Partial Thromboplastin Time)
- ✅ `ddimer` - D-dimer
- ✅ `fdp` - FDP (Fibrin Degradation Products)
- ✅ `fibrinogen` - Fibrinogen
- ✅ `antithrombin_iii` - Antithrombin III
- ✅ `protein_c` - Protein C
- ✅ `protein_s` - Protein S

**Variations Handled:** PT活性値, PT Activity, D-ダイマー, Fbg, etc.

---

## Others
**Category Description:** Additional lab values that don't fit into other categories

**Canonical Keys with Descriptions:**
- ✅ `glucose` - Glucose
- ✅ `hba1c` - HbA1c (Hemoglobin A1c)
- ✅ `iga` - IgA (Immunoglobulin A)
- ✅ `igg` - IgG (Immunoglobulin G)
- ✅ `igm` - IgM (Immunoglobulin M)
- ✅ `vitamin_d` - Vitamin D
- ✅ `beta2_microglobulin` - Beta-2 Microglobulin
- ✅ `procalcitonin` - Procalcitonin

**Variations Handled:** GLU, 血糖 (Japanese), etc.

---

## Custom Values
**Category Description:** User-added lab values not in standard categories

**Note:** Custom values are manually added by users and don't have predefined descriptions. They are stored with user-provided names and will appear in this category.

---

## Summary

### Categories
- **Total Categories:** 10 (including Custom Values and Others)
- **All categories have:** Descriptions, Icons, and proper categorization logic

### Lab Values
- **Total Canonical Keys:** ~80+ unique lab types
- **Total Descriptions:** ~80+ (one per canonical key)
- **Variations Handled:** Hundreds of variations (case, spacing, hyphens, abbreviations, Japanese names)

### Normalization System
- ✅ **Synonym Mapping:** All variations map to canonical keys
- ✅ **Display Names:** Consistent user-friendly names
- ✅ **Descriptions:** One description per lab type (using canonical keys)
- ✅ **Categorization:** Automatic categorization using normalized keys
- ✅ **Tooltips:** All lab values with descriptions show tooltips

### Key Features
1. **Case-Insensitive:** All matching is case-insensitive
2. **Variation Handling:** Handles spaces, hyphens, underscores, abbreviations
3. **International Support:** Handles Japanese names (e.g., フェリチン, PT活性値, D-ダイマー)
4. **Consistent Display:** All lab names use standardized display format
5. **No Duplicates:** One description per lab type eliminates duplicates

### Recent Additions
- MPV, NRBC, NRBC Percentage, Reticulocyte Count/Percentage (Blood Counts)
- Direct/Indirect Bilirubin (Liver Function)
- Ionized Calcium, Phosphate (Electrolytes)
- Antithrombin III, Protein C, Protein S (Coagulation)
- CA 27-29, SCC Antigen, CYFRA 21-1, NSE, Beta-hCG (Disease-Specific Markers)
- Beta-2 Microglobulin, Procalcitonin, IL-6 (Others/Inflammation)

---

## Notes

1. **Normalization:** The system automatically normalizes all lab names to canonical keys before lookup, so variations don't need separate descriptions.

2. **Custom Values:** User-added labs that don't match any known category go to "Custom Values" if manually added, or "Others" if extracted from documents.

3. **Tooltips:** All lab values with descriptions show an info button (ℹ️) that displays the description in a popup tooltip.

4. **Dropdown:** The "Add Lab Value" dropdown includes all categories with their descriptions for easy selection.
