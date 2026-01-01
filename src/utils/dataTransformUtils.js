// Data transformation utilities for converting Firestore data to UI format

import { labService, vitalService } from '../firebase/services';
import { getCancerRelevanceScore } from './healthUtils';
import { normalizeVitalName, getVitalDisplayName } from './normalizationUtils';

// Transform Firestore labs data to UI format
export const transformLabsData = async (labs) => {
  const grouped = {};

  // Process each lab and load its values
  for (const lab of labs) {
    const labType = lab.labType || 'unknown';

    if (!grouped[labType]) {
      grouped[labType] = {
        id: lab.id, // Store lab document ID for adding values
        name: lab.label,
        unit: lab.unit,
        current: lab.currentValue,
        status: lab.status || 'normal',
        trend: 'stable',
        normalRange: lab.normalRange,
        isNumeric: typeof lab.currentValue === 'number',
        relevanceScore: getCancerRelevanceScore(labType),
        data: []
      };
    }

    // Load lab values from subcollection
    try {
      const values = await labService.getLabValues(lab.id);
      if (values && values.length > 0) {
        // Sort by date (oldest first) for trend calculation
        const sortedValues = values
          .map(v => ({
            id: v.id,
            value: v.value,
            date: v.date?.toDate ? v.date.toDate() : (v.date ? new Date(v.date) : new Date()),
            timestamp: v.date?.toDate ? v.date.toDate().getTime() : (v.date ? new Date(v.date).getTime() : Date.now())
          }))
          .sort((a, b) => a.timestamp - b.timestamp);

        // Add all values to data array
        sortedValues.forEach(v => {
          grouped[labType].data.push({
            id: v.id,
            date: v.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            dateOriginal: v.date, // Store original Date object for editing
            value: v.value,
            timestamp: v.timestamp,
            notes: v.notes || '' // Store notes for editing
          });
        });

        // Calculate trend based on values
        if (sortedValues.length === 1) {
          // Only one value - no trend
          grouped[labType].trend = 'stable';
        } else if (sortedValues.length >= 2) {
          // Compare last two values
          const lastValue = sortedValues[sortedValues.length - 1].value;
          const previousValue = sortedValues[sortedValues.length - 2].value;
          
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
        if (sortedValues.length > 0) {
          grouped[labType].current = sortedValues[sortedValues.length - 1].value;
        }
      } else {
        // No values yet, just use the lab document data
        const timestamp = lab.createdAt?.toDate ? lab.createdAt.toDate() : (lab.createdAt ? new Date(lab.createdAt) : new Date());
        grouped[labType].data.push({
          id: lab.id,
          date: timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          dateOriginal: timestamp, // Store original Date object for editing
          value: lab.currentValue,
          timestamp: timestamp.getTime(),
          notes: '' // No notes for initial value
        });
        grouped[labType].trend = 'stable';
      }
    } catch (error) {
      console.error(`Error loading values for lab ${lab.id}:`, error);
      // Fallback to lab document data
      const timestamp = lab.createdAt?.toDate ? lab.createdAt.toDate() : (lab.createdAt ? new Date(lab.createdAt) : new Date());
      grouped[labType].data.push({
        id: lab.id,
        date: timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        dateOriginal: timestamp, // Store original Date object for editing
        value: lab.currentValue,
        timestamp: timestamp.getTime(),
        notes: '' // No notes for fallback value
      });
      grouped[labType].trend = 'stable';
    }
  }

  return grouped;
};

// Transform Firestore vitals data to UI format
export const transformVitalsData = async (vitals) => {
  const grouped = {};

  // Process each vital and load its values
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

    // Load vital values from subcollection
    try {
      const values = await vitalService.getVitalValues(vital.id);
      if (values && values.length > 0) {
        // Sort by date (oldest first) for trend calculation
        const sortedValues = values
          .map(v => ({
            id: v.id,
            value: v.value,
            systolic: v.systolic,
            diastolic: v.diastolic,
            date: v.date?.toDate ? v.date.toDate() : (v.date ? new Date(v.date) : new Date()),
            timestamp: v.date?.toDate ? v.date.toDate().getTime() : (v.date ? new Date(v.date).getTime() : Date.now()),
            notes: v.notes || ''
          }))
          .sort((a, b) => a.timestamp - b.timestamp);

        // Add all values to data array
        sortedValues.forEach(v => {
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
        });

        // Update current value to most recent
        if (sortedValues.length > 0) {
          const lastValue = sortedValues[sortedValues.length - 1];
          grouped[canonicalKey].current = lastValue.value;
          if (lastValue.systolic && lastValue.diastolic) {
            grouped[canonicalKey].current = `${lastValue.systolic}/${lastValue.diastolic}`;
          }
        }
      } else {
        // No values yet, just use the vital document data
        const vitalDate = new Date(vital.createdAt?.toDate ? vital.createdAt.toDate() : vital.createdAt);
        grouped[canonicalKey].data.push({
          id: vital.id, // Store vital document ID for deletion
          date: vitalDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          dateOriginal: vitalDate, // Store original Date object for editing
          value: vital.currentValue,
          timestamp: vitalDate.getTime(),
          notes: '' // No notes for initial value
        });
      }
    } catch (error) {
      console.error(`Error loading values for vital ${vital.id}:`, error);
      // Fallback to vital document data
      const vitalDate = new Date(vital.createdAt?.toDate ? vital.createdAt.toDate() : vital.createdAt);
      grouped[canonicalKey].data.push({
        id: vital.id, // Store vital document ID for deletion
        date: vitalDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        dateOriginal: vitalDate, // Store original Date object for editing
        value: vital.currentValue,
        timestamp: vitalDate.getTime(),
        notes: '' // No notes for fallback value
      });
    }
  }

  return grouped;
};

