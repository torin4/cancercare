import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { PatientProvider } from './contexts/PatientContext';
import { HealthProvider } from './contexts/HealthContext';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AuthProvider>
      <PatientProvider>
        <HealthProvider>
          <App />
        </HealthProvider>
      </PatientProvider>
    </AuthProvider>
  </React.StrictMode>
);
// Force Vercel rebuild - Wed Dec 31 22:20:27 JST 2025
