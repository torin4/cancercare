/**
 * Journal Note Service
 * 
 * Handles all journal note-related Firestore operations including:
 * - CRUD operations for journal note documents
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
  orderBy
} from 'firebase/firestore';
import { Timestamp } from 'firebase/firestore';
import { db } from '../config';
import { COLLECTIONS } from '../collections';
import { convertTimestamps } from './shared/convertTimestamps';
import { serverTimestamp } from 'firebase/firestore';

export const journalNoteService = {
  // Get all journal notes for a patient
  async getJournalNotes(patientId) {
    const q = query(
      collection(db, COLLECTIONS.JOURNAL_NOTES),
      where('patientId', '==', patientId),
      orderBy('date', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...convertTimestamps(doc.data())
    }));
  },

  // Add journal note
  async addJournalNote(noteData) {
    // Convert date to Firestore Timestamp if it's a Date object
    const dataToSave = {
      ...noteData,
      date: noteData.date instanceof Date
        ? Timestamp.fromDate(noteData.date)
        : noteData.date,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    const docRef = await addDoc(collection(db, COLLECTIONS.JOURNAL_NOTES), dataToSave);
    return docRef.id;
  },

  // Update journal note
  async updateJournalNote(noteId, updates) {
    const docRef = doc(db, COLLECTIONS.JOURNAL_NOTES, noteId);
    const dataToSave = {
      ...updates,
      updatedAt: serverTimestamp()
    };
    // Convert date to Timestamp if provided
    if (updates.date instanceof Date) {
      dataToSave.date = Timestamp.fromDate(updates.date);
    }
    await updateDoc(docRef, dataToSave);
  },

  // Delete journal note
  async deleteJournalNote(noteId) {
    await deleteDoc(doc(db, COLLECTIONS.JOURNAL_NOTES, noteId));
  }
};
