/**
 * Sentry Error Tracking Configuration
 * 
 * To set up Sentry:
 * 1. Install: npm install @sentry/react
 * 2. Get your DSN from: https://sentry.io
 * 3. Add REACT_APP_SENTRY_DSN to your .env file
 * 4. This file will automatically initialize Sentry in production
 * 
 * Note: This module works without Sentry installed - it gracefully degrades.
 * The require() calls are wrapped to prevent webpack from trying to resolve
 * the module during build time if it's not installed.
 */

let Sentry = null;
let sentryChecked = false;

// Lazy-load Sentry only at runtime to avoid build-time resolution
// This function is only called at runtime, not during webpack bundling
function getSentry() {
  // Return cached value if already checked
  if (sentryChecked) {
    return Sentry;
  }
  
  sentryChecked = true;
  
  // Only try to load Sentry at runtime (in browser), not during build
  if (typeof window !== 'undefined') {
    // We're in the browser (runtime) - safe to try loading
    try {
      // Use eval to prevent webpack from statically analyzing this require
      // This allows the build to succeed even if @sentry/react isn't installed
      const requireSentry = new Function('return typeof require !== "undefined" ? require("@sentry/react") : null');
      Sentry = requireSentry();
    } catch (e) {
      // Module not found or other error - that's okay, we'll work without it
      Sentry = null;
    }
  } else {
    // Build time - don't try to load
    Sentry = null;
  }
  
  return Sentry;
}

/**
 * Initialize Sentry if available and configured
 */
export function initSentry() {
  // Only initialize at runtime, not during build
  if (typeof window === 'undefined') {
    return;
  }
  
  const SentryModule = getSentry();
  
  if (!SentryModule) {
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
    SentryModule.init({
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
  // Only capture at runtime
  if (typeof window === 'undefined') {
    return;
  }
  
  const SentryModule = getSentry();
  
  if (!SentryModule) {
    return;
  }

  if (process.env.NODE_ENV === 'production') {
    SentryModule.captureException(error, {
      extra: context,
    });
  }
}

/**
 * Capture a message to Sentry
 */
export function captureMessage(message, level = 'info') {
  // Only capture at runtime
  if (typeof window === 'undefined') {
    return;
  }
  
  const SentryModule = getSentry();
  
  if (!SentryModule) {
    return;
  }

  if (process.env.NODE_ENV === 'production') {
    SentryModule.captureMessage(message, level);
  }
}

export default getSentry;
