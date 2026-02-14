const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  const PROXY_TIMEOUT_MS = Number(process.env.PROXY_TIMEOUT_MS || 180000);
  // Proxy all /api/* requests to backend server on port 4000
  // IMPORTANT: http-proxy-middleware strips the matched path prefix by default
  // So app.use('/api', ...) will strip /api and forward /jrct/search
  // But our backend expects /api/jrct/search, so we need to preserve the prefix
  // Solution: Use pathRewrite to restore /api prefix
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:4000',
      changeOrigin: true,
      logLevel: 'debug',
      timeout: PROXY_TIMEOUT_MS,
      proxyTimeout: PROXY_TIMEOUT_MS,
      secure: false, // Allow self-signed certificates if any
      ws: false, // Disable websocket proxying
      // IMPORTANT: http-proxy-middleware strips the matched path prefix
      // Request: /api/jrct/search -> After matching '/api', becomes: /jrct/search
      // Backend expects: /api/jrct/search
      // Solution: Always restore the /api prefix
      pathRewrite: function (path, req) {
        // Path is already stripped by http-proxy-middleware: /jrct/search
        // We need to restore: /api/jrct/search
        return `/api${path}`;
      },
      onError: (err, req, res) => {
        console.error('Proxy error:', err.message);
        if (!res.headersSent) {
          if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') {
            res.status(504).json({ error: 'Gateway Timeout', message: 'The request took too long. Please try again.' });
          } else {
            res.status(502).json({ error: 'Bad Gateway', message: err.message });
          }
        }
      },
      onProxyReq: (proxyReq, req, res) => {
        // Remove conditional request headers to prevent 304 responses
        // These headers cause the backend to return 304 if ETag matches
        delete proxyReq.headers['if-none-match'];
        delete proxyReq.headers['if-modified-since'];
        
        // Log the proxied request for debugging
        const targetPath = req.url.startsWith('/api') ? req.url : `/api${req.url}`;
        console.log(`[Proxy] ${req.method} ${req.url} -> http://localhost:4000${targetPath}`);
      },
      onProxyRes: (proxyRes, req, res) => {
        // Remove ETag and other cache headers from response to prevent browser caching
        delete proxyRes.headers['etag'];
        delete proxyRes.headers['last-modified'];
        
        // Force no-cache headers for all API responses
        proxyRes.headers['cache-control'] = 'no-cache, no-store, must-revalidate, max-age=0';
        proxyRes.headers['pragma'] = 'no-cache';
        proxyRes.headers['expires'] = '0';
        
        // SharedArrayBuffer support: Add required headers for zero-copy transfers
        // These headers enable SharedArrayBuffer in browsers (required for high-performance DICOM loading)
        proxyRes.headers['cross-origin-opener-policy'] = 'same-origin';
        proxyRes.headers['cross-origin-embedder-policy'] = 'require-corp';
      }
    })
  );
};
