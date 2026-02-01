import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { BarChart, Heart, Thermometer, Pill, ClipboardList } from 'lucide-react';

const IRIS_ICON_SRC = '/icons/iris_logo.svg';
import { DesignTokens, Layouts, combineClasses } from '../../design/designTokens';
import { useAuth } from '../../contexts/AuthContext';
import { usePatientContext } from '../../contexts/PatientContext';
import { useHealthContext } from '../../contexts/HealthContext';
import { useBanner } from '../../contexts/BannerContext';
import { labService, vitalService, symptomService } from '../../firebase/services';
import UploadProgressOverlay from '../UploadProgressOverlay';
import { processDocument, generateChatSummary } from '../../services/documentProcessor';
import { uploadDocument } from '../../firebase/storage';
import LabsSection from './health/sections/LabsSection';
import VitalsSection from './health/sections/VitalsSection';
import SymptomsSection from './health/sections/SymptomsSection';
import MedicationsSection from './health/sections/MedicationsSection';

export default function HealthTab({ onTabChange, initialSection = null, onOpenMobileChat }) {
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
        // Don't close if clicking on a button, tooltip, chart point, or chart click area
        if (!e.target.closest('.tooltip-container') && 
            !e.target.closest('button') && 
            !e.target.closest('.vital-chart-point') &&
            !e.target.closest('.lab-chart-point') &&
            !e.target.closest('.vital-chart-point-click-area') &&
            !e.target.closest('.lab-chart-point-click-area')) {
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

  // Check for metric to expand from dashboard click
  useEffect(() => {
    const expandMetricStr = sessionStorage.getItem('expandMetric');
    if (expandMetricStr) {
      try {
        const expandMetric = JSON.parse(expandMetricStr);
        if (expandMetric.type === 'lab') {
          setHealthSection('labs');
          // Store the lab key for LabsSection to pick up
          sessionStorage.setItem('expandLabKey', expandMetric.key);
        } else if (expandMetric.type === 'vital') {
          setHealthSection('vitals');
          // Store the vital key for VitalsSection to pick up
          sessionStorage.setItem('expandVitalKey', expandMetric.key);
        }
        sessionStorage.removeItem('expandMetric');
      } catch (e) {
        console.error('Failed to parse expandMetric:', e);
        sessionStorage.removeItem('expandMetric');
      }
    }
  }, []);
  
  // Lab, vital, symptom, and medication state are now managed by their respective section components
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [pendingDocumentDate, setPendingDocumentDate] = useState(null);
  const [pendingDocumentNote, setPendingDocumentNote] = useState(null);
  const [showDocumentOnboarding, setShowDocumentOnboarding] = useState(false);
  const [documentOnboardingMethod, setDocumentOnboardingMethod] = useState('picker');

  // Lab and vital data aliases (used by handleAskAboutHealth and sections via context)
  const allLabData = labsData;
  const allVitalsData = vitalsData;

  // Favorite metrics, toggleFavorite, isLabEmptyHelper, and currentLab are now
  // managed by their respective section components

  // isMedicationTaken and markMedicationTaken are now managed by MedicationsSection component

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
      showError(`Failed to process document: ${error.message}. The file was not uploaded. Please try again or contact support if the issue persists.`);
      setIsUploading(false);
      setUploadProgress('');
    }
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

  // Symptoms and medications data loading is now handled by their respective section components

  // Lab and vital auto-selection, symptom calendar management, and sessionStorage handling
  // are now managed by their respective section components

  // Handle "Ask About Health" button - needs to set context and switch to chat or open mobile overlay
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
      
      // Store in sessionStorage for ChatTab or ChatSidebar to access
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
      
      // Only navigate to chat tab if we're on desktop (no mobile overlay handler)
      if (!onOpenMobileChat) {
        onTabChange('chat');
      }
    } catch (error) {
      showError('Error loading health data. Please try again.');
    }
  };

  return (
    <>
      {/* Header */}
      <div className={combineClasses(
        DesignTokens.spacing.container.mobile,
        'sm:px-4 md:px-6',
        'py-2 sm:py-3',
        'flex items-center justify-between'
      )}>
        <div className={combineClasses('flex items-center', DesignTokens.spacing.gap.sm, 'sm:gap-3')}>
          <div className={combineClasses(DesignTokens.moduleAccent.health.bg, 'p-2 sm:p-2.5 rounded-lg')}>
            <ClipboardList className={combineClasses('w-5 h-5 sm:w-6 sm:h-6', DesignTokens.moduleAccent.health.text)} />
          </div>
          <div>
            <h1 className={combineClasses(DesignTokens.components.header.title, 'mb-0')}>Health</h1>
          </div>
        </div>
        {/* Mobile Ask Button */}
        {onOpenMobileChat && (
          <button
            onClick={() => {
              handleAskAboutHealth().then(() => {
                onOpenMobileChat();
              }).catch(error => {
                console.error('[HealthTab] Failed to prepare health chat:', error);
              });
            }}
            className="lg:hidden text-medical-neutral-600 hover:text-medical-neutral-900 min-h-[44px] min-w-[44px] px-2 touch-manipulation active:opacity-70 flex items-center justify-center transition-colors"
            title="Ask about health data"
          >
            <img src={IRIS_ICON_SRC} alt="" className="w-6 h-6" />
          </button>
        )}
      </div>
      <div className={combineClasses(Layouts.container, Layouts.section)}>

      {/* Health Section Tabs with Ask About Button */}
      <div className={combineClasses('flex items-center', DesignTokens.spacing.gap.responsive.md, Layouts.section, 'overflow-x-auto')}>
        {/* Health Section Tabs */}
        <div className={combineClasses('flex', DesignTokens.spacing.gap.responsive.xs, 'overflow-x-auto', 'flex-1', 'mb-0')}>
        {['labs', 'vitals', 'symptoms', 'medications'].map(section => (
          <button
            key={section}
            onClick={() => setHealthSection(section)}
            className={combineClasses(
              DesignTokens.components.tabs.button.base,
              healthSection === section
                ? DesignTokens.components.tabs.button.active
                : DesignTokens.components.tabs.button.inactive
            )}
          >
            {section === 'labs' && (
              <>
                <BarChart className={DesignTokens.icons.button.size.full} />
                <span className={DesignTokens.typography.body.base}>Labs</span>
              </>
            )}
            {section === 'vitals' && (
              <>
                <Heart className={DesignTokens.icons.button.size.full} />
                <span className={DesignTokens.typography.body.base}>Vitals</span>
              </>
            )}
            {section === 'symptoms' && (
              <>
                <Thermometer className={DesignTokens.icons.button.size.full} />
                <span className={DesignTokens.typography.body.base}>Symptoms</span>
              </>
            )}
            {section === 'medications' && (
              <>
                <Pill className={DesignTokens.icons.button.size.full} />
                <span className={DesignTokens.typography.body.base}>
                  <span className="hidden sm:inline">Medications</span>
                  <span className="sm:hidden">Meds</span>
                </span>
              </>
            )}
          </button>
        ))}
        </div>
      </div>

      {healthSection === 'labs' && (
        <LabsSection
          onTabChange={onTabChange}
          openDocumentOnboarding={openDocumentOnboarding}
          selectedDataPoint={selectedDataPoint}
          setSelectedDataPoint={setSelectedDataPoint}
          hoveredDataPoint={hoveredDataPoint}
          setHoveredDataPoint={setHoveredDataPoint}
        />
      )}

      {healthSection === 'vitals' && (
        <VitalsSection
          onTabChange={onTabChange}
          selectedDataPoint={selectedDataPoint}
          setSelectedDataPoint={setSelectedDataPoint}
          hoveredDataPoint={hoveredDataPoint}
          setHoveredDataPoint={setHoveredDataPoint}
        />
      )}

      {healthSection === 'symptoms' && (
        <SymptomsSection onTabChange={onTabChange} />
      )}

      {healthSection === 'medications' && (
        <MedicationsSection onTabChange={onTabChange} />
      )}

      {/* Old sections have been extracted to component files */}
      {/* Upload Progress Overlay */}
      <UploadProgressOverlay
        show={isUploading}
        uploadProgress={uploadProgress}
      />
      </div>
    </>
  );
}



HealthTab.propTypes = {
  onTabChange: PropTypes.func.isRequired,
  initialSection: PropTypes.oneOf(['labs', 'vitals', 'symptoms', 'medications']),
  onOpenMobileChat: PropTypes.func
};
