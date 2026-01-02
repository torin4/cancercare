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
    if (converted[key] && converted[key].toDate) {
      converted[key] = converted[key].toDate();
    }
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
    if (docSnap.exists()) {
      // Document exists, update it
      await updateDoc(docRef, {
        value: valueData.value,
        date: valueData.date,
        notes: valueData.notes || ''
      });
    } else {
      // Document doesn't exist, create it
      await setDoc(docRef, {
        value: valueData.value,
        date: valueData.date,
        notes: valueData.notes || ''
      });
    }
  },

  // Delete individual lab document (one data point)
  async deleteLab(labId) {
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

    // Try to delete subcollection values first
    // If this fails due to permissions, we'll still try to delete the main document
    // Firestore will automatically clean up orphaned subcollections
    try {
      const valuesRef = collection(db, COLLECTIONS.LABS, labId, 'values');
      const valuesSnapshot = await getDocs(valuesRef);
      
      // Delete values one by one sequentially to avoid overwhelming security rules
      for (const valueDoc of valuesSnapshot.docs) {
        try {
          await deleteDoc(valueDoc.ref);
        } catch (error) {
          // Log but continue - don't fail the entire operation
          console.warn(`Error deleting lab value ${valueDoc.id}:`, error.message);
        }
      }
    } catch (error) {
      // Log but continue - main document deletion should still work
      // This might fail if we can't even read the subcollection, but that's okay
      console.warn('Error accessing lab subcollection values:', error.message);
    }
    
    // Delete the main lab document
    // This should work if the user owns the lab (security rules will check)
    try {
      await deleteDoc(labRef);
    } catch (error) {
      // If this fails, it's a real permissions issue
      console.error('Error deleting lab document:', error);
      console.error('Lab ID:', labId);
      console.error('Lab patientId:', labData.patientId);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      throw new Error(`Failed to delete lab: ${error.message}. Code: ${error.code}`);
    }
  },

  // Delete individual lab value (from subcollection if used)
  async deleteLabValue(labId, valueId) {
    await deleteDoc(doc(db, COLLECTIONS.LABS, labId, 'values', valueId));
  },

  // Delete all labs of a specific type for a patient
  async deleteAllLabsByType(patientId, labType) {
    const q = query(
      collection(db, COLLECTIONS.LABS),
      where('patientId', '==', patientId),
      where('labType', '==', labType)
    );
    const querySnapshot = await getDocs(q);
    const deletePromises = querySnapshot.docs.map(async (docSnap) => {
      // Also delete any subcollection values
      try {
        const valuesRef = collection(db, COLLECTIONS.LABS, docSnap.id, 'values');
        const valuesSnapshot = await getDocs(valuesRef);
        const deleteValuePromises = valuesSnapshot.docs.map(d => deleteDoc(d.ref));
        await Promise.all(deleteValuePromises);
      } catch (error) {
        console.warn(`Error deleting subcollection values for lab ${docSnap.id}:`, error);
      }
      return deleteDoc(docSnap.ref);
    });
    await Promise.all(deletePromises);
    return querySnapshot.docs.length;
  },

  // Clean up orphaned lab documents (labs with no values)
  async cleanupOrphanedLabs(patientId) {
    console.log(`[cleanupOrphanedLabs] Starting cleanup for patient ${patientId}`);
    const allLabs = await this.getLabs(patientId);
    console.log(`[cleanupOrphanedLabs] Found ${allLabs.length} total labs to check`);
    const orphanedLabs = [];
    
    // Check each lab for values
    for (const lab of allLabs) {
      try {
        const values = await this.getLabValues(lab.id);
        if (!values || values.length === 0) {
          orphanedLabs.push(lab);
          console.log(`[cleanupOrphanedLabs] Lab ${lab.id} (${lab.labType}) has no values - marked for deletion`);
        }
      } catch (error) {
        console.warn(`[cleanupOrphanedLabs] Error checking lab ${lab.id}:`, error);
        // If we can't check values, assume it's orphaned and try to delete
        orphanedLabs.push(lab);
      }
    }
    
    console.log(`[cleanupOrphanedLabs] Found ${orphanedLabs.length} orphaned labs (no values)`);
    
    // Delete orphaned labs
    let deletedCount = 0;
    for (const lab of orphanedLabs) {
      try {
        await this.deleteLab(lab.id);
        deletedCount++;
        console.log(`[cleanupOrphanedLabs] ✓ Deleted orphaned lab: ${lab.labType} (${lab.id})`);
      } catch (error) {
        console.warn(`[cleanupOrphanedLabs] ✗ Error deleting orphaned lab ${lab.id}:`, error);
      }
    }
    
    console.log(`[cleanupOrphanedLabs] Cleanup complete: ${deletedCount}/${orphanedLabs.length} labs deleted`);
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
    // Also delete any subcollection values
    try {
      const valuesRef = collection(db, COLLECTIONS.VITALS, vitalId, 'values');
      const valuesSnapshot = await getDocs(valuesRef);
      const deleteValuePromises = valuesSnapshot.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deleteValuePromises);
    } catch (error) {
      console.warn('Error deleting vital subcollection values:', error);
      // Continue with main document deletion even if subcollection deletion fails
    }
    await deleteDoc(doc(db, COLLECTIONS.VITALS, vitalId));
  },

  // Delete individual vital value (from subcollection if used)
  async deleteVitalValue(vitalId, valueId) {
    await deleteDoc(doc(db, COLLECTIONS.VITALS, vitalId, 'values', valueId));
  },

  // Delete all vitals of a specific type for a patient
  async deleteAllVitalsByType(patientId, vitalType) {
    const q = query(
      collection(db, COLLECTIONS.VITALS),
      where('patientId', '==', patientId),
      where('vitalType', '==', vitalType)
    );
    const querySnapshot = await getDocs(q);
    const deletePromises = querySnapshot.docs.map(async (docSnap) => {
      // Also delete any subcollection values
      try {
        const valuesRef = collection(db, COLLECTIONS.VITALS, docSnap.id, 'values');
        const valuesSnapshot = await getDocs(valuesRef);
        const deleteValuePromises = valuesSnapshot.docs.map(d => deleteDoc(d.ref));
        await Promise.all(deleteValuePromises);
      } catch (error) {
        console.warn(`Error deleting subcollection values for vital ${docSnap.id}:`, error);
      }
      return deleteDoc(docSnap.ref);
    });
    await Promise.all(deletePromises);
    return querySnapshot.docs.length;
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
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...convertTimestamps(doc.data())
    }));
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
    if (documentData.id) {
      const docRef = doc(db, COLLECTIONS.DOCUMENTS, documentData.id);
      await updateDoc(docRef, {
        ...documentData,
        updatedAt: serverTimestamp()
      });
      return documentData.id;
    } else {
      const docRef = await addDoc(collection(db, COLLECTIONS.DOCUMENTS), {
        ...documentData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return docRef.id;
    }
  },

  // Delete document
  async deleteDocument(docId) {
    await deleteDoc(doc(db, COLLECTIONS.DOCUMENTS, docId));
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
      console.warn('Symptoms subscription error:', err);
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
      console.log('Clearing health data for:', userId);

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

      console.log('Health data cleared successfully - patient profile preserved');
    } catch (error) {
      console.error('Error clearing health data:', error);
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

      console.log('Full user data deleted successfully');
    } catch (error) {
      console.error('Error deleting full user data:', error);
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







