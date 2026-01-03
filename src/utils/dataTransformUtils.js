// Data transformation utilities for converting Firestore data to UI format

import { labService, vitalService } from '../firebase/services';
import { getCancerRelevanceScore } from './healthUtils';
import { normalizeVitalName, getVitalDisplayName, normalizeLabName } from './normalizationUtils';
import { formatDateString } from './helpers';

// Transform Firestore labs data to UI format
export const transformLabsData = async (labs) => {
  const grouped = {};

  // Process each lab and load its values
  // First, group labs by labType to handle multiple lab documents with same type
  // Normalize lab types to ensure variations (e.g., "crp", "CRP", "c-reactive protein") are grouped together
  const labsByType = {};
  for (const lab of labs) {
    // Normalize the labType to a canonical key (e.g., "crp", "ca125")
    // Try normalizing both labType and label, fallback to lowercase labType
    const normalizedLabType = normalizeLabName(lab.labType) || 
                               normalizeLabName(lab.label) || 
                               (lab.labType || 'unknown').toLowerCase();
    if (!labsByType[normalizedLabType]) {
      labsByType[normalizedLabType] = [];
    }
    labsByType[normalizedLabType].push(lab);
  }

  // Load ALL lab values in parallel FIRST (much faster than sequential)
  const allLabValuePromises = labs.map(lab => 
    labService.getLabValues(lab.id).then(values => ({ labId: lab.id, values: values || [] }))
  );
  const allLabValues = await Promise.all(allLabValuePromises);
  const labValuesMap = {};
  allLabValues.forEach(({ labId, values }) => {
    labValuesMap[labId] = values;
  });

  // Process each unique labType (merge values from all lab documents with same type)
  for (const [labType, labDocuments] of Object.entries(labsByType)) {
    // Use the first lab document as the primary one (most recent or first found)
    const primaryLab = labDocuments[0];
    
    if (!grouped[labType]) {
      grouped[labType] = {
        id: primaryLab.id, // Store primary lab document ID for adding values
        name: primaryLab.label,
        unit: primaryLab.unit,
        current: primaryLab.currentValue,
        status: primaryLab.status || 'normal',
        trend: 'stable',
        normalRange: primaryLab.normalRange,
        isNumeric: typeof primaryLab.currentValue === 'number',
        relevanceScore: getCancerRelevanceScore(labType),
        data: []
      };
    }

    // Initialize deduplication sets OUTSIDE the loop so they persist across all lab documents with same type
    const existingIds = new Set(grouped[labType].data.map(d => d.id));
    const existingValueKeys = new Set(grouped[labType].data.map(d => {
      // Use day-level timestamp for deduplication
      const dayStart = d.dateOriginal ? new Date(d.dateOriginal.getFullYear(), d.dateOriginal.getMonth(), d.dateOriginal.getDate()).getTime() : d.timestamp;
      return `${dayStart}_${d.value}`;
    }));
    let totalSkippedCount = 0;

    // Process all lab documents with this type to merge their values (values already loaded)
    for (const lab of labDocuments) {
      // Get lab values from pre-loaded map
      try {
        const values = labValuesMap[lab.id] || [];
        if (values && values.length > 0) {
          // Sort by date (oldest first) for trend calculation
          // Round timestamps to day level (midnight) to handle timezone issues and ensure same-day values are treated as duplicates
          const sortedValues = values
            .map(v => {
              // Convert Firestore Timestamp to local date (avoid timezone shift)
              let date;
              if (v.date?.toDate) {
                // Firestore Timestamp - convert to local date using date components
                const firestoreDate = v.date.toDate();
                // Use local date components to avoid timezone shift
                date = new Date(firestoreDate.getFullYear(), firestoreDate.getMonth(), firestoreDate.getDate());
              } else if (v.date) {
                // Already a Date object or string - parse as local date
                if (v.date instanceof Date) {
                  date = new Date(v.date.getFullYear(), v.date.getMonth(), v.date.getDate());
                } else {
                  // String date - parse as local
                  const dateStr = formatDateString(v.date);
                  if (dateStr) {
                    const parts = dateStr.split('-');
                    date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                  } else {
                    date = new Date();
                  }
                }
              } else {
                date = new Date();
              }
              
              const timestamp = date.getTime();
              // Round to day level (midnight) for deduplication - this prevents same-day duplicates with different times
              const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
              return {
                id: v.id,
                value: v.value,
                date: date,
                timestamp: timestamp, // Keep original timestamp for sorting
                dayTimestamp: dayStart, // Use day-level timestamp for deduplication
                notes: v.notes || '' // Include notes
              };
            })
            .sort((a, b) => a.timestamp - b.timestamp);

          // Add all values to data array, avoiding duplicates by ID and day+value
          // Use the persistent deduplication sets that span all lab documents with this type
          sortedValues.forEach(v => {
            const valueKey = `${v.dayTimestamp}_${v.value}`;
            // Only add if we haven't seen this ID or day+value combination before
            // This prevents duplicates from multiple lab documents or reprocessing issues
            if (existingIds.has(v.id)) {
              totalSkippedCount++;
            } else if (existingValueKeys.has(valueKey)) {
              totalSkippedCount++;
            } else {
              // Format date for display (use local date components to avoid timezone shift)
              const displayDate = v.date instanceof Date 
                ? v.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : (v.date ? new Date(v.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '');
              
              grouped[labType].data.push({
                id: v.id,
                date: displayDate,
                dateOriginal: v.date, // Store original Date object for editing
                value: v.value,
                timestamp: v.timestamp,
                notes: v.notes || '' // Store notes for editing
              });
              existingIds.add(v.id);
              existingValueKeys.add(valueKey);
            }
          });
        } else {
          // No values in subcollection - only use lab document data if currentValue exists
          // (If currentValue is null, it means all values were deleted, so don't add it back)
          if (lab.currentValue != null && lab.currentValue !== undefined && lab.currentValue !== '') {
            // Convert to local date to avoid timezone shift
            let timestamp;
            if (lab.createdAt?.toDate) {
              const firestoreDate = lab.createdAt.toDate();
              timestamp = new Date(firestoreDate.getFullYear(), firestoreDate.getMonth(), firestoreDate.getDate());
            } else if (lab.createdAt) {
              if (lab.createdAt instanceof Date) {
                timestamp = new Date(lab.createdAt.getFullYear(), lab.createdAt.getMonth(), lab.createdAt.getDate());
              } else {
                const dateStr = formatDateString(lab.createdAt);
                if (dateStr) {
                  const parts = dateStr.split('-');
                  timestamp = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                } else {
                  timestamp = new Date();
                }
              }
            } else {
              timestamp = new Date();
            }
            
            const dayStart = new Date(timestamp.getFullYear(), timestamp.getMonth(), timestamp.getDate()).getTime();
            const valueKey = `${dayStart}_${lab.currentValue}`;
            
            // Check if this fallback value is already in the data array (from another lab document with same type)
            // Use the persistent deduplication sets
            if (!existingIds.has(lab.id) && !existingValueKeys.has(valueKey)) {
              grouped[labType].data.push({
                id: lab.id,
                date: timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                dateOriginal: timestamp, // Store original Date object for editing
                value: lab.currentValue,
                timestamp: timestamp.getTime(),
                notes: '' // No notes for initial value
              });
              existingIds.add(lab.id);
              existingValueKeys.add(valueKey);
            }
          }
          // If currentValue is null/empty, don't add anything - all values were deleted
        }
      } catch (error) {
        console.error(`Error loading values for lab ${lab.id}:`, error);
        // Fallback to lab document data only if currentValue exists
        // (If currentValue is null, it means all values were deleted, so don't add it back)
        if (lab.currentValue != null && lab.currentValue !== undefined && lab.currentValue !== '') {
          // Convert to local date to avoid timezone shift
          let timestamp;
          if (lab.createdAt?.toDate) {
            const firestoreDate = lab.createdAt.toDate();
            timestamp = new Date(firestoreDate.getFullYear(), firestoreDate.getMonth(), firestoreDate.getDate());
          } else if (lab.createdAt) {
            if (lab.createdAt instanceof Date) {
              timestamp = new Date(lab.createdAt.getFullYear(), lab.createdAt.getMonth(), lab.createdAt.getDate());
            } else {
              const dateStr = formatDateString(lab.createdAt);
              if (dateStr) {
                const parts = dateStr.split('-');
                timestamp = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
              } else {
                timestamp = new Date();
              }
            }
          } else {
            timestamp = new Date();
          }
          
          const dayStart = new Date(timestamp.getFullYear(), timestamp.getMonth(), timestamp.getDate()).getTime();
          const valueKey = `${dayStart}_${lab.currentValue}`;
          
          // Check if this fallback value is already in the data array (from another lab document with same type)
          // Use the persistent deduplication sets
          if (!existingIds.has(lab.id) && !existingValueKeys.has(valueKey)) {
            grouped[labType].data.push({
              id: lab.id,
              date: timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              dateOriginal: timestamp, // Store original Date object for editing
              value: lab.currentValue,
              timestamp: timestamp.getTime(),
              notes: '' // No notes for fallback value
            });
            existingIds.add(lab.id);
            existingValueKeys.add(valueKey);
          }
        }
        // If currentValue is null/empty, don't add anything - all values were deleted
      }
    }
    
    // CRITICAL: Sort the data array by timestamp after all values from all lab documents are added
    // This ensures the graph displays points in chronological order
    grouped[labType].data.sort((a, b) => a.timestamp - b.timestamp);
    
    // Only log duplicates in development mode if there are many
    if (process.env.NODE_ENV === 'development' && totalSkippedCount > 5) {
      console.warn(`[transformLabsData] Skipped ${totalSkippedCount} duplicate values for ${labType} (across ${labDocuments.length} lab document(s))`);
    }

    // Calculate trend based on all merged values
    const allValues = grouped[labType].data;
    if (allValues.length === 1) {
      // Only one value - no trend
      grouped[labType].trend = 'stable';
    } else if (allValues.length >= 2) {
      // Compare last two values
      const lastValue = allValues[allValues.length - 1].value;
      const previousValue = allValues[allValues.length - 2].value;
      
      if (typeof lastValue === 'number' && typeof previousValue === 'number') {
        const difference = lastValue - previousValue;
        const percentChange = Math.abs(difference / previousValue);
        
        // Only show trend if change is significant (> 1% to avoid noise)
        if (percentChange > 0.01) {
          grouped[labType].trend = difference > 0 ? 'up' : 'down';
        } else {
          grouped[labType].trend = 'stable';
        }
      } else {
        grouped[labType].trend = 'stable';
      }
    }

    // Update current value to most recent
    if (allValues.length > 0) {
      grouped[labType].current = allValues[allValues.length - 1].value;
    }
  }

  return grouped;
};

// Transform Firestore vitals data to UI format
export const transformVitalsData = async (vitals) => {
  const grouped = {};

  // Load ALL vital values in parallel FIRST (much faster than sequential)
  const allVitalValuePromises = vitals.map(vital => 
    vitalService.getVitalValues(vital.id).then(values => ({ vitalId: vital.id, values: values || [] }))
  );
  const allVitalValues = await Promise.all(allVitalValuePromises);
  const vitalValuesMap = {};
  allVitalValues.forEach(({ vitalId, values }) => {
    vitalValuesMap[vitalId] = values;
  });

  // Process each vital and load its values (values already loaded)
  for (const vital of vitals) {
    const vitalType = vital.vitalType || 'unknown';

    // Normalize vital type to canonical key
    const canonicalKey = normalizeVitalName(vitalType) || normalizeVitalName(vital.label) || vitalType;
    const displayName = getVitalDisplayName(canonicalKey);

    if (!grouped[canonicalKey]) {
      grouped[canonicalKey] = {
        id: vital.id, // Store vital document ID
        name: displayName,
        unit: vital.unit,
        current: vital.currentValue,
        status: 'normal',
        trend: 'stable',
        normalRange: vital.normalRange,
        data: []
      };
    }

    // Get vital values from pre-loaded map
    try {
      const values = vitalValuesMap[vital.id] || [];
      if (values && values.length > 0) {
        // Sort by date (oldest first) for trend calculation
        // Round timestamps to day level (midnight) to handle timezone issues and ensure same-day values are treated as duplicates
        const sortedValues = values
          .map(v => {
            // Convert Firestore Timestamp to local date (avoid timezone shift)
            let date;
            if (v.date?.toDate) {
              // Firestore Timestamp - convert to local date using date components
              const firestoreDate = v.date.toDate();
              // Use local date components to avoid timezone shift
              date = new Date(firestoreDate.getFullYear(), firestoreDate.getMonth(), firestoreDate.getDate());
            } else if (v.date) {
              // Already a Date object or string - parse as local date
              if (v.date instanceof Date) {
                date = new Date(v.date.getFullYear(), v.date.getMonth(), v.date.getDate());
              } else {
                // String date - parse as local
                const dateStr = formatDateString(v.date);
                if (dateStr) {
                  const parts = dateStr.split('-');
                  date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                } else {
                  date = new Date();
                }
              }
            } else {
              date = new Date();
            }
            
            const timestamp = date.getTime();
            // Round to day level (midnight) for deduplication - this prevents same-day duplicates with different times
            const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
            return {
              id: v.id,
              value: v.value,
              systolic: v.systolic,
              diastolic: v.diastolic,
              date: date,
              timestamp: timestamp, // Keep original timestamp for sorting
              dayTimestamp: dayStart, // Use day-level timestamp for deduplication
              notes: v.notes || ''
            };
          })
          .sort((a, b) => a.timestamp - b.timestamp);

        // Add all values to data array, avoiding duplicates by ID and day+value
        const existingIds = new Set(grouped[canonicalKey].data.map(d => d.id));
        const existingValueKeys = new Set(grouped[canonicalKey].data.map(d => {
          // Use day-level timestamp for deduplication
          const dayStart = d.dateOriginal ? new Date(d.dateOriginal.getFullYear(), d.dateOriginal.getMonth(), d.dateOriginal.getDate()).getTime() : d.timestamp;
          return `${dayStart}_${d.value}_${d.systolic || ''}_${d.diastolic || ''}`;
        }));
        let skippedCount = 0;
        sortedValues.forEach(v => {
          const valueKey = `${v.dayTimestamp}_${v.value}_${v.systolic || ''}_${v.diastolic || ''}`;
          // Only add if we haven't seen this ID or day+value combination before
          // This prevents duplicates from multiple vital documents or reprocessing issues
          if (existingIds.has(v.id)) {
            skippedCount++;
          } else if (existingValueKeys.has(valueKey)) {
            skippedCount++;
          }
          if (!existingIds.has(v.id) && !existingValueKeys.has(valueKey)) {
            grouped[canonicalKey].data.push({
              id: v.id,
              date: v.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
              dateOriginal: v.date, // Store original Date object for editing
              value: v.value,
              systolic: v.systolic,
              diastolic: v.diastolic,
              timestamp: v.timestamp,
              notes: v.notes || ''
            });
            existingIds.add(v.id);
            existingValueKeys.add(valueKey);
          }
        });
        
        // CRITICAL: Sort the data array by timestamp after all values are added
        // This ensures the graph displays points in chronological order
        grouped[canonicalKey].data.sort((a, b) => a.timestamp - b.timestamp);
        
        // Only log duplicates in development mode if there are many
        if (process.env.NODE_ENV === 'development' && skippedCount > 5) {
          console.warn(`[transformVitalsData] Skipped ${skippedCount} duplicate values for ${canonicalKey}`);
        }

        // Update current value to most recent
        if (sortedValues.length > 0) {
          const lastValue = sortedValues[sortedValues.length - 1];
          grouped[canonicalKey].current = lastValue.value;
          if (lastValue.systolic && lastValue.diastolic) {
            grouped[canonicalKey].current = `${lastValue.systolic}/${lastValue.diastolic}`;
          }
        }
      } else {
        // No values in subcollection - only use vital document data if currentValue exists
        // (If currentValue is null, it means all values were deleted, so don't add it back)
        if (vital.currentValue != null && vital.currentValue !== undefined && vital.currentValue !== '') {
          // Convert to local date to avoid timezone shift
          let vitalDate;
          if (vital.createdAt?.toDate) {
            const firestoreDate = vital.createdAt.toDate();
            vitalDate = new Date(firestoreDate.getFullYear(), firestoreDate.getMonth(), firestoreDate.getDate());
          } else if (vital.createdAt) {
            if (vital.createdAt instanceof Date) {
              vitalDate = new Date(vital.createdAt.getFullYear(), vital.createdAt.getMonth(), vital.createdAt.getDate());
            } else {
              const dateStr = formatDateString(vital.createdAt);
              if (dateStr) {
                const parts = dateStr.split('-');
                vitalDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
              } else {
                vitalDate = new Date();
              }
            }
          } else {
            vitalDate = new Date();
          }
          
          grouped[canonicalKey].data.push({
            id: vital.id, // Store vital document ID for deletion
            date: vitalDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            dateOriginal: vitalDate, // Store original Date object for editing
            value: vital.currentValue,
            timestamp: vitalDate.getTime(),
            notes: '' // No notes for initial value
          });
        }
        // If currentValue is null/empty, don't add anything - all values were deleted
      }
    } catch (error) {
      console.error(`Error loading values for vital ${vital.id}:`, error);
      // Fallback to vital document data only if currentValue exists
      // (If currentValue is null, it means all values were deleted, so don't add it back)
      if (vital.currentValue != null && vital.currentValue !== undefined && vital.currentValue !== '') {
        // Convert to local date to avoid timezone shift
        let vitalDate;
        if (vital.createdAt?.toDate) {
          const firestoreDate = vital.createdAt.toDate();
          vitalDate = new Date(firestoreDate.getFullYear(), firestoreDate.getMonth(), firestoreDate.getDate());
        } else if (vital.createdAt) {
          if (vital.createdAt instanceof Date) {
            vitalDate = new Date(vital.createdAt.getFullYear(), vital.createdAt.getMonth(), vital.createdAt.getDate());
          } else {
            const dateStr = formatDateString(vital.createdAt);
            if (dateStr) {
              const parts = dateStr.split('-');
              vitalDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
            } else {
              vitalDate = new Date();
            }
          }
        } else {
          vitalDate = new Date();
        }
        
        grouped[canonicalKey].data.push({
          id: vital.id, // Store vital document ID for deletion
          date: vitalDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          dateOriginal: vitalDate, // Store original Date object for editing
          value: vital.currentValue,
          timestamp: vitalDate.getTime(),
          notes: '' // No notes for fallback value
        });
      }
      // If currentValue is null/empty, don't add anything - all values were deleted
    }
  }

  return grouped;
};

