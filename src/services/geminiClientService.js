import { GoogleGenerativeAI } from '@google/generative-ai';
import { auth } from '../firebase/config';
import logger from '../utils/logger';
import { createTraceContext, latencyBucket, trackProductEvent } from './telemetryClientService';

const BROWSER_API_KEY = process.env.REACT_APP_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';
const PROXY_PATH = '/api/gemini';
const PROXY_SIZE_LIMIT_BYTES = 3 * 1024 * 1024; // Keep below common serverless payload limits
const MAX_TOOL_CHAT_MESSAGE_CHARS = 4000;
const MAX_TOOL_CHAT_HISTORY_ITEMS = 6;
const MAX_TOOL_CHAT_HISTORY_CHARS = 1200;

let browserGenAI = null;

function truncateText(value, maxChars) {
  const text = typeof value === 'string' ? value : String(value ?? '');
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}...`;
}

function sanitizeConversationHistory(history) {
  if (!Array.isArray(history)) return [];

  return history
    .slice(-MAX_TOOL_CHAT_HISTORY_ITEMS)
    .map((item) => {
      const role = item?.role === 'assistant' || item?.role === 'model' ? 'assistant' : 'user';
      const content = truncateText(item?.content || item?.text || '', MAX_TOOL_CHAT_HISTORY_CHARS);
      return { role, content };
    })
    .filter((item) => item.content && item.content.trim().length > 0);
}

function sanitizePatientProfile(profile) {
  if (!profile || typeof profile !== 'object') return null;
  const allowed = [
    'age',
    'gender',
    'weight',
    'weightUnit',
    'diagnosis',
    'cancerType',
    'stage',
    'responseComplexity',
    'isPatient',
    'caregiverName'
  ];

  const sanitized = {};
  allowed.forEach((key) => {
    if (profile[key] !== undefined && profile[key] !== null && profile[key] !== '') {
      sanitized[key] = profile[key];
    }
  });

  return Object.keys(sanitized).length > 0 ? sanitized : null;
}

function sanitizeTrialContext(trialContext) {
  if (!trialContext || typeof trialContext !== 'object') return null;
  const sanitized = {};

  const copyString = (sourceKey, targetKey = sourceKey, maxChars = 240) => {
    const value = trialContext[sourceKey];
    if (typeof value === 'string' && value.trim()) {
      sanitized[targetKey] = truncateText(value.trim(), maxChars);
    }
  };

  copyString('id', 'id', 120);
  copyString('title', 'title', 300);
  copyString('phase', 'phase', 80);
  copyString('status', 'status', 80);
  copyString('nctId', 'nctId', 80);
  copyString('source', 'source', 80);

  if (typeof trialContext._isSearchResults === 'boolean') {
    sanitized._isSearchResults = trialContext._isSearchResults;
  }
  if (Number.isFinite(trialContext._searchResultsCount)) {
    sanitized._searchResultsCount = trialContext._searchResultsCount;
  }

  return Object.keys(sanitized).length > 0 ? sanitized : null;
}

function summarizeNotebookContext(notebookContext) {
  if (!notebookContext || typeof notebookContext !== 'object') return null;
  if (!Array.isArray(notebookContext.entries)) return null;

  const entries = notebookContext.entries;
  if (entries.length === 0) return null;

  const dates = entries
    .map((entry) => {
      if (!entry?.date) return null;
      const d = new Date(entry.date);
      if (isNaN(d.getTime())) return null;
      return d.toISOString().slice(0, 10);
    })
    .filter(Boolean)
    .sort();

  return {
    entryCount: entries.length,
    startDate: dates[0] || null,
    endDate: dates[dates.length - 1] || null
  };
}

function estimatePayloadSize(payload) {
  try {
    return new TextEncoder().encode(JSON.stringify(payload)).length;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

async function getAuthToken(forceRefresh = false) {
  try {
    const currentUser = auth?.currentUser;
    if (!currentUser) return null;
    return await currentUser.getIdToken(forceRefresh);
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

/**
 * Call the tool-backed chat endpoint for health data read/analysis queries.
 * Returns the full compatibility envelope { response, extractedData, insight, insights, source }.
 */
export async function callToolChat({ message, conversationHistory, patientProfile, trialContext, notebookContext, abortSignal }) {
  const traceContext = createTraceContext('tool-read');
  const startedAt = Date.now();
  const featureFlag = process.env.REACT_APP_IRIS_TOOL_CHAT_ENABLED === 'true' ? 'enabled' : 'unknown';

  const requestPayload = {
    message: truncateText(message || '', MAX_TOOL_CHAT_MESSAGE_CHARS),
    conversationHistory: sanitizeConversationHistory(conversationHistory),
    patientProfile: sanitizePatientProfile(patientProfile),
    trialContext: sanitizeTrialContext(trialContext),
    notebookContext: summarizeNotebookContext(notebookContext)
  };

  trackProductEvent('chat_message_sent', {
    route: 'tool-read',
    feature_flag: featureFlag,
    status: 'started',
    source: 'gemini_client'
  }, { traceContext });

  const requestWithToken = async (token) => fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      traceparent: traceContext.traceparent,
      'x-iris-request-id': traceContext.requestId
    },
    body: JSON.stringify(requestPayload),
    signal: abortSignal
  });

  let token = await getAuthToken(false);
  let response = await requestWithToken(token);

  // Token may be stale; refresh once and retry before failing.
  if (response.status === 401) {
    const refreshedToken = await getAuthToken(true);
    if (refreshedToken && refreshedToken !== token) {
      token = refreshedToken;
      response = await requestWithToken(token);
    } else if (refreshedToken) {
      response = await requestWithToken(refreshedToken);
    }
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const details = payload?.message || payload?.details || payload?.error;
    const latencyMs = Date.now() - startedAt;
    trackProductEvent('chat_error_shown', {
      route: 'tool-read',
      feature_flag: featureFlag,
      status: 'error',
      http_status: response.status,
      latency_ms: latencyMs,
      latency_bucket: latencyBucket(latencyMs),
      error_class: response.status === 401 ? 'auth' : 'network'
    }, { traceContext, flushNow: true });
    throw new Error(details ? `Tool chat request failed (${response.status}): ${details}` : `Tool chat request failed (${response.status})`);
  }

  if (!payload || typeof payload.response !== 'string') {
    trackProductEvent('chat_error_shown', {
      route: 'tool-read',
      feature_flag: featureFlag,
      status: 'error',
      error_class: 'invalid_payload'
    }, { traceContext, flushNow: true });
    throw new Error('Tool chat returned an invalid response payload');
  }

  const latencyMs = Date.now() - startedAt;
  trackProductEvent('chat_response_received', {
    route: 'tool-read',
    feature_flag: featureFlag,
    status: 'ok',
    latency_ms: latencyMs,
    latency_bucket: latencyBucket(latencyMs),
    tool_call_count: payload.toolCallCount || 0,
    tools_used_count: Array.isArray(payload.toolsUsed) ? payload.toolsUsed.length : 0,
    fallback_used: false
  }, { traceContext, flushNow: true });

  return payload;
}
