import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, Loader2, AlertCircle, ChevronLeft, ChevronRight, Ruler, Crosshair, RotateCcw, SunMoon } from 'lucide-react';
import { downloadFileAsBlob } from '../firebase/storage';
import { extractDicomMetadata } from '../services/dicomService';
import { registerZipImageLoader, registerZipStructure, generateZipImageId, unregisterZipImageLoader } from '../services/zipImageLoader';

/**
 * Cornerstone3D DICOM Viewer Component (Stack-based)
 *
 * Uses Cornerstone3D StackViewport for fast, memory-efficient 2D slice viewing.
 * Like IMAIOS, shows first image immediately and loads others progressively.
 *
 * Features:
 * - First image displays in 1-3 seconds
 * - On-demand slice loading (only decompresses when viewed)
 * - Prefetching adjacent slices in background
 * - Low memory footprint (~50-100MB vs 500MB+ for volume)
 * - Smooth scrolling through series
 */

// Initialize Cornerstone3D (only once)
let cornerstoneInitialized = false;

/**
 * Format DICOM date (YYYYMMDD) to readable format
 */
function formatDicomDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null;
  // DICOM date format: YYYYMMDD
  const cleaned = dateStr.replace(/[^0-9]/g, '');
  if (cleaned.length !== 8) return dateStr;
  const year = cleaned.substring(0, 4);
  const month = cleaned.substring(4, 6);
  const day = cleaned.substring(6, 8);
  try {
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return `${year}-${month}-${day}`;
  }
}

/**
 * Format DICOM time (HHMMSS or HHMMSS.ffffff) to readable format
 */
function formatDicomTime(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const cleaned = timeStr.replace(/[^0-9]/g, '').substring(0, 6);
  if (cleaned.length < 4) return timeStr;
  const hours = cleaned.substring(0, 2);
  const minutes = cleaned.substring(2, 4);
  const seconds = cleaned.length >= 6 ? cleaned.substring(4, 6) : '00';
  return `${hours}:${minutes}:${seconds}`;
}

function sortByInstanceAndSlice(docs) {
  if (!Array.isArray(docs) || docs.length === 0) return docs;
  const validDocs = docs.filter(doc => doc != null);
  if (validDocs.length === 0) return [];
  return [...validDocs].sort((a, b) => {
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

export default function Cornerstone3DViewer({
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
  const [loadedSeriesFiles, setLoadedSeriesFiles] = useState(new Map());
  const [loadingSeries, setLoadingSeries] = useState(new Set());
  const [loadedSlicesCount, setLoadedSlicesCount] = useState(0);
  const [activeTool, setActiveTool] = useState('windowLevel'); // 'windowLevel', 'length', 'probe'
  const [isInverted, setIsInverted] = useState(false);
  const [probeValue, setProbeValue] = useState(null); // HU value at cursor

  const viewerRef = useRef(null);
  const renderingEngineRef = useRef(null);
  const viewportRef = useRef(null);
  const imageIdsRef = useRef([]);
  const navigatingRef = useRef(false);
  const initTimeoutRef = useRef(null);
  const prefetchControllerRef = useRef(null);
  const fileListRef = useRef([]); // Stable ref for fileList
  const initStartedRef = useRef(false); // Prevent double initialization
  const toolGroupRef = useRef(null); // Store tool group reference

  // Handle different document source formats
  const isZipSource = documents && typeof documents === 'object' && !Array.isArray(documents) && documents.source === 'zip';
  const isMultiSeries = documents && typeof documents === 'object' && !Array.isArray(documents) &&
    Array.isArray(documents.series) && documents.series.length > 0;

  const seriesList = isMultiSeries ? documents.series : null;

  // Lazy-load series files when selected
  const currentSeriesFiles = loadedSeriesFiles.get(selectedSeriesIndex) || [];
  const rawFileList = isMultiSeries
    ? currentSeriesFiles
    : (Array.isArray(documents) ? documents : []);
  const filteredFileList = Array.isArray(rawFileList)
    ? rawFileList.filter(doc => doc != null && (doc.zipEntry || doc.storagePath || doc.fileUrl || doc.getBlob))
    : [];
  const fileList = sortByInstanceAndSlice(filteredFileList);
  const hasMultipleFiles = fileList.length > 1;

  // Keep stable ref updated
  fileListRef.current = fileList;

  // Initialize Cornerstone3D (lighter version - no volume loader needed)
  const initializeCornerstone = useCallback(async () => {
    if (cornerstoneInitialized) return;

    try {
      // 1. Initialize Cornerstone Core
      const cornerstoneCore = await import('@cornerstonejs/core');
      const { init: initCornerstoneCore, cache } = cornerstoneCore;

      // CRITICAL: Set cache size BEFORE init to prevent CACHE_SIZE_EXCEEDED
      // 500MB max cache - enough for ~100 CT slices, old ones get evicted
      cache.setMaxCacheSize(500 * 1024 * 1024); // 500MB

      initCornerstoneCore({
        gpuTier: { tier: 2 },
        isMobile: false
      });

      // 2. Check SharedArrayBuffer (optional optimization)
      const hasSharedArrayBuffer = typeof SharedArrayBuffer !== 'undefined';
      if (!hasSharedArrayBuffer) {
        console.warn('[Cornerstone3D] SharedArrayBuffer not available. Zero-copy transfers disabled.');
      }

      // 3. Initialize DICOM Image Loader
      const dicomImageLoader = await import('@cornerstonejs/dicom-image-loader');
      const { init: initDicomImageLoader, fileManager } = dicomImageLoader;

      initDicomImageLoader({
        maxWebWorkers: Math.min(navigator.hardwareConcurrency || 4, 4),
        startWebWorkersOnDemand: true,
        webWorkerTaskPaths: [],
        taskConfiguration: {
          decodeTask: {
            initializeCodecsOnStartup: false,
            usePDFJS: false,
            strict: false
          }
        }
      });

      // Store fileManager for blob handling
      if (typeof window !== 'undefined') {
        window.cornerstoneFileManager = fileManager;
      }

      // 4. Initialize Tools (for scroll, zoom, pan, measurement)
      const tools = await import('@cornerstonejs/tools');
      const { init: initTools, StackScrollTool, PanTool, ZoomTool, WindowLevelTool, LengthTool, ProbeTool, ToolGroupManager, Enums: ToolEnums } = tools;
      initTools();

      // Add tools to Cornerstone
      tools.addTool(StackScrollTool);
      tools.addTool(PanTool);
      tools.addTool(ZoomTool);
      tools.addTool(WindowLevelTool);
      tools.addTool(LengthTool);
      tools.addTool(ProbeTool);

      // 5. Register custom ZIP image loader
      registerZipImageLoader();

      cornerstoneInitialized = true;
      console.log('[Cornerstone3D] Initialized (Stack mode - no volume loader)');
    } catch (err) {
      console.error('[Cornerstone3D] Initialization error:', err);
      throw new Error(`Failed to initialize Cornerstone3D: ${err.message}`);
    }
  }, []);

  // Generate imageIds for stack (lazy - no extraction)
  // Uses refs to avoid dependency on fileList which changes every render
  const generateImageIds = useCallback(async (seriesIdx) => {
    const currentFiles = fileListRef.current;

    if (imageIdsRef.current.length === currentFiles.length && imageIdsRef.current.length > 0) {
      return imageIdsRef.current;
    }

    // Register ZIP structure for lazy loading
    if (isMultiSeries && currentFiles.length > 0 && currentFiles[0]?.source === 'zip') {
      registerZipStructure(seriesIdx, {
        files: currentFiles,
        seriesIndex: seriesIdx
      });
    }

    const imageIds = [];

    // For ZIP files: Create lazy zipentry: imageIds (NO extraction!)
    if (isMultiSeries && currentFiles.length > 0 && currentFiles[0]?.source === 'zip') {
      console.log(`[Cornerstone3D] Creating ${currentFiles.length} lazy imageIds for series ${seriesIdx}`);

      for (let i = 0; i < currentFiles.length; i++) {
        imageIds.push(generateZipImageId(seriesIdx, i));
      }
    } else {
      // For non-ZIP sources: Still need to create blob URLs
      console.log(`[Cornerstone3D] Creating ${currentFiles.length} imageIds from non-ZIP source`);

      for (let i = 0; i < currentFiles.length; i++) {
        const doc = currentFiles[i];
        if (!doc) continue;

        try {
          let blob = null;

          if (doc.getBlob && typeof doc.getBlob === 'function') {
            blob = await doc.getBlob();
          } else if (doc.storagePath) {
            blob = await downloadFileAsBlob(doc.storagePath, doc.fileUrl, userId, doc.id, false);
          } else if (doc.fileUrl) {
            const response = await fetch(doc.fileUrl);
            blob = await response.blob();
          }

          if (blob && blob.size > 0) {
            try {
              const { fileManager } = await import('@cornerstonejs/dicom-image-loader');
              const file = new File([blob], `dicom-${i}.dcm`, { type: 'application/dicom' });
              imageIds.push(fileManager.add(file));
            } catch {
              const objectUrl = URL.createObjectURL(blob);
              imageIds.push(`wadouri:${objectUrl}`);
            }
          }
        } catch (error) {
          console.error(`[Cornerstone3D] Error generating imageId ${i}:`, error.message);
        }
      }
    }

    imageIdsRef.current = imageIds;
    console.log(`[Cornerstone3D] Generated ${imageIds.length} imageIds for stack`);
    return imageIds;
  }, [userId, isMultiSeries]);

  // Navigate to specific slice (StackViewport method)
  const navigateToIndex = useCallback(async (newIndex) => {
    if (newIndex < 0 || newIndex >= fileList.length) return;
    if (!viewportRef.current) return;

    try {
      const viewport = viewportRef.current;

      // For StackViewport, use setImageIdIndex
      await viewport.setImageIdIndex(newIndex);

      // Render
      if (renderingEngineRef.current) {
        renderingEngineRef.current.renderViewports([viewport.id]);
      }

      // Update current image info
      const currentDoc = fileList[newIndex];
      if (currentDoc) {
        const metadata = currentDoc?.dicomMetadata || currentDoc?.dicomDirMeta?.image || decodedMetadata;
        setCurrentImageInfo({
          instanceNumber: metadata?.instanceNumber || null,
          sliceLocation: metadata?.sliceLocation || null,
          fileName: currentDoc?.fileName || null
        });
      }

      setError(null);
    } catch (err) {
      console.error('[Cornerstone3D] Error navigating:', err);
      setError(`Failed to navigate: ${err.message}`);
    }
  }, [fileList, decodedMetadata]);

  // Prefetch adjacent slices in background (conservative to avoid cache overflow)
  const prefetchAdjacentSlices = useCallback(async (centerIndex) => {
    if (!imageIdsRef.current.length) return;

    // Cancel any pending prefetch
    if (prefetchControllerRef.current) {
      prefetchControllerRef.current.abort();
    }

    prefetchControllerRef.current = new AbortController();
    const signal = prefetchControllerRef.current.signal;

    const { imageLoader, cache } = await import('@cornerstonejs/core');

    // Only prefetch 2 slices ahead/behind to avoid cache overflow
    // With 500MB cache and ~5MB per CT slice, we can hold ~100 slices
    const prefetchRadius = 2;

    // Calculate indices to prefetch (prioritize forward direction)
    const indicesToPrefetch = [];
    for (let offset = 1; offset <= prefetchRadius; offset++) {
      if (centerIndex + offset < imageIdsRef.current.length) {
        indicesToPrefetch.push(centerIndex + offset);
      }
      if (centerIndex - offset >= 0) {
        indicesToPrefetch.push(centerIndex - offset);
      }
    }

    // Prefetch in background - stop if cache is getting full
    for (const idx of indicesToPrefetch) {
      if (signal.aborted) break;

      // Check cache usage before prefetching
      const cacheInfo = cache.getCacheSize();
      const maxCache = cache.getMaxCacheSize();
      if (cacheInfo > maxCache * 0.8) {
        // Cache is 80% full, stop prefetching
        console.log('[Cornerstone3D] Cache 80% full, stopping prefetch');
        break;
      }

      try {
        const imageId = imageIdsRef.current[idx];
        if (imageId) {
          await imageLoader.loadImage(imageId);
        }
      } catch (err) {
        // Ignore prefetch errors (including cache errors)
        if (err.message?.includes('CACHE_SIZE_EXCEEDED')) {
          console.log('[Cornerstone3D] Cache full, stopping prefetch');
          break;
        }
      }

      // Longer delay to be gentle on resources
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }, []);

  // Switch active tool (for toolbar)
  const switchTool = useCallback(async (toolName) => {
    if (!toolGroupRef.current) return;

    try {
      const tools = await import('@cornerstonejs/tools');
      const { Enums: ToolEnums } = tools;
      const toolGroup = toolGroupRef.current;

      // Deactivate current primary tool
      if (activeTool === 'windowLevel') {
        toolGroup.setToolPassive(tools.WindowLevelTool.toolName);
      } else if (activeTool === 'length') {
        toolGroup.setToolPassive(tools.LengthTool.toolName);
      } else if (activeTool === 'probe') {
        toolGroup.setToolPassive(tools.ProbeTool.toolName);
        setProbeValue(null);
      }

      // Activate new tool
      if (toolName === 'windowLevel') {
        toolGroup.setToolActive(tools.WindowLevelTool.toolName, {
          bindings: [{ mouseButton: ToolEnums.MouseBindings.Primary }]
        });
      } else if (toolName === 'length') {
        toolGroup.setToolActive(tools.LengthTool.toolName, {
          bindings: [{ mouseButton: ToolEnums.MouseBindings.Primary }]
        });
      } else if (toolName === 'probe') {
        toolGroup.setToolActive(tools.ProbeTool.toolName, {
          bindings: [{ mouseButton: ToolEnums.MouseBindings.Primary }]
        });
      }

      setActiveTool(toolName);
    } catch (err) {
      console.error('[Cornerstone3D] Error switching tool:', err);
    }
  }, [activeTool]);

  // Reset viewport to default view
  const resetView = useCallback(() => {
    if (!viewportRef.current || !renderingEngineRef.current) return;

    try {
      const viewport = viewportRef.current;
      viewport.resetCamera();
      viewport.resetProperties();
      renderingEngineRef.current.renderViewports([viewport.id]);

      // Reset invert state
      setIsInverted(false);
    } catch (err) {
      console.error('[Cornerstone3D] Error resetting view:', err);
    }
  }, []);

  // Toggle image inversion (negative mode)
  const toggleInvert = useCallback(() => {
    if (!viewportRef.current || !renderingEngineRef.current) return;

    try {
      const viewport = viewportRef.current;
      const newInvertState = !isInverted;

      // Get current properties and toggle invert
      const properties = viewport.getProperties();
      viewport.setProperties({ ...properties, invert: newInvertState });
      renderingEngineRef.current.renderViewports([viewport.id]);

      setIsInverted(newInvertState);
    } catch (err) {
      console.error('[Cornerstone3D] Error toggling invert:', err);
    }
  }, [isInverted]);

  // Lazy-load series files when series selection changes
  useEffect(() => {
    if (!isMultiSeries || !seriesList || !documents?.loadSeriesFiles) {
      return;
    }

    const loadSeries = async () => {
      if (loadedSeriesFiles.has(selectedSeriesIndex)) return;
      if (loadingSeries.has(selectedSeriesIndex)) return;

      setLoadingSeries(prev => new Set(prev).add(selectedSeriesIndex));
      setLoadingProgress(`Loading series ${selectedSeriesIndex + 1}/${seriesList.length}...`);

      try {
        const files = await documents.loadSeriesFiles(selectedSeriesIndex);
        setLoadedSeriesFiles(prev => {
          const next = new Map(prev);
          next.set(selectedSeriesIndex, files);
          return next;
        });
      } catch (error) {
        console.error(`[Cornerstone3D] Error loading series ${selectedSeriesIndex}:`, error);
        setError(`Failed to load series: ${error.message}`);
      } finally {
        setLoadingSeries(prev => {
          const next = new Set(prev);
          next.delete(selectedSeriesIndex);
          return next;
        });
        setLoadingProgress(null);
      }
    };

    loadSeries();
  }, [selectedSeriesIndex, isMultiSeries, seriesList, documents, loadedSeriesFiles, loadingSeries]);

  // Initialize viewer with StackViewport
  // Use a stable key to prevent re-initialization on every render
  const fileListKey = `${selectedSeriesIndex}-${fileList.length}-${fileList[0]?.fileName || 'none'}`;
  const fileListKeyRef = useRef(fileListKey);

  // Track if files are ready for this series
  const filesReady = !isMultiSeries || (loadedSeriesFiles.has(selectedSeriesIndex) && !loadingSeries.has(selectedSeriesIndex));
  const hasFiles = fileList.length > 0;

  useEffect(() => {
    // Only proceed if files are ready and we have files
    if (!filesReady || !hasFiles || !userId) {
      setIsLoading(false);
      return;
    }

    // Check if this is a new fileListKey (series changed)
    if (fileListKeyRef.current !== fileListKey) {
      fileListKeyRef.current = fileListKey;
      initStartedRef.current = false; // Allow re-init for new series
    }

    // Prevent double initialization (React StrictMode)
    if (initStartedRef.current) {
      return;
    }
    initStartedRef.current = true;

    // Track if component is still mounted
    let isMounted = true;
    let localRenderingEngine = null;
    let localToolGroupId = null;

    const initViewer = async () => {
      try {
        if (!isMounted) return;

        // Use ref for stable file list access
        const currentFileList = fileListRef.current;

        setIsLoading(true);
        setError(null);
        setTotalFiles(currentFileList.length);
        setCurrentIndex(0);
        setCurrentImageInfo(null);
        setLoadedSlicesCount(0);
        setLoadingProgress('Initializing Cornerstone3D...');

        // Timeout safety
        initTimeoutRef.current = setTimeout(() => {
          if (!isMounted) return;
          console.error('[Cornerstone3D] Initialization timeout');
          setError('Viewer initialization timed out. Please try again.');
          setIsLoading(false);
        }, 30000);

        // Initialize Cornerstone3D
        await initializeCornerstone();

        if (!isMounted) return;

        const { RenderingEngine, Enums } = await import('@cornerstonejs/core');

        // Create rendering engine with unique ID
        const renderingEngineId = `cornerstone-viewer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        localRenderingEngine = new RenderingEngine(renderingEngineId);
        renderingEngineRef.current = localRenderingEngine;

        if (!isMounted || !viewerRef.current) {
          // Component unmounted during async operation
          if (localRenderingEngine) {
            try { localRenderingEngine.destroy(); } catch (e) { /* ignore */ }
          }
          return;
        }

        const container = viewerRef.current;

        // Wait for container dimensions
        let attempts = 0;
        while ((container.offsetWidth === 0 || container.offsetHeight === 0) && attempts < 10 && isMounted) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }

        if (!isMounted) return;

        if (container.offsetWidth === 0 || container.offsetHeight === 0) {
          container.style.width = '100%';
          container.style.height = '100%';
          await new Promise(resolve => setTimeout(resolve, 200));
        }

        if (!isMounted) return;

        // Create STACK VIEWPORT
        const viewportId = `stack-viewport-${Date.now()}`;
        const viewportInput = {
          viewportId,
          element: container,
          type: Enums.ViewportType.STACK
        };

        localRenderingEngine.enableElement(viewportInput);
        const viewport = localRenderingEngine.getViewport(viewportId);
        viewportRef.current = viewport;

        if (!isMounted) return;

        // Wait for canvas
        let canvasWaitAttempts = 0;
        while (!viewport.element?.querySelector('canvas') && canvasWaitAttempts < 20 && isMounted) {
          await new Promise(resolve => setTimeout(resolve, 50));
          canvasWaitAttempts++;
        }

        if (!isMounted) return;

        // Set up tools for the viewport
        try {
          const tools = await import('@cornerstonejs/tools');
          const { ToolGroupManager, Enums: ToolEnums } = tools;

          // Create unique tool group
          localToolGroupId = `toolGroup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          let toolGroup = ToolGroupManager.createToolGroup(localToolGroupId);

          if (toolGroup && isMounted) {
            // Store tool group reference for later use
            toolGroupRef.current = toolGroup;

            // Add viewport to tool group
            toolGroup.addViewport(viewportId, renderingEngineId);

            // Add all tools to the group
            toolGroup.addTool(tools.StackScrollTool.toolName);
            toolGroup.addTool(tools.PanTool.toolName);
            toolGroup.addTool(tools.ZoomTool.toolName);
            toolGroup.addTool(tools.WindowLevelTool.toolName);
            toolGroup.addTool(tools.LengthTool.toolName);
            toolGroup.addTool(tools.ProbeTool.toolName);

            // Set active tools - scroll always on wheel
            toolGroup.setToolActive(tools.StackScrollTool.toolName, {
              bindings: [{ mouseButton: ToolEnums.MouseBindings.Wheel }]
            });
            // Default: WindowLevel on primary (left click)
            toolGroup.setToolActive(tools.WindowLevelTool.toolName, {
              bindings: [{ mouseButton: ToolEnums.MouseBindings.Primary }]
            });
            toolGroup.setToolActive(tools.PanTool.toolName, {
              bindings: [{ mouseButton: ToolEnums.MouseBindings.Auxiliary }]
            });
            toolGroup.setToolActive(tools.ZoomTool.toolName, {
              bindings: [{ mouseButton: ToolEnums.MouseBindings.Secondary }]
            });
            // Length and Probe are passive by default (can be activated via toolbar)
            toolGroup.setToolPassive(tools.LengthTool.toolName);
            toolGroup.setToolPassive(tools.ProbeTool.toolName);
          }

          // Add custom wheel/trackpad handler for slice scrolling
          // This handles two-finger trackpad scrolling which may not trigger the standard wheel tool
          let wheelAccumulator = 0;
          const wheelThreshold = 50; // Pixels of scroll before changing slice

          const handleWheel = (e) => {
            if (!isMounted || !viewportRef.current) return;

            // Prevent default scrolling behavior
            e.preventDefault();

            // Accumulate scroll delta (trackpad sends many small events)
            wheelAccumulator += e.deltaY;

            // Only change slice when threshold is reached
            if (Math.abs(wheelAccumulator) >= wheelThreshold) {
              const direction = wheelAccumulator > 0 ? 1 : -1;
              wheelAccumulator = 0; // Reset accumulator

              setCurrentIndex(prev => {
                const newIndex = prev + direction;
                const maxIndex = imageIdsRef.current.length - 1;
                return Math.max(0, Math.min(maxIndex, newIndex));
              });
            }
          };

          container.addEventListener('wheel', handleWheel, { passive: false });

          // Store cleanup function
          container._wheelCleanup = () => {
            container.removeEventListener('wheel', handleWheel);
          };
        } catch (toolError) {
          console.warn('[Cornerstone3D] Tool setup error (non-fatal):', toolError);
        }

        if (!isMounted) return;

        // Generate imageIds (fast - no extraction for ZIP)
        setLoadingProgress('Preparing image stack...');
        const imageIds = await generateImageIds(selectedSeriesIndex);

        if (!isMounted) return;

        if (!imageIds || imageIds.length === 0) {
          throw new Error('No imageIds generated');
        }

        // Set stack on viewport
        setLoadingProgress('Setting up stack viewport...');
        await viewport.setStack(imageIds, 0);

        if (!isMounted) return;

        // Render first image
        setLoadingProgress('Loading first image...');
        localRenderingEngine.renderViewports([viewport.id]);

        // Start prefetching adjacent slices in background
        setLoadedSlicesCount(1);
        if (isMounted) {
          prefetchAdjacentSlices(0);
        }

        // Extract metadata from first file
        if (currentFileList[0] && !decodedMetadata && isMounted) {
          try {
            const firstDoc = currentFileList[0];
            if (firstDoc.dicomMetadata || firstDoc.dicomDirMeta) {
              const dirMeta = firstDoc.dicomDirMeta;
              const existingMeta = firstDoc.dicomMetadata ||
                (dirMeta?.image ? {
                  instanceNumber: dirMeta.image.instanceNumber,
                  sliceLocation: dirMeta.image.sliceLocation,
                  modality: dirMeta.series?.modality,
                  studyDescription: dirMeta.study?.studyDescription,
                  seriesDescription: dirMeta.series?.seriesDescription,
                  studyDate: dirMeta.study?.studyDate,
                  seriesDate: dirMeta.series?.seriesDate,
                  seriesTime: dirMeta.series?.seriesTime,
                  bodyPartExamined: dirMeta.series?.bodyPartExamined,
                  // Institution can be at series or study level
                  institutionName: dirMeta.series?.institutionName || dirMeta.study?.institutionName,
                  institutionAddress: dirMeta.study?.institutionAddress,
                  accessionNumber: dirMeta.study?.accessionNumber,
                } : null);
              if (existingMeta) {
                setDecodedMetadata(existingMeta);
              }
            }
          } catch (metadataError) {
            console.warn('[Cornerstone3D] Error extracting metadata:', metadataError);
          }
        }

        if (initTimeoutRef.current) {
          clearTimeout(initTimeoutRef.current);
          initTimeoutRef.current = null;
        }

        if (isMounted) {
          setIsLoading(false);
          setLoadingProgress(null);
        }
      } catch (err) {
        if (initTimeoutRef.current) {
          clearTimeout(initTimeoutRef.current);
          initTimeoutRef.current = null;
        }

        if (!isMounted) return;

        console.error('[Cornerstone3D] Error initializing viewer:', err);
        let errorMessage = err.message || 'Failed to initialize viewer';

        if (err.message?.includes('memory')) {
          errorMessage = `Memory error: The DICOM file is too large. (${fileListRef.current.length} files)`;
        }

        setError(errorMessage);
        setIsLoading(false);
      }
    };

    initViewer();

    return () => {
      // Mark as unmounted FIRST
      isMounted = false;

      // Clear timeout
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
        initTimeoutRef.current = null;
      }

      // Cancel prefetch
      if (prefetchControllerRef.current) {
        prefetchControllerRef.current.abort();
        prefetchControllerRef.current = null;
      }

      // Cleanup wheel event listener
      if (viewerRef.current?._wheelCleanup) {
        viewerRef.current._wheelCleanup();
        delete viewerRef.current._wheelCleanup;
      }

      // Destroy tool group
      if (localToolGroupId) {
        import('@cornerstonejs/tools').then(({ ToolGroupManager }) => {
          try {
            ToolGroupManager.destroyToolGroup(localToolGroupId);
          } catch (e) { /* ignore */ }
        }).catch(() => {});
      }

      // Destroy rendering engine
      if (localRenderingEngine) {
        try {
          localRenderingEngine.destroy();
        } catch (err) {
          // Ignore - may already be destroyed
        }
      }
      renderingEngineRef.current = null;
      viewportRef.current = null;

      // Cleanup imageIds
      const imageIdsToCleanup = [...imageIdsRef.current];
      imageIdsRef.current = [];

      import('@cornerstonejs/core').then(({ cache }) => {
        for (const imageId of imageIdsToCleanup) {
          try {
            cache.removeImageLoadObject(imageId);
            if (imageId.startsWith('wadouri:')) {
              URL.revokeObjectURL(imageId.replace('wadouri:', ''));
            }
          } catch (e) { /* ignore */ }
        }
      }).catch(() => {});

      // Clear ZIP caches
      unregisterZipImageLoader();

      // Reset init flag so next effect can run
      initStartedRef.current = false;
    };
    // CRITICAL: Use stable dependencies only to prevent infinite loops
    // fileListKey captures: selectedSeriesIndex + fileList.length + first file name
    // filesReady captures: whether series is loaded
  }, [fileListKey, filesReady, hasFiles, userId, initializeCornerstone, generateImageIds, prefetchAdjacentSlices, selectedSeriesIndex]);

  // Handle navigation changes
  useEffect(() => {
    if (navigatingRef.current) return;

    if (currentIndex >= 0 && currentIndex < fileList.length && !isLoading && fileList.length > 0 && viewportRef.current) {
      navigatingRef.current = true;
      navigateToIndex(currentIndex).then(() => {
        // Prefetch adjacent slices after navigation
        prefetchAdjacentSlices(currentIndex);
      }).finally(() => {
        navigatingRef.current = false;
      });
    }
  }, [currentIndex, fileList.length, isLoading, navigateToIndex, prefetchAdjacentSlices]);

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

  // Emergency close handler
  const handleEmergencyClose = useCallback((e) => {
    if (e.key === 'Escape' || e.keyCode === 27) {
      e.preventDefault();
      e.stopPropagation();
      if (onClose) onClose();
    }
  }, [onClose]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      setCurrentIndex(prev => Math.max(0, prev - 1));
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      setCurrentIndex(prev => Math.min(totalFiles - 1, prev + 1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setCurrentIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setCurrentIndex(totalFiles - 1);
    }
  }, [totalFiles]);

  // Add global escape and keyboard handlers
  useEffect(() => {
    window.addEventListener('keydown', handleEmergencyClose);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleEmergencyClose);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleEmergencyClose, handleKeyDown]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Emergency Close Button */}
      <button
        onClick={onClose}
        className="fixed top-4 right-4 z-[100] p-3 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg transition-colors"
        title="Close Viewer (ESC)"
        type="button"
        aria-label="Close viewer"
      >
        <X className="w-6 h-6" />
      </button>

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
                  {hasMultipleFiles && (
                    <>
                      {' - '}
                      <span className="text-gray-300">
                        {totalFiles} slice{totalFiles !== 1 ? 's' : ''}
                      </span>
                    </>
                  )}
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
                      setCurrentIndex(0);
                    }
                  }}
                  className="bg-gray-800 text-white border border-gray-600 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-gray-500"
                  disabled={loadingSeries.has(selectedSeriesIndex)}
                >
                  {seriesList.map((s, i) => (
                    <option key={i} value={i}>
                      {s.label || `Series ${i + 1}`} ({s.fileIndices?.length ?? s.files?.length ?? 0})
                      {loadedSeriesFiles.has(i) ? ' ✓' : ''}
                    </option>
                  ))}
                </select>
                {loadingSeries.has(selectedSeriesIndex) && (
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                )}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-md transition-colors flex-shrink-0"
            type="button"
            title="Close Viewer (ESC)"
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
              <p className="text-sm text-gray-300">{loadingProgress || 'Loading...'}</p>
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
            {/* Toolbar */}
            <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
              <div className="flex gap-1 bg-black/80 rounded-lg p-1.5 backdrop-blur-sm">
                {/* Window/Level Tool (default) */}
                <button
                  onClick={() => switchTool('windowLevel')}
                  className={`p-2 rounded-md transition-colors ${
                    activeTool === 'windowLevel'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                  title="Window/Level (adjust brightness/contrast)"
                >
                  <SunMoon className="w-5 h-5" />
                </button>

                {/* Length Measurement Tool */}
                <button
                  onClick={() => switchTool('length')}
                  className={`p-2 rounded-md transition-colors ${
                    activeTool === 'length'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                  title="Measure Distance (click and drag)"
                >
                  <Ruler className="w-5 h-5" />
                </button>

                {/* Probe Tool (HU values) */}
                <button
                  onClick={() => switchTool('probe')}
                  className={`p-2 rounded-md transition-colors ${
                    activeTool === 'probe'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                  title="Probe (show HU value at click)"
                >
                  <Crosshair className="w-5 h-5" />
                </button>

                <div className="w-px bg-gray-600 mx-1" />

                {/* Invert Toggle */}
                <button
                  onClick={toggleInvert}
                  className={`p-2 rounded-md transition-colors ${
                    isInverted
                      ? 'bg-yellow-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                  title="Invert (toggle negative mode)"
                >
                  <span className="w-5 h-5 flex items-center justify-center text-sm font-bold">
                    {isInverted ? '−' : '+'}
                  </span>
                </button>

                {/* Reset View */}
                <button
                  onClick={resetView}
                  className="p-2 rounded-md bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
                  title="Reset View"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>
              </div>

              {/* Probe value display */}
              {activeTool === 'probe' && probeValue !== null && (
                <div className="bg-black/80 rounded-lg px-3 py-1.5 text-white text-sm backdrop-blur-sm">
                  HU: {probeValue}
                </div>
              )}
            </div>

            <div
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
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-2 z-20">
                <div className="flex items-center gap-4 bg-black/70 rounded-lg px-4 py-2">
                  <button
                    onClick={() => {
                      if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
                    }}
                    disabled={currentIndex === 0}
                    className="p-2 rounded-md bg-white/20 hover:bg-white/30 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Previous slice (←)"
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
                      if (currentIndex < totalFiles - 1) setCurrentIndex(currentIndex + 1);
                    }}
                    disabled={currentIndex >= totalFiles - 1}
                    className="p-2 rounded-md bg-white/20 hover:bg-white/30 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Next slice (→)"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
                {/* Slice slider for fast navigation */}
                {totalFiles > 10 && (
                  <div className="bg-black/70 rounded-lg px-4 py-2 w-full max-w-md">
                    <input
                      type="range"
                      min={0}
                      max={totalFiles - 1}
                      value={currentIndex}
                      onChange={(e) => setCurrentIndex(parseInt(e.target.value, 10))}
                      className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Metadata Panel */}
      {displayMetadata && (
        <div className="flex-shrink-0 bg-gray-900 text-white border-t border-gray-700 p-4 overflow-y-auto max-h-48">
          <h4 className="text-sm font-semibold mb-2">Scan Information</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-2 text-sm">
            {/* Modality */}
            {displayMetadata.modality && (
              <div>
                <span className="font-medium text-gray-300">Modality: </span>
                <span className="text-gray-400">{displayMetadata.modality}</span>
              </div>
            )}
            {/* Series Date (preferred) or Study Date */}
            {(displayMetadata.seriesDate || displayMetadata.studyDate || displayMetadata.studyDateFormatted) && (
              <div>
                <span className="font-medium text-gray-300">
                  {displayMetadata.seriesDate ? 'Series Date: ' : 'Study Date: '}
                </span>
                <span className="text-gray-400">
                  {displayMetadata.seriesDate
                    ? formatDicomDate(displayMetadata.seriesDate)
                    : (displayMetadata.studyDateFormatted || formatDicomDate(displayMetadata.studyDate))}
                </span>
              </div>
            )}
            {/* Series Time */}
            {displayMetadata.seriesTime && (
              <div>
                <span className="font-medium text-gray-300">Time: </span>
                <span className="text-gray-400">{formatDicomTime(displayMetadata.seriesTime)}</span>
              </div>
            )}
            {/* Institution / Hospital */}
            {displayMetadata.institutionName && (
              <div className="col-span-1 md:col-span-2">
                <span className="font-medium text-gray-300">Institution: </span>
                <span className="text-gray-400">{displayMetadata.institutionName}</span>
              </div>
            )}
            {/* Body Part */}
            {displayMetadata.bodyPartExamined && (
              <div>
                <span className="font-medium text-gray-300">Body Part: </span>
                <span className="text-gray-400">{displayMetadata.bodyPartExamined}</span>
              </div>
            )}
            {/* Series Description */}
            {displayMetadata.seriesDescription && (
              <div className="col-span-1 md:col-span-2">
                <span className="font-medium text-gray-300">Series: </span>
                <span className="text-gray-400">{displayMetadata.seriesDescription}</span>
              </div>
            )}
            {/* Study Description */}
            {displayMetadata.studyDescription && displayMetadata.studyDescription !== displayMetadata.seriesDescription && (
              <div className="col-span-1 md:col-span-2">
                <span className="font-medium text-gray-300">Study: </span>
                <span className="text-gray-400">{displayMetadata.studyDescription}</span>
              </div>
            )}
            {/* Accession Number */}
            {displayMetadata.accessionNumber && (
              <div>
                <span className="font-medium text-gray-300">Accession #: </span>
                <span className="text-gray-400">{displayMetadata.accessionNumber}</span>
              </div>
            )}
            {/* Slice Count */}
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
