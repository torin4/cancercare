import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { PatientProvider } from './contexts/PatientContext';
import { HealthProvider } from './contexts/HealthContext';
import { BannerProvider } from './contexts/BannerContext';
import { initSentry } from './utils/sentry';
import ErrorBoundary from './components/ErrorBoundary';

// Initialize Sentry error tracking (if configured)
initSentry();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <PatientProvider>
          <HealthProvider>
            <BannerProvider>
              <App />
            </BannerProvider>
          </HealthProvider>
        </PatientProvider>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
// Force Vercel rebuild - Wed Dec 31 22:20:27 JST 2025
