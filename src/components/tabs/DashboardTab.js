import React, { useState, useEffect, useRef } from 'react';
import { Activity, TrendingUp, Upload, AlertCircle, ClipboardList, Info, Dna, Bookmark, Star, ChevronRight, Search, MessageSquare, X, Heart, Loader2, BarChart, Home } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePatientContext } from '../../contexts/PatientContext';
import { useHealthContext } from '../../contexts/HealthContext';
import { useBanner } from '../../contexts/BannerContext';
import { getSavedTrials } from '../../services/clinicalTrials/clinicalTrialsService';
import { parseMutation, getTodayLocalDate } from '../../utils/helpers';
import { formatLabel } from '../../utils/formatters';
import { normalizeLabName, getLabDisplayName, labValueDescriptions, normalizeVitalName, getVitalDisplayName, vitalDescriptions, labKeyMap } from '../../utils/normalizationUtils';
import { getLabStatus, getVitalStatus } from '../../utils/healthUtils';
import { processDocument, generateChatSummary } from '../../services/documentProcessor';
import { uploadDocument } from '../../firebase/storage';
import AddSymptomModal from '../modals/AddSymptomModal';
import AddLabModal from '../modals/AddLabModal';
import AddVitalModal from '../modals/AddVitalModal';
import DocumentUploadOnboarding from '../DocumentUploadOnboarding';
import UploadProgressOverlay from '../UploadProgressOverlay';

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
              <div className="w-16 h-16 bg-medical-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Loader2 className="w-8 h-8 text-medical-primary-600 animate-spin" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Loading Health Data</h3>
              <p className="text-gray-600">Processing labs and vitals...</p>
            </div>
          </div>
        </div>
      )}

      <div className="p-3 sm:p-4 md:p-6">
        {/* Header */}
        <div className="mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3">
          <div className="bg-medical-primary-50 p-2 sm:p-2.5 rounded-lg">
            <Home className="w-5 h-5 sm:w-6 sm:h-6 text-medical-primary-600" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-medical-neutral-900 mb-0.5 sm:mb-1">Dashboard</h1>
          </div>
        </div>

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

        {/* Key Metrics - Only show if there are favorites */}
        {hasRealLabData || hasRealVitalData ? (() => {
          // Check if user has favorited any metrics
          const favoriteLabs = patientProfile?.favoriteMetrics?.labs || [];
          const favoriteVitals = patientProfile?.favoriteMetrics?.vitals || [];
          const hasFavorites = favoriteLabs.length > 0 || favoriteVitals.length > 0;

          // Helper function to render a metric item
          const renderMetricItem = (item, itemType) => {
            const data = item.data;
            let latestValue = (data.data && data.data.length > 0)
              ? data.data[data.data.length - 1]?.value
              : data.current;
            
            // Calculate proper status using healthUtils functions
            let statusInfo = { status: 'normal', color: 'green', label: 'Normal' };
            const numValue = typeof latestValue === 'string' && latestValue.includes('/') 
              ? latestValue 
              : parseFloat(latestValue);
            
            if (itemType === 'lab' && !isNaN(numValue) && data.normalRange) {
              statusInfo = getLabStatus(numValue, data.normalRange);
            } else if (itemType === 'vital' && data.normalRange) {
              const vitalKey = normalizeVitalName(item.key) || item.key;
              statusInfo = getVitalStatus(latestValue, data.normalRange, vitalKey);
            } else {
              // Fallback to data.status if available
              const dataStatus = data.status || 'normal';
              if (dataStatus === 'warning') {
                statusInfo = { status: 'warning', color: 'yellow', label: 'Above normal' };
              } else if (dataStatus === 'danger') {
                statusInfo = { status: 'danger', color: 'red', label: 'High' };
              }
            }
            
            // Get description using normalized system (for labs and vitals)
            let description = '';
            let displayName = data.name;
            if (itemType === 'lab') {
              const canonicalKey = normalizeLabName(data.name || item.key);
              if (canonicalKey && labValueDescriptions[canonicalKey]) {
                description = labValueDescriptions[canonicalKey];
                displayName = getLabDisplayName(data.name || item.key);
              }
            } else if (itemType === 'vital') {
              const canonicalKey = normalizeVitalName(data.name || item.key);
              if (canonicalKey && vitalDescriptions[canonicalKey]) {
                description = vitalDescriptions[canonicalKey];
                displayName = getVitalDisplayName(data.name || item.key);
              }
            }
            
            // Determine color classes based on status
            const statusColorClass = 
              statusInfo.color === 'red' ? 'text-red-500' :
              statusInfo.color === 'yellow' ? 'text-orange-500' :
              statusInfo.color === 'green' ? 'text-green-500' :
              'text-medical-accent-500';
            
            const statusTextColorClass = 
              statusInfo.color === 'red' ? 'text-red-600' :
              statusInfo.color === 'yellow' ? 'text-orange-600' :
              statusInfo.color === 'green' ? 'text-green-600' :
              'text-medical-neutral-600';
            
            return (
              <div key={`${itemType}-${item.key}`} className="text-center p-3 sm:p-4 bg-white rounded-lg border border-medical-neutral-200 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-center gap-1.5 mb-2">
                  <span className="text-xs font-medium text-medical-neutral-700">{displayName}</span>
                  <div className="flex items-center gap-1">
                    <Activity className={`w-3.5 h-3.5 ${statusColorClass}`} />
                    {description && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setLabTooltip({
                            labName: displayName,
                            description: description
                          });
                        }}
                        className="p-1.5 -m-1.5 text-medical-primary-500 hover:text-medical-primary-700 active:text-medical-primary-800 transition-colors touch-manipulation min-w-[32px] min-h-[32px] flex items-center justify-center"
                        title="Learn more about this value"
                        aria-label="Learn more about this value"
                      >
                        <Info className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-lg sm:text-xl font-bold text-medical-neutral-900">{latestValue}{data.unit ? ` ${data.unit}` : ''}</p>
                <p className={`text-xs mt-1 font-medium ${statusTextColorClass}`}>
                  {statusInfo.label}
                </p>
              </div>
            );
          };

          // Prepare Key Labs - show favorites if they exist, otherwise show defaults
          const getKeyLabItems = () => {
            if (!hasRealLabData) return null;
            
            // If there are favorite labs, use those
            if (favoriteLabs.length > 0) {
              const favoriteLabItems = favoriteLabs
                .filter(key => labsData[key] && ((labsData[key].data && labsData[key].data.length > 0) || labsData[key].current))
                .map(key => ({ type: 'lab', key, data: labsData[key] }))
                .slice(0, 4);
              if (favoriteLabItems.length > 0) return favoriteLabItems;
            }
            
            // Otherwise, use default important labs
            const keyLabKeys = Object.keys(labsData)
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
                const criticalOrder = ['ca125', 'cea', 'wbc', 'hemoglobin', 'platelets', 'creatinine', 'alt', 'ast', 'albumin', 'ldh'];
                const idxA = criticalOrder.indexOf(a.toLowerCase());
                const idxB = criticalOrder.indexOf(b.toLowerCase());
                if (idxA !== -1 && idxB !== -1) return idxA - idxB;
                if (idxA !== -1) return -1;
                if (idxB !== -1) return 1;
                return 0;
              })
              .slice(0, 4);

            const displayLabKeys = keyLabKeys.length > 0 
              ? keyLabKeys
              : Object.keys(labsData)
                  .filter(key => {
                    const lab = labsData[key];
                    return lab && ((lab.data && lab.data.length > 0) || lab.current);
                  })
                  .slice(0, 4);

            if (displayLabKeys.length === 0) return null;
            return displayLabKeys.map(key => ({ type: 'lab', key, data: labsData[key] }));
          };

          // Prepare Key Vitals - show favorites if they exist, otherwise show defaults
          const getKeyVitalItems = () => {
            if (!hasRealVitalData) return null;
            
            // If there are favorite vitals, use those
            if (favoriteVitals.length > 0) {
              const favoriteVitalItems = favoriteVitals
                .filter(key => {
                  const vital = vitalsData[key];
                  if (!vital) return false;
                  const hasData = vital.data && Array.isArray(vital.data) && vital.data.length > 0;
                  const hasCurrent = vital.current !== null && vital.current !== undefined && vital.current !== '';
                  return hasData || hasCurrent;
                })
                .map(key => ({ type: 'vital', key, data: vitalsData[key] }))
                .slice(0, 4);
              if (favoriteVitalItems.length > 0) return favoriteVitalItems;
            }
            
            // Otherwise, use default important vitals
            const keyVitalKeys = Object.keys(vitalsData)
              .filter(key => {
                const vital = vitalsData[key];
                return vital && ((vital.data && vital.data.length > 0) || vital.current);
              })
              .filter(key => ['weight', 'bp', 'bloodpressure', 'temperature', 'temp', 'heartrate', 'hr', 'pulse'].includes(key.toLowerCase()))
              .slice(0, 4);

            const displayVitalKeys = keyVitalKeys.length > 0
              ? keyVitalKeys
              : Object.keys(vitalsData)
                  .filter(key => {
                    const vital = vitalsData[key];
                    return vital && ((vital.data && vital.data.length > 0) || vital.current);
                  })
                  .slice(0, 4);

            if (displayVitalKeys.length === 0) return null;
            return displayVitalKeys.map(key => ({ type: 'vital', key, data: vitalsData[key] }));
          };

          const keyLabItems = getKeyLabItems();
          const keyVitalItems = getKeyVitalItems();
          const showKeyLabs = keyLabItems !== null;
          const showKeyVitals = keyVitalItems !== null;

          return (
            <>
              {/* Key Labs and Key Vitals Cards - Side by side on desktop, stacked on mobile */}
              {(showKeyLabs || showKeyVitals) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  {/* Key Labs Card */}
                  {showKeyLabs && (
                    <div className="bg-white rounded-lg sm:rounded-xl p-4 sm:p-5 border-2 border-medical-primary-200 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base sm:text-lg font-semibold text-medical-neutral-900 flex items-center gap-2">
                          <div className="bg-medical-primary-50 p-2 rounded-lg">
                            <BarChart className="w-5 h-5 text-medical-primary-600" />
                          </div>
                          Key Labs
                        </h3>
                        <button
                          onClick={() => {
                            sessionStorage.setItem('healthSection', 'labs');
                            onTabChange('health');
                          }}
                          className="text-sm font-medium text-medical-primary-600 hover:text-medical-primary-700 active:text-medical-primary-800 transition-colors touch-manipulation flex items-center gap-1"
                        >
                          View All <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                        {keyLabItems.map((item) => renderMetricItem(item, 'lab'))}
                      </div>
                    </div>
                  )}

                  {/* Key Vitals Card */}
                  {showKeyVitals && (
                    <div className="bg-white rounded-lg sm:rounded-xl p-4 sm:p-5 border-2 border-medical-primary-200 shadow-sm">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base sm:text-lg font-semibold text-medical-neutral-900 flex items-center gap-2">
                          <div className="bg-medical-primary-50 p-2 rounded-lg">
                            <Heart className="w-5 h-5 text-medical-primary-600" />
                          </div>
                          Key Vitals
                        </h3>
                        <button
                          onClick={() => {
                            sessionStorage.setItem('healthSection', 'vitals');
                            onTabChange('health');
                          }}
                          className="text-sm font-medium text-medical-primary-600 hover:text-medical-primary-700 active:text-medical-primary-800 transition-colors touch-manipulation flex items-center gap-1"
                        >
                          View All <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                        {keyVitalItems.map((item) => renderMetricItem(item, 'vital'))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          );
        })() : (
          <div className="bg-white rounded-lg sm:rounded-xl p-6 sm:p-8 text-center border-2 border-medical-primary-200 shadow-sm">
            <div className="w-16 h-16 bg-medical-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ClipboardList className="w-8 h-8 text-medical-primary-600" />
            </div>
            <h3 className="text-lg font-semibold text-medical-neutral-900 mb-2">No health data tracked yet</h3>
            <p className="text-sm text-medical-neutral-600 mb-6">Start by uploading lab results or chatting with the AI assistant</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => onTabChange('chat')}
                className="px-6 py-3 min-h-[44px] bg-white border-2 border-medical-primary-500 text-medical-primary-600 rounded-lg hover:bg-medical-primary-50 active:bg-medical-primary-100 transition-all duration-200 text-sm font-semibold shadow-sm hover:shadow-md flex items-center justify-center gap-2 touch-manipulation"
              >
                <MessageSquare className="w-4 h-4" />
                Chat with AI
              </button>
              <button
                onClick={() => {
                  if (!hasUploadedDocument) {
                    openDocumentOnboarding('labs');
                  } else {
                    onTabChange('files');
                  }
                }}
                className="px-6 py-3 min-h-[44px] bg-medical-primary-500 text-white rounded-lg hover:bg-medical-primary-600 active:bg-medical-primary-700 transition-all duration-200 text-sm font-semibold shadow-sm hover:shadow-md flex items-center justify-center gap-2 touch-manipulation"
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
            {genomicProfile && genomicProfile.mutations && genomicProfile.mutations.length > 0 && (
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base sm:text-lg font-semibold text-medical-neutral-900 flex items-center gap-2">
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-2 rounded-lg">
                    <Dna className="w-5 h-5 text-purple-600" />
                  </div>
                  Genomic Profile
                </h3>
                <button
                  onClick={() => onTabChange('profile')}
                  className="text-sm font-medium text-medical-primary-600 hover:text-medical-primary-700 active:text-medical-primary-800 transition-colors touch-manipulation flex items-center gap-1"
                >
                  View All <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
            {genomicProfile && ((genomicProfile.mutations && genomicProfile.mutations.length > 0) || (genomicProfile.cnvs && genomicProfile.cnvs.length > 0)) ? (
              <>
                <div className="bg-white rounded-lg p-3 mb-3">
                  <div className="flex flex-wrap gap-2">
                    {genomicProfile.mutations && genomicProfile.mutations.slice(0, 5).map((mutation, idx) => (
                      <span key={idx} className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                        {mutation.gene} {formatLabel(mutation.variant || mutation.type)}
                      </span>
                    ))}
                    {genomicProfile.cnvs && genomicProfile.cnvs.slice(0, 3).map((cnv, idx) => {
                      const cnvType = cnv.type === 'amplification' || cnv.type === 'gain' || (cnv.copyNumber && cnv.copyNumber > 2) ? 'Amp' : 'Del';
                      return (
                        <span key={`cnv-${idx}`} className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-medium">
                          {cnv.gene} {cnvType}
                        </span>
                      );
                    })}
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
              </>
            ) : (
              <div className="bg-white rounded-lg sm:rounded-xl p-6 sm:p-8 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Dna className="w-8 h-8 text-purple-600" />
                </div>
                <h3 className="text-lg font-semibold text-medical-neutral-900 mb-2">No genomic data yet</h3>
                <p className="text-sm text-medical-neutral-600 mb-6">Upload your genomic test report to match with targeted therapies and clinical trials</p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={() => {
                      if (!hasUploadedDocument) {
                        openDocumentOnboarding('genomic');
                      } else {
                        onTabChange('files');
                      }
                    }}
                    className="px-6 py-3 min-h-[44px] bg-purple-600 text-white rounded-lg hover:bg-purple-700 active:bg-purple-800 transition-all duration-200 text-sm font-semibold shadow-sm hover:shadow-md flex items-center justify-center gap-2 touch-manipulation"
                  >
                    <Upload className="w-4 h-4" />
                    Upload Genomic Report
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Saved Trials */}
        <div className="bg-white rounded-lg sm:rounded-xl p-4 sm:p-5 border-2 border-medical-accent-200 shadow-sm">
          {!loadingSavedTrials && savedTrials.length > 0 && (
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base sm:text-lg font-semibold text-medical-neutral-900 flex items-center gap-2">
                <div className="bg-medical-accent-50 p-2 rounded-lg">
                  <Bookmark className="w-5 h-5 text-medical-accent-600" />
                </div>
                Saved Trials
              </h3>
              <button
                onClick={() => onTabChange('trials')}
                className="text-sm font-medium text-medical-primary-600 hover:text-medical-primary-700 active:text-medical-primary-800 transition-colors touch-manipulation flex items-center gap-1"
              >
                View All <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
          {loadingSavedTrials ? (
            <div className="text-center py-8">
              <p className="text-medical-neutral-600 text-sm">Loading saved trials...</p>
            </div>
          ) : savedTrials.length > 0 ? (
            <div className="space-y-3">
              {savedTrials.map((trial) => (
                <div
                  key={trial.id}
                  className="border border-medical-neutral-200 rounded-lg p-3 sm:p-4 hover:border-medical-accent-300 hover:shadow-sm active:bg-medical-neutral-100 transition-all cursor-pointer bg-medical-neutral-50/50 touch-manipulation min-h-[60px]"
                  onClick={() => onTabChange('trials')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onTabChange('trials');
                    }
                  }}
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
            </div>
          ) : (
            <div className="bg-white rounded-lg sm:rounded-xl p-6 sm:p-8 text-center">
              <div className="w-16 h-16 bg-medical-accent-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Bookmark className="w-8 h-8 text-medical-accent-600" />
              </div>
              <h3 className="text-lg font-semibold text-medical-neutral-900 mb-2">No saved trials yet</h3>
              <p className="text-sm text-medical-neutral-600 mb-6">Search and save clinical trials that match your profile</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => onTabChange('trials')}
                  className="px-6 py-3 min-h-[44px] bg-medical-accent-500 text-white rounded-lg hover:bg-medical-accent-600 active:bg-medical-accent-700 transition-all duration-200 text-sm font-semibold shadow-sm hover:shadow-md flex items-center justify-center gap-2 touch-manipulation"
                >
                  <Search className="w-4 h-4" />
                  Search Clinical Trials
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lab Tooltip Modal */}
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
                className="p-2 -mr-2 text-medical-neutral-400 hover:text-medical-neutral-600 active:text-medical-neutral-700 transition-colors flex-shrink-0 touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
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

      {/* Upload Progress Overlay */}
      <UploadProgressOverlay
        show={isUploading}
        uploadProgress={uploadProgress}
      />
    </>
  );
}

