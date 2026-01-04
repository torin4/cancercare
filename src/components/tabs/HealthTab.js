import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, BarChart, Heart, Thermometer, Pill, Plus, Upload, Edit2, X, TrendingUp, TrendingDown, Minus, Activity, Info, Calendar, Clock, Check, AlertCircle, Trash2, MoreVertical, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Search, Eye, EyeOff, Star, ClipboardList } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePatientContext } from '../../contexts/PatientContext';
import { useHealthContext } from '../../contexts/HealthContext';
import { useBanner } from '../../contexts/BannerContext';
import { labService, vitalService, symptomService, medicationService, patientService } from '../../firebase/services';
import { getLabStatus, getVitalStatus, getWeightNormalRange } from '../../utils/healthUtils';
import { normalizeLabName, getLabDisplayName, labValueDescriptions, normalizeVitalName, getVitalDisplayName, vitalDescriptions, categorizeLabs } from '../../utils/normalizationUtils';
import { categoryIcons, categoryDescriptions } from '../../constants/categories';
import { getTodayLocalDate, formatDateString } from '../../utils/helpers';
import AddSymptomModal from '../modals/AddSymptomModal';
import AddMedicationModal from '../modals/AddMedicationModal';
import AddLabModal from '../modals/AddLabModal';
import AddVitalModal from '../modals/AddVitalModal';
import AddVitalValueModal from '../modals/AddVitalValueModal';
import AddLabValueModal from '../modals/AddLabValueModal';
import EditLabModal from '../modals/EditLabModal';
import DocumentUploadOnboarding from '../DocumentUploadOnboarding';
import DeletionConfirmationModal from '../modals/DeletionConfirmationModal';
import UploadProgressOverlay from '../UploadProgressOverlay';
import { processDocument, generateChatSummary } from '../../services/documentProcessor';
import { uploadDocument } from '../../firebase/storage';

export default function HealthTab({ onTabChange, initialSection = null }) {
  const { user } = useAuth();
  const { hasUploadedDocument, patientProfile, refreshPatient } = usePatientContext();
  const { labsData, setLabsData, vitalsData, setVitalsData, hasRealLabData, hasRealVitalData, reloadHealthData } = useHealthContext();
  const { showSuccess, showError } = useBanner();

  // Tab-specific state
  const [healthSection, setHealthSection] = useState(initialSection || 'labs');
  const [selectedDataPoint, setSelectedDataPoint] = useState(null); // Track which data point tooltip is open
  const [hoveredDataPoint, setHoveredDataPoint] = useState(null); // Track which data point is being hovered
  
  // Close tooltip when clicking outside
  useEffect(() => {
    if (selectedDataPoint) {
      const handleClickOutside = (e) => {
        // Don't close if clicking on a button or tooltip
        if (!e.target.closest('.tooltip-container') && !e.target.closest('button')) {
          setSelectedDataPoint(null);
        }
      };
      
      // Add a small delay to allow button clicks to register first
      const timer = setTimeout(() => {
        document.addEventListener('click', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside);
      }, 100);
      
      return () => {
        clearTimeout(timer);
        document.removeEventListener('click', handleClickOutside);
        document.removeEventListener('touchstart', handleClickOutside);
      };
    }
  }, [selectedDataPoint]);
  
  // Update section when initialSection prop changes (e.g., after document upload)
  useEffect(() => {
    if (initialSection && ['labs', 'vitals', 'symptoms', 'medications'].includes(initialSection)) {
      setHealthSection(initialSection);
    }
  }, [initialSection]);

  // Check for healthSection from sessionStorage (set by DashboardTab View All buttons)
  useEffect(() => {
    const healthSectionFromStorage = sessionStorage.getItem('healthSection');
    if (healthSectionFromStorage && ['labs', 'vitals', 'symptoms', 'medications'].includes(healthSectionFromStorage)) {
      setHealthSection(healthSectionFromStorage);
      sessionStorage.removeItem('healthSection');
    }
  }, []);
  
  const [selectedLab, setSelectedLab] = useState('ca125');
  const [selectedDate, setSelectedDate] = useState(null);
  const [labSearchQuery, setLabSearchQuery] = useState('');
  const [hideEmptyMetrics, setHideEmptyMetrics] = useState(false);
  const [isDeletingEmptyMetrics, setIsDeletingEmptyMetrics] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [pendingDocumentDate, setPendingDocumentDate] = useState(null);
  const [pendingDocumentNote, setPendingDocumentNote] = useState(null);
  const [symptomCalendarDate, setSymptomCalendarDate] = useState(new Date());
  const [showAddMedication, setShowAddMedication] = useState(false);
  const [selectedVital, setSelectedVital] = useState('bp');
  const [showAddVital, setShowAddVital] = useState(false);
  const [showAddVitalValue, setShowAddVitalValue] = useState(false);
  const [selectedVitalForValue, setSelectedVitalForValue] = useState(null);
  const [newVitalValue, setNewVitalValue] = useState({ value: '', systolic: '', diastolic: '', dateTime: new Date().toISOString().slice(0, 16), notes: '' });
  const [isEditingVitalValue, setIsEditingVitalValue] = useState(false);
  const [editingVitalValueId, setEditingVitalValueId] = useState(null);
  const [newVital, setNewVital] = useState({ vitalType: '', value: '', systolic: '', diastolic: '', dateTime: new Date().toISOString().slice(0, 16), notes: '' });
  const [isEditingVital, setIsEditingVital] = useState(false);
  const [showAddSymptomModal, setShowAddSymptomModal] = useState(false);
  const [symptomForm, setSymptomForm] = useState({
    name: '',
    severity: '',
    date: getTodayLocalDate(),
    time: new Date().toTimeString().slice(0, 5),
    notes: '',
    customSymptomName: '',
    tags: []
  });
  const [symptoms, setSymptoms] = useState([]);
  const [medications, setMedications] = useState([]);
  const [medicationLog, setMedicationLog] = useState([]);
  const [showAddLab, setShowAddLab] = useState(false);
  const [showAddLabValue, setShowAddLabValue] = useState(false);
  const [selectedLabForValue, setSelectedLabForValue] = useState(null);
  const [newLabValue, setNewLabValue] = useState({ value: '', date: getTodayLocalDate(), notes: '' });
  const [isEditingLabValue, setIsEditingLabValue] = useState(false);
  const [editingLabValueId, setEditingLabValueId] = useState(null);
  const [newLabData, setNewLabData] = useState({
    label: '',
    normalRange: '',
    unit: ''
  });
  const [showAllLabs, setShowAllLabs] = useState(false);
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
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, title: '', message: '', onConfirm: null, itemName: '', confirmText: 'Yes, Delete Permanently' });
  const [metricSelectionMode, setMetricSelectionMode] = useState(false);
  const [selectedMetrics, setSelectedMetrics] = useState(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [favoriteMetrics, setFavoriteMetrics] = useState({ labs: [], vitals: [] });
  const [showDocumentOnboarding, setShowDocumentOnboarding] = useState(false);
  const [documentOnboardingMethod, setDocumentOnboardingMethod] = useState('picker');

  const allLabData = labsData;
  const allVitalsData = vitalsData;

  // Load favorites from patient profile
  useEffect(() => {
    if (patientProfile) {
      setFavoriteMetrics(patientProfile.favoriteMetrics || { labs: [], vitals: [] });
    }
  }, [patientProfile]);

  // Helper function to check if a lab is empty (defined at component level so toggleFavorite can use it)
  const isLabEmptyHelper = (lab) => {
    if (!lab) return true;
    if (!lab.data || !Array.isArray(lab.data) || lab.data.length === 0) {
      return true; // No data at all
    }
    
    const labDocIds = lab.labDocumentIds || [lab.id];
    const allDataIdsAreFallback = lab.data.every(d => labDocIds.includes(d.id));
    
    const hasValidValues = lab.data.some(d => {
      const value = d.value;
      if (value == null || value === undefined || value === '') return false;
      const valueStr = String(value).trim().toLowerCase();
      if (valueStr === '-' || valueStr === '—' || valueStr === 'n/a' || valueStr === 'na' || 
          valueStr === '未測定' || valueStr === '測定なし' || valueStr === '--') {
        return false;
      }
      if (lab.isNumeric && isNaN(parseFloat(value))) {
        return false;
      }
      return true;
    });
    
    return allDataIdsAreFallback || !hasValidValues;
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
      // For vitals, use the raw count
      let validFavoritesCount = typeArray.length;
      if (type === 'labs') {
        // Count only valid labs (ones that exist and are not empty)
        validFavoritesCount = typeArray.filter(key => {
          const lab = allLabData[key];
          return lab && !isLabEmptyHelper(lab);
        }).length;
      }

      // Check if already at limit of 4 valid favorites for this type
      if (validFavoritesCount >= 4) {
        const typeLabel = type === 'labs' ? 'labs' : 'vitals';
        showError(`You can only select up to 4 favorite ${typeLabel}. Please remove one before adding another.`);
        return;
      }
      // Add to favorites
      newFavorites[type] = [...typeArray, metricKey];
    }

    setFavoriteMetrics(newFavorites);

    try {
      await patientService.updateFavoriteMetrics(user.uid, newFavorites);
      // Refresh patient profile to ensure context is updated
      await refreshPatient();
      showSuccess(typeArray.includes(metricKey) ? 'Removed from favorites' : 'Added to favorites');
    } catch (error) {
      // Revert on error
      setFavoriteMetrics(favoriteMetrics);
      showError('Failed to update favorites');
    }
  };

  // Get current lab for display
  const currentLab = allLabData[selectedLab] || Object.values(allLabData).find(lab => lab.isNumeric) || Object.values(allLabData)[0] || {
    name: 'No Lab Selected',
    current: '--',
    unit: '',
    data: [],
    isNumeric: false
  };

  const isMedicationTaken = (medId, scheduledTime) => {
    const today = new Date().toDateString();
    return medicationLog.some(log => {
      const logDate = new Date(log.takenAt).toDateString();
      return log.medId === medId &&
        log.scheduledTime === scheduledTime &&
        logDate === today;
    });
  };

  const markMedicationTaken = (medId, scheduledTime) => {
    const now = new Date().toISOString();
    setMedicationLog([...medicationLog, {
      medId: medId,
      scheduledTime: scheduledTime,
      takenAt: now
    }]);
  };

  const openDocumentOnboarding = (docType = null, method = 'picker') => {
    setDocumentOnboardingMethod(method || 'picker');
    setShowDocumentOnboarding(true);
  };

  // Document upload handlers
  const handleRealFileUpload = async (file, docType) => {
    if (!user) {
      showError('Please log in to upload files');
      return;
    }

    try {
      // Show loading overlay
      setIsUploading(true);
      setUploadProgress('Reading document...');

      // Get document date and note (user-provided or null)
      const providedDate = pendingDocumentDate;
      const providedNote = pendingDocumentNote;
      // Clear pending date and note after use
      setPendingDocumentDate(null);
      setPendingDocumentNote(null);

      // Step 1: Process document with AI to extract medical data
      setUploadProgress('Analyzing document with AI...');
      const processingResult = await processDocument(file, user.uid, patientProfile, providedDate, providedNote, null);

      // Step 2: Upload file to Firebase Storage
      setUploadProgress('Uploading to secure storage...');
      // Use user-provided date, or AI-extracted date, or null (will default to today)
      const dateForFilename = providedDate || processingResult.extractedDate || null;
      
      const uploadResult = await uploadDocument(file, user.uid, {
        category: processingResult.documentType || docType,
        documentType: processingResult.documentType || docType,
        date: dateForFilename, // Pass the date (user-provided or AI-extracted) for filename
        note: providedNote || null,
        dataPointCount: processingResult.dataPointCount || 0
      });


      // Step 3: Link all extracted values to the document ID
      setUploadProgress('Linking data to document...');
      if (processingResult.extractedData && uploadResult.id) {
        try {
          const { linkValuesToDocument } = await import('../../services/documentProcessor');
          await linkValuesToDocument(processingResult.extractedData, uploadResult.id, user.uid);
        } catch (linkError) {
        }
      }

      setUploadProgress('Saving extracted data...');

      // Reload health data to show new values
      setUploadProgress('Refreshing your health data...');
      await reloadHealthData();

      setIsUploading(false);
      setUploadProgress('');
      const dataPointText = processingResult.dataPointCount > 0 
        ? ` ${processingResult.dataPointCount} data point${processingResult.dataPointCount !== 1 ? 's' : ''} extracted.`
        : '';
showSuccess(`Document uploaded and processed successfully!${dataPointText} All extracted data has been saved to your health records.`);
       
       // Generate chat summary and navigate to chat
       const chatSummary = generateChatSummary(processingResult.extractedData, processingResult.extractedData);
       
       // Store the summary in sessionStorage for the chat tab to pick up
       sessionStorage.setItem('uploadSummary', JSON.stringify({
         summary: chatSummary,
         timestamp: Date.now(),
         documentType: processingResult.documentType || docType
       }));
       
       // Navigate to chat tab
       onTabChange('chat');
    } catch (error) {
      showError(`Failed to process document: ${error.message}. The file was not uploaded. Please try again or contact support if the issue persists.`);
      setIsUploading(false);
      setUploadProgress('');
    }
  };

  const simulateDocumentUpload = (docType) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.vcf,.vcf.gz,.maf,.bed,.txt,.csv,.tsv,.zip,.gz,.xlsx,.xls';
    input.style.display = 'none';

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        await handleRealFileUpload(file, docType);
      }
    };

    document.body.appendChild(input);
    input.click();
    setTimeout(() => {
      if (document.body.contains(input)) {
        document.body.removeChild(input);
      }
    }, 1000);
  };

  const simulateCameraUpload = (docType) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.vcf,.vcf.gz,.maf,.bed,.txt,.csv,.tsv,.zip,.gz,.xlsx,.xls,image/*';
    input.capture = 'environment';
    input.style.display = 'none';

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        await handleRealFileUpload(file, docType);
      }
    };

    document.body.appendChild(input);
    input.click();
    setTimeout(() => {
      if (document.body.contains(input)) {
        document.body.removeChild(input);
      }
    }, 1000);
  };

  // Real-time subscription for symptoms
  useEffect(() => {
    if (!user) return;
    const unsub = symptomService.subscribeSymptoms(user.uid, (items) => {
      setSymptoms(items);
    });
    return () => unsub && unsub();
  }, [user]);

  // Load medications
  useEffect(() => {
    const loadMedications = async () => {
      if (user) {
        try {
          const meds = await medicationService.getMedications(user.uid);
          setMedications(meds);
        } catch (error) {
        }
      }
    };
    loadMedications();
  }, [user]);

  // Auto-select first numeric lab when labs data changes
  useEffect(() => {
    if (Object.keys(allLabData).length > 0 && !allLabData[selectedLab]?.isNumeric) {
      const firstNumericLab = Object.keys(allLabData).find(key => allLabData[key]?.isNumeric);
      if (firstNumericLab) {
        setSelectedLab(firstNumericLab);
      }
    }
  }, [allLabData, selectedLab]);

  // Auto-select first vital when vitals data changes
  useEffect(() => {
    if (Object.keys(allVitalsData).length > 0 && !allVitalsData[selectedVital]) {
      const firstVital = Object.keys(allVitalsData)[0];
      if (firstVital) {
        setSelectedVital(firstVital);
      }
    }
  }, [allVitalsData, selectedVital]);

  // Auto-locate to today when symptoms section is opened
  useEffect(() => {
    if (healthSection === 'symptoms') {
      const today = new Date();
      const localToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      setSymptomCalendarDate(localToday);
      const todayDay = localToday.getDate().toString();
      const hasSymptomsToday = symptoms.some(s => {
        const symptomDate = s.date instanceof Date ? s.date : new Date(s.date);
        const localSymptomDate = new Date(symptomDate.getFullYear(), symptomDate.getMonth(), symptomDate.getDate());
        return localSymptomDate.getDate().toString() === todayDay && 
               localSymptomDate.getMonth() === localToday.getMonth() && 
               localSymptomDate.getFullYear() === localToday.getFullYear();
      });
      if (hasSymptomsToday) {
        setSelectedDate(todayDay);
      }
    }
  }, [healthSection, symptoms]);

  // Check for showAddLab flag from sessionStorage (set by DashboardTab)
  useEffect(() => {
    const showAddLabFlag = sessionStorage.getItem('showAddLab');
    if (showAddLabFlag === 'true') {
      setShowAddLab(true);
      sessionStorage.removeItem('showAddLab');
    }
  }, []);

  // Handle "Ask About Health" button - needs to set context and switch to chat
  const handleAskAboutHealth = async () => {
    if (!user) return;
    try {
      const labs = await labService.getLabs(user.uid);
      const vitals = await vitalService.getVitals(user.uid);
      const symptomData = await symptomService.getSymptoms(user.uid);
      
      // Load ALL values for each lab and vital (with dates and notes)
      const labsWithValues = await Promise.all(labs.map(async (lab) => {
        if (lab.id) {
          const values = await labService.getLabValues(lab.id);
          return { ...lab, values: values || [] };
        }
        return lab;
      }));
      
      const vitalsWithValues = await Promise.all(vitals.map(async (vital) => {
        if (vital.id) {
          const values = await vitalService.getVitalValues(vital.id);
          return { ...vital, values: values || [] };
        }
        return vital;
      }));
      
      // Store in sessionStorage for ChatTab to access
      sessionStorage.setItem('currentHealthContext', JSON.stringify({
        labs: labsWithValues,
        vitals: vitalsWithValues,
        symptoms: symptomData
      }));
      
      // Store message to add
      sessionStorage.setItem('healthContextMessage', JSON.stringify({
        type: 'ai',
        text: `I'm ready to answer questions about your health data. I can see your labs, vitals, and symptoms. You can ask me about trends, what values mean, or any concerns you have.`
      }));
      
      onTabChange('chat');
    } catch (error) {
      showError('Error loading health data. Please try again.');
    }
  };

  return (
    <div className="p-3 sm:p-4 md:p-6">
      {/* Header */}
      <div className="mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3">
        <div className="bg-medical-primary-50 p-2 sm:p-2.5 rounded-lg">
          <ClipboardList className="w-5 h-5 sm:w-6 sm:h-6 text-medical-primary-600" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-medical-neutral-900 mb-0.5 sm:mb-1">Health</h1>
        </div>
      </div>

      {/* Health Section Tabs with Ask About Button */}
      <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6 overflow-x-auto">
        {/* Health Section Tabs */}
        <div className="flex gap-1 sm:gap-4 flex-1">
        {['labs', 'vitals', 'symptoms', 'medications'].map(section => (
          <button
            key={section}
            onClick={() => setHealthSection(section)}
            className={`pb-3 px-2 sm:px-4 font-medium transition-all duration-200 flex items-center gap-1 sm:gap-2 min-h-[44px] touch-manipulation active:opacity-70 whitespace-nowrap flex-shrink-0 ${
              healthSection === section
                ? 'text-medical-primary-600 border-b-2 border-medical-primary-600'
                : 'text-medical-neutral-600 hover:text-medical-primary-600'
            }`}
          >
            {section === 'labs' && (
              <>
                <BarChart className="w-4 h-4" />
                <span className="text-xs sm:text-base">Labs</span>
              </>
            )}
            {section === 'vitals' && (
              <>
                <Heart className="w-4 h-4" />
                <span className="text-xs sm:text-base">Vitals</span>
              </>
            )}
            {section === 'symptoms' && (
              <>
                <Thermometer className="w-4 h-4" />
                <span className="text-xs sm:text-base">Symptoms</span>
              </>
            )}
            {section === 'medications' && (
              <>
                <Pill className="w-4 h-4" />
                <span className="text-xs sm:text-base">
                  <span className="hidden sm:inline">Medications</span>
                  <span className="sm:hidden">Meds</span>
                </span>
              </>
            )}
          </button>
        ))}
        </div>
        
        {/* Ask About Health Button */}
        <button
          onClick={handleAskAboutHealth}
          className="bg-medical-primary-50 text-medical-primary-600 px-3 sm:px-6 py-2.5 rounded-lg hover:bg-medical-primary-100 transition font-medium flex items-center gap-2 shadow-sm border border-medical-primary-200 min-h-[44px] touch-manipulation active:opacity-70 flex-shrink-0"
        >
          <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-medical-primary-600" />
          <span className="hidden sm:inline">Ask About This</span>
        </button>
      </div>

      {healthSection === 'labs' && (
        <div className="space-y-4">
          {/* Empty State - No Lab Data */}
                    {!hasRealLabData && Object.keys(labsData).length === 0 && (
                      <div className="border-2 border-medical-primary-500 rounded-lg p-4 sm:p-6 text-center bg-white">
                        <div className="flex flex-col items-center gap-3">
                          <BarChart className="w-10 h-10 sm:w-12 sm:h-12 text-medical-primary-400" />
                          <div>
                            <h3 className="text-base sm:text-lg font-semibold text-medical-primary-900 mb-1">No Lab Data Yet</h3>
                            <p className="text-xs sm:text-sm text-medical-primary-700 mb-4">
                              Start tracking your lab values by uploading a report or adding a metric manually
                            </p>
                            <div className="flex flex-col sm:flex-row gap-3 justify-center">
                              <button
                                onClick={() => setShowAddLab(true)}
                                className="bg-white border-2 border-medical-primary-500 text-medical-primary-600 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-medical-primary-50 transition shadow-sm flex items-center justify-center gap-2 min-h-[44px] touch-manipulation active:opacity-70"
                              >
                                <Edit2 className="w-4 h-4" />
                                Manual Enter
                              </button>
                              <button
                                onClick={() => openDocumentOnboarding('lab-report')}
                                className="bg-medical-primary-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-medical-primary-600 transition shadow-sm flex items-center justify-center gap-2 min-h-[44px] touch-manipulation active:opacity-90"
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
                          <div className="bg-white rounded-xl p-3 sm:p-4 md:p-6 border border-gray-200">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                              <h2 className="text-base sm:text-lg font-semibold text-gray-900">Lab Trends</h2>
                              <select
                                value={selectedLab}
                                onChange={(e) => setSelectedLab(e.target.value)}
                                className="text-sm border border-gray-300 rounded-lg px-2 sm:px-3 py-2 sm:py-1.5 focus:ring-2 focus:ring-green-500 min-h-[44px] w-full sm:w-auto touch-manipulation"
                              >
                                {(() => {
                                  // Organize labs by category
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

                                  // Map canonical keys to categories (from categorizeLabs function)
                                  const canonicalKeyToCategory = {
                                    'ca125': 'disease_specific_markers', 'ca199': 'disease_specific_markers', 'ca153': 'disease_specific_markers',
                                    'ca724': 'disease_specific_markers', 'ca242': 'disease_specific_markers', 'ca50': 'disease_specific_markers',
                                    'ca2729': 'disease_specific_markers', 'cea': 'disease_specific_markers', 'afp': 'disease_specific_markers',
                                    'psa': 'disease_specific_markers', 'he4': 'disease_specific_markers', 'inhibinb': 'disease_specific_markers',
                                    'romaindex': 'disease_specific_markers', 'scc_antigen': 'disease_specific_markers',
                                    'cyfra211': 'disease_specific_markers', 'nse': 'disease_specific_markers', 'betahcg': 'disease_specific_markers',
                                    'alt': 'liver_function', 'ast': 'liver_function', 'ast_alt_ratio': 'liver_function',
                                    'alp': 'liver_function', 'alp_ifcc': 'liver_function', 'bilirubin_total': 'liver_function',
                                    'bilirubin_direct': 'liver_function', 'bilirubin_indirect': 'liver_function',
                                    'albumin': 'liver_function', 'ggt': 'liver_function', 'ldh': 'liver_function',
                                    'creatinine': 'kidney_function', 'egfr': 'kidney_function', 'bun': 'kidney_function',
                                    'urea': 'kidney_function', 'urineprotein': 'kidney_function', 'urinecreatinine': 'kidney_function',
                                    'wbc': 'blood_counts', 'rbc': 'blood_counts', 'hemoglobin': 'blood_counts',
                                    'hematocrit': 'blood_counts', 'platelets': 'blood_counts', 'anc': 'blood_counts',
                                    'neutrophils_abs': 'blood_counts', 'neutrophils_pct': 'blood_counts',
                                    'lymphocytes_abs': 'blood_counts', 'lymphocytes_pct': 'blood_counts',
                                    'monocytes_abs': 'blood_counts', 'monocytes_pct': 'blood_counts',
                                    'eosinophils_abs': 'blood_counts', 'eosinophils_pct': 'blood_counts',
                                    'basophils_abs': 'blood_counts', 'basophils_pct': 'blood_counts',
                                    'mcv': 'blood_counts', 'mch': 'blood_counts', 'mchc': 'blood_counts',
                                    'rdw': 'blood_counts', 'rdw_cv': 'blood_counts',
                                    'mpv': 'blood_counts', 'nrbc': 'blood_counts', 'nrbc_pct': 'blood_counts',
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
                                    'antithrombin_iii': 'coagulation', 'protein_c': 'coagulation', 'protein_s': 'coagulation',
                                    'glucose': 'other', 'hba1c': 'other', 'iga': 'other', 'igg': 'other', 'igm': 'other', 'vitamin_d': 'other',
                                    'beta2_microglobulin': 'other', 'procalcitonin': 'other'
                                  };

                                  // Group labs by category - similar to vitals approach
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

                                  // Sort categories by predefined order
                                  const categoryOrder = [
                                    'Disease-Specific Markers', 'Blood Counts', 'Liver Function', 'Kidney Function',
                                    'Electrolytes', 'Coagulation', 'Thyroid Function', 'Cardiac Markers',
                                    'Inflammation', 'Others'
                                  ];

                                  // Render optgroups
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
                              <div className="mb-4">
                                <div className="flex items-baseline gap-2 mb-1">
                                  <span className="text-2xl sm:text-3xl font-bold text-gray-900">{currentLab.current}</span>
                                  <span className="text-sm text-gray-600">{currentLab.unit}</span>
                                  {(() => {
                                    const labStatus = getLabStatus(currentLab.current, currentLab.normalRange);
                                    const statusColors = {
                                      green: 'bg-green-100 text-green-700',
                                      yellow: 'bg-amber-100 text-amber-700',
                                      red: 'bg-red-100 text-red-700',
                                      gray: 'bg-gray-100 text-gray-700'
                                    };
                                    return (
                                      <span className={`ml-auto text-xs px-2 py-1 rounded-full ${statusColors[labStatus.color] || statusColors.gray}`}>
                                        {labStatus.label}
                                      </span>
                                    );
                                  })()}
                                </div>
                                <p className="text-xs sm:text-sm text-gray-600">Normal range: {currentLab.normalRange} {currentLab.unit}</p>
                              </div>

                              {/* Chart - Responsive with Y-axis and hover tooltips */}
                              <div className="flex gap-2 sm:gap-3">
                            {/* Y-axis labels */}
                            <div className="flex flex-col justify-between text-xs text-gray-600 font-medium py-2" style={{ paddingBottom: '1.5rem' }}>
                              {(() => {
                                // Filter out non-numeric values and ensure we have valid numbers
                                const values = currentLab.data
                                  .map(d => parseFloat(d.value))
                                  .filter(v => !isNaN(v) && isFinite(v));

                                if (values.length === 0) {
                                  return <div className="text-right pr-2 w-10">--</div>;
                                }

                                let minVal = Math.min(...values);
                                let maxVal = Math.max(...values);

                                // Parse normal range if available (formats: "0-35", "24.0-34.0", "< 0.5", "> 60")
                                if (currentLab.normalRange) {
                                  // Try standard range format "X-Y"
                                  let rangeMatch = currentLab.normalRange.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/);
                                  if (rangeMatch) {
                                    const normMin = parseFloat(rangeMatch[1]);
                                    const normMax = parseFloat(rangeMatch[2]);
                                    if (!isNaN(normMin) && !isNaN(normMax)) {
                                      minVal = Math.min(minVal, normMin);
                                      maxVal = Math.max(maxVal, normMax);
                                    }
                                  } else {
                                    // Try "< X" format (e.g., D-dimer: "< 0.5")
                                    const lessThanMatch = currentLab.normalRange.match(/<\s*(\d+\.?\d*)/);
                                    if (lessThanMatch) {
                                      const threshold = parseFloat(lessThanMatch[1]);
                                      if (!isNaN(threshold)) {
                                        minVal = Math.min(minVal, 0);
                                        maxVal = Math.max(maxVal, threshold);
                                      }
                                    } else {
                                      // Try "> X" format (e.g., eGFR: "> 60")
                                      const greaterThanMatch = currentLab.normalRange.match(/>\s*(\d+\.?\d*)/);
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
                                    <div key={i} className="border-t border-gray-200"></div>
                                  ))}
                                </div>

                                {/* SVG Graph */}
                                {(() => {
                                  // Filter out non-numeric values and ensure we have valid numbers
                                  const values = currentLab.data
                                    .map(d => parseFloat(d.value))
                                    .filter(v => !isNaN(v) && isFinite(v));

                                  if (values.length === 0) {
                                    return (
                                      <div className="flex items-center justify-center h-full text-gray-400">
                                        <p>No numeric data available for charting</p>
                                      </div>
                                    );
                                  }

                                  let minVal = Math.min(...values);
                                  let maxVal = Math.max(...values);

                                  // Parse normal range if available (formats: "0-35", "24.0-34.0", "< 0.5", "> 60")
                                  if (currentLab.normalRange) {
                                    // Try standard range format "X-Y"
                                    let rangeMatch = currentLab.normalRange.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/);
                                    if (rangeMatch) {
                                      const normMin = parseFloat(rangeMatch[1]);
                                      const normMax = parseFloat(rangeMatch[2]);
                                      if (!isNaN(normMin) && !isNaN(normMax)) {
                                        minVal = Math.min(minVal, normMin);
                                        maxVal = Math.max(maxVal, normMax);
                                      }
                                    } else {
                                      // Try "< X" format (e.g., D-dimer: "< 0.5")
                                      const lessThanMatch = currentLab.normalRange.match(/<\s*(\d+\.?\d*)/);
                                      if (lessThanMatch) {
                                        const threshold = parseFloat(lessThanMatch[1]);
                                        if (!isNaN(threshold)) {
                                          minVal = Math.min(minVal, 0);
                                          maxVal = Math.max(maxVal, threshold);
                                        }
                                      } else {
                                        // Try "> X" format (e.g., eGFR: "> 60")
                                        const greaterThanMatch = currentLab.normalRange.match(/>\s*(\d+\.?\d*)/);
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
                                  const yRange = yMax - yMin || 1; // Prevent division by zero

                                  return (
                                    <>
                                      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 400 160" preserveAspectRatio="none">
                                        <defs>
                                          <linearGradient id={`gradient-${selectedLab}`} x1="0%" y1="0%" x2="0%" y2="100%">
                                            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
                                            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05" />
                                          </linearGradient>
                                        </defs>

                                        {/* Normal range boundaries (if available) */}
                                        {currentLab.normalRange && (() => {
                                          // Try standard range format "X-Y"
                                          let rangeMatch = currentLab.normalRange.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/);
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
                                            // Try "< X" format (e.g., D-dimer: "< 0.5")
                                            const lessThanMatch = currentLab.normalRange.match(/<\s*(\d+\.?\d*)/);
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
                                              // Try "> X" format (e.g., eGFR: "> 60")
                                              const greaterThanMatch = currentLab.normalRange.match(/>\s*(\d+\.?\d*)/);
                                              if (greaterThanMatch) {
                                                const threshold = parseFloat(greaterThanMatch[1]);
                                                if (!isNaN(threshold) && isFinite(threshold)) {
                                                  const thresholdY = 160 - ((threshold - yMin) / yRange) * 160;
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
                                          return null;
                                        })()}

                                        {/* Area under line */}
                                        <polygon
                                          points={(() => {
                                            const dataLength = Math.max(currentLab.data.length - 1, 1); // Prevent division by zero
                                            const topPoints = currentLab.data.map((d, i) =>
                                              `${(i / dataLength) * 400},${160 - ((d.value - yMin) / yRange) * 160}`
                                            ).join(' ');
                                            return `${topPoints} 400,160 0,160`;
                                          })()}
                                          fill={`url(#gradient-${selectedLab})`}
                                        />

                                        {/* Line */}
                                        <polyline
                                          points={(() => {
                                            const dataLength = Math.max(currentLab.data.length - 1, 1); // Prevent division by zero
                                            return currentLab.data.map((d, i) =>
                                              `${(i / dataLength) * 400},${160 - ((d.value - yMin) / yRange) * 160}`
                                            ).join(' ');
                                          })()}
                                          fill="none"
                                          stroke="#3b82f6"
                                          strokeWidth="3"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        />
                                      </svg>

                                      {/* Interactive data points with tooltips */}
                                      {currentLab.data.map((d, i) => {
                                        const dataLength = Math.max(currentLab.data.length - 1, 1); // Prevent division by zero
                                        const x = (i / dataLength) * 100;
                                        const y = ((d.value - yMin) / yRange) * 100;
                                        const isLatest = i === currentLab.data.length - 1;
                                        
                                        // Calculate lab status for this data point
                                        const labStatus = getLabStatus(parseFloat(d.value), currentLab.normalRange);
                                        const statusColors = {
                                          green: '#10b981',
                                          yellow: '#f59e0b',
                                          red: '#ef4444',
                                          gray: '#6b7280'
                                        };
                                        const dotColor = statusColors[labStatus.color] || statusColors.gray;
                                        const statusBadgeColors = {
                                          green: 'bg-green-100 text-green-700',
                                          yellow: 'bg-amber-100 text-amber-700',
                                          red: 'bg-red-100 text-red-700',
                                          gray: 'bg-gray-100 text-gray-700'
                                        };

                                        const isSelected = selectedDataPoint === `${selectedLab}-${d.id}`;
                                        const pointKey = `${selectedLab}-${d.id}`;
                                        const isHovered = hoveredDataPoint === pointKey;
                                        
                                        return (
                                          <div
                                            key={i}
                                            className="absolute group"
                                            style={{
                                              left: `${x}%`,
                                              bottom: `${y}%`,
                                              transform: 'translate(-50%, 50%)',
                                              zIndex: isSelected ? 30 : (isHovered ? 25 : 10)
                                            }}
                                            onMouseEnter={() => setHoveredDataPoint(pointKey)}
                                            onMouseLeave={() => setHoveredDataPoint(null)}
                                          >
                                            {/* Touch/Click area - larger on mobile */}
                                            <div 
                                              className="absolute inset-0 w-12 h-12 sm:w-10 sm:h-10 -m-6 sm:-m-5 cursor-pointer touch-manipulation"
                                              style={{ zIndex: 20 }}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                e.preventDefault();
                                                // Toggle tooltip on click/tap
                                                const pointKey = `${selectedLab}-${d.id}`;
                                                if (isSelected) {
                                                  setSelectedDataPoint(null);
                                                } else {
                                                  setSelectedDataPoint(pointKey);
                                                }
                                              }}
                                              onTouchStart={(e) => {
                                                e.stopPropagation();
                                              }}
                                            />

                                            {/* Outer ring on hover or when selected */}
                                            <div
                                              className={`absolute inset-0 rounded-full transition-all ${
                                                isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
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
                                                isSelected || isLatest ? 'scale-125' : 'group-hover:scale-125'
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
                                                isSelected ? 'opacity-100 pointer-events-auto' : 'opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto'
                                              } transition-opacity ${
                                                y > 70 ? 'bottom-full mb-4' : 'top-full mt-4'
                                              } ${
                                                x < 10 ? 'left-0' : x > 90 ? 'right-0' : 'left-1/2 transform -translate-x-1/2'
                                              }`}
                                              style={{ zIndex: 30 }}
                                            >
                                              <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-xl whitespace-nowrap tooltip-container">
                                                <div className="flex items-center justify-between gap-3">
                                                  <div>
                                                <div className="font-bold text-sm">{d.value} {currentLab.unit}</div>
                                                <div className="text-xs text-gray-400 mt-0.5">{d.date}</div>
                                                  </div>
                                                  {d.id && (
                                                    <div className="flex items-center gap-2">
                                                      <button
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          e.preventDefault();
                                                          // Close tooltip
                                                          setSelectedDataPoint(null);
                                                          
                                                          const currentLabDoc = allLabData[selectedLab];
                                                          if (currentLabDoc && currentLabDoc.id) {
                                                            setSelectedLabForValue({ id: currentLabDoc.id, name: getLabDisplayName(currentLabDoc.name || selectedLab), unit: currentLabDoc.unit, key: selectedLab });
                                                            // Pre-fill with existing value data
                                                            const valueData = currentLab.data.find(item => item.id === d.id);
                                                            // Use dateOriginal if available, otherwise fall back to timestamp, then formatted date
                                                            // Use formatDateString to ensure local time (not UTC) - prevents one-day shift
                                                            let dateValue = getTodayLocalDate();
                                                            if (valueData?.dateOriginal) {
                                                              dateValue = formatDateString(valueData.dateOriginal) || getTodayLocalDate();
                                                            } else if (valueData?.timestamp) {
                                                              dateValue = formatDateString(new Date(valueData.timestamp)) || getTodayLocalDate();
                                                            } else if (valueData?.date) {
                                                              dateValue = formatDateString(valueData.date) || getTodayLocalDate();
                                                            }
                                                            setNewLabValue({ 
                                                              value: valueData?.value || '', 
                                                              date: dateValue, 
                                                              notes: valueData?.notes || '' 
                                                            });
                                                            setEditingLabValueId(d.id); // Store the value ID being edited
                                                            setIsEditingLabValue(true);
                                                            setShowAddLabValue(true);
                                                          }
                                                        }}
                                                        onTouchStart={(e) => {
                                                          e.stopPropagation();
                                                          e.preventDefault();
                                                        }}
                                                        className="text-blue-400 hover:text-blue-300 active:text-blue-200 transition-colors p-2.5 sm:p-2 rounded hover:bg-blue-900/20 active:bg-blue-900/30 min-h-[48px] min-w-[48px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center touch-manipulation"
                                                        title="Edit this reading"
                                                      >
                                                        <Edit2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                                                      </button>
                                                      <button
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          // Capture values in closure
                                                          const labValueId = d.id;
                                                          const labKey = selectedLab;
                                                          const labDoc = allLabData[selectedLab];
                                                          const labDocId = labDoc?.id;
                                                          const labName = currentLab.name;
                                                          const labUnit = currentLab.unit;
                                                          const labValue = d.value;
                                                          const labDate = d.date;
                                                          
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
                                                              try {
                                                                
                                                                // Optimistically update UI immediately
                                                                const updatedLabsData = { ...labsData };
                                                                if (updatedLabsData[labKey] && updatedLabsData[labKey].data) {
                                                                  const filteredData = updatedLabsData[labKey].data.filter(item => item.id !== labValueId);
                                                                  // Get most recent value (first item after sorting by timestamp)
                                                                  const sortedData = [...filteredData].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                                                                  updatedLabsData[labKey] = {
                                                                    ...updatedLabsData[labKey],
                                                                    data: filteredData,
                                                                    current: sortedData.length > 0 ? sortedData[0].value : '--'
                                                                  };
                                                                  setLabsData(updatedLabsData);
                                                                }
                                                                
                                                                // Delete from Firestore in background
                                                                // Verify user is authenticated before deletion
                                                                if (!user || !user.uid) {
                                                                  throw new Error('User not authenticated');
                                                                }
                                                                
                                                                
                                                                await labService.deleteLabValue(labDocId, labValueId);
                                                                
                                                                
                                                                // Check if lab is now orphaned (no values left) and clean it up
                                                                try {
                                                                  const remainingValues = await labService.getLabValues(labDocId);
                                                                  if (!remainingValues || remainingValues.length === 0) {
                                                                    await labService.deleteLab(labDocId);
                                                                  }
                                                                } catch (cleanupError) {
                                                                }
                                                                
                                                                // Reload health data to ensure UI matches database state
                                                                // deleteLabValue now clears currentValue when last value is deleted, preventing reappearance
                                                                await reloadHealthData();
                                                                
                                                                // Show success banner
                                                                showSuccess(`${labName} reading deleted successfully`);
                                                              } catch (error) {
                                                                // Revert optimistic update on error only
                                                                reloadHealthData();
                                                                showError('Failed to delete lab reading. Please try again.');
                                                              }
                                                            }
                                                          });
                                                        }}
                                                        onTouchStart={(e) => {
                                                          e.stopPropagation();
                                                          e.preventDefault();
                                                        }}
                                                        className="text-red-400 hover:text-red-300 active:text-red-200 transition-colors p-2.5 sm:p-2 rounded hover:bg-red-900/20 active:bg-red-900/30 min-h-[48px] min-w-[48px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center touch-manipulation"
                                                        title="Delete this reading"
                                                      >
                                                        <Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
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
                              <div className="relative border-t border-gray-300 pt-2 text-xs text-gray-600" style={{ height: '20px' }}>
                                {(() => {
                                  if (!currentLab.data || currentLab.data.length === 0) {
                                    return <span>No data</span>;
                                  }

                                  const seenMonthYears = new Set();
                                  const monthLabels = [];
                                  const monthYearData = []; // Store { label, index, position }
                                  const dataLength = currentLab.data.length;

                                  currentLab.data.forEach((d, i) => {
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

                                  // For mobile: show first, middle (if 3+), and last (max 3 labels)
                                  let mobileLabels = [];
                                  if (monthYearData.length > 0) {
                                    if (monthYearData.length === 1) {
                                      mobileLabels = [monthYearData[0]];
                                    } else if (monthYearData.length === 2) {
                                      mobileLabels = [monthYearData[0], monthYearData[1]];
                                    } else {
                                      // Show first, middle, and last
                                      const midIndex = Math.floor(monthYearData.length / 2);
                                      mobileLabels = [
                                        monthYearData[0],
                                        monthYearData[midIndex],
                                        monthYearData[monthYearData.length - 1]
                                      ];
                                    }
                                  }

                                  return (
                                    <>
                                      {monthLabels}
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
                          ) : (
                            // Non-numeric lab - show text info instead of chart
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
                              <p className="text-sm text-blue-700 mb-2">This lab value contains non-numeric data</p>
                              <p className="text-2xl font-bold text-blue-900 mb-2">{currentLab.current}</p>
                              <p className="text-xs text-blue-600">
                                Most recent: {currentLab.data[currentLab.data.length - 1]?.date}
                              </p>
                            </div>
                          )}
                          </div>
                        )}

                        {/* Lab Value Cards - Organized by Category with Expandable Cards */}
                          {(() => {
                          // Helper function to render lab card (smaller, cleaner)
                          const renderLabCard = (key, lab) => {
                            if (lab.isNumeric) {
                                  const labStatus = getLabStatus(lab.current, lab.normalRange);
                                  const statusColors = {
                                green: { dot: 'bg-medical-accent-500', text: 'text-medical-accent-700' },
                                yellow: { dot: 'bg-amber-500', text: 'text-amber-700' },
                                    red: { dot: 'bg-red-500', text: 'text-red-700' },
                                gray: { dot: 'bg-medical-neutral-400', text: 'text-medical-neutral-600' }
                                  };
                                  const colors = statusColors[labStatus.color];
                              // Normalize lab name to canonical key for description lookup
                              const canonicalKey = normalizeLabName(lab.name);
                              const labDescription = canonicalKey ? (labValueDescriptions[canonicalKey] || '') : '';
                              const displayName = getLabDisplayName(lab.name);

                                  return (
                                <div
                                      key={key}
                                  className={`relative bg-white rounded-lg shadow-sm p-4 border-2 transition-all cursor-pointer ${
                                    metricSelectionMode && selectedMetrics.has(key)
                                      ? 'border-blue-500 bg-blue-50'
                                      : selectedLab === key && !metricSelectionMode
                                      ? 'border-medical-primary-500 bg-medical-primary-50'
                                      : 'border-medical-neutral-200 hover:border-medical-neutral-300 hover:shadow-md'
                                  }`}
                                  onClick={() => {
                                    if (metricSelectionMode) {
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
                                      <input
                                        type="checkbox"
                                        checked={selectedMetrics.has(key)}
                                        onChange={() => {}}
                                        className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 pointer-events-none"
                                      />
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
                                          className="text-yellow-500 hover:text-yellow-600 transition-colors"
                                          title={favoriteMetrics.labs?.includes(key) ? "Remove from favorites" : "Add to favorites"}
                                        >
                                          <Star className={`w-3.5 h-3.5 ${favoriteMetrics.labs?.includes(key) ? 'fill-yellow-500' : ''}`} />
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
                                            className="text-medical-primary-500 hover:text-medical-primary-700 transition-colors"
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
                                            <TrendingUp className="w-4 h-4 text-red-500" />
                                          ) : lab.trend === 'down' ? (
                                            <TrendingDown className="w-4 h-4 text-green-500" />
                                          ) : (
                                            <Minus className="w-4 h-4 text-gray-400" />
                                          )
                                        )}
                                        <p className="text-xs text-medical-neutral-500">{lab.unit}</p>
                                      </div>
                                      <p className={`text-xs ${colors.text} font-medium mt-1`}>{labStatus.label}</p>
                                      {lab.normalRange && (
                                        <p className="text-xs text-medical-neutral-500 mt-1">Normal: {lab.normalRange}</p>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1 ml-2">
                                      <div className="relative">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
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
                                              className="fixed inset-0 z-40"
                                              onClick={() => setOpenDeleteMenu(null)}
                                            />
                                            <div className="absolute right-0 top-8 z-[100] bg-white rounded-lg shadow-lg border border-medical-neutral-200 py-1 min-w-[160px]">
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setOpenDeleteMenu(null);
                                                  // Find the lab document ID
                                                  const labDoc = allLabData[key];
                                                  if (labDoc && labDoc.id) {
                                                    setSelectedLabForValue({ id: labDoc.id, name: displayName, unit: lab.unit, key: key });
                                                    setNewLabValue({ value: '', date: getTodayLocalDate(), notes: '' });
                                                    setIsEditingLabValue(false);
                                                    setShowAddLabValue(true);
                                                  }
                                                }}
                                                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 min-h-[44px] touch-manipulation active:opacity-70"
                                              >
                                                <Plus className="w-4 h-4" />
                                                Add Value
                                              </button>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setOpenDeleteMenu(null);
                                                  setEditingLab(lab);
                                                  setEditingLabKey(key);
                                                }}
                                                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 min-h-[44px] touch-manipulation active:opacity-70"
                                              >
                                                <Edit2 className="w-4 h-4" />
                                                Edit Metric
                                              </button>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setOpenDeleteMenu(null);
                                                  const labType = key;
                                                  const count = lab.data?.length || 0;
                                                  setDeleteConfirm({
                                                    show: true,
                                                    title: `Delete All ${displayName} Data?`,
                                                    message: `This will permanently remove ${count} ${count === 1 ? 'entry' : 'entries'} of ${displayName} data.`,
                                                    itemName: `all ${displayName} data`,
                                                    confirmText: 'Yes, Delete All',
                                                    onConfirm: async () => {
                                                      try {
                                                        
                                                        // Optimistically update UI immediately
                                                        const updatedLabsData = { ...labsData };
                                                        delete updatedLabsData[labType];
                                                        setLabsData(updatedLabsData);
                                                        
                                                        // If deleted lab was selected, select first available
                                                        if (selectedLab === labType) {
                                                          const firstAvailable = Object.keys(updatedLabsData).find(key => updatedLabsData[key].isNumeric);
                                                          if (firstAvailable) {
                                                            setSelectedLab(firstAvailable);
                                                          }
                                                        }
                                                        
                                                        // Delete from Firestore in background
                                                        const deletedCount = await labService.deleteAllLabsByType(user.uid, labType);
                                                        
                                                        // Wait a bit longer and verify deletion before reloading
                                                        await new Promise(resolve => setTimeout(resolve, 1000));
                                                        
                                                        // Reload to ensure sync (but UI already updated)
                                                        await reloadHealthData();
                                                      } catch (error) {
                                                        // Revert optimistic update on error
                                                        reloadHealthData();
                                                        showError('Failed to delete lab data. Please try again.');
                                                      }
                                                    }
                                                  });
                                                }}
                                                className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors min-h-[44px] touch-manipulation active:opacity-70"
                                              >
                                                <Trash2 className="w-4 h-4" />
                                                {(() => {
                                                  const hasValues = lab.data && Array.isArray(lab.data) && (
                                                    lab.data.length > 1 || 
                                                    (lab.data.length === 1 && lab.data[0].value != null && lab.data[0].value !== undefined)
                                                  );
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
                              // Non-numeric labs (or labs without values yet)
                              const displayName = getLabDisplayName(lab.name || key);
                              return (
                                <div
                                  key={key}
                                  className={`relative bg-white rounded-lg shadow-sm p-4 border-2 transition-all cursor-pointer ${
                                    metricSelectionMode && selectedMetrics.has(key)
                                      ? 'border-blue-500 bg-blue-50'
                                      : 'border-medical-neutral-200 hover:border-medical-neutral-300 hover:shadow-md'
                                  }`}
                                  onClick={() => {
                                    if (metricSelectionMode) {
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
                                      <input
                                        type="checkbox"
                                        checked={selectedMetrics.has(key)}
                                        onChange={() => {}}
                                        className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 pointer-events-none"
                                      />
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
                                          className="text-yellow-500 hover:text-yellow-600 transition-colors"
                                          title={favoriteMetrics.labs?.includes(key) ? "Remove from favorites" : "Add to favorites"}
                                        >
                                          <Star className={`w-3.5 h-3.5 ${favoriteMetrics.labs?.includes(key) ? 'fill-yellow-500' : ''}`} />
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
                                              className="fixed inset-0 z-40"
                                              onClick={() => setOpenDeleteMenu(null)}
                                            />
                                            <div className="absolute right-0 top-8 z-[100] bg-white rounded-lg shadow-lg border border-medical-neutral-200 py-1 min-w-[160px]">
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setOpenDeleteMenu(null);
                                                  // Find the lab document ID
                                                  const labDoc = allLabData[key];
                                                  if (labDoc && labDoc.id) {
                                                    setSelectedLabForValue({ id: labDoc.id, name: displayName, unit: lab.unit || '', key: key });
                                                    setNewLabValue({ value: '', date: getTodayLocalDate(), notes: '' });
                                                    setShowAddLabValue(true);
                                                  }
                                                }}
                                                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 min-h-[44px] touch-manipulation active:opacity-70"
                                              >
                                                <Plus className="w-4 h-4" />
                                                Add Value
                                              </button>
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setOpenDeleteMenu(null);
                                                  const labType = key;
                                                  const count = lab.data?.length || 0;
                                                  setDeleteConfirm({
                                                    show: true,
                                                    title: `Delete All ${displayName} Data?`,
                                                    message: `This will permanently remove ${count} ${count === 1 ? 'entry' : 'entries'} of ${displayName} data.`,
                                                    itemName: `all ${displayName} data`,
                                                    confirmText: 'Yes, Delete All',
                                                    onConfirm: async () => {
                                                      try {
                                                        
                                                        // Optimistically update UI immediately
                                                        const updatedLabsData = { ...labsData };
                                                        delete updatedLabsData[labType];
                                                        setLabsData(updatedLabsData);
                                                        
                                                        // If deleted lab was selected, select first available
                                                        if (selectedLab === labType) {
                                                          const firstAvailable = Object.keys(updatedLabsData).find(key => updatedLabsData[key].isNumeric);
                                                          if (firstAvailable) {
                                                            setSelectedLab(firstAvailable);
                                                          }
                                                        }
                                                        
                                                        // Delete from Firestore in background
                                                        const deletedCount = await labService.deleteAllLabsByType(user.uid, labType);
                                                        
                                                        // Wait a bit longer and verify deletion before reloading
                                                        await new Promise(resolve => setTimeout(resolve, 1000));
                                                        
                                                        // Reload to ensure sync (but UI already updated)
                                                        await reloadHealthData();
                                                      } catch (error) {
                                                        // Revert optimistic update on error
                                                        reloadHealthData();
                                                        showError('Failed to delete lab data. Please try again.');
                                                      }
                                                    }
                                                  });
                                                }}
                                                className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors min-h-[44px] touch-manipulation active:opacity-70"
                                              >
                                                <Trash2 className="w-4 h-4" />
                                                {(() => {
                                                  const hasValues = lab.data && Array.isArray(lab.data) && (
                                                    lab.data.length > 1 || 
                                                    (lab.data.length === 1 && lab.data[0].value != null && lab.data[0].value !== undefined)
                                                  );
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

                          const categorizedLabs = categorizeLabs(allLabData);
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

                          // Helper function to get category for a lab key
                          const getLabCategory = (labKey) => {
                            // Check categorizedLabs to find where this lab actually is
                            for (const [category, labs] of Object.entries(categorizedLabs)) {
                              if (labs.some(([key]) => key === labKey)) {
                                return category;
                              }
                            }
                            return null;
                          };

                          // Helper function to check if a lab is empty (same logic as filter)
                          const isLabEmpty = (lab) => {
                            if (!lab.data || !Array.isArray(lab.data) || lab.data.length === 0) {
                              return true; // No data at all
                            }
                            
                            const labDocIds = lab.labDocumentIds || [lab.id];
                            const allDataIdsAreFallback = lab.data.every(d => labDocIds.includes(d.id));
                            
                            const hasValidValues = lab.data.some(d => {
                              const value = d.value;
                              if (value == null || value === undefined || value === '') return false;
                              const valueStr = String(value).trim().toLowerCase();
                              if (valueStr === '-' || valueStr === '—' || valueStr === 'n/a' || valueStr === 'na' || 
                                  valueStr === '未測定' || valueStr === '測定なし' || valueStr === '--') {
                                return false;
                              }
                              if (lab.isNumeric && isNaN(parseFloat(value))) {
                                return false;
                              }
                              return true;
                            });
                            
                            return allDataIdsAreFallback || !hasValidValues;
                          };

                          // Filter labs based on search query and empty metrics option
                          const filterLabsBySearch = (labs, query, hideEmpty) => {
                            let filtered = labs;
                            
                            // Filter by search query
                            if (query && query.trim() !== '') {
                              const searchLower = query.toLowerCase().trim();
                              filtered = filtered.filter(([key, lab]) => {
                                const displayName = getLabDisplayName(lab.name);
                                const labName = lab.name || '';
                                return displayName.toLowerCase().includes(searchLower) || 
                                       labName.toLowerCase().includes(searchLower);
                              });
                            }
                            
                            // Filter out metrics with no values if hideEmpty is true
                            if (hideEmpty) {
                              filtered = filtered.filter(([key, lab]) => {
                                // Check if lab has actual recorded data points (not just fallback values)
                                // Fallback values have id === lab.id (the lab document ID)
                                // Real values have different IDs (from the subcollection)
                                if (!lab.data || !Array.isArray(lab.data) || lab.data.length === 0) {
                                  return false; // No data at all
                                }
                                
                                // Check if data IDs match any lab document ID (fallback values)
                                // When multiple lab documents have the same type, fallback values can have different IDs
                                // The transformed lab object stores all lab document IDs in labDocumentIds array
                                const labDocIds = lab.labDocumentIds || [lab.id]; // Fallback to just the primary ID
                                
                                // Check if all data points are fallback values (ID matches any lab document ID)
                                const allDataIdsAreFallback = lab.data.length > 0 && lab.data.every(d => labDocIds.includes(d.id));
                                
                                // Check if values are valid (not empty, null, or placeholder values)
                                // This catches cases where metrics were extracted from documents but have empty/placeholder values
                                const hasValidValues = lab.data.some(d => {
                                  const value = d.value;
                                  // Check if value is valid (not empty, null, undefined, or placeholder)
                                  if (value == null || value === undefined || value === '') return false;
                                  const valueStr = String(value).trim().toLowerCase();
                                  // Check for placeholder values
                                  if (valueStr === '-' || valueStr === '—' || valueStr === 'n/a' || valueStr === 'na' || 
                                      valueStr === '未測定' || valueStr === '測定なし' || valueStr === '--') {
                                    return false;
                                  }
                                  // For numeric labs, check if it's a valid number
                                  if (lab.isNumeric && isNaN(parseFloat(value))) {
                                    return false;
                                  }
                                  return true;
                                });
                                
                                
                                // Check if there are any actual recorded values (not fallback) AND the values are valid
                                // A data point ID that matches any lab document ID means it's a fallback value
                                // Real values have IDs from the subcollection that don't match any lab document ID
                                // But even real values need to have valid (non-empty) values
                                const hasRealValidValues = !allDataIdsAreFallback && hasValidValues;
                                
                                
                                // Only show labs that have actual recorded data points with valid values
                                // This excludes labs that only have fallback values OR have empty/placeholder values
                                return hasRealValidValues;
                              });
                            }
                            
                            return filtered;
                          };

                          // Apply search filter and empty metrics filter to categorized labs
                          const filteredCategorizedLabs = {};
                          Object.keys(categorizedLabs).forEach(category => {
                            const filtered = filterLabsBySearch(categorizedLabs[category], labSearchQuery, hideEmptyMetrics);
                            if (filtered.length > 0) {
                              filteredCategorizedLabs[category] = filtered;
                            }
                          });

                          // Count total lab metrics that are actually displayed (after categorization, deduplication, and search filtering)
                          // This matches the number of cards shown
                          const totalLabCount = Object.values(filteredCategorizedLabs).reduce((sum, labs) => sum + labs.length, 0);
                          
                          // Debug: Always log counts to help identify orphaned data
                          const allLabCount = Object.keys(allLabData).length;
                          
                          if (allLabCount !== totalLabCount) {
                            const labsWithoutData = Object.entries(allLabData).filter(([key, lab]) => 
                              !lab.data || !Array.isArray(lab.data) || lab.data.length === 0
                            );
                            if (labsWithoutData.length > 0) {
                            }
                            // Find labs that were deduplicated or filtered out
                            const allLabKeys = new Set(Object.keys(allLabData));
                            const displayedLabKeys = new Set();
                            Object.values(categorizedLabs).forEach(labs => {
                              labs.forEach(([key]) => displayedLabKeys.add(key));
                            });
                            const orphanedKeys = Array.from(allLabKeys).filter(key => !displayedLabKeys.has(key));
                            if (orphanedKeys.length > 0) {
                            } else {
                            }
                          } else {
                          }
                          
                          // If there's a discrepancy, log cleanup instructions and offer to clean up
                          if (allLabCount !== totalLabCount) {
                          }

                          return (
                            <div className="space-y-4 mt-6">
                              {/* Search Bar and 3-dot Menu */}
                              <div className="mb-4 space-y-3">
                                <div className="flex gap-2 items-center">
                                  <div className="relative flex-1">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                      <Search className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <input
                                      type="text"
                                      value={labSearchQuery}
                                      onChange={(e) => setLabSearchQuery(e.target.value)}
                                      placeholder="Search labs by name..."
                                      className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-medical-primary-500 focus:border-medical-primary-500 text-sm"
                                    />
                                    {labSearchQuery && (
                                      <button
                                        onClick={() => setLabSearchQuery('')}
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                                      >
                                        <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                                      </button>
                                    )}
                                  </div>

                                  {/* 3-dot menu */}
                                  <div className="relative">
                                    <button
                                      onClick={() => setOpenEmptyMetricsMenu(!openEmptyMetricsMenu)}
                                      className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                                      aria-label="Lab options"
                                    >
                                      <MoreVertical className="w-5 h-5" />
                                    </button>

                                    {openEmptyMetricsMenu && (() => {
                                      const emptyLabs = Object.entries(allLabData).filter(([key, lab]) => isLabEmpty(lab));

                                      return (
                                          <>
                                            <div
                                              className="fixed inset-0 z-40"
                                              onClick={() => setOpenEmptyMetricsMenu(false)}
                                            />
                                            <div className="absolute right-0 top-10 z-[100] bg-white rounded-lg shadow-lg border border-gray-200 py-2 min-w-[240px]">
                                              {/* Upload Lab Report Button */}
                                              <button
                                                onClick={() => {
                                                  setOpenEmptyMetricsMenu(false);
                                                  openDocumentOnboarding('lab-report');
                                                }}
                                                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors min-h-[44px] touch-manipulation active:opacity-70"
                                              >
                                                <Upload className="w-4 h-4" />
                                                Upload Lab Report
                                              </button>

                                              {/* Add Lab Metric Button */}
                                              <button
                                                onClick={() => {
                                                  setOpenEmptyMetricsMenu(false);
                                                  setShowAddLab(true);
                                                }}
                                                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors min-h-[44px] touch-manipulation active:opacity-70"
                                              >
                                                <Plus className="w-4 h-4" />
                                                Add Lab Metric
                                              </button>

                                              <div className="border-t border-gray-200 my-1"></div>

                                              {/* Select to Delete Metrics Button */}
                                              <button
                                                onClick={() => {
                                                  setOpenEmptyMetricsMenu(false);
                                                  setMetricSelectionMode(true);
                                                  setSelectedMetrics(new Set());
                                                  // Expand all categories
                                                  const allExpanded = {};
                                                  Object.keys(expandedCategories).forEach(cat => {
                                                    allExpanded[cat] = true;
                                                  });
                                                  setExpandedCategories(allExpanded);
                                                }}
                                                className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors min-h-[44px] touch-manipulation active:opacity-70"
                                              >
                                                <Check className="w-4 h-4" />
                                                Select metrics to delete
                                              </button>

                                              {emptyLabs.length > 0 && (
                                                <>
                                                  <div className="border-t border-gray-200 my-1"></div>

                                                  {/* Hide Empty Metrics Toggle */}
                                                  <label className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors">
                                                    <input
                                                      type="checkbox"
                                                      checked={hideEmptyMetrics}
                                                      onChange={(e) => {
                                                        setHideEmptyMetrics(e.target.checked);
                                                        setOpenEmptyMetricsMenu(false);
                                                      }}
                                                      className="w-4 h-4 text-medical-primary-600 border-gray-300 rounded focus:ring-medical-primary-500 focus:ring-2 cursor-pointer"
                                                    />
                                                    <div className="flex items-center gap-2 flex-1">
                                                      {hideEmptyMetrics ? (
                                                        <EyeOff className="w-4 h-4 text-gray-600" />
                                                      ) : (
                                                        <Eye className="w-4 h-4 text-gray-400" />
                                                      )}
                                                      <span className="text-sm text-gray-700">
                                                        Hide metrics with no values
                                                      </span>
                                                    </div>
                                                  </label>

                                                  {/* Delete Empty Metrics Button */}
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
                                                        
                                                        // Delete all empty labs
                                                        const deletePromises = emptyLabTypes.map(labType => 
                                                          labService.deleteAllLabsByType(user.uid, labType)
                                                        );
                                                        const results = await Promise.all(deletePromises);
                                                        const totalDeleted = results.reduce((sum, count) => sum + count, 0);
                                                        
                                                        
                                                        // Wait a bit before reloading
                                                        await new Promise(resolve => setTimeout(resolve, 1000));
                                                        
                                                        // Reload health data
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
                                                className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] touch-manipulation active:opacity-70"
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
                                      );
                                    })()}
                                  </div>
                                </div>
                              </div>
                              
                              {/* Selection Mode Banner */}
                              {metricSelectionMode && (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <h4 className="text-sm font-semibold text-gray-900">
                                        Select metrics to delete ({selectedMetrics.size} selected)
                                      </h4>
                                      <p className="text-xs text-gray-600 mt-1">Click on metric cards to select them</p>
                                    </div>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => {
                                          setMetricSelectionMode(false);
                                          setSelectedMetrics(new Set());
                                          // Reset to default: all categories collapsed
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
                                        className="px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
                                      >
                                        Cancel
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
                                                // Delete all selected metrics
                                                for (const labType of selectedKeys) {
                                                  await labService.deleteAllLabsByType(user.uid, labType);
                                                }

                                                // Reload data
                                                await reloadHealthData();

                                                // Exit selection mode and reset to default: all categories collapsed
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
                                        className="px-3 py-1.5 text-sm text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                      >
                                        Delete ({selectedMetrics.size})
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Total metrics count - aligned left above first card */}
                              {totalLabCount > 0 && !metricSelectionMode && (
                                <p className="text-sm text-medical-neutral-600 mb-2 text-left">
                                  {labSearchQuery
                                    ? `${totalLabCount} metric${totalLabCount !== 1 ? 's' : ''} found`
                                    : `${totalLabCount} metric${totalLabCount !== 1 ? 's' : ''} tracked`}
                                </p>
                              )}
                              {labSearchQuery && totalLabCount === 0 && (
                                <p className="text-sm text-gray-500 mb-2 text-left">
                                  No labs found matching "{labSearchQuery}"
                                </p>
                              )}
                              
                              {/* Favorite Labs Section - Only show if there are favorites and not in search mode */}
                              {!labSearchQuery && favoriteMetrics.labs && favoriteMetrics.labs.length > 0 && (() => {
                                const favoriteLabItems = favoriteMetrics.labs
                                  .filter(key => allLabData[key] && !isLabEmpty(allLabData[key]))
                                  .map(key => ({
                                    key,
                                    lab: allLabData[key],
                                    category: getLabCategory(key),
                                    displayName: getLabDisplayName(allLabData[key]?.name || key)
                                  }))
                                  .filter(item => item.category); // Only show if category was found

                                if (favoriteLabItems.length === 0) return null;

                                return (
                                  <div className="mb-4">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                      <h3 className="text-sm font-semibold text-medical-neutral-700">Favorite Labs</h3>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {favoriteLabItems.map(({ key, category, displayName }) => (
                                        <button
                                          key={key}
                                          onClick={() => {
                                            // Expand the category and scroll to it
                                            setExpandedCategories(prev => {
                                              const allClosed = Object.keys(prev).reduce((acc, cat) => {
                                                acc[cat] = false;
                                                return acc;
                                              }, {});
                                              return {
                                                ...allClosed,
                                                [category]: true
                                              };
                                            });
                                            // Scroll to the category after a brief delay to allow expansion
                                            setTimeout(() => {
                                              const categoryElement = document.querySelector(`[data-category="${category}"]`);
                                              if (categoryElement) {
                                                categoryElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                              }
                                            }, 100);
                                          }}
                                          className="px-3 py-1.5 bg-yellow-50 border border-yellow-200 text-medical-neutral-900 rounded-lg hover:bg-yellow-100 hover:border-yellow-300 transition-colors text-sm font-medium flex items-center gap-1.5 min-h-[44px] touch-manipulation active:opacity-70"
                                        >
                                          <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                                          <span>{displayName}</span>
                                          <ChevronRight className="w-3 h-3 text-medical-neutral-400" />
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })()}
                              
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
                                    {/* Category Header - Clickable to expand/collapse */}
                                    <button
                                      onClick={() => setExpandedCategories(prev => {
                                        const isCurrentlyExpanded = prev[category];
                                        // Close all categories
                                        const allClosed = Object.keys(prev).reduce((acc, key) => {
                                          acc[key] = false;
                                          return acc;
                                        }, {});
                                        // Toggle the clicked category
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
                                          <h3 className="text-base sm:text-lg font-semibold text-medical-neutral-900">{category}</h3>
                                          <p className="text-xs sm:text-sm text-medical-neutral-600 mt-1">{description}</p>
                                          <p className="text-xs text-medical-neutral-500 mt-1">{labsInCategory.length} value{labsInCategory.length !== 1 ? 's' : ''} tracked</p>
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

                                    {/* Expanded Content */}
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
        </div>
      )}

      {healthSection === 'vitals' && (
        <div className="space-y-4">
                    {/* Empty State - No Vital Data */}
                    {Object.keys(allVitalsData).length === 0 && (
                      <div className="border-2 border-medical-primary-500 rounded-lg p-4 sm:p-6 text-center bg-white">
                        <div className="flex flex-col items-center gap-3">
                          <Heart className="w-10 h-10 sm:w-12 sm:h-12 text-medical-primary-400" />
                          <div>
                            <h3 className="text-base sm:text-lg font-semibold text-medical-primary-900 mb-1">No Vital Signs Data Yet</h3>
                            <p className="text-xs sm:text-sm text-medical-primary-700 mb-4">
                              Track blood pressure, heart rate, weight, and more
                            </p>
                            <div className="flex flex-col sm:flex-row gap-3 justify-center">
                              <button
                                onClick={() => {
                                  setIsEditingVital(false);
                                  setShowAddVital(true);
                                }}
                                className="bg-white border-2 border-medical-primary-500 text-medical-primary-600 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-medical-primary-50 transition shadow-sm flex items-center justify-center gap-2 min-h-[44px] touch-manipulation active:opacity-70"
                              >
                                <Edit2 className="w-4 h-4" />
                                Manual Enter
                              </button>
                            <button
                              onClick={() => onTabChange('chat')}
                                className="bg-medical-primary-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-medical-primary-600 transition shadow-sm flex items-center justify-center gap-2 min-h-[44px] touch-manipulation active:opacity-90"
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
                        <div className="bg-white rounded-xl p-3 sm:p-4 md:p-6 border border-gray-200">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                            <h2 className="text-base sm:text-lg font-semibold text-gray-900">Vital Signs</h2>
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                              {Object.keys(allVitalsData).length > 0 ? (
                            <>
                            <select
                              value={selectedVital}
                              onChange={(e) => setSelectedVital(e.target.value)}
                              className="text-sm border border-gray-300 rounded-lg px-2 sm:px-3 py-2 sm:py-1.5 focus:ring-2 focus:ring-green-500 min-h-[44px] w-full sm:w-auto touch-manipulation"
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
                              className="text-yellow-500 hover:text-yellow-600 transition-colors p-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
                              title={favoriteMetrics.vitals?.includes(selectedVital) ? "Remove from favorites" : "Add to favorites"}
                            >
                              <Star className={`w-4 h-4 ${favoriteMetrics.vitals?.includes(selectedVital) ? 'fill-yellow-500' : ''}`} />
                            </button>
                            </>
                              ) : (
                                <div className="text-sm text-gray-500">No vitals available</div>
                              )}
                            </div>
                          </div>

                          {(() => {
                            const currentVital = allVitalsData[selectedVital] || {
                              name: 'No Data',
                              current: '--',
                              unit: '',
                              status: 'normal',
                              data: []
                            };
                            
                            if (!currentVital || !currentVital.data || currentVital.data.length === 0) {
                              return (
                                <div className="text-center py-8 text-gray-500">
                                  <p>No vital data available for {getVitalDisplayName(selectedVital)}</p>
                                  <button
                                    onClick={() => onTabChange('chat')}
                                    className="mt-4 bg-medical-primary-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-medical-primary-600 transition"
                                  >
                                    Go to Chat to Add Data
                                  </button>
                                </div>
                              );
                            }
                            
                            return (
                              <>
                                <div className="mb-4">
                                  <div className="flex items-baseline gap-2 mb-1">
                                    <span className="text-2xl sm:text-3xl font-bold text-gray-900">{currentVital.current}</span>
                                    <span className="text-sm text-gray-600">{currentVital.unit}</span>
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
                                        green: 'text-green-700',
                                        yellow: 'text-amber-700',
                                        red: 'text-red-700',
                                        gray: 'text-gray-700'
                                      };
                                      return (
                                        <span className={`ml-auto text-xs ${statusColors[vitalStatus.color] || statusColors.gray}`}>
                                          {vitalStatus.label}
                                        </span>
                                      );
                                    })()}
                                  </div>
                                  <p className="text-xs sm:text-sm text-gray-600">
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
                                  <div className="flex flex-col justify-between text-xs text-gray-600 font-medium py-2" style={{ paddingBottom: '1.5rem' }}>
                                    {(() => {
                                      // Filter out non-numeric values and ensure we have valid numbers
                                      const values = currentVital.data
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
                                          <div key={i} className="border-t border-gray-200"></div>
                                        ))}
                                      </div>

                                      {/* SVG Graph */}
                                      {(() => {
                                        // Filter out non-numeric values and ensure we have valid numbers
                                        const values = currentVital.data
                                          .map(d => {
                                            if (selectedVital === 'bp' || selectedVital === 'bloodpressure') {
                                              return parseFloat(d.systolic || d.value);
                                            }
                                            return parseFloat(d.value);
                                          })
                                          .filter(v => !isNaN(v) && isFinite(v));

                                        if (values.length === 0) {
                                          return (
                                            <div className="flex items-center justify-center h-full text-gray-400">
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
                                                  const dataLength = Math.max(currentVital.data.length - 1, 1); // Prevent division by zero
                                                  const topPoints = currentVital.data.map((d, i) => {
                                                    const val = (selectedVital === 'bp' || selectedVital === 'bloodpressure') ? (d.systolic || d.value) : d.value;
                                                    return `${(i / dataLength) * 400},${160 - ((parseFloat(val) - yMin) / yRange) * 160}`;
                                                  }).join(' ');
                                                  return `${topPoints} 400,160 0,160`;
                                                })()}
                                                fill={`url(#gradient-vital-${selectedVital})`}
                                              />

                                              {/* Line */}
                                              <polyline
                                                points={(() => {
                                                  const dataLength = Math.max(currentVital.data.length - 1, 1); // Prevent division by zero
                                                  return currentVital.data.map((d, i) => {
                                                    const val = (selectedVital === 'bp' || selectedVital === 'bloodpressure') ? (d.systolic || d.value) : d.value;
                                                    return `${(i / dataLength) * 400},${160 - ((parseFloat(val) - yMin) / yRange) * 160}`;
                                                  }).join(' ');
                                                })()}
                                                fill="none"
                                                stroke="#3b82f6"
                                                strokeWidth="3"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                              />
                                            </svg>

                                            {/* Interactive data points with tooltips */}
                                            {currentVital.data.map((d, i) => {
                                              const dataLength = Math.max(currentVital.data.length - 1, 1); // Prevent division by zero
                                              const val = (selectedVital === 'bp' || selectedVital === 'bloodpressure') ? (d.systolic || d.value) : d.value;
                                              const displayValue = (selectedVital === 'bp' || selectedVital === 'bloodpressure') 
                                                ? `${d.systolic || d.value}/${d.diastolic || ''}` 
                                                : d.value;
                                              const x = (i / dataLength) * 100;
                                              const y = ((parseFloat(val) - yMin) / yRange) * 100;
                                              const isLatest = i === currentVital.data.length - 1;
                                              
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
                                                green: 'bg-green-100 text-green-700',
                                                yellow: 'bg-amber-100 text-amber-700',
                                                red: 'bg-red-100 text-red-700',
                                                gray: 'bg-gray-100 text-gray-700'
                                              };

                                              const isVitalSelected = selectedDataPoint === `${selectedVital}-${d.id}`;
                                              const vitalPointKey = `${selectedVital}-${d.id}`;
                                              const isVitalHovered = hoveredDataPoint === vitalPointKey;
                                              return (
                                                <div
                                                  key={i}
                                                  className="absolute group"
                                                  style={{
                                                    left: `${x}%`,
                                                    bottom: `${y}%`,
                                                    transform: 'translate(-50%, 50%)',
                                                    zIndex: isVitalSelected ? 20 : (isVitalHovered ? 25 : 10)
                                                  }}
                                                  onMouseEnter={() => setHoveredDataPoint(vitalPointKey)}
                                                  onMouseLeave={() => setHoveredDataPoint(null)}
                                                >
                                                  {/* Touch/Click area - larger on mobile */}
                                                  <div 
                                                    className="absolute inset-0 w-12 h-12 sm:w-10 sm:h-10 -m-6 sm:-m-5 cursor-pointer touch-manipulation"
                                                    style={{ zIndex: 20 }}
                                                    onClick={(e) => {
                                                      e.stopPropagation();
                                                      e.preventDefault();
                                                      // Toggle tooltip on click/tap
                                                      const pointKey = `${selectedVital}-${d.id}`;
                                                      if (selectedDataPoint === pointKey) {
                                                        setSelectedDataPoint(null);
                                                      } else {
                                                        setSelectedDataPoint(pointKey);
                                                      }
                                                    }}
                                                    onTouchStart={(e) => {
                                                      e.stopPropagation();
                                                    }}
                                                  />

                                                  {/* Outer ring on hover or when selected */}
                                                  <div
                                                    className={`absolute inset-0 rounded-full transition-all ${
                                                      selectedDataPoint === `${selectedVital}-${d.id}` ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
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
                                                      selectedDataPoint === `${selectedVital}-${d.id}` || isLatest ? 'scale-125' : 'group-hover:scale-125'
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
                                                      selectedDataPoint === `${selectedVital}-${d.id}` ? 'opacity-100 pointer-events-auto' : 'opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto'
                                                    } transition-opacity ${
                                                      y > 70 ? 'bottom-full mb-4' : 'top-full mt-4'
                                                    } ${
                                                      x < 10 ? 'left-0' : x > 90 ? 'right-0' : 'left-1/2 transform -translate-x-1/2'
                                                    }`}
                                                    style={{ zIndex: 30 }}
                                                  >
                                                    <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-xl whitespace-nowrap tooltip-container">
                                                      <div className="flex items-center justify-between gap-3">
                                                        <div>
                                                      <div className="font-bold text-sm">
                                                        {displayValue} {currentVital.unit}
                                                      </div>
                                                      <div className="text-xs text-gray-400 mt-0.5">{d.date}</div>
                                                        </div>
                                                        {d.id && (
                                                          <div className="flex items-center gap-2">
                                                            <button
                                                              onClick={(e) => {
                                                                e.stopPropagation();
                                                                e.preventDefault();
                                                                // Close tooltip
                                                                setSelectedDataPoint(null);
                                                                
                                                                const currentVitalDoc = allVitalsData[selectedVital];
                                                                if (currentVitalDoc && currentVitalDoc.id) {
                                                                  // Pre-fill with existing value data
                                                                  const valueData = currentVital.data.find(item => item.id === d.id);
                                                                  // Extract date from various possible formats, using local time to avoid timezone shift
                                                                  let dateTimeValue = new Date().toISOString().slice(0, 16);
                                                                  
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
                                                              className="text-blue-400 hover:text-blue-300 active:text-blue-200 transition-colors p-2.5 sm:p-2 rounded hover:bg-blue-900/20 active:bg-blue-900/30 flex-shrink-0 min-h-[48px] min-w-[48px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center touch-manipulation"
                                                              title="Edit this reading"
                                                            >
                                                              <Edit2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                                                            </button>
                                                            <button
                                                              onClick={(e) => {
                                                                e.stopPropagation();
                                                                e.preventDefault();
                                                                // Close tooltip
                                                                setSelectedDataPoint(null);
                                                                
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
                                                                    } catch (error) {
                                                                      // Revert optimistic update on error
                                                                      reloadHealthData();
                                                                      showError('Failed to delete vital reading. Please try again.');
                                                                    }
                                                                  }
                                                                });
                                                              }}
                                                              className="text-red-400 hover:text-red-300 transition-colors p-2 rounded hover:bg-red-900/20 flex-shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation active:opacity-70"
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
                                    <div className="relative border-t border-gray-300 pt-2 text-xs text-gray-600" style={{ height: '20px' }}>
                                      {(() => {
                                        if (!currentVital.data || currentVital.data.length === 0) {
                                          return <span>No data</span>;
                                        }

                                        const seenMonthYears = new Set();
                                        const monthLabels = [];
                                        const monthYearData = []; // Store { label, index, position }
                                        const dataLength = currentVital.data.length;

                                        currentVital.data.forEach((d, i) => {
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

                                        // For mobile: show first, middle (if 3+), and last (max 3 labels)
                                        let mobileLabels = [];
                                        if (monthYearData.length > 0) {
                                          if (monthYearData.length === 1) {
                                            mobileLabels = [monthYearData[0]];
                                          } else if (monthYearData.length === 2) {
                                            mobileLabels = [monthYearData[0], monthYearData[1]];
                                          } else {
                                            // Show first, middle, and last
                                            const midIndex = Math.floor(monthYearData.length / 2);
                                            mobileLabels = [
                                              monthYearData[0],
                                              monthYearData[midIndex],
                                              monthYearData[monthYearData.length - 1]
                                            ];
                                          }
                                        }

                                        return (
                                          <>
                                            {monthLabels}
                                            {mobileLabels.map((item, idx) => (
                                              <span
                                                key={`mobile-${item.index}`}
                                                className="absolute sm:hidden"
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
                            className="flex items-center gap-2 text-green-600 hover:text-green-700 transition-colors min-h-[44px] touch-manipulation active:opacity-70 px-2 py-1"
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
                        <div className="bg-white rounded-lg shadow p-4">
                          <h3 className="font-semibold text-gray-800 mb-3">All Vitals (Latest)</h3>
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
                                  className={`relative bg-white rounded-lg shadow-sm p-4 border-2 transition-all cursor-pointer ${
                                    selectedVital === key
                                      ? 'border-medical-primary-500 bg-medical-primary-50'
                                      : 'border-medical-neutral-200 hover:border-medical-neutral-300 hover:shadow-md'
                                  }`}
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
                                          className="text-yellow-500 hover:text-yellow-600 transition-colors"
                                          title={favoriteMetrics.vitals?.includes(key) ? "Remove from favorites" : "Add to favorites"}
                                        >
                                          <Star className={`w-3.5 h-3.5 ${favoriteMetrics.vitals?.includes(key) ? 'fill-yellow-500' : ''}`} />
                                        </button>
                                      </div>
                                      <div className="flex items-baseline gap-2">
                                        <p className="text-xl font-bold text-medical-neutral-900">{vital.current}</p>
                                        <p className="text-xs text-medical-neutral-500">{vital.unit}</p>
                                      </div>
                                      {(() => {
                                        const vitalStatus = getVitalStatus(vital.current, normalRange, key);
                                        const statusColors = {
                                          green: 'text-green-700',
                                          yellow: 'text-amber-700',
                                          red: 'text-red-700',
                                          gray: 'text-gray-700'
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
                                                    dateTime: new Date().toISOString().slice(0, 16), 
                                                    notes: '' 
                                                  });
                                                  setIsEditingVitalValue(false);
                                                  setEditingVitalValueId(null);
                                                  setShowAddVitalValue(true);
                                                }
                                              }}
                                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                            >
                                              <Plus className="w-4 h-4" />
                                              Add Value
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
                                                    } catch (error) {
                                                      // Revert optimistic update on error
                                                      reloadHealthData();
                                                      showError('Failed to delete vital data. Please try again.');
                                                    }
                                                  }
                                                });
                                              }}
                                              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
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
        </div>
      )}

      {healthSection === 'symptoms' && (
        <div className="space-y-4">
                {symptoms.length === 0 ? (
                  <div className="border-2 border-medical-primary-500 rounded-lg p-4 sm:p-6 text-center bg-white">
                    <div className="flex flex-col items-center gap-3">
                      <Thermometer className="w-10 h-10 sm:w-12 sm:h-12 text-medical-primary-400" />
                      <div>
                        <h3 className="text-base sm:text-lg font-semibold text-medical-primary-900 mb-1">No Symptoms Tracked Yet</h3>
                        <p className="text-xs sm:text-sm text-medical-primary-700 mb-4">
                          Track symptoms to identify patterns and correlations with your health data
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                          <button
                            onClick={() => setShowAddSymptomModal(true)}
                            className="bg-white border-2 border-medical-primary-500 text-medical-primary-600 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-medical-primary-50 transition shadow-sm flex items-center justify-center gap-2 min-h-[44px] touch-manipulation active:opacity-70"
                          >
                            <Edit2 className="w-4 h-4" />
                            Manual Enter
                          </button>
                    <button
                      onClick={() => onTabChange('chat')}
                            className="bg-medical-primary-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-medical-primary-600 transition shadow-sm flex items-center justify-center gap-2 min-h-[44px] touch-manipulation active:opacity-90"
                    >
                            <MessageSquare className="w-4 h-4" />
                            Add via Chat
                    </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {symptoms.length > 5 && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs sm:text-sm font-semibold text-blue-900">AI Pattern Detection</p>
                            <p className="text-xs text-blue-700 mt-1">
                              Track more symptoms to enable pattern detection and correlations with your lab values.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Symptom Calendar */}
                <div className="bg-white rounded-lg shadow p-3 sm:p-4">
                  {/* Date Pager */}
                  <div className="flex items-center justify-between mb-4 gap-2">
                    <button
                      onClick={() => {
                        const prevMonth = new Date(symptomCalendarDate);
                        prevMonth.setMonth(prevMonth.getMonth() - 1);
                        setSymptomCalendarDate(prevMonth);
                      }}
                      className="p-2 rounded-lg hover:bg-gray-100 transition min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation active:opacity-70"
                    >
                      <ChevronLeft className="w-5 h-5 text-gray-600" />
                    </button>
                    <div className="flex flex-col sm:flex-row items-center gap-2 flex-1 min-w-0">
                      <h3 className="font-semibold text-sm sm:text-base text-gray-800 text-center sm:text-left truncate">
                        {symptomCalendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </h3>
                      <button
                        onClick={() => {
                          // Use local timezone for today's date
                          const today = new Date();
                          const localToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                          setSymptomCalendarDate(localToday);
                          setSelectedDate(localToday.getDate().toString());
                        }}
                        className="px-3 py-2 text-xs sm:text-sm text-medical-primary-600 hover:bg-medical-primary-50 rounded-lg transition min-h-[44px] touch-manipulation active:opacity-70 whitespace-nowrap"
                      >
                        Today
                      </button>
                    </div>
                    <button
                      onClick={() => {
                        const nextMonth = new Date(symptomCalendarDate);
                        nextMonth.setMonth(nextMonth.getMonth() + 1);
                        setSymptomCalendarDate(nextMonth);
                      }}
                      className="p-2 rounded-lg hover:bg-gray-100 transition min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation active:opacity-70"
                    >
                      <ChevronRight className="w-5 h-5 text-gray-600" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between mb-4">
                    <div></div>
                    <button
                      onClick={() => setShowAddSymptomModal(true)}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 min-h-[44px] touch-manipulation active:opacity-70"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Symptom
                    </button>
                  </div>

                  {/* Calendar Grid */}
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                      <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                        {day}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {(() => {
                      const currentMonth = symptomCalendarDate.getMonth();
                      const currentYear = symptomCalendarDate.getFullYear();
                      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
                      const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();
                      const calendar = [];
                      // Use local timezone for today's date
                      const today = new Date();
                      const localToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                      const isCurrentMonth = localToday.getMonth() === currentMonth && localToday.getFullYear() === currentYear;

                      // Map real symptoms to dates (using local timezone)
                      const symptomsByDate = {};
                      symptoms.forEach(symptom => {
                        // Ensure date is in local timezone
                        const symptomDate = symptom.date instanceof Date ? symptom.date : new Date(symptom.date);
                        const localSymptomDate = new Date(symptomDate.getFullYear(), symptomDate.getMonth(), symptomDate.getDate());
                        // Only include symptoms from the current calendar month
                        if (localSymptomDate.getMonth() === currentMonth && localSymptomDate.getFullYear() === currentYear) {
                          const day = localSymptomDate.getDate().toString();
                        if (!symptomsByDate[day]) {
                          symptomsByDate[day] = [];
                        }
                        symptomsByDate[day].push({
                            id: symptom.id,
                          type: symptom.name || symptom.type,
                          severity: symptom.severity,
                            time: symptom.time || symptomDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
                            tags: symptom.tags || []
                        });
                        }
                      });

                      // Symptom type colors
                      const symptomColors = {
                        'Fatigue': 'bg-blue-500',
                        'Pain': 'bg-red-500',
                        'Nausea': 'bg-green-500',
                        'Headache': 'bg-purple-500',
                        'Dizziness': 'bg-yellow-500',
                        'Fever': 'bg-orange-500',
                        'Shortness of Breath': 'bg-cyan-500',
                        'Loss of Appetite': 'bg-amber-500',
                        'Sleep Issues': 'bg-indigo-500'
                      };
                      
                      // Helper function to get color for a symptom type (dark gray for custom symptoms)
                      const getSymptomColor = (symptomType) => {
                        return symptomColors[symptomType] || 'bg-gray-700'; // Dark gray for custom symptoms
                      };

                      // Add empty cells for days before month starts
                      for (let i = 0; i < firstDayOfWeek; i++) {
                        calendar.push(
                          <div key={`empty-${i}`} className="aspect-square"></div>
                        );
                      }

                      // Add days of month
                      for (let day = 1; day <= daysInMonth; day++) {
                        const dayStr = day.toString();
                        const hasSymptoms = symptomsByDate[dayStr];
                        // Check if this is today's date (using local timezone)
                        const isToday = isCurrentMonth && localToday.getDate() === day;
                        const uniqueSymptomTypes = hasSymptoms ? [...new Set(hasSymptoms.map(s => s.type))] : [];

                        calendar.push(
                          <button
                            key={day}
                            onClick={() => {
                              if (hasSymptoms) {
                                if (selectedDate === dayStr) {
                                  setSelectedDate(null);
                                } else {
                                  setSelectedDate(dayStr);
                                }
                              }
                            }}
                            className={`aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition-all relative ${isToday
                              ? 'bg-medical-primary-50 border-2 border-medical-primary-500 font-bold'
                              : hasSymptoms
                                ? 'hover:bg-gray-100 border border-gray-200'
                                : 'border border-transparent text-gray-400'
                              } ${selectedDate === dayStr ? 'ring-2 ring-medical-primary-500 bg-medical-primary-50' : ''}`}
                          >
                            <span className={isToday ? 'text-medical-primary-700' : hasSymptoms ? 'text-gray-900' : ''}>{day}</span>

                            {/* Symptom dots */}
                            {hasSymptoms && (
                              <div className="flex gap-0.5 mt-1">
                                {uniqueSymptomTypes.slice(0, 3).map((type, idx) => (
                                  <div
                                    key={idx}
                                    className={`w-1.5 h-1.5 rounded-full ${getSymptomColor(type)}`}
                                    title={type}
                                  />
                                ))}
                              </div>
                            )}
                          </button>
                        );
                      }

                      return (
                        <>
                          {calendar}

                          {/* Selected Date Details */}
                          {selectedDate && symptomsByDate[selectedDate] && (
                            <div className="col-span-7 mt-4 bg-gray-50 rounded-lg p-4 animate-fade-scale">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="font-semibold text-gray-800">
                                  {symptomCalendarDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).replace(selectedDate, selectedDate)}
                                </h4>
                                <button
                                  onClick={() => setSelectedDate(null)}
                                  className="text-gray-500 hover:text-gray-700"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>

                              <div className="space-y-2">
                                {symptomsByDate[selectedDate].map((symptom, idx) => (
                                  <div
                                    key={symptom.id || idx}
                                    className={`border-l-4 pl-3 py-2 pr-2 rounded-r ${symptom.severity === 'Severe' ? 'border-red-400 bg-red-50' :
                                      symptom.severity === 'Moderate' ? 'border-yellow-400 bg-yellow-50' :
                                        'border-green-400 bg-green-50'
                                      }`}
                                  >
                                    <div className="flex items-center justify-between mb-1">
                                      <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getSymptomColor(symptom.type)}`}></div>
                                        <p className="text-sm font-medium truncate">{symptom.type}</p>
                                      </div>
                                      <div className="flex items-center gap-2 flex-shrink-0">
                                      <span className="text-xs text-gray-600">{symptom.time}</span>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setDeleteConfirm({
                                              show: true,
                                              title: 'Delete Symptom Entry?',
                                              message: `This will permanently delete this ${symptom.type} symptom entry.`,
                                              itemName: 'symptom entry',
                                              confirmText: 'Yes, Delete',
                                              onConfirm: async () => {
                                                try {
                                                  await symptomService.deleteSymptom(symptom.id);
                                                  // Symptoms will automatically update via the subscription
                                                } catch (error) {
                                                  showError('Failed to delete symptom. Please try again.');
                                                }
                                              }
                                            });
                                          }}
                                          className="text-red-500 hover:text-red-700 transition-colors p-1 rounded hover:bg-red-100"
                                          title="Delete symptom"
                                        >
                                          <X className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </div>
                                    <p className={`text-xs font-medium ${symptom.severity === 'Severe' ? 'text-red-700' :
                                      symptom.severity === 'Moderate' ? 'text-yellow-700' :
                                        'text-green-700'
                                      }`}>
                                      {symptom.severity}
                                    </p>
                                    {symptom.tags && symptom.tags.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-2">
                                        {symptom.tags.map((tagId, tagIdx) => {
                                          const tagLabels = {
                                            'treatment-related': { label: 'Related to treatment', color: 'bg-blue-100 text-blue-700' },
                                            'discuss-doctor': { label: 'Discuss with doctor', color: 'bg-purple-100 text-purple-700' },
                                            'medication-needed': { label: 'Medication needed', color: 'bg-red-100 text-red-700' },
                                            'side-effect': { label: 'Side effect', color: 'bg-orange-100 text-orange-700' },
                                            'emergency': { label: 'Emergency', color: 'bg-red-200 text-red-800' },
                                            'recurring': { label: 'Recurring', color: 'bg-indigo-100 text-indigo-700' },
                                            'new-symptom': { label: 'New symptom', color: 'bg-green-100 text-green-700' },
                                            'worsening': { label: 'Worsening', color: 'bg-yellow-100 text-yellow-700' }
                                          };
                                          const tag = tagLabels[tagId] || { label: tagId, color: 'bg-gray-100 text-gray-700' };
                                          return (
                                            <span
                                              key={tagIdx}
                                              className={`text-xs rounded-full px-2 py-0.5 ${tag.color}`}
                                            >
                                              {tag.label}
                                            </span>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>

                    {/* Legend */}
                    <div className="bg-white rounded-lg shadow p-3 sm:p-4">
                      <h4 className="font-semibold text-gray-800 mb-3 text-xs sm:text-sm">Symptom Types</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                        {[
                          { type: 'Fatigue', color: 'bg-blue-500' },
                          { type: 'Pain', color: 'bg-red-500' },
                          { type: 'Nausea', color: 'bg-green-500' },
                          { type: 'Headache', color: 'bg-purple-500' },
                          { type: 'Dizziness', color: 'bg-yellow-500' },
                          { type: 'Other', color: 'bg-gray-500' },
                        ].map(item => (
                          <div key={item.type} className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${item.color}`}></div>
                            <span className="text-xs text-gray-700">{item.type}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
        </div>
      )}

      {healthSection === 'medications' && (
        <div className="space-y-4">
                {medications.length === 0 ? (
                  <div className="border-2 border-medical-primary-500 rounded-lg p-4 sm:p-6 text-center bg-white">
                    <div className="flex flex-col items-center gap-3">
                      <Pill className="w-10 h-10 sm:w-12 sm:h-12 text-medical-primary-400" />
                      <div>
                        <h3 className="text-base sm:text-lg font-semibold text-medical-primary-900 mb-1">No Medications Tracked Yet</h3>
                        <p className="text-xs sm:text-sm text-medical-primary-700 mb-4">
                          Track your medications to monitor adherence and schedule doses
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                          <button
                            onClick={() => setShowAddMedication(true)}
                            className="bg-white border-2 border-medical-primary-500 text-medical-primary-600 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-medical-primary-50 transition shadow-sm flex items-center justify-center gap-2 min-h-[44px] touch-manipulation active:opacity-70"
                          >
                            <Edit2 className="w-4 h-4" />
                            Manual Enter
                          </button>
                          <button
                            onClick={() => onTabChange('chat')}
                            className="bg-medical-primary-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-medical-primary-600 transition shadow-sm flex items-center justify-center gap-2 min-h-[44px] touch-manipulation active:opacity-90"
                          >
                            <MessageSquare className="w-4 h-4" />
                            Add via Chat
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
              <>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs sm:text-sm font-semibold text-blue-900">Medication Adherence</p>
                      <p className="text-xs text-blue-700 mt-1">
                        All medications taken on schedule. Next IV infusion scheduled for Jan 5.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Active Medications */}
                <div className="bg-white rounded-lg shadow p-3 sm:p-4">
                  <h3 className="text-sm sm:text-base font-semibold text-gray-800 mb-3">Active Medications</h3>
                  <div className="space-y-3">
                    {medications.filter(med => med.active).map(med => {
                      const colorClasses = {
                        purple: 'bg-purple-100 border-purple-300 text-purple-800',
                        blue: 'bg-blue-100 border-blue-300 text-blue-800',
                        green: 'bg-green-100 border-green-300 text-green-800',
                        orange: 'bg-orange-100 border-orange-300 text-orange-800',
                        teal: 'bg-teal-100 border-teal-300 text-teal-800',
                      };

                      return (
                        <div key={med.id} className="border border-gray-200 rounded-lg p-3 hover:shadow-md transition">
                          <div className="mb-2">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                              <h4 className="text-sm sm:text-base font-semibold text-gray-900">{med.name}</h4>
                              <span className={`text-xs px-2 py-0.5 rounded-full border ${colorClasses[med.color]} w-fit`}>
                                {med.purpose}
                              </span>
                            </div>
                            <p className="text-xs sm:text-sm text-gray-600">
                              <span className="font-medium">{med.dosage}</span> • {med.frequency}
                            </p>
                          </div>

                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-2 pt-2 border-t border-gray-100">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-gray-500 mb-0.5">Next dose</p>
                              <p className="text-xs sm:text-sm font-medium text-gray-800">
                                {new Date(med.nextDose).toLocaleString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: med.schedule.includes(':') ? 'numeric' : undefined,
                                  minute: med.schedule.includes(':') ? '2-digit' : undefined
                                })}
                              </p>
                            </div>
                            {med.schedule.includes(':') && (
                              (() => {
                                const times = med.schedule.split(',').map(t => t.trim());
                                const nextTime = times[0]; // Use first scheduled time for today
                                const taken = isMedicationTaken(med.id, nextTime);

                                return taken ? (
                                  <div className="flex items-center gap-2 bg-green-50 px-3 py-1.5 rounded-lg w-fit">
                                    <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                    <span className="text-xs font-medium text-green-700">Taken</span>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => markMedicationTaken(med.id, nextTime)}
                                    className="bg-green-600 text-white text-xs px-3 py-2 rounded-lg hover:bg-green-700 transition font-medium min-h-[44px] w-full sm:w-auto touch-manipulation active:opacity-90"
                                  >
                                    Mark Taken
                                  </button>
                                );
                              })()
                            )}
                          </div>

                          <div className="mt-2 pt-2 border-t border-gray-100">
                            <p className="text-xs text-gray-600">
                              <span className="font-medium">Schedule:</span> {med.schedule}
                            </p>
                            {med.instructions && (
                              <p className="text-xs text-gray-600 mt-1">
                                <span className="font-medium">Instructions:</span> {med.instructions}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Upcoming Doses */}
                <div className="bg-white rounded-lg shadow p-3 sm:p-4">
                  <h3 className="text-sm sm:text-base font-semibold text-gray-800 mb-3">Today's Schedule</h3>
                  <div className="space-y-2">
                    {medications
                      .filter(med => med.active && med.schedule.includes(':'))
                      .flatMap(med =>
                        med.schedule.split(',').map(time => ({
                          ...med,
                          specificTime: time.trim()
                        }))
                      )
                      .sort((a, b) => a.specificTime.localeCompare(b.specificTime))
                      .map((med, idx) => {
                        const taken = isMedicationTaken(med.id, med.specificTime);

                        return (
                          <button
                            key={`schedule-${med.id}-${idx}`}
                            onClick={() => !taken && markMedicationTaken(med.id, med.specificTime)}
                            className={`w-full flex items-center gap-2 sm:gap-3 p-3 border-2 rounded-lg transition min-h-[60px] touch-manipulation active:opacity-70 ${taken
                              ? 'border-green-300 bg-green-50 cursor-default'
                              : 'border-gray-200 hover:border-green-500 hover:bg-green-50'
                              }`}
                          >
                            <div className="text-xs sm:text-sm font-semibold text-gray-700 w-16 sm:w-20 flex-shrink-0">
                              {med.specificTime}
                            </div>
                            <div className="flex-1 text-left min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{med.name}</p>
                              <p className="text-xs text-gray-600">{med.dosage}</p>
                            </div>
                            <div className={`w-6 h-6 flex-shrink-0 rounded-full border-2 flex items-center justify-center ${taken ? 'border-green-500 bg-green-500' : 'border-gray-300'
                              }`}>
                              {taken && (
                                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </div>

                <button
                  onClick={() => setShowAddMedication(true)}
                  className="w-full py-2.5 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-blue-500 hover:text-blue-600 transition min-h-[44px] touch-manipulation active:opacity-70"
                >
                  + Add Medication
                </button>
                  </>
                )}
        </div>
      )}

      {/* Modals */}
      <AddSymptomModal
        show={showAddSymptomModal}
        onClose={() => setShowAddSymptomModal(false)}
        symptomForm={symptomForm}
        setSymptomForm={setSymptomForm}
        user={user}
      />

      <AddMedicationModal
        show={showAddMedication}
        onClose={() => setShowAddMedication(false)}
        user={user}
        reloadHealthData={reloadHealthData}
      />

      <AddLabModal
        show={showAddLab}
        onClose={() => setShowAddLab(false)}
        user={user}
        newLabData={newLabData}
        setNewLabData={setNewLabData}
        reloadHealthData={reloadHealthData}
        allLabsData={labsData}
      />

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

      <AddVitalValueModal
        show={showAddVitalValue}
        onClose={() => {
          setShowAddVitalValue(false);
          setSelectedVitalForValue(null);
          setIsEditingVitalValue(false);
          setEditingVitalValueId(null);
          setNewVitalValue({ value: '', systolic: '', diastolic: '', dateTime: new Date().toISOString().slice(0, 16), notes: '' });
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

      <AddLabValueModal
        show={showAddLabValue}
        onClose={() => {
          setShowAddLabValue(false);
          setSelectedLabForValue(null);
          setIsEditingLabValue(false);
          setEditingLabValueId(null);
          setNewLabValue({ value: '', date: getTodayLocalDate(), notes: '' });
        }}
        user={user}
        selectedLabForValue={selectedLabForValue}
        newLabValue={newLabValue}
        setNewLabValue={setNewLabValue}
        isEditingLabValue={isEditingLabValue}
        editingLabValueId={editingLabValueId}
        setIsEditingLabValue={setIsEditingLabValue}
        setEditingLabValueId={setEditingLabValueId}
        setSelectedLabForValue={setSelectedLabForValue}
        reloadHealthData={reloadHealthData}
      />

      {showDocumentOnboarding && (
        <DocumentUploadOnboarding
          isOnboarding={!hasUploadedDocument}
          onClose={() => setShowDocumentOnboarding(false)}
          onUploadClick={async (documentType, documentDate = null, documentNote = null, fileOrFiles = null) => {
            setShowDocumentOnboarding(false);
            // Store document date and note for use in upload
            setPendingDocumentDate(documentDate);
            setPendingDocumentNote(documentNote);
            
            // If file(s) is provided (from component's file picker), upload it/them directly
            if (fileOrFiles) {
              if (Array.isArray(fileOrFiles)) {
                // Multiple files - process sequentially
                for (let i = 0; i < fileOrFiles.length; i++) {
                  await handleRealFileUpload(fileOrFiles[i], documentType);
                }
              } else {
                // Single file
                handleRealFileUpload(fileOrFiles, documentType);
              }
            } else {
              // Otherwise, open file picker (fallback)
              const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
              
              if (documentOnboardingMethod === 'camera') {
                simulateCameraUpload(documentType);
              } else if (isMobile) {
                simulateCameraUpload(documentType);
              } else {
                simulateDocumentUpload(documentType);
              }
            }
          }}
        />
      )}

      {/* Lab Tooltip Modal */}
      {labTooltip && (
        <>
          <div
            className="fixed inset-0 z-[70] bg-black/20 backdrop-blur-sm"
            onClick={() => setLabTooltip(null)}
          />
          <div
            className="fixed z-[71] bg-white rounded-xl shadow-2xl border border-medical-neutral-200 max-w-sm w-[90vw] sm:w-96 p-5 animate-fade-scale"
            style={{
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              maxHeight: '80vh',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-lg font-bold text-medical-neutral-900 pr-2">{labTooltip.labName}</h3>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setLabTooltip(null);
                }}
                className="text-medical-neutral-400 hover:text-medical-neutral-600 transition-colors flex-shrink-0"
                aria-label="Close"
                type="button"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-medical-neutral-700 leading-relaxed">{labTooltip.description}</p>
          </div>
        </>
      )}

      <EditLabModal
        show={editingLab !== null}
        onClose={() => {
          setEditingLab(null);
          setEditingLabKey(null);
        }}
        lab={editingLab}
        labKey={editingLabKey}
        user={user}
        onSave={async () => {
          await reloadHealthData();
          showSuccess('Metric updated successfully');
        }}
        onDeleteValue={async (labId, valueId, labKey) => {
          try {
            
            // Optimistically update UI immediately
            const updatedLabsData = { ...labsData };
            if (updatedLabsData[labKey] && updatedLabsData[labKey].data) {
              const filteredData = updatedLabsData[labKey].data.filter(item => item.id !== valueId);
              const sortedData = [...filteredData].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
              updatedLabsData[labKey] = {
                ...updatedLabsData[labKey],
                data: filteredData,
                current: sortedData.length > 0 ? sortedData[0].value : '--'
              };
              setLabsData(updatedLabsData);
            }
            
            // Delete from Firestore
            await labService.deleteLabValue(labId, valueId);
            
            // Check if lab is now orphaned
            try {
              const remainingValues = await labService.getLabValues(labId);
              if (!remainingValues || remainingValues.length === 0) {
                await labService.deleteLab(labId);
              }
            } catch (error) {
            }
            
            // Reload to ensure sync
            await new Promise(resolve => setTimeout(resolve, 1000));
            await reloadHealthData();
            showSuccess('Value deleted successfully');
          } catch (error) {
            reloadHealthData();
            showError('Failed to delete value. Please try again.');
            throw error;
          }
        }}
      />

      <DeletionConfirmationModal
        show={deleteConfirm.show}
        onClose={() => {
          if (!isDeleting) {
            setDeleteConfirm({ show: false, title: '', message: '', onConfirm: null, itemName: '', confirmText: 'Yes, Delete Permanently' });
            setIsDeleting(false);
          }
        }}
        onConfirm={async () => {
          if (deleteConfirm.onConfirm) {
            setIsDeleting(true);
            try {
              await deleteConfirm.onConfirm();
            } finally {
              setIsDeleting(false);
              setDeleteConfirm({ show: false, title: '', message: '', onConfirm: null, itemName: '', confirmText: 'Yes, Delete Permanently' });
            }
          }
        }}
        title={deleteConfirm.title}
        message={deleteConfirm.message}
        itemName={deleteConfirm.itemName}
        confirmText={deleteConfirm.confirmText}
        isDeleting={isDeleting}
      />

      {/* Upload Progress Overlay */}
      <UploadProgressOverlay
        show={isUploading}
        uploadProgress={uploadProgress}
      />
    </div>
  );
}

