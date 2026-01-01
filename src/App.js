import React, { useState, useEffect } from 'react';
import { Upload, MessageSquare, FolderOpen, User, Home, Send, Camera, AlertCircle, TrendingUp, MapPin, Search, Activity, Plus, X, Edit2, ChevronRight, Star, Bookmark, Paperclip, Target, Heart, Droplet, Zap, Info, ChevronDown, ChevronUp, MoreVertical, Trash2, Calendar, Globe, Scale, Ruler, Clock, FileText, Users, Phone, Dna, UserCircle, ClipboardList, MessageCircle, Bot, Thermometer, Pill, BarChart } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import Lottie from 'lottie-react';
import { onAuthStateChanged, signOut, deleteUser } from 'firebase/auth';
import { uploadDocument, deleteUserDirectory, deleteDocument } from './firebase/storage';
import { documentService, labService, vitalService, patientService, accountService, genomicProfileService, emergencyContactService, medicationService, symptomService, trialLocationService, messageService } from './firebase/services';
import { getSavedTrials } from './services/clinicalTrials/clinicalTrialsService';
import { IMPORTANT_GENES } from './config/importantGenes';
import { processDocument, generateExtractionSummary } from './services/documentProcessor';
import { processChatMessage, generateChatExtractionSummary } from './services/chatProcessor';
import { auth } from './firebase/config';
import Login from './components/Login';
import ClinicalTrials from './components/ClinicalTrials';
import DocumentUploadOnboarding from './components/DocumentUploadOnboarding';
import Onboarding from './components/Onboarding';

// Comprehensive list of countries for dropdowns
const COUNTRIES = [
  "United States", "Canada", "United Kingdom", "Australia", "Germany", "France", "India", "China", "Japan",
  "Brazil", "Mexico", "Italy", "Spain", "South Africa", "Nigeria", "Egypt", "Argentina", "Colombia",
  "Indonesia", "Pakistan", "Bangladesh", "Russia", "South Korea", "Vietnam", "Philippines", "Turkey",
  "Iran", "Thailand", "Myanmar", "Kenya", "Ukraine", "Poland", "Algeria", "Morocco", "Peru",
  "Venezuela", "Malaysia", "Uzbekistan", "Saudi Arabia", "Yemen", "Ghana", "Nepal", "Madagascar",
  "Cameroon", "Chile", "Netherlands", "Belgium", "Greece", "Portugal", "Sweden", "Switzerland",
  "Austria", "Israel", "United Arab Emirates", "Singapore", "Ireland", "New Zealand", "Denmark",
  "Finland", "Norway", "Cuba", "Dominican Republic", "Haiti", "Guatemala", "Ecuador", "Bolivia",
  "Paraguay", "Uruguay", "Honduras", "Nicaragua", "El Salvador", "Costa Rica", "Panama", "Jamaica",
  "Trinidad and Tobago", "Ethiopia", "Sudan", "Angola", "Mozambique", "Uganda", "Tanzania", "Democratic Republic of the Congo",
  "Afghanistan", "Iraq", "Syria", "Kazakhstan", "Sri Lanka", "Romania", "Hungary", "Czech Republic",
  "Bulgaria", "Serbia", "Croatia", "Bosnia and Herzegovina", "Albania", "North Macedonia", "Slovenia",
  "Estonia", "Latvia", "Lithuania", "Belarus", "Moldova", "Cyprus", "Malta", "Luxembourg", "Iceland",
  "Greenland", "Fiji", "Papua New Guinea", "Solomon Islands", "Vanuatu", "Samoa", "Tonga", "Kiribati",
  "Micronesia", "Marshall Islands", "Palau", "Nauru", "Tuvalu", "San Marino", "Monaco", "Liechtenstein",
  "Andorra", "Vatican City"
].sort();

const styles = `
  @keyframes slide-up {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }
  
  @keyframes fade-scale {
    from {
      opacity: 0;
      transform: scale(0.95) translateY(10px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }
  
  .animate-slide-up {
    animation: slide-up 0.3s ease-out;
  }
  
  .animate-fade-scale {
    animation: fade-scale 0.2s ease-out;
  }
  
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
`;

export default function CancerCareApp() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showQuickLog, setShowQuickLog] = useState(false);
  const [showAddSymptomModal, setShowAddSymptomModal] = useState(false);
  const [healthSection, setHealthSection] = useState('labs'); // 'labs', 'vitals', 'symptoms', 'medications'
  const [selectedLab, setSelectedLab] = useState('ca125');
  const [selectedDate, setSelectedDate] = useState(null);
  const [showAddMedication, setShowAddMedication] = useState(false);
  const [savedTrials, setSavedTrials] = useState([]);
  const [loadingSavedTrials, setLoadingSavedTrials] = useState(false);
  // Helper: extract DNA and protein change from mutation strings
  const parseMutation = (mutation) => {
    const raw = (mutation.variant || '') + ' ' + (mutation.type || '');
    const dnaMatch = raw.match(/c\.[^\s,;)]*/i);
    const proteinMatch = raw.match(/p\.[^\s,;)]*/i);
    const dna = mutation.dna || mutation.dnaChange || (dnaMatch ? dnaMatch[0] : null);
    const protein = mutation.protein || mutation.aminoAcidChange || (proteinMatch ? proteinMatch[0] : null);
    const kind = mutation.type || (mutation.germline ? 'Germline' : mutation.somatic ? 'Somatic' : null);
    return { dna, protein, kind };
  };
  // Cancer types (matching onboarding)
  const CANCER_TYPES = [
    // Gynecological Cancers
    'Ovarian Cancer',
    'Endometrial Cancer',
    'Cervical Cancer',
    'Uterine Cancer',
    'Vaginal Cancer',
    'Vulvar Cancer',
    'Fallopian Tube Cancer',
    // Breast Cancer
    'Breast Cancer',
    'Male Breast Cancer',
    'Inflammatory Breast Cancer',
    'Triple-Negative Breast Cancer',
    // Lung Cancer
    'Lung Cancer',
    'Non-Small Cell Lung Cancer',
    'Small Cell Lung Cancer',
    'Mesothelioma',
    // Gastrointestinal Cancers
    'Colorectal Cancer',
    'Colon Cancer',
    'Rectal Cancer',
    'Stomach Cancer',
    'Esophageal Cancer',
    'Pancreatic Cancer',
    'Liver Cancer',
    'Gallbladder Cancer',
    'Bile Duct Cancer',
    'Anal Cancer',
    'Gastrointestinal Stromal Tumor (GIST)',
    // Blood Cancers
    'Leukemia',
    'Acute Lymphoblastic Leukemia (ALL)',
    'Acute Myeloid Leukemia (AML)',
    'Chronic Lymphocytic Leukemia (CLL)',
    'Chronic Myeloid Leukemia (CML)',
    'Lymphoma',
    'Hodgkin Lymphoma',
    'Non-Hodgkin Lymphoma',
    'Multiple Myeloma',
    'Myelodysplastic Syndrome',
    // Skin Cancer
    'Melanoma',
    'Basal Cell Carcinoma',
    'Squamous Cell Carcinoma',
    'Merkel Cell Carcinoma',
    // Genitourinary Cancers
    'Prostate Cancer',
    'Bladder Cancer',
    'Kidney Cancer',
    'Renal Cell Carcinoma',
    'Testicular Cancer',
    'Penile Cancer',
    // Head and Neck Cancers
    'Head and Neck Cancer',
    'Thyroid Cancer',
    'Oral Cancer',
    'Throat Cancer',
    'Laryngeal Cancer',
    'Nasopharyngeal Cancer',
    'Salivary Gland Cancer',
    // Brain and Nervous System
    'Brain Cancer',
    'Glioblastoma',
    'Astrocytoma',
    'Oligodendroglioma',
    'Meningioma',
    'Neuroblastoma',
    'Spinal Cord Tumor',
    // Bone and Soft Tissue
    'Bone Cancer',
    'Osteosarcoma',
    'Ewing Sarcoma',
    'Soft Tissue Sarcoma',
    'Rhabdomyosarcoma',
    // Endocrine Cancers
    'Adrenal Cancer',
    'Pituitary Tumor',
    'Parathyroid Cancer',
    'Neuroendocrine Tumor',
    'Carcinoid Tumor',
    // Pediatric Cancers
    'Wilms Tumor',
    'Retinoblastoma',
    // Other Cancers
    'Thymoma',
    'Carcinoma of Unknown Primary',
    'Other (Please Specify)'
  ].sort();

  // Common subtype mapping (same options as onboarding)
  const CANCER_SUBTYPES = {
    'Ovarian Cancer': ['High-grade serous', 'Low-grade serous', 'Clear cell', 'Endometrioid', 'Mucinous', 'Other (specify)'],
    'Breast Cancer': ['Invasive ductal (IDC)', 'Invasive lobular (ILC)', 'Triple-negative', 'HER2+', 'ER+/PR+', 'Other (specify)'],
    'Lung Cancer': ['Adenocarcinoma', 'Squamous cell carcinoma', 'Small cell lung cancer', 'Large cell carcinoma', 'Other (specify)'],
    'Colorectal Cancer': ['Adenocarcinoma', 'Mucinous adenocarcinoma', 'Signet ring cell carcinoma', 'Other (specify)'],
    'Endometrial Cancer': ['Endometrioid', 'Serous (Type II)', 'Clear cell', 'Carcinosarcoma', 'Other (specify)'],
    'Pancreatic Cancer': ['Pancreatic ductal adenocarcinoma', 'Pancreatic neuroendocrine tumor (PNET)', 'Other (specify)'],
    'Kidney Cancer': ['Clear cell RCC', 'Papillary RCC', 'Chromophobe RCC', 'Other (specify)'],
    'Cervical Cancer': ['Squamous cell carcinoma', 'Adenocarcinoma', 'Adenosquamous', 'Other (specify)'],
    'Uterine Cancer': ['Endometrial (endometrioid)', 'Serous', 'Carcinosarcoma', 'Other (specify)'],
    'Brain Cancer': ['Glioblastoma', 'Astrocytoma', 'Oligodendroglioma', 'Other (specify)'],
    'Skin Cancer': ['Melanoma', 'Basal cell carcinoma', 'Squamous cell carcinoma', 'Other (specify)'],
    'Thyroid Cancer': ['Papillary', 'Follicular', 'Medullary', 'Anaplastic', 'Other (specify)'],
    'Bladder Cancer': ['Urothelial (transitional) carcinoma', 'Squamous cell carcinoma', 'Adenocarcinoma', 'Other (specify)'],
    'Prostate Cancer': ['Adenocarcinoma', 'Neuroendocrine', 'Other (specify)']
  };
  
  // Options matching onboarding Step 2
  const STAGE_OPTIONS = ['Stage I', 'Stage II', 'Stage III', 'Stage IV', 'Not Applicable', 'Unknown'];
  const PERFORMANCE_OPTIONS = ['0 - Fully active', '1 - Restricted in physically strenuous activity', '2 - Ambulatory, capable of all self-care', '3 - Limited self-care, confined to bed or chair 50%', '4 - Completely disabled, confined to bed or chair 100%'];
  const DISEASE_STATUS_OPTIONS = ['Newly Diagnosed', 'In Remission', 'Stable Disease', 'Progressive Disease', 'Recurrent Disease', 'Unknown'];
  const TREATMENT_STATUS_OPTIONS = ['First-line', 'Second-line', 'Third-line', 'Fourth-line or later', 'Maintenance', 'Adjuvant', 'Neoadjuvant', 'Palliative', 'Other (specify)'];
  // Format mutation labels (remove underscores, title case, map common codes)
  const formatLabel = (raw) => {
    if (!raw && raw !== 0) return '';
    let s = String(raw).trim();
    // common mapping for known codes
    const lower = s.toLowerCase();
    if (lower === 'vus' || lower === 'vsu') return 'VUS (Variant of Uncertain Significance)';
    if (lower === 'likely_pathogenic' || lower === 'likely pathogenic') return 'Likely pathogenic';
    if (lower === 'pathogenic') return 'Pathogenic';
    if (lower === 'benign') return 'Benign';
    // replace underscores and camelCase separation with spaces
    s = s.replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2');
    // Title case small words preserved
    return s.split(' ').map(w => w.length > 0 ? (w[0].toUpperCase() + w.slice(1).toLowerCase()) : '').join(' ');
  };

  const formatSignificance = (sig) => {
    if (!sig) return '';
    // If it's already a short code like 'likely_pathogenic', map to nicer text
    return formatLabel(sig).replace('Vus (Variant Of Uncertain Significance)', 'VUS (Variant of Uncertain Significance)');
  };
  const significanceExplanation = (sig) => {
    if (!sig) return '';
    const key = formatSignificance(sig).toLowerCase();
    if (key.includes('vus') || key.includes('variant of uncertain')) return 'Uncertain clinical significance — evidence is insufficient to determine if this variant causes disease.';
    if (key.includes('likely pathogenic')) return 'Likely pathogenic — evidence suggests this variant is likely to be disease-causing.';
    if (key.includes('pathogenic')) return 'Pathogenic — this variant is known to be disease-causing.';
    if (key.includes('benign')) return 'Benign — this variant is not associated with disease.';
    return '';
  };
  const [genomicExpanded, setGenomicExpanded] = useState(false);
  const [selectedVital, setSelectedVital] = useState('bp');
  const [showAddVital, setShowAddVital] = useState(false);
  const [messages, setMessages] = useState([]);
  const [chatHistoryLoaded, setChatHistoryLoaded] = useState(false);
  const messagesEndRef = React.useRef(null);
  const [quickLogInput, setQuickLogInput] = useState('');
  const [inputText, setInputText] = useState('');
  const [quickLogMode, setQuickLogMode] = useState('general'); // 'general' or 'symptom'
  const [currentTrialContext, setCurrentTrialContext] = useState(null); // Trial context for chatbot
  const [currentHealthContext, setCurrentHealthContext] = useState(null); // Health context for chatbot (labs, vitals, symptoms)
  const [quickLogSymptomForm, setQuickLogSymptomForm] = useState({
    name: '',
    severity: '',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().slice(0, 5),
    notes: ''
  });
  const [symptomForm, setSymptomForm] = useState({
    name: '',
    severity: '',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toTimeString().slice(0, 5),
    notes: ''
  });
  const [showDocumentOnboarding, setShowDocumentOnboarding] = useState(false);
  const [documentOnboardingMethod, setDocumentOnboardingMethod] = useState('picker');
  const [hasUploadedDocument, setHasUploadedDocument] = useState(false);
  const [showEditInfo, setShowEditInfo] = useState(false);
  const [editCancerCustom, setEditCancerCustom] = useState(false);
  const [editStageCustom, setEditStageCustom] = useState(false);
  const [showUpdateStatus, setShowUpdateStatus] = useState(false);
  const [editMode, setEditMode] = useState('ai');
  const [updateStatusSubtypeCustom, setUpdateStatusSubtypeCustom] = useState(false);
  const [updateStatusTreatmentCustom, setUpdateStatusTreatmentCustom] = useState(false);
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
  const [showEditGenomic, setShowEditGenomic] = useState(false);
  const [editingGenomicProfile, setEditingGenomicProfile] = useState(null);
  const [showEditContacts, setShowEditContacts] = useState(false);
  const [showEditLocation, setShowEditLocation] = useState(false);
  const [showEditMedicalTeam, setShowEditMedicalTeam] = useState(false);

  useEffect(() => {
    if (showEditInfo) {
      const diagKey = patientProfile.diagnosis || currentStatus.diagnosis || '';
      const opts = CANCER_SUBTYPES[diagKey] || [];
      setEditCancerCustom(patientProfile.cancerType ? !opts.includes(patientProfile.cancerType) : false);
      setEditStageCustom(patientProfile.stage === 'Other (specify)' || !!patientProfile.stageOther);
    }
  }, [showEditInfo]);
  const [showDeletionConfirm, setShowDeletionConfirm] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [deletionType, setDeletionType] = useState(null); // 'data' or 'account'
  const [isDeleting, setIsDeleting] = useState(false);
  const [profileImage, setProfileImage] = useState(null);
  const [documentScanAnimation, setDocumentScanAnimation] = useState(null);
  const [patientProfile, setPatientProfile] = useState({
    name: '',
    age: '',
    dateOfBirth: '',
    weight: '',
    height: '',
    diagnosis: '',
    stage: '',
    stageOther: '',
    diagnosisDate: '',
    cancerType: '',
    country: 'United States',
    oncologist: '',
    hospital: ''
  });
  const [trialLocation, setTrialLocation] = useState({
    country: 'United States',
    includeAllLocations: false
  });

  // Helpers for country-specific address labels/placeholders
  const getStateLabel = (country) => {
    if (!country) return 'State/Region';
    const c = country.toLowerCase();
    if (c.includes('japan')) return 'Prefecture';
    if (c.includes('canada') || c.includes('australia')) return 'Province/State';
    if (c.includes('united kingdom') || c.includes('uk')) return 'County/Region';
    return 'State/Region';
  };

  const getStatePlaceholder = (country) => {
    if (!country) return '';
    const c = country.toLowerCase();
    if (c.includes('japan')) return 'Tokyo';
    if (c.includes('canada')) return 'BC';
    if (c.includes('united states') || c.includes('united states of america')) return 'WA';
    return '';
  };

  const getPostalLabel = (country) => {
    if (!country) return 'Postal Code';
    const c = country.toLowerCase();
    if (c.includes('united states')) return 'ZIP Code';
    return 'Postal Code';
  };

  const getPostalPlaceholder = (country) => {
    if (!country) return '';
    const c = country.toLowerCase();
    if (c.includes('japan')) return '100-0001';
    if (c.includes('united states')) return '98109';
    if (c.includes('canada')) return 'V6B 1A1';
    return '';
  };
  const [newLabData, setNewLabData] = useState({
    label: '',
    normalRange: '',
    unit: ''
  });

  // Real data from Firestore
  const [labsData, setLabsData] = useState({});
  const [vitalsData, setVitalsData] = useState({});
  const [hasRealLabData, setHasRealLabData] = useState(false);
  const [hasRealVitalData, setHasRealVitalData] = useState(false);
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
  const [emergencyContacts, setEmergencyContacts] = useState([]);
  const [editContacts, setEditContacts] = useState([]);

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
    console.log('openDocumentOnboarding called, hasUploadedDocument=', hasUploadedDocument, 'docType=', docType, 'method=', method);
    setDocumentOnboardingMethod(method || 'picker');
    setShowDocumentOnboarding(true);
  };

  // Log when onboarding modal visibility changes
  useEffect(() => {
    console.log('showDocumentOnboarding changed:', showDocumentOnboarding);
  }, [showDocumentOnboarding]);

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
      name: 'Heart Rate',
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

  const [genomicProfile, setGenomicProfile] = useState(null);

  // Mock data removed - app now uses real data from Firestore and ClinicalTrials.gov API

  // Load Lottie animation
  useEffect(() => {
    fetch('/animations/Document OCR Scan.json')
      .then(response => response.json())
      .then(data => setDocumentScanAnimation(data))
      .catch(error => console.error('Error loading Lottie animation:', error));
  }, []);

  // Monitor authentication state and create patient profile if needed
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);

      if (user) {
        // Initialize default welcome message for the specific user
        setMessages([
          {
            type: 'ai',
            text: `Hi ${user.displayName || 'there'}. How can I help you track your health today?\n\nJust tell me about your values naturally - like "My CA-125 came back at 70" or "My blood pressure was 145/92 today" - and I'll extract and log everything automatically.`
          }
        ]);

        // Check if patient profile exists, create if not
        await ensurePatientProfile(user);
      } else {
        setMessages([]);
      }

      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Create patient profile if it doesn't exist
  const ensurePatientProfile = async (user) => {
    try {
      // Check if patient exists
      const existingPatient = await patientService.getPatient(user.uid);

      if (!existingPatient) {
        // Create initial skeleton record immediately
        console.log('Creating initial patient record for:', user.uid);
        await patientService.savePatient(user.uid, {
          email: user.email,
          displayName: user.displayName || 'Patient',
          createdAt: new Date(),
          updatedAt: new Date(),
          profileComplete: false
        });

        // Show onboarding for new users
        setNeedsOnboarding(true);
      } else {
        // Check if profile is complete (has diagnosis)
        if (!existingPatient.diagnosis) {
          console.log('Incomplete profile detected, showing onboarding');
          setNeedsOnboarding(true);
        }
      }
    } catch (error) {
      console.error('Error ensuring patient profile:', error);
    }
  };

  // Handle onboarding completion
  const handleOnboardingComplete = async (formData) => {
    try {
      console.log('Saving onboarding data:', formData);

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

      // No emergency contact or primary care saved during onboarding (managed in app contacts)

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

      console.log('Onboarding completed successfully');
      setNeedsOnboarding(false);
    } catch (error) {
      console.error('Error saving onboarding data:', error);
      alert('Failed to save profile. Please try again.');
    }
  };

  // Handle Data Deletion
  const handleDeleteData = async (type) => {
    if (!user) return;

    try {
      setIsDeleting(true);

      if (type === 'data') {
        // Option 1: Clear Health Data Only
        await accountService.clearHealthData(user.uid);
        await deleteUserDirectory(user.uid);

        // Reset local data states
        setLabsData({});
        setVitalsData({});
        setDocuments([]);
        setMessages([
          {
            type: 'ai',
            text: `Hi ${user.displayName || 'there'}. I've cleared your health history as requested. How can I help you start fresh today?`
          }
        ]);

        alert('Your health data has been successfully cleared.');
        setShowDeletionConfirm(false);
      } else if (type === 'account') {
        // Option 2: Full Account & Data Deletion
        const currentUser = auth.currentUser;
        if (!currentUser) {
          alert('No user found. Please log in and try again.');
          setIsDeleting(false);
          return;
        }

        const userId = currentUser.uid;

        try {
          // 1. Scrub all data first
          await accountService.deleteFullUserData(userId);
          await deleteUserDirectory(userId);

          // 2. Delete Auth Account
          await deleteUser(currentUser);
          
          // 3. Sign out and reset state
          await signOut(auth);
          setUser(null);
          setPatientProfile({
            name: '',
            age: '',
            dateOfBirth: '',
            weight: '',
            height: '',
            diagnosis: '',
            stage: '',
            stageOther: '',
            diagnosisDate: '',
            cancerType: '',
            country: 'United States',
            oncologist: '',
            hospital: ''
          });
          setLabsData({});
          setVitalsData({});
          setDocuments([]);
          setMessages([]);
          setCurrentStatus({
            diagnosis: '',
            diagnosisDate: '',
            treatmentLine: '',
            currentRegimen: '',
            performanceStatus: '',
            diseaseStatus: '',
            baselineCa125: '',
            stage: '',
            subtype: ''
          });
          
          setShowDeletionConfirm(false);
          alert('Your account and all associated data have been permanently deleted.');
        } catch (authError) {
          console.error('Account deletion error:', authError);
          if (authError.code === 'auth/requires-recent-login') {
            alert('For security, account deletion requires a recent login. Please log out and log back in, then try again.');
            setIsDeleting(false);
            setShowDeletionConfirm(false);
            return;
          }
          // If auth deletion fails but data was deleted, still sign out
          if (authError.code && !authError.code.includes('requires-recent-login')) {
            try {
              await signOut(auth);
              setUser(null);
            } catch (signOutError) {
              console.error('Sign out error:', signOutError);
            }
          }
          throw authError;
        }
      }
    } catch (error) {
      console.error('Error during deletion:', error);
      alert('An error occurred during deletion. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Load documents from Firestore when user logs in
  useEffect(() => {
    const loadDocuments = async () => {
      if (user) {
        try {
          const docs = await documentService.getDocuments(user.uid);
          setDocuments(docs);
        } catch (error) {
          console.error('Error loading documents:', error);
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
    const loadHealthData = async () => {
      if (user) {
        try {
          // Load labs
          const labs = await labService.getLabs(user.uid);
          const transformedLabs = transformLabsData(labs);
          setLabsData(transformedLabs);
          setHasRealLabData(labs.length > 0);

          // Load vitals
          const vitals = await vitalService.getVitals(user.uid);
          const transformedVitals = transformVitalsData(vitals);
          setVitalsData(transformedVitals);
          setHasRealVitalData(vitals.length > 0);

          // Load patient profile
          const profile = await patientService.getPatient(user.uid);
          if (profile) {
            setPatientProfile({
              name: profile.name || '',
              age: profile.age || '',
              dateOfBirth: profile.dateOfBirth || '',
              weight: profile.weight || '',
              height: profile.height || '',
              diagnosis: profile.diagnosis || '',
              diagnosisDate: profile.diagnosisDate || '',
              cancerType: profile.cancerType || '',
              stage: profile.stage || '',
              stageOther: profile.stageOther || '',
              country: profile.country || 'United States',
              oncologist: profile.oncologist || '',
              hospital: profile.hospital || ''
            });
            // Load current status if present, and merge with patientProfile fields
            if (profile.currentStatus) {
              setCurrentStatus({
                ...profile.currentStatus,
                subtype: profile.currentStatus.subtype || profile.cancerType || '',
                stage: profile.currentStatus.stage || profile.stage || ''
              });
            } else if (profile.cancerType || profile.stage) {
              // If no currentStatus but we have cancerType/stage in profile, initialize currentStatus
              setCurrentStatus({
                diagnosis: profile.diagnosis || '',
                diagnosisDate: profile.diagnosisDate || '',
                subtype: profile.cancerType || '',
                stage: profile.stage || '',
                treatmentLine: '',
                currentRegimen: '',
                performanceStatus: '',
                diseaseStatus: '',
                baselineCa125: ''
              });
            }
          }

          // Load genomic profile
          const genomic = await genomicProfileService.getGenomicProfile(user.uid);
          if (genomic) {
            setGenomicProfile(genomic);
          }

          // Check if user has uploaded documents
          const docs = await documentService.getDocuments(user.uid);
          setHasUploadedDocument(docs.length > 0);
          setDocuments(docs);

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
            console.log('No trial location preferences found, using defaults');
          }
        } catch (error) {
          console.error('Error loading health data:', error);
        }
      }
    };

    loadHealthData();
  }, [user]);

  // Transform Firestore labs data to UI format
  // Cancer-relevant lab categorization
  const cancerRelevantLabs = {
    critical: ['cea', 'ca125', 'ca199', 'afp', 'psa', 'ca153', 'ca2729', 'tumor_markers', 'wbc', 'hemoglobin', 'platelets', 'neutrophils', 'lymphocytes', 'anc'],
    important: ['alt', 'ast', 'creatinine', 'egfr', 'bilirubin', 'albumin', 'alp', 'ldh', 'd-dimer'],
    monitoring: ['glucose', 'sodium', 'potassium', 'calcium', 'magnesium', 'phosphate']
  };

  const getCancerRelevanceScore = (labType) => {
    if (cancerRelevantLabs.critical.includes(labType.toLowerCase())) return 3;
    if (cancerRelevantLabs.important.includes(labType.toLowerCase())) return 2;
    if (cancerRelevantLabs.monitoring.includes(labType.toLowerCase())) return 1;
    return 0;
  };

  // Calculate detailed status with color coding based on normal range
  const getLabStatus = (value, normalRange) => {
    if (!normalRange || typeof value !== 'number') {
      return { status: 'unknown', color: 'gray', label: 'Unknown' };
    }

    // Parse different normal range formats
    const rangeMatch = normalRange.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/);
    if (rangeMatch) {
      const min = parseFloat(rangeMatch[1]);
      const max = parseFloat(rangeMatch[2]);
      const range = max - min;
      const warningThreshold = range * 0.1; // 10% buffer zone

      if (value < min) {
        // Below normal range
        if (value >= min - warningThreshold) {
          return { status: 'warning-low', color: 'yellow', label: 'Slightly Low' };
        }
        return { status: 'abnormal-low', color: 'red', label: 'Low' };
      } else if (value > max) {
        // Above normal range
        if (value <= max + warningThreshold) {
          return { status: 'warning-high', color: 'yellow', label: 'Slightly High' };
        }
        return { status: 'abnormal-high', color: 'red', label: 'High' };
      } else {
        // Within normal range
        return { status: 'normal', color: 'green', label: 'Normal' };
      }
    }

    // Handle "< X" format (e.g., D-dimer: "< 0.5")
    const lessThanMatch = normalRange.match(/<\s*(\d+\.?\d*)/);
    if (lessThanMatch) {
      const threshold = parseFloat(lessThanMatch[1]);
      const warningThreshold = threshold * 0.1;

      if (value < threshold) {
        return { status: 'normal', color: 'green', label: 'Normal' };
      } else if (value < threshold + warningThreshold) {
        return { status: 'warning-high', color: 'yellow', label: 'Slightly High' };
      } else {
        return { status: 'abnormal-high', color: 'red', label: 'High' };
      }
    }

    // Handle "> X" format (e.g., eGFR: "> 60")
    const greaterThanMatch = normalRange.match(/>\s*(\d+\.?\d*)/);
    if (greaterThanMatch) {
      const threshold = parseFloat(greaterThanMatch[1]);
      const warningThreshold = threshold * 0.1;

      if (value > threshold) {
        return { status: 'normal', color: 'green', label: 'Normal' };
      } else if (value > threshold - warningThreshold) {
        return { status: 'warning-low', color: 'yellow', label: 'Slightly Low' };
      } else {
        return { status: 'abnormal-low', color: 'red', label: 'Low' };
      }
    }

    return { status: 'unknown', color: 'gray', label: 'Unknown' };
  };

  const transformLabsData = (labs) => {
    const grouped = {};

    labs.forEach(lab => {
      const labType = lab.labType || 'unknown';

      if (!grouped[labType]) {
        grouped[labType] = {
          name: lab.label,
          unit: lab.unit,
          current: lab.currentValue,
          status: lab.status || 'normal',
          trend: 'stable',
          normalRange: lab.normalRange,
          isNumeric: typeof lab.currentValue === 'number',
          relevanceScore: getCancerRelevanceScore(labType),
          data: []
        };
      }

      // Add to history if we have the lab values
      // Note: We'll load full history when we expand this
      grouped[labType].current = lab.currentValue;
      const timestamp = lab.createdAt?.toDate ? lab.createdAt.toDate() : (lab.createdAt ? new Date(lab.createdAt) : new Date());
      grouped[labType].data.push({
        id: lab.id, // Store lab document ID for deletion
        date: timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: lab.currentValue,
        timestamp: timestamp.getTime() // Store timestamp for calculations
      });
    });

    return grouped;
  };

  // Category descriptions for lab organization
  const categoryDescriptions = {
    'Disease-Specific Markers': 'Tumor markers and cancer-specific biomarkers used to monitor disease progression and treatment response',
    'Liver Function': 'Enzymes and proteins that assess liver health and detect liver damage or dysfunction',
    'Kidney Function': 'Markers that evaluate kidney health and filtration capacity',
    'Blood Counts': 'Complete blood count (CBC) components including white cells, red cells, and platelets',
    'Thyroid Function': 'Hormones and markers that assess thyroid gland function and metabolism',
    'Cardiac Markers': 'Biomarkers used to detect heart damage, heart failure, or cardiac events',
    'Inflammation': 'Markers that indicate inflammation, infection, or immune system activity',
    'Electrolytes': 'Essential minerals and salts that maintain fluid balance and cellular function',
    'Coagulation': 'Tests that evaluate blood clotting function and bleeding risk',
    'Custom Values': 'User-added lab values not in standard categories',
    'Others': 'Additional lab values that don\'t fit into other categories'
  };

  // Category icons mapping
  const categoryIcons = {
    'Disease-Specific Markers': Target,
    'Liver Function': Activity,
    'Kidney Function': Heart,
    'Blood Counts': Droplet,
    'Thyroid Function': Activity,
    'Cardiac Markers': Heart,
    'Inflammation': AlertCircle,
    'Electrolytes': Zap,
    'Coagulation': Droplet,
    'Custom Values': Plus,
    'Others': Activity
  };

  // Brief descriptions for common lab values
  // Vital Value Normalization System
  // Maps all variations to canonical keys for consistent display and descriptions
  const vitalSynonymMap = {
    'blood_pressure': ['bloodpressure', 'bp', 'blood pressure', 'systolic', 'diastolic', 'bp_systolic', 'bp_diastolic'],
    'heart_rate': ['heartrate', 'hr', 'heart rate', 'pulse', 'pulse rate', 'bpm'],
    'temperature': ['temp', 'temperature', 'body temperature', 'body temp', 'fever'],
    'weight': ['weight', 'body weight', 'bodyweight', 'mass'],
    'oxygen_saturation': ['o2sat', 'o2 saturation', 'spo2', 'oxygen saturation', 'o2', 'sat'],
    'respiratory_rate': ['rr', 'respiratory rate', 'breathing rate', 'respiration', 'breathing']
  };

  // Reverse map: create lookup from any variation to canonical key
  const vitalKeyMap = {};
  Object.entries(vitalSynonymMap).forEach(([canonicalKey, variations]) => {
    variations.forEach(variation => {
      vitalKeyMap[variation.toLowerCase()] = canonicalKey;
    });
  });

  // Display name mapping: canonical key -> user-friendly display name
  const vitalDisplayNames = {
    'blood_pressure': 'Blood Pressure',
    'heart_rate': 'Heart Rate',
    'temperature': 'Temperature',
    'weight': 'Weight',
    'oxygen_saturation': 'Oxygen Saturation',
    'respiratory_rate': 'Respiratory Rate'
  };

  // Vital descriptions
  const vitalDescriptions = {
    'blood_pressure': 'Blood pressure measures the force of blood against artery walls. Systolic (top number) is pressure when heart beats, diastolic (bottom number) is pressure when heart rests. Normal is typically <120/80 mmHg.',
    'heart_rate': 'Heart rate (pulse) measures how many times your heart beats per minute. Normal resting heart rate is typically 60-100 beats per minute for adults.',
    'temperature': 'Body temperature indicates whether you have a fever or hypothermia. Normal body temperature is typically 97.5-99.5°F (36.4-37.5°C).',
    'weight': 'Body weight is an important vital sign that can indicate fluid retention, nutritional status, or response to treatment. Significant changes may require medical attention.',
    'oxygen_saturation': 'Oxygen saturation (SpO2) measures how much oxygen your blood is carrying. Normal levels are typically >95%. Low levels may indicate breathing problems or lung issues.',
    'respiratory_rate': 'Respiratory rate measures how many breaths you take per minute. Normal rate is typically 12-20 breaths per minute for adults at rest.'
  };

  // Normalize vital name to canonical key
  const normalizeVitalName = (rawName) => {
    if (!rawName) return null;
    
    // Clean the raw name
    const cleaned = rawName.toString().toLowerCase().trim()
      .replace(/[^\w\s]/g, ' ') // Replace special chars with spaces
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
    
    // Look up in vital key map
    if (vitalKeyMap[cleaned]) {
      return vitalKeyMap[cleaned];
    }
    
    // Try partial matches
    for (const [canonicalKey, variations] of Object.entries(vitalSynonymMap)) {
      if (variations.some(v => cleaned.includes(v) || v.includes(cleaned))) {
        return canonicalKey;
      }
    }
    
    return null; // Unknown vital
  };

  // Get display name for vital
  const getVitalDisplayName = (vitalKeyOrName) => {
    // First try to normalize
    const canonicalKey = normalizeVitalName(vitalKeyOrName);
    if (canonicalKey && vitalDisplayNames[canonicalKey]) {
      return vitalDisplayNames[canonicalKey];
    }
    
    // Fallback: return original with basic formatting
    if (!vitalKeyOrName) return 'Unknown Vital';
    const name = vitalKeyOrName.toString();
    return name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, ' ');
  };

  // Lab Value Normalization System
  // Maps all variations to canonical keys for consistent categorization and descriptions
  
  // Synonym mapping: all variations -> canonical key
  const labSynonymMap = {
    // Disease-Specific Markers
    'ca125': ['ca125', 'ca-125', 'ca 125', 'ca_125'],
    'ca199': ['ca199', 'ca 19-9', 'ca-19-9', 'ca19-9', 'ca 19 9'],
    'ca153': ['ca153', 'ca 15-3', 'ca-15-3', 'ca15-3', 'ca 15 3'],
    'ca724': ['ca724', 'ca 72-4', 'ca-72-4', 'ca72-4', 'ca 72 4'],
    'ca242': ['ca242', 'ca 242', 'ca-242'],
    'ca50': ['ca50', 'ca 50', 'ca-50'],
    'cea': ['cea'],
    'afp': ['afp'],
    'psa': ['psa'],
    'he4': ['he4'],
    'inhibinb': ['inhibinb', 'inhibin b'],
    'romaindex': ['romaindex', 'roma index', 'roma'],
    'ca2729': ['ca2729', 'ca 27-29', 'ca-27-29', 'ca27-29', 'ca 27 29'],
    'scc_antigen': ['scc antigen', 'scc', 'squamous cell carcinoma antigen'],
    'cyfra211': ['cyfra211', 'cyfra 21-1', 'cyfra-21-1', 'cyfra21-1'],
    'nse': ['nse', 'neuron-specific enolase', 'neuron specific enolase'],
    'betahcg': ['betahcg', 'beta-hcg', 'β-hcg', 'bhcg', 'b-hcg', 'beta hcg'],
    
    // Liver Function
    'alt': ['alt', 'gpt'],
    'ast': ['ast', 'got'],
    'ast_alt_ratio': ['astalt', 'ast/alt', 'ast alt ratio', 'ast_alt'],
    'alp': ['alp', 'alkphos', 'alkalinephosphatase', 'alkaline phosphatase'],
    'alp_ifcc': ['alpifcc', 'alp ifcc', 'alp (ifcc)'],
    'bilirubin_total': ['tbil', 't-bil', 'totalbilirubin', 'total bilirubin', 'bilirubin'],
    'bilirubin_direct': ['direct bilirubin', 'conjugated bilirubin', 'dbil', 'd-bil'],
    'bilirubin_indirect': ['indirect bilirubin', 'unconjugated bilirubin', 'ibil', 'i-bil'],
    'albumin': ['alb', 'albumin'],
    'ggt': ['ggt', 'γgt', 'gamma gt'],
    'ldh': ['ldh', 'ld', 'ldifcc', 'ld ifcc'],
    
    // Kidney Function
    'creatinine': ['creatinine', 'cre'],
    'egfr': ['egfr', 'e gfr'],
    'bun': ['bun'],
    'urea': ['urea'],
    'urineprotein': ['urineprotein', 'urine protein', 'protein urine'],
    'urinecreatinine': ['urinecreatinine', 'urine creatinine'],
    
    // Blood Counts
    'wbc': ['wbc'],
    'rbc': ['rbc'],
    'hemoglobin': ['hemoglobin', 'hgb'],
    'hematocrit': ['hematocrit', 'hct'],
    'platelets': ['platelets', 'plt'],
    'anc': ['anc'],
    'neutrophils_abs': ['neutro#', 'neut#', 'neutrophilsabs', 'neutrophil abs'],
    'neutrophils_pct': ['neutro%', 'neut%', 'neutrophil%'],
    'lymphocytes_abs': ['lymph#', 'lym#', 'lymphocytesabs'],
    'lymphocytes_pct': ['lymph%', 'lym%', 'lymphocytes%'],
    'monocytes_abs': ['mono#', 'mon#'],
    'monocytes_pct': ['mono%', 'mon%'],
    'eosinophils_abs': ['eo#'],
    'eosinophils_pct': ['eo%'],
    'basophils_abs': ['ba#'],
    'basophils_pct': ['ba%'],
    'mcv': ['mcv'],
    'mch': ['mch'],
    'mchc': ['mchc'],
    'rdw': ['rdw'],
    'rdw_cv': ['rdwcv', 'rdw-cv'],
    'mpv': ['mpv', 'mean platelet volume'],
    'nrbc': ['nrbc', 'nucleated red blood cells', 'nucleated rbc'],
    'nrbc_pct': ['nrbc%', 'nrbc percentage', 'nrbc percent'],
    'reticulocyte_count': ['reticulocyte count', 'retic count', 'reticulocytes'],
    'reticulocyte_pct': ['reticulocyte%', 'reticulocyte percentage', 'reticulocyte percent', 'retic%'],
    
    // Thyroid Function
    'tsh': ['tsh'],
    't3': ['t3'],
    't4': ['t4'],
    'ft3': ['ft3', 'free t3', 'freet3'],
    'ft4': ['ft4', 'free t4', 'freet4'],
    'thyroglobulin': ['thyroglobulin', 'tg'],
    
    // Cardiac Markers
    'troponin': ['troponin', 'trop'],
    'bnp': ['bnp'],
    'ntprobnp': ['ntprobnp', 'nt-probnp'],
    'ckmb': ['ckmb', 'ck-mb'],
    'myoglobin': ['myoglobin'],
    
    // Inflammation
    'ferritin': ['ferritin', 'フェリチン', 'ferritinjapanese'],
    'crp': ['crp'],
    'esr': ['esr'],
    
    // Electrolytes
    'sodium': ['sodium', 'na'],
    'potassium': ['potassium', 'k'],
    'chloride': ['chloride', 'cl', 'ci'],
    'bicarbonate': ['bicarbonate', 'hco3', 'bicarb'],
    'co2': ['co2'],
    'magnesium': ['magnesium', 'mg'],
    'phosphorus': ['phosphorus', 'p', 'phos'],
    'calcium': ['calcium', 'ca'],
    'calcium_ionized': ['ionized calcium', 'ca2+', 'ca²⁺', 'ca++', 'ionized ca'],
    'phosphate': ['phosphate', 'phosphorus', 'p', 'phos', 'po4'],
    
    // Coagulation
    'pt': ['pt', 'ptactivity', 'pt activity', 'pt活性値', 'pt activity value'],
    'inr': ['inr'],
    'aptt': ['aptt'],
    'ddimer': ['ddimer', 'd-dimer', 'dimer', 'd-ダイマー'],
    'fdp': ['fdp'],
    'fibrinogen': ['fibrinogen', 'fbg'],
    'antithrombin_iii': ['antithrombin iii', 'at-iii', 'at3', 'antithrombin'],
    'protein_c': ['protein c', 'proteinc'],
    'protein_s': ['protein s', 'proteins'],
    
    // Other
    'glucose': ['glucose', 'glu', '血糖'],
    'hba1c': ['hba1c'],
    'iga': ['iga'],
    'igg': ['igg'],
    'igm': ['igm'],
    'vitamin_d': ['vitamin d', 'vitamind', '25(oh)d', '25ohd'],
    'beta2_microglobulin': ['beta2 microglobulin', 'beta-2 microglobulin', 'β2 microglobulin', 'b2m'],
    'procalcitonin': ['procalcitonin', 'pct'],
    'il6': ['il6', 'il-6', 'interleukin-6', 'interleukin 6']
  };

  // Reverse map: create lookup from any variation to canonical key
  const labKeyMap = {};
  Object.entries(labSynonymMap).forEach(([canonicalKey, variations]) => {
    variations.forEach(variation => {
      labKeyMap[variation.toLowerCase()] = canonicalKey;
    });
  });

  // Display name mapping: canonical key -> user-friendly display name
  const labDisplayNames = {
    'ca125': 'CA-125',
    'ca199': 'CA 19-9',
    'ca153': 'CA 15-3',
    'ca724': 'CA 72-4',
    'ca242': 'CA 242',
    'ca50': 'CA 50',
    'cea': 'CEA',
    'afp': 'AFP',
    'psa': 'PSA',
    'he4': 'HE4',
    'inhibinb': 'Inhibin B',
    'romaindex': 'ROMA Index',
    'ca2729': 'CA 27-29',
    'scc_antigen': 'SCC Antigen',
    'cyfra211': 'CYFRA 21-1',
    'nse': 'NSE',
    'betahcg': 'Beta-hCG',
    'alt': 'ALT',
    'ast': 'AST',
    'ast_alt_ratio': 'AST/ALT Ratio',
    'alp': 'ALP',
    'alp_ifcc': 'ALP (IFCC)',
    'bilirubin_total': 'Total Bilirubin',
    'bilirubin_direct': 'Direct Bilirubin',
    'bilirubin_indirect': 'Indirect Bilirubin',
    'albumin': 'Albumin',
    'ggt': 'GGT',
    'ldh': 'LDH',
    'creatinine': 'Creatinine',
    'egfr': 'eGFR',
    'bun': 'BUN',
    'urea': 'Urea',
    'urineprotein': 'Urine Protein',
    'urinecreatinine': 'Urine Creatinine',
    'wbc': 'WBC',
    'rbc': 'RBC',
    'hemoglobin': 'Hemoglobin',
    'hematocrit': 'Hematocrit',
    'platelets': 'Platelets',
    'anc': 'ANC',
    'neutrophils_abs': 'Neutrophil Absolute Count',
    'neutrophils_pct': 'Neutrophil Percentage',
    'lymphocytes_abs': 'Lymphocyte Absolute Count',
    'lymphocytes_pct': 'Lymphocyte Percentage',
    'monocytes_abs': 'Monocyte Absolute Count',
    'monocytes_pct': 'Monocyte Percentage',
    'eosinophils_abs': 'Eosinophil Absolute Count',
    'eosinophils_pct': 'Eosinophil Percentage',
    'basophils_abs': 'Basophil Absolute Count',
    'basophils_pct': 'Basophil Percentage',
    'mcv': 'MCV',
    'mch': 'MCH',
    'mchc': 'MCHC',
    'rdw': 'RDW',
    'rdw_cv': 'RDW-CV',
    'mpv': 'MPV',
    'nrbc': 'NRBC',
    'nrbc_pct': 'NRBC Percentage',
    'reticulocyte_count': 'Reticulocyte Count',
    'reticulocyte_pct': 'Reticulocyte Percentage',
    'tsh': 'TSH',
    't3': 'T3',
    't4': 'T4',
    'ft3': 'Free T3',
    'ft4': 'Free T4',
    'thyroglobulin': 'Thyroglobulin',
    'troponin': 'Troponin',
    'bnp': 'BNP',
    'ntprobnp': 'NT-proBNP',
    'ckmb': 'CK-MB',
    'myoglobin': 'Myoglobin',
    'ferritin': 'Ferritin',
    'crp': 'CRP',
    'esr': 'ESR',
    'sodium': 'Sodium',
    'potassium': 'Potassium',
    'chloride': 'Chloride',
    'bicarbonate': 'Bicarbonate',
    'co2': 'CO2',
    'magnesium': 'Magnesium',
    'phosphorus': 'Phosphorus',
    'calcium': 'Calcium',
    'calcium_ionized': 'Ionized Calcium',
    'phosphate': 'Phosphate',
    'pt': 'PT',
    'inr': 'INR',
    'aptt': 'APTT',
    'ddimer': 'D-dimer',
    'fdp': 'FDP',
    'fibrinogen': 'Fibrinogen',
    'antithrombin_iii': 'Antithrombin III',
    'protein_c': 'Protein C',
    'protein_s': 'Protein S',
    'glucose': 'Glucose',
    'hba1c': 'HbA1c',
    'iga': 'IgA',
    'igg': 'IgG',
    'igm': 'IgM',
    'vitamin_d': 'Vitamin D',
    'beta2_microglobulin': 'Beta-2 Microglobulin',
    'procalcitonin': 'Procalcitonin',
    'il6': 'IL-6'
  };

  // Normalize lab name to canonical key
  const normalizeLabName = (rawName) => {
    if (!rawName) return null;
    
    // Clean the raw name
    let cleaned = rawName.toString().trim();
    
    // Convert to lowercase for matching
    cleaned = cleaned.toLowerCase();
    
    // Remove common separators
    cleaned = cleaned.replace(/[\s\-_\/\.]/g, '');
    
    // Normalize common variants
    cleaned = cleaned.replace(/ntprobnp/g, 'ntprobnp');
    cleaned = cleaned.replace(/ckmb/g, 'ckmb');
    cleaned = cleaned.replace(/ca199/g, 'ca199');
    cleaned = cleaned.replace(/ca125/g, 'ca125');
    cleaned = cleaned.replace(/freet3/g, 'ft3');
    cleaned = cleaned.replace(/freet4/g, 'ft4');
    
    // Look up in synonym map
    const canonicalKey = labKeyMap[cleaned];
    return canonicalKey || null;
  };

  // Get display name for a lab (canonical key or raw name)
  const getLabDisplayName = (labKeyOrName) => {
    // First try to normalize
    const canonicalKey = normalizeLabName(labKeyOrName);
    if (canonicalKey && labDisplayNames[canonicalKey]) {
      return labDisplayNames[canonicalKey];
    }
    
    // If no canonical key found, return title case of original
    if (labKeyOrName) {
      const str = labKeyOrName.toString();
      return str.split(/[\s\-_]/).map(word => 
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      ).join(' ');
    }
    
    return labKeyOrName || 'Unknown Lab';
  };

  // Lab value descriptions - using ONLY canonical keys
  const labValueDescriptions = {
    // Disease-Specific Markers
    'ca125': 'Tumor marker for ovarian cancer. Elevated levels may indicate disease activity or recurrence.',
    'ca199': 'Tumor marker for pancreatic and gastrointestinal cancers. Used to monitor treatment response.',
    'ca153': 'Tumor marker for breast cancer. Helps monitor disease progression and treatment effectiveness.',
    'ca724': 'Tumor marker for gastrointestinal cancers, particularly gastric cancer. Used to monitor treatment response and recurrence.',
    'ca242': 'Tumor marker for pancreatic and colorectal cancers. Used in combination with other markers for diagnosis and monitoring.',
    'ca50': 'Tumor marker for pancreatic and gastrointestinal cancers. Elevated levels may indicate disease activity.',
    'cea': 'Carcinoembryonic antigen. Used to monitor colorectal, lung, and other cancers. Elevated levels may indicate recurrence.',
    'afp': 'Alpha-fetoprotein. Marker for liver cancer and germ cell tumors. Also elevated in pregnancy.',
    'psa': 'Prostate-specific antigen. Used to screen and monitor prostate cancer. Age-specific normal ranges apply.',
    'he4': 'Human epididymis protein 4. Ovarian cancer biomarker, often used with CA-125 for better accuracy.',
    'inhibinb': 'Hormone marker for ovarian cancer, particularly granulosa cell tumors. Also used in fertility assessment.',
    'romaindex': 'Risk of Ovarian Malignancy Algorithm. Combines CA-125 and HE4 levels to assess ovarian cancer risk.',
    'ca2729': 'CA 27-29. A tumor marker primarily used in breast cancer to monitor treatment response and detect disease recurrence.',
    'scc_antigen': 'SCC Antigen (Squamous Cell Carcinoma Antigen). A tumor marker associated with squamous cell carcinomas, including cervical, lung, and head and neck cancers.',
    'cyfra211': 'CYFRA 21-1. A fragment of cytokeratin 19 commonly elevated in non-small cell lung cancer and used to assess tumor burden.',
    'nse': 'NSE (Neuron-Specific Enolase). A marker associated with neuroendocrine tumors and small cell lung cancer, often reflecting disease activity.',
    'betahcg': 'Beta-hCG (β-hCG). A tumor marker used in germ cell tumors and trophoblastic disease, and occasionally elevated in other malignancies.',
    // Blood Counts
    'wbc': 'White blood cell count. Measures immune system cells. Low counts (neutropenia) increase infection risk during chemotherapy.',
    'rbc': 'Red blood cell count. Measures oxygen-carrying cells. Low levels indicate anemia.',
    'hemoglobin': 'Protein in red blood cells that carries oxygen. Low levels (anemia) cause fatigue and weakness.',
    'hematocrit': 'Percentage of red blood cells in blood. Low levels indicate anemia.',
    'platelets': 'Blood cells that help with clotting. Low levels (thrombocytopenia) increase bleeding risk.',
    'anc': 'Absolute neutrophil count. Critical for infection risk. Should be >1500/μL to reduce infection risk.',
    'neutrophils_abs': 'Neutrophil absolute count. Total number of neutrophils in blood. Critical for fighting bacterial infections. Low levels (neutropenia) increase infection risk.',
    'neutrophils_pct': 'Neutrophil percentage. Percentage of white blood cells that are neutrophils. Normal range is typically 48.0-61.0%. Low levels increase infection risk.',
    'lymphocytes_abs': 'Lymphocyte absolute count. Total number of lymphocytes in blood. Important for immune function. Low levels may indicate immune suppression.',
    'lymphocytes_pct': 'Lymphocyte percentage. Percentage of white blood cells that are lymphocytes. Normal range is typically 25.0-45.0%. Low levels may indicate immune suppression.',
    'monocytes_abs': 'Monocyte absolute count. Total number of monocytes in blood. Elevated in chronic infections or inflammatory conditions.',
    'monocytes_pct': 'Monocyte percentage. Percentage of white blood cells that are monocytes. Normal range is typically 4.0-7.0%. Elevated in chronic infections or inflammatory conditions.',
    'eosinophils_abs': 'Eosinophil absolute count. Total number of eosinophils in blood. Elevated in allergies, asthma, or parasitic infections.',
    'eosinophils_pct': 'Eosinophil percentage. Percentage of white blood cells that are eosinophils. Normal range is typically 1.0-5.0%. Elevated in allergies or parasitic infections.',
    'basophils_abs': 'Basophil absolute count. Total number of basophils in blood. Usually very low. Elevated in rare conditions like chronic myeloid leukemia.',
    'basophils_pct': 'Basophil percentage. Percentage of white blood cells that are basophils. Normal range is typically 0.0-1.0%.',
    'mcv': 'Mean corpuscular volume. Average size of red blood cells. Used to classify types of anemia.',
    'mch': 'Mean corpuscular hemoglobin. Average amount of hemoglobin per red blood cell. Low in iron deficiency anemia.',
    'mchc': 'Mean corpuscular hemoglobin concentration. Average concentration of hemoglobin in red blood cells. Used in anemia diagnosis.',
    'rdw': 'Red cell distribution width. Measures variation in red blood cell size. Elevated in iron deficiency or other anemias.',
    'rdw_cv': 'Red cell distribution width - coefficient of variation. Measures variation in red blood cell size as a percentage. Elevated in iron deficiency or other anemias.',
    'mpv': 'Mean platelet volume. Average size of platelets in the blood. Changes can indicate altered bone marrow activity, platelet destruction, or effects of chemotherapy.',
    'nrbc': 'Nucleated red blood cells. Immature red blood cells circulating in the bloodstream. Their presence suggests severe bone marrow stress, hypoxia, or marrow infiltration by cancer.',
    'nrbc_pct': 'NRBC percentage. Proportion of nucleated red blood cells relative to total white blood cells. Used to assess bone marrow response or failure during intensive cancer treatment.',
    'reticulocyte_count': 'Reticulocyte count. Number of immature red blood cells released from the bone marrow. Reflects marrow response to anemia, bleeding, or chemotherapy-induced suppression.',
    'reticulocyte_pct': 'Reticulocyte percentage. Percentage of reticulocytes among total red blood cells. Helps distinguish whether anemia is due to decreased production or increased destruction.',
    // Kidney Function
    'creatinine': 'Waste product filtered by kidneys. High levels indicate kidney dysfunction or dehydration.',
    'egfr': 'Estimated glomerular filtration rate. Measures kidney filtering capacity. Adjusted for age, gender, and race.',
    'bun': 'Blood urea nitrogen. Waste product from protein breakdown. High levels may indicate kidney dysfunction.',
    'urea': 'Waste product from protein metabolism. Filtered by kidneys. High levels indicate kidney dysfunction or dehydration.',
    'urineprotein': 'Protein in urine. Normally minimal. Elevated levels (proteinuria) indicate kidney damage or disease.',
    'urinecreatinine': 'Creatinine in urine. Used with blood creatinine to calculate kidney function and detect kidney disease.',
    // Liver Function
    'alt': 'Alanine aminotransferase. Liver enzyme. Elevated levels indicate liver damage, often from medications or disease.',
    'ast': 'Aspartate aminotransferase. Liver enzyme. Elevated levels indicate liver or muscle damage.',
    'ast_alt_ratio': 'Ratio of aspartate aminotransferase to alanine aminotransferase. Used to assess patterns of liver injury; abnormal values may suggest specific liver conditions such as alcoholic liver disease or advanced fibrosis.',
    'alp': 'Alkaline phosphatase. Liver and bone enzyme. Elevated in liver disease or bone disorders.',
    'alp_ifcc': 'Alkaline phosphatase (IFCC method). Liver and bone enzyme. Abnormal levels may indicate bile duct obstruction, liver disease, or bone disorders.',
    'bilirubin_total': 'Total bilirubin. Breakdown product of red blood cells. High levels cause jaundice and indicate liver dysfunction.',
    'bilirubin_direct': 'Direct bilirubin (conjugated bilirubin). Bilirubin that has been processed by the liver. Elevated levels suggest bile duct obstruction, liver metastases, or impaired hepatic excretion.',
    'bilirubin_indirect': 'Indirect bilirubin (unconjugated bilirubin). Bilirubin prior to liver conjugation. Elevation may indicate hemolysis, ineffective erythropoiesis, or impaired hepatic uptake.',
    'albumin': 'Main protein in blood. Low levels indicate malnutrition, liver disease, or kidney disease.',
    'ggt': 'Gamma-glutamyl transferase. Liver enzyme. Elevated levels indicate liver disease, bile duct obstruction, or alcohol use.',
    'ldh': 'Lactate dehydrogenase. Enzyme found in many tissues. Elevated in tissue damage, hemolysis, or cancer.',
    // Thyroid Function
    'tsh': 'Thyroid-stimulating hormone. Regulates thyroid function. High levels indicate hypothyroidism, low levels indicate hyperthyroidism.',
    't3': 'Triiodothyronine. Active thyroid hormone. Regulates metabolism.',
    't4': 'Thyroxine. Thyroid hormone. Regulates metabolism and energy.',
    'ft3': 'Free triiodothyronine. Unbound active thyroid hormone. More accurate than total T3 for assessing thyroid function.',
    'ft4': 'Free thyroxine. Unbound thyroid hormone. More accurate than total T4 for assessing thyroid function.',
    'thyroglobulin': 'Protein produced by thyroid gland. Used as tumor marker for thyroid cancer monitoring after treatment.',
    // Cardiac Markers
    'troponin': 'Heart muscle protein. Elevated levels indicate heart damage from heart attack or other cardiac events.',
    'bnp': 'B-type natriuretic peptide. Marker for heart failure. Elevated levels indicate heart stress.',
    'ntprobnp': 'N-terminal pro-B-type natriuretic peptide. More stable marker for heart failure than BNP. Used for diagnosis and monitoring.',
    'ckmb': 'Creatine kinase-MB. Heart muscle enzyme. Elevated levels indicate heart muscle damage from heart attack.',
    'myoglobin': 'Protein found in heart and skeletal muscle. Rapidly elevated after heart attack or muscle injury.',
    // Inflammation
    'crp': 'C-reactive protein. Measures inflammation in the body. Elevated in infection, inflammation, or autoimmune conditions.',
    'esr': 'Erythrocyte sedimentation rate. Non-specific marker of inflammation. Elevated in many conditions including infection and autoimmune disease.',
    'ferritin': 'Iron storage protein. Low levels indicate iron deficiency. High levels may indicate iron overload or inflammation.',
    // Coagulation
    'pt': 'Prothrombin time. Measures blood clotting function. Important for monitoring anticoagulant medications.',
    'inr': 'International normalized ratio. Standardized measure of blood clotting. Used to monitor warfarin therapy.',
    'aptt': 'Activated partial thromboplastin time. Measures intrinsic clotting pathway. Used to monitor heparin therapy.',
    'ddimer': 'D-dimer. Fragment from blood clots. Elevated in deep vein thrombosis, pulmonary embolism, and DIC.',
    'fdp': 'Fibrin degradation products. Fragments from blood clot breakdown. Elevated in conditions involving blood clotting such as DIC, deep vein thrombosis, or pulmonary embolism.',
    'fibrinogen': 'Blood clotting protein. Elevated in inflammation or infection. Low levels increase bleeding risk.',
    'antithrombin_iii': 'Antithrombin III. A natural anticoagulant protein that inhibits clot formation. Reduced levels increase thrombosis risk and are common in cancer and during chemotherapy.',
    'protein_c': 'Protein C. A vitamin K-dependent anticoagulant protein. Deficiency contributes to hypercoagulable states frequently seen in malignancy.',
    'protein_s': 'Protein S. A cofactor for Protein C that enhances anticoagulant activity. Low levels increase the risk of venous thromboembolism in cancer patients.',
    // Electrolytes
    'sodium': 'Essential electrolyte. Regulates fluid balance and nerve function. Imbalances can cause confusion or seizures.',
    'potassium': 'Essential electrolyte. Important for heart and muscle function. Dangerous if too high or too low.',
    'calcium': 'Mineral essential for bones, muscles, and nerve function. Regulated by parathyroid hormone and vitamin D.',
    'calcium_ionized': 'Ionized calcium (Ca²⁺). The biologically active form of calcium in the blood. Abnormal levels are common in bone metastases, multiple myeloma, and paraneoplastic syndromes.',
    'phosphate': 'Phosphate. An essential electrolyte involved in cellular energy and bone metabolism. Abnormalities are common in tumor lysis syndrome and advanced malignancy.',
    'magnesium': 'Essential mineral for muscle and nerve function. Low levels can cause muscle cramps and irregular heartbeat.',
    'chloride': 'Essential electrolyte. Works with sodium to maintain fluid balance and acid-base balance in the body.',
    'bicarbonate': 'Buffer that maintains blood pH. Low levels indicate acidosis. High levels indicate alkalosis.',
    'co2': 'Carbon dioxide. Reflects acid-base balance and respiratory function. Used to assess metabolic and respiratory status.',
    'phosphorus': 'Essential mineral for bone health, energy production, and cell function. Imbalances can affect multiple body systems.',
    // Other
    'glucose': 'Blood sugar. High levels indicate diabetes or prediabetes. Low levels (hypoglycemia) can be dangerous.',
    'hba1c': 'Hemoglobin A1c. Average blood sugar over 2-3 months. Used to diagnose and monitor diabetes.',
    'iga': 'Immunoglobulin A. Antibody found in mucous membranes and blood. Important for immune defense in respiratory and digestive tracts. Abnormal levels may indicate immune disorders.',
    'igg': 'Immunoglobulin G. Most abundant antibody in blood. Provides long-term immunity against infections. Elevated in chronic infections or autoimmune conditions. Low levels increase infection risk.',
    'igm': 'Immunoglobulin M. First antibody produced in response to infection. Elevated in acute infections. Low levels may indicate immune deficiency.',
    'vitamin_d': 'Essential vitamin for bone health and immune function. Low levels are common and may require supplementation.',
    'beta2_microglobulin': 'Beta-2 Microglobulin. A protein associated with tumor burden and prognosis in lymphomas and multiple myeloma.',
    'procalcitonin': 'Procalcitonin. A biomarker of bacterial infection that helps distinguish infection from inflammation or immune-related adverse events in cancer patients.',
    'il6': 'IL-6 (Interleukin-6). An inflammatory cytokine often elevated in cancer, infection, and cytokine release syndromes, useful for monitoring immune-related toxicity.'
  };

  // Categorize labs by organ function and type
  const categorizeLabs = (labs) => {
    // Predefined lab types by category (including common abbreviations and variations)
    const diseaseMarkers = ['ca125', 'cea', 'afp', 'psa', 'he4', 'ca199', 'ca153', 'ca724', 'ca242', 'ca50', 'inhibinb', 'romaindex', 'ca-125', 'ca 19-9', 'ca 15-3'];
    const liverFunction = ['alt', 'ast', 'bilirubin', 'albumin', 'alkalinephosphatase', 'alp', 'ggt', 'ldh', 'pt', 'inr', 'aptt', 'alb', 'ast/alt', 'alp ifcc', 'pt活性値', 'pt activity', 'pt activity value'];
    const kidneyFunction = ['creatinine', 'egfr', 'bun', 'urea', 'urineprotein', 'urinecreatinine', 'cre'];
    const bloodCounts = ['wbc', 'rbc', 'hemoglobin', 'hematocrit', 'platelets', 'anc', 'lymphocytes', 'neutrophils', 'monocytes', 'eosinophils', 'basophils', 'mcv', 'mch', 'mchc', 'rdw', 'rdw-cv', 'hgb', 'hct', 'plt', 'ba#', 'ba%', 'eo#', 'eo%', 'lymph#', 'lymph%', 'mono#', 'mono%', 'neutro#', 'neutro%'];
    const thyroidFunction = ['tsh', 't3', 't4', 'ft3', 'ft4', 'thyroglobulin', 'free t3', 'free t4'];
    const cardiacMarkers = ['troponin', 'bnp', 'ntprobnp', 'ckmb', 'myoglobin', 'nt-probnp', 'ck-mb'];
    const inflammation = ['crp', 'esr', 'ferritin', 'fibrinogen', 'フェリチン', 'fbg', 'ferritin (japanese)'];
    const electrolytes = ['sodium', 'potassium', 'chloride', 'bicarbonate', 'co2', 'magnesium', 'phosphorus', 'calcium', 'na', 'k', 'ci', 'ca', 'mg', 'p', 'phos'];
    const coagulation = ['pt', 'inr', 'aptt', 'dimer', 'ddimer', 'fibrinogen', 'd-dimer', 'fbg'];
    const tumorMarkers = ['ca125', 'cea', 'afp', 'psa', 'ca199', 'ca153', 'ca724', 'ca242', 'ca50', 'he4', 'inhibinb', 'romaindex', 'ca2729', 'ca549', 'ca195'];

    const categories = {
      'Disease-Specific Markers': [],
      'Liver Function': [],
      'Kidney Function': [],
      'Blood Counts': [],
      'Thyroid Function': [],
      'Cardiac Markers': [],
      'Inflammation': [],
      'Electrolytes': [],
      'Coagulation': [],
      'Custom Values': [],
      'Others': []
    };

    // Known lab types (for detecting custom values)
    const allKnownTypes = [
      ...diseaseMarkers, ...liverFunction, ...kidneyFunction, ...bloodCounts,
      ...thyroidFunction, ...cardiacMarkers, ...inflammation, ...electrolytes, ...coagulation
    ];

    // Track categorized labs to prevent duplicates
    const categorizedKeys = new Set();

    // Category mapping: canonical key -> category name
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

    // Map canonical keys to categories
    const canonicalKeyToCategory = {
      // Disease-Specific Markers
      'ca125': 'disease_specific_markers', 'ca199': 'disease_specific_markers', 'ca153': 'disease_specific_markers',
      'ca724': 'disease_specific_markers', 'ca242': 'disease_specific_markers', 'ca50': 'disease_specific_markers',
      'ca2729': 'disease_specific_markers', 'cea': 'disease_specific_markers', 'afp': 'disease_specific_markers',
      'psa': 'disease_specific_markers', 'he4': 'disease_specific_markers', 'inhibinb': 'disease_specific_markers',
      'romaindex': 'disease_specific_markers', 'scc_antigen': 'disease_specific_markers',
      'cyfra211': 'disease_specific_markers', 'nse': 'disease_specific_markers', 'betahcg': 'disease_specific_markers',
      
      // Liver Function
      'alt': 'liver_function', 'ast': 'liver_function', 'ast_alt_ratio': 'liver_function',
      'alp': 'liver_function', 'alp_ifcc': 'liver_function', 'bilirubin_total': 'liver_function',
      'bilirubin_direct': 'liver_function', 'bilirubin_indirect': 'liver_function',
      'albumin': 'liver_function', 'ggt': 'liver_function', 'ldh': 'liver_function',
      
      // Kidney Function
      'creatinine': 'kidney_function', 'egfr': 'kidney_function', 'bun': 'kidney_function',
      'urea': 'kidney_function', 'urineprotein': 'kidney_function', 'urinecreatinine': 'kidney_function',
      
      // Blood Counts
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
      
      // Thyroid Function
      'tsh': 'thyroid_function', 't3': 'thyroid_function', 't4': 'thyroid_function',
      'ft3': 'thyroid_function', 'ft4': 'thyroid_function', 'thyroglobulin': 'thyroid_function',
      
      // Cardiac Markers
      'troponin': 'cardiac_markers', 'bnp': 'cardiac_markers', 'ntprobnp': 'cardiac_markers',
      'ckmb': 'cardiac_markers', 'myoglobin': 'cardiac_markers',
      
      // Inflammation
      'crp': 'inflammation', 'esr': 'inflammation', 'ferritin': 'inflammation',
      'il6': 'inflammation',
      
      // Electrolytes
      'sodium': 'electrolytes', 'potassium': 'electrolytes', 'chloride': 'electrolytes',
      'bicarbonate': 'electrolytes', 'co2': 'electrolytes', 'magnesium': 'electrolytes',
      'phosphorus': 'electrolytes', 'calcium': 'electrolytes', 'calcium_ionized': 'electrolytes',
      'phosphate': 'electrolytes',
      
      // Coagulation (precedence: coagulation wins over liver_function for PT, INR, APTT, etc.)
      'pt': 'coagulation', 'inr': 'coagulation', 'aptt': 'coagulation',
      'ddimer': 'coagulation', 'fdp': 'coagulation', 'fibrinogen': 'coagulation',
      'antithrombin_iii': 'coagulation', 'protein_c': 'coagulation', 'protein_s': 'coagulation',
      
      // Other
      'glucose': 'other', 'hba1c': 'other', 'iga': 'other', 'igg': 'other', 'igm': 'other', 'vitamin_d': 'other',
      'beta2_microglobulin': 'other', 'procalcitonin': 'other'
    };

    Object.entries(labs).forEach(([key, lab]) => {
      // Skip if already categorized
      if (categorizedKeys.has(key)) return;

      // Normalize lab name to canonical key
      const canonicalKey = normalizeLabName(lab.name || key);
      
      // Determine category
      let category = 'other';
      if (canonicalKey && canonicalKeyToCategory[canonicalKey]) {
        category = canonicalKeyToCategory[canonicalKey];
      } else {
        // Fallback: try to match by name/key patterns
        const labKey = key.toLowerCase();
        const labName = (lab.name || '').toLowerCase();
        
        if (diseaseMarkers.some(m => labKey.includes(m) || labName.includes(m)) ||
            tumorMarkers.some(m => labKey.includes(m) || labName.includes(m))) {
          category = 'disease_specific_markers';
        } else if (coagulation.some(m => labKey.includes(m) || labName.includes(m))) {
          // Coagulation has precedence
          category = 'coagulation';
        } else if (liverFunction.some(m => labKey.includes(m) || labName.includes(m))) {
          category = 'liver_function';
        } else if (kidneyFunction.some(m => labKey.includes(m) || labName.includes(m))) {
          category = 'kidney_function';
        } else if (bloodCounts.some(m => labKey.includes(m) || labName.includes(m))) {
          category = 'blood_counts';
        } else if (thyroidFunction.some(m => labKey.includes(m) || labName.includes(m))) {
          category = 'thyroid_function';
        } else if (cardiacMarkers.some(m => labKey.includes(m) || labName.includes(m))) {
          category = 'cardiac_markers';
        } else if (inflammation.some(m => labKey.includes(m) || labName.includes(m))) {
          category = 'inflammation';
        } else if (electrolytes.some(m => labKey.includes(m) || labName.includes(m))) {
          category = 'electrolytes';
        }
      }

      // Map to UI category name
      const uiCategory = categoryMap[category] || 'Others';
      
      // Note: "Custom Values" should only contain manually added labs (via Add Lab modal)
      // Document-extracted labs that don't fit categories go to "Others"
      categories[uiCategory].push([key, lab]);
      categorizedKeys.add(key);
    });

    // Remove duplicates within each category (same lab name)
    Object.keys(categories).forEach(category => {
      const seen = new Map();
      categories[category] = categories[category].filter(([key, lab]) => {
        const labNameKey = (lab.name || key).toLowerCase();
        if (seen.has(labNameKey)) {
          return false; // Duplicate
        }
        seen.set(labNameKey, true);
        return true;
      });
    });

    // Sort labs within each category by relevance score, then alphabetically
    Object.keys(categories).forEach(category => {
      categories[category].sort(([keyA, labA], [keyB, labB]) => {
        const scoreA = labA.relevanceScore || 0;
        const scoreB = labB.relevanceScore || 0;
        if (scoreB !== scoreA) return scoreB - scoreA;
        return labA.name.localeCompare(labB.name);
      });
    });

    return categories;
  };

  // Transform Firestore vitals data to UI format
  const transformVitalsData = (vitals) => {
    const grouped = {};

    vitals.forEach(vital => {
      const vitalType = vital.vitalType || 'unknown';
      
      // Normalize vital type to canonical key
      const canonicalKey = normalizeVitalName(vitalType) || normalizeVitalName(vital.label) || vitalType;
      const displayName = getVitalDisplayName(canonicalKey);

      if (!grouped[canonicalKey]) {
        grouped[canonicalKey] = {
          name: displayName,
          unit: vital.unit,
          current: vital.currentValue,
          status: 'normal',
          trend: 'stable',
          normalRange: vital.normalRange,
          data: []
        };
      }

      grouped[canonicalKey].current = vital.currentValue;
      grouped[canonicalKey].data.push({
        id: vital.id, // Store vital document ID for deletion
        date: new Date(vital.createdAt?.toDate ? vital.createdAt.toDate() : vital.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: vital.currentValue
      });
    });

    return grouped;
  };

  // Function to reload health data (call after adding new values)
  const reloadHealthData = async () => {
    if (user) {
      try {
        const labs = await labService.getLabs(user.uid);
        const transformedLabs = transformLabsData(labs);
        setLabsData(transformedLabs);
        setHasRealLabData(labs.length > 0);

        const vitals = await vitalService.getVitals(user.uid);
        const transformedVitals = transformVitalsData(vitals);
        setVitalsData(transformedVitals);
        setHasRealVitalData(vitals.length > 0);

        // Reload genomic profile
        const genomic = await genomicProfileService.getGenomicProfile(user.uid);
        if (genomic) {
          setGenomicProfile(genomic);
        } else {
          setGenomicProfile(null);
        }
      } catch (error) {
        console.error('Error reloading health data:', error);
      }
    }
  };

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


  // Load saved trials when dashboard is active
  useEffect(() => {
    const loadSavedTrials = async () => {
      if (activeTab === 'dashboard' && user?.uid) {
        setLoadingSavedTrials(true);
        try {
          const trials = await getSavedTrials(user.uid);
          // Sort by match percentage (highest first) and limit to top 5
          const sortedTrials = trials
            .filter(trial => trial.matchResult?.matchPercentage)
            .sort((a, b) => (b.matchResult?.matchPercentage || 0) - (a.matchResult?.matchPercentage || 0))
            .slice(0, 5);
          setSavedTrials(sortedTrials);
        } catch (error) {
          console.error('Error loading saved trials:', error);
          setSavedTrials([]);
        } finally {
          setLoadingSavedTrials(false);
        }
      }
    };
    loadSavedTrials();
  }, [activeTab, user]);

  // Load chat history when chat tab is opened (only once per session)
  useEffect(() => {
    const loadChatHistory = async () => {
      if (activeTab === 'chat' && user && !chatHistoryLoaded) {
        try {
          const savedMessages = await messageService.getMessages(user.uid, 100);
          if (savedMessages.length > 0) {
            setMessages(savedMessages.map(msg => ({
              type: msg.type,
              text: msg.text,
              isAnalysis: msg.isAnalysis || false
            })));
          }
          setChatHistoryLoaded(true);
        } catch (error) {
          console.error('Error loading chat history:', error);
          setChatHistoryLoaded(true); // Mark as loaded even on error to prevent retry loops
        }
      }
    };
    loadChatHistory();
  }, [activeTab, user, chatHistoryLoaded]);

  // Auto-scroll when messages change
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [messages.length]);

  // Cleanup old messages (older than 90 days) - run once per day
  useEffect(() => {
    if (!user) return;

    const cleanupOldMessages = async () => {
      try {
        const allMessages = await messageService.getMessages(user.uid, 1000);
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        
        const oldMessages = allMessages.filter(msg => {
          const msgDate = msg.createdAt?.toDate ? msg.createdAt.toDate() : new Date(msg.createdAt);
          return msgDate < ninetyDaysAgo;
        });

        // Delete old messages (limit to 50 at a time to avoid rate limits)
        for (const msg of oldMessages.slice(0, 50)) {
          try {
            await messageService.deleteMessage(msg.id);
          } catch (err) {
            console.error('Error deleting old message:', err);
          }
        }
      } catch (error) {
        console.error('Error cleaning up old messages:', error);
      }
    };

    // Run cleanup once per day (check localStorage for last cleanup time)
    const lastCleanup = localStorage.getItem(`chatCleanup_${user.uid}`);
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    if (!lastCleanup || (now - parseInt(lastCleanup)) > oneDay) {
      cleanupOldMessages();
      localStorage.setItem(`chatCleanup_${user.uid}`, now.toString());
    }
  }, [user]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || !user) return;

    const userMessage = inputText;
    setInputText('');

    // Add user message immediately
    const userMsg = { type: 'user', text: userMessage };
    setMessages(prev => [...prev, userMsg]);
    
    // Auto-scroll to bottom after user message
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);

    // Save user message to Firestore (async, don't wait)
    if (user) {
      messageService.addMessage({
        patientId: user.uid,
        type: 'user',
        text: userMessage,
        isAnalysis: false
      }).catch(err => console.error('Error saving user message:', err));
    }

    try {
      // Process message with AI to extract and save medical data
      const result = await processChatMessage(
        userMessage,
        user.uid,
        messages.slice(-10).map(msg => ({
          role: msg.type === 'user' ? 'user' : 'assistant',
          content: msg.text
        })),
        currentTrialContext, // Pass trial context if available
        currentHealthContext, // Pass health context if available
        patientProfile // Pass patient profile for demographic-based normal ranges
      );

      // Build response text
      let responseText = result.response;

      // Add extraction summary if data was extracted
      if (result.extractedData) {
        const summary = generateChatExtractionSummary(result.extractedData);
        if (summary) {
          responseText += summary;
        }
      }

      // Add AI response
      const aiMsg = {
        type: 'ai',
        text: responseText,
        isAnalysis: !!result.extractedData
      };
      setMessages(prev => [...prev, aiMsg]);
      
      // Auto-scroll to bottom after AI response
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

      // Save AI message to Firestore (async, don't wait)
      if (user) {
        messageService.addMessage({
          patientId: user.uid,
          type: 'ai',
          text: responseText,
          isAnalysis: !!result.extractedData,
          extractedData: result.extractedData || null
        }).catch(err => console.error('Error saving AI message:', err));
      }

      // Reload health data if values were extracted
      if (result.extractedData) {
        await reloadHealthData();
      }

    } catch (error) {
      console.error('Error processing message:', error);
      const errorMsg = {
        type: 'ai',
        text: 'Sorry, I\'m having trouble processing your message right now. Please try again in a moment.'
      };
      setMessages(prev => [...prev, errorMsg]);
      
      // Auto-scroll to bottom after error message
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
      
      // Save error message to Firestore (async, don't wait)
      if (user) {
        messageService.addMessage({
          patientId: user.uid,
          type: 'ai',
          text: errorMsg.text,
          isAnalysis: false
        }).catch(err => console.error('Error saving error message:', err));
      }
    }
  };

  const handleRealFileUpload = async (file, docType) => {
    console.log('handleRealFileUpload called', file?.name, docType);
    if (!user) {
      alert('Please log in to upload files');
      return;
    }

    try {
      // Ensure we're on the chat tab before starting
      setActiveTab('chat');

      // Show loading overlay
      setIsUploading(true);
      setUploadProgress('Reading document...');

      // Get document date (user-provided or null)
      const providedDate = pendingDocumentDate;
      // Clear pending date after use
      setPendingDocumentDate(null);

      // Show processing message
      setMessages([...messages,
      { type: 'user', text: `Uploading: ${file.name}`, isUpload: true },
      { type: 'ai', text: `Processing document... This may take a moment.`, isAnalysis: true }
      ]);

      // Step 1: Process document with AI to extract medical data
      setUploadProgress('Analyzing document with AI...');
      const processingResult = await processDocument(file, user.uid, patientProfile, providedDate);
      console.log('Document processing result:', processingResult);

      // Step 2: Upload file to Firebase Storage
      setUploadProgress('Uploading to secure storage...');
      const uploadResult = await uploadDocument(file, user.uid, {
        category: processingResult.documentType || docType,
        documentType: processingResult.documentType || docType
      });

      console.log('File uploaded successfully:', uploadResult);

      setUploadProgress('Saving extracted data...');

      // Step 3: Add to local documents state
      // Use user-provided date or today
      const docDate = providedDate || new Date().toISOString().split('T')[0];
      const newDoc = {
        id: uploadResult.id,
        name: file.name,
        type: processingResult.documentType || docType,
        date: docDate,
        fileUrl: uploadResult.fileUrl,
        storagePath: uploadResult.storagePath,
        icon: (processingResult.documentType || docType).toLowerCase()
      };

      setDocuments([newDoc, ...documents]);

      // Step 4: Generate summary of extracted data
      const summary = generateExtractionSummary(
        processingResult.extractedData,
        processingResult.extractedData
      );

      // Update messages with extraction results
      setMessages(prev => [
        ...prev.slice(0, -1), // Remove "Processing..." message
        {
          type: 'ai',
          text: `Document processed successfully!\n\nDocument Type: ${processingResult.documentType}\n\n${summary}\n\nAll data has been automatically saved to your health records.`,
          isAnalysis: true
        }
      ]);

      // Reload health data to show new values
      setUploadProgress('Refreshing your health data...');
      await reloadHealthData();

      setActiveTab('chat');
      setIsUploading(false);
      setUploadProgress('');
    } catch (error) {
      console.error('Upload error:', error);

      // Update messages with error
      setMessages(prev => [
        ...prev.slice(0, -1), // Remove "Processing..." message
        {
          type: 'ai',
          text: `Failed to process document: ${error.message}\n\nThe file was not uploaded. Please try again or contact support if the issue persists.`
        }
      ]);

      setIsUploading(false);
      setUploadProgress('');
    }
  };

  const simulateDocumentUpload = (docType) => {
    console.log('simulateDocumentUpload called, docType=', docType);
    // Create a file input element
    const input = document.createElement('input');
    input.type = 'file';
    // Accept common document and genomic data file types (vcf, maf, bed, txt, csv, tsv, compressed)
    input.accept = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.vcf,.vcf.gz,.maf,.bed,.txt,.csv,.tsv,.zip,.gz,.xlsx,.xls';

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        console.log('simulateDocumentUpload - file selected:', file.name, 'docType=', docType);
        await handleRealFileUpload(file, docType);
      }
    };

    console.log('simulateDocumentUpload invoking file picker');
    input.click();
  };

  const simulateCameraUpload = (docType) => {
    console.log('simulateCameraUpload called, docType=', docType);
    const input = document.createElement('input');
    input.type = 'file';
    // Accept common document types and images
    input.accept = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.vcf,.vcf.gz,.maf,.bed,.txt,.csv,.tsv,.zip,.gz,.xlsx,.xls,image/*';
    // Hint mobile devices to open camera (this enables camera option in file picker)
    input.capture = 'environment';

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        console.log('simulateCameraUpload - file selected:', file.name, 'docType=', docType);
        await handleRealFileUpload(file, docType);
      }
    };

    input.click();
  };

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
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (error) {
      console.error('Sign out error:', error);
      alert('Failed to sign out: ' + error.message);
    }
  };

  // Show loading screen while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-medical-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <Activity className="w-12 h-12 text-medical-primary-600 animate-pulse mx-auto mb-4" />
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
      <style>{styles}</style>

      {/* Header - Responsive */}
      <div className="bg-white border-b border-medical-neutral-200 shadow-sm px-4 sm:px-6 py-3 sm:py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-medical-primary-100 rounded-full flex items-center justify-center shadow-sm">
              <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-medical-primary-600" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-medical-neutral-900">CancerCare</h1>
              {(patientProfile.diagnosis || patientProfile.stage) && (
                <p className="text-xs sm:text-sm text-medical-neutral-600">
                  {patientProfile.diagnosis}
                  {patientProfile.diagnosis && patientProfile.stage && ' • '}
                  {patientProfile.stage}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => setActiveTab('profile')}
            className="p-2 hover:bg-medical-neutral-100 rounded-lg transition-colors duration-200"
          >
            <User className="w-5 h-5 sm:w-6 sm:h-6 text-medical-neutral-600" />
          </button>
        </div>
      </div>

      {/* Main Content - Scrollable */}
      <div className="flex-1 overflow-y-auto pb-20">
        {activeTab === 'dashboard' && (
          <>
            {/* Quick Action Buttons */}
            <div className="bg-white border-b border-medical-neutral-200 px-4 sm:px-6 py-4 sm:py-5">
              <div className="max-w-6xl mx-auto">
                <h2 className="text-base sm:text-lg font-semibold text-medical-neutral-900 mb-3 sm:mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-medical-primary-600" />
                  Quick Actions
                </h2>
                <div className="flex flex-row items-stretch justify-between gap-2 sm:gap-4">
                  <button
                    onClick={() => {
                      setShowAddSymptomModal(true);
                    }}
                    className="group relative flex flex-row items-center justify-center gap-2 sm:gap-3 px-3 sm:px-5 py-3 sm:py-3.5 flex-1 bg-gradient-to-br from-medical-primary-50 to-medical-primary-100/50 hover:from-medical-primary-100 hover:to-medical-primary-200/50 border border-medical-primary-200/60 hover:border-medical-primary-300 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    <div className="w-8 h-8 sm:w-9 sm:h-9 bg-medical-primary-500 group-hover:bg-medical-primary-600 rounded-lg flex items-center justify-center transition-colors duration-200 shadow-sm flex-shrink-0">
                      <Activity className="w-4 h-4 sm:w-4 sm:h-4 text-white" />
                    </div>
                    <div className="flex flex-col items-start min-w-0">
                      <span className="text-xs sm:text-sm font-semibold text-medical-primary-800 group-hover:text-medical-primary-900 whitespace-nowrap">Log Symptom</span>
                      <span className="text-xs text-medical-primary-600/80 hidden sm:block">Track how you're feeling</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('health');
                      setHealthSection('labs');
                      // Small delay to ensure tab is switched, then trigger add lab
                      setTimeout(() => {
                        setShowAddLab(true);
                      }, 300);
                    }}
                    className="group relative flex flex-row items-center justify-center gap-2 sm:gap-3 px-3 sm:px-5 py-3 sm:py-3.5 flex-1 bg-gradient-to-br from-medical-accent-50 to-medical-accent-100/50 hover:from-medical-accent-100 hover:to-medical-accent-200/50 border border-medical-accent-200/60 hover:border-medical-accent-300 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    <div className="w-8 h-8 sm:w-9 sm:h-9 bg-medical-accent-500 group-hover:bg-medical-accent-600 rounded-lg flex items-center justify-center transition-colors duration-200 shadow-sm flex-shrink-0">
                      <TrendingUp className="w-4 h-4 sm:w-4 sm:h-4 text-white" />
                    </div>
                    <div className="flex flex-col items-start min-w-0">
                      <span className="text-xs sm:text-sm font-semibold text-medical-accent-800 group-hover:text-medical-accent-900 whitespace-nowrap">Add Lab Value</span>
                      <span className="text-xs text-medical-accent-600/80 hidden sm:block">Record test results</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      openDocumentOnboarding('general');
                    }}
                    className="group relative flex flex-row items-center justify-center gap-2 sm:gap-3 px-3 sm:px-5 py-3 sm:py-3.5 flex-1 bg-gradient-to-br from-medical-secondary-50 to-medical-secondary-100/50 hover:from-medical-secondary-100 hover:to-medical-secondary-200/50 border border-medical-secondary-200/60 hover:border-medical-secondary-300 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    <div className="w-8 h-8 sm:w-9 sm:h-9 bg-medical-secondary-500 group-hover:bg-medical-secondary-600 rounded-lg flex items-center justify-center transition-colors duration-200 shadow-sm flex-shrink-0">
                      <Upload className="w-4 h-4 sm:w-4 sm:h-4 text-white" />
                    </div>
                    <div className="flex flex-col items-start min-w-0">
                      <span className="text-xs sm:text-sm font-semibold text-medical-secondary-800 group-hover:text-medical-secondary-900 whitespace-nowrap">Smart Scan</span>
                      <span className="text-xs text-medical-secondary-600/80 hidden sm:block">Upload & extract data</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {(() => {
          // Calculate CA-125 trend dynamically
          const ca125Data = labsData.ca125;
          let ca125Alert = null;

          if (ca125Data && ca125Data.data && ca125Data.data.length >= 2) {
            const dataPoints = ca125Data.data
              .map(d => ({
                date: d.timestamp ? new Date(d.timestamp) : (typeof d.date === 'string' ? parseDateString(d.date) : new Date(d.date)),
                value: typeof d.value === 'number' ? d.value : parseFloat(d.value)
              }))
              .filter(d => !isNaN(d.value) && d.date instanceof Date && !isNaN(d.date.getTime()))
              .sort((a, b) => a.date - b.date);
            
            // Helper function to parse date strings like "Oct 15"
            function parseDateString(dateStr) {
              if (!dateStr || typeof dateStr !== 'string') return new Date();
              // Try to parse "Oct 15" format - assume current year
              const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
              const parts = dateStr.trim().split(' ');
              if (parts.length === 2) {
                const monthIndex = months.indexOf(parts[0]);
                const day = parseInt(parts[1]);
                if (monthIndex !== -1 && !isNaN(day)) {
                  const year = new Date().getFullYear();
                  return new Date(year, monthIndex, day);
                }
              }
              return new Date(dateStr);
            }

            if (dataPoints.length >= 2) {
              const latest = dataPoints[dataPoints.length - 1];
              const previous = dataPoints[dataPoints.length - 2];
              const change = latest.value - previous.value;
              const percentChange = ((change / previous.value) * 100).toFixed(1);
              const daysDiff = Math.round((latest.date - previous.date) / (1000 * 60 * 60 * 24));

              // Show alert if significant increase (>10%) or decrease (>15%)
              if (change > 0 && percentChange > 10) {
                ca125Alert = {
                  type: 'up',
                  message: `Rose from ${previous.value} → ${latest.value}${ca125Data.unit ? ` ${ca125Data.unit}` : ''} in ${daysDiff} day${daysDiff !== 1 ? 's' : ''} (${percentChange}% increase). Consider discussing with oncologist.`
                };
              } else if (change < 0 && Math.abs(percentChange) > 15) {
                ca125Alert = {
                  type: 'down',
                  message: `Decreased from ${previous.value} → ${latest.value}${ca125Data.unit ? ` ${ca125Data.unit}` : ''} in ${daysDiff} day${daysDiff !== 1 ? 's' : ''} (${Math.abs(percentChange)}% decrease).`
                };
              }
            }
          }

          return (
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              {/* Dynamic CA-125 Alert */}
              {ca125Alert && (
                <div className={`bg-white rounded-lg sm:rounded-xl border-2 p-4 sm:p-5 shadow-sm ${
                  ca125Alert.type === 'up' 
                    ? 'border-amber-300 bg-amber-50' 
                    : 'border-medical-accent-300 bg-medical-accent-50'
                }`}>
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                      ca125Alert.type === 'up' 
                        ? 'bg-amber-100' 
                        : 'bg-medical-accent-100'
                    }`}>
                      <AlertCircle className={`w-5 h-5 ${
                        ca125Alert.type === 'up' 
                          ? 'text-amber-600' 
                          : 'text-medical-accent-600'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <h3 className={`text-base font-semibold mb-1 ${
                        ca125Alert.type === 'up' 
                          ? 'text-amber-900' 
                          : 'text-medical-accent-900'
                      }`}>
                        CA-125 {ca125Alert.type === 'up' ? 'Trending Up' : 'Trending Down'}
                      </h3>
                      <p className={`text-sm ${
                        ca125Alert.type === 'up' 
                          ? 'text-amber-700' 
                          : 'text-medical-accent-700'
                      }`}>
                        {ca125Alert.message}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Most Important Labs & Vitals - Single Row */}
            {hasRealLabData || hasRealVitalData ? (() => {
              // Get most important labs (prioritize by relevance score, then by critical list)
              const importantLabKeys = Object.keys(labsData)
                .filter(key => {
                  const lab = labsData[key];
                  return lab && ((lab.data && lab.data.length > 0) || lab.current) && lab.relevanceScore >= 1;
                })
                .sort((a, b) => {
                  const labA = labsData[a];
                  const labB = labsData[b];
                  // Sort by relevance score (higher first), then by critical list order
                  if (labB.relevanceScore !== labA.relevanceScore) {
                    return labB.relevanceScore - labA.relevanceScore;
                  }
                  const criticalOrder = ['ca125', 'cea', 'wbc', 'hemoglobin', 'platelets', 'creatinine', 'alt', 'ast', 'albumin', 'ldh'];
                  const idxA = criticalOrder.indexOf(a.toLowerCase());
                  const idxB = criticalOrder.indexOf(b.toLowerCase());
                  if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                  if (idxA !== -1) return -1;
                  if (idxB !== -1) return 1;
                  return 0;
                })
                .slice(0, 5); // Top 5 labs

              // Get most important vitals (weight, blood pressure, temperature, heart rate)
              const importantVitalKeys = Object.keys(vitalsData)
                .filter(key => {
                  const vital = vitalsData[key];
                  return vital && ((vital.data && vital.data.length > 0) || vital.current);
                })
                .filter(key => ['weight', 'bp', 'bloodpressure', 'temperature', 'temp', 'heartrate', 'hr', 'pulse'].includes(key.toLowerCase()))
                .slice(0, 3); // Top 3 vitals

              const allImportantItems = [
                ...importantLabKeys.map(key => ({ type: 'lab', key, data: labsData[key] })),
                ...importantVitalKeys.map(key => ({ type: 'vital', key, data: vitalsData[key] }))
              ].slice(0, 5); // Max 5 items in the row

              // If no important items found, try to show any available data
              if (allImportantItems.length === 0) {
                // Fallback: show any labs or vitals with data
                const anyLabKeys = Object.keys(labsData)
                  .filter(key => {
                    const lab = labsData[key];
                    return lab && ((lab.data && lab.data.length > 0) || lab.current);
                  })
                  .slice(0, 3);
                
                const anyVitalKeys = Object.keys(vitalsData)
                  .filter(key => {
                    const vital = vitalsData[key];
                    return vital && ((vital.data && vital.data.length > 0) || vital.current);
                  })
                  .slice(0, 2);
                
                const fallbackItems = [
                  ...anyLabKeys.map(key => ({ type: 'lab', key, data: labsData[key] })),
                  ...anyVitalKeys.map(key => ({ type: 'vital', key, data: vitalsData[key] }))
                ].slice(0, 5);
                
                if (fallbackItems.length === 0) return null;
                
                // Use fallback items
                return (
                  <div className="bg-white rounded-lg sm:rounded-xl p-4 sm:p-5 border-2 border-medical-accent-200 shadow-sm">
                    <h3 className="text-base sm:text-lg font-semibold text-medical-neutral-900 mb-4 flex items-center gap-2">
                      <div className="bg-medical-accent-50 p-2 rounded-lg">
                        <Activity className="w-5 h-5 text-medical-accent-600" />
                      </div>
                      Key Metrics
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                      {fallbackItems.map((item) => {
                        const data = item.data;
                        let latestValue = (data.data && data.data.length > 0)
                          ? data.data[data.data.length - 1]?.value
                          : data.current;
                        const status = data.status || 'normal';
                        
                        // Get description using normalized system (for labs and vitals)
                        let description = '';
                        let displayName = data.name;
                        if (item.type === 'lab') {
                          const canonicalKey = normalizeLabName(data.name || item.key);
                          if (canonicalKey && labValueDescriptions[canonicalKey]) {
                            description = labValueDescriptions[canonicalKey];
                            displayName = getLabDisplayName(data.name || item.key);
                          }
                        } else if (item.type === 'vital') {
                          const canonicalKey = normalizeVitalName(data.name || item.key);
                          if (canonicalKey && vitalDescriptions[canonicalKey]) {
                            description = vitalDescriptions[canonicalKey];
                            displayName = getVitalDisplayName(data.name || item.key);
                          }
                        }
                        
                        return (
                          <div key={`${item.type}-${item.key}`} className="text-center p-4 bg-white rounded-lg border border-medical-neutral-200 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-center gap-1.5 mb-2">
                              <span className="text-xs font-medium text-medical-neutral-700">{displayName}</span>
                              <div className="flex items-center gap-1">
                                <Activity className={`w-3.5 h-3.5 ${status === 'warning' ? 'text-orange-500' : status === 'danger' ? 'text-red-500' : 'text-medical-accent-500'}`} />
                                {description && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setLabTooltip({
                                        labName: displayName,
                                        description: description
                                      });
                                    }}
                                    className="text-medical-primary-500 hover:text-medical-primary-700 transition-colors"
                                    title="Learn more about this value"
                                  >
                                    <Info className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                            <p className="text-lg sm:text-xl font-bold text-medical-neutral-900">{latestValue}{data.unit ? ` ${data.unit}` : ''}</p>
                            {status !== 'normal' && (
                              <p className={`text-xs mt-1 font-medium ${status === 'warning' ? 'text-orange-600' : 'text-red-600'}`}>
                                {status === 'warning' ? 'Above normal' : 'High'}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              return (
                <div className="bg-white rounded-lg sm:rounded-xl p-4 sm:p-5 border-2 border-medical-accent-200 shadow-sm">
                  <h3 className="text-base sm:text-lg font-semibold text-medical-neutral-900 mb-4 flex items-center gap-2">
                    <div className="bg-medical-accent-50 p-2 rounded-lg">
                      <Activity className="w-5 h-5 text-medical-accent-600" />
                    </div>
                    Key Metrics
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                    {allImportantItems.map((item) => {
                      const data = item.data;
                      // Get latest value - labs and vitals both have data array or current
                      let latestValue;
                      if (item.type === 'lab') {
                        latestValue = (data.data && data.data.length > 0)
                          ? data.data[data.data.length - 1]?.value
                          : data.current;
                      } else {
                        // Vitals structure
                        latestValue = (data.data && data.data.length > 0)
                          ? data.data[data.data.length - 1]?.value
                          : data.current;
                      }
                      const status = data.status || 'normal';
                      
                      // Get description using normalized system (for labs and vitals)
                      let description = '';
                      let displayName = data.name;
                      if (item.type === 'lab') {
                        const canonicalKey = normalizeLabName(data.name || item.key);
                        if (canonicalKey && labValueDescriptions[canonicalKey]) {
                          description = labValueDescriptions[canonicalKey];
                          displayName = getLabDisplayName(data.name || item.key);
                        }
                      } else if (item.type === 'vital') {
                        const canonicalKey = normalizeVitalName(data.name || item.key);
                        if (canonicalKey && vitalDescriptions[canonicalKey]) {
                          description = vitalDescriptions[canonicalKey];
                          displayName = getVitalDisplayName(data.name || item.key);
                        }
                      }
                      
                      return (
                        <div key={`${item.type}-${item.key}`} className="text-center p-4 bg-white rounded-lg border border-medical-neutral-200 shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex items-center justify-center gap-1.5 mb-2">
                            <span className="text-xs font-medium text-medical-neutral-700">{displayName}</span>
                            <div className="flex items-center gap-1">
                              <Activity className={`w-3.5 h-3.5 ${status === 'warning' ? 'text-orange-500' : status === 'danger' ? 'text-red-500' : 'text-medical-accent-500'}`} />
                              {description && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setLabTooltip({
                                      labName: displayName,
                                      description: description
                                    });
                                  }}
                                  className="text-medical-primary-500 hover:text-medical-primary-700 transition-colors"
                                  title="Learn more about this value"
                                >
                                  <Info className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                          <p className="text-lg sm:text-xl font-bold text-medical-neutral-900">{latestValue}{data.unit ? ` ${data.unit}` : ''}</p>
                          {status !== 'normal' && (
                            <p className={`text-xs mt-1 font-medium ${status === 'warning' ? 'text-orange-600' : 'text-red-600'}`}>
                              {status === 'warning' ? 'Above normal' : 'High'}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })() : (
              <div className="bg-medical-primary-50 rounded-lg sm:rounded-xl p-6 sm:p-8 text-center border-2 border-medical-primary-200 shadow-sm">
                <div className="w-16 h-16 bg-medical-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Activity className="w-8 h-8 text-medical-primary-600" />
                </div>
                <h3 className="text-lg font-semibold text-medical-neutral-900 mb-2">No health data tracked yet</h3>
                <p className="text-sm text-medical-neutral-600 mb-6">Start by uploading lab results or chatting with the AI assistant</p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={() => setActiveTab('chat')}
                    className="px-6 py-3 bg-medical-primary-500 text-white rounded-lg hover:bg-medical-primary-600 transition-all duration-200 text-sm font-semibold shadow-sm hover:shadow-md flex items-center justify-center gap-2"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Chat with AI
                  </button>
                  <button
                    onClick={() => {
                      if (!hasUploadedDocument) {
                        openDocumentOnboarding('labs');
                      } else {
                        setActiveTab('files');
                      }
                    }}
                    className="px-6 py-3 bg-medical-accent-500 text-white rounded-lg hover:bg-medical-accent-600 transition-all duration-200 text-sm font-semibold shadow-sm hover:shadow-md flex items-center justify-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    Upload Labs
                  </button>
                </div>
              </div>
            )}

          {/* Two Column Layout on larger screens */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* Genomic Profile Card */}
              <div className="w-full bg-white rounded-lg sm:rounded-xl p-4 sm:p-5 border-2 border-purple-200 shadow-sm lg:col-span-2">
                <h3 className="text-base sm:text-lg font-semibold text-medical-neutral-900 mb-4 flex items-center gap-2">
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-2 rounded-lg">
                    <Dna className="w-5 h-5 text-purple-600" />
                  </div>
                  Genomic Profile
                </h3>
                {genomicProfile && genomicProfile.mutations && genomicProfile.mutations.length > 0 ? (
                  <>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {genomicProfile.mutations.slice(0, 5).map((mutation, idx) => {
                        const { dna, protein, kind } = parseMutation(mutation);
                        return (
                          <span key={idx} className="px-3 py-1.5 bg-medical-secondary-100 text-medical-secondary-800 rounded-lg text-xs font-medium">
                            <span className="font-semibold mr-1">{mutation.gene}</span>
                            <span>{formatLabel(dna || protein || kind || mutation.type)}</span>
                          </span>
                        );
                      })}
                      {genomicProfile.tmb && (
                        <span className="px-3 py-1.5 bg-medical-primary-100 text-medical-primary-800 rounded-lg text-xs font-medium">
                          TMB: {genomicProfile.tmb}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => setActiveTab('profile')}
                      className="text-medical-secondary-600 text-sm font-medium hover:text-medical-secondary-700 transition-colors"
                    >
                      View Full Profile →
                    </button>
                  </>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-medical-neutral-600 text-sm mb-4">No genomic data yet</p>
                    <button
                      onClick={() => {
                        if (!hasUploadedDocument) {
                          openDocumentOnboarding('genomic');
                        } else {
                          setActiveTab('files');
                        }
                      }}
                      className="text-medical-primary-600 text-sm font-medium hover:text-medical-primary-700 transition-colors"
                    >
                      Upload Genomic Report →
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Saved Trials */}
            <div className="bg-white rounded-lg sm:rounded-xl p-4 sm:p-5 border-2 border-medical-primary-200 shadow-sm">
              <h3 className="text-base sm:text-lg font-semibold text-medical-neutral-900 mb-4 flex items-center gap-2">
                <div className="bg-medical-primary-50 p-2 rounded-lg">
                  <Bookmark className="w-5 h-5 text-medical-primary-600" />
                </div>
                Saved Trials
              </h3>
              {loadingSavedTrials ? (
                <div className="text-center py-8">
                  <p className="text-medical-neutral-600 text-sm">Loading saved trials...</p>
                </div>
              ) : savedTrials.length > 0 ? (
                <div className="space-y-3">
                  {savedTrials.map((trial) => (
                    <div
                      key={trial.id}
                      className="border border-medical-neutral-200 rounded-lg p-3 sm:p-4 hover:border-medical-primary-300 hover:shadow-sm transition-all cursor-pointer bg-medical-neutral-50/50"
                      onClick={() => setActiveTab('trials')}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-medical-neutral-900 text-sm sm:text-base mb-1.5 truncate">
                            {trial.title || trial.titleJa || 'Untitled Trial'}
                          </h4>
                          {trial.matchResult && (
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-medical-neutral-600 font-medium">
                                Match: {trial.matchResult.matchPercentage}%
                              </span>
                              {trial.isFavorite && (
                                <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                              )}
                            </div>
                          )}
                        </div>
                        <ChevronRight className="w-5 h-5 text-medical-neutral-400 ml-2 flex-shrink-0" />
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => setActiveTab('trials')}
                    className="w-full text-center text-medical-primary-600 text-sm font-medium hover:text-medical-primary-700 transition-colors mt-3"
                  >
                    View All Saved Trials →
                  </button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-medical-neutral-600 text-sm mb-4">No saved trials yet</p>
                  <button
                    onClick={() => setActiveTab('trials')}
                    className="text-medical-primary-600 text-sm font-medium hover:text-medical-primary-700 transition-colors"
                  >
                    Search Clinical Trials →
                  </button>
                </div>
              )}
            </div>
          </div>
          );
        })()}
          </>
        )}

        {activeTab === 'chat' && (
          <div className="flex flex-col h-full">
            <div 
              ref={messagesEndRef}
              className="flex-1 overflow-y-auto p-4 space-y-3"
            >
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex items-start gap-2 ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.type === 'ai' && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-medical-primary-500 to-medical-accent-500 flex items-center justify-center shadow-sm">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                  )}
                  <div className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 ${msg.type === 'user'
                    ? 'bg-medical-primary-500 text-white'
                    : msg.isAnalysis
                      ? 'bg-medical-secondary-50 border border-medical-secondary-200 text-medical-neutral-800'
                      : 'bg-white border border-medical-neutral-200 text-medical-neutral-900'
                    }`}>
                    {msg.type === 'user' ? (
                      <p className="text-sm sm:text-base whitespace-pre-wrap">{msg.text}</p>
                    ) : (
                      <div className="text-sm sm:text-base prose prose-sm max-w-none">
                        <ReactMarkdown
                          components={{
                            p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                            ul: ({node, ...props}) => <ul className="list-disc list-inside mb-2 space-y-1" {...props} />,
                            ol: ({node, ...props}) => <ol className="list-decimal list-inside mb-2 space-y-1" {...props} />,
                            li: ({node, ...props}) => <li className="ml-2" {...props} />,
                            strong: ({node, ...props}) => <strong className="font-semibold" {...props} />,
                            em: ({node, ...props}) => <em className="italic" {...props} />,
                            code: ({node, ...props}) => <code className="bg-medical-neutral-100 px-1.5 py-0.5 rounded text-xs font-mono" {...props} />,
                            h1: ({node, ...props}) => <h1 className="text-lg font-bold mb-2 mt-3 first:mt-0" {...props} />,
                            h2: ({node, ...props}) => <h2 className="text-base font-bold mb-2 mt-3 first:mt-0" {...props} />,
                            h3: ({node, ...props}) => <h3 className="text-sm font-bold mb-1 mt-2 first:mt-0" {...props} />,
                            blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-medical-neutral-300 pl-3 italic my-2" {...props} />,
                            a: ({node, ...props}) => <a className="text-medical-primary-600 underline hover:text-medical-primary-800" {...props} />,
                          }}
                        >
                          {msg.text}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                  {msg.type === 'user' && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full overflow-hidden shadow-sm">
                      {profileImage ? (
                        <img 
                          src={profileImage} 
                          alt="Profile" 
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-medical-primary-500 to-medical-secondary-500 flex items-center justify-center text-white text-xs font-bold">
                          {(() => {
                            const name = patientProfile.firstName || patientProfile.lastName 
                              ? `${patientProfile.firstName || ''} ${patientProfile.middleName ? patientProfile.middleName + ' ' : ''}${patientProfile.lastName || ''}`.trim()
                              : patientProfile.name || user?.displayName || 'U';
                            const parts = name.trim().split(/\s+/);
                            if (parts.length >= 2) {
                              return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
                            }
                            return name.substring(0, 2).toUpperCase();
                          })()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Trial Context Indicator */}
            {currentTrialContext && (
              <div className="p-3 bg-medical-primary-50 border-b border-medical-primary-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-medical-primary-600 text-sm font-medium">Discussing:</span>
                  <span className="text-medical-primary-800 text-sm">{currentTrialContext.title || 'Trial'}</span>
                </div>
                <button
                  onClick={() => {
                    setCurrentTrialContext(null);
                    setMessages(prev => [...prev, {
                      type: 'ai',
                      text: 'Trial context cleared. You can now ask general questions or ask about a different trial.'
                    }]);
                  }}
                  className="text-medical-primary-600 hover:text-medical-primary-800 text-sm underline"
                >
                  Clear
                </button>
              </div>
            )}

            {/* Health Context Indicator */}
            {currentHealthContext && (
              <div className="p-3 bg-medical-accent-50 border-b border-medical-accent-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-medical-accent-600 text-sm font-medium">Discussing:</span>
                  <span className="text-medical-accent-800 text-sm">Your Health Data (Labs, Vitals, Symptoms)</span>
                </div>
                <button
                  onClick={() => {
                    setCurrentHealthContext(null);
                    setMessages(prev => [...prev, {
                      type: 'ai',
                      text: 'Health context cleared. You can now ask general questions or ask about different health data.'
                    }]);
                  }}
                  className="text-medical-accent-600 hover:text-medical-accent-800 text-sm underline"
                >
                  Clear
                </button>
              </div>
            )}

            {/* Example Question Bubbles */}
            {messages.length === 0 && (
              <div className="px-4 py-3 bg-medical-neutral-50 border-t border-medical-neutral-200">
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                  {[
                    { text: "What does my CA-125 level mean?", color: "bg-medical-primary-500/80" },
                    { text: "Explain my latest lab results", color: "bg-medical-accent-500/80" },
                    { text: "What are common side effects?", color: "bg-medical-secondary-500/80" },
                    { text: "How is my treatment progressing?", color: "bg-medical-primary-400/80" },
                    { text: "What should I ask my doctor?", color: "bg-medical-secondary-400/80" },
                    { text: "Explain my symptoms", color: "bg-medical-accent-400/80" },
                    { text: "What trials match my profile?", color: "bg-medical-primary-600/80" },
                    { text: "Track my medication schedule", color: "bg-medical-secondary-600/80" },
                  ].map((question, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setInputText(question.text);
                        // Focus on input after setting text
                        setTimeout(() => {
                          const input = document.querySelector('input[type="text"]');
                          if (input) input.focus();
                        }, 0);
                      }}
                      className={`${question.color} text-white px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap hover:opacity-100 opacity-90 transition-opacity flex-shrink-0`}
                    >
                      {question.text}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="p-4 bg-white border-t">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder={
                    currentTrialContext 
                      ? `Ask about ${currentTrialContext.title || 'this trial'}...` 
                      : currentHealthContext 
                        ? "Ask about your labs, vitals, or symptoms..." 
                        : "Ask about symptoms, treatments, or upload results..."
                  }
                  className="flex-1 border border-medical-neutral-300 rounded-full px-4 py-2.5 text-sm sm:text-base focus:ring-2 focus:ring-medical-primary-500 focus:border-transparent transition-all duration-200"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openDocumentOnboarding(null, 'picker')}
                    title="Attach file or take photo"
                    className="bg-medical-neutral-100 text-medical-neutral-700 p-2 rounded-full hover:bg-medical-neutral-200 transition flex-shrink-0"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>
                  <button
                    onClick={handleSendMessage}
                    className="bg-medical-primary-500 text-white w-10 h-10 rounded-full hover:bg-medical-primary-600 transition flex-shrink-0 shadow-sm flex items-center justify-center"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'health' && (
          <div className="p-4 space-y-4">
            {/* Ask About Health Button */}
            <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">Ask About Your Health Data</h3>
                  <p className="text-sm text-gray-600">Get insights about your labs, vitals, and symptoms</p>
                </div>
                <button
                  onClick={async () => {
                    if (!user) return;
                    try {
                      // Load all health data
                      const labs = await labService.getLabs(user.uid);
                      const vitals = await vitalService.getVitals(user.uid);
                      const symptoms = await symptomService.getSymptoms(user.uid);
                      
                      // Set health context
                      setCurrentHealthContext({
                        labs: labs,
                        vitals: vitals,
                        symptoms: symptoms
                      });
                      
                      // Switch to chat tab
                      setActiveTab('chat');
                      
                      // Add a message indicating we're now discussing health data
                      setMessages(prev => [...prev, {
                        type: 'ai',
                        text: `I'm ready to answer questions about your health data. I can see your labs, vitals, and symptoms. You can ask me about trends, what values mean, or any concerns you have.`
                      }]);
                    } catch (error) {
                      console.error('Error loading health data:', error);
                      alert('Error loading health data. Please try again.');
                    }
                  }}
                  className="bg-medical-primary-500 text-white px-6 py-2.5 rounded-lg hover:bg-medical-primary-600 transition font-medium flex items-center gap-2 shadow-sm"
                >
                  <MessageSquare className="w-5 h-5" />
                  Ask About Health
                </button>
              </div>
            </div>

            {/* Health Section Tabs */}
            <div className="flex gap-4 mb-6 border-b border-medical-neutral-200">
              {['labs', 'vitals', 'symptoms', 'medications'].map(section => (
                <button
                  key={section}
                  onClick={() => setHealthSection(section)}
                  className={`pb-3 px-4 font-medium transition-all duration-200 flex items-center gap-2 ${
                    healthSection === section
                      ? 'text-medical-primary-600 border-b-2 border-medical-primary-600'
                      : 'text-medical-neutral-600 hover:text-medical-primary-600'
                  }`}
                >
                  {section === 'labs' && (
                    <>
                      <BarChart className="w-4 h-4" />
                      Labs
                    </>
                  )}
                  {section === 'vitals' && (
                    <>
                      <Heart className="w-4 h-4" />
                      Vitals
                    </>
                  )}
                  {section === 'symptoms' && (
                    <>
                      <Thermometer className="w-4 h-4" />
                      Symptoms
                    </>
                  )}
                  {section === 'medications' && (
                    <>
                      <Pill className="w-4 h-4" />
                      Medications
                    </>
                  )}
                </button>
              ))}
            </div>

            {healthSection === 'labs' && (
                  <>
                    {/* Empty State - No Lab Data */}
                    {!hasRealLabData && Object.keys(labsData).length === 0 && (
                      <div className="bg-medical-primary-50 border border-medical-primary-200 rounded-lg p-6 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <BarChart className="w-12 h-12 text-medical-primary-400" />
                          <div>
                            <h3 className="font-semibold text-medical-primary-900 mb-1">No Lab Data Yet</h3>
                            <p className="text-sm text-medical-primary-700 mb-4">
                              Upload lab reports to automatically extract and track your lab values
                            </p>
                            <button
                              onClick={() => openDocumentOnboarding('lab-report')}
                              className="bg-medical-primary-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-medical-primary-600 transition shadow-sm flex items-center gap-2 mx-auto"
                            >
                              <Upload className="w-4 h-4" />
                              Upload Lab Report
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Show data if available */}
                    {(hasRealLabData || Object.keys(labsData).length > 0) && (
                      <>

                        {/* Lab Trend Chart - only show if we have numeric labs */}
                        {Object.values(allLabData).some(lab => lab.isNumeric) && (
                          <div className="bg-white rounded-xl p-4 sm:p-6 border border-gray-200">
                            <div className="flex items-center justify-between mb-4">
                              <h2 className="text-base sm:text-lg font-semibold text-gray-900">Lab Trends</h2>
                              <select
                                value={selectedLab}
                                onChange={(e) => setSelectedLab(e.target.value)}
                                className="text-sm border border-gray-300 rounded-lg px-2 sm:px-3 py-1.5 focus:ring-2 focus:ring-green-500"
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

                                  // Group labs by category
                                  const labsByCategory = {};
                                  Object.keys(allLabData)
                                    .filter(key => allLabData[key].isNumeric)
                                    .forEach(key => {
                                      const canonicalKey = normalizeLabName(key) || key.toLowerCase();
                                      const category = canonicalKeyToCategory[canonicalKey] || 'other';
                                      const uiCategory = categoryMap[category] || 'Others';
                                      
                                      if (!labsByCategory[uiCategory]) {
                                        labsByCategory[uiCategory] = [];
                                      }
                                      labsByCategory[uiCategory].push({
                                        key,
                                        displayName: getLabDisplayName(key) || allLabData[key].name
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
                                  <span className={`ml-auto text-xs px-2 py-1 rounded-full ${currentLab.status === 'warning' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                                    }`}>
                                    {currentLab.status === 'warning' ? 'High' : 'Normal'}
                                  </span>
                                </div>
                                <p className="text-xs sm:text-sm text-gray-600">Normal range: {currentLab.normalRange} {currentLab.unit}</p>
                              </div>

                              {/* Chart - Responsive with Y-axis and hover tooltips */}
                              <div className="flex gap-3">
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
                                            <stop offset="0%" stopColor={currentLab.status === 'warning' ? '#f97316' : '#10b981'} stopOpacity="0.2" />
                                            <stop offset="100%" stopColor={currentLab.status === 'warning' ? '#f97316' : '#10b981'} stopOpacity="0.05" />
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
                                                    fill="#10b981"
                                                    opacity="0.08"
                                                  />
                                                  {/* Normal range boundary lines */}
                                                  <line x1="0" y1={normMinY} x2="400" y2={normMinY} stroke="#10b981" strokeWidth="1" strokeDasharray="4,4" opacity="0.4" />
                                                  <line x1="0" y1={normMaxY} x2="400" y2={normMaxY} stroke="#10b981" strokeWidth="1" strokeDasharray="4,4" opacity="0.4" />
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
                                                      fill="#10b981"
                                                      opacity="0.08"
                                                    />
                                                    {/* Threshold line */}
                                                    <line x1="0" y1={thresholdY} x2="400" y2={thresholdY} stroke="#10b981" strokeWidth="1" strokeDasharray="4,4" opacity="0.4" />
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
                                                        fill="#10b981"
                                                        opacity="0.08"
                                                      />
                                                      {/* Threshold line */}
                                                      <line x1="0" y1={thresholdY} x2="400" y2={thresholdY} stroke="#10b981" strokeWidth="1" strokeDasharray="4,4" opacity="0.4" />
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
                                          stroke={currentLab.status === 'warning' ? '#f97316' : '#10b981'}
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

                                        return (
                                          <div
                                            key={i}
                                            className="absolute group cursor-pointer"
                                            style={{
                                              left: `${x}%`,
                                              bottom: `${y}%`,
                                              transform: 'translate(-50%, 50%)'
                                            }}
                                          >
                                            {/* Hover area */}
                                            <div className="absolute inset-0 w-10 h-10 -m-5"></div>

                                            {/* Outer ring on hover */}
                                            <div
                                              className="absolute inset-0 rounded-full transition-all opacity-0 group-hover:opacity-100"
                                              style={{
                                                width: '20px',
                                                height: '20px',
                                                margin: '-10px',
                                                border: `2px solid ${currentLab.status === 'warning' ? '#f97316' : '#10b981'}`,
                                                backgroundColor: currentLab.status === 'warning' ? 'rgba(249, 115, 22, 0.1)' : 'rgba(16, 185, 129, 0.1)'
                                              }}
                                            />

                                            {/* Data point dot */}
                                            <div
                                              className={`rounded-full transition-all relative z-10 group-hover:scale-125 ${isLatest ? 'w-3.5 h-3.5' : 'w-3 h-3'
                                                }`}
                                              style={{
                                                backgroundColor: currentLab.status === 'warning' ? '#f97316' : '#10b981',
                                                border: '2px solid white',
                                                boxShadow: isLatest
                                                  ? '0 2px 8px rgba(0,0,0,0.25)'
                                                  : '0 1px 4px rgba(0,0,0,0.15)'
                                              }}
                                            />

                                            {/* Tooltip with delete button */}
                                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-4 opacity-0 group-hover:opacity-100 transition-opacity z-30">
                                              <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 whitespace-nowrap shadow-xl">
                                                <div className="flex items-center justify-between gap-3">
                                                  <div>
                                                    <div className="font-bold text-sm">{d.value} {currentLab.unit}</div>
                                                    <div className="text-gray-300 text-center text-xs mt-0.5">{d.date}</div>
                                                  </div>
                                                  {d.id && (
                                                    <button
                                                      onClick={async (e) => {
                                                        e.stopPropagation();
                                                        if (window.confirm(`Delete this ${currentLab.name} reading (${d.value} ${currentLab.unit} on ${d.date})?`)) {
                                                          try {
                                                            console.log('Deleting lab with ID:', d.id);
                                                            
                                                            // Optimistically update UI immediately
                                                            const updatedLabsData = { ...labsData };
                                                            if (updatedLabsData[selectedLab] && updatedLabsData[selectedLab].data) {
                                                              const filteredData = updatedLabsData[selectedLab].data.filter(item => item.id !== d.id);
                                                              // Get most recent value (first item after sorting by timestamp)
                                                              const sortedData = [...filteredData].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                                                              updatedLabsData[selectedLab] = {
                                                                ...updatedLabsData[selectedLab],
                                                                data: filteredData,
                                                                current: sortedData.length > 0 ? sortedData[0].value : '--'
                                                              };
                                                              setLabsData(updatedLabsData);
                                                            }
                                                            
                                                            // Delete from Firestore in background
                                                            await labService.deleteLab(d.id);
                                                            
                                                            // Reload to ensure sync (but UI already updated)
                                                            setTimeout(async () => {
                                                              const labs = await labService.getLabs(user.uid);
                                                              const transformedLabs = transformLabsData(labs);
                                                              setLabsData(transformedLabs);
                                                            }, 300);
                                                          } catch (error) {
                                                            console.error('Error deleting lab:', error);
                                                            // Revert optimistic update on error
                                                            reloadHealthData();
                                                            alert('Failed to delete lab reading. Please try again.');
                                                          }
                                                        }
                                                      }}
                                                      className="text-red-400 hover:text-red-300 transition-colors p-1 rounded hover:bg-red-900/20"
                                                      title="Delete this reading"
                                                    >
                                                      <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                  )}
                                                </div>
                                                {/* Arrow */}
                                                <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-px">
                                                  <div className="border-4 border-transparent border-t-gray-900"></div>
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

                              {/* X-axis labels */}
                              <div className="flex justify-between border-t border-gray-300 pt-2 text-xs text-gray-600">
                                {currentLab.data.map((d, i) => (
                                  <span key={i} className="hidden sm:inline">{d.date}</span>
                                ))}
                                <span className="sm:hidden">{currentLab.data[0].date}</span>
                                <span className="sm:hidden">{currentLab.data[currentLab.data.length - 1].date}</span>
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
                                  className="relative bg-white rounded-lg shadow-sm p-4 border border-medical-neutral-200 hover:shadow-md transition-all"
                                >
                                  {/* Status indicator dot */}
                                  <div className={`absolute top-3 right-3 w-2.5 h-2.5 ${colors.dot} rounded-full`}></div>

                                  <div className="flex items-start justify-between mb-2">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1">
                                        <p className="text-sm font-semibold text-medical-neutral-900">{displayName}</p>
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
                                        <p className="text-xs text-medical-neutral-500">{lab.unit}</p>
                                      </div>
                                      <p className={`text-xs ${colors.text} font-medium mt-1`}>{labStatus.label}</p>
                                      {lab.normalRange && (
                                        <p className="text-xs text-medical-neutral-500 mt-1">Normal: {lab.normalRange}</p>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1 ml-2">
                                      <button
                                        onClick={() => setSelectedLab(key)}
                                        className="p-1.5 text-medical-primary-600 hover:bg-medical-primary-50 rounded transition-colors"
                                        title="View chart"
                                      >
                                        <TrendingUp className="w-4 h-4" />
                                      </button>
                                      <div className="relative">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setOpenDeleteMenu(openDeleteMenu === `lab:${key}` ? null : `lab:${key}`);
                                          }}
                                          className="p-1.5 text-medical-neutral-500 hover:bg-medical-neutral-100 rounded transition-colors"
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
                                            <div className="absolute right-0 top-8 z-50 bg-white rounded-lg shadow-lg border border-medical-neutral-200 py-1 min-w-[160px]">
                                              <button
                                                onClick={async (e) => {
                                                  e.stopPropagation();
                                                  setOpenDeleteMenu(null);
                                                  const labType = key;
                                                  const count = lab.data?.length || 0;
                                                  if (window.confirm(`Delete all ${displayName} data? This will permanently remove ${count} ${count === 1 ? 'entry' : 'entries'}. This action cannot be undone.`)) {
                                                    try {
                                                      console.log('Deleting all labs of type:', labType);
                                                      
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
                                                      console.log('Deleted labs count:', deletedCount);
                                                      
                                                      // Reload to ensure sync (but UI already updated)
                                                      setTimeout(async () => {
                                                        const labs = await labService.getLabs(user.uid);
                                                        const transformedLabs = transformLabsData(labs);
                                                        setLabsData(transformedLabs);
                                                      }, 300);
                                                    } catch (error) {
                                                      console.error('Error deleting labs:', error);
                                                      // Revert optimistic update on error
                                                      reloadHealthData();
                                                      alert('Failed to delete lab data. Please try again.');
                                                    }
                                                  }
                                                }}
                                                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                                              >
                                                <Trash2 className="w-4 h-4" />
                                                Delete All {displayName}
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
                              return (
                                <div
                                  key={key}
                                  className="bg-medical-primary-50 border border-medical-primary-200 rounded-lg p-4"
                                >
                                  <p className="text-sm font-semibold text-medical-primary-900 mb-1">{lab.name}</p>
                                  <p className="text-base font-bold text-medical-primary-900">{lab.current}</p>
                                  <p className="text-xs text-medical-primary-600 mt-1">
                                    {new Date(lab.data[lab.data.length - 1]?.date || Date.now()).toLocaleDateString()}
                                  </p>
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

                          return (
                            <div className="space-y-4 mt-6">
                              {categoryOrder.map(category => {
                                const labsInCategory = categorizedLabs[category];
                                if (labsInCategory.length === 0) return null;

                                const isExpanded = expandedCategories[category];
                                const CategoryIcon = categoryIcons[category] || Activity;
                                const description = categoryDescriptions[category];

                                return (
                                  <div
                                    key={category}
                                    className="bg-white rounded-xl shadow-sm border border-medical-neutral-200 overflow-hidden transition-all hover:shadow-md"
                                  >
                                    {/* Category Header - Clickable to expand/collapse */}
                                    <button
                                      onClick={() => setExpandedCategories(prev => ({
                                        ...prev,
                                        [category]: !prev[category]
                                      }))}
                                      className="w-full p-5 flex items-center justify-between hover:bg-medical-neutral-50 transition-colors"
                                    >
                                      <div className="flex items-center gap-4 flex-1">
                                        <div className="w-12 h-12 bg-medical-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                          <CategoryIcon className="w-6 h-6 text-medical-primary-600" />
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
                                      <div className="px-5 pb-5 pt-2 border-t border-medical-neutral-100">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
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


                        <div className="space-y-2">
                          <button
                            onClick={() => setShowAddLab(true)}
                            className="w-full py-2 border-2 border-dashed border-medical-neutral-300 rounded-lg text-medical-neutral-600 hover:border-medical-primary-500 hover:text-medical-primary-600 transition"
                          >
                            + Add Lab Value to Track
                          </button>
                          <button
                            onClick={() => simulateDocumentUpload('lab')}
                            className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium flex items-center justify-center gap-2"
                          >
                            <Upload className="w-4 h-4" />
                            Upload Lab Report
                          </button>
                        </div>
                      </>
                    )}
                  </>
            )}

            {healthSection === 'vitals' && (
              <>
                {/* Empty State - No Vital Data */}
                {!hasRealVitalData && Object.keys(vitalsData).length === 0 && (
                      <div className="bg-medical-primary-50 border border-medical-primary-200 rounded-lg p-6 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <Heart className="w-12 h-12 text-medical-primary-400" />
                          <div>
                            <h3 className="font-semibold text-medical-primary-900 mb-1">No Vital Signs Data Yet</h3>
                            <p className="text-sm text-medical-primary-700 mb-4">
                              Track blood pressure, heart rate, weight, and more
                            </p>
                            <div className="flex flex-col sm:flex-row gap-3 justify-center">
                              <button
                                onClick={() => setShowAddVital(true)}
                                className="bg-white border-2 border-medical-primary-500 text-medical-primary-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-medical-primary-50 transition shadow-sm"
                              >
                                Manual Enter
                              </button>
                              <button
                                onClick={() => setActiveTab('chat')}
                                className="bg-medical-primary-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-medical-primary-600 transition shadow-sm"
                              >
                                Add via Chat
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Show data if available */}
                    {(hasRealVitalData || Object.keys(vitalsData).length > 0) && (
                      <>

                        {/* Vital Trend Chart */}
                        <div className="bg-white rounded-xl p-4 sm:p-6 border border-gray-200">
                          <div className="flex items-center justify-between mb-4">
                            <h2 className="text-base sm:text-lg font-semibold text-gray-900">Vital Signs</h2>
                            <div className="flex items-center gap-2">
                              {Object.keys(allVitalsData).length > 0 ? (
                                <select
                                  value={selectedVital}
                                  onChange={(e) => setSelectedVital(e.target.value)}
                                  className="text-sm border border-gray-300 rounded-lg px-2 sm:px-3 py-1.5 focus:ring-2 focus:ring-green-500"
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
                              ) : (
                                <div className="text-sm text-gray-500">No vitals available</div>
                              )}
                              <div className="relative">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenDeleteMenu(openDeleteMenu === `vital:${selectedVital}` ? null : `vital:${selectedVital}`);
                                  }}
                                  className="p-1.5 text-medical-neutral-500 hover:bg-medical-neutral-100 rounded transition-colors"
                                  title="More options"
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </button>
                                {openDeleteMenu === `vital:${selectedVital}` && (
                                  <>
                                    <div
                                      className="fixed inset-0 z-40"
                                      onClick={() => setOpenDeleteMenu(null)}
                                    />
                                    <div className="absolute right-0 top-8 z-50 bg-white rounded-lg shadow-lg border border-medical-neutral-200 py-1 min-w-[160px]">
                                      <button
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          setOpenDeleteMenu(null);
                                          const vitalType = selectedVital;
                                          const vital = allVitalsData[vitalType];
                                          const displayName = getVitalDisplayName(vital?.name || vitalType);
                                          const count = vital?.data?.length || 0;
                                              if (window.confirm(`Delete all ${displayName} data? This will permanently remove ${count} ${count === 1 ? 'entry' : 'entries'}. This action cannot be undone.`)) {
                                                try {
                                                  console.log('Deleting all vitals of type:', vitalType);
                                                  
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
                                                    }
                                                  }
                                                  
                                                  // Delete from Firestore in background
                                                  const deletedCount = await vitalService.deleteAllVitalsByType(user.uid, vitalType);
                                                  console.log('Deleted vitals count:', deletedCount);
                                                  
                                                  // Reload to ensure sync (but UI already updated)
                                                  setTimeout(async () => {
                                                    const vitals = await vitalService.getVitals(user.uid);
                                                    const transformedVitals = transformVitalsData(vitals);
                                                    setVitalsData(transformedVitals);
                                                  }, 300);
                                                } catch (error) {
                                                  console.error('Error deleting vitals:', error);
                                                  // Revert optimistic update on error
                                                  reloadHealthData();
                                                  alert('Failed to delete vital data. Please try again.');
                                                }
                                              }
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                        Delete All {getVitalDisplayName(allVitalsData[selectedVital]?.name || selectedVital)}
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
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
                                    onClick={() => setActiveTab('chat')}
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
                                    <span className={`ml-auto text-xs px-2 py-1 rounded-full ${currentVital.status === 'warning' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                                      }`}>
                                      {currentVital.status === 'warning' ? 'Abnormal' : 'Normal'}
                                    </span>
                                  </div>
                                  <p className="text-xs sm:text-sm text-gray-600">Normal range: {currentVital.normalRange} {currentVital.unit}</p>
                                </div>

                                {/* Chart - Responsive with Y-axis and hover tooltips */}
                                <div className="flex gap-3">
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

                                        // Parse normal range if available
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
                                        const yRange = yMax - yMin || 1; // Prevent division by zero

                                        return (
                                          <>
                                            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 400 160" preserveAspectRatio="none">
                                              <defs>
                                                <linearGradient id={`gradient-vital-${selectedVital}`} x1="0%" y1="0%" x2="0%" y2="100%">
                                                  <stop offset="0%" stopColor={currentVital.status === 'warning' ? '#f97316' : '#10b981'} stopOpacity="0.2" />
                                                  <stop offset="100%" stopColor={currentVital.status === 'warning' ? '#f97316' : '#10b981'} stopOpacity="0.05" />
                                                </linearGradient>
                                              </defs>

                                              {/* Normal range boundaries (if available) */}
                                              {currentVital.normalRange && (() => {
                                                // Try standard range format "X-Y"
                                                let rangeMatch = currentVital.normalRange.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/);
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
                                                          fill="#10b981"
                                                          opacity="0.08"
                                                        />
                                                        {/* Normal range boundary lines */}
                                                        <line x1="0" y1={normMinY} x2="400" y2={normMinY} stroke="#10b981" strokeWidth="1" strokeDasharray="4,4" opacity="0.4" />
                                                        <line x1="0" y1={normMaxY} x2="400" y2={normMaxY} stroke="#10b981" strokeWidth="1" strokeDasharray="4,4" opacity="0.4" />
                                                      </>
                                                    );
                                                  }
                                                } else {
                                                  // Try "< X" format
                                                  const lessThanMatch = currentVital.normalRange.match(/<\s*(\d+\.?\d*)/);
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
                                                            fill="#10b981"
                                                            opacity="0.08"
                                                          />
                                                          {/* Threshold line */}
                                                          <line x1="0" y1={thresholdY} x2="400" y2={thresholdY} stroke="#10b981" strokeWidth="1" strokeDasharray="4,4" opacity="0.4" />
                                                        </>
                                                      );
                                                    }
                                                  } else {
                                                    // Try "> X" format
                                                    const greaterThanMatch = currentVital.normalRange.match(/>\s*(\d+\.?\d*)/);
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
                                                              fill="#10b981"
                                                              opacity="0.08"
                                                            />
                                                            {/* Threshold line */}
                                                            <line x1="0" y1={thresholdY} x2="400" y2={thresholdY} stroke="#10b981" strokeWidth="1" strokeDasharray="4,4" opacity="0.4" />
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
                                                stroke={currentVital.status === 'warning' ? '#f97316' : '#10b981'}
                                                strokeWidth="3"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                              />
                                            </svg>

                                            {/* Interactive data points with tooltips */}
                                            {currentVital.data.map((d, i) => {
                                              const dataLength = Math.max(currentVital.data.length - 1, 1); // Prevent division by zero
                                              const val = (selectedVital === 'bp' || selectedVital === 'bloodpressure') ? (d.systolic || d.value) : d.value;
                                              const x = (i / dataLength) * 100;
                                              const y = ((parseFloat(val) - yMin) / yRange) * 100;
                                              const isLatest = i === currentVital.data.length - 1;

                                              return (
                                                <div
                                                  key={i}
                                                  className="absolute group cursor-pointer"
                                                  style={{
                                                    left: `${x}%`,
                                                    bottom: `${y}%`,
                                                    transform: 'translate(-50%, 50%)'
                                                  }}
                                                >
                                                  {/* Hover area */}
                                                  <div className="absolute inset-0 w-10 h-10 -m-5"></div>

                                                  {/* Outer ring on hover */}
                                                  <div
                                                    className="absolute inset-0 rounded-full transition-all opacity-0 group-hover:opacity-100"
                                                    style={{
                                                      width: '20px',
                                                      height: '20px',
                                                      margin: '-10px',
                                                      border: `2px solid ${currentVital.status === 'warning' ? '#f97316' : '#10b981'}`,
                                                      backgroundColor: currentVital.status === 'warning' ? 'rgba(249, 115, 22, 0.1)' : 'rgba(16, 185, 129, 0.1)'
                                                    }}
                                                  />

                                                  {/* Data point dot */}
                                                  <div
                                                    className={`rounded-full transition-all relative z-10 group-hover:scale-125 ${isLatest ? 'w-3.5 h-3.5' : 'w-3 h-3'
                                                      }`}
                                                    style={{
                                                      backgroundColor: currentVital.status === 'warning' ? '#f97316' : '#10b981',
                                                      border: '2px solid white',
                                                      boxShadow: isLatest
                                                        ? '0 2px 8px rgba(0,0,0,0.25)'
                                                        : '0 1px 4px rgba(0,0,0,0.15)'
                                                    }}
                                                  />

                                                  {/* Tooltip with delete button */}
                                                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-4 opacity-0 group-hover:opacity-100 transition-opacity z-30">
                                                    <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 shadow-xl">
                                                      <div className="flex items-center justify-between gap-3">
                                                        <div>
                                                          <div className="font-bold text-sm">
                                                            {selectedVital === 'bp' || selectedVital === 'bloodpressure' 
                                                              ? `${d.systolic || d.value}/${d.diastolic || ''} ${currentVital.unit}`
                                                              : `${d.value} ${currentVital.unit}`
                                                            }
                                                          </div>
                                                          <div className="text-gray-300 text-center text-xs mt-0.5">{d.date}</div>
                                                        </div>
                                                        {d.id && (
                                                          <button
                                                            onClick={async (e) => {
                                                              e.stopPropagation();
                                                              const displayName = getVitalDisplayName(currentVital.name || selectedVital);
                                                              const valueDisplay = selectedVital === 'bp' || selectedVital === 'bloodpressure' 
                                                                ? `${d.systolic || d.value}/${d.diastolic || ''}`
                                                                : d.value;
                                                              if (window.confirm(`Delete this ${displayName} reading (${valueDisplay} ${currentVital.unit} on ${d.date})?`)) {
                                                                try {
                                                                  console.log('Deleting vital with ID:', d.id);
                                                                  
                                                                  // Optimistically update UI immediately
                                                                  const updatedVitalsData = { ...vitalsData };
                                                                  if (updatedVitalsData[selectedVital] && updatedVitalsData[selectedVital].data) {
                                                                    const filteredData = updatedVitalsData[selectedVital].data.filter(item => item.id !== d.id);
                                                                    // Get most recent value (first item after sorting by timestamp)
                                                                    const sortedData = [...filteredData].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                                                                    updatedVitalsData[selectedVital] = {
                                                                      ...updatedVitalsData[selectedVital],
                                                                      data: filteredData,
                                                                      current: sortedData.length > 0 ? sortedData[0].value : '--'
                                                                    };
                                                                    setVitalsData(updatedVitalsData);
                                                                  }
                                                                  
                                                                  // Delete from Firestore in background
                                                                  await vitalService.deleteVital(d.id);
                                                                  
                                                                  // Reload to ensure sync (but UI already updated)
                                                                  setTimeout(async () => {
                                                                    const vitals = await vitalService.getVitals(user.uid);
                                                                    const transformedVitals = transformVitalsData(vitals);
                                                                    setVitalsData(transformedVitals);
                                                                  }, 300);
                                                                } catch (error) {
                                                                  console.error('Error deleting vital:', error);
                                                                  // Revert optimistic update on error
                                                                  reloadHealthData();
                                                                  alert('Failed to delete vital reading. Please try again.');
                                                                }
                                                              }
                                                            }}
                                                            className="text-red-400 hover:text-red-300 transition-colors p-1 rounded hover:bg-red-900/20 flex-shrink-0"
                                                            title="Delete this reading"
                                                          >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                          </button>
                                                        )}
                                                      </div>
                                                      {/* Arrow */}
                                                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                                                        <div className="border-4 border-transparent border-t-gray-900"></div>
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

                                    {/* X-axis labels */}
                                    <div className="flex justify-between border-t border-gray-300 pt-2 text-xs text-gray-600">
                                      {currentVital.data.map((d, i) => (
                                        <span key={i} className="hidden sm:inline">{d.date}</span>
                                      ))}
                                      <span className="sm:hidden">{currentVital.data[0]?.date}</span>
                                      <span className="sm:hidden">{currentVital.data[currentVital.data.length - 1]?.date}</span>
                                    </div>
                                  </div>
                                </div>
                              </>
                            );
                          })()}
                        </div>

                        {/* Quick Vital Stats */}
                        <div className="bg-white rounded-lg shadow p-4">
                          <h3 className="font-semibold text-gray-800 mb-3">All Vitals (Latest)</h3>
                          <div className="grid grid-cols-2 gap-2">
                            {Object.entries(allVitalsData).map(([key, vital]) => (
                              <button
                                key={key}
                                onClick={() => setSelectedVital(key)}
                                className={`p-3 rounded-lg border-2 transition text-left ${selectedVital === key
                                  ? 'border-green-500 bg-green-50'
                                  : 'border-gray-200 hover:border-gray-300'
                                  }`}
                              >
                                <p className="text-xs text-gray-600 mb-0.5">{vital.name}</p>
                                <p className="text-lg font-bold text-gray-900">{vital.current}</p>
                                <p className="text-xs text-gray-500">{vital.unit}</p>
                              </button>
                            ))}
                          </div>
                        </div>

                        <button
                          onClick={() => setShowAddVital(true)}
                          className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition"
                        >
                          + Log Vital Reading
                        </button>
                      </>
                    )}
              </>
            )}

            {healthSection === 'symptoms' && (
              <>
                {symptoms.length === 0 ? (
                  <div className="bg-medical-primary-50 border border-medical-primary-200 rounded-lg p-6 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Thermometer className="w-12 h-12 text-medical-primary-400" />
                      <div>
                        <h3 className="font-semibold text-medical-primary-900 mb-1">No Symptoms Tracked Yet</h3>
                        <p className="text-sm text-medical-primary-700 mb-4">
                          Track symptoms to identify patterns and correlations with your health data
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                          <button
                            onClick={() => setShowAddSymptomModal(true)}
                            className="bg-white border-2 border-medical-primary-500 text-medical-primary-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-medical-primary-50 transition shadow-sm"
                          >
                            Manual Enter
                          </button>
                          <button
                            onClick={() => setActiveTab('chat')}
                            className="bg-medical-primary-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-medical-primary-600 transition shadow-sm"
                          >
                            Add via Chat
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {symptoms.length > 5 && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-semibold text-blue-900">AI Pattern Detection</p>
                            <p className="text-xs text-blue-700 mt-1">
                              Track more symptoms to enable pattern detection and correlations with your lab values.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Symptom Calendar */}
                <div className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-800">December 2024</h3>
                    <button
                      onClick={() => setShowAddSymptomModal(true)}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
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
                      // December 2024 starts on Sunday (day 0)
                      const daysInMonth = 31;
                      const firstDayOfWeek = 0; // Sunday
                      const calendar = [];

                      // Map real symptoms to dates
                      const symptomsByDate = {};
                      symptoms.forEach(symptom => {
                        const date = new Date(symptom.date);
                        const day = date.getDate().toString();
                        if (!symptomsByDate[day]) {
                          symptomsByDate[day] = [];
                        }
                        symptomsByDate[day].push({
                          id: symptom.id,
                          type: symptom.name || symptom.type,
                          severity: symptom.severity,
                          time: symptom.time || new Date(symptom.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                        });
                      });

                      // Symptom type colors
                      const symptomColors = {
                        'Fatigue': 'bg-blue-500',
                        'Pain': 'bg-red-500',
                        'Nausea': 'bg-green-500',
                        'Headache': 'bg-purple-500',
                        'Dizziness': 'bg-yellow-500',
                        'Other': 'bg-gray-500'
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
                        // Check if this is today's date
                        const today = new Date();
                        const isToday = today.getDate() === day && today.getMonth() === 11 && today.getFullYear() === 2024;
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
                              ? 'bg-green-100 border-2 border-green-500 font-bold'
                              : hasSymptoms
                                ? 'hover:bg-gray-100 border border-gray-200'
                                : 'border border-transparent text-gray-400'
                              } ${selectedDate === dayStr ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}
                          >
                            <span className={isToday ? 'text-green-700' : hasSymptoms ? 'text-gray-900' : ''}>{day}</span>

                            {/* Symptom dots */}
                            {hasSymptoms && (
                              <div className="flex gap-0.5 mt-1">
                                {uniqueSymptomTypes.slice(0, 3).map((type, idx) => (
                                  <div
                                    key={idx}
                                    className={`w-1.5 h-1.5 rounded-full ${symptomColors[type] || symptomColors['Other']}`}
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
                                <h4 className="font-semibold text-gray-800">December {selectedDate}, 2024</h4>
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
                                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${symptomColors[symptom.type] || symptomColors['Other']}`}></div>
                                        <p className="text-sm font-medium truncate">{symptom.type}</p>
                                      </div>
                                      <div className="flex items-center gap-2 flex-shrink-0">
                                        <span className="text-xs text-gray-600">{symptom.time}</span>
                                        <button
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            if (window.confirm('Are you sure you want to delete this symptom entry?')) {
                                              try {
                                                await symptomService.deleteSymptom(symptom.id);
                                                // Symptoms will automatically update via the subscription
                                              } catch (error) {
                                                console.error('Error deleting symptom:', error);
                                                alert('Failed to delete symptom. Please try again.');
                                              }
                                            }
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
                    <div className="bg-white rounded-lg shadow p-4">
                      <h4 className="font-semibold text-gray-800 mb-3 text-sm">Symptom Types</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
              </>
            )}

            {healthSection === 'medications' && (
              <>
                {medications.length === 0 ? (
                  <div className="bg-medical-primary-50 border border-medical-primary-200 rounded-lg p-6 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Pill className="w-12 h-12 text-medical-primary-400" />
                      <div>
                        <h3 className="font-semibold text-medical-primary-900 mb-1">No Medications Tracked Yet</h3>
                        <p className="text-sm text-medical-primary-700 mb-4">
                          Track your medications to monitor adherence and schedule doses
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3 justify-center">
                          <button
                            onClick={() => setShowAddMedication(true)}
                            className="bg-white border-2 border-medical-primary-500 text-medical-primary-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-medical-primary-50 transition shadow-sm"
                          >
                            Manual Enter
                          </button>
                          <button
                            onClick={() => setActiveTab('chat')}
                            className="bg-medical-primary-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-medical-primary-600 transition shadow-sm"
                          >
                            Add via Chat
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-blue-900">Medication Adherence</p>
                          <p className="text-xs text-blue-700 mt-1">
                            All medications taken on schedule. Next IV infusion scheduled for Jan 5.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Active Medications */}
                    <div className="bg-white rounded-lg shadow p-4">
                      <h3 className="font-semibold text-gray-800 mb-3">Active Medications</h3>
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
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold text-gray-900">{med.name}</h4>
                                <span className={`text-xs px-2 py-0.5 rounded-full border ${colorClasses[med.color]}`}>
                                  {med.purpose}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600">
                                <span className="font-medium">{med.dosage}</span> • {med.frequency}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                            <div className="flex-1">
                              <p className="text-xs text-gray-500 mb-0.5">Next dose</p>
                              <p className="text-sm font-medium text-gray-800">
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
                                  <div className="flex items-center gap-2 bg-green-50 px-3 py-1.5 rounded-lg">
                                    <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                    <span className="text-xs font-medium text-green-700">Taken</span>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => markMedicationTaken(med.id, nextTime)}
                                    className="bg-green-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-green-700 transition font-medium"
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
                <div className="bg-white rounded-lg shadow p-4">
                  <h3 className="font-semibold text-gray-800 mb-3">Today's Schedule</h3>
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
                            className={`w-full flex items-center gap-3 p-2 border-2 rounded-lg transition ${taken
                              ? 'border-green-300 bg-green-50 cursor-default'
                              : 'border-gray-200 hover:border-green-500 hover:bg-green-50'
                              }`}
                          >
                            <div className="text-sm font-semibold text-gray-700 w-20">
                              {med.specificTime}
                            </div>
                            <div className="flex-1 text-left">
                              <p className="text-sm font-medium text-gray-900">{med.name}</p>
                              <p className="text-xs text-gray-600">{med.dosage}</p>
                            </div>
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${taken ? 'border-green-500 bg-green-500' : 'border-gray-300'
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
                  className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition"
                >
                  + Add Medication
                </button>
                  </>
                )}
              </>
            )}

          </div>
        )}

        {activeTab === 'trials' && (
          <ClinicalTrials 
            onTrialSelected={(trial) => {
              setCurrentTrialContext(trial);
              setActiveTab('chat');
              // Add a message indicating we're now discussing this trial
              setMessages(prev => [...prev, {
                type: 'ai',
                text: `I'm ready to answer questions about "${trial.title || 'this trial'}". You can ask me about the drugs being used, what phase the study is in, eligibility criteria, or anything else about the trial.`
              }]);
            }}
          />
        )}

        {activeTab === 'files' && (
          <div className="p-4 space-y-4">
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-purple-900">AI Document Analysis</p>
                  <p className="text-xs text-purple-700 mt-1">
                    {documents.length} document{documents.length !== 1 ? 's' : ''} processed. Upload lab results, imaging scans, clinical reports, or genomic test results.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="font-semibold mb-3">Medical Documents</h3>
              {documents.length === 0 ? (
                <div className="text-center py-8">
                  <FolderOpen className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm mb-4">No documents uploaded yet</p>
                  <button
                    onClick={() => {
                      openDocumentOnboarding('general');
                    }}
                    className="px-4 py-2 bg-medical-primary-500 text-white rounded-lg hover:bg-medical-primary-600 transition text-sm font-medium"
                  >
                    Upload Your First Document
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {documents.map(doc => {
                    // Define icon and color based on document type
                    const getIconConfig = (type) => {
                      switch (type) {
                        case 'Lab':
                          return {
                            bgColor: 'bg-blue-100',
                            iconColor: 'text-blue-600',
                            icon: (
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                              </svg>
                            ),
                            label: "Lab Results"
                          };
                        case 'Scan':
                          return {
                            bgColor: 'bg-purple-100',
                            iconColor: 'text-purple-600',
                            icon: (
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            ),
                            label: "Imaging Scan"
                          };
                        case 'Report':
                          return {
                            bgColor: 'bg-green-100',
                            iconColor: 'text-green-600',
                            icon: (
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            ),
                            label: "Clinical Report"
                          };
                        case 'Genomic':
                          return {
                            bgColor: 'bg-amber-100',
                            iconColor: 'text-amber-600',
                            icon: (
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                              </svg>
                            ),
                            label: "Genomic Test"
                          };
                        default:
                          return {
                            bgColor: 'bg-gray-100',
                            iconColor: 'text-gray-600',
                            icon: (
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            ),
                            label: "Document"
                          };
                      }
                    };

                    const iconConfig = getIconConfig(doc.documentType || doc.type);
                    
                    // Get file name - try multiple possible fields
                    const fileName = doc.fileName || doc.name || 'Untitled Document';
                    
                    const handleDelete = async (e) => {
                      e.stopPropagation();
                      if (window.confirm(`Are you sure you want to delete "${fileName}"? This action cannot be undone.`)) {
                        try {
                          await deleteDocument(doc.id, doc.storagePath);
                          // Reload documents
                          const updatedDocs = await documentService.getDocuments(user.uid);
                          setDocuments(updatedDocs);
                        } catch (error) {
                          console.error('Error deleting document:', error);
                          alert('Failed to delete document. Please try again.');
                        }
                      }
                    };

                    return (
                      <div key={doc.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 transition">
                        <div className={`w-12 h-12 ${iconConfig.bgColor} rounded-lg flex items-center justify-center flex-shrink-0`}>
                          <div className={iconConfig.iconColor}>
                            {iconConfig.icon}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-base font-semibold truncate">{fileName}</p>
                          <p className="text-xs text-gray-700 mt-0.5">{iconConfig.label}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {new Date(doc.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                        <div className="flex-shrink-0 flex items-center gap-2">
                          {doc.fileUrl && (
                            <a
                              href={doc.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition"
                              onClick={(e) => e.stopPropagation()}
                            >
                              View
                            </a>
                          )}
                          <button
                            onClick={handleDelete}
                            className="p-1.5 rounded-full text-gray-500 hover:bg-red-100 hover:text-red-600 transition"
                            aria-label="Delete document"
                          >
                            <X size={18} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              onClick={() => {
                openDocumentOnboarding('general');
              }}
              className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition flex items-center justify-center gap-2"
            >
              <Upload size={18} />
              Upload Document
            </button>
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="p-4 space-y-4 pb-24">
            {/* Patient Info */}
            <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border border-medical-neutral-200">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                {/* Profile Picture */}
                <div className="relative flex-shrink-0">
                  {profileImage ? (
                    <img 
                      src={profileImage} 
                      alt="Profile" 
                      className="w-28 h-28 sm:w-32 sm:h-32 rounded-full object-cover border-4 border-white shadow-lg" 
                    />
                  ) : (
                    <div className="w-28 h-28 sm:w-32 sm:h-32 bg-gradient-to-br from-medical-primary-500 to-medical-secondary-500 rounded-full flex items-center justify-center text-white text-3xl sm:text-4xl font-bold shadow-lg border-4 border-white">
                      {(() => {
                        const name = patientProfile.firstName || patientProfile.lastName 
                          ? `${patientProfile.firstName || ''} ${patientProfile.middleName ? patientProfile.middleName + ' ' : ''}${patientProfile.lastName || ''}`.trim()
                          : patientProfile.name || user?.displayName || 'Patient';
                        const parts = name.trim().split(/\s+/);
                        if (parts.length >= 2) {
                          return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
                        }
                        return name.substring(0, 2).toUpperCase();
                      })()}
                    </div>
                  )}
                  <button
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.onchange = (e) => {
                        const file = e.target.files[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (e) => setProfileImage(e.target.result);
                          reader.readAsDataURL(file);
                        }
                      };
                      input.click();
                    }}
                    className="absolute bottom-0 right-0 w-10 h-10 bg-medical-primary-600 rounded-full flex items-center justify-center text-white shadow-lg hover:bg-medical-primary-700 transition transform hover:scale-110"
                    title="Change profile picture"
                  >
                    <Camera className="w-5 h-5" />
                  </button>
                </div>

                {/* Profile Information */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <h2 className="font-bold text-2xl sm:text-3xl text-gray-900 mb-1">
                        {patientProfile.firstName || patientProfile.lastName 
                          ? `${patientProfile.firstName || ''} ${patientProfile.middleName ? patientProfile.middleName + ' ' : ''}${patientProfile.lastName || ''}`.trim()
                          : patientProfile.name || user?.displayName || 'Patient'}
                      </h2>
                      {patientProfile.gender && (
                        <span className="text-sm text-gray-600">
                          {patientProfile.gender}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => setShowEditInfo(true)}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      <Edit2 size={18} />
                    </button>
                  </div>

                  {/* Key Information Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                    {patientProfile.age && (
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-8 h-8 bg-medical-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-medical-primary-600" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Age</p>
                          <p className="font-semibold text-gray-900">{patientProfile.age} years</p>
                        </div>
                      </div>
                    )}
                    {patientProfile.dateOfBirth && (
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-8 h-8 bg-medical-accent-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Calendar className="w-4 h-4 text-medical-accent-600" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Date of Birth</p>
                          <p className="font-semibold text-gray-900">
                            {new Date(patientProfile.dateOfBirth).toLocaleDateString('en-US', { 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            })}
                          </p>
                        </div>
                      </div>
                    )}
                    {patientProfile.country && (
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-8 h-8 bg-medical-secondary-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <MapPin className="w-4 h-4 text-medical-secondary-600" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Location</p>
                          <p className="font-semibold text-gray-900">{patientProfile.country}</p>
                        </div>
                      </div>
                    )}
                    {patientProfile.gender && (
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-8 h-8 bg-pink-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-pink-600" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Gender</p>
                          <p className="font-semibold text-gray-900">{patientProfile.gender}</p>
                        </div>
                      </div>
                    )}
                    {patientProfile.height && (
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <TrendingUp className="w-4 h-4 text-green-600" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Height</p>
                          <p className="font-semibold text-gray-900">{patientProfile.height} cm</p>
                        </div>
                      </div>
                    )}
                    {patientProfile.weight && (
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Activity className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Weight</p>
                          <p className="font-semibold text-gray-900">{patientProfile.weight} kg</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Current Status - Full Width */}
            <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border-2 border-medical-accent-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-medical-accent-50 p-2.5 rounded-lg">
                    <Activity className="w-6 h-6 text-medical-accent-600" />
                  </div>
                  <h2 className="font-semibold text-gray-800 text-lg">Current Status</h2>
                </div>
                <button
                  onClick={() => setShowUpdateStatus(true)}
                  className="text-medical-accent-600 hover:text-medical-accent-700"
                >
                  <Edit2 size={18} />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="flex flex-col">
                  <span className="text-gray-600 mb-1 text-sm">Diagnosis</span>
                  <span className="font-medium text-gray-900">{currentStatus?.diagnosis || patientProfile?.diagnosis || 'No diagnosis yet'}</span>
                </div>
                {(currentStatus?.subtype || patientProfile?.cancerType) && (
                  <div className="flex flex-col">
                    <span className="text-gray-600 mb-1 text-sm">Cancer Subtype</span>
                    <span className="font-medium text-gray-900">{currentStatus?.subtype || patientProfile?.cancerType || '—'}</span>
                  </div>
                )}
                {(currentStatus?.stage || patientProfile?.stage) && (
                  <div className="flex flex-col">
                    <span className="text-gray-600 mb-1 text-sm">Stage</span>
                    <span className="font-medium text-gray-900">{currentStatus?.stage || patientProfile?.stage || '—'}</span>
                  </div>
                )}
                <div className="flex flex-col">
                  <span className="text-gray-600 mb-1 text-sm">Treatment Status</span>
                  <span className="font-medium text-gray-900">{currentStatus?.treatmentLine || currentStatus?.currentRegimen || '—'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-gray-600 mb-1 text-sm">ECOG Performance</span>
                  <span className="font-medium text-gray-900">{currentStatus?.performanceStatus || '—'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-gray-600 mb-1 text-sm">Disease Status</span>
                  <span className="font-medium text-gray-900">{currentStatus?.diseaseStatus || '—'}</span>
                </div>
                {currentStatus?.baselineCa125 != null && currentStatus?.baselineCa125 !== '' && (
                  <div className="flex flex-col">
                    <span className="text-gray-600 mb-1 text-sm">Baseline CA-125</span>
                    <span className="font-medium text-gray-900">{currentStatus.baselineCa125}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Genomic Profile */}
            <div className="bg-white rounded-lg shadow-sm p-4 sm:p-6 border-2 border-purple-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-2.5 rounded-lg">
                    <Dna className="w-6 h-6 text-purple-600" />
                  </div>
                  <h2 className="font-semibold text-gray-800 text-lg">Genomic Profile</h2>
                </div>
                <div className="flex items-center gap-2">
                  {genomicProfile && genomicProfile.mutations && genomicProfile.mutations.length > 0 && (
                    <button
                      onClick={() => setGenomicExpanded(!genomicExpanded)}
                      className="text-purple-600 hover:text-purple-700 flex items-center gap-1 text-sm font-medium"
                    >
                      {genomicExpanded ? (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                          Collapse
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                          Expand
                        </>
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      // Initialize editing state with current profile or empty structure
                      setEditingGenomicProfile(genomicProfile ? {
                        mutations: genomicProfile.mutations || [],
                        biomarkers: genomicProfile.biomarkers || {},
                        testName: genomicProfile.testName || '',
                        testDate: genomicProfile.testDate ? (typeof genomicProfile.testDate === 'string' ? genomicProfile.testDate.split('T')[0] : new Date(genomicProfile.testDate).toISOString().split('T')[0]) : '',
                        laboratoryName: genomicProfile.laboratoryName || '',
                        specimenType: genomicProfile.specimenType || '',
                        tumorPurity: genomicProfile.tumorPurity || '',
                        tmb: genomicProfile.tmb || genomicProfile.biomarkers?.tumorMutationalBurden?.value || '',
                        msi: genomicProfile.msi || genomicProfile.biomarkers?.microsatelliteInstability?.status || '',
                        hrdScore: genomicProfile.hrdScore || genomicProfile.biomarkers?.hrdScore?.value || '',
                        cnvs: genomicProfile.cnvs || [],
                        fusions: genomicProfile.fusions || [],
                        germlineFindings: genomicProfile.germlineFindings || []
                      } : {
                        mutations: [],
                        biomarkers: {},
                        testName: '',
                        testDate: '',
                        laboratoryName: '',
                        specimenType: '',
                        tumorPurity: '',
                        tmb: '',
                        msi: '',
                        hrdScore: '',
                        cnvs: [],
                        fusions: [],
                        germlineFindings: []
                      });
                      setShowEditGenomic(true);
                    }}
                    className="text-purple-600 hover:text-purple-700"
                  >
                    <Edit2 size={18} />
                  </button>
                </div>
              </div>

              {/* Summary View - Always Visible */}
              {genomicProfile && genomicProfile.mutations && genomicProfile.mutations.length > 0 ? (
                <div className="bg-white rounded-lg p-3 mb-3">
                  <div className="flex flex-wrap gap-2">
                    {genomicProfile.mutations.slice(0, 5).map((mutation, idx) => (
                      <span key={idx} className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                        {mutation.gene} {formatLabel(mutation.variant || mutation.type)}
                      </span>
                    ))}
                    {genomicProfile.tmb && (
                      <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                        TMB: {genomicProfile.tmb}
                      </span>
                    )}
                    {genomicProfile.msi && (
                      <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                        MSI: {genomicProfile.msi}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-lg p-6 text-center">
                  <p className="text-gray-500 mb-4">No genomic profile data available</p>
                  <button
                    onClick={() => {
                      openDocumentOnboarding('genomic');
                    }}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                  >
                    Upload Genomic Test Report
                  </button>
                </div>
              )}

              {/* Expanded Details */}
              {genomicExpanded && genomicProfile && ((genomicProfile.mutations && genomicProfile.mutations.length > 0) || (genomicProfile.cnvs && genomicProfile.cnvs.length > 0) || genomicProfile.tmb || genomicProfile.msi || genomicProfile.hrd) && (
                <div className="space-y-3 animate-fade-scale">
                  {/* Key Mutations */}
                  <div className="bg-white rounded-lg p-4">
                    <h3 className="font-semibold text-gray-800 mb-3 text-sm flex items-center gap-2">
                      <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                      </svg>
                      Germline & Somatic Mutations
                    </h3>
                    <div className="space-y-2">
                      {genomicProfile.mutations.map((mutation, idx) => {
                        const { dna, protein, kind } = parseMutation(mutation);
                        return (
                          <div key={idx} className="flex items-start justify-between p-2 bg-purple-50 border border-purple-200 rounded">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                  <span className={`font-semibold text-gray-900 text-sm ${IMPORTANT_GENES.includes((mutation.gene||'').toUpperCase()) ? 'text-yellow-700' : ''}`}>{mutation.gene}</span>
                                <span className={`px-2 py-0.5 ${IMPORTANT_GENES.includes((mutation.gene||'').toUpperCase()) ? 'bg-yellow-100 text-yellow-800' : 'bg-purple-100 text-purple-800'} rounded text-xs font-medium`}>
                                  {formatLabel(kind || mutation.type || 'Mutation')}
                                </span>
                              </div>
                              {dna && (
                                <p className="text-xs text-gray-700 mt-1"><span className="font-medium">DNA:</span> {dna}</p>
                              )}
                              {protein && (
                                <p className="text-xs text-gray-700 mt-1"><span className="font-medium">Protein:</span> {protein}</p>
                              )}
                              {!dna && !protein && mutation.variant && (
                                <p className="text-xs text-gray-700 mt-1">{mutation.variant}</p>
                              )}
                              {mutation.significance && (
                                <div className="mt-1">
                                  <p className="text-xs text-gray-600 font-medium">{formatSignificance(mutation.significance)}</p>
                                  {significanceExplanation(mutation.significance) && (
                                    <p className="text-xs text-gray-500 mt-0.5">{significanceExplanation(mutation.significance)}</p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Copy Number Variants (CNVs) */}
                  {genomicProfile.cnvs && genomicProfile.cnvs.length > 0 && (
                    <div className="bg-white rounded-lg p-4">
                      <h3 className="font-semibold text-gray-800 mb-3 text-sm flex items-center gap-2">
                        <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        Copy Number Variants (CNVs)
                      </h3>
                      <div className="space-y-2">
                        {genomicProfile.cnvs.map((cnv, idx) => (
                          <div key={idx} className="flex items-start justify-between p-2 bg-orange-50 border border-orange-200 rounded">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className={`font-semibold text-gray-900 text-sm ${IMPORTANT_GENES.includes((cnv.gene||'').toUpperCase()) ? 'text-yellow-700' : ''}`}>
                                  {cnv.gene}
                                </span>
                                <span className="px-2 py-0.5 bg-orange-100 text-orange-800 rounded text-xs font-medium">
                                  {cnv.type === 'amplification' || cnv.type === 'gain' || (cnv.copyNumber && cnv.copyNumber > 2) ? 'Amplification' : 'Deletion'}
                                </span>
                                {IMPORTANT_GENES.includes((cnv.gene||'').toUpperCase()) && (
                                  <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">
                                    Important
                                  </span>
                                )}
                              </div>
                              {cnv.copyNumber && (
                                <p className="text-xs text-gray-700 mt-1">
                                  <span className="font-medium">Copy Number:</span> {cnv.copyNumber}
                                </p>
                              )}
                              {cnv.note && (
                                <p className="text-xs text-gray-600 mt-1">{cnv.note}</p>
                              )}
                              {cnv.gene === 'CCNE1' && (
                                <p className="text-xs text-orange-700 font-medium mt-1 flex items-center gap-1">
                                  <AlertCircle className="w-4 h-4" /> Platinum resistance marker - important for treatment planning
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Biomarkers */}
                  <div className="bg-white rounded-lg p-4">
                    <h3 className="font-semibold text-gray-800 mb-3 text-sm flex items-center gap-2">
                      <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      Biomarkers
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      {genomicProfile.hrd && (
                        <div className="p-2 bg-purple-50 border border-purple-200 rounded">
                          <p className="text-xs text-gray-600 mb-1">HRD Score</p>
                          <p className="text-lg font-bold text-purple-900">{genomicProfile.hrd}</p>
                          <p className="text-xs text-purple-700 font-medium">
                            {genomicProfile.hrd >= 42 ? 'Positive (≥42)' : 'Negative (<42)'}
                          </p>
                        </div>
                      )}

                      {genomicProfile.tmb && (
                        <div className="p-2 bg-blue-50 border border-blue-200 rounded">
                          <p className="text-xs text-gray-600 mb-1">TMB</p>
                          <p className="text-lg font-bold text-blue-900">{genomicProfile.tmb}</p>
                          <p className="text-xs text-blue-700 font-medium">
                            {parseFloat(genomicProfile.tmb) >= 10 ? 'High (≥10 mut/Mb)' : 'Low (<10 mut/Mb)'}
                          </p>
                        </div>
                      )}

                      {genomicProfile.msi && (
                        <div className="p-2 bg-green-50 border border-green-200 rounded">
                          <p className="text-xs text-gray-600 mb-1">MSI Status</p>
                          <p className="text-sm font-bold text-green-900">{genomicProfile.msi}</p>
                          <p className="text-xs text-green-700 font-medium">Microsatellite status</p>
                        </div>
                      )}

                      {genomicProfile.pdl1 && (
                        <div className="p-2 bg-teal-50 border border-teal-200 rounded">
                          <p className="text-xs text-gray-600 mb-1">PD-L1</p>
                          <p className="text-sm font-bold text-teal-900">{genomicProfile.pdl1}</p>
                          <p className="text-xs text-teal-700 font-medium">Expression level</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Test Information */}
                  {(genomicProfile.testType || genomicProfile.testDate || genomicProfile.sampleType) && (
                    <div className="bg-white rounded-lg p-3">
                      <h3 className="font-semibold text-gray-800 mb-2 text-sm">Test Information</h3>
                      <div className="space-y-1 text-xs">
                        {genomicProfile.testType && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Test Type:</span>
                            <span className="font-medium text-gray-900">{genomicProfile.testType}</span>
                          </div>
                        )}
                        {genomicProfile.sampleType && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Sample:</span>
                            <span className="font-medium text-gray-900">{genomicProfile.sampleType}</span>
                          </div>
                        )}
                        {genomicProfile.testDate && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Test Date:</span>
                            <span className="font-medium text-gray-900">
                              {genomicProfile.testDate instanceof Date 
                                ? genomicProfile.testDate.toLocaleDateString() 
                                : typeof genomicProfile.testDate === 'string' 
                                  ? genomicProfile.testDate 
                                  : new Date(genomicProfile.testDate).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                        {genomicProfile.genesAnalyzed && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Genes Analyzed:</span>
                            <span className="font-medium text-gray-900">{genomicProfile.genesAnalyzed}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Treatment Implications */}
                  <div className="bg-purple-100 border border-purple-300 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-purple-700 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="text-xs font-semibold text-purple-900">Treatment Implications</p>
                        <p className="text-xs text-purple-800 mt-1">
                          BRCA1 mutation indicates high sensitivity to PARP inhibitors (Olaparib, Niraparib).
                          HRD-positive status supports platinum-based chemotherapy.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Medical Team & Emergency Contacts - Side by Side */}
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Medical Team */}
              <div className="flex-1 bg-white rounded-lg shadow-sm p-4 border-2 border-medical-primary-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="bg-medical-primary-50 p-2.5 rounded-lg">
                      <Users className="w-5 h-5 text-medical-primary-600" />
                    </div>
                    <h2 className="font-semibold text-gray-800">Medical Team</h2>
                  </div>
                  <button
                    onClick={() => setShowEditMedicalTeam(true)}
                    className="text-medical-primary-600 hover:text-medical-primary-700"
                  >
                    <Edit2 size={18} />
                  </button>
                </div>
                <div className="text-sm text-gray-700 space-y-1">
                  <p><strong>Oncologist:</strong> {patientProfile.oncologist || '—'}</p>
                  <p><strong>Hospital/Clinic:</strong> {patientProfile.hospital || '—'}</p>
                  {(() => {
                    const pc = emergencyContacts.find(c => c.contactType === 'primaryCare' || c.contactType === 'primary_care' || c.contactType === 'primary');
                    if (pc) {
                      return <p><strong>Primary Care:</strong> {pc.name} {pc.phone ? `(${pc.phone})` : ''}</p>;
                    }
                    return <p><strong>Primary Care:</strong> —</p>;
                  })()}
                </div>
              </div>

              {/* Emergency Contacts */}
              <div className="flex-1 bg-white rounded-lg shadow-sm p-4 border-2 border-amber-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="bg-amber-50 p-2.5 rounded-lg">
                      <Phone className="w-5 h-5 text-amber-600" />
                    </div>
                    <h2 className="font-semibold text-gray-800">Emergency Contacts</h2>
                  </div>
                  <button
                    onClick={() => { setEditContacts(emergencyContacts.length ? emergencyContacts : []); setShowEditContacts(true); }}
                    className="text-amber-600 hover:text-amber-700"
                  >
                    <Edit2 size={18} />
                  </button>
                </div>
                {emergencyContacts.length > 0 ? (
                  <div className="space-y-2">
                    {emergencyContacts.map((contact, idx) => {
                      const colors = ['blue', 'green', 'purple', 'orange'];
                      const color = colors[idx % colors.length];
                      return (
                        <div key={contact.id} className={`bg-${color}-50 rounded-lg p-3`}>
                          <div className="flex items-center gap-2 mb-1">
                            <User size={14} className={`text-${color}-600`} />
                            <p className="text-xs text-gray-600 font-medium">{contact.relationship}</p>
                          </div>
                          <p className="text-sm font-semibold text-gray-900">{contact.name}</p>
                          <p className="text-xs text-gray-600 mt-0.5">{contact.phone}</p>
                          {contact.email && (
                            <p className="text-xs text-gray-600">{contact.email}</p>
                          )}
                          {contact.address && (
                            <p className="text-xs text-gray-600">{contact.address}{contact.city ? `, ${contact.city}` : ''}{contact.state ? ` ${contact.state}` : ''}{contact.zip ? ` ${contact.zip}` : ''}</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <User className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm mb-3">No emergency contacts added</p>
                    <button
                      onClick={() => { setEditContacts(emergencyContacts.length ? emergencyContacts : [{ contactType: 'Emergency', name: '', relationship: '', phone: '', email: '', address: '', city: '', state: '', zip: '' }]); setShowEditContacts(true); }}
                      className="text-blue-600 text-sm font-medium hover:underline"
                    >
                      Add Emergency Contact
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Account Privacy & Deletion */}
            <div className="bg-red-50 border border-red-100 rounded-lg p-4 mt-6">
              <h2 className="font-semibold text-red-800 mb-1">Account & Privacy</h2>
              <p className="text-xs text-red-700 mb-4">
                Permanently clear your health records or delete your entire account. These actions cannot be undone.
              </p>
              <div className="space-y-3">
                <button
                  onClick={() => {
                    setDeletionType('data');
                    setShowDeletionConfirm(true);
                  }}
                  className="w-full py-2 px-4 bg-white border border-red-200 text-red-600 font-medium text-sm rounded-lg hover:bg-red-50 transition"
                >
                  Clear Health Data ONLY
                </button>
                <button
                  onClick={() => {
                    setDeletionType('account');
                    setShowDeletionConfirm(true);
                  }}
                  className="w-full py-2 px-4 bg-red-600 text-white font-medium text-sm rounded-lg hover:bg-red-700 transition"
                >
                  Delete Data & Remove Account
                </button>
              </div>
            </div>

            {/* Sign Out Section */}
            {user && (
              <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Signed in as</p>
                    <p className="text-sm font-medium text-gray-900">{user.email}</p>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Deletion Confirmation Modal */}
        {showDeletionConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl animate-fade-scale">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 mx-auto">
                <AlertCircle className="text-red-600" size={24} />
              </div>

              <h3 className="text-lg font-bold text-gray-900 text-center mb-2">
                {deletionType === 'data' ? 'Clear Health Records?' : 'Delete Account Forever?'}
              </h3>

              <p className="text-sm text-gray-600 text-center mb-6">
                {deletionType === 'data'
                  ? 'This will erase all your labs, vitals, and documents. Your profile and login will remain.'
                  : 'This will permanently delete your account and all health data from our servers.'}
                <br />
                <span className="font-bold text-red-600 mt-2 block">This action is irreversible.</span>
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={() => handleDeleteData(deletionType)}
                  disabled={isDeleting}
                  className={`w-full py-3 rounded-xl font-bold text-white transition-all shadow-lg ${isDeleting ? 'bg-gray-400' : 'bg-red-600 hover:bg-red-700 active:scale-[0.98]'}`}
                >
                  {isDeleting ? 'Processing...' : 'Yes, Delete Permanently'}
                </button>
                <button
                  onClick={() => setShowDeletionConfirm(false)}
                  disabled={isDeleting}
                  className="w-full py-3 rounded-xl font-bold text-gray-700 hover:bg-gray-100 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

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

      {/* Bottom Navigation - Fixed */}
      <div className="bg-white border-t px-2 sm:px-4 py-2 flex-shrink-0 fixed bottom-0 left-0 right-0 z-10">
        <div className="flex justify-around items-center">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all duration-200 ${activeTab === 'dashboard' ? 'text-medical-primary-600 bg-medical-primary-50' : 'text-medical-neutral-600 hover:text-medical-primary-600 hover:bg-medical-neutral-50'
              }`}
          >
            <Home className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-xs font-medium">Home</span>
          </button>

          <button
            onClick={() => setActiveTab('chat')}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all duration-200 ${activeTab === 'chat' ? 'text-medical-primary-600 bg-medical-primary-50' : 'text-medical-neutral-600 hover:text-medical-primary-600 hover:bg-medical-neutral-50'
              }`}
          >
            <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-xs font-medium">Chat</span>
          </button>

          <button
            onClick={() => setActiveTab('health')}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all duration-200 ${activeTab === 'health' ? 'text-medical-primary-600 bg-medical-primary-50' : 'text-medical-neutral-600 hover:text-medical-primary-600 hover:bg-medical-neutral-50'
              }`}
          >
            <Activity className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-xs font-medium">Health</span>
          </button>

          <button
            onClick={() => setActiveTab('trials')}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all duration-200 ${activeTab === 'trials' ? 'text-medical-primary-600 bg-medical-primary-50' : 'text-medical-neutral-600 hover:text-medical-primary-600 hover:bg-medical-neutral-50'
              }`}
          >
            <Search className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-xs font-medium">Trials</span>
          </button>

          <button
            onClick={() => setActiveTab('files')}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all duration-200 ${activeTab === 'files' ? 'text-medical-primary-600 bg-medical-primary-50' : 'text-medical-neutral-600 hover:text-medical-primary-600 hover:bg-medical-neutral-50'
              }`}
          >
            <FolderOpen className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-xs font-medium">Files</span>
          </button>
        </div>
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
                          
                          // Add user message immediately
                          setMessages(prev => [...prev, { type: 'user', text: userMessage }]);
                          
                          try {
                            // Process message with AI to extract and save medical data
                            const result = await processChatMessage(
                              userMessage,
                              user.uid,
                              messages.slice(-10).map(msg => ({
                                role: msg.type === 'user' ? 'user' : 'assistant',
                                content: msg.text
                              }))
                            );

                            // Build response text
                            let responseText = result.response;

                            // Add extraction summary if data was extracted
                            if (result.extractedData) {
                              const summary = generateChatExtractionSummary(result.extractedData);
                              if (summary) {
                                responseText += summary;
                              }
                            }

                            // Add AI response
                            setMessages(prev => [...prev, {
                              type: 'ai',
                              text: responseText,
                              isAnalysis: !!result.extractedData
                            }]);

                            // Reload health data if values were extracted
                            if (result.extractedData) {
                              await reloadHealthData();
                            }
                            
                            // Switch to chat tab to show the conversation
                            setActiveTab('chat');
                          } catch (error) {
                            console.error('Error processing quick log message:', error);
                            setMessages(prev => [...prev, {
                              type: 'ai',
                              text: 'Sorry, I\'m having trouble processing your message right now. Please try again in a moment.'
                            }]);
                            setActiveTab('chat');
                          }
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
                          alert('Please fill in all required fields (Symptom Type and Severity)');
                          return;
                        }
                        
                        if (!user) {
                          alert('Please log in to save symptoms');
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
                          // Optionally show a success message
                          setMessages(prev => [...prev, {
                            type: 'ai',
                            text: `Logged symptom: ${quickLogSymptomForm.name} (${quickLogSymptomForm.severity})`
                          }]);
                        } catch (error) {
                          console.error('Error saving symptom:', error);
                          alert('Failed to save symptom. Please try again.');
                        }
                      }}
                      className="w-full mt-4 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition"
                    >
                      Log Symptom
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      }

      {/* Add Symptom Modal - Only show in health page symptoms section */}
      {
        showAddSymptomModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 md:p-4">
            <div className="bg-white w-full h-full md:h-auto md:rounded-2xl md:max-w-md md:max-h-[85vh] overflow-hidden flex flex-col animate-slide-up">
              <div className="flex-shrink-0 bg-white border-b p-4 flex items-center justify-between">
                <h3 className="font-bold text-lg text-gray-800">Log Symptom</h3>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowAddSymptomModal(false);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                  type="button"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
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
                      value={symptomForm.name}
                      onChange={(e) => setSymptomForm({...symptomForm, name: e.target.value})}
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
                        onClick={() => setSymptomForm({...symptomForm, severity: 'mild'})}
                        className={`border-2 rounded-lg py-3 text-center transition ${symptomForm.severity === 'mild' ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-green-500 hover:bg-green-50'}`}
                      >
                        <div className="w-3 h-3 bg-green-500 rounded-full mx-auto mb-1"></div>
                        <div className="text-sm font-medium text-gray-700">Mild</div>
                      </button>
                      <button 
                        onClick={() => setSymptomForm({...symptomForm, severity: 'moderate'})}
                        className={`border-2 rounded-lg py-3 text-center transition ${symptomForm.severity === 'moderate' ? 'border-yellow-500 bg-yellow-50' : 'border-gray-300 hover:border-yellow-500 hover:bg-yellow-50'}`}
                      >
                        <div className="w-3 h-3 bg-yellow-500 rounded-full mx-auto mb-1"></div>
                        <div className="text-sm font-medium text-gray-700">Moderate</div>
                      </button>
                      <button 
                        onClick={() => setSymptomForm({...symptomForm, severity: 'severe'})}
                        className={`border-2 rounded-lg py-3 text-center transition ${symptomForm.severity === 'severe' ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-red-500 hover:bg-red-50'}`}
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
                        value={symptomForm.date}
                        onChange={(e) => setSymptomForm({...symptomForm, date: e.target.value})}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                      <input
                        type="time"
                        value={symptomForm.time}
                        onChange={(e) => setSymptomForm({...symptomForm, time: e.target.value})}
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
                      value={symptomForm.notes}
                      onChange={(e) => setSymptomForm({...symptomForm, notes: e.target.value})}
                      placeholder="Additional details about the symptom..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    ></textarea>
                  </div>

                  {/* Quick Actions */}
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs font-medium text-gray-700 mb-2">Quick Actions:</p>
                    <div className="flex flex-wrap gap-2">
                      <button className="text-xs bg-white border border-gray-300 rounded-full px-3 py-1.5 hover:bg-gray-100 transition">
                        Related to treatment
                      </button>
                      <button className="text-xs bg-white border border-gray-300 rounded-full px-3 py-1.5 hover:bg-gray-100 transition">
                        Discuss with doctor
                      </button>
                      <button className="text-xs bg-white border border-gray-300 rounded-full px-3 py-1.5 hover:bg-gray-100 transition">
                        Medication needed
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-shrink-0 border-t p-4 bg-white">
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowAddSymptomModal(false);
                      setSymptomForm({
                        name: '',
                        severity: '',
                        date: new Date().toISOString().split('T')[0],
                        time: new Date().toTimeString().slice(0, 5),
                        notes: ''
                      });
                    }}
                    className="flex-1 bg-gray-200 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-300 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (!symptomForm.name || !symptomForm.severity) {
                        alert('Please fill in all required fields (Symptom Type and Severity)');
                        return;
                      }
                      
                      if (!user) {
                        alert('Please log in to save symptoms');
                        return;
                      }

                      try {
                        // Combine date and time into a single datetime
                        const dateTime = new Date(`${symptomForm.date}T${symptomForm.time}`);
                        
                        await symptomService.addSymptom({
                          patientId: user.uid,
                          name: symptomForm.name,
                          severity: symptomForm.severity,
                          date: dateTime,
                          notes: symptomForm.notes || ''
                        });

                        // Reset form and close modal
                        setSymptomForm({
                          name: '',
                          severity: '',
                          date: new Date().toISOString().split('T')[0],
                          time: new Date().toTimeString().slice(0, 5),
                          notes: ''
                        });
                        setShowAddSymptomModal(false);
                        
                        // Symptoms will automatically update via the subscription
                      } catch (error) {
                        console.error('Error saving symptom:', error);
                        alert('Failed to save symptom. Please try again.');
                      }
                    }}
                    className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition"
                  >
                    Log Symptom
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Add Medication Modal */}
      {
        showAddMedication && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 md:p-4">
            <div className="bg-white w-full h-full md:h-auto md:rounded-2xl md:max-w-md md:max-h-[85vh] overflow-hidden flex flex-col animate-slide-up">
              <div className="flex-shrink-0 bg-white border-b p-4 flex items-center justify-between">
                <h3 className="font-bold text-lg text-gray-800">Add Medication</h3>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowAddMedication(false);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                  type="button"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-blue-900">Medication Tracking</p>
                        <p className="text-xs text-blue-700 mt-1">
                          Add any medication to track dosage, schedule, and adherence.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Medication Name <span className="text-red-600">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Paclitaxel, Ibuprofen"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Dosage <span className="text-red-600">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., 20"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Unit <span className="text-red-600">*</span>
                      </label>
                      <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">Select...</option>
                        <option value="mg">mg</option>
                        <option value="mg/m²">mg/m²</option>
                        <option value="mg/kg">mg/kg</option>
                        <option value="mcg">mcg</option>
                        <option value="mL">mL</option>
                        <option value="units">units</option>
                        <option value="tablets">tablet(s)</option>
                        <option value="capsules">capsule(s)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Frequency <span className="text-red-600">*</span>
                    </label>
                    <select className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Select frequency...</option>
                      <option value="once-daily">Once daily</option>
                      <option value="twice-daily">Twice daily</option>
                      <option value="three-daily">Three times daily</option>
                      <option value="four-daily">Four times daily</option>
                      <option value="every-other">Every other day</option>
                      <option value="weekly">Weekly</option>
                      <option value="every-2-weeks">Every 2 weeks</option>
                      <option value="every-3-weeks">Every 3 weeks</option>
                      <option value="monthly">Monthly</option>
                      <option value="as-needed">As needed</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Time(s) of Day
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., 8:00 AM, 8:00 PM"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">For daily medications, specify times</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Purpose/Type <span className="text-red-600">*</span>
                    </label>
                    <select className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">Select purpose...</option>
                      <option value="chemotherapy">Chemotherapy</option>
                      <option value="targeted">Targeted therapy</option>
                      <option value="immunotherapy">Immunotherapy</option>
                      <option value="hormone">Hormone therapy</option>
                      <option value="anti-nausea">Anti-nausea</option>
                      <option value="pain">Pain management</option>
                      <option value="anti-inflammatory">Anti-inflammatory</option>
                      <option value="antibiotic">Antibiotic</option>
                      <option value="stomach">Stomach protection</option>
                      <option value="vitamin">Vitamin/Supplement</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                    <input
                      type="date"
                      defaultValue="2024-12-28"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Special Instructions <span className="text-gray-500 text-xs">(optional)</span>
                    </label>
                    <textarea
                      rows="2"
                      placeholder="e.g., Take with food, Avoid grapefruit"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    ></textarea>
                  </div>
                </div>
              </div>

              <div className="flex-shrink-0 border-t p-4 bg-white">
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowAddMedication(false)}
                    className="flex-1 bg-gray-200 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-300 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setShowAddMedication(false);
                      alert('Medication added successfully!');
                    }}
                    className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition"
                  >
                    Add Medication
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Document Upload Onboarding (First Time) */}
      {
        showDocumentOnboarding && (
          <DocumentUploadOnboarding
            isOnboarding={!hasUploadedDocument}
            onClose={() => setShowDocumentOnboarding(false)}
            onUploadClick={(documentType, documentDate = null) => {
              setShowDocumentOnboarding(false);
              // Store document date for use in upload
              setPendingDocumentDate(documentDate);
              // Check if mobile device
              const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
              
              // If mobile and method is camera, use camera upload
              // Otherwise, if mobile, show camera option in file picker
              // If not mobile, go straight to file picker
              if (documentOnboardingMethod === 'camera') {
                simulateCameraUpload(documentType);
              } else if (isMobile) {
                // On mobile, use camera upload which includes camera option
                simulateCameraUpload(documentType);
              } else {
                // On desktop, use regular file picker
                simulateDocumentUpload(documentType);
              }
            }}
          />
        )
      }

      {/* Add Lab Modal */}
      {
        showAddLab && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 md:p-4">
            <div className="bg-white w-full h-full md:h-auto md:rounded-2xl md:max-w-md md:max-h-[85vh] overflow-hidden flex flex-col animate-slide-up">
              <div className="flex-shrink-0 bg-white border-b p-4 flex items-center justify-between">
                <h3 className="font-bold text-lg text-gray-800">Add Lab Value to Track</h3>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowAddLab(false);
                    setNewLabData({ label: '', normalRange: '', unit: '' });
                  }}
                  className="text-gray-500 hover:text-gray-700"
                  type="button"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-900">Custom Lab Tracking</p>
                      <p className="text-xs text-blue-700 mt-1">
                        Select a common marker or add your own custom lab value. The AI will track trends and alert you to significant changes.
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Lab Value to Track <span className="text-red-600">*</span>
                  </label>
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        const selected = JSON.parse(e.target.value);
                        setNewLabData({
                          label: selected.name,
                          normalRange: selected.range,
                          unit: selected.unit
                        });
                      }
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select a lab marker by category...</option>

                    <optgroup label={`Disease-Specific Markers - ${categoryDescriptions['Disease-Specific Markers']}`}>
                      <option value={JSON.stringify({ name: 'CA-125', range: '<35', unit: 'U/mL' })}>CA-125 (Ovarian) - &lt;35 U/mL</option>
                      <option value={JSON.stringify({ name: 'CA 19-9', range: '<37', unit: 'U/mL' })}>CA 19-9 (Pancreatic) - &lt;37 U/mL</option>
                      <option value={JSON.stringify({ name: 'CA 15-3', range: '<30', unit: 'U/mL' })}>CA 15-3 (Breast) - &lt;30 U/mL</option>
                      <option value={JSON.stringify({ name: 'CEA', range: '<3', unit: 'ng/mL' })}>CEA (Colorectal) - &lt;3 ng/mL</option>
                      <option value={JSON.stringify({ name: 'AFP', range: '<10', unit: 'ng/mL' })}>AFP (Liver) - &lt;10 ng/mL</option>
                      <option value={JSON.stringify({ name: 'PSA', range: '<4', unit: 'ng/mL' })}>PSA (Prostate) - &lt;4 ng/mL</option>
                      <option value={JSON.stringify({ name: 'HE4', range: '<70', unit: 'pmol/L' })}>HE4 (Ovarian) - &lt;70 pmol/L</option>
                    </optgroup>

                    <optgroup label={`Blood Counts - ${categoryDescriptions['Blood Counts']}`}>
                      <option value={JSON.stringify({ name: 'WBC', range: '4.5-11.0', unit: 'K/μL' })}>WBC (White Blood Cells) - 4.5-11.0 K/μL</option>
                      <option value={JSON.stringify({ name: 'RBC', range: '4.5-5.5', unit: 'M/μL' })}>RBC (Red Blood Cells) - 4.5-5.5 M/μL</option>
                      <option value={JSON.stringify({ name: 'Hemoglobin', range: '12.0-16.0', unit: 'g/dL' })}>Hemoglobin - 12.0-16.0 g/dL</option>
                      <option value={JSON.stringify({ name: 'Hematocrit', range: '36-48', unit: '%' })}>Hematocrit - 36-48%</option>
                      <option value={JSON.stringify({ name: 'Platelets', range: '150-400', unit: 'K/μL' })}>Platelets - 150-400 K/μL</option>
                      <option value={JSON.stringify({ name: 'ANC', range: '>1500', unit: '/μL' })}>ANC (Absolute Neutrophil Count) - &gt;1500 /μL</option>
                      <option value={JSON.stringify({ name: 'Neutrophils', range: '40-70', unit: '%' })}>Neutrophils - 40-70%</option>
                      <option value={JSON.stringify({ name: 'Lymphocytes', range: '20-40', unit: '%' })}>Lymphocytes - 20-40%</option>
                    </optgroup>

                    <optgroup label={`Kidney Function - ${categoryDescriptions['Kidney Function']}`}>
                      <option value={JSON.stringify({ name: 'Creatinine', range: '0.6-1.2', unit: 'mg/dL' })}>Creatinine - 0.6-1.2 mg/dL</option>
                      <option value={JSON.stringify({ name: 'eGFR', range: '>60', unit: 'mL/min' })}>eGFR - &gt;60 mL/min</option>
                      <option value={JSON.stringify({ name: 'BUN', range: '7-20', unit: 'mg/dL' })}>BUN (Blood Urea Nitrogen) - 7-20 mg/dL</option>
                    </optgroup>

                    <optgroup label={`Liver Function - ${categoryDescriptions['Liver Function']}`}>
                      <option value={JSON.stringify({ name: 'ALT', range: '7-56', unit: 'U/L' })}>ALT - 7-56 U/L</option>
                      <option value={JSON.stringify({ name: 'AST', range: '10-40', unit: 'U/L' })}>AST - 10-40 U/L</option>
                      <option value={JSON.stringify({ name: 'ALP', range: '44-147', unit: 'U/L' })}>ALP (Alkaline Phosphatase) - 44-147 U/L</option>
                      <option value={JSON.stringify({ name: 'Bilirubin', range: '0.1-1.2', unit: 'mg/dL' })}>Bilirubin (Total) - 0.1-1.2 mg/dL</option>
                      <option value={JSON.stringify({ name: 'Albumin', range: '3.5-5.5', unit: 'g/dL' })}>Albumin - 3.5-5.5 g/dL</option>
                    </optgroup>

                    <optgroup label={`Electrolytes - ${categoryDescriptions['Electrolytes']}`}>
                      <option value={JSON.stringify({ name: 'Sodium', range: '136-145', unit: 'mmol/L' })}>Sodium - 136-145 mmol/L</option>
                      <option value={JSON.stringify({ name: 'Potassium', range: '3.5-5.0', unit: 'mmol/L' })}>Potassium - 3.5-5.0 mmol/L</option>
                      <option value={JSON.stringify({ name: 'Calcium', range: '8.5-10.5', unit: 'mg/dL' })}>Calcium - 8.5-10.5 mg/dL</option>
                      <option value={JSON.stringify({ name: 'Magnesium', range: '1.7-2.2', unit: 'mg/dL' })}>Magnesium - 1.7-2.2 mg/dL</option>
                      <option value={JSON.stringify({ name: 'Glucose', range: '70-100', unit: 'mg/dL' })}>Glucose (Fasting) - 70-100 mg/dL</option>
                    </optgroup>

                    <optgroup label={`Thyroid Function - ${categoryDescriptions['Thyroid Function']}`}>
                      <option value={JSON.stringify({ name: 'TSH', range: '0.4-4.0', unit: 'mIU/L' })}>TSH (Thyroid) - 0.4-4.0 mIU/L</option>
                    </optgroup>

                    <optgroup label={`Cardiac Markers - ${categoryDescriptions['Cardiac Markers']}`}>
                      <option value={JSON.stringify({ name: 'Troponin', range: '<0.04', unit: 'ng/mL' })}>Troponin - &lt;0.04 ng/mL</option>
                      <option value={JSON.stringify({ name: 'BNP', range: '<100', unit: 'pg/mL' })}>BNP - &lt;100 pg/mL</option>
                    </optgroup>

                    <optgroup label={`Inflammation - ${categoryDescriptions['Inflammation']}`}>
                      <option value={JSON.stringify({ name: 'CRP', range: '<3', unit: 'mg/L' })}>CRP (C-Reactive Protein) - &lt;3 mg/L</option>
                      <option value={JSON.stringify({ name: 'ESR', range: '0-20', unit: 'mm/hr' })}>ESR (Erythrocyte Sedimentation Rate) - 0-20 mm/hr</option>
                      <option value={JSON.stringify({ name: 'Ferritin', range: '15-200', unit: 'ng/mL' })}>Ferritin - 15-200 ng/mL</option>
                    </optgroup>

                    <optgroup label={`Coagulation - ${categoryDescriptions['Coagulation']}`}>
                      <option value={JSON.stringify({ name: 'PT', range: '11-13', unit: 'seconds' })}>PT (Prothrombin Time) - 11-13 seconds</option>
                      <option value={JSON.stringify({ name: 'INR', range: '0.9-1.1', unit: '' })}>INR - 0.9-1.1</option>
                      <option value={JSON.stringify({ name: 'D-dimer', range: '<0.5', unit: 'mg/L' })}>D-dimer - &lt;0.5 mg/L</option>
                    </optgroup>

                    <optgroup label={`Custom Values - ${categoryDescriptions['Custom Values']}`}>
                      <option disabled value="">(Add custom labs using the form below)</option>
                    </optgroup>

                    <optgroup label={`Others - ${categoryDescriptions['Others']}`}>
                      <option value={JSON.stringify({ name: 'LDH', range: '140-280', unit: 'U/L' })}>LDH (Lactate Dehydrogenase) - 140-280 U/L</option>
                      <option value={JSON.stringify({ name: 'Vitamin D', range: '30-100', unit: 'ng/mL' })}>Vitamin D - 30-100 ng/mL</option>
                      <option value={JSON.stringify({ name: 'HbA1c', range: '<5.7', unit: '%' })}>HbA1c (Diabetes) - &lt;5.7%</option>
                    </optgroup>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Common cancer-related lab values</p>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500 font-medium">Or add custom lab</span>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <h4 className="font-semibold text-gray-800 text-sm">Custom Lab Value</h4>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Lab Name *</label>
                    <input
                      type="text"
                      value={newLabData.label}
                      onChange={(e) => setNewLabData({ ...newLabData, label: e.target.value })}
                      placeholder="e.g., Vitamin D, Albumin, Magnesium"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Normal Range *</label>
                      <input
                        type="text"
                        value={newLabData.normalRange}
                        onChange={(e) => setNewLabData({ ...newLabData, normalRange: e.target.value })}
                        placeholder="e.g., <35, 4.5-11.0"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Unit *</label>
                      <input
                        type="text"
                        value={newLabData.unit}
                        onChange={(e) => setNewLabData({ ...newLabData, unit: e.target.value })}
                        placeholder="e.g., U/mL, mg/dL"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
                    <p className="text-xs text-blue-700">
                      <span className="font-semibold">Tip:</span> You can add any lab value from your medical records - the AI will learn what's normal for you over time.
                    </p>
                  </div>
                </div>

                {newLabData.label && newLabData.normalRange && newLabData.unit && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-xs font-medium text-green-900 mb-1">Preview:</p>
                    <p className="text-sm text-green-800">
                      <strong>{newLabData.label}</strong> • Normal: {newLabData.normalRange} {newLabData.unit}
                    </p>
                  </div>
                )}
              </div>

              <div className="flex-shrink-0 border-t p-4 bg-white">
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowAddLab(false);
                      setNewLabData({ label: '', normalRange: '', unit: '' });
                    }}
                    className="flex-1 bg-gray-200 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-300 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (newLabData.label && newLabData.normalRange && newLabData.unit) {
                        alert(`Added ${newLabData.label} to your tracked labs!\n\nNormal Range: ${newLabData.normalRange} ${newLabData.unit}\n\nYou can now log values and track trends for this marker.`);
                        setNewLabData({ label: '', normalRange: '', unit: '' });
                        setShowAddLab(false);
                      }
                    }}
                    className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
                    disabled={!newLabData.label || !newLabData.normalRange || !newLabData.unit}
                  >
                    Add Lab Value
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Log Vital Reading Modal */}
      {
        showAddVital && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 md:p-4">
            <div className="bg-white w-full h-full md:h-auto md:rounded-2xl md:max-w-md md:max-h-[85vh] overflow-hidden flex flex-col animate-slide-up">
              <div className="flex-shrink-0 bg-white border-b p-4 flex items-center justify-between">
                <h3 className="font-bold text-lg text-gray-800">Log Vital Reading</h3>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowAddVital(false);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                  type="button"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-900">Log Vital Reading</p>
                      <p className="text-xs text-blue-700 mt-1">
                        All vitals are tracked automatically. Select which vital you measured and enter the reading.
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Vital Sign <span className="text-red-600">*</span>
                  </label>
                  <select className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select vital sign...</option>
                    <option value="bp">Blood Pressure</option>
                    <option value="hr">Heart Rate</option>
                    <option value="temp">Temperature</option>
                    <option value="weight">Weight</option>
                    <option value="o2sat">Oxygen Saturation</option>
                    <option value="rr">Respiratory Rate</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reading <span className="text-red-600">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      placeholder="Systolic"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="number"
                      placeholder="Diastolic"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">For blood pressure, enter both values</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date & Time</label>
                  <input
                    type="datetime-local"
                    defaultValue={new Date().toISOString().slice(0, 16)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes <span className="text-gray-500 text-xs">(optional)</span>
                  </label>
                  <textarea
                    rows="2"
                    placeholder="e.g., Taken after rest, morning reading"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  ></textarea>
                </div>
              </div>

              <div className="flex-shrink-0 border-t p-4 bg-white">
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowAddVital(false)}
                    className="flex-1 bg-gray-200 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-300 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      setShowAddVital(false);
                      alert('Vital reading logged successfully!');
                    }}
                    className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition"
                  >
                    Log Reading
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Edit Location Modal - Comprehensive */}
      {
        showEditLocation && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
            <div className="bg-white w-full h-full sm:h-auto sm:max-w-lg sm:rounded-xl sm:max-h-[85vh] flex flex-col animate-slide-up">
              <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
                <h3 className="text-lg font-semibold text-gray-900">Trial Search Location</h3>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowEditLocation(false);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                  type="button"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-green-900">Trial Matching</p>
                      <p className="text-xs text-green-700 mt-0.5">
                        Your location helps us find clinical trials from ClinicalTrials.gov. You can enable global search to include international trials.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={trialLocation.includeAllLocations}
                      onChange={(e) => setTrialLocation({ ...trialLocation, includeAllLocations: e.target.checked })}
                      className="mt-1 w-4 h-4 text-green-600 rounded focus:ring-green-500"
                    />
                    <div>
                      <p className="font-semibold text-gray-800">Include Global Locations</p>
                      <p className="text-xs text-gray-600 mt-1">
                        Search international databases for all available clinical trials worldwide
                      </p>
                    </div>
                  </label>
                </div>

                <div className={trialLocation.includeAllLocations ? 'opacity-50' : ''}>
                  <h4 className="font-semibold text-gray-800 mb-3">Search Country</h4>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                    <select
                      value={trialLocation.country}
                      onChange={(e) => setTrialLocation({ ...trialLocation, country: e.target.value })}
                      disabled={trialLocation.includeAllLocations}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
                    >
                      {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      {trialLocation.includeAllLocations 
                        ? 'Global search is enabled - country selection disabled'
                        : 'Trials will be searched within this country'}
                    </p>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-3">
                  <h5 className="text-sm font-semibold text-gray-800 mb-2">Database</h5>
                  <div className="space-y-1 text-xs text-gray-600">
                    <div className="flex items-center gap-2">
                      <div className="w-1 h-1 bg-green-600 rounded-full"></div>
                      <span>ClinicalTrials.gov</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t p-4 flex gap-3 flex-shrink-0">
                <button
                  onClick={() => setShowEditLocation(false)}
                  className="flex-1 bg-gray-200 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-300 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    try {
                      await trialLocationService.saveTrialLocation(user.uid, trialLocation);
                      setShowEditLocation(false);
                      setMessages(prev => [...prev, {
                        type: 'ai',
                        text: 'Trial search location updated successfully!'
                      }]);
                    } catch (error) {
                      console.error('Error saving trial location:', error);
                      alert('Failed to save location settings. Please try again.');
                    }
                  }}
                  className="flex-1 bg-green-600 text-white py-2.5 rounded-lg font-medium hover:bg-green-700 transition"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Edit Patient Info Modal */}
      {
        showEditInfo && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 md:p-4">
            <div className="bg-white w-full h-full md:h-auto md:rounded-2xl md:max-w-md md:max-h-[85vh] overflow-hidden flex flex-col animate-slide-up">
              <div className="flex-shrink-0 bg-white border-b p-4 flex items-center justify-between">
                <h3 className="font-bold text-lg text-gray-800">Edit Patient Information</h3>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowEditInfo(false);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                  type="button"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                      <input
                        type="text"
                        value={patientProfile.firstName || ''}
                        onChange={(e) => setPatientProfile({ ...patientProfile, firstName: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Middle Name</label>
                      <input
                        type="text"
                        value={patientProfile.middleName || ''}
                        onChange={(e) => setPatientProfile({ ...patientProfile, middleName: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                      <input
                        type="text"
                        value={patientProfile.lastName || ''}
                        onChange={(e) => setPatientProfile({ ...patientProfile, lastName: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Age *</label>
                      <input
                        type="number"
                        value={patientProfile.age}
                        onChange={(e) => setPatientProfile({ ...patientProfile, age: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                      <input
                        type="date"
                        value={patientProfile.dateOfBirth}
                        onChange={(e) => setPatientProfile({ ...patientProfile, dateOfBirth: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                    <select
                      value={patientProfile.gender || ''}
                      onChange={(e) => setPatientProfile({ ...patientProfile, gender: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Height (cm)</label>
                      <input
                        type="number"
                        value={patientProfile.height}
                        onChange={(e) => setPatientProfile({ ...patientProfile, height: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={patientProfile.weight}
                        onChange={(e) => setPatientProfile({ ...patientProfile, weight: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    {/* Oncologist moved to Medical Team (Edit Contacts) */}
                  </div>

                  <div>
                    {/* Hospital/Clinic moved to Medical Team (Edit Contacts) */}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                    <select
                      value={patientProfile.country || 'United States'}
                      onChange={(e) => setPatientProfile({ ...patientProfile, country: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="United States">United States</option>
                      <option value="United Kingdom">United Kingdom</option>
                      <option value="Canada">Canada</option>
                      <option value="Australia">Australia</option>
                      <option value="Japan">Japan</option>
                      <option value="Germany">Germany</option>
                      <option value="France">France</option>
                      <option value="India">India</option>
                      <option value="China">China</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                      {/* Primary Care is managed as a contact entry via Edit Contacts */}

                </div>
              </div>

              <div className="flex-shrink-0 border-t p-4 bg-white">
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowEditInfo(false)}
                    className="flex-1 bg-gray-200 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-300 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        // Construct name from first/middle/last
                        const fullName = `${patientProfile.firstName || ''} ${patientProfile.middleName ? patientProfile.middleName + ' ' : ''}${patientProfile.lastName || ''}`.trim();
                        const toSave = {
                          firstName: patientProfile.firstName || '',
                          middleName: patientProfile.middleName || '',
                          lastName: patientProfile.lastName || '',
                          name: fullName || patientProfile.name,
                          age: parseInt(patientProfile.age) || null,
                          dateOfBirth: patientProfile.dateOfBirth,
                          gender: patientProfile.gender || '',
                          weight: parseFloat(patientProfile.weight) || null,
                          height: parseFloat(patientProfile.height) || null,
                          country: patientProfile.country || ''
                        };
                        console.log('Saving Edit Patient Info:', toSave);
                        await patientService.savePatient(user.uid, toSave);
                        // verify saved
                        const saved = await patientService.getPatient(user.uid);
                        console.log('Saved patient profile after edit:', saved);
                        // Ensure UI reflects saved values
                        setPatientProfile(prev => ({
                          ...prev,
                          firstName: patientProfile.firstName || prev.firstName,
                          middleName: patientProfile.middleName || prev.middleName,
                          lastName: patientProfile.lastName || prev.lastName,
                          name: fullName || patientProfile.name || prev.name,
                          age: parseInt(patientProfile.age) || '',
                          dateOfBirth: patientProfile.dateOfBirth,
                          gender: patientProfile.gender || prev.gender,
                          weight: patientProfile.weight,
                          height: patientProfile.height,
                          country: patientProfile.country || prev.country
                        }));
                        setShowEditInfo(false);
                        setMessages(prev => [...prev, {
                          type: 'ai',
                          text: 'Patient information updated successfully!'
                        }]);
                      } catch (error) {
                        console.error('Error saving patient info:', error);
                        alert('Failed to save patient information. Please try again.');
                      }
                    }}
                    className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Update Status Modal */}
      {
        showUpdateStatus && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 md:p-4">
            <div className="bg-white w-full h-full md:h-auto md:rounded-2xl md:max-w-md md:max-h-[85vh] overflow-hidden flex flex-col animate-slide-up">
              <div className="flex-shrink-0 bg-white border-b p-4 flex items-center justify-between">
                <h3 className="font-bold text-lg text-gray-800">Update Current Status</h3>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowUpdateStatus(false);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                  type="button"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-4">
                  {/* Cancer Type - matching onboarding */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cancer Type *</label>
                    <select
                      value={currentStatus.diagnosis || ''}
                      onChange={(e) => {
                        const newDiagnosis = e.target.value;
                        setCurrentStatus({
                          ...currentStatus,
                          diagnosis: newDiagnosis,
                          subtype: '' // Clear subtype when cancer type changes
                        });
                        setUpdateStatusSubtypeCustom(false);
                      }}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select cancer type</option>
                      {CANCER_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  {/* Cancer Subtype - matching onboarding */}
                  {currentStatus.diagnosis && (CANCER_SUBTYPES[currentStatus.diagnosis] || []).length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Cancer Subtype (optional)</label>
                      <select
                        value={currentStatus.subtype === 'Other (specify)' ? 'Other (specify)' : (currentStatus.subtype || '')}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === 'Other (specify)') {
                            setCurrentStatus({ ...currentStatus, subtype: 'Other (specify)' });
                            setUpdateStatusSubtypeCustom(true);
                          } else {
                            setCurrentStatus({ ...currentStatus, subtype: value });
                            setUpdateStatusSubtypeCustom(false);
                          }
                        }}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select subtype (optional)</option>
                        {CANCER_SUBTYPES[currentStatus.diagnosis].map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      {updateStatusSubtypeCustom && (
                        <input
                          type="text"
                          value={currentStatus.subtype === 'Other (specify)' ? '' : currentStatus.subtype}
                          onChange={(e) => setCurrentStatus({ ...currentStatus, subtype: e.target.value })}
                          className="w-full mt-2 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Specify subtype"
                        />
                      )}
                    </div>
                  )}

                  {/* Stage - matching onboarding */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Stage *</label>
                    <select
                      value={currentStatus.stage || ''}
                      onChange={(e) => setCurrentStatus({...currentStatus, stage: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select stage</option>
                      {STAGE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  {/* Diagnosis Date - matching onboarding */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date of Diagnosis *</label>
                    <input
                      type="date"
                      value={currentStatus.diagnosisDate || ''}
                      onChange={(e) => setCurrentStatus({...currentStatus, diagnosisDate: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Treatment Status - matching onboarding */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Treatment Status *</label>
                    <select
                      value={currentStatus.treatmentLine === 'Other (specify)' ? 'Other (specify)' : (currentStatus.treatmentLine || '')}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === 'Other (specify)') {
                          setCurrentStatus({ ...currentStatus, treatmentLine: 'Other (specify)' });
                          setUpdateStatusTreatmentCustom(true);
                        } else {
                          setCurrentStatus({ ...currentStatus, treatmentLine: value });
                          setUpdateStatusTreatmentCustom(false);
                        }
                      }}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select treatment status</option>
                      {TREATMENT_STATUS_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    {updateStatusTreatmentCustom && (
                      <input
                        type="text"
                        value={currentStatus.treatmentLine === 'Other (specify)' ? '' : currentStatus.treatmentLine}
                        onChange={(e) => setCurrentStatus({ ...currentStatus, treatmentLine: e.target.value })}
                        className="w-full mt-2 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Specify treatment status"
                      />
                    )}
                  </div>

                  {/* Current Regimen - keep this as it's useful */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Current Regimen</label>
                    <input
                      type="text"
                      value={currentStatus.currentRegimen || ''}
                      onChange={(e) => setCurrentStatus({...currentStatus, currentRegimen: e.target.value})}
                      placeholder="e.g., Carboplatin + Paclitaxel"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Performance Status - matching onboarding */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ECOG Performance *</label>
                    <select
                      value={currentStatus.performanceStatus || ''}
                      onChange={(e) => setCurrentStatus({...currentStatus, performanceStatus: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select ECOG</option>
                      {PERFORMANCE_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>

                  {/* Disease Status - matching onboarding */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Disease Status *</label>
                    <select
                      value={currentStatus.diseaseStatus || ''}
                      onChange={(e) => setCurrentStatus({...currentStatus, diseaseStatus: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select status</option>
                      {DISEASE_STATUS_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>

                  {/* Baseline CA-125 - matching onboarding */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Baseline CA-125 (optional)</label>
                    <input
                      type="number"
                      step="any"
                      value={currentStatus.baselineCa125 || ''}
                      onChange={(e) => setCurrentStatus({...currentStatus, baselineCa125: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex-shrink-0 border-t p-4 bg-white">
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowUpdateStatus(false)}
                    className="flex-1 bg-gray-200 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-300 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        // Process subtype - if it's "Other (specify)", use the custom value
                        const finalSubtype = currentStatus.subtype === 'Other (specify)' ? '' : (currentStatus.subtype || '');
                        // Process treatment status - if it's "Other (specify)", use the custom value
                        const finalTreatmentStatus = currentStatus.treatmentLine === 'Other (specify)' ? '' : (currentStatus.treatmentLine || '');
                        
                        // Save current status and top-level diagnosis to patient document
                        await patientService.savePatient(user.uid, {
                          currentStatus: {
                            ...currentStatus,
                            subtype: finalSubtype,
                            stage: currentStatus.stage || '',
                            treatmentLine: finalTreatmentStatus
                          },
                          diagnosis: currentStatus.diagnosis || '',
                          diagnosisDate: currentStatus.diagnosisDate || '',
                          cancerType: finalSubtype || '', // Save subtype to cancerType field
                          stage: currentStatus.stage || ''
                        });
                        setShowUpdateStatus(false);
                        // Update local UI state
                        setCurrentStatus({
                          ...currentStatus,
                          subtype: finalSubtype,
                          stage: currentStatus.stage || '',
                          treatmentLine: finalTreatmentStatus
                        });
                        setPatientProfile(prev => ({ 
                          ...prev, 
                          diagnosis: currentStatus.diagnosis || prev.diagnosis, 
                          diagnosisDate: currentStatus.diagnosisDate || prev.diagnosisDate,
                          cancerType: finalSubtype || prev.cancerType,
                          stage: currentStatus.stage || prev.stage
                        }));
                        setMessages(prev => [...prev, { type: 'ai', text: 'Current status updated successfully!' }]);
                      } catch (err) {
                        console.error('Failed to save current status', err);
                        alert('Failed to save current status.');
                      }
                    }}
                    className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Edit Genomic Profile Modal */}
      {
        showEditGenomic && editingGenomicProfile && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 md:p-4">
            <div className="bg-white w-full h-full md:h-auto md:rounded-2xl md:max-w-4xl md:max-h-[90vh] overflow-hidden flex flex-col animate-slide-up">
              <div className="flex-shrink-0 bg-white border-b p-4 flex items-center justify-between">
                <h3 className="font-bold text-lg text-gray-800">Edit Genomic Profile</h3>
                <button
                  onClick={() => {
                    setShowEditGenomic(false);
                    setEditingGenomicProfile(null);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-purple-900">Genomic Testing</p>
                      <p className="text-xs text-purple-700 mt-0.5">
                        Update your genomic test results to help match with relevant clinical trials
                      </p>
                    </div>
                  </div>
                </div>

                {/* Test Information */}
                <div>
                  <h4 className="font-semibold text-gray-800 mb-3">Test Information</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Test Name</label>
                      <input
                        type="text"
                        value={editingGenomicProfile.testName || ''}
                        onChange={(e) => setEditingGenomicProfile({...editingGenomicProfile, testName: e.target.value})}
                        placeholder="e.g., FoundationOne CDx, Guardant360"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Test Date</label>
                      <input
                        type="date"
                        value={editingGenomicProfile.testDate || ''}
                        onChange={(e) => setEditingGenomicProfile({...editingGenomicProfile, testDate: e.target.value})}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Laboratory Name</label>
                      <input
                        type="text"
                        value={editingGenomicProfile.laboratoryName || ''}
                        onChange={(e) => setEditingGenomicProfile({...editingGenomicProfile, laboratoryName: e.target.value})}
                        placeholder="e.g., Foundation Medicine"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Specimen Type</label>
                      <input
                        type="text"
                        value={editingGenomicProfile.specimenType || ''}
                        onChange={(e) => setEditingGenomicProfile({...editingGenomicProfile, specimenType: e.target.value})}
                        placeholder="e.g., FFPE tissue, Blood (ctDNA)"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tumor Purity</label>
                      <input
                        type="text"
                        value={editingGenomicProfile.tumorPurity || ''}
                        onChange={(e) => setEditingGenomicProfile({...editingGenomicProfile, tumorPurity: e.target.value})}
                        placeholder="e.g., 70%"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Mutations */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-gray-800">Mutations</h4>
                    <button
                      onClick={() => {
                        setEditingGenomicProfile({
                          ...editingGenomicProfile,
                          mutations: [...(editingGenomicProfile.mutations || []), { gene: '', variant: '', dna: '', protein: '', significance: '', type: '' }]
                        });
                      }}
                      className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                    >
                      + Add Mutation
                    </button>
                  </div>
                  <div className="space-y-3">
                    {editingGenomicProfile.mutations && editingGenomicProfile.mutations.length > 0 ? (
                      editingGenomicProfile.mutations.map((mutation, idx) => (
                        <div key={idx} className="border border-gray-200 rounded-lg p-3 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Gene</label>
                              <input
                                type="text"
                                value={mutation.gene || ''}
                                onChange={(e) => {
                                  const updated = [...editingGenomicProfile.mutations];
                                  updated[idx] = {...updated[idx], gene: e.target.value};
                                  setEditingGenomicProfile({...editingGenomicProfile, mutations: updated});
                                }}
                                placeholder="e.g., BRCA1"
                                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-purple-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Variant/Alteration</label>
                              <input
                                type="text"
                                value={mutation.variant || mutation.alteration || ''}
                                onChange={(e) => {
                                  const updated = [...editingGenomicProfile.mutations];
                                  updated[idx] = {...updated[idx], variant: e.target.value, alteration: e.target.value};
                                  setEditingGenomicProfile({...editingGenomicProfile, mutations: updated});
                                }}
                                placeholder="e.g., c.5266dupC"
                                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-purple-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">DNA Change</label>
                              <input
                                type="text"
                                value={mutation.dna || mutation.dnaChange || ''}
                                onChange={(e) => {
                                  const updated = [...editingGenomicProfile.mutations];
                                  updated[idx] = {...updated[idx], dna: e.target.value, dnaChange: e.target.value};
                                  setEditingGenomicProfile({...editingGenomicProfile, mutations: updated});
                                }}
                                placeholder="e.g., c.5266dupC"
                                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-purple-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Protein Change</label>
                              <input
                                type="text"
                                value={mutation.protein || mutation.aminoAcidChange || ''}
                                onChange={(e) => {
                                  const updated = [...editingGenomicProfile.mutations];
                                  updated[idx] = {...updated[idx], protein: e.target.value, aminoAcidChange: e.target.value};
                                  setEditingGenomicProfile({...editingGenomicProfile, mutations: updated});
                                }}
                                placeholder="e.g., p.Gln1756Profs*74"
                                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-purple-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Significance</label>
                              <select
                                value={mutation.significance || mutation.clinicalSignificance || ''}
                                onChange={(e) => {
                                  const updated = [...editingGenomicProfile.mutations];
                                  updated[idx] = {...updated[idx], significance: e.target.value, clinicalSignificance: e.target.value};
                                  setEditingGenomicProfile({...editingGenomicProfile, mutations: updated});
                                }}
                                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-purple-500"
                              >
                                <option value="">Select...</option>
                                <option value="pathogenic">Pathogenic</option>
                                <option value="likely_pathogenic">Likely Pathogenic</option>
                                <option value="VUS">VUS (Variant of Uncertain Significance)</option>
                                <option value="benign">Benign</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                              <select
                                value={mutation.type || ''}
                                onChange={(e) => {
                                  const updated = [...editingGenomicProfile.mutations];
                                  updated[idx] = {...updated[idx], type: e.target.value};
                                  setEditingGenomicProfile({...editingGenomicProfile, mutations: updated});
                                }}
                                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-purple-500"
                              >
                                <option value="">Select...</option>
                                <option value="somatic">Somatic</option>
                                <option value="germline">Germline</option>
                              </select>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              const updated = editingGenomicProfile.mutations.filter((_, i) => i !== idx);
                              setEditingGenomicProfile({...editingGenomicProfile, mutations: updated});
                            }}
                            className="text-xs text-red-600 hover:text-red-700"
                          >
                            Remove
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500 italic">No mutations added yet</p>
                    )}
                  </div>
                </div>

                {/* Biomarkers */}
                <div>
                  <h4 className="font-semibold text-gray-800 mb-3">Biomarkers</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">TMB (Tumor Mutational Burden)</label>
                      <input
                        type="text"
                        value={editingGenomicProfile.tmb || ''}
                        onChange={(e) => setEditingGenomicProfile({...editingGenomicProfile, tmb: e.target.value})}
                        placeholder="e.g., 12.5 mutations/megabase"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">MSI (Microsatellite Instability)</label>
                      <select
                        value={editingGenomicProfile.msi || ''}
                        onChange={(e) => setEditingGenomicProfile({...editingGenomicProfile, msi: e.target.value})}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="">Select...</option>
                        <option value="MSI-H">MSI-H (High)</option>
                        <option value="MSS">MSS (Stable)</option>
                        <option value="MSI-L">MSI-L (Low)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">HRD Score</label>
                      <input
                        type="number"
                        value={editingGenomicProfile.hrdScore || ''}
                        onChange={(e) => setEditingGenomicProfile({...editingGenomicProfile, hrdScore: e.target.value})}
                        placeholder="e.g., 48"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-shrink-0 bg-white border-t p-4">
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowEditGenomic(false);
                      setEditingGenomicProfile(null);
                    }}
                    className="flex-1 bg-gray-200 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-300 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        // Build the genomic profile object for saving
                        const profileToSave = {
                          mutations: editingGenomicProfile.mutations || [],
                          biomarkers: {
                            ...(editingGenomicProfile.biomarkers || {}),
                            ...(editingGenomicProfile.tmb ? { tumorMutationalBurden: { value: editingGenomicProfile.tmb } } : {}),
                            ...(editingGenomicProfile.msi ? { microsatelliteInstability: { status: editingGenomicProfile.msi } } : {}),
                            ...(editingGenomicProfile.hrdScore ? { hrdScore: { value: parseFloat(editingGenomicProfile.hrdScore) } } : {})
                          },
                          testName: editingGenomicProfile.testName || '',
                          testDate: editingGenomicProfile.testDate ? new Date(editingGenomicProfile.testDate) : null,
                          laboratoryName: editingGenomicProfile.laboratoryName || '',
                          specimenType: editingGenomicProfile.specimenType || '',
                          tumorPurity: editingGenomicProfile.tumorPurity || '',
                          tmb: editingGenomicProfile.tmb || '',
                          msi: editingGenomicProfile.msi || '',
                          hrdScore: editingGenomicProfile.hrdScore ? parseFloat(editingGenomicProfile.hrdScore) : null,
                          cnvs: editingGenomicProfile.cnvs || [],
                          fusions: editingGenomicProfile.fusions || [],
                          germlineFindings: editingGenomicProfile.germlineFindings || []
                        };

                        await genomicProfileService.saveGenomicProfile(user.uid, profileToSave);
                        
                        // Reload the profile
                        const updated = await genomicProfileService.getGenomicProfile(user.uid);
                        setGenomicProfile(updated);
                        
                        setShowEditGenomic(false);
                        setEditingGenomicProfile(null);
                        setMessages(prev => [...prev, { type: 'ai', text: 'Genomic profile updated successfully!' }]);
                      } catch (err) {
                        console.error('Failed to save genomic profile', err);
                        alert('Failed to save genomic profile. Please try again.');
                      }
                    }}
                    className="flex-1 bg-purple-600 text-white py-2.5 rounded-lg font-medium hover:bg-purple-700 transition"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Edit Emergency Contacts Modal */}
      {
        showEditContacts && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 md:p-4">
            <div className="bg-white w-full h-full md:h-auto md:rounded-2xl md:max-w-2xl md:max-h-[85vh] overflow-hidden flex flex-col animate-slide-up">
              <div className="flex-shrink-0 bg-white border-b p-4 flex items-center justify-between">
                <h3 className="font-bold text-lg text-gray-800">Edit Emergency Contacts</h3>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowEditContacts(false);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                  type="button"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-900">Quick Access</p>
                      <p className="text-xs text-blue-700 mt-0.5">
                        Keep your emergency contacts up to date for quick access
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {editContacts.map((c, i) => (
                    <div key={i} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-gray-800 mb-0 flex items-center">
                          <User size={18} className="mr-2 text-blue-600" />
                          <span className="capitalize">{c.contactType || 'Contact'}</span>
                        </h4>
                        <button
                          onClick={() => setEditContacts(prev => prev.filter((_, idx) => idx !== i))}
                          className="text-sm text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={c.name || ''}
                          onChange={(e) => setEditContacts(prev => prev.map((item, idx) => idx === i ? { ...item, name: e.target.value } : item))}
                          placeholder="Contact name"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="text"
                          value={c.relationship || ''}
                          onChange={(e) => setEditContacts(prev => prev.map((item, idx) => idx === i ? { ...item, relationship: e.target.value } : item))}
                          placeholder="Relationship"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="tel"
                          value={c.phone || ''}
                          onChange={(e) => setEditContacts(prev => prev.map((item, idx) => idx === i ? { ...item, phone: e.target.value } : item))}
                          placeholder="Phone number"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="email"
                          value={c.email || ''}
                          onChange={(e) => setEditContacts(prev => prev.map((item, idx) => idx === i ? { ...item, email: e.target.value } : item))}
                          placeholder="Email (optional)"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          type="text"
                          value={c.address || ''}
                          onChange={(e) => setEditContacts(prev => prev.map((item, idx) => idx === i ? { ...item, address: e.target.value } : item))}
                          placeholder="Address (street)"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                        />
                        <div className="grid grid-cols-3 gap-2">
                          <input
                            type="text"
                            value={c.city || ''}
                            onChange={(e) => setEditContacts(prev => prev.map((item, idx) => idx === i ? { ...item, city: e.target.value } : item))}
                            placeholder="City"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                          />
                          <input
                            type="text"
                            value={c.state || ''}
                            onChange={(e) => setEditContacts(prev => prev.map((item, idx) => idx === i ? { ...item, state: e.target.value } : item))}
                            placeholder="State"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                          />
                          <input
                            type="text"
                            value={c.zip || ''}
                            onChange={(e) => setEditContacts(prev => prev.map((item, idx) => idx === i ? { ...item, zip: e.target.value } : item))}
                            placeholder="ZIP"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <div>
                    <button
                      onClick={() => setEditContacts(prev => [...prev, { contactType: 'Emergency', name: '', relationship: '', phone: '', email: '', address: '', city: '', state: '', zip: '' }])}
                      className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm"
                    >
                      + Add Contact
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex-shrink-0 bg-white border-t p-4">
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowEditContacts(false)}
                    className="flex-1 bg-gray-200 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-300 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        // Save each contact via service
                        const savedIds = [];
                        for (const c of editContacts) {
                          const toSave = {
                            ...c,
                            patientId: user.uid
                          };
                          const id = await emergencyContactService.saveEmergencyContact(toSave);
                          savedIds.push(id);
                        }
                        // Reload contacts
                        const contacts = await emergencyContactService.getEmergencyContacts(user.uid);
                        setEmergencyContacts(contacts);
                        setShowEditContacts(false);
                        alert('Emergency contacts updated!');
                      } catch (err) {
                        console.error('Failed to save emergency contacts', err);
                        alert('Failed to save emergency contacts.');
                      }
                    }}
                    className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Edit Medical Team Modal */}
      {
        showEditMedicalTeam && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 md:p-4">
            <div className="bg-white w-full h-full md:h-auto md:rounded-2xl md:max-w-lg md:max-h-[85vh] overflow-hidden flex flex-col animate-slide-up">
              <div className="flex-shrink-0 bg-white border-b p-4 flex items-center justify-between">
                <h3 className="font-bold text-lg text-gray-800">Edit Medical Team</h3>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowEditMedicalTeam(false);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                  type="button"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-900">Medical Team Information</p>
                      <p className="text-xs text-blue-700 mt-0.5">
                        Keep your medical team information up to date for better care coordination
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Oncologist</label>
                    <input
                      type="text"
                      value={patientProfile.oncologist || ''}
                      onChange={(e) => setPatientProfile({ ...patientProfile, oncologist: e.target.value })}
                      placeholder="e.g., Dr. Jane Smith"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hospital/Clinic</label>
                    <input
                      type="text"
                      value={patientProfile.hospital || ''}
                      onChange={(e) => setPatientProfile({ ...patientProfile, hospital: e.target.value })}
                      placeholder="e.g., Seattle Cancer Care Alliance"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Primary Care Physician</label>
                    {(() => {
                      const pc = emergencyContacts.find(c => c.contactType === 'primaryCare' || c.contactType === 'primary_care' || c.contactType === 'primary');
                      if (pc) {
                        return (
                          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                            <p className="text-sm text-gray-700"><strong>{pc.name}</strong></p>
                            {pc.phone && <p className="text-sm text-gray-600">{pc.phone}</p>}
                            {pc.email && <p className="text-sm text-gray-600">{pc.email}</p>}
                            <p className="text-xs text-gray-500 mt-2">Manage in Emergency Contacts</p>
                          </div>
                        );
                      }
                      return (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                          <p className="text-sm text-gray-500">No primary care physician added</p>
                          <button
                            onClick={() => {
                              setShowEditMedicalTeam(false);
                              setShowEditContacts(true);
                            }}
                            className="text-xs text-blue-600 hover:underline mt-1"
                          >
                            Add in Emergency Contacts →
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              <div className="flex-shrink-0 bg-white border-t p-4">
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowEditMedicalTeam(false)}
                    className="flex-1 bg-gray-200 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-300 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const toSave = {
                          oncologist: patientProfile.oncologist || '',
                          hospital: patientProfile.hospital || ''
                        };
                        console.log('Saving Medical Team:', toSave);
                        await patientService.savePatient(user.uid, toSave);
                        // Verify saved
                        const saved = await patientService.getPatient(user.uid);
                        console.log('Saved medical team:', saved);
                        // Update local state
                        setPatientProfile(prev => ({
                          ...prev,
                          oncologist: patientProfile.oncologist || prev.oncologist,
                          hospital: patientProfile.hospital || prev.hospital
                        }));
                        setShowEditMedicalTeam(false);
                        setMessages(prev => [...prev, {
                          type: 'ai',
                          text: 'Medical team information updated successfully!'
                        }]);
                      } catch (error) {
                        console.error('Error saving medical team:', error);
                        alert('Failed to save medical team information. Please try again.');
                      }
                    }}
                    className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }


      {/* Upload Progress Overlay */}
      {
        isUploading && (
          <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 animate-fade-scale">
              <div className="text-center">
                {/* Lottie Animation */}
                {documentScanAnimation ? (
                  <div className="inline-flex items-center justify-center mb-6">
                    <Lottie 
                      animationData={documentScanAnimation}
                      loop={true}
                      style={{ width: 200, height: 200 }}
                    />
                  </div>
                ) : (
                  <div className="inline-flex items-center justify-center w-20 h-20 mb-6">
                    <div className="relative">
                      <div className="w-20 h-20 border-4 border-blue-200 rounded-full"></div>
                      <div className="w-20 h-20 border-4 border-blue-600 rounded-full absolute top-0 left-0 animate-spin border-t-transparent"></div>
                    </div>
                  </div>
                )}

                {/* Progress text */}
                <h3 className="text-xl font-bold text-gray-900 mb-2">Processing Document</h3>
                <p className="text-gray-600 mb-6">{uploadProgress}</p>

                {/* Progress steps */}
                <div className="space-y-2 text-left bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-3 text-sm">
                    <div className={`w-2 h-2 rounded-full ${uploadProgress.includes('Reading') ? 'bg-blue-600 animate-pulse' : uploadProgress.includes('Analyzing') || uploadProgress.includes('Uploading') || uploadProgress.includes('Saving') || uploadProgress.includes('Refreshing') ? 'bg-green-600' : 'bg-gray-300'}`}></div>
                    <span className={uploadProgress.includes('Reading') || uploadProgress.includes('Analyzing') || uploadProgress.includes('Uploading') || uploadProgress.includes('Saving') || uploadProgress.includes('Refreshing') ? 'text-gray-900' : 'text-gray-500'}>Reading document</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <div className={`w-2 h-2 rounded-full ${uploadProgress.includes('Analyzing') ? 'bg-blue-600 animate-pulse' : uploadProgress.includes('Uploading') || uploadProgress.includes('Saving') || uploadProgress.includes('Refreshing') ? 'bg-green-600' : 'bg-gray-300'}`}></div>
                    <span className={uploadProgress.includes('Analyzing') || uploadProgress.includes('Uploading') || uploadProgress.includes('Saving') || uploadProgress.includes('Refreshing') ? 'text-gray-900' : 'text-gray-500'}>Analyzing with AI</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <div className={`w-2 h-2 rounded-full ${uploadProgress.includes('Uploading') ? 'bg-blue-600 animate-pulse' : uploadProgress.includes('Saving') || uploadProgress.includes('Refreshing') ? 'bg-green-600' : 'bg-gray-300'}`}></div>
                    <span className={uploadProgress.includes('Uploading') || uploadProgress.includes('Saving') || uploadProgress.includes('Refreshing') ? 'text-gray-900' : 'text-gray-500'}>Uploading to storage</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <div className={`w-2 h-2 rounded-full ${uploadProgress.includes('Saving') ? 'bg-blue-600 animate-pulse' : uploadProgress.includes('Refreshing') ? 'bg-green-600' : 'bg-gray-300'}`}></div>
                    <span className={uploadProgress.includes('Saving') || uploadProgress.includes('Refreshing') ? 'text-gray-900' : 'text-gray-500'}>Saving extracted data</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <div className={`w-2 h-2 rounded-full ${uploadProgress.includes('Refreshing') ? 'bg-blue-600 animate-pulse' : 'bg-gray-300'}`}></div>
                    <span className={uploadProgress.includes('Refreshing') ? 'text-gray-900' : 'text-gray-500'}>Updating dashboard</span>
                  </div>
                </div>

                <p className="text-xs text-gray-500 mt-4">
                  Please don't close this window
                </p>
              </div>
            </div>
          </div>
        )
      }

      {/* Patient Onboarding Modal */}
      {needsOnboarding && (
        <Onboarding onComplete={handleOnboardingComplete} />
      )}
    </div >
  );
}
