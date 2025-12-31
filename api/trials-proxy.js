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
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const parsed = new URL(req.url, 'http://localhost');
    const params = parsed.searchParams;
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
      // The new API uses /api/v2/studies with query.term parameter
      const expr = params.get('expr') || params.get('condition') || '';
      const min_rnk = Number(params.get('min_rnk') || params.get('min') || 1);
      const max_rnk = Number(params.get('max_rnk') || params.get('max') || 50);
      
      // Calculate pagination for v2 API
      const pageSize = Math.min(Math.max(1, max_rnk - min_rnk + 1), 100); // v2 API max is 100 per page
      const pageToken = params.get('pageToken') || null; // For pagination continuation
      
      // Build v2 API query
      const v2Params = [];
      if (expr) {
        v2Params.push(`query.term=${encodeURIComponent(expr)}`);
      }
      // v2 API uses page[size] and page[token] for pagination
      v2Params.push(`page.size=${pageSize}`);
      if (pageToken) {
        v2Params.push(`page.token=${encodeURIComponent(pageToken)}`);
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

      // If this was a CTGov v2 API response, normalize it to legacy format
      if (source === 'ctgov') {
        const d = response.data || {};
        
        // Check if it's already in legacy format (fallback from old API)
        if (d.StudyFieldsResponse && d.StudyFieldsResponse.Study) {
          res.status(response.status).setHeader('Content-Type', 'application/json');
          return res.json(d);
        }

        // v2 API structure: response has `studies` array
        const items = d.studies || [];
        const studies = [];
        
        if (Array.isArray(items) && items.length > 0) {
          items.forEach(study => {
            // v2 API structure: study.protocolSection contains all the data
            const protocolSection = study.protocolSection || {};
            const identificationModule = protocolSection.identificationModule || {};
            const statusModule = protocolSection.statusModule || {};
            const designModule = protocolSection.designModule || {};
            const descriptionModule = protocolSection.descriptionModule || {};
            const conditionsModule = protocolSection.conditionsModule || {};
            const contactsLocationsModule = protocolSection.contactsLocationsModule || {};

            const id = identificationModule.nctId || '';
            if (!id) return; // Skip if no ID

            // Extract all fields in legacy array format
            const studyObj = {
              NCTId: [id],
              BriefTitle: [identificationModule.briefTitle || identificationModule.officialTitle || ''],
              Condition: (conditionsModule.conditions || []).map(c => {
                // Handle both string and object formats
                return typeof c === 'string' ? c : (c.condition || c.name || '');
              }),
              OverallStatus: [statusModule.overallStatus || statusModule.overallStatusList?.overallStatus || ''],
              Phase: (designModule.phases || []).map(p => {
                return typeof p === 'string' ? p : (p.phase || '');
              }),
              BriefSummary: [descriptionModule.briefSummary || descriptionModule.detailedDescription?.text || ''],
              LocationCity: [],
              LocationCountry: []
            };

            // Extract location information from contactsLocationsModule
            const locations = contactsLocationsModule.locations || [];
            locations.forEach(loc => {
              const facility = loc.facility || {};
              const city = facility.city || '';
              const country = facility.country || '';
              if (city) studyObj.LocationCity.push(city);
              if (country) studyObj.LocationCountry.push(country);
            });

            studies.push(studyObj);
          });
        }

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
