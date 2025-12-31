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
      // ClinicalTrials.gov API v2 (modernized API)
      // According to migration guide: https://clinicaltrials.gov/data-api/about-api/api-migration#query-endpoints
      // The new API uses /api/v2/studies with query.term and query.cond parameters
      // Support both v2 format (query.term, query.cond, pageSize) and legacy format (expr, min_rnk, max_rnk)
      const queryTerm = params.get('query.term') || params.get('query.cond') || params.get('expr') || params.get('condition') || '';
      const pageSize = Number(params.get('pageSize') || params.get('max_rnk') || 50);
      const pageNumber = Number(params.get('pageNumber') || params.get('page') || 1);
      
      // Calculate pagination for v2 API (max 100 per page)
      const v2PageSize = Math.min(Math.max(1, pageSize), 100);
      const v2PageNumber = Math.max(1, pageNumber);
      
      // Build v2 API query parameters
      const v2Params = [];
      if (queryTerm) {
        // v2 API uses query.term for search terms
        v2Params.push(`query.term=${encodeURIComponent(queryTerm)}`);
        // Also include query.cond if provided separately
        const queryCond = params.get('query.cond');
        if (queryCond && queryCond !== queryTerm) {
          v2Params.push(`query.cond=${encodeURIComponent(queryCond)}`);
        }
      }
      
      // v2 API uses page[size] and page[number] for pagination
      v2Params.push(`page.size=${v2PageSize}`);
      v2Params.push(`page.number=${v2PageNumber}`);
      
      // Include fields if specified
      const fields = params.get('fields');
      if (fields) {
        v2Params.push(`fields=${encodeURIComponent(fields)}`);
      }
      
      // Use new v2 API endpoint
      target = `https://clinicaltrials.gov/api/v2/studies?${v2Params.join('&')}`;
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
      const response = await axios.get(target, {
        headers: {
          Accept: 'application/json',
          'User-Agent': req.headers['user-agent'] || 'CancerCareProxy/1.0'
        },
        timeout: 20000
      });
      
      console.log('trials-proxy: API response status:', response.status);
      console.log('trials-proxy: API response data keys:', Object.keys(response.data || {}));

      // If this was a CTGov v2 API response, normalize it to legacy format
      if (source === 'ctgov') {
        const d = response.data || {};
        
        console.log('trials-proxy: CTGov response structure:', {
          hasStudyFieldsResponse: !!d.StudyFieldsResponse,
          hasStudies: !!d.studies,
          hasData: !!d.data,
          keys: Object.keys(d),
          status: response.status
        });
        
        // Check if it's already in legacy format (fallback from old API)
        if (d.StudyFieldsResponse && d.StudyFieldsResponse.Study) {
          console.log('trials-proxy: Using legacy StudyFieldsResponse format, studies:', d.StudyFieldsResponse.Study.length);
          if (d.StudyFieldsResponse.Study.length === 0) {
            const queryTerm = params.get('query.term') || params.get('query.cond') || params.get('expr') || params.get('condition') || '';
            console.log('trials-proxy: WARNING - Empty Study array. Query was:', queryTerm);
            console.log('trials-proxy: Full response structure:', JSON.stringify(d, null, 2).substring(0, 500));
          }
          res.status(response.status).setHeader('Content-Type', 'application/json');
          return res.json(d);
        }

        // v2 API structure: response has `studies` array
        const items = d.studies || d.data || [];
        const studies = [];
        
        console.log('trials-proxy: Processing v2 API format, items count:', items.length);
        
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
              
              // Safely extract summary
              const briefSummary = descriptionModule?.briefSummary || 
                                  descriptionModule?.detailedDescription?.text || 
                                  study.summary || 
                                  '';
              
              // Safely extract locations
              const locations = contactsLocationsModule?.locations || [];
              const locationCities = [];
              const locationCountries = [];
              
              locations.forEach(loc => {
                try {
                  const facility = loc?.facility || {};
                  const city = facility?.city || '';
                  const country = facility?.country || '';
                  if (city) locationCities.push(city);
                  if (country) locationCountries.push(country);
                } catch (e) {
                  // Skip this location if there's an error
                }
              });

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
            NStudiesFound: d.nextPageToken ? '>=' + studies.length : studies.length
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
