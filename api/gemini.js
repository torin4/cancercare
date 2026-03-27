const { GoogleGenerativeAI } = require('@google/generative-ai');
const { setCors, getBearerToken, verifyFirebaseIdToken } = require('./lib/auth');
const {
  createServerTelemetryContext,
  emitTelemetryEvent,
  latencyBucket,
  classifyError,
  hashUserId
} = require('./lib/telemetry');

const DEFAULT_MODEL = 'gemini-3.1-pro-preview';

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

module.exports = async (req, res) => {
  setCors(req, res);
  const telemetryContext = createServerTelemetryContext(req, { route: 'legacy-gemini' });
  res.setHeader('traceparent', telemetryContext.traceparent);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    emitTelemetryEvent('chat_request_rejected', {
      route: 'legacy-gemini',
      status: 'error',
      reason: 'method_not_allowed',
      http_status: 405
    }, telemetryContext);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const idToken = getBearerToken(req);
  if (!idToken) {
    emitTelemetryEvent('chat_request_rejected', {
      route: 'legacy-gemini',
      status: 'error',
      reason: 'missing_token',
      http_status: 401
    }, telemetryContext);
    return res.status(401).json({ error: 'Missing bearer token' });
  }

  let uidForHash = null;
  try {
    const user = await verifyFirebaseIdToken(idToken);
    uidForHash = user?.localId || null;
  } catch (error) {
    emitTelemetryEvent('chat_request_rejected', {
      route: 'legacy-gemini',
      status: 'error',
      reason: 'invalid_token',
      error_class: classifyError(error),
      http_status: 401
    }, telemetryContext);
    return res.status(401).json({ error: 'Unauthorized request' });
  }

  const startedAt = Date.now();

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const modelName = body.model || DEFAULT_MODEL;
    let content = body.content;
    const userHash = hashUserId(uidForHash);

    emitTelemetryEvent('chat_message_sent', {
      route: 'legacy-gemini',
      status: 'started',
      feature_flag: process.env.IRIS_TOOL_CHAT_ENABLED === 'true' ? 'enabled' : 'unknown',
      source: 'api_gemini',
      user_hash: userHash
    }, telemetryContext);

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
    const latencyMs = Date.now() - startedAt;

    emitTelemetryEvent('chat_response_received', {
      route: 'legacy-gemini',
      status: 'ok',
      latency_ms: latencyMs,
      latency_bucket: latencyBucket(latencyMs),
      fallback_used: false,
      user_hash: userHash
    }, telemetryContext);

    return res.status(200).json({
      response: text,
      traceId: telemetryContext.traceId,
      requestId: telemetryContext.requestId
    });
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    emitTelemetryEvent('chat_response_received', {
      route: 'legacy-gemini',
      status: 'error',
      error_class: classifyError(error),
      latency_ms: latencyMs,
      latency_bucket: latencyBucket(latencyMs),
      fallback_used: false
    }, telemetryContext);
    return res.status(500).json({
      error: 'Failed to process message',
      details: error.message
    });
  }
};
