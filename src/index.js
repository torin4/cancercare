import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { PatientProvider } from './contexts/PatientContext';
import { HealthProvider } from './contexts/HealthContext';
import { BannerProvider } from './contexts/BannerContext';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AuthProvider>
      <PatientProvider>
        <HealthProvider>
          <BannerProvider>
          <App />
          </BannerProvider>
        </HealthProvider>
      </PatientProvider>
    </AuthProvider>
  </React.StrictMode>
);
// Force Vercel rebuild - Wed Dec 31 22:20:27 JST 2025
