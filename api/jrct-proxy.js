const axios = require('axios');

// Simple proxy to forward requests to JRCT API to avoid client TLS/cors issues.
// Forwards any path after /api/jrct-proxy to https://jrct.niph.go.jp

module.exports = async (req, res) => {
  try {
    // Reconstruct target URL by removing the /api/jrct-proxy prefix
    const prefix = '/api/jrct-proxy';
    const originalUrl = req.url || '';
    const forwardPath = originalUrl.startsWith(prefix) ? originalUrl.slice(prefix.length) : originalUrl;
    const target = `https://jrct.niph.go.jp${forwardPath}`;

    console.log('jrct-proxy forwarding to:', target);

    const response = await axios.get(target, {
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'en,ja',
        // Pass through user-agent if available
        'User-Agent': req.headers['user-agent'] || 'CancerCareProxy/1.0'
      },
      timeout: 20000
    });

    // Return the upstream response body and status
    res.status(response.status).setHeader('Content-Type', 'application/json');
    if (typeof response.data === 'string') {
      res.send(response.data);
    } else {
      res.json(response.data);
    }

  } catch (error) {
    console.error('jrct-proxy error:', error.message || error);

    // If axios returned a response, forward status and data
    if (error.response) {
      res.status(error.response.status).json({
        error: error.message,
        details: error.response.data
      });
      return;
    }

    res.status(502).json({ error: 'JRCT proxy error', message: error.message });
  }
};
