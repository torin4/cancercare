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
import { calculateYAxisBounds, calculateYAxisBoundsForBloodPressure, SCROLL_THRESHOLD } from '../utils/chartUtils';
import HealthChart from '../components/HealthChart';
import { detectCondition } from '../../../../utils/conditionDetection';
import ConditionBadge from '../components/ConditionBadge';

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
  const [chartTimeRange, setChartTimeRange] = useState('90d'); // '7d' | '30d' | '90d' | 'all' - default 3 months

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
        showError('You can pin up to 6 metrics. Please unpin one first.');
        return;
      }

      // Add to favorites
      newFavorites[type] = [...typeArray, metricKey];
    }

    setFavoriteMetrics(newFavorites);

    try {
      await patientService.updateFavoriteMetrics(user.uid, newFavorites);
      if (newFavorites[type].includes(metricKey)) {
        showSuccess('Added to key metrics');
      } else {
        showSuccess('Removed from key metrics');
      }
    } catch (error) {
      showError('Failed to update key metrics. Please try again.');
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

  // Open graph for vital when coming from dashboard key metric click (no scroll)
  useEffect(() => {
    const expandVitalKey = sessionStorage.getItem('expandVitalKey');
    if (!expandVitalKey || !allVitalsData || Object.keys(allVitalsData).length === 0) return;
    const normalizedKey = normalizeVitalName(expandVitalKey);
    const actualKey = Object.keys(allVitalsData).find(key => {
      const n = normalizeVitalName(key) || key.toLowerCase();
      return n === normalizedKey || key === expandVitalKey;
    });
    if (actualKey) {
      setSelectedVital(actualKey);
    }
    sessionStorage.removeItem('expandVitalKey');
  }, [allVitalsData]);

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
      title={favoriteMetrics.vitals?.includes(selectedVital) ? "Unpin from key metrics" : "Pin to key metrics"}
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
      {Object.keys(allVitalsData).length > 0 && allVitalsData[selectedVital]?.data?.length > 0 && (() => {
        const vitalData = filterDataByTimeRange(allVitalsData[selectedVital]?.data || []);
        const scrollable = chartTimeRange === 'all' && vitalData.length > SCROLL_THRESHOLD;
        return (
          <div className="flex items-center gap-2 mb-3 flex-wrap">
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
            {scrollable && (
              <span className={combineClasses("text-xs", DesignTokens.colors.neutral.text[500])}>← scroll →</span>
            )}
          </div>
        );
      })()}

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

      const isScrollable = chartTimeRange === 'all' && chartData.length > SCROLL_THRESHOLD;

      // Normal range for vitals (with age-based defaults)
      const normalRangeForChart = currentVital.normalRange || (() => {
        const age = patientProfile.age || (patientProfile.dateOfBirth ? Math.floor((new Date() - new Date(patientProfile.dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000)) : null);
        const normalizedKey = normalizeVitalName(selectedVital) || selectedVital.toLowerCase();
        switch (normalizedKey) {
          case 'blood_pressure': case 'bp': return age && age < 18 ? '<120/80' : '<140/90';
          case 'heart_rate': case 'hr':
            if (age) { if (age < 1) return '100-160'; if (age < 3) return '90-150'; if (age < 10) return '70-120'; if (age < 18) return '60-100'; }
            return '60-100';
          case 'temperature': case 'temp': return '97.5-99.5';
          case 'weight': return patientProfile.height ? getWeightNormalRange(patientProfile.height, patientProfile.gender) : null;
          case 'oxygen_saturation': case 'o2sat': case 'spo2': return '>95';
          case 'respiratory_rate': case 'rr':
            if (age) { if (age < 1) return '30-60'; if (age < 3) return '24-40'; if (age < 12) return '20-30'; }
            return '12-20';
          default: return null;
        }
      })();

      const isBP = selectedVital === 'bp' || selectedVital === 'bloodpressure' || selectedVital === 'blood_pressure';
      const bounds = isBP
        ? calculateYAxisBoundsForBloodPressure(chartData, normalRangeForChart)
        : calculateYAxisBounds(chartData.map(d => ({ value: d.value })), normalRangeForChart);

      // Transform chartData for HealthChart (BP: value=systolic, diastolic; others: value only)
      // For BP: parse "136/85" from value field when systolic/diastolic not stored separately (legacy data)
      const vitalChartData = chartData.map((d, i) => {
        let value = isBP ? parseFloat(d.systolic ?? d.value) : parseFloat(d.value);
        let diastolic = isBP ? parseFloat(d.diastolic) : undefined;
        if (isBP && (d.systolic == null || d.diastolic == null)) {
          const valueStr = String(d.value ?? '').trim();
          const parts = valueStr.split('/');
          if (parts.length === 2) {
            const sys = parseFloat(parts[0].trim());
            const dia = parseFloat(parts[1].trim());
            if (!isNaN(sys)) value = sys;
            if (!isNaN(dia)) diastolic = dia;
          }
        }
        const displayValue = isBP ? `${value}/${diastolic ?? '—'}` : d.value;
        const vitalStatus = getVitalStatus(displayValue, normalRangeForChart, selectedVital);
        return {
          date: d.date,
          value: isNaN(value) ? 0 : value,
          diastolic: isBP && !isNaN(diastolic) ? diastolic : undefined,
          id: d.id,
          displayValue,
          status: vitalStatus.color,
          pointKey: `${selectedVital}-${d.id ?? i}`,
        };
      });

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

      {/* Chart - Recharts HealthChart */}
      <HealthChart
        data={vitalChartData}
        unit={currentVital.unit}
        normalRange={normalRangeForChart}
        bounds={bounds}
        isScrollable={isScrollable}
        dataLength={vitalChartData.length}
        pointKeyPrefix={selectedVital}
        selectedDataPoint={selectedDataPoint}
        onSelectPoint={setSelectedDataPoint}
        onEditPoint={(dataPoint) => {
          setSelectedDataPoint(null);
          const currentVitalDoc = allVitalsData[selectedVital];
          if (currentVitalDoc?.id) {
            const valueData = (currentVital?.data || []).find(item => item.id === dataPoint.id);
            let dateTimeValue = getCurrentDateTimeLocal();
            let dateValue = valueData?.dateOriginal || valueData?.date;
            if (dateValue) {
              let dateObj = null;
              if (dateValue?.toDate) {
                const firestoreDate = dateValue.toDate();
                dateObj = new Date(firestoreDate.getFullYear(), firestoreDate.getMonth(), firestoreDate.getDate(), firestoreDate.getHours(), firestoreDate.getMinutes());
              } else if (valueData?.timestamp) {
                const dateFromTimestamp = new Date(valueData.timestamp);
                dateObj = new Date(dateFromTimestamp.getFullYear(), dateFromTimestamp.getMonth(), dateFromTimestamp.getDate(), dateFromTimestamp.getHours(), dateFromTimestamp.getMinutes());
              } else if (dateValue instanceof Date) {
                dateObj = new Date(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate(), dateValue.getHours(), dateValue.getMinutes());
              } else if (typeof dateValue === 'string') {
                const parsed = new Date(dateValue);
                if (!isNaN(parsed.getTime())) dateObj = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), parsed.getHours(), parsed.getMinutes());
              }
              if (dateObj && !isNaN(dateObj.getTime())) {
                const y = dateObj.getFullYear(), m = String(dateObj.getMonth() + 1).padStart(2, '0'), d = String(dateObj.getDate()).padStart(2, '0');
                const h = String(dateObj.getHours()).padStart(2, '0'), min = String(dateObj.getMinutes()).padStart(2, '0');
                dateTimeValue = `${y}-${m}-${d}T${h}:${min}`;
              }
            }
            setSelectedVitalForValue({ id: currentVitalDoc.id, name: getVitalDisplayName(currentVitalDoc.name || selectedVital), unit: currentVitalDoc.unit, key: selectedVital, vitalType: selectedVital });
            setNewVitalValue({ value: valueData?.value || '', systolic: valueData?.systolic || '', diastolic: valueData?.diastolic || '', dateTime: dateTimeValue, notes: valueData?.notes || '' });
            setEditingVitalValueId(dataPoint.id);
            setIsEditingVitalValue(true);
            setShowAddVitalValue(true);
          }
        }}
        onDeletePoint={(dataPoint) => {
          const vitalValueId = dataPoint.id;
          const vitalKey = selectedVital;
          const vitalDoc = allVitalsData[selectedVital];
          const vitalDocId = vitalDoc?.id;
          const displayName = getVitalDisplayName(currentVital.name || selectedVital);
          const valueDisplay = dataPoint.displayValue;
          const vitalUnit = currentVital.unit;
          const vitalDate = dataPoint.date;
          if (!vitalDocId) { showError('Vital document ID not found. Please try again.'); return; }
          setDeleteConfirm({
            show: true,
            title: `Delete ${displayName} Reading?`,
            message: `This will permanently delete this ${displayName} reading (${valueDisplay} ${vitalUnit} on ${vitalDate}).`,
            itemName: `${displayName} reading`,
            confirmText: 'Yes, Delete',
            onConfirm: async () => {
              setIsDeletingVitalValue(true);
              try {
                const updatedVitalsData = { ...vitalsData };
                if (updatedVitalsData[vitalKey]?.data) {
                  const filteredData = updatedVitalsData[vitalKey].data.filter(item => item.id !== vitalValueId);
                  const sortedData = [...filteredData].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                  updatedVitalsData[vitalKey] = { ...updatedVitalsData[vitalKey], data: filteredData, current: sortedData.length > 0 ? sortedData[0].value : '--' };
                  setVitalsData(updatedVitalsData);
                }
                if (!user?.uid) throw new Error('User not authenticated');
                await vitalService.deleteVitalValue(vitalDocId, vitalValueId);
                try {
                  const remainingValues = await vitalService.getVitalValues(vitalDocId);
                  if (!remainingValues?.length) await vitalService.deleteVital(vitalDocId);
                } catch (cleanupError) {}
                await reloadHealthData();
                showSuccess(`${displayName} reading deleted successfully`);
                setDeleteConfirm(prev => ({ ...prev, show: false }));
              } catch (error) {
                reloadHealthData();
                showError('Failed to delete vital reading. Please try again.');
                setDeleteConfirm(prev => ({ ...prev, show: false }));
              } finally {
                setIsDeletingVitalValue(false);
              }
            }
          });
        }}
        isBloodPressure={selectedVital === 'bp' || selectedVital === 'bloodpressure' || selectedVital === 'blood_pressure'}
        chartId={selectedVital}
      />

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

      {/* Key metrics - small cards (favorites or first vitals with data), like Labs tab */}
      {Object.keys(allVitalsData).length > 0 && (() => {
        const keyVitalKeys = favoriteMetrics.vitals?.length > 0
          ? favoriteMetrics.vitals.filter(key => allVitalsData[key] && (allVitalsData[key].data?.length > 0 || allVitalsData[key].current))
          : Object.keys(allVitalsData)
              .filter(key => (allVitalsData[key].data?.length > 0 || allVitalsData[key].current))
              .slice(0, 6);
        if (keyVitalKeys.length === 0) return null;
        return (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <Star className={combineClasses(
                DesignTokens.icons.button.size.full,
                keyVitalKeys.length && favoriteMetrics.vitals?.length > 0 ? DesignTokens.components.favorite.filled : DesignTokens.colors.neutral.text[500]
              )} />
              <h3 className="text-sm font-semibold text-medical-neutral-700">
                {favoriteMetrics.vitals?.length > 0 ? 'Key Vitals' : 'Key Metrics'}
              </h3>
            </div>
            <div className={combineClasses('flex flex-nowrap overflow-x-auto gap-2 pb-1', DesignTokens.spacing.gap.sm)}>
              {keyVitalKeys.map((key) => {
                const vital = allVitalsData[key];
                const displayName = getVitalDisplayName(vital?.name || key);
                const currentVal = vital?.current;
                const unit = vital?.unit || '';
                const normalRange = vital?.normalRange || (() => {
                  const age = patientProfile?.age ?? (patientProfile?.dateOfBirth ? Math.floor((new Date() - new Date(patientProfile.dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000)) : null);
                  const n = normalizeVitalName(key) || key.toLowerCase();
                  if (n === 'bp' || n === 'blood_pressure') return age && age < 18 ? '<120/80' : '<140/90';
                  if (n === 'hr' || n === 'heart_rate') return age ? (age < 18 ? '60-100' : '60-100') : '60-100';
                  if (n === 'temp' || n === 'temperature') return '97.5-99.5';
                  if (n === 'weight' && patientProfile?.height) return getWeightNormalRange(patientProfile.height, patientProfile.gender);
                  if (n === 'o2sat' || n === 'oxygen_saturation') return '>95';
                  if (n === 'rr' || n === 'respiratory_rate') return '12-20';
                  return null;
                })();
                const vitalStatus = getVitalStatus(currentVal, normalRange, key);
                const statusColorClass =
                  vitalStatus.color === 'red' ? DesignTokens.components.status.high.icon :
                  vitalStatus.color === 'yellow' ? DesignTokens.components.status.low.icon :
                  DesignTokens.components.status.normal.icon;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedVital(key)}
                    className={combineClasses(
                      'flex-shrink-0 min-w-[140px] p-2 rounded-lg text-left border transition-all duration-200 min-h-[44px] touch-manipulation active:opacity-90',
                      DesignTokens.colors.app[50],
                      DesignTokens.colors.app.border[200],
                      'hover:bg-gray-50 hover:shadow-md hover:-translate-y-0.5'
                    )}
                  >
                    <div className={combineClasses('flex items-center justify-between mb-1')}>
                      <span className={combineClasses(DesignTokens.typography.body.xs, 'font-medium', DesignTokens.colors.app.text[700])}>
                        {displayName}
                      </span>
                      <Activity className={combineClasses(DesignTokens.icons.small.size.full, statusColorClass)} />
                    </div>
                    <p className={combineClasses(DesignTokens.typography.body.sm, 'font-bold', DesignTokens.colors.app.text[900])}>
                      {currentVal != null && currentVal !== '' ? `${currentVal}${unit ? ` ${unit}` : ''}` : '—'}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}

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
      combineClasses(DesignTokens.components.card.nestedWithShadow, 'hover:border-medical-neutral-300', DesignTokens.shadows.hover)
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
      title={favoriteMetrics.vitals?.includes(key) ? "Unpin from key metrics" : "Pin to key metrics"}
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
      <div className="mt-1">
        <ConditionBadge condition={detectCondition('vital', key, vital.current, normalRange)} />
      </div>
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
      );
      })()}
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
