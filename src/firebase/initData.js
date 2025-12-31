/**
 * Data Initialization Utility
 * 
 * This file contains helper functions to initialize Firebase with default data
 * or migrate existing local data to Firebase.
 */

import { Timestamp } from 'firebase/firestore';
import {
  patientService,
  labService,
  vitalService,
  medicationService,
  medicationLogService,
  documentService,
  messageService,
  symptomService,
  genomicProfileService,
  emergencyContactService,
  clinicalTrialService,
  trialLocationService
} from './services';

// Convert date string to Firestore Timestamp
const toTimestamp = (dateString) => {
  if (!dateString) return Timestamp.now();
  const date = new Date(dateString);
  return Timestamp.fromDate(date);
};

// Convert date string to Firestore Timestamp (for date fields)
const parseDate = (dateStr) => {
  // Handle formats like "Dec 28", "Oct 15", etc.
  if (!dateStr) return Timestamp.now();
  
  // If it's already a full date string like "2024-12-28", use it directly
  if (dateStr.includes('-') && dateStr.length > 10) {
    return toTimestamp(dateStr);
  }
  
  // Otherwise, assume current year and parse month/day
  const months = {
    'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
    'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
  };
  
  const parts = dateStr.split(' ');
  if (parts.length === 2) {
    const month = months[parts[0]];
    const day = parseInt(parts[1]);
    const year = new Date().getFullYear();
    const date = new Date(year, month, day);
    return Timestamp.fromDate(date);
  }
  
  return Timestamp.now();
};

/**
 * Initialize patient data
 */
export const initPatient = async (patientId = 'mary', patientData = {}) => {
  const defaultPatient = {
    id: patientId,
    name: 'Mary',
    age: 58,
    diagnosis: 'Stage IIIC Ovarian Cancer',
    diagnosisDate: toTimestamp('2024-09-15'),
    currentTreatment: 'Paclitaxel + Bevacizumab',
    oncologist: 'Dr. Sarah Chen',
    hospital: 'Seattle Cancer Center',
    status: 'Active Treatment',
    ...patientData
  };

  await patientService.savePatient(patientId, defaultPatient);
  return defaultPatient;
};

/**
 * Initialize lab data
 */
export const initLabs = async (patientId = 'mary', labData = {}) => {
  const defaultLabs = {
    ca125: {
      labType: 'ca125',
      name: 'CA-125',
      unit: 'U/mL',
      current: 62,
      status: 'warning',
      trend: 'up',
      normalRange: '<35',
      data: [
        { date: 'Oct 15', value: 38 },
        { date: 'Oct 29', value: 42 },
        { date: 'Nov 12', value: 45 },
        { date: 'Nov 26', value: 47 },
        { date: 'Dec 1', value: 48 },
        { date: 'Dec 8', value: 51 },
        { date: 'Dec 15', value: 53 },
        { date: 'Dec 20', value: 55 },
        { date: 'Dec 28', value: 62 }
      ]
    },
    wbc: {
      labType: 'wbc',
      name: 'WBC',
      unit: 'K/μL',
      current: 5.8,
      status: 'normal',
      trend: 'stable',
      normalRange: '4.5-11.0',
      data: [
        { date: 'Nov 12', value: 6.5 },
        { date: 'Dec 1', value: 6.3 },
        { date: 'Dec 15', value: 6.0 },
        { date: 'Dec 20', value: 6.2 },
        { date: 'Dec 28', value: 5.8 }
      ]
    },
    // Add more labs as needed...
    ...labData
  };

  const labIds = {};
  
  for (const [key, lab] of Object.entries(defaultLabs)) {
    const { data, ...labInfo } = lab;
    const labId = await labService.saveLab({
      ...labInfo,
      patientId
    });
    
    // Add historical values
    if (data && Array.isArray(data)) {
      for (const value of data) {
        await labService.addLabValue(labId, {
          value: value.value,
          date: parseDate(value.date),
          notes: value.notes || ''
        });
      }
    }
    
    labIds[key] = labId;
  }

  return labIds;
};

/**
 * Initialize vitals data
 */
export const initVitals = async (patientId = 'mary', vitalsData = {}) => {
  const defaultVitals = {
    bp: {
      vitalType: 'bp',
      name: 'Blood Pressure',
      unit: 'mmHg',
      current: '128/82',
      systolic: 128,
      diastolic: 82,
      status: 'normal',
      trend: 'stable',
      normalRange: '<140/90',
      data: [
        { date: 'Oct 15', value: 122, systolic: 122, diastolic: 78 },
        { date: 'Nov 12', value: 126, systolic: 126, diastolic: 80 },
        { date: 'Dec 20', value: 125, systolic: 125, diastolic: 81 },
        { date: 'Dec 28', value: 128, systolic: 128, diastolic: 82 }
      ]
    },
    hr: {
      vitalType: 'hr',
      name: 'Heart Rate',
      unit: 'BPM',
      current: 72,
      status: 'normal',
      trend: 'stable',
      normalRange: '60-100',
      data: [
        { date: 'Oct 15', value: 68 },
        { date: 'Nov 12', value: 70 },
        { date: 'Dec 20', value: 74 },
        { date: 'Dec 28', value: 72 }
      ]
    },
    // Add more vitals as needed...
    ...vitalsData
  };

  const vitalIds = {};
  
  for (const [key, vital] of Object.entries(defaultVitals)) {
    const { data, ...vitalInfo } = vital;
    const vitalId = await vitalService.saveVital({
      ...vitalInfo,
      patientId
    });
    
    // Add historical values
    if (data && Array.isArray(data)) {
      for (const value of data) {
        await vitalService.addVitalValue(vitalId, {
          value: value.value,
          systolic: value.systolic,
          diastolic: value.diastolic,
          date: parseDate(value.date),
          notes: value.notes || ''
        });
      }
    }
    
    vitalIds[key] = vitalId;
  }

  return vitalIds;
};

/**
 * Initialize medications
 */
export const initMedications = async (patientId = 'mary', medications = []) => {
  const defaultMedications = [
    {
      name: 'Paclitaxel',
      dosage: '175 mg/m²',
      frequency: 'Every 3 weeks',
      schedule: 'IV infusion',
      purpose: 'Chemotherapy',
      nextDose: toTimestamp('2025-01-05'),
      color: 'purple',
      instructions: 'Administered at infusion center',
      active: true
    },
    {
      name: 'Bevacizumab',
      dosage: '15 mg/kg',
      frequency: 'Every 3 weeks',
      schedule: 'IV infusion',
      purpose: 'Targeted therapy',
      nextDose: toTimestamp('2025-01-05'),
      color: 'blue',
      instructions: 'Given with Paclitaxel',
      active: true
    },
    {
      name: 'Ondansetron',
      dosage: '8 mg',
      frequency: 'Twice daily',
      schedule: '8:00 AM, 8:00 PM',
      purpose: 'Anti-nausea',
      nextDose: toTimestamp('2024-12-28T20:00:00'),
      color: 'green',
      instructions: 'Take with or without food',
      active: true
    },
    {
      name: 'Dexamethasone',
      dosage: '4 mg',
      frequency: 'Daily',
      schedule: '9:00 AM',
      purpose: 'Anti-inflammatory',
      nextDose: toTimestamp('2024-12-29T09:00:00'),
      color: 'orange',
      instructions: 'Take with food to reduce stomach upset',
      active: true
    },
    {
      name: 'Omeprazole',
      dosage: '20 mg',
      frequency: 'Daily',
      schedule: '8:00 AM',
      purpose: 'Stomach protection',
      nextDose: toTimestamp('2024-12-29T08:00:00'),
      color: 'teal',
      instructions: 'Take 30 minutes before breakfast',
      active: true
    },
    ...medications
  ];

  const medIds = [];
  for (const med of defaultMedications) {
    const id = await medicationService.saveMedication({
      ...med,
      patientId
    });
    medIds.push(id);
  }

  return medIds;
};

/**
 * Initialize medication logs
 */
export const initMedicationLogs = async (patientId = 'mary', medIds = [], logs = []) => {
  const defaultLogs = [
    { medId: medIds[2], scheduledTime: '8:00 AM', takenAt: toTimestamp('2024-12-28T08:05:00') },
    { medId: medIds[4], scheduledTime: '8:00 AM', takenAt: toTimestamp('2024-12-28T08:03:00') },
    { medId: medIds[3], scheduledTime: '9:00 AM', takenAt: toTimestamp('2024-12-28T09:02:00') },
    ...logs
  ];

  const logIds = [];
  for (const log of defaultLogs) {
    if (log.medId) {
      const id = await medicationLogService.addMedicationLog({
        ...log,
        patientId
      });
      logIds.push(id);
    }
  }

  return logIds;
};

/**
 * Initialize genomic profile
 */
export const initGenomicProfile = async (patientId = 'mary', profileData = {}) => {
  const defaultProfile = {
    brca1: 'Positive',
    brca2: 'Negative',
    tp53: 'Wild-type',
    pik3ca: 'Wild-type',
    arid1a: 'Mutated',
    pten: 'Loss detected',
    hrd: 'HRD Positive (Score: 45)',
    hrdScore: 45,
    msi: 'MSS (Microsatellite Stable)',
    tmb: 'Low (3 mutations/Mb)',
    tmbValue: 3,
    pdL1: 'Negative (<1%)',
    testType: 'Foundation One CDx',
    testDate: toTimestamp('2024-09-15'),
    ...profileData
  };

  await genomicProfileService.saveGenomicProfile(patientId, defaultProfile);
  return defaultProfile;
};

/**
 * Initialize emergency contacts
 */
export const initEmergencyContacts = async (patientId = 'mary', contacts = []) => {
  const defaultContacts = [
    {
      contactType: 'oncologist',
      name: 'Dr. Sarah Chen',
      phone: '(206) 555-0123',
      email: 'schen@cancercenter.org'
    },
    {
      contactType: 'primaryCare',
      name: 'Dr. Michael Ross',
      phone: '(206) 555-0156',
      email: 'mross@healthcare.org'
    },
    {
      contactType: 'hospital',
      name: 'Seattle Cancer Center',
      phone: '(206) 555-0199',
      address: '1234 Medical Plaza, Seattle, WA'
    },
    {
      contactType: 'emergency',
      name: 'John (Husband)',
      phone: '(206) 555-0142',
      relation: 'Spouse'
    },
    ...contacts
  ];

  const contactIds = [];
  for (const contact of defaultContacts) {
    const id = await emergencyContactService.saveEmergencyContact({
      ...contact,
      patientId
    });
    contactIds.push(id);
  }

  return contactIds;
};

/**
 * Initialize trial location preferences
 */
export const initTrialLocation = async (patientId = 'mary', locationData = {}) => {
  const defaultLocation = {
    city: 'Seattle',
    state: 'WA',
    country: 'United States',
    zip: '98109',
    searchRadius: '100',
    includeAllLocations: false,
    ...locationData
  };

  await trialLocationService.saveTrialLocation(patientId, defaultLocation);
  return defaultLocation;
};

/**
 * Initialize all data for a patient
 */
export const initAllData = async (patientId = 'mary') => {
  console.log('Initializing Firebase data for patient:', patientId);
  
  try {
    // Initialize patient
    await initPatient(patientId);
    console.log('✓ Patient initialized');

    // Initialize labs
    const labIds = await initLabs(patientId);
    console.log('✓ Labs initialized');

    // Initialize vitals
    const vitalIds = await initVitals(patientId);
    console.log('✓ Vitals initialized');

    // Initialize medications
    const medIds = await initMedications(patientId);
    console.log('✓ Medications initialized');

    // Initialize medication logs
    await initMedicationLogs(patientId, medIds);
    console.log('✓ Medication logs initialized');

    // Initialize genomic profile
    await initGenomicProfile(patientId);
    console.log('✓ Genomic profile initialized');

    // Initialize emergency contacts
    await initEmergencyContacts(patientId);
    console.log('✓ Emergency contacts initialized');

    // Initialize trial location
    await initTrialLocation(patientId);
    console.log('✓ Trial location initialized');

    console.log('✅ All data initialized successfully!');
    return true;
  } catch (error) {
    console.error('❌ Error initializing data:', error);
    throw error;
  }
};




