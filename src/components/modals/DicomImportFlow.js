import React, { useState, useEffect, useRef } from 'react';
import { Upload, X, FileImage, Trash2, ChevronRight, Loader2 } from 'lucide-react';
import { DesignTokens, combineClasses } from '../../design/designTokens';
import { isZipFile } from '../../services/zipService';
import { isDicomFile } from '../../services/dicomService';
import { prepareZipForViewing } from '../../services/zipViewerService';

/**
 * DICOM Import Flow Modal
 *
 * Viewer-only flow: select files → optional note → open viewer.
 * No save option; action step skipped.
 */
export default function DicomImportFlow({
  show,
  onClose,
  onViewNow = null,
  onSaveToLibrary,
  userId
}) {
  const [step, setStep] = useState(1); // 1 = files, 2 = optional note
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [note, setNote] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [filePreviews, setFilePreviews] = useState({});
  const filePreviewsRef = useRef({});

  // Reset state when modal opens/closes
  useEffect(() => {
    if (show) {
      setStep(1);
      setSelectedFiles([]);
      setNote('');
      setIsProcessing(false);
      setProcessingMessage('');
    }
  }, [show]);

  // Cleanup preview URLs
  useEffect(() => {
    return () => {
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
    
    const oldPreviews = filePreviewsRef.current;
    Object.keys(oldPreviews).forEach(key => {
      if (!newPreviews[key] && oldPreviews[key]?.startsWith('blob:')) {
        URL.revokeObjectURL(oldPreviews[key]);
      }
    });
    
    filePreviewsRef.current = newPreviews;
    setFilePreviews(newPreviews);
  }, [selectedFiles]);

  const openFilePicker = () => {
    const input = document.createElement('input');
    input.type = 'file';
    // Accept DICOM files and ZIP archives
    input.accept = '.dcm,.dicom,.zip,application/dicom,application/x-dicom,application/zip';
    input.multiple = true;
    
    input.style.position = 'fixed';
    input.style.top = '-9999px';
    input.style.left = '-9999px';
    
    input.onchange = async (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) {
        // Validate files are DICOM or ZIP
        const validFiles = [];
        for (const file of files) {
          const isZip = isZipFile(file);
          const isDicom = await isDicomFile(file);
          if (isZip || isDicom) {
            validFiles.push(file);
          }
        }
        
        if (validFiles.length > 0) {
          setSelectedFiles(prev => [...prev, ...validFiles]);
        } else if (files.length > 0) {
          alert('Please select scan files (.dcm) or a ZIP archive containing CT/MRI/PET scan images.');
        }
      }
      
      if (document.body.contains(input)) {
        document.body.removeChild(input);
      }
    };
    
    document.body.appendChild(input);
    input.click();
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => {
      const newFiles = prev.filter((_, i) => i !== index);
      // Cleanup preview URL
      if (filePreviewsRef.current[index]) {
        URL.revokeObjectURL(filePreviewsRef.current[index]);
        delete filePreviewsRef.current[index];
      }
      return newFiles;
    });
  };

  const handleContinueFromStep1 = () => {
    if (selectedFiles.length > 0) {
      setStep(2);
    }
  };

  const handleBack = () => {
    if (step === 2) setStep(1);
  };

  const handleViewNow = async () => {
    if (selectedFiles.length === 0) return;

    setIsProcessing(true);
    setProcessingMessage('Preparing files for viewing...');

    try {
      // Check if we have a ZIP file
      const zipFile = selectedFiles.find(f => isZipFile(f));
      
      if (zipFile) {
        // Handle ZIP file
        const arrayBuffer = await zipFile.arrayBuffer();
        setProcessingMessage('Processing ZIP archive...');
        
        const zipViewerResult = await prepareZipForViewing(
          arrayBuffer,
          (current, total, message) => {
            if (message) setProcessingMessage(message);
          }
        );

        if (!zipViewerResult.success) {
          throw new Error(zipViewerResult.error || 'Failed to prepare ZIP for viewing');
        }

        const viewerData = {
          source: 'zip',
          zipFile: zipFile,
          zip: zipViewerResult.zip,
          series: zipViewerResult.series.map(s => ({
            id: s.id,
            label: s.label,
            studyInstanceUID: s.studyInstanceUID,
            seriesInstanceUID: s.seriesInstanceUID,
            modality: s.modality,
            bodyPartExamined: s.bodyPartExamined,
            fileIndices: s.fileIndices || []
          })),
          dicomDirStructure: zipViewerResult.dicomDirStructure,
          loadSeriesFiles: zipViewerResult.loadSeriesFiles
        };

        setIsProcessing(false);
        onClose();
        if (onViewNow) {
          onViewNow(viewerData);
        }
      } else {
        // Handle individual DICOM files
        // For single/multi DICOM files, pass as array
        // The viewer expects an array of document objects or a viewer data structure
        const viewerData = Array.isArray(selectedFiles) ? selectedFiles : [selectedFiles];
        
        setIsProcessing(false);
        onClose();
        if (onViewNow) {
          onViewNow(viewerData);
        }
      }
    } catch (error) {
      console.error('Error preparing files for viewing:', error);
      setProcessingMessage(`Error: ${error.message}`);
      setIsProcessing(false);
    }
  };

  const handleSkipNote = () => {
    handleViewNow();
  };

  const handleContinueWithNote = () => {
    handleViewNow();
  };

  if (!show) return null;

  const totalSteps = 2;
  const progressPercentage = (step / totalSteps) * 100;

  return (
    <div className={DesignTokens.components.modal.backdrop}>
      <div className={combineClasses('bg-white w-full h-full md:h-auto md:rounded-xl md:max-w-4xl md:max-h-[90vh] overflow-y-auto animate-slide-up')}>
        {/* Header with progress */}
        <div className={combineClasses('sticky top-0 bg-white', DesignTokens.borders.divider)}>
          <div className={combineClasses('w-full h-1', DesignTokens.colors.neutral[100])}>
            <div 
              className={combineClasses('h-full bg-gradient-to-r from-blue-600 to-blue-500 transition-all duration-500 ease-out')}
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          
          <div className={combineClasses('px-6 py-4 flex items-start justify-between gap-4')}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h2 className={combineClasses(DesignTokens.typography.h2.full, DesignTokens.typography.h2.weight, DesignTokens.colors.neutral.text[900])}>
                  View CT / MRI / PET Scans
                </h2>
                <span className={combineClasses(DesignTokens.typography.body.xs, DesignTokens.colors.neutral.text[500], 'flex-shrink-0')}>
                  Step {step} of {totalSteps}
                </span>
              </div>
              <p className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.colors.neutral.text[600])}>
                {step === 1 && 'Select a ZIP file of scan images, or individual scan files (ZIP required for multi-series)'}
                {step === 2 && 'Add an optional note, or skip to open the viewer'}
              </p>
            </div>
            <button
              onClick={onClose}
              className={combineClasses(DesignTokens.components.modal.closeButton, 'flex-shrink-0')}
              type="button"
              disabled={isProcessing}
            >
              <X className={combineClasses(DesignTokens.icons.standard.size.full)} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className={combineClasses(DesignTokens.spacing.card.desktop, 'space-y-4')}>
          {isProcessing ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className={combineClasses('w-8 h-8 animate-spin mb-4', DesignTokens.colors.primary[500])} />
              <p className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.colors.neutral.text[600])}>
                {processingMessage || 'Processing...'}
              </p>
            </div>
          ) : (
            <>
              {step === 1 && (
                <div className="space-y-4">
                  <div className={combineClasses(
                    DesignTokens.borders.radius.md,
                    DesignTokens.spacing.card.mobile,
                    DesignTokens.borders.width.default,
                    'bg-blue-50 border-blue-200'
                  )}>
                    <h3 className={combineClasses(DesignTokens.typography.h3.full, DesignTokens.typography.h3.weight, DesignTokens.colors.neutral.text[900], 'mb-2')}>
                      Select Files
                    </h3>
                    <p className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.colors.neutral.text[700], 'mb-4')}>
                      <strong>ZIP file required:</strong> Select a ZIP containing your CT, MRI, or PET scan images. Individual scan files (.dcm) are also supported. Dates are read from the scan metadata.
                    </p>
                    
                    <div className="flex flex-col sm:flex-row gap-3 mb-4">
                      <button
                        onClick={openFilePicker}
                        className={combineClasses(
                          'rounded-lg transition font-medium min-h-[44px] touch-manipulation active:opacity-70',
                          'bg-blue-500 text-white hover:bg-blue-600',
                          'flex-1 flex items-center justify-center gap-2'
                        )}
                      >
                        <Upload className={combineClasses(DesignTokens.icons.standard.size.mobile)} />
                        Choose Files
                      </button>
                    </div>

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
                                  <FileImage className={combineClasses('w-6 h-6', DesignTokens.colors.neutral.text[300])} />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={combineClasses(DesignTokens.typography.body.sm, 'font-medium', DesignTokens.colors.neutral.text[900], 'truncate')}>
                                  {file.name}
                                </p>
                                <p className={combineClasses(DesignTokens.typography.body.xs, DesignTokens.colors.neutral.text[500])}>
                                  {(file.size / 1024 / 1024).toFixed(2)} MB
                                  {isZipFile(file) && ' • ZIP Archive'}
                                  {!isZipFile(file) && ' • Scan file'}
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
                        <FileImage className={combineClasses('w-12 h-12 mx-auto mb-2', DesignTokens.colors.neutral.text[300])} />
                        <p className="text-sm">No files selected yet</p>
                        <p className="text-xs mt-1">ZIP file required (or individual scan files)</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div className={combineClasses(
                    DesignTokens.borders.radius.md,
                    DesignTokens.spacing.card.mobile,
                    DesignTokens.borders.width.default,
                    'bg-blue-50 border-blue-200'
                  )}>
                    <h3 className={combineClasses(DesignTokens.typography.h3.full, DesignTokens.typography.h3.weight, DesignTokens.colors.neutral.text[900], 'mb-2')}>
                      Add Note (Optional)
                    </h3>
                    <p className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.colors.neutral.text[700], 'mb-4')}>
                      Add a note to help you remember this scan (e.g., "Baseline CT scan", "Follow-up MRI"). Study and series dates are automatically extracted from the scan metadata. Skip to open the viewer.
                    </p>
                    <div className="space-y-3">
                      <div>
                        <label className={combineClasses('block', DesignTokens.typography.body.sm, 'font-medium', DesignTokens.colors.neutral.text[700], 'mb-2')}>
                          Note <span className={combineClasses(DesignTokens.colors.neutral.text[500], 'text-xs')}>(optional)</span>
                        </label>
                        <textarea
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="e.g., Baseline CT scan, Follow-up MRI, Pre-treatment scan"
                          rows={3}
                          className={combineClasses(DesignTokens.components.input.base, DesignTokens.components.input.textarea)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className={combineClasses('sticky bottom-0', DesignTokens.components.modal.footer, 'flex items-center justify-between')}>
          {step === 1 && (
            <>
              <button
                onClick={onClose}
                className={combineClasses(DesignTokens.colors.neutral.text[600], 'hover:text-medical-neutral-900', 'font-medium', DesignTokens.transitions.default, 'flex items-center gap-2', DesignTokens.spacing.button.full, 'py-2.5')}
                disabled={isProcessing}
              >
                Cancel
              </button>
              <div className="flex gap-2">
                <button
                  onClick={handleContinueFromStep1}
                  disabled={selectedFiles.length === 0 || isProcessing}
                  className={combineClasses(
                    DesignTokens.colors.neutral.text[600],
                    'hover:text-medical-neutral-900 font-medium',
                    DesignTokens.transitions.default,
                    'flex items-center gap-2 py-2.5 px-4',
                    (selectedFiles.length === 0 || isProcessing) && 'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  Add note
                </button>
                <button
                  onClick={handleViewNow}
                  disabled={selectedFiles.length === 0 || isProcessing}
                  className={combineClasses(
                    DesignTokens.components.button.primary,
                    DesignTokens.spacing.button.full,
                    'py-2.5 flex items-center gap-2',
                    (selectedFiles.length === 0 || isProcessing) && 'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  Open viewer
                  <ChevronRight className={combineClasses(DesignTokens.icons.standard.size.mobile)} />
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <button
                onClick={handleBack}
                className={combineClasses(DesignTokens.colors.neutral.text[600], 'hover:text-medical-neutral-900', 'font-medium', DesignTokens.transitions.default, 'flex items-center gap-2', DesignTokens.spacing.button.full, 'py-2.5')}
                disabled={isProcessing}
              >
                Back
              </button>
              <div className="flex gap-2">
                <button
                  onClick={handleSkipNote}
                  className={combineClasses(DesignTokens.colors.neutral.text[600], 'hover:text-medical-neutral-900', 'font-medium', DesignTokens.transitions.default, 'flex items-center gap-2', DesignTokens.spacing.button.full, 'py-2.5')}
                  disabled={isProcessing}
                >
                  Skip to viewer
                </button>
                <button
                  onClick={handleContinueWithNote}
                  className={combineClasses(
                    DesignTokens.components.button.primary,
                    DesignTokens.spacing.button.full,
                    'py-2.5 flex items-center gap-2'
                  )}
                  disabled={isProcessing}
                >
                  Open viewer
                  <ChevronRight className={combineClasses(DesignTokens.icons.standard.size.mobile)} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
