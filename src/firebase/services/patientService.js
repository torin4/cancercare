/**
 * Patient Service
 * Handles all patient-related Firebase operations
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../config';
import { COLLECTIONS } from '../collections';
import { convertTimestamps } from './shared/convertTimestamps';

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
  },

  // Update favorite metrics
  async updateFavoriteMetrics(patientId, favoriteMetrics) {
    const docRef = doc(db, COLLECTIONS.PATIENTS, patientId);
    await updateDoc(docRef, {
      favoriteMetrics,
      updatedAt: serverTimestamp()
    });
  }
};
