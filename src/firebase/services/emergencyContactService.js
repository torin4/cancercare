/**
 * Emergency Contact Service
 * 
 * Handles all emergency contact-related Firestore operations including:
 * - CRUD operations for emergency contact documents
 */

import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  limit,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../config';
import { COLLECTIONS } from '../collections';
import { convertTimestamps } from './shared/convertTimestamps';

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
    const LOG = '[emergencyContactService.saveEmergencyContact]';
    console.log(LOG, 'input', { hasId: !!contactData?.id, keys: contactData ? Object.keys(contactData) : [] });

    // Firestore rejects undefined values; strip them and omit document id from body
    const { id, ...rest } = contactData;
    const clean = Object.fromEntries(
      Object.entries(rest).filter(([, v]) => v !== undefined)
    );
    console.log(LOG, 'clean payload (no undefined)', { clean, hasPatientId: 'patientId' in clean });

    if (id) {
      console.log(LOG, 'updateDoc', id);
      const docRef = doc(db, COLLECTIONS.EMERGENCY_CONTACTS, id);
      try {
        await updateDoc(docRef, { ...clean, updatedAt: serverTimestamp() });
        console.log(LOG, 'updateDoc ok', id);
        return id;
      } catch (err) {
        console.error(LOG, 'updateDoc failed', { id, error: err, message: err?.message, code: err?.code });
        throw err;
      }
    } else {
      console.log(LOG, 'addDoc (new contact)');
      try {
        const docRef = await addDoc(collection(db, COLLECTIONS.EMERGENCY_CONTACTS), {
          ...clean,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        console.log(LOG, 'addDoc ok', docRef.id);
        return docRef.id;
      } catch (err) {
        console.error(LOG, 'addDoc failed', { error: err, message: err?.message, code: err?.code });
        throw err;
      }
    }
  },

  // Delete emergency contact
  async deleteEmergencyContact(contactId) {
    const LOG = '[emergencyContactService.deleteEmergencyContact]';
    console.log(LOG, 'delete', contactId);
    try {
      await deleteDoc(doc(db, COLLECTIONS.EMERGENCY_CONTACTS, contactId));
      console.log(LOG, 'delete ok', contactId);
    } catch (err) {
      console.error(LOG, 'delete failed', { contactId, error: err, message: err?.message, code: err?.code });
      throw err;
    }
  }
};
