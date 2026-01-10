/**
 * useFavoriteMetrics Hook
 * 
 * Custom hook for managing favorite metrics (labs/vitals).
 * Centralizes favorite metrics logic for use across LabsSection and VitalsSection.
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../../../../contexts/AuthContext';
import { usePatientContext } from '../../../../contexts/PatientContext';
import { useBanner } from '../../../../contexts/BannerContext';
import { patientService } from '../../../../firebase/services';

export function useFavoriteMetrics() {
  const { user } = useAuth();
  const { patientProfile, refreshPatient } = usePatientContext();
  const { showSuccess, showError } = useBanner();

  const [favoriteMetrics, setFavoriteMetrics] = useState({ labs: [], vitals: [] });

  // Load favorites from patient profile
  useEffect(() => {
    if (patientProfile) {
      setFavoriteMetrics(patientProfile.favoriteMetrics || { labs: [], vitals: [] });
    }
  }, [patientProfile]);

  // Toggle favorite metric
  const toggleFavorite = async (metricKey, type, validationFn = null) => {
    if (!user?.uid) return;

    const newFavorites = { ...favoriteMetrics };
    const typeArray = newFavorites[type] || [];

    if (typeArray.includes(metricKey)) {
      // Remove from favorites
      newFavorites[type] = typeArray.filter(key => key !== metricKey);
    } else {
      // Validate before adding (e.g., check if metric exists and has data)
      let validFavoritesCount = typeArray.length;
      if (validationFn) {
        validFavoritesCount = validationFn(typeArray);
      }

      // Check limit (default 6, can be overridden)
      if (validFavoritesCount >= 6) {
        const typeLabel = type === 'labs' ? 'labs' : 'vitals';
        showError(`Maximum 6 favorite ${typeLabel} allowed. Please remove one first.`);
        return;
      }

      // Add to favorites
      newFavorites[type] = [...typeArray, metricKey];
    }

    setFavoriteMetrics(newFavorites);

    try {
      await patientService.updateFavoriteMetrics(user.uid, newFavorites);
      if (newFavorites[type].includes(metricKey)) {
        showSuccess('Added to favorites');
      } else {
        showSuccess('Removed from favorites');
      }
      // Refresh patient profile to ensure context is updated
      await refreshPatient();
    } catch (error) {
      // Revert on error
      setFavoriteMetrics(favoriteMetrics);
      showError('Failed to update favorites');
    }
  };

  return {
    favoriteMetrics,
    toggleFavorite
  };
}
