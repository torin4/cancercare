import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './config';
import { COLLECTIONS } from './collections';

// Helper function to convert Firestore timestamps to JS dates
const convertTimestamps = (data) => {
  if (!data) return data;
  const converted = { ...data };
  Object.keys(converted).forEach(key => {
    if (converted[key] && converted[key].toDate) {
      converted[key] = converted[key].toDate();
    }
  });
  return converted;
};

// ==================== PATIENT SERVICES ====================

export const patientService = {
  // Get patient by ID
  async getPatient(patientId) {
    const docRef = doc(db, COLLECTIONS.PATIENTS, patientId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...convertTimestamps(docSnap.data()) };
    }
    return null;
  },

  // Create or update patient
  async savePatient(patientId, patientData) {
    const docRef = doc(db, COLLECTIONS.PATIENTS, patientId);
    await setDoc(docRef, {
      ...patientData,
      id: patientId,
      updatedAt: serverTimestamp(),
      createdAt: patientData.createdAt || serverTimestamp()
    }, { merge: true });
    return patientId;
  },

  // Update patient
  async updatePatient(patientId, updates) {
    const docRef = doc(db, COLLECTIONS.PATIENTS, patientId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  }
};

// ==================== LAB SERVICES ====================

export const labService = {
  // Get all labs for a patient
  async getLabs(patientId) {
    const q = query(
      collection(db, COLLECTIONS.LABS),
      where('patientId', '==', patientId),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...convertTimestamps(doc.data())
    }));
  },

  // Get lab by ID
  async getLab(labId) {
    const docRef = doc(db, COLLECTIONS.LABS, labId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...convertTimestamps(docSnap.data()) };
    }
    return null;
  },

  // Get lab by type (e.g., 'ca125')
  async getLabByType(patientId, labType) {
    const q = query(
      collection(db, COLLECTIONS.LABS),
      where('patientId', '==', patientId),
      where('labType', '==', labType),
      limit(1)
    );
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return { id: doc.id, ...convertTimestamps(doc.data()) };
    }
    return null;
  },

  // Create or update lab
  async saveLab(labData) {
    if (labData.id) {
      // Update existing
      const docRef = doc(db, COLLECTIONS.LABS, labData.id);
      await updateDoc(docRef, {
        ...labData,
        updatedAt: serverTimestamp()
      });
      return labData.id;
    } else {
      // Create new
      const docRef = await addDoc(collection(db, COLLECTIONS.LABS), {
        ...labData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return docRef.id;
    }
  },

  // Get lab values (historical data)
  async getLabValues(labId) {
    const q = query(
      collection(db, COLLECTIONS.LABS, labId, 'values'),
      orderBy('date', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...convertTimestamps(doc.data())
    }));
  },

  // Add lab value
  async addLabValue(labId, valueData) {
    const docRef = await addDoc(
      collection(db, COLLECTIONS.LABS, labId, 'values'),
      {
        ...valueData,
        labId,
        createdAt: serverTimestamp()
      }
    );
    return docRef.id;
  },

  // Delete lab
  async deleteLab(labId) {
    await deleteDoc(doc(db, COLLECTIONS.LABS, labId));
  }
};

// ==================== VITAL SERVICES ====================

export const vitalService = {
  // Get all vitals for a patient
  async getVitals(patientId) {
    const q = query(
      collection(db, COLLECTIONS.VITALS),
      where('patientId', '==', patientId),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...convertTimestamps(doc.data())
    }));
  },

  // Get vital by ID
  async getVital(vitalId) {
    const docRef = doc(db, COLLECTIONS.VITALS, vitalId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...convertTimestamps(docSnap.data()) };
    }
    return null;
  },

  // Get vital by type (e.g., 'bp')
  async getVitalByType(patientId, vitalType) {
    const q = query(
      collection(db, COLLECTIONS.VITALS),
      where('patientId', '==', patientId),
      where('vitalType', '==', vitalType),
      limit(1)
    );
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return { id: doc.id, ...convertTimestamps(doc.data()) };
    }
    return null;
  },

  // Create or update vital
  async saveVital(vitalData) {
    if (vitalData.id) {
      const docRef = doc(db, COLLECTIONS.VITALS, vitalData.id);
      await updateDoc(docRef, {
        ...vitalData,
        updatedAt: serverTimestamp()
      });
      return vitalData.id;
    } else {
      const docRef = await addDoc(collection(db, COLLECTIONS.VITALS), {
        ...vitalData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return docRef.id;
    }
  },

  // Get vital values (historical data)
  async getVitalValues(vitalId) {
    const q = query(
      collection(db, COLLECTIONS.VITALS, vitalId, 'values'),
      orderBy('date', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...convertTimestamps(doc.data())
    }));
  },

  // Add vital value
  async addVitalValue(vitalId, valueData) {
    const docRef = await addDoc(
      collection(db, COLLECTIONS.VITALS, vitalId, 'values'),
      {
        ...valueData,
        vitalId,
        createdAt: serverTimestamp()
      }
    );
    return docRef.id;
  },

  // Delete vital
  async deleteVital(vitalId) {
    await deleteDoc(doc(db, COLLECTIONS.VITALS, vitalId));
  }
};

// ==================== MEDICATION SERVICES ====================

export const medicationService = {
  // Get all medications for a patient
  async getMedications(patientId) {
    const q = query(
      collection(db, COLLECTIONS.MEDICATIONS),
      where('patientId', '==', patientId),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...convertTimestamps(doc.data())
    }));
  },

  // Get active medications only
  async getActiveMedications(patientId) {
    const q = query(
      collection(db, COLLECTIONS.MEDICATIONS),
      where('patientId', '==', patientId),
      where('active', '==', true),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...convertTimestamps(doc.data())
    }));
  },

  // Get medication by ID
  async getMedication(medId) {
    const docRef = doc(db, COLLECTIONS.MEDICATIONS, medId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...convertTimestamps(docSnap.data()) };
    }
    return null;
  },

  // Create or update medication
  async saveMedication(medicationData) {
    if (medicationData.id) {
      const docRef = doc(db, COLLECTIONS.MEDICATIONS, medicationData.id);
      await updateDoc(docRef, {
        ...medicationData,
        updatedAt: serverTimestamp()
      });
      return medicationData.id;
    } else {
      const docRef = await addDoc(collection(db, COLLECTIONS.MEDICATIONS), {
        ...medicationData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return docRef.id;
    }
  },

  // Delete medication
  async deleteMedication(medId) {
    await deleteDoc(doc(db, COLLECTIONS.MEDICATIONS, medId));
  }
};

// ==================== MEDICATION LOG SERVICES ====================

export const medicationLogService = {
  // Get all medication logs for a patient
  async getMedicationLogs(patientId) {
    const q = query(
      collection(db, COLLECTIONS.MEDICATION_LOGS),
      where('patientId', '==', patientId),
      orderBy('takenAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...convertTimestamps(doc.data())
    }));
  },

  // Get logs for a specific medication
  async getMedicationLogsByMed(patientId, medId) {
    const q = query(
      collection(db, COLLECTIONS.MEDICATION_LOGS),
      where('patientId', '==', patientId),
      where('medId', '==', medId),
      orderBy('takenAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...convertTimestamps(doc.data())
    }));
  },

  // Add medication log entry
  async addMedicationLog(logData) {
    const docRef = await addDoc(collection(db, COLLECTIONS.MEDICATION_LOGS), {
      ...logData,
      takenAt: logData.takenAt || serverTimestamp(),
      createdAt: serverTimestamp()
    });
    return docRef.id;
  },

  // Delete medication log
  async deleteMedicationLog(logId) {
    await deleteDoc(doc(db, COLLECTIONS.MEDICATION_LOGS, logId));
  }
};

// ==================== DOCUMENT SERVICES ====================

export const documentService = {
  // Get all documents for a patient
  async getDocuments(patientId) {
    const q = query(
      collection(db, COLLECTIONS.DOCUMENTS),
      where('patientId', '==', patientId),
      orderBy('date', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...convertTimestamps(doc.data())
    }));
  },

  // Get document by ID
  async getDocument(docId) {
    const docRef = doc(db, COLLECTIONS.DOCUMENTS, docId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...convertTimestamps(docSnap.data()) };
    }
    return null;
  },

  // Create document
  async saveDocument(documentData) {
    if (documentData.id) {
      const docRef = doc(db, COLLECTIONS.DOCUMENTS, documentData.id);
      await updateDoc(docRef, {
        ...documentData,
        updatedAt: serverTimestamp()
      });
      return documentData.id;
    } else {
      const docRef = await addDoc(collection(db, COLLECTIONS.DOCUMENTS), {
        ...documentData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return docRef.id;
    }
  },

  // Delete document
  async deleteDocument(docId) {
    await deleteDoc(doc(db, COLLECTIONS.DOCUMENTS, docId));
  }
};

// ==================== MESSAGE SERVICES ====================

export const messageService = {
  // Get all messages for a patient
  async getMessages(patientId, limitCount = 50) {
    const q = query(
      collection(db, COLLECTIONS.MESSAGES),
      where('patientId', '==', patientId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs
      .map(doc => ({
        id: doc.id,
        ...convertTimestamps(doc.data())
      }))
      .reverse(); // Reverse to show oldest first
  },

  // Add message
  async addMessage(messageData) {
    const docRef = await addDoc(collection(db, COLLECTIONS.MESSAGES), {
      ...messageData,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  },

  // Delete message
  async deleteMessage(messageId) {
    await deleteDoc(doc(db, COLLECTIONS.MESSAGES, messageId));
  }
};

// ==================== SYMPTOM SERVICES ====================

export const symptomService = {
  // Get all symptoms for a patient
  async getSymptoms(patientId) {
    const q = query(
      collection(db, COLLECTIONS.SYMPTOMS),
      where('patientId', '==', patientId),
      orderBy('date', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...convertTimestamps(doc.data())
    }));
  },

  // Add symptom
  async addSymptom(symptomData) {
    const docRef = await addDoc(collection(db, COLLECTIONS.SYMPTOMS), {
      ...symptomData,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  },

  // Update symptom
  async updateSymptom(symptomId, updates) {
    const docRef = doc(db, COLLECTIONS.SYMPTOMS, symptomId);
    await updateDoc(docRef, updates);
  },

  // Delete symptom
  async deleteSymptom(symptomId) {
    await deleteDoc(doc(db, COLLECTIONS.SYMPTOMS, symptomId));
  }
};

// ==================== GENOMIC PROFILE SERVICES ====================

export const genomicProfileService = {
  // Get genomic profile for a patient
  async getGenomicProfile(patientId) {
    const docRef = doc(db, COLLECTIONS.GENOMIC_PROFILES, patientId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...convertTimestamps(docSnap.data()) };
    }
    return null;
  },

  // Create or update genomic profile
  async saveGenomicProfile(patientId, profileData) {
    const docRef = doc(db, COLLECTIONS.GENOMIC_PROFILES, patientId);
    await setDoc(docRef, {
      ...profileData,
      id: patientId,
      patientId,
      updatedAt: serverTimestamp(),
      createdAt: profileData.createdAt || serverTimestamp()
    }, { merge: true });
    return patientId;
  }
};

// ==================== EMERGENCY CONTACT SERVICES ====================

export const emergencyContactService = {
  // Get all emergency contacts for a patient
  async getEmergencyContacts(patientId) {
    const q = query(
      collection(db, COLLECTIONS.EMERGENCY_CONTACTS),
      where('patientId', '==', patientId)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...convertTimestamps(doc.data())
    }));
  },

  // Get contact by type
  async getContactByType(patientId, contactType) {
    const q = query(
      collection(db, COLLECTIONS.EMERGENCY_CONTACTS),
      where('patientId', '==', patientId),
      where('contactType', '==', contactType),
      limit(1)
    );
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const doc = querySnapshot.docs[0];
      return { id: doc.id, ...convertTimestamps(doc.data()) };
    }
    return null;
  },

  // Save emergency contact
  async saveEmergencyContact(contactData) {
    if (contactData.id) {
      const docRef = doc(db, COLLECTIONS.EMERGENCY_CONTACTS, contactData.id);
      await updateDoc(docRef, {
        ...contactData,
        updatedAt: serverTimestamp()
      });
      return contactData.id;
    } else {
      const docRef = await addDoc(collection(db, COLLECTIONS.EMERGENCY_CONTACTS), {
        ...contactData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return docRef.id;
    }
  },

  // Delete emergency contact
  async deleteEmergencyContact(contactId) {
    await deleteDoc(doc(db, COLLECTIONS.EMERGENCY_CONTACTS, contactId));
  }
};

// ==================== CLINICAL TRIAL SERVICES ====================

export const clinicalTrialService = {
  // Get all clinical trials for a patient
  async getClinicalTrials(patientId) {
    const q = query(
      collection(db, COLLECTIONS.CLINICAL_TRIALS),
      where('patientId', '==', patientId),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...convertTimestamps(doc.data())
    }));
  },

  // Save clinical trial
  async saveClinicalTrial(trialData) {
    if (trialData.id) {
      const docRef = doc(db, COLLECTIONS.CLINICAL_TRIALS, trialData.id);
      await updateDoc(docRef, {
        ...trialData,
        updatedAt: serverTimestamp()
      });
      return trialData.id;
    } else {
      const docRef = await addDoc(collection(db, COLLECTIONS.CLINICAL_TRIALS), {
        ...trialData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return docRef.id;
    }
  },

  // Delete clinical trial
  async deleteClinicalTrial(trialId) {
    await deleteDoc(doc(db, COLLECTIONS.CLINICAL_TRIALS, trialId));
  }
};

// ==================== TRIAL LOCATION SERVICES ====================

export const trialLocationService = {
  // Get trial location preferences for a patient
  async getTrialLocation(patientId) {
    const docRef = doc(db, COLLECTIONS.TRIAL_LOCATIONS, patientId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...convertTimestamps(docSnap.data()) };
    }
    return null;
  },

  // Save trial location preferences
  async saveTrialLocation(patientId, locationData) {
    const docRef = doc(db, COLLECTIONS.TRIAL_LOCATIONS, patientId);
    await setDoc(docRef, {
      ...locationData,
      id: patientId,
      patientId,
      updatedAt: serverTimestamp()
    }, { merge: true });
    return patientId;
  }
};

// ==================== ACCOUNT & DATA DELETION SERVICES ====================

export const accountService = {
  /**
   * Clears all medical/personal health data but keeps basic profile info
   */
  async clearHealthData(userId) {
    try {
      console.log('Clearing health data for:', userId);

      // 1. Collections to clear completely (where patientId == userId)
      const healthCollections = [
        COLLECTIONS.LABS,
        COLLECTIONS.VITALS,
        COLLECTIONS.MEDICATIONS,
        COLLECTIONS.MEDICATION_LOGS,
        COLLECTIONS.DOCUMENTS,
        COLLECTIONS.MESSAGES,
        COLLECTIONS.SYMPTOMS,
        COLLECTIONS.CLINICAL_TRIALS
      ];

      for (const colName of healthCollections) {
        const q = query(collection(db, colName), where('patientId', '==', userId));
        const snapshot = await getDocs(q);

        const deletePromises = snapshot.docs.map(async (docSnap) => {
          // Special handling for labs/vitals subcollections
          if (colName === COLLECTIONS.LABS || colName === COLLECTIONS.VITALS) {
            const valuesSnap = await getDocs(collection(db, colName, docSnap.id, 'values'));
            const subDeletePromises = valuesSnap.docs.map(d => deleteDoc(d.ref));
            await Promise.all(subDeletePromises);
          }
          return deleteDoc(docSnap.ref);
        });

        await Promise.all(deletePromises);
      }

      // 2. Clear genomic profile (one per user, ID is userId)
      await deleteDoc(doc(db, COLLECTIONS.GENOMIC_PROFILES, userId));

      console.log('Health data cleared successfully');
    } catch (error) {
      console.error('Error clearing health data:', error);
      throw error;
    }
  },

  /**
   * Deletes absolutely everything associated with the user
   */
  async deleteFullUserData(userId) {
    try {
      // First clear all health data
      await this.clearHealthData(userId);

      // Delete remaining profile/location data
      await deleteDoc(doc(db, COLLECTIONS.PATIENTS, userId));
      await deleteDoc(doc(db, COLLECTIONS.TRIAL_LOCATIONS, userId));

      // Delete emergency contacts
      const q = query(collection(db, COLLECTIONS.EMERGENCY_CONTACTS), where('patientId', '==', userId));
      const snapshot = await getDocs(q);
      const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deletePromises);

      console.log('Full user data deleted successfully');
    } catch (error) {
      console.error('Error deleting full user data:', error);
      throw error;
    }
  }
};

// ==================== ADVANCED CLINICAL TRIAL SERVICES ====================
// Import advanced trial services (JRCT integration, matching, etc.)
export { default as jrctService } from '../services/clinicalTrials/jrctService';
export { default as trialMatcher } from '../services/clinicalTrials/trialMatcher';
export { default as clinicalTrialsService } from '../services/clinicalTrials/clinicalTrialsService';



