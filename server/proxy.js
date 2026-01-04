const express = require('express');
const axios = require('axios');
const morgan = require('morgan');
const { URL } = require('url');

const app = express();
const PORT = process.env.PORT || 4000;
const JRCT_HOST = 'https://jrct.niph.go.jp';

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Import and use the trials-proxy serverless function
const trialsProxy = require('../api/trials-proxy');

app.get('/api/jrct-proxy/*', async (req, res) => {
  try {
    const forwardPath = req.originalUrl.replace(/^\/api\/jrct-proxy/, '');
    const target = `${JRCT_HOST}${forwardPath}`;
    console.log('proxy forwarding to', target);

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
    console.error('proxy error', error.message || error);
    if (error.response) {
      res.status(error.response.status).json({ error: error.message, details: error.response.data });
      return;
    }
    res.status(502).json({ error: 'JRCT proxy error', message: error.message });
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
    console.error('trials-proxy error:', error);
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
      jrct: '/api/jrct-proxy/*',
      trials: '/api/trials-proxy'
    }
  });
});

app.listen(PORT, () => {
  console.log(`Proxy server listening on http://localhost:${PORT}`);
  console.log(`  - JRCT proxy: http://localhost:${PORT}/api/jrct-proxy/*`);
  console.log(`  - Trials proxy: http://localhost:${PORT}/api/trials-proxy`);
});
