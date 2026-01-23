import React, { useEffect, useRef, useState } from 'react';
import { X, Loader2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { DesignTokens, combineClasses } from '../../design/designTokens';
import { downloadFileAsBlob } from '../../firebase/storage';
import { extractDicomMetadata } from '../../services/dicomService';

/**
 * DICOM Viewer Modal Component
 * Uses DWV (DICOM Web Viewer) library to display DICOM files
 * Supports single file or multiple files (series) with navigation
 */
export default function DicomViewerModal({
  show,
  onClose,
  fileUrl = null,
  storagePath = null,
  dicomMetadata = null,
  userId = null,
  documentId = null,
  // New: Support for multiple files (array of document objects)
  documents = null // Array of { fileUrl, storagePath, dicomMetadata, id, fileName }
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalFiles, setTotalFiles] = useState(1);
  const [decodedMetadata, setDecodedMetadata] = useState(null); // Store re-extracted metadata with proper encoding
  const viewerRef = useRef(null);
  const dwvAppRef = useRef(null);
  const objectUrlRefs = useRef([]); // Track all object URLs for cleanup

  // Determine if we have multiple files or single file (computed outside useEffect for use in render)
  const hasMultipleFiles = documents && Array.isArray(documents) && documents.length > 1;
  const fileList = hasMultipleFiles ? documents : (documents && documents.length === 1 ? documents : [{ fileUrl, storagePath, dicomMetadata, id: documentId, fileName: null }]);
  
  useEffect(() => {
    if (!show || (!hasMultipleFiles && !fileUrl && !storagePath && (!documents || documents.length === 0))) {
      return;
    }

    // Initialize DWV app
    const initDWV = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setTotalFiles(fileList.length);
        setCurrentIndex(0);

        // Dynamically import DWV to avoid SSR issues
        const dwv = await import('dwv');

        // Create DWV app instance
        const app = new dwv.App();
        dwvAppRef.current = app;

        // Set the container element
        if (viewerRef.current) {
          // Ensure container has explicit dimensions for DWV
          const container = viewerRef.current;
          
          // Wait for container to have proper dimensions
          let attempts = 0;
          while ((container.offsetWidth === 0 || container.offsetHeight === 0) && attempts < 10) {
            console.log(`Waiting for container dimensions (attempt ${attempts + 1})...`, {
              offsetWidth: container.offsetWidth,
              offsetHeight: container.offsetHeight,
              clientWidth: container.clientWidth,
              clientHeight: container.clientHeight
            });
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
          }
          
          // Set explicit dimensions if still zero
          if (container.offsetWidth === 0 || container.offsetHeight === 0) {
            const parent = container.parentElement;
            if (parent) {
              const parentWidth = parent.clientWidth || window.innerWidth * 0.9;
              const parentHeight = parent.clientHeight || window.innerHeight * 0.7;
              container.style.width = `${parentWidth}px`;
              container.style.height = `${parentHeight}px`;
              console.log('Set explicit container dimensions:', {
                width: container.style.width,
                height: container.style.height
              });
            }
          }
          
          console.log('Initializing DWV with container dimensions:', {
            width: container.offsetWidth,
            height: container.offsetHeight,
            id: container.id
          });
          
          // Initialize DWV with tools
          // DWV 0.35.1 uses dataViewConfigs with divId instead of containerDivId
          app.init({
            dataViewConfigs: {
              '*': [{
                divId: container.id
              }]
            },
            tools: {
              Scroll: {},
              ZoomAndPan: {},
              WindowLevel: {}
            },
            gui: ['toolbar']
          });
          
          console.log('DWV initialized with dataViewConfigs');

          // Download all files and create object URLs
          // Also re-extract metadata with proper Japanese encoding support
          const dicomUrls = [];
          objectUrlRefs.current = []; // Reset object URLs array
          let firstFileBlob = null; // Store first file blob for metadata re-extraction
          
          for (let i = 0; i < fileList.length; i++) {
            const doc = fileList[i];
            let dicomUrl = doc.fileUrl;
            
            // If we have storagePath, download via Firebase SDK to avoid CORS issues
            if (doc.storagePath) {
              try {
                // For DICOM files, use proxy (useDirectDownload=false) to avoid CORS issues
                // getBytes() will always fail with CORS for DICOM files in browsers
                const blob = await downloadFileAsBlob(doc.storagePath, doc.fileUrl, userId, doc.id, false);
                const objectUrl = URL.createObjectURL(blob);
                objectUrlRefs.current.push(objectUrl); // Store for cleanup
                dicomUrl = objectUrl;
                
                // Store first file blob for metadata re-extraction (to fix Japanese encoding)
                if (i === 0 && !firstFileBlob) {
                  firstFileBlob = blob;
                }
              } catch (downloadError) {
                console.error(`Error downloading DICOM file ${i + 1}/${fileList.length}:`, downloadError);
                // Continue with other files even if one fails
                if (doc.fileUrl) {
                  dicomUrl = doc.fileUrl;
                } else {
                  console.warn(`Skipping file ${i + 1} - no URL available`);
                  continue;
                }
              }
            }
            
            if (dicomUrl) {
              dicomUrls.push(dicomUrl);
            }
          }
          
          // Re-extract metadata from first file with proper Japanese encoding support
          // This fixes mojibake issues in files uploaded before the encoding fix
          if (firstFileBlob) {
            try {
              const file = new File([firstFileBlob], 'dicom.dcm', { type: 'application/dicom' });
              const metadataResult = await extractDicomMetadata(file);
              if (metadataResult.success && metadataResult.metadata) {
                console.log('Re-extracted DICOM metadata with proper encoding support');
                setDecodedMetadata(metadataResult.metadata);
              }
            } catch (metadataError) {
              console.warn('Failed to re-extract metadata, using stored metadata:', metadataError);
              // Continue with stored metadata if re-extraction fails
            }
          }

          if (dicomUrls.length === 0) {
            throw new Error('No DICOM files could be loaded. Please check your connection and try again.');
          }

          // Load all DICOM files into DWV
          // DWV can load multiple files and will allow navigation between them
          const loadOptions = {
            headers: {
              'Accept': 'application/dicom,application/octet-stream'
            }
          };

          // Set up event listeners for DWV load events
          const handleLoadEnd = () => {
            console.log('DWV load end event fired');
            // Force resize after load
            setTimeout(() => {
              if (viewerRef.current && app) {
                try {
                  window.dispatchEvent(new Event('resize'));
                  if (typeof app.resize === 'function') {
                    app.resize();
                  }
                  console.log('DWV resized after load');
                } catch (err) {
                  console.warn('Error resizing after load:', err);
                }
              }
            }, 100);
          };
          
          // Listen for DWV load events
          app.addEventListener('loadend', handleLoadEnd);
          app.addEventListener('loaditem', () => console.log('DWV load item event'));
          app.addEventListener('load', () => console.log('DWV load event'));
          
          console.log(`Loading ${dicomUrls.length} DICOM file(s) into viewer...`);
          await app.loadURLs(dicomUrls, loadOptions);
          
          // Wait a moment for DWV to process the loaded files
          await new Promise(resolve => setTimeout(resolve, 300));
          
          // Force DWV to resize and render after loading
          // This ensures the viewer displays correctly
          if (viewerRef.current && app) {
            try {
              const container = viewerRef.current;
              console.log('Container dimensions after load:', {
                width: container.offsetWidth,
                height: container.offsetHeight,
                clientWidth: container.clientWidth,
                clientHeight: container.clientHeight
              });
              
              // Trigger resize to ensure proper rendering
              window.dispatchEvent(new Event('resize'));
              
              // Also try DWV's resize method if available
              if (typeof app.resize === 'function') {
                app.resize();
              }
              
              // Debug: Check what DWV created in the container
              const dwvElements = container.querySelectorAll('*');
              console.log('DWV container children:', {
                childCount: container.children.length,
                totalElements: dwvElements.length,
                children: Array.from(container.children).map(el => ({
                  tagName: el.tagName,
                  className: el.className,
                  id: el.id,
                  style: el.style.cssText,
                  width: el.offsetWidth,
                  height: el.offsetHeight
                }))
              });
              
              // Check for canvas elements (DWV uses canvas for rendering)
              const canvases = container.querySelectorAll('canvas');
              console.log('DWV canvas elements:', {
                count: canvases.length,
                canvases: Array.from(canvases).map(canvas => ({
                  width: canvas.width,
                  height: canvas.height,
                  style: canvas.style.cssText,
                  display: window.getComputedStyle(canvas).display,
                  visibility: window.getComputedStyle(canvas).visibility,
                  opacity: window.getComputedStyle(canvas).opacity
                }))
              });
              
              console.log('DWV viewer initialized and resized');
            } catch (resizeError) {
              console.warn('Error resizing DWV viewer:', resizeError);
            }
          }
          
          // If multiple files, set up navigation
          if (hasMultipleFiles && dicomUrls.length > 1) {
            // DWV automatically handles series navigation when multiple files are loaded
            // The Scroll tool allows navigation between slices
            console.log(`Loaded ${dicomUrls.length} files. Use scroll wheel or scroll tool to navigate between slices.`);
          }
          
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Error loading DICOM file(s):', err);
        
        // Provide more helpful error messages
        let errorMessage = err.message || 'Failed to load DICOM file(s).';
        
        if (err.message?.includes('CORS') || err.message?.includes('Access-Control-Allow-Origin')) {
          errorMessage = 'CORS error: Cannot load DICOM file due to browser security restrictions. The file may need to be accessed through a proxy server.';
        } else if (err.message?.includes('DICM') || err.message?.includes('magic')) {
          errorMessage = 'Invalid DICOM file: The file does not appear to be a valid DICOM format. Please ensure the file is a valid DICOM image.';
        } else if (err.message?.includes('network') || err.message?.includes('fetch')) {
          errorMessage = 'Network error: Cannot download the DICOM file(s). Please check your connection and try again.';
        }
        
        setError(errorMessage);
        setIsLoading(false);
      }
    };

    initDWV();

    // Cleanup on unmount
    return () => {
      // Clean up all object URLs
      objectUrlRefs.current.forEach(url => {
        if (url) {
          URL.revokeObjectURL(url);
        }
      });
      objectUrlRefs.current = [];
      
      // Clean up DWV app
      if (dwvAppRef.current) {
        try {
          dwvAppRef.current.reset();
        } catch (err) {
          console.warn('Error cleaning up DWV app:', err);
        }
      }
    };
  }, [show, fileUrl, storagePath, userId, documentId, documents, dicomMetadata]);

  if (!show) return null;

  return (
    <div className={combineClasses(DesignTokens.components.modal.backdrop, 'z-50')}>
      <div className={combineClasses('bg-white w-full h-full md:h-auto', DesignTokens.borders.radius.lg, 'md:max-w-[95vw] md:max-h-[95vh] overflow-hidden flex flex-col animate-slide-up')}>
        {/* Header */}
        <div className={combineClasses('flex-shrink-0 border-b', DesignTokens.components.modal.header, DesignTokens.colors.neutral.border[200])}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className={combineClasses(DesignTokens.typography.h2.full, DesignTokens.typography.h2.weight, DesignTokens.colors.neutral.text[800])}>
                DICOM Viewer
              </h3>
              {((decodedMetadata || dicomMetadata) || (hasMultipleFiles && (decodedMetadata || fileList[0]?.dicomMetadata))) && (
                <p className={combineClasses('text-sm mt-1', DesignTokens.colors.neutral.text[600])}>
                  {(decodedMetadata || dicomMetadata || fileList[0]?.dicomMetadata)?.modality || 'Imaging'} - {(decodedMetadata || dicomMetadata || fileList[0]?.dicomMetadata)?.studyDescription || 'Medical Scan'}
                  {(decodedMetadata || dicomMetadata || fileList[0]?.dicomMetadata)?.studyDateFormatted && ` (${(decodedMetadata || dicomMetadata || fileList[0]?.dicomMetadata).studyDateFormatted})`}
                  {hasMultipleFiles && ` - ${totalFiles} slice${totalFiles !== 1 ? 's' : ''}`}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className={combineClasses(DesignTokens.transitions.default, DesignTokens.components.modal.closeButton)}
              type="button"
            >
              <X className={DesignTokens.icons.header.size.full} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className={combineClasses('flex-1 overflow-hidden flex flex-col', DesignTokens.components.modal.body)}>
          {error ? (
            <div className="flex-1 flex items-center justify-center flex-col p-8">
              <AlertCircle className={combineClasses('w-12 h-12 mb-4', DesignTokens.components.status.high.icon)} />
              <p className={combineClasses('text-lg font-medium mb-2', DesignTokens.colors.neutral.text[800])}>
                Error Loading DICOM File
              </p>
              <p className={combineClasses('text-sm', DesignTokens.colors.neutral.text[600])}>
                {error}
              </p>
            </div>
          ) : (
            <>
              {/* Viewer Container */}
              <div className="flex-1 relative bg-black overflow-hidden">
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 z-10">
                    <div className="flex flex-col items-center">
                      <Loader2 className={combineClasses('w-8 h-8 animate-spin mb-2', DesignTokens.colors.primary[500])} />
                      <p className={combineClasses('text-sm', DesignTokens.colors.neutral.text[300])}>
                        Loading DICOM file{hasMultipleFiles ? 's' : ''}... {hasMultipleFiles && `(${totalFiles} files)`}
                      </p>
                    </div>
                  </div>
                )}
                <div
                  id="dwv-viewer"
                  ref={viewerRef}
                  className="w-full h-full"
                  style={{ 
                    minHeight: '400px',
                    width: '100%',
                    height: '100%',
                    position: 'relative',
                    display: 'block'
                  }}
                />
                
                {/* Navigation controls for multiple files */}
                {hasMultipleFiles && totalFiles > 1 && !isLoading && (
                  <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-4 bg-black/70 rounded-lg px-4 py-2 z-20">
                    <button
                      onClick={() => {
                        if (dwvAppRef.current) {
                          try {
                            // Use mouse wheel simulation or keyboard event to navigate
                            // DWV handles scroll events automatically
                            const event = new WheelEvent('wheel', {
                              deltaY: 100,
                              bubbles: true
                            });
                            viewerRef.current?.dispatchEvent(event);
                            setCurrentIndex(prev => Math.max(0, prev - 1));
                          } catch (err) {
                            console.warn('Error navigating to previous slice:', err);
                          }
                        }
                      }}
                      className={combineClasses(
                        'p-2 rounded-md',
                        'bg-white/20 hover:bg-white/30',
                        'text-white',
                        'transition-colors'
                      )}
                      title="Previous slice (or use scroll wheel)"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className={combineClasses('text-white text-sm font-medium', 'px-3')}>
                      {currentIndex + 1} / {totalFiles}
                    </span>
                    <button
                      onClick={() => {
                        if (dwvAppRef.current) {
                          try {
                            // Use mouse wheel simulation or keyboard event to navigate
                            // DWV handles scroll events automatically
                            const event = new WheelEvent('wheel', {
                              deltaY: -100,
                              bubbles: true
                            });
                            viewerRef.current?.dispatchEvent(event);
                            setCurrentIndex(prev => Math.min(totalFiles - 1, prev + 1));
                          } catch (err) {
                            console.warn('Error navigating to next slice:', err);
                          }
                        }
                      }}
                      className={combineClasses(
                        'p-2 rounded-md',
                        'bg-white/20 hover:bg-white/30',
                        'text-white',
                        'transition-colors'
                      )}
                      title="Next slice (or use scroll wheel)"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Metadata Panel (if available) */}
              {/* Use decodedMetadata (re-extracted with proper encoding) if available, otherwise fall back to stored metadata */}
              {((decodedMetadata || dicomMetadata) || (hasMultipleFiles && (decodedMetadata || fileList[0]?.dicomMetadata))) && (
                <div className={combineClasses('border-t p-4 overflow-y-auto max-h-48', DesignTokens.colors.neutral.border[200])}>
                  <h4 className={combineClasses('text-sm font-semibold mb-2', DesignTokens.colors.neutral.text[800])}>
                    Scan Information
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {(() => {
                      const meta = decodedMetadata || dicomMetadata || fileList[0]?.dicomMetadata;
                      return (
                        <>
                          {meta?.modality && (
                            <div>
                              <span className={combineClasses('font-medium', DesignTokens.colors.neutral.text[700])}>Modality: </span>
                              <span className={DesignTokens.colors.neutral.text[600]}>{meta.modality}</span>
                            </div>
                          )}
                          {meta?.studyDateFormatted && (
                            <div>
                              <span className={combineClasses('font-medium', DesignTokens.colors.neutral.text[700])}>Study Date: </span>
                              <span className={DesignTokens.colors.neutral.text[600]}>{meta.studyDateFormatted}</span>
                            </div>
                          )}
                          {meta?.bodyPartExamined && (
                            <div>
                              <span className={combineClasses('font-medium', DesignTokens.colors.neutral.text[700])}>Body Part: </span>
                              <span className={DesignTokens.colors.neutral.text[600]}>{meta.bodyPartExamined}</span>
                            </div>
                          )}
                          {meta?.institutionName && (
                            <div>
                              <span className={combineClasses('font-medium', DesignTokens.colors.neutral.text[700])}>Institution: </span>
                              <span className={DesignTokens.colors.neutral.text[600]}>{meta.institutionName}</span>
                            </div>
                          )}
                          {meta?.seriesDescription && (
                            <div>
                              <span className={combineClasses('font-medium', DesignTokens.colors.neutral.text[700])}>Series: </span>
                              <span className={DesignTokens.colors.neutral.text[600]}>{meta.seriesDescription}</span>
                            </div>
                          )}
                          {hasMultipleFiles ? (
                            <div>
                              <span className={combineClasses('font-medium', DesignTokens.colors.neutral.text[700])}>Slices: </span>
                              <span className={DesignTokens.colors.neutral.text[600]}>{totalFiles}</span>
                            </div>
                          ) : meta?.numberOfFrames && (
                            <div>
                              <span className={combineClasses('font-medium', DesignTokens.colors.neutral.text[700])}>Frames: </span>
                              <span className={DesignTokens.colors.neutral.text[600]}>{meta.numberOfFrames}</span>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className={combineClasses('flex-shrink-0 border-t p-4', DesignTokens.colors.neutral.border[200])}>
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className={combineClasses(DesignTokens.components.button.secondary, DesignTokens.spacing.button.md)}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
