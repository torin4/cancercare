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
      // ClinicalTrials.gov Data API v2 (preferred)
      // Map legacy `expr` -> `query.term`, and translate paging params
      // into v2 `page[size]`/`page[number]`. We'll request JSON and
      // normalize the modern response back into a legacy-like
      // `StudyFieldsResponse` shape so the frontend can continue to use
      // the existing parsing logic without changes.
      const expr = params.get('expr') || params.get('condition') || '';
      const fields = params.get('fields') || '';
      const min_rnk = Number(params.get('min_rnk') || params.get('min') || 1);
      const max_rnk = Number(params.get('max_rnk') || params.get('max') || 50);
      // compute page size (cap to 1000 per API limits)
      const size = Math.min(Math.max(1, max_rnk - min_rnk + 1), 1000);
      const pageNumber = Math.max(1, Math.floor((min_rnk - 1) / size) + 1);

      const v2Params = [];
      if (expr) v2Params.push(`query.term=${encodeURIComponent(expr)}`);
      if (fields) v2Params.push(`fields=${encodeURIComponent(fields)}`);

      // Avoid passing paging parameters that may be rejected by the API
      // in some configurations; the v2 endpoint supports pagination but
      // we'll rely on its defaults for now.
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

      // If this was a CTGov v2 response, normalize it to a legacy
      // `StudyFieldsResponse` shape that the frontend expects.
      if (source === 'ctgov') {
        const d = response.data || {};
        // New v2 API often returns data in `data` array, or `studies`.
        const items = d.data || d.studies || d.results || [];
        const studies = [];

        // items may already be an array of study objects (modern schema)
        if (Array.isArray(items) && items.length > 0) {
          items.forEach(it => {
            // Try to extract common fields from multiple possible paths
            const id = it.nctId || it.NCTId || it.id || it.NCTID || (it.study && (it.study.nctId || it.study.NCTId));
            const title = it.briefTitle || it.BriefTitle || it.title || (it.study && (it.study.briefTitle || it.study.title)) || '';
            if (id) {
              // Legacy StudyFieldsResponse had arrays for each field
              studies.push({ NCTId: [id], BriefTitle: [title] });
            }
          });
        }

        // Fallback: if response.data already resembles legacy schema, forward it
        if (studies.length === 0 && d.StudyFieldsResponse && d.StudyFieldsResponse.Study) {
          res.status(response.status).setHeader('Content-Type', 'application/json');
          return res.json(d);
        }

        const out = { StudyFieldsResponse: { Study: studies } };
        res.status(200).setHeader('Content-Type', 'application/json');
        res.json(out);
        return;
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
      // If this was a CTGov request and the StudyFields API failed, try XML fallback
      if (source === 'ctgov') {
        try {
          // Reconstruct key params from forwardQs so we can call the XML endpoint
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

          // Very small XML -> JSON extraction for core fields (NCTId, BriefTitle)
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
          res.json(out);
          return;
        } catch (xmlErr) {
          console.error('ctgov XML fallback failed:', xmlErr.message || xmlErr);
          // fall-through to send original error below
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
      }

      // Not a ctgov fallback or fallback failed — rethrow to outer catch
      throw err;
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
