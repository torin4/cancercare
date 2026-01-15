# AI-Powered Document Processing

## Overview

The app now automatically processes uploaded medical documents using Gemini AI to:
1. **Identify document type** (Lab, Scan, Report, Genomic, Vitals, Medication)
2. **Extract medical data** (lab values, vitals, mutations, medications, etc.)
3. **Save to Firestore** (appropriate collections based on data type)
4. **Update UI** (data appears in Health screen automatically)

## How It Works

### Upload Flow

```
User clicks upload button
    ↓
File picker opens
    ↓
User selects file (PDF, image, etc.)
    ↓
[1] AI analyzes document
    ↓
[2] Extracts structured data
    ↓
[3] Saves to Firestore collections
    ↓
[4] Uploads file to Storage
    ↓
[5] Shows extraction summary
```

### Data Extraction

The AI extracts and maps data to your Firestore collections:

**Lab Results** → `labs` collection
- CA-125, CEA, WBC, Hemoglobin, Platelets, etc.
- Automatically creates lab entries and value history

**Vitals** → `vitals` collection
- Blood Pressure, Heart Rate, Temperature, Weight, Oxygen
- Creates vital entries with timestamps

**Genomic Tests** → `genomicProfiles` collection
- Mutations (BRCA1, TP53, etc.)
- Tumor Mutational Burden (TMB)
- Microsatellite Status (MSI-H/MSS)
- HRD Score

**Medications** → `medications` collection
- Drug name, dosage, frequency
- Start date, active status

**Imaging/Scans** → `documents` collection
- Scan type, body part, findings
- Radiologist impressions

## Example Extraction

**Input:** Lab report PDF with:
```
CA-125: 68 U/mL
WBC: 5.5 K/μL
Platelets: 238 K/μL
```

**Output:**
```javascript
{
  documentType: "Lab",
  data: {
    labs: [
      {
        labType: "ca125",
        label: "CA-125",
        value: 68,
        unit: "U/mL",
        normalRange: "0-35",
        status: "high"
      },
      {
        labType: "wbc",
        label: "WBC",
        value: 5.5,
        unit: "K/μL",
        normalRange: "4-11",
        status: "normal"
      }
    ]
  }
}
```

**Saved to Firestore:**
- `labs/abc123` - CA-125 entry
- `labs/abc123/values/xyz` - Value: 68
- `labs/def456` - WBC entry
- `labs/def456/values/xyz` - Value: 5.5

**User sees:**
- Data appears in Health > Labs tab
- Chart updates with new values
- Trend analysis available

## Supported File Types

- **PDF** (.pdf)
- **Images** (.jpg, .jpeg, .png)
- **Documents** (.doc, .docx)

## Document Types Recognized

1. **Lab Results**
   - Blood work, tumor markers
   - Chemistry panels
   - Kidney/liver function tests

2. **Imaging/Scans**
   - CT, MRI, PET scans
   - X-rays, ultrasounds

3. **Clinical Reports**
   - Progress notes
   - Consultation notes
   - Treatment summaries

4. **Genomic Tests**
   - Foundation One
   - Guardant360
   - BRCA testing
   - Mutation panels

5. **Vital Signs**
   - Blood pressure
   - Heart rate
   - Temperature, weight

6. **Medications**
   - Prescriptions
   - Medication lists

## AI Model

- **Model:** Gemini 2.0 Flash Exp
- **Provider:** Google AI
- **Capabilities:**
  - Multimodal (text + images)
  - Medical terminology understanding
  - Structured data extraction

## Environment Variables

Make sure your `.env` file has:

```env
GEMINI_API_KEY=your_api_key_here
```

## Error Handling

If document processing fails:
- File is **not** uploaded
- User sees error message
- Can retry upload
- No partial data saved

## Privacy & Security

- All processing happens via secure API
- Files uploaded to Firebase Storage (encrypted)
- Firestore security rules enforce user isolation
- No data shared between users
- HIPAA-compliant architecture

## Testing

To test document processing:

1. Log in to the app
2. Click any upload button (Lab, Scan, etc.)
3. Select a medical document
4. Wait for processing (may take 5-10 seconds)
5. Check extraction summary in chat
6. Verify data in Health screen

## Future Enhancements

- [ ] Support for handwritten notes
- [ ] Multi-page document processing
- [ ] Batch upload
- [ ] Custom extraction templates
- [ ] Integration with EHR systems
