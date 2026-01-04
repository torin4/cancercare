import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
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
    const value = converted[key];
    // Handle Firestore Timestamps (has toDate method)
    if (value && typeof value === 'object' && value.toDate && typeof value.toDate === 'function') {
      converted[key] = value.toDate();
    }
    // Handle Date objects (already converted, keep as is)
    else if (value instanceof Date) {
      converted[key] = value;
    }
    // Handle null/undefined (keep as is - no conversion needed)
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

  // Update lab value note
  async updateLabValueNote(labId, valueId, newNote) {
    const docRef = doc(db, COLLECTIONS.LABS, labId, 'values', valueId);
    await updateDoc(docRef, {
      notes: newNote
    });
  },

  // Update lab value (value, date, notes)
  async updateLabValue(labId, valueId, valueData) {
    const docRef = doc(db, COLLECTIONS.LABS, labId, 'values', valueId);
    // Check if document exists first
    const docSnap = await getDoc(docRef);
    const updateData = {};
    if (valueData.value !== undefined) updateData.value = valueData.value;
    if (valueData.date !== undefined) updateData.date = valueData.date;
    if (valueData.notes !== undefined) updateData.notes = valueData.notes || '';
    if (valueData.documentId !== undefined) updateData.documentId = valueData.documentId || null;
    
    if (docSnap.exists()) {
      // Document exists, update it
      await updateDoc(docRef, updateData);
    } else {
      // Document doesn't exist, create it
      await setDoc(docRef, {
        ...updateData,
        labId,
        createdAt: serverTimestamp()
      });
    }
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
    const { auth } = await import('./config');
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
    const { auth } = await import('./config');
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

    // First, try to find the value in the provided labId
    let valueRef = doc(db, COLLECTIONS.LABS, labId, 'values', valueId);
    let valueDoc = await getDoc(valueRef);
    let actualLabId = labId;
    
    // If value not found in provided labId, search through all labs with same type
    // This handles the case where multiple lab documents have the same labType
    if (!valueDoc.exists()) {
      
      // Get the lab document to find its labType
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
      
      // Find all labs with the same type for this user
      const q = query(
        collection(db, COLLECTIONS.LABS),
        where('patientId', '==', currentUser.uid),
        where('labType', '==', labType)
      );
      const allLabsSnapshot = await getDocs(q);
      
      // Search through all labs with same type to find which one contains this value
      for (const labDocSnap of allLabsSnapshot.docs) {
        const testLabId = labDocSnap.id;
        const testValueRef = doc(db, COLLECTIONS.LABS, testLabId, 'values', valueId);
        const testValueDoc = await getDoc(testValueRef);
        
        if (testValueDoc.exists()) {
          actualLabId = testLabId;
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
      // Value found in provided labId, verify ownership
      const labRef = doc(db, COLLECTIONS.LABS, labId);
      const labDoc = await getDoc(labRef);
      
      if (!labDoc.exists()) {
        throw new Error('Lab document not found');
      }

      const labData = labDoc.data();
      if (!labData.patientId) {
        throw new Error('Lab document missing patientId');
      }

      // Verify the current user owns this lab
      if (labData.patientId !== currentUser.uid) {
        throw new Error(`Permission denied: You don't have permission to delete this value. Lab belongs to user ${labData.patientId}, but you are ${currentUser.uid}`);
      }
    }

    // Log before deletion
    const valueData = valueDoc.data();
    const actualLabRef = doc(db, COLLECTIONS.LABS, actualLabId);
    const actualLabDoc = await getDoc(actualLabRef);
    const actualLabData = actualLabDoc.data();
    
    
    // Delete the value
    await deleteDoc(valueRef);
    
    // Check if this was the last value - if so, clear currentValue to prevent it from reappearing
    const remainingValues = await getDocs(query(collection(db, COLLECTIONS.LABS, actualLabId, 'values')));
    
    if (remainingValues.empty) {
      // Clear currentValue so transform functions don't use it as a fallback
      await updateDoc(actualLabRef, {
        currentValue: null,
        updatedAt: serverTimestamp()
      });
      
      // Verify it was cleared
      const updatedLabDoc = await getDoc(actualLabRef);
      const updatedLabData = updatedLabDoc.data();
    } else {
    }
  },

  // Delete all labs of a specific type for a patient
  // labType is the normalized key from the UI (e.g., "ca125")
  // We need to find all labs that normalize to this key, regardless of their exact labType value
  async deleteAllLabsByType(patientId, labType) {
    // Import normalizeLabName dynamically to avoid circular dependencies
    const { normalizeLabName } = await import('../utils/normalizationUtils');
    
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
    const { auth } = await import('./config');
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
    const { auth } = await import('./config');
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
    const { normalizeVitalName } = await import('../utils/normalizationUtils');
    
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
      await updateDoc(docRef, {
        ...dataToSave,
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
    const { auth } = await import('./config');
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
  },

  // Delete all messages for a patient
  async deleteAllMessages(patientId) {
    const q = query(
      collection(db, COLLECTIONS.MESSAGES),
      where('patientId', '==', patientId)
    );
    const querySnapshot = await getDocs(q);
    const deletePromises = querySnapshot.docs.map(docSnap => deleteDoc(docSnap.ref));
    await Promise.all(deletePromises);
    return querySnapshot.docs.length;
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

  // Subscribe to real-time symptom updates for a patient
  subscribeSymptoms(patientId, onChange) {
    const q = query(
      collection(db, COLLECTIONS.SYMPTOMS),
      where('patientId', '==', patientId),
      orderBy('date', 'desc')
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(d => ({ id: d.id, ...convertTimestamps(d.data()) }));
      if (typeof onChange === 'function') onChange(items);
    }, (err) => {
    });
    return unsub;
  },

  // Add symptom
  async addSymptom(symptomData) {
    // Filter out undefined values to prevent Firestore errors
    const cleanData = Object.fromEntries(
      Object.entries(symptomData).filter(([_, value]) => value !== undefined)
    );
    
    const docRef = await addDoc(collection(db, COLLECTIONS.SYMPTOMS), {
      ...cleanData,
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
      const data = { id: docSnap.id, ...convertTimestamps(docSnap.data()) };
      return normalizeGenomicProfile(data);
    }
    return null;
  },

  // Create or update genomic profile
  async saveGenomicProfile(patientId, profileData) {
    const docRef = doc(db, COLLECTIONS.GENOMIC_PROFILES, patientId);
    const normalized = normalizeGenomicProfile({ id: patientId, patientId, ...profileData });
    await setDoc(docRef, {
      ...normalized,
      id: patientId,
      patientId,
      updatedAt: serverTimestamp(),
      createdAt: profileData.createdAt || serverTimestamp()
    }, { merge: true });
    return patientId;
  }
};

// ==================== JOURNAL NOTE SERVICES ====================

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

// Normalize genomic profile shape to a consistent schema used by the UI
function normalizeGenomicProfile(profile = {}) {
  const p = { ...profile };

  // Ensure mutations array exists and normalize each entry
  const rawMutations = Array.isArray(p.mutations) ? p.mutations : (p.variants || p.mut || []);
  const mutations = rawMutations.map((m) => {
    const mutation = typeof m === 'string' ? { variant: m } : { ...m };
    // Check multiple fields for DNA/protein notation: variant, alteration, dna, dnaChange
    const raw = (mutation.variant || '') + ' ' + (mutation.alteration || '') + ' ' + (mutation.type || '') + ' ' + (mutation.note || '');
    const dnaMatch = raw.match(/c\.[^\s,;)]*/i);
    const proteinMatch = raw.match(/p\.[^\s,;)]*/i);
    const copyMatch = raw.match(/(?:copy number|copy|cn|copies)[:=\s]*([0-9.]+)/i);

    // Check alteration field first if it contains DNA notation
    let dna = mutation.dna || mutation.dnaChange;
    if (!dna && mutation.alteration) {
      const altDnaMatch = mutation.alteration.match(/c\.[^\s,;)]*/i);
      if (altDnaMatch) {
        dna = altDnaMatch[0];
      } else if (mutation.alteration.match(/^c\./i)) {
        // If alteration starts with c., use it as DNA
        dna = mutation.alteration;
      }
    }
    if (!dna && dnaMatch) {
      dna = dnaMatch[0];
    }
    
    let protein = mutation.protein || mutation.aminoAcidChange;
    if (!protein && mutation.alteration) {
      const altProteinMatch = mutation.alteration.match(/p\.[^\s,;)]*/i);
      if (altProteinMatch) {
        protein = altProteinMatch[0];
      }
    }
    if (!protein && proteinMatch) {
      protein = proteinMatch[0];
    }
    const copyNumber = mutation.copyNumber || mutation.cn || (copyMatch ? parseFloat(copyMatch[1]) : (mutation.copy ? parseFloat(mutation.copy) : undefined));
    const gene = mutation.gene || mutation.symbol || mutation.name || (mutation.variant ? (mutation.variant.split(/[\s:]/)[0] || null) : null);
    const significance = mutation.significance || mutation.clinicalSignificance || mutation.annotation;
    const kind = mutation.type || (mutation.germline ? 'Germline' : mutation.somatic ? 'Somatic' : null);

    const out = {
      gene: gene || null,
      variant: mutation.variant || null,
      dna: dna || null,
      protein: protein || null,
      copyNumber: typeof copyNumber === 'number' ? copyNumber : null,
      type: mutation.type || null,
      significance: significance || null,
      source: mutation.source || null,
      // Preserve variant allele frequency and other AI-extracted fields
      // Check multiple possible field names: variantAlleleFrequency, vaf, frequency, VAF
      variantAlleleFrequency: (() => {
        const vaf = mutation.variantAlleleFrequency || mutation.vaf || mutation.VAF || mutation.frequency;
        if (vaf === undefined || vaf === null) return null;
        if (typeof vaf === 'number') return isNaN(vaf) ? null : vaf;
        const parsed = parseFloat(vaf);
        if (!isNaN(parsed)) {
          return parsed;
        }
        return null;
      })(),
      alteration: mutation.alteration || null,
      mutationType: mutation.mutationType || null,
      therapyImplication: mutation.therapyImplication || null,
      fdaApprovedTherapy: mutation.fdaApprovedTherapy || null
    };
    return out;
  });

  // Collect CNV/amplification entries either from mutations or from top-level fields
  const cnvs = [];
  // From explicit cnv list
  if (Array.isArray(p.cnvs)) {
    p.cnvs.forEach(c => {
      cnvs.push({ gene: c.gene || c.symbol || null, copyNumber: c.copyNumber || c.cn || null, note: c.note || null });
    });
  }
  // From mutations that include copyNumber
  mutations.forEach(m => {
    if (m.copyNumber && m.gene) cnvs.push({ gene: m.gene, copyNumber: m.copyNumber });
  });
  // From top-level fields like copyNumberMap or copyNumbers
  if (p.copyNumberMap && typeof p.copyNumberMap === 'object') {
    Object.keys(p.copyNumberMap).forEach(g => cnvs.push({ gene: g, copyNumber: Number(p.copyNumberMap[g]) }));
  }

  // Normalize biomarkers
  const tmbValue = p.tmbValue || (typeof p.tmb === 'string' && p.tmb.match(/[0-9.]+/) ? parseFloat(p.tmb.match(/[0-9.]+/)[0]) : null);
  const hrdScore = p.hrdScore || (p.hrd && typeof p.hrd === 'number' ? p.hrd : null);
  const msi = p.msi || p.msiStatus || (p.microsatelliteInstability ? p.microsatelliteInstability.status : null);
  const pdl1 = p.pdl1 || p.pdL1 || p.pdl1Expression || null;

  return {
    ...p,
    mutations,
    cnvs: cnvs.length ? cnvs : (Array.isArray(p.cnvs) ? p.cnvs : []),
    tmbValue: tmbValue || null,
    hrdScore: hrdScore || null,
    msi: msi || null,
    pdl1: pdl1 || null
  };
}

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

// ==================== ADVANCED CLINICAL TRIAL SERVICES ====================
// Import advanced trial services (JRCT integration, matching, etc.)
// JRCT integration removed — expose the trial aggregation service instead
export * as trialAggregator from '../services/clinicalTrials/trialSearchService';
export { default as trialMatcher } from '../services/clinicalTrials/trialMatcher';
export { default as clinicalTrialsService } from '../services/clinicalTrials/clinicalTrialsService';








