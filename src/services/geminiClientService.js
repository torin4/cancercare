import { GoogleGenerativeAI } from '@google/generative-ai';
import { auth } from '../firebase/config';
import logger from '../utils/logger';

const BROWSER_API_KEY = process.env.REACT_APP_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
const PROXY_PATH = '/api/gemini';
const PROXY_SIZE_LIMIT_BYTES = 3 * 1024 * 1024; // Keep below common serverless payload limits

let browserGenAI = null;

function estimatePayloadSize(payload) {
  try {
    return new TextEncoder().encode(JSON.stringify(payload)).length;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

async function getAuthToken() {
  try {
    const currentUser = auth?.currentUser;
    if (!currentUser) return null;
    return await currentUser.getIdToken();
  } catch {
    return null;
  }
}

async function callGeminiProxy({ model, content, abortSignal }) {
  const token = await getAuthToken();
  const response = await fetch(PROXY_PATH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ model, content }),
    signal: abortSignal
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message = payload?.error || payload?.details || payload?.message || `Gemini proxy request failed (${response.status})`;
    throw new Error(message);
  }

  if (!payload || typeof payload.response !== 'string') {
    throw new Error('Gemini proxy returned an invalid response payload');
  }

  return payload.response;
}

async function callGeminiBrowser({ model, content }) {
  if (!BROWSER_API_KEY) {
    throw new Error('Gemini API key is not configured for browser fallback');
  }
  if (!browserGenAI) {
    browserGenAI = new GoogleGenerativeAI(BROWSER_API_KEY);
  }

  const browserModel = browserGenAI.getGenerativeModel({ model });
  const result = await browserModel.generateContent(content);
  const response = await result.response;
  return response.text();
}

/**
 * Generate text from Gemini with server proxy first and browser fallback.
 * Proxy path is preferred for security. Fallback preserves compatibility.
 */
export async function generateGeminiText({ model, content, abortSignal = null }) {
  const payload = { model, content };
  const payloadSize = estimatePayloadSize(payload);
  const canUseProxy = payloadSize <= PROXY_SIZE_LIMIT_BYTES;

  if (canUseProxy) {
    try {
      return await callGeminiProxy({ model, content, abortSignal });
    } catch (error) {
      logger.warn('[Gemini] Proxy request failed, falling back to browser SDK:', error.message);
    }
  } else {
    logger.warn('[Gemini] Payload exceeds proxy size limit; using browser SDK fallback');
  }

  return await callGeminiBrowser({ model, content });
}

