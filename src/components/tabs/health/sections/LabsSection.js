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
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Search, Eye, EyeOff, Star 
} from 'lucide-react';
import { DesignTokens, combineClasses } from '../../../../design/designTokens';
import { useAuth } from '../../../../contexts/AuthContext';
import { usePatientContext } from '../../../../contexts/PatientContext';
import { useHealthContext } from '../../../../contexts/HealthContext';
import { useBanner } from '../../../../contexts/BannerContext';
import { labService, patientService } from '../../../../firebase/services';
import { getLabStatus } from '../../../../utils/healthUtils';
import { 
  normalizeLabName, 
  getLabDisplayName, 
  labValueDescriptions, 
  categorizeLabs 
} from '../../../../utils/normalizationUtils';
import { categoryIcons, categoryDescriptions } from '../../../../constants/categories';
import AddLabModal from '../../../modals/AddLabModal';
import AddLabValueModal from '../../../modals/AddLabValueModal';
import EditLabModal from '../../../modals/EditLabModal';
import DeletionConfirmationModal from '../../../modals/DeletionConfirmationModal';
import LabTooltipModal from '../../../modals/LabTooltipModal';
import { isLabEmpty, filterLabsBySearch } from '../utils/labFilters';
import { calculateYAxisBounds, generateYAxisLabels, parseNormalRangeForChart, generateChartPoints } from '../utils/chartUtils';

export default function LabsSection({ 
  onTabChange,
  openDocumentOnboarding,
  selectedDataPoint,
  setSelectedDataPoint,
  hoveredDataPoint,
  setHoveredDataPoint
}) {
  const { user } = useAuth();
  const { patientProfile } = usePatientContext();
  const { labsData, hasRealLabData, reloadHealthData } = useHealthContext();
  const { showSuccess, showError } = useBanner();

  // Labs-specific state
  const [selectedLab, setSelectedLab] = useState('ca125');
  const [labSearchQuery, setLabSearchQuery] = useState('');
  const [hideEmptyMetrics, setHideEmptyMetrics] = useState(false);
  const [isDeletingEmptyMetrics, setIsDeletingEmptyMetrics] = useState(false);
  const [showAddLab, setShowAddLab] = useState(false);
  const [showAddLabValue, setShowAddLabValue] = useState(false);
  const [selectedLabForValue, setSelectedLabForValue] = useState(null);
  const [newLabValue, setNewLabValue] = useState({ value: '', date: '', notes: '' });
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
  const [metricSelectionMode, setMetricSelectionMode] = useState(false);
  const [selectedMetrics, setSelectedMetrics] = useState(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [favoriteMetrics, setFavoriteMetrics] = useState({ labs: [], vitals: [] });

  const allLabData = labsData;

  // Load favorites from patient profile
  useEffect(() => {
    if (patientProfile) {
      setFavoriteMetrics(patientProfile.favoriteMetrics || { labs: [], vitals: [] });
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
      // Revert on error
      setFavoriteMetrics(favoriteMetrics);
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

  // Get current lab, ensuring it exists
  const currentLab = allLabData[selectedLab] || Object.values(allLabData).find(lab => lab.isNumeric) || Object.values(allLabData)[0] || {
    name: 'No Data',
    current: '--',
    unit: '',
    status: 'normal',
    trend: 'stable',
    normalRange: '--',
    isNumeric: false,
    data: []
  };

  // Memoize categorized labs
  const categorizedLabs = useMemo(() => {
    return categorizeLabs(allLabData);
  }, [allLabData]);

  // Filter labs by search and empty metrics
  const filteredCategorizedLabs = useMemo(() => {
    const filtered = {};
    Object.keys(categorizedLabs).forEach(category => {
      const categoryLabs = categorizedLabs[category];
      const filteredLabs = filterLabsBySearch(categoryLabs, labSearchQuery, hideEmptyMetrics);
      if (filteredLabs.length > 0) {
        filtered[category] = filteredLabs;
      }
    });
    return filtered;
  }, [categorizedLabs, labSearchQuery, hideEmptyMetrics]);

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

      {/* Show data if available - Full Labs section content goes here */}
      {(hasRealLabData || Object.keys(labsData).length > 0) && (
        <div>
          {/* TODO: Add the full Labs section rendering logic here */}
          {/* This includes: charts, lab cards, search, filters, etc. */}
          {/* Content from HealthTab.js lines 659-2645 */}
          <p className="text-sm text-gray-500">Labs section content will be added here...</p>
        </div>
      )}

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
          setNewLabValue({ value: '', date: '', notes: '' });
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
        editingLab={editingLab}
        editingLabKey={editingLabKey}
        reloadHealthData={reloadHealthData}
      />

      <DeletionConfirmationModal
        show={deleteConfirm.show}
        title={deleteConfirm.title}
        message={deleteConfirm.message}
        itemName={deleteConfirm.itemName}
        confirmText={deleteConfirm.confirmText}
        onConfirm={deleteConfirm.onConfirm}
        onClose={() => setDeleteConfirm({ ...deleteConfirm, show: false })}
      />
    </div>
  );
}