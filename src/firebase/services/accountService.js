/**
 * Account Service
 * 
 * Handles account-related Firestore operations including:
 * - Clearing health data while preserving profile info
 * - Full user data deletion
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where
} from 'firebase/firestore';
import { db } from '../config';
import { COLLECTIONS } from '../collections';

export const accountService = {
  /**
   * Clears all medical/personal health data but keeps basic profile info
   * Preserves: patient profile, current status, diagnosis, emergency contacts, trial location preferences
   */
  async clearHealthData(userId) {
    try {
      // 1. Collections to clear completely (where patientId == userId)
      const healthCollections = [
        COLLECTIONS.LABS,
        COLLECTIONS.VITALS,
        COLLECTIONS.MEDICATIONS,
        COLLECTIONS.MEDICATION_LOGS,
        COLLECTIONS.DOCUMENTS,
        COLLECTIONS.MESSAGES,
        COLLECTIONS.SYMPTOMS,
        COLLECTIONS.CLINICAL_TRIALS,
        COLLECTIONS.MATCHED_TRIALS
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

      // 2. Delete genomic profile
      const genomicRef = doc(db, COLLECTIONS.GENOMIC_PROFILES, userId);
      const genomicSnap = await getDoc(genomicRef);
      if (genomicSnap.exists()) {
        await deleteDoc(genomicRef);
      }

      // 3. Preserve currentStatus and diagnosis info in patient profile
      // Note: diagnosis, diagnosisDate, currentStatus are kept persistent for trial matching and user reference
      // Only clear health data collections, not the patient's current status information

    } catch (error) {
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

    } catch (error) {
      throw error;
    }
  }
};
