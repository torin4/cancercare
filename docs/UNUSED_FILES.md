# Unused Files in CancerCare App

This document lists files that are not currently being used in the application and can potentially be removed.

## Confirmed Unused Files

### 1. Backup Files
- **`src/App.js.bak`** - Backup file, not imported anywhere
- **`src/services/clinicalTrials/trialSearchService.js.bak`** - Backup file, not imported anywhere

### 2. Example/Demo Files
- **`src/components/FileUploadExample.jsx`** - Example component, not imported or used anywhere in the app

### 3. Duplicate Files
- **`src/components/DocumentUploadOnboarding.js`** - Duplicate of `src/components/modals/DocumentUploadOnboarding.js`. Only the modals version is used throughout the app.

### 4. Unused Components
- **`src/components/modals/ConfirmationModal.js`** - Generic confirmation modal that is not imported anywhere. The app uses `DeletionConfirmationModal.js` instead.

### 5. Unused Firebase Utilities
- **`src/firebase/hooks.js`** - Contains custom React hooks (usePatient, useLabs, useVitals, etc.) that are not imported anywhere. The app uses Context providers (AuthContext, PatientContext, HealthContext) instead.
- **`src/firebase/initData.js`** - Data initialization utility functions for development/testing. Not imported anywhere in the production app.

### 6. Utility Services (Potentially Unused)
- **`src/services/orphanedDataCleanup.js`** - Contains `findOrphanedValuesForDate` function. Not directly imported anywhere. The `documentCleanupService.js` has its own `runFullOrphanedCleanup` function that doesn't use this file. This appears to be unused.

## Files That Are Used

The following files ARE being used and should NOT be removed:
- `src/components/DateTimePicker.js` - Used in AddVitalModal and AddVitalValueModal
- `src/components/modals/EditLabModal.js` - Used in HealthTab
- All other modals, tabs, contexts, and services are actively used

## Recommendation

Before deleting, verify:
1. Check if `orphanedDataCleanup.js` functions are called via `documentCleanupService.js`
2. Confirm `initData.js` is not needed for any setup scripts
3. Review if `hooks.js` might be useful for future development

## Safe to Delete Immediately

- `src/App.js.bak`
- `src/services/clinicalTrials/trialSearchService.js.bak`
- `src/components/FileUploadExample.jsx`
- `src/components/DocumentUploadOnboarding.js` (duplicate)
- `src/components/modals/ConfirmationModal.js` (if not planning to use generic confirmation modals)

