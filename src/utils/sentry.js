/**
 * Sentry Error Tracking Configuration
 * 
 * To set up Sentry:
 * 1. Install: npm install @sentry/react
 * 2. Get your DSN from: https://sentry.io
 * 3. Add REACT_APP_SENTRY_DSN to your .env file
 * 4. This file will automatically initialize Sentry in production
 */

let Sentry = null;

// Try to load Sentry (will be null if not installed)
// Use dynamic import to avoid build errors if package isn't installed
try {
  // Check if module exists before requiring
  if (typeof require !== 'undefined') {
    try {
      Sentry = require('@sentry/react');
    } catch (e) {
      // Sentry not installed - that's okay, we'll work without it
      Sentry = null;
    }
  }
} catch (e) {
  // Sentry not available - that's okay
  Sentry = null;
}

/**
 * Initialize Sentry if available and configured
 */
export function initSentry() {
  if (!Sentry) {
    // Sentry not installed - skip initialization
    return;
  }

  const dsn = process.env.REACT_APP_SENTRY_DSN;
  
  if (!dsn) {
    // DSN not configured - skip initialization
    return;
  }

  // Only initialize in production
  if (process.env.NODE_ENV === 'production') {
    Sentry.init({
      dsn: dsn,
      environment: 'production',
      tracesSampleRate: 0.1, // 10% of transactions for performance monitoring
      beforeSend(event, hint) {
        // Don't send errors in development
        if (process.env.NODE_ENV === 'development') {
          return null;
        }
        return event;
      },
      ignoreErrors: [
        // Ignore common browser extension errors
        'ResizeObserver loop limit exceeded',
        'Non-Error promise rejection captured',
        // Ignore network errors that are expected
        'NetworkError',
        'Failed to fetch',
      ],
    });
  }
}

/**
 * Capture an exception to Sentry
 */
export function captureException(error, context = {}) {
  if (!Sentry) {
    return;
  }

  if (process.env.NODE_ENV === 'production') {
    Sentry.captureException(error, {
      extra: context,
    });
  }
}

/**
 * Capture a message to Sentry
 */
export function captureMessage(message, level = 'info') {
  if (!Sentry) {
    return;
  }

  if (process.env.NODE_ENV === 'production') {
    Sentry.captureMessage(message, level);
  }
}

export default Sentry;
