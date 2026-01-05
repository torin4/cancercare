import { labService, vitalService, documentService } from '../firebase/services';

/**
 * Find orphaned values for a specific date from documents with multiple dates
 * This is useful when a document has multiple dates and some values might be orphaned
 * 
 * @param {string} userId - User ID
 * @param {string} targetDate - Date filter (YYYY-MM-DD format)
 * @param {string|null} documentId - Optional document ID to check. If provided, only checks values from that document
 * @returns {Object} Cleanup results
 */
export async function findOrphanedValuesForDate(userId, targetDate, documentId = null) {
  const results = {
    orphanedLabValues: [],
    orphanedVitalValues: [],
    errors: []
  };

  try {
    // Parse target date
    const parts = targetDate.split('-');
    if (parts.length !== 3) {
      throw new Error('Invalid date format. Use YYYY-MM-DD');
    }
    const targetDateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    targetDateObj.setHours(0, 0, 0, 0);

    // Get all documents to check which documentIds are valid
    const allDocuments = await documentService.getDocuments(userId);
    const validDocumentIds = new Set(allDocuments.map(doc => doc.id));

    // If documentId is provided, verify it exists
    if (documentId && !validDocumentIds.has(documentId)) {
      // Document doesn't exist - all values with this documentId are orphaned
      const allLabs = await labService.getLabs(userId);
      for (const lab of allLabs) {
        const values = await labService.getLabValues(lab.id);
        for (const value of values) {
          if (value.documentId === documentId) {
            // Check if date matches
            let valueDate = null;
            if (value.date?.toDate) {
              const firestoreDate = value.date.toDate();
              valueDate = new Date(firestoreDate.getFullYear(), firestoreDate.getMonth(), firestoreDate.getDate());
            } else if (value.date instanceof Date) {
              valueDate = new Date(value.date.getFullYear(), value.date.getMonth(), value.date.getDate());
            } else if (typeof value.date === 'string') {
              const parts = value.date.split('-');
              if (parts.length === 3) {
                valueDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
              }
            }

            if (valueDate && valueDate.getTime() === targetDateObj.getTime()) {
              results.orphanedLabValues.push({
                labId: lab.id,
                labName: lab.name || lab.label || lab.labType,
                valueId: value.id,
                value: value.value,
                date: value.date,
                documentId: value.documentId,
                reason: `Document ID ${documentId} does not exist`
              });
            }
          }
        }
      }

      // Same for vitals
      const allVitals = await vitalService.getVitals(userId);
      for (const vital of allVitals) {
        const values = await vitalService.getVitalValues(vital.id);
        for (const value of values) {
          if (value.documentId === documentId) {
            // Check if date matches
            let valueDate = null;
            if (value.date?.toDate) {
              const firestoreDate = value.date.toDate();
              valueDate = new Date(firestoreDate.getFullYear(), firestoreDate.getMonth(), firestoreDate.getDate());
            } else if (value.date instanceof Date) {
              valueDate = new Date(value.date.getFullYear(), value.date.getMonth(), value.date.getDate());
            } else if (typeof value.date === 'string') {
              const parts = value.date.split('-');
              if (parts.length === 3) {
                valueDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
              }
            }

            if (valueDate && valueDate.getTime() === targetDateObj.getTime()) {
              results.orphanedVitalValues.push({
                vitalId: vital.id,
                vitalName: vital.name || vital.label || vital.vitalType,
                valueId: value.id,
                value: value.value,
                date: value.date,
                documentId: value.documentId,
                reason: `Document ID ${documentId} does not exist`
              });
            }
          }
        }
      }
    } else {
      // Check all values for the target date
      return await findAndCleanupOrphanedValues(userId, targetDate);
    }

    return results;
  } catch (error) {
    results.errors.push(`Error finding orphaned values: ${error.message}`);
    throw error;
  }
}

/**
 * Find and clean up orphaned values for a specific date
 * Orphaned values are those that:
 * 1. Have documentId: null (legacy values)
 * 2. Have a documentId that doesn't exist in the documents collection
 * 3. Are from a specific date (optional filter)
 * 
 * @param {string} userId - User ID
 * @param {string|null} targetDate - Optional date filter (YYYY-MM-DD format). If null, checks all orphaned values
 * @returns {Object} Cleanup results
 */
export async function findAndCleanupOrphanedValues(userId, targetDate = null) {
  const results = {
    orphanedLabValues: [],
    orphanedVitalValues: [],
    deletedLabValues: 0,
    deletedVitalValues: 0,
    errors: []
  };

  try {
    // Get all documents to check which documentIds are valid
    const allDocuments = await documentService.getDocuments(userId);
    const validDocumentIds = new Set(allDocuments.map(doc => doc.id));

    // Parse target date if provided
    let targetDateObj = null;
    if (targetDate) {
      const parts = targetDate.split('-');
      if (parts.length === 3) {
        targetDateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        targetDateObj.setHours(0, 0, 0, 0);
      }
    }

    // Check all lab values
    const allLabs = await labService.getLabs(userId);
    for (const lab of allLabs) {
      try {
        const values = await labService.getLabValues(lab.id);
        for (const value of values) {
          let isOrphaned = false;
          let reason = '';

          // Check if value has no documentId (legacy)
          if (!value.documentId) {
            isOrphaned = true;
            reason = 'No documentId (legacy value)';
          } 
          // Check if documentId doesn't exist
          else if (value.documentId && !validDocumentIds.has(value.documentId)) {
            isOrphaned = true;
            reason = `Document ID ${value.documentId} does not exist`;
          }

          // If target date is specified, check if value matches that date
          if (isOrphaned && targetDateObj) {
            let valueDate = null;
            if (value.date?.toDate) {
              const firestoreDate = value.date.toDate();
              valueDate = new Date(firestoreDate.getFullYear(), firestoreDate.getMonth(), firestoreDate.getDate());
            } else if (value.date instanceof Date) {
              valueDate = new Date(value.date.getFullYear(), value.date.getMonth(), value.date.getDate());
            } else if (typeof value.date === 'string') {
              const parts = value.date.split('-');
              if (parts.length === 3) {
                valueDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
              }
            }

            // Only include if date matches
            if (valueDate && valueDate.getTime() !== targetDateObj.getTime()) {
              isOrphaned = false;
            }
          }

          if (isOrphaned) {
            results.orphanedLabValues.push({
              labId: lab.id,
              labName: lab.name || lab.label || lab.labType,
              valueId: value.id,
              value: value.value,
              date: value.date,
              documentId: value.documentId,
              reason
            });
          }
        }
      } catch (error) {
        results.errors.push(`Error checking lab ${lab.id}: ${error.message}`);
      }
    }

    // Check all vital values
    const allVitals = await vitalService.getVitals(userId);
    for (const vital of allVitals) {
      try {
        const values = await vitalService.getVitalValues(vital.id);
        for (const value of values) {
          let isOrphaned = false;
          let reason = '';

          // Check if value has no documentId (legacy)
          if (!value.documentId) {
            isOrphaned = true;
            reason = 'No documentId (legacy value)';
          } 
          // Check if documentId doesn't exist
          else if (value.documentId && !validDocumentIds.has(value.documentId)) {
            isOrphaned = true;
            reason = `Document ID ${value.documentId} does not exist`;
          }

          // If target date is specified, check if value matches that date
          if (isOrphaned && targetDateObj) {
            let valueDate = null;
            if (value.date?.toDate) {
              const firestoreDate = value.date.toDate();
              valueDate = new Date(firestoreDate.getFullYear(), firestoreDate.getMonth(), firestoreDate.getDate());
            } else if (value.date instanceof Date) {
              valueDate = new Date(value.date.getFullYear(), value.date.getMonth(), value.date.getDate());
            } else if (typeof value.date === 'string') {
              const parts = value.date.split('-');
              if (parts.length === 3) {
                valueDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
              }
            }

            // Only include if date matches
            if (valueDate && valueDate.getTime() !== targetDateObj.getTime()) {
              isOrphaned = false;
            }
          }

          if (isOrphaned) {
            results.orphanedVitalValues.push({
              vitalId: vital.id,
              vitalName: vital.name || vital.label || vital.vitalType,
              valueId: value.id,
              value: value.value,
              date: value.date,
              documentId: value.documentId,
              reason
            });
          }
        }
      } catch (error) {
        results.errors.push(`Error checking vital ${vital.id}: ${error.message}`);
      }
    }

    return results;
  } catch (error) {
    results.errors.push(`Error finding orphaned values: ${error.message}`);
    throw error;
  }
}

/**
 * Delete orphaned values found by findAndCleanupOrphanedValues
 * @param {Object} orphanedData - Results from findAndCleanupOrphanedValues
 * @returns {Object} Deletion results
 */
export async function deleteOrphanedValues(orphanedData) {
  const results = {
    deletedLabValues: 0,
    deletedVitalValues: 0,
    errors: []
  };

  // Delete orphaned lab values
  for (const orphaned of orphanedData.orphanedLabValues) {
    try {
      await labService.deleteLabValue(orphaned.labId, orphaned.valueId);
      results.deletedLabValues++;
    } catch (error) {
      results.errors.push(`Error deleting lab value ${orphaned.valueId}: ${error.message}`);
    }
  }

  // Delete orphaned vital values
  for (const orphaned of orphanedData.orphanedVitalValues) {
    try {
      await vitalService.deleteVitalValue(orphaned.vitalId, orphaned.valueId);
      results.deletedVitalValues++;
    } catch (error) {
      results.errors.push(`Error deleting vital value ${orphaned.valueId}: ${error.message}`);
    }
  }

  return results;
}

