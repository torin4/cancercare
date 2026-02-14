const axios = require('axios');

function setCors(req, res) {
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
    : ['*'];
  const origin = req.headers.origin;
  const isAllowed = allowedOrigins.includes('*') || (origin && allowedOrigins.includes(origin));
  const corsOrigin = isAllowed ? (origin || '*') : 'null';

  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

function getBearerToken(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  return token || null;
}

async function verifyFirebaseIdToken(idToken) {
  const firebaseApiKey = process.env.FIREBASE_API_KEY || process.env.REACT_APP_FIREBASE_API_KEY;
  if (!firebaseApiKey) {
    throw new Error('Firebase API key is not configured on server');
  }

  const response = await axios.post(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseApiKey}`,
    { idToken },
    { timeout: 10000 }
  );

  const users = response?.data?.users;
  if (!Array.isArray(users) || users.length === 0 || !users[0].localId) {
    throw new Error('Invalid authentication token');
  }

  return users[0];
}

module.exports = { setCors, getBearerToken, verifyFirebaseIdToken };
