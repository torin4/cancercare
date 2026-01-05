import React, { useState, useEffect, useRef } from 'react';
import { Upload, Activity, Dna, FileText, X, CheckCircle, ChevronRight, AlertTriangle, Camera, Trash2 } from 'lucide-react';
import { useHealthContext } from '../../contexts/HealthContext';
import DatePicker from '../DatePicker';
import { DesignTokens, combineClasses } from '../../design/designTokens';

const DocumentUploadOnboarding = ({ onClose, onUploadClick, isOnboarding = true }) => {
  const { hasRealLabData, hasRealVitalData } = useHealthContext();
  const [selectedType, setSelectedType] = useState(null);
  const [documentDate, setDocumentDate] = useState('');
  const [documentNote, setDocumentNote] = useState('');
  const [onlyExistingMetrics, setOnlyExistingMetrics] = useState(false);
  const [currentStep, setCurrentStep] = useState(1); // 1 = document type, 2 = date, 3 = notes, 4 = files
  const [selectedFiles, setSelectedFiles] = useState([]); // Track selected files
  const [filePreviews, setFilePreviews] = useState({}); // Track preview URLs for images
  const filePreviewsRef = useRef({});

  // Update ref when filePreviews changes
  useEffect(() => {
    filePreviewsRef.current = filePreviews;
  }, [filePreviews]);

  // Cleanup preview URLs when component unmounts
  useEffect(() => {
    return () => {
      // Cleanup all preview URLs on unmount
      Object.values(filePreviewsRef.current).forEach(url => {
        if (url && url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, []);

  // Generate preview URLs for image files
  useEffect(() => {
    const newPreviews = {};
    selectedFiles.forEach((file, index) => {
      if (file.type.startsWith('image/')) {
        newPreviews[index] = URL.createObjectURL(file);
      }
    });
    
    // Revoke old preview URLs that are no longer needed
    const oldPreviews = filePreviewsRef.current;
    Object.keys(oldPreviews).forEach(key => {
      if (!newPreviews[key] && oldPreviews[key]?.startsWith('blob:')) {
        URL.revokeObjectURL(oldPreviews[key]);
      }
    });
    
    setFilePreviews(newPreviews);
  }, [selectedFiles]);

  const documentTypes = [
    {
      id: 'blood-test',
      title: 'Blood Test / Lab Results',
      icon: Activity,
      description: 'Upload lab results including tumor markers, CBC, metabolic panel',
      examples: [
        'CA-125, CA 19-9, CEA tumor markers',
        'Complete Blood Count (CBC)',
        'Comprehensive Metabolic Panel (CMP)',
        'Liver function tests (AST, ALT)',
        'Kidney function (Creatinine, eGFR)'
      ],
      color: 'blue',
      helpText: 'We\'ll automatically extract lab values, track trends, and alert you to concerning changes.'
    },
    {
      id: 'genomic-profile',
      title: 'Genomic Test Report',
      icon: Dna,
      description: 'Upload genomic testing results for precision treatment matching',
      examples: [
        'Foundation One CDx report',
        'Guardant360 liquid biopsy',
        'Tempus xT or Tempus TOP',
        'BRCA1/BRCA2 testing',
        'MSI/TMB testing',
        'Any NGS panel report'
      ],
      color: 'purple',
      helpText: 'We\'ll extract mutations, biomarkers (TMB, MSI, HRD), and match you with targeted therapies and clinical trials.'
    },
    {
      id: 'other',
      title: 'Other Medical Document',
      icon: FileText,
      description: 'Imaging reports, pathology, treatment notes, etc.',
      examples: [
        'CT/MRI/PET scan reports',
        'Pathology reports',
        'Oncology progress notes',
        'Treatment plans',
        'Surgical reports'
      ],
      color: 'green',
      helpText: 'We\'ll extract relevant medical information and keep everything organized in one place.'
    }
  ];

  const totalSteps = 4;
  const progressPercentage = (currentStep / totalSteps) * 100;

  const handleContinueFromStep1 = () => {
    if (selectedType) {
      setCurrentStep(2); // Go to date step
    }
  };

  const handleSkipDate = () => {
    // Skip date and go to notes step
    setCurrentStep(3);
  };

  const handleContinueWithDate = () => {
    // Continue with date to notes step
    setCurrentStep(3);
  };

  const handleSkipNote = () => {
    // Skip note and go to file selection step
    setCurrentStep(4);
  };

  const handleContinueWithNote = () => {
    // Continue with note and go to file selection step
    setCurrentStep(4);
  };

  const openFilePicker = (useCamera = false) => {
    // Create file input and trigger it immediately (must be in user interaction context)
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.vcf,.vcf.gz,.maf,.bed,.txt,.csv,.tsv,.zip,.gz,.xlsx,.xls,image/*';
    input.multiple = true; // Enable multiple file selection
    
    // Check if mobile device and enable camera option
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile && useCamera) {
      input.capture = 'environment'; // Enable camera option on mobile
      input.multiple = false; // Camera typically only allows one photo at a time
    }
    
    input.style.position = 'fixed';
    input.style.top = '-9999px';
    input.style.left = '-9999px';
    
    input.onchange = async (e) => {
      const files = Array.from(e.target.files || []);
      
      if (files.length > 0) {
        // Add files to selectedFiles state instead of uploading immediately
        setSelectedFiles(prev => [...prev, ...files]);
      }
      
      // Clean up
      if (document.body.contains(input)) {
        document.body.removeChild(input);
      }
    };
    
    // Append to body and click immediately (must be in user interaction context)
    document.body.appendChild(input);
    input.click();
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUploadAll = async () => {
    if (selectedFiles.length === 0) {
      return; // No files to upload
    }

    // Normalize date and note
    const normalizedDate = (documentDate && typeof documentDate === 'string' && documentDate.trim() !== '') 
      ? documentDate.trim() 
      : null;
    const normalizedNote = (documentNote && typeof documentNote === 'string' && documentNote.trim() !== '') 
      ? documentNote.trim() 
      : null;

    // Pass all files to onUploadClick
    try {
      if (selectedFiles.length === 1) {
        await onUploadClick(selectedType, normalizedDate, normalizedNote, selectedFiles[0], onlyExistingMetrics);
      } else {
        await onUploadClick(selectedType, normalizedDate, normalizedNote, selectedFiles, onlyExistingMetrics);
      }
    } catch (error) {
    }
  };

  const handleBack = () => {
    if (currentStep === 4) {
      setCurrentStep(3);
    } else if (currentStep === 3) {
      setCurrentStep(2);
    } else if (currentStep === 2) {
      setCurrentStep(1);
    }
  };

  return (
    <div className={DesignTokens.components.modal.backdrop}>
      <div className={combineClasses('bg-white w-full h-full md:h-auto md:rounded-xl md:max-w-4xl md:max-h-[90vh] overflow-y-auto animate-slide-up')}>
        {/* Header with integrated progress */}
        <div className={combineClasses('sticky top-0 bg-white', DesignTokens.borders.divider)}>
          {/* Subtle progress bar at top */}
          <div className={combineClasses('w-full h-1', DesignTokens.colors.neutral[100])}>
            <div 
              className={combineClasses('h-full bg-gradient-to-r from-yellow-500 to-yellow-600 transition-all duration-500 ease-out')}
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          
          {/* Header content */}
          <div className={combineClasses('px-6 py-4 flex items-start justify-between gap-4')}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h2 className={combineClasses(DesignTokens.typography.h2.full, DesignTokens.typography.h2.weight, DesignTokens.colors.neutral.text[900])}>{isOnboarding ? 'Upload Your First File' : 'File Upload'}</h2>
                <span className={combineClasses(DesignTokens.typography.body.xs, DesignTokens.colors.neutral.text[500], 'flex-shrink-0')}>
                  Step {currentStep} of {totalSteps}
                </span>
              </div>
              <p className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.colors.neutral.text[600])}>
                {currentStep === 1 && (isOnboarding ? 'Choose the type of file you\'d like to upload' : 'Select document type')}
                {currentStep === 2 && 'When was this document created or when were these tests performed?'}
                {currentStep === 3 && 'Add any context about this document (optional)'}
                {currentStep === 4 && 'Add photos or files. You can take multiple photos or select from your gallery.'}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }}
              className={combineClasses(DesignTokens.components.modal.closeButton, 'flex-shrink-0')}
              type="button"
            >
              <X className={combineClasses(DesignTokens.icons.standard.size.full)} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className={combineClasses(DesignTokens.spacing.card.desktop, 'space-y-4')}>
          {currentStep === 1 && (
            // Document type selection
            documentTypes.map((type) => {
            const Icon = type.icon;
            const isSelected = selectedType === type.id;
            const colorClasses = {
              blue: {
                border: 'border-medical-primary-200',
                bg: 'bg-medical-primary-50',
                selectedBorder: 'border-medical-primary-500',
                selectedBg: 'bg-medical-primary-50',
                icon: 'text-medical-primary-600',
                badge: 'bg-medical-primary-100 text-medical-primary-700'
              },
              purple: {
                border: 'border-purple-200',
                bg: 'bg-gradient-to-br from-purple-50 to-pink-50',
                selectedBorder: 'border-purple-500',
                selectedBg: 'bg-gradient-to-br from-purple-50 to-pink-50',
                icon: 'text-purple-600',
                badge: 'bg-purple-100 text-purple-700'
              },
              green: {
                border: 'border-medical-accent-200',
                bg: 'bg-medical-accent-50',
                selectedBorder: 'border-medical-accent-500',
                selectedBg: 'bg-medical-accent-50',
                icon: 'text-medical-accent-600',
                badge: 'bg-medical-accent-100 text-medical-accent-700'
              }
            }[type.color];

            // Hover classes for each color type
            const hoverClasses = {
              blue: 'hover:border-medical-primary-500',
              purple: 'hover:border-purple-500',
              green: 'hover:border-medical-accent-500'
            }[type.color];

            return (
              <div
                key={type.id}
                onClick={() => setSelectedType(type.id)}
                className={combineClasses(
                  DesignTokens.borders.width.thick,
                  DesignTokens.borders.radius.md,
                  DesignTokens.spacing.card.full,
                  'cursor-pointer',
                  DesignTokens.transitions.all,
                  isSelected
                    ? combineClasses(colorClasses.selectedBorder, colorClasses.selectedBg, DesignTokens.shadows.md)
                    : combineClasses(colorClasses.border, hoverClasses, DesignTokens.shadows.hover)
                )}
              >
                {/* Header with Icon, Title, Description */}
                <div className="flex items-start gap-4 mb-3">
                  {/* Icon */}
                  <div className={combineClasses(colorClasses.bg, DesignTokens.spacing.iconContainer.full, DesignTokens.borders.radius.md, 'flex-shrink-0')}>
                    <Icon className={combineClasses(DesignTokens.icons.standard.size.mobile, colorClasses.icon)} />
                  </div>

                  {/* Title and Description */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className={combineClasses(DesignTokens.typography.h3.full, DesignTokens.typography.h3.weight, DesignTokens.colors.neutral.text[900])}>{type.title}</h3>
                        <p className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.colors.neutral.text[600], 'mt-1')}>{type.description}</p>
                      </div>
                      {isSelected && (
                        <CheckCircle className={combineClasses(DesignTokens.icons.standard.size.full, DesignTokens.colors.primary.text[600], 'flex-shrink-0')} />
                      )}
                    </div>
                  </div>
                </div>

                {/* Examples - Full Width */}
                <div className="w-full mt-3">
                  <p className={combineClasses(DesignTokens.typography.body.xs, 'font-semibold', DesignTokens.colors.neutral.text[700], 'mb-2')}>Examples:</p>
                  <div className={combineClasses('flex flex-wrap', DesignTokens.spacing.gap.sm)}>
                    {type.examples.map((example, idx) => (
                      <span
                        key={idx}
                        className={combineClasses(DesignTokens.typography.body.xs, 'px-2 py-1', DesignTokens.borders.radius.full, colorClasses.badge)}
                      >
                        {example}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Help Text */}
                {isSelected && (
                  <div className={combineClasses('mt-3', DesignTokens.spacing.card.mobile, colorClasses.bg, DesignTokens.borders.radius.md, DesignTokens.borders.width.default, colorClasses.border)}>
                    <p className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.colors.neutral.text[700])}>
                      <strong>What we'll do:</strong> {type.helpText}
                    </p>
                  </div>
                )}
              </div>
            );
          })
          )}
          
          {currentStep === 2 && (
            // Date input step
            <div className="space-y-4">
              <div className={combineClasses(
                DesignTokens.borders.radius.md,
                DesignTokens.spacing.card.mobile,
                DesignTokens.borders.width.default,
                selectedType === 'genomic-profile'
                  ? 'bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200'
                  : selectedType === 'blood-test'
                  ? 'bg-blue-50 border-blue-200'
                  : 'bg-green-50 border-green-200'
              )}>
                <h3 className={combineClasses(DesignTokens.typography.h3.full, DesignTokens.typography.h3.weight, DesignTokens.colors.neutral.text[900], 'mb-2')}>Document Date</h3>
                <p className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.colors.neutral.text[700], 'mb-4')}>
                  When was this document created or when were these tests performed? This helps us accurately track your health data over time.
                </p>
                
                {/* Warning for multiple dates */}
                <div className={combineClasses('mb-4', DesignTokens.spacing.card.mobile, 'bg-amber-50', DesignTokens.borders.width.default, 'border-amber-200', DesignTokens.borders.radius.md)}>
                  <div className="flex items-start gap-2">
                    <AlertTriangle className={combineClasses(DesignTokens.icons.standard.size.mobile, 'text-amber-600 flex-shrink-0 mt-0.5')} />
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-amber-900 mb-1">
                        Important: Single Date Only
                      </p>
                      <p className="text-xs text-amber-800">
                        This date field should only be used for documents where all tests/results are from the same date. 
                        If your document contains results from multiple dates, leave this blank and we'll extract dates from the document itself.
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className={combineClasses('block', DesignTokens.typography.body.sm, 'font-medium', DesignTokens.colors.neutral.text[700], 'mb-2')}>
                      Document Date <span className={combineClasses(DesignTokens.colors.neutral.text[500], 'text-xs')}>(optional)</span>
                    </label>
                    <DatePicker
                      value={documentDate}
                      onChange={(e) => setDocumentDate(e.target.value)}
                      max={new Date().toISOString().split('T')[0]}
                      placeholder="YYYY-MM-DD"
                      showClear={true}
                    />
                    <p className={combineClasses(DesignTokens.typography.body.xs, DesignTokens.colors.neutral.text[500], 'mt-1')}>
                      If you don't know the date or your document has multiple dates, you can skip and we'll try to extract it from the document.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {currentStep === 3 && (
            // Note input step
            <div className="space-y-4">
              <div className={combineClasses(
                DesignTokens.borders.radius.md,
                DesignTokens.spacing.card.mobile,
                DesignTokens.borders.width.default,
                selectedType === 'genomic-profile'
                  ? 'bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200'
                  : selectedType === 'blood-test'
                  ? 'bg-blue-50 border-blue-200'
                  : 'bg-green-50 border-green-200'
              )}>
                <h3 className={combineClasses(DesignTokens.typography.h3.full, DesignTokens.typography.h3.weight, DesignTokens.colors.neutral.text[900], 'mb-2')}>Add Context Note</h3>
                <p className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.colors.neutral.text[700], 'mb-4')}>
                  {selectedType === 'blood-test' 
                    ? 'Add any context about this lab report that might be helpful for understanding the values (e.g., "Before starting treatment", "After cycle 2", "Post-surgery"). This note will be attached to all lab and vital values extracted from this document.'
                    : selectedType === 'genomic-profile'
                    ? 'Add any context about this genomic test that might be helpful (e.g., "Baseline before treatment", "After progression", "Post-biopsy"). This note will help the AI provide more contextualized insights when analyzing your genomic data.'
                    : 'Add any context about this document that might be helpful (e.g., "Before treatment", "Follow-up visit", "Emergency department"). This note will help the AI provide more contextualized insights when analyzing your medical records.'
                  }
                </p>
                <div className={combineClasses(
                  DesignTokens.borders.radius.md,
                  DesignTokens.spacing.card.mobile,
                  'mb-4',
                  DesignTokens.borders.width.default,
                  selectedType === 'genomic-profile'
                    ? 'bg-purple-100 border-purple-300'
                    : selectedType === 'blood-test'
                    ? 'bg-blue-100 border-blue-300'
                    : 'bg-green-100 border-green-300'
                )}>
                  <p className={`text-xs font-medium mb-1 ${
                    selectedType === 'genomic-profile'
                      ? 'text-purple-800'
                      : selectedType === 'blood-test'
                      ? 'text-blue-800'
                      : 'text-green-800'
                  }`}>How this helps the AI:</p>
                  <p className={`text-xs ${
                    selectedType === 'genomic-profile'
                      ? 'text-purple-700'
                      : selectedType === 'blood-test'
                      ? 'text-blue-700'
                      : 'text-green-700'
                  }`}>
                    When you ask questions about your health data, the AI will see this context note and use it to provide more relevant and contextualized insights. For example, if you note "After cycle 2", the AI will understand that values were taken after a specific treatment cycle when analyzing trends or explaining results.
                  </p>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className={combineClasses('block', DesignTokens.typography.body.sm, 'font-medium', DesignTokens.colors.neutral.text[700], 'mb-2')}>
                      Context Note <span className={combineClasses(DesignTokens.colors.neutral.text[500], 'text-xs')}>(optional)</span>
                    </label>
                    <textarea
                      value={documentNote}
                      onChange={(e) => setDocumentNote(e.target.value)}
                      placeholder="e.g., Before starting treatment, After cycle 2, Post-surgery..."
                      rows={3}
                      className={combineClasses(DesignTokens.components.input.base, DesignTokens.components.input.textarea)}
                    />
                    <p className={combineClasses(DesignTokens.typography.body.xs, DesignTokens.colors.neutral.text[500], 'mt-1')}>
                      This note will be saved with the document and all extracted values, helping the AI provide better context-aware responses.
                    </p>
                  </div>
                  
                  {/* Only extract existing metrics checkbox - only show for blood-test type and if user has existing metrics */}
                  {selectedType === 'blood-test' && (hasRealLabData || hasRealVitalData) && (
                    <div className={combineClasses('mt-4 pt-4', DesignTokens.borders.divider)}>
                      <label className="flex items-start gap-3 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={onlyExistingMetrics}
                          onChange={(e) => setOnlyExistingMetrics(e.target.checked)}
                          className={combineClasses('mt-1', DesignTokens.components.input.checkbox)}
                        />
                        <div className="flex-1">
                          <div className={combineClasses(DesignTokens.typography.body.sm, 'font-medium', DesignTokens.colors.neutral.text[900], 'group-hover:text-medical-neutral-700')}>
                            Only extract data for metrics that already exist
                          </div>
                          <p className={combineClasses(DesignTokens.typography.body.xs, DesignTokens.colors.neutral.text[600], 'mt-1')}>
                            When enabled, only labs and vitals that you've already added to your Health tab will be extracted. New metrics will be skipped.
                          </p>
                        </div>
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {currentStep === 4 && (() => {
            // Get the selected document type and its color
            const selectedDocType = documentTypes.find(type => type.id === selectedType);
            const docColor = selectedDocType?.color || 'blue';
            
            // Theme-based button classes
            const themeButtonClasses = {
              blue: {
                primary: 'bg-medical-primary-500 text-white hover:bg-medical-primary-600',
                secondary: 'bg-medical-primary-50 text-medical-primary-600 hover:bg-medical-primary-100 border border-medical-primary-200'
              },
              purple: {
                primary: 'bg-purple-500 text-white hover:bg-purple-600',
                secondary: 'bg-purple-50 text-purple-600 hover:bg-purple-100 border border-purple-200'
              },
              green: {
                primary: 'bg-medical-accent-500 text-white hover:bg-medical-accent-600',
                secondary: 'bg-medical-accent-50 text-medical-accent-600 hover:bg-medical-accent-100 border border-medical-accent-200'
              }
            }[docColor];
            
            return (
            // File selection step
            <div className="space-y-4">
              <div className={combineClasses(
                DesignTokens.borders.radius.md,
                DesignTokens.spacing.card.mobile,
                DesignTokens.borders.width.default,
                selectedType === 'genomic-profile'
                  ? 'bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200'
                  : selectedType === 'blood-test'
                  ? 'bg-blue-50 border-blue-200'
                  : 'bg-green-50 border-green-200'
              )}>
                <h3 className={combineClasses(DesignTokens.typography.h3.full, DesignTokens.typography.h3.weight, DesignTokens.colors.neutral.text[900], 'mb-4')}>Add Photos or Files</h3>
                
                {/* Action buttons */}
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                  <button
                    onClick={() => openFilePicker(true)}
                    className={combineClasses(
                      'rounded-lg transition-colors font-medium min-h-[44px] touch-manipulation active:opacity-70',
                      themeButtonClasses.primary,
                      'flex-1 flex items-center justify-center gap-2'
                    )}
                  >
                    <Camera className={combineClasses(DesignTokens.icons.standard.size.mobile)} />
                    Take Photo
                  </button>
                  <button
                    onClick={() => openFilePicker(false)}
                    className={combineClasses(
                      'rounded-lg transition font-medium min-h-[44px] touch-manipulation active:opacity-70',
                      themeButtonClasses.secondary,
                      'flex-1 flex items-center justify-center gap-2'
                    )}
                  >
                    <Upload className={combineClasses(DesignTokens.icons.standard.size.mobile)} />
                    Choose from Gallery
                  </button>
                </div>

                {/* Selected files list */}
                {selectedFiles.length > 0 && (
                  <div className="space-y-2">
                    <p className={combineClasses(DesignTokens.typography.body.sm, 'font-medium', DesignTokens.colors.neutral.text[700])}>
                      Selected Files ({selectedFiles.length})
                    </p>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {selectedFiles.map((file, index) => (
                        <div
                          key={index}
                          className={combineClasses('flex items-center', DesignTokens.spacing.gap.md, DesignTokens.spacing.card.mobile, 'bg-white', DesignTokens.borders.width.default, DesignTokens.colors.neutral.border[200], DesignTokens.borders.radius.md)}
                        >
                          <div className={combineClasses('flex-shrink-0 w-12 h-12 rounded flex items-center justify-center', DesignTokens.colors.neutral[100])}>
                            {file.type.startsWith('image/') && filePreviews[index] ? (
                              <img
                                src={filePreviews[index]}
                                alt={file.name}
                                className="w-full h-full object-cover rounded"
                              />
                            ) : (
                              <FileText className={combineClasses('w-6 h-6', DesignTokens.colors.neutral.text[300])} />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={combineClasses(DesignTokens.typography.body.sm, 'font-medium', DesignTokens.colors.neutral.text[900], 'truncate')}>{file.name}</p>
                            <p className={combineClasses(DesignTokens.typography.body.xs, DesignTokens.colors.neutral.text[500])}>
                              {(file.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                          <button
                            onClick={() => removeFile(index)}
                            className={combineClasses('flex-shrink-0', DesignTokens.spacing.iconContainer.mobile, 'text-red-600 hover:bg-red-50', DesignTokens.borders.radius.md, DesignTokens.transitions.default)}
                            title="Remove file"
                          >
                            <Trash2 className={combineClasses(DesignTokens.icons.standard.size.mobile)} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedFiles.length === 0 && (
                  <div className={combineClasses('text-center py-8', DesignTokens.colors.neutral.text[500])}>
                    <Upload className={combineClasses('w-12 h-12 mx-auto mb-2', DesignTokens.colors.neutral.text[300])} />
                    <p className="text-sm">No files selected yet</p>
                    <p className="text-xs mt-1">Take a photo or choose from your gallery</p>
                  </div>
                )}
              </div>
            </div>
            );
          })()}
        </div>

        {/* Footer */}
        <div className={combineClasses('sticky bottom-0', DesignTokens.components.modal.footer, 'flex items-center justify-between')}>
          {currentStep === 1 && (
            <>
              <button
                onClick={onClose}
                className={combineClasses(DesignTokens.colors.neutral.text[600], 'hover:text-medical-neutral-900', 'font-medium', DesignTokens.transitions.default, 'flex items-center gap-2', DesignTokens.spacing.button.full, 'py-2.5')}
              >
                Cancel
              </button>
              <button
                onClick={handleContinueFromStep1}
                disabled={!selectedType}
                className={combineClasses(
                  'bg-gray-800 hover:bg-gray-700 text-white',
                  DesignTokens.spacing.button.full,
                  'py-2.5 flex items-center gap-2',
                  !selectedType && 'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                Continue
                <ChevronRight className={combineClasses(DesignTokens.icons.standard.size.mobile)} />
              </button>
            </>
          )}
          
          {currentStep === 2 && (
            <>
              <button
                onClick={handleBack}
                className={combineClasses(DesignTokens.colors.neutral.text[600], 'hover:text-medical-neutral-900', 'font-medium', DesignTokens.transitions.default, 'flex items-center gap-2', DesignTokens.spacing.button.full, 'py-2.5')}
              >
                <ChevronRight className={combineClasses(DesignTokens.icons.small.size.full, 'rotate-180')} />
                Back
              </button>
              <button
                onClick={documentDate && documentDate.trim() !== '' ? handleContinueWithDate : handleSkipDate}
                className={combineClasses('bg-gray-800 hover:bg-gray-700 text-white', DesignTokens.spacing.button.full, 'py-2.5 flex items-center gap-2')}
              >
                {documentDate && documentDate.trim() !== '' ? 'Continue' : 'Skip without date'}
                <ChevronRight className={combineClasses(DesignTokens.icons.standard.size.mobile)} />
              </button>
            </>
          )}
          
          {currentStep === 3 && (
            <>
              <button
                onClick={handleBack}
                className={combineClasses(DesignTokens.colors.neutral.text[600], 'hover:text-medical-neutral-900', 'font-medium', DesignTokens.transitions.default, 'flex items-center gap-2', DesignTokens.spacing.button.full, 'py-2.5')}
              >
                <ChevronRight className={combineClasses(DesignTokens.icons.small.size.full, 'rotate-180')} />
                Back
              </button>
              <button
                onClick={documentNote && documentNote.trim() !== '' ? handleContinueWithNote : handleSkipNote}
                className={combineClasses('bg-gray-800 hover:bg-gray-700 text-white', DesignTokens.spacing.button.full, 'py-2.5 flex items-center gap-2')}
              >
                Continue
                <ChevronRight className={combineClasses(DesignTokens.icons.standard.size.mobile)} />
              </button>
            </>
          )}

          {currentStep === 4 && (
            <>
              <button
                onClick={handleBack}
                className={combineClasses(DesignTokens.colors.neutral.text[600], 'hover:text-medical-neutral-900', 'font-medium', DesignTokens.transitions.default, 'flex items-center gap-2', DesignTokens.spacing.button.full, 'py-2.5')}
              >
                <ChevronRight className={combineClasses(DesignTokens.icons.small.size.full, 'rotate-180')} />
                Back
              </button>
              <button
                onClick={handleUploadAll}
                disabled={selectedFiles.length === 0}
                className={combineClasses(
                  'bg-gray-800 hover:bg-gray-700 text-white',
                  DesignTokens.spacing.button.full,
                  'py-2.5 flex items-center gap-2',
                  selectedFiles.length === 0 && 'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                Upload {selectedFiles.length > 0 ? `${selectedFiles.length} file${selectedFiles.length !== 1 ? 's' : ''}` : 'Files'}
                <ChevronRight className={combineClasses(DesignTokens.icons.standard.size.mobile)} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentUploadOnboarding;
