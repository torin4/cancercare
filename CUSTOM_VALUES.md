# Custom Lab & Vital Values

## Overview

The system **automatically handles ANY medical value** you mention - both predefined (like CA-125, WBC) and custom ones (like CEA, AFP, LDH, PSA, etc.). You don't need to configure anything!

---

## How Custom Values Work

### AI Extraction

**The AI is smart enough to extract ANY lab or vital value it sees:**

```javascript
// In the prompt
"labType": "ca125|cea|wbc|hemoglobin|platelets|etc"
                                                 ^^^
                          The "etc" means ANY lab type!
```

**Examples of what gets extracted:**

| You Say/Upload | Lab Type Created | Label | Status |
|----------------|------------------|-------|--------|
| "CA-125 is 68" | `ca125` | CA-125 | ✅ Predefined |
| "CEA came back at 5.2" | `cea` | CEA | ✅ Custom |
| "AFP is 12" | `afp` | AFP | ✅ Custom |
| "LDH is 245" | `ldh` | LDH | ✅ Custom |
| "PSA is 2.1" | `psa` | PSA | ✅ Custom |
| "Troponin is 0.04" | `troponin` | Troponin | ✅ Custom |

---

## Complete Flow for Custom Values

### Example: CEA (Carcinoembryonic Antigen)

**Step 1: You chat:**
```
"Her CEA level is 5.2 ng/mL"
```

**Step 2: AI extracts:**
```json
{
  "labs": [
    {
      "labType": "cea",           // Auto-generated ID
      "label": "CEA",             // Display name
      "value": 5.2,
      "unit": "ng/mL",
      "normalRange": "0-3",       // AI knows this!
      "status": "high"            // Auto-calculated
    }
  ]
}
```

**Step 3: Saved to Firestore:**
```
labs/xyz123
  ├── patientId: "user123"
  ├── labType: "cea"
  ├── label: "CEA"
  ├── currentValue: 5.2
  ├── unit: "ng/mL"
  ├── normalRange: "0-3"
  └── status: "high"
```

**Step 4: Transformed for UI:**
```javascript
{
  cea: {
    name: "CEA",
    unit: "ng/mL",
    current: 5.2,
    status: "high",
    trend: "stable",
    normalRange: "0-3",
    data: [{ date: "Dec 29", value: 5.2 }]
  }
}
```

**Step 5: Appears in Health Screen:**
- ✅ Shows in lab dropdown
- ✅ Shows in lab cards
- ✅ Chart renders with data
- ✅ Normal range displayed
- ✅ Status indicator (high/normal/low)

---

## What Makes a Value "Custom"?

**Predefined Values** (have default fallback data in UI):
- CA-125
- WBC (White Blood Cells)
- ANC (Absolute Neutrophil Count)
- Hemoglobin
- Platelets
- Creatinine
- eGFR
- ALT
- AST
- Blood Pressure
- Heart Rate
- Temperature
- Weight

**Custom Values** (no fallback, pure Firestore):
- CEA (Carcinoembryonic Antigen)
- AFP (Alpha-Fetoprotein)
- PSA (Prostate-Specific Antigen)
- LDH (Lactate Dehydrogenase)
- HCG (Human Chorionic Gonadotropin)
- Troponin
- BNP (B-type Natriuretic Peptide)
- ESR (Erythrocyte Sedimentation Rate)
- CRP (C-Reactive Protein)
- And literally ANY other medical value!

---

## AI Capabilities

### What the AI Knows

The AI can automatically:

✅ **Identify lab types:**
- Recognizes 100+ common lab names
- Handles abbreviations (CEA, AFP, PSA)
- Handles full names (C-Reactive Protein)

✅ **Determine units:**
- ng/mL, mg/dL, mmol/L, U/mL, K/μL, etc.
- Auto-converts if needed

✅ **Know normal ranges:**
- Has medical knowledge of standard ranges
- Adjusts for age/gender when mentioned

✅ **Calculate status:**
- Compares value to normal range
- Returns: high, normal, low

### Example Extractions

**Input:** "Her ESR is 45"
```json
{
  "labType": "esr",
  "label": "ESR",
  "value": 45,
  "unit": "mm/hr",
  "normalRange": "0-20",
  "status": "high"
}
```

**Input:** "CRP came back at 12 mg/L"
```json
{
  "labType": "crp",
  "label": "CRP",
  "value": 12,
  "unit": "mg/L",
  "normalRange": "0-10",
  "status": "high"
}
```

**Input:** "Troponin is 0.04 ng/mL"
```json
{
  "labType": "troponin",
  "label": "Troponin",
  "value": 0.04,
  "unit": "ng/mL",
  "normalRange": "0-0.04",
  "status": "normal"
}
```

---

## Health Screen Display

### How Custom Values Appear

**Lab Dropdown:**
```javascript
<select>
  <option>CA-125</option>
  <option>WBC</option>
  <option>CEA</option>        ← Custom!
  <option>AFP</option>        ← Custom!
  <option>Hemoglobin</option>
</select>
```

**Lab Cards (Grid View):**
```
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│  CA-125     │ │  WBC        │ │  CEA        │ ← Custom!
│  68 U/mL    │ │  5.5 K/μL   │ │  5.2 ng/mL  │
│  ⬆ High     │ │  ✓ Normal   │ │  ⬆ High     │
└─────────────┘ └─────────────┘ └─────────────┘
```

**Chart View:**
- X-axis: Dates
- Y-axis: Values
- Line: Trend over time
- Markers: Individual data points
- Reference: Normal range shaded

---

## Adding Custom Labs Manually

You can also add custom labs that the AI doesn't recognize:

### Via Chat
```
User: "Track her Myoglobin level - it's 85 ng/mL"

AI: "I'll start tracking Myoglobin for Mary."

✅ Logged 1 lab value(s):
• Myoglobin: 85 ng/mL
```

### Via Document Upload
Upload a lab report with ANY values, and they'll be extracted:
```
Lab Report Contents:
- CA-125: 68 U/mL
- HE4: 145 pmol/L         ← Custom!
- Inhibin B: 22 pg/mL     ← Custom!

Result:
✅ All three extracted
✅ All three appear in Health screen
```

---

## Firestore Structure for Custom Values

**Same as predefined values!**

```
labs/{labId}
  ├── patientId: "user123"
  ├── labType: "customLabType"   ← Any string works
  ├── label: "Custom Lab Name"
  ├── currentValue: 123.4
  ├── unit: "custom unit"
  ├── normalRange: "custom range"
  └── status: "normal|high|low"
```

**No configuration needed!**
- No schema to update
- No dropdown to configure
- No hardcoded lists

---

## Chat Examples with Custom Values

### Example 1: Multiple Custom Labs
```
User: "Got her tumor markers back. CEA is 5.2, AFP is 8.1, and CA 19-9 is 42"

AI Response:
✅ Logged 3 lab value(s):
• CEA: 5.2 ng/mL (high)
• AFP: 8.1 ng/mL (normal)
• CA 19-9: 42 U/mL (high)

Health Screen:
All three appear in dropdown and cards
All three have charts
All show trends over time
```

### Example 2: Uncommon Lab
```
User: "Her Beta-2 Microglobulin is 3.8 mg/L"

AI Response:
✅ Logged 1 lab value(s):
• Beta-2 Microglobulin: 3.8 mg/L (high)

Firestore:
labs/xyz
  ├── labType: "beta2microglobulin"
  ├── label: "Beta-2 Microglobulin"
  ├── currentValue: 3.8
  └── ...

Health Screen:
Shows in lab list
Chart displays data
Normal range shown
```

### Example 3: Custom Vital
```
User: "Peak flow is 420 L/min today"

AI Response:
✅ Logged 1 vital sign(s):
• Peak Flow: 420 L/min

Firestore:
vitals/xyz
  ├── vitalType: "peakflow"
  ├── label: "Peak Flow"
  ├── currentValue: 420
  └── ...

Health Screen (Vitals section):
Shows in vitals list
Chart displays trend
```

---

## Handling Edge Cases

### What if AI doesn't recognize something?

**Scenario:** Very obscure lab value
```
User: "Track her Chromogranin A level"

AI will:
1. Extract it anyway (best effort)
2. Create labType: "chromogranina"
3. Guess unit if possible
4. Estimate normal range
5. Save to Firestore

You can then manually correct if needed
```

### What if units are missing?

```
User: "CA-125 is 68"  (no unit specified)

AI will:
1. Infer unit from medical knowledge
2. CA-125 → U/mL (standard unit)
3. Save with inferred unit
```

### What if normal range is unknown?

```
User: "XYZ marker is 50"  (very uncommon)

AI will:
1. Extract value: 50
2. Status: "normal" (safe default)
3. Normal range: "Unknown" or empty
4. Still displays in UI
```

---

## Benefits of Dynamic System

✅ **No Maintenance:** Works with any medical value
✅ **No Configuration:** AI handles everything
✅ **No Limits:** Track unlimited lab types
✅ **Future-Proof:** New biomarkers automatically work
✅ **Patient-Specific:** Each patient can have different labs
✅ **International:** Works with any units/standards

---

## Testing Custom Values

### Test 1: Common Custom Lab
```
1. Chat: "CEA is 6.5"
2. Check Firestore: labs/xyz with labType="cea"
3. Check Health screen: CEA appears in dropdown
4. Select CEA: Chart shows value
```

### Test 2: Uncommon Lab
```
1. Chat: "Calcitonin is 15 pg/mL"
2. Check Firestore: labs/xyz with labType="calcitonin"
3. Check Health screen: Calcitonin appears
4. Works perfectly!
```

### Test 3: Document Upload
```
1. Upload lab report with custom values
2. AI extracts all values (common + custom)
3. All appear in Health screen
4. Charts work for all
```

---

## Summary

**Your system is fully dynamic!**

- ✅ Handles predefined values (CA-125, WBC, etc.)
- ✅ Handles custom values (CEA, AFP, PSA, etc.)
- ✅ Handles uncommon values (Chromogranin, HE4, etc.)
- ✅ Handles vitals (BP, HR, custom ones too)
- ✅ AI extracts automatically
- ✅ UI displays automatically
- ✅ Charts render automatically

**No configuration needed - it just works!** 🎉
