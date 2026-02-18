# Sentry Error Tracking Setup

## Quick Setup (5 minutes)

### Step 1: Install Sentry
```bash
npm install @sentry/react
```

### Step 2: Create Sentry Account
1. Go to https://sentry.io
2. Sign up for a free account
3. Create a new project (select React)
4. Copy your DSN (Data Source Name)

### Step 3: Add DSN to Environment Variables

**Local (.env file):**
```bash
REACT_APP_SENTRY_DSN=https://your-dsn@sentry.io/your-project-id
```

**Vercel (Production):**
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add: `REACT_APP_SENTRY_DSN` = `https://your-dsn@sentry.io/your-project-id`
3. Select all environments (Production, Preview, Development)
4. Redeploy

### Step 4: Verify Setup

The code is already set up! Sentry will automatically:
- Initialize when the app starts (production only)
- Capture errors from ErrorBoundary
- Capture errors logged via logger.error()
- Ignore common browser extension errors

## What Gets Tracked

✅ **Automatic Tracking:**
- React component errors (via ErrorBoundary)
- Errors logged with `logger.error()`
- Unhandled promise rejections (if configured)

✅ **What's Ignored:**
- Development environment errors
- Common browser extension errors
- Network errors (expected failures)

## Testing

To test Sentry is working:

1. Deploy to production/staging
2. Trigger an error (e.g., click a broken feature)
3. Check your Sentry dashboard - you should see the error within seconds

## Optional: Advanced Configuration

Edit `src/utils/sentry.js` to customize:
- `tracesSampleRate`: Performance monitoring sample rate (default: 10%)
- `ignoreErrors`: Additional errors to ignore
- `beforeSend`: Custom filtering before sending errors

## Cost

Sentry free tier includes:
- 5,000 errors/month
- 10,000 performance units/month
- 1 project
- 30-day error history

This is typically enough for small to medium applications.
