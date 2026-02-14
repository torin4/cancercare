const axios = require('axios');
const crypto = require('crypto');

const SAFE_ATTRIBUTE_ALLOWLIST = new Set([
  'request_id',
  'trace_id',
  'route',
  'feature_flag',
  'status',
  'reason',
  'error_class',
  'error_code',
  'http_status',
  'latency_ms',
  'latency_bucket',
  'tool_call_count',
  'tools_used_count',
  'tool_name',
  'tool_status',
  'tool_iteration',
  'alert_count',
  'high_priority_count',
  'concerning_count',
  'improving_count',
  'has_favorites',
  'source',
  'metric_type',
  'metric_key',
  'trend_direction',
  'severity',
  'signal_type',
  'confidence_bucket',
  'data_points_used',
  'days_between_points',
  'fallback_used',
  'user_hash',
  'path',
  'method'
]);

function randomHex(byteLength) {
  return crypto.randomBytes(byteLength).toString('hex');
}

function sanitizeAttributeValue(value) {
  if (value == null) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return Number(value.toFixed(3));
  }
  const text = String(value).trim();
  if (!text) return null;
  return text.slice(0, 120);
}

function sanitizeTelemetryAttributes(attributes = {}) {
  const safe = {};
  Object.entries(attributes).forEach(([key, rawValue]) => {
    if (!SAFE_ATTRIBUTE_ALLOWLIST.has(key)) return;
    const value = sanitizeAttributeValue(rawValue);
    if (value == null) return;
    safe[key] = value;
  });
  return safe;
}

function parseTraceparent(traceparent) {
  if (typeof traceparent !== 'string') return null;
  const match = traceparent.trim().match(/^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/i);
  if (!match) return null;
  return {
    traceId: match[1].toLowerCase(),
    parentSpanId: match[2].toLowerCase(),
    traceFlags: match[3].toLowerCase()
  };
}

function createServerTelemetryContext(req, options = {}) {
  const incoming = parseTraceparent(req?.headers?.traceparent);
  const traceId = incoming?.traceId || randomHex(16);
  const spanId = randomHex(8);
  const requestIdHeader = req?.headers?.['x-iris-request-id'];
  const requestId = typeof requestIdHeader === 'string' && requestIdHeader.trim()
    ? requestIdHeader.trim().slice(0, 64)
    : (options.requestId || `iris_${Date.now().toString(36)}_${randomHex(4)}`);

  return {
    requestId,
    traceId,
    spanId,
    parentSpanId: incoming?.parentSpanId || null,
    traceFlags: incoming?.traceFlags || '01',
    route: options.route || null,
    traceparent: `00-${traceId}-${spanId}-${incoming?.traceFlags || '01'}`
  };
}

function latencyBucket(latencyMs) {
  if (!Number.isFinite(latencyMs) || latencyMs < 0) return 'unknown';
  if (latencyMs < 500) return 'lt_500ms';
  if (latencyMs < 1000) return '500ms_1s';
  if (latencyMs < 2000) return '1s_2s';
  if (latencyMs < 4000) return '2s_4s';
  return 'gte_4s';
}

function classifyError(error) {
  const message = String(error?.message || '').toLowerCase();
  if (!message) return 'unknown';
  if (message.includes('timeout') || message.includes('timed out')) return 'timeout';
  if (message.includes('unauthorized') || message.includes('token')) return 'auth';
  if (message.includes('tool')) return 'tool';
  if (message.includes('gemini') || message.includes('model')) return 'model';
  if (message.includes('network') || message.includes('fetch')) return 'network';
  return 'runtime';
}

function hashUserId(uid) {
  if (!uid) return null;
  const salt = process.env.TELEMETRY_USER_HASH_SALT || 'iris-default-salt';
  return crypto
    .createHash('sha256')
    .update(`${salt}:${uid}`)
    .digest('hex')
    .slice(0, 32);
}

async function postToTelemetryEndpoint(eventPayload) {
  const endpoint = process.env.OTLP_EVENTS_ENDPOINT;
  if (!endpoint) return;

  const authHeader = process.env.OTLP_EVENTS_AUTH_HEADER || '';
  const headers = { 'Content-Type': 'application/json' };
  if (authHeader) {
    const splitIndex = authHeader.indexOf(':');
    if (splitIndex > 0) {
      const key = authHeader.slice(0, splitIndex).trim();
      const value = authHeader.slice(splitIndex + 1).trim();
      if (key && value) headers[key] = value;
    }
  }

  await axios.post(endpoint, eventPayload, {
    headers,
    timeout: Number(process.env.OTLP_EVENTS_TIMEOUT_MS || 2500)
  });
}

async function emitTelemetryEvent(name, attributes = {}, context = {}) {
  const eventName = String(name || '').trim();
  if (!eventName) return;

  const payload = {
    name: eventName,
    timestamp: new Date().toISOString(),
    requestId: context.requestId || null,
    traceId: context.traceId || null,
    spanId: context.spanId || null,
    attributes: sanitizeTelemetryAttributes({
      ...attributes,
      ...(context.requestId ? { request_id: context.requestId } : {}),
      ...(context.traceId ? { trace_id: context.traceId } : {}),
      ...(context.route ? { route: context.route } : {})
    })
  };

  const shouldLog = process.env.TELEMETRY_LOG_EVENTS === 'true' || process.env.NODE_ENV !== 'production';
  if (shouldLog) {
    // Keep logs structured and PHI-safe.
    console.log('[telemetry]', JSON.stringify(payload));
  }

  try {
    await postToTelemetryEndpoint(payload);
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[telemetry] export failed:', error.message);
    }
  }
}

module.exports = {
  SAFE_ATTRIBUTE_ALLOWLIST,
  sanitizeTelemetryAttributes,
  createServerTelemetryContext,
  emitTelemetryEvent,
  latencyBucket,
  classifyError,
  hashUserId
};
