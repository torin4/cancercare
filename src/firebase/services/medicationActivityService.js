/**
 * Medication Activity Service
 *
 * Tracks user actions on medications (add/update/pause/resume/delete).
 * Separate from adherence logs (taken doses).
 */

import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../config';
import { COLLECTIONS } from '../collections';

export const medicationActivityService = {
  async addActivity({
    patientId,
    medId = null,
    action,
    medName = null,
    details = null
  }) {
    if (!patientId) throw new Error('patientId is required');
    if (!action) throw new Error('action is required');

    const payload = {
      patientId,
      medId,
      action, // 'added' | 'updated' | 'paused' | 'resumed' | 'stopped' | 'restarted' | 'deleted'
      medName,
      details,
      createdAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, COLLECTIONS.MEDICATION_ACTIVITY), payload);
    return docRef.id;
  }
};

