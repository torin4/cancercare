import axios from 'axios';

const PROXY_BASE = '/api/trials-proxy';

/**
 * Detect chromosomal location patterns (e.g., 17q21, p13, q21)
 * @param {string} term - Term to check
 * @returns {string|null} - Chromosomal location if found, null otherwise
 */
function detectChromosomalLocation(term) {
  if (!term || typeof term !== 'string') return null;
  
  // Patterns: 17q21, 1p13, q21, p13, etc.
  const patterns = [
    /\b\d+[pq]\d+\b/i,           // e.g., 17q21, 1p13
    /\b[pq]\d+\b/i,              // e.g., q21, p13
    /\bchromosome\s+\d+[pq]\d+\b/i, // e.g., chromosome 17q21
  ];
  
  for (const pattern of patterns) {
    const match = term.match(pattern);
    if (match) {
      return match[0];
    }
  }
  
  return null;
}

/**
 * Build structured Boolean query strings for ClinicalTrials.gov API v2
 * Groups synonyms in parentheses with OR operators
 * @param {Object} patientProfile - Patient profile with diagnosis, cancerType, currentStatus
 * @param {Array<string>} additionalTerms - Additional search terms (e.g., gene names, biomarkers)
 * @returns {Object} - Object with query.cond (disease) and query.term (biomarkers/status)
 */
function buildSearchCondition(patientProfile, additionalTerms = []) {
  const conditionTerms = []; // For query.cond (disease/condition)
  const termParts = [];       // For query.term (biomarkers, status, genes)
  const chromosomalLocations = [];
  
  // PRIMARY CONDITION (query.cond) - Disease/Cancer Type
  // Handle both patientProfile object and simple condition string
  if (typeof patientProfile === 'string') {
    conditionTerms.push(patientProfile);
  } else if (patientProfile?.diagnosis) {
    conditionTerms.push(patientProfile.diagnosis);
  } else if (patientProfile?.cancerType) {
    conditionTerms.push(patientProfile.cancerType);
  } else if (patientProfile?.condition) {
    conditionTerms.push(patientProfile.condition);
  }
  
  // Add cancer subtype to condition (use OR to broaden)
  if (patientProfile?.currentStatus?.diagnosis && 
      patientProfile.currentStatus.diagnosis !== patientProfile.diagnosis &&
      patientProfile.currentStatus.diagnosis !== patientProfile.cancerType) {
    const primaryTerm = conditionTerms[0] || patientProfile.diagnosis || patientProfile.cancerType;
    if (primaryTerm) {
      conditionTerms[0] = `(${primaryTerm} OR ${patientProfile.currentStatus.diagnosis})`;
    } else {
      conditionTerms.push(patientProfile.currentStatus.diagnosis);
    }
  }
  
  // QUERY.TERM - Biomarkers, Status, Genes, Chromosomal Locations
  // Process additional terms (genes/mutations) - deduplicate and group with OR
  const uniqueGenes = [...new Set(additionalTerms.filter(term => term && typeof term === 'string'))];
  const geneTerms = [];
  
  uniqueGenes.forEach(gene => {
    // Check for chromosomal location
    const chromLoc = detectChromosomalLocation(gene);
    if (chromLoc) {
      chromosomalLocations.push(chromLoc);
    } else {
      geneTerms.push(gene);
    }
  });
  
  // Group genes with OR (trials matching ANY gene)
  if (geneTerms.length > 0) {
    if (geneTerms.length === 1) {
      termParts.push(geneTerms[0]);
    } else {
      termParts.push(`(${geneTerms.join(' OR ')})`);
    }
  }
  
  // Add chromosomal locations
  if (chromosomalLocations.length > 0) {
    const uniqueChromLocs = [...new Set(chromosomalLocations)];
    if (uniqueChromLocs.length === 1) {
      termParts.push(uniqueChromLocs[0]);
    } else {
      termParts.push(`(${uniqueChromLocs.join(' OR ')})`);
    }
  }
  
  // Add disease status with Boolean operators (group synonyms)
  if (patientProfile?.currentStatus?.diseaseStatus) {
    const diseaseStatus = patientProfile.currentStatus.diseaseStatus.toLowerCase();
    
    // Skip non-searchable statuses
    if (diseaseStatus.includes('stable') && !diseaseStatus.includes('unstable')) {
      // Skip "Stable Disease"
    } else if (diseaseStatus.includes('recurrent') || diseaseStatus.includes('recurrence')) {
      termParts.push('(recurrent OR relapsed OR recurrence)');
    } else if (diseaseStatus.includes('refractory')) {
      termParts.push('(refractory OR resistant)');
    } else if (diseaseStatus.includes('metastatic')) {
      termParts.push('(metastatic OR metastasis)');
    } else if (diseaseStatus.includes('advanced')) {
      termParts.push('(advanced OR stage IV)');
    }
  }
  
  return {
    cond: conditionTerms.join(' OR '), // query.cond for disease
    term: termParts.join(' AND ')       // query.term for biomarkers/status
  };
}

/**
 * Search clinical trials from ClinicalTrials.gov API v2
 * @param {Object} params - Search parameters
 * @returns {Promise<Object>} - Search results with normalized trial data
 */
export async function searchTrials(params) {
  const attempted = [];
  const onProgress = params?.onProgress;
  const pageNumber = params?.pageNumber || 1;
  const pageSize = params?.pageSize || 50;
  
  try {
    if (typeof onProgress === 'function') onProgress(`Querying ClinicalTrials.gov (page ${pageNumber})`);
    attempted.push('ClinicalTrials.gov');
    
    // Build v2 API compatible query parameters
    // Extract condition and biomarkers from params
    const condition = params.condition || params.diagnosis || '';
    const biomarkers = params.biomarkers || params.additionalTerms || [];
    const biomarkersArray = Array.isArray(biomarkers) ? biomarkers : (biomarkers ? [biomarkers] : []);
    
    // Build search condition - handle both patientProfile object and simple condition string
    const patientProfileForSearch = params.diagnosis || params.cancerType || params.currentStatus 
      ? params 
      : { diagnosis: condition, currentStatus: params.currentStatus || {} };
    
    const { cond, term } = buildSearchCondition(patientProfileForSearch, biomarkersArray);
    
    // Request only the fields we actually use
    const fields = ['NCTId', 'BriefTitle', 'Condition', 'OverallStatus', 'Phase', 'BriefSummary', 'EligibilityCriteria', 'Locations'].join(',');
    
    // Build query parameters for v2 API
    const queryParams = new URLSearchParams();
    if (cond) queryParams.set('query.cond', cond);
    if (term) queryParams.set('query.term', term);
    queryParams.set('pageSize', pageSize.toString());
    queryParams.set('pageNumber', pageNumber.toString());
    queryParams.set('fields', fields);
    queryParams.set('source', 'ctgov');
    queryParams.set('fmt', 'json');
    
    const queryString = queryParams.toString();
    const queryStringLength = queryString.length;
    const maxUrlLength = 2000;
    
    let ctRaw;
    
    if (queryStringLength > maxUrlLength) {
      // Use POST request for long queries
      console.log(`Query too long (${queryStringLength} chars), using POST request`);
      if (typeof onProgress === 'function') onProgress('Sending search request (POST)');
      
      const postData = {
        source: 'ctgov',
        'query.cond': cond || '',
        'query.term': term || '',
        fields: fields,
        pageSize: pageSize,
        pageNumber: pageNumber,
        fmt: 'json'
      };
      
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
      const proxyUrl = `${PROXY_BASE}?${queryString}`;
      
      console.log('Searching ClinicalTrials.gov with URL:', proxyUrl.substring(0, 200) + (proxyUrl.length > 200 ? '...' : ''));
      
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
      const ctResult = await searchCTGov({ ...params, _rawCTGovResponse: ctRaw });
      console.log('searchCTGov result:', {
        success: ctResult.success,
        trialsLength: ctResult.trials?.length,
        error: ctResult.error
      });
      if (ctResult.success && ctResult.trials.length > 0) {
        const totalResults = ctRaw?.StudyFieldsResponse?.NStudiesFound || 
                            ctRaw?.StudyFieldsResponse?.NStudiesReturned || 
                            ctResult.trials.length;
        const hasMore = ctResult.trials.length >= pageSize && (totalResults > pageNumber * pageSize);
        
        if (typeof onProgress === 'function') {
          onProgress(`ClinicalTrials.gov returned ${ctResult.trials.length} results${hasMore ? ` (${totalResults} total available)` : ''}`);
        }
        return { 
          ...ctResult, 
          attemptedSources: attempted,
          pagination: {
            pageNumber,
            pageSize,
            totalResults: typeof totalResults === 'number' ? totalResults : null,
            hasMore
          }
        };
      } else {
        console.warn('ClinicalTrials.gov returned no trials:', ctResult);
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

  return { success: false, source: 'Aggregated', attemptedSources: attempted, totalResults: 0, trials: [], pagination: { pageNumber, pageSize, hasMore: false } };
}

/**
 * Parse and normalize ClinicalTrials.gov API v2 response
 * Uses defensive coding with optional chaining for all nested paths
 * @param {Object} params - Search parameters with _rawCTGovResponse
 * @returns {Promise<Object>} - Normalized trial data
 */
export async function searchCTGov(params) {
  try {
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
      studies = raw.studies.map(study => {
        try {
          // Use optional chaining for all nested paths
          const protocolSection = study?.protocolSection || {};
          const identificationModule = protocolSection?.identificationModule || {};
          const statusModule = protocolSection?.statusModule || {};
          const designModule = protocolSection?.designModule || {};
          const descriptionModule = protocolSection?.descriptionModule || {};
          const conditionsModule = protocolSection?.conditionsModule || {};
          const contactsLocationsModule = protocolSection?.contactsLocationsModule || {};
          const eligibilityModule = protocolSection?.eligibilityModule || {};
          
          // Map protocolSection.identificationModule.nctId to id
          const nctId = identificationModule?.nctId || study?.nctId || study?.id || '';
          if (!nctId) {
            console.warn('Study missing nctId, skipping:', study);
            return null;
          }
          
          // Map protocolSection.statusModule.overallStatus to status
          const overallStatus = statusModule?.overallStatus || 
                               statusModule?.overallStatusList?.overallStatus || 
                               study?.overallStatus || 
                               '';
          
          // Safely extract all fields with optional chaining
          const briefTitle = identificationModule?.briefTitle || 
                            identificationModule?.officialTitle || 
                            study?.title || 
                            '';
          
          const conditions = (conditionsModule?.conditions || []).map(c => {
            try {
              return typeof c === 'string' ? c : (c?.condition || c?.name || '');
            } catch (e) {
              return '';
            }
          }).filter(Boolean);
          
          const phases = (designModule?.phases || []).map(p => {
            try {
              return typeof p === 'string' ? p : (p?.phase || '');
            } catch (e) {
              return '';
            }
          }).filter(Boolean);
          
          const briefSummary = descriptionModule?.briefSummary || 
                              descriptionModule?.detailedDescription?.text || 
                              study?.summary || 
                              '';
          
          // Extract EligibilityCriteria
          const eligibilityCriteria = eligibilityModule?.eligibilityCriteria?.text || 
                                     eligibilityModule?.eligibilityCriteria || 
                                     '';
          
          // Map protocolSection.contactsLocationsModule.locations to locations
          const locations = contactsLocationsModule?.locations || [];
          const locationCities = [];
          const locationCountries = [];
          const locationStates = [];
          
          locations.forEach(loc => {
            try {
              const facility = loc?.facility || {};
              const city = facility?.city || '';
              const country = facility?.country || '';
              const state = facility?.state || '';
              if (city) locationCities.push(city);
              if (country) locationCountries.push(country);
              if (state) locationStates.push(state);
            } catch (e) {
              // Skip this location if there's an error
            }
          });
          
          // Convert v2 format to normalized trial format
          return {
            id: nctId,
            nctId: nctId,
            title: briefTitle,
            briefTitle: briefTitle,
            conditions: conditions,
            status: overallStatus,
            overallStatus: overallStatus,
            phase: phases.join(', '),
            phases: phases,
            summary: briefSummary,
            briefSummary: briefSummary,
            eligibilityCriteria: eligibilityCriteria,
            locations: locations.map(loc => ({
              city: loc?.facility?.city || '',
              state: loc?.facility?.state || '',
              country: loc?.facility?.country || '',
              zip: loc?.facility?.zip || ''
            })),
            locationCities: locationCities,
            locationCountries: locationCountries,
            locationStates: locationStates,
            source: 'ClinicalTrials.gov',
            url: `https://clinicaltrials.gov/study/${nctId}`
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
    } else if (raw && Array.isArray(raw)) {
      studies = raw;
      console.log('Using array format, studies count:', studies.length);
    }

    console.log('searchCTGov - studies array length:', studies.length);
    
    if (studies.length === 0) {
      console.warn('No studies found in response. Raw response keys:', raw ? Object.keys(raw) : 'no raw');
      if (raw) {
        console.warn('Raw response sample:', JSON.stringify(raw, null, 2).substring(0, 1000));
      }
      return { success: false, source: 'ClinicalTrials.gov', totalResults: 0, trials: [], error: 'No studies found in API response' };
    }

    // Normalize studies to trial format
    let trials = studies.map(s => {
      try {
        // Handle both v2 format (already normalized above) and legacy format
        if (s.id || s.nctId) {
          // Already in normalized format from v2 processing
          return s;
        }
        
        // Legacy format normalization
        const nctId = Array.isArray(s.NCTId) ? s.NCTId[0] : s.NCTId || '';
        const title = Array.isArray(s.BriefTitle) ? s.BriefTitle[0] : s.BriefTitle || '';
        const conditions = Array.isArray(s.Condition) ? s.Condition : (s.Condition || []);
        const status = Array.isArray(s.OverallStatus) ? s.OverallStatus[0] : s.OverallStatus || '';
        const phases = Array.isArray(s.Phase) ? s.Phase : (s.Phase || []);
        const summary = Array.isArray(s.BriefSummary) ? s.BriefSummary[0] : s.BriefSummary || '';
        const eligibilityCriteria = Array.isArray(s.EligibilityCriteria) ? s.EligibilityCriteria[0] : s.EligibilityCriteria || '';
        const locationCities = Array.isArray(s.LocationCity) ? s.LocationCity : (s.LocationCity || []);
        const locationCountries = Array.isArray(s.LocationCountry) ? s.LocationCountry : (s.LocationCountry || []);
        
        return {
          id: nctId,
          nctId: nctId,
          title: title,
          briefTitle: title,
          conditions: conditions,
          status: status,
          overallStatus: status,
          phase: phases.join(', '),
          phases: phases,
          summary: summary,
          briefSummary: summary,
          eligibilityCriteria: eligibilityCriteria,
          locationCities: locationCities,
          locationCountries: locationCountries,
          locations: locationCities.map((city, idx) => ({
            city: city,
            country: locationCountries[idx] || ''
          })),
          source: 'ClinicalTrials.gov',
          url: `https://clinicaltrials.gov/study/${nctId}`
        };
      } catch (error) {
        console.error('Error normalizing study:', error, s);
        return null;
      }
    }).filter(Boolean);

    console.log('searchCTGov - mapped trials count:', trials.length);

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

/**
 * Apply location filters to trial results
 * @param {Array} trials - Array of trial objects
 * @param {Object} params - Search parameters with location info
 * @returns {Promise<Array>} - Filtered trials
 */
async function applyLocationFilters(trials, params) {
  if (!params || !trials || trials.length === 0) return trials;
  
  const { country, includeAllLocations } = params;
  
  // If global search is enabled, return all trials
  if (includeAllLocations) {
    return trials;
  }
  
  // Filter by country if specified
  if (country) {
    return trials.filter(trial => {
      if (!trial.locationCountries || trial.locationCountries.length === 0) {
        // If no location data, include it (might be virtual/remote)
        return true;
      }
      return trial.locationCountries.some(c => 
        c && c.toLowerCase().includes(country.toLowerCase())
      );
    });
  }
  
  return trials;
}

/**
 * Build CTGov expression (legacy support)
 * @param {Object} params - Search parameters
 * @returns {string} - Search expression
 */
function buildCTGovExpr(params) {
  const { condition } = params || {};
  return condition || '';
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
    const brcaCondition = buildSearchCondition(patientProfile, ['BRCA']);
    
    const baseParams = {
      diagnosis: patientProfile.diagnosis,
      cancerType: patientProfile.cancerType,
      currentStatus: patientProfile.currentStatus,
      condition: brcaCondition.cond,
      biomarkers: brcaCondition.term,
      age: patientProfile.age,
      gender: patientProfile.gender,
      onProgress,
      pageNumber: 1,
      pageSize: 50
    };
    if (trialLocation) Object.assign(baseParams, {
      country: trialLocation.country,
      includeAllLocations: trialLocation.includeAllLocations
    });
    if (typeof onProgress === 'function') onProgress('Searching for BRCA-related trials on ClinicalTrials.gov');
    searchPromises.push(searchTrials(baseParams));
    attempted.push('BRCA');
  }

  // Search for TMB-high trials (immunotherapy)
  if (genomicProfile.biomarkers?.tumorMutationalBurden?.interpretation === 'high') {
    const tmbCondition = buildSearchCondition(patientProfile, ['TMB', 'immunotherapy']);
    
    const baseParamsTMB = {
      condition: tmbCondition.cond,
      biomarkers: tmbCondition.term,
      diagnosis: patientProfile.diagnosis,
      cancerType: patientProfile.cancerType,
      currentStatus: patientProfile.currentStatus,
      age: patientProfile.age,
      gender: patientProfile.gender,
      status: 'recruiting',
      pageNumber: 1,
      pageSize: 50
    };
    if (trialLocation) Object.assign(baseParamsTMB, {
      country: trialLocation.country,
      includeAllLocations: trialLocation.includeAllLocations
    });
    if (typeof onProgress === 'function') onProgress('Searching for TMB-high trials on ClinicalTrials.gov');
    searchPromises.push(searchTrials(baseParamsTMB));
    attempted.push('TMB');
  }

  // Search for MSI-H trials
  if (genomicProfile.biomarkers?.microsatelliteInstability?.status === 'MSI-H') {
    const msiCondition = buildSearchCondition(patientProfile, ['MSI-H']);
    
    const baseParamsMSI = {
      condition: msiCondition.cond,
      biomarkers: msiCondition.term,
      diagnosis: patientProfile.diagnosis,
      cancerType: patientProfile.cancerType,
      currentStatus: patientProfile.currentStatus,
      age: patientProfile.age,
      gender: patientProfile.gender,
      status: 'recruiting',
      pageNumber: 1,
      pageSize: 50
    };
    if (trialLocation) Object.assign(baseParamsMSI, {
      country: trialLocation.country,
      includeAllLocations: trialLocation.includeAllLocations
    });
    if (typeof onProgress === 'function') onProgress('Searching for MSI-H trials on ClinicalTrials.gov');
    searchPromises.push(searchTrials(baseParamsMSI));
    attempted.push('MSI-H');
  }

  // Search for HRD-positive trials (PARP inhibitors)
  if (genomicProfile.biomarkers?.hrdScore?.interpretation === 'HRD-positive') {
    const hrdCondition = buildSearchCondition(patientProfile, ['HRD', 'PARP']);
    
    const baseParamsHRD = {
      condition: hrdCondition.cond,
      biomarkers: hrdCondition.term,
      diagnosis: patientProfile.diagnosis,
      cancerType: patientProfile.cancerType,
      currentStatus: patientProfile.currentStatus,
      age: patientProfile.age,
      gender: patientProfile.gender,
      status: 'recruiting',
      pageNumber: 1,
      pageSize: 50
    };
    if (trialLocation) Object.assign(baseParamsHRD, {
      country: trialLocation.country,
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
    const topGenes = otherMutations.slice(0, 3);
    topGenes.forEach(mutation => {
      const mutationCondition = buildSearchCondition(patientProfile, [mutation.gene]);
      
      const gp = {
        condition: mutationCondition.cond,
        biomarkers: mutationCondition.term,
        diagnosis: patientProfile.diagnosis,
        cancerType: patientProfile.cancerType,
        currentStatus: patientProfile.currentStatus,
        age: patientProfile.age,
        gender: patientProfile.gender,
        status: 'recruiting',
        pageNumber: 1,
        pageSize: 50
      };
      if (trialLocation) Object.assign(gp, {
        country: trialLocation.country,
        includeAllLocations: trialLocation.includeAllLocations
      });
      if (typeof onProgress === 'function') onProgress(`Searching for gene ${mutation.gene} trials on ClinicalTrials.gov`);
      searchPromises.push(searchTrials(gp));
      attempted.push(mutation.gene);
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
  
  const generalCondition = buildSearchCondition(patientProfile, mutationTerms);
  
  const generalParams = {
    condition: generalCondition.cond,
    biomarkers: generalCondition.term,
    diagnosis: patientProfile.diagnosis,
    cancerType: patientProfile.cancerType,
    currentStatus: patientProfile.currentStatus,
    age: patientProfile.age,
    gender: patientProfile.gender,
    status: 'recruiting',
    pageNumber: 1,
    pageSize: 50
  };
  if (trialLocation) Object.assign(generalParams, {
    country: trialLocation.country,
    includeAllLocations: trialLocation.includeAllLocations
  });
  if (typeof onProgress === 'function') onProgress('Performing general diagnosis search on ClinicalTrials.gov');
  searchPromises.push(searchTrials(generalParams));
  attempted.push('general');

  // Execute all searches in parallel
  const results = await Promise.all(searchPromises);

  // Combine and deduplicate results
  const allTrials = [];
  const seenIds = new Set();

  results.forEach(result => {
    if (result.success && result.trials) {
      result.trials.forEach(trial => {
        if (trial.id && !seenIds.has(trial.id)) {
          seenIds.add(trial.id);
          allTrials.push(trial);
        }
      });
    }
  });

  return {
    success: allTrials.length > 0,
    source: 'ClinicalTrials.gov',
    totalResults: allTrials.length,
    trials: allTrials,
    attemptedSources: attempted
  };
}

/**
 * Check if a trial matches eligibility criteria
 * @param {Object} trial - Trial object
 * @param {Object} patientProfile - Patient profile
 * @returns {boolean} - True if trial matches
 */
export function matchesTrialEligibility(trial, patientProfile) {
  // Basic eligibility matching logic
  // Can be expanded with more sophisticated criteria parsing
  return true;
}

/**
 * Get detailed trial information
 * @param {string} nctId - NCT ID
 * @returns {Promise<Object>} - Detailed trial data
 */
export async function getTrialDetails(nctId) {
  // For detailed trial info, direct users to ClinicalTrials.gov website
  return {
    id: nctId,
    url: `https://clinicaltrials.gov/study/${nctId}`,
    source: 'ClinicalTrials.gov'
  };
}

// Backward compatibility exports
export const searchJRCT = searchTrials;
export const searchJRCTByGenomicProfile = searchTrialsByGenomicProfile;
export const matchesJRCTEligibility = matchesTrialEligibility;
export const getJRCTTrial = getTrialDetails;

