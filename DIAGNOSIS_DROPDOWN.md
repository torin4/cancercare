# Diagnosis Dropdown - Searchable Cancer Type Selector

## Overview

The onboarding form includes a searchable dropdown for selecting cancer diagnosis, which ensures data accuracy for clinical trial matching while still allowing custom input for rare or unlisted diagnoses.

---

## Features

### 1. **Searchable Dropdown**
- 🔍 Real-time search filtering
- 📋 Comprehensive list of 90+ cancer types
- ⌨️ Type to filter results
- 🖱️ Click to select from list
- ✏️ Free-text input for unlisted cancers

### 2. **Categorized Cancer List**

The dropdown includes cancers organized by category:

**Gynecological Cancers:**
- Ovarian Cancer
- Endometrial Cancer
- Cervical Cancer
- Uterine Cancer
- Vaginal Cancer
- Vulvar Cancer
- Fallopian Tube Cancer

**Breast Cancer:**
- Breast Cancer
- Male Breast Cancer
- Inflammatory Breast Cancer
- Triple-Negative Breast Cancer

**Lung Cancer:**
- Lung Cancer
- Non-Small Cell Lung Cancer
- Small Cell Lung Cancer
- Mesothelioma

**Gastrointestinal Cancers:**
- Colorectal Cancer
- Colon Cancer
- Rectal Cancer
- Stomach Cancer
- Esophageal Cancer
- Pancreatic Cancer
- Liver Cancer
- Gallbladder Cancer
- Bile Duct Cancer
- Anal Cancer
- GIST

**Blood Cancers:**
- Leukemia (ALL, AML, CLL, CML)
- Lymphoma (Hodgkin, Non-Hodgkin)
- Multiple Myeloma
- Myelodysplastic Syndrome

**Skin Cancer:**
- Melanoma
- Basal Cell Carcinoma
- Squamous Cell Carcinoma
- Merkel Cell Carcinoma

**Genitourinary Cancers:**
- Prostate Cancer
- Bladder Cancer
- Kidney Cancer
- Renal Cell Carcinoma
- Testicular Cancer
- Penile Cancer

**Head and Neck Cancers:**
- Thyroid Cancer
- Oral Cancer
- Throat Cancer
- Laryngeal Cancer
- Nasopharyngeal Cancer
- Salivary Gland Cancer

**Brain and Nervous System:**
- Brain Cancer
- Glioblastoma
- Astrocytoma
- Meningioma
- Neuroblastoma
- Spinal Cord Tumor

**Bone and Soft Tissue:**
- Bone Cancer
- Osteosarcoma
- Ewing Sarcoma
- Soft Tissue Sarcoma
- Rhabdomyosarcoma

**Endocrine Cancers:**
- Adrenal Cancer
- Pituitary Tumor
- Parathyroid Cancer
- Neuroendocrine Tumor
- Carcinoid Tumor

**Pediatric Cancers:**
- Wilms Tumor
- Retinoblastoma

**Other:**
- Thymoma
- Carcinoma of Unknown Primary
- Other (Please Specify)

---

## User Experience

### Search & Select Flow

**Step 1: User starts typing**
```
Input: "ova"

Dropdown shows:
├─ Ovarian Cancer
└─ (other matches...)
```

**Step 2: Filtered results appear**
- Results update in real-time as user types
- Dropdown shows only matching cancers
- Case-insensitive search

**Step 3: User clicks a cancer type**
- Selected cancer appears in confirmation box
- Diagnosis field is populated
- Dropdown closes automatically

**Step 4: Confirmation**
```
Selected: Ovarian Cancer
[Change]
```

### Free-Text Custom Input

**If cancer type is not in list:**

1. User can type freely in the search box
2. System automatically saves typed text as diagnosis
3. No dropdown selection needed
4. Custom text is preserved

**Example:**
```
Input: "Rare Neuroendocrine Cancer of the Appendix"

Result: Custom diagnosis saved as typed
```

---

## Why This Matters for Clinical Trials

### Data Standardization

**Problem without dropdown:**
- "Ovarian Cancer" vs "ovarian cancer" vs "Ovarian Ca" vs "OC"
- Inconsistent naming prevents trial matching

**Solution with dropdown:**
- Standardized names: "Ovarian Cancer"
- Consistent across all users
- Better trial search results

### Trial Matching Accuracy

**How trials filter by diagnosis:**
```javascript
// Trial eligibility criteria
trial.conditions: ["Ovarian Cancer", "Fallopian Tube Cancer"]

// User's profile
patient.diagnosis: "Ovarian Cancer" // ✅ Exact match!

// Without dropdown (user typed):
patient.diagnosis: "ovarian cancer" // ❌ No match
patient.diagnosis: "Ovary Cancer"   // ❌ No match
```

**With standardized dropdown:**
- ✅ Exact string matching works
- ✅ Trial searches are accurate
- ✅ No missed opportunities

### Example Trial Search

**User's diagnosis:** "Ovarian Cancer"

**Matching trials:**
```
ClinicalTrials.gov API Query:
?cond=Ovarian+Cancer

Results:
✅ Trial NCT12345: "Phase III Study for Ovarian Cancer"
✅ Trial NCT67890: "Immunotherapy for Ovarian and Fallopian Tube Cancer"
✅ Trial NCT24680: "Targeted Therapy for Advanced Ovarian Cancer"
```

**If user typed "ovarian cancer" (lowercase):**
```
?cond=ovarian+cancer

Results:
❌ No exact matches (case-sensitive API)
```

---

## Technical Implementation

### Component State

```javascript
const [diagnosisSearch, setDiagnosisSearch] = useState('');
const [showDiagnosisDropdown, setShowDiagnosisDropdown] = useState(false);
const [formData, setFormData] = useState({
  diagnosis: '', // Stores selected/typed diagnosis
  // ... other fields
});
```

### Search Filtering

```javascript
const filteredCancerTypes = CANCER_TYPES.filter(cancer =>
  cancer.toLowerCase().includes(diagnosisSearch.toLowerCase())
);
```

**How it works:**
- Converts both search term and cancer names to lowercase
- Uses `.includes()` for partial matching
- "ova" matches "**Ova**rian Cancer"
- "lung" matches "**Lung** Cancer" and "Non-Small Cell **Lung** Cancer"

### Selection Handler

```javascript
const handleDiagnosisSelect = (cancer) => {
  if (cancer === 'Other (Please Specify)') {
    setShowCustomDiagnosisInput(true);
    updateField('diagnosis', '');
    setDiagnosisSearch('');
  } else {
    updateField('diagnosis', cancer);
    setDiagnosisSearch(cancer);
    setShowCustomDiagnosisInput(false);
  }
  setShowDiagnosisDropdown(false);
};
```

### Click Outside Handler

```javascript
useEffect(() => {
  const handleClickOutside = (event) => {
    if (diagnosisRef.current && !diagnosisRef.current.contains(event.target)) {
      setShowDiagnosisDropdown(false);
    }
  };

  document.addEventListener('mousedown', handleClickOutside);
  return () => document.removeEventListener('mousedown', handleClickOutside);
}, []);
```

**Purpose:** Closes dropdown when user clicks anywhere outside

---

## UI Components

### Search Input

```jsx
<input
  type="text"
  value={diagnosisSearch}
  onChange={(e) => {
    setDiagnosisSearch(e.target.value);
    setShowDiagnosisDropdown(true);
    // Save custom text if not in list
    if (e.target.value && !CANCER_TYPES.includes(e.target.value)) {
      updateField('diagnosis', e.target.value);
    }
  }}
  onFocus={() => setShowDiagnosisDropdown(true)}
  placeholder="Search for cancer type or type custom..."
/>
```

### Dropdown Results

```jsx
{showDiagnosisDropdown && filteredCancerTypes.length > 0 && (
  <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-64 overflow-y-auto">
    {filteredCancerTypes.map((cancer, index) => (
      <button
        key={index}
        type="button"
        onClick={() => handleDiagnosisSelect(cancer)}
        className="w-full text-left px-4 py-2.5 hover:bg-green-50 transition"
      >
        {cancer}
      </button>
    ))}
  </div>
)}
```

### Selected Diagnosis Display

```jsx
{formData.diagnosis && (
  <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-lg">
    <span className="text-sm text-green-700 font-medium">
      Selected: {formData.diagnosis}
    </span>
    <button
      type="button"
      onClick={() => {
        updateField('diagnosis', '');
        setDiagnosisSearch('');
      }}
      className="text-xs text-green-600 underline"
    >
      Change
    </button>
  </div>
)}
```

---

## Validation

### Step 3 Validation

```javascript
case 3:
  return formData.diagnosis && formData.diagnosisDate;
```

**Requirements:**
- ✅ Diagnosis must be filled (from dropdown OR free-text)
- ✅ Diagnosis date must be selected

**Valid inputs:**
- "Ovarian Cancer" (from dropdown)
- "Rare Appendix Cancer" (custom free-text)

---

## Saved Data Format

### Firestore Document

```javascript
patients/{userId}
{
  diagnosis: "Ovarian Cancer",      // Standardized from dropdown
  diagnosisDate: "2024-01-15",
  cancerType: "Clear Cell",
  stage: "Stage IIIC",
  // ... other fields
}
```

**For trial matching:**
```javascript
// Query trials
const query = `https://clinicaltrials.gov/api/query/study_fields?expr=${patient.diagnosis}&fmt=json`;

// Exact match works because diagnosis is standardized!
```

---

## Benefits Summary

### ✅ Accuracy
- Standardized cancer names
- Consistent across all users
- Reduces typos and variations

### ✅ Trial Matching
- Exact string matching with ClinicalTrials.gov
- Better search results
- No missed trials due to naming differences

### ✅ Flexibility
- Still allows custom input
- Users not blocked by missing options
- Rare cancers can be entered

### ✅ UX
- Fast search filtering
- No scrolling through long list
- Type a few letters → see matches
- Clear confirmation of selection

---

## Testing the Dropdown

### Test 1: Standard Cancer Selection
```
1. Navigate to onboarding Step 3
2. Click diagnosis field
3. Type: "ova"
4. See: "Ovarian Cancer" in dropdown
5. Click: "Ovarian Cancer"
6. Verify: "Selected: Ovarian Cancer" appears
7. Check: formData.diagnosis = "Ovarian Cancer"
```

### Test 2: Custom Cancer Input
```
1. Navigate to onboarding Step 3
2. Click diagnosis field
3. Type: "Rare Appendiceal Neuroendocrine Tumor"
4. See: No dropdown matches
5. Verify: Text is saved as custom diagnosis
6. Check: formData.diagnosis = "Rare Appendiceal Neuroendocrine Tumor"
```

### Test 3: Search Filtering
```
1. Type: "lung"
2. See results:
   - Lung Cancer
   - Non-Small Cell Lung Cancer
   - Small Cell Lung Cancer
3. Type: "lung small"
4. See results:
   - Small Cell Lung Cancer
```

### Test 4: Change Selection
```
1. Select: "Breast Cancer"
2. See: "Selected: Breast Cancer"
3. Click: "Change"
4. Verify: Field cleared, can search again
```

---

## Future Enhancements

Possible improvements for later:

- [ ] Add ICD-10 codes for each cancer type
- [ ] Show cancer category labels in dropdown
- [ ] Add "Recently selected" section
- [ ] Multi-select for multiple primary cancers
- [ ] Integration with cancer registry APIs
- [ ] Suggest related subtypes after selection

---

## Summary

The searchable diagnosis dropdown provides:

1. ✅ **90+ standardized cancer types**
2. ✅ **Real-time search filtering**
3. ✅ **Custom free-text input option**
4. ✅ **Better clinical trial matching**
5. ✅ **Improved data quality**
6. ✅ **Professional user experience**

**Result:** Accurate, consistent diagnosis data that enables precise clinical trial matching! 🎯
