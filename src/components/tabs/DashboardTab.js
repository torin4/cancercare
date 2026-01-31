import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { Activity, TrendingUp, Upload, AlertCircle, ClipboardList, Info, Dna, Bookmark, ChevronRight, Search, MessageSquare, X, Heart, Loader2, BarChart, Home, FileText, Plus, FolderOpen, User, Calendar } from 'lucide-react';
import { DesignTokens, Layouts, combineClasses } from '../../design/designTokens';
import { useAuth } from '../../contexts/AuthContext';
import { usePatientContext } from '../../contexts/PatientContext';
import { useHealthContext } from '../../contexts/HealthContext';
import { useBanner } from '../../contexts/BannerContext';
import { getSavedTrials } from '../../services/clinicalTrials/clinicalTrialsService';
import { parseMutation, getTodayLocalDate, formatDateString } from '../../utils/helpers';
import { formatJournalContentForDisplay } from '../../utils/dayOneImportUtils';
import { formatLabel } from '../../utils/formatters';
import { documentService } from '../../firebase/services';
import { getNotebookEntries } from '../../services/notebookService';
import { normalizeLabName, getLabDisplayName, labValueDescriptions, normalizeVitalName, getVitalDisplayName, vitalDescriptions, labKeyMap } from '../../utils/normalizationUtils';
import { getLabStatus, getVitalStatus } from '../../utils/healthUtils';
import { processDocument, generateChatSummary } from '../../services/documentProcessor';
import { uploadDocument } from '../../firebase/storage';
import AddSymptomModal from '../modals/AddSymptomModal';
import AddLabModal from '../modals/AddLabModal';
import AddVitalModal from '../modals/AddVitalModal';
import AddVitalValueModal from '../modals/AddVitalValueModal';
import AddLabValueModal from '../modals/AddLabValueModal';
import AddJournalNoteModal from '../modals/AddJournalNoteModal';
import DocumentUploadOnboarding from '../modals/DocumentUploadOnboarding';
import DicomImportFlow from '../modals/DicomImportFlow';
import UploadProgressOverlay from '../UploadProgressOverlay';
import LabTooltipModal from '../modals/LabTooltipModal';

export default function DashboardTab({ onTabChange }) {
  const { user } = useAuth();
  const { hasUploadedDocument, patientProfile } = usePatientContext();
  const { labsData, vitalsData, hasRealLabData, hasRealVitalData, genomicProfile, reloadHealthData, loading: healthLoading } = useHealthContext();
  const { showSuccess, showError } = useBanner();

  // Tab-specific state
  const [savedTrials, setSavedTrials] = useState([]);
  const [loadingSavedTrials, setLoadingSavedTrials] = useState(false);
  const [labTooltip, setLabTooltip] = useState(null);
  const [showAddSymptomModal, setShowAddSymptomModal] = useState(false);
  const [showAddLabModal, setShowAddLabModal] = useState(false);
  const [showAddVitalModal, setShowAddVitalModal] = useState(false);
  const [showAddJournalNoteModal, setShowAddJournalNoteModal] = useState(false);
  const [showAddVitalValueModal, setShowAddVitalValueModal] = useState(false);
  const [showAddLabValueModal, setShowAddLabValueModal] = useState(false);
  const [selectedVitalForValue, setSelectedVitalForValue] = useState(null);
  const [selectedLabForValue, setSelectedLabForValue] = useState(null);
  const [availableVitalsForModal, setAvailableVitalsForModal] = useState([]);
  const [availableLabsForModal, setAvailableLabsForModal] = useState([]);
  const [newVitalValue, setNewVitalValue] = useState({ value: '', systolic: '', diastolic: '', dateTime: new Date().toISOString().slice(0, 16), notes: '' });
  const [newLabValue, setNewLabValue] = useState({ value: '', date: getTodayLocalDate(), notes: '' });
  const [isEditingVitalValue, setIsEditingVitalValue] = useState(false);
  const [isEditingLabValue, setIsEditingLabValue] = useState(false);
  const [editingVitalValueId, setEditingVitalValueId] = useState(null);
  const [editingLabValueId, setEditingLabValueId] = useState(null);
  const [recentDocuments, setRecentDocuments] = useState([]);
  const [recentNotebookEntries, setRecentNotebookEntries] = useState([]);
  const [isLoadingFilesSummary, setIsLoadingFilesSummary] = useState(false);
  const [newVital, setNewVital] = useState({
    vitalType: '',
    value: '',
    systolic: '',
    diastolic: '',
    dateTime: new Date().toISOString().slice(0, 16),
    notes: '',
    customLabel: '',
    customUnit: '',
    customNormalRange: ''
  });
  const [showDocumentOnboarding, setShowDocumentOnboarding] = useState(false);
  const [documentOnboardingMethod, setDocumentOnboardingMethod] = useState('picker');
  const [showDicomImportFlow, setShowDicomImportFlow] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [pendingDocumentDate, setPendingDocumentDate] = useState(null);
  const [pendingDocumentNote, setPendingDocumentNote] = useState(null);
  const [symptomForm, setSymptomForm] = useState({
    name: '',
    severity: '',
    date: getTodayLocalDate(),
    time: new Date().toTimeString().slice(0, 5),
    notes: '',
    customSymptomName: '',
    tags: []
  });

  // Track if component is mounted to prevent setState after unmount
  const isMountedRef = useRef(true);

  // Load saved trials when component mounts
  useEffect(() => {
    isMountedRef.current = true;
    
    const loadSavedTrials = async () => {
      if (user?.uid) {
        if (isMountedRef.current) {
          setLoadingSavedTrials(true);
        }
        try {
          const trials = await getSavedTrials(user.uid);
          // Sort by match percentage (highest first) and limit to top 5
          const sortedTrials = trials
            .filter(trial => trial.matchResult?.matchPercentage)
            .sort((a, b) => (b.matchResult?.matchPercentage || 0) - (a.matchResult?.matchPercentage || 0))
            .slice(0, 5);
          if (isMountedRef.current) {
            setSavedTrials(sortedTrials);
          }
        } catch (error) {
          if (isMountedRef.current) {
            setSavedTrials([]);
          }
        } finally {
          if (isMountedRef.current) {
            setLoadingSavedTrials(false);
          }
        }
      }
    };
    
    loadSavedTrials();
    
    return () => {
      isMountedRef.current = false;
    };
  }, [user]);

  // Load recent documents and notebook entries for Files summary
  useEffect(() => {
    const loadFilesSummary = async () => {
      if (!user?.uid) return;
      
      setIsLoadingFilesSummary(true);
      try {
        const [docs, entries] = await Promise.all([
          documentService.getDocuments(user.uid),
          getNotebookEntries(user.uid, { limit: 3 })
        ]);
        
        // Sort documents by date (most recent first) and take top 3
        const sortedDocs = docs
          .sort((a, b) => {
            const dateA = a.date ? new Date(a.date) : new Date(0);
            const dateB = b.date ? new Date(b.date) : new Date(0);
            return dateB - dateA;
          })
          .slice(0, 3);
        
        if (isMountedRef.current) {
          setRecentDocuments(sortedDocs);
          setRecentNotebookEntries(entries.slice(0, 3));
        }
      } catch (error) {
        console.error('Failed to load files summary:', error);
      } finally {
        if (isMountedRef.current) {
          setIsLoadingFilesSummary(false);
        }
      }
    };
    
    loadFilesSummary();
  }, [user]);

  // Helper function to open document onboarding
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
          // Linking failure is non-critical; document is uploaded and data is extracted
          // Error is silently handled to avoid disrupting the upload flow
        }
      }

      // Don't set generic "Saving extracted data" - let the specific aiStatus messages show instead
      // setUploadProgress('Saving extracted data...');

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
      // Provide more helpful error messages
      let errorMessage = error.message || 'Unknown error occurred';
      
      // Enhance error messages for common issues
      if (errorMessage.includes('ZIP') || errorMessage.includes('zip')) {
        errorMessage = `Failed to process ZIP file: ${errorMessage}\n\nPlease ensure:\n- The file is a valid ZIP archive\n- The ZIP contains scan images (.dcm or from imaging CDs)\n- The file is not corrupted`;
      } else if (errorMessage.includes('DICOM') || errorMessage.includes('dicom') || errorMessage.includes('scan')) {
        errorMessage = `Failed to process scan file: ${errorMessage}\n\nPlease ensure:\n- The file is a valid CT/MRI/PET scan format\n- The file is not corrupted`;
      } else if (errorMessage.includes('validation') || errorMessage.includes('File type not allowed')) {
        errorMessage = `File validation failed: ${errorMessage}\n\nSupported file types: PDF, images, documents, scan files (.dcm), and ZIP archives of scan images`;
      }
      
      showError(`Failed to process document: ${errorMessage}. The file was not uploaded. Please try again or contact support if the issue persists.`);
      setIsUploading(false);
      setUploadProgress('');
    }
  };

  const handleImportDicom = () => {
    setShowDicomImportFlow(true);
  };

  const simulateDocumentUpload = (docType) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.vcf,.vcf.gz,.maf,.bed,.txt,.csv,.tsv,.zip,.ZIP,.gz,.xlsx,.xls,.dcm,.dicom,application/dicom,application/x-dicom,application/zip,*/*';
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
    input.accept = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.vcf,.vcf.gz,.maf,.bed,.txt,.csv,.tsv,.zip,.ZIP,.gz,.xlsx,.xls,.dcm,.dicom,application/dicom,application/x-dicom,application/zip,image/*,*/*';
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

  // Helper function to parse date strings like "Oct 15"
  const parseDateString = (dateStr) => {
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
  };

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
    <>
      {/* Loading spinner with blurred background */}
      {healthLoading && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Loader2 className="w-8 h-8 text-gray-800 animate-spin" />
              </div>
              <h3 className={combineClasses('text-xl font-bold mb-2', DesignTokens.colors.neutral.text[900])}>Loading Health Data</h3>
              <p className={combineClasses(DesignTokens.colors.neutral.text[600])}>Processing labs and vitals...</p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className={combineClasses(
        DesignTokens.spacing.container.mobile,
        'sm:px-4 md:px-6',
        'py-2 sm:py-3',
        'flex items-center'
      )}>
        <div className={combineClasses('flex items-center', DesignTokens.spacing.gap.sm, 'sm:gap-3')}>
          <div className={combineClasses('p-2 sm:p-2.5 rounded-lg', 'bg-gray-100')}>
            <Home className={combineClasses('w-5 h-5 sm:w-6 sm:h-6', 'text-gray-800')} />
          </div>
          <div>
            <h1 className={combineClasses(DesignTokens.components.header.title, 'mb-0')}>Dashboard</h1>
          </div>
        </div>
      </div>
      <div className={combineClasses(Layouts.container, 'flex flex-col', DesignTokens.spacing.gap.md)}>

        {/* Dynamic CA-125 Alert */}
        {ca125Alert && (
          <div className={combineClasses(
            DesignTokens.components.card.withColoredBorder(
              ca125Alert.type === 'up' 
                ? 'border-yellow-300' 
                : DesignTokens.colors.accent.border[300]
            ),
            ca125Alert.type === 'up' 
              ? 'bg-yellow-50' 
              : DesignTokens.colors.accent[50],
            DesignTokens.shadows.sm
          )}>
            <div className={combineClasses('flex items-start', DesignTokens.spacing.gap.md)}>
              <div className={combineClasses(
                'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
                ca125Alert.type === 'up' 
                  ? 'bg-yellow-100' 
                  : DesignTokens.colors.accent[100]
              )}>
                <AlertCircle className={combineClasses(
                  DesignTokens.icons.header.size.full,
                  ca125Alert.type === 'up' 
                    ? 'text-yellow-600' 
                    : DesignTokens.colors.accent.text[600]
                )} />
              </div>
              <div className="flex-1">
                <h3 className={combineClasses(
                  DesignTokens.typography.h3.full,
                  DesignTokens.typography.h3.weight,
                  'mb-1',
                  ca125Alert.type === 'up' 
                    ? 'text-yellow-900' 
                    : DesignTokens.colors.accent.text[900]
                )}>
                  CA-125 {ca125Alert.type === 'up' ? 'Trending Up' : 'Trending Down'}
                </h3>
                <p className={combineClasses(
                  DesignTokens.typography.body.sm,
                  ca125Alert.type === 'up' 
                    ? 'text-yellow-700' 
                    : DesignTokens.colors.accent.text[700]
                )}>
                  {ca125Alert.message}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab Summaries Grid */}
        <div className={combineClasses('grid grid-cols-1 md:grid-cols-2', DesignTokens.spacing.gap.md)}>
          
          {/* Health Tab Summary - Full Row */}
          <div className={combineClasses(
            'md:col-span-2',
            DesignTokens.components.card.container,
            DesignTokens.components.card.withColoredBorder(DesignTokens.moduleAccent.health.border)
          )}>
            <div className={combineClasses('flex items-center justify-between mb-4')}>
              <div className={combineClasses('flex items-center', DesignTokens.spacing.gap.sm)}>
                <div className={combineClasses(DesignTokens.moduleAccent.health.bg, DesignTokens.spacing.iconContainer.mobile, DesignTokens.borders.radius.sm)}>
                  <Activity className={combineClasses(DesignTokens.icons.standard.size.full, DesignTokens.moduleAccent.health.text)} />
                </div>
                <h3 className={combineClasses(DesignTokens.typography.h3.full, DesignTokens.typography.h3.weight, DesignTokens.colors.app.text[900])}>
                  Health
                </h3>
              </div>
                      <button
                onClick={() => onTabChange('health')}
                        className={combineClasses(
                  DesignTokens.typography.body.sm,
                  'font-medium',
                  DesignTokens.colors.app.text[600],
                  'flex items-center',
                  DesignTokens.spacing.gap.xs,
                  'px-3 py-1.5 rounded-lg',
                  'transition-colors',
                  'hover:bg-anchor-50'
                        )}
                      >
                View All <ChevronRight className={DesignTokens.icons.small.size.full} />
                      </button>
                  </div>

            {/* Key Metrics & Recent Data */}
            {hasRealLabData || hasRealVitalData ? (() => {
              const favoriteLabs = patientProfile?.favoriteMetrics?.labs || [];
              const favoriteVitals = patientProfile?.favoriteMetrics?.vitals || [];

              // Get key metrics (favorites or high-relevance, up to 6 total)
              const getKeyMetrics = () => {
                const allMetrics = [];
                
                // Get favorite labs
                if (favoriteLabs.length > 0 && hasRealLabData) {
                  favoriteLabs.forEach(key => {
                    const lab = labsData[key];
                    if (lab && ((lab.data && lab.data.length > 0) || lab.current)) {
                      allMetrics.push({ type: 'lab', key, data: lab });
                    }
                  });
                }
                
                // Get favorite vitals
                if (favoriteVitals.length > 0 && hasRealVitalData) {
                  favoriteVitals.forEach(key => {
                    const vital = vitalsData[key];
                    if (vital && ((vital.data && Array.isArray(vital.data) && vital.data.length > 0) || vital.current)) {
                      allMetrics.push({ type: 'vital', key, data: vital });
                    }
                  });
                }
                
                // If we have favorites, return up to 6
                if (allMetrics.length > 0) {
                  return allMetrics.slice(0, 6);
            }
            
                // Otherwise, get high-relevance labs and important vitals
                const keyLabs = Object.keys(labsData)
              .filter(key => {
                const lab = labsData[key];
                return lab && ((lab.data && lab.data.length > 0) || lab.current) && lab.relevanceScore >= 1;
              })
              .sort((a, b) => {
                const labA = labsData[a];
                const labB = labsData[b];
                if (labB.relevanceScore !== labA.relevanceScore) {
                  return labB.relevanceScore - labA.relevanceScore;
                }
                const criticalOrder = ['ca125', 'cea', 'wbc', 'hemoglobin', 'platelets', 'creatinine', 'egfr', 'alt', 'ast', 'albumin', 'ldh'];
                const idxA = criticalOrder.indexOf(a.toLowerCase());
                const idxB = criticalOrder.indexOf(b.toLowerCase());
                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                if (idxA !== -1) return -1;
                if (idxB !== -1) return 1;
                return 0;
              })
                  .slice(0, 4)
                  .map(key => ({ type: 'lab', key, data: labsData[key] }));

                const keyVitals = Object.keys(vitalsData)
                  .filter(key => {
                    const vital = vitalsData[key];
                    return vital && ((vital.data && vital.data.length > 0) || vital.current);
                  })
                  .filter(key => ['weight', 'bp', 'bloodpressure', 'blood_pressure', 'temperature', 'temp', 'heartrate', 'hr', 'heart_rate', 'pulse', 'oxygen_saturation', 'o2sat'].includes(key.toLowerCase()))
                  .slice(0, 2)
                  .map(key => ({ type: 'vital', key, data: vitalsData[key] }));
                
                return [...keyLabs, ...keyVitals].slice(0, 6);
              };
              
              const getKeyLabItems = () => {
                if (!hasRealLabData) return null;
                if (favoriteLabs.length > 0) {
                  const items = favoriteLabs
                    .filter(key => labsData[key] && ((labsData[key].data && labsData[key].data.length > 0) || labsData[key].current))
                    .map(key => ({ type: 'lab', key, data: labsData[key] }))
                    .slice(0, 2);
                  if (items.length > 0) return items;
                }
                const keys = Object.keys(labsData)
                  .filter(key => {
                    const lab = labsData[key];
                    return lab && ((lab.data && lab.data.length > 0) || lab.current);
                  })
                  .slice(0, 2);
                if (keys.length === 0) return null;
                return keys.map(key => ({ type: 'lab', key, data: labsData[key] }));
          };

          const getKeyVitalItems = () => {
            if (!hasRealVitalData) return null;
            if (favoriteVitals.length > 0) {
                  const items = favoriteVitals
                .filter(key => {
                  const vital = vitalsData[key];
                      return vital && ((vital.data && Array.isArray(vital.data) && vital.data.length > 0) || vital.current);
                })
                .map(key => ({ type: 'vital', key, data: vitalsData[key] }))
                    .slice(0, 2);
                  if (items.length > 0) return items;
            }
                const keys = Object.keys(vitalsData)
              .filter(key => {
                const vital = vitalsData[key];
                return vital && ((vital.data && vital.data.length > 0) || vital.current);
              })
                  .slice(0, 2);
                if (keys.length === 0) return null;
                return keys.map(key => ({ type: 'vital', key, data: vitalsData[key] }));
          };

              const keyMetrics = getKeyMetrics();
          const keyLabItems = getKeyLabItems();
          const keyVitalItems = getKeyVitalItems();
              
              const renderMetricItem = (item, itemType) => {
                const data = item.data;
                let latestValue = (data.data && data.data.length > 0)
                  ? data.data[data.data.length - 1]?.value
                  : data.current;
                
                let statusInfo = { status: 'normal', color: 'green', label: 'Normal' };
                const numValue = typeof latestValue === 'string' && latestValue.includes('/') 
                  ? latestValue 
                  : parseFloat(latestValue);
                
                if (itemType === 'lab' && !isNaN(numValue) && data.normalRange) {
                  statusInfo = getLabStatus(numValue, data.normalRange);
                } else if (itemType === 'vital' && data.normalRange) {
                  const vitalKey = normalizeVitalName(item.key) || item.key;
                  statusInfo = getVitalStatus(latestValue, data.normalRange, vitalKey);
                }
                
                let displayName = data.name;
                if (itemType === 'lab') {
                  displayName = getLabDisplayName(data.name || item.key);
                } else if (itemType === 'vital') {
                  displayName = getVitalDisplayName(data.name || item.key);
                }
                
                const statusColorClass = 
                  statusInfo.color === 'red' ? DesignTokens.components.status.high.icon :
                  statusInfo.color === 'yellow' ? DesignTokens.components.status.low.icon :
                  DesignTokens.components.status.normal.icon;

          return (
                  <div 
                    key={`${itemType}-${item.key}`} 
                    onClick={() => {
                      // Store metric info to open in Health tab
                      sessionStorage.setItem('expandMetric', JSON.stringify({
                        key: item.key,
                        type: itemType
                      }));
                      onTabChange('health');
                    }}
                    className={combineClasses(
                      'p-2 rounded-lg',
                      DesignTokens.colors.app[50],
                      'border',
                      DesignTokens.colors.app.border[200],
                      'cursor-pointer hover:bg-gray-50 transition-all duration-200',
                      'hover:shadow-md hover:-translate-y-0.5'
                    )}>
                    <div className={combineClasses('flex items-center justify-between mb-1')}>
                      <span className={combineClasses(DesignTokens.typography.body.xs, 'font-medium', DesignTokens.colors.app.text[700])}>
                        {displayName}
                      </span>
                      <Activity className={combineClasses(DesignTokens.icons.small.size.full, statusColorClass)} />
                          </div>
                    <p className={combineClasses(DesignTokens.typography.body.sm, 'font-bold', DesignTokens.colors.app.text[900])}>
                      {latestValue}{data.unit ? ` ${data.unit}` : ''}
                    </p>
                      </div>
                );
              };

              return (
                <div className={combineClasses('space-y-4 mb-4')}>
                  {/* Key Metrics Section */}
                  {keyMetrics && keyMetrics.length > 0 && (
                    <div>
                      <p className={combineClasses(DesignTokens.typography.body.xs, 'font-semibold mb-2', DesignTokens.colors.app.text[600], 'uppercase')}>
                        Key Metrics
                      </p>
                      <div className={combineClasses('grid grid-cols-2 sm:grid-cols-3', DesignTokens.spacing.gap.sm)}>
                        {keyMetrics.map((item) => renderMetricItem(item, item.type))}
                      </div>
                    </div>
                  )}
                          </div>
              );
            })() : (
              <p className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.colors.app.text[500], 'mb-4')}>
                No health data yet
              </p>
            )}

            {/* Quick Actions */}
            <div className={combineClasses('flex flex-wrap gap-2 pt-3 border-t', DesignTokens.colors.app.border[200])}>
                        <button
                          onClick={() => {
                  const availableVitals = Object.keys(vitalsData || {}).filter(key => {
                    const vital = vitalsData[key];
                    return vital && vital.id && (vital.data?.length > 0 || vital.current);
                  }).map(key => ({
                    id: vitalsData[key].id,
                    key,
                    name: getVitalDisplayName(key),
                    vitalType: key === 'bp' ? 'bp' : 'single',
                    unit: vitalsData[key]?.unit || '',
                    normalRange: vitalsData[key]?.normalRange || ''
                  }));
                  if (availableVitals.length === 0) {
                    showError('No vitals available. Please add a vital first.');
                    return;
                  }
                  setAvailableVitalsForModal(availableVitals);
                  setSelectedVitalForValue(availableVitals[0]);
                  setShowAddVitalValueModal(true);
                          }}
                          className={combineClasses(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium',
                  DesignTokens.components.button.outline.primary,
                  'hover:bg-medical-primary-50 hover:border-medical-primary-400 hover:text-medical-primary-700'
                          )}
                        >
                <Heart className="w-3.5 h-3.5" />
                <span>Add Vital</span>
                        </button>
              <button
                onClick={() => {
                  const availableLabs = Object.keys(labsData || {}).filter(key => {
                    const lab = labsData[key];
                    return lab && lab.id && (lab.data?.length > 0 || lab.current);
                  }).map(key => ({
                    id: labsData[key].id,
                    key,
                    name: getLabDisplayName(key),
                    unit: labsData[key]?.unit || '',
                    normalRange: labsData[key]?.normalRange || ''
                  }));
                  if (availableLabs.length === 0) {
                    showError('No labs available. Please add a lab first.');
                    return;
                  }
                  setAvailableLabsForModal(availableLabs);
                  setSelectedLabForValue(availableLabs[0]);
                  setShowAddLabValueModal(true);
                }}
                className={combineClasses(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium',
                  DesignTokens.components.button.outline.primary,
                  'hover:bg-medical-primary-50 hover:border-medical-primary-400 hover:text-medical-primary-700'
                )}
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span>Add Lab</span>
              </button>
              <button
                onClick={() => setShowAddSymptomModal(true)}
                className={combineClasses(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium',
                  DesignTokens.components.button.outline.primary,
                  'hover:bg-medical-primary-50 hover:border-medical-primary-400 hover:text-medical-primary-700'
                )}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Log Symptom</span>
              </button>
            </div>
          </div>

          {/* Trials Tab Summary */}
          <div className={DesignTokens.components.card.withColoredBorder(DesignTokens.moduleAccent.trials.border)}>
            <div className={combineClasses('flex items-center justify-between mb-4')}>
              <div className={combineClasses('flex items-center', DesignTokens.spacing.gap.sm)}>
                <div className={combineClasses(DesignTokens.moduleAccent.trials.bg, DesignTokens.spacing.iconContainer.mobile, DesignTokens.borders.radius.sm)}>
                  <Bookmark className={combineClasses(DesignTokens.icons.standard.size.full, DesignTokens.moduleAccent.trials.text)} />
                  </div>
                <h3 className={combineClasses(DesignTokens.typography.h3.full, DesignTokens.typography.h3.weight, DesignTokens.colors.app.text[900])}>
                  Clinical Trials
                </h3>
              </div>
                <button
                onClick={() => onTabChange('trials')}
                  className={combineClasses(
                    DesignTokens.typography.body.sm,
                    'font-medium',
                  DesignTokens.colors.app.text[600],
                  'flex items-center',
                    DesignTokens.spacing.gap.xs,
                    'px-3 py-1.5 rounded-lg',
                    'transition-colors',
                    'hover:bg-anchor-50'
                  )}
                >
                View All <ChevronRight className={DesignTokens.icons.small.size.full} />
                </button>
              </div>

            {/* Saved Trials Preview */}
            {loadingSavedTrials ? (
              <div className="text-center py-4">
                <Loader2 className={combineClasses('w-5 h-5 animate-spin mx-auto mb-2', DesignTokens.colors.app.text[400])} />
                <p className={combineClasses(DesignTokens.typography.body.xs, DesignTokens.colors.app.text[500])}>Loading...</p>
              </div>
            ) : savedTrials.length > 0 ? (
              <div className={combineClasses('space-y-2 mb-4')}>
                {savedTrials.slice(0, 3).map((trial) => (
                  <div
                    key={trial.id}
                    className={combineClasses(
                      'p-3 rounded-lg border cursor-pointer transition-all duration-200',
                      DesignTokens.colors.app[50],
                      DesignTokens.colors.app.border[200],
                      'hover:shadow-md hover:-translate-y-0.5'
                    )}
                    onClick={() => onTabChange('trials')}
                  >
                    <h4 className={combineClasses(DesignTokens.typography.body.sm, 'font-semibold mb-1', DesignTokens.colors.app.text[900], 'line-clamp-1')}>
                      {trial.title || trial.titleJa || 'Untitled Trial'}
                    </h4>
                    {trial.matchResult && (
                      <p className={combineClasses(DesignTokens.typography.body.xs, DesignTokens.colors.app.text[600])}>
                        Match: {trial.matchResult.matchPercentage}%
                      </p>
                    )}
                  </div>
                ))}
                </div>
            ) : (
              <p className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.colors.app.text[500], 'mb-4')}>
                No saved trials yet
              </p>
            )}

            {/* Quick Actions */}
            <div className={combineClasses('flex flex-wrap gap-2 pt-3 border-t', DesignTokens.colors.app.border[200])}>
                  <button
                onClick={() => onTabChange('trials')}
                    className={combineClasses(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium',
                  DesignTokens.components.button.outline.primary,
                  'hover:bg-green-50 hover:border-care-600 hover:text-care-600'
                    )}
                  >
                <Search className="w-3.5 h-3.5" />
                <span>Search Trials</span>
                  </button>
          </div>
        </div>

          {/* Files Tab Summary */}
        <div className={combineClasses(
            DesignTokens.components.card.container,
            DesignTokens.components.card.withColoredBorder(DesignTokens.moduleAccent.files.border)
          )}>
            <div className={combineClasses('flex items-center justify-between mb-4')}>
              <div className={combineClasses('flex items-center', DesignTokens.spacing.gap.sm)}>
                <div className={combineClasses(DesignTokens.moduleAccent.files.bg, DesignTokens.spacing.iconContainer.mobile, DesignTokens.borders.radius.sm)}>
                  <FolderOpen className={combineClasses(DesignTokens.icons.standard.size.full, DesignTokens.moduleAccent.files.text)} />
                </div>
                <h3 className={combineClasses(DesignTokens.typography.h3.full, DesignTokens.typography.h3.weight, DesignTokens.colors.app.text[900])}>
                  Files & Notes
              </h3>
              </div>
              <button
                onClick={() => onTabChange('files')}
                className={combineClasses(
                  DesignTokens.typography.body.sm,
                  'font-medium',
                  DesignTokens.colors.app.text[600],
                  'flex items-center',
                  DesignTokens.spacing.gap.xs,
                  'px-3 py-1.5 rounded-lg',
                  'transition-colors',
                  'hover:bg-anchor-50'
                )}
              >
                View All <ChevronRight className={DesignTokens.icons.small.size.full} />
              </button>
            </div>

            {/* Recent Documents & Notes Preview */}
            {isLoadingFilesSummary ? (
              <div className="text-center py-4">
                <Loader2 className={combineClasses('w-5 h-5 animate-spin mx-auto mb-2', DesignTokens.colors.app.text[400])} />
                <p className={combineClasses(DesignTokens.typography.body.xs, DesignTokens.colors.app.text[500])}>Loading...</p>
            </div>
            ) : (
              <div className={combineClasses('space-y-3 mb-4')}>
                {recentDocuments.length > 0 && (
                  <div>
                    <p className={combineClasses(DesignTokens.typography.body.xs, 'font-semibold mb-2', DesignTokens.colors.app.text[600], 'uppercase')}>
                      Recent Documents
                    </p>
                    <div className={combineClasses('space-y-2')}>
                      {recentDocuments.slice(0, 2).map((doc) => (
                        <div
                          key={doc.id}
                          onClick={() => {
                            // Store document ID to expand in Files tab
                            sessionStorage.setItem('expandDocumentId', doc.id);
                            onTabChange('files');
                          }}
                          className={combineClasses(
                            'p-2 rounded-lg border flex items-center gap-2',
                            DesignTokens.colors.app[50],
                            DesignTokens.colors.app.border[200],
                            'cursor-pointer hover:bg-gray-50 transition-all duration-200',
                            'hover:shadow-md hover:-translate-y-0.5'
                          )}
                >
                          <FileText className={combineClasses('w-4 h-4 flex-shrink-0', DesignTokens.colors.app.text[500])} />
                    <div className="flex-1 min-w-0">
                            <p className={combineClasses(DesignTokens.typography.body.xs, 'font-medium truncate', DesignTokens.colors.app.text[900])}>
                              {doc.name || 'Untitled Document'}
                            </p>
                            <div className="flex items-center gap-2">
                              {doc.date && (
                                <p className={combineClasses(DesignTokens.typography.body.xs, DesignTokens.colors.app.text[500])}>
                                  {formatDateString(doc.date)}
                                </p>
                              )}
                              {doc.dataPointCount !== undefined && doc.dataPointCount !== null && doc.dataPointCount > 0 && (
                                <span className={combineClasses(DesignTokens.typography.body.xs, DesignTokens.moduleAccent.files.text, 'font-medium')}>
                                  • {doc.dataPointCount} point{doc.dataPointCount !== 1 ? 's' : ''}
                          </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
              </div>
                )}
                {recentNotebookEntries.length > 0 && (
                  <div>
                    <p className={combineClasses(DesignTokens.typography.body.xs, 'font-semibold mb-2', DesignTokens.colors.app.text[600], 'uppercase')}>
                      Recent Notes
                    </p>
                    <div className={combineClasses('space-y-2')}>
                      {recentNotebookEntries.slice(0, 2).map((entry) => (
                        <div
                          key={entry.dateKey}
                          onClick={() => {
                            // Store entry dateKey to expand in Files tab
                            sessionStorage.setItem('expandNotebookEntry', entry.dateKey);
                            onTabChange('files');
                          }}
                          className={combineClasses(
                            'p-2 rounded-lg border',
                            DesignTokens.colors.app[50],
                            DesignTokens.colors.app.border[200],
                            'cursor-pointer hover:bg-gray-50 transition-all duration-200',
                            'hover:shadow-md hover:-translate-y-0.5'
                          )}
                        >
                          <div className={combineClasses('flex items-center gap-2 mb-1')}>
                            <Calendar className={combineClasses('w-3.5 h-3.5', DesignTokens.colors.app.text[500])} />
                            <p className={combineClasses(DesignTokens.typography.body.xs, 'font-medium', DesignTokens.colors.app.text[700])}>
                              {formatDateString(entry.date)}
                            </p>
                          </div>
                          {entry.notes.length > 0 && (
                            <p className={combineClasses(DesignTokens.typography.body.xs, DesignTokens.colors.app.text[600], 'line-clamp-2')}>
                              {formatJournalContentForDisplay(entry.notes[0].content)}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {recentDocuments.length === 0 && recentNotebookEntries.length === 0 && (
                  <p className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.colors.app.text[500])}>
                    No documents or notes yet
                  </p>
                )}
              </div>
            )}

            {/* Quick Actions */}
            <div className={combineClasses('flex flex-wrap gap-2 pt-3 border-t', DesignTokens.colors.app.border[200])}>
                <button
                onClick={() => {
                  if (!hasUploadedDocument) {
                    setDocumentOnboardingMethod('picker');
                    setShowDocumentOnboarding(true);
                  } else {
                    onTabChange('files');
                  }
                }}
                  className={combineClasses(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium',
                  DesignTokens.components.button.outline.primary,
                  'hover:bg-medical-secondary-50 hover:border-medical-secondary-400 hover:text-medical-secondary-700'
                )}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload File</span>
              </button>
              <button
                onClick={() => setShowAddJournalNoteModal(true)}
                className={combineClasses(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium',
                  DesignTokens.components.button.outline.primary,
                  'hover:bg-medical-secondary-50 hover:border-medical-secondary-400 hover:text-medical-secondary-700'
                  )}
                >
                <FileText className="w-3.5 h-3.5" />
                <span>Add Note</span>
                </button>
              </div>
            </div>

        </div>
      </div>

      {/* Lab Tooltip Modal */}
      <LabTooltipModal
        show={!!labTooltip}
        labTooltip={labTooltip}
        onClose={() => setLabTooltip(null)}
      />

      {/* Modals */}
      <AddSymptomModal
        show={showAddSymptomModal}
        onClose={() => {
          setShowAddSymptomModal(false);
          // Reset form when closing
          setSymptomForm({
            name: '',
            severity: '',
            date: getTodayLocalDate(),
            time: new Date().toTimeString().slice(0, 5),
            notes: '',
            customSymptomName: '',
            tags: []
          });
        }}
        symptomForm={symptomForm}
        setSymptomForm={setSymptomForm}
        user={user}
      />

      {showDocumentOnboarding && (
        <DocumentUploadOnboarding
          isOnboarding={!hasUploadedDocument}
          onClose={() => setShowDocumentOnboarding(false)}
          onImportDicom={handleImportDicom}
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

      {/* DICOM Import Flow Modal */}
      {showDicomImportFlow && (
        <DicomImportFlow
          show={showDicomImportFlow}
          onClose={() => setShowDicomImportFlow(false)}
          onViewNow={null} // DashboardTab doesn't have DICOM viewer access
          onSaveToLibrary={async (files, note) => {
            setShowDicomImportFlow(false);
            setIsUploading(true);
            setUploadProgress('Saving scan files to library...');
            
            try {
              // Process files sequentially (reuse existing logic)
              for (let i = 0; i < files.length; i++) {
                await handleRealFileUpload(files[i], 'Scan', null, note); // null date - DICOM metadata will provide
              }
              
              setIsUploading(false);
              setUploadProgress('');
              showSuccess(`Successfully saved ${files.length} scan file${files.length !== 1 ? 's' : ''} to library`);
            } catch (error) {
              console.error('Error saving scan files to library:', error);
              setIsUploading(false);
              setUploadProgress('');
              showError(`Failed to save files: ${error.message}`);
            }
          }}
          userId={user?.uid}
        />
      )}

      {/* Lab Tooltip Modal */}
      <LabTooltipModal
        show={!!labTooltip}
        labTooltip={labTooltip}
        onClose={() => setLabTooltip(null)}
      />

      {/* Modals */}
      <AddSymptomModal
        show={showAddSymptomModal}
        onClose={() => {
          setShowAddSymptomModal(false);
          // Reset form when closing
          setSymptomForm({
            name: '',
            severity: '',
            date: getTodayLocalDate(),
            time: new Date().toTimeString().slice(0, 5),
            notes: '',
            customSymptomName: '',
            tags: []
          });
        }}
        symptomForm={symptomForm}
        setSymptomForm={setSymptomForm}
        user={user}
      />

      {showDocumentOnboarding && (
        <DocumentUploadOnboarding
          isOnboarding={!hasUploadedDocument}
          onClose={() => setShowDocumentOnboarding(false)}
          onImportDicom={handleImportDicom}
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

      {/* Upload Progress Overlay */}
      <UploadProgressOverlay
        show={isUploading}
        uploadProgress={uploadProgress}
      />

      {/* Add Lab Modal */}
      <AddLabModal
        show={showAddLabModal}
        onClose={() => setShowAddLabModal(false)}
        user={user}
        reloadHealthData={reloadHealthData}
        labKeyMap={labKeyMap}
        allLabsData={labsData}
      />

      {/* Add Vital Modal */}
      {showAddVitalModal && (
        <AddVitalModal
          show={showAddVitalModal}
          onClose={() => setShowAddVitalModal(false)}
          user={user}
          patientProfile={patientProfile}
          isEditingVital={false}
          editingVitalValueId={null}
          newVital={newVital}
          setNewVital={setNewVital}
          setIsEditingVital={() => {}}
          setEditingVitalValueId={() => {}}
          allVitalsData={vitalsData}
          reloadHealthData={reloadHealthData}
          getWeightNormalRange={(height) => {
            // Simple weight range calculation
            if (!height) return '';
            const heightInMeters = height / 100;
            const minWeight = 18.5 * heightInMeters * heightInMeters;
            const maxWeight = 24.9 * heightInMeters * heightInMeters;
            return `${Math.round(minWeight)}-${Math.round(maxWeight)} kg`;
          }}
        />
      )}

      {/* Add Journal Note Modal */}
      <AddJournalNoteModal
        show={showAddJournalNoteModal}
        onClose={() => setShowAddJournalNoteModal(false)}
        user={user}
        onNoteAdded={() => {
          // Reload if needed
        }}
      />

      {/* Add Vital Value Modal */}
      {showAddVitalValueModal && selectedVitalForValue && (
        <AddVitalValueModal
          show={showAddVitalValueModal}
          onClose={() => {
            setShowAddVitalValueModal(false);
            setSelectedVitalForValue(null);
            setAvailableVitalsForModal([]);
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
          availableVitals={availableVitalsForModal}
        />
      )}

      {/* Add Lab Value Modal */}
      {showAddLabValueModal && selectedLabForValue && (
        <AddLabValueModal
          show={showAddLabValueModal}
          onClose={() => {
            setShowAddLabValueModal(false);
            setSelectedLabForValue(null);
            setAvailableLabsForModal([]);
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
          setSelectedLab={null}
          availableLabs={availableLabsForModal}
        />
      )}

      {/* Upload Progress Overlay */}
      <UploadProgressOverlay
        show={isUploading}
        uploadProgress={uploadProgress}
      />
    </>
  );
}



DashboardTab.propTypes = {
  onTabChange: PropTypes.func.isRequired
};
