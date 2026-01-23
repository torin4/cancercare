const express = require('express');
const axios = require('axios');
const morgan = require('morgan');
const { URL } = require('url');

const app = express();
const PORT = process.env.PORT || 4000;

// Disable Express ETag generation - we don't want caching
app.set('etag', false);

// CORS middleware - handle preflight requests
app.use((req, res, next) => {
  const origin = req.headers.origin;
  // Allow all origins in development, restrict in production
  res.setHeader('Access-Control-Allow-Origin', origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '3600');
  
  // SharedArrayBuffer support: Add required headers for zero-copy transfers
  // These headers enable SharedArrayBuffer in browsers (required for high-performance DICOM loading)
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Note: Server timeout will be set after app.listen() is called

// Import and use the serverless functions
const trialsProxy = require('../api/trials-proxy');
const storageProxy = require('../api/storage-proxy');
const jrctSearch = require('../api/jrct/search');
const jrctDetail = require('../api/jrct/detail');

// Handle JRCT search endpoint
app.all('/api/jrct/search', async (req, res) => {
  // Disable caching for search results - always get fresh data
  // Remove any conditional request headers to force fresh request
  delete req.headers['if-none-match'];
  delete req.headers['if-modified-since'];
  
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  // Don't set ETag - prevent conditional requests
  
  // Convert Express request to serverless function format
  const protocol = req.protocol || 'http';
  const host = req.get('host') || 'localhost:4000';
  const fullUrl = `${protocol}://${host}${req.originalUrl || req.url}`;
  
  const serverlessReq = {
    method: req.method,
    url: fullUrl,
    query: req.query,
    headers: req.headers,
    body: req.body
  };
  
  // Create a mock response object that properly handles the serverless function format
  let responseSent = false;
  const serverlessRes = {
    statusCode: 200,
    headers: {},
    setHeader: (key, value) => {
      res.setHeader(key, value);
    },
    status: (code) => {
      serverlessRes.statusCode = code;
      return serverlessRes;
    },
    json: (data) => {
      if (!responseSent) {
        responseSent = true;
        res.status(serverlessRes.statusCode).json(data);
      }
    },
    send: (data) => {
      if (!responseSent) {
        responseSent = true;
        res.status(serverlessRes.statusCode).send(data);
      }
    },
    end: () => {
      if (!responseSent) {
        responseSent = true;
        res.status(serverlessRes.statusCode).end();
      }
    }
  };
  
  try {
    await jrctSearch(serverlessReq, serverlessRes);
    // If no response was sent, send a default response
    if (!responseSent) {
      res.status(500).json({ error: 'No response from JRCT search function' });
    }
  } catch (error) {
    if (!responseSent) {
      res.status(500).json({ error: 'Internal server error', message: error.message });
    }
  }
});

// Handle JRCT detail endpoint
app.all('/api/jrct/detail', async (req, res) => {
  // Convert Express request to serverless function format
  const protocol = req.protocol || 'http';
  const host = req.get('host') || 'localhost:4000';
  const fullUrl = `${protocol}://${host}${req.originalUrl || req.url}`;
  
  const serverlessReq = {
    method: req.method,
    url: fullUrl,
    query: req.query,
    headers: req.headers,
    body: req.body
  };
  
  // Create a mock response object that properly handles the serverless function format
  let responseSent = false;
  const serverlessRes = {
    statusCode: 200,
    headers: {},
    setHeader: (key, value) => {
      res.setHeader(key, value);
    },
    status: (code) => {
      serverlessRes.statusCode = code;
      return serverlessRes;
    },
    json: (data) => {
      if (!responseSent) {
        responseSent = true;
        res.status(serverlessRes.statusCode).json(data);
      }
    },
    send: (data) => {
      if (!responseSent) {
        responseSent = true;
        res.status(serverlessRes.statusCode).send(data);
      }
    },
    end: () => {
      if (!responseSent) {
        responseSent = true;
        res.status(serverlessRes.statusCode).end();
      }
    }
  };
  
  try {
    await jrctDetail(serverlessReq, serverlessRes);
    // If no response was sent, send a default response
    if (!responseSent) {
      res.status(500).json({ error: 'No response from JRCT detail function' });
    }
  } catch (error) {
    if (!responseSent) {
      res.status(500).json({ error: 'Internal server error', message: error.message });
    }
  }
});

// Handle storage-proxy endpoint
app.all('/api/storage-proxy', async (req, res) => {
  // Convert Express request to serverless function format
  const protocol = req.protocol || 'http';
  const host = req.get('host') || 'localhost:4000';
  const fullUrl = `${protocol}://${host}${req.originalUrl || req.url}`;
  
  const serverlessReq = {
    method: req.method,
    url: fullUrl,
    query: req.query,
    headers: req.headers,
    body: req.body
  };
  
  // Create a mock response object that properly handles the serverless function format
  let responseSent = false;
  const serverlessRes = {
    statusCode: 200,
    headers: {},
    setHeader: (key, value) => {
      res.setHeader(key, value);
    },
    status: (code) => {
      serverlessRes.statusCode = code;
      return serverlessRes;
    },
    json: (data) => {
      if (!responseSent) {
        responseSent = true;
        res.status(serverlessRes.statusCode).json(data);
      }
    },
    send: (data) => {
      if (!responseSent) {
        responseSent = true;
        res.status(serverlessRes.statusCode).send(data);
      }
    },
    end: () => {
      if (!responseSent) {
        responseSent = true;
        res.status(serverlessRes.statusCode).end();
      }
    }
  };
  
  try {
    await storageProxy(serverlessReq, serverlessRes);
    // If no response was sent, send a default response
    if (!responseSent) {
      res.status(500).json({ error: 'No response from storage-proxy function' });
    }
  } catch (error) {
    if (!responseSent) {
      res.status(500).json({ error: 'Internal server error', message: error.message });
    }
  }
});

// Handle trials-proxy endpoint
app.all('/api/trials-proxy', async (req, res) => {
  // Convert Express request to serverless function format
  // The serverless function expects req.url to be a full URL string
  const protocol = req.protocol || 'http';
  const host = req.get('host') || 'localhost:4000';
  const fullUrl = `${protocol}://${host}${req.originalUrl || req.url}`;
  
  const serverlessReq = {
    method: req.method,
    url: fullUrl,
    headers: req.headers,
    body: req.body
  };
  
  // Create a mock response object that properly handles the serverless function format
  let responseSent = false;
  const serverlessRes = {
    statusCode: 200,
    headers: {},
    setHeader: (key, value) => {
      res.setHeader(key, value);
    },
    status: (code) => {
      serverlessRes.statusCode = code;
      return serverlessRes;
    },
    json: (data) => {
      if (!responseSent) {
        responseSent = true;
        res.status(serverlessRes.statusCode).json(data);
      }
    },
    end: () => {
      if (!responseSent) {
        responseSent = true;
        res.status(serverlessRes.statusCode).end();
      }
    }
  };
  
  try {
    await trialsProxy(serverlessReq, serverlessRes);
    // If no response was sent, send a default response
    if (!responseSent) {
      res.status(500).json({ error: 'No response from trials-proxy function' });
    }
  } catch (error) {
    if (!responseSent) {
      res.status(500).json({ error: 'Internal server error', message: error.message });
    }
  }
});

// Root route handler
app.get('/', (req, res) => {
  res.json({ 
    message: 'Proxy server is running',
    endpoints: {
      jrctSearch: '/api/jrct/search?q=<query>&page=<page>',
      jrctDetail: '/api/jrct/detail?id=<trialId>&q=<query>&page=<page>',
      trials: '/api/trials-proxy',
      storage: '/api/storage-proxy'
    }
  });
});

const server = app.listen(PORT, () => {
  console.log(`Proxy server is running on port ${PORT}`);
  console.log(`Endpoints available:`);
  console.log(`  - JRCT Search: http://localhost:${PORT}/api/jrct/search?q=<query>&page=<page>`);
  console.log(`  - JRCT Detail: http://localhost:${PORT}/api/jrct/detail?id=<trialId>&q=<query>&page=<page>`);
  console.log(`  - Trials Proxy: http://localhost:${PORT}/api/trials-proxy`);
  console.log(`  - Storage Proxy: http://localhost:${PORT}/api/storage-proxy`);
});

// Increase server timeout for long-running requests (JRCT searches can take 11-13 seconds)
server.timeout = 60000; // 60 seconds
server.keepAliveTimeout = 65000; // Keep-alive timeout slightly longer than server timeout
