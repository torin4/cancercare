import { db } from '../../firebase/config';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore';
import { searchTrialsByGenomicProfile, matchesTrialEligibility } from './trialSearchService';
import { trialLocationService } from '../../firebase/services';
import { calculateTrialMatchScore, sortTrialsByMatch } from './trialMatcher';
import { IMPORTANT_GENES } from '../../config/importantGenes';

/**
 * Save a matched trial for a patient
 * @param {string} userId - Patient ID
 * @param {Object} trialData - Trial data with match results
 * @returns {Promise<string>} - Saved trial document ID
 */
export async function saveMatchedTrial(userId, trialData) {
  try {
    const trialRef = doc(collection(db, 'matchedTrials'));

    // Build trial data object, filtering out undefined values
    const trialDocData = {
      patientId: userId,
      trialId: trialData.id,
      source: trialData.source,

      // Trial information (only include if defined)
      title: trialData.title,
      phase: trialData.phase,
      status: trialData.status,
      conditions: trialData.conditions,
      interventions: trialData.interventions,
      sponsor: trialData.sponsor,
      locations: trialData.locations,

      // Match results
      matchResult: trialData.matchResult,

      // URLs (only include if defined)
      url: trialData.url,

      // Metadata
      savedAt: serverTimestamp(),
      attemptedSources: trialData.attemptedSources || [],
      isFavorite: false,
      notes: ''
    };

    // Add optional fields only if they are defined
    if (trialData.titleJa !== undefined && trialData.titleJa !== null) {
      trialDocData.titleJa = trialData.titleJa;
    }
    if (trialData.urlJa !== undefined && trialData.urlJa !== null) {
      trialDocData.urlJa = trialData.urlJa;
    }

    // Filter out any remaining undefined values
    const cleanData = Object.fromEntries(
      Object.entries(trialDocData).filter(([_, value]) => value !== undefined)
    );

    await setDoc(trialRef, cleanData);

    return trialRef.id;
  } catch (error) {
    console.error('Error saving matched trial:', error);
    throw error;
  }
}

/**
 * Get all saved trials for a patient
 * @param {string} userId - Patient ID
 * @returns {Promise<Array>} - Array of saved trials
 */
export async function getSavedTrials(userId) {
  try {
    const trialsQuery = query(
      collection(db, 'matchedTrials'),
      where('patientId', '==', userId),
      orderBy('savedAt', 'desc')
    );

    const snapshot = await getDocs(trialsQuery);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting saved trials:', error);
    throw error;
  }
}

/**
 * Get favorite trials for a patient
 * @param {string} userId - Patient ID
 * @returns {Promise<Array>} - Array of favorite trials
 */
export async function getFavoriteTrials(userId) {
  try {
    const trialsQuery = query(
      collection(db, 'matchedTrials'),
      where('patientId', '==', userId),
      where('isFavorite', '==', true),
      orderBy('savedAt', 'desc')
    );

    const snapshot = await getDocs(trialsQuery);

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting favorite trials:', error);
    throw error;
  }
}

/**
 * Toggle favorite status for a trial
 * @param {string} trialDocId - Firestore document ID of saved trial
 * @param {boolean} isFavorite - New favorite status
 * @returns {Promise<void>}
 */
export async function toggleTrialFavorite(trialDocId, isFavorite) {
  try {
    const trialRef = doc(db, 'matchedTrials', trialDocId);
    await setDoc(trialRef, { isFavorite }, { merge: true });
  } catch (error) {
    console.error('Error toggling trial favorite:', error);
    throw error;
  }
}

/**
 * Update notes for a saved trial
 * @param {string} trialDocId - Firestore document ID of saved trial
 * @param {string} notes - Trial notes
 * @returns {Promise<void>}
 */
export async function updateTrialNotes(trialDocId, notes) {
  try {
    const trialRef = doc(db, 'matchedTrials', trialDocId);
    await setDoc(trialRef, { notes, updatedAt: serverTimestamp() }, { merge: true });
  } catch (error) {
    console.error('Error updating trial notes:', error);
    throw error;
  }
}

/**
 * Remove a saved trial
 * @param {string} trialDocId - Firestore document ID of saved trial
 * @returns {Promise<void>}
 */
export async function removeSavedTrial(trialDocId) {
  try {
    await deleteDoc(doc(db, 'matchedTrials', trialDocId));
  } catch (error) {
    console.error('Error removing saved trial:', error);
    throw error;
  }
}

/**
 * Search and match clinical trials for a patient
 * @param {string} userId - Patient ID
 * @param {Object} patientProfile - Patient demographics and medical info
 * @param {Object} genomicProfile - Patient's genomic profile (optional)
 * @returns {Promise<Object>} - Search results with matched trials
 */
export async function searchAndMatchTrials(userId, patientProfile, genomicProfile = null, onProgress = null, pageNumber = 1) {
  try {
    let searchResults;

    // Determine trial location preferences (if saved for this patient)
    let trialLocation = null;
    try {
      trialLocation = await trialLocationService.getTrialLocation(userId);
    } catch (e) {
      console.warn('Could not load trial location for user:', e?.message || e);
    }

    // If genomic profile exists, use genomic-based search and include location
    if (genomicProfile) {
      const tl = trialLocation ? { ...trialLocation, onProgress } : { onProgress };
      searchResults = await searchTrialsByGenomicProfile(genomicProfile, patientProfile, tl);
    } else {
      // Extract mutations and CNVs for separate query.term
      const additionalTerms = [];
      
      // Add mutations/variants from genomic profile if available
      if (genomicProfile && genomicProfile.mutations && genomicProfile.mutations.length > 0) {
        const importantMutations = genomicProfile.mutations
          .filter(m => m.gene && IMPORTANT_GENES.includes(m.gene.toUpperCase()))
          .slice(0, 3);
        
        if (importantMutations.length > 0) {
          additionalTerms.push(...importantMutations.map(m => m.gene));
        }
      }
      
      // Also add CNVs (like CCNE1 amplification)
      if (genomicProfile && genomicProfile.cnvs && genomicProfile.cnvs.length > 0) {
        const importantCNVs = genomicProfile.cnvs
          .filter(cnv => cnv.gene && IMPORTANT_GENES.includes(cnv.gene.toUpperCase()))
          .slice(0, 2);
        
        if (importantCNVs.length > 0) {
          additionalTerms.push(...importantCNVs.map(cnv => cnv.gene));
        }
      }
      
      const { searchTrials } = await import('./trialSearchService');
      const params = {
        patientProfile: patientProfile,
        additionalTerms: additionalTerms,
        age: patientProfile.age,
        gender: patientProfile.gender,
        status: 'recruiting',
        onProgress,
        pageNumber: pageNumber,
        pageSize: 50
      };
      if (trialLocation) {
        params.country = trialLocation.country;
        params.includeAllLocations = trialLocation.includeAllLocations;
      }
      searchResults = await searchTrials(params);
    }

    if (!searchResults.success || !searchResults.trials) {
      return {
        success: false,
        totalResults: 0,
        trials: [],
        searchSources: searchResults.attemptedSources || [],
        error: searchResults.error || 'No trials found',
        pagination: searchResults.pagination || null
      };
    }

    // Calculate match scores for each trial
    const trialsWithMatches = searchResults.trials.map(trial => {
      const matchResult = calculateTrialMatchScore(trial, patientProfile, genomicProfile);

      return {
        ...trial,
        matchResult
      };
    });

    // Sort by match score
    const sortedTrials = sortTrialsByMatch(trialsWithMatches);

    return {
      success: true,
      totalResults: sortedTrials.length,
      trials: sortedTrials,
      searchSources: searchResults.attemptedSources || [],
      searchCriteria: {
        diagnosis: patientProfile.diagnosis,
        age: patientProfile.age,
        gender: patientProfile.gender,
        hasGenomicProfile: !!genomicProfile
      }
    };

  } catch (error) {
    console.error('Error searching and matching trials:', error);
    return {
      success: false,
      totalResults: 0,
      trials: [],
      error: error.message
    };
  }
}

/**
 * Get trial statistics for a patient
 * @param {string} userId - Patient ID
 * @returns {Promise<Object>} - Trial statistics
 */
export async function getTrialStatistics(userId) {
  try {
    const savedTrials = await getSavedTrials(userId);

    const stats = {
      totalSaved: savedTrials.length,
      favorites: savedTrials.filter(t => t.isFavorite).length,
      byEligibility: {
        highly_eligible: savedTrials.filter(t => t.matchResult?.eligibilityLevel === 'highly_eligible').length,
        potentially_eligible: savedTrials.filter(t => t.matchResult?.eligibilityLevel === 'potentially_eligible').length,
        unlikely_eligible: savedTrials.filter(t => t.matchResult?.eligibilityLevel === 'unlikely_eligible').length
      },
      byPhase: {},
      byStatus: {}
    };

    // Count by phase
    savedTrials.forEach(trial => {
      const phase = trial.phase || 'Unknown';
      stats.byPhase[phase] = (stats.byPhase[phase] || 0) + 1;
    });

    // Count by status
    savedTrials.forEach(trial => {
      const status = trial.status || 'Unknown';
      stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
    });

    return stats;
  } catch (error) {
    console.error('Error getting trial statistics:', error);
    throw error;
  }
}

/**
 * Check if a trial is already saved for a patient
 * @param {string} userId - Patient ID
 * @param {string} trialId - Trial ID (from source database)
 * @returns {Promise<boolean>} - True if trial is already saved
 */
export async function isTrialSaved(userId, trialId) {
  try {
    // Return false if userId or trialId is missing
    if (!userId || !trialId) {
      return false;
    }

    const trialsQuery = query(
      collection(db, 'matchedTrials'),
      where('patientId', '==', userId),
      where('trialId', '==', trialId)
    );

    const snapshot = await getDocs(trialsQuery);
    return !snapshot.empty;
  } catch (error) {
    // Handle permission errors gracefully - return false if we can't check
    // This allows the UI to continue working even if there's a permissions issue
    if (error.code === 'permission-denied' || error.message?.includes('permission')) {
      console.warn('Permission denied checking if trial is saved. User may not be authenticated:', error.message);
      return false;
    }
    console.error('Error checking if trial is saved:', error);
    return false;
  }
}

export default {
  saveMatchedTrial,
  getSavedTrials,
  getFavoriteTrials,
  toggleTrialFavorite,
  updateTrialNotes,
  removeSavedTrial,
  searchAndMatchTrials,
  getTrialStatistics,
  isTrialSaved
};
