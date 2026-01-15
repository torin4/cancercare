# Custom Labels: Document → Health Screen Flow

## YES! The App Fully Supports Custom Labels

Your app can:
1. ✅ **Search for ANY custom label** in uploaded documents
2. ✅ **Extract the values** automatically
3. ✅ **Save to Firestore** with the custom label
4. ✅ **Display in Health screen** immediately

**No configuration needed!**

---

## Complete Example: Custom Lab in Document

### Step 1: You Upload a Lab Report

**Document Contents:**
```
LABORATORY RESULTS
Patient: Jane Doe
Date: December 29, 2024

CA-125 (Tumor Marker)............ 68 U/mL      [High]
CEA (Carcinoembryonic Antigen)... 6.5 ng/mL    [High]
AFP (Alpha-Fetoprotein)........... 12.3 ng/mL   [Normal]
HE4 (Human Epididymis 4).......... 145 pmol/L   [High]
Inhibin B......................... 22 pg/mL     [Normal]
CA 19-9........................... 42 U/mL      [High]
```

### Step 2: AI Analyzes Document

**Gemini AI processes the document:**

```javascript
// AI extracts this JSON:
{
  "documentType": "Lab",
  "summary": "Tumor marker panel showing elevated CA-125, CEA, HE4, and CA 19-9",
  "data": {
    "labs": [
      {
        "labType": "ca125",
        "label": "CA-125",
        "value": 68,
        "unit": "U/mL",
        "date": "2024-12-29",
        "normalRange": "0-35",
        "status": "high"
      },
      {
        "labType": "cea",           // ← CUSTOM!
        "label": "CEA",
        "value": 6.5,
        "unit": "ng/mL",
        "date": "2024-12-29",
        "normalRange": "0-3",
        "status": "high"
      },
      {
        "labType": "afp",           // ← CUSTOM!
        "label": "AFP",
        "value": 12.3,
        "unit": "ng/mL",
        "date": "2024-12-29",
        "normalRange": "0-15",
        "status": "normal"
      },
      {
        "labType": "he4",           // ← CUSTOM!
        "label": "HE4",
        "value": 145,
        "unit": "pmol/L",
        "date": "2024-12-29",
        "normalRange": "0-70",
        "status": "high"
      },
      {
        "labType": "inhibinb",      // ← CUSTOM!
        "label": "Inhibin B",
        "value": 22,
        "unit": "pg/mL",
        "date": "2024-12-29",
        "normalRange": "10-273",
        "status": "normal"
      },
      {
        "labType": "ca199",         // ← CUSTOM!
        "label": "CA 19-9",
        "value": 42,
        "unit": "U/mL",
        "date": "2024-12-29",
        "normalRange": "0-37",
        "status": "high"
      }
    ]
  }
}
```

### Step 3: Saved to Firestore

**All 6 labs saved automatically:**

```
Firestore Database
└── labs
    ├── lab_001 (CA-125)     // Predefined
    ├── lab_002 (CEA)        // ← CUSTOM!
    ├── lab_003 (AFP)        // ← CUSTOM!
    ├── lab_004 (HE4)        // ← CUSTOM!
    ├── lab_005 (Inhibin B)  // ← CUSTOM!
    └── lab_006 (CA 19-9)    // ← CUSTOM!
```

**Each with full structure:**

```javascript
// Example: CEA in Firestore
labs/lab_002
{
  id: "lab_002",
  patientId: "user123",
  labType: "cea",                    // ← Custom type
  label: "CEA",                      // ← Custom label
  currentValue: 6.5,
  unit: "ng/mL",
  normalRange: "0-3",
  status: "high",
  createdAt: Timestamp(2024-12-29),
  updatedAt: Timestamp(2024-12-29)
}

// Subcollection: Value history
labs/lab_002/values/value_001
{
  value: 6.5,
  date: Timestamp(2024-12-29),
  notes: "Extracted from document",
  createdAt: Timestamp(2024-12-29)
}
```

### Step 4: Appears in Health Screen

**Lab Dropdown:**
```
┌────────────────────────┐
│ Select Lab Type      ▼ │
├────────────────────────┤
│ CA-125                 │
│ CEA                ✓   │ ← CUSTOM!
│ AFP                    │ ← CUSTOM!
│ HE4                    │ ← CUSTOM!
│ Inhibin B              │ ← CUSTOM!
│ CA 19-9                │ ← CUSTOM!
│ WBC                    │
│ Hemoglobin             │
└────────────────────────┘
```

**Lab Cards (Grid View):**
```
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│  CA-125     │ │  CEA        │ │  AFP        │
│  68 U/mL    │ │  6.5 ng/mL  │ │  12.3 ng/mL │
│  ⬆ High     │ │  ⬆ High     │ │  ✓ Normal   │
└─────────────┘ └─────────────┘ └─────────────┘

┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│  HE4        │ │  Inhibin B  │ │  CA 19-9    │
│  145 pmol/L │ │  22 pg/mL   │ │  42 U/mL    │
│  ⬆ High     │ │  ✓ Normal   │ │  ⬆ High     │
└─────────────┘ └─────────────┘ └─────────────┘
```

**Chart View (when selecting CEA):**
```
CEA Trend
↑
7 |                    ●
  |
6 |
  |
5 |
  |
4 |
  └─────────────────────────→
   Dec 29

Current: 6.5 ng/mL
Range: 0-3 ng/mL
Status: High ⬆
```

### Step 5: Chat Confirmation

**User sees in chat:**
```
✅ Document processed successfully!

Document Type: Lab

📊 Extracted 6 lab value(s):
  • CA-125: 68 U/mL (high)
  • CEA: 6.5 ng/mL (high)
  • AFP: 12.3 ng/mL (normal)
  • HE4: 145 pmol/L (high)
  • Inhibin B: 22 pg/mL (normal)
  • CA 19-9: 42 U/mL (high)

All data has been automatically saved to your health records.
```

---

## How AI Finds Custom Labels

### Label Recognition

The AI uses medical knowledge to recognize:

**1. Common abbreviations:**
- CEA, AFP, PSA, LDH, CRP, ESR
- CA 19-9, CA 15-3, CA 27-29
- HCG, TSH, T3, T4, PTH

**2. Full names:**
- "Carcinoembryonic Antigen" → CEA
- "Alpha-Fetoprotein" → AFP
- "Prostate-Specific Antigen" → PSA

**3. Alternative spellings:**
- "CA125" or "CA-125" or "CA 125" → ca125
- "CA19-9" or "CA 19-9" → ca199

**4. Contextual clues:**
```
Document says: "Tumor Marker Panel"
                "CEA........... 6.5 ng/mL"

AI understands:
- This is a lab result
- CEA is a tumor marker
- 6.5 is the value
- ng/mL is the unit
- Creates: { labType: "cea", label: "CEA", ... }
```

---

## Real-World Examples

### Example 1: Comprehensive Metabolic Panel

**Document:**
```
COMPREHENSIVE METABOLIC PANEL
Glucose............... 95 mg/dL
BUN................... 18 mg/dL
Creatinine............ 0.9 mg/dL
Sodium................ 140 mmol/L
Potassium............. 4.2 mmol/L
Chloride.............. 102 mmol/L
CO2................... 24 mmol/L
Calcium............... 9.5 mg/dL
Total Protein......... 7.2 g/dL
Albumin............... 4.5 g/dL
Total Bilirubin....... 0.8 mg/dL
ALT................... 28 U/L
AST................... 32 U/L
```

**AI Extracts: 13 values!**

All appear in Health screen:
- Glucose ← Custom
- BUN ← Custom
- Creatinine (predefined)
- Sodium ← Custom
- Potassium ← Custom
- Chloride ← Custom
- CO2 ← Custom
- Calcium ← Custom
- Total Protein ← Custom
- Albumin ← Custom
- Bilirubin ← Custom
- ALT (predefined)
- AST (predefined)

### Example 2: Thyroid Panel

**Document:**
```
THYROID FUNCTION TESTS
TSH..................... 2.5 mIU/L
Free T4................. 1.2 ng/dL
Free T3................. 3.1 pg/mL
Thyroid Peroxidase Ab... 15 IU/mL
```

**AI Extracts: 4 thyroid values**

All saved as:
```javascript
{ labType: "tsh", label: "TSH", ... }
{ labType: "t4", label: "Free T4", ... }
{ labType: "t3", label: "Free T3", ... }
{ labType: "tpoab", label: "Thyroid Peroxidase Ab", ... }
```

All appear in Health screen dropdown and charts!

### Example 3: Cardiac Panel

**Document:**
```
CARDIAC BIOMARKERS
Troponin I.............. 0.04 ng/mL
CK-MB................... 3.5 ng/mL
BNP..................... 125 pg/mL
Pro-BNP................. 450 pg/mL
```

**AI Extracts: 4 cardiac markers**

All become custom labs in your system!

---

## Label Normalization

### How AI Creates labType from labels

**Rules:**
1. Lowercase everything
2. Remove spaces and special characters
3. Keep alphanumeric only

**Examples:**

| Document Label | labType Created | Display Label |
|----------------|-----------------|---------------|
| CA-125 | ca125 | CA-125 |
| CEA | cea | CEA |
| CA 19-9 | ca199 | CA 19-9 |
| Free T4 | t4 | Free T4 |
| Vitamin B12 | vitaminb12 | Vitamin B12 |
| Beta-2 Microglobulin | beta2microglobulin | Beta-2 Microglobulin |

---

## What Gets Extracted

### Automatically Detected

For each lab value, AI extracts:

✅ **Label** - Display name (e.g., "CEA", "AFP")
✅ **Value** - Numerical result (e.g., 6.5)
✅ **Unit** - Measurement unit (e.g., "ng/mL")
✅ **Normal Range** - Reference range (e.g., "0-3")
✅ **Status** - high/normal/low (auto-calculated)
✅ **Date** - Test date (from document or current date)

### Example Extraction

**From this line in document:**
```
CEA (Carcinoembryonic Antigen)... 6.5 ng/mL    [High]  (Ref: 0-3)
```

**AI extracts:**
```javascript
{
  labType: "cea",
  label: "CEA",
  value: 6.5,
  unit: "ng/mL",
  normalRange: "0-3",
  status: "high",
  date: "2024-12-29"
}
```

---

## Health Screen Integration

### Dynamic Display

**Code that makes it work:**

```javascript
// Health screen automatically shows all labs
Object.keys(allLabData).map(key => (
  <option key={key} value={key}>
    {allLabData[key].name}  // Shows custom labels!
  </option>
))

// Result:
// - CA-125 ← Shows up
// - CEA ← Shows up (custom!)
// - AFP ← Shows up (custom!)
// - Any other lab ← Shows up!
```

**No hardcoded lists! All labs appear automatically.**

---

## Testing Custom Labels

### Test 1: Upload Lab Report

```
1. Create a text file: "lab-results.txt"
2. Add custom labs:
   CEA: 5.2 ng/mL
   AFP: 8.1 ng/mL
   CA 19-9: 35 U/mL
3. Upload to app
4. Check:
   ✅ Chat shows extraction
   ✅ Firestore has 3 new labs
   ✅ Health screen shows all 3
   ✅ Charts work for all 3
```

### Test 2: Comprehensive Panel

```
1. Upload real lab report PDF
2. AI extracts ALL values (10-20+ labs)
3. All appear in Health screen
4. All have charts
5. All track over time
```

### Test 3: Uncommon Lab

```
1. Upload report with obscure value:
   "Chromogranin A: 85 ng/mL"
2. AI extracts it
3. Saves as custom lab
4. Shows in Health screen
5. Works perfectly!
```

---

## Benefits

✅ **Unlimited lab types** - Track anything
✅ **No maintenance** - AI handles extraction
✅ **No configuration** - Works out of the box
✅ **Future-proof** - New biomarkers automatically work
✅ **Patient-specific** - Each patient can have different labs
✅ **Comprehensive tracking** - Full history for all values

---

## Summary

**YES! Your app can:**

1. ✅ Search for ANY custom label in documents
2. ✅ Extract values automatically using AI
3. ✅ Save to Firestore with custom labType
4. ✅ Display in Health screen immediately
5. ✅ Create charts for custom values
6. ✅ Track trends over time
7. ✅ Handle unlimited custom labels

**No configuration, no maintenance, just works!** 🎉
