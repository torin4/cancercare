const { GoogleGenerativeAI } = require('@google/generative-ai');
const { setCors, getBearerToken, verifyFirebaseIdToken } = require('./lib/auth');
const { TOOL_DECLARATIONS, TOOL_ALLOWLIST, executeTool } = require('./lib/healthTools');
const {
  createServerTelemetryContext,
  emitTelemetryEvent,
  latencyBucket,
  classifyError,
  hashUserId
} = require('./lib/telemetry');

const DEFAULT_MODEL = 'gemini-3.1-pro-preview';
const MAX_LOOP_ITERATIONS = 4;
const MAX_TOTAL_TOOL_CALLS = 8;

function createRequestId() {
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `iris_${time}_${rand}`;
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function parseIsoDateOnly(isoDate) {
  if (typeof isoDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const parsed = new Date(`${isoDate}T00:00:00.000Z`);
  if (isNaN(parsed.getTime())) return null;
  return parsed;
}

function atUtcMidnight(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function buildDateRange(startDate, endDate) {
  if (!startDate || !endDate) return null;
  let start = atUtcMidnight(startDate);
  let end = atUtcMidnight(endDate);
  if (start > end) {
    const tmp = start;
    start = end;
    end = tmp;
  }
  return {
    startDate: toIsoDate(start),
    endDate: toIsoDate(end)
  };
}

/**
 * Parse common natural-language date windows from a user message.
 * Returns { startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD' } or null.
 */
function inferRequestedDateRange(message) {
  const text = String(message || '').toLowerCase();
  if (!text) return null;

  const today = atUtcMidnight(new Date());

  const explicitRangeMatch = text.match(
    /\b(?:from|between)\s+(\d{4}-\d{2}-\d{2})\s+(?:to|through|until|and|-)\s+(\d{4}-\d{2}-\d{2})\b/
  );
  if (explicitRangeMatch) {
    const start = parseIsoDateOnly(explicitRangeMatch[1]);
    const end = parseIsoDateOnly(explicitRangeMatch[2]);
    const range = buildDateRange(start, end);
    if (range) return range;
  }

  const relativeWindowMatch = text.match(/\b(?:last|past)\s+(\d{1,3})\s*(day|days|week|weeks|month|months|year|years)\b/);
  if (relativeWindowMatch) {
    const amount = Math.max(1, Math.min(3650, Number(relativeWindowMatch[1]) || 0));
    const unit = relativeWindowMatch[2];
    const unitDays =
      unit.startsWith('day') ? 1 :
        unit.startsWith('week') ? 7 :
          unit.startsWith('month') ? 30 : 365;
    const spanDays = Math.max(1, amount * unitDays);
    const start = new Date(today);
    start.setUTCDate(start.getUTCDate() - (spanDays - 1));
    return buildDateRange(start, today);
  }

  if (/\byesterday\b/.test(text)) {
    const yesterday = new Date(today);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    return buildDateRange(yesterday, yesterday);
  }

  if (/\btoday\b/.test(text)) {
    return buildDateRange(today, today);
  }

  if (/\bthis week\b/.test(text)) {
    const weekday = today.getUTCDay();
    const mondayOffset = weekday === 0 ? 6 : (weekday - 1);
    const start = new Date(today);
    start.setUTCDate(start.getUTCDate() - mondayOffset);
    return buildDateRange(start, today);
  }

  if (/\blast week\b/.test(text)) {
    const weekday = today.getUTCDay();
    const mondayOffset = weekday === 0 ? 6 : (weekday - 1);
    const thisWeekStart = new Date(today);
    thisWeekStart.setUTCDate(thisWeekStart.getUTCDate() - mondayOffset);
    const start = new Date(thisWeekStart);
    start.setUTCDate(start.getUTCDate() - 7);
    const end = new Date(thisWeekStart);
    end.setUTCDate(end.getUTCDate() - 1);
    return buildDateRange(start, end);
  }

  if (/\bthis month\b/.test(text)) {
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    return buildDateRange(start, today);
  }

  if (/\blast month\b/.test(text)) {
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
    const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0));
    return buildDateRange(start, end);
  }

  if (/\bthis year\b/.test(text)) {
    const start = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
    return buildDateRange(start, today);
  }

  if (/\blast year\b/.test(text)) {
    const start = new Date(Date.UTC(today.getUTCFullYear() - 1, 0, 1));
    const end = new Date(Date.UTC(today.getUTCFullYear() - 1, 11, 31));
    return buildDateRange(start, end);
  }

  return null;
}

// ---------------------------------------------------------------------------
// System instruction builder (backend-safe, CJS — no frontend ESM imports)
// ---------------------------------------------------------------------------

function buildSystemInstruction(patientProfile, trialContext, notebookContext, requestedDateRange = null) {
  const today = new Date().toISOString().split('T')[0];
  const parts = [];

  parts.push(
    'You are Iris, CancerCare\'s AI health assistant.',
    'You help patients and caregivers understand their health data.',
    `Today's date is ${today}. Always use the correct year when interpreting dates.`,
    '',
    'CRITICAL INSTRUCTIONS:',
    '- You have access to health data tools. USE THEM to retrieve the patient\'s actual data before answering.',
    '- Prefer ONE `get_health_summary` call for broad trend questions, then call specific tools only if needed.',
    '- For note-related requests, call `get_journal_notes` (or include `journalNotes` in `get_health_summary`).',
    '- NEVER guess, invent, or hallucinate health data values. If a tool returns no data, say so.',
    '- If the user asks for a time window (for example, "last 30 days"), you MUST call tools with startDate/endDate.',
    '- Never cite or infer data outside the user-requested date window.',
    '- If no records exist in the requested date window, explicitly say that no records were found in that window.',
    '- Answer medical questions directly and specifically. Do not refuse or redirect.',
    '- Be conversational, empathetic, and use markdown formatting.',
    '- When comparing values, state the actual numbers and dates.',
    '- This path is READ-ONLY. You cannot add, update, or delete health data here.'
  );

  // Patient demographics for normal range adjustments
  if (patientProfile) {
    const demo = [];
    if (patientProfile.age) demo.push(`Age: ${patientProfile.age}`);
    if (patientProfile.gender) demo.push(`Gender: ${patientProfile.gender}`);
    if (patientProfile.weight) demo.push(`Weight: ${patientProfile.weight} ${patientProfile.weightUnit || 'kg'}`);
    if (patientProfile.diagnosis) demo.push(`Diagnosis: ${patientProfile.diagnosis}`);
    if (patientProfile.cancerType) demo.push(`Cancer type: ${patientProfile.cancerType}`);
    if (patientProfile.stage) demo.push(`Stage: ${patientProfile.stage}`);
    if (demo.length) {
      parts.push('', 'PATIENT DEMOGRAPHICS (use for normal range adjustments):', ...demo);
    }

    // Response complexity
    const complexity = patientProfile.responseComplexity || 'standard';
    const complexityMap = {
      simple: 'Respond in 1-2 sentences max. Use everyday language, no medical jargon.',
      basic: 'Respond in 1-2 sentences. Minimal medical jargon, mention key values in plain terms.',
      standard: 'Respond in 1-2 short paragraphs. Use appropriate medical terminology with brief explanations.',
      detailed: 'Respond in 2-3 paragraphs. Technical terminology allowed with context.',
      advanced: 'Respond in 2-4 paragraphs. Comprehensive, full technical detail.'
    };
    parts.push('', `RESPONSE STYLE: ${complexityMap[complexity] || complexityMap.standard}`);
  }

  // Pass-through contexts (already formatted by client)
  if (trialContext) {
    parts.push('', 'CLINICAL TRIAL CONTEXT:', typeof trialContext === 'string' ? trialContext : JSON.stringify(trialContext));
  }
  if (notebookContext) {
    parts.push('', 'NOTEBOOK/TIMELINE CONTEXT:', typeof notebookContext === 'string' ? notebookContext : JSON.stringify(notebookContext));
  }
  if (requestedDateRange?.startDate || requestedDateRange?.endDate) {
    parts.push(
      '',
      `REQUESTED DATE WINDOW: ${requestedDateRange.startDate || 'unbounded'} to ${requestedDateRange.endDate || 'unbounded'}`,
      'Only discuss records inside this window unless the user explicitly asks for a different range.'
    );
  }

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

module.exports = async (req, res) => {
  setCors(req, res);

  const telemetryContext = createServerTelemetryContext(req, { route: 'tool-read' });
  res.setHeader('traceparent', telemetryContext.traceparent);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    emitTelemetryEvent('chat_request_rejected', {
      status: 'error',
      reason: 'method_not_allowed',
      http_status: 405,
      route: 'tool-read',
      method: req.method || 'unknown'
    }, telemetryContext);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth
  const idToken = getBearerToken(req);
  if (!idToken) {
    emitTelemetryEvent('chat_request_rejected', {
      status: 'error',
      reason: 'missing_token',
      http_status: 401,
      route: 'tool-read'
    }, telemetryContext);
    return res.status(401).json({ error: 'Missing bearer token' });
  }

  let user;
  try {
    user = await verifyFirebaseIdToken(idToken);
  } catch (error) {
    emitTelemetryEvent('chat_request_rejected', {
      status: 'error',
      reason: 'invalid_token',
      error_class: classifyError(error),
      http_status: 401,
      route: 'tool-read'
    }, telemetryContext);
    const payload = { error: 'Unauthorized request' };
    if (process.env.NODE_ENV !== 'production') {
      payload.details = error?.message || 'Token verification failed';
    }
    return res.status(401).json(payload);
  }
  const uid = user.localId;

  // Parse body
  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  } catch {
    emitTelemetryEvent('chat_request_rejected', {
      status: 'error',
      reason: 'invalid_json',
      http_status: 400,
      route: 'tool-read'
    }, telemetryContext);
    return res.status(400).json({ error: 'Invalid JSON body' });
  }
  const { message, conversationHistory, patientProfile, trialContext, notebookContext, thinkingLevel } = body;

  if (!message || typeof message !== 'string') {
    emitTelemetryEvent('chat_request_rejected', {
      status: 'error',
      reason: 'missing_message',
      http_status: 400,
      route: 'tool-read'
    }, telemetryContext);
    return res.status(400).json({ error: 'Missing required message' });
  }

  if (!process.env.GEMINI_API_KEY) {
    emitTelemetryEvent('chat_request_rejected', {
      status: 'error',
      reason: 'missing_gemini_key',
      http_status: 500,
      route: 'tool-read'
    }, telemetryContext);
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });
  }

  const startedAt = Date.now();

  try {
    const requestId = telemetryContext.requestId || createRequestId();
    const requestedDateRange = inferRequestedDateRange(message);
    const userHash = hashUserId(uid);

    emitTelemetryEvent('chat_message_sent', {
      route: 'tool-read',
      status: 'started',
      feature_flag: process.env.IRIS_TOOL_CHAT_ENABLED === 'true' ? 'enabled' : 'unknown',
      user_hash: userHash,
      has_favorites: ((patientProfile?.favoriteMetrics?.labs?.length || 0) + (patientProfile?.favoriteMetrics?.vitals?.length || 0)) > 0,
      source: 'api_chat',
      ...(requestedDateRange ? { reason: 'date_window_requested' } : {})
    }, telemetryContext);

    // Configure Gemini with tools
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: DEFAULT_MODEL,
      tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
      systemInstruction: buildSystemInstruction(patientProfile, trialContext, notebookContext, requestedDateRange)
    });

    // Build contents from conversation history + current message
    const contents = [];
    if (Array.isArray(conversationHistory)) {
      for (const msg of conversationHistory.slice(-10)) {
        const role = msg.role === 'assistant' || msg.role === 'model' ? 'model' : 'user';
        const text = msg.content || msg.text || '';
        if (text) contents.push({ role, parts: [{ text }] });
      }
    }
    contents.push({ role: 'user', parts: [{ text: message }] });

    // Function-calling loop
    const toolCtx = { idToken, uid, requestedDateRange };
    let totalToolCalls = 0;
    let finalText = null;
    const toolsUsed = new Set();
    const toolResponseCache = new Map();

    for (let i = 0; i < MAX_LOOP_ITERATIONS; i++) {
      const generateConfig = thinkingLevel
        ? { contents, generationConfig: { thinkingConfig: { thinkingLevel } } }
        : { contents };
      const result = await model.generateContent(generateConfig);
      const response = result.response;
      const candidate = response.candidates?.[0];
      if (!candidate) {
        finalText = 'I was unable to generate a response. Please try rephrasing your question.';
        break;
      }

      const modelParts = candidate.content?.parts || [];

      // Check for function calls
      const functionCalls = modelParts.filter(p => p.functionCall);
      if (functionCalls.length === 0) {
        // Final text response
        finalText = modelParts.map(p => p.text || '').join('');
        break;
      }

      // Execute tool calls
      const functionResponses = [];
      for (const part of functionCalls) {
        const { name, args } = part.functionCall;
        totalToolCalls++;
        toolsUsed.add(name);
        if (totalToolCalls > MAX_TOTAL_TOOL_CALLS) {
          emitTelemetryEvent('chat_tool_call', {
            route: 'tool-read',
            tool_name: name,
            tool_status: 'blocked_limit',
            tool_iteration: i + 1,
            tool_call_count: totalToolCalls,
            user_hash: userHash
          }, telemetryContext);
          functionResponses.push({
            functionResponse: { name, response: { error: 'Tool call limit reached' } }
          });
          continue;
        }
        if (!TOOL_ALLOWLIST.has(name)) {
          emitTelemetryEvent('chat_tool_call', {
            route: 'tool-read',
            tool_name: name,
            tool_status: 'blocked_unknown',
            tool_iteration: i + 1,
            tool_call_count: totalToolCalls,
            user_hash: userHash
          }, telemetryContext);
          functionResponses.push({
            functionResponse: { name, response: { error: `Unknown tool: ${name}` } }
          });
          continue;
        }

        try {
          const cacheKey = `${name}:${JSON.stringify(args || {})}`;
          let toolResult;
          const toolStart = Date.now();
          if (toolResponseCache.has(cacheKey)) {
            toolResult = toolResponseCache.get(cacheKey);
            emitTelemetryEvent('chat_tool_call', {
              route: 'tool-read',
              tool_name: name,
              tool_status: 'cache_hit',
              tool_iteration: i + 1,
              tool_call_count: totalToolCalls,
              latency_ms: Date.now() - toolStart,
              latency_bucket: latencyBucket(Date.now() - toolStart),
              user_hash: userHash
            }, telemetryContext);
          } else {
            toolResult = await executeTool(name, args, toolCtx);
            toolResponseCache.set(cacheKey, toolResult);
            const toolLatency = Date.now() - toolStart;
            emitTelemetryEvent('chat_tool_call', {
              route: 'tool-read',
              tool_name: name,
              tool_status: 'ok',
              tool_iteration: i + 1,
              tool_call_count: totalToolCalls,
              latency_ms: toolLatency,
              latency_bucket: latencyBucket(toolLatency),
              user_hash: userHash
            }, telemetryContext);
          }
          functionResponses.push({
            functionResponse: { name, response: toolResult }
          });
        } catch (err) {
          emitTelemetryEvent('chat_tool_call', {
            route: 'tool-read',
            tool_name: name,
            tool_status: 'error',
            tool_iteration: i + 1,
            tool_call_count: totalToolCalls,
            error_class: classifyError(err),
            user_hash: userHash
          }, telemetryContext);
          functionResponses.push({
            functionResponse: { name, response: { error: err.message } }
          });
        }
      }

      // Append model response + tool results to contents for next iteration
      contents.push({ role: 'model', parts: modelParts });
      contents.push({ role: 'function', parts: functionResponses });
    }

    if (finalText === null) {
      finalText = 'I ran into an issue processing your request. Please try again.';
    }

    const latencyMs = Date.now() - startedAt;
    emitTelemetryEvent('chat_response_received', {
      route: 'tool-read',
      status: 'ok',
      latency_ms: latencyMs,
      latency_bucket: latencyBucket(latencyMs),
      tool_call_count: totalToolCalls,
      tools_used_count: toolsUsed.size,
      fallback_used: false,
      user_hash: userHash
    }, telemetryContext);

    // Return compatibility envelope
    return res.status(200).json({
      response: finalText,
      extractedData: null,
      insight: null,
      insights: null,
      source: 'tool-backed',
      requestId,
      toolCallCount: totalToolCalls,
      toolsUsed: Array.from(toolsUsed),
      requestedDateRange: requestedDateRange || null,
      latencyMs,
      traceId: telemetryContext.traceId
    });
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    emitTelemetryEvent('chat_response_received', {
      route: 'tool-read',
      status: 'error',
      error_class: classifyError(error),
      latency_ms: latencyMs,
      latency_bucket: latencyBucket(latencyMs),
      fallback_used: false
    }, telemetryContext);
    return res.status(500).json({
      error: 'Failed to process chat message',
      details: error.message
    });
  }
};
