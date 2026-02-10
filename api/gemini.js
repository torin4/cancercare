const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const DEFAULT_MODEL = 'gemini-3-flash-preview';

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

function buildLegacyContext(message, conversationHistory) {
  return `You are CancerCare's AI health assistant. You're helping track Mary's health. Mary has Stage IIIC ovarian cancer and is undergoing treatment.

Your role:
- Help track her labs, vitals, medications, and symptoms
- Extract values from natural language (e.g., "BP was 130/85" -> log blood pressure)
- Provide supportive, medical insights
- Flag concerning trends (elevated CA-125, high BP, fever, etc.)
- Be conversational and empathetic

Current conversation:
${conversationHistory ? conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n') : ''}

User message: ${message}`;
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

module.exports = async (req, res) => {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const idToken = getBearerToken(req);
  if (!idToken) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }

  try {
    await verifyFirebaseIdToken(idToken);
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized request' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const modelName = body.model || DEFAULT_MODEL;
    let content = body.content;

    // Backward compatibility with legacy shape
    if (!content) {
      const { message, conversationHistory } = body;
      if (!message) {
        return res.status(400).json({ error: 'Missing required content or message' });
      }
      content = buildLegacyContext(message, conversationHistory);
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent(content);
    const response = await result.response;
    const text = response.text();

    return res.status(200).json({ response: text });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to process message',
      details: error.message
    });
  }
};
