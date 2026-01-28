/**
 * Medication Service
 * 
 * Handles all medication-related Firestore operations including:
 * - CRUD operations for medication documents
 * - Managing medication schedules and adherence
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  query,
  where,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../config';
import { COLLECTIONS } from '../collections';
import { convertTimestamps } from './shared/convertTimestamps';

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
      // Avoid storing `id` inside the document body
      // eslint-disable-next-line no-unused-vars
      const { id, ...data } = medicationData;
      await updateDoc(docRef, { ...data, updatedAt: serverTimestamp() });
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

  // Pause/resume (toggle active)
  async setMedicationActive(medId, active) {
    const docRef = doc(db, COLLECTIONS.MEDICATIONS, medId);
    // Backwards compatible: treat "active false" as paused, not stopped
    await updateDoc(docRef, { active: !!active, status: !!active ? 'active' : 'paused', stoppedAt: null, updatedAt: serverTimestamp() });
  },

  // Stop medication (keep record for history)
  async stopMedication(medId) {
    const docRef = doc(db, COLLECTIONS.MEDICATIONS, medId);
    await updateDoc(docRef, { active: false, status: 'stopped', stoppedAt: serverTimestamp(), updatedAt: serverTimestamp() });
  },

  // Restart a stopped medication (keeps history but clears stoppedAt)
  async restartMedication(medId) {
    const docRef = doc(db, COLLECTIONS.MEDICATIONS, medId);
    await updateDoc(docRef, { active: true, status: 'active', stoppedAt: null, updatedAt: serverTimestamp() });
  },

  // Delete medication
  async deleteMedication(medId) {
    await deleteDoc(doc(db, COLLECTIONS.MEDICATIONS, medId));
  }
};
