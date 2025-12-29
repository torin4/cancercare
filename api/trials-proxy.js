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
      // ClinicalTrials.gov Study Fields API (preferred)
      // We'll attempt the official JSON StudyFields API first; if it fails
      // we fall back to the XML/results endpoint and convert a small
      // set of fields into a Study-like JSON response so the frontend
      // can continue to work without adding new dependencies.
      target = `https://clinicaltrials.gov/api/query/study_fields?${forwardQs}`;
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

      // Forward JSON response
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
