import axios from 'axios';

// JRCT API Base URL (proxied). Use env override or localhost proxy in development.
const DEFAULT_PROXY_PATH = '/api/jrct-proxy/api/2.0';
const JRCT_API_BASE = (function() {
  // Allow explicit override via environment variable
  if (process.env.REACT_APP_JRCT_PROXY_URL) return process.env.REACT_APP_JRCT_PROXY_URL.replace(/\/$/, '');

  // If running in development on localhost, use local proxy server if available
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:4000' + DEFAULT_PROXY_PATH;
  }

  // Production: assume same-origin serverless function at /api/jrct-proxy
  return DEFAULT_PROXY_PATH;
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
    out = out.filter(t => (t.country || '').toLowerCase().includes(countryLower) ||
      (t.locations || []).some(loc => {
        const q = typeof loc === 'string' ? loc.toLowerCase() : ((loc.country || '') + ' ' + (loc.city || '')).toLowerCase();
        return q.includes(countryLower);
      })
    );
  }

  // Radius filter (requires geocoding) — params.searchRadius in miles and params.city/country or params.zip
  if (params.searchRadius && !params.includeAllLocations) {
    // Build user location query from provided fields
    const userParts = [];
    if (params.city) userParts.push(params.city);
    if (params.state) userParts.push(params.state);
    if (params.zip) userParts.push(params.zip);
    if (params.country) userParts.push(params.country);
    const userQuery = userParts.join(', ');
    const userGeo = await geocodeAddress(userQuery);
    if (!userGeo) return out; // can't apply radius

    const radius = Number(params.searchRadius) || 0;
    const filtered = [];

    // For each trial, see if any location geocodes within radius
    for (const trial of out) {
      const locs = trial.locations || [];
      let keep = false;
      for (const loc of locs) {
        const q = locationToQuery(loc);
        if (!q) continue;
        const geo = await geocodeAddress(q);
        if (!geo) continue;
        const d = distanceMiles(userGeo.lat, userGeo.lon, geo.lat, geo.lon);
        if (d <= radius) { keep = true; break; }
      }
      if (keep) filtered.push(trial);
    }

    return filtered;
  }

  return out;
}

/**
 * Search JRCT (Japan Registry of Clinical Trials) for matching trials
 * @param {Object} params - Search parameters
 * @returns {Promise<Object>} - Search results with normalized trial data
 */
export async function searchJRCT(params) {
  const {
    condition,        // Cancer type (e.g., "Ovarian Cancer", "乳癌")
    intervention,     // Drug/therapy name
    phase,           // Trial phase (1, 2, 3, 4)
    status,          // recruiting, active, completed
    age,             // Patient age
    gender,          // male, female
    gene,            // Gene mutation (BRCA1, TP53, etc.)
    biomarker        // Biomarker (TMB-high, MSI-H, HRD-positive)
  } = params;

  const attempted = [];
  const onProgress = params?.onProgress;

  try {
    // Build search parameters
    const searchParams = new URLSearchParams();

    if (condition) searchParams.append('condition', condition);
    if (intervention) searchParams.append('intervention', intervention);
    if (phase) searchParams.append('phase', phase);
    if (status) searchParams.append('status', status || 'recruiting');
    if (age) searchParams.append('age', age);
    if (gender) searchParams.append('gender', gender);
    if (gene) searchParams.append('gene', gene);
    if (biomarker) searchParams.append('biomarker', biomarker);

    if (typeof onProgress === 'function') onProgress('Querying JRCT');
    const response = await axios.get(`${JRCT_API_BASE}/trials?${searchParams.toString()}`, {
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'en,ja'
      },
      timeout: 15000
    });

    let trials = response.data.trials ? response.data.trials.map(trial => normalizeJRCTTrial(trial)) : [];

    // Apply location filters (country and optional radius)
    trials = await applyLocationFilters(trials, params);

    attempted.push('JRCT');
    if (typeof onProgress === 'function') onProgress('JRCT returned results');

    return {
      success: true,
      source: 'JRCT',
      attemptedSources: attempted,
      totalResults: trials.length,
      trials
    };

  } catch (error) {
    console.error('Error searching JRCT:', error);

    // JRCT failed; record attempt
    attempted.push('JRCT');
    if (typeof onProgress === 'function') onProgress('JRCT failed — trying WHO');

    // Try WHO ICTRP as first fallback
    try {
      attempted.push('WHO-ICTRP');
      if (typeof onProgress === 'function') onProgress('Querying WHO-ICTRP');
      const who = await searchWHO(params);
      if (who.success && who.trials.length > 0) {
        if (typeof onProgress === 'function') onProgress('WHO-ICTRP returned results');
        return { ...who, attemptedSources: attempted };
      }
    } catch (e) {
      console.warn('WHO fallback failed:', e?.message || e);
    }

    // Then try ClinicalTrials.gov
    try {
      attempted.push('ClinicalTrials.gov');
      if (typeof onProgress === 'function') onProgress('Querying ClinicalTrials.gov');
      const ct = await searchCTGov(params);
      if (ct.success && ct.trials.length > 0) {
        if (typeof onProgress === 'function') onProgress('ClinicalTrials.gov returned results');
        return { ...ct, attemptedSources: attempted };
      }
    } catch (e) {
      console.warn('ClinicalTrials.gov fallback failed:', e?.message || e);
    }

    // Return empty results if all sources fail
    return {
      success: false,
      source: 'JRCT',
      attemptedSources: attempted,
      totalResults: 0,
      trials: [],
      error: error.message
    };
  }
}

/**
 * Search ClinicalTrials.gov as a fallback source
 */
export async function searchCTGov(params) {
  try {
    const { condition, age, gender } = params;

    // Build expression (simple: condition + age + gender)
    let expr = '';
    if (condition) expr += condition;
    if (gender) expr += ` AND ${gender}`;
    if (age) expr += ` AND ${age}`;

    const fields = [
      'NCTId', 'BriefTitle', 'Condition', 'OverallStatus', 'Phase', 'BriefSummary', 'LocationCity', 'LocationCountry'
    ].join(',');

    const url = `https://clinicaltrials.gov/api/query/study_fields?expr=${encodeURIComponent(expr)}&fields=${fields}&min_rnk=1&max_rnk=50&fmt=json`;

    const res = await axios.get(url, { timeout: 15000 });
    const studies = res.data.StudyFieldsResponse?.Study || [];

    let trials = studies.map(s => ({
      id: s.NCTId?.[0] || null,
      source: 'ClinicalTrials.gov',
      title: s.BriefTitle?.[0] || '',
      conditions: s.Condition || [],
      status: s.OverallStatus?.[0] || '',
      phase: s.Phase?.[0] || '',
      summary: s.BriefSummary?.[0] || '',
      locations: (s.LocationCity || []).map((city, idx) => ({ city, country: s.LocationCountry?.[idx] || '' })),
      url: s.NCTId?.[0] ? `https://clinicaltrials.gov/study/${s.NCTId[0]}` : null
    }));

    // Apply location filters if provided
    trials = await applyLocationFilters(trials, params);

    return { success: true, source: 'ClinicalTrials.gov', totalResults: trials.length, trials };
  } catch (error) {
    console.error('Error searching ClinicalTrials.gov:', error?.message || error);
    return { success: false, source: 'ClinicalTrials.gov', totalResults: 0, trials: [], error: error.message };
  }
}

/**
 * Placeholder: attempt WHO ICTRP search. The ICTRP public API/endpoint may vary.
 * We attempt a best-effort call and gracefully fail back to ClinicalTrials.gov.
 */
export async function searchWHO(params) {
  try {
    const { condition } = params;
    // WHO TrialSearch API (trialsearch.who.int) - best-effort path
    const url = `https://trialsearch.who.int/api/v1/trials?search=${encodeURIComponent(condition || '')}&pageSize=50`;
    const res = await axios.get(url, { timeout: 15000 });
    const items = res.data?.items || res.data?.trials || [];

    let trials = items.map(item => ({
      id: item.trial_id || item.id || null,
      source: 'WHO-ICTRP',
      title: item.title || item.brief_title || '',
      conditions: item.conditions || item.condition || [],
      status: item.status || item.recruitment_status || '',
      phase: item.phase || '',
      summary: item.summary || item.brief_summary || '',
      locations: item.locations || [],
      url: item.url || item.link || null
    }));

    // Apply location filters if provided
    trials = await applyLocationFilters(trials, params);

    return { success: true, source: 'WHO-ICTRP', totalResults: trials.length, trials };
  } catch (error) {
    console.error('Error searching WHO ICTRP:', error?.message || error);
    return { success: false, source: 'WHO-ICTRP', totalResults: 0, trials: [], error: error.message };
  }
}

/**
 * Get detailed information for a specific JRCT trial
 * @param {string} trialId - JRCT trial ID
 * @returns {Promise<Object>} - Detailed trial information
 */
export async function getJRCTTrial(trialId) {
  try {
    const response = await axios.get(`${JRCT_API_BASE}/trials/${trialId}`, {
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'en,ja'
      },
      timeout: 10000
    });

    return {
      success: true,
      trial: normalizeJRCTTrial(response.data)
    };

  } catch (error) {
    console.error('Error fetching JRCT trial:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Search JRCT trials by genomic profile
 * @param {Object} genomicProfile - Patient's genomic profile from Firestore
 * @param {Object} patientProfile - Patient demographics
 * @returns {Promise<Object>} - Matching trials
 */
export async function searchJRCTByGenomicProfile(genomicProfile, patientProfile, trialLocation) {
  const searchPromises = [];
  const attempted = [];
  const onProgress = (trialLocation && trialLocation.onProgress) || null;

  // Search for BRCA-related trials
  const brcaMutations = genomicProfile.mutations?.filter(
    m => m.gene === 'BRCA1' || m.gene === 'BRCA2'
  );

    if (brcaMutations && brcaMutations.length > 0) {
    const baseParams = {
      gene: 'BRCA',
      condition: patientProfile.diagnosis,
      age: patientProfile.age,
      gender: patientProfile.gender,
      status: 'recruiting'
    };
    if (trialLocation) {
      baseParams.country = trialLocation.country;
      baseParams.city = trialLocation.city;
      baseParams.searchRadius = trialLocation.searchRadius;
      baseParams.includeAllLocations = trialLocation.includeAllLocations;
    }
    if (typeof onProgress === 'function') onProgress('Searching for BRCA-related trials');
    searchPromises.push(searchJRCT(baseParams));
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
    if (typeof onProgress === 'function') onProgress('Searching for TMB-high trials');
    searchPromises.push(searchJRCT(baseParamsTMB));
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
    if (typeof onProgress === 'function') onProgress('Searching for MSI-H trials');
    searchPromises.push(searchJRCT(baseParamsMSI));
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
    if (typeof onProgress === 'function') onProgress('Searching for HRD-positive trials');
    searchPromises.push(searchJRCT(baseParamsHRD));
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
      if (typeof onProgress === 'function') onProgress(`Searching for gene ${mutation.gene} trials`);
      searchPromises.push(searchJRCT(gp));
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
  if (typeof onProgress === 'function') onProgress('Performing general diagnosis search');
  searchPromises.push(searchJRCT(generalParams));
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
    source: 'JRCT',
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
export function matchesJRCTEligibility(trial, patientProfile, genomicProfile) {
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
 * Normalize JRCT trial data to common format
 * @param {Object} rawTrial - Raw trial data from JRCT API
 * @returns {Object} - Normalized trial data
 */
function normalizeJRCTTrial(rawTrial) {
  return {
    id: rawTrial.jrct_id || rawTrial.id,
    source: 'JRCT',

    // Title (bilingual)
    title: rawTrial.title_en || rawTrial.title,
    titleJa: rawTrial.title_ja || rawTrial.title,

    // Basic information
    phase: rawTrial.phase || 'Not specified',
    status: rawTrial.recruitment_status || rawTrial.status || 'unknown',
    conditions: rawTrial.conditions || [],
    interventions: rawTrial.interventions || [],

    // Study details
    summary: rawTrial.summary_en || rawTrial.brief_summary,
    summaryJa: rawTrial.summary_ja,
    description: rawTrial.detailed_description_en || rawTrial.detailed_description,
    descriptionJa: rawTrial.detailed_description_ja,

    // Sponsor and location
    sponsor: rawTrial.sponsor || rawTrial.lead_sponsor,
    locations: rawTrial.locations || [],
    country: 'Japan',

    // Eligibility
    eligibility: {
      minAge: rawTrial.minimum_age,
      maxAge: rawTrial.maximum_age,
      gender: rawTrial.gender || rawTrial.sex,
      criteria: rawTrial.eligibility_criteria_en || rawTrial.eligibility_criteria,
      criteriaJa: rawTrial.eligibility_criteria_ja
    },

    // Dates
    startDate: rawTrial.start_date,
    completionDate: rawTrial.completion_date,
    lastUpdated: rawTrial.last_update_date,

    // Contact
    contact: rawTrial.contact,
    contactEmail: rawTrial.contact_email,

    // Genomic criteria (extracted from eligibility text)
    genomicCriteria: extractGenomicCriteria(
      rawTrial.eligibility_criteria_en || rawTrial.eligibility_criteria || ''
    ),

    // URLs
    url: `https://jrct.niph.go.jp/en-latest-detail/${rawTrial.jrct_id || rawTrial.id}`,
    urlJa: `https://jrct.niph.go.jp/latest-detail/${rawTrial.jrct_id || rawTrial.id}`,

    // Additional metadata
    studyType: rawTrial.study_type || 'Interventional',
    primaryOutcome: rawTrial.primary_outcome,
    secondaryOutcome: rawTrial.secondary_outcome,
    enrollmentTarget: rawTrial.target_sample_size
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

export default {
  searchJRCT,
  getJRCTTrial,
  searchJRCTByGenomicProfile,
  matchesJRCTEligibility
};
