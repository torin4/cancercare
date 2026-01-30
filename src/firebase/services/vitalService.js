/**
 * Vital Service
 * 
 * Handles all vital-related Firestore operations including:
 * - CRUD operations for vital documents
 * - Managing vital values (historical data) subcollections
 * - Vital cleanup and orphaned data management
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
  limit,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config';
import { COLLECTIONS } from '../collections';
import { convertTimestamps } from './shared/convertTimestamps';

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
    // Firestore rejects undefined - filter out undefined values
    const cleanData = Object.fromEntries(
      Object.entries(valueData || {}).filter(([, v]) => v !== undefined)
    );
    const dataToSave = {
      ...cleanData,
      vitalId,
      createdAt: serverTimestamp()
    };
    if (cleanData.date instanceof Date) {
      dataToSave.date = Timestamp.fromDate(cleanData.date);
    }
    const docRef = await addDoc(
      collection(db, COLLECTIONS.VITALS, vitalId, 'values'),
      dataToSave
    );
    return docRef.id;
  },

  // Update vital value note
  async updateVitalValueNote(vitalId, valueId, newNote) {
    const docRef = doc(db, COLLECTIONS.VITALS, vitalId, 'values', valueId);
    await updateDoc(docRef, {
      notes: newNote
    });
  },

  // Update vital value (value, date, notes, systolic, diastolic)
  async updateVitalValue(vitalId, valueId, valueData) {
    const docRef = doc(db, COLLECTIONS.VITALS, vitalId, 'values', valueId);
    const updateData = {
      date: valueData.date,
      notes: valueData.notes || ''
    };
    if (valueData.value !== undefined) updateData.value = valueData.value;
    if (valueData.systolic !== undefined) updateData.systolic = valueData.systolic;
    if (valueData.diastolic !== undefined) updateData.diastolic = valueData.diastolic;
    
    // Check if document exists first
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      // Document exists, update it
      await updateDoc(docRef, updateData);
    } else {
      // Document doesn't exist, create it
      await setDoc(docRef, updateData);
    }
  },

  // Delete individual vital document (one data point)
  async deleteVital(vitalId) {
    // Import auth to verify current user
    const { auth } = await import('../config');
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
      throw new Error('User not authenticated. Please sign in and try again.');
    }

    // First verify the vital exists and get it (for ownership check)
    const vitalRef = doc(db, COLLECTIONS.VITALS, vitalId);
    const vitalDoc = await getDoc(vitalRef);
    
    if (!vitalDoc.exists()) {
      throw new Error('Vital document not found');
    }

    // Verify ownership
    const vitalData = vitalDoc.data();
    if (!vitalData.patientId) {
      throw new Error('Vital document missing patientId');
    }

    // Verify the current user owns this vital
    if (vitalData.patientId !== currentUser.uid) {
      throw new Error(`Permission denied: You don't have permission to delete this vital. Vital belongs to user ${vitalData.patientId}, but you are ${currentUser.uid}`);
    }

    // Also delete any subcollection values
    // IMPORTANT: Only delete values from THIS specific vital document's subcollection
    // The subcollection path ensures values are isolated to this vital document only
    try {
      const valuesRef = collection(db, COLLECTIONS.VITALS, vitalId, 'values');
      const valuesSnapshot = await getDocs(valuesRef);
      
      
      // Delete values with safety checks
      let deletedCount = 0;
      for (const valueDoc of valuesSnapshot.docs) {
        try {
          // Double-check: Verify the value is in the correct vital's subcollection
          const valuePath = valueDoc.ref.path;
          const expectedPathPrefix = `${COLLECTIONS.VITALS}/${vitalId}/values/`;
          
          if (!valuePath.startsWith(expectedPathPrefix)) {
            // Skip this value - don't delete it as it might belong to another vital
            continue;
          }
          
          await deleteDoc(valueDoc.ref);
          deletedCount++;
        } catch (error) {
          // Continue - don't fail the entire operation
        }
      }
      
    } catch (error) {
      // Continue with main document deletion even if subcollection deletion fails
    }
    
    try {
      await deleteDoc(vitalRef);
    } catch (error) {
      throw new Error(`Failed to delete vital: ${error.message}. Code: ${error.code}`);
    }
  },

  // Delete individual vital value (from subcollection if used)
  // IMPORTANT: This only deletes a value from the specific vital document's subcollection
  // The path structure (vitals/{vitalId}/values/{valueId}) ensures isolation
  async deleteVitalValue(vitalId, valueId) {
    // Import auth to verify current user
    const { auth } = await import('../config');
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
      throw new Error('User not authenticated. Please sign in and try again.');
    }

    // Check if valueId is actually the vital document ID (fallback value with no subcollection)
    // This happens when transform functions use vital.id as the data point ID
    if (valueId === vitalId) {
      const vitalRef = doc(db, COLLECTIONS.VITALS, vitalId);
      const vitalDoc = await getDoc(vitalRef);
      
      if (!vitalDoc.exists()) {
        throw new Error('Vital document not found');
      }

      const vitalData = vitalDoc.data();
      if (vitalData.patientId !== currentUser.uid) {
        throw new Error(`Permission denied: You don't have permission to delete this value.`);
      }
      
      // This is a fallback value (vital document used as data point), just clear currentValue
      await updateDoc(vitalRef, {
        currentValue: null,
        updatedAt: serverTimestamp()
      });
      return;
    }

    // First, try to find the value in the provided vitalId
    let valueRef = doc(db, COLLECTIONS.VITALS, vitalId, 'values', valueId);
    let valueDoc = await getDoc(valueRef);
    let actualVitalId = vitalId;
    
    // If value not found in provided vitalId, search through all vitals with same type
    // This handles the case where multiple vital documents have the same vitalType
    if (!valueDoc.exists()) {
      
      // Get the vital document to find its vitalType
      const vitalRef = doc(db, COLLECTIONS.VITALS, vitalId);
      const vitalDoc = await getDoc(vitalRef);
      
      if (!vitalDoc.exists()) {
        throw new Error('Vital document not found');
      }

      const vitalData = vitalDoc.data();
      if (vitalData.patientId !== currentUser.uid) {
        throw new Error(`Permission denied: You don't have permission to delete this value.`);
      }

      const vitalType = vitalData.vitalType;
      
      // Find all vitals with the same type for this user
      const q = query(
        collection(db, COLLECTIONS.VITALS),
        where('patientId', '==', currentUser.uid),
        where('vitalType', '==', vitalType)
      );
      const allVitalsSnapshot = await getDocs(q);
      
      // Search through all vitals with same type to find which one contains this value
      for (const vitalDocSnap of allVitalsSnapshot.docs) {
        const testVitalId = vitalDocSnap.id;
        const testValueRef = doc(db, COLLECTIONS.VITALS, testVitalId, 'values', valueId);
        const testValueDoc = await getDoc(testValueRef);
        
        if (testValueDoc.exists()) {
          actualVitalId = testVitalId;
          valueRef = testValueRef;
          valueDoc = testValueDoc;
          break;
        }
      }
      
      // If still not found, it may have already been deleted
      if (!valueDoc.exists()) {
        return; // Don't throw - value may have already been deleted
      }
    } else {
      // Value found in provided vitalId, verify ownership
      const vitalRef = doc(db, COLLECTIONS.VITALS, vitalId);
      const vitalDoc = await getDoc(vitalRef);
      
      if (!vitalDoc.exists()) {
        throw new Error('Vital document not found');
      }

      const vitalData = vitalDoc.data();
      if (!vitalData.patientId) {
        throw new Error('Vital document missing patientId');
      }

      // Verify the current user owns this vital
      if (vitalData.patientId !== currentUser.uid) {
        throw new Error(`Permission denied: You don't have permission to delete this value. Vital belongs to user ${vitalData.patientId}, but you are ${currentUser.uid}`);
      }
    }
    
    // Log before deletion
    const valueData = valueDoc.data();
    const actualVitalRef = doc(db, COLLECTIONS.VITALS, actualVitalId);
    const actualVitalDoc = await getDoc(actualVitalRef);
    const actualVitalData = actualVitalDoc.data();
    
    
    await deleteDoc(valueRef);
    
    // Check if this was the last value - if so, clear currentValue to prevent it from reappearing
    const remainingValues = await getDocs(query(collection(db, COLLECTIONS.VITALS, actualVitalId, 'values')));
    
    if (remainingValues.empty) {
      // Clear currentValue so transform functions don't use it as a fallback
      await updateDoc(actualVitalRef, {
        currentValue: null,
        updatedAt: serverTimestamp()
      });
      
      // Verify it was cleared
      const updatedVitalDoc = await getDoc(actualVitalRef);
      const updatedVitalData = updatedVitalDoc.data();
    } else {
    }
  },

  // Delete all vitals of a specific type for a patient
  // vitalType is the normalized key from the UI (e.g., "blood_pressure")
  // We need to find all vitals that normalize to this key, regardless of their exact vitalType value
  async deleteAllVitalsByType(patientId, vitalType) {
    // Import normalizeVitalName dynamically to avoid circular dependencies
    const { normalizeVitalName } = await import('../../utils/normalizationUtils');
    
    // Get all vitals for this patient (can't query by normalized vitalType)
    const q = query(
      collection(db, COLLECTIONS.VITALS),
      where('patientId', '==', patientId)
    );
    const querySnapshot = await getDocs(q);
    
    // Filter vitals by normalized vitalType
    const vitalsToDelete = [];
    for (const docSnap of querySnapshot.docs) {
      const vitalData = docSnap.data();
      // Normalize both the stored vitalType and label to match the normalized key
      const normalizedStoredType = normalizeVitalName(vitalData.vitalType) || 
                                    normalizeVitalName(vitalData.label) || 
                                    (vitalData.vitalType || '').toLowerCase();
      const normalizedTargetType = normalizeVitalName(vitalType) || vitalType.toLowerCase();
      
      if (normalizedStoredType === normalizedTargetType) {
        vitalsToDelete.push(docSnap);
      }
    }
    
    
    // Delete all matching vitals and their subcollection values
    const deletePromises = vitalsToDelete.map(async (docSnap) => {
      // Also delete any subcollection values
      try {
        const valuesRef = collection(db, COLLECTIONS.VITALS, docSnap.id, 'values');
        const valuesSnapshot = await getDocs(valuesRef);
        const deleteValuePromises = valuesSnapshot.docs.map(d => deleteDoc(d.ref));
        await Promise.all(deleteValuePromises);
      } catch (error) {
      }
      await deleteDoc(docSnap.ref);
    });
    await Promise.all(deletePromises);
    return vitalsToDelete.length;
  },

  // Clean up orphaned vital documents (vitals with no values)
  async cleanupOrphanedVitals(patientId) {
    const allVitals = await this.getVitals(patientId);
    if (allVitals.length === 0) return 0;
    
    const orphanedVitals = [];

    // Check each vital for values
    for (const vital of allVitals) {
      try {
        const values = await this.getVitalValues(vital.id);
        if (!values || values.length === 0) {
          orphanedVitals.push(vital);
        }
      } catch (error) {
        // If we can't check values, assume it's orphaned and try to delete
        orphanedVitals.push(vital);
      }
    }

    if (orphanedVitals.length === 0) return 0;

    // Delete orphaned vitals
    let deletedCount = 0;
    for (const vital of orphanedVitals) {
      try {
        await this.deleteVital(vital.id);
        deletedCount++;
      } catch (error) {
      }
    }

    // Only log if we actually deleted something
    if (deletedCount > 0) {
    }
    
    return deletedCount;
  }
};
