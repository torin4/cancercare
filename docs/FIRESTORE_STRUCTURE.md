# Firestore Database Structure

## What Gets Created When You Sign Up

When you create an account and log in, here's what automatically happens in Firebase:

### 1. Firebase Authentication
```
Authentication
└── Users
    └── {userId} (auto-generated)
        ├── email: "user@example.com"
        ├── displayName: "John Doe" (if using Google)
        └── uid: "abc123xyz..."
```

### 2. Firestore Database - Patient Profile
```
Firestore
└── patients
    └── {userId}
        ├── id: "abc123xyz..."
        ├── email: "user@example.com"
        ├── displayName: "Patient"
        ├── createdAt: Timestamp
        └── updatedAt: Timestamp
```

**This is created automatically on first login!**

---

## What Gets Created When You Add Data

### When You Chat: "CA-125 is 68"

**Firestore Structure:**
```
Firestore
└── labs
    └── {labId} (auto-generated)
        ├── id: "lab123"
        ├── patientId: "abc123xyz..."
        ├── labType: "ca125"
        ├── label: "CA-125"
        ├── currentValue: 68
        ├── unit: "U/mL"
        ├── normalRange: "0-35"
        ├── status: "high"
        ├── createdAt: Timestamp
        └── updatedAt: Timestamp

        └── values (subcollection)
            └── {valueId}
                ├── value: 68
                ├── date: Timestamp
                ├── notes: "Added via chat"
                └── createdAt: Timestamp
```

---

### When You Chat: "BP was 130/85"

**Firestore Structure:**
```
Firestore
└── vitals
    └── {vitalId} (auto-generated)
        ├── id: "vital123"
        ├── patientId: "abc123xyz..."
        ├── vitalType: "bp"
        ├── label: "Blood Pressure"
        ├── currentValue: "130/85"
        ├── unit: "mmHg"
        ├── normalRange: "90-120/60-80"
        ├── createdAt: Timestamp
        └── updatedAt: Timestamp

        └── values (subcollection)
            └── {valueId}
                ├── value: "130/85"
                ├── date: Timestamp
                ├── notes: "Added via chat"
                └── createdAt: Timestamp
```

---

### When You Upload a Lab Report PDF

**Multiple Collections Created:**

```
Firestore
├── documents
│   └── {docId}
│       ├── id: "doc123"
│       ├── patientId: "abc123xyz..."
│       ├── fileName: "lab-results.pdf"
│       ├── fileUrl: "https://firebasestorage.googleapis.com/..."
│       ├── storagePath: "documents/abc123xyz.../1735442400000_lab-results.pdf"
│       ├── fileSize: 245678
│       ├── fileType: "application/pdf"
│       ├── category: "Lab"
│       ├── documentType: "Lab"
│       └── date: Timestamp
│
├── labs (if CA-125 extracted)
│   └── {labId}
│       ├── patientId: "abc123xyz..."
│       ├── labType: "ca125"
│       ├── currentValue: 68
│       └── ... (full structure)
│
└── labs (if WBC extracted)
    └── {labId2}
        ├── patientId: "abc123xyz..."
        ├── labType: "wbc"
        ├── currentValue: 5.5
        └── ... (full structure)
```

**Firebase Storage:**
```
Storage
└── documents
    └── {userId}
        └── 1735442400000_lab-results.pdf (the actual file)
```

---

## Complete Firestore Collections

### All Possible Collections

Your Firestore database can have these collections:

```
Firestore Database
├── patients/{patientId}
├── labs/{labId}
│   └── values/{valueId} (subcollection)
├── vitals/{vitalId}
│   └── values/{valueId} (subcollection)
├── medications/{medId}
├── medicationLogs/{logId}
├── documents/{docId}
├── messages/{messageId}
├── symptoms/{symptomId}
├── genomicProfiles/{profileId}
├── emergencyContacts/{contactId}
├── clinicalTrials/{trialId}
└── trialLocations/{locationId}
```

---

## Example: New User Journey

### Step 1: Sign Up
```
Action: User signs up with email/password or Google

Created in Firebase:
✅ Authentication/Users/{userId}
✅ Firestore/patients/{userId}
```

### Step 2: First Chat Message
```
Action: User types "My CA-125 is 72"

Created in Firestore:
✅ labs/{labId}
   └── values/{valueId}
```

### Step 3: Upload Document
```
Action: User uploads "lab-report.pdf"

Created in Firebase:
✅ Storage/documents/{userId}/1234567890_lab-report.pdf
✅ Firestore/documents/{docId}
✅ Firestore/labs/{labId} (for each extracted value)
✅ Firestore/vitals/{vitalId} (if vitals in document)
```

### Step 4: View Health Screen
```
Action: User navigates to Health tab

Data Loaded From:
📊 Firestore/labs/* (all user's labs)
📊 Firestore/vitals/* (all user's vitals)
📊 Charts render with real data
```

---

## What You'll See in Firebase Console

### Firestore Database View

```
🗂 Firestore Database
  📁 patients
    📄 abc123xyz... (your user ID)

  📁 labs
    📄 lab_ca125_001
    📄 lab_wbc_002
    📄 lab_platelets_003

  📁 vitals
    📄 vital_bp_001
    📄 vital_hr_002

  📁 documents
    📄 doc_001
    📄 doc_002
```

### Storage View

```
🗂 Storage
  📁 documents
    📁 abc123xyz... (your user ID)
      📄 1735442400000_lab-report.pdf
      📄 1735442500000_scan-results.pdf
      📄 1735442600000_genomic-test.pdf
```

---

## Data Ownership & Security

### How Your Data is Protected

**Firestore Rules:**
```javascript
// Only you can read/write your own data
match /labs/{labId} {
  allow read: if resource.data.patientId == request.auth.uid;
  allow write: if request.resource.data.patientId == request.auth.uid;
}
```

**Storage Rules:**
```javascript
// Only you can access files in your folder
match /documents/{userId}/{allPaths=**} {
  allow read, write: if request.auth.uid == userId;
}
```

**Result:**
- ✅ You can ONLY see your own data
- ✅ Other users CANNOT see your data
- ✅ Unauthenticated users CANNOT access anything
- ✅ HIPAA-compliant data isolation

---

## Checking Your Data

### Via Firebase Console

1. **Go to:** https://console.firebase.google.com/project/cancercare-db3f9/firestore
2. **See Collections:**
   - `patients` - Your profile
   - `labs` - All your lab values
   - `vitals` - All your vital signs
   - `documents` - File metadata
3. **Click on any document to see full data**

### Via Storage Console

1. **Go to:** https://console.firebase.google.com/project/cancercare-db3f9/storage
2. **See Files:**
   - `documents/{yourUserId}/` - All your uploaded files
3. **Click to download or view**

---

## Sample Data After Using App

After using the app for a few days, your Firestore might look like:

```
Firestore
├── patients
│   └── abc123xyz
│       └── email: "john@example.com"
│
├── labs (12 documents)
│   ├── lab001 (CA-125: 68)
│   ├── lab002 (WBC: 5.5)
│   ├── lab003 (Hemoglobin: 11.2)
│   ├── lab004 (Platelets: 238)
│   └── ... (8 more)
│
├── vitals (5 documents)
│   ├── vital001 (BP: 130/85)
│   ├── vital002 (HR: 72)
│   ├── vital003 (Temp: 98.6)
│   └── ... (2 more)
│
├── documents (8 documents)
│   ├── doc001 (lab-results-dec-28.pdf)
│   ├── doc002 (ct-scan.pdf)
│   ├── doc003 (genomic-report.pdf)
│   └── ... (5 more)
│
└── symptoms (3 documents)
    ├── symptom001 (Nausea - moderate)
    ├── symptom002 (Fatigue - mild)
    └── symptom003 (Pain - mild)
```

**Total Documents: ~28**
**Total Collections: 4-5 active collections**

---

## Growth Over Time

As you use the app more:

- **Labs Collection:** Grows with each lab value (CA-125, WBC, etc.)
- **Vitals Collection:** Grows with each vital sign reading
- **Documents Collection:** One entry per file uploaded
- **Storage:** Grows with actual file storage

**Estimated Size:**
- 1 month of daily use: ~100 documents, ~50MB storage
- 6 months: ~500 documents, ~200MB storage
- 1 year: ~1000 documents, ~500MB storage

**Firebase Free Tier:**
- Firestore: 1GB storage (more than enough)
- Storage: 5GB storage (plenty for documents)
- Reads: 50K/day (way more than needed)

You'll stay well within free tier limits! 🎉
