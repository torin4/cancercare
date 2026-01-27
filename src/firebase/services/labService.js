/**
 * Lab Service
 * 
 * Handles all lab-related Firestore operations including:
 * - CRUD operations for lab documents
 * - Managing lab values (historical data) subcollections
 * - Lab cleanup and orphaned data management
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
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../config';
import { COLLECTIONS } from '../collections';
import { convertTimestamps } from './shared/convertTimestamps';

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
      // Remove id from update data (Firestore doesn't allow updating document ID)
      const { id, ...updateData } = labData;
      await updateDoc(docRef, {
        ...updateData,
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

  // Update lab value note
  async updateLabValueNote(labId, valueId, newNote) {
    const docRef = doc(db, COLLECTIONS.LABS, labId, 'values', valueId);
    await updateDoc(docRef, {
      notes: newNote
    });
  },

  // Update lab value (value, date, notes)
  async updateLabValue(labId, valueId, valueData) {
    // Import auth to verify current user
    const { auth } = await import('../config');
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
      throw new Error('User not authenticated. Please sign in and try again.');
    }

    // Get the lab document first to find its labType
    const labRef = doc(db, COLLECTIONS.LABS, labId);
    const labDoc = await getDoc(labRef);
    
    if (!labDoc.exists()) {
      throw new Error('Lab document not found');
    }

    const labData = labDoc.data();
    if (labData.patientId !== currentUser.uid) {
      throw new Error(`Permission denied: You don't have permission to update this value.`);
    }
    
    const labType = labData.labType;
    
    // CRITICAL: Get ALL labs for this user and filter by normalized labType
    // This handles cases where different labType values normalize to the same key
    // and where the value might be in a different lab document with the same type
    const { normalizeLabName } = await import('../../utils/normalizationUtils');
    const normalizedLabType = normalizeLabName(labType) || normalizeLabName(labData.label) || labType.toLowerCase();
    
    // Get all labs for this user
    const allUserLabsQuery = query(
      collection(db, COLLECTIONS.LABS),
      where('patientId', '==', currentUser.uid)
    );
    const allUserLabsSnapshot = await getDocs(allUserLabsQuery);
    
    // Filter labs that normalize to the same key
    const matchingLabs = allUserLabsSnapshot.docs.filter(doc => {
      const docData = doc.data();
      const docNormalizedType = normalizeLabName(docData.labType) || normalizeLabName(docData.label) || docData.labType?.toLowerCase();
      return docNormalizedType === normalizedLabType;
    });
    
    const updateData = {};
    if (valueData.value !== undefined) updateData.value = valueData.value;
    if (valueData.date !== undefined) updateData.date = valueData.date;
    if (valueData.notes !== undefined) updateData.notes = valueData.notes || '';
    if (valueData.documentId !== undefined) updateData.documentId = valueData.documentId || null;
    
    // Search through all lab documents with the same type to find the value
    for (const labDocSnap of matchingLabs) {
      const testLabId = labDocSnap.id;
      const testValueRef = doc(db, COLLECTIONS.LABS, testLabId, 'values', valueId);
      const testValueDoc = await getDoc(testValueRef);
      
      if (testValueDoc.exists()) {
        // Found the value in this lab document, update it
        await updateDoc(testValueRef, updateData);
        
        // Update the lab's current value if this is the most recent value
        const testLabRef = doc(db, COLLECTIONS.LABS, testLabId);
        const testRemainingValues = await getDocs(query(
          collection(db, COLLECTIONS.LABS, testLabId, 'values'),
          orderBy('date', 'desc'),
          limit(1)
        ));
        if (!testRemainingValues.empty) {
          const mostRecentValue = testRemainingValues.docs[0].data();
          await updateDoc(testLabRef, {
            currentValue: mostRecentValue?.value ?? null,
            updatedAt: serverTimestamp()
          });
        }
        
        return; // Successfully updated, exit
      }
    }
    
    // Value not found in any lab document - this shouldn't happen, but create it in the provided lab
    console.warn(`updateLabValue: Value ${valueId} not found in any lab document with type ${normalizedLabType}, creating in lab ${labId}`);
    const docRef = doc(db, COLLECTIONS.LABS, labId, 'values', valueId);
    await setDoc(docRef, {
      ...updateData,
      labId,
      createdAt: serverTimestamp()
    });
  },
  
  // Update lab value documentId (for linking values to documents after creation)
  async updateLabValueDocumentId(labId, valueId, documentId) {
    const docRef = doc(db, COLLECTIONS.LABS, labId, 'values', valueId);
    await updateDoc(docRef, {
      documentId: documentId || null
    });
  },

  // Delete individual lab document (one data point)
  async deleteLab(labId) {
    // Import auth to verify current user
    const { auth } = await import('../config');
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
      throw new Error('User not authenticated. Please sign in and try again.');
    }

    // First verify the lab exists and get it (for ownership check)
    const labRef = doc(db, COLLECTIONS.LABS, labId);
    const labDoc = await getDoc(labRef);
    
    if (!labDoc.exists()) {
      throw new Error('Lab document not found');
    }

    // Verify ownership - this will throw if user doesn't have permission
    // The security rules will check this, but we can verify here too
    const labData = labDoc.data();
    if (!labData.patientId) {
      throw new Error('Lab document missing patientId');
    }

    // Verify the current user owns this lab
    if (labData.patientId !== currentUser.uid) {
      throw new Error(`Permission denied: You don't have permission to delete this lab. Lab belongs to user ${labData.patientId}, but you are ${currentUser.uid}`);
    }

    // Try to delete subcollection values first
    // IMPORTANT: Only delete values from THIS specific lab document's subcollection
    // The subcollection path ensures values are isolated to this lab document only
    try {
      const valuesRef = collection(db, COLLECTIONS.LABS, labId, 'values');
      const valuesSnapshot = await getDocs(valuesRef);
      
      
      // Delete values one by one sequentially to avoid overwhelming security rules
      // Each value is in the subcollection of this specific labId, so it's safe to delete
      let deletedCount = 0;
      for (const valueDoc of valuesSnapshot.docs) {
        try {
          // Double-check: Verify the value is in the correct lab's subcollection
          // The path structure ensures this, but we log it for safety
          const valuePath = valueDoc.ref.path;
          const expectedPathPrefix = `${COLLECTIONS.LABS}/${labId}/values/`;
          
          if (!valuePath.startsWith(expectedPathPrefix)) {
            // Skip this value - don't delete it as it might belong to another lab
            continue;
          }
          
          await deleteDoc(valueDoc.ref);
          deletedCount++;
        } catch (error) {
          // Log but continue - don't fail the entire operation
        }
      }
      
    } catch (error) {
      // Log but continue - main document deletion should still work
      // This might fail if we can't even read the subcollection, but that's okay
    }
    
    // Delete the main lab document
    // This should work if the user owns the lab (security rules will check)
    try {
      await deleteDoc(labRef);
    } catch (error) {
      // If this fails, it's a real permissions issue
      throw new Error(`Failed to delete lab: ${error.message}. Code: ${error.code}`);
    }
  },

  // Delete individual lab value (from subcollection if used)
  async deleteLabValue(labId, valueId) {
    // Import auth to verify current user
    const { auth } = await import('../config');
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
      throw new Error('User not authenticated. Please sign in and try again.');
    }

    // Check if valueId is actually the lab document ID (fallback value with no subcollection)
    // This happens when transform functions use lab.id as the data point ID
    if (valueId === labId) {
      const labRef = doc(db, COLLECTIONS.LABS, labId);
      const labDoc = await getDoc(labRef);
      
      if (!labDoc.exists()) {
        throw new Error('Lab document not found');
      }

      const labData = labDoc.data();
      if (labData.patientId !== currentUser.uid) {
        throw new Error(`Permission denied: You don't have permission to delete this value.`);
      }
      
      // This is a fallback value (lab document used as data point), just clear currentValue
      await updateDoc(labRef, {
        currentValue: null,
        updatedAt: serverTimestamp()
      });
      return;
    }

    // Get the lab document first to find its labType
    const labRef = doc(db, COLLECTIONS.LABS, labId);
    const labDoc = await getDoc(labRef);
    
    if (!labDoc.exists()) {
      throw new Error('Lab document not found');
    }

    const labData = labDoc.data();
    if (labData.patientId !== currentUser.uid) {
      throw new Error(`Permission denied: You don't have permission to delete this value.`);
    }
    
    const labType = labData.labType;
    
    // CRITICAL: Get ALL labs for this user and filter by normalized labType
    // This handles cases where different labType values normalize to the same key
    // (e.g., "hba1c", "hemoglobina1c", "Hemoglobin A1c" all normalize to "hba1c")
    const { normalizeLabName } = await import('../../utils/normalizationUtils');
    const normalizedLabType = normalizeLabName(labType) || normalizeLabName(labData.label) || labType.toLowerCase();
    
    // Get all labs for this user
    const allUserLabsQuery = query(
      collection(db, COLLECTIONS.LABS),
      where('patientId', '==', currentUser.uid)
    );
    const allUserLabsSnapshot = await getDocs(allUserLabsQuery);
    
    // Filter labs that normalize to the same key
    const matchingLabs = allUserLabsSnapshot.docs.filter(doc => {
      const docData = doc.data();
      const docNormalizedType = normalizeLabName(docData.labType) || normalizeLabName(docData.label) || docData.labType?.toLowerCase();
      return docNormalizedType === normalizedLabType;
    });
    
    const deletedFromLabs = [];
    
    // Delete the value from ALL lab documents with the same normalized type
    for (const labDocSnap of matchingLabs) {
      const testLabId = labDocSnap.id;
      const testLabData = labDocSnap.data();
      const testValueRef = doc(db, COLLECTIONS.LABS, testLabId, 'values', valueId);
      const testValueDoc = await getDoc(testValueRef);
      
      if (testValueDoc.exists()) {
        await deleteDoc(testValueRef);
        deletedFromLabs.push(testLabId);
        
        // Update that lab's currentValue
        const testLabRef = doc(db, COLLECTIONS.LABS, testLabId);
        const testRemainingValues = await getDocs(query(collection(db, COLLECTIONS.LABS, testLabId, 'values')));
        if (testRemainingValues.empty) {
          await updateDoc(testLabRef, {
            currentValue: null,
            updatedAt: serverTimestamp()
          });
        } else {
          const mostRecentValue = testRemainingValues.docs[0].data();
          await updateDoc(testLabRef, {
            currentValue: mostRecentValue?.value ?? null,
            updatedAt: serverTimestamp()
          });
        }
      } else {
        // Value not found in this lab - let's check what values actually exist
        const allValuesInLab = await getDocs(query(collection(db, COLLECTIONS.LABS, testLabId, 'values')));
        const existingValueIds = allValuesInLab.docs.map(d => d.id);
        
        // If the value ID doesn't match but there's only one value, it's likely the one we want
        // This handles cases where the UI has a stale/transformed ID
        if (allValuesInLab.size === 1 && !existingValueIds.includes(valueId)) {
          const actualValueId = existingValueIds[0];
          const actualValueDoc = allValuesInLab.docs[0];
          
          // Delete the actual value
          await deleteDoc(actualValueDoc.ref);
          deletedFromLabs.push(testLabId);
          
          // Clear currentValue since this was the only value
          const testLabRef = doc(db, COLLECTIONS.LABS, testLabId);
          await updateDoc(testLabRef, {
            currentValue: null,
            updatedAt: serverTimestamp()
          });
        }
      }
    }
    
    if (deletedFromLabs.length > 0) {
      return;
    }
    
    // If value wasn't found in any lab document, check if it's a fallback value (lab.id as valueId)
    if (valueId === labId) {
      // This is a fallback value, just clear currentValue from all labs with this normalized type
      for (const labDocSnap of matchingLabs) {
        const testLabId = labDocSnap.id;
        const testLabRef = doc(db, COLLECTIONS.LABS, testLabId);
        await updateDoc(testLabRef, {
          currentValue: null,
          updatedAt: serverTimestamp()
        });
      }
      return;
    }
    
    // Value not found anywhere - may have already been deleted
    return;
  },

  // Delete all labs of a specific type for a patient
  // labType is the normalized key from the UI (e.g., "ca125")
  // We need to find all labs that normalize to this key, regardless of their exact labType value
  async deleteAllLabsByType(patientId, labType) {
    // Import normalizeLabName dynamically to avoid circular dependencies
    const { normalizeLabName } = await import('../../utils/normalizationUtils');
    
    // Get all labs for this patient (can't query by normalized labType)
    const q = query(
      collection(db, COLLECTIONS.LABS),
      where('patientId', '==', patientId)
    );
    const querySnapshot = await getDocs(q);
    
    // Filter labs by normalized labType
    const labsToDelete = [];
    for (const docSnap of querySnapshot.docs) {
      const labData = docSnap.data();
      // Normalize both the stored labType and label to match the normalized key
      const normalizedStoredType = normalizeLabName(labData.labType) || 
                                     normalizeLabName(labData.label) || 
                                     (labData.labType || '').toLowerCase();
      const normalizedTargetType = normalizeLabName(labType) || labType.toLowerCase();
      
      if (normalizedStoredType === normalizedTargetType) {
        labsToDelete.push(docSnap);
      }
    }
    
    
    // Delete all matching labs and their subcollection values
    const deletePromises = labsToDelete.map(async (docSnap) => {
      // Also delete any subcollection values
      try {
        const valuesRef = collection(db, COLLECTIONS.LABS, docSnap.id, 'values');
        const valuesSnapshot = await getDocs(valuesRef);
        const deleteValuePromises = valuesSnapshot.docs.map(d => deleteDoc(d.ref));
        await Promise.all(deleteValuePromises);
      } catch (error) {
      }
      await deleteDoc(docSnap.ref);
    });
    await Promise.all(deletePromises);
    return labsToDelete.length;
  },

  // Clean up orphaned lab documents (labs with no values)
  async cleanupOrphanedLabs(patientId) {
    const allLabs = await this.getLabs(patientId);
    if (allLabs.length === 0) return 0;
    
    const orphanedLabs = [];
    
    // Check each lab for values
    for (const lab of allLabs) {
      try {
        const values = await this.getLabValues(lab.id);
        if (!values || values.length === 0) {
          orphanedLabs.push(lab);
        }
      } catch (error) {
        // If we can't check values, assume it's orphaned and try to delete
        orphanedLabs.push(lab);
      }
    }
    
    if (orphanedLabs.length === 0) return 0;
    
    // Delete orphaned labs
    let deletedCount = 0;
    for (const lab of orphanedLabs) {
      try {
        await this.deleteLab(lab.id);
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
