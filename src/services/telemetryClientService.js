import { auth } from '../firebase/config';
import logger from '../utils/logger';

const TELEMETRY_ENDPOINT = '/api/telemetry';
const MAX_BATCH_SIZE = 10;
const FLUSH_INTERVAL_MS = 2500;

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
  'fallback_used'
]);

let flushTimer = null;
let queue = [];
let flushInFlight = false;

function randomHex(byteLength) {
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    const bytes = new Uint8Array(byteLength);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  let output = '';
  for (let i = 0; i < byteLength; i += 1) {
    output += Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
  }
  return output;
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

function sanitizeAttributes(attributes = {}) {
  const safe = {};
  Object.entries(attributes).forEach(([key, rawValue]) => {
    if (!SAFE_ATTRIBUTE_ALLOWLIST.has(key)) return;
    const value = sanitizeAttributeValue(rawValue);
    if (value == null) return;
    safe[key] = value;
  });
  return safe;
}

async function getAuthToken() {
  try {
    const currentUser = auth?.currentUser;
    if (!currentUser) return null;
    return await currentUser.getIdToken(false);
  } catch {
    return null;
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushTelemetryQueue();
  }, FLUSH_INTERVAL_MS);
}

async function flushTelemetryQueue() {
  if (flushInFlight || queue.length === 0) return;
  flushInFlight = true;

  const batch = queue.slice(0, MAX_BATCH_SIZE);
  queue = queue.slice(MAX_BATCH_SIZE);

  try {
    const token = await getAuthToken();
    if (!token) {
      return;
    }
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    };

    const first = batch[0] || {};
    const response = await fetch(TELEMETRY_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        events: batch.map((event) => ({
          name: event.name,
          timestamp: event.timestamp,
          attributes: event.attributes
        }))
      }),
      keepalive: true,
      ...(first.traceparent ? { headers: { ...headers, traceparent: first.traceparent } } : {})
    });

    if (!response.ok) {
      logger.warn('[telemetry] failed to send batch:', response.status);
    }
  } catch (error) {
    logger.warn('[telemetry] batch send error:', error.message);
  } finally {
    flushInFlight = false;
    if (queue.length > 0) {
      scheduleFlush();
    }
  }
}

function enqueueTelemetryEvent(event) {
  queue.push(event);
  if (queue.length >= MAX_BATCH_SIZE) {
    flushTelemetryQueue();
  } else {
    scheduleFlush();
  }
}

export function createTraceContext(route = 'unknown') {
  const traceId = randomHex(16);
  const spanId = randomHex(8);
  const requestId = `iris_${Date.now().toString(36)}_${randomHex(4)}`;
  return {
    route,
    requestId,
    traceId,
    spanId,
    traceparent: `00-${traceId}-${spanId}-01`
  };
}

export function latencyBucket(latencyMs) {
  if (!Number.isFinite(latencyMs) || latencyMs < 0) return 'unknown';
  if (latencyMs < 500) return 'lt_500ms';
  if (latencyMs < 1000) return '500ms_1s';
  if (latencyMs < 2000) return '1s_2s';
  if (latencyMs < 4000) return '2s_4s';
  return 'gte_4s';
}

export function confidenceBucket(confidence) {
  if (!Number.isFinite(confidence)) return 'unknown';
  if (confidence >= 0.85) return 'high';
  if (confidence >= 0.65) return 'medium';
  return 'low';
}

export function trackProductEvent(name, attributes = {}, options = {}) {
  if (!name || typeof name !== 'string') return;

  const context = options.traceContext || null;
  const safeAttributes = sanitizeAttributes({
    ...attributes,
    ...(context?.requestId ? { request_id: context.requestId } : {}),
    ...(context?.traceId ? { trace_id: context.traceId } : {}),
    ...(context?.route ? { route: context.route } : {})
  });

  enqueueTelemetryEvent({
    name,
    timestamp: new Date().toISOString(),
    attributes: safeAttributes,
    traceparent: context?.traceparent || null
  });

  if (options.flushNow) {
    flushTelemetryQueue();
  }
}

export function trackTrendAlertsRendered(alerts = [], attributes = {}) {
  const list = Array.isArray(alerts) ? alerts : [];

  trackProductEvent('trend_notifications_rendered', {
    alert_count: list.length,
    high_priority_count: list.filter((alert) => alert.severity === 'high').length,
    concerning_count: list.filter((alert) => alert.signalType === 'concerning').length,
    improving_count: list.filter((alert) => alert.signalType === 'improving').length,
    source: 'dashboard',
    ...attributes
  });

  list.slice(0, 8).forEach((alert) => {
    trackProductEvent('trend_notification_item', {
      source: 'dashboard',
      metric_type: alert.telemetry?.metric_type || alert.metricType,
      metric_key: alert.telemetry?.metric_key || alert.metricKey,
      trend_direction: alert.telemetry?.trend_direction || alert.direction,
      severity: alert.telemetry?.severity || alert.severity,
      signal_type: alert.telemetry?.signal_type || alert.signalType,
      confidence_bucket: alert.telemetry?.confidence_bucket || confidenceBucket(alert.confidence),
      data_points_used: alert.telemetry?.data_points_used || alert.dataPointCount,
      days_between_points: alert.telemetry?.days_between_points || null
    });
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (queue.length > 0) {
      flushTelemetryQueue();
    }
  });
}
