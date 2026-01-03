import { labService, vitalService, medicationService } from '../firebase/services';

/**
 * Comprehensive document data cleanup service
 * Ensures ALL data associated with a document is properly removed from Firestore
 * including orphaned parent documents that have no values left
 */

/**
 * Clean up ALL data for a document (used before rescanning)
 * This removes ALL lab/vital values regardless of documentId to prevent duplicates
 * @param {string} documentId - The document ID to clean up
 * @param {string} userId - User ID for verification
 * @param {boolean} aggressiveCleanup - If true, deletes ALL values (not just matching documentId)
 * @returns {Object} Results of the cleanup operation
 */
export async function cleanupDocumentData(documentId, userId, aggressiveCleanup = true) {
  console.log(`[DocumentCleanup] Starting comprehensive cleanup for document ${documentId} (aggressive: ${aggressiveCleanup})`);

  const results = {
    labValuesDeleted: 0,
    vitalValuesDeleted: 0,
    medicationsDeleted: 0,
    orphanedLabsDeleted: 0,
    orphanedVitalsDeleted: 0,
    legacyLabValuesDeleted: 0,
    legacyVitalValuesDeleted: 0,
    errors: [],
    duration: 0
  };

  const startTime = Date.now();

  try {
    // Step 1: Delete all lab values with this documentId (or ALL if aggressive)
    console.log(`[DocumentCleanup] Step 1: Cleaning up lab values for document ${documentId}`);
    const labResults = await cleanupLabsByDocument(documentId, userId, aggressiveCleanup);
    results.labValuesDeleted = labResults.valuesDeleted;
    results.orphanedLabsDeleted = labResults.orphanedLabsDeleted;
    results.legacyLabValuesDeleted = labResults.legacyValuesDeleted || 0;

    // Step 2: Delete all vital values with this documentId (or ALL if aggressive)
    console.log(`[DocumentCleanup] Step 2: Cleaning up vital values for document ${documentId}`);
    const vitalResults = await cleanupVitalsByDocument(documentId, userId, aggressiveCleanup);
    results.vitalValuesDeleted = vitalResults.valuesDeleted;
    results.orphanedVitalsDeleted = vitalResults.orphanedVitalsDeleted;
    results.legacyVitalValuesDeleted = vitalResults.legacyValuesDeleted || 0;

    // Step 3: Delete all medications with this documentId
    console.log(`[DocumentCleanup] Step 3: Cleaning up medications for document ${documentId}`);
    const medicationResults = await cleanupMedicationsByDocument(documentId, userId);
    results.medicationsDeleted = medicationResults.medicationsDeleted;

    // Step 4: Run full orphaned cleanup to catch anything missed
    console.log(`[DocumentCleanup] Step 4: Running full orphaned cleanup`);
    const additionalOrphans = await runFullOrphanedCleanup(userId);
    results.orphanedLabsDeleted += additionalOrphans.labs;
    results.orphanedVitalsDeleted += additionalOrphans.vitals;

    results.duration = Date.now() - startTime;

    console.log(`[DocumentCleanup] ✓ Cleanup complete in ${results.duration}ms:`, {
      labValues: results.labValuesDeleted,
      vitalValues: results.vitalValuesDeleted,
      medications: results.medicationsDeleted,
      orphanedLabs: results.orphanedLabsDeleted,
      orphanedVitals: results.orphanedVitalsDeleted,
      legacyLabValues: results.legacyLabValuesDeleted,
      legacyVitalValues: results.legacyVitalValuesDeleted
    });

    return results;
  } catch (error) {
    results.errors.push(error.message);
    results.duration = Date.now() - startTime;
    console.error(`[DocumentCleanup] ✗ Cleanup failed after ${results.duration}ms:`, error);
    throw error;
  }
}

/**
 * Clean up all lab values associated with a document
 * @param {string} documentId - The document ID
 * @param {string} userId - User ID
 * @param {boolean} aggressiveCleanup - If true, deletes ALL values, not just matching documentId
 * @returns {Object} Cleanup results
 */
async function cleanupLabsByDocument(documentId, userId, aggressiveCleanup = false) {
  const results = {
    valuesDeleted: 0,
    orphanedLabsDeleted: 0,
    labsChecked: new Set(),
    legacyValuesDeleted: 0
  };

  try {
    // Get document to check creation time for legacy value matching
    const { documentService } = await import('../firebase/services');
    const docData = await documentService.getDocument(documentId);
    const docCreatedAt = docData?.createdAt ? (docData.createdAt.toDate ? docData.createdAt.toDate() : new Date(docData.createdAt)) : null;
    // Use a 5-minute window for legacy value matching (values created within 5 min of document)
    const legacyWindowMs = 5 * 60 * 1000; // 5 minutes
    
    console.log(`[LabCleanup] Checking labs for document ${documentId} (aggressive: ${aggressiveCleanup})`);
    if (docCreatedAt) {
      console.log(`[LabCleanup] Document created at: ${docCreatedAt.toISOString()}, using ${legacyWindowMs/1000}s window for legacy values`);
    }

    // Get all labs for this user
    const allLabs = await labService.getLabs(userId);
    console.log(`[LabCleanup] Checking ${allLabs.length} labs for document ${documentId}`);

    // Collect deletion operations for batch processing
    const deletionOps = [];

    for (const labDoc of allLabs) {
      try {
        const values = await labService.getLabValues(labDoc.id);
        let deletedFromThisLab = 0;

        for (const value of values) {
          let shouldDelete = false;
          let deleteReason = '';

          if (aggressiveCleanup) {
            shouldDelete = true;
            deleteReason = 'aggressive mode';
          } else if (value.documentId === documentId) {
            shouldDelete = true;
            deleteReason = 'matching documentId';
          } else if (!value.documentId && docCreatedAt) {
            // Legacy value: check if created around the same time as document
            const valueCreatedAt = value.createdAt?.toDate ? value.createdAt.toDate() : (value.createdAt ? new Date(value.createdAt) : null);
            if (valueCreatedAt) {
              const timeDiff = Math.abs(valueCreatedAt.getTime() - docCreatedAt.getTime());
              if (timeDiff <= legacyWindowMs) {
                shouldDelete = true;
                deleteReason = `legacy value (created ${Math.round(timeDiff/1000)}s from document)`;
                results.legacyValuesDeleted++;
              }
            }
          }

          if (shouldDelete) {
            deletionOps.push({
              labId: labDoc.id,
              valueId: value.id,
              label: labDoc.label || labDoc.labType,
              reason: deleteReason
            });
            deletedFromThisLab++;
          }
        }

        // Track labs that had deletions (might become orphaned)
        if (deletedFromThisLab > 0) {
          results.labsChecked.add(labDoc.id);
        }
      } catch (error) {
        console.warn(`[LabCleanup] Error checking lab ${labDoc.id}:`, error);
      }
    }

    // Execute deletions in parallel batches of 10
    console.log(`[LabCleanup] Deleting ${deletionOps.length} lab values in batches (${results.legacyValuesDeleted} legacy values)`);
    for (let i = 0; i < deletionOps.length; i += 10) {
      const batch = deletionOps.slice(i, i + 10);
      await Promise.all(batch.map(async (op) => {
        try {
          await labService.deleteLabValue(op.labId, op.valueId);
          results.valuesDeleted++;
          console.log(`[LabCleanup] ✓ Deleted ${op.label} value ${op.valueId} (${op.reason})`);
        } catch (error) {
          console.warn(`[LabCleanup] ✗ Failed to delete value ${op.valueId}:`, error.message);
        }
      }));
    }

    // Clean up orphaned labs (labs with no values left)
    console.log(`[LabCleanup] Checking ${results.labsChecked.size} labs for orphans`);
    for (const labId of results.labsChecked) {
      try {
        const remainingValues = await labService.getLabValues(labId);
        if (!remainingValues || remainingValues.length === 0) {
          await labService.deleteLab(labId);
          results.orphanedLabsDeleted++;
          console.log(`[LabCleanup] ✓ Deleted orphaned lab ${labId}`);
        }
      } catch (error) {
        console.warn(`[LabCleanup] ✗ Error checking/deleting orphaned lab ${labId}:`, error.message);
      }
    }

    console.log(`[LabCleanup] Complete: ${results.valuesDeleted} values deleted (${results.legacyValuesDeleted} legacy), ${results.orphanedLabsDeleted} orphaned labs removed`);
    return results;
  } catch (error) {
    console.error('[LabCleanup] Error during lab cleanup:', error);
    throw error;
  }
}

/**
 * Clean up all vital values associated with a document
 * @param {string} documentId - The document ID
 * @param {string} userId - User ID
 * @param {boolean} aggressiveCleanup - If true, deletes ALL values, not just matching documentId
 * @returns {Object} Cleanup results
 */
async function cleanupVitalsByDocument(documentId, userId, aggressiveCleanup = false) {
  const results = {
    valuesDeleted: 0,
    orphanedVitalsDeleted: 0,
    vitalsChecked: new Set(),
    legacyValuesDeleted: 0
  };

  try {
    // Get document to check creation time for legacy value matching
    const { documentService } = await import('../firebase/services');
    const docData = await documentService.getDocument(documentId);
    const docCreatedAt = docData?.createdAt ? (docData.createdAt.toDate ? docData.createdAt.toDate() : new Date(docData.createdAt)) : null;
    // Use a 5-minute window for legacy value matching (values created within 5 min of document)
    const legacyWindowMs = 5 * 60 * 1000; // 5 minutes
    
    console.log(`[VitalCleanup] Checking vitals for document ${documentId} (aggressive: ${aggressiveCleanup})`);
    if (docCreatedAt) {
      console.log(`[VitalCleanup] Document created at: ${docCreatedAt.toISOString()}, using ${legacyWindowMs/1000}s window for legacy values`);
    }

    // Get all vitals for this user
    const allVitals = await vitalService.getVitals(userId);
    console.log(`[VitalCleanup] Checking ${allVitals.length} vitals for document ${documentId}`);

    // Collect deletion operations for batch processing
    const deletionOps = [];

    for (const vitalDoc of allVitals) {
      try {
        const values = await vitalService.getVitalValues(vitalDoc.id);
        let deletedFromThisVital = 0;

        for (const value of values) {
          let shouldDelete = false;
          let deleteReason = '';

          if (aggressiveCleanup) {
            shouldDelete = true;
            deleteReason = 'aggressive mode';
          } else if (value.documentId === documentId) {
            shouldDelete = true;
            deleteReason = 'matching documentId';
          } else if (!value.documentId && docCreatedAt) {
            // Legacy value: check if created around the same time as document
            const valueCreatedAt = value.createdAt?.toDate ? value.createdAt.toDate() : (value.createdAt ? new Date(value.createdAt) : null);
            if (valueCreatedAt) {
              const timeDiff = Math.abs(valueCreatedAt.getTime() - docCreatedAt.getTime());
              if (timeDiff <= legacyWindowMs) {
                shouldDelete = true;
                deleteReason = `legacy value (created ${Math.round(timeDiff/1000)}s from document)`;
                results.legacyValuesDeleted++;
              }
            }
          }

          if (shouldDelete) {
            deletionOps.push({
              vitalId: vitalDoc.id,
              valueId: value.id,
              label: vitalDoc.label || vitalDoc.vitalType,
              reason: deleteReason
            });
            deletedFromThisVital++;
          }
        }

        // Track vitals that had deletions (might become orphaned)
        if (deletedFromThisVital > 0) {
          results.vitalsChecked.add(vitalDoc.id);
        }
      } catch (error) {
        console.warn(`[VitalCleanup] Error checking vital ${vitalDoc.id}:`, error);
      }
    }

    // Execute deletions in parallel batches of 10
    console.log(`[VitalCleanup] Deleting ${deletionOps.length} vital values in batches (${results.legacyValuesDeleted} legacy values)`);
    for (let i = 0; i < deletionOps.length; i += 10) {
      const batch = deletionOps.slice(i, i + 10);
      await Promise.all(batch.map(async (op) => {
        try {
          await vitalService.deleteVitalValue(op.vitalId, op.valueId);
          results.valuesDeleted++;
          console.log(`[VitalCleanup] ✓ Deleted ${op.label} value ${op.valueId} (${op.reason})`);
        } catch (error) {
          console.warn(`[VitalCleanup] ✗ Failed to delete value ${op.valueId}:`, error.message);
        }
      }));
    }

    // Clean up orphaned vitals (vitals with no values left)
    console.log(`[VitalCleanup] Checking ${results.vitalsChecked.size} vitals for orphans`);
    for (const vitalId of results.vitalsChecked) {
      try {
        const remainingValues = await vitalService.getVitalValues(vitalId);
        if (!remainingValues || remainingValues.length === 0) {
          await vitalService.deleteVital(vitalId);
          results.orphanedVitalsDeleted++;
          console.log(`[VitalCleanup] ✓ Deleted orphaned vital ${vitalId}`);
        }
      } catch (error) {
        console.warn(`[VitalCleanup] ✗ Error checking/deleting orphaned vital ${vitalId}:`, error.message);
      }
    }

    console.log(`[VitalCleanup] Complete: ${results.valuesDeleted} values deleted (${results.legacyValuesDeleted} legacy), ${results.orphanedVitalsDeleted} orphaned vitals removed`);
    return results;
  } catch (error) {
    console.error('[VitalCleanup] Error during vital cleanup:', error);
    throw error;
  }
}

/**
 * Clean up all medications associated with a document
 * @param {string} documentId - The document ID
 * @param {string} userId - User ID
 * @returns {Object} Cleanup results
 */
async function cleanupMedicationsByDocument(documentId, userId) {
  const results = {
    medicationsDeleted: 0
  };

  try {
    // Get all medications for this user
    const allMedications = await medicationService.getMedications(userId);
    console.log(`[MedicationCleanup] Checking ${allMedications.length} medications for document ${documentId}`);

    // Collect medications to delete
    const medicationsToDelete = allMedications.filter(med => med.documentId === documentId);

    console.log(`[MedicationCleanup] Deleting ${medicationsToDelete.length} medications in batches`);

    // Delete in parallel batches of 10
    for (let i = 0; i < medicationsToDelete.length; i += 10) {
      const batch = medicationsToDelete.slice(i, i + 10);
      await Promise.all(batch.map(async (med) => {
        try {
          await medicationService.deleteMedication(med.id);
          results.medicationsDeleted++;
          console.log(`[MedicationCleanup] ✓ Deleted medication ${med.name} (${med.id})`);
        } catch (error) {
          console.warn(`[MedicationCleanup] ✗ Failed to delete medication ${med.id}:`, error.message);
        }
      }));
    }

    console.log(`[MedicationCleanup] Complete: ${results.medicationsDeleted} medications deleted`);
    return results;
  } catch (error) {
    console.error('[MedicationCleanup] Error during medication cleanup:', error);
    throw error;
  }
}

/**
 * Run full orphaned cleanup to catch any missed orphans
 * @param {string} userId - User ID
 * @returns {Object} Number of orphaned items deleted
 */
async function runFullOrphanedCleanup(userId) {
  const results = {
    labs: 0,
    vitals: 0
  };

  try {
    // Clean up orphaned labs
    const orphanedLabs = await labService.cleanupOrphanedLabs(userId);
    results.labs = orphanedLabs;

    // Clean up orphaned vitals (using new function)
    const orphanedVitals = await vitalService.cleanupOrphanedVitals(userId);
    results.vitals = orphanedVitals;

    console.log(`[OrphanedCleanup] Found and removed ${results.labs} orphaned labs, ${results.vitals} orphaned vitals`);
    return results;
  } catch (error) {
    console.error('[OrphanedCleanup] Error during orphaned cleanup:', error);
    throw error;
  }
}

/**
 * Verify that all data for a document has been cleaned up
 * @param {string} documentId - The document ID
 * @param {string} userId - User ID
 * @returns {Object} Verification results
 */
export async function verifyCleanupComplete(documentId, userId) {
  console.log(`[CleanupVerification] Verifying cleanup for document ${documentId}`);

  const results = {
    labValuesRemaining: 0,
    vitalValuesRemaining: 0,
    medicationsRemaining: 0,
    isComplete: true
  };

  try {
    // Check labs
    const allLabs = await labService.getLabs(userId);
    for (const labDoc of allLabs) {
      const values = await labService.getLabValues(labDoc.id);
      const remainingValues = values.filter(v => v.documentId === documentId);
      results.labValuesRemaining += remainingValues.length;
    }

    // Check vitals
    const allVitals = await vitalService.getVitals(userId);
    for (const vitalDoc of allVitals) {
      const values = await vitalService.getVitalValues(vitalDoc.id);
      const remainingValues = values.filter(v => v.documentId === documentId);
      results.vitalValuesRemaining += remainingValues.length;
    }

    // Check medications
    const allMedications = await medicationService.getMedications(userId);
    results.medicationsRemaining = allMedications.filter(med => med.documentId === documentId).length;

    results.isComplete = (
      results.labValuesRemaining === 0 &&
      results.vitalValuesRemaining === 0 &&
      results.medicationsRemaining === 0
    );

    if (!results.isComplete) {
      console.warn(`[CleanupVerification] ⚠️ Cleanup incomplete! ${results.labValuesRemaining} lab values, ${results.vitalValuesRemaining} vital values, and ${results.medicationsRemaining} medications still remain`);
    } else {
      console.log(`[CleanupVerification] ✓ Cleanup verified complete`);
    }

    return results;
  } catch (error) {
    console.error('[CleanupVerification] Error during verification:', error);
    throw error;
  }
}
