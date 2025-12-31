/**
 * Firestore Collections Structure
 * 
 * This file defines all the collections and their data structures
 * for the Cancer Care Tracking application.
 */

// Collection names
export const COLLECTIONS = {
  PATIENTS: 'patients',
  LABS: 'labs',
  VITALS: 'vitals',
  MEDICATIONS: 'medications',
  MEDICATION_LOGS: 'medicationLogs',
  DOCUMENTS: 'documents',
  MESSAGES: 'messages',
  SYMPTOMS: 'symptoms',
  GENOMIC_PROFILES: 'genomicProfiles',
  EMERGENCY_CONTACTS: 'emergencyContacts',
  CLINICAL_TRIALS: 'clinicalTrials',
  MATCHED_TRIALS: 'matchedTrials',
  TRIAL_LOCATIONS: 'trialLocations'
};

/**
 * Patient Document Structure
 * Collection: patients
 * Document ID: patientId (e.g., 'mary')
 */
export const PatientSchema = {
  id: 'string', // Document ID
  name: 'string', // e.g., "Mary"
  age: 'number',
  diagnosis: 'string', // e.g., "Stage IIIC Ovarian Cancer"
  diagnosisDate: 'timestamp',
  currentTreatment: 'string',
  oncologist: 'string',
  hospital: 'string',
  createdAt: 'timestamp',
  updatedAt: 'timestamp',
  profileImage: 'string', // URL to profile image
  status: 'string' // e.g., "Active Treatment"
};

/**
 * Lab Data Structure
 * Collection: labs
 * Document ID: auto-generated
 * Subcollection: values (for historical data)
 */
export const LabSchema = {
  id: 'string', // Document ID
  patientId: 'string', // Reference to patient
  labType: 'string', // e.g., 'ca125', 'wbc', 'hemoglobin'
  name: 'string', // e.g., 'CA-125'
  unit: 'string', // e.g., 'U/mL'
  normalRange: 'string', // e.g., '<35'
  current: 'number', // Current value
  status: 'string', // 'normal', 'warning', 'critical'
  trend: 'string', // 'up', 'down', 'stable'
  createdAt: 'timestamp',
  updatedAt: 'timestamp'
};

/**
 * Lab Value (Historical Data)
 * Collection: labs/{labId}/values
 * Document ID: auto-generated
 */
export const LabValueSchema = {
  id: 'string',
  labId: 'string', // Reference to parent lab
  value: 'number',
  date: 'timestamp',
  notes: 'string',
  createdAt: 'timestamp'
};

/**
 * Vital Signs Structure
 * Collection: vitals
 * Document ID: auto-generated
 * Subcollection: values (for historical data)
 */
export const VitalSchema = {
  id: 'string',
  patientId: 'string',
  vitalType: 'string', // e.g., 'bp', 'hr', 'temp', 'weight', 'o2sat', 'rr'
  name: 'string', // e.g., 'Blood Pressure'
  unit: 'string', // e.g., 'mmHg', 'BPM', '°F', 'kg', '%', '/min'
  normalRange: 'string',
  current: 'string|number', // Can be string for BP (e.g., '128/82') or number
  systolic: 'number', // For BP only
  diastolic: 'number', // For BP only
  status: 'string', // 'normal', 'warning', 'critical'
  trend: 'string', // 'up', 'down', 'stable'
  createdAt: 'timestamp',
  updatedAt: 'timestamp'
};

/**
 * Vital Value (Historical Data)
 * Collection: vitals/{vitalId}/values
 * Document ID: auto-generated
 */
export const VitalValueSchema = {
  id: 'string',
  vitalId: 'string',
  value: 'number|string',
  systolic: 'number', // For BP only
  diastolic: 'number', // For BP only
  date: 'timestamp',
  notes: 'string',
  createdAt: 'timestamp'
};

/**
 * Medication Structure
 * Collection: medications
 * Document ID: auto-generated
 */
export const MedicationSchema = {
  id: 'string',
  patientId: 'string',
  name: 'string', // e.g., 'Paclitaxel'
  dosage: 'string', // e.g., '175 mg/m²'
  frequency: 'string', // e.g., 'Every 3 weeks'
  schedule: 'string', // e.g., 'IV infusion' or '8:00 AM, 8:00 PM'
  purpose: 'string', // e.g., 'Chemotherapy'
  nextDose: 'timestamp',
  color: 'string', // For UI display
  instructions: 'string',
  active: 'boolean',
  createdAt: 'timestamp',
  updatedAt: 'timestamp'
};

/**
 * Medication Log Structure
 * Collection: medicationLogs
 * Document ID: auto-generated
 */
export const MedicationLogSchema = {
  id: 'string',
  patientId: 'string',
  medId: 'string', // Reference to medication
  scheduledTime: 'string', // e.g., '8:00 AM'
  takenAt: 'timestamp',
  notes: 'string',
  createdAt: 'timestamp'
};

/**
 * Document Structure
 * Collection: documents
 * Document ID: auto-generated
 */
export const DocumentSchema = {
  id: 'string',
  patientId: 'string',
  name: 'string', // e.g., 'Lab Results - Dec 28, 2024'
  type: 'string', // 'Lab', 'Scan', 'Report', 'Genomic'
  date: 'timestamp',
  data: 'string', // Extracted text/data
  icon: 'string', // 'lab', 'scan', 'report', 'genomic'
  fileUrl: 'string', // URL to uploaded file in Storage
  fileType: 'string', // 'pdf', 'image', etc.
  extractedValues: 'object', // AI-extracted values
  createdAt: 'timestamp',
  updatedAt: 'timestamp'
};

/**
 * Message/Chat Structure
 * Collection: messages
 * Document ID: auto-generated
 */
export const MessageSchema = {
  id: 'string',
  patientId: 'string',
  type: 'string', // 'user' or 'ai'
  text: 'string',
  isAnalysis: 'boolean', // If AI extracted values
  extractedData: 'object', // Any extracted health data
  createdAt: 'timestamp'
};

/**
 * Symptom Structure
 * Collection: symptoms
 * Document ID: auto-generated
 */
export const SymptomSchema = {
  id: 'string',
  patientId: 'string',
  date: 'timestamp',
  type: 'string', // e.g., 'Fatigue', 'Pain', 'Nausea'
  severity: 'string', // 'Mild', 'Moderate', 'Severe'
  notes: 'string',
  createdAt: 'timestamp'
};

/**
 * Genomic Profile Structure
 * Collection: genomicProfiles
 * Document ID: patientId (one per patient)
 */
export const GenomicProfileSchema = {
  id: 'string', // Same as patientId
  patientId: 'string',
  brca1: 'string', // 'Positive', 'Negative', 'Unknown'
  brca2: 'string',
  tp53: 'string', // 'Wild-type', 'Mutated', 'Unknown'
  pik3ca: 'string',
  arid1a: 'string',
  pten: 'string',
  hrd: 'string', // e.g., 'HRD Positive (Score: 45)'
  hrdScore: 'number',
  msi: 'string', // 'MSS', 'MSI-H', 'Unknown'
  tmb: 'string', // e.g., 'Low (3 mutations/Mb)'
  tmbValue: 'number',
  pdL1: 'string', // e.g., 'Negative (<1%)'
  testType: 'string', // e.g., 'Foundation One CDx'
  testDate: 'timestamp',
  createdAt: 'timestamp',
  updatedAt: 'timestamp'
};

/**
 * Emergency Contact Structure
 * Collection: emergencyContacts
 * Document ID: patientId (one document per patient with subcollections)
 * Subcollection: contacts
 */
export const EmergencyContactSchema = {
  id: 'string',
  patientId: 'string',
  contactType: 'string', // 'oncologist', 'primaryCare', 'hospital', 'emergency'
  name: 'string',
  phone: 'string',
  email: 'string',
  address: 'string', // For hospital
  relation: 'string', // For emergency contact
  createdAt: 'timestamp',
  updatedAt: 'timestamp'
};

/**
 * Clinical Trial Structure
 * Collection: clinicalTrials
 * Document ID: auto-generated
 */
export const ClinicalTrialSchema = {
  id: 'string',
  patientId: 'string',
  trialId: 'string', // e.g., 'NCT05123456'
  name: 'string',
  location: 'string',
  distance: 'string', // e.g., '2.3 miles'
  match: 'string', // e.g., '92%'
  phase: 'string', // e.g., 'Phase II'
  status: 'string', // 'Recruiting', 'Active', etc.
  matchReasons: 'array', // ['BRCA1+', 'HRD+', 'Stage IIIC']
  locationData: 'object', // City, state, country, zip
  createdAt: 'timestamp',
  updatedAt: 'timestamp'
};

/**
 * Trial Location Preferences
 * Collection: trialLocations
 * Document ID: patientId (one per patient)
 */
export const TrialLocationSchema = {
  id: 'string', // Same as patientId
  patientId: 'string',
  city: 'string',
  state: 'string',
  country: 'string',
  zip: 'string',
  searchRadius: 'string', // e.g., '100' (miles/km)
  includeAllLocations: 'boolean',
  updatedAt: 'timestamp'
};



