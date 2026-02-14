# Iris Better Vision v2: backend health tools + Gemini function calling (no-regression)

**Summary:** Improve Iris's in-app health-data vision by moving health-data retrieval to backend Gemini tool-calling, while preserving current extraction/save behavior and multimodal flows. This version fixes the v1 gaps: response-contract compatibility, secure tool arguments, local proxy wiring, prompt/module boundaries, and token-efficiency filters.

---

## Goal

Give Iris accurate, on-demand access to labs, vitals, symptoms, and medications without relying on one large client-built context blob, **without breaking current chat behavior**.

---

## What changes from v1

1. Keep compatibility with current chat contract so extraction/save flows do not regress.
2. Do not let the model supply `userId`; backend always uses verified token `uid`.
3. Add local dev routing for `/api/chat` (and `/api/gemini` parity) in `server/proxy.js`.
4. Avoid frontend ESM prompt imports inside serverless CJS code; use backend-safe prompt modules.
5. Keep image/DICOM requests on existing multimodal path until tool path supports them.
6. Add filtered tool parameters (`labType`, date range, limit, etc.) to reduce token bloat.

---

## Current behavior (why vision is limited)

- Chat UI loads health data in browser, builds a large text context, and sends it to Gemini.
- Gemini cannot request specific subsets of data on demand.
- Retrieval/comparison accuracy depends on prompt size/format and can degrade with truncation.

---

## Target behavior

- For text-based health retrieval/analysis questions, backend runs Gemini with tool definitions and serves structured data on demand.
- For data-entry/edit/delete extraction flows, keep current extraction pipeline until a later migration.
- For image/DICOM chat, keep current multimodal path.
- Client chooses the safest path by intent:
  - Tool path: retrieval/comparison/analysis
  - Legacy path: extraction writes + multimodal

---

## Architecture

1. App sends message + history (+ optional trial/notebook/patient context) to `/api/chat` for eligible text queries.
2. Backend verifies Firebase ID token, gets `uid`, creates Gemini request with health tools.
3. Gemini issues function calls (e.g. `get_labs({ labType, startDate, endDate, limit })`).
4. Backend executes tools with Firebase Admin using verified `uid` only.
5. Backend loops until final model text and returns compatibility payload.
6. Client renders response using existing UI model.

---

## API contract

### `POST /api/chat` request

```json
{
  "message": "What was my CA-125 last month?",
  "conversationHistory": [{ "role": "user", "content": "..." }],
  "trialContext": {},
  "notebookContext": {},
  "patientProfile": {},
  "mode": "tool-read"
}
```

### `POST /api/chat` response (compatibility envelope)

```json
{
  "response": "Your CA-125 on 2026-01-14 was 48 U/mL.",
  "extractedData": null,
  "insight": null,
  "insights": null,
  "source": "tool-backed"
}
```

Notes:
- Keep keys compatible with existing chat object shape.
- `extractedData` is `null` for read/query tool flow.

---

## Health tools (read-only, filtered)

Backend tool declarations (no `userId` parameter exposed to model):

- `get_labs({ labType?, startDate?, endDate?, limit? })`
- `get_vitals({ vitalType?, startDate?, endDate?, limit? })`
- `get_symptoms({ startDate?, endDate?, severity?, limit? })`
- `get_medications({ activeOnly?, limit? })`
- `get_health_summary({ include?, startDate?, endDate? })`

Tool execution rules:
- Always scope queries by verified `uid`.
- Default limits (for example 20-50 records) with hard max caps.
- Serialize timestamps to ISO date strings.

---

## Implementation plan

### 1) Add backend health tools module

- Add `api/health-tools.js`:
  - Initialize Firebase Admin once.
  - Implement read-only Firestore queries for labs/vitals/symptoms/medications.
  - Support filters and limits.
  - Normalize/serialize output for Gemini.

### 2) Add backend chat orchestration endpoint

- Add `api/chat.js`:
  - Verify Firebase token using Admin `verifyIdToken`.
  - Build backend-safe system instructions (do not import frontend-only modules directly).
  - Register tool declarations.
  - Run function-calling loop with:
    - max loop count (guardrail)
    - allowlisted tool names
    - schema validation for args
  - Return compatibility envelope `{ response, extractedData, insight, insights, source }`.

### 3) Keep legacy extraction + multimodal path

- In `src/services/chatProcessor.js`, route by intent:
  - Retrieval/comparison text queries -> call new `/api/chat` flow.
  - Add/update/delete/journal extraction -> keep current path.
  - DICOM/image flow -> keep current multimodal path.

### 4) Client service updates

- Update `src/services/geminiClientService.js` with `callToolChatProxy(...)` for `/api/chat`.
- Keep existing `/api/gemini` request + browser fallback logic as legacy fallback.

### 5) Local and deployment routing

- Update `server/proxy.js` to mount `/api/chat` (and `/api/gemini` parity if needed) for local dev.
- Keep Vercel serverless deployment path under `/api/*`.

### 6) Dependencies and secrets

- Update `package.json` with `firebase-admin`.
- Ensure Admin credentials are available at runtime.
- Update `.gitignore` to exclude service account JSON files.

---

## Security requirements

- Reject requests without valid bearer token.
- Never trust model-provided user identifiers.
- Enforce read-only tool behavior in this phase.
- Apply tool-call and payload-size guardrails.
- Log tool usage metadata without sensitive payload dumps.

---

## Testing and rollout

### Test cases

1. Health retrieval: "What was my CA-125 last month?"
2. Comparison: "Compare my last two hemoglobin results."
3. Non-health text query still returns normal response.
4. Add/update/delete extraction still writes to Firestore as before.
5. DICOM/image chat behavior unchanged.
6. Local dev `/api/chat` works via React proxy + `server/proxy.js`.
7. Security check: model cannot access another user's data.

### Rollout

1. Ship behind feature flag (`IRIS_TOOL_CHAT_ENABLED`).
2. Enable for internal users first.
3. Monitor latency, tool-call count, and failure rates.
4. Expand rollout after parity checks pass.

---

## Files to add or update

- **Add:** `api/health-tools.js`
- **Add:** `api/chat.js`
- **Update:** `server/proxy.js`
- **Update:** `src/services/chatProcessor.js`
- **Update:** `src/services/geminiClientService.js`
- **Update:** `package.json`
- **Update:** `.gitignore` (if needed)

---

## Success criteria

- Iris answers health retrieval/comparison questions from backend tool-fetched data with correct values and dates.
- No regression in current extraction/save behavior.
- No regression in DICOM/image chat behavior.
- Backend enforces user-scoped data access for every tool call.
- Local and production environments both support `/api/chat` flow reliably.

---

## OTLP telemetry plan (hard-coded analytics + AI analytics)

As of **2026-02-12**, Google Cloud's Telemetry (OTLP) API is trace-focused. Design accordingly:
- Send **traces** to Telemetry API (`https://telemetry.googleapis.com`).
- Send **metrics/logs** through an OpenTelemetry Collector (or existing Cloud Monitoring/Logging paths).

### Why this Iris refactor helps telemetry

- `/api/chat` creates a single backend orchestration point for intent classification, model calls, tool calls, and response assembly.
- That central point gives consistent span boundaries and request correlation IDs that are difficult to get from pure client-side prompt assembly.

### Telemetry architecture

1. Frontend creates/propagates `traceparent` per chat turn.
2. Backend (`/api/chat`, `/api/gemini`) starts root span per request.
3. Backend emits child spans for auth, model calls, tool calls, parse/response.
4. OTLP exporters send traces to Telemetry API.
5. Collector/exporters route metrics and logs to Cloud Monitoring/Logging.
6. Dashboards join product analytics + AI execution telemetry by trace/request ID.

### Span taxonomy (backend)

Root span:
- `iris.chat.request`

Child spans:
- `auth.verify_firebase_token`
- `iris.intent.route` (tool-read vs legacy-extraction vs multimodal)
- `gemini.generate_content` (or per turn in tool loop)
- `iris.tool.get_labs`
- `iris.tool.get_vitals`
- `iris.tool.get_symptoms`
- `iris.tool.get_medications`
- `iris.tool.get_health_summary`
- `iris.response.compose`
- `iris.fallback.legacy_path` (only when used)

Recommended span attributes (PHI-safe):
- `iris.request_id`
- `iris.route`
- `iris.model`
- `iris.tool.name`
- `iris.tool.call_count`
- `iris.loop.iteration`
- `iris.user_role` (patient/caregiver only)
- `iris.has_trial_context` (bool)
- `iris.has_notebook_context` (bool)
- `iris.has_image` (bool)
- `iris.status` (ok/error/fallback)
- `error.type` / `error.code` (no raw payload)

### Metric schema

Counters:
- `iris_chat_requests_total{route,status}`
- `iris_tool_calls_total{tool,status}`
- `iris_fallback_total{reason}`
- `iris_auth_failures_total`

Histograms:
- `iris_chat_latency_ms{route}`
- `iris_model_latency_ms{model}`
- `iris_tool_latency_ms{tool}`
- `iris_end_to_end_latency_ms{path}`

Gauges/UpDown:
- `iris_inflight_requests`

Distribution metrics:
- `iris_tool_calls_per_request`
- `iris_tokens_input_estimate`
- `iris_tokens_output_estimate`

### Hard-coded product analytics events (correlated)

Keep existing product analytics events, but include:
- `request_id`
- `trace_id`
- `route`
- `feature_flag` (`IRIS_TOOL_CHAT_ENABLED`)

Core events:
- `chat_message_sent`
- `chat_response_received`
- `chat_response_rendered`
- `chat_cancelled`
- `chat_error_shown`
- `health_context_auto_load_attempted` (legacy path only)

### PHI/PII policy (required)

- Do **not** send raw user message text, lab values, symptom notes, medication names/doses, document text, or DICOM metadata strings to telemetry attributes.
- Use coarse-grained categories only (intent class, route, error class, counts, booleans).
- Hash user identifiers with salted one-way hashing before telemetry (`user_hash`), or omit user IDs entirely from telemetry.
- Maintain an allowlist of safe attributes in one shared telemetry helper.
- Treat logs as sensitive: structured logs only, redacted fields, no prompt/tool payload dumps.

### Sampling and retention

- Default head sampling: 10% for successful requests.
- Always sample 100% for:
  - errors
  - fallback usage
  - latency above threshold (e.g. p95+ candidate)
- Keep short retention for verbose debug logs; long retention for aggregates/SLO metrics.

### SLOs and alerting

SLO targets:
- `iris_chat_latency_ms` p95 < 4s (text-only)
- tool-call error rate < 1%
- fallback rate < 5%
- auth failure rate stable baseline (alert on spikes)

Alerts:
- sudden increase in `iris_fallback_total`
- sustained `gemini.generate_content` latency degradation
- sustained tool-specific error spikes

### Rollout plan for telemetry coverage

Phase 1 (with `/api/chat` launch):
- Instrument `/api/chat` end-to-end.
- Add route-level metrics + traces.
- Add dashboards for tool flow only.

Phase 2 (parity):
- Instrument legacy `/api/gemini` path and extraction/write path.
- Add cross-route comparison dashboard (tool vs legacy).

Phase 3 (full coverage):
- Instrument multimodal/DICOM path.
- Standardize request correlation across all chat surfaces.

### Implementation checklist

- Add backend telemetry helper (for spans/metrics/logs + safe-attribute allowlist).
- Instrument `api/chat.js` and `api/gemini.js`.
- Propagate trace context from frontend fetch requests.
- Add collector/exporter config per environment.
- Add dashboards and alerts before broad rollout.
