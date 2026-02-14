const { setCors, getBearerToken, verifyFirebaseIdToken } = require('./lib/auth');
const {
  createServerTelemetryContext,
  emitTelemetryEvent,
  classifyError,
  hashUserId,
  sanitizeTelemetryAttributes
} = require('./lib/telemetry');

const MAX_EVENTS_PER_REQUEST = 25;

module.exports = async (req, res) => {
  setCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const telemetryContext = createServerTelemetryContext(req, { route: 'frontend' });
  res.setHeader('traceparent', telemetryContext.traceparent);

  const idToken = getBearerToken(req);
  if (!idToken) {
    emitTelemetryEvent('telemetry_ingest_rejected', {
      status: 'error',
      reason: 'missing_token',
      http_status: 401,
      route: 'frontend'
    }, telemetryContext);
    return res.status(401).json({ error: 'Missing bearer token' });
  }

  let user;
  try {
    user = await verifyFirebaseIdToken(idToken);
  } catch (error) {
    emitTelemetryEvent('telemetry_ingest_rejected', {
      status: 'error',
      reason: 'invalid_token',
      error_class: classifyError(error),
      http_status: 401,
      route: 'frontend'
    }, telemetryContext);
    return res.status(401).json({ error: 'Unauthorized request' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const inputEvents = Array.isArray(body.events)
    ? body.events
    : (body.name || body.eventName ? [body] : []);

  if (inputEvents.length === 0) {
    return res.status(400).json({ error: 'No telemetry events provided' });
  }

  const userHash = hashUserId(user.localId || user.uid || null);
  const acceptedEvents = inputEvents.slice(0, MAX_EVENTS_PER_REQUEST);

  await Promise.all(
    acceptedEvents.map((event) => {
      const eventName = String(event?.name || event?.eventName || 'frontend_event').slice(0, 64);
      const attrs = sanitizeTelemetryAttributes({
        ...(event?.attributes || {}),
        ...(userHash ? { user_hash: userHash } : {}),
        source: 'frontend'
      });
      return emitTelemetryEvent(eventName, attrs, telemetryContext);
    })
  );

  return res.status(200).json({
    ok: true,
    accepted: acceptedEvents.length,
    requestId: telemetryContext.requestId,
    traceId: telemetryContext.traceId
  });
};
