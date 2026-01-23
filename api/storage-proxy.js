const axios = require('axios');

// Vercel serverless function to proxy Firebase Storage downloads (bypasses CORS)
// SECURITY: Enhanced with URL validation and security headers
module.exports = async (req, res) => {
  // Security: Restrict CORS to known origins in production
  const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['*']; // Allow all in development
  
  const origin = req.headers.origin;
  const corsOrigin = allowedOrigins.includes('*') || (origin && allowedOrigins.includes(origin))
    ? (origin || '*')
    : 'null';
  
  // Set CORS headers - must match what the Express server sets
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '3600');
  
  // SharedArrayBuffer support: Add required headers for zero-copy transfers
  // These headers enable SharedArrayBuffer in browsers (required for high-performance DICOM loading)
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
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

    // SECURITY: Validate that URL is from Firebase Storage
    // Firebase Storage URLs contain 'firebasestorage.googleapis.com' or 'storage.googleapis.com'
    const isValidFirebaseUrl = fileUrl.includes('firebasestorage.googleapis.com') || 
                                fileUrl.includes('storage.googleapis.com');
    
    if (!isValidFirebaseUrl) {
      return res.status(403).json({ error: 'Invalid storage URL. Only Firebase Storage URLs are allowed.' });
    }
    
    // SECURITY: Validate URL format to prevent SSRF attacks
    try {
      const urlObj = new URL(fileUrl);
      if (!['https:'].includes(urlObj.protocol)) {
        return res.status(403).json({ error: 'Only HTTPS URLs are allowed' });
      }
    } catch (urlError) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Increase timeout for large files (up to 120 seconds)
    // For large files, we'll stream the response
    const response = await axios.get(fileUrl, {
      responseType: 'arraybuffer',
      timeout: 120000, // 120 seconds for large files (Vercel Pro allows up to 60s, but we set higher for local dev)
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      maxRedirects: 3, // Limit redirects to prevent redirect attacks
      validateStatus: (status) => status >= 200 && status < 400,
      headers: {
        'User-Agent': req.headers['user-agent'] || 'CancerCareProxy/1.0'
      }
    });

    const contentType = response.headers['content-type'] || 'application/octet-stream';
    
    // SECURITY: Validate content type (only allow medical document types)
    const allowedContentTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/csv',
      'application/dicom',
      'application/x-dicom',
      'application/zip',
      'application/x-zip-compressed'
    ];
    
    const isAllowedContentType = allowedContentTypes.some(type => 
      contentType.toLowerCase().includes(type.toLowerCase())
    );
    
    if (!isAllowedContentType) {
      return res.status(403).json({ error: 'Content type not allowed' });
    }
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', response.data.length);
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.send(Buffer.from(response.data));
  } catch (error) {
    // Handle timeout errors specifically
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return res.status(504).json({ 
        error: 'Gateway Timeout', 
        message: 'The file download timed out. The file may be too large or the connection is slow. Try again or contact support if the issue persists.' 
      });
    }
    
    if (error.response) {
      res.status(error.response.status).json({ error: error.message, details: error.response.data });
      return;
    }
    res.status(502).json({ error: 'Storage proxy error', message: error.message });
  }
};

