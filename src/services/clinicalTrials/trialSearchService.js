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
    
    // Normalize country names for better matching
    const countryVariations = {
      'japan': ['japan', 'japanese'],
      'united states': ['united states', 'usa', 'us', 'america'],
      'united kingdom': ['united kingdom', 'uk', 'britain', 'british'],
      'south korea': ['south korea', 'korea', 'korean'],
      'china': ['china', 'chinese'],
      'australia': ['australia', 'australian'],
      'canada': ['canada', 'canadian'],
      'germany': ['germany', 'german'],
      'france': ['france', 'french'],
      'italy': ['italy', 'italian'],
      'spain': ['spain', 'spanish']
    };
    
    // Get all variations for the country
    let searchTerms = [countryLower];
    for (const [key, variations] of Object.entries(countryVariations)) {
      if (variations.includes(countryLower)) {
        searchTerms = variations;
        break;
      }
    }
    
    
    out = out.filter(t => {
      // Check trial's country field (this is the first country from locations, may not be complete)
      const trialCountry = (t.country || '').toLowerCase();
      if (searchTerms.some(term => trialCountry.includes(term))) {
        return true;
      }
      
      // Check trial locations (this is the authoritative source)
      const locations = t.locations || [];
      if (locations.length === 0) {
        // If no location data and country filter is active, exclude the trial
        // (we can't verify it's in the requested country)
        return false;
      }
      
      // Check if any location matches the search country
      const hasMatch = locations.some(loc => {
        if (typeof loc === 'string') {
          const matches = searchTerms.some(term => loc.toLowerCase().includes(term));
          if (matches) {
          }
          return matches;
        }
        // Check location object's country field
        const locCountry = (loc.country || '').toLowerCase();
        if (locCountry && searchTerms.some(term => locCountry.includes(term))) {
          return true;
        }
        // Also check city field (some locations might have country in city field)
        const locCity = (loc.city || '').toLowerCase();
        if (locCity && searchTerms.some(term => locCity.includes(term))) {
          return true;
        }
        return false;
      });
      
      if (!hasMatch) {
        // Log why this trial was excluded
        const allCountries = [...new Set(locations.map(loc => {
          if (typeof loc === 'string') {
            const parts = loc.split(',').map(s => s.trim());
            return parts[parts.length - 1] || '';
          }
          return loc.country || '';
        }).filter(Boolean))];
      }
      
      return hasMatch;
    });
    
  }

  // If includeAllLocations is true, return all trials (no filtering)
  return out;
}

/**
 * Search JRCT (Japan Registry of Clinical Trials)
 * @param {Object} params - Search parameters
 * @returns {Promise<Object>} - Search results with normalized trial data
 */
async function searchJRCT(params) {
  const onProgress = params?.onProgress;
  const pageNumber = params?.pageNumber || 1;
  
  try {
    // Progress message is handled by parent searchTrials function
    // This allows showing multiple sources being queried simultaneously
    
    // Build search query from params
    // IMPORTANT: JRCT has separate fields:
    // - reg_plobrem_1 (対象疾患名 / Target Disease Name) for main disease (cond)
    // - demo_1 (フリーワード検索 / Free Word Search) for subtype/keywords (term)
    // We'll pass both separately: disease in 'q' param, subtype in 'term' param
    let diseaseQuery = '';
    let subtypeQuery = '';
    try {
      const { cond, term } = buildCTGovExpr(params || {});
      // Use cond (disease/condition) for the disease field
      diseaseQuery = (cond || '').trim();
      // Use term (subtype) for the keyword/search field
      // IMPORTANT: JRCT keyword search needs all words but lowercase
      // Convert "Clear Cell Carcinoma" to "clear cell carcinoma" (all words, lowercase)
      let rawSubtype = (term || '').trim();
      if (rawSubtype) {
        // Lowercase all words for better matching with JRCT database
        subtypeQuery = rawSubtype.toLowerCase();
      }
    } catch (err) {
      console.error('Error building JRCT query:', err.message);
      return { success: false, source: 'JRCT', trials: [], totalResults: 0, error: 'Failed to build search query' };
    }
    
    // If disease query is empty, skip JRCT search (not an error, just no results)
    // Subtype can be empty (it's optional), but disease is required
    if (!diseaseQuery || diseaseQuery.trim().length === 0) {
      // Progress message is handled by parent searchTrials function
      return { success: false, source: 'JRCT', trials: [], totalResults: 0 };
    }
    
    // Query JRCT proxy endpoint
    // Pass disease in 'q' param and subtype in 'term' param
    const encodedDisease = encodeURIComponent(diseaseQuery);
    const encodedSubtype = subtypeQuery ? encodeURIComponent(subtypeQuery) : '';
    
    // Build URL with optional term parameter
    let proxyUrl = `/api/jrct/search?q=${encodedDisease}&page=${pageNumber}`;
    if (encodedSubtype && encodedSubtype.length > 0 && encodedSubtype !== '%20') {
      proxyUrl += `&term=${encodedSubtype}`;
    }
    
    let response;
    try {
      response = await axios.get(proxyUrl, { 
        timeout: 70000, // 70 seconds - JRCT searches can take 11-13 seconds, plus processing time
        // Need buffer above proxy timeout (60s) to handle network latency
        validateStatus: (status) => status < 500 // Accept 4xx as valid responses, but not 5xx
      });
    } catch (axiosError) {
      // Handle axios errors (network, timeout, etc.)
      if (axiosError.response) {
        // Server responded with error status (including 400 for empty query)
        const status = axiosError.response.status;
        const errorData = axiosError.response.data;
        
        // Don't log 400 errors as they're expected for empty queries
        if (status >= 500) {
          console.error('JRCT search HTTP error:', status, errorData);
        }
        
        return { 
          success: false, 
          source: 'JRCT', 
          trials: [], 
          totalResults: 0, 
          error: errorData?.message || errorData?.error || `HTTP ${status}` 
        };
      } else {
        // Network error, timeout, etc.
        console.error('JRCT search network error:', axiosError.message);
        return { 
          success: false, 
          source: 'JRCT', 
          trials: [], 
          totalResults: 0, 
          error: axiosError.message 
        };
      }
    }
    
    // Check for error response
    if (response.status >= 400) {
      // 400 errors are expected for empty queries, don't log as error
      if (response.status >= 500) {
        console.error('JRCT search error response:', response.status, response.data);
      }
      return { 
        success: false, 
        source: 'JRCT', 
        trials: [], 
        totalResults: 0, 
        error: response.data?.message || response.data?.error || `HTTP ${response.status}` 
      };
    }
    
    if (!response.data || response.data.error) {
      // Check if response indicates an error
      return { 
        success: false, 
        source: 'JRCT', 
        trials: [], 
        totalResults: 0, 
        error: response.data?.error || response.data?.message || 'Invalid response' 
      };
    }
    
    if (!response.data.results || !Array.isArray(response.data.results)) {
      return { success: false, source: 'JRCT', trials: [], totalResults: 0, error: 'Invalid response format' };
    }
    
    // Normalize JRCT results to match ClinicalTrials.gov format
    // Note: Backend already filters by recruiting status (filterRecruiting=true by default)
    // So we trust the backend filter and just normalize the data format
    const trials = response.data.results
          .map(result => {
            // Map JRCT status from Japanese to English (matching ClinicalTrials.gov format - all caps)
            const statusMap = {
              '募集中': 'RECRUITING',
              '受付中': 'RECRUITING',
              '継続中': 'ONGOING',
              '終了': 'COMPLETED',
              '中止': 'TERMINATED',
              '未開始': 'NOT_YET_RECRUITING'
            };
            
            const normalizedStatus = statusMap[result.status] || result.status || 'UNKNOWN';
            
            // Try to extract phase from title or condition if available
            const extractPhaseFromText = (text) => {
              if (!text) return '';
              const textNormalized = text.replace(/\s+/g, ' ').trim();
              
              // Combined phases: Phase I/II, Phase 1/2, etc.
              const combinedMatch = textNormalized.match(/\bphase\s+([ivxlcdm]+|[1-4])\s*[/-]\s*([ivxlcdm]+|[1-4])\b/i);
              if (combinedMatch) {
                const numToRoman = { '1': 'I', '2': 'II', '3': 'III', '4': 'IV' };
                const p1 = numToRoman[combinedMatch[1]] || combinedMatch[1].toUpperCase();
                const p2 = numToRoman[combinedMatch[2]] || combinedMatch[2].toUpperCase();
                return `Phase ${p1}/${p2}`;
              }
              
              // Single phases: Phase I, Phase II, Phase 1, etc.
              const singleMatch = textNormalized.match(/\bphase\s+([ivxlcdm]+|[1-4])\b/i);
              if (singleMatch) {
                const numToRoman = { '1': 'I', '2': 'II', '3': 'III', '4': 'IV' };
                const phaseStr = numToRoman[singleMatch[1]] || singleMatch[1].toUpperCase();
                return `Phase ${phaseStr}`;
              }
              
              // Japanese: フェーズI, フェーズ1, etc.
              const japaneseMatch = textNormalized.match(/フェーズ\s*([ivxlcdm]+|[1-4]|[一二三四])/i);
              if (japaneseMatch) {
                const jpToRoman = { '一': 'I', '二': 'II', '三': 'III', '四': 'IV' };
                const numToRoman = { '1': 'I', '2': 'II', '3': 'III', '4': 'IV' };
                const phaseStr = jpToRoman[japaneseMatch[1]] || numToRoman[japaneseMatch[1]] || japaneseMatch[1].toUpperCase();
                return `Phase ${phaseStr}`;
              }
              
              return '';
            };
            
            // Try to extract phase from title or condition
            let extractedPhase = extractPhaseFromText(result.title) || extractPhaseFromText(result.condition) || '';
            
            return {
              id: result.id,
              source: 'JRCT',
              title: result.title,
              titleJa: result.title, // Store Japanese title separately
              conditions: result.condition ? [result.condition] : [],
              status: normalizedStatus,
              statusJa: result.status, // Keep original Japanese status
              phase: extractedPhase, // Extract from title/condition if available, otherwise empty (will be populated from detail page)
              summary: '', // Will be fetched from detail if needed
              locations: [{ country: 'Japan' }], // JRCT trials are in Japan
              country: 'Japan',
              published: result.published,
              url: result.detailUrl || `https://jrct.mhlw.go.jp/latest-detail/${result.id}`,
              detailUrl: result.detailUrl,
              // Store the search query that returned this trial for detail fetching
              _searchQuery: diseaseQuery + (subtypeQuery ? ` ${subtypeQuery}` : ''), // Internal: used for fetching details later
              // Store token data extracted from search results (for direct detail access)
              _tokenData: result.tokenData || null // Internal: token from search results page
            };
          });
    
    const totalResults = response.data.total || trials.length;
    const validTrials = trials.filter(t => t.id);
    
    return {
      success: true,
      source: 'JRCT',
      trials: validTrials, // Filter out invalid trials
      totalResults,
      pagination: response.data.pages ? {
        currentPage: pageNumber,
        totalPages: Math.ceil(totalResults / 20), // JRCT typically shows 20 per page
        hasMore: response.data.pages.some(p => p.label.toLowerCase().includes('next') || p.label.includes('次'))
      } : null
    };
  } catch (error) {
    // Silently fail JRCT search - don't block overall search
    return { success: false, source: 'JRCT', trials: [], totalResults: 0, error: error.message };
  }
}

/**
 * Search clinical trials from available sources (ClinicalTrials.gov, JRCT, and WHO ICTRP)
 * @param {Object} params - Search parameters
 * @returns {Promise<Object>} - Search results with normalized trial data
 */
export async function searchTrials(params) {
  const attempted = [];
  const onProgress = params?.onProgress;
  const pageNumber = params?.pageNumber || 1;
  const pageSize = params?.pageSize || 50;
  
  // Track active searches for progress display
  const activeSearches = new Set();
  
  // Helper to update progress message showing all active searches
  const updateProgress = () => {
    if (typeof onProgress === 'function' && activeSearches.size > 0) {
      const sources = Array.from(activeSearches).sort();
      if (sources.length === 1) {
        onProgress(`Querying ${sources[0]}...`);
      } else {
        onProgress(`Querying ${sources.join(' and ')}...`);
      }
    }
  };
  
  // Search both ClinicalTrials.gov and JRCT in parallel
  const searchPromises = [];
  
  // Search ClinicalTrials.gov
  try {
    activeSearches.add('ClinicalTrials.gov');
    updateProgress();
    attempted.push('ClinicalTrials.gov');
    
    // Build v2 API compatible query parameters
    // IMPORTANT MAPPING:
    // - query.cond = Main disease/condition (e.g., "Ovarian Cancer")
    // - query.term = Patient subtype (e.g., "Clear Cell Sarcoma")
    // This matches ClinicalTrials.gov search interface: Condition field = query.cond, Other terms field = query.term
    const { cond, term } = buildCTGovExpr(params);
    // IMPORTANT: LocationCity and LocationCountry are NOT available in v2 API fields parameter
    // Location data is only in full study response (protocolSection.contactsLocationsModule.locations)
    // So we DON'T specify fields parameter - this forces API to return full v2 format with location data
    if (params?.country) {
    }
    
    // Check if query is too long for GET request (limit ~2000 chars for URL)
    const queryLength = encodeURIComponent(cond).length + encodeURIComponent(term).length;
    const maxUrlLength = 2000;
    
    let ctRaw;
    
    if (queryLength > maxUrlLength) {
      // Use POST request for long queries
      // Progress message already shows active searches
      
      const postData = {
        source: 'ctgov',
        'query.term': term || '',
        'query.cond': cond || '',
        // Don't specify fields - get full study data with locations
        pageSize: pageSize,
        pageNumber: pageNumber,
        fmt: 'json'
      };
      
      // Add location filter parameters if provided
      if (params?.country) {
        postData.country = params.country;
        postData.includeAllLocations = params.includeAllLocations ? 'true' : 'false';
      }
      
      // Log POST data
      
      ctRaw = await axios.post(PROXY_BASE, postData, {
        timeout: 20000,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }).then(r => {
        return r.data;
      }).catch(err => {
        return null;
      });
    } else {
      // Use GET request for shorter queries
      // Don't specify fields parameter - get full study data with locations
      // Include country and includeAllLocations parameters for backend filtering
      const proxyParams = new URLSearchParams({
        source: 'ctgov',
        'query.term': term || '',
        'query.cond': cond || '',
        pageSize: pageSize.toString(),
        pageNumber: pageNumber.toString(),
        fmt: 'json'
      });
      
      // Add location filter parameters if provided
      if (params?.country) {
        proxyParams.set('country', params.country);
        proxyParams.set('includeAllLocations', params.includeAllLocations ? 'true' : 'false');
      }
      
      const proxyUrl = `${PROXY_BASE}?${proxyParams.toString()}`;
      
      // Log full URL (not truncated)
      
      ctRaw = await axios.get(proxyUrl, { 
        timeout: 20000,
        headers: {
          'Accept': 'application/json'
        }
      }).then(r => {
        return r.data;
      }).catch(err => {
        return null;
      });
    }
    
    if (ctRaw) {
      
      // Log location filter params
      if (params.country) {
      }
      
      const ctResult = await searchCTGov({ ...params, _rawCTGovResponse: ctRaw });
      searchPromises.push(
        Promise.resolve(ctResult).finally(() => {
          activeSearches.delete('ClinicalTrials.gov');
          updateProgress();
        })
      );
    } else {
      activeSearches.delete('ClinicalTrials.gov');
      updateProgress();
      searchPromises.push(Promise.resolve({ success: false, source: 'ClinicalTrials.gov', trials: [], totalResults: 0 }));
    }
  } catch (e) {
    activeSearches.delete('ClinicalTrials.gov');
    updateProgress();
    searchPromises.push(Promise.resolve({ success: false, source: 'ClinicalTrials.gov', trials: [], totalResults: 0, error: e.message }));
  }
  
  // Search JRCT in parallel
  try {
    activeSearches.add('JRCT');
    updateProgress();
    searchPromises.push(
      searchJRCT({ ...params, onProgress: null }).finally(() => {
        activeSearches.delete('JRCT');
        updateProgress();
      })
    );
    attempted.push('JRCT');
  } catch (e) {
    activeSearches.delete('JRCT');
    updateProgress();
    // Silently skip JRCT if there's an error
    searchPromises.push(Promise.resolve({ success: false, source: 'JRCT', trials: [], totalResults: 0 }));
  }
  
  // Search WHO ICTRP in parallel (optional - may have overlap with JRCT and ClinicalTrials.gov)
  // Only search if includeAllLocations is true (since WHO is global and aggregates from multiple sources)
  if (params?.includeAllLocations) {
    try {
      activeSearches.add('WHO ICTRP');
      updateProgress();
      searchPromises.push(
        searchWHO(params).finally(() => {
          activeSearches.delete('WHO ICTRP');
          updateProgress();
        })
      );
      attempted.push('WHO-ICTRP');
    } catch (e) {
      activeSearches.delete('WHO ICTRP');
      updateProgress();
      // Silently skip WHO if there's an error
      searchPromises.push(Promise.resolve({ success: false, source: 'WHO-ICTRP', trials: [], totalResults: 0 }));
    }
  }
  
  // Wait for all searches to complete
  const results = await Promise.all(searchPromises);
  
  // Combine results from all sources
  const allTrials = [];
  const seenIds = new Set();
  let totalResults = 0;
  
  results.forEach(result => {
    if (result.success && result.trials && Array.isArray(result.trials)) {
      totalResults += result.totalResults || result.trials.length;
      result.trials.forEach(trial => {
        // Deduplicate by trial ID (in case same trial appears in multiple sources)
        if (trial.id && !seenIds.has(trial.id)) {
          seenIds.add(trial.id);
          allTrials.push(trial);
        }
      });
    }
  });
  
  // If we got results from any source, return success
  if (allTrials.length > 0) {
    // Determine pagination from the most comprehensive result
    const ctResult = results.find(r => r.source === 'ClinicalTrials.gov' && r.success);
    const pagination = ctResult?.pagination || (allTrials.length >= pageSize ? {
      currentPage: pageNumber,
      hasMore: true
    } : null);
    
    if (typeof onProgress === 'function') {
      const ctCount = results.find(r => r.source === 'ClinicalTrials.gov')?.trials?.length || 0;
      const jrctCount = results.find(r => r.source === 'JRCT')?.trials?.length || 0;
      const whoCount = results.find(r => r.source === 'WHO-ICTRP')?.trials?.length || 0;
      const sourceParts = [];
      if (ctCount > 0) sourceParts.push(`${ctCount} from ClinicalTrials.gov`);
      if (jrctCount > 0) sourceParts.push(`${jrctCount} from JRCT`);
      if (whoCount > 0) sourceParts.push(`${whoCount} from WHO`);
      onProgress(`Found ${allTrials.length} trials${sourceParts.length > 0 ? ` (${sourceParts.join(', ')})` : ''}`);
    }
    
    return {
      success: true,
      source: 'Aggregated',
      attemptedSources: attempted,
      totalResults: totalResults,
      trials: allTrials,
      pagination
    };
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
    
    
    // Handle v2 API format (preferred) - studies array with protocolSection
    if (raw && raw.studies && Array.isArray(raw.studies)) {
      // v2 API format: studies array with protocolSection structure
      studies = raw.studies.map(study => {
        try {
          const protocolSection = study.protocolSection || {};
          // Safely extract modules with fallbacks to prevent 'cannot read property of undefined' errors
          const identificationModule = protocolSection.identificationModule || {};
          const statusModule = protocolSection.statusModule || {};
          const designModule = protocolSection.designModule || {};
          const descriptionModule = protocolSection.descriptionModule || {};
          const conditionsModule = protocolSection.conditionsModule || {};
          const contactsLocationsModule = protocolSection.contactsLocationsModule || {};
          
          // Safely extract nctId with multiple fallbacks
          const nctId = identificationModule.nctId || study.nctId || study.id || '';
          if (!nctId) {
            return null;
          }
          
          // Safely extract title
          const briefTitle = identificationModule.briefTitle || 
                            identificationModule.officialTitle || 
                            study.title || 
                            '';
          
          // Safely extract conditions
          const conditions = (conditionsModule?.conditions || []).map(c => 
            typeof c === 'string' ? c : (c?.condition || c?.name || '')
          ).filter(Boolean);
          
          // Safely extract status
          const overallStatus = statusModule?.overallStatus || 
                               statusModule?.overallStatusList?.overallStatus || 
                               study.overallStatus || 
                               '';
          
          // Safely extract phases
          const phases = (designModule?.phases || []).map(p => 
            typeof p === 'string' ? p : (p?.phase || '')
          ).filter(Boolean);
          
          // Safely extract summary
          const briefSummary = descriptionModule?.briefSummary || 
                              descriptionModule?.detailedDescription?.text || 
                              study.summary || 
                              '';
          
          // Safely extract locations
          const locations = contactsLocationsModule?.locations || [];
          const locationCities = locations.map(loc => {
            try {
              return loc?.facility?.city || '';
            } catch (e) {
              return '';
            }
          }).filter(Boolean);
          
          const locationCountries = locations.map(loc => {
            try {
              return loc?.facility?.country || '';
            } catch (e) {
              return '';
            }
          }).filter(Boolean);
          
          // Convert v2 format to legacy StudyFieldsResponse format for compatibility
          return {
            NCTId: [nctId],
            BriefTitle: [briefTitle],
            Condition: conditions,
            OverallStatus: [overallStatus],
            Phase: phases,
            BriefSummary: [briefSummary],
            LocationCity: locationCities,
            LocationCountry: locationCountries
          };
        } catch (error) {
          return null;
        }
      }).filter(Boolean); // Remove null entries
    } else if (raw && raw.StudyFieldsResponse) {
      // Legacy format fallback
      studies = raw.StudyFieldsResponse.Study || [];
      if (studies.length > 0) {
        const firstStudy = studies[0];
        // Check for alternative location field names
        const locationKeys = Object.keys(firstStudy).filter(k => 
          k.toLowerCase().includes('location') || 
          k.toLowerCase().includes('city') || 
          k.toLowerCase().includes('country')
        );
        if (locationKeys.length > 0) {
          locationKeys.forEach(key => {
          });
        }
      }
    } else if (raw && Array.isArray(raw)) {
      studies = raw;
    } else {
      // Build expression - use proxy instead of direct API call for better reliability
      const { condition, patientProfile, additionalTerms, age, gender } = params;
      // ClinicalTrials.gov basic search only supports condition/keywords
      // Age and gender filtering should be done post-query or via eligibility criteria
      let cond = '';
      let term = '';
      
      if (patientProfile) {
        const result = buildSearchCondition(patientProfile, additionalTerms || []);
        cond = result.cond;
        term = result.term;
      } else if (condition) {
        // Legacy: try to parse condition string
        const andMatch = condition.match(/^(.+?)\s+AND\s+\((.+)\)$/i);
        if (andMatch) {
          cond = andMatch[1].trim();
          term = andMatch[2].trim();
        } else {
          cond = condition;
          term = '';
        }
      }
      // Don't specify fields - get full study data with locations
      
      // Use proxy endpoint for better CORS handling and error management
      // v2 API uses query.term, query.cond, and pageSize
      const url = `${PROXY_BASE}?source=ctgov&query.term=${encodeURIComponent(term || '')}&query.cond=${encodeURIComponent(cond || '')}&pageSize=50&pageNumber=1&fmt=json`;
      try {
        const res = await axios.get(url, { timeout: 20000 });
        const responseData = res.data;
        
        // Handle v2 API format (studies array with protocolSection)
        if (responseData.studies && Array.isArray(responseData.studies)) {
          studies = responseData.studies.map(study => {
            try {
              const protocolSection = study.protocolSection || {};
              // Safely extract modules with fallbacks
              const identificationModule = protocolSection.identificationModule || {};
              const statusModule = protocolSection.statusModule || {};
              const designModule = protocolSection.designModule || {};
              const descriptionModule = protocolSection.descriptionModule || {};
              const conditionsModule = protocolSection.conditionsModule || {};
              const contactsLocationsModule = protocolSection.contactsLocationsModule || {};
              
              // Safely extract nctId
              const nctId = identificationModule.nctId || study.nctId || study.id || '';
              if (!nctId) return null;
              
              // Safely extract all fields with fallbacks
              const briefTitle = identificationModule.briefTitle || identificationModule.officialTitle || study.title || '';
              const conditions = (conditionsModule?.conditions || []).map(c => 
                typeof c === 'string' ? c : (c?.condition || c?.name || '')
              ).filter(Boolean);
              const overallStatus = statusModule?.overallStatus || statusModule?.overallStatusList?.overallStatus || study.overallStatus || '';
              const phases = (designModule?.phases || []).map(p => 
                typeof p === 'string' ? p : (p?.phase || '')
              ).filter(Boolean);
              // Extract briefSummary - can be string or object with text property
              let briefSummary = '';
              if (descriptionModule?.briefSummary) {
                briefSummary = typeof descriptionModule.briefSummary === 'string' 
                  ? descriptionModule.briefSummary 
                  : (descriptionModule.briefSummary.text || descriptionModule.briefSummary.content || '');
              }
              if (!briefSummary && descriptionModule?.detailedDescription) {
                const detailedDesc = descriptionModule.detailedDescription;
                briefSummary = typeof detailedDesc === 'string' 
                  ? detailedDesc 
                  : (detailedDesc.text || detailedDesc.content || '');
              }
              if (!briefSummary) {
                briefSummary = study.summary || '';
              }
              
              // Safely extract locations from v2 API format
              // According to ClinicalTrials.gov API docs: protocolSection.contactsLocationsModule.locations[]
              // Each location has: facility { name, city, state, zip, country }
              const locations = contactsLocationsModule?.locations || [];
              const locationCities = [];
              const locationCountries = [];
              
              const locationDetails = [];
              locations.forEach(loc => {
                try {
                  // Handle both formats: facility as object or facility as string
                  const facility = loc?.facility;
                  const facilityName = typeof facility === 'string' 
                    ? facility 
                    : (facility?.name || '');
                  const city = loc?.city || facility?.city || '';
                  const state = loc?.state || facility?.state || facility?.province || '';
                  const country = loc?.country || facility?.country || '';
                  
                  if (city) locationCities.push(city);
                  if (country) locationCountries.push(country);
                  
                  // Store full location details including facility name
                  if (city || country || facilityName) {
                    locationDetails.push({
                      facility: facilityName,
                      city: city,
                      state: state,
                      country: country
                    });
                  }
                  
                  // Log if we find location data for debugging
                  if (city || country || facilityName) {
                  }
                } catch (e) {
                }
              });
              
              // Log location extraction summary
              if (locations.length > 0) {
              } else {
              }
              
              // Also check for location data in other possible fields
              if (locationCities.length === 0 && locationCountries.length === 0) {
                // Try alternative location fields
                const altLocations = study.locations || study.locationCountries || [];
                altLocations.forEach(loc => {
                  if (typeof loc === 'string') {
                    // If it's a country name, add it
                    if (loc.length > 2 && !loc.includes(',')) {
                      locationCountries.push(loc);
                    }
                  } else if (loc?.country) {
                    locationCountries.push(loc.country);
                  }
                });
              }
              
              // Convert v2 format to legacy StudyFieldsResponse format for compatibility
              return {
                NCTId: [nctId],
                BriefTitle: [briefTitle],
                Condition: conditions,
                OverallStatus: [overallStatus],
                Phase: phases,
                BriefSummary: [briefSummary],
                LocationCity: locationCities,
                LocationCountry: locationCountries,
                LocationDetails: locationDetails // Include full location details with facility names
              };
            } catch (error) {
              return null;
            }
          }).filter(Boolean); // Remove null entries
        } else if (responseData.StudyFieldsResponse) {
          // Legacy format fallback
          studies = responseData.StudyFieldsResponse.Study || [];
        }
      } catch (error) {
        // Return empty array on error
        studies = [];
      }
    }

    
    if (studies.length === 0) {
      if (raw) {
      }
      return { success: false, source: 'ClinicalTrials.gov', totalResults: 0, trials: [], error: 'No studies found in API response' };
    }

    let trials = studies.map(s => {
      const locationCities = s.LocationCity || [];
      const locationCountries = s.LocationCountry || [];
      const locationDetails = s.LocationDetails || []; // Get full location details if available
      
      // Build locations array - prefer LocationDetails if available, otherwise build from cities/countries
      let locations = [];
      if (locationDetails.length > 0) {
        // Use full location details with facility names
        locations = locationDetails.map(loc => ({
          facility: loc.facility || '',
          city: loc.city || '',
          state: loc.state || '',
          country: loc.country || ''
        }));
      } else {
        // Fallback: build from separate city/country arrays
        locations = locationCities.map((city, idx) => ({ 
          facility: '',
        city: typeof city === 'string' ? city : '', 
        country: (locationCountries[idx] || locationCountries[0] || '') 
      }));
      
      // If no cities but we have countries, create location entries from countries
      if (locations.length === 0 && locationCountries.length > 0) {
        locationCountries.forEach(country => {
          if (country) {
              locations.push({ 
                facility: '',
                city: '',
                country: typeof country === 'string' ? country : '' 
              });
          }
        });
        }
      }
      
      const status = s.OverallStatus?.[0] || s.OverallStatus || '';
      const statusLower = status.toLowerCase();
      
      // Filter out non-recruiting trials
      // Only include: RECRUITING, ACTIVE_NOT_RECRUITING is excluded
      const isRecruiting = statusLower.includes('recruiting') && 
                          !statusLower.includes('not_recruiting') && 
                          !statusLower.includes('not recruiting');
      
      if (!isRecruiting) {
        return null; // Skip non-recruiting trials
      }

      const trial = {
        id: s.NCTId?.[0] || s.NCTId || null,
        source: 'ClinicalTrials.gov',
        title: s.BriefTitle?.[0] || s.BriefTitle || '',
        conditions: s.Condition || [],
        status: status,
        phase: s.Phase?.[0] || s.Phase || '',
        summary: s.BriefSummary?.[0] || s.BriefSummary || '',
        locations: locations,
        // Also store country for easier filtering
        country: locationCountries[0] || '',
        url: (s.NCTId?.[0] || s.NCTId) ? `https://clinicaltrials.gov/study/${s.NCTId[0] || s.NCTId}` : null
      };
      return trial;
    }).filter(t => t && t.id); // Filter out null trials and trials without IDs

    if (trials.length > 0) {
      // Log trials with Japan locations for debugging
      const japanTrials = trials.filter(t => {
        const country = (t.country || '').toLowerCase();
        const hasJapan = t.locations?.some(loc => {
          const locCountry = (typeof loc === 'string' ? loc : loc.country || '').toLowerCase();
          return locCountry.includes('japan') || locCountry.includes('japanese');
        });
        return country.includes('japan') || country.includes('japanese') || hasJapan;
      });
      if (japanTrials.length > 0) {
      }
    }

    // Apply location filters if provided
    trials = await applyLocationFilters(trials, params);


    // Determine if there are more results available
    const totalResults = raw?.StudyFieldsResponse?.NStudiesFound || 
                        raw?.StudyFieldsResponse?.NStudiesReturned || 
                        trials.length;
    const pageNumber = params?.pageNumber || 1;
    const pageSize = params?.pageSize || 50;
    const hasMore = trials.length >= pageSize && (typeof totalResults === 'number' ? totalResults > pageNumber * pageSize : false);
    
    return { 
      success: true, 
      source: 'ClinicalTrials.gov', 
      totalResults: typeof totalResults === 'number' ? totalResults : trials.length, 
      trials,
      pagination: {
        pageNumber,
        pageSize,
        totalResults: typeof totalResults === 'number' ? totalResults : null,
        hasMore
      }
    };
  } catch (error) {
    return { success: false, source: 'ClinicalTrials.gov', totalResults: 0, trials: [], error: error.message };
  }
}

function buildCTGovExpr(params) {
  const { condition, patientProfile, additionalTerms, subtype, otherTerms } = params || {};
  
  // If patientProfile is provided, use buildSearchCondition to separate cond and term
  if (patientProfile) {
    const { cond, term } = buildSearchCondition(patientProfile, additionalTerms || []);
    // If manual subtype/otherTerms is provided, it should override the patientProfile subtype
    // This allows users to manually enter "Other terms" that will go to query.term
    const finalTerm = (subtype || otherTerms) ? (subtype || otherTerms) : term;
    return { cond, term: finalTerm };
  }
  
  // If manual subtype/otherTerms is provided without patientProfile, use it for query.term
  if (subtype || otherTerms) {
    return {
      cond: condition || '',
      term: subtype || otherTerms || ''
    };
  }
  
  // Legacy: if only condition is provided, try to parse it
  // For now, put everything in cond and leave term empty
  // This is not ideal but maintains backward compatibility
  if (condition) {
    // Try to separate condition from genes/biomarkers
    // Look for patterns like "Disease AND (Gene1 OR Gene2)"
    const andMatch = condition.match(/^(.+?)\s+AND\s+\((.+)\)$/i);
    if (andMatch) {
      return {
        cond: andMatch[1].trim(),
        term: andMatch[2].trim()
      };
    }
    // If no AND pattern, assume it's all condition
    return {
      cond: condition,
      term: ''
    };
  }
  
  return { cond: '', term: '' };
}

/**
 * Search WHO ICTRP (International Clinical Trials Registry Platform)
 * Note: WHO aggregates from multiple registries including JRCT and ClinicalTrials.gov
 * This may have significant overlap with existing sources.
 * @param {Object} params - Search parameters
 * @returns {Promise<Object>} - Search results with normalized trial data
 */
async function searchWHO(params) {
  const onProgress = params?.onProgress;
  const pageNumber = params?.pageNumber || 1;
  const pageSize = params?.pageSize || 50;
  
  try {
    // Progress message is handled by parent searchTrials function
    // This allows showing multiple sources being queried simultaneously
    
    // Build search query from params (same structure as JRCT and ClinicalTrials.gov)
    let searchQuery = '';
    try {
      const { cond, term } = buildCTGovExpr(params || {});
      // Combine cond and term for WHO search (WHO uses a single search parameter)
      const queryParts = [];
      if (cond) queryParts.push(cond.trim());
      if (term && term.trim()) queryParts.push(term.trim());
      searchQuery = queryParts.join(' ').trim();
    } catch (err) {
      console.error('Error building WHO query:', err.message);
      return { success: false, source: 'WHO-ICTRP', trials: [], totalResults: 0, error: 'Failed to build search query' };
    }
    
    if (!searchQuery || searchQuery.trim().length === 0) {
      // Progress message is handled by parent searchTrials function
      return { success: false, source: 'WHO-ICTRP', trials: [], totalResults: 0 };
    }
    
    // Try using the proxy first (if it supports WHO)
    // Note: WHO API endpoint appears to have changed or is not publicly accessible
    // The proxy may handle this, or we may need to skip WHO searches
    let whoRaw;
    try {
      const proxyParams = new URLSearchParams({
        source: 'who',
        search: searchQuery,
        pageSize: Math.min(pageSize, 100).toString(),
        page: pageNumber.toString()
      });
      
      const proxyUrl = `${PROXY_BASE}?${proxyParams.toString()}`;
      whoRaw = await axios.get(proxyUrl, { 
        timeout: 20000,
        headers: {
          'Accept': 'application/json'
        }
      }).then(r => r.data).catch(() => null);
      
      // If proxy fails or returns HTML (indicating API is not accessible), skip WHO
      if (!whoRaw || (typeof whoRaw === 'string' && whoRaw.includes('<!DOCTYPE'))) {
        return { success: false, source: 'WHO-ICTRP', trials: [], totalResults: 0, error: 'WHO API not accessible' };
      }
    } catch (e) {
      return { success: false, source: 'WHO-ICTRP', trials: [], totalResults: 0, error: e.message };
    }
    
    // Parse WHO response
    let items = [];
    if (whoRaw) {
      if (Array.isArray(whoRaw)) {
        items = whoRaw;
      } else if (whoRaw.items && Array.isArray(whoRaw.items)) {
        items = whoRaw.items;
      } else if (whoRaw.trials && Array.isArray(whoRaw.trials)) {
        items = whoRaw.trials;
      } else if (whoRaw.data && Array.isArray(whoRaw.data)) {
        items = whoRaw.data;
      }
    }
    
    if (items.length === 0) {
      return { success: false, source: 'WHO-ICTRP', trials: [], totalResults: 0, error: 'No results from WHO API' };
    }
    
    // Normalize WHO trial data to match our format
    const trials = items.map(item => {
      // WHO may use different field names - try multiple variations
      const trialId = item.trial_id || item.id || item.primary_id || item.registry_id || null;
      const title = item.title || item.brief_title || item.public_title || item.name || '';
      const conditions = Array.isArray(item.conditions) 
        ? item.conditions 
        : (item.condition ? [item.condition] : []);
      const status = item.status || item.recruitment_status || item.recruitmentStatus || '';
      const phase = item.phase || item.phases || '';
      const summary = item.summary || item.brief_summary || item.description || '';
      
      // Normalize status to match ClinicalTrials.gov format (all caps)
      let normalizedStatus = status.toUpperCase();
      if (normalizedStatus.includes('RECRUITING') || normalizedStatus.includes('OPEN')) {
        normalizedStatus = 'RECRUITING';
      } else if (normalizedStatus.includes('NOT_RECRUITING') || normalizedStatus.includes('CLOSED')) {
        normalizedStatus = 'NOT_RECRUITING';
      } else if (normalizedStatus.includes('COMPLETED')) {
        normalizedStatus = 'COMPLETED';
      } else if (normalizedStatus.includes('TERMINATED')) {
        normalizedStatus = 'TERMINATED';
      }
      
      // Extract locations
      let locations = [];
      if (Array.isArray(item.locations)) {
        locations = item.locations;
      } else if (item.location) {
        locations = Array.isArray(item.location) ? item.location : [item.location];
      } else if (item.countries && Array.isArray(item.countries)) {
        locations = item.countries.map(c => ({ country: c }));
      } else if (item.country) {
        locations = [{ country: item.country }];
      }
      
      // Extract URL
      const url = item.url || item.link || item.trial_url || null;
      
      return {
        id: trialId,
        source: 'WHO-ICTRP',
        title: title,
        conditions: conditions,
        status: normalizedStatus,
        phase: phase,
        summary: summary,
        locations: locations,
        country: locations[0]?.country || '',
        url: url,
        published: item.date_registered || item.registration_date || null
      };
    });
    
    // Apply location filters if specified
    const filtered = await applyLocationFilters(trials, params || {});
    
    // Note: WHO aggregates from multiple sources, so there will be overlap with JRCT and ClinicalTrials.gov
    // Deduplication happens in searchTrials function
    
    return {
      success: true,
      source: 'WHO-ICTRP',
      totalResults: filtered.length,
      trials: filtered
    };
  } catch (error) {
    console.error('WHO ICTRP search error:', error);
    return { success: false, source: 'WHO-ICTRP', trials: [], totalResults: 0, error: error.message };
  }
}

/**
 * Get detailed information for a specific trial
 * @param {string} trialId - Trial ID (NCT number for ClinicalTrials.gov, jRCT ID for JRCT)
 * @param {string} source - Trial source ('ClinicalTrials.gov' or 'JRCT') - optional, will be detected if not provided
 * @param {string} searchQuery - Original search query (needed for JRCT detail fetch)
 * @returns {Promise<Object>} - Detailed trial information
 */
export async function getTrialDetails(trialId, source = null, searchQuery = '') {
  try {
    if (!trialId) {
      return { success: false, error: 'Trial ID is required' };
    }

    // Detect source from trial ID format if not provided
    const detectedSource = source || (trialId.match(/^jRCT/i) ? 'JRCT' : 'ClinicalTrials.gov');
    
    if (detectedSource === 'JRCT') {
      // Fetch JRCT trial details
      // METHOD 1: Use stored tokenData from search results (preferred - avoids rebuilding search page)
      // METHOD 2: Rebuild search page and extract token (fallback)
      
      // Check if searchQuery is actually a trial object with tokenData
      let tokenData = null;
      let storedDetailUrl = null;
      let searchQueryToUse = '';
      
      if (typeof searchQuery === 'object' && searchQuery !== null) {
        // searchQuery is actually a trial object
        tokenData = searchQuery._tokenData || null;
        storedDetailUrl = searchQuery.detailUrl || null;
        searchQueryToUse = searchQuery._searchQuery || searchQuery.conditions?.[0] || searchQuery.title || '';
      } else if (typeof searchQuery === 'string') {
        searchQueryToUse = searchQuery.trim() || 'cancer';
      } else {
        searchQueryToUse = 'cancer';
      }
      
      let res;
      let detailData;
      
      // METHOD 1: Try with stored tokenData first (if available)
      if (tokenData && tokenData['_Token[fields]']) {
        const tokenDataParam = encodeURIComponent(JSON.stringify(tokenData));
        const detailUrlParam = storedDetailUrl ? `&detailUrl=${encodeURIComponent(storedDetailUrl)}` : '';
        const detailUrl = `/api/jrct/detail?id=${encodeURIComponent(trialId)}&tokenData=${tokenDataParam}${detailUrlParam}`;
        
        try {
          res = await axios.get(detailUrl, { 
            timeout: 70000,
            validateStatus: (status) => status < 600
          });
          detailData = res.data;
          
          if (res.status === 200 && !detailData.error) {
            // Success with stored token
          } else if (detailData?.error) {
            // Token method failed, fall through to METHOD 2
            tokenData = null; // Force fallback
          }
        } catch (tokenErr) {
          // Token method failed, fall through to METHOD 2
          tokenData = null; // Force fallback
        }
      }
      
      // METHOD 2: Fallback to search query method
      if (!detailData || detailData?.error) {
        const fallbackUrl = `/api/jrct/detail?id=${encodeURIComponent(trialId)}&q=${encodeURIComponent(searchQueryToUse)}&page=1`;
        
        try {
          res = await axios.get(fallbackUrl, { 
            timeout: 70000,
            validateStatus: (status) => status < 600
          });
          detailData = res.data;
        } catch (axiosErr) {
          if (axiosErr.response) {
            res = axiosErr.response;
            detailData = res.data;
          } else {
            throw axiosErr;
          }
        }
      }
      
      // If still error, try with trial ID as query (last resort)
      if (detailData && detailData.error && searchQueryToUse !== trialId) {
        const isServerError = res.status >= 500 || (res.status >= 400 && (detailData.message || '').includes('not found in search results'));
        
        if (isServerError) {
          const retryUrl = `/api/jrct/detail?id=${encodeURIComponent(trialId)}&q=${encodeURIComponent(trialId)}&page=1`;
          try {
            const retryRes = await axios.get(retryUrl, { 
              timeout: 70000,
              validateStatus: (status) => status < 600
            });
            
            if (retryRes.status === 200 && !retryRes.data.error) {
              res = retryRes;
              detailData = retryRes.data;
            }
          } catch (retryErr) {
            console.error('Retry with trial ID failed:', retryErr.message);
          }
        }
      }
      
      if (detailData && detailData.error) {
        return { 
          success: false, 
          error: detailData.error || detailData.message || 'Failed to fetch JRCT details', 
          debug: detailData.debug,
          httpStatus: res.status
        };
      }
      
      // Check if we have valid data
      if (!detailData || res.status >= 400) {
        const errorMsg = detailData?.error || detailData?.message || `Failed to fetch JRCT details (HTTP ${res.status})`;
        const isNotFound = errorMsg.includes('not found in search results') || 
                          errorMsg.includes('Could not find detail form') ||
                          (detailData?.debug?.idFoundInSearchResults === false);
        
        return { 
          success: false, 
          error: isNotFound 
            ? `Trial ${trialId} not found in JRCT search results. The search results page only shows basic information (ID, title, condition, status, published date). Detailed information (hospitals, eligibility, contacts, etc.) is only available on the detail page, which requires a valid token from the search results.`
            : errorMsg,
          debug: {
            ...detailData?.debug,
            httpStatus: res.status,
            searchQueryUsed: searchQueryToUse,
            usedStoredToken: !!tokenData,
            suggestion: isNotFound 
              ? `Visit https://jrct.mhlw.go.jp/latest-detail/${trialId} directly, or perform a new search to get fresh tokens.`
              : 'This may be a temporary JRCT server issue. Try again later or visit the JRCT website directly.'
          }
        };
      }
      
      // Success! JRCT detail endpoint now returns parsed JSON with all fields
      // Map it to match ClinicalTrials.gov format for consistency
      return {
        success: true,
        summary: detailData.summary || detailData.detailedDescription || '',
        summaryJa: detailData.summaryJa || detailData.summary || '',
        eligibilityCriteria: detailData.eligibilityCriteria || '',
        eligibilityCriteriaJa: detailData.eligibilityCriteriaJa || '',
        eligibility: detailData.eligibility || (detailData.eligibilityCriteria ? { criteria: detailData.eligibilityCriteria } : undefined),
        // Include all additional fields for comprehensive display
        locations: detailData.locations || [],
        facilities: detailData.facilities || [],
        sponsor: detailData.sponsor || detailData.sponsorInstitution || '',
        sponsorInstitution: detailData.sponsorInstitution || '',
        phase: detailData.phase || '',
        status: detailData.status || '',
        statusJa: detailData.statusJa || '',
        enrollment: detailData.enrollment || '',
        studyType: detailData.studyType || '',
        intervention: detailData.intervention || '',
        primaryOutcome: detailData.primaryOutcome || '',
        secondaryOutcome: detailData.secondaryOutcome || '',
        firstEnrollmentDate: detailData.firstEnrollmentDate || '',
        completionDate: detailData.completionDate || '',
        publishedDate: detailData.publishedDate || '',
        contactName: detailData.contactName || '',
        contactAffiliation: detailData.contactAffiliation || '',
        contactAddress: detailData.contactAddress || '',
        contactPhone: detailData.contactPhone || '',
        contactEmail: detailData.contactEmail || '',
        age: detailData.age || '',
        gender: detailData.gender || '',
        inclusionCriteria: detailData.inclusionCriteria || '',
        exclusionCriteria: detailData.exclusionCriteria || '',
        countriesOfRecruitment: detailData.countriesOfRecruitment || [],
        conditions: detailData.conditions || [],
        url: detailData.url || '',
        urlJa: detailData.urlJa || '',
        title: detailData.title || '', // Use full Public Title from details
        titleJa: detailData.titleJa || detailData.title || '' // Use full title for Japanese too
      };
    } else {
      // Fetch ClinicalTrials.gov trial details (existing logic)
      const url = `${PROXY_BASE}?source=ctgov&query.term=${encodeURIComponent(trialId)}&pageSize=1&fmt=json`;
      const res = await axios.get(url, { timeout: 70000 });
      const responseData = res.data;

      if (responseData.studies && responseData.studies.length > 0) {
        // Find the study that matches the trialId exactly
        const study = responseData.studies.find(s => {
          const nctId = s.protocolSection?.identificationModule?.nctId || s.nctId || s.id || '';
          return nctId === trialId || nctId === `NCT${trialId}` || trialId === `NCT${nctId}`;
        }) || responseData.studies[0];
        
        const protocolSection = study.protocolSection || {};
        const descriptionModule = protocolSection.descriptionModule || {};
        
        // Extract summary with proper handling
        let briefSummary = '';
        if (descriptionModule?.briefSummary) {
          briefSummary = typeof descriptionModule.briefSummary === 'string' 
            ? descriptionModule.briefSummary 
            : (descriptionModule.briefSummary.text || descriptionModule.briefSummary.content || '');
        }
        if (!briefSummary && descriptionModule?.detailedDescription) {
          const detailedDesc = descriptionModule.detailedDescription;
          briefSummary = typeof detailedDesc === 'string' 
            ? detailedDesc 
            : (detailedDesc.text || detailedDesc.content || '');
        }

        // Extract eligibility criteria
        let eligibilityCriteria = '';
        if (descriptionModule?.eligibilityCriteria) {
          const elig = descriptionModule.eligibilityCriteria;
          eligibilityCriteria = typeof elig === 'string' 
            ? elig 
            : (elig.text || elig.content || '');
        }

        return {
          success: true,
          summary: briefSummary,
          eligibilityCriteria: eligibilityCriteria,
          eligibility: eligibilityCriteria ? { criteria: eligibilityCriteria } : undefined
        };
      }

      return { success: false, error: 'Trial not found' };
    }
  } catch (error) {
    return { success: false, error: error.message || 'Failed to fetch trial details' };
  }
}

/**
 * Helper function to build search condition with cancer type, subtype, disease status, and mutations
 * @param {Object} patientProfile - Patient profile with diagnosis, cancerType, currentStatus
 * @param {Array<string>} additionalTerms - Additional search terms (e.g., gene names, biomarkers)
 * @returns {Object} - Object with:
 *   - `cond` (query.cond): Main disease/condition (e.g., "Ovarian Cancer")
 *   - `term` (query.term): Patient subtype (e.g., "Clear Cell Sarcoma")
 * 
 * IMPORTANT: This ensures disease goes to query.cond (main search) and subtype goes to query.term (other terms)
 */
function buildSearchCondition(patientProfile, additionalTerms = []) {
  const condTerms = []; // For query.cond (disease/condition)
  const termParts = []; // For query.term (biomarkers, status, genes, chromosomal locations)
  
  // Primary diagnosis/cancer type - goes in cond
  // NOTE: diagnosis is the main disease (e.g., "Ovarian Cancer")
  // cancerType is the subtype (e.g., "Clear Cell"), NOT the main diagnosis
  if (patientProfile.diagnosis) {
    condTerms.push(patientProfile.diagnosis);
  }
  
    // Add cancer subtype if available - goes in query.term (Other terms) to match ClinicalTrials.gov interface
  // This matches how users search: Condition = "Ovarian Cancer", Other terms = "Clear Cell Sarcoma"
  // Always add subtype to query.term if it exists and is different from the main diagnosis
  const mainDiagnosis = patientProfile.diagnosis || '';
  // IMPORTANT: Subtype is stored in patientProfile.cancerType, NOT in currentStatus.diagnosis
  // currentStatus.diagnosis is the same as the main diagnosis, not the subtype
  const subtype = patientProfile.cancerType || '';
  
  
  if (subtype && subtype.trim() !== '' && subtype !== mainDiagnosis) {
    // Add subtype to termParts (query.term) instead of cond (query.cond)
    // IMPORTANT: Subtype should be FIRST in query.term to match website search behavior
    termParts.unshift(subtype.trim()); // Use unshift to add at beginning
  } else if (subtype && subtype === mainDiagnosis) {
    // Subtype is same as main diagnosis, no need to add it again
  } else if (!subtype || subtype.trim() === '') {
  }
  
  
  // NOTE: User explicitly requested that ONLY the subtype should be in query.term
  // All other parameters (disease status, genes, mutations, biomarkers) are REMOVED from query.term
  // These will be used for matching/scoring but NOT in the search query
  // 
  // REMOVED: Disease status terms (recurrent, refractory, metastatic, advanced, etc.)
  // REMOVED: Gene/mutation terms (BRCA, ATM, CCNE1, etc.)
  // REMOVED: Biomarker terms (TMB, MSI-H, HRD, etc.)
  // 
  // ONLY subtype (e.g., "Clear Cell") is included in query.term
  
  
  const finalCond = condTerms.join(' AND ');
  const finalTerm = termParts.join(' AND ');
  
  
  return {
    cond: finalCond,
    term: finalTerm
  };
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
    // Build condition with cancer type/subtype, disease status, and BRCA
    const { cond, term } = buildSearchCondition(patientProfile, ['BRCA']);
    
    const baseParams = {
      patientProfile: patientProfile,
      additionalTerms: ['BRCA'],
      age: patientProfile.age,
      gender: patientProfile.gender,
      pageNumber: 1,
      pageSize: 50
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
    const { cond, term } = buildSearchCondition(patientProfile, ['TMB', 'immunotherapy']);
    
    const baseParamsTMB = {
      biomarker: 'TMB-high',
      patientProfile: patientProfile,
      additionalTerms: ['TMB', 'immunotherapy'],
      intervention: 'pembrolizumab OR nivolumab OR immunotherapy',
      age: patientProfile.age,
      gender: patientProfile.gender,
      status: 'recruiting',
      pageNumber: 1,
      pageSize: 50
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
    const { cond, term } = buildSearchCondition(patientProfile, ['MSI-H']);
    
    const baseParamsMSI = {
      biomarker: 'MSI-H',
      patientProfile: patientProfile,
      additionalTerms: ['MSI-H'],
      intervention: 'pembrolizumab',
      age: patientProfile.age,
      gender: patientProfile.gender,
      status: 'recruiting',
      pageNumber: 1,
      pageSize: 50
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
    const { cond, term } = buildSearchCondition(patientProfile, ['HRD', 'PARP']);
    
    const baseParamsHRD = {
      biomarker: 'HRD-positive',
      patientProfile: patientProfile,
      additionalTerms: ['HRD', 'PARP'],
      intervention: 'olaparib OR rucaparib OR niraparib OR PARP inhibitor',
      age: patientProfile.age,
      gender: patientProfile.gender,
      status: 'recruiting',
      pageNumber: 1,
      pageSize: 50
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
      // Build condition with cancer type/subtype, disease status, and mutation gene
      const { cond, term } = buildSearchCondition(patientProfile, [mutation.gene]);
      
      const gp = {
        patientProfile: patientProfile,
        additionalTerms: [mutation.gene],
        age: patientProfile.age,
        gender: patientProfile.gender,
        status: 'recruiting',
        pageNumber: 1,
        pageSize: 50
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

  // General search by diagnosis - include cancer type, subtype, disease status, and mutations
  const mutationTerms = [];
  if (genomicProfile.mutations && genomicProfile.mutations.length > 0) {
    const importantMutations = genomicProfile.mutations
      .filter(m => m.gene)
      .slice(0, 3)
      .map(m => m.gene);
    mutationTerms.push(...importantMutations);
  }
  
  // Add important CNVs (like CCNE1)
  if (genomicProfile.cnvs && genomicProfile.cnvs.length > 0) {
    const importantCNVs = genomicProfile.cnvs
      .filter(cnv => cnv.gene)
      .slice(0, 2)
      .map(cnv => cnv.gene);
    mutationTerms.push(...importantCNVs);
  }
  
  const { cond, term } = buildSearchCondition(patientProfile, mutationTerms);
  
  const generalParams = {
    patientProfile: patientProfile,
    additionalTerms: mutationTerms,
    age: patientProfile.age,
    gender: patientProfile.gender,
    status: 'recruiting',
    pageNumber: 1,
    pageSize: 50
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

  // Cancer subtype check
  if (patientProfile.currentStatus?.diagnosis && 
      patientProfile.currentStatus.diagnosis !== patientProfile.diagnosis &&
      trial.conditions?.some(c => {
        const conditionLower = c.toLowerCase();
        const subtypeLower = patientProfile.currentStatus.diagnosis.toLowerCase();
        return conditionLower.includes(subtypeLower) || subtypeLower.includes(conditionLower);
      })) {
    matches.push(`Cancer subtype: ${patientProfile.currentStatus.diagnosis} (matches)`);
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
// JRCT search is now integrated into searchTrials
// These exports maintain backwards compatibility
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

