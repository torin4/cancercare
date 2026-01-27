import React from 'react';
import PropTypes from 'prop-types';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { captureException } from '../utils/sentry';
import logger from '../utils/logger';

/**
 * Error Boundary component to catch and handle React component errors gracefully.
 * Prevents entire app crashes when individual components fail.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details for debugging
    this.setState({ errorInfo });

    // Log to logger (handles dev/prod automatically)
    logger.error('[ErrorBoundary] Caught error:', error);
    logger.error('[ErrorBoundary] Component stack:', errorInfo?.componentStack);

    // Send to Sentry error tracking service (if configured)
    captureException(error, {
      componentStack: errorInfo?.componentStack,
      errorBoundary: true,
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="flex flex-col items-center justify-center p-8 bg-red-50 rounded-lg border border-red-200 m-4">
          <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
          <h2 className="text-lg font-semibold text-red-800 mb-2">
            {this.props.title || 'Something went wrong'}
          </h2>
          <p className="text-red-600 text-center mb-4 max-w-md">
            {this.props.message || 'An unexpected error occurred. Please try again.'}
          </p>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="mb-4 p-3 bg-red-100 rounded text-sm text-red-800 max-w-full overflow-auto">
              <summary className="cursor-pointer font-medium">Error Details</summary>
              <pre className="mt-2 whitespace-pre-wrap break-words">
                {this.state.error.toString()}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}
          <button
            onClick={this.handleRetry}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
  fallback: PropTypes.node,
  title: PropTypes.string,
  message: PropTypes.string
};

export default ErrorBoundary;
