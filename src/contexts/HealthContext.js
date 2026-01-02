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
      
      // Clean up orphaned labs before loading (wait for completion to ensure cleanup happens)
      try {
        const orphanedCount = await labService.cleanupOrphanedLabs(user.uid);
        if (orphanedCount > 0) {
          console.log(`[HealthContext] Cleaned up ${orphanedCount} orphaned labs during reload`);
        }
      } catch (error) {
        console.warn('Error cleaning up orphaned labs:', error);
      }
      
      const labs = await labService.getLabs(user.uid);
      const transformedLabs = await transformLabsData(labs);
      setLabsData(transformedLabs);
      setHasRealLabData(labs.length > 0);

      const vitals = await vitalService.getVitals(user.uid);
      const transformedVitals = await transformVitalsData(vitals);
      setVitalsData(transformedVitals);
      const hasData = Object.values(transformedVitals).some(vital => 
        vital?.data && Array.isArray(vital.data) && vital.data.length > 0
      );
      setHasRealVitalData(hasData);

      // Reload genomic profile - explicitly set to null if not found
      const genomic = await genomicProfileService.getGenomicProfile(user.uid);
      setGenomicProfile(genomic || null);
    } catch (error) {
      console.error('Error reloading health data:', error);
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
        
        // Clean up orphaned labs before loading (wait for completion to ensure cleanup happens)
        try {
          const orphanedCount = await labService.cleanupOrphanedLabs(user.uid);
          if (orphanedCount > 0) {
            console.log(`[HealthContext] Cleaned up ${orphanedCount} orphaned labs during initial load`);
          }
        } catch (error) {
          console.warn('Error cleaning up orphaned labs:', error);
        }
        
        const labs = await labService.getLabs(user.uid);
        const transformedLabs = await transformLabsData(labs);
        setLabsData(transformedLabs);
        setHasRealLabData(labs.length > 0);

        const vitals = await vitalService.getVitals(user.uid);
        const transformedVitals = await transformVitalsData(vitals);
        setVitalsData(transformedVitals);
        const hasData = Object.values(transformedVitals).some(vital => 
          vital?.data && Array.isArray(vital.data) && vital.data.length > 0
        );
        setHasRealVitalData(hasData);

        // Reload genomic profile - explicitly set to null if not found
        const genomic = await genomicProfileService.getGenomicProfile(user.uid);
        setGenomicProfile(genomic || null);
      } catch (error) {
        console.error('Error loading health data:', error);
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

