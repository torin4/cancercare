const axios = require('axios');

const JRCT_HOST = 'https://jrct.niph.go.jp';

// Vercel serverless function to proxy JRCT API requests (bypasses CORS)
module.exports = async (req, res) => {
  // Allow CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Extract the path from the query string or URL
    // The path should be passed as a query parameter 'path' or extracted from the URL
    const path = req.query.path || req.url.replace(/^\/api\/jrct-proxy/, '');
    const target = `${JRCT_HOST}${path}${req.url.includes('?') ? '&' + new URL(req.url, 'http://localhost').search.substring(1) : ''}`;
    

    const response = await axios.get(target, {
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'en,ja',
        'User-Agent': req.headers['user-agent'] || 'CancerCareProxy/1.0'
      },
      timeout: 20000
    });

    res.status(response.status).json(response.data);
  } catch (error) {
    if (error.response) {
      res.status(error.response.status).json({ error: error.message, details: error.response.data });
      return;
    }
    res.status(502).json({ error: 'JRCT proxy error', message: error.message });
  }
};

