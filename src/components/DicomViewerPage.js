import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, Loader2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { DesignTokens, combineClasses } from '../design/designTokens';
import { downloadFileAsBlob } from '../firebase/storage';
import { extractDicomMetadata } from '../services/dicomService';

/**
 * Full-Screen DICOM Viewer Page Component
 * Uses DWV (DICOM Web Viewer) library to display DICOM files
 * LAZY LOADING: Only loads files on-demand to prevent memory crashes
 */
function sortByInstanceAndSlice(docs) {
  if (!Array.isArray(docs) || docs.length === 0) return docs;
  // Filter out null/undefined documents to prevent errors
  const validDocs = docs.filter(doc => doc != null);
  if (validDocs.length === 0) return [];
  return [...validDocs].sort((a, b) => {
    // Add null checks for safety
    if (!a || !b) return 0;
    const instA = a.dicomDirMeta?.image?.instanceNumber ?? a.dicomMetadata?.instanceNumber;
    const instB = b.dicomDirMeta?.image?.instanceNumber ?? b.dicomMetadata?.instanceNumber;
    if (instA != null && instB != null) {
      const nA = parseInt(instA, 10) || 0;
      const nB = parseInt(instB, 10) || 0;
      if (nA !== nB) return nA - nB;
    }
    const slA = a.dicomDirMeta?.image?.sliceLocation ?? a.dicomMetadata?.sliceLocation;
    const slB = b.dicomDirMeta?.image?.sliceLocation ?? b.dicomMetadata?.sliceLocation;
    if (slA != null && slB != null) return (parseFloat(slA) || 0) - (parseFloat(slB) || 0);
    return 0;
  });
}

export default function DicomViewerPage({
  documents = null,
  userId = null,
  onClose
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalFiles, setTotalFiles] = useState(1);
  const [decodedMetadata, setDecodedMetadata] = useState(null);
  const [currentImageInfo, setCurrentImageInfo] = useState(null);
  const [selectedSeriesIndex, setSelectedSeriesIndex] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState('Initializing...');
  
  const viewerRef = useRef(null);
  const dwvAppRef = useRef(null);
  const loadedFilesRef = useRef(new Map()); // Map<index, { objectUrl, dataId }>
  const loadingPromisesRef = useRef(new Map()); // Track ongoing loads
  const dataIdsRef = useRef([]);
  const PRELOAD_WINDOW = 0; // NO preloading - only load current file to prevent crashes
  const MAX_LOADED_FILES = 1; // Keep only 1 file in memory for large series to prevent memory overload

  // Handle different document source formats
  const isZipSource = documents && typeof documents === 'object' && !Array.isArray(documents) && documents.source === 'zip';
  const isMultiSeries = documents && typeof documents === 'object' && !Array.isArray(documents) &&
    Array.isArray(documents.series) && documents.series.length > 0;
  
  const seriesList = isMultiSeries ? documents.series : null;
  const rawFileList = isMultiSeries
    ? (seriesList?.[selectedSeriesIndex]?.files ?? [])
    : (Array.isArray(documents) ? documents : []);
  // Filter out null/undefined entries before sorting
  const filteredFileList = Array.isArray(rawFileList) 
    ? rawFileList.filter(doc => doc != null && (doc.zipEntry || doc.storagePath || doc.fileUrl || doc.getBlob))
    : [];
  const fileList = sortByInstanceAndSlice(filteredFileList);
  const hasMultipleFiles = fileList.length > 1;

  // Load a single file on-demand
  const loadFile = useCallback(async (index) => {
    if (index < 0 || index >= fileList.length) return null;
    
    // Already loaded?
    if (loadedFilesRef.current.has(index)) {
      return loadedFilesRef.current.get(index);
    }
    
    // Already loading?
    if (loadingPromisesRef.current.has(index)) {
      return await loadingPromisesRef.current.get(index);
    }
    
    const loadPromise = (async () => {
      try {
        const doc = fileList[index];
        if (!doc) {
          console.warn(`[DICOM Viewer] Document at index ${index} is null or undefined`);
          return null;
        }
        
        setLoadingProgress(`Loading file ${index + 1}/${fileList.length}...`);
        
        let blob = null;
        
        try {
          // Get blob from ZIP or Firebase
          if (doc.source === 'zip' && doc.zipEntry) {
            blob = await doc.zipEntry.async('blob');
          } else if (doc.getBlob && typeof doc.getBlob === 'function') {
            blob = await doc.getBlob();
          } else if (doc.storagePath) {
            blob = await downloadFileAsBlob(doc.storagePath, doc.fileUrl, userId, doc.id, false);
          } else if (doc.fileUrl) {
            const response = await fetch(doc.fileUrl);
            blob = await response.blob();
          } else {
            throw new Error('No valid source found for document');
          }
        } catch (blobError) {
          console.error(`[DICOM Viewer] Error getting blob for file ${index + 1}:`, blobError);
          throw new Error(`Failed to load file ${index + 1}: ${blobError.message || 'Unknown error'}`);
        }
        
        if (!blob || blob.size === 0) {
          throw new Error('Blob is empty or invalid');
        }
        
        // Create Object URL (this uses memory - will be cleaned up)
        const objectUrl = URL.createObjectURL(blob);
        
        // Log file size for memory tracking (only for large files or first file)
        if (index === 0 || blob.size > 10 * 1024 * 1024) {
          const fileSizeMB = (blob.size / (1024 * 1024)).toFixed(2);
          console.log(`[DICOM Viewer] Loading file ${index + 1}/${fileList.length} (${fileSizeMB}MB)`);
        }
        
        // Load into DWV
        const app = dwvAppRef.current;
        if (!app) {
          URL.revokeObjectURL(objectUrl); // Clean up if app not ready
          return null;
        }
        
        const loadOptions = {
          headers: { 'Accept': 'application/dicom,application/octet-stream' }
        };
        
        // Wait for loadend event with timeout
        let loadEndFired = false;
        let dataId = null;
        let loadError = null;
        
        const loadEndHandler = () => {
          loadEndFired = true;
        };
        
        const dataAddHandler = (event) => {
          dataId = event.dataid || event.data?.id || null;
        };
        
        const errorHandler = (event) => {
          loadError = event.error || event.message || 'Unknown DWV error';
          console.error('[DICOM Viewer] DWV load error:', loadError, event);
        };
        
        app.addEventListener('loadend', loadEndHandler);
        app.addEventListener('dataadd', dataAddHandler);
        app.addEventListener('error', errorHandler);
        
        try {
          await app.loadURLs([objectUrl], loadOptions);
        } catch (loadErr) {
          app.removeEventListener('loadend', loadEndHandler);
          app.removeEventListener('dataadd', dataAddHandler);
          app.removeEventListener('error', errorHandler);
          URL.revokeObjectURL(objectUrl);
          throw new Error(`DWV failed to load file: ${loadErr.message || 'Unknown error'}`);
        }
        
        // Wait for load to complete (with timeout)
        let waitCount = 0;
        const maxWait = 100; // Increased timeout for large files
        while (!loadEndFired && !loadError && waitCount < maxWait) {
          await new Promise(resolve => setTimeout(resolve, 100));
          waitCount++;
        }
        
        if (loadError) {
          app.removeEventListener('loadend', loadEndHandler);
          app.removeEventListener('dataadd', dataAddHandler);
          app.removeEventListener('error', errorHandler);
          URL.revokeObjectURL(objectUrl);
          throw new Error(`DWV error loading file: ${loadError}`);
        }
        
        // Wait for dataadd (with timeout)
        waitCount = 0;
        const maxDataWait = 50; // Increased timeout for large files
        while (!dataId && waitCount < maxDataWait) {
          await new Promise(resolve => setTimeout(resolve, 100));
          waitCount++;
        }
        
        app.removeEventListener('loadend', loadEndHandler);
        app.removeEventListener('dataadd', dataAddHandler);
        app.removeEventListener('error', errorHandler);
        
        if (!dataId) {
          // Get dataId from app.getData()
          try {
            const data = app.getData ? app.getData() : null;
            if (data && typeof data === 'object') {
              const dataIds = Object.keys(data);
              if (dataIds.length > 0) {
                // Find the newest dataId (last one)
                dataId = dataIds[dataIds.length - 1];
              }
            }
          } catch (dataError) {
            console.warn('[DICOM Viewer] Error getting data from DWV app:', dataError);
          }
        }
        
        if (!dataId) {
          URL.revokeObjectURL(objectUrl);
          throw new Error('Failed to create data item in DWV - DWV may be out of memory or file is corrupted');
        }
        
        const result = { objectUrl, dataId, index };
        loadedFilesRef.current.set(index, result);
        
        // Update dataIds ref
        const data = app.getData ? app.getData() : null;
        if (data) {
          dataIdsRef.current = Object.keys(data);
          // Only log memory usage for first file or if count is high
          const dataItemCount = Object.keys(data).length;
          if (index === 0 || dataItemCount > 5) {
            console.log(`[DICOM Viewer] Loaded file ${index + 1} - DWV has ${dataItemCount} data item(s) in memory`);
          }
        }
        
        // Immediately cleanup old files to prevent memory buildup
        cleanupDistantFiles(index);
        
        return result;
      } catch (error) {
        console.error(`Error loading file ${index}:`, error);
        return null;
      } finally {
        loadingPromisesRef.current.delete(index);
      }
    })();
    
    loadingPromisesRef.current.set(index, loadPromise);
    return await loadPromise;
  }, [fileList, userId]);

  // Clean up files outside the window - AGGRESSIVE cleanup to prevent crashes
  const cleanupDistantFiles = useCallback((currentIdx) => {
    const toKeep = new Set();
    
    // For large series (>50 files), keep ONLY current file to minimize memory
    // For smaller series, allow minimal preloading
    const keepWindow = fileList.length > 50 ? 0 : PRELOAD_WINDOW;
    for (let i = Math.max(0, currentIdx - keepWindow); 
         i <= Math.min(fileList.length - 1, currentIdx + keepWindow); 
         i++) {
      toKeep.add(i);
    }
    
    // Always enforce MAX_LOADED_FILES limit - remove oldest first
    if (loadedFilesRef.current.size > MAX_LOADED_FILES) {
      const loadedIndices = Array.from(loadedFilesRef.current.keys()).sort((a, b) => {
        // Keep current index, remove others
        if (a === currentIdx) return -1;
        if (b === currentIdx) return 1;
        return b - a; // Remove oldest (lowest index) first
      });
      // Only keep the current file if we're over limit
      toKeep.clear();
      toKeep.add(currentIdx);
    }
    
    // AGGRESSIVE cleanup: Remove from DWV and revoke URLs
    const app = dwvAppRef.current;
    let removedCount = 0;
    for (const [idx, fileData] of loadedFilesRef.current.entries()) {
      if (!toKeep.has(idx)) {
        // Remove from DWV - this should free decoded pixel data
        if (app && fileData && fileData.dataId) {
          try {
            // Try multiple methods to ensure data is removed
            if (typeof app.removeDataItem === 'function') {
              app.removeDataItem(fileData.dataId);
            } else if (typeof app.removeData === 'function') {
              app.removeData(fileData.dataId);
            } else if (app.getData && typeof app.getData === 'function') {
              // Try to get data and remove it manually
              try {
                const data = app.getData();
                if (data && typeof data === 'object' && data[fileData.dataId]) {
                  delete data[fileData.dataId];
                }
              } catch (dataError) {
                // Ignore errors when accessing data
              }
            }
            removedCount++;
          } catch (e) {
            console.warn(`[DICOM Viewer] Error removing data item ${fileData.dataId}:`, e);
          }
        }
        
        // Revoke Object URL immediately to free memory
        if (fileData && fileData.objectUrl) {
          try {
            URL.revokeObjectURL(fileData.objectUrl);
          } catch (urlError) {
            console.warn(`[DICOM Viewer] Error revoking object URL:`, urlError);
          }
        }
        
        loadedFilesRef.current.delete(idx);
      }
    }
    
    // Force garbage collection hint (browser may or may not honor this)
    if (removedCount > 0) {
      // Only log if we removed multiple files or it's a large series
      if (removedCount > 1 || fileList.length > 100) {
        console.log(`[DICOM Viewer] Cleaned up ${removedCount} file(s) from memory`);
      }
      // Suggest garbage collection (non-standard, but some browsers support it)
      if (window.gc && typeof window.gc === 'function') {
        try {
          window.gc();
        } catch (e) {
          // Ignore if not available
        }
      }
    }
    
    // Memory warning for large series (only log once per series change)
    if (fileList.length > 50 && loadedFilesRef.current.size > 1) {
      // Only warn once, not on every cleanup
      if (!cleanupDistantFiles._warned) {
        console.warn(`[DICOM Viewer] Large series (${fileList.length} files) - keeping only ${loadedFilesRef.current.size} in memory to prevent crashes`);
        cleanupDistantFiles._warned = true;
      }
    }
  }, [fileList.length]);

  // Preload files around current index - DISABLED for large series to prevent crashes
  const preloadWindow = useCallback(async (currentIdx) => {
    // Skip preloading for large series (>50 files) to prevent memory crashes
    if (fileList.length > 50) {
      return; // No preloading for large series
    }
    
    const start = Math.max(0, currentIdx - PRELOAD_WINDOW);
    const end = Math.min(fileList.length - 1, currentIdx + PRELOAD_WINDOW);
    
    const preloadPromises = [];
    for (let i = start; i <= end; i++) {
      if (!loadedFilesRef.current.has(i) && !loadingPromisesRef.current.has(i)) {
        preloadPromises.push(loadFile(i));
      }
    }
    
    // Load in parallel but don't wait for all
    Promise.all(preloadPromises).catch(err => {
      console.warn('Some preloads failed:', err);
    });
  }, [loadFile, fileList.length]);

  // Navigate to a specific index
  const navigateToIndex = useCallback(async (newIndex) => {
    if (newIndex < 0 || newIndex >= fileList.length) return;
    
    setCurrentIndex(newIndex);
    
    // Load current file if not loaded
    const fileData = await loadFile(newIndex);
    
    if (fileData && dwvAppRef.current) {
      const app = dwvAppRef.current;
      try {
        app.render(fileData.dataId);
        setTimeout(() => {
          if (typeof app.resize === 'function') app.resize();
          window.dispatchEvent(new Event('resize'));
        }, 50);
      } catch (err) {
        console.warn('Error rendering file:', err);
      }
    }
    
    // Cleanup FIRST (aggressive), then optionally preload
    cleanupDistantFiles(newIndex);
    
    // Only preload for small series to prevent memory issues
    if (fileList.length <= 50) {
      await preloadWindow(newIndex);
    }
    
    // Update image info
    const currentDoc = fileList[newIndex];
    if (currentDoc) {
      try {
        const metadata = currentDoc?.dicomMetadata || currentDoc?.dicomDirMeta?.image || decodedMetadata;
        setCurrentImageInfo({
          instanceNumber: metadata?.instanceNumber || null,
          sliceLocation: metadata?.sliceLocation || null,
          fileName: currentDoc?.fileName || null
        });
      } catch (metaError) {
        console.warn('[DICOM Viewer] Error setting image info:', metaError);
        setCurrentImageInfo(null);
      }
    } else {
      setCurrentImageInfo(null);
    }
  }, [loadFile, preloadWindow, cleanupDistantFiles, fileList, decodedMetadata]);

  // Initialize DWV
  useEffect(() => {
    if (!fileList || fileList.length === 0 || !userId) {
      setIsLoading(false);
      return;
    }

    const initDWV = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setTotalFiles(fileList.length);
        setCurrentIndex(0);
        setCurrentImageInfo(null);
        setLoadingProgress('Initializing viewer...');

        const dwv = await import('dwv');

        // Configure DWV worker paths
        try {
          if (dwv.image && dwv.image.decoderScripts) {
            const workerBaseUrl = `${window.location.origin}/assets/workers`;
            dwv.image.decoderScripts = {
              'jpeg-lossless': `${workerBaseUrl}/jpegloss.worker.min.js`,
              'jpeg-baseline': `${workerBaseUrl}/jpegbaseline.worker.min.js`,
              'jpeg2000': `${workerBaseUrl}/jpeg2000.worker.min.js`,
              'rle': `${workerBaseUrl}/rle.worker.min.js`
            };
          }
        } catch (workerConfigError) {
          console.warn('Could not configure DWV worker paths:', workerConfigError);
        }

        const app = new dwv.App();
        dwvAppRef.current = app;

        if (viewerRef.current) {
          const container = viewerRef.current;
          
          // Wait for container dimensions
          let attempts = 0;
          while ((container.offsetWidth === 0 || container.offsetHeight === 0) && attempts < 10) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
          }
          
          if (container.offsetWidth === 0 || container.offsetHeight === 0) {
            container.style.width = '100%';
            container.style.height = '100%';
          }

          if (!container.id) {
            container.id = 'dicom-viewer';
          }

          app.init({
            dataViewConfigs: { '*': [{ divId: container.id }] },
            tools: { Scroll: {}, ZoomAndPan: {}, WindowLevel: {} },
            gui: ['toolbar']
          });

          // Load first file only
          setLoadingProgress('Loading first image...');
          await navigateToIndex(0);
          
          // Extract metadata from first file (only if not already available)
          if (fileList[0] && !decodedMetadata) {
            try {
              const firstDoc = fileList[0];
              if (!firstDoc) {
                console.warn('[DICOM Viewer] First document is null');
                return;
              }
              
              let firstBlob = null;
              
              // Use existing metadata if available to avoid re-extraction
              if (firstDoc.dicomMetadata || firstDoc.dicomDirMeta) {
                const existingMeta = firstDoc.dicomMetadata || 
                  (firstDoc.dicomDirMeta?.image ? {
                    instanceNumber: firstDoc.dicomDirMeta.image.instanceNumber,
                    sliceLocation: firstDoc.dicomDirMeta.image.sliceLocation,
                    modality: firstDoc.dicomDirMeta.series?.modality,
                    studyDescription: firstDoc.dicomDirMeta.study?.studyDescription,
                    seriesDescription: firstDoc.dicomDirMeta.series?.seriesDescription,
                    studyDate: firstDoc.dicomDirMeta.study?.studyDate,
                    bodyPartExamined: firstDoc.dicomDirMeta.series?.bodyPartExamined,
                    institutionName: null
                  } : null);
                if (existingMeta) {
                  setDecodedMetadata(existingMeta);
                  return; // Skip re-extraction if we have metadata
                }
              }
              
              // Only extract if we don't have metadata
              if (firstDoc.source === 'zip' && firstDoc.zipEntry) {
                firstBlob = await firstDoc.zipEntry.async('blob');
              } else if (firstDoc.getBlob && typeof firstDoc.getBlob === 'function') {
                firstBlob = await firstDoc.getBlob();
              } else if (firstDoc.storagePath) {
                firstBlob = await downloadFileAsBlob(firstDoc.storagePath, firstDoc.fileUrl, userId, firstDoc.id, false);
              }
              
              if (firstBlob) {
                const file = new File([firstBlob], 'dicom.dcm', { type: 'application/dicom' });
                const metadataResult = await extractDicomMetadata(file);
                if (metadataResult.success && metadataResult.metadata) {
                  setDecodedMetadata(metadataResult.metadata);
                }
                // Clean up blob immediately after extraction
                firstBlob = null;
              }
            } catch (metadataError) {
              console.warn('[DICOM Viewer] Error extracting metadata, using stored metadata if available:', metadataError);
              // Continue with stored metadata if re-extraction fails
            }
          }

          setIsLoading(false);
        }
      } catch (err) {
        console.error('Error initializing DICOM viewer:', err);
        
        // Provide more helpful error messages
        let errorMessage = err.message || 'Failed to initialize DICOM viewer';
        
        if (err.message?.includes('memory') || err.message?.includes('allocation') || err.message?.includes('out of memory')) {
          errorMessage = `Memory error: The DICOM file is too large to load in the browser. Try viewing a smaller series or individual files. (${fileList.length} files)`;
        } else if (err.message?.includes('meta') || err.message?.includes('null')) {
          errorMessage = 'Data structure error: Some files in the series may be corrupted or missing metadata. Please try again or contact support.';
        } else if (err.message?.includes('DICM') || err.message?.includes('magic')) {
          errorMessage = 'Invalid DICOM file: The file does not appear to be a valid DICOM format.';
        } else if (err.message?.includes('network') || err.message?.includes('fetch')) {
          errorMessage = 'Network error: Cannot download the DICOM file(s). Please check your connection.';
        }
        
        setError(errorMessage);
        setIsLoading(false);
      }
    };

    initDWV();

    return () => {
      // Cleanup
      if (viewerRef.current) {
        if (viewerRef.current._syncInterval) {
          clearInterval(viewerRef.current._syncInterval);
          delete viewerRef.current._syncInterval;
        }
      }
      
      // Revoke all Object URLs
      for (const fileData of loadedFilesRef.current.values()) {
        if (fileData && fileData.objectUrl) {
          try {
            URL.revokeObjectURL(fileData.objectUrl);
          } catch (e) {
            // Ignore URL revocation errors
          }
        }
      }
      loadedFilesRef.current.clear();
      loadingPromisesRef.current.clear();
      
      // CRITICAL: Fix DWV memory leak - properly cleanup resize handlers
      if (dwvAppRef.current) {
        try {
          // Remove any resize event listeners that DWV might have added
          // DWV has a known bug where it uses window.onresize instead of addEventListener
          // We need to clear this to prevent memory leaks
          const app = dwvAppRef.current;
          
          // Try to remove resize handler if it exists
          if (app.removeEventListener && typeof app.removeEventListener === 'function') {
            try {
              app.removeEventListener('resize', () => {});
            } catch (e) {
              // Ignore if not available
            }
          }
          
          // Clear window resize handler if DWV set it directly (known bug)
          if (window.onresize && window.onresize.toString().includes('dwv')) {
            window.onresize = null;
          }
          
          // Reset the app (this should clean up internal state)
          app.reset();
          
          // Force clear all data from DWV
          try {
            const data = app.getData ? app.getData() : null;
            if (data && typeof data === 'object') {
              const dataIds = Object.keys(data);
              for (const id of dataIds) {
                try {
                  if (typeof app.removeDataItem === 'function') {
                    app.removeDataItem(id);
                  } else if (typeof app.removeData === 'function') {
                    app.removeData(id);
                  } else {
                    delete data[id];
                  }
                } catch (e) {
                  // Continue cleanup even if one fails
                }
              }
            }
          } catch (dataError) {
            // Ignore data cleanup errors
          }
        } catch (err) {
          console.warn('[DICOM Viewer] Error during DWV cleanup:', err);
        } finally {
          // Clear the reference
          dwvAppRef.current = null;
        }
      }
    };
  }, [fileList, userId, navigateToIndex]);

  // Handle navigation
  useEffect(() => {
    if (currentIndex >= 0 && currentIndex < fileList.length && !isLoading) {
      navigateToIndex(currentIndex);
    }
  }, [currentIndex, fileList.length, isLoading, navigateToIndex]);

  const hasData = documents && (
    Array.isArray(documents) ? documents.length > 0 :
    (documents.source === 'zip' && documents.series?.length > 0) ||
    (documents.series?.length ?? 0) > 0
  );
  
  if (!hasData) {
    return null;
  }

  const displayMetadata = decodedMetadata || fileList[0]?.dicomMetadata;
  const showViewer = fileList && fileList.length > 0;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 bg-gray-900 text-white px-6 py-4 border-b border-gray-700">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0 flex flex-wrap items-center gap-4">
            <div>
              <h2 className="text-xl font-semibold">DICOM Viewer</h2>
              {displayMetadata && (
                <p className="text-sm text-gray-300 mt-1">
                  {displayMetadata.modality || 'Imaging'} - {displayMetadata.studyDescription || 'Medical Scan'}
                  {displayMetadata.studyDateFormatted && ` (${displayMetadata.studyDateFormatted})`}
                  {hasMultipleFiles && ` - ${totalFiles} slice${totalFiles !== 1 ? 's' : ''}`}
                </p>
              )}
            </div>
            {isMultiSeries && seriesList && seriesList.length > 1 && (
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-400">Series:</label>
                <select
                  value={selectedSeriesIndex}
                  onChange={(e) => {
                    const idx = parseInt(e.target.value, 10);
                    if (!Number.isNaN(idx) && idx >= 0 && idx < seriesList.length) {
                      setSelectedSeriesIndex(idx);
                    }
                  }}
                  className="bg-gray-800 text-white border border-gray-600 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-500"
                >
                  {seriesList.map((s, i) => (
                    <option key={i} value={i}>
                      {s.label || `Series ${i + 1}`} ({s.files?.length ?? 0})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-md transition-colors flex-shrink-0"
            type="button"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Viewer Container */}
      <div className="flex-1 relative bg-black overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 z-10">
            <div className="flex flex-col items-center">
              <Loader2 className="w-8 h-8 animate-spin mb-2 text-white" />
              <p className="text-sm text-gray-300">{loadingProgress}</p>
            </div>
          </div>
        )}

        {error ? (
          <div className="absolute inset-0 flex items-center justify-center flex-col p-8">
            <AlertCircle className="w-12 h-12 mb-4 text-red-500" />
            <p className="text-lg font-medium mb-2 text-white">Error Loading DICOM File</p>
            <p className="text-sm text-gray-300">{error}</p>
          </div>
        ) : !showViewer && isMultiSeries ? (
          <div className="absolute inset-0 flex items-center justify-center flex-col p-8">
            <p className="text-gray-400">No files in selected series. Choose another series.</p>
          </div>
        ) : (
          <>
            <div
              id="dwv-viewer"
              ref={viewerRef}
              className="w-full h-full"
              style={{ 
                width: '100%',
                height: '100%',
                position: 'relative',
                display: 'block'
              }}
            />
            
            {/* Navigation controls */}
            {hasMultipleFiles && totalFiles > 1 && !isLoading && (
              <div className="absolute bottom-32 left-1/2 transform -translate-x-1/2 flex items-center gap-4 bg-black/70 rounded-lg px-4 py-2 z-20">
                <button
                  onClick={() => {
                    if (currentIndex > 0) {
                      setCurrentIndex(currentIndex - 1);
                    }
                  }}
                  disabled={currentIndex === 0}
                  className="p-2 rounded-md bg-white/20 hover:bg-white/30 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Previous slice"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-white text-sm font-medium px-3">
                  {currentIndex + 1} / {totalFiles}
                  {currentImageInfo?.instanceNumber && ` (Instance: ${currentImageInfo.instanceNumber})`}
                  {currentImageInfo?.sliceLocation && ` (Z: ${parseFloat(currentImageInfo.sliceLocation).toFixed(1)}mm)`}
                </span>
                <button
                  onClick={() => {
                    if (currentIndex < totalFiles - 1) {
                      setCurrentIndex(currentIndex + 1);
                    }
                  }}
                  disabled={currentIndex >= totalFiles - 1}
                  className="p-2 rounded-md bg-white/20 hover:bg-white/30 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Next slice"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Metadata Panel */}
      {displayMetadata && (
        <div className="flex-shrink-0 bg-gray-900 text-white border-t border-gray-700 p-4 overflow-y-auto max-h-48">
          <h4 className="text-sm font-semibold mb-2">Scan Information</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {displayMetadata.modality && (
              <div>
                <span className="font-medium text-gray-300">Modality: </span>
                <span className="text-gray-400">{displayMetadata.modality}</span>
              </div>
            )}
            {displayMetadata.studyDateFormatted && (
              <div>
                <span className="font-medium text-gray-300">Study Date: </span>
                <span className="text-gray-400">{displayMetadata.studyDateFormatted}</span>
              </div>
            )}
            {displayMetadata.bodyPartExamined && (
              <div>
                <span className="font-medium text-gray-300">Body Part: </span>
                <span className="text-gray-400">{displayMetadata.bodyPartExamined}</span>
              </div>
            )}
            {displayMetadata.institutionName && (
              <div>
                <span className="font-medium text-gray-300">Institution: </span>
                <span className="text-gray-400">{displayMetadata.institutionName}</span>
              </div>
            )}
            {displayMetadata.seriesDescription && (
              <div>
                <span className="font-medium text-gray-300">Series: </span>
                <span className="text-gray-400">{displayMetadata.seriesDescription}</span>
              </div>
            )}
            {hasMultipleFiles ? (
              <div>
                <span className="font-medium text-gray-300">Slices: </span>
                <span className="text-gray-400">{totalFiles}</span>
              </div>
            ) : displayMetadata.numberOfFrames && (
              <div>
                <span className="font-medium text-gray-300">Frames: </span>
                <span className="text-gray-400">{displayMetadata.numberOfFrames}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
