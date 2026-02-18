# CancerCare — CLAUDE.md

## Project Overview
A React single-page application for personal cancer care tracking. Features include lab/vital tracking with charts, an AI chat assistant (Iris), clinical trial search, DICOM medical imaging, document upload/parsing, and PDF report generation.

## Commands

```bash
# Recommended dev workflow — runs React (port 3001) + Express proxy (port 4000) together
npm run start:all

# React dev server only (port 3001)
npm start

# Express proxy only (port 4000)
npm run start:proxy

# Production build
npm run build
```

There are **no test commands**. The project has no test suite.

**Engine requirements:** Node >= 18.0.0, npm >= 9.0.0.

## Architecture

### Routing
No React Router. Navigation is pure state: `App.js` holds `activeTab` (`'dashboard'` | `'chat'` | `'health'` | `'trials'` | `'files'` | `'export'` | `'profile'`). Tab components receive `onTabChange` as a prop for programmatic navigation.

### State Management
No Redux or Zustand. Four React Contexts at the root:
- **`AuthContext`** — `user`, `authLoading` (wraps Firebase `onAuthStateChanged`)
- **`PatientContext`** — `patientProfile`, `needsOnboarding`, `refreshPatient`
- **`HealthContext`** — `labsData`, `vitalsData`, `hasRealLabData`, `reloadHealthData`
- **`BannerContext`** — `showSuccess`, `showError` for global notifications

Remaining state lives in `App.js` and is passed as props.

### Module System
- `src/` — ESM (`import`/`export`)
- `api/` and `server/` — CJS (`require`/`module.exports`)

Do not mix these.

### Local Dev Proxy
`server/proxy.js` (Express, port 4000) adapts the Express `req`/`res` interface to the Vercel serverless function signature. `src/setupProxy.js` proxies all `/api/*` requests from the React dev server (3001) to port 4000. This means the same `api/*.js` code runs identically in local dev and Vercel production.

## Key Directories

```
api/                    # Vercel serverless functions (CJS)
  lib/                  # Shared: auth.js, firestoreRest.js, healthTools.js
server/                 # Local dev Express proxy
src/
  components/
    modals/             # 30+ modal components
    tabs/               # Page-level tab components
      health/           # Health tab: sections/, components/, hooks/, utils/
      dashboard/        # Dashboard subcomponents
  contexts/             # AuthContext, HealthContext, PatientContext, BannerContext
  design/
    designTokens.js     # ALL Tailwind class tokens — import from here, don't hardcode
  firebase/
    config.js           # Firebase init (null-safe)
    services/           # 14 entity service files (labService, vitalService, etc.)
    hooks.js            # Custom data hooks (useLabs, useVitals, etc.)
    services.js         # Central re-export of all services
  prompts/
    chat/               # mainPrompt.js, taskDescriptions.js
    context/            # healthContext, trialContext, notebookContext builders
  services/
    chatProcessor.js    # Main AI orchestration (2100+ lines)
    geminiClientService.js
    documentProcessor.js
  utils/
    normalizationUtils.js  # Lab/vital normalization, reference ranges (largest file)
    dataTransformUtils.js  # Raw Firestore → UI-ready keyed objects
    healthUtils.js
    logger.js           # Production-safe logger — always use this, not console.log
```

## Data Layer

### Firestore Collections
```
patients/{uid}
labs/{labId}
  └── values/{valueId}      # time-series subcollection
vitals/{vitalId}
  └── values/{valueId}      # time-series subcollection
medications/{medId}
medicationLogs/{logId}
symptoms/{symptomId}
documents/{docId}
messages/{msgId}
genomicProfiles/{uid}       # document ID = patientId
journalNotes/{noteId}
clinicalTrials/{trialId}
trialLocations/{uid}        # document ID = patientId
emergencyContacts/{contactId}
```

**All records use `patientId` field = Firebase Auth UID** for security rule enforcement.

### Client vs. Server Firestore Access
- **`src/firebase/services/`** — use the Firebase client SDK (in browser)
- **`api/lib/firestoreRest.js`** — use Firestore REST API with the user's ID token (in serverless functions — no firebase-admin)

### Auth Token Verification
Serverless functions verify the Firebase ID token by calling Google's Identity Toolkit REST API. See `api/lib/auth.js` for `verifyFirebaseIdToken()`.

## Design System

**Always use `DesignTokens` from `src/design/designTokens.js`.** Import `DesignTokens` and `combineClasses` and compose classes from the token object. Do not hardcode Tailwind color classes like `text-blue-500` — use the tokens. The `THEME_USAGE_RULES` file at the project root documents the locked color contract.

```js
import { DesignTokens, combineClasses } from '../../../../design/designTokens';

// Good
<div className={combineClasses(DesignTokens.components.card.container, DesignTokens.borders.card)}>

// Bad — hardcodes colors outside the design system
<div className="bg-white rounded-xl border border-gray-200 p-4">
```

## Iris Chat System

Two execution paths, controlled by `REACT_APP_IRIS_TOOL_CHAT_ENABLED`:

1. **Tool path** (preferred): `api/chat.js` — Gemini with function calling. Gemini selects which health data tools to invoke (`get_labs`, `get_vitals`, etc.), server fetches from Firestore REST, synthesizes response.
2. **Context-stuffing path** (fallback): `src/services/chatProcessor.js` + `api/gemini.js` — health data is loaded client-side and injected into the Gemini system prompt.

The tool path silently falls back to context-stuffing on failure. `api/lib/healthTools.js` declares the 5 tool definitions and their execution handlers.

## Logging

**Never use `console.log` directly.** Use the production-safe logger:

```js
import logger from '../utils/logger';

logger.log('info message');    // dev only
logger.warn('warning');        // dev only
logger.error('error', err);    // always (+ Sentry if configured)
logger.debug('verbose', data); // only when REACT_APP_PROCESSOR_DEBUG=true
```

## Firebase Config (Null-Safe Pattern)

`src/firebase/config.js` exports `db`, `auth`, `storage` as `null` when env vars are missing. Always check `isFirebaseConfigured()` before using Firebase, and handle the null case gracefully.

## Environment Variables

### Frontend (`REACT_APP_` prefix required)
| Variable | Required | Description |
|---|---|---|
| `REACT_APP_FIREBASE_API_KEY` | Yes | Firebase API key |
| `REACT_APP_FIREBASE_AUTH_DOMAIN` | Yes | Firebase auth domain |
| `REACT_APP_FIREBASE_PROJECT_ID` | Yes | Firebase project ID |
| `REACT_APP_FIREBASE_STORAGE_BUCKET` | Yes | Firebase Storage bucket |
| `REACT_APP_FIREBASE_MESSAGING_SENDER_ID` | Yes | Firebase messaging sender ID |
| `REACT_APP_FIREBASE_APP_ID` | Yes | Firebase app ID |
| `REACT_APP_GEMINI_API_KEY` | Yes | Gemini API key (browser fallback) |
| `REACT_APP_PROXY_URL` | Dev | Proxy base URL (e.g. `http://localhost:4000`) |
| `REACT_APP_IRIS_TOOL_CHAT_ENABLED` | No | `'true'` enables tool-backed chat |
| `REACT_APP_PROCESSOR_DEBUG` | No | `'true'` enables verbose debug logging |
| `REACT_APP_SENTRY_DSN` | No | Sentry DSN for error tracking |

### Server-side (no prefix — Vercel env vars)
| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Yes | Gemini API key (serverless) |
| `FIREBASE_API_KEY` | Yes | For Firebase token verification |
| `FIREBASE_PROJECT_ID` | Yes | For Firestore REST API |
| `ALLOWED_ORIGINS` | No | Comma-separated CORS origins |
| `IRIS_TOOL_CHAT_ENABLED` | No | Server-side feature flag |

## Conventions

- **No TypeScript** — the entire codebase is `.js`
- **Components:** PascalCase (e.g. `AddLabModal.js`)
- **Services/utils:** camelCase (e.g. `labService.js`, `normalizationUtils.js`)
- **One component per file**
- **Modals:** in `src/components/modals/`
- **Data transforms:** raw Firestore data → UI-ready objects via `src/utils/dataTransformUtils.js`
- **No linting config** — relies on CRA's built-in ESLint; no Prettier config
- **Serverless functions** follow the Vercel handler signature `(req, res)` and must use CJS

## Webpack Notes

`config-overrides.js` (react-app-rewired) adds Node.js polyfills required by Cornerstone3D (crypto, stream, buffer, etc.) and sets `COOP`/`COEP` headers for `SharedArrayBuffer` (needed for DICOM WASM decoders). There is a known pre-existing Cornerstone.js webpack build warning that is unrelated to app code — do not attempt to fix it.
