const axios = require('axios');
const { URL } = require('url');

// Universal proxy to forward trial API requests (JRCT, WHO, ClinicalTrials.gov)
// Usage examples:
//  /api/trials-proxy?source=jrct&condition=Ovarian
//  /api/trials-proxy?source=ctgov&expr=ovarian+cancer&fields=...
//  /api/trials-proxy?source=who&search=Ovarian%20Cancer

module.exports = async (req, res) => {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  // Handle POST requests for long query strings
  let params;
  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      params = new URLSearchParams();
      Object.keys(body).forEach(key => {
        params.set(key, body[key]);
      });
    } catch (e) {
      return res.status(400).json({ error: 'Invalid POST body' });
    }
  } else {
    const parsed = new URL(req.url, 'http://localhost');
    params = parsed.searchParams;
  }

  try {
    const source = params.get('source');

    // Build forward query string without the `source` param
    const forwardParams = [];
    params.forEach((v, k) => {
      if (k === 'source') return;
      forwardParams.push(`${k}=${encodeURIComponent(v)}`);
    });
    const forwardQs = forwardParams.join('&');

    let target;
    if (source === 'ctgov') {
      // ClinicalTrials.gov Public API v2 (for third-party apps)
      // Documentation: https://clinicaltrials.gov/data-api/api
      // The public API uses /api/v2/studies with query.term and query.cond parameters
      const queryTerm = params.get('query.term') || params.get('query.cond') || params.get('expr') || params.get('condition') || '';
      const pageSize = Number(params.get('pageSize') || params.get('max_rnk') || 50);
      const pageNumber = Number(params.get('pageNumber') || params.get('page') || 1);
      
      // Calculate pagination for v2 API (max 100 per page)
      const v2PageSize = Math.min(Math.max(1, pageSize), 100);
      const v2PageNumber = Math.max(1, pageNumber);
      
      // Build v2 API query parameters
      const v2Params = [];
      
      // Handle query.term and query.cond (public API format)
      // IMPORTANT MAPPING (matches ClinicalTrials.gov search interface):
      // - query.cond = condition/disease (main search field, e.g., "Ovarian Cancer")
      // - query.term = patient subtype (other terms field, e.g., "Clear Cell Sarcoma")
      // Note: Genes/biomarkers are NOT included in query.term - only subtype is included
      const queryTermParam = params.get('query.term');
      const queryCondParam = params.get('query.cond');
      
      // Use separate query.cond and query.term if both are provided (v2 API supports this)
      if (queryCondParam) {
        v2Params.push(`query.cond=${encodeURIComponent(queryCondParam)}`);
      }
      if (queryTermParam) {
        v2Params.push(`query.term=${encodeURIComponent(queryTermParam)}`);
      }
      
      // Fallback: if only legacy queryTerm is provided, use it for query.term
      if (!queryTermParam && !queryCondParam && queryTerm) {
        v2Params.push(`query.term=${encodeURIComponent(queryTerm)}`);
      }
      
      // Note: Public v2 API doesn't support query.locn parameter
      // Location filtering will be done client-side after receiving results
      const country = params.get('country');
      const includeAllLocations = params.get('includeAllLocations') === 'true' || params.get('includeAllLocations') === true;
      if (country && !includeAllLocations) {
        console.log('trials-proxy: Location filter requested:', country, '(will filter client-side)');
      }
      
      // v2 API uses pageSize for pagination
      v2Params.push(`pageSize=${v2PageSize}`);
      // Note: v2 API uses nextPageToken for pagination, but we can use pageSize for first page
      
      // IMPORTANT: Do NOT specify fields parameter - this forces API to return legacy format without location data
      // When fields is not specified, API returns full v2 format (studies array) with location data in protocolSection.contactsLocationsModule
      const fields = params.get('fields');
      if (fields && fields !== 'all') {
        // Only use fields if explicitly requested (but note: location data won't be available)
        v2Params.push(`fields=${encodeURIComponent(fields)}`);
        console.log('trials-proxy: WARNING - fields parameter specified, location data may not be available');
      }
      // If no fields specified, API returns full v2 format with location data
      
      // Use public v2 API endpoint (for third-party apps)
      target = `https://clinicaltrials.gov/api/v2/studies?${v2Params.join('&')}`;
      
      // Enhanced logging for debugging
      console.log('=== trials-proxy: ClinicalTrials.gov Public v2 API Request ===');
      console.log('Full API URL:', target);
      console.log('query.cond (Condition/Disease - main search):', queryCondParam || '(not provided)');
      console.log('query.term (Patient Subtype - other terms):', queryTermParam || '(not provided)');
      if (country) {
        console.log('query.locn (Location filter):', country, includeAllLocations ? '(but including all locations)' : '(country-specific)');
      }
      console.log('pageSize:', v2PageSize, '| pageNumber:', v2PageNumber);
      console.log('Fields:', fields || 'default fields');
      console.log('================================================================');
    } else if (source === 'who') {
      const path = params.get('path') || 'api/v1/trials';
      target = `https://trialsearch.who.int/${path}${forwardQs ? `?${forwardQs}` : ''}`;
    } else {
      return res.status(400).json({ error: 'Missing or invalid source parameter (accepted: who, ctgov)' });
    }

    console.log('trials-proxy forwarding to:', target);
    if (source === 'ctgov') {
      const queryTerm = params.get('query.term') || params.get('query.cond') || params.get('expr') || params.get('condition') || '';
      console.log('trials-proxy query term:', queryTerm || 'none');
    }

    // Try to fetch the target. For ClinicalTrials.gov we add special handling
    // to fall back to the ct2/results XML when the StudyFields API is unavailable.
    try {
      // For CTGov v2 API: Fetch ALL pages and filter on backend to match website behavior
      let allStudies = [];
      let nextPageToken = null;
      let pageCount = 0;
      const country = params.get('country');
      const includeAllLocations = params.get('includeAllLocations') === 'true' || params.get('includeAllLocations') === true;
      
      if (source === 'ctgov' && country && !includeAllLocations) {
        console.log('trials-proxy: Fetching ALL pages and filtering by location on backend:', country);
        
        // Fetch all pages using nextPageToken
        const seenTokens = new Set(); // Track tokens to detect infinite loops
        const seenFirstStudyIds = new Set(); // Track first study ID from each page to detect duplicates
        do {
          pageCount++;
          
          // Safety check: if we've seen this token before, pagination is broken
          if (nextPageToken && seenTokens.has(nextPageToken)) {
            console.warn(`trials-proxy: WARNING - Duplicate nextPageToken detected (${nextPageToken.substring(0, 20)}...), stopping pagination to prevent infinite loop`);
            break;
          }
          if (nextPageToken) {
            seenTokens.add(nextPageToken);
          }
          
          // IMPORTANT: API response returns nextPageToken, but request parameter must be pageToken
          const pageUrl = nextPageToken 
            ? `${target}&pageToken=${encodeURIComponent(nextPageToken)}`
            : target;
          
          console.log(`trials-proxy: Fetching page ${pageCount}${nextPageToken ? ` (token: ${nextPageToken.substring(0, 20)}...)` : ''}`);
          
          const response = await axios.get(pageUrl, {
            headers: {
              Accept: 'application/json',
              'User-Agent': req.headers['user-agent'] || 'CancerCareProxy/1.0'
            },
            timeout: 30000 // Longer timeout for multiple pages
          });
          
          const d = response.data || {};
          const items = d.studies || d.data || [];
          console.log(`trials-proxy: Page ${pageCount} returned ${items.length} studies`);
          
          // Safety check: detect if we're getting duplicate pages (same first study ID)
          if (items.length > 0) {
            const firstStudyId = items[0]?.protocolSection?.identificationModule?.nctId || 
                                items[0]?.nctId || 
                                items[0]?.id || 
                                '';
            if (firstStudyId && seenFirstStudyIds.has(firstStudyId)) {
              console.warn(`trials-proxy: WARNING - Duplicate page detected (first study ID: ${firstStudyId}), stopping pagination`);
              break;
            }
            if (firstStudyId) {
              seenFirstStudyIds.add(firstStudyId);
            }
          }
          
          // Collect all studies from this page
          allStudies.push(...items);
          
          // Check for next page
          const previousToken = nextPageToken;
          nextPageToken = d.nextPageToken || null;
          if (nextPageToken) {
            console.log(`trials-proxy: More pages available, nextPageToken: ${nextPageToken.substring(0, 20)}...`);
            // Additional check: if token hasn't changed, pagination might be stuck
            if (previousToken && previousToken === nextPageToken) {
              console.warn(`trials-proxy: WARNING - nextPageToken unchanged from previous page!`);
              console.warn(`trials-proxy: Previous: ${previousToken.substring(0, 40)}... Current: ${nextPageToken.substring(0, 40)}...`);
              console.warn(`trials-proxy: Stopping pagination. Total studies: ${allStudies.length}`);
              break;
            }
            // Only log "Token changed" if tokens are actually different
            if (previousToken && previousToken !== nextPageToken) {
              console.log(`trials-proxy: Token changed: ${previousToken.substring(0, 20)}... -> ${nextPageToken.substring(0, 20)}...`);
            } else if (previousToken) {
              // This shouldn't happen due to the check above, but log for debugging
              console.log(`trials-proxy: Token appears unchanged (will be caught by duplicate check)`);
            }
          } else {
            console.log(`trials-proxy: No more pages (nextPageToken is null)`);
          }
        } while (nextPageToken && pageCount < 100); // Safety limit: max 100 pages
        
        console.log(`trials-proxy: Fetched ${pageCount} page(s), total studies: ${allStudies.length}`);
        
        // Deduplicate studies by NCT ID before filtering
        const uniqueStudies = [];
        const seenStudyIds = new Set();
        for (const study of allStudies) {
          const id = study?.protocolSection?.identificationModule?.nctId || 
                     study?.nctId || 
                     study?.id || 
                     '';
          if (id && !seenStudyIds.has(id)) {
            seenStudyIds.add(id);
            uniqueStudies.push(study);
          }
        }
        console.log(`trials-proxy: After deduplication: ${uniqueStudies.length} unique studies (removed ${allStudies.length - uniqueStudies.length} duplicates)`);
        allStudies = uniqueStudies;
        
        // Now process and filter all studies
        const studies = [];
        const countryLower = country.toLowerCase();
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
        
        let searchTerms = [countryLower];
        for (const [key, variations] of Object.entries(countryVariations)) {
          if (variations.includes(countryLower)) {
            searchTerms = variations;
            break;
          }
        }
        
        console.log(`trials-proxy: Filtering ${allStudies.length} studies for country: ${country} (search terms: ${searchTerms.join(', ')})`);
        
        let studiesWithNoLocation = 0;
        let studiesWithLocationButNoMatch = 0;
        let studiesWithMatch = 0;
        let sampleLocationData = []; // Store first few location examples for debugging
        
        allStudies.forEach((study, idx) => {
          try {
            const protocolSection = study.protocolSection || {};
            const identificationModule = protocolSection.identificationModule || {};
            const statusModule = protocolSection.statusModule || {};
            const designModule = protocolSection.designModule || {};
            const descriptionModule = protocolSection.descriptionModule || {};
            const conditionsModule = protocolSection.conditionsModule || {};
            const contactsLocationsModule = protocolSection.contactsLocationsModule || {};
            
            const id = identificationModule.nctId || study.nctId || study.id || '';
            if (!id) return;
            
            // Extract locations
            const locations = contactsLocationsModule?.locations || [];
            const locationCountries = [];
            
            locations.forEach(loc => {
              const country = loc?.country || '';
              if (country) locationCountries.push(country);
            });
            
            // Collect sample location data for first few studies
            if (idx < 5 && locationCountries.length > 0) {
              sampleLocationData.push({
                studyId: id,
                countries: locationCountries
              });
            }
            
            // Check if this trial has the requested country
            const hasMatch = locationCountries.some(locCountry => 
              searchTerms.some(term => locCountry.toLowerCase().includes(term))
            );
            
            // Only include trials that match the country filter
            if (!hasMatch && locations.length > 0) {
              studiesWithLocationButNoMatch++;
              return; // Skip this trial - doesn't match country filter
            }
            
            // If no location data, exclude it (can't verify it's in requested country)
            if (locations.length === 0) {
              studiesWithNoLocation++;
              return; // Skip trials with no location data
            }
            
            studiesWithMatch++;
            
            // Process this study (it passed the location filter)
            const briefTitle = identificationModule.briefTitle || identificationModule.officialTitle || study.title || '';
            const conditions = (conditionsModule?.conditions || []).map(c => 
              typeof c === 'string' ? c : (c?.condition || c?.name || '')
            ).filter(Boolean);
            const overallStatus = statusModule?.overallStatus || 
                                 statusModule?.overallStatusList?.overallStatus || 
                                 study.overallStatus || '';
            const phases = (designModule?.phases || []).map(p => 
              typeof p === 'string' ? p : (p?.phase || '')
            ).filter(Boolean);
            const briefSummary = descriptionModule?.briefSummary || 
                                descriptionModule?.detailedDescription?.text || 
                                study.summary || '';
            
            // Extract full location details including facility names
            const locationDetails = [];
            locations.forEach(loc => {
              try {
                // Handle both formats: facility as object or facility as string
                const facility = loc?.facility;
                const facilityName = typeof facility === 'string' 
                  ? facility 
                  : (facility?.name || '');
                const city = loc?.city || facility?.city || '';
                const state = loc?.state || facility?.state || '';
                const country = loc?.country || facility?.country || '';
                
                if (city || country || facilityName) {
                  locationDetails.push({
                    facility: facilityName,
                    city: city,
                    state: state,
                    country: country
                  });
                }
              } catch (e) {
                console.warn(`trials-proxy: Error extracting location details:`, e?.message || e);
              }
            });
            
            const locationCities = locationDetails.map(loc => loc.city).filter(Boolean);
            
            studies.push({
              NCTId: [id],
              BriefTitle: [briefTitle],
              Condition: conditions,
              OverallStatus: [overallStatus],
              Phase: phases,
              BriefSummary: [briefSummary],
              LocationCity: locationCities,
              LocationCountry: locationCountries,
              LocationDetails: locationDetails // Add full location details with facility names
            });
          } catch (error) {
            console.error(`trials-proxy: Error processing study ${idx}:`, error?.message || error);
          }
        });
        
        console.log(`trials-proxy: Location filtering summary:`);
        console.log(`   - Studies with matching location: ${studiesWithMatch}`);
        console.log(`   - Studies with location but no match: ${studiesWithLocationButNoMatch}`);
        console.log(`   - Studies with no location data: ${studiesWithNoLocation}`);
        console.log(`   - Sample location data (first 5 studies):`, JSON.stringify(sampleLocationData, null, 2));
        console.log(`trials-proxy: After location filtering: ${studies.length} studies match ${country}`);
        
        const out = { 
          StudyFieldsResponse: { 
            Study: studies,
            NStudiesReturned: studies.length,
            NStudiesFound: studies.length
          } 
        };
        res.status(200).setHeader('Content-Type', 'application/json');
        return res.json(out);
      }
      
      // For CTGov v2 API: Fetch ALL pages to get complete results (even without country filter)
      if (source === 'ctgov') {
        console.log('trials-proxy: Fetching ALL pages for complete results');
        
        // Fetch all pages using nextPageToken
        let allStudies = [];
        let nextPageToken = null;
        let pageCount = 0;
        const seenTokens = new Set(); // Track tokens to detect infinite loops
        const seenFirstStudyIds = new Set(); // Track first study ID from each page to detect duplicates
        
        do {
          pageCount++;
          
          // Safety check: if we've seen this token before, pagination is broken
          if (nextPageToken && seenTokens.has(nextPageToken)) {
            console.warn(`trials-proxy: WARNING - Duplicate nextPageToken detected (${nextPageToken.substring(0, 20)}...), stopping pagination to prevent infinite loop`);
            break;
          }
          if (nextPageToken) {
            seenTokens.add(nextPageToken);
          }
          
          // IMPORTANT: API response returns nextPageToken, but request parameter must be pageToken
          const pageUrl = nextPageToken 
            ? `${target}&pageToken=${encodeURIComponent(nextPageToken)}`
            : target;
          
          console.log(`trials-proxy: Fetching page ${pageCount}${nextPageToken ? ` (token: ${nextPageToken.substring(0, 20)}...)` : ''}`);
          
          const response = await axios.get(pageUrl, {
            headers: {
              Accept: 'application/json',
              'User-Agent': req.headers['user-agent'] || 'CancerCareProxy/1.0'
            },
            timeout: 30000 // Longer timeout for multiple pages
          });
          
          const d = response.data || {};
          const items = d.studies || d.data || [];
          console.log(`trials-proxy: Page ${pageCount} returned ${items.length} studies`);
          
          // Safety check: detect if we're getting duplicate pages (same first study ID)
          if (items.length > 0) {
            const firstStudyId = items[0]?.protocolSection?.identificationModule?.nctId || 
                                items[0]?.nctId || 
                                items[0]?.id || 
                                '';
            if (firstStudyId && seenFirstStudyIds.has(firstStudyId)) {
              console.warn(`trials-proxy: WARNING - Duplicate page detected (first study ID: ${firstStudyId}), stopping pagination`);
              break;
            }
            if (firstStudyId) {
              seenFirstStudyIds.add(firstStudyId);
            }
          }
          
          // Collect all studies from this page
          allStudies.push(...items);
          
          // Check for next page
          const previousToken = nextPageToken;
          nextPageToken = d.nextPageToken || null;
          if (nextPageToken) {
            console.log(`trials-proxy: More pages available, nextPageToken: ${nextPageToken.substring(0, 20)}...`);
            // Additional check: if token hasn't changed, pagination might be stuck
            if (previousToken && previousToken === nextPageToken) {
              console.warn(`trials-proxy: WARNING - nextPageToken unchanged from previous page!`);
              console.warn(`trials-proxy: Previous: ${previousToken.substring(0, 40)}... Current: ${nextPageToken.substring(0, 40)}...`);
              console.warn(`trials-proxy: Stopping pagination. Total studies: ${allStudies.length}`);
              break;
            }
            // Only log "Token changed" if tokens are actually different
            if (previousToken && previousToken !== nextPageToken) {
              console.log(`trials-proxy: Token changed: ${previousToken.substring(0, 20)}... -> ${nextPageToken.substring(0, 20)}...`);
            } else if (previousToken) {
              // This shouldn't happen due to the check above, but log for debugging
              console.log(`trials-proxy: Token appears unchanged (will be caught by duplicate check)`);
            }
          } else {
            console.log(`trials-proxy: No more pages (nextPageToken is null)`);
          }
        } while (nextPageToken && pageCount < 100); // Safety limit: max 100 pages
        
        console.log(`trials-proxy: Fetched ${pageCount} page(s), total studies: ${allStudies.length}`);
        
        // Deduplicate studies by NCT ID before processing
        const uniqueStudies = [];
        const seenStudyIds = new Set();
        for (const study of allStudies) {
          const id = study?.protocolSection?.identificationModule?.nctId || 
                     study?.nctId || 
                     study?.id || 
                     '';
          if (id && !seenStudyIds.has(id)) {
            seenStudyIds.add(id);
            uniqueStudies.push(study);
          }
        }
        console.log(`trials-proxy: After deduplication: ${uniqueStudies.length} unique studies (removed ${allStudies.length - uniqueStudies.length} duplicates)`);
        allStudies = uniqueStudies;
        
        // Now process all studies (no location filtering for global search)
        const d = { studies: allStudies };
        
        console.log('trials-proxy: CTGov response structure:', {
          hasStudyFieldsResponse: !!d.StudyFieldsResponse,
          hasStudies: !!d.studies,
          hasData: !!d.data,
          keys: Object.keys(d)
        });
        
        // Check if it's already in legacy format (fallback from old API)
        if (d.StudyFieldsResponse && d.StudyFieldsResponse.Study) {
          console.log('trials-proxy: Using legacy StudyFieldsResponse format, studies:', d.StudyFieldsResponse.Study.length);
          if (d.StudyFieldsResponse.Study.length > 0) {
            // Log first study to see location data structure
            const firstStudy = d.StudyFieldsResponse.Study[0];
            console.log('trials-proxy: First study keys:', Object.keys(firstStudy));
            console.log('trials-proxy: First study LocationCity:', firstStudy.LocationCity);
            console.log('trials-proxy: First study LocationCountry:', firstStudy.LocationCountry);
            // Check for all location-related fields
            const locationFields = Object.keys(firstStudy).filter(k => 
              k.toLowerCase().includes('location') || 
              k.toLowerCase().includes('city') || 
              k.toLowerCase().includes('country') ||
              k.toLowerCase().includes('facility')
            );
            if (locationFields.length > 0) {
              console.log('trials-proxy: Location-related fields found:', locationFields);
              locationFields.forEach(field => {
                console.log(`trials-proxy:   ${field}:`, firstStudy[field]);
              });
            }
          }
          if (d.StudyFieldsResponse.Study.length === 0) {
            const queryTerm = params.get('query.term') || params.get('query.cond') || params.get('expr') || params.get('condition') || '';
            console.log('trials-proxy: WARNING - Empty Study array. Query was:', queryTerm);
            console.log('trials-proxy: Full response structure:', JSON.stringify(d, null, 2).substring(0, 500));
          }
          res.status(200).setHeader('Content-Type', 'application/json');
          return res.json(d);
        }

        // v2 API structure: response has `studies` array directly at root
        const items = d.studies || d.data || [];
        const studies = [];
        
        console.log('trials-proxy: Processing v2 API format, items count:', items.length);
        console.log('trials-proxy: Response structure check - has studies:', !!d.studies, 'has data:', !!d.data, 'keys:', Object.keys(d));
        
        if (items.length === 0 && d.studies === undefined && d.data === undefined) {
          console.warn('trials-proxy: No studies array found in response. Full response:', JSON.stringify(d, null, 2).substring(0, 1000));
        }
        
        if (Array.isArray(items) && items.length > 0) {
          items.forEach((study, idx) => {
            try {
              // v2 API structure: study.protocolSection contains all the data
              const protocolSection = study.protocolSection || {};
              // Safely extract modules with fallbacks to prevent 'cannot read property of undefined' errors
              const identificationModule = protocolSection.identificationModule || {};
              const statusModule = protocolSection.statusModule || {};
              const designModule = protocolSection.designModule || {};
              const descriptionModule = protocolSection.descriptionModule || {};
              const conditionsModule = protocolSection.conditionsModule || {};
              const contactsLocationsModule = protocolSection.contactsLocationsModule || {};

              // Safely extract nctId with multiple fallbacks
              const id = identificationModule.nctId || study.nctId || study.id || '';
              if (!id) {
                console.warn(`trials-proxy: Study ${idx} has no nctId, skipping`);
                return; // Skip if no ID
              }

              // Safely extract title
              const briefTitle = identificationModule.briefTitle || identificationModule.officialTitle || study.title || '';
              
              // Safely extract conditions
              const conditions = (conditionsModule?.conditions || []).map(c => {
                try {
                  return typeof c === 'string' ? c : (c?.condition || c?.name || '');
                } catch (e) {
                  return '';
                }
              }).filter(Boolean);
              
              // Safely extract status
              const overallStatus = statusModule?.overallStatus || 
                                   statusModule?.overallStatusList?.overallStatus || 
                                   study.overallStatus || 
                                   '';
              
              // Safely extract phases
              const phases = (designModule?.phases || []).map(p => {
                try {
                  return typeof p === 'string' ? p : (p?.phase || '');
                } catch (e) {
                  return '';
                }
              }).filter(Boolean);
              
              // Safely extract summary - can be string or object with text property
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
              
              // Safely extract locations from contactsLocationsModule
              // According to ClinicalTrials.gov API docs: protocolSection.contactsLocationsModule.locations[]
              // Each location has: facility { name, city, state, zip, country }
              const locations = contactsLocationsModule?.locations || [];
              const locationCities = [];
              const locationCountries = [];
              

// CRITICAL DEBUG: Log location structure for first study to understand why extraction fails
              if (locations.length > 0 && idx === 0) {
                console.log(`trials-proxy: ===== LOCATION STRUCTURE DEBUG FOR FIRST STUDY ${id} =====`);
                console.log(`trials-proxy: Number of locations: ${locations.length}`);
                console.log(`trials-proxy: First location FULL structure:`, JSON.stringify(locations[0], null, 2));
                console.log(`trials-proxy: First location keys:`, Object.keys(locations[0] || {}));
                if (locations[0]?.facility) {
                  console.log(`trials-proxy: Facility object:`, JSON.stringify(locations[0].facility, null, 2));
                  console.log(`trials-proxy: Facility keys:`, Object.keys(locations[0].facility || {}));
                } else {
                  console.log(`trials-proxy: WARNING - First location has NO facility property!`);
                }
                console.log(`trials-proxy: ====================================================`);
              }

              const locationDetails = [];
              locations.forEach(loc => {
                try {
                  // IMPORTANT: Based on actual API response structure:
                  // - city and country are DIRECTLY on the location object (loc.city, loc.country)
                  // - facility can be a STRING (facility name) or an object with a name property
                  // Structure: { facility: "Name" or {name: "Name"}, city: "Beijing", country: "China", state: "...", ... }
                  const facility = loc?.facility;
                  const facilityName = typeof facility === 'string' 
                    ? facility 
                    : (facility?.name || '');
                  const city = loc?.city || '';
                  const state = loc?.state || '';
                  const country = loc?.country || '';
                  
                  // Build location string with city, state (if available), and country
                  if (city) {
                    locationCities.push(city);
                  }
                  if (country) {
                    locationCountries.push(country);
                  }
                  
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
                    console.log(`trials-proxy: Extracted location for study ${id}: facility=${facilityName}, city=${city}, state=${state}, country=${country}`);
                  }
                } catch (e) {
                  console.warn(`trials-proxy: Error extracting location for study ${id}:`, e?.message || e);
                  // Skip this location if there's an error
                }
              });
              
              // Log location extraction summary
              if (locations.length > 0) {
                console.log(`trials-proxy: Study ${id} has ${locations.length} location(s), extracted ${locationCities.length} cities, ${locationCountries.length} countries`);
              } else {
                console.warn(`trials-proxy: Study ${id} has no locations in contactsLocationsModule`);
              }

              // Extract all fields in legacy array format
              const studyObj = {
                NCTId: [id],
                BriefTitle: [briefTitle],
                Condition: conditions,
                OverallStatus: [overallStatus],
                Phase: phases,
                BriefSummary: [briefSummary],
                LocationCity: locationCities,
                LocationCountry: locationCountries
              };

              studies.push(studyObj);
            } catch (error) {
              console.error(`trials-proxy: Error processing study ${idx}:`, error?.message || error);
              // Continue processing other studies even if one fails
            }
          });
        } else {
          console.warn('trials-proxy: No items array found or empty. Response data:', JSON.stringify(d, null, 2).substring(0, 500));
        }

        console.log('trials-proxy: Normalized studies count:', studies.length);

        // Return in legacy StudyFieldsResponse format for compatibility
        const out = { 
          StudyFieldsResponse: { 
            Study: studies,
            NStudiesReturned: studies.length,
            NStudiesFound: studies.length // All pages fetched, so this is the complete count
          } 
        };
        res.status(200).setHeader('Content-Type', 'application/json');
        return res.json(out);
      }

      // Non-CTGov responses: forward JSON as-is
      res.status(response.status).setHeader('Content-Type', 'application/json');
      if (typeof response.data === 'string') {
        res.send(response.data);
      } else {
        res.json(response.data);
      }
      return;
    } catch (err) {
      // If this was a CTGov v2 API request that failed, try legacy API as fallback
      if (source === 'ctgov') {
        try {
          console.log('trials-proxy ctgov v2 failed, trying legacy API fallback:', err?.message || err);
          
          // Try legacy API endpoint as fallback
          const expr = params.get('expr') || params.get('condition') || '';
          const fields = params.get('fields') || 'NCTId,BriefTitle,Condition,OverallStatus,Phase,BriefSummary,LocationCity,LocationCountry';
          const min_rnk = params.get('min_rnk') || params.get('min') || '1';
          const max_rnk = params.get('max_rnk') || params.get('max') || '50';
          const legacyUrl = `https://clinicaltrials.gov/api/query/study_fields?expr=${encodeURIComponent(expr)}&fields=${encodeURIComponent(fields)}&min_rnk=${min_rnk}&max_rnk=${max_rnk}&fmt=json`;

          console.log('trials-proxy ctgov fallback to legacy API:', legacyUrl);
          const legacyRes = await axios.get(legacyUrl, {
            headers: { 
              'User-Agent': req.headers['user-agent'] || 'CancerCareProxy/1.0',
              Accept: 'application/json'
            },
            timeout: 20000
          });

          // Legacy API returns StudyFieldsResponse format directly
          if (legacyRes.data && legacyRes.data.StudyFieldsResponse) {
            res.status(200).setHeader('Content-Type', 'application/json');
            return res.json(legacyRes.data);
          }
        } catch (legacyErr) {
          console.error('ctgov legacy API fallback also failed:', legacyErr.message || legacyErr);
          // Try XML as last resort
          try {
            const expr = params.get('expr') || params.get('condition') || '';
            const min_rnk = params.get('min_rnk') || '1';
            const max_rnk = params.get('max_rnk') || '50';
            const xmlUrl = `https://clinicaltrials.gov/ct2/results?expr=${encodeURIComponent(expr)}&min_rnk=${min_rnk}&max_rnk=${max_rnk}&displayxml=true`;

            console.log('trials-proxy ctgov fallback to XML:', xmlUrl);
            const xmlRes = await axios.get(xmlUrl, {
              headers: { 'User-Agent': req.headers['user-agent'] || 'CancerCareProxy/1.0' },
              timeout: 20000
            });

            const xml = xmlRes.data || '';
            const studies = [];
            const studyBlocks = Array.from(xml.matchAll(/<clinical_study>([\s\S]*?)<\/clinical_study>/gi));
            studyBlocks.forEach(sb => {
              const block = sb[1];
              const idMatch = block.match(/<nct_id>([\s\S]*?)<\/nct_id>/i);
              const titleMatch = block.match(/<brief_title>([\s\S]*?)<\/brief_title>/i);
              const id = idMatch ? idMatch[1].trim() : null;
              const title = titleMatch ? titleMatch[1].trim() : '';
              if (id) {
                studies.push({ NCTId: [id], BriefTitle: [title] });
              }
            });

            const out = { StudyFieldsResponse: { Study: studies } };
            res.status(200).setHeader('Content-Type', 'application/json');
            return res.json(out);
          } catch (xmlErr) {
            console.error('ctgov XML fallback also failed:', xmlErr.message || xmlErr);
            // fall-through to send original error below
          }
        }
      }

      // If WHO returned a 404 or unavailable message, attempt to fall back
      // to ClinicalTrials.gov v2 using the same search expression.
      if (source === 'who') {
        const status = err?.response?.status;
        const msg = String(err?.response?.data || '').toLowerCase();
        if (status === 404 || msg.includes('removed') || msg.includes('temporarily unavailable')) {
          try {
            const expr = params.get('search') || params.get('condition') || '';
            const fields = params.get('fields') || 'NCTId,BriefTitle';
            const ctUrl = `https://clinicaltrials.gov/api/v2/studies?query.term=${encodeURIComponent(expr)}&fields=${encodeURIComponent(fields)}`;
            console.log('trials-proxy WHO fallback to CTGov v2:', ctUrl);
            const ctRes = await axios.get(ctUrl, {
              headers: { 'User-Agent': req.headers['user-agent'] || 'CancerCareProxy/1.0', Accept: 'application/json' },
              timeout: 20000
            });
            // Normalize v2 response into legacy StudyFieldsResponse-like shape
            const d = ctRes.data || {};
            const items = d.data || d.studies || d.results || [];
            const studies = [];
            if (Array.isArray(items)) {
              items.forEach(it => {
                const id = it.nctId || it.NCTId || it.id || (it.study && (it.study.nctId || it.study.NCTId));
                const title = it.briefTitle || it.BriefTitle || it.title || (it.study && (it.study.briefTitle || it.study.title)) || '';
                if (id) studies.push({ NCTId: [id], BriefTitle: [title] });
              });
            }
            const out = { StudyFieldsResponse: { Study: studies } };
            res.status(200).setHeader('Content-Type', 'application/json');
            res.json(out);
            return;
          } catch (ctErr) {
            console.error('WHO->CTGov fallback failed:', ctErr.message || ctErr);
            // fall through to return original WHO error below
          }
        }
      }
      // Not a ctgov/WHO fallback or fallback failed — return an error response
      if (err && err.response) {
        res.status(err.response.status).json({ error: err.message, details: err.response.data });
        return;
      }
      res.status(502).json({ error: 'Upstream request failed', message: err?.message || String(err) });
      return;
    }

  } catch (error) {
    console.error('trials-proxy error:', error.message || error);
    if (error.response) {
      res.status(error.response.status).json({ error: error.message, details: error.response.data });
      return;
    }
    res.status(502).json({ error: 'Trials proxy error', message: error.message });
  }
};
// Force rebuild
