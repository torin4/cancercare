# Firebase Setup Guide

This guide will help you set up Firebase for the Cancer Care Tracking application.

## Step 1: Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Add project" or select an existing project
3. Follow the setup wizard:
   - Enter project name (e.g., "cancercare")
   - Enable/disable Google Analytics (optional)
   - Click "Create project"

## Step 2: Enable Firestore Database

1. In Firebase Console, go to **Build** > **Firestore Database**
2. Click "Create database"
3. Choose **Production mode** (we'll set up security rules later)
4. Select a location closest to your users
5. Click "Enable"

## Step 3: Set Up Authentication (Optional but Recommended)

1. Go to **Build** > **Authentication**
2. Click "Get started"
3. Enable **Email/Password** sign-in method
4. (Optional) Enable other providers as needed

## Step 4: Set Up Storage (For Document Uploads)

1. Go to **Build** > **Storage**
2. Click "Get started"
3. Start in **Production mode**
4. Choose the same location as Firestore
5. Click "Done"

## Step 5: Get Your Firebase Configuration

1. In Firebase Console, click the gear icon ⚙️ next to "Project Overview"
2. Select **Project settings**
3. Scroll down to "Your apps" section
4. Click the **Web** icon (`</>`) to add a web app
5. Register your app (e.g., "CancerCare Web")
6. Copy the Firebase configuration object

## Step 6: Add Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Open `.env` and add your Firebase config values:
   ```
   REACT_APP_FIREBASE_API_KEY=AIzaSy...
   REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   REACT_APP_FIREBASE_PROJECT_ID=your-project-id
   REACT_APP_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789
   REACT_APP_FIREBASE_APP_ID=1:123456789:web:abc123
   ```

## Step 7: Install Firebase SDK

```bash
npm install firebase
```

## Step 8: Set Up Firestore Security Rules

1. In Firebase Console, go to **Build** > **Firestore Database** > **Rules**
2. Replace the default rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Patients collection - users can only access their own patient data
    match /patients/{patientId} {
      allow read, write: if request.auth != null && request.auth.uid == patientId;
    }
    
    // Labs - users can only access labs for their patient
    match /labs/{labId} {
      allow read, write: if request.auth != null;
      match /values/{valueId} {
        allow read, write: if request.auth != null;
      }
    }
    
    // Vitals - users can only access vitals for their patient
    match /vitals/{vitalId} {
      allow read, write: if request.auth != null;
      match /values/{valueId} {
        allow read, write: if request.auth != null;
      }
    }
    
    // Medications
    match /medications/{medId} {
      allow read, write: if request.auth != null;
    }
    
    // Medication Logs
    match /medicationLogs/{logId} {
      allow read, write: if request.auth != null;
    }
    
    // Documents
    match /documents/{docId} {
      allow read, write: if request.auth != null;
    }
    
    // Messages
    match /messages/{messageId} {
      allow read, write: if request.auth != null;
    }
    
    // Symptoms
    match /symptoms/{symptomId} {
      allow read, write: if request.auth != null;
    }
    
    // Genomic Profiles
    match /genomicProfiles/{profileId} {
      allow read, write: if request.auth != null && request.auth.uid == profileId;
    }
    
    // Emergency Contacts
    match /emergencyContacts/{contactId} {
      allow read, write: if request.auth != null;
    }
    
    // Clinical Trials
    match /clinicalTrials/{trialId} {
      allow read, write: if request.auth != null;
    }
    
    // Trial Locations
    match /trialLocations/{locationId} {
      allow read, write: if request.auth != null && request.auth.uid == locationId;
    }
  }
}
```

**Note:** For development, you can use more permissive rules, but **NEVER** deploy these to production:

```javascript
// DEVELOPMENT ONLY - NOT FOR PRODUCTION
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

## Step 9: Set Up Storage Security Rules

1. Go to **Build** > **Storage** > **Rules**
2. Add rules:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /documents/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Step 10: Create Firestore Indexes (If Needed)

Firestore will prompt you to create indexes when you run queries. Click the link in the error message to create them automatically.

Common indexes you might need:
- `labs` collection: `patientId` (Ascending) + `createdAt` (Descending)
- `vitals` collection: `patientId` (Ascending) + `createdAt` (Descending)
- `medications` collection: `patientId` (Ascending) + `active` (Ascending) + `createdAt` (Descending)
- `medicationLogs` collection: `patientId` (Ascending) + `takenAt` (Descending)

## Collections Structure

The app uses the following Firestore collections:

- **patients** - Patient information
- **labs** - Lab test data (with subcollection `values` for historical data)
- **vitals** - Vital signs (with subcollection `values` for historical data)
- **medications** - Medication list
- **medicationLogs** - Medication adherence logs
- **documents** - Uploaded documents (lab reports, scans, etc.)
- **messages** - AI chat conversation history
- **symptoms** - Symptom tracking entries
- **genomicProfiles** - Genomic test results
- **emergencyContacts** - Emergency contact information
- **clinicalTrials** - Matched clinical trials
- **trialLocations** - Trial search location preferences

## Testing the Setup

1. Start your development server:
   ```bash
   npm start
   ```

2. The app should connect to Firebase automatically
3. Check the browser console for any Firebase errors
4. Try adding a lab value or vital to test database writes

## Troubleshooting

### "Firebase: Error (auth/configuration-not-found)"
- Make sure all environment variables are set in `.env`
- Restart your development server after adding environment variables

### "Missing or insufficient permissions"
- Check your Firestore security rules
- Make sure you're authenticated (if using auth)

### "Index not found"
- Click the link in the error message to create the index
- Or go to Firestore > Indexes and create manually

## Next Steps

After Firebase is set up:
1. The app will automatically use Firebase for data persistence
2. All data will be stored in Firestore
3. Documents can be uploaded to Firebase Storage
4. Consider setting up authentication for multi-user support

