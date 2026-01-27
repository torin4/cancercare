/**
 * Production-safe logging utility.
 * Only logs in development mode unless explicitly overridden.
 *
 * Usage:
 *   import logger from '../utils/logger';
 *   logger.log('Message');           // Only in dev
 *   logger.warn('Warning');          // Only in dev
 *   logger.error('Error', error);    // Always logs errors
 *   logger.debug('Debug info');      // Only in dev with DEBUG flag
 */

const isDev = process.env.NODE_ENV === 'development';
const isDebug = process.env.REACT_APP_PROCESSOR_DEBUG === 'true';

const logger = {
  /**
   * Log informational messages (development only)
   */
  log: (...args) => {
    if (isDev) {
      console.log(...args);
    }
  },

  /**
   * Log warning messages (development only)
   */
  warn: (...args) => {
    if (isDev) {
      console.warn(...args);
    }
  },

  /**
   * Log error messages (always - errors should be tracked)
   * In production, sends to error tracking service if configured
   */
  error: (...args) => {
    console.error(...args);
    
    // Send to Sentry if available and in production
    if (!isDev) {
      try {
        // Dynamic import to avoid build errors if Sentry not installed
        const sentryUtils = require('./sentry');
        if (sentryUtils && sentryUtils.captureException) {
          // If first arg is an Error object, capture as exception
          if (args[0] instanceof Error) {
            sentryUtils.captureException(args[0], { context: args.slice(1) });
          } else {
            // Otherwise capture as message
            sentryUtils.captureMessage(args.join(' '), 'error');
          }
        }
      } catch (e) {
        // Sentry not available - that's okay
      }
    }
  },

  /**
   * Log debug messages (development only, with DEBUG flag)
   */
  debug: (...args) => {
    if (isDev && isDebug) {
      console.debug('[DEBUG]', ...args);
    }
  },

  /**
   * Log with a specific tag/component name (development only)
   */
  tagged: (tag, ...args) => {
    if (isDev) {
      console.log(`[${tag}]`, ...args);
    }
  },

  /**
   * Log performance timing (development only)
   */
  time: (label) => {
    if (isDev) {
      console.time(label);
    }
  },

  timeEnd: (label) => {
    if (isDev) {
      console.timeEnd(label);
    }
  },

  /**
   * Group related logs (development only)
   */
  group: (label) => {
    if (isDev) {
      console.group(label);
    }
  },

  groupEnd: () => {
    if (isDev) {
      console.groupEnd();
    }
  }
};

export default logger;
