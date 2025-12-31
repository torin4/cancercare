import axios from 'axios';

// Proxy base (serverless proxy added to repo). Calls are routed to `/api/trials-proxy`.
const PROXY_BASE = (function() {
  if (process.env.REACT_APP_TRIALS_PROXY_URL) return process.env.REACT_APP_TRIALS_PROXY_URL.replace(/\/$/, '');
  return '/api/trials-proxy';
})();

// In-memory cache for geocoding results to avoid repeated requests
const geocodeCache = new Map();

// Haversine distance (miles)
function distanceMiles(lat1, lon1, lat2, lon2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 3958.8; // miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

async function geocodeAddress(query) {
  if (!query) return null;
  const key = String(query).trim();
  if (geocodeCache.has(key)) return geocodeCache.get(key);

  try {
    const res = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: { q: key, format: 'json', limit: 1 },
      headers: { 'User-Agent': 'CancerCare/1.0 (contact@example.com)' },
      timeout: 10000
    });

    const item = res.data && res.data[0];
    if (!item) {
      geocodeCache.set(key, null);
      return null;
    }

    const lat = parseFloat(item.lat);
    const lon = parseFloat(item.lon);
    const out = { lat, lon };
    geocodeCache.set(key, out);
    return out;
  } catch (e) {
    console.warn('Geocode failed for', key, e?.message || e);
    geocodeCache.set(key, null);
    return null;
  }
}

function locationToQuery(loc) {
  // loc can be string or {city,country}
  if (!loc) return null;
  if (typeof loc === 'string') return loc;
  if (loc.city && loc.country) return `${loc.city}, ${loc.country}`;
  if (loc.city && loc.state) return `${loc.city}, ${loc.state}`;
  if (loc.country) return loc.country;
  return JSON.stringify(loc);
}

async function applyLocationFilters(trials, params) {
  if (!params) return trials;

  let out = trials || [];

  // Country filter (simple string match) when includeAllLocations is false
  if (params.country && !params.includeAllLocations) {
    const countryLower = String(params.country).toLowerCase();
    out = out.filter(t => {
      // Check trial's country field
      if ((t.country || '').toLowerCase().includes(countryLower)) return true;
      
      // Check trial locations
      const locations = t.locations || [];
      return locations.some(loc => {
        if (typeof loc === 'string') {
          return loc.toLowerCase().includes(countryLower);
        }
        // Check location object's country field
        const locCountry = (loc.country || '').toLowerCase();
        return locCountry.includes(countryLower);
      });
    });
  }

  // If includeAllLocations is true, return all trials (no filtering)
  return out;
}

/**
 * Search clinical trials from available sources (currently ClinicalTrials.gov)
 * @param {Object} params - Search parameters
 * @returns {Promise<Object>} - Search results with normalized trial data
 */
export async function searchTrials(params) {
  const attempted = [];
  const onProgress = params?.onProgress;
  // Currently queries ClinicalTrials.gov
  try {
    if (typeof onProgress === 'function') onProgress('Querying ClinicalTrials.gov');
    attempted.push('ClinicalTrials.gov');
    
    const expr = buildCTGovExpr(params);
    const fields = ['NCTId', 'BriefTitle', 'Condition', 'OverallStatus', 'Phase', 'BriefSummary', 'LocationCity', 'LocationCountry'].join(',');
    const proxyUrl = `${PROXY_BASE}?source=ctgov&expr=${encodeURIComponent(expr)}&fields=${encodeURIComponent(fields)}&min_rnk=1&max_rnk=50&fmt=json`;
    
    console.log('Searching ClinicalTrials.gov with URL:', proxyUrl);
    
    const ctRaw = await axios.get(proxyUrl, { 
      timeout: 20000,
      headers: {
        'Accept': 'application/json'
      }
    }).then(r => {
      console.log('ClinicalTrials.gov response received:', r?.data ? 'has data' : 'no data');
      return r.data;
    }).catch(err => {
      console.error('ClinicalTrials.gov proxy request failed:', err?.response?.status, err?.message);
      return null;
    });
    
    if (ctRaw) {
      console.log('ClinicalTrials.gov raw response structure:', {
        hasStudyFieldsResponse: !!ctRaw.StudyFieldsResponse,
        hasStudies: !!ctRaw.studies,
        hasData: !!ctRaw.data,
        keys: Object.keys(ctRaw),
        studyFieldsResponseKeys: ctRaw.StudyFieldsResponse ? Object.keys(ctRaw.StudyFieldsResponse) : null,
        studyCount: ctRaw.StudyFieldsResponse?.Study?.length || ctRaw.studies?.length || 0
      });
      const ctResult = await searchCTGov({ ...params, _rawCTGovResponse: ctRaw });
      console.log('searchCTGov result:', {
        success: ctResult.success,
        trialsLength: ctResult.trials?.length,
        error: ctResult.error
      });
      if (ctResult.success && ctResult.trials.length > 0) {
        if (typeof onProgress === 'function') onProgress(`ClinicalTrials.gov returned ${ctResult.trials.length} results`);
        return { ...ctResult, attemptedSources: attempted };
      } else {
        console.warn('ClinicalTrials.gov returned no trials:', ctResult);
        // Log the raw response for debugging
        if (ctRaw.StudyFieldsResponse) {
          console.log('StudyFieldsResponse structure:', JSON.stringify(ctRaw.StudyFieldsResponse, null, 2).substring(0, 500));
        }
      }
    } else {
      console.warn('ClinicalTrials.gov returned null response');
    }
  } catch (e) {
    console.error('ClinicalTrials.gov query failed:', e?.message || e, e?.stack);
  }

  return { success: false, source: 'Aggregated', attemptedSources: attempted, totalResults: 0, trials: [] };
}

/**
 * Search ClinicalTrials.gov as a fallback source
 */
export async function searchCTGov(params) {
  try {
    // If a raw response was provided (via proxy), normalize it; otherwise attempt direct call
    const raw = params && params._rawCTGovResponse;
    let studies = [];
    
    console.log('searchCTGov - raw response check:', {
      hasRaw: !!raw,
      rawType: raw ? typeof raw : null,
      isArray: Array.isArray(raw),
      hasStudyFieldsResponse: raw?.StudyFieldsResponse ? true : false,
      studyFieldsResponseKeys: raw?.StudyFieldsResponse ? Object.keys(raw.StudyFieldsResponse) : null
    });
    
    if (raw && raw.StudyFieldsResponse) {
      studies = raw.StudyFieldsResponse.Study || [];
      console.log('Using StudyFieldsResponse format, studies count:', studies.length);
      if (studies.length > 0) {
        console.log('First study sample:', JSON.stringify(studies[0], null, 2).substring(0, 300));
      }
    } else if (raw && Array.isArray(raw)) {
      studies = raw;
      console.log('Using array format, studies count:', studies.length);
    } else if (raw && raw.studies) {
      // Handle v2 API format that might have been normalized differently
      studies = raw.studies;
      console.log('Using raw.studies format, studies count:', studies.length);
    } else {
      // Build expression - use proxy instead of direct API call for better reliability
      const { condition, age, gender } = params;
      let expr = '';
      if (condition) expr += condition;
      if (gender) expr += ` AND ${gender}`;
      if (age) expr += ` AND ${age}`;
      const fields = ['NCTId', 'BriefTitle', 'Condition', 'OverallStatus', 'Phase', 'BriefSummary', 'LocationCity', 'LocationCountry'].join(',');
      
      // Use proxy endpoint for better CORS handling and error management
      const url = `${PROXY_BASE}?source=ctgov&expr=${encodeURIComponent(expr)}&fields=${encodeURIComponent(fields)}&min_rnk=1&max_rnk=50&fmt=json`;
      try {
        const res = await axios.get(url, { timeout: 20000 });
        studies = res.data.StudyFieldsResponse?.Study || [];
      } catch (error) {
        console.error('ClinicalTrials.gov API error:', error?.response?.status, error?.message);
        // Return empty array on error
        studies = [];
      }
    }

    console.log('searchCTGov - studies array length:', studies.length);
    
    if (studies.length === 0) {
      console.warn('No studies found in response. Raw response keys:', raw ? Object.keys(raw) : 'no raw');
      if (raw) {
        console.warn('Raw response sample:', JSON.stringify(raw, null, 2).substring(0, 1000));
      }
      return { success: false, source: 'ClinicalTrials.gov', totalResults: 0, trials: [], error: 'No studies found in API response' };
    }

    let trials = studies.map(s => {
      const trial = {
        id: s.NCTId?.[0] || s.NCTId || null,
        source: 'ClinicalTrials.gov',
        title: s.BriefTitle?.[0] || s.BriefTitle || '',
        conditions: s.Condition || [],
        status: s.OverallStatus?.[0] || s.OverallStatus || '',
        phase: s.Phase?.[0] || s.Phase || '',
        summary: s.BriefSummary?.[0] || s.BriefSummary || '',
        locations: (s.LocationCity || []).map((city, idx) => ({ 
          city: typeof city === 'string' ? city : '', 
          country: (s.LocationCountry?.[idx] || s.LocationCountry?.[0] || '') 
        })),
        url: (s.NCTId?.[0] || s.NCTId) ? `https://clinicaltrials.gov/study/${s.NCTId[0] || s.NCTId}` : null
      };
      return trial;
    }).filter(t => t.id); // Filter out trials without IDs

    console.log('searchCTGov - mapped trials count:', trials.length);

    // Apply location filters if provided
    trials = await applyLocationFilters(trials, params);

    console.log('searchCTGov - after location filters:', trials.length);

    return { success: true, source: 'ClinicalTrials.gov', totalResults: trials.length, trials };
  } catch (error) {
    console.error('Error searching ClinicalTrials.gov:', error?.message || error);
    return { success: false, source: 'ClinicalTrials.gov', totalResults: 0, trials: [], error: error.message };
  }
}

function buildCTGovExpr(params) {
  const { condition, age, gender } = params || {};
  let expr = '';
  if (condition) expr += condition;
  if (gender) expr += ` AND ${gender}`;
  if (age) expr += ` AND ${age}`;
  return expr;
}

/**
 * Placeholder: attempt WHO ICTRP search. The ICTRP public API/endpoint may vary.
 * We attempt a best-effort call and gracefully fail back to ClinicalTrials.gov.
 */
export async function searchWHO(params, rawResponse) {
  try {
    const { condition } = params || {};
    let items = [];
    if (rawResponse && (rawResponse.items || rawResponse.trials)) {
      items = rawResponse.items || rawResponse.trials;
    } else {
      const url = `https://trialsearch.who.int/api/v1/trials?search=${encodeURIComponent(condition || '')}&pageSize=50`;
      const res = await axios.get(url, { timeout: 15000 }).catch(() => null);
      items = res?.data?.items || res?.data?.trials || [];
    }

    const trials = (items || []).map(item => ({
      id: item.trial_id || item.id || null,
      source: 'WHO-ICTRP',
      title: item.title || item.brief_title || item.name || '',
      conditions: item.conditions || item.condition || [],
      status: item.status || item.recruitment_status || '',
      phase: item.phase || '',
      summary: item.summary || item.brief_summary || item.description || '',
      locations: item.locations || item.location || item.countries || [],
      url: item.url || item.link || null
    }));

    const filtered = await applyLocationFilters(trials, params || {});
    return { success: true, source: 'WHO-ICTRP', totalResults: filtered.length, trials: filtered };
  } catch (error) {
    console.error('Error searching WHO ICTRP:', error?.message || error);
    return { success: false, source: 'WHO-ICTRP', totalResults: 0, trials: [], error: error.message };
  }
}

/**
 * Get detailed information for a specific trial
 * @param {string} trialId - Trial ID (NCT number for ClinicalTrials.gov)
 * @returns {Promise<Object>} - Detailed trial information
 */
export async function getTrialDetails(trialId) {
  // For detailed trial info, use the trial URL: https://clinicaltrials.gov/study/{trialId}
  return { success: false, error: 'Use ClinicalTrials.gov website for detailed trial information.' };
}

/**
 * Search clinical trials by genomic profile
 * @param {Object} genomicProfile - Patient's genomic profile from Firestore
 * @param {Object} patientProfile - Patient demographics
 * @param {Object} trialLocation - Trial location preferences
 * @returns {Promise<Object>} - Matching trials
 */
export async function searchTrialsByGenomicProfile(genomicProfile, patientProfile, trialLocation) {
  const searchPromises = [];
  const attempted = [];
  const onProgress = (trialLocation && trialLocation.onProgress) || null;

  // Search for BRCA-related trials
  const brcaMutations = genomicProfile.mutations?.filter(
    m => m.gene === 'BRCA1' || m.gene === 'BRCA2'
  );

    if (brcaMutations && brcaMutations.length > 0) {
    const baseParams = {
      condition: patientProfile.diagnosis,
      age: patientProfile.age,
      gender: patientProfile.gender
    };
    if (trialLocation) Object.assign(baseParams, {
      country: trialLocation.country,
      city: trialLocation.city,
      searchRadius: trialLocation.searchRadius,
      includeAllLocations: trialLocation.includeAllLocations
    });
    if (typeof onProgress === 'function') onProgress('Searching for BRCA-related trials on ClinicalTrials.gov');
    searchPromises.push(searchTrials(baseParams));
    attempted.push('BRCA');
  }

  // Search for TMB-high trials (immunotherapy)
    if (genomicProfile.biomarkers?.tumorMutationalBurden?.interpretation === 'high') {
    const baseParamsTMB = {
      biomarker: 'TMB-high',
      condition: patientProfile.diagnosis,
      intervention: 'pembrolizumab OR nivolumab OR immunotherapy',
      age: patientProfile.age,
      gender: patientProfile.gender,
      status: 'recruiting'
    };
    if (trialLocation) Object.assign(baseParamsTMB, {
      country: trialLocation.country,
      city: trialLocation.city,
      searchRadius: trialLocation.searchRadius,
      includeAllLocations: trialLocation.includeAllLocations
    });
    if (typeof onProgress === 'function') onProgress('Searching for TMB-high trials on ClinicalTrials.gov');
    searchPromises.push(searchTrials(baseParamsTMB));
    attempted.push('TMB');
  }

  // Search for MSI-H trials
    if (genomicProfile.biomarkers?.microsatelliteInstability?.status === 'MSI-H') {
    const baseParamsMSI = {
      biomarker: 'MSI-H',
      condition: patientProfile.diagnosis,
      intervention: 'pembrolizumab',
      age: patientProfile.age,
      gender: patientProfile.gender,
      status: 'recruiting'
    };
    if (trialLocation) Object.assign(baseParamsMSI, {
      country: trialLocation.country,
      city: trialLocation.city,
      searchRadius: trialLocation.searchRadius,
      includeAllLocations: trialLocation.includeAllLocations
    });
    if (typeof onProgress === 'function') onProgress('Searching for MSI-H trials on ClinicalTrials.gov');
    searchPromises.push(searchTrials(baseParamsMSI));
    attempted.push('MSI-H');
  }

  // Search for HRD-positive trials (PARP inhibitors)
    if (genomicProfile.biomarkers?.hrdScore?.interpretation === 'HRD-positive') {
    const baseParamsHRD = {
      biomarker: 'HRD-positive',
      condition: patientProfile.diagnosis,
      intervention: 'olaparib OR rucaparib OR niraparib OR PARP inhibitor',
      age: patientProfile.age,
      gender: patientProfile.gender,
      status: 'recruiting'
    };
    if (trialLocation) Object.assign(baseParamsHRD, {
      country: trialLocation.country,
      city: trialLocation.city,
      searchRadius: trialLocation.searchRadius,
      includeAllLocations: trialLocation.includeAllLocations
    });
    if (typeof onProgress === 'function') onProgress('Searching for HRD-positive trials on ClinicalTrials.gov');
    searchPromises.push(searchTrials(baseParamsHRD));
    attempted.push('HRD');
  }

  // Search for other significant mutations
  const otherMutations = genomicProfile.mutations?.filter(
    m => m.significance === 'pathogenic' && m.gene !== 'BRCA1' && m.gene !== 'BRCA2'
  );

    if (otherMutations && otherMutations.length > 0) {
    // Search for trials targeting specific genes
    const topGenes = otherMutations.slice(0, 3); // Limit to top 3 mutations
    topGenes.forEach(mutation => {
      const gp = {
        gene: mutation.gene,
        condition: patientProfile.diagnosis,
        age: patientProfile.age,
        gender: patientProfile.gender,
        status: 'recruiting'
      };
      if (trialLocation) Object.assign(gp, {
        country: trialLocation.country,
        city: trialLocation.city,
        searchRadius: trialLocation.searchRadius,
        includeAllLocations: trialLocation.includeAllLocations
      });
      if (typeof onProgress === 'function') onProgress(`Searching for gene ${mutation.gene} trials on ClinicalTrials.gov`);
      searchPromises.push(searchTrials(gp));
      attempted.add && attempted.add(mutation.gene);
    });
  }

  // General search by diagnosis
  const generalParams = {
    condition: patientProfile.diagnosis,
    age: patientProfile.age,
    gender: patientProfile.gender,
    status: 'recruiting'
  };
  if (trialLocation) Object.assign(generalParams, {
    country: trialLocation.country,
    city: trialLocation.city,
    searchRadius: trialLocation.searchRadius,
    includeAllLocations: trialLocation.includeAllLocations
  });
  if (typeof onProgress === 'function') onProgress('Performing general diagnosis search on ClinicalTrials.gov');
  searchPromises.push(searchTrials(generalParams));
  attempted.push('general');

  // Execute all searches in parallel
  const results = await Promise.all(searchPromises);

  // Combine and deduplicate trials
  const allTrials = [];
  const seenIds = new Set();
  const attemptedSet = new Set();

  results.forEach(result => {
    // Collect attempted sources info
    if (result?.attemptedSources && Array.isArray(result.attemptedSources)) {
      result.attemptedSources.forEach(s => attemptedSet.add(s));
    } else if (result?.source) {
      attemptedSet.add(result.source);
    }
    if (result.success && result.trials) {
      result.trials.forEach(trial => {
        if (!seenIds.has(trial.id)) {
          seenIds.add(trial.id);
          allTrials.push(trial);
        }
      });
    }
  });

  return {
    success: true,
    source: 'ClinicalTrials.gov',
    attemptedSources: Array.from(attemptedSet),
    totalResults: allTrials.length,
    trials: allTrials
  };
}

/**
 * Check if patient matches trial eligibility criteria
 * @param {Object} trial - Trial data
 * @param {Object} patientProfile - Patient demographics
 * @param {Object} genomicProfile - Patient's genomic profile
 * @returns {Object} - Match result with reasoning
 */
export function matchesTrialEligibility(trial, patientProfile, genomicProfile) {
  const matches = [];
  const mismatches = [];

  // Age check
  if (trial.eligibility?.minAge && patientProfile.age < trial.eligibility.minAge) {
    mismatches.push(`Patient age (${patientProfile.age}) below minimum (${trial.eligibility.minAge})`);
  }
  if (trial.eligibility?.maxAge && patientProfile.age > trial.eligibility.maxAge) {
    mismatches.push(`Patient age (${patientProfile.age}) above maximum (${trial.eligibility.maxAge})`);
  }
  if (!trial.eligibility?.minAge && !trial.eligibility?.maxAge) {
    matches.push('Age: No restrictions');
  } else if (mismatches.length === 0) {
    matches.push(`Age: ${patientProfile.age} (eligible)`);
  }

  // Gender check
  if (trial.eligibility?.gender && trial.eligibility.gender !== 'all') {
    if (trial.eligibility.gender.toLowerCase() === patientProfile.gender?.toLowerCase()) {
      matches.push(`Gender: ${patientProfile.gender} (matches)`);
    } else {
      mismatches.push(`Gender requirement: ${trial.eligibility.gender}, patient: ${patientProfile.gender}`);
    }
  }

  // Diagnosis check
  if (trial.conditions?.some(c => c.toLowerCase().includes(patientProfile.diagnosis?.toLowerCase()))) {
    matches.push(`Diagnosis: ${patientProfile.diagnosis} (matches)`);
  }

  // Genomic criteria checks
  if (genomicProfile) {
    // BRCA mutations
    const brcaMutations = genomicProfile.mutations?.filter(
      m => m.gene === 'BRCA1' || m.gene === 'BRCA2'
    );
    if (trial.genomicCriteria?.includes('BRCA') && brcaMutations?.length > 0) {
      matches.push(`BRCA mutation detected: ${brcaMutations.map(m => m.gene).join(', ')}`);
    }

    // TMB-high
    if (trial.genomicCriteria?.includes('TMB-high') &&
        genomicProfile.biomarkers?.tumorMutationalBurden?.interpretation === 'high') {
      matches.push(`TMB-high (${genomicProfile.biomarkers.tumorMutationalBurden.value} mutations/megabase)`);
    }

    // MSI-H
    if (trial.genomicCriteria?.includes('MSI-H') &&
        genomicProfile.biomarkers?.microsatelliteInstability?.status === 'MSI-H') {
      matches.push('MSI-H detected');
    }

    // HRD-positive
    if (trial.genomicCriteria?.includes('HRD') &&
        genomicProfile.biomarkers?.hrdScore?.interpretation === 'HRD-positive') {
      matches.push(`HRD-positive (score: ${genomicProfile.biomarkers.hrdScore.value})`);
    }
  }

  const isEligible = mismatches.length === 0;
  const matchScore = matches.length / (matches.length + mismatches.length);

  return {
    isEligible,
    matchScore,
    matches,
    mismatches,
    reasoning: isEligible
      ? `Patient meets all eligibility criteria (${matches.length} matches)`
      : `Patient does not meet some criteria (${mismatches.length} mismatches)`
  };
}

/**
 * Extract genomic criteria from eligibility text
 * @param {string} eligibilityText - Trial eligibility criteria text
 * @returns {Array<string>} - List of genomic criteria
 */
function extractGenomicCriteria(eligibilityText) {
  const criteria = [];
  const text = eligibilityText.toLowerCase();

  // Check for common genomic markers
  if (text.includes('brca') || text.includes('brca1') || text.includes('brca2')) {
    criteria.push('BRCA');
  }
  if (text.includes('tmb') || text.includes('tumor mutational burden') || text.includes('tmb-high')) {
    criteria.push('TMB-high');
  }
  if (text.includes('msi-h') || text.includes('microsatellite instability-high') || text.includes('msi high')) {
    criteria.push('MSI-H');
  }
  if (text.includes('hrd') || text.includes('homologous recombination deficiency') || text.includes('hrd-positive')) {
    criteria.push('HRD');
  }
  if (text.includes('pd-l1') || text.includes('pdl1')) {
    criteria.push('PD-L1');
  }
  if (text.includes('her2') || text.includes('her-2')) {
    criteria.push('HER2');
  }
  if (text.includes('ntrk') || text.includes('trk fusion')) {
    criteria.push('NTRK');
  }
  if (text.includes('alk') || text.includes('alk fusion')) {
    criteria.push('ALK');
  }
  if (text.includes('egfr')) {
    criteria.push('EGFR');
  }
  if (text.includes('kras')) {
    criteria.push('KRAS');
  }

  return criteria;
}

// Legacy exports for backward compatibility
export const searchJRCT = searchTrials;
export const searchJRCTByGenomicProfile = searchTrialsByGenomicProfile;
export const matchesJRCTEligibility = matchesTrialEligibility;
export const getJRCTTrial = getTrialDetails;

export default {
  searchTrials,
  searchTrialsByGenomicProfile,
  matchesTrialEligibility,
  getTrialDetails,
  // Legacy exports
  searchJRCT,
  searchJRCTByGenomicProfile,
  matchesJRCTEligibility,
  getJRCTTrial
};

