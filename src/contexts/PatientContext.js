import React, { createContext, useContext, useState, useEffect } from 'react';
import { patientService } from '../firebase/services';
import { useAuth } from './AuthContext';

const PatientContext = createContext(null);

export const usePatientContext = () => {
  const context = useContext(PatientContext);
  if (!context) {
    throw new Error('usePatientContext must be used within a PatientProvider');
  }
  return context;
};

export const PatientProvider = ({ children }) => {
  const { user } = useAuth();
  const [patientProfile, setPatientProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    if (!user) {
      setPatientProfile(null);
      setLoading(false);
      setNeedsOnboarding(false);
      return;
    }

    const loadPatient = async () => {
      try {
        setLoading(true);
        const patient = await patientService.getPatient(user.uid);
        
        if (!patient) {
          // Create initial skeleton record
          await patientService.savePatient(user.uid, {
            email: user.email,
            displayName: user.displayName || 'Patient',
            createdAt: new Date(),
            updatedAt: new Date(),
            profileComplete: false
          });
          setNeedsOnboarding(true);
          setPatientProfile(null);
        } else {
          setPatientProfile(patient);
          // Check if profile is complete (has diagnosis)
          if (!patient.diagnosis) {
            setNeedsOnboarding(true);
          } else {
            setNeedsOnboarding(false);
          }
        }
      } catch (error) {
        setPatientProfile(null);
      } finally {
        setLoading(false);
      }
    };

    loadPatient();
  }, [user]);

  const refreshPatient = async () => {
    if (!user) return;
    try {
      const patient = await patientService.getPatient(user.uid);
      setPatientProfile(patient);
    } catch (error) {
    }
  };

  const value = {
    patientProfile,
    setPatientProfile,
    loading,
    needsOnboarding,
    setNeedsOnboarding,
    refreshPatient
  };

  return (
    <PatientContext.Provider value={value}>
      {children}
    </PatientContext.Provider>
  );
};

