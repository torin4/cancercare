/**
 * ZIP Viewer Service
 *
 * Prepares ZIP files for direct viewing without uploading to Firebase Storage.
 * Similar to zipService.js but optimized for in-memory viewing:
 * - Keeps ZIP in memory
 * - Returns zipEntry references (not extracted Files)
 * - Organizes by study/series using DICOMDIR when available
 * - Provides on-demand Blob extraction for viewer
 *
 * This enables instant viewing like IMAIOS - no upload/download delays.
 */

import JSZip from 'jszip';
import { parseDicomDir, flattenDicomDirStructure } from './dicomDirParser';

/**
 * Prepare ZIP file for direct viewing
 * Loads ZIP, parses DICOMDIR if present, organizes files by study/series
 * Returns structure with zipEntry references for on-demand extraction
 *
 * @param {File|ArrayBuffer} zipFileOrBuffer - ZIP file or ArrayBuffer to prepare
 * @param {Function} onProgress - Optional progress callback (current, total, message)
 * @returns {Promise<Object>} - Structure ready for viewer
 *
 * Returns:
 * {
 *   success: boolean,
 *   error?: string,
 *   zip: JSZip instance (kept in memory),
 *   entries: Array<{ relativePath, zipEntry, fileName, dicomDirMeta?, dicomDirSortKey? }>,
 *   dicomDirStructure?: { patients: [...] },
 *   series: Array<{ id, label, files: Array<{ index, zipEntry, metadata? }> }>,
 *   getFileBlob: (index) => Promise<Blob>,
 *   getFileBlobByPath: (path) => Promise<Blob>
 * }
 */
export async function prepareZipForViewing(zipFileOrBuffer, onProgress = null) {
  try {
    // Debug: Log what we received
    console.log('[ZIP Viewer] prepareZipForViewing called with:', {
      type: typeof zipFileOrBuffer,
      isArrayBuffer: zipFileOrBuffer instanceof ArrayBuffer,
      isFile: zipFileOrBuffer instanceof File,
      constructor: zipFileOrBuffer?.constructor?.name,
      hasByteLength: 'byteLength' in zipFileOrBuffer,
      hasSize: 'size' in zipFileOrBuffer
    });
    
    let arrayBuffer;
    let fileName = 'archive.zip';
    let fileSizeMB = 0;

    // Handle both File and ArrayBuffer inputs
    // Check for ArrayBuffer more robustly (handles different contexts)
    // ArrayBuffer has byteLength property and is not a File
    const hasByteLength = zipFileOrBuffer && typeof zipFileOrBuffer.byteLength === 'number';
    const isFile = zipFileOrBuffer instanceof File;
    const isArrayBuffer = zipFileOrBuffer instanceof ArrayBuffer || 
                         (hasByteLength && !isFile && !zipFileOrBuffer.name);
    
    if (isArrayBuffer) {
      // Already an ArrayBuffer - use it directly (this is the preferred method)
      arrayBuffer = zipFileOrBuffer;
      fileSizeMB = arrayBuffer.byteLength / (1024 * 1024);
      fileName = 'archive.zip';
      console.log(`[ZIP Viewer] Using provided ArrayBuffer (${fileSizeMB.toFixed(1)}MB)`);
    } else if (isFile) {
      // It's a File object - try to read it
      fileName = zipFileOrBuffer.name || 'archive.zip';
      fileSizeMB = zipFileOrBuffer.size / (1024 * 1024);
      
      // Only log for large files to reduce console noise
      if (fileSizeMB > 100) {
        console.log(`[ZIP Viewer] Preparing ZIP: ${fileName} (${fileSizeMB.toFixed(1)}MB)`);
      }

      // Warn about very large files that may cause memory issues
      if (fileSizeMB > 500) {
        console.warn(`[ZIP Viewer] Very large ZIP (${fileSizeMB.toFixed(1)}MB) - may cause memory issues`);
        if (onProgress) {
          onProgress(0, 0, `Warning: Large file (${fileSizeMB.toFixed(0)}MB) - this may take a while...`);
        }
      }

      if (onProgress) {
        onProgress(0, 0, 'Reading ZIP file...');
      }

      try {
        console.log('[ZIP Viewer] Attempting to read File object...');
        arrayBuffer = await zipFileOrBuffer.arrayBuffer();
        console.log('[ZIP Viewer] Successfully read File, size:', arrayBuffer.byteLength);
        
        // Only log memory usage for large files
        if (fileSizeMB > 100) {
          const arrayBufferMB = arrayBuffer.byteLength / (1024 * 1024);
          console.log(`[ZIP Viewer] ZIP loaded: ${arrayBufferMB.toFixed(1)}MB in memory`);
        }
      } catch (readError) {
        console.error('[ZIP Viewer] Error reading ZIP file:', readError);
        console.error('[ZIP Viewer] Error details:', {
          name: readError.name,
          message: readError.message,
          stack: readError.stack
        });
        
        // Provide helpful error message for file already read
        if (readError.name === 'NotReadableError' || readError.message?.includes('could not be read')) {
          throw new Error('File has already been read. Please pass an ArrayBuffer instead of a File object. The file was likely consumed during processing.');
        }
        
        if (readError.message && (readError.message.includes('memory') || readError.message.includes('allocation'))) {
          throw new Error(`ZIP file is too large (${fileSizeMB.toFixed(1)}MB) to load in browser memory. Please try a smaller archive or split the files.`);
        }
        throw new Error(`Failed to read ZIP file: ${readError.message || 'File may be too large or corrupted'}`);
      }
    } else {
      throw new Error('Invalid input: expected File or ArrayBuffer');
    }

    if (onProgress) {
      onProgress(0, 0, 'Parsing ZIP structure...');
    }

    let zip;
    try {
      zip = await JSZip.loadAsync(arrayBuffer, {
        checkCRC32: false,
        createFolders: true
      });
    } catch (loadError) {
      console.error('[ZIP Viewer] Error loading ZIP file:', loadError);
      throw new Error(`Failed to load ZIP file: ${loadError.message || 'ZIP file may be corrupted'}`);
    }

    // OPTIMIZATION: Check for DICOMDIR FIRST (like IMAIOS does)
    // If DICOMDIR exists, use it exclusively - no need to scan all files
    let dicomDirZipEntry = null;
    let dicomDirStructure = null;
    const zipFiles = Object.entries(zip.files);
    
    // Fast scan for DICOMDIR only
    for (const [relativePath, zipEntry] of zipFiles) {
      if (zipEntry.dir) continue;
      const lowerPath = relativePath.toLowerCase();
      if (lowerPath === 'dicomdir' || lowerPath.endsWith('/dicomdir')) {
        dicomDirZipEntry = { relativePath, zipEntry };
        break; // Found it, stop scanning
      }
    }

    const dicomFileEntries = [];
    
    // If DICOMDIR exists, parse it FIRST and use it to build file list (IMAIOS approach)
    if (dicomDirZipEntry) {
      console.log('[ZIP Viewer] Found DICOMDIR, parsing...');
      if (onProgress) onProgress(0, 0, 'Parsing DICOMDIR...');
      try {
        const blob = await dicomDirZipEntry.zipEntry.async('blob');
        const ab = await blob.arrayBuffer();
        console.log('[ZIP Viewer] Calling parseDicomDir with ArrayBuffer size:', ab.byteLength);
        const parseResult = await parseDicomDir(ab);
        console.log('[ZIP Viewer] parseDicomDir result:', parseResult);
        if (parseResult.success && parseResult.structure) {
          dicomDirStructure = parseResult.structure;
          const flat = flattenDicomDirStructure(parseResult.structure);
          
          // Build path-to-zipEntry map for fast lookup
          const pathToZipEntry = new Map();
          for (const [relativePath, zipEntry] of zipFiles) {
            if (zipEntry.dir) continue;
            const normPath = (relativePath || '').toLowerCase().replace(/\\/g, '/');
            pathToZipEntry.set(normPath, zipEntry);
            // Also store without leading slash and with different path separators
            if (normPath.startsWith('/')) {
              pathToZipEntry.set(normPath.substring(1), zipEntry);
            }
            pathToZipEntry.set(normPath.replace(/\//g, '\\'), zipEntry);
          }
          
          // Use DICOMDIR to build file list - trust it completely (no header checks needed!)
          if (onProgress) onProgress(0, flat.length, `Loading ${flat.length} DICOM files from DICOMDIR...`);
          
          for (let i = 0; i < flat.length; i++) {
            const entry = flat[i];
            const filePath = entry.filePath || entry.filePathLower || '';
            const normPath = filePath.toLowerCase().replace(/\\/g, '/');
            
            // Try multiple path variations to find the zipEntry
            let zipEntry = pathToZipEntry.get(normPath) ||
                          pathToZipEntry.get(normPath.replace(/^\/+/, '')) ||
                          pathToZipEntry.get(normPath.replace(/\//g, '\\'));
            
            // If not found, try partial matching
            if (!zipEntry) {
              for (const [path, entry] of pathToZipEntry) {
                const pathLower = path.toLowerCase();
                if (pathLower === normPath || 
                    pathLower.endsWith('/' + normPath) || 
                    pathLower.endsWith(normPath) ||
                    normPath.endsWith('/' + pathLower) ||
                    normPath.endsWith(pathLower)) {
                  zipEntry = entry;
                  break;
                }
              }
            }
            
            if (zipEntry && !zipEntry.dir) {
              const relativePath = Array.from(pathToZipEntry.entries()).find(([p, e]) => e === zipEntry)?.[0] || filePath;
              const fileName = relativePath.split('/').pop() || relativePath.split('\\').pop() || filePath;
              
              const inst = parseInt(entry.image?.instanceNumber || '0', 10);
              const sl = parseFloat(entry.image?.sliceLocation || '0');
              const sortKey = [
                entry.study?.studyInstanceUID || '',
                entry.study?.studyDate || '',
                entry.series?.seriesInstanceUID || '',
                String(entry.series?.seriesNumber || '').padStart(8, '0'),
                Number.isNaN(inst) ? 0 : inst,
                Number.isNaN(sl) ? 0 : sl,
              ].join('\0');
              
              dicomFileEntries.push({
                relativePath,
                zipEntry,
                fileName: fileName.includes('.') ? fileName : `${fileName}.dcm`,
                dicomDirMeta: {
                  study: entry.study || {},
                  series: entry.series || {},
                  image: entry.image || {}
                },
                dicomDirSortKey: sortKey
              });
            }
            
            if (onProgress && (i + 1) % 100 === 0) {
              onProgress(i + 1, flat.length, `Loading files from DICOMDIR... (${i + 1}/${flat.length})`);
            }
          }
          
          // Sort by DICOMDIR order
          dicomFileEntries.sort((a, b) => (a.dicomDirSortKey || '').localeCompare(b.dicomDirSortKey || ''));
          
          if (dicomFileEntries.length > 0) {
            console.log(`[ZIP Viewer] Loaded ${dicomFileEntries.length} DICOM files from DICOMDIR (fast path)`);
          }
        }
      } catch (e) {
        console.warn('[ZIP Viewer] DICOMDIR parse error, falling back to file scan:', e);
        dicomDirZipEntry = null; // Fall through to file scanning
      }
    }
    
    // Fallback: If no DICOMDIR or DICOMDIR failed, scan files (slower but works)
    if (dicomFileEntries.length === 0) {
      if (onProgress) {
        onProgress(0, zipFiles.length, 'Scanning ZIP for DICOM files...');
      }

      let scannedCount = 0;
      const totalEntries = zipFiles.length;
      const useFastHeuristic = fileSizeMB > 300;

      for (const [relativePath, zipEntry] of zipFiles) {
        scannedCount++;

        if (zipEntry.dir) {
          if (onProgress && scannedCount % 500 === 0) {
            onProgress(scannedCount, totalEntries, `Scanning... (${scannedCount}/${totalEntries}, found ${dicomFileEntries.length} DICOM files)`);
          }
          continue;
        }

        const lowerPath = relativePath.toLowerCase();
        const hasDicomExtension = lowerPath.endsWith('.dcm') || lowerPath.endsWith('.dicom');

        let isDicom = hasDicomExtension;
        if (!hasDicomExtension && !relativePath.includes('.')) {
          if (useFastHeuristic) {
            // Fast heuristic: assume files in DICOM-related folders are DICOM
            const pathParts = lowerPath.split('/');
            const inDicomFolder = pathParts.some(part =>
              part.includes('dcm') ||
              part.includes('dicom') ||
              part.includes('dcmdt') ||
              part === 'ihe_pdi' ||
              part === 'pdsv'
            );
            isDicom = inDicomFolder;
          }
          // Skip header checks for speed - trust file extensions and folder names
        }

        if (isDicom) {
          let fileName = relativePath.split('/').pop() || relativePath;
          if (!fileName.includes('.')) {
            fileName = `${fileName}.dcm`;
          }

          dicomFileEntries.push({
            relativePath,
            zipEntry,
            fileName
          });
        }

        const progressInterval = useFastHeuristic ? 500 : 100;
        if (onProgress && scannedCount % progressInterval === 0) {
          onProgress(scannedCount, totalEntries, `Found ${dicomFileEntries.length} DICOM files... (${scannedCount}/${totalEntries})`);
        }
      }

      if (dicomFileEntries.length > 0) {
        console.log(`[ZIP Viewer] Found ${dicomFileEntries.length} DICOM file${dicomFileEntries.length !== 1 ? 's' : ''} (fallback scan)`);
      }
    }

    // Organize files by series - but store only metadata/paths, not zipEntry objects
    // This allows lazy loading of series files
    const seriesMap = new Map();
    const fileMetadata = []; // Store metadata for all files (lightweight)
    
    for (let i = 0; i < dicomFileEntries.length; i++) {
      const entry = dicomFileEntries[i];
      
      // Skip null or invalid entries (only log first few to avoid spam)
      if (!entry || !entry.zipEntry) {
        if (i < 5) {
          console.warn(`[ZIP Viewer] Skipping invalid entry at index ${i}`);
        }
        continue;
      }
      
      // Store lightweight metadata (without zipEntry)
      fileMetadata.push({
        index: i,
        relativePath: entry.relativePath,
        fileName: entry.fileName,
        dicomDirMeta: entry.dicomDirMeta || null
      });
      
      const seriesUID = entry.dicomDirMeta?.series?.seriesInstanceUID || `series-${i}`;
      const studyUID = entry.dicomDirMeta?.study?.studyInstanceUID || `study-${i}`;
      const seriesKey = `${studyUID}::${seriesUID}`;

      if (!seriesMap.has(seriesKey)) {
        const seriesLabel = entry.dicomDirMeta?.series?.seriesDescription ||
          entry.dicomDirMeta?.series?.modality ||
          `Series ${seriesMap.size + 1}`;
        seriesMap.set(seriesKey, {
          id: seriesKey,
          label: seriesLabel,
          studyInstanceUID: studyUID,
          seriesInstanceUID: seriesUID,
          modality: entry.dicomDirMeta?.series?.modality || null,
          bodyPartExamined: entry.dicomDirMeta?.series?.bodyPartExamined || null,
          fileIndices: [] // Store indices instead of full file objects
        });
      }

      const series = seriesMap.get(seriesKey);
      if (series) {
        series.fileIndices.push(i);
      }
    }

    const series = Array.from(seriesMap.values());
    
    // Create lazy-loading function to get files for a specific series
    const loadSeriesFiles = async (seriesIndex) => {
      if (seriesIndex < 0 || seriesIndex >= series.length) {
        return [];
      }
      
      const targetSeries = series[seriesIndex];
      if (!targetSeries || !targetSeries.fileIndices) {
        return [];
      }
      
      // Load files for this series on-demand
      const files = [];
      for (const fileIndex of targetSeries.fileIndices) {
        if (fileIndex >= 0 && fileIndex < dicomFileEntries.length) {
          const entry = dicomFileEntries[fileIndex];
          if (entry && entry.zipEntry) {
            files.push({
              source: 'zip', // Required for loadDicomFile to recognize ZIP files
              index: fileIndex,
              zipEntry: entry.zipEntry,
              relativePath: entry.relativePath,
              fileName: entry.fileName,
              dicomDirMeta: entry.dicomDirMeta || null,
              getBlob: async () => {
                if (!entry.zipEntry) throw new Error('zipEntry is null');
                return await entry.zipEntry.async('blob');
              }
            });
          }
        }
      }
      
      return files;
    };

    return {
      success: true,
      zip,
      entries: dicomFileEntries,
      dicomDirStructure: dicomDirStructure || undefined,
      series,
      loadSeriesFiles, // Lazy-loading function for series
      getFileBlob: async (index) => {
        if (index < 0 || index >= dicomFileEntries.length) {
          throw new Error(`Invalid file index: ${index}`);
        }
        const entry = dicomFileEntries[index];
        if (!entry || !entry.zipEntry) {
          throw new Error(`Entry at index ${index} is null or invalid`);
        }
        try {
          return await entry.zipEntry.async('blob');
        } catch (error) {
          console.error(`[ZIP Viewer] Error extracting blob for index ${index}:`, error);
          throw new Error(`Failed to extract file: ${error.message || 'Unknown error'}`);
        }
      },
      getFileBlobByPath: async (path) => {
        const normPath = (path || '').toLowerCase().replace(/\\/g, '/');
        const entry = dicomFileEntries.find(e => {
          if (!e || !e.relativePath) return false;
          const r = e.relativePath.toLowerCase().replace(/\\/g, '/');
          return r === normPath || r.endsWith('/' + normPath) || (normPath.length > 0 && r.endsWith(normPath));
        });
        if (!entry || !entry.zipEntry) {
          throw new Error(`File not found in ZIP: ${path}`);
        }
        try {
          return await entry.zipEntry.async('blob');
        } catch (error) {
          console.error(`[ZIP Viewer] Error extracting blob for path ${path}:`, error);
          throw new Error(`Failed to extract file: ${error.message || 'Unknown error'}`);
        }
      }
    };
  } catch (error) {
    console.error('[ZIP Viewer] Error preparing ZIP for viewing:', error);
    return {
      success: false,
      error: error.message || 'Failed to prepare ZIP for viewing',
      zip: null,
      entries: [],
      series: []
    };
  }
}
