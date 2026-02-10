/**
 * Garmin Connect Service
 * 
 * Handles Garmin Connect API integration for syncing health/vitals data.
 * Requires Garmin Developer Program approval and OAuth credentials.
 * 
 * Documentation: https://developer.garmin.com/gc-developer-program/health-api/
 */

import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { vitalService } from '../firebase/services';

/**
 * Garmin OAuth Configuration
 * These should be set via environment variables after Garmin Developer Program approval
 */
const GARMIN_CONFIG = {
  // OAuth 1.0a credentials (for Health API)
  consumerKey: process.env.REACT_APP_GARMIN_CONSUMER_KEY || '',
  consumerSecret: process.env.REACT_APP_GARMIN_CONSUMER_SECRET || '',
  
  // OAuth 2.0 credentials (for newer APIs)
  clientId: process.env.REACT_APP_GARMIN_CLIENT_ID || '',
  clientSecret: process.env.REACT_APP_GARMIN_CLIENT_SECRET || '',
  
  // API Base URLs
  healthApiBaseUrl: 'https://healthapi.garmin.com/wellness-api/rest',
  connectApiBaseUrl: 'https://connectapi.garmin.com',
  
  // OAuth URLs
  requestTokenUrl: 'https://connectapi.garmin.com/oauth-service/oauth/request_token',
  authorizeUrl: 'https://connect.garmin.com/oauthConfirm',
  accessTokenUrl: 'https://connectapi.garmin.com/oauth-service/oauth/access_token',
};

/**
 * Check if Garmin is configured
 */
export function isGarminConfigured() {
  return !!(GARMIN_CONFIG.consumerKey && GARMIN_CONFIG.consumerSecret);
}

/**
 * Get OAuth tokens from Firestore for a user
 */
async function getGarminTokens(userId) {
  try {
    const patientRef = doc(db, 'patients', userId);
    const patientDoc = await getDoc(patientRef);
    
    if (patientDoc.exists()) {
      const data = patientDoc.data();
      return data.garminTokens || null;
    }
    return null;
  } catch (error) {
    console.error('[Garmin] Error fetching tokens:', error);
    return null;
  }
}

/**
 * Save OAuth tokens to Firestore (encrypted or secured)
 */
async function saveGarminTokens(userId, tokens) {
  try {
    const patientRef = doc(db, 'patients', userId);
    await updateDoc(patientRef, {
      garminTokens: tokens,
      garminConnectedAt: new Date().toISOString(),
    });
    return true;
  } catch (error) {
    console.error('[Garmin] Error saving tokens:', error);
    throw error;
  }
}

/**
 * Clear Garmin tokens (disconnect)
 */
export async function disconnectGarmin(userId) {
  try {
    const patientRef = doc(db, 'patients', userId);
    await updateDoc(patientRef, {
      garminTokens: null,
      garminConnectedAt: null,
    });
    return true;
  } catch (error) {
    console.error('[Garmin] Error disconnecting:', error);
    throw error;
  }
}

/**
 * Check if user has Garmin connected
 */
export async function isGarminConnected(userId) {
  const tokens = await getGarminTokens(userId);
  return !!tokens;
}

/**
 * Generate OAuth 1.0a signature (simplified - you may need a library for production)
 * For production, use a library like 'oauth-1.0a' or implement full OAuth 1.0a spec
 */
function generateOAuthSignature(method, url, params, secret) {
  // Placeholder intentionally disabled to avoid producing invalid signatures in production.
  throw new Error('Garmin OAuth signature generation is not implemented.');
}

/**
 * Step 1: Get OAuth request token
 * This initiates the OAuth flow
 */
export async function initiateGarminOAuth(userId, callbackUrl) {
  if (!isGarminConfigured()) {
    throw new Error('Garmin API credentials not configured. Please set up Garmin Developer Program credentials.');
  }

  try {
    void userId;
    void callbackUrl;
    throw new Error('Garmin OAuth request-token flow is not implemented yet.');
  } catch (error) {
    console.error('[Garmin] Error initiating OAuth:', error);
    throw error;
  }
}

/**
 * Step 2: Exchange verifier for access token
 * Called after user authorizes your app
 */
export async function completeGarminOAuth(userId, requestToken, requestTokenSecret, verifier) {
  void userId;
  void requestToken;
  void requestTokenSecret;
  void verifier;
  throw new Error('Garmin OAuth token exchange is not implemented yet.');
}

/**
 * Map Garmin health data types to CancerCare vital types
 */
function mapGarminToVitalType(garminDataType) {
  const mapping = {
    'RESTING_HEART_RATE': 'hr',
    'HEART_RATE': 'hr',
    'STRESS': null, // Not directly mapped
    'SLEEP_DURATION': null, // Tracked separately
    'BODY_BATTERY': null, // Garmin-specific
    'RESPIRATION': 'rr',
    'PULSE_OX': 'spo2',
    'BODY_TEMPERATURE': 'temp',
    'BLOOD_PRESSURE': 'bp',
    'WEIGHT': 'weight',
    'VO2_MAX': null, // Fitness metric
  };
  
  return mapping[garminDataType] || null;
}

/**
 * Fetch health summary from Garmin Health API
 * This gets daily aggregated health metrics
 */
export async function fetchGarminHealthSummary(userId, startDate, endDate) {
  const tokens = await getGarminTokens(userId);
  if (!tokens) {
    throw new Error('Garmin not connected. Please connect your Garmin account first.');
  }

  try {
    void startDate;
    void endDate;
    throw new Error('Garmin Health API fetch is not implemented yet.');
  } catch (error) {
    console.error('[Garmin] Error fetching health summary:', error);
    throw error;
  }
}

/**
 * Sync Garmin health data to CancerCare vitals
 * Fetches data from Garmin and saves it to Firestore vitals collection
 */
export async function syncGarminToVitals(userId, daysBack = 30) {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    // Fetch health data from Garmin
    const healthData = await fetchGarminHealthSummary(userId, startDate, endDate);
    
    if (!healthData || !healthData.dailyHealthSummaries) {
      return { synced: 0, errors: [] };
    }

    const errors = [];
    let syncedCount = 0;

    // Process each day's data
    for (const daily of healthData.dailyHealthSummaries) {
      const date = new Date(daily.calendarDate);

      // Sync Heart Rate
      if (daily.restingHeartRate) {
        try {
          await syncGarminVital(userId, 'hr', {
            value: daily.restingHeartRate,
            date: date.toISOString(),
            notes: 'Synced from Garmin Connect',
            source: 'garmin',
          });
          syncedCount++;
        } catch (error) {
          errors.push({ type: 'hr', date: daily.calendarDate, error: error.message });
        }
      }

      // Sync PulseOx
      if (daily.pulseOx) {
        try {
          await syncGarminVital(userId, 'spo2', {
            value: daily.pulseOx,
            date: date.toISOString(),
            notes: 'Synced from Garmin Connect',
            source: 'garmin',
          });
          syncedCount++;
        } catch (error) {
          errors.push({ type: 'spo2', date: daily.calendarDate, error: error.message });
        }
      }

      // Sync Respiration Rate
      if (daily.respiration) {
        try {
          await syncGarminVital(userId, 'rr', {
            value: daily.respiration,
            date: date.toISOString(),
            notes: 'Synced from Garmin Connect',
            source: 'garmin',
          });
          syncedCount++;
        } catch (error) {
          errors.push({ type: 'rr', date: daily.calendarDate, error: error.message });
        }
      }
    }

    return { synced: syncedCount, errors };
  } catch (error) {
    console.error('[Garmin] Error syncing to vitals:', error);
    throw error;
  }
}

/**
 * Sync a single vital value from Garmin
 * Creates or updates the vital in Firestore
 */
async function syncGarminVital(userId, vitalType, valueData) {
  try {
    // Check if vital already exists
    let vital = await vitalService.getVitalByType(userId, vitalType);
    
    if (!vital) {
      // Create new vital
      const vitalId = await vitalService.saveVital({
        patientId: userId,
        vitalType: vitalType,
        name: getVitalDisplayName(vitalType),
        unit: getVitalUnit(vitalType),
        normalRange: getVitalNormalRange(vitalType),
      });
      vital = await vitalService.getVital(vitalId);
    }

    // Add value to vital
    await vitalService.addVitalValue(vital.id, {
      value: valueData.value,
      date: valueData.date,
      notes: valueData.notes || `Synced from Garmin Connect`,
    });

    return vital;
  } catch (error) {
    console.error(`[Garmin] Error syncing vital ${vitalType}:`, error);
    throw error;
  }
}

/**
 * Helper: Get vital display name
 */
function getVitalDisplayName(vitalType) {
  const names = {
    'hr': 'Heart Rate',
    'spo2': 'Oxygen Saturation',
    'rr': 'Respiratory Rate',
    'temp': 'Temperature',
    'bp': 'Blood Pressure',
    'weight': 'Weight',
  };
  return names[vitalType] || vitalType;
}

/**
 * Helper: Get vital unit
 */
function getVitalUnit(vitalType) {
  const units = {
    'hr': 'BPM',
    'spo2': '%',
    'rr': 'breaths/min',
    'temp': '°F',
    'bp': 'mmHg',
    'weight': 'lbs',
  };
  return units[vitalType] || '';
}

/**
 * Helper: Get vital normal range
 */
function getVitalNormalRange(vitalType) {
  const ranges = {
    'hr': '60-100',
    'spo2': '>95',
    'rr': '12-20',
    'temp': '97.5-99.5',
    'bp': '<140/90',
  };
  return ranges[vitalType] || null;
}

export default {
  isGarminConfigured,
  isGarminConnected,
  initiateGarminOAuth,
  completeGarminOAuth,
  disconnectGarmin,
  fetchGarminHealthSummary,
  syncGarminToVitals,
};
