const express = require('express');
const axios = require('axios');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 4000;
const JRCT_HOST = 'https://jrct.niph.go.jp';

app.use(morgan('dev'));

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

app.listen(PORT, () => {
  console.log(`JRCT proxy listening on http://localhost:${PORT}`);
});
