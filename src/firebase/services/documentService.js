/**
 * Document Service
 * 
 * Handles all document-related Firestore operations including:
 * - CRUD operations for document documents
 * - Calculating and updating date ranges based on associated lab/vital values
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../config';
import { COLLECTIONS } from '../collections';
import { convertTimestamps } from './shared/convertTimestamps';
import { labService } from './labService';
import { vitalService } from './vitalService';

export const documentService = {
  // Get all documents for a patient
  async getDocuments(patientId) {
    const q = query(
      collection(db, COLLECTIONS.DOCUMENTS),
      where('patientId', '==', patientId),
      orderBy('date', 'desc')
    );
    const querySnapshot = await getDocs(q);
    const documents = querySnapshot.docs.map(doc => {
      const data = convertTimestamps(doc.data());
      return {
        id: doc.id,
        ...data
      };
    });
    
    // Calculate date ranges synchronously and include them in returned documents immediately
    // This prevents visual "jump" when Files tab loads
    const documentsWithRanges = await this.calculateDateRangesForDocuments(patientId, documents);
    
    // Update Firestore in background (non-blocking) for persistence
    this.calculateAndUpdateDateRanges(patientId, documentsWithRanges).catch(error => {
      // Background update error handling - don't block UI
    });
    
    return documentsWithRanges;
  },

  // Calculate date ranges and include them in document objects immediately (synchronous)
  async calculateDateRangesForDocuments(patientId, documents) {
    if (!documents || documents.length === 0) return documents;
    
    try {
      // Get all labs and vitals for the user (only once)
      const [labs, vitals] = await Promise.all([
        labService.getLabs(patientId),
        vitalService.getVitals(patientId)
      ]);
      
      // Load ALL lab and vital values in parallel (much faster than sequential)
      const labValuePromises = labs.map(lab => labService.getLabValues(lab.id));
      const vitalValuePromises = vitals.map(vital => vitalService.getVitalValues(vital.id));
      const [allLabValues, allVitalValues] = await Promise.all([
        Promise.all(labValuePromises),
        Promise.all(vitalValuePromises)
      ]);
      
      // Build a map of documentId -> all associated dates
      const documentDatesMap = {};
      
      // Process all lab values (already loaded)
      allLabValues.forEach((values, index) => {
        for (const value of values) {
          if (value.documentId && value.date) {
            if (!documentDatesMap[value.documentId]) {
              documentDatesMap[value.documentId] = new Set();
            }
            const dateValue = value.date?.toDate ? value.date.toDate() : (value.date instanceof Date ? value.date : new Date(value.date));
            const localDate = new Date(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate());
            documentDatesMap[value.documentId].add(localDate.getTime());
          }
        }
      });
      
      // Process all vital values (already loaded)
      allVitalValues.forEach((values, index) => {
        for (const value of values) {
          if (value.documentId && value.date) {
            if (!documentDatesMap[value.documentId]) {
              documentDatesMap[value.documentId] = new Set();
            }
            const dateValue = value.date?.toDate ? value.date.toDate() : (value.date instanceof Date ? value.date : new Date(value.date));
            const localDate = new Date(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate());
            documentDatesMap[value.documentId].add(localDate.getTime());
          }
        }
      });
      
      // Add date ranges to document objects immediately
      return documents.map(doc => {
        const dates = documentDatesMap[doc.id];
        if (!dates || dates.size <= 1) {
          // Single date or no dates - return document as-is (or clear ranges if they exist)
          return {
            ...doc,
            minDate: null,
            maxDate: null,
            hasMultipleDates: false
          };
        }
        
        // Multiple dates - calculate and include range
        const dateArray = Array.from(dates).sort((a, b) => a - b);
        const minDate = new Date(dateArray[0]);
        const maxDate = new Date(dateArray[dateArray.length - 1]);
        
        return {
          ...doc,
          minDate: minDate,
          maxDate: maxDate,
          hasMultipleDates: true
        };
      });
    } catch (error) {
      // Return documents as-is if calculation fails
      return documents;
    }
  },

  // Calculate date ranges for documents and update them in Firestore
  async calculateAndUpdateDateRanges(patientId, documents) {
    if (!documents || documents.length === 0) return;
    
    try {
      // Get all labs and vitals for the user (only once)
      const [labs, vitals] = await Promise.all([
        labService.getLabs(patientId),
        vitalService.getVitals(patientId)
      ]);
      
      // Build a map of documentId -> all associated dates
      const documentDatesMap = {};
      
      // Check all lab values
      for (const lab of labs) {
        const values = await labService.getLabValues(lab.id);
        for (const value of values) {
          if (value.documentId && value.date) {
            if (!documentDatesMap[value.documentId]) {
              documentDatesMap[value.documentId] = new Set();
            }
            const dateValue = value.date?.toDate ? value.date.toDate() : (value.date instanceof Date ? value.date : new Date(value.date));
            const localDate = new Date(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate());
            documentDatesMap[value.documentId].add(localDate.getTime());
          }
        }
      }
      
      // Check all vital values
      for (const vital of vitals) {
        const values = await vitalService.getVitalValues(vital.id);
        for (const value of values) {
          if (value.documentId && value.date) {
            if (!documentDatesMap[value.documentId]) {
              documentDatesMap[value.documentId] = new Set();
            }
            const dateValue = value.date?.toDate ? value.date.toDate() : (value.date instanceof Date ? value.date : new Date(value.date));
            const localDate = new Date(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate());
            documentDatesMap[value.documentId].add(localDate.getTime());
          }
        }
      }
      
      // Update documents with date ranges
      const updatePromises = documents.map(async (doc) => {
        const dates = documentDatesMap[doc.id];
        if (!dates || dates.size <= 1) {
          // Single date or no dates - clear date range if it exists
          if (doc.minDate || doc.maxDate) {
            const docRef = doc(db, COLLECTIONS.DOCUMENTS, doc.id);
            await updateDoc(docRef, {
              minDate: null,
              maxDate: null,
              hasMultipleDates: false
            });
          }
          return;
        }
        
        // Multiple dates - calculate and store range
        const dateArray = Array.from(dates).sort((a, b) => a - b);
        const minDate = new Date(dateArray[0]);
        const maxDate = new Date(dateArray[dateArray.length - 1]);
        
        // Only update if the range has changed
        const existingMin = doc.minDate ? (doc.minDate.toDate ? doc.minDate.toDate().getTime() : new Date(doc.minDate).getTime()) : null;
        const existingMax = doc.maxDate ? (doc.maxDate.toDate ? doc.maxDate.toDate().getTime() : new Date(doc.maxDate).getTime()) : null;
        
        if (existingMin !== minDate.getTime() || existingMax !== maxDate.getTime()) {
          const docRef = doc(db, COLLECTIONS.DOCUMENTS, doc.id);
          await updateDoc(docRef, {
            minDate: Timestamp.fromDate(minDate),
            maxDate: Timestamp.fromDate(maxDate),
            hasMultipleDates: true
          });
        }
      });
      
      await Promise.all(updatePromises);
    } catch (error) {
      throw error;
    }
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
    // Convert Date objects to Firestore Timestamps for proper storage
    // Firestore prefers Timestamps over Date objects for consistency
    const dataToSave = {
      ...documentData,
      // Ensure date is a Timestamp if it's a Date object
      date: documentData.date 
        ? (documentData.date instanceof Date 
            ? Timestamp.fromDate(documentData.date)
            : documentData.date)
        : null,
      // Ensure note is explicitly included - preserve string values, normalize empty strings to null
      note: (documentData.note !== undefined && documentData.note !== null && documentData.note !== '')
        ? (typeof documentData.note === 'string' ? documentData.note.trim() : documentData.note)
        : null
    };
    
    if (documentData.id) {
      const docRef = doc(db, COLLECTIONS.DOCUMENTS, documentData.id);
      // Remove 'id' from dataToSave as it's not a Firestore field
      const { id, ...updateData } = dataToSave;
      await updateDoc(docRef, {
        ...updateData,
        updatedAt: serverTimestamp()
      });
      return documentData.id;
    } else {
      const docRef = await addDoc(collection(db, COLLECTIONS.DOCUMENTS), {
        ...dataToSave,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return docRef.id;
    }
  },

  // Delete document
  async deleteDocument(docId) {
    // Import auth to verify current user
    const { auth } = await import('../config');
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
      throw new Error('User not authenticated. Please sign in and try again.');
    }

    // First verify the document exists and get it (for ownership check)
    const docRef = doc(db, COLLECTIONS.DOCUMENTS, docId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      throw new Error('Document not found');
    }

    // Verify ownership
    const docData = docSnap.data();
    if (!docData.patientId) {
      throw new Error('Document missing patientId');
    }

    // Verify the current user owns this document
    if (docData.patientId !== currentUser.uid) {
      throw new Error(`Permission denied: You don't have permission to delete this document. Document belongs to user ${docData.patientId}, but you are ${currentUser.uid}`);
    }

    try {
      await deleteDoc(docRef);
    } catch (error) {
      throw new Error(`Failed to delete document: ${error.message}. Code: ${error.code}`);
    }
  }
};
