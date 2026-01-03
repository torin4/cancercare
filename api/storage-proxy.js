const axios = require('axios');

// Vercel serverless function to proxy Firebase Storage downloads (bypasses CORS)
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
    const fileUrl = req.query.url;
    if (!fileUrl) {
      return res.status(400).json({ error: 'Missing file URL parameter' });
    }

    console.log('storage-proxy: Downloading file from', fileUrl);
    
    // Increase timeout for large files (up to 60 seconds for Vercel Pro, 10s for free tier)
    // For large files, we'll stream the response
    const response = await axios.get(fileUrl, {
      responseType: 'arraybuffer',
      timeout: 60000, // 60 seconds for large files
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      headers: {
        'User-Agent': req.headers['user-agent'] || 'CancerCareProxy/1.0'
      }
    });

    const contentType = response.headers['content-type'] || 'application/octet-stream';
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', response.data.length);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(Buffer.from(response.data));
  } catch (error) {
    console.error('storage-proxy error:', error.message || error);
    if (error.response) {
      res.status(error.response.status).json({ error: error.message, details: error.response.data });
      return;
    }
    res.status(502).json({ error: 'Storage proxy error', message: error.message });
  }
};

