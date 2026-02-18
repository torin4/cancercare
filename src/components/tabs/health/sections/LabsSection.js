/**
 * LabsSection Component
 * 
 * Extracted from HealthTab to improve organization and maintainability.
 * This component handles all lab-related functionality including:
 * - Lab data display and charts
 * - Lab search and filtering
 * - Lab category organization
 * - Adding/editing/deleting labs and lab values
 * - Metric selection and deletion
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Plus, Upload, Edit2, X, TrendingUp, TrendingDown, Minus, 
  Activity, Info, Clock, Check, AlertCircle, Trash2, MoreVertical, 
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Search, Eye, EyeOff, Star, Sparkles
} from 'lucide-react';
import { DesignTokens, combineClasses } from '../../../../design/designTokens';
import { useAuth } from '../../../../contexts/AuthContext';
import { usePatientContext } from '../../../../contexts/PatientContext';
import { useHealthContext } from '../../../../contexts/HealthContext';
import { useBanner } from '../../../../contexts/BannerContext';
import { labService, patientService } from '../../../../firebase/services';
import { getLabStatus, numericValueForChart } from '../../../../utils/healthUtils';
import { 
  normalizeLabName, 
  getLabDisplayName, 
  labValueDescriptions, 
  labDefaultNormalRanges,
  categorizeLabs 
} from '../../../../utils/normalizationUtils';
import { categoryIcons, categoryDescriptions } from '../../../../constants/categories';
import AddLabModal from '../../../modals/AddLabModal';
import AddLabValueModal from '../../../modals/AddLabValueModal';
import EditLabModal from '../../../modals/EditLabModal';
import DeletionConfirmationModal from '../../../modals/DeletionConfirmationModal';
import LabTooltipModal from '../../../modals/LabTooltipModal';
import { isLabEmpty, filterLabsBySearch } from '../utils/labFilters';
import { detectCondition, detectCategoryConditions } from '../../../../utils/conditionDetection';
import ConditionBadge from '../components/ConditionBadge';
import { calculateYAxisBounds, SCROLL_THRESHOLD } from '../utils/chartUtils';
import HealthChart from '../components/HealthChart';
import { getTodayLocalDate, formatDateString } from '../../../../utils/helpers';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { getIrrelevantCategories, extractCancerTypeFromDiagnosis } from '../../../../utils/diseaseRelevantCategories';
import { CANCER_TYPES } from '../../../../constants/cancerTypes';
import { calculateSectionInsight } from '../../../../utils/sectionInsights';
import SectionInsightBadge from '../components/SectionInsightBadge';

function LabsSection({ 
  onTabChange,
  openDocumentOnboarding,
  selectedDataPoint,
  setSelectedDataPoint,
  hoveredDataPoint,
  setHoveredDataPoint
}) {
  const { user } = useAuth();
  const { patientProfile } = usePatientContext();
  const { labsData, setLabsData, hasRealLabData, reloadHealthData } = useHealthContext();
  const { showSuccess, showError } = useBanner();

  // Labs-specific state
  const [selectedLab, setSelectedLab] = useState('ca125');
  const [isDataCalculationExpanded, setIsDataCalculationExpanded] = useState(false);

  // Check for lab to expand from dashboard click
  useEffect(() => {
    const expandLabKey = sessionStorage.getItem('expandLabKey');
    if (expandLabKey && labsData && Object.keys(labsData).length > 0) {
      // Check if the lab exists in labsData
      const normalizedKey = normalizeLabName(expandLabKey);
      const labExists = Object.keys(labsData).some(key => {
        const normalized = normalizeLabName(key);
        return normalized === normalizedKey || key === expandLabKey;
      });
      
      if (labExists) {
        // Find the actual key in labsData (might be different case/variation)
        const actualKey = Object.keys(labsData).find(key => {
          const normalized = normalizeLabName(key);
          return normalized === normalizedKey || key === expandLabKey;
        }) || expandLabKey;
        
        // Only switch the chart to this metric; do not expand category or scroll
        setSelectedLab(actualKey);
        sessionStorage.removeItem('expandLabKey');
      } else {
        // Lab not found, clear the sessionStorage
        sessionStorage.removeItem('expandLabKey');
      }
    }
  }, [labsData]);
  const [labSearchQuery, setLabSearchQuery] = useState('');
  // Debounce search query to avoid filtering on every keystroke
  const debouncedSearchQuery = useDebouncedValue(labSearchQuery, 300);
  const [hideEmptyMetrics, setHideEmptyMetrics] = useState(false);
  const [isDeletingEmptyMetrics, setIsDeletingEmptyMetrics] = useState(false);
  const [showAddLab, setShowAddLab] = useState(false);
  const [showAddLabValue, setShowAddLabValue] = useState(false);
  const [selectedLabForValue, setSelectedLabForValue] = useState(null);
  const [newLabValue, setNewLabValue] = useState({ value: '', date: getTodayLocalDate(), notes: '' });
  const [isEditingLabValue, setIsEditingLabValue] = useState(false);
  const [editingLabValueId, setEditingLabValueId] = useState(null);
  const [newLabData, setNewLabData] = useState({ label: '', normalRange: '', unit: '' });
  const [expandedCategories, setExpandedCategories] = useState({
    'Disease-Specific Markers': true,
    'Liver Function': false,
    'Kidney Function': false,
    'Blood Counts': false,
    'Thyroid Function': false,
    'Cardiac Markers': false,
    'Inflammation': false,
    'Electrolytes': false,
    'Coagulation': false,
    'Custom Values': false,
    'Others': false
  });
  const [labTooltip, setLabTooltip] = useState(null);
  const [openDeleteMenu, setOpenDeleteMenu] = useState(null);
  const [openEmptyMetricsMenu, setOpenEmptyMetricsMenu] = useState(false);
  const [editingLab, setEditingLab] = useState(null);
  const [editingLabKey, setEditingLabKey] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ 
    show: false, 
    title: '', 
    message: '', 
    onConfirm: null, 
    itemName: '', 
    confirmText: 'Yes, Delete Permanently' 
  });
  const [isDeletingLabValue, setIsDeletingLabValue] = useState(false);
  const [metricSelectionMode, setMetricSelectionMode] = useState(false);
  const [selectedMetrics, setSelectedMetrics] = useState(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [favoriteMetrics, setFavoriteMetrics] = useState({ labs: [], vitals: [] });
  const [hiddenLabs, setHiddenLabs] = useState([]);
  const [showHiddenLabs, setShowHiddenLabs] = useState(false);
  const [chartTimeRange, setChartTimeRange] = useState('90d'); // '7d' | '30d' | '90d' | 'all' - default 3 months

  const allLabData = labsData;

  // Filter lab data by selected time range
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

  // Load favorites and hidden labs from patient profile
  useEffect(() => {
    if (patientProfile) {
      setFavoriteMetrics(patientProfile.favoriteMetrics || { labs: [], vitals: [] });
      setHiddenLabs(patientProfile.hiddenLabs || []);
    }
  }, [patientProfile]);

  // Helper function to check if a lab is empty
  const isLabEmptyHelper = (lab) => {
    return isLabEmpty(lab);
  };

  // Toggle favorite metric
  const toggleFavorite = async (metricKey, type) => {
    if (!user?.uid) return;

    const newFavorites = { ...favoriteMetrics };
    const typeArray = newFavorites[type] || [];

    if (typeArray.includes(metricKey)) {
      // Remove from favorites
      newFavorites[type] = typeArray.filter(key => key !== metricKey);
    } else {
      // For labs, check valid favorites (ones that exist and have data)
      let validFavoritesCount = typeArray.length;
      if (type === 'labs') {
        validFavoritesCount = typeArray.filter(key => {
          const lab = allLabData[key];
          return lab && !isLabEmptyHelper(lab);
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
      // Revert on error
      setFavoriteMetrics(favoriteMetrics);
    }
  };

  // Hide selected labs
  const hideSelectedLabs = async () => {
    if (!user?.uid) return;
    if (selectedMetrics.size === 0) {
      showError('Please select at least one metric to hide');
      return;
    }

    const selectedKeys = Array.from(selectedMetrics);
    const newHiddenLabs = [...new Set([...hiddenLabs, ...selectedKeys])];
    setHiddenLabs(newHiddenLabs);

    try {
      await patientService.updateHiddenLabs(user.uid, newHiddenLabs);
      setMetricSelectionMode(false);
      setSelectedMetrics(new Set());
      showSuccess(`Hidden ${selectedKeys.length} metric${selectedKeys.length !== 1 ? 's' : ''}`);
    } catch (error) {
      showError('Failed to hide metrics. Please try again.');
      // Revert on error
      setHiddenLabs(hiddenLabs);
    }
  };

  // Unhide labs
  const unhideLabs = async (labKeys) => {
    if (!user?.uid) return;
    const newHiddenLabs = hiddenLabs.filter(key => !labKeys.includes(key));
    setHiddenLabs(newHiddenLabs);

    try {
      await patientService.updateHiddenLabs(user.uid, newHiddenLabs);
      showSuccess(`Unhidden ${labKeys.length} metric${labKeys.length !== 1 ? 's' : ''}`);
    } catch (error) {
      showError('Failed to unhide metrics. Please try again.');
      // Revert on error
      setHiddenLabs(hiddenLabs);
    }
  };

  // Smart hide irrelevant labs based on cancer type
  const smartHideIrrelevantLabs = async () => {
    if (!user?.uid) {
      showError('Please sign in to use smart hide');
      return;
    }

    if (!patientProfile?.diagnosis && !patientProfile?.cancerType) {
      showError('Please set your diagnosis in your profile to use smart hide');
      return;
    }

    // Extract cancer type from diagnosis or cancerType field
    const cancerType = patientProfile.cancerType || 
                       extractCancerTypeFromDiagnosis(patientProfile.diagnosis, CANCER_TYPES);
    
    if (!cancerType) {
      showError('Could not determine cancer type from your profile. Please update your diagnosis.');
      return;
    }

    // Get irrelevant categories
    const irrelevantCategories = getIrrelevantCategories(cancerType);
    
    if (irrelevantCategories.length === 0) {
      showSuccess('All lab categories are relevant for your cancer type');
      return;
    }

    // Helper to get category for a lab key
    const getLabCategory = (labKey) => {
      for (const [category, labs] of Object.entries(categorizedLabs)) {
        if (labs.some(([key]) => key === labKey)) {
          return category;
        }
      }
      return 'Others'; // Default
    };

    // Get all labs in irrelevant categories (exclude Custom Values and Others from auto-hiding)
    const labsToHide = [];
    Object.entries(allLabData).forEach(([key, lab]) => {
      const category = getLabCategory(key);
      if (irrelevantCategories.includes(category)) {
        labsToHide.push(key);
      }
    });

    if (labsToHide.length === 0) {
      showSuccess('No irrelevant labs found to hide');
      return;
    }

    // Hide the labs (merge with existing hidden labs, no duplicates)
    const newHiddenLabs = [...new Set([...hiddenLabs, ...labsToHide])];
    setHiddenLabs(newHiddenLabs);

    try {
      await patientService.updateHiddenLabs(user.uid, newHiddenLabs);
      showSuccess(`Smart hide: Hidden ${labsToHide.length} metric${labsToHide.length !== 1 ? 's' : ''} in irrelevant categories`);
      setOpenEmptyMetricsMenu(false);
    } catch (error) {
      showError('Failed to hide labs. Please try again.');
      // Revert on error
      setHiddenLabs(hiddenLabs);
    }
  };

  // Auto-select first numeric lab when data loads
  useEffect(() => {
    if (Object.keys(allLabData).length > 0) {
      if (!allLabData[selectedLab] || !allLabData[selectedLab].isNumeric) {
        const firstNumericLab = Object.keys(allLabData).find(key => allLabData[key].isNumeric);
        if (firstNumericLab) {
          setSelectedLab(firstNumericLab);
        }
      }
    }
  }, [allLabData, selectedLab]);

  // Check for showAddLab flag from sessionStorage (set by DashboardTab)
  useEffect(() => {
    const showAddLabFlag = sessionStorage.getItem('showAddLab');
    if (showAddLabFlag === 'true') {
      setShowAddLab(true);
      sessionStorage.removeItem('showAddLab');
    }
  }, []);

  // Memoize current lab calculation - recalculates only when selectedLab or allLabData changes
  const currentLab = useMemo(() => {
    return allLabData[selectedLab] || Object.values(allLabData).find(lab => lab.isNumeric) || Object.values(allLabData)[0] || {
      name: 'No Data',
      current: '--',
      unit: '',
      status: 'normal',
      trend: 'stable',
      normalRange: '--',
      isNumeric: false,
      data: []
    };
  }, [allLabData, selectedLab]);

  // Memoize categorized labs
  const categorizedLabs = useMemo(() => {
    return categorizeLabs(allLabData);
  }, [allLabData]);

  // Filter labs by search, empty metrics, and hidden labs - use debounced search query
  const filteredCategorizedLabs = useMemo(() => {
    const filtered = {};
    Object.keys(categorizedLabs).forEach(category => {
      const categoryLabs = categorizedLabs[category];
      let filteredLabs = filterLabsBySearch(categoryLabs, debouncedSearchQuery, hideEmptyMetrics);
      
      // Filter out hidden labs unless showHiddenLabs is true
      if (!showHiddenLabs) {
        filteredLabs = filteredLabs.filter(([key]) => !hiddenLabs.includes(key));
      }
      
      if (filteredLabs.length > 0) {
        filtered[category] = filteredLabs;
      }
    });
    return filtered;
  }, [categorizedLabs, debouncedSearchQuery, hideEmptyMetrics, hiddenLabs, showHiddenLabs]);

  // Calculate section insights for each category (CTCAE-based health scores)
  const sectionInsights = useMemo(() => {
    const insights = {};
    for (const [category, labs] of Object.entries(filteredCategorizedLabs)) {
      insights[category] = calculateSectionInsight(category, labs);
    }
    return insights;
  }, [filteredCategorizedLabs]);

  // Filtered lab data by time range
  const filteredLabData = useMemo(() => filterDataByTimeRange(currentLab?.data || []), [currentLab, chartTimeRange]);

  const isScrollable = chartTimeRange === 'all' && (filteredLabData?.length || 0) > SCROLL_THRESHOLD;

  // Memoize chart data and bounds for HealthChart
  const labChartData = useMemo(() => {
    if (!currentLab || !currentLab.isNumeric || !filteredLabData || filteredLabData.length === 0) {
      return { data: [], bounds: null, normalRange: null };
    }

    const chartCanonicalKey = normalizeLabName(currentLab?.name || selectedLab);
    const detailEffectiveRange = currentLab.normalRange || (chartCanonicalKey && labDefaultNormalRanges[chartCanonicalKey]);
    const bounds = calculateYAxisBounds(filteredLabData, detailEffectiveRange);

    const data = filteredLabData.map((d, i) => {
      const labStatus = getLabStatus(d.value, detailEffectiveRange);
      const numVal = numericValueForChart(d.value);
      const value = typeof numVal === 'number' && !isNaN(numVal) ? numVal : 0;
      return {
        date: d.date,
        value,
        id: d.id,
        displayValue: d.value,
        status: labStatus.color,
        pointKey: `${selectedLab}-${d.id ?? i}`,
      };
    });

    return {
      data,
      bounds,
      normalRange: detailEffectiveRange,
    };
  }, [currentLab, selectedLab, filteredLabData]);

  // Category order for display
  const categoryOrder = [
    'Disease-Specific Markers',
    'Liver Function',
    'Kidney Function',
    'Blood Counts',
    'Thyroid Function',
    'Cardiac Markers',
    'Inflammation',
    'Electrolytes',
    'Coagulation',
    'Custom Values',
    'Others'
  ];

  // NOTE: The full Labs section JSX (2000+ lines) will be included here
  // Due to file size, this is being done incrementally
  // The rendering logic from lines 622-2645 of HealthTab.js should be copied here

  return (
    <div className="space-y-4">
      {/* Empty State - No Lab Data */}
      {!hasRealLabData && Object.keys(labsData).length === 0 && (
        <div className={combineClasses(
          DesignTokens.components.card.container,
          DesignTokens.components.card.container,
          'text-center'
        )}>
          <div className="flex flex-col items-center gap-3">
            <BarChart className={combineClasses('w-10 h-10 sm:w-12 sm:h-12', DesignTokens.colors.app.text[400])} />
            <div>
              <h3 className={combineClasses('text-base sm:text-lg font-semibold mb-1', DesignTokens.colors.app.text[900])}>No Lab Data Yet</h3>
              <p className={combineClasses('text-xs sm:text-sm mb-4', DesignTokens.colors.app.text[700])}>
                Start tracking your lab values by uploading a report or adding a metric manually
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => setShowAddLab(true)}
                  className={combineClasses(DesignTokens.components.button.outline.primary, DesignTokens.spacing.button.full, 'py-2.5 text-sm font-medium', DesignTokens.spacing.gap.sm, 'min-h-[44px] touch-manipulation active:opacity-70')}
                >
                  <Edit2 className="w-4 h-4" />
                  Manual Enter
                </button>
                <button
                  onClick={() => openDocumentOnboarding('lab-report')}
                  className={combineClasses("px-4 py-2.5 rounded-lg text-sm font-medium transition shadow-sm flex items-center justify-center gap-2 min-h-[44px] touch-manipulation active:opacity-90", DesignTokens.colors.primary[500], 'text-white', DesignTokens.colors.primary[600].replace('bg-', 'hover:bg-'))}
                >
                  <Upload className="w-4 h-4" />
                  Upload Lab Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Show data if available */}
      {(hasRealLabData || Object.keys(labsData).length > 0) && (
        <>
          {/* Lab Trend Chart - only show if we have numeric labs */}
          {Object.values(allLabData).some(lab => lab.isNumeric) && (
            <div className={combineClasses(
              DesignTokens.components.card.container,
              DesignTokens.borders.card
            )}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                <h2 className={combineClasses('text-base sm:text-lg font-semibold', DesignTokens.colors.neutral.text[900])}>Lab Trends</h2>
                <select
                  value={selectedLab}
                  onChange={(e) => setSelectedLab(e.target.value)}
                  className={combineClasses(DesignTokens.components.select.base, 'min-h-[44px] w-full sm:w-auto touch-manipulation focus:ring-green-500', DesignTokens.colors.neutral.border[300])}
                >
                  {(() => {
                    // Organize labs by category for dropdown
                    const categoryMap = {
                      'disease_specific_markers': 'Disease-Specific Markers',
                      'liver_function': 'Liver Function',
                      'kidney_function': 'Kidney Function',
                      'blood_counts': 'Blood Counts',
                      'thyroid_function': 'Thyroid Function',
                      'cardiac_markers': 'Cardiac Markers',
                      'inflammation': 'Inflammation',
                      'electrolytes': 'Electrolytes',
                      'coagulation': 'Coagulation',
                      'other': 'Others'
                    };

                    const canonicalKeyToCategory = {
                      'ca125': 'disease_specific_markers', 'ca199': 'disease_specific_markers', 'ca153': 'disease_specific_markers',
                      'ca724': 'disease_specific_markers', 'ca242': 'disease_specific_markers', 'ca50': 'disease_specific_markers',
                      'ca2729': 'disease_specific_markers', 'cea': 'disease_specific_markers', 'afp': 'disease_specific_markers',
                      'psa': 'disease_specific_markers', 'he4': 'disease_specific_markers', 'inhibinb': 'disease_specific_markers',
                      'romaindex': 'disease_specific_markers', 'scc_antigen': 'disease_specific_markers',
                      'cyfra211': 'disease_specific_markers', 'nse': 'disease_specific_markers', 'betahcg': 'disease_specific_markers',
                      'alt': 'liver_function', 'ast': 'liver_function', 'ast_alt_ratio': 'liver_function',
                      'ag_ratio': 'liver_function', 'albi_score': 'liver_function',
                      'alp': 'liver_function', 'alp_ifcc': 'liver_function', 'bilirubin_total': 'liver_function',
                      'bilirubin_direct': 'liver_function', 'bilirubin_indirect': 'liver_function',
                      'albumin': 'liver_function', 'ggt': 'liver_function', 'ck': 'liver_function',
                      'ldh': 'liver_function', 'amylase': 'liver_function',
                      'creatinine': 'kidney_function', 'egfr': 'kidney_function', 'bun': 'kidney_function',
                      'urea': 'kidney_function', 'uric_acid': 'kidney_function',
                      'urineprotein': 'kidney_function', 'urinecreatinine': 'kidney_function',
                      'urine_wbc': 'kidney_function', 'urine_rbc': 'kidney_function', 'urine_hyaline_casts': 'kidney_function',
                      'urine_renal_tubular_epithelial': 'kidney_function', 'urine_squamous_epithelial': 'kidney_function',
                      'urine_bacteria': 'kidney_function', 'urine_yeast': 'kidney_function', 'urine_crystals': 'kidney_function',
                      'urine_mucus': 'kidney_function', 'urine_color': 'kidney_function', 'urine_appearance': 'kidney_function',
                      'urine_glucose': 'kidney_function', 'urine_ketones': 'kidney_function', 'urine_bilirubin': 'kidney_function',
                      'urine_blood': 'kidney_function', 'urine_nitrite': 'kidney_function', 'urine_leukocyte_esterase': 'kidney_function',
                      'urine_specific_gravity': 'kidney_function', 'urine_ph': 'kidney_function', 'urine_urobilinogen': 'kidney_function',
                      'wbc': 'blood_counts', 'rbc': 'blood_counts', 'hemoglobin': 'blood_counts',
                      'hematocrit': 'blood_counts', 'platelets': 'blood_counts', 'anc': 'blood_counts',
                      'neutrophils_abs': 'blood_counts', 'neutrophils_pct': 'blood_counts',
                      'lymphocytes_abs': 'blood_counts', 'lymphocytes_pct': 'blood_counts',
                      'monocytes_abs': 'blood_counts', 'monocytes_pct': 'blood_counts',
                      'eosinophils_abs': 'blood_counts', 'eosinophils_pct': 'blood_counts',
                      'basophils_abs': 'blood_counts', 'basophils_pct': 'blood_counts',
                      'mcv': 'blood_counts', 'mch': 'blood_counts', 'mchc': 'blood_counts',
                      'rdw': 'blood_counts', 'rdw_cv': 'blood_counts',
                      'mpv': 'blood_counts', 'platelet_crit': 'blood_counts', 'pdw_sd': 'blood_counts',
                      'nrbc': 'blood_counts', 'nrbc_pct': 'blood_counts',
                      'reticulocyte_count': 'blood_counts', 'reticulocyte_pct': 'blood_counts',
                      'tsh': 'thyroid_function', 't3': 'thyroid_function', 't4': 'thyroid_function',
                      'ft3': 'thyroid_function', 'ft4': 'thyroid_function', 'thyroglobulin': 'thyroid_function',
                      'troponin': 'cardiac_markers', 'bnp': 'cardiac_markers', 'ntprobnp': 'cardiac_markers',
                      'ckmb': 'cardiac_markers', 'myoglobin': 'cardiac_markers',
                      'crp': 'inflammation', 'esr': 'inflammation', 'ferritin': 'inflammation',
                      'il6': 'inflammation',
                      'sodium': 'electrolytes', 'potassium': 'electrolytes', 'chloride': 'electrolytes',
                      'bicarbonate': 'electrolytes', 'co2': 'electrolytes', 'magnesium': 'electrolytes',
                      'phosphorus': 'electrolytes', 'calcium': 'electrolytes', 'calcium_ionized': 'electrolytes',
                      'phosphate': 'electrolytes',
                      'pt': 'coagulation', 'inr': 'coagulation', 'aptt': 'coagulation',
                      'ddimer': 'coagulation', 'fdp': 'coagulation', 'fibrinogen': 'coagulation',
                      'iron': 'coagulation', 'fib4_index': 'coagulation', 'hcv_screening': 'coagulation',
                      'antithrombin_iii': 'coagulation', 'protein_c': 'coagulation', 'protein_s': 'coagulation',
                      'glucose': 'other', 'hba1c': 'other', 'iga': 'other', 'igg': 'other', 'igm': 'other', 'vitamin_d': 'other',
                      'beta2_microglobulin': 'other', 'procalcitonin': 'other'
                    };

                    const labsByCategory = {};
                    Object.keys(allLabData)
                      .filter(key => allLabData[key] && allLabData[key].isNumeric)
                      .forEach(key => {
                        const lab = allLabData[key];
                        const canonicalKey = normalizeLabName(lab?.name || key) || key.toLowerCase();
                        const category = canonicalKeyToCategory[canonicalKey] || 'other';
                        const uiCategory = categoryMap[category] || 'Others';
                        
                        if (!labsByCategory[uiCategory]) {
                          labsByCategory[uiCategory] = [];
                        }
                        labsByCategory[uiCategory].push({
                          key,
                          displayName: getLabDisplayName(lab?.name || key) || lab?.name || key
                        });
                      });

                    const categoryOrder = [
                      'Disease-Specific Markers', 'Blood Counts', 'Liver Function', 'Kidney Function',
                      'Electrolytes', 'Coagulation', 'Thyroid Function', 'Cardiac Markers',
                      'Inflammation', 'Others'
                    ];

                    return categoryOrder
                      .filter(cat => labsByCategory[cat] && labsByCategory[cat].length > 0)
                      .map(category => (
                        <optgroup key={category} label={category}>
                          {labsByCategory[category]
                            .sort((a, b) => a.displayName.localeCompare(b.displayName))
                            .map(({ key, displayName }) => (
                              <option key={key} value={key}>{displayName}</option>
                            ))}
                        </optgroup>
                      ));
                  })()}
                </select>
              </div>

              {currentLab && currentLab.isNumeric ? (
                <>
                  {(() => {
                    const detailCanonicalKey = normalizeLabName(currentLab?.name || selectedLab);
                    const detailEffectiveRange = currentLab.normalRange || (detailCanonicalKey && labDefaultNormalRanges[detailCanonicalKey]);
                    return (
                  <>
                  <div className="mb-4">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className={combineClasses('text-2xl sm:text-3xl font-bold', DesignTokens.colors.neutral.text[900])}>{currentLab.current}</span>
                      <span className={combineClasses('text-sm', DesignTokens.colors.neutral.text[600])}>{currentLab.unit}</span>
                      {(() => {
                        const labStatus = getLabStatus(currentLab.current, detailEffectiveRange);
                        const statusColors = {
                          green: combineClasses(DesignTokens.components.status.normal.bg, DesignTokens.components.status.normal.text),
                          yellow: combineClasses(DesignTokens.components.status.low.bg, DesignTokens.components.alert.text.warning),
                          red: combineClasses(DesignTokens.components.status.high.bg, DesignTokens.components.alert.text.error),
                          gray: combineClasses(DesignTokens.colors.neutral[100], DesignTokens.colors.neutral.text[700])
                        };
                        return (
                          <span className={`ml-auto text-xs px-2 py-1 rounded-full ${statusColors[labStatus.color] || statusColors.gray}`}>
                            {labStatus.label}
                          </span>
                        );
                      })()}
                    </div>
                    <p className={combineClasses('text-xs sm:text-sm', DesignTokens.colors.neutral.text[600])}>Normal range: {detailEffectiveRange || '--'} {currentLab.unit}</p>
                  </div>

                  {/* Chart time range filter */}
                  {currentLab?.data?.length > 0 && (
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
                      {isScrollable && (
                        <span className={combineClasses("text-xs", DesignTokens.colors.neutral.text[500])}>← scroll →</span>
                      )}
                    </div>
                  )}

                  {/* Chart - Recharts HealthChart */}
                  {labChartData.bounds && labChartData.data.length > 0 ? (
                    <HealthChart
                      data={labChartData.data}
                      unit={currentLab.unit}
                      normalRange={labChartData.normalRange}
                      bounds={labChartData.bounds}
                      isScrollable={isScrollable}
                      dataLength={labChartData.data.length}
                      pointKeyPrefix={selectedLab}
                      selectedDataPoint={selectedDataPoint}
                      onSelectPoint={setSelectedDataPoint}
                      onEditPoint={(dataPoint) => {
                        setSelectedDataPoint(null);
                        const currentLabDoc = allLabData[selectedLab];
                        if (currentLabDoc?.id) {
                          const valueData = (currentLab?.data || []).find(item => item.id === dataPoint.id);
                          let dateValue = getTodayLocalDate();
                          if (valueData?.dateOriginal) {
                            dateValue = formatDateString(valueData.dateOriginal) || getTodayLocalDate();
                          } else if (valueData?.timestamp) {
                            dateValue = formatDateString(new Date(valueData.timestamp)) || getTodayLocalDate();
                          } else if (valueData?.date) {
                            dateValue = formatDateString(valueData.date) || getTodayLocalDate();
                          }
                          setSelectedLabForValue({ id: currentLabDoc.id, name: getLabDisplayName(currentLabDoc.name || selectedLab), unit: currentLabDoc.unit, key: selectedLab });
                          setNewLabValue({ value: valueData?.value || '', date: dateValue, notes: valueData?.notes || '' });
                          setEditingLabValueId(dataPoint.id);
                          setIsEditingLabValue(true);
                          setShowAddLabValue(true);
                        }
                      }}
                      onDeletePoint={(dataPoint) => {
                        const labValueId = dataPoint.id;
                        const labKey = selectedLab;
                        const labDoc = allLabData[selectedLab];
                        const labDocId = labDoc?.id;
                        const labName = currentLab.name;
                        const labUnit = currentLab.unit;
                        const labValue = dataPoint.displayValue;
                        const labDate = dataPoint.date;
                        if (!labDocId) {
                          showError('Lab document ID not found. Please try again.');
                          return;
                        }
                        setDeleteConfirm({
                          show: true,
                          title: `Delete ${labName} Reading?`,
                          message: `This will permanently delete this ${labName} reading (${labValue} ${labUnit} on ${labDate}).`,
                          itemName: `${labName} reading`,
                          confirmText: 'Yes, Delete',
                          onConfirm: async () => {
                            setIsDeletingLabValue(true);
                            try {
                              const updatedLabsData = { ...labsData };
                              if (updatedLabsData[labKey]?.data) {
                                const filteredData = updatedLabsData[labKey].data.filter(item => item.id !== labValueId);
                                const sortedData = [...filteredData].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                                updatedLabsData[labKey] = { ...updatedLabsData[labKey], data: filteredData, current: sortedData.length > 0 ? sortedData[0].value : '--' };
                                setLabsData(updatedLabsData);
                              }
                              if (!user?.uid) throw new Error('User not authenticated');
                              await labService.deleteLabValue(labDocId, labValueId);
                              try {
                                const remainingValues = await labService.getLabValues(labDocId);
                                if (!remainingValues?.length) await labService.deleteLab(labDocId);
                              } catch (cleanupError) {}
                              await reloadHealthData();
                              showSuccess(`${labName} reading deleted successfully`);
                              setDeleteConfirm(prev => ({ ...prev, show: false }));
                            } catch (error) {
                              reloadHealthData();
                              showError(`Failed to delete lab reading: ${error.message}`);
                              setDeleteConfirm(prev => ({ ...prev, show: false }));
                            } finally {
                              setIsDeletingLabValue(false);
                            }
                          }
                        });
                      }}
                      isBloodPressure={false}
                      chartId={selectedLab}
                    />
                  ) : (
                    <div className={combineClasses("flex items-center justify-center h-40", DesignTokens.colors.neutral.text[300])}>
                      <p>No numeric data available for charting</p>
                    </div>
                  )}
                </>
                ); })()}
                </>
              ) : (
                <div className={combineClasses("text-center py-8", DesignTokens.colors.neutral.text[400])}>
                  <p>No numeric data available for charting</p>
                </div>
              )}
            </div>
          )}

          {/* Lab Value Cards - Organized by Category with Expandable Cards */}
          {(() => {
            // Helper function to render lab card
            const renderLabCard = (key, lab) => {
              if (lab.isNumeric) {
                const canonicalKey = normalizeLabName(lab.name || key);
                const effectiveRange = lab.normalRange || (canonicalKey && labDefaultNormalRanges[canonicalKey]);
                const labStatus = getLabStatus(lab.current, effectiveRange);
                const statusColors = {
                  green: { dot: 'bg-medical-accent-500', text: 'text-medical-accent-700' },
                  yellow: { dot: combineClasses('', DesignTokens.components.status.low.icon.replace('text-', 'bg-')), text: combineClasses('', DesignTokens.components.alert.text.warning) },
                  red: { dot: combineClasses('', DesignTokens.components.status.high.icon.replace('text-', 'bg-')), text: combineClasses('', DesignTokens.components.alert.text.error) },
                  gray: { dot: 'bg-medical-neutral-400', text: 'text-medical-neutral-600' }
                };
                const colors = statusColors[labStatus.color];
                const labDescription = canonicalKey ? (labValueDescriptions[canonicalKey] || '') : '';
                const displayName = getLabDisplayName(lab.name);

                const isHidden = hiddenLabs.includes(key);
                return (
                  <div
                    key={key}
                    data-lab-key={key}
                    className={combineClasses(
                      'relative cursor-pointer',
                      DesignTokens.transitions.all,
                      metricSelectionMode && isHidden
                        ? combineClasses(DesignTokens.components.card.nestedWithShadow, 'opacity-50 border-2 border-dashed border-medical-neutral-300')
                        : combineClasses(DesignTokens.components.card.nestedWithShadow, 'hover:border-medical-neutral-300', DesignTokens.shadows.hover)
                    )}
                    onClick={() => {
                      if (metricSelectionMode) {
                        // If lab is hidden, unhide it when clicked
                        if (hiddenLabs.includes(key)) {
                          unhideLabs([key]);
                          return;
                        }
                        // Otherwise, toggle selection
                        const newSelected = new Set(selectedMetrics);
                        if (newSelected.has(key)) {
                          newSelected.delete(key);
                        } else {
                          newSelected.add(key);
                        }
                        setSelectedMetrics(newSelected);
                      } else {
                        setSelectedLab(key);
                      }
                    }}
                  >
                    {metricSelectionMode && (
                      <div className="absolute top-3 left-3">
                        {isHidden ? (
                          <EyeOff className={combineClasses('w-5 h-5', DesignTokens.colors.neutral.text[400])} />
                        ) : (
                          <input
                            type="checkbox"
                            checked={selectedMetrics.has(key)}
                            onChange={() => {}}
                            className={combineClasses('w-5 h-5 rounded pointer-events-none', DesignTokens.colors.app.text[600], 'focus:ring-anchor-900', DesignTokens.colors.neutral.border[300])}
                          />
                        )}
                      </div>
                    )}

                    <div className={`flex items-start justify-between mb-2 ${metricSelectionMode ? 'ml-8' : ''}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-semibold text-medical-neutral-900">
                            {displayName}
                            {lab.data && lab.data.length > 0 && (
                              <span className="text-xs font-normal text-medical-neutral-500 ml-1">
                                ({lab.data.length})
                              </span>
                            )}
                          </p>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(key, 'labs');
                            }}
                            className={combineClasses("transition-colors", DesignTokens.colors.accent.text[500], DesignTokens.colors.accent.text[600])}
                            title={favoriteMetrics.labs?.includes(key) ? "Unpin from key metrics" : "Pin to key metrics"}
                          >
                            <Star className={combineClasses(
                              DesignTokens.icons.small.size.full,
                              favoriteMetrics.labs?.includes(key) 
                                ? DesignTokens.components.favorite.filled 
                                : DesignTokens.components.favorite.unfilled
                            )} />
                          </button>
                          {labDescription && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setLabTooltip({
                                  labName: displayName,
                                  description: labDescription
                                });
                              }}
                              className={combineClasses(DesignTokens.colors.app.text[500], 'hover:' + DesignTokens.colors.app.text[700], DesignTokens.transitions.default)}
                              title="Learn more about this lab value"
                            >
                              <Info className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                        <div className="flex items-baseline gap-2">
                          <p className="text-xl font-bold text-medical-neutral-900">{lab.current}</p>
                          {lab.trend && lab.data && lab.data.length > 0 && (
                            lab.trend === 'up' ? (
                              <TrendingUp className={combineClasses("w-4 h-4", DesignTokens.components.status.high.icon)} />
                            ) : lab.trend === 'down' ? (
                              <TrendingDown className={combineClasses("w-4 h-4", DesignTokens.components.status.normal.icon)} />
                            ) : (
                              <Minus className={combineClasses('w-4 h-4', DesignTokens.colors.neutral.text[300])} />
                            )
                          )}
                          <p className="text-xs text-medical-neutral-500">{lab.unit}</p>
                        </div>
                        <p className={`text-xs ${colors.text} font-medium mt-1`}>{labStatus.label}</p>
                        <div className="mt-1">
                          <ConditionBadge condition={detectCondition('lab', canonicalKey, lab.current, effectiveRange)} />
                        </div>
                        {lab.normalRange && (
                          <p className="text-xs text-medical-neutral-500 mt-1">Normal: {lab.normalRange}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              setOpenDeleteMenu(openDeleteMenu === `lab:${key}` ? null : `lab:${key}`);
                            }}
                            className="p-2 text-medical-neutral-500 hover:bg-medical-neutral-100 rounded transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation active:opacity-70"
                            title="More options"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          {openDeleteMenu === `lab:${key}` && (
                            <>
                              <div
                                className="fixed inset-0 z-[90]"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  setOpenDeleteMenu(null);
                                }}
                              />
                              <div className="absolute right-0 top-8 z-[100] bg-white rounded-lg shadow-lg border border-medical-neutral-200 py-1 min-w-[160px]">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    setOpenDeleteMenu(null);
                                    const labDoc = allLabData[key];
                                    if (labDoc && labDoc.id) {
                                      setSelectedLabForValue({ id: labDoc.id, name: displayName, unit: lab.unit, key: key });
                                      setNewLabValue({ value: '', date: getTodayLocalDate(), notes: '' });
                                      setIsEditingLabValue(false);
                                      setShowAddLabValue(true);
                                    }
                                  }}
                                  className={combineClasses('w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 min-h-[44px] touch-manipulation active:opacity-70', DesignTokens.colors.neutral.text[700], 'hover:bg-medical-neutral-100')}
                                >
                                  <Plus className="w-4 h-4" />
                                  Add Value
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    setOpenDeleteMenu(null);
                                    const labDoc = allLabData[key];
                                    if (labDoc) {
                                      setEditingLab(labDoc);
                                      setEditingLabKey(key);
                                    }
                                  }}
                                  className={combineClasses('w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 min-h-[44px] touch-manipulation active:opacity-70', DesignTokens.colors.neutral.text[700], 'hover:bg-medical-neutral-100')}
                                >
                                  <Edit2 className="w-4 h-4" />
                                  Edit Metric
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    setOpenDeleteMenu(null);
                                    const labType = key;
                                    const labDoc = allLabData[key];
                                    const count = labDoc?.values?.length || labDoc?.data?.length || lab?.data?.length || 0;
                                    setDeleteConfirm({
                                      show: true,
                                      title: count > 0 ? `Delete All ${displayName} Data?` : `Delete ${displayName} Metric?`,
                                      message: count > 0 
                                        ? `This will permanently remove ${count} ${count === 1 ? 'entry' : 'entries'} of ${displayName} data.`
                                        : `This will permanently delete the ${displayName} metric card.`,
                                      itemName: count > 0 ? `all ${displayName} data` : `${displayName} metric`,
                                      confirmText: 'Yes, Delete',
                                      onConfirm: async () => {
                                        try {
                                          const labDoc = allLabData[labType];
                                          const labDocId = labDoc?.id;
                                          const labDocIds = labDoc?.labDocumentIds || (labDocId ? [labDocId] : []);
                                          
                                          const updatedLabsData = { ...labsData };
                                          delete updatedLabsData[labType];
                                          setLabsData(updatedLabsData);
                                          
                                          if (selectedLab === labType) {
                                            const firstAvailable = Object.keys(updatedLabsData).find(key => updatedLabsData[key]?.isNumeric);
                                            if (firstAvailable) {
                                              setSelectedLab(firstAvailable);
                                            } else {
                                              setSelectedLab(null);
                                            }
                                          }
                                          
                                          let deletedCount = await labService.deleteAllLabsByType(user.uid, labType);
                                          
                                          if (deletedCount === 0 && labDocIds.length > 0) {
                                            let directDeletedCount = 0;
                                            for (const labId of labDocIds) {
                                              try {
                                                const exists = await labService.getLab(labId);
                                                if (exists) {
                                                  await labService.deleteLab(labId);
                                                  directDeletedCount++;
                                                }
                                              } catch (deleteError) {
                                                if (deleteError.message && !deleteError.message.includes('not found') && !deleteError.message.includes('not exist')) {
                                                  throw deleteError;
                                                }
                                              }
                                            }
                                            deletedCount = directDeletedCount;
                                          }
                                          
                                          if (deletedCount === 0 && labDocIds.length > 0) {
                                            let allAlreadyDeleted = true;
                                            for (const labId of labDocIds) {
                                              try {
                                                const exists = await labService.getLab(labId);
                                                if (exists) {
                                                  allAlreadyDeleted = false;
                                                  break;
                                                }
                                              } catch (checkError) {
                                                // Lab doesn't exist
                                              }
                                            }
                                            
                                            if (allAlreadyDeleted) {
                                              showSuccess(`${displayName} removed successfully.`);
                                              // Close the modal after successful deletion
                                              setDeleteConfirm({ ...deleteConfirm, show: false });
                                              return;
                                            }
                                          }
                                          
                                          if (deletedCount === 0) {
                                            await reloadHealthData();
                                            showError(`Could not delete ${displayName}. Please try refreshing the page.`);
                                            // Close the modal even on error
                                            setDeleteConfirm({ ...deleteConfirm, show: false });
                                            return;
                                          }
                                          
                                          await new Promise(resolve => setTimeout(resolve, 300));
                                          showSuccess(`${displayName} deleted successfully.`);
                                          
                                          // Close the modal after successful deletion
                                          setDeleteConfirm({ ...deleteConfirm, show: false });
                                        } catch (error) {
                                          await reloadHealthData();
                                          showError(`Failed to delete lab data: ${error.message || 'Please try again.'}`);
                                          // Close the modal even on error
                                          setDeleteConfirm({ ...deleteConfirm, show: false });
                                        }
                                      }
                                    });
                                  }}
                                  className={combineClasses("w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition-colors min-h-[44px] touch-manipulation active:opacity-70", DesignTokens.components.status.high.text, DesignTokens.components.status.high.bg.replace('bg-', 'hover:bg-'))}
                                >
                                  <Trash2 className="w-4 h-4" />
                                  {(() => {
                                    const labDoc = allLabData[key];
                                    const hasValues = (labDoc?.values?.length > 0) || (labDoc?.data?.length > 0) || (lab?.data?.length > 0);
                                    return hasValues ? 'Delete All' : 'Delete Metric';
                                  })()}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              } else {
                // Non-numeric labs
                const displayName = getLabDisplayName(lab.name || key);
                const isHidden = hiddenLabs.includes(key);
                return (
                  <div
                      key={key}
                      className={combineClasses(
                        'relative cursor-pointer',
                        DesignTokens.transitions.all,
                        metricSelectionMode && isHidden
                          ? combineClasses(DesignTokens.components.card.nestedWithShadow, 'opacity-50 border-2 border-dashed border-medical-neutral-300')
                          : combineClasses(DesignTokens.components.card.nestedWithShadow, 'hover:border-medical-neutral-300', DesignTokens.shadows.hover)
                      )}
                    onClick={() => {
                      if (metricSelectionMode) {
                        // If lab is hidden, unhide it when clicked
                        if (hiddenLabs.includes(key)) {
                          unhideLabs([key]);
                          return;
                        }
                        // Otherwise, toggle selection
                        const newSelected = new Set(selectedMetrics);
                        if (newSelected.has(key)) {
                          newSelected.delete(key);
                        } else {
                          newSelected.add(key);
                        }
                        setSelectedMetrics(newSelected);
                      }
                    }}
                  >
                    {metricSelectionMode && (
                      <div className="absolute top-3 left-3">
                        {isHidden ? (
                          <EyeOff className={combineClasses('w-5 h-5', DesignTokens.colors.neutral.text[400])} />
                        ) : (
                          <input
                            type="checkbox"
                            checked={selectedMetrics.has(key)}
                            onChange={() => {}}
                            className={combineClasses('w-5 h-5 rounded pointer-events-none', DesignTokens.colors.app.text[600], 'focus:ring-anchor-900', DesignTokens.colors.neutral.border[300])}
                          />
                        )}
                      </div>
                    )}

                    <div className={`flex items-start justify-between ${metricSelectionMode ? 'ml-8' : ''}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-semibold text-medical-neutral-900">{displayName}</p>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(key, 'labs');
                            }}
                            className={combineClasses("transition-colors", DesignTokens.colors.accent.text[500], DesignTokens.colors.accent.text[600])}
                            title={favoriteMetrics.labs?.includes(key) ? "Unpin from key metrics" : "Pin to key metrics"}
                          >
                            <Star className={combineClasses(
                              DesignTokens.icons.small.size.full,
                              favoriteMetrics.labs?.includes(key) 
                                ? DesignTokens.components.favorite.filled 
                                : DesignTokens.components.favorite.unfilled
                            )} />
                          </button>
                        </div>
                        {lab.current ? (
                          <>
                            <p className="text-base font-bold text-medical-neutral-900">{lab.current}</p>
                            {lab.unit && <p className="text-xs text-medical-neutral-500">{lab.unit}</p>}
                          </>
                        ) : (
                          <p className="text-sm text-medical-neutral-500 italic">No values yet</p>
                        )}
                        {lab.normalRange && (
                          <p className="text-xs text-medical-neutral-500 mt-1">Normal: {lab.normalRange}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              setOpenDeleteMenu(openDeleteMenu === `lab:${key}` ? null : `lab:${key}`);
                            }}
                            className="p-2 text-medical-neutral-500 hover:bg-medical-neutral-100 rounded transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation active:opacity-70"
                            title="More options"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          {openDeleteMenu === `lab:${key}` && (
                            <>
                              <div
                                className="fixed inset-0 z-[90]"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  setOpenDeleteMenu(null);
                                }}
                              />
                              <div className="absolute right-0 top-8 z-[100] bg-white rounded-lg shadow-lg border border-medical-neutral-200 py-1 min-w-[160px]">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    setOpenDeleteMenu(null);
                                    const labDoc = allLabData[key];
                                    if (labDoc && labDoc.id) {
                                      setSelectedLabForValue({ id: labDoc.id, name: displayName, unit: lab.unit || '', key: key });
                                      setNewLabValue({ value: '', date: getTodayLocalDate(), notes: '' });
                                      setShowAddLabValue(true);
                                    }
                                  }}
                                  className={combineClasses('w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 min-h-[44px] touch-manipulation active:opacity-70', DesignTokens.colors.neutral.text[700], 'hover:bg-medical-neutral-100')}
                                >
                                  <Plus className="w-4 h-4" />
                                  Add Value
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    setOpenDeleteMenu(null);
                                    const labDoc = allLabData[key];
                                    if (labDoc) {
                                      setEditingLab(labDoc);
                                      setEditingLabKey(key);
                                    }
                                  }}
                                  className={combineClasses('w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 min-h-[44px] touch-manipulation active:opacity-70', DesignTokens.colors.neutral.text[700], 'hover:bg-medical-neutral-100')}
                                >
                                  <Edit2 className="w-4 h-4" />
                                  Edit Metric
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    setOpenDeleteMenu(null);
                                    const labType = key;
                                    const labDoc = allLabData[key];
                                    const count = labDoc?.values?.length || labDoc?.data?.length || lab?.data?.length || 0;
                                    setDeleteConfirm({
                                      show: true,
                                      title: count > 0 ? `Delete All ${displayName} Data?` : `Delete ${displayName} Metric?`,
                                      message: count > 0 
                                        ? `This will permanently remove ${count} ${count === 1 ? 'entry' : 'entries'} of ${displayName} data.`
                                        : `This will permanently delete the ${displayName} metric card.`,
                                      itemName: count > 0 ? `all ${displayName} data` : `${displayName} metric`,
                                      confirmText: 'Yes, Delete',
                                      onConfirm: async () => {
                                        try {
                                          const labDoc = allLabData[labType];
                                          const labDocId = labDoc?.id;
                                          const labDocIds = labDoc?.labDocumentIds || (labDocId ? [labDocId] : []);
                                          
                                          const updatedLabsData = { ...labsData };
                                          delete updatedLabsData[labType];
                                          setLabsData(updatedLabsData);
                                          
                                          if (selectedLab === labType) {
                                            const firstAvailable = Object.keys(updatedLabsData).find(key => updatedLabsData[key]?.isNumeric);
                                            if (firstAvailable) {
                                              setSelectedLab(firstAvailable);
                                            } else {
                                              setSelectedLab(null);
                                            }
                                          }
                                          
                                          let deletedCount = await labService.deleteAllLabsByType(user.uid, labType);
                                          
                                          if (deletedCount === 0 && labDocIds.length > 0) {
                                            let directDeletedCount = 0;
                                            for (const labId of labDocIds) {
                                              try {
                                                const exists = await labService.getLab(labId);
                                                if (exists) {
                                                  await labService.deleteLab(labId);
                                                  directDeletedCount++;
                                                }
                                              } catch (deleteError) {
                                                if (deleteError.message && !deleteError.message.includes('not found') && !deleteError.message.includes('not exist')) {
                                                  throw deleteError;
                                                }
                                              }
                                            }
                                            deletedCount = directDeletedCount;
                                          }
                                          
                                          if (deletedCount === 0 && labDocIds.length > 0) {
                                            let allAlreadyDeleted = true;
                                            for (const labId of labDocIds) {
                                              try {
                                                const exists = await labService.getLab(labId);
                                                if (exists) {
                                                  allAlreadyDeleted = false;
                                                  break;
                                                }
                                              } catch (checkError) {
                                                // Lab doesn't exist
                                              }
                                            }
                                            
                                            if (allAlreadyDeleted) {
                                              showSuccess(`${displayName} removed successfully.`);
                                              // Close the modal after successful deletion
                                              setDeleteConfirm({ ...deleteConfirm, show: false });
                                              return;
                                            }
                                          }
                                          
                                          if (deletedCount === 0) {
                                            await reloadHealthData();
                                            showError(`Could not delete ${displayName}. Please try refreshing the page.`);
                                            // Close the modal even on error
                                            setDeleteConfirm({ ...deleteConfirm, show: false });
                                            return;
                                          }
                                          
                                          await new Promise(resolve => setTimeout(resolve, 300));
                                          showSuccess(`${displayName} deleted successfully.`);
                                          
                                          // Close the modal after successful deletion
                                          setDeleteConfirm({ ...deleteConfirm, show: false });
                                        } catch (error) {
                                          await reloadHealthData();
                                          showError(`Failed to delete lab data: ${error.message || 'Please try again.'}`);
                                          // Close the modal even on error
                                          setDeleteConfirm({ ...deleteConfirm, show: false });
                                        }
                                      }
                                    });
                                  }}
                                  className={combineClasses("w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition-colors min-h-[44px] touch-manipulation active:opacity-70", DesignTokens.components.status.high.text, DesignTokens.components.status.high.bg.replace('bg-', 'hover:bg-'))}
                                >
                                  <Trash2 className="w-4 h-4" />
                                  {(() => {
                                    const labDoc = allLabData[key];
                                    const hasValues = (labDoc?.values?.length > 0) || (labDoc?.data?.length > 0) || (lab?.data?.length > 0);
                                    return hasValues ? 'Delete All' : 'Delete Metric';
                                  })()}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }
            };

            // Helper function to get category for a lab key
            const getLabCategory = (labKey) => {
              for (const [category, labs] of Object.entries(categorizedLabs)) {
                if (labs.some(([key]) => key === labKey)) {
                  return category;
                }
              }
              return null;
            };

            const totalLabCount = Object.values(filteredCategorizedLabs).reduce((sum, labs) => sum + labs.length, 0);
            const emptyLabs = Object.entries(allLabData).filter(([key, lab]) => isLabEmptyHelper(lab));

            return (
              <div className="space-y-4 mt-6">
                {/* Search Bar and 3-dot Menu */}
                <div className="mb-4 space-y-3">
                  <div className="flex gap-2 items-center">
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className={combineClasses("h-5 w-5", DesignTokens.colors.neutral.text[300])} />
                      </div>
                      <input
                        type="text"
                        value={labSearchQuery}
                        onChange={(e) => setLabSearchQuery(e.target.value)}
                        placeholder="Search labs by name..."
                        className={combineClasses(DesignTokens.components.input.base, "block w-full pl-10 pr-3 py-2.5 rounded-lg leading-5 text-sm", DesignTokens.colors.neutral.text[500], 'focus:placeholder-gray-400')}
                      />
                      {labSearchQuery && (
                        <button
                          onClick={() => setLabSearchQuery('')}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center"
                        >
                          <X className={combineClasses("h-5 w-5 hover:text-medical-neutral-600", DesignTokens.colors.neutral.text[300])} />
                        </button>
                      )}
                    </div>

                    {/* 3-dot menu */}
                    <div className="relative">
                      <button
                        onClick={() => setOpenEmptyMetricsMenu(!openEmptyMetricsMenu)}
                        className={combineClasses("p-2 rounded-lg transition-colors hover:text-medical-neutral-700 hover:bg-medical-neutral-100", DesignTokens.colors.neutral.text[500])}
                        aria-label="Lab options"
                      >
                        <MoreVertical className="w-5 h-5" />
                      </button>

                      {openEmptyMetricsMenu && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setOpenEmptyMetricsMenu(false)}
                          />
                          <div className={combineClasses("absolute right-0 top-10 z-[100] bg-white rounded-lg shadow-lg border py-2 min-w-[240px]", DesignTokens.colors.neutral.border[200])}>
                            <button
                              onClick={() => {
                                setOpenEmptyMetricsMenu(false);
                                openDocumentOnboarding('lab-report');
                              }}
                              className={combineClasses("w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition-colors min-h-[44px] touch-manipulation active:opacity-70 hover:bg-medical-neutral-50", DesignTokens.colors.neutral.text[700])}
                            >
                              <Upload className="w-4 h-4" />
                              Upload Lab Report
                            </button>
                            <button
                              onClick={() => {
                                setOpenEmptyMetricsMenu(false);
                                setShowAddLab(true);
                              }}
                              className={combineClasses("w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition-colors min-h-[44px] touch-manipulation active:opacity-70 hover:bg-medical-neutral-50", DesignTokens.colors.neutral.text[700])}
                            >
                              <Plus className="w-4 h-4" />
                              Add Lab Metric
                            </button>
                            <div className={combineClasses("border-t my-1", DesignTokens.colors.neutral.border[200])}></div>
                            <button
                              onClick={() => {
                                setOpenEmptyMetricsMenu(false);
                                setMetricSelectionMode(true);
                                setSelectedMetrics(new Set());
                                const allExpanded = {};
                                Object.keys(expandedCategories).forEach(cat => {
                                  allExpanded[cat] = true;
                                });
                                setExpandedCategories(allExpanded);
                              }}
                              className={combineClasses("w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition-colors min-h-[44px] touch-manipulation active:opacity-70 hover:bg-medical-neutral-50", DesignTokens.colors.neutral.text[700])}
                            >
                              <Check className="w-4 h-4" />
                              Select metrics to hide/delete
                            </button>
                            {(patientProfile?.diagnosis || patientProfile?.cancerType) && (
                              <button
                                onClick={smartHideIrrelevantLabs}
                                className={combineClasses("w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition-colors min-h-[44px] touch-manipulation active:opacity-70 hover:bg-medical-neutral-50", DesignTokens.colors.neutral.text[700])}
                              >
                                <Sparkles className="w-4 h-4" />
                                Smart hide irrelevant metrics
                              </button>
                            )}
                            {hiddenLabs.length > 0 && (
                              <>
                                <div className={combineClasses("border-t my-1", DesignTokens.colors.neutral.border[200])}></div>
                                <label className={combineClasses("flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors hover:bg-medical-neutral-50")}>
                                  <input
                                    type="checkbox"
                                    checked={showHiddenLabs}
                                    onChange={(e) => {
                                      setShowHiddenLabs(e.target.checked);
                                      setOpenEmptyMetricsMenu(false);
                                    }}
                                    className={combineClasses("w-4 h-4 rounded focus:ring-anchor-900 focus:ring-2 cursor-pointer", DesignTokens.colors.app.text[600], DesignTokens.colors.neutral.border[300])}
                                  />
                                  <div className="flex items-center gap-2 flex-1">
                                    {showHiddenLabs ? (
                                      <Eye className={combineClasses("w-4 h-4", DesignTokens.colors.neutral.text[600])} />
                                    ) : (
                                      <EyeOff className={combineClasses("w-4 h-4", DesignTokens.colors.neutral.text[300])} />
                                    )}
                                    <span className={combineClasses("text-sm", DesignTokens.colors.neutral.text[700])}>
                                      Show hidden metrics ({hiddenLabs.length})
                                    </span>
                                  </div>
                                </label>
                                {showHiddenLabs && (
                                  <button
                                    onClick={async () => {
                                      setOpenEmptyMetricsMenu(false);
                                      if (hiddenLabs.length === 0) return;
                                      await unhideLabs(hiddenLabs);
                                    }}
                                    className={combineClasses("w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition-colors min-h-[44px] touch-manipulation active:opacity-70 hover:bg-medical-neutral-50", DesignTokens.colors.neutral.text[700])}
                                  >
                                    <Eye className="w-4 h-4" />
                                    Unhide all ({hiddenLabs.length})
                                  </button>
                                )}
                              </>
                            )}
                            {emptyLabs.length > 0 && (
                              <>
                                <div className={combineClasses("border-t my-1", DesignTokens.colors.neutral.border[200])}></div>
                                <label className={combineClasses("flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors hover:bg-medical-neutral-50")}>
                                  <input
                                    type="checkbox"
                                    checked={hideEmptyMetrics}
                                    onChange={(e) => {
                                      setHideEmptyMetrics(e.target.checked);
                                      setOpenEmptyMetricsMenu(false);
                                    }}
                                    className={combineClasses("w-4 h-4 rounded focus:ring-anchor-900 focus:ring-2 cursor-pointer", DesignTokens.colors.app.text[600], DesignTokens.colors.neutral.border[300])}
                                  />
                                  <div className="flex items-center gap-2 flex-1">
                                    {hideEmptyMetrics ? (
                                      <EyeOff className={combineClasses("w-4 h-4", DesignTokens.colors.neutral.text[600])} />
                                    ) : (
                                      <Eye className={combineClasses("w-4 h-4", DesignTokens.colors.neutral.text[300])} />
                                    )}
                                    <span className={combineClasses("text-sm", DesignTokens.colors.neutral.text[700])}>
                                      Hide metrics with no values
                                    </span>
                                  </div>
                                </label>
                                <button
                                  onClick={async () => {
                                    setOpenEmptyMetricsMenu(false);
                                    if (!user || !user.uid) {
                                      showError('You must be logged in to delete metrics.');
                                      return;
                                    }
                                    const emptyLabTypes = emptyLabs.map(([key]) => key);
                                    setDeleteConfirm({
                                      show: true,
                                      title: `Delete ${emptyLabTypes.length} Empty Metric${emptyLabTypes.length !== 1 ? 's' : ''}?`,
                                      message: `This will permanently delete ${emptyLabTypes.length} metric${emptyLabTypes.length !== 1 ? 's' : ''} with no values: ${emptyLabTypes.slice(0, 5).map(key => getLabDisplayName(allLabData[key]?.name || key)).join(', ')}${emptyLabTypes.length > 5 ? ` and ${emptyLabTypes.length - 5} more` : ''}.`,
                                      itemName: `${emptyLabTypes.length} empty metric${emptyLabTypes.length !== 1 ? 's' : ''}`,
                                      confirmText: 'Yes, Delete All',
                                      onConfirm: async () => {
                                        try {
                                          setIsDeletingEmptyMetrics(true);
                                          const deletePromises = emptyLabTypes.map(labType => 
                                            labService.deleteAllLabsByType(user.uid, labType)
                                          );
                                          const results = await Promise.all(deletePromises);
                                          const totalDeleted = results.reduce((sum, count) => sum + count, 0);
                                          await new Promise(resolve => setTimeout(resolve, 1000));
                                          await reloadHealthData();
                                          showSuccess(`Deleted ${totalDeleted} empty metric${totalDeleted !== 1 ? 's' : ''}`);
                                          setIsDeletingEmptyMetrics(false);
                                        } catch (error) {
                                          showError('Failed to delete empty metrics. Please try again.');
                                          setIsDeletingEmptyMetrics(false);
                                        }
                                      }
                                    });
                                  }}
                                  disabled={isDeletingEmptyMetrics}
                                  className={combineClasses("w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] touch-manipulation active:opacity-70", DesignTokens.components.status.high.text, DesignTokens.components.status.high.bg.replace('bg-', 'hover:bg-'))}
                                >
                                  {isDeletingEmptyMetrics ? (
                                    <>
                                      <Activity className="w-4 h-4 animate-spin" />
                                      Deleting...
                                    </>
                                  ) : (
                                    <>
                                      <Trash2 className="w-4 h-4" />
                                      Delete empty metrics ({emptyLabs.length})
                                    </>
                                  )}
                                </button>
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Selection Mode Banner */}
                {metricSelectionMode && (
                  <div className={combineClasses("border rounded-lg p-4 mb-4", DesignTokens.components.alert.info.bg, DesignTokens.components.alert.info.border)}>
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className={combineClasses("text-sm font-semibold", DesignTokens.colors.neutral.text[900])}>
                          Select metrics ({selectedMetrics.size} selected)
                        </h4>
                        <p className={combineClasses("text-xs mt-1", DesignTokens.colors.neutral.text[600])}>Click on metric cards to select them</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setMetricSelectionMode(false);
                            setSelectedMetrics(new Set());
                            setExpandedCategories({
                              'Disease-Specific Markers': false,
                              'Liver Function': false,
                              'Kidney Function': false,
                              'Blood Counts': false,
                              'Thyroid Function': false,
                              'Cardiac Markers': false,
                              'Inflammation': false,
                              'Electrolytes': false,
                              'Coagulation': false,
                              'Custom Values': false,
                              'Others': false
                            });
                          }}
                          className={combineClasses("px-3 py-1.5 text-sm bg-white border rounded hover:bg-medical-neutral-50", DesignTokens.colors.neutral.text[700], DesignTokens.colors.neutral.border[300])}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={hideSelectedLabs}
                          disabled={selectedMetrics.size === 0}
                          className={combineClasses("px-3 py-1.5 text-sm bg-white border rounded hover:bg-medical-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed", DesignTokens.colors.neutral.text[700], DesignTokens.colors.neutral.border[300])}
                        >
                          <EyeOff className="w-4 h-4 inline mr-1" />
                          Hide ({selectedMetrics.size})
                        </button>
                        <button
                          onClick={() => {
                            if (selectedMetrics.size === 0) {
                              showError('Please select at least one metric to delete');
                              return;
                            }
                            const selectedKeys = Array.from(selectedMetrics);
                            const selectedNames = selectedKeys.map(key => getLabDisplayName(allLabData[key]?.name || key));
                            setDeleteConfirm({
                              show: true,
                              title: `Delete ${selectedMetrics.size} Selected Metric${selectedMetrics.size !== 1 ? 's' : ''}?`,
                              message: `This will permanently delete: ${selectedNames.slice(0, 3).join(', ')}${selectedMetrics.size > 3 ? ` and ${selectedMetrics.size - 3} more` : ''}.`,
                              itemName: `${selectedMetrics.size} metric${selectedMetrics.size !== 1 ? 's' : ''}`,
                              confirmText: 'Yes, Delete',
                              onConfirm: async () => {
                                try {
                                  for (const labType of selectedKeys) {
                                    await labService.deleteAllLabsByType(user.uid, labType);
                                  }
                                  await reloadHealthData();
                                  setMetricSelectionMode(false);
                                  setSelectedMetrics(new Set());
                                  setExpandedCategories({
                                    'Disease-Specific Markers': false,
                                    'Liver Function': false,
                                    'Kidney Function': false,
                                    'Blood Counts': false,
                                    'Thyroid Function': false,
                                    'Cardiac Markers': false,
                                    'Inflammation': false,
                                    'Electrolytes': false,
                                    'Coagulation': false,
                                    'Custom Values': false,
                                    'Others': false
                                  });
                                  showSuccess(`Deleted ${selectedKeys.length} metric${selectedKeys.length !== 1 ? 's' : ''}`);
                                } catch (error) {
                                  showError('Failed to delete selected metrics');
                                }
                              }
                            });
                          }}
                          disabled={selectedMetrics.size === 0}
                          className={combineClasses("px-3 py-1.5 text-sm text-white rounded disabled:opacity-50 disabled:cursor-not-allowed", 'bg-red-600', 'hover:bg-red-700')}
                        >
                          Delete ({selectedMetrics.size})
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Total metrics count */}
                {totalLabCount > 0 && !metricSelectionMode && (
                  <p className="text-sm text-medical-neutral-600 mb-2 text-left">
                    {labSearchQuery
                      ? `${totalLabCount} metric${totalLabCount !== 1 ? 's' : ''} found`
                      : `${totalLabCount} metric${totalLabCount !== 1 ? 's' : ''} tracked`}
                  </p>
                )}
                {labSearchQuery && totalLabCount === 0 && (
                  <p className={combineClasses("text-sm mb-2 text-left", DesignTokens.colors.neutral.text[500])}>
                    No labs found matching "{labSearchQuery}"
                  </p>
                )}

                {/* Key metrics - small cards (pinned or first labs with data), same style/behavior as Vitals */}
                {!labSearchQuery && totalLabCount > 0 && (() => {
                  const keyLabKeys = favoriteMetrics.labs?.length > 0
                    ? favoriteMetrics.labs.filter(key => allLabData[key] && !isLabEmptyHelper(allLabData[key]))
                    : Object.keys(allLabData)
                        .filter(key => !isLabEmptyHelper(allLabData[key]))
                        .slice(0, 6);
                  if (keyLabKeys.length === 0) return null;
                  return (
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Star className={combineClasses(
                          DesignTokens.icons.button.size.full,
                          keyLabKeys.length && favoriteMetrics.labs?.length > 0 ? DesignTokens.components.favorite.filled : DesignTokens.colors.neutral.text[500]
                        )} />
                        <h3 className="text-sm font-semibold text-medical-neutral-700">
                          {favoriteMetrics.labs?.length > 0 ? 'Key Labs' : 'Key Metrics'}
                        </h3>
                      </div>
                      <div className={combineClasses('flex flex-nowrap overflow-x-auto gap-2 pb-1', DesignTokens.spacing.gap.sm)}>
                        {keyLabKeys.map((key) => {
                          const lab = allLabData[key];
                          const displayName = getLabDisplayName(lab?.name || key);
                          const currentVal = lab?.current;
                          const unit = lab?.unit || '';
                          const canonicalKey = normalizeLabName(lab?.name || key);
                          const normalRange = lab?.normalRange || (canonicalKey && labDefaultNormalRanges[canonicalKey]);
                          const labStatus = getLabStatus(currentVal, normalRange);
                          const statusColorClass =
                            labStatus.color === 'red' ? DesignTokens.components.status.high.icon :
                            labStatus.color === 'yellow' ? DesignTokens.components.status.low.icon :
                            DesignTokens.components.status.normal.icon;
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => setSelectedLab(key)}
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

                {/* Category Cards */}
                {categoryOrder.map(category => {
                  const labsInCategory = filteredCategorizedLabs[category];
                  if (!labsInCategory || labsInCategory.length === 0) return null;

                  const isExpanded = expandedCategories[category];
                  const CategoryIcon = categoryIcons[category] || Activity;
                  const description = categoryDescriptions[category];

                  return (
                    <div
                      key={category}
                      data-category={category}
                      className="bg-white rounded-xl shadow-sm border border-medical-neutral-200 overflow-visible transition-all hover:shadow-md"
                    >
                      <button
                        onClick={() => setExpandedCategories(prev => {
                          const isCurrentlyExpanded = prev[category];
                          const allClosed = Object.keys(prev).reduce((acc, key) => {
                            acc[key] = false;
                            return acc;
                          }, {});
                          return {
                            ...allClosed,
                            [category]: !isCurrentlyExpanded
                          };
                        })}
                        className="w-full p-3 sm:p-5 flex items-center justify-between hover:bg-medical-neutral-50 transition-colors min-h-[44px] touch-manipulation active:opacity-70"
                      >
                        <div className="flex items-center gap-4 flex-1">
                          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-medical-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <CategoryIcon className="w-5 h-5 sm:w-6 sm:h-6 text-medical-primary-600" />
                          </div>
                          <div className="text-left flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-base sm:text-lg font-semibold text-medical-neutral-900">{category}</h3>
                              {sectionInsights[category] && (
                                <SectionInsightBadge insight={sectionInsights[category]} />
                              )}
                            </div>
                            <p className="text-xs sm:text-sm text-medical-neutral-600 mt-1">{description}</p>
                            <p className="text-xs text-medical-neutral-500 mt-1">{labsInCategory.length} value{labsInCategory.length !== 1 ? 's' : ''} tracked</p>
                            {(() => {
                              const conditions = detectCategoryConditions(labsInCategory);
                              if (conditions.length === 0) return null;
                              return (
                                <div
                                  className="flex flex-wrap gap-1 mt-1.5"
                                  onClick={(e) => e.stopPropagation()}
                                  role="presentation"
                                >
                                  {conditions.map(c => <ConditionBadge key={c.name} condition={c} />)}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                        <div className="ml-4 flex-shrink-0">
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-medical-neutral-500" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-medical-neutral-500" />
                          )}
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="px-3 sm:px-5 pb-3 sm:pb-5 pt-2 border-t border-medical-neutral-100 overflow-visible">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mt-4 overflow-visible">
                            {labsInCategory.map(([key, lab]) => (
                              renderLabCard(key, lab)
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </>
      )}

      {/* PRO-CTCAE Information Card - Collapsible */}
      <div className={combineClasses(
        DesignTokens.components.card.container,
        'border-l-4 border-medical-primary-500'
      )}>
        <button
          onClick={() => setIsDataCalculationExpanded(!isDataCalculationExpanded)}
          className="w-full flex items-center justify-between gap-3 text-left"
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex-shrink-0">
              <Info className="w-5 h-5 text-medical-primary-600" />
            </div>
            <h3 className="text-sm font-semibold text-anchor-900">
              How We Calculate Your Data
            </h3>
          </div>
          <div className="flex-shrink-0">
            {isDataCalculationExpanded ? (
              <ChevronUp className="w-5 h-5 text-medical-neutral-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-medical-neutral-500" />
            )}
          </div>
        </button>
        
        {isDataCalculationExpanded && (
          <div className="mt-4 pt-4 border-t border-medical-neutral-100">
            <p className="text-xs sm:text-sm text-anchor-700 mb-3">
              The severity ratings shown on each lab category (Normal, Mild, Moderate, Severe, Very severe) are calculated using the{' '}
              <a 
                href="https://healthcaredelivery.cancer.gov/pro-ctcae/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-medical-primary-600 hover:text-medical-primary-700 underline font-medium"
              >
                Patient-Reported Outcomes version of the Common Terminology Criteria for Adverse Events (PRO-CTCAE)
              </a>
              {' '}methodology developed by the National Cancer Institute.
            </p>
            <p className="text-xs sm:text-sm text-anchor-700 mb-3">
              <strong>Normal Ranges:</strong> Normal ranges are extracted from your uploaded lab reports and medical documents. When not available in documents, we use age- and gender-appropriate clinical reference values, or standard default ranges for common lab tests.
            </p>
            <p className="text-xs text-anchor-600">
              For applicable categories, we use CTCAE grading criteria (Grades 0-4) to assess the severity of abnormal lab values. The overall category rating reflects the worst grade found in that category, helping you understand the overall health status of each lab category at a glance.
            </p>
          </div>
        )}
      </div>

      {/* Modals */}
      <AddLabModal
        show={showAddLab}
        onClose={() => {
          setShowAddLab(false);
          setNewLabData({ label: '', normalRange: '', unit: '' });
        }}
        user={user}
        reloadHealthData={reloadHealthData}
      />

      <AddLabValueModal
        show={showAddLabValue && !!selectedLabForValue}
        onClose={() => {
          setShowAddLabValue(false);
          setSelectedLabForValue(null);
          setIsEditingLabValue(false);
          setEditingLabValueId(null);
          setNewLabValue({ value: '', date: getTodayLocalDate(), notes: '' });
        }}
        user={user}
        selectedLabForValue={selectedLabForValue}
        setSelectedLabForValue={setSelectedLabForValue}
        newLabValue={newLabValue}
        setNewLabValue={setNewLabValue}
        isEditingLabValue={isEditingLabValue}
        setIsEditingLabValue={setIsEditingLabValue}
        editingLabValueId={editingLabValueId}
        setEditingLabValueId={setEditingLabValueId}
        reloadHealthData={reloadHealthData}
        setSelectedLab={setSelectedLab}
      />

      <EditLabModal
        show={!!editingLab}
        onClose={() => {
          setEditingLab(null);
          setEditingLabKey(null);
        }}
        user={user}
        lab={editingLab}
        labKey={editingLabKey}
        onSave={async () => {
          await reloadHealthData();
        }}
        onDeleteValue={async (labId, valueId, labKey) => {
          try {
            await labService.deleteLabValue(labId, valueId);
            await reloadHealthData();
          } catch (error) {
            showError(`Failed to delete value: ${error.message || 'Please try again.'}`);
            throw error;
          }
        }}
      />

      <DeletionConfirmationModal
        show={deleteConfirm.show}
        title={deleteConfirm.title}
        message={deleteConfirm.message}
        itemName={deleteConfirm.itemName}
        confirmText={deleteConfirm.confirmText}
        onConfirm={deleteConfirm.onConfirm}
        onClose={() => {
          if (!isDeletingLabValue) {
            setDeleteConfirm({ ...deleteConfirm, show: false });
          }
        }}
        isDeleting={isDeletingLabValue}
      />

      <LabTooltipModal
        show={!!labTooltip}
        labTooltip={labTooltip}
        onClose={() => setLabTooltip(null)}
      />
    </div>
  );
}

// Memoize component to prevent unnecessary re-renders
// Only re-renders when props change
export default React.memo(LabsSection, (prevProps, nextProps) => {
  // Custom comparison function for optimal performance
  return (
    prevProps.selectedDataPoint?.id === nextProps.selectedDataPoint?.id &&
    prevProps.hoveredDataPoint?.id === nextProps.hoveredDataPoint?.id &&
    prevProps.onTabChange === nextProps.onTabChange &&
    prevProps.openDocumentOnboarding === nextProps.openDocumentOnboarding &&
    prevProps.setSelectedDataPoint === nextProps.setSelectedDataPoint &&
    prevProps.setHoveredDataPoint === nextProps.setHoveredDataPoint
  );
});
