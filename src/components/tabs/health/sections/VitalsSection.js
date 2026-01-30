/**
 * VitalsSection Component
 * 
 * Extracted from HealthTab to improve organization and maintainability.
 * This component handles all vitals-related functionality including:
 * - Vitals data display and charts
 * - Vitals search and filtering
 * - Adding/editing/deleting vitals and vital values
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Heart, Plus, Upload, Edit2, X, TrendingUp, TrendingDown, Minus, 
  Activity, Info, Clock, Check, AlertCircle, Trash2, MoreVertical, 
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Search, Eye, EyeOff, Star,
  MessageSquare
} from 'lucide-react';
import { DesignTokens, combineClasses } from '../../../../design/designTokens';
import { useAuth } from '../../../../contexts/AuthContext';
import { usePatientContext } from '../../../../contexts/PatientContext';
import { useHealthContext } from '../../../../contexts/HealthContext';
import { useBanner } from '../../../../contexts/BannerContext';
import { vitalService, patientService } from '../../../../firebase/services';
import { getVitalStatus, getWeightNormalRange } from '../../../../utils/healthUtils';
import { 
  normalizeVitalName, 
  getVitalDisplayName, 
  vitalDescriptions
} from '../../../../utils/normalizationUtils';
import AddVitalModal from '../../../modals/AddVitalModal';
import AddVitalValueModal from '../../../modals/AddVitalValueModal';
import EditVitalModal from '../../../modals/EditVitalModal';
import DeletionConfirmationModal from '../../../modals/DeletionConfirmationModal';
import { getTodayLocalDate, formatDateString, getCurrentDateTimeLocal } from '../../../../utils/helpers';
import { calculateYAxisBounds } from '../utils/chartUtils';

function VitalsSection({ 
  onTabChange,
  selectedDataPoint,
  setSelectedDataPoint,
  hoveredDataPoint,
  setHoveredDataPoint
}) {
  const { user } = useAuth();
  const { patientProfile } = usePatientContext();
  const { vitalsData, setVitalsData, hasRealVitalData, reloadHealthData } = useHealthContext();
  const { showSuccess, showError } = useBanner();

  // Vitals-specific state
  const [selectedVital, setSelectedVital] = useState('bp');
  const [showAddVital, setShowAddVital] = useState(false);
  const [showAddVitalValue, setShowAddVitalValue] = useState(false);
  const [selectedVitalForValue, setSelectedVitalForValue] = useState(null);
  const [newVitalValue, setNewVitalValue] = useState({ 
    value: '', 
    systolic: '', 
    diastolic: '', 
    dateTime: getCurrentDateTimeLocal(), 
    notes: '' 
  });
  const [isEditingVitalValue, setIsEditingVitalValue] = useState(false);
  const [editingVitalValueId, setEditingVitalValueId] = useState(null);
  const [newVital, setNewVital] = useState({ 
    vitalType: '', 
    value: '', 
    systolic: '', 
    diastolic: '', 
    dateTime: getCurrentDateTimeLocal(), 
    notes: '' 
  });
  const [isEditingVital, setIsEditingVital] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ 
    show: false, 
    title: '', 
    message: '', 
    onConfirm: null, 
    itemName: '', 
    confirmText: 'Yes, Delete Permanently' 
  });
  const [isDeletingVitalValue, setIsDeletingVitalValue] = useState(false);
  const [openDeleteMenu, setOpenDeleteMenu] = useState(null);
  const [editingVital, setEditingVital] = useState(null);
  const [editingVitalKey, setEditingVitalKey] = useState(null);
  const [favoriteMetrics, setFavoriteMetrics] = useState({ labs: [], vitals: [] });
  const [chartTimeRange, setChartTimeRange] = useState('30d'); // '7d' | '30d' | '90d' | 'all'

  const allVitalsData = vitalsData;

  // Filter vital data by selected time range
  const filterDataByTimeRange = (data) => {
    if (!data || data.length === 0 || chartTimeRange === 'all') return data || [];
    const now = Date.now();
    const msPerDay = 24 * 60 * 60 * 1000;
    const cutoff = now - (chartTimeRange === '7d' ? 7 : chartTimeRange === '30d' ? 30 : 90) * msPerDay;
    return data.filter((d) => {
      const ts = d.timestamp ?? (d.dateOriginal instanceof Date ? d.dateOriginal.getTime() : d.dateOriginal?.toDate?.()?.getTime?.());
      return ts != null && ts >= cutoff;
    });
  };

  // Load favorites from patient profile
  useEffect(() => {
    if (patientProfile) {
      setFavoriteMetrics(patientProfile.favoriteMetrics || { labs: [], vitals: [] });
    }
  }, [patientProfile]);


  // Toggle favorite metric
  const toggleFavorite = async (metricKey, type) => {
    if (!user || !user.uid) return;

    const newFavorites = { ...favoriteMetrics };
    const typeArray = newFavorites[type] || [];

    if (typeArray.includes(metricKey)) {
      // Remove from favorites
      newFavorites[type] = typeArray.filter(key => key !== metricKey);
    } else {
      // Check limit (max 6 favorites per type)
      let validFavoritesCount = typeArray.length;
      if (type === 'vitals') {
        validFavoritesCount = typeArray.filter(key => {
          const vital = allVitalsData[key];
          return vital && vital.data && vital.data.length > 0;
        }).length;
      }

      if (validFavoritesCount >= 6) {
        showError('Maximum 6 favorite metrics allowed. Please remove one first.');
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
    } catch (error) {
      showError('Failed to update favorites. Please try again.');
      setFavoriteMetrics(favoriteMetrics);
    }
  };

  // Auto-select first vital when data loads
  useEffect(() => {
    if (Object.keys(allVitalsData).length > 0) {
      if (!allVitalsData[selectedVital] || !allVitalsData[selectedVital].data || allVitalsData[selectedVital].data.length === 0) {
        const firstVital = Object.keys(allVitalsData).find(key => 
          allVitalsData[key].data && allVitalsData[key].data.length > 0
        );
        if (firstVital) {
          setSelectedVital(firstVital);
        }
      }
    }
  }, [allVitalsData, selectedVital]);

  // Get current vital
  const currentVital = allVitalsData[selectedVital] || {
    name: 'No Data',
    current: '--',
    unit: '',
    status: 'normal',
    trend: 'stable',
    normalRange: '--',
    data: []
  };

  return (
    <div className="space-y-4">
      {/* Empty State - No Vital Data */}
      {Object.keys(allVitalsData).length === 0 && (
        <div className={combineClasses(
          DesignTokens.components.card.container,
          DesignTokens.components.card.container,
          'text-center'
        )}>
          <div className="flex flex-col items-center gap-3">
            <Heart className={combineClasses('w-10 h-10 sm:w-12 sm:h-12', DesignTokens.colors.app.text[400])} />
            <div>
              <h3 className={combineClasses('text-base sm:text-lg font-semibold mb-1', DesignTokens.colors.app.text[900])}>No Vital Signs Data Yet</h3>
              <p className={combineClasses('text-xs sm:text-sm mb-4', DesignTokens.colors.app.text[700])}>
                Track blood pressure, heart rate, weight, and more
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => {
                    setIsEditingVital(false);
                    setShowAddVital(true);
                  }}
                  className={combineClasses(DesignTokens.components.button.outline.primary, DesignTokens.spacing.button.full, 'py-2.5 text-sm font-medium', DesignTokens.spacing.gap.sm, 'min-h-[44px] touch-manipulation active:opacity-70')}
                >
                  <Edit2 className="w-4 h-4" />
                  Manual Enter
                </button>
                <button
                  onClick={() => onTabChange('chat')}
                  className={combineClasses("px-4 py-2.5 rounded-lg text-sm font-medium transition shadow-sm flex items-center justify-center gap-2 min-h-[44px] touch-manipulation active:opacity-90", DesignTokens.colors.primary[500], 'text-white', DesignTokens.colors.primary[600].replace('bg-', 'hover:bg-'))}
                >
                  <MessageSquare className="w-4 h-4" />
                  Add via Chat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Show data if available */}
      {Object.keys(allVitalsData).length > 0 && (
      <>

      {/* Vital Trend Chart */}
      <div className={combineClasses(
      DesignTokens.components.card.container,
      DesignTokens.borders.card
      )}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
      <h2 className={combineClasses('text-base sm:text-lg font-semibold', DesignTokens.colors.neutral.text[900])}>Vital Signs</h2>
      <div className="flex items-center gap-2 w-full sm:w-auto">
      {Object.keys(allVitalsData).length > 0 ? (
      <>
      <select
      value={selectedVital}
      onChange={(e) => setSelectedVital(e.target.value)}
      className={combineClasses("text-sm border rounded-lg px-2 sm:px-3 py-2 sm:py-1.5 focus:ring-2 focus:ring-green-500 min-h-[44px] w-full sm:w-auto touch-manipulation", DesignTokens.colors.neutral.border[300])}
      >
      {(() => {
      // Organize vitals by category
      const vitalCategoryMap = {
      'blood_pressure': 'Cardiovascular',
      'heart_rate': 'Cardiovascular',
      'oxygen_saturation': 'Respiratory',
      'respiratory_rate': 'Respiratory',
      'temperature': 'General',
      'weight': 'Metabolic'
      };

      // Group vitals by category
      const vitalsByCategory = {};
      Object.keys(allVitalsData).forEach(key => {
      const vital = allVitalsData[key];
      const canonicalKey = normalizeVitalName(key) || key.toLowerCase();
      const category = vitalCategoryMap[canonicalKey] || 'General';

      if (!vitalsByCategory[category]) {
      vitalsByCategory[category] = [];
      }
      vitalsByCategory[category].push({
      key,
      displayName: getVitalDisplayName(vital.name || key)
      });
      });

      // Sort categories by predefined order
      const categoryOrder = [
      'Cardiovascular', 'Respiratory', 'Metabolic', 'General'
      ];

      // Render optgroups
      return categoryOrder
      .filter(cat => vitalsByCategory[cat] && vitalsByCategory[cat].length > 0)
      .map(category => (
      <optgroup key={category} label={category}>
      {vitalsByCategory[category]
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
      .map(({ key, displayName }) => (
      <option key={key} value={key}>{displayName}</option>
      ))}
      </optgroup>
      ));
      })()}
      </select>
      <button
      onClick={() => toggleFavorite(selectedVital, 'vitals')}
      className={combineClasses("transition-colors p-2 min-h-[44px] min-w-[44px] flex items-center justify-center", DesignTokens.colors.accent.text[500], DesignTokens.colors.accent.text[600])}
      title={favoriteMetrics.vitals?.includes(selectedVital) ? "Remove from favorites" : "Add to favorites"}
      >
      <Star className={combineClasses(
      DesignTokens.icons.button.size.full,
      favoriteMetrics.vitals?.includes(selectedVital) 
      ? DesignTokens.components.favorite.filled 
      : DesignTokens.components.favorite.unfilled
      )} />
      </button>
      </>
      ) : (
      <div className={combineClasses("text-sm", DesignTokens.colors.neutral.text[500])}>No vitals available</div>
      )}
      </div>
      </div>

      {/* Chart time range filter */}
      {Object.keys(allVitalsData).length > 0 && allVitalsData[selectedVital]?.data?.length > 0 && (
        <div className="flex items-center gap-1 mb-3">
          <span className={combineClasses("text-xs font-medium", DesignTokens.colors.neutral.text[600])}>Show:</span>
          {[
            { value: '7d', label: '7 days' },
            { value: '30d', label: '1 month' },
            { value: '90d', label: '3 months' },
            { value: 'all', label: 'All' }
          ].map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setChartTimeRange(value)}
              className={combineClasses(
                "px-2.5 py-1 text-xs rounded-md transition-colors min-h-[32px] touch-manipulation",
                chartTimeRange === value
                  ? 'bg-anchor-900 text-white'
                  : combineClasses('border', DesignTokens.colors.neutral.border[300], 'hover:bg-medical-neutral-50', DesignTokens.colors.neutral.text[700])
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {(() => {
      const currentVital = allVitalsData[selectedVital] || {
      name: 'No Data',
      current: '--',
      unit: '',
      status: 'normal',
      data: []
      };

      const chartData = filterDataByTimeRange(currentVital?.data || []);

      if (!currentVital || !currentVital.data || currentVital.data.length === 0) {
      return (
      <div className={combineClasses("text-center py-8", DesignTokens.colors.neutral.text[500])}>
      <p>No vital data available for {getVitalDisplayName(selectedVital)}</p>
      <button
      onClick={() => onTabChange('chat')}
      className={combineClasses(DesignTokens.components.button.primary, DesignTokens.spacing.button.full, 'py-2 mt-4')}
      >
      Go to Chat to Add Data
      </button>
      </div>
      );
      }

      if (chartData.length === 0) {
      return (
      <div className={combineClasses("text-center py-8", DesignTokens.colors.neutral.text[500])}>
      <p>No data in selected time range. Try &quot;All&quot; or a longer range.</p>
      </div>
      );
      }

      return (
      <>
      <div className="mb-4">
      <div className="flex items-baseline gap-2 mb-1">
      <span className={combineClasses('text-2xl sm:text-3xl font-bold', DesignTokens.colors.neutral.text[900])}>{currentVital.current}</span>
      <span className={combineClasses('text-sm', DesignTokens.colors.neutral.text[600])}>{currentVital.unit}</span>
      {(() => {
      const normalRange = currentVital.normalRange || (() => {
      const age = patientProfile.age || (patientProfile.dateOfBirth ? Math.floor((new Date() - new Date(patientProfile.dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000)) : null);
      const normalizedKey = normalizeVitalName(selectedVital) || selectedVital.toLowerCase();

      switch (normalizedKey) {
      case 'blood_pressure':
      case 'bp':
      return age && age < 18 ? '<120/80' : '<140/90';
      case 'heart_rate':
      case 'hr':
      if (age) {
      if (age < 1) return '100-160';
      if (age < 3) return '90-150';
      if (age < 10) return '70-120';
      if (age < 18) return '60-100';
      }
      return '60-100';
      case 'temperature':
      case 'temp':
      return '97.5-99.5';
      case 'weight':
      // Calculate weight normal range based on BMI (18.5-24.9) using height
      if (patientProfile.height) {
      return getWeightNormalRange(patientProfile.height, patientProfile.gender);
      }
      return null;
      case 'oxygen_saturation':
      case 'o2sat':
      case 'spo2':
      return '>95';
      case 'respiratory_rate':
      case 'rr':
      if (age) {
      if (age < 1) return '30-60';
      if (age < 3) return '24-40';
      if (age < 12) return '20-30';
      }
      return '12-20';
      default: return null;
      }
      })();
      const vitalStatus = getVitalStatus(currentVital.current, normalRange, selectedVital);
      const statusColors = {
      green: DesignTokens.components.status.normal.text,
      yellow: DesignTokens.components.status.low.text,
      red: DesignTokens.components.status.high.text,
      gray: DesignTokens.colors.neutral.text[700]
      };
      return (
      <span className={`ml-auto text-xs ${statusColors[vitalStatus.color] || statusColors.gray}`}>
      {vitalStatus.label}
      </span>
      );
      })()}
      </div>
      <p className={combineClasses("text-xs sm:text-sm", DesignTokens.colors.neutral.text[600])}>
      Normal range: {(() => {
      const normalRange = currentVital.normalRange || (() => {
      // Fallback to default normal ranges if not set
      const age = patientProfile.age || (patientProfile.dateOfBirth ? Math.floor((new Date() - new Date(patientProfile.dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000)) : null);
      // Normalize the vital key to handle both short and canonical keys
      const normalizedKey = normalizeVitalName(selectedVital) || selectedVital.toLowerCase();

      switch (normalizedKey) {
      case 'blood_pressure':
      case 'bp':
      return age && age < 18 ? '<120/80' : '<140/90';
      case 'heart_rate':
      case 'hr':
      if (age) {
      if (age < 1) return '100-160';
      if (age < 3) return '90-150';
      if (age < 10) return '70-120';
      if (age < 18) return '60-100';
      }
      return '60-100';
      case 'temperature':
      case 'temp':
      return '97.5-99.5';
      case 'weight':
      // Calculate weight normal range based on BMI (18.5-24.9) using height
      if (patientProfile.height) {
      return getWeightNormalRange(patientProfile.height, patientProfile.gender);
      }
      return null;
      case 'oxygen_saturation':
      case 'o2sat':
      case 'spo2':
      return '>95';
      case 'respiratory_rate':
      case 'rr':
      if (age) {
      if (age < 1) return '30-60';
      if (age < 3) return '24-40';
      if (age < 12) return '20-30';
      }
      return '12-20';
      default: return 'N/A';
      }
      })();
      return normalRange ? `${normalRange} ${currentVital.unit}` : 'N/A';
      })()}
      </p>
      </div>

      {/* Chart - Responsive with Y-axis and hover tooltips */}
      <div className="flex gap-2 sm:gap-3">
      {/* Y-axis labels */}
      <div className={combineClasses("flex flex-col justify-between text-xs font-medium py-2", DesignTokens.colors.neutral.text[600])} style={{ paddingBottom: '1.5rem' }}>
      {(() => {
      // Filter out non-numeric values and ensure we have valid numbers
      const values = chartData
      .map(d => {
      if (selectedVital === 'bp' || selectedVital === 'bloodpressure') {
      return parseFloat(d.systolic || d.value);
      }
      return parseFloat(d.value);
      })
      .filter(v => !isNaN(v) && isFinite(v));

      if (values.length === 0) {
      return <div className="text-right pr-2 w-10">--</div>;
      }

      let minVal = Math.min(...values);
      let maxVal = Math.max(...values);

      // Parse normal range if available (formats: "0-35", "24.0-34.0", "< 0.5", "> 60")
      if (currentVital.normalRange) {
      // Try standard range format "X-Y"
      let rangeMatch = currentVital.normalRange.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/);
      if (rangeMatch) {
      const normMin = parseFloat(rangeMatch[1]);
      const normMax = parseFloat(rangeMatch[2]);
      if (!isNaN(normMin) && !isNaN(normMax)) {
      minVal = Math.min(minVal, normMin);
      maxVal = Math.max(maxVal, normMax);
      }
      } else {
      // Try "< X" format
      const lessThanMatch = currentVital.normalRange.match(/<\s*(\d+\.?\d*)/);
      if (lessThanMatch) {
      const threshold = parseFloat(lessThanMatch[1]);
      if (!isNaN(threshold)) {
      minVal = Math.min(minVal, 0);
      maxVal = Math.max(maxVal, threshold);
      }
      } else {
      // Try "> X" format
      const greaterThanMatch = currentVital.normalRange.match(/>\s*(\d+\.?\d*)/);
      if (greaterThanMatch) {
      const threshold = parseFloat(greaterThanMatch[1]);
      if (!isNaN(threshold)) {
      minVal = Math.min(minVal, threshold);
      }
      }
      }
      }
      }

      const range = maxVal - minVal;
      const padding = range * 0.2 || 10; // Fallback if range is 0
      const yMin = Math.floor(minVal - padding);
      const yMax = Math.ceil(maxVal + padding);
      const step = (yMax - yMin) / 4;

      return [4, 3, 2, 1, 0].map(i => (
      <div key={i} className="text-right pr-2 w-10" style={{ lineHeight: '1' }}>
      {(yMin + (step * i)).toFixed(maxVal > 100 ? 0 : 1)}
      </div>
      ));
      })()}
      </div>

      {/* Chart area */}
      <div className="flex-1">
      <div className="relative h-40 mb-3">
      {/* Horizontal grid lines */}
      <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
      {[0, 1, 2, 3, 4].map(i => (
      <div key={i} className={combineClasses("border-t", DesignTokens.colors.neutral.border[200])}></div>
      ))}
      </div>

      {/* SVG Graph */}
      {(() => {
      // Filter out non-numeric values and ensure we have valid numbers
      const values = chartData
      .map(d => {
      if (selectedVital === 'bp' || selectedVital === 'bloodpressure') {
      return parseFloat(d.systolic || d.value);
      }
      return parseFloat(d.value);
      })
      .filter(v => !isNaN(v) && isFinite(v));

      if (values.length === 0) {
      return (
      <div className={combineClasses("flex items-center justify-center h-full", DesignTokens.colors.neutral.text[300])}>
      <p>No numeric data available for charting</p>
      </div>
      );
      }

      let minVal = Math.min(...values);
      let maxVal = Math.max(...values);

      // Get normal range (calculate if not set, especially for weight)
      const normalRangeForChart = currentVital.normalRange || (() => {
      const age = patientProfile.age || (patientProfile.dateOfBirth ? Math.floor((new Date() - new Date(patientProfile.dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000)) : null);
      // Normalize the vital key to handle both short and canonical keys
      const normalizedKey = normalizeVitalName(selectedVital) || selectedVital.toLowerCase();

      switch (normalizedKey) {
      case 'blood_pressure':
      case 'bp':
      return age && age < 18 ? '<120/80' : '<140/90';
      case 'heart_rate':
      case 'hr':
      if (age) {
      if (age < 1) return '100-160';
      if (age < 3) return '90-150';
      if (age < 10) return '70-120';
      if (age < 18) return '60-100';
      }
      return '60-100';
      case 'temperature':
      case 'temp':
      return '97.5-99.5';
      case 'weight':
      // Calculate weight normal range based on BMI (18.5-24.9) using height
      if (patientProfile.height) {
      return getWeightNormalRange(patientProfile.height, patientProfile.gender);
      }
      return null;
      case 'oxygen_saturation':
      case 'o2sat':
      case 'spo2':
      return '>95';
      case 'respiratory_rate':
      case 'rr':
      if (age) {
      if (age < 1) return '30-60';
      if (age < 3) return '24-40';
      if (age < 12) return '20-30';
      }
      return '12-20';
      default: return null;
      }
      })();

      // Parse normal range if available
      if (normalRangeForChart) {
      // Special handling for blood pressure format "<140/90"
      const bpMatch = normalRangeForChart.match(/<\s*(\d+)\/(\d+)/);
      if (bpMatch && (selectedVital === 'bp' || selectedVital === 'blood_pressure')) {
      // For BP, use the systolic threshold (first number)
      const threshold = parseFloat(bpMatch[1]);
      if (!isNaN(threshold)) {
      minVal = Math.min(minVal, 0);
      maxVal = Math.max(maxVal, threshold);
      }
      } else {
      // Try standard range format "X-Y"
      let rangeMatch = normalRangeForChart.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/);
      if (rangeMatch) {
      const normMin = parseFloat(rangeMatch[1]);
      const normMax = parseFloat(rangeMatch[2]);
      if (!isNaN(normMin) && !isNaN(normMax)) {
      minVal = Math.min(minVal, normMin);
      maxVal = Math.max(maxVal, normMax);
      }
      } else {
      // Try "< X" format (single number, not BP)
      const lessThanMatch = normalRangeForChart.match(/<\s*(\d+\.?\d*)/);
      if (lessThanMatch) {
      const threshold = parseFloat(lessThanMatch[1]);
      if (!isNaN(threshold)) {
      minVal = Math.min(minVal, 0);
      maxVal = Math.max(maxVal, threshold);
      }
      } else {
      // Try "> X" format
      const greaterThanMatch = normalRangeForChart.match(/>\s*(\d+\.?\d*)/);
      if (greaterThanMatch) {
      const threshold = parseFloat(greaterThanMatch[1]);
      if (!isNaN(threshold)) {
      // For "> X" format, include threshold in Y-axis bounds if it's close to data
      // Only adjust if threshold is within reasonable range of the data
      if (threshold >= minVal * 0.8 && threshold <= maxVal * 1.2) {
      minVal = Math.min(minVal, threshold * 0.95);
      maxVal = Math.max(maxVal, threshold * 1.05);
      }
      }
      }
      }
      }
      }
      }

      const range = maxVal - minVal;
      const padding = range * 0.2 || 10; // Fallback if range is 0
      const yMin = Math.floor(minVal - padding);
      const yMax = Math.ceil(maxVal + padding);
      const yRange = yMax - yMin || 1; // Prevent division by zero

      return (
      <>
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 400 160" preserveAspectRatio="none">
      <defs>
      <linearGradient id={`gradient-vital-${selectedVital}`} x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
      <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05" />
      </linearGradient>
      </defs>

      {/* Normal range boundaries (if available) */}
      {(() => {
      // Use the normal range calculated earlier for Y-axis
      const normalRange = normalRangeForChart;

      if (!normalRange) return null;

      return (() => {
      // Special handling for blood pressure format "<140/90"
      const bpMatch = normalRange.match(/<\s*(\d+)\/(\d+)/);
      if (bpMatch && (selectedVital === 'bp' || selectedVital === 'blood_pressure')) {
      // For BP, we show the systolic threshold (first number)
      const threshold = parseFloat(bpMatch[1]);
      if (!isNaN(threshold) && isFinite(threshold)) {
      const thresholdY = 160 - ((threshold - yMin) / yRange) * 160;
      return (
      <>
      {/* Shaded area below threshold */}
      <rect
      x="0"
      y={thresholdY}
      width="400"
      height={160 - thresholdY}
      fill="#3b82f6"
      opacity="0.08"
      />
      {/* Threshold line */}
      <line x1="0" y1={thresholdY} x2="400" y2={thresholdY} stroke="#3b82f6" strokeWidth="1" strokeDasharray="4,4" opacity="0.4" />
      </>
      );
      }
      }

      // Try standard range format "X-Y"
      let rangeMatch = normalRange.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/);
      if (rangeMatch) {
      const normMin = parseFloat(rangeMatch[1]);
      const normMax = parseFloat(rangeMatch[2]);
      if (!isNaN(normMin) && !isNaN(normMax) && isFinite(normMin) && isFinite(normMax)) {
      const normMinY = 160 - ((normMin - yMin) / yRange) * 160;
      const normMaxY = 160 - ((normMax - yMin) / yRange) * 160;
      return (
      <>
      {/* Normal range shaded area */}
      <rect
      x="0"
      y={normMaxY}
      width="400"
      height={normMinY - normMaxY}
      fill="#3b82f6"
      opacity="0.08"
      />
      {/* Normal range boundary lines */}
      <line x1="0" y1={normMinY} x2="400" y2={normMinY} stroke="#3b82f6" strokeWidth="1" strokeDasharray="4,4" opacity="0.4" />
      <line x1="0" y1={normMaxY} x2="400" y2={normMaxY} stroke="#3b82f6" strokeWidth="1" strokeDasharray="4,4" opacity="0.4" />
      </>
      );
      }
      } else {
      // Try "< X" format (single number, not BP)
      const lessThanMatch = normalRange.match(/<\s*(\d+\.?\d*)/);
      if (lessThanMatch) {
      const threshold = parseFloat(lessThanMatch[1]);
      if (!isNaN(threshold) && isFinite(threshold)) {
      const thresholdY = 160 - ((threshold - yMin) / yRange) * 160;
      return (
      <>
      {/* Shaded area below threshold */}
      <rect
      x="0"
      y={thresholdY}
      width="400"
      height={160 - thresholdY}
      fill="#3b82f6"
      opacity="0.08"
      />
      {/* Threshold line */}
      <line x1="0" y1={thresholdY} x2="400" y2={thresholdY} stroke="#3b82f6" strokeWidth="1" strokeDasharray="4,4" opacity="0.4" />
      </>
      );
      }
      } else {
      // Try "> X" format
      const greaterThanMatch = normalRange.match(/>\s*(\d+\.?\d*)/);
      if (greaterThanMatch) {
      const threshold = parseFloat(greaterThanMatch[1]);
      if (!isNaN(threshold) && isFinite(threshold)) {
      const thresholdY = 160 - ((threshold - yMin) / yRange) * 160;
      // Only show if threshold is within visible range
      if (thresholdY >= 0 && thresholdY <= 160) {
      return (
      <>
      {/* Shaded area above threshold */}
      <rect
      x="0"
      y="0"
      width="400"
      height={thresholdY}
      fill="#3b82f6"
      opacity="0.08"
      />
      {/* Threshold line */}
      <line x1="0" y1={thresholdY} x2="400" y2={thresholdY} stroke="#3b82f6" strokeWidth="1" strokeDasharray="4,4" opacity="0.4" />
      </>
      );
      }
      }
      }
      }
      }
      return null;
      })();
      })()}

      {/* Area under line */}
      <polygon
      points={(() => {
      const dataLength = Math.max(chartData.length - 1, 1); // Prevent division by zero
      const topPoints = chartData.map((d, i) => {
      const val = (selectedVital === 'bp' || selectedVital === 'bloodpressure') ? (d.systolic || d.value) : d.value;
      const numVal = parseFloat(val);
      // Only include valid numeric values
      if (isNaN(numVal) || !isFinite(numVal)) {
        return null;
      }
      const y = 160 - ((numVal - yMin) / yRange) * 160;
      // Ensure y is a valid number
      if (isNaN(y) || !isFinite(y)) {
        return null;
      }
      return `${(i / dataLength) * 400},${y}`;
      }).filter(Boolean).join(' ');
      return `${topPoints} 400,160 0,160`;
      })()}
      fill={`url(#gradient-vital-${selectedVital})`}
      />

      {/* Line */}
      <polyline
      points={(() => {
      const dataLength = Math.max(chartData.length - 1, 1); // Prevent division by zero
      return chartData.map((d, i) => {
      const val = (selectedVital === 'bp' || selectedVital === 'bloodpressure') ? (d.systolic || d.value) : d.value;
      const numVal = parseFloat(val);
      // Only include valid numeric values
      if (isNaN(numVal) || !isFinite(numVal)) {
        return null;
      }
      const y = 160 - ((numVal - yMin) / yRange) * 160;
      // Ensure y is a valid number
      if (isNaN(y) || !isFinite(y)) {
        return null;
      }
      return `${(i / dataLength) * 400},${y}`;
      }).filter(Boolean).join(' ');
      })()}
      fill="none"
      stroke="#3b82f6"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      shapeRendering="geometricPrecision"
      vectorEffect="non-scaling-stroke"
      />
      </svg>

      {/* Interactive data points with tooltips */}
      {chartData.map((d, i) => {
      const dataLength = Math.max(chartData.length - 1, 1); // Prevent division by zero
      // Check if this is an "all day" entry (time is midnight or isAllDay flag is set)
      const isAllDay = d.isAllDay || (d.time === '00:00' || d.time === '00:00:00') || false;
      const val = (selectedVital === 'bp' || selectedVital === 'bloodpressure') ? (d.systolic || d.value) : d.value;
      const displayValue = (selectedVital === 'bp' || selectedVital === 'bloodpressure') 
      ? `${d.systolic || d.value}/${d.diastolic || ''}` 
      : d.value;
      const x = (i / dataLength) * 100;
      const y = ((parseFloat(val) - yMin) / yRange) * 100;
      const isLatest = i === chartData.length - 1;

      // Get normal range for status calculation
      const normalRange = currentVital.normalRange || (() => {
      const age = patientProfile.age || (patientProfile.dateOfBirth ? Math.floor((new Date() - new Date(patientProfile.dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000)) : null);
      const normalizedKey = normalizeVitalName(selectedVital) || selectedVital.toLowerCase();

      switch (normalizedKey) {
      case 'blood_pressure':
      case 'bp':
      return age && age < 18 ? '<120/80' : '<140/90';
      case 'heart_rate':
      case 'hr':
      if (age) {
      if (age < 1) return '100-160';
      if (age < 3) return '90-150';
      if (age < 10) return '70-120';
      if (age < 18) return '60-100';
      }
      return '60-100';
      case 'temperature':
      case 'temp':
      return '97.5-99.5';
      case 'weight':
      // Calculate weight normal range based on BMI (18.5-24.9) using height
      if (patientProfile.height) {
      return getWeightNormalRange(patientProfile.height, patientProfile.gender);
      }
      return null;
      case 'oxygen_saturation':
      case 'o2sat':
      case 'spo2':
      return '>95';
      case 'respiratory_rate':
      case 'rr':
      if (age) {
      if (age < 1) return '30-60';
      if (age < 3) return '24-40';
      if (age < 12) return '20-30';
      }
      return '12-20';
      default: return null;
      }
      })();

      const vitalStatus = getVitalStatus(displayValue, normalRange, selectedVital);
      const statusColors = {
      green: '#10b981',
      yellow: '#f59e0b',
      red: '#ef4444',
      gray: '#6b7280'
      };
      const dotColor = statusColors[vitalStatus.color] || statusColors.gray;
      const statusBadgeColors = {
      green: combineClasses(DesignTokens.components.status.normal.bg, DesignTokens.components.status.normal.text),
      yellow: combineClasses(DesignTokens.components.status.low.bg, DesignTokens.components.status.low.text),
      red: combineClasses(DesignTokens.components.status.high.bg, DesignTokens.components.status.high.text),
      gray: combineClasses(DesignTokens.colors.neutral[100], DesignTokens.colors.neutral.text[700])
      };

      const isVitalSelected = selectedDataPoint === `${selectedVital}-${d.id}`;
      const vitalPointKey = `${selectedVital}-${d.id}`;
      const isVitalHovered = hoveredDataPoint === vitalPointKey;
      return (
      <div
      key={i}
      className="absolute group vital-chart-point"
      style={{
      left: `${x}%`,
      bottom: `${y}%`,
      transform: 'translate(-50%, 50%)',
      zIndex: isVitalSelected ? 30 : (isVitalHovered ? 25 : 10)
      }}
      onMouseEnter={() => setHoveredDataPoint(vitalPointKey)}
      onMouseLeave={() => setHoveredDataPoint(null)}
      >
      {/* Touch/Click area - larger on mobile */}
      <div
      className="absolute inset-0 w-12 h-12 sm:w-10 sm:h-10 -m-6 sm:-m-5 cursor-pointer touch-manipulation vital-chart-point-click-area"
      style={{ zIndex: 20 }}
      onClick={(e) => {
      e.stopPropagation();
      e.preventDefault();
      e.nativeEvent.stopImmediatePropagation();
      // Use functional update to ensure we're working with latest state
      // This prevents race conditions with double-click/touch events
      setSelectedDataPoint(prev => {
        if (prev === vitalPointKey) {
          return null; // Toggle off if already selected
        }
        return vitalPointKey; // Select this point
      });
      }}
      onTouchEnd={(e) => {
      // Prevent click event from also firing on touch devices
      e.preventDefault();
      }}
      />

      {/* Outer ring on hover or when selected */}
      <div
      className={`absolute inset-0 rounded-full transition-all ${
      isVitalSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
      }`}
      style={{
      width: '20px',
      height: '20px',
      margin: '-10px',
      border: `2px solid ${dotColor}`,
      backgroundColor: `${dotColor}20`
      }}
      />

      {/* Data point dot */}
      <div
      className={`rounded-full transition-all relative z-10 ${
      isVitalSelected || isLatest ? 'scale-125' : 'group-hover:scale-125'
      } ${isLatest ? 'w-3.5 h-3.5' : 'w-3 h-3'}`}
      style={{
      backgroundColor: dotColor,
      border: '2px solid white',
      boxShadow: isLatest
      ? '0 2px 8px rgba(0,0,0,0.25)'
      : '0 1px 4px rgba(0,0,0,0.15)'
      }}
      />

      {/* Tooltip with edit and delete buttons - show on hover or when selected */}
      <div 
      className={`absolute ${
      isVitalSelected ? 'opacity-100 pointer-events-auto' : 'opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto'
      } transition-opacity ${
      y > 70 ? 'bottom-full mb-4' : 'top-full mt-4'
      } ${
      x < 10 ? 'left-0' : x > 90 ? 'right-0' : 'left-1/2 transform -translate-x-1/2'
      }`}
      style={{ zIndex: 30 }}
      >
      <div className={combineClasses("text-xs rounded-lg py-2 px-3 shadow-xl whitespace-nowrap tooltip-container", DesignTokens.colors.neutral[900], 'text-white')}>
      <div className="flex items-center justify-between gap-3">
      <div>
      <div className="font-bold text-sm">
      {displayValue} {currentVital.unit}
      </div>
      <div className={combineClasses("text-xs mt-0.5", DesignTokens.colors.neutral.text[300])}>{d.date}</div>
      </div>
      {d.id && (
      <div className="flex items-center gap-2">
      <button
      onClick={(e) => {
      e.stopPropagation();
      e.preventDefault();
      setSelectedDataPoint(null);
      const currentVitalDoc = allVitalsData[selectedVital];
      if (currentVitalDoc && currentVitalDoc.id) {
      // Pre-fill with existing value data
      const valueData = currentVital.data.find(item => item.id === d.id);
      // Extract date from various possible formats, using local time to avoid timezone shift
      let dateTimeValue = getCurrentDateTimeLocal();

      // Get the date value (prioritize dateOriginal, then date)
      let dateValue = valueData?.dateOriginal || valueData?.date;

      if (dateValue) {
      let dateObj = null;

      // Check for Firestore Timestamp (has toDate method)
      if (dateValue && typeof dateValue.toDate === 'function') {
      const firestoreDate = dateValue.toDate();
      // Use local date components to avoid timezone shift
      dateObj = new Date(firestoreDate.getFullYear(), firestoreDate.getMonth(), firestoreDate.getDate(), firestoreDate.getHours(), firestoreDate.getMinutes());
      }
      // Check for timestamp (number)
      else if (valueData?.timestamp) {
      const dateFromTimestamp = new Date(valueData.timestamp);
      dateObj = new Date(dateFromTimestamp.getFullYear(), dateFromTimestamp.getMonth(), dateFromTimestamp.getDate(), dateFromTimestamp.getHours(), dateFromTimestamp.getMinutes());
      }
      // Check for date as Date object
      else if (dateValue instanceof Date) {
      dateObj = new Date(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate(), dateValue.getHours(), dateValue.getMinutes());
      }
      // Check for date as string
      else if (typeof dateValue === 'string') {
      const parsed = new Date(dateValue);
      if (!isNaN(parsed.getTime())) {
      dateObj = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), parsed.getHours(), parsed.getMinutes());
      }
      }

      if (dateObj && !isNaN(dateObj.getTime())) {
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      const hours = String(dateObj.getHours()).padStart(2, '0');
      const minutes = String(dateObj.getMinutes()).padStart(2, '0');
      dateTimeValue = `${year}-${month}-${day}T${hours}:${minutes}`;
      }
      }
      const displayName = getVitalDisplayName(currentVitalDoc.name || selectedVital);
      setSelectedVitalForValue({ 
      id: currentVitalDoc.id, 
      name: displayName, 
      unit: currentVitalDoc.unit, 
      key: selectedVital,
      vitalType: selectedVital
      });
      setNewVitalValue({ 
      value: valueData?.value || '', 
      systolic: valueData?.systolic || '', 
      diastolic: valueData?.diastolic || '', 
      dateTime: dateTimeValue, 
      notes: valueData?.notes || '' 
      });
      setEditingVitalValueId(d.id); // Store the value ID being edited
      setIsEditingVitalValue(true);
      setShowAddVitalValue(true);
      }
      }}
      onTouchStart={(e) => {
      e.stopPropagation();
      e.preventDefault();
      }}
      className={combineClasses("transition-colors p-2.5 sm:p-2 rounded flex-shrink-0 min-h-[48px] min-w-[48px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center touch-manipulation", DesignTokens.colors.primary.text[500], DesignTokens.colors.primary.text[300], DesignTokens.colors.primary.text[200], combineClasses('hover:bg-opacity-20', DesignTokens.colors.primary[900]), combineClasses('active:bg-opacity-30', DesignTokens.colors.primary[900]))}
      title="Edit this reading"
      >
      <Edit2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
      </button>
      <button
      onClick={(e) => {
      e.stopPropagation();
      // Capture values in closure
      const vitalValueId = d.id;
      const vitalKey = selectedVital;
      const vitalDoc = allVitalsData[selectedVital];
      const vitalDocId = vitalDoc?.id;
      const displayName = getVitalDisplayName(currentVital.name || selectedVital);
      const valueDisplay = selectedVital === 'bp' || selectedVital === 'bloodpressure' 
      ? `${d.systolic || d.value}/${d.diastolic || ''}`
      : d.value;
      const vitalUnit = currentVital.unit;
      const vitalDate = d.date;

      if (!vitalDocId) {
      showError('Vital document ID not found. Please try again.');
      return;
      }

      setDeleteConfirm({
      show: true,
      title: `Delete ${displayName} Reading?`,
      message: `This will permanently delete this ${displayName} reading (${valueDisplay} ${vitalUnit} on ${vitalDate}).`,
      itemName: `${displayName} reading`,
      confirmText: 'Yes, Delete',
      onConfirm: async () => {
      setIsDeletingVitalValue(true);
      try {

      // Optimistically update UI immediately
      const updatedVitalsData = { ...vitalsData };
      if (updatedVitalsData[vitalKey] && updatedVitalsData[vitalKey].data) {
      const filteredData = updatedVitalsData[vitalKey].data.filter(item => item.id !== vitalValueId);
      // Get most recent value (first item after sorting by timestamp)
      const sortedData = [...filteredData].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      updatedVitalsData[vitalKey] = {
      ...updatedVitalsData[vitalKey],
      data: filteredData,
      current: sortedData.length > 0 ? sortedData[0].value : '--'
      };
      setVitalsData(updatedVitalsData);
      }

      // Delete from Firestore in background
      // Verify user is authenticated before deletion
      if (!user || !user.uid) {
      throw new Error('User not authenticated');
      }


      await vitalService.deleteVitalValue(vitalDocId, vitalValueId);


      // Check if vital is now orphaned (no values left) and clean it up
      try {
      const remainingValues = await vitalService.getVitalValues(vitalDocId);
      if (!remainingValues || remainingValues.length === 0) {
      await vitalService.deleteVital(vitalDocId);
      }
      } catch (cleanupError) {
      }

      // Reload health data to ensure UI matches database state
      // deleteVitalValue now clears currentValue when last value is deleted, preventing reappearance
      await reloadHealthData();

      // Show success banner
      showSuccess(`${displayName} reading deleted successfully`);
      
      // Close the modal after successful deletion
      setDeleteConfirm({ ...deleteConfirm, show: false });
      } catch (error) {
      // Revert optimistic update on error
      reloadHealthData();
      showError('Failed to delete vital reading. Please try again.');
      // Close the modal even on error
      setDeleteConfirm({ ...deleteConfirm, show: false });
      } finally {
      setIsDeletingVitalValue(false);
      }
      }
      });
      }}
      className={combineClasses("transition-colors p-2 rounded flex-shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation active:opacity-70", DesignTokens.components.status.high.text, 'hover:text-red-300', 'hover:bg-red-900/20')}
      title="Delete this reading"
      >
      <Trash2 className="w-3.5 h-3.5" />
      </button>
      </div>
      )}
      </div>
      </div>
      </div>
      </div>
      );
      })}
      </>
      );
      })()}
      </div>

      {/* X-axis labels - show unique month/year only, aligned with data points */}
      <div className={combineClasses("relative border-t pt-2 text-xs", DesignTokens.colors.neutral.border[300], DesignTokens.colors.neutral.text[600])} style={{ height: '20px' }}>
      {(() => {
      if (!chartData || chartData.length === 0) {
      return <span>No data</span>;
      }

      const seenMonthYears = new Set();
      const monthLabels = [];
      const monthYearData = []; // Store { label, index, position }
      const dataLength = chartData.length;

      chartData.forEach((d, i) => {
      let dateObj = d.dateOriginal;
      if (!dateObj && d.timestamp) {
      dateObj = new Date(d.timestamp);
      }
      if (dateObj instanceof Date && !isNaN(dateObj.getTime())) {
      const monthYear = dateObj.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      if (!seenMonthYears.has(monthYear)) {
      seenMonthYears.add(monthYear);
      const leftPercent = (i / Math.max(dataLength - 1, 1)) * 100;
      monthYearData.push({ label: monthYear, index: i, position: leftPercent });
      // Calculate position based on data point index
      monthLabels.push(
      <span
      key={i}
      className="absolute hidden sm:inline whitespace-nowrap"
      style={{ left: `${leftPercent}%`, transform: 'translateX(-50%)' }}
      >
      {monthYear}
      </span>
      );
      }
      }
      });

      // Progressive truncation based on screen size
      // Mobile (< 640px): first, middle, last (max 3)
      // Small tablet (640px-768px): first, third, two-thirds, last (max 4)
      // Tablet (768px-1024px): first, quarter, middle, three-quarter, last (max 5)
      // Large tablet (1024px-1280px): first, sixth, third, half, two-thirds, five-sixths, last (max 7)
      // Desktop (>= 1280px): all labels
      let mobileLabels = [];
      let smallTabletLabels = [];
      let tabletLabels = [];
      let largeTabletLabels = [];

      if (monthYearData.length > 0) {
      // Mobile labels (first, middle, last) - 3 labels
      if (monthYearData.length === 1) {
      mobileLabels = [monthYearData[0]];
      } else if (monthYearData.length === 2) {
      mobileLabels = [monthYearData[0], monthYearData[1]];
      } else {
      const midIndex = Math.floor(monthYearData.length / 2);
      mobileLabels = [
      monthYearData[0],
      monthYearData[midIndex],
      monthYearData[monthYearData.length - 1]
      ];
      }

      // Small tablet labels (first, third, two-thirds, last) - 4 labels
      if (monthYearData.length <= 3) {
      smallTabletLabels = monthYearData;
      } else if (monthYearData.length === 4) {
      smallTabletLabels = monthYearData;
      } else {
      const thirdIndex = Math.floor(monthYearData.length / 3);
      const twoThirdsIndex = Math.floor(monthYearData.length * 2 / 3);
      smallTabletLabels = [
      monthYearData[0],
      monthYearData[thirdIndex],
      monthYearData[twoThirdsIndex],
      monthYearData[monthYearData.length - 1]
      ];
      }

      // Tablet labels (first, quarter, middle, three-quarter, last) - 5 labels
      if (monthYearData.length <= 4) {
      tabletLabels = monthYearData;
      } else if (monthYearData.length <= 5) {
      tabletLabels = monthYearData;
      } else {
      const quarterIndex = Math.floor(monthYearData.length / 4);
      const midIndex = Math.floor(monthYearData.length / 2);
      const threeQuarterIndex = Math.floor(monthYearData.length * 3 / 4);
      tabletLabels = [
      monthYearData[0],
      monthYearData[quarterIndex],
      monthYearData[midIndex],
      monthYearData[threeQuarterIndex],
      monthYearData[monthYearData.length - 1]
      ];
      }

      // Large tablet labels (first, sixth, third, half, two-thirds, five-sixths, last) - 7 labels
      if (monthYearData.length <= 5) {
      largeTabletLabels = monthYearData;
      } else if (monthYearData.length <= 7) {
      largeTabletLabels = monthYearData;
      } else {
      const sixthIndex = Math.floor(monthYearData.length / 6);
      const thirdIndex = Math.floor(monthYearData.length / 3);
      const midIndex = Math.floor(monthYearData.length / 2);
      const twoThirdsIndex = Math.floor(monthYearData.length * 2 / 3);
      const fiveSixthsIndex = Math.floor(monthYearData.length * 5 / 6);
      largeTabletLabels = [
      monthYearData[0],
      monthYearData[sixthIndex],
      monthYearData[thirdIndex],
      monthYearData[midIndex],
      monthYearData[twoThirdsIndex],
      monthYearData[fiveSixthsIndex],
      monthYearData[monthYearData.length - 1]
      ];
      }
      }

      return (
      <>
      {/* Desktop (xl and up): Show all labels */}
      {monthLabels.map((label, idx) => {
      const originalStyle = label.props.style;
      return (
      <span
      key={`desktop-${idx}`}
      className="absolute hidden xl:inline whitespace-nowrap"
      style={originalStyle}
      >
      {label.props.children}
      </span>
      );
      })}
      {/* Large tablet (lg to xl): Show 7 labels */}
      {largeTabletLabels.map((item, idx) => (
      <span
      key={`large-tablet-${item.index}`}
      className="absolute hidden lg:inline xl:hidden whitespace-nowrap"
      style={{ left: `${item.position}%`, transform: 'translateX(-50%)' }}
      >
      {item.label}
      </span>
      ))}
      {/* Tablet (md to lg): Show 5 labels */}
      {tabletLabels.map((item, idx) => (
      <span
      key={`tablet-${item.index}`}
      className="absolute hidden md:inline lg:hidden whitespace-nowrap"
      style={{ left: `${item.position}%`, transform: 'translateX(-50%)' }}
      >
      {item.label}
      </span>
      ))}
      {/* Small tablet (sm to md): Show 4 labels */}
      {smallTabletLabels.map((item, idx) => (
      <span
      key={`small-tablet-${item.index}`}
      className="absolute hidden sm:inline md:hidden whitespace-nowrap"
      style={{ left: `${item.position}%`, transform: 'translateX(-50%)' }}
      >
      {item.label}
      </span>
      ))}
      {/* Mobile (< sm): Show 3 labels */}
      {mobileLabels.map((item, idx) => (
      <span
      key={`mobile-${item.index}`}
      className="absolute sm:hidden whitespace-nowrap"
      style={{ left: `${item.position}%`, transform: 'translateX(-50%)' }}
      >
      {item.label}
      </span>
      ))}
      </>
      );
      })()}
      </div>
      </div>
      </div>
      </>
      );
      })()}
      </div>

      {/* Add Vital Metric Button */}
      <div className="flex justify-end mb-2">
      <button
      onClick={() => setShowAddVital(true)}
      className={combineClasses("flex items-center gap-2 transition-colors min-h-[44px] touch-manipulation active:opacity-70 px-2 py-1", DesignTokens.components.status.normal.text, 'hover:text-green-700')}
      >
      <Plus className="w-4 h-4" />
      <span className="text-sm font-medium">Add Vital Metric</span>
      </button>
      </div>

      {/* Total metrics count - aligned left above first card */}
      {Object.keys(allVitalsData).length > 0 && (
      <p className="text-sm text-medical-neutral-600 mb-2 text-left">
      {Object.keys(allVitalsData).length} metric{Object.keys(allVitalsData).length !== 1 ? 's' : ''} tracked
      </p>
      )}

      {/* Quick Vital Stats */}
      <div className={combineClasses(
      DesignTokens.components.card.nestedWithShadow
      )}>
      <h3 className={combineClasses("font-semibold mb-3", DesignTokens.colors.neutral.text[900])}>All Vitals (Latest)</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      {Object.entries(allVitalsData).map(([key, vital]) => {
      const displayName = getVitalDisplayName(vital.name || key);
      // Get normal range for display
      const normalRange = vital.normalRange || (() => {
      const age = patientProfile.age || (patientProfile.dateOfBirth ? Math.floor((new Date() - new Date(patientProfile.dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000)) : null);
      const normalizedKey = normalizeVitalName(key) || key.toLowerCase();

      switch (normalizedKey) {
      case 'blood_pressure':
      case 'bp':
      return age && age < 18 ? '<120/80' : '<140/90';
      case 'heart_rate':
      case 'hr':
      if (age) {
      if (age < 1) return '100-160';
      if (age < 3) return '90-150';
      if (age < 10) return '70-120';
      if (age < 18) return '60-100';
      }
      return '60-100';
      case 'temperature':
      case 'temp':
      return '97.5-99.5';
      case 'weight':
      // Calculate weight normal range based on BMI (18.5-24.9) using height
      if (patientProfile.height) {
      return getWeightNormalRange(patientProfile.height, patientProfile.gender);
      }
      return null;
      case 'oxygen_saturation':
      case 'o2sat':
      case 'spo2':
      return '>95';
      case 'respiratory_rate':
      case 'rr':
      if (age) {
      if (age < 1) return '30-60';
      if (age < 3) return '24-40';
      if (age < 12) return '20-30';
      }
      return '12-20';
      default: return null;
      }
      })();

      return (
      <div
      key={key}
      className={combineClasses(
      'relative cursor-pointer',
      DesignTokens.transitions.all,
      selectedVital === key
      ? combineClasses(DesignTokens.components.card.withColoredBorder(DesignTokens.colors.primary.border[600] || 'border-medical-primary-500'), DesignTokens.colors.app[50])
      : combineClasses(DesignTokens.components.card.nestedWithShadow, 'hover:border-medical-neutral-300', DesignTokens.shadows.hover)
      )}
      onClick={() => setSelectedVital(key)}
      >
      <div className="flex items-start justify-between mb-2">
      <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-1">
      <p className="text-sm font-semibold text-medical-neutral-900">
      {displayName}
      {vital.data && vital.data.length > 0 && (
      <span className="text-xs font-normal text-medical-neutral-500 ml-1">
      ({vital.data.length})
      </span>
      )}
      </p>
      <button
      onClick={(e) => {
      e.stopPropagation();
      toggleFavorite(key, 'vitals');
      }}
      className={combineClasses("transition-colors", DesignTokens.colors.accent.text[500], DesignTokens.colors.accent.text[600])}
      title={favoriteMetrics.vitals?.includes(key) ? "Remove from favorites" : "Add to favorites"}
      >
      <Star className={combineClasses(
      DesignTokens.icons.small.size.full,
      favoriteMetrics.vitals?.includes(key) 
      ? DesignTokens.components.favorite.filled 
      : DesignTokens.components.favorite.unfilled
      )} />
      </button>
      </div>
      <div className="flex items-baseline gap-2">
      <p className="text-xl font-bold text-medical-neutral-900">{vital.current}</p>
      <p className="text-xs text-medical-neutral-500">{vital.unit}</p>
      </div>
      {(() => {
      const vitalStatus = getVitalStatus(vital.current, normalRange, key);
      const statusColors = {
      green: DesignTokens.components.status.normal.text,
      yellow: DesignTokens.components.alert.text.warning,
      red: DesignTokens.components.alert.text.error,
      gray: DesignTokens.colors.neutral.text[700]
      };
      return (
      <p className={`text-xs ${statusColors[vitalStatus.color] || statusColors.gray} font-medium mt-1`}>
      {vitalStatus.label}
      </p>
      );
      })()}
      {normalRange && (
      <p className="text-xs text-medical-neutral-500 mt-1">Normal: {normalRange}</p>
      )}
      </div>
      </div>
      <div className="absolute top-2 right-2">
      <div className="relative">
      <button
      onClick={(e) => {
      e.stopPropagation();
      setOpenDeleteMenu(openDeleteMenu === `vital:${key}` ? null : `vital:${key}`);
      }}
      className="p-2 text-medical-neutral-500 hover:bg-medical-neutral-100 rounded transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation active:opacity-70"
      title="More options"
      >
      <MoreVertical className="w-4 h-4" />
      </button>
      {openDeleteMenu === `vital:${key}` && (
      <>
      <div
      className="fixed inset-0 z-[90]"
      onClick={() => setOpenDeleteMenu(null)}
      />
      <div className="absolute right-0 top-8 z-[100] bg-white rounded-lg shadow-lg border border-medical-neutral-200 py-1 min-w-[160px]">
      <button
      onClick={(e) => {
      e.stopPropagation();
      setOpenDeleteMenu(null);
      // Open add vital value modal for this specific vital
      const vitalDoc = allVitalsData[key];
      if (vitalDoc) {
      const displayName = getVitalDisplayName(vitalDoc.name || key);
      setSelectedVitalForValue({
      id: vitalDoc.id,
      name: displayName,
      unit: vitalDoc.unit,
      key: key,
      vitalType: key
      });
      setNewVitalValue({
      value: '',
      systolic: '',
      diastolic: '',
      dateTime: getCurrentDateTimeLocal(),
      notes: ''
      });
      setIsEditingVitalValue(false);
      setEditingVitalValueId(null);
      setShowAddVitalValue(true);
      }
      }}
      className={combineClasses("w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 min-h-[44px] touch-manipulation active:opacity-70", DesignTokens.colors.neutral.text[700], "hover:bg-medical-neutral-100")}
      >
      <Plus className="w-4 h-4" />
      Add Value
      </button>
      <button
      onClick={(e) => {
      e.stopPropagation();
      setOpenDeleteMenu(null);
      const vitalDoc = allVitalsData[key];
      if (vitalDoc) {
      setEditingVital(vitalDoc);
      setEditingVitalKey(key);
      }
      }}
      className={combineClasses("w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 min-h-[44px] touch-manipulation active:opacity-70", DesignTokens.colors.neutral.text[700], "hover:bg-medical-neutral-100")}
      >
      <Edit2 className="w-4 h-4" />
      Edit Metric
      </button>
      <button
      onClick={(e) => {
      e.stopPropagation();
      setOpenDeleteMenu(null);
      const vitalType = key;
      const vital = allVitalsData[key] || vitalsData[key];
      const displayName = getVitalDisplayName(vital?.name || vitalType);
      const count = vital?.data?.length || 0;
      const hasValues = (vital?.data && Array.isArray(vital.data) && vital.data.length > 0 && vital.data.some(item => item.value != null && item.value !== undefined));
      const title = hasValues
      ? `Delete All ${displayName} Data?`
      : `Delete ${displayName} Metric?`;
      const message = hasValues
      ? `This will permanently remove ${count} ${count === 1 ? 'entry' : 'entries'} of ${displayName} data.`
      : `This will permanently remove the ${displayName} metric.`;
      setDeleteConfirm({
      show: true,
      title,
      message,
      itemName: hasValues ? `all ${displayName} data` : `${displayName} metric`,
      confirmText: 'Yes, Delete',
      onConfirm: async () => {
      try {
      // Get the vital document ID
      const vitalId = vital?.id;
      if (!vitalId) {
      showError('Error: Could not find vital document ID. Please try again.');
      // Close the modal even on error
      setDeleteConfirm({ ...deleteConfirm, show: false });
      return;
      }


      // Optimistically update UI immediately
      const updatedVitalsData = { ...vitalsData };
      delete updatedVitalsData[vitalType];
      setVitalsData(updatedVitalsData);

      // If deleted vital was selected, select first available
      if (selectedVital === vitalType) {
      const firstAvailable = Object.keys(updatedVitalsData).find(key => 
      updatedVitalsData[key] && updatedVitalsData[key].data && updatedVitalsData[key].data.length > 0
      );
      if (firstAvailable) {
      setSelectedVital(firstAvailable);
      } else {
      // No vitals with data left, clear selection
      setSelectedVital(null);
      }
      }

      // Delete from Firestore using the document ID
      // This will also delete all subcollection values
      await vitalService.deleteVital(vitalId);

      // If all vitals are deleted, reload to update hasRealVitalData flag
      if (Object.keys(updatedVitalsData).length === 0) {
      // Small delay to ensure Firestore deletion completes
      setTimeout(async () => {
      await reloadHealthData();
      }, 300);
      }
      // Otherwise, don't reload immediately - optimistic update already removed it
      // Reloading too quickly can cause the vital to reappear
      
      // Close the modal after successful deletion
      setDeleteConfirm({ ...deleteConfirm, show: false });
      } catch (error) {
      // Revert optimistic update on error
      reloadHealthData();
      showError('Failed to delete vital data. Please try again.');
      // Close the modal even on error
      setDeleteConfirm({ ...deleteConfirm, show: false });
      }
      }
      });
      }}
      className={combineClasses("w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors", DesignTokens.components.status.high.text, DesignTokens.components.status.high.bg.replace('bg-', 'hover:bg-'))}
      >
      <Trash2 className="w-4 h-4" />
      {(() => {
      const vital = allVitalsData[key] || vitalsData[key];
      const hasValues = vital?.data && Array.isArray(vital.data) && vital.data.length > 0 && vital.data.some(item => item.value != null && item.value !== undefined);
      return hasValues ? 'Delete All' : 'Delete Metric';
      })()}
      </button>
      </div>
      </>
      )}
      </div>
      </div>
      </div>
      );
      })}
      </div>
      </div>
      </>
      )}

      {/* Modals */}
      <AddVitalModal
        show={showAddVital}
        onClose={() => setShowAddVital(false)}
        user={user}
        newVital={newVital}
        setNewVital={setNewVital}
        setIsEditingVital={setIsEditingVital}
        setEditingVitalValueId={setEditingVitalValueId}
        allVitalsData={allVitalsData}
        reloadHealthData={reloadHealthData}
        getWeightNormalRange={getWeightNormalRange}
      />

      <EditVitalModal
        show={!!editingVital}
        onClose={() => {
          setEditingVital(null);
          setEditingVitalKey(null);
        }}
        vital={editingVital}
        vitalKey={editingVitalKey}
        user={user}
        onSave={async () => {
          if (reloadHealthData) await reloadHealthData();
        }}
        onDeleteValue={async (vitalId, valueId) => {
          await vitalService.deleteVitalValue(vitalId, valueId);
          if (reloadHealthData) await reloadHealthData();
        }}
      />

      <AddVitalValueModal
        show={showAddVitalValue}
        onClose={() => {
          setShowAddVitalValue(false);
          setSelectedVitalForValue(null);
          setIsEditingVitalValue(false);
          setEditingVitalValueId(null);
          setNewVitalValue({ value: '', systolic: '', diastolic: '', dateTime: getCurrentDateTimeLocal(), notes: '' });
        }}
        user={user}
        selectedVitalForValue={selectedVitalForValue}
        newVitalValue={newVitalValue}
        setNewVitalValue={setNewVitalValue}
        isEditingVitalValue={isEditingVitalValue}
        editingVitalValueId={editingVitalValueId}
        setIsEditingVitalValue={setIsEditingVitalValue}
        setEditingVitalValueId={setEditingVitalValueId}
        setSelectedVitalForValue={setSelectedVitalForValue}
        reloadHealthData={reloadHealthData}
        vitalsData={vitalsData}
      />

      <DeletionConfirmationModal
        show={deleteConfirm.show}
        title={deleteConfirm.title}
        message={deleteConfirm.message}
        itemName={deleteConfirm.itemName}
        confirmText={deleteConfirm.confirmText}
        onConfirm={deleteConfirm.onConfirm}
        onClose={() => {
          if (!isDeletingVitalValue) {
            setDeleteConfirm({ ...deleteConfirm, show: false });
          }
        }}
        isDeleting={isDeletingVitalValue}
      />
    </div>
  );
}

// Memoize component to prevent unnecessary re-renders
export default React.memo(VitalsSection, (prevProps, nextProps) => {
  // selectedDataPoint and hoveredDataPoint are strings, compare directly (not .id)
  return (
    prevProps.selectedDataPoint === nextProps.selectedDataPoint &&
    prevProps.hoveredDataPoint === nextProps.hoveredDataPoint &&
    prevProps.onTabChange === nextProps.onTabChange &&
    prevProps.setSelectedDataPoint === nextProps.setSelectedDataPoint &&
    prevProps.setHoveredDataPoint === nextProps.setHoveredDataPoint
  );
});
