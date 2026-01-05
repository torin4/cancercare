import React, { useState, useEffect } from 'react';
import { Upload, MessageSquare, FolderOpen, User, Home, Send, Camera, AlertCircle, TrendingUp, TrendingDown, Minus, MapPin, Search, Activity, Plus, X, Edit2, ChevronRight, Star, Bookmark, Paperclip, Target, Heart, Droplet, Zap, Info, ChevronDown, ChevronUp, MoreVertical, Trash2, Calendar, Globe, Scale, Ruler, Clock, FileText, Users, Phone, Dna, UserCircle, ClipboardList, MessageCircle, Bot, Thermometer, Pill, BarChart, Check, LogOut, ChevronLeft, Save, Link2, Loader2, Unlink, Settings, FlaskConical, RefreshCw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { onAuthStateChanged, signOut, deleteUser, linkWithPopup, unlink, GoogleAuthProvider } from 'firebase/auth';
import { uploadDocument, deleteUserDirectory, deleteDocument } from './firebase/storage';
import { documentService, labService, vitalService, patientService, accountService, genomicProfileService, emergencyContactService, medicationService, symptomService, trialLocationService, messageService } from './firebase/services';
import { getSavedTrials } from './services/clinicalTrials/clinicalTrialsService';
import { IMPORTANT_GENES } from './config/importantGenes';
import { processDocument, generateExtractionSummary, linkValuesToDocument } from './services/documentProcessor';
import { processChatMessage, generateChatExtractionSummary } from './services/chatProcessor';
import { auth } from './firebase/config';
import Login from './components/Login';
import ClinicalTrials from './components/tabs/ClinicalTrials';
import DocumentUploadOnboarding from './components/modals/DocumentUploadOnboarding';
import Onboarding from './components/Onboarding';
import Navigation from './components/Navigation';
import AddSymptomModal from './components/modals/AddSymptomModal';
import AddMedicationModal from './components/modals/AddMedicationModal';
import EditMedicalTeamModal from './components/modals/EditMedicalTeamModal';
import EditContactsModal from './components/modals/EditContactsModal';
import EditGenomicModal from './components/modals/EditGenomicModal';
import AddLabModal from './components/modals/AddLabModal';
import AddVitalModal from './components/modals/AddVitalModal';
import AddVitalValueModal from './components/modals/AddVitalValueModal';
import DeletionConfirmationModal from './components/modals/DeletionConfirmationModal';
import EditLocationModal from './components/modals/EditLocationModal';
import EditPatientInfoModal from './components/modals/EditPatientInfoModal';
import UpdateStatusModal from './components/modals/UpdateStatusModal';
import EditDocumentNoteModal from './components/modals/EditDocumentNoteModal';
import AddLabValueModal from './components/modals/AddLabValueModal';
import UploadProgressOverlay from './components/UploadProgressOverlay';
import ProfileTab from './components/tabs/ProfileTab';
import FilesTab from './components/tabs/FilesTab';
import DashboardTab from './components/tabs/DashboardTab';
import HealthTab from './components/tabs/HealthTab';
import ChatTab from './components/tabs/ChatTab';
import { chatSuggestions, trialSuggestions } from './constants/chatSuggestions';
import { CANCER_TYPES, CANCER_SUBTYPES, STAGE_OPTIONS, PERFORMANCE_OPTIONS, DISEASE_STATUS_OPTIONS, TREATMENT_STATUS_OPTIONS } from './constants/cancerTypes';
import { COUNTRIES } from './constants/countries';
import { categoryDescriptions, categoryIcons } from './constants/categories';
import { formatLabel, formatSignificance, significanceExplanation } from './utils/formatters';
import { parseMutation, getTodayLocalDate, getStateLabel, getStatePlaceholder, getPostalLabel, getPostalPlaceholder } from './utils/helpers';
import { getLabStatus, getVitalStatus, getWeightNormalRange, getCancerRelevanceScore, cancerRelevantLabs } from './utils/healthUtils';
import { vitalSynonymMap, vitalKeyMap, vitalDisplayNames, vitalDescriptions, normalizeVitalName, getVitalDisplayName, labSynonymMap, labKeyMap, labDisplayNames, labValueDescriptions, normalizeLabName, getLabDisplayName, categorizeLabs } from './utils/normalizationUtils';
import { transformLabsData, transformVitalsData } from './utils/dataTransformUtils';
import { useAuth } from './contexts/AuthContext';
import { usePatientContext } from './contexts/PatientContext';
import { useHealthContext } from './contexts/HealthContext';
import { useBanner } from './contexts/BannerContext';
import './styles/animations.css';


export default function CancerCareApp() {
  // Use contexts for shared state
  const { user, authLoading, setUser } = useAuth();
  const { patientProfile, setPatientProfile, refreshPatient, needsOnboarding, setNeedsOnboarding } = usePatientContext();
  const { labsData, setLabsData, vitalsData, setVitalsData, genomicProfile, setGenomicProfile, hasRealLabData, hasRealVitalData, loading: healthLoading, reloadHealthData } = useHealthContext();
  const { showSuccess, showError } = useBanner();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [pendingHealthSection, setPendingHealthSection] = useState(null);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [showQuickLog, setShowQuickLog] = useState(false);
  const [showAddSymptomModal, setShowAddSymptomModal] = useState(false);
  const [healthSection, setHealthSection] = useState('labs'); // 'labs', 'vitals', 'symptoms', 'medications'
  const [selectedLab, setSelectedLab] = useState('ca125');
  const [selectedDate, setSelectedDate] = useState(null);
  const [symptomCalendarDate, setSymptomCalendarDate] = useState(new Date()); // Current month/year for symptoms calendar
  const [showAddMedication, setShowAddMedication] = useState(false);
  const [savedTrials, setSavedTrials] = useState([]);
  // genomicExpanded moved to ProfileTab
  const [selectedVital, setSelectedVital] = useState('bp');
  const [showAddVital, setShowAddVital] = useState(false);
  const [showAddVitalValue, setShowAddVitalValue] = useState(false);
  const [selectedVitalForValue, setSelectedVitalForValue] = useState(null);
  const [newVitalValue, setNewVitalValue] = useState({ value: '', systolic: '', diastolic: '', dateTime: new Date().toISOString().slice(0, 16), notes: '' });
  const [isEditingVitalValue, setIsEditingVitalValue] = useState(false);
  const [newVital, setNewVital] = useState({ vitalType: '', value: '', systolic: '', diastolic: '', dateTime: new Date().toISOString().slice(0, 16), notes: '' });
  const [quickLogInput, setQuickLogInput] = useState('');
  const [quickLogMode, setQuickLogMode] = useState('general'); // 'general' or 'symptom'

  const [quickLogSymptomForm, setQuickLogSymptomForm] = useState({
    name: '',
    severity: '',
    date: getTodayLocalDate(),
    time: new Date().toTimeString().slice(0, 5),
    notes: ''
  });
  const [symptomForm, setSymptomForm] = useState({
    name: '',
    severity: '',
    date: getTodayLocalDate(),
    time: new Date().toTimeString().slice(0, 5),
    notes: '',
    customSymptomName: '',
    tags: [] // Array of tags like 'treatment-related', 'discuss-doctor', etc.
  });
  const [showDocumentOnboarding, setShowDocumentOnboarding] = useState(false);
  const [documentOnboardingMethod, setDocumentOnboardingMethod] = useState('picker');
  const [hasUploadedDocument, setHasUploadedDocument] = useState(false);
  const [pendingDocumentDate, setPendingDocumentDate] = useState(null);
  const [pendingDocumentNote, setPendingDocumentNote] = useState(null);
  // Profile tab modals moved to ProfileTab component
  const [editMode, setEditMode] = useState('ai');
  const [currentStatus, setCurrentStatus] = useState({
    diagnosis: '',
    diagnosisDate: '',
    subtype: '',
    stage: '',
    treatmentLine: '',
    currentRegimen: '',
    performanceStatus: '',
    diseaseStatus: '',
    baselineCa125: '',
    subtype: '' // Add subtype field
  });
  const [showAddLab, setShowAddLab] = useState(false);
  const [showAddLabValue, setShowAddLabValue] = useState(false);
  const [selectedLabForValue, setSelectedLabForValue] = useState(null);
  const [newLabValue, setNewLabValue] = useState({ value: '', date: getTodayLocalDate(), notes: '' });
  const [isEditingLabValue, setIsEditingLabValue] = useState(false);
  const [editingLabValueId, setEditingLabValueId] = useState(null);
  const [isEditingVital, setIsEditingVital] = useState(false);
  const [editingVitalValueId, setEditingVitalValueId] = useState(null);
  // Profile tab modals moved to ProfileTab component
  const [showEditLocation, setShowEditLocation] = useState(false);
  const [editingDocumentNote, setEditingDocumentNote] = useState(null);
  const [documentNoteEdit, setDocumentNoteEdit] = useState('');

  // Profile tab useEffect moved to ProfileTab component
  // Profile tab state moved to ProfileTab component
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  // patientProfile is now from PatientContext
  const [trialLocation, setTrialLocation] = useState({
    country: 'United States',
    includeAllLocations: false
  });

  const [newLabData, setNewLabData] = useState({
    label: '',
    normalRange: '',
    unit: ''
  });

  // labsData, vitalsData, hasRealLabData, hasRealVitalData are now from HealthContext
  const [showAllLabs, setShowAllLabs] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({
    'Disease-Specific Markers': true, // Default expanded
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
  const [labTooltip, setLabTooltip] = useState(null); // { labName, description, position: { x, y } }
  const [openDeleteMenu, setOpenDeleteMenu] = useState(null); // Track which lab/vital has menu open: 'lab:ca125' or 'vital:bp'

  const [documents, setDocuments] = useState([]);
  // emergencyContacts and editContacts moved to ProfileTab component

  const [medications, setMedications] = useState([]);

  const [medicationLog, setMedicationLog] = useState([]);

  const markMedicationTaken = (medId, scheduledTime) => {
    const now = new Date().toISOString();

    setMedicationLog([...medicationLog, {
      medId: medId,
      scheduledTime: scheduledTime,
      takenAt: now
    }]);
  };

  // Helper to open the document upload onboarding with debugging log
  const openDocumentOnboarding = (docType = null, method = 'picker') => {
    setDocumentOnboardingMethod(method || 'picker');
    setShowDocumentOnboarding(true);
  };

  // Log when onboarding modal visibility changes
  useEffect(() => {
  }, [showDocumentOnboarding]);

  // Helper function to determine target tab and section based on document type
  const getTargetTabAndSection = (documentType) => {
    const docType = (documentType || '').toLowerCase();
    
    if (docType === 'lab' || docType === 'labs') {
      return { tab: 'health', section: 'labs' };
    } else if (docType === 'vital' || docType === 'vitals') {
      return { tab: 'health', section: 'vitals' };
    } else if (docType === 'genomic' || docType === 'genome') {
      return { tab: 'profile', section: null };
    } else if (docType === 'symptom' || docType === 'symptoms') {
      return { tab: 'health', section: 'symptoms' };
    } else if (docType === 'medication' || docType === 'medications') {
      return { tab: 'health', section: 'medications' };
    }
    // Default: stay on files tab or go to files
    return { tab: 'files', section: null };
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
      // This is critical - values were created without documentId, now we link them
      setUploadProgress('Linking data to document...');
      if (processingResult.extractedData && uploadResult.id) {
        try {
          await linkValuesToDocument(processingResult.extractedData, uploadResult.id, user.uid);
        } catch (linkError) {
          // Don't fail the upload if linking fails - values are still saved
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
      
      // Navigate to relevant tab based on document type
      const { tab, section } = getTargetTabAndSection(processingResult.documentType || docType);
      if (section && tab === 'health') {
        setPendingHealthSection(section);
      } else {
        setPendingHealthSection(null);
      }
      setActiveTab(tab);
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

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        await handleRealFileUpload(file, docType);
      }
    };

    input.click();
  };

  const simulateCameraUpload = (docType) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.vcf,.vcf.gz,.maf,.bed,.txt,.csv,.tsv,.zip,.gz,.xlsx,.xls,image/*';
    input.capture = 'environment';
    input.style.display = 'none'; // Hide the input element

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        await handleRealFileUpload(file, docType);
      }
    };

    // Append to body temporarily to ensure it works
    document.body.appendChild(input);
    input.click();
    // Remove from DOM after a short delay
    setTimeout(() => {
      if (document.body.contains(input)) {
        document.body.removeChild(input);
      }
    }, 1000);
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

  // Default lab data (fallback when no Firestore data)
  const defaultLabData = {
    ca125: {
      name: 'CA-125',
      unit: 'U/mL',
      current: 62,
      status: 'warning',
      trend: 'up',
      normalRange: '<35',
      data: [
        { date: 'Oct 15', value: 38 },
        { date: 'Oct 29', value: 42 },
        { date: 'Nov 12', value: 45 },
        { date: 'Nov 26', value: 47 },
        { date: 'Dec 1', value: 48 },
        { date: 'Dec 8', value: 51 },
        { date: 'Dec 15', value: 53 },
        { date: 'Dec 20', value: 55 },
        { date: 'Dec 28', value: 62 }
      ]
    },
    wbc: {
      name: 'WBC',
      unit: 'K/μL',
      current: 5.8,
      status: 'normal',
      trend: 'stable',
      normalRange: '4.5-11.0',
      data: [
        { date: 'Nov 12', value: 6.5 },
        { date: 'Dec 1', value: 6.3 },
        { date: 'Dec 15', value: 6.0 },
        { date: 'Dec 20', value: 6.2 },
        { date: 'Dec 28', value: 5.8 }
      ]
    },
    anc: {
      name: 'ANC',
      unit: '/μL',
      current: 3200,
      status: 'normal',
      trend: 'stable',
      normalRange: '>1,500',
      data: [
        { date: 'Nov 12', value: 3500 },
        { date: 'Dec 1', value: 3400 },
        { date: 'Dec 15', value: 3300 },
        { date: 'Dec 20', value: 3100 },
        { date: 'Dec 28', value: 3200 }
      ]
    },
    hemoglobin: {
      name: 'Hemoglobin',
      unit: 'g/dL',
      current: 11.2,
      status: 'normal',
      trend: 'stable',
      normalRange: '12.0-16.0',
      data: [
        { date: 'Oct 15', value: 12.5 },
        { date: 'Nov 12', value: 11.8 },
        { date: 'Dec 1', value: 11.5 },
        { date: 'Dec 15', value: 11.3 },
        { date: 'Dec 20', value: 11.4 },
        { date: 'Dec 28', value: 11.2 }
      ]
    },
    platelets: {
      name: 'Platelets',
      unit: 'K/μL',
      current: 238,
      status: 'normal',
      trend: 'stable',
      normalRange: '150-400',
      data: [
        { date: 'Nov 12', value: 252 },
        { date: 'Dec 1', value: 248 },
        { date: 'Dec 15', value: 242 },
        { date: 'Dec 20', value: 245 },
        { date: 'Dec 28', value: 238 }
      ]
    },
    creatinine: {
      name: 'Creatinine',
      unit: 'mg/dL',
      current: 0.9,
      status: 'normal',
      trend: 'stable',
      normalRange: '0.6-1.2',
      data: [
        { date: 'Oct 15', value: 0.8 },
        { date: 'Nov 12', value: 0.85 },
        { date: 'Dec 1', value: 0.87 },
        { date: 'Dec 20', value: 0.88 },
        { date: 'Dec 28', value: 0.9 }
      ]
    },
    egfr: {
      name: 'eGFR',
      unit: 'mL/min',
      current: 82,
      status: 'normal',
      trend: 'stable',
      normalRange: '>60',
      data: [
        { date: 'Oct 15', value: 88 },
        { date: 'Nov 12', value: 86 },
        { date: 'Dec 1', value: 84 },
        { date: 'Dec 20', value: 83 },
        { date: 'Dec 28', value: 82 }
      ]
    },
    alt: {
      name: 'ALT',
      unit: 'U/L',
      current: 28,
      status: 'normal',
      trend: 'stable',
      normalRange: '7-56',
      data: [
        { date: 'Oct 15', value: 25 },
        { date: 'Nov 12', value: 27 },
        { date: 'Dec 20', value: 26 },
        { date: 'Dec 28', value: 28 }
      ]
    },
    ast: {
      name: 'AST',
      unit: 'U/L',
      current: 32,
      status: 'normal',
      trend: 'stable',
      normalRange: '10-40',
      data: [
        { date: 'Oct 15', value: 30 },
        { date: 'Nov 12', value: 31 },
        { date: 'Dec 20', value: 33 },
        { date: 'Dec 28', value: 32 }
      ]
    }
  };

  // Use real data from Firestore only
  const allLabData = labsData;

  const defaultVitalsData = {
    bp: {
      name: 'Blood Pressure',
      unit: 'mmHg',
      current: '128/82',
      systolic: 128,
      diastolic: 82,
      status: 'normal',
      trend: 'stable',
      normalRange: '<140/90',
      data: [
        { date: 'Oct 15', value: 122, systolic: 122, diastolic: 78 },
        { date: 'Nov 12', value: 126, systolic: 126, diastolic: 80 },
        { date: 'Dec 20', value: 125, systolic: 125, diastolic: 81 },
        { date: 'Dec 28', value: 128, systolic: 128, diastolic: 82 }
      ]
    },
    hr: {
      name: 'Resting Heart Rate',
      unit: 'BPM',
      current: 72,
      status: 'normal',
      trend: 'stable',
      normalRange: '60-100',
      data: [
        { date: 'Oct 15', value: 68 },
        { date: 'Nov 12', value: 70 },
        { date: 'Dec 20', value: 74 },
        { date: 'Dec 28', value: 72 }
      ]
    },
    temp: {
      name: 'Temperature',
      unit: '°F',
      current: 98.2,
      status: 'normal',
      trend: 'stable',
      normalRange: '97.5-99.5',
      data: [
        { date: 'Oct 15', value: 98.1 },
        { date: 'Nov 12', value: 98.3 },
        { date: 'Dec 20', value: 98.0 },
        { date: 'Dec 28', value: 98.2 }
      ]
    },
    weight: {
      name: 'Weight',
      unit: 'kg',
      current: 62.0,
      status: 'normal',
      trend: 'down',
      normalRange: '55-70',
      data: [
        { date: 'Oct 15', value: 64.5 },
        { date: 'Nov 12', value: 63.8 },
        { date: 'Dec 20', value: 62.5 },
        { date: 'Dec 28', value: 62.0 }
      ]
    },
    o2sat: {
      name: 'Oxygen Saturation',
      unit: '%',
      current: 98,
      status: 'normal',
      trend: 'stable',
      normalRange: '>95',
      data: [
        { date: 'Oct 15', value: 97 },
        { date: 'Nov 12', value: 98 },
        { date: 'Dec 20', value: 98 },
        { date: 'Dec 28', value: 98 }
      ]
    },
    rr: {
      name: 'Respiratory Rate',
      unit: '/min',
      current: 16,
      status: 'normal',
      trend: 'stable',
      normalRange: '12-20',
      data: [
        { date: 'Oct 15', value: 15 },
        { date: 'Nov 12', value: 16 },
        { date: 'Dec 20', value: 16 },
        { date: 'Dec 28', value: 16 }
      ]
    }
  };

  // Use real data from Firestore only
  const allVitalsData = vitalsData;

  const [symptoms, setSymptoms] = useState([]);

  // genomicProfile is now from HealthContext

  // Mock data removed - app now uses real data from Firestore and ClinicalTrials.gov API


  // Welcome message initialization moved to ChatTab component

  // Handle onboarding completion
  const handleOnboardingComplete = async (formData) => {
    try {

      // Calculate age from date of birth
      const dob = new Date(formData.dateOfBirth);
      const today = new Date();
      const age = Math.floor((today - dob) / (365.25 * 24 * 60 * 60 * 1000));

      // Save patient profile with only fields collected in onboarding
      await patientService.savePatient(user.uid, {
        email: user.email,
        name: formData.name,
        displayName: formData.name,
        dateOfBirth: formData.dateOfBirth,
        age: age,
        gender: formData.gender || '',
        country: formData.country || '',
        height: formData.height ? parseFloat(formData.height) : null,
        weight: formData.weight ? parseFloat(formData.weight) : null,
        diagnosis: formData.diagnosis || formData.cancerType || '',
        diagnosisDate: formData.diagnosisDate || '',
        cancerType: formData.subtype || formData.cancerType || '', // Save subtype to cancerType field
        stage: formData.stage || '',
        // Save initial current status collected during onboarding
        currentStatus: {
          diagnosis: formData.diagnosis || formData.cancerType || '',
          diagnosisDate: formData.diagnosisDate || '',
          treatmentLine: formData.treatmentLine || '',
          currentRegimen: '',
          performanceStatus: formData.performanceStatus || '',
          diseaseStatus: formData.diseaseStatus || '',
          baselineCa125: formData.baselineCa125 ? parseFloat(formData.baselineCa125) : null
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        profileComplete: true
      });

      // No emergency contact or clinical trial coordinator saved during onboarding (managed in app contacts)

      // Update local patientProfile state so UI reflects saved data immediately
      setPatientProfile(prev => ({
        ...prev,
        name: formData.name,
        age: age,
        dateOfBirth: formData.dateOfBirth,
        gender: formData.gender || prev.gender,
        diagnosis: formData.diagnosis || formData.cancerType || prev.diagnosis,
        diagnosisDate: formData.diagnosisDate || prev.diagnosisDate,
        cancerType: formData.cancerType || prev.cancerType,
        stage: formData.stage || prev.stage,
        height: formData.height || prev.height,
        weight: formData.weight || prev.weight,
        country: formData.country || prev.country
      }));

      // Update currentStatus state so it shows in the Current Status section
      // Process subtype - if it's "Other (specify)", use the custom value
      const finalSubtype = formData.subtype === 'Other (specify)' ? '' : (formData.subtype || '');
      setCurrentStatus(prev => ({
        ...prev,
        diagnosis: formData.diagnosis || formData.cancerType || prev.diagnosis,
        diagnosisDate: formData.diagnosisDate || prev.diagnosisDate,
        treatmentLine: formData.treatmentLine || prev.treatmentLine,
        performanceStatus: formData.performanceStatus || prev.performanceStatus,
        diseaseStatus: formData.diseaseStatus || prev.diseaseStatus,
        baselineCa125: formData.baselineCa125 ? parseFloat(formData.baselineCa125) : prev.baselineCa125,
        stage: formData.stage || prev.stage,
        subtype: finalSubtype || prev.subtype
      }));

      setNeedsOnboarding(false);
    } catch (error) {
      showError('Failed to save profile. Please try again.');
    }
  };

  // Handle Data Deletion
  // Profile tab handleDeleteData moved to ProfileTab component

  // Load documents from Firestore when user logs in
  useEffect(() => {
    const loadDocuments = async () => {
      if (user) {
        try {
          const docs = await documentService.getDocuments(user.uid);
          setDocuments(docs);
        } catch (error) {
        }
      }
    };

    loadDocuments();
  }, [user]);

  // Real-time subscription for symptoms so UI updates without refresh
  useEffect(() => {
    if (!user) return;
    const unsub = symptomService.subscribeSymptoms(user.uid, (items) => {
      setSymptoms(items);
    });
    return () => unsub && unsub();
  }, [user]);

  // Load labs and vitals data from Firestore
  useEffect(() => {
    const loadAdditionalData = async () => {
      if (user) {
        try {
          // Initialize currentStatus from patientProfile (loaded by PatientContext)
          if (patientProfile) {
            if (patientProfile.currentStatus) {
              // Ensure all fields are included from saved currentStatus
              setCurrentStatus({
                diagnosis: patientProfile.currentStatus.diagnosis || patientProfile.diagnosis || '',
                diagnosisDate: patientProfile.currentStatus.diagnosisDate || patientProfile.diagnosisDate || '',
                subtype: patientProfile.currentStatus.subtype || patientProfile.cancerType || '',
                stage: patientProfile.currentStatus.stage || patientProfile.stage || '',
                treatmentLine: patientProfile.currentStatus.treatmentLine || '',
                currentRegimen: patientProfile.currentStatus.currentRegimen || '',
                performanceStatus: patientProfile.currentStatus.performanceStatus || '',
                diseaseStatus: patientProfile.currentStatus.diseaseStatus || '',
                baselineCa125: patientProfile.currentStatus.baselineCa125 || ''
              });
            } else if (patientProfile.cancerType || patientProfile.stage || patientProfile.diagnosis) {
              // If no currentStatus but we have cancerType/stage/diagnosis in profile, initialize currentStatus
              setCurrentStatus({
                diagnosis: patientProfile.diagnosis || '',
                diagnosisDate: patientProfile.diagnosisDate || '',
                subtype: patientProfile.cancerType || '',
                stage: patientProfile.stage || '',
                treatmentLine: '',
                currentRegimen: '',
                performanceStatus: '',
                diseaseStatus: '',
                baselineCa125: ''
              });
            }
          }

          // Check if user has uploaded documents
          const docs = await documentService.getDocuments(user.uid);
          setHasUploadedDocument(docs.length > 0);
          setDocuments(docs);

          // Load emergency contacts and filter out empty ones
          try {
            const contacts = await emergencyContactService.getEmergencyContacts(user.uid);
            const filteredContacts = contacts.filter(c => 
              (c.name && c.name.trim()) || (c.phone && c.phone.trim())
            );
            setEmergencyContacts(filteredContacts);
            
            // Clean up any empty contacts that might exist in Firestore
            const emptyContacts = contacts.filter(c => 
              !(c.name && c.name.trim()) && !(c.phone && c.phone.trim())
            );
            for (const emptyContact of emptyContacts) {
              if (emptyContact.id) {
                await emergencyContactService.deleteEmergencyContact(emptyContact.id);
              }
            }
          } catch (error) {
          }

          // Load trial location preferences
          try {
            const location = await trialLocationService.getTrialLocation(user.uid);
            if (location) {
              // Handle both old format (with city/state/zip) and new format (country only)
              setTrialLocation({
                country: location.country || 'United States',
                includeAllLocations: location.includeAllLocations || false
              });
            }
          } catch (error) {
          }
        } catch (error) {
        }
      }
    };

    loadAdditionalData();
  }, [user, patientProfile]);

  // Transform Firestore labs data to UI format
  // Note: getLabStatus, getVitalStatus, getWeightNormalRange, getCancerRelevanceScore, and cancerRelevantLabs
  // have been moved to utils/healthUtils.js

  // Note: transformLabsData moved to utils/dataTransformUtils.js

  // Note: categoryDescriptions and categoryIcons moved to constants/categories.js
  // Note: Normalization utilities (vitalSynonymMap, labSynonymMap, normalizeVitalName, normalizeLabName, etc.) moved to utils/normalizationUtils.js
  // Note: transformVitalsData moved to utils/dataTransformUtils.js

  // reloadHealthData is now from HealthContext

  // Auto-select first numeric lab when data loads
  useEffect(() => {
    if (Object.keys(labsData).length > 0) {
      // Check if current selection is valid
      if (!labsData[selectedLab] || !labsData[selectedLab].isNumeric) {
        // Find first numeric lab
        const firstNumericLab = Object.keys(labsData).find(key => labsData[key].isNumeric);
        if (firstNumericLab) {
          setSelectedLab(firstNumericLab);
        }
      }
    }
  }, [labsData]);

  // Auto-select first available vital when data loads
  useEffect(() => {
    if (Object.keys(vitalsData).length > 0) {
      // Check if current selection is valid
      if (!vitalsData[selectedVital] || !vitalsData[selectedVital].data || vitalsData[selectedVital].data.length === 0) {
        // Find first vital with data
        const firstVital = Object.keys(vitalsData).find(key => vitalsData[key] && vitalsData[key].data && vitalsData[key].data.length > 0);
        if (firstVital) {
          setSelectedVital(firstVital);
        }
      }
    }
  }, [vitalsData]);

  // Auto-locate to today when symptoms section is opened
  useEffect(() => {
    if (healthSection === 'symptoms') {
      // Use local timezone for today's date
      const today = new Date();
      const localToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      setSymptomCalendarDate(localToday);
      // Check if today has symptoms and auto-select it
      const todayDay = localToday.getDate().toString();
      const hasSymptomsToday = symptoms.some(s => {
        // Ensure symptom date is in local timezone
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


  // Load saved trials when dashboard is active

  // Chat-related functions moved to ChatTab component

  // Get current lab, ensuring it exists and defaulting to first numeric lab if not
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

  // Handle sign out
  // Profile tab handlers moved to ProfileTab component

  // Show loading screen ONLY during initial authentication check (app startup)
  // Do NOT show when health data is reloading - let individual screens handle their own loading states
  if (authLoading) {
    return (
      <div className="min-h-screen bg-medical-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-medical-primary-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
            <Activity className="w-8 h-8 text-medical-primary-600 animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold text-medical-neutral-900 mb-2">CancerCare</h1>
          <p className="text-medical-neutral-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login screen if not authenticated
  if (!user) {
    return <Login onLoginSuccess={() => setUser(auth.currentUser)} />;
  }

  return (
    <div className="flex flex-col h-screen bg-medical-neutral-50">

      <Navigation 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        patientProfile={patientProfile}
        onSidebarHover={setSidebarExpanded}
      />

      {/* Main Content - Scrollable */}
      <div className={`flex-1 overflow-y-auto pb-20 md:pb-0 transition-all duration-300 ${
        sidebarExpanded ? 'md:ml-64' : 'md:ml-20'
      }`}>
        {activeTab === 'dashboard' && (
          <DashboardTab onTabChange={setActiveTab} />
        )}

        {activeTab === 'chat' && (
          <ChatTab onTabChange={setActiveTab} />
        )}

        {activeTab === 'health' && (
          <HealthTab onTabChange={setActiveTab} initialSection={pendingHealthSection} />
        )}

        {activeTab === 'trials' && (
          <ClinicalTrials 
            onTrialSelected={(trial) => {
              // Store trial context in sessionStorage temporarily for chat tab
              if (trial) {
                sessionStorage.setItem('currentTrialContext', JSON.stringify(trial));
              }
              // Switch to chat tab
              setActiveTab('chat');
            }} 
          />
        )}

        {activeTab === 'files' && (
          <FilesTab onTabChange={setActiveTab} />
        )}

        {activeTab === 'profile' && (
          <ProfileTab onTabChange={setActiveTab} />
        )}


        {/* DeletionConfirmationModal moved to ProfileTab component */}

        {/* Lab Value Tooltip/Popup */}
        {labTooltip && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-[70] bg-black/20 backdrop-blur-sm"
              onClick={() => setLabTooltip(null)}
            />
            {/* Tooltip */}
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
      </div>



      {/* Quick Log Overlay - 50% Bottom Sheet */}
      {
        showQuickLog && (
          <div className="fixed inset-0 z-50">
            <div
              onClick={() => {
                setShowQuickLog(false);
                setQuickLogMode('general');
                setQuickLogInput('');
                setQuickLogSymptomForm({
                  name: '',
                  severity: '',
                  date: new Date().toISOString().split('T')[0],
                  time: new Date().toTimeString().slice(0, 5),
                  notes: ''
                });
              }}
              className="absolute inset-0 bg-black bg-opacity-50"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl animate-slide-up" style={{ height: quickLogMode === 'symptom' ? '85vh' : '50vh' }}>
              <div className="p-4 border-b flex items-center justify-between">
                <h3 className="font-bold text-lg">Quick Health Log</h3>
                <button
                  onClick={() => {
                    setShowQuickLog(false);
                    setQuickLogMode('general');
                    setQuickLogInput('');
                    setQuickLogSymptomForm({
                      name: '',
                      severity: '',
                      date: new Date().toISOString().split('T')[0],
                      time: new Date().toTimeString().slice(0, 5),
                      notes: ''
                    });
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="p-4 flex-1 overflow-y-auto">
                {/* Mode Toggle */}
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setQuickLogMode('general')}
                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition ${
                      quickLogMode === 'general'
                        ? 'bg-medical-primary-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    General Log
                  </button>
                  <button
                    onClick={() => setQuickLogMode('symptom')}
                    className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition ${
                      quickLogMode === 'symptom'
                        ? 'bg-medical-primary-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Log Symptom
                  </button>
                </div>

                {quickLogMode === 'general' ? (
                  <>
                    <p className="text-sm text-gray-600 mb-4">
                      Tell me about symptoms, energy levels, or anything you'd like to track.
                    </p>

                    <textarea
                      value={quickLogInput}
                      onChange={(e) => setQuickLogInput(e.target.value)}
                      placeholder="e.g., 'Fatigue 6/10 today, mild nausea after breakfast'"
                      className="w-full h-32 border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />

                    <button
                      onClick={async () => {
                        if (quickLogInput.trim() && user) {
                          const userMessage = quickLogInput;
                          setQuickLogInput('');
                          setShowQuickLog(false);
                          setQuickLogMode('general');
                          
                          // Store message in sessionStorage for ChatTab to process
                          sessionStorage.setItem('pendingQuickLogMessage', JSON.stringify({
                            type: 'user',
                            text: userMessage
                          }));
                          
                          // Reload health data if needed (will be done by ChatTab after processing)
                          // Switch to chat tab - ChatTab will process the message
                          setActiveTab('chat');
                        }
                      }}
                      className="w-full mt-4 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition"
                    >
                      Log & Save
                    </button>
                  </>
                ) : (
                  <>
                    <div className="space-y-4">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-blue-900">Quick Symptom Logging</p>
                            <p className="text-xs text-blue-700 mt-1">
                              Track your symptoms to help identify patterns and inform your care team.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Symptom Type <span className="text-red-600">*</span>
                        </label>
                        <select 
                          value={quickLogSymptomForm.name}
                          onChange={(e) => setQuickLogSymptomForm({...quickLogSymptomForm, name: e.target.value})}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select symptom type...</option>
                          <option value="Fatigue">Fatigue</option>
                          <option value="Pain">Pain</option>
                          <option value="Nausea">Nausea</option>
                          <option value="Headache">Headache</option>
                          <option value="Dizziness">Dizziness</option>
                          <option value="Fever">Fever</option>
                          <option value="Shortness of Breath">Shortness of Breath</option>
                          <option value="Loss of Appetite">Loss of Appetite</option>
                          <option value="Sleep Issues">Sleep Issues</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Severity <span className="text-red-600">*</span>
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          <button 
                            onClick={() => setQuickLogSymptomForm({...quickLogSymptomForm, severity: 'mild'})}
                            className={`border-2 rounded-lg py-3 text-center transition ${quickLogSymptomForm.severity === 'mild' ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-green-500 hover:bg-green-50'}`}
                          >
                            <div className="w-3 h-3 bg-green-500 rounded-full mx-auto mb-1"></div>
                            <div className="text-sm font-medium text-gray-700">Mild</div>
                          </button>
                          <button 
                            onClick={() => setQuickLogSymptomForm({...quickLogSymptomForm, severity: 'moderate'})}
                            className={`border-2 rounded-lg py-3 text-center transition ${quickLogSymptomForm.severity === 'moderate' ? 'border-yellow-500 bg-yellow-50' : 'border-gray-300 hover:border-yellow-500 hover:bg-yellow-50'}`}
                          >
                            <div className="w-3 h-3 bg-yellow-500 rounded-full mx-auto mb-1"></div>
                            <div className="text-sm font-medium text-gray-700">Moderate</div>
                          </button>
                          <button 
                            onClick={() => setQuickLogSymptomForm({...quickLogSymptomForm, severity: 'severe'})}
                            className={`border-2 rounded-lg py-3 text-center transition ${quickLogSymptomForm.severity === 'severe' ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-red-500 hover:bg-red-50'}`}
                          >
                            <div className="w-3 h-3 bg-red-500 rounded-full mx-auto mb-1"></div>
                            <div className="text-sm font-medium text-gray-700">Severe</div>
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                          <input
                            type="date"
                            value={quickLogSymptomForm.date}
                            onChange={(e) => setQuickLogSymptomForm({...quickLogSymptomForm, date: e.target.value})}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                          <input
                            type="time"
                            value={quickLogSymptomForm.time}
                            onChange={(e) => setQuickLogSymptomForm({...quickLogSymptomForm, time: e.target.value})}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Notes <span className="text-gray-500 text-xs">(optional)</span>
                        </label>
                        <textarea
                          rows="3"
                          value={quickLogSymptomForm.notes}
                          onChange={(e) => setQuickLogSymptomForm({...quickLogSymptomForm, notes: e.target.value})}
                          placeholder="Additional details about the symptom..."
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        ></textarea>
                      </div>
                    </div>

                    <button
                      onClick={async () => {
                        if (!quickLogSymptomForm.name || !quickLogSymptomForm.severity) {
                          showError('Please fill in all required fields (Symptom Type and Severity)');
                          return;
                        }
                        
                        if (!user) {
                          showError('Please log in to save symptoms');
                          return;
                        }

                        try {
                          // Combine date and time into a single datetime
                          const dateTime = new Date(`${quickLogSymptomForm.date}T${quickLogSymptomForm.time}`);
                          
                          await symptomService.addSymptom({
                            patientId: user.uid,
                            name: quickLogSymptomForm.name,
                            severity: quickLogSymptomForm.severity,
                            date: dateTime,
                            notes: quickLogSymptomForm.notes || ''
                          });

                          // Reset form and close modal
                          setQuickLogSymptomForm({
                            name: '',
                            severity: '',
                            date: new Date().toISOString().split('T')[0],
                            time: new Date().toTimeString().slice(0, 5),
                            notes: ''
                          });
                          setShowQuickLog(false);
                          setQuickLogMode('general');
                          
                          // Symptoms will automatically update via the subscription
                          // Store success message in sessionStorage for ChatTab
                          sessionStorage.setItem('pendingQuickLogMessage', JSON.stringify({
                            type: 'ai',
                            text: `Logged symptom: ${quickLogSymptomForm.name} (${quickLogSymptomForm.severity})`
                          }));
                          setActiveTab('chat');
                        } catch (error) {
                          showError('Failed to save symptom. Please try again.');
                        }
                      }}
                      className="w-full mt-4 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition flex items-center justify-center gap-2"
                    >
                      <Activity className="w-4 h-4" />
                      Log Symptom
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      }

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
      />

      <EditDocumentNoteModal
        show={!!editingDocumentNote}
        onClose={() => {
                  setEditingDocumentNote(null);
                  setDocumentNoteEdit('');
                }}
        user={user}
        editingDocumentNote={editingDocumentNote}
        setEditingDocumentNote={setEditingDocumentNote}
        documentNoteEdit={documentNoteEdit}
        setDocumentNoteEdit={setDocumentNoteEdit}
        setIsUploading={setIsUploading}
        setUploadProgress={setUploadProgress}
        reloadHealthData={reloadHealthData}
        setDocuments={setDocuments}
      />


      {/* Document Upload Onboarding (First Time) */}
      {
        showDocumentOnboarding && (
          <DocumentUploadOnboarding
            isOnboarding={!hasUploadedDocument}
            onClose={() => setShowDocumentOnboarding(false)}
            onUploadClick={(documentType, documentDate = null, documentNote = null, file = null) => {
              // Store document date and note for use in upload
              setPendingDocumentDate(documentDate);
              setPendingDocumentNote(documentNote);
              
              // Close modal
              setShowDocumentOnboarding(false);
              
              // If file is provided (from component's file picker), upload it directly
              if (file) {
                handleRealFileUpload(file, documentType);
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
        )
      }

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

      <AddLabModal
        show={showAddLab}
        onClose={() => {
                    setShowAddLab(false);
                    setNewLabData({ label: '', normalRange: '', unit: '' });
                  }}
        user={user}
        reloadHealthData={reloadHealthData}
        labKeyMap={labKeyMap}
        allLabsData={labsData}
      />

      <AddVitalModal
        show={showAddVital}
        onClose={() => {
                      setShowAddVital(false);
                      setIsEditingVital(false);
                      setEditingVitalValueId(null);
                      setNewVital({ vitalType: '', value: '', systolic: '', diastolic: '', dateTime: new Date().toISOString().slice(0, 16), notes: '' });
                    }}
        user={user}
        patientProfile={patientProfile}
        isEditingVital={isEditingVital}
        editingVitalValueId={editingVitalValueId}
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
      />

      <EditLocationModal
        show={showEditLocation}
        onClose={() => setShowEditLocation(false)}
        user={user}
        trialLocation={trialLocation}
        setTrialLocation={setTrialLocation}
      />

      {/* Profile tab modals moved to ProfileTab component */}


      <UploadProgressOverlay
        show={isUploading}
        uploadProgress={uploadProgress}
      />

      {/* Patient Onboarding Modal */}
      {needsOnboarding && (
        <Onboarding onComplete={handleOnboardingComplete} />
      )}
    </div >
  );
}
