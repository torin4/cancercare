import React, { createContext, useContext, useState, useEffect } from 'react';
import { labService, vitalService, genomicProfileService } from '../firebase/services';
import { transformLabsData, transformVitalsData } from '../utils/dataTransformUtils';
import { useAuth } from './AuthContext';

const HealthContext = createContext(null);

export const useHealthContext = () => {
  const context = useContext(HealthContext);
  if (!context) {
    throw new Error('useHealthContext must be used within a HealthProvider');
  }
  return context;
};

export const HealthProvider = ({ children }) => {
  const { user } = useAuth();
  const [labsData, setLabsData] = useState({});
  const [vitalsData, setVitalsData] = useState({});
  const [genomicProfile, setGenomicProfile] = useState(null);
  const [hasRealLabData, setHasRealLabData] = useState(false);
  const [hasRealVitalData, setHasRealVitalData] = useState(false);
  const [loading, setLoading] = useState(true);

  const reloadHealthData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Load data in parallel with cleanup (cleanup runs in background, doesn't block)
      const [labs, vitals, genomic] = await Promise.all([
        labService.getLabs(user.uid),
        vitalService.getVitals(user.uid),
        genomicProfileService.getGenomicProfile(user.uid)
      ]);
      
      const transformedLabs = await transformLabsData(labs);
      setLabsData(transformedLabs);
      setHasRealLabData(labs.length > 0);

      const transformedVitals = await transformVitalsData(vitals);
      setVitalsData(transformedVitals);
      const hasData = Object.values(transformedVitals).some(vital => 
        vital?.data && Array.isArray(vital.data) && vital.data.length > 0
      );
      setHasRealVitalData(hasData);

      setGenomicProfile(genomic || null);
      
      // NOTE: Automatic orphan cleanup is intentionally disabled here.
      // A transient read failure could incorrectly classify valid data as orphaned.
      // Cleanup should be triggered explicitly from controlled UI/service flows.
    } catch (error) {
      console.error('[HealthContext] Failed to reload health data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      setLabsData({});
      setVitalsData({});
      setGenomicProfile(null);
      setHasRealLabData(false);
      setHasRealVitalData(false);
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        setLoading(true);
        
        // Load data first (don't wait for cleanup)
        const [labs, vitals, genomic] = await Promise.all([
          labService.getLabs(user.uid),
          vitalService.getVitals(user.uid),
          genomicProfileService.getGenomicProfile(user.uid)
        ]);
        
        const transformedLabs = await transformLabsData(labs);
        setLabsData(transformedLabs);
        setHasRealLabData(labs.length > 0);

        const transformedVitals = await transformVitalsData(vitals);
        setVitalsData(transformedVitals);
        const hasData = Object.values(transformedVitals).some(vital => 
          vital?.data && Array.isArray(vital.data) && vital.data.length > 0
        );
        setHasRealVitalData(hasData);

        setGenomicProfile(genomic || null);
        
        // NOTE: Automatic orphan cleanup is intentionally disabled here.
        // A transient read failure could incorrectly classify valid data as orphaned.
        // Cleanup should be triggered explicitly from controlled UI/service flows.
      } catch (error) {
        console.error('[HealthContext] Failed to load health data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  const value = {
    labsData,
    setLabsData,
    vitalsData,
    setVitalsData,
    genomicProfile,
    setGenomicProfile,
    hasRealLabData,
    hasRealVitalData,
    loading,
    reloadHealthData
  };

  return (
    <HealthContext.Provider value={value}>
      {children}
    </HealthContext.Provider>
  );
};
