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
    
    console.log(`Applying location filter for country: ${params.country}, search terms:`, searchTerms);
    console.log(`Trials before filtering: ${out.length}`);
    
    out = out.filter(t => {
      // Check trial's country field (this is the first country from locations, may not be complete)
      const trialCountry = (t.country || '').toLowerCase();
      if (searchTerms.some(term => trialCountry.includes(term))) {
        console.log(`Trial ${t.id}: Matched top-level country "${t.country}"`);
        return true;
      }
      
      // Check trial locations (this is the authoritative source)
      const locations = t.locations || [];
      if (locations.length === 0) {
        // If no location data and country filter is active, exclude the trial
        // (we can't verify it's in the requested country)
        console.warn(`Trial ${t.id} has no location data, excluding from country-filtered results`);
        return false;
      }
      
      // Check if any location matches the search country
      const hasMatch = locations.some(loc => {
        if (typeof loc === 'string') {
          const matches = searchTerms.some(term => loc.toLowerCase().includes(term));
          if (matches) {
            console.log(`Trial ${t.id}: Matched location string "${loc}"`);
          }
          return matches;
        }
        // Check location object's country field
        const locCountry = (loc.country || '').toLowerCase();
        if (locCountry && searchTerms.some(term => locCountry.includes(term))) {
          console.log(`Trial ${t.id}: Matched location country "${loc.country}"`);
          return true;
        }
        // Also check city field (some locations might have country in city field)
        const locCity = (loc.city || '').toLowerCase();
        if (locCity && searchTerms.some(term => locCity.includes(term))) {
          console.log(`Trial ${t.id}: Matched location city "${loc.city}"`);
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
        console.log(`Trial ${t.id}: Excluded - has countries: ${allCountries.join(', ')}, searching for: ${params.country}`);
      }
      
      return hasMatch;
    });
    
    console.log(`Trials after filtering: ${out.length}`);
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
  const pageNumber = params?.pageNumber || 1;
  const pageSize = params?.pageSize || 50;
  
  // Currently queries ClinicalTrials.gov
  try {
    if (typeof onProgress === 'function') onProgress(`Querying ClinicalTrials.gov (page ${pageNumber})`);
    attempted.push('ClinicalTrials.gov');
    
    // Build v2 API compatible query parameters
    const { cond, term } = buildCTGovExpr(params);
    // IMPORTANT: LocationCity and LocationCountry are NOT available in v2 API fields parameter
    // Location data is only in full study response (protocolSection.contactsLocationsModule.locations)
    // So we DON'T specify fields parameter - this forces API to return full v2 format with location data
    console.log('=== ClinicalTrials.gov Query Parameters ===');
    console.log('query.cond (Condition/Disease):', cond || '(empty)');
    console.log('query.term (Other terms - genes, subtype, biomarkers):', term || '(empty)');
    if (params?.country) {
      console.log('Location filter:', params.country, params.includeAllLocations ? '(including all locations)' : '(specific country only)');
    }
    console.log('Page:', pageNumber, '| Page Size:', pageSize);
    console.log('Fields: NOT SPECIFIED (requesting full study data to get location information)')
    console.log('==========================================');
    
    // Check if query is too long for GET request (limit ~2000 chars for URL)
    const queryLength = encodeURIComponent(cond).length + encodeURIComponent(term).length;
    const maxUrlLength = 2000;
    
    let ctRaw;
    
    if (queryLength > maxUrlLength) {
      // Use POST request for long queries
      console.log(`Query too long (${queryLength} chars), using POST request`);
      if (typeof onProgress === 'function') onProgress('Sending search request (POST)');
      
      const postData = {
        source: 'ctgov',
        'query.term': term || '',
        'query.cond': cond || '',
        // Don't specify fields - get full study data with locations
        pageSize: pageSize,
        pageNumber: pageNumber,
        fmt: 'json'
      };
      
      // Log POST data
      console.log('=== POST Request Data ===');
      console.log(JSON.stringify(postData, null, 2));
      console.log('========================');
      
      ctRaw = await axios.post(PROXY_BASE, postData, {
        timeout: 20000,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }).then(r => {
        console.log('ClinicalTrials.gov POST response received:', r?.data ? 'has data' : 'no data');
        return r.data;
      }).catch(err => {
        console.error('ClinicalTrials.gov POST request failed:', err?.response?.status, err?.message);
        return null;
      });
    } else {
      // Use GET request for shorter queries
      // Don't specify fields parameter - get full study data with locations
      const proxyUrl = `${PROXY_BASE}?source=ctgov&query.term=${encodeURIComponent(term || '')}&query.cond=${encodeURIComponent(cond || '')}&pageSize=${pageSize}&pageNumber=${pageNumber}&fmt=json`;
      
      // Log full URL (not truncated)
      console.log('=== GET Request URL ===');
      console.log(proxyUrl);
      console.log('========================');
      
      ctRaw = await axios.get(proxyUrl, { 
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
    }
    
    if (ctRaw) {
      console.log('ClinicalTrials.gov raw response structure:', {
        hasStudyFieldsResponse: !!ctRaw.StudyFieldsResponse,
        hasStudies: !!ctRaw.studies,
        hasData: !!ctRaw.data,
        keys: Object.keys(ctRaw),
        studyFieldsResponseKeys: ctRaw.StudyFieldsResponse ? Object.keys(ctRaw.StudyFieldsResponse) : null,
        studyCount: ctRaw.StudyFieldsResponse?.Study?.length || ctRaw.studies?.length || 0
      });
      
      // Log location filter params
      if (params.country) {
        console.log('Location filter params:', {
          country: params.country,
          includeAllLocations: params.includeAllLocations
        });
      }
      
      const ctResult = await searchCTGov({ ...params, _rawCTGovResponse: ctRaw });
      console.log('searchCTGov result:', {
        success: ctResult.success,
        trialsLength: ctResult.trials?.length,
        error: ctResult.error,
        countryFilter: params.country
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
      hasStudies: !!raw?.studies,
      studyFieldsResponseKeys: raw?.StudyFieldsResponse ? Object.keys(raw.StudyFieldsResponse) : null
    });
    
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
            console.warn('Study missing nctId, skipping:', study);
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
          console.error('Error processing study in v2 format:', error, study);
          return null;
        }
      }).filter(Boolean); // Remove null entries
      console.log('Using v2 API format (protocolSection), studies count:', studies.length);
    } else if (raw && raw.StudyFieldsResponse) {
      // Legacy format fallback
      studies = raw.StudyFieldsResponse.Study || [];
      console.log('Using legacy StudyFieldsResponse format, studies count:', studies.length);
      if (studies.length > 0) {
        const firstStudy = studies[0];
        console.log('First study sample:', JSON.stringify(firstStudy, null, 2).substring(0, 1000));
        console.log('First study LocationCity:', firstStudy.LocationCity);
        console.log('First study LocationCountry:', firstStudy.LocationCountry);
        console.log('First study all keys:', Object.keys(firstStudy));
        // Check for alternative location field names
        const locationKeys = Object.keys(firstStudy).filter(k => 
          k.toLowerCase().includes('location') || 
          k.toLowerCase().includes('city') || 
          k.toLowerCase().includes('country')
        );
        console.log('Location-related keys in first study:', locationKeys);
        if (locationKeys.length > 0) {
          locationKeys.forEach(key => {
            console.log(`  ${key}:`, firstStudy[key]);
          });
        }
      }
    } else if (raw && Array.isArray(raw)) {
      studies = raw;
      console.log('Using array format, studies count:', studies.length);
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
              const briefSummary = descriptionModule?.briefSummary || descriptionModule?.detailedDescription?.text || study.summary || '';
              
              // Safely extract locations from v2 API format
              // According to ClinicalTrials.gov API docs: protocolSection.contactsLocationsModule.locations[]
              // Each location has: facility { name, city, state, zip, country }
              const locations = contactsLocationsModule?.locations || [];
              const locationCities = [];
              const locationCountries = [];
              
              locations.forEach(loc => {
                try {
                  const facility = loc?.facility || {};
                  // Extract city, state, and country according to API structure
                  const city = facility?.city || loc?.city || '';
                  const state = facility?.state || facility?.province || '';
                  const country = facility?.country || loc?.country || '';
                  
                  if (city) locationCities.push(city);
                  if (country) locationCountries.push(country);
                  
                  // Log if we find location data for debugging
                  if (city || country) {
                    console.log(`trialSearchService: Extracted location for ${nctId}: city=${city}, state=${state}, country=${country}`);
                  }
                } catch (e) {
                  console.warn(`trialSearchService: Error extracting location for ${nctId}:`, e?.message || e);
                }
              });
              
              // Log location extraction summary
              if (locations.length > 0) {
                console.log(`trialSearchService: Study ${nctId} has ${locations.length} location(s), extracted ${locationCities.length} cities, ${locationCountries.length} countries`);
              } else {
                console.warn(`trialSearchService: Study ${nctId} has no locations in contactsLocationsModule`);
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
                LocationCountry: locationCountries
              };
            } catch (error) {
              console.error('Error processing study in v2 format:', error, study);
              return null;
            }
          }).filter(Boolean); // Remove null entries
        } else if (responseData.StudyFieldsResponse) {
          // Legacy format fallback
          studies = responseData.StudyFieldsResponse.Study || [];
        }
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
      const locationCities = s.LocationCity || [];
      const locationCountries = s.LocationCountry || [];
      
      // Build locations array
      const locations = locationCities.map((city, idx) => ({ 
        city: typeof city === 'string' ? city : '', 
        country: (locationCountries[idx] || locationCountries[0] || '') 
      }));
      
      // If no cities but we have countries, create location entries from countries
      if (locations.length === 0 && locationCountries.length > 0) {
        locationCountries.forEach(country => {
          if (country) {
            locations.push({ city: '', country: country });
          }
        });
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

    console.log('searchCTGov - mapped trials count:', trials.length);
    if (trials.length > 0) {
      console.log('Sample trial locations:', trials[0].locations);
      console.log('Sample trial country:', trials[0].country);
      console.log('Sample trial status:', trials[0].status);
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
        console.log(`Found ${japanTrials.length} trials with Japan locations before filtering`);
      }
    }

    // Apply location filters if provided
    trials = await applyLocationFilters(trials, params);

    console.log('searchCTGov - after location filters:', trials.length);

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
    console.error('Error searching ClinicalTrials.gov:', error?.message || error);
    return { success: false, source: 'ClinicalTrials.gov', totalResults: 0, trials: [], error: error.message };
  }
}

function buildCTGovExpr(params) {
  const { condition, patientProfile, additionalTerms } = params || {};
  
  // If patientProfile is provided, use buildSearchCondition to separate cond and term
  if (patientProfile) {
    const { cond, term } = buildSearchCondition(patientProfile, additionalTerms || []);
    return { cond, term };
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
 * Helper function to build search condition with cancer type, subtype, disease status, and mutations
 * @param {Object} patientProfile - Patient profile with diagnosis, cancerType, currentStatus
 * @param {Array<string>} additionalTerms - Additional search terms (e.g., gene names, biomarkers)
 * @returns {Object} - Object with `cond` (condition/disease) and `term` (biomarkers/genes)
 */
function buildSearchCondition(patientProfile, additionalTerms = []) {
  const condTerms = []; // For query.cond (disease/condition)
  const termParts = []; // For query.term (biomarkers, status, genes, chromosomal locations)
  
  // Primary diagnosis/cancer type - goes in cond
  if (patientProfile.diagnosis) {
    condTerms.push(patientProfile.diagnosis);
  } else if (patientProfile.cancerType) {
    condTerms.push(patientProfile.cancerType);
  }
  
    // Add cancer subtype if available - goes in query.term (Other terms) to match ClinicalTrials.gov interface
  // This matches how users search: Condition = "Ovarian Cancer", Other terms = "Clear Cell Sarcoma"
  // Always add subtype to query.term if it exists and is different from the main diagnosis
  const mainDiagnosis = patientProfile.diagnosis || patientProfile.cancerType || '';
  const subtype = patientProfile.currentStatus?.diagnosis || '';
  
  if (subtype && subtype.trim() !== '' && subtype !== mainDiagnosis) {
    // Add subtype to termParts (query.term) instead of cond (query.cond)
    termParts.push(subtype.trim());
    console.log(`buildSearchCondition: Adding subtype "${subtype}" to query.term (Other terms), main diagnosis: "${mainDiagnosis}"`);
  } else if (subtype && subtype === mainDiagnosis) {
    // Subtype is same as main diagnosis, no need to add it again
    console.log(`buildSearchCondition: Subtype "${subtype}" is same as main diagnosis "${mainDiagnosis}", not adding to query.term`);
  }
  
  // Add disease status with Boolean operators for better matching - goes in term
  // Only include disease statuses that are useful search terms
  if (patientProfile.currentStatus?.diseaseStatus) {
    const diseaseStatus = patientProfile.currentStatus.diseaseStatus.toLowerCase();
    // Use Boolean OR operators to capture variations
    // Skip "Stable Disease" and similar statuses that aren't good search terms
    if (diseaseStatus.includes('stable') && !diseaseStatus.includes('unstable')) {
      // Skip "Stable Disease" - not a useful search term
    } else if (diseaseStatus.includes('recurrent') || diseaseStatus.includes('recurrence')) {
      termParts.push('(recurrent OR relapsed OR recurrence)');
    } else if (diseaseStatus.includes('refractory')) {
      termParts.push('(refractory OR resistant)');
    } else if (diseaseStatus.includes('metastatic')) {
      termParts.push('(metastatic OR metastasis)');
    } else if (diseaseStatus.includes('advanced')) {
      termParts.push('(advanced OR stage IV)');
    }
    // Skip other disease statuses like "Stable Disease", "Partial Response", etc.
  }
  
  // Process additional terms (genes/mutations) - goes in term
  const uniqueGenes = [...new Set(additionalTerms.filter(term => term && typeof term === 'string'))];
  if (uniqueGenes.length > 0) {
    // Group genes with OR to broaden search (trials matching ANY gene)
    if (uniqueGenes.length === 1) {
      termParts.push(uniqueGenes[0]);
    } else {
      termParts.push(`(${uniqueGenes.join(' OR ')})`);
    }
  }
  
  return {
    cond: condTerms.join(' AND '),
    term: termParts.join(' AND ')
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

