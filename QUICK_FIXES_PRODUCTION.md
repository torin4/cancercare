# Quick Production Fixes

## 1. Add Environment Variable Validation (5 minutes)

Add this to `src/firebase/config.js` after line 14:

```javascript
// Validate required environment variables
const requiredEnvVars = {
  REACT_APP_FIREBASE_API_KEY: process.env.REACT_APP_FIREBASE_API_KEY,
  REACT_APP_FIREBASE_PROJECT_ID: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  REACT_APP_FIREBASE_STORAGE_BUCKET: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
};

const missingVars = Object.entries(requiredEnvVars)
  .filter(([key, value]) => !value)
  .map(([key]) => key);

if (missingVars.length > 0) {
  const error = `Missing required environment variables: ${missingVars.join(', ')}`;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(error);
  } else {
    console.error(`⚠️ ${error}`);
    console.error('Please check your .env file');
  }
}
```

## 2. Update .env.example (2 minutes)

Update `.env.example` to include all required variables:

```bash
# Firebase Configuration
REACT_APP_FIREBASE_API_KEY=your_firebase_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id

# Gemini API
REACT_APP_GEMINI_API_KEY=your_gemini_api_key
GEMINI_API_KEY=your_gemini_api_key

# Optional: Error Tracking
REACT_APP_SENTRY_DSN=your_sentry_dsn

# Optional: Proxy URL (for production)
REACT_APP_PROXY_URL=https://your-domain.vercel.app
```

## 3. Quick Sentry Setup (10 minutes)

### Step 1: Install Sentry
```bash
npm install @sentry/react
```

### Step 2: Initialize in src/index.js
```javascript
import * as Sentry from "@sentry/react";

if (process.env.NODE_ENV === 'production' && process.env.REACT_APP_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.REACT_APP_SENTRY_DSN,
    environment: "production",
    tracesSampleRate: 0.1,
    beforeSend(event, hint) {
      // Don't send errors in development
      if (process.env.NODE_ENV === 'development') {
        return null;
      }
      return event;
    },
  });
}
```

### Step 3: Update ErrorBoundary.js
Replace the TODO comment (lines 30-33) with:

```javascript
// Send to error tracking service in production
if (process.env.NODE_ENV === 'production') {
  try {
    const Sentry = require('@sentry/react');
    Sentry.captureException(error, { extra: errorInfo });
  } catch (e) {
    // Sentry not available, fail silently
  }
}
```

### Step 4: Wrap App with ErrorBoundary
In `src/index.js`:
```javascript
import ErrorBoundary from './components/ErrorBoundary';

ReactDOM.render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
  document.getElementById('root')
);
```

## 4. Replace console.error with logger (Optional, 15 minutes)

Create a script to find and replace:

```bash
# Find all console.error
grep -r "console.error" src/ --include="*.js" --include="*.jsx"

# Manually replace critical ones with:
import logger from '../utils/logger';
logger.error('Error message:', error);
```

## 5. Test Production Build (5 minutes)

```bash
# Build for production
npm run build

# Check build size
du -sh build/static/js/*
du -sh build/static/css/*

# Test locally (if you have serve installed)
npx serve -s build
```

## 6. Pre-Deployment Checklist

Before deploying to production:

- [ ] All environment variables set in Vercel/hosting platform
- [ ] Production build tested locally
- [ ] Error tracking configured (Sentry)
- [ ] Firebase security rules reviewed
- [ ] Test upload functionality
- [ ] Test chat functionality
- [ ] Test DICOM viewer
- [ ] Mobile responsiveness verified

## 7. Vercel Environment Variables

When deploying to Vercel, add these in Settings → Environment Variables:

```
REACT_APP_FIREBASE_API_KEY
REACT_APP_FIREBASE_AUTH_DOMAIN
REACT_APP_FIREBASE_PROJECT_ID
REACT_APP_FIREBASE_STORAGE_BUCKET
REACT_APP_FIREBASE_MESSAGING_SENDER_ID
REACT_APP_FIREBASE_APP_ID
REACT_APP_GEMINI_API_KEY
GEMINI_API_KEY
REACT_APP_SENTRY_DSN (optional)
REACT_APP_PROXY_URL (if using custom proxy)
```

Make sure to select **all environments** (Production, Preview, Development).
