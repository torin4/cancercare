/**
 * ZIP Service
 *
 * Handles extraction of files from ZIP archives, specifically for DICOM files.
 * When DICOMDIR is present, parses it and organizes files by study/series.
 */

import JSZip from 'jszip';
import { parseDicomDir, flattenDicomDirStructure } from './dicomDirParser';

/**
 * Check if a file is a ZIP archive
 * @param {File} file - File to check
 * @returns {boolean} - True if file is a ZIP
 */
export function isZipFile(file) {
  if (!file) {
    console.warn('isZipFile: No file provided');
    return false;
  }
  
  const fileName = file.name || '';
  const lowerName = fileName.toLowerCase();
  const mimeType = file.type || '';
  
  // Removed verbose logging to reduce memory overhead
  
  // Check extension first (most reliable) - this catches "Archive.zip", "CT_SCAN2024.zip", etc.
  if (lowerName.endsWith('.zip')) {
    return true;
  }
  
  // Check MIME type (may not always be set by browser)
  if (mimeType === 'application/zip' || 
      mimeType === 'application/x-zip-compressed') {
    return true;
  }
  
  // If MIME type is octet-stream but filename ends with .zip, it's likely a ZIP
  if (mimeType === 'application/octet-stream' && lowerName.endsWith('.zip')) {
    return true;
  }
  
  // Also check if MIME type is empty but filename suggests ZIP
  if (!mimeType && lowerName.endsWith('.zip')) {
    return true;
  }
  
  return false;
}

/**
 * Extract DICOM files from a ZIP archive
 * For large ZIPs (400MB+), this will identify files but extract them on-demand
 * @param {File|ArrayBuffer} zipFileOrBuffer - ZIP file or ArrayBuffer
 * @param {Function} onProgress - Optional progress callback (current, total, fileName)
 * @returns {Promise<Object>} - Object with file list and extraction function
 */
export async function extractDicomFilesFromZip(zipFileOrBuffer, onProgress = null) {
  try {
    let arrayBuffer;
    let fileName = 'archive.zip';
    let fileSizeMB = 0;
    
    // Handle both File and ArrayBuffer inputs
    if (zipFileOrBuffer instanceof ArrayBuffer) {
      // Already an ArrayBuffer - use it directly
      arrayBuffer = zipFileOrBuffer;
      fileSizeMB = arrayBuffer.byteLength / (1024 * 1024);
      fileName = 'archive.zip';
      console.log(`[ZIP Service] Using provided ArrayBuffer (${fileSizeMB.toFixed(1)}MB)`);
    } else if (zipFileOrBuffer instanceof File) {
      // It's a File object - read it
      fileName = zipFileOrBuffer.name || 'archive.zip';
      fileSizeMB = zipFileOrBuffer.size / (1024 * 1024);
      
      // Only log for large files
      if (fileSizeMB > 100) {
        console.log(`[ZIP Service] Processing ZIP: ${fileName} (${fileSizeMB.toFixed(1)}MB)`);
      }
      
      // Warn for very large files
      if (fileSizeMB > 300) {
        console.warn(`[ZIP Service] Large ZIP (${fileSizeMB.toFixed(1)}MB) - may use significant memory`);
      }
      
      // Read ZIP file as ArrayBuffer
      // Note: JSZip requires loading entire ZIP into memory - this is a limitation
      if (onProgress) {
        onProgress(0, 0, 'Reading ZIP file...');
      }
      
      try {
        arrayBuffer = await zipFileOrBuffer.arrayBuffer();
      } catch (readError) {
        console.error('[ZIP Service] Error reading ZIP file:', readError);
        throw new Error(`Failed to read ZIP file: ${readError.message || 'File may be too large or corrupted'}`);
      }
    } else {
      throw new Error('Invalid input: expected File or ArrayBuffer');
    }
    
    if (onProgress) {
      onProgress(0, 0, 'Parsing ZIP structure...');
    }
    
    // Load ZIP with error handling
    let zip;
    try {
      // JSZip.loadAsync can fail with complex/large ZIPs
      zip = await JSZip.loadAsync(arrayBuffer, {
        // Options to help with large files
        checkCRC32: false, // Skip CRC check for faster loading (less safe but works for large files)
        createFolders: true
      });
    } catch (loadError) {
      console.error('[ZIP Service] Error loading ZIP file:', loadError);
      console.error('[ZIP Service] Error details:', {
        name: loadError.name,
        message: loadError.message,
        stack: loadError.stack
      });
      
      // Provide helpful error message
      if (fileSizeMB > 300) {
        throw new Error(`ZIP file is too large (${fileSizeMB.toFixed(1)}MB) or complex for browser processing. JSZip encountered an error: ${loadError.message || 'Unknown error'}. Consider uploading individual DICOM files or using a smaller ZIP archive.`);
      } else {
        throw new Error(`Failed to load ZIP file: ${loadError.message || 'ZIP file may be corrupted or in an unsupported format'}`);
      }
    }
    
    // First pass: Identify all DICOM files (without extracting them yet)
    const dicomFileEntries = []; // Array of {relativePath, zipEntry, fileName}
    let dicomDirZipEntry = null; // DICOMDIR entry, used only for parsing (not uploaded)

    if (onProgress) {
      onProgress(0, Object.keys(zip.files).length, 'Scanning for DICOM files...');
    }

    let scannedCount = 0;
    const totalEntries = Object.keys(zip.files).length;

    // For large ZIPs, use a faster heuristic-based approach
    // For smaller ZIPs, we can check headers
    const useFastHeuristic = fileSizeMB > 300;

    // Iterate through all files in the ZIP
    for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
      scannedCount++;

      // Skip directories
      if (zipEntry.dir) {
        if (onProgress && scannedCount % 500 === 0) {
          onProgress(scannedCount, totalEntries, `Scanning... (${scannedCount}/${totalEntries}, found ${dicomFileEntries.length} DICOM files)`);
        }
        continue;
      }

      // Check if file is a DICOM file by extension or by checking header
      const lowerPath = relativePath.toLowerCase();
      const hasDicomExtension = lowerPath.endsWith('.dcm') || lowerPath.endsWith('.dicom');

      // Check for DICOMDIR (special DICOM index – we parse it but do not add to upload list)
      const isDicomDir = lowerPath === 'dicomdir' || lowerPath.endsWith('/dicomdir');
      if (isDicomDir) {
        dicomDirZipEntry = { relativePath, zipEntry };
        if (onProgress && scannedCount % 500 === 0) {
          onProgress(scannedCount, totalEntries, `Scanning... (${scannedCount}/${totalEntries}, found ${dicomFileEntries.length} DICOM files)`);
        }
        continue;
      }

      let isDicom = hasDicomExtension;
      if (!hasDicomExtension && !relativePath.includes('.')) {
        // File has no extension - use heuristic for large ZIPs, check header for small ZIPs
        if (useFastHeuristic) {
          // For very large ZIPs, assume files without extensions in DICOM-related folders are DICOM files
          // This is much faster and avoids memory issues
          const pathParts = lowerPath.split('/');
          const inDicomFolder = pathParts.some(part => 
            part.includes('dcm') || 
            part.includes('dicom') || 
            part.includes('dcmdt') ||
            part === 'ihe_pdi' ||
            part === 'pdsv'
          );
          isDicom = inDicomFolder;
        } else {
          // For smaller ZIPs, check the header (but limit to reasonable file sizes)
          if (zipEntry._data && zipEntry._data.uncompressedSize < 50 * 1024 * 1024) { // Only check files < 50MB
            try {
              // Read the file to check for DICM signature
              // Note: We read the whole file, but only check the first 132 bytes
              const buffer = await zipEntry.async('uint8array');
              if (buffer && buffer.length >= 132) {
                const dicomSignature = String.fromCharCode(
                  buffer[128],
                  buffer[129],
                  buffer[130],
                  buffer[131]
                );
                isDicom = dicomSignature === 'DICM';
              }
            } catch (error) {
              // If we can't read header, skip this file (not DICOM)
              isDicom = false;
            }
          }
        }
      }
      
      if (isDicom) {
        // Extract filename from path (handle nested paths)
        let fileName = relativePath.split('/').pop() || relativePath;
        
        // Ensure DICOM files have an extension for Firebase Storage rules
        // Files without extensions may be rejected by storage rules
        if (!fileName.includes('.')) {
          // Add .dcm extension if file has no extension
          fileName = `${fileName}.dcm`;
        }
        
        dicomFileEntries.push({
          relativePath,
          zipEntry,
          fileName
        });
      }
      
      // Update progress periodically (less frequently for large ZIPs)
      const progressInterval = useFastHeuristic ? 500 : 100;
      if (onProgress && scannedCount % progressInterval === 0) {
        onProgress(scannedCount, totalEntries, `Found ${dicomFileEntries.length} DICOM files... (${scannedCount}/${totalEntries})`);
      }
    }
    
    // Only log if significant number of files
    if (dicomFileEntries.length > 0) {
      console.log(`[ZIP Service] Found ${dicomFileEntries.length} DICOM file${dicomFileEntries.length !== 1 ? 's' : ''}`);
    }

    /** @type {{ patients: Array }|null} */
    let dicomDirStructure = null;

    if (dicomDirZipEntry && dicomFileEntries.length > 0) {
      if (onProgress) onProgress(0, 0, 'Parsing DICOMDIR...');
      try {
        const blob = await dicomDirZipEntry.zipEntry.async('blob');
        const ab = await blob.arrayBuffer();
        const parseResult = await parseDicomDir(ab);
        if (parseResult.success && parseResult.structure) {
          dicomDirStructure = parseResult.structure;
          const flat = flattenDicomDirStructure(parseResult.structure);
          const pathToMeta = new Map();
          for (const e of flat) {
            const k = e.filePathLower;
            if (!pathToMeta.has(k)) pathToMeta.set(k, e);
          }
          const norm = (p) => (p || '').toLowerCase().replace(/\\/g, '/');
          for (const entry of dicomFileEntries) {
            const r = norm(entry.relativePath);
            let meta = pathToMeta.get(r);
            if (!meta) {
              for (const [k, v] of pathToMeta) {
                if (r === k || r.endsWith('/' + k) || (k.length > 0 && r.endsWith(k))) {
                  meta = v;
                  break;
                }
              }
            }
            if (meta) {
              const inst = parseInt(meta.image.instanceNumber, 10);
              const sl = parseFloat(meta.image.sliceLocation);
              const sortKey = [
                meta.study.studyInstanceUID || '',
                meta.study.studyDate || '',
                meta.series.seriesInstanceUID || '',
                String(meta.series.seriesNumber || '').padStart(8, '0'),
                Number.isNaN(inst) ? 0 : inst,
                Number.isNaN(sl) ? 0 : sl,
              ].join('\0');
              entry.dicomDirMeta = { study: meta.study, series: meta.series, image: meta.image };
              entry.dicomDirSortKey = sortKey;
            } else {
              entry.dicomDirSortKey = '\uffff'; // unmatched last
            }
          }
          dicomFileEntries.sort((a, b) => (a.dicomDirSortKey || '').localeCompare(b.dicomDirSortKey || ''));
          // Only log if significant number of matches
          const matchedCount = dicomFileEntries.filter((e) => e.dicomDirMeta).length;
          if (matchedCount > 10) {
            console.log(`[ZIP Service] DICOMDIR parsed: ${matchedCount}/${flat.length} files matched`);
          }
        } else {
          console.warn('[ZIP Service] DICOMDIR parse failed, using fallback order:', parseResult.error);
        }
      } catch (e) {
        console.warn('[ZIP Service] DICOMDIR parse error, using fallback order:', e);
      }
    }

    // For large ZIPs, extract files on-demand to save memory
    // For smaller ZIPs, extract all at once for better performance
    const shouldExtractOnDemand = fileSizeMB > 200 || dicomFileEntries.length > 500;
    
    if (shouldExtractOnDemand) {
      // Removed verbose log to reduce memory overhead
      
      // Return a function that extracts files on-demand
      return {
        success: true,
        files: [],
        count: dicomFileEntries.length,
        extractOnDemand: true,
        entries: dicomFileEntries,
        dicomDirStructure: dicomDirStructure || undefined,
        extractFile: async (index) => {
          if (index < 0 || index >= dicomFileEntries.length) {
            throw new Error(`Invalid file index: ${index}`);
          }
          
          const entry = dicomFileEntries[index];
          try {
            // Extract file content as blob
            const blob = await entry.zipEntry.async('blob');
            
            const file = new File([blob], entry.fileName, {
              type: 'application/dicom',
              lastModified: entry.zipEntry.date ? entry.zipEntry.date.getTime() : Date.now()
            });
            
            return file;
          } catch (error) {
            console.error(`Failed to extract DICOM file ${entry.relativePath}:`, error);
            throw error;
          }
        }
      };
    } else {
      // Extract all files at once (for smaller ZIPs)
      if (onProgress) {
        onProgress(0, dicomFileEntries.length, 'Extracting DICOM files...');
      }
      
      const dicomFiles = [];
      
      for (let i = 0; i < dicomFileEntries.length; i++) {
        const entry = dicomFileEntries[i];
        
        try {
          // Extract file content as blob
          const blob = await entry.zipEntry.async('blob');
          
          const file = new File([blob], entry.fileName, {
            type: 'application/dicom',
            lastModified: entry.zipEntry.date ? entry.zipEntry.date.getTime() : Date.now()
          });
          
          dicomFiles.push(file);
          
          if (onProgress && (i + 1) % 10 === 0) {
            onProgress(i + 1, dicomFileEntries.length, `Extracted ${i + 1}/${dicomFileEntries.length} files...`);
          }
        } catch (error) {
          console.warn(`Failed to extract DICOM file ${entry.relativePath}:`, error);
          // Continue with other files
        }
      }
      
      return {
        success: true,
        files: dicomFiles,
        count: dicomFiles.length,
        extractOnDemand: false,
        entries: dicomFileEntries,
        dicomDirStructure: dicomDirStructure || undefined,
      };
    }
  } catch (error) {
    console.error('Error extracting DICOM files from ZIP:', error);
    
    // Provide helpful error messages for memory issues
    if (error.message && (error.message.includes('memory') || error.message.includes('allocation'))) {
      return {
        success: false,
        error: `ZIP file is too large to process in the browser (${(zipFile.size / 1024 / 1024).toFixed(1)}MB). Please try uploading individual DICOM files or a smaller ZIP archive.`,
        files: [],
        count: 0
      };
    }
    
    return {
      success: false,
      error: error.message || 'Failed to extract DICOM files from ZIP',
      files: [],
      count: 0
    };
  }
}

/**
 * Extract all files from a ZIP archive (for general use)
 * @param {File} zipFile - ZIP file
 * @returns {Promise<Array<File>>} - Array of extracted files
 */
export async function extractAllFilesFromZip(zipFile) {
  try {
    // Read ZIP file as ArrayBuffer
    const arrayBuffer = await zipFile.arrayBuffer();
    
    // Load ZIP
    const zip = await JSZip.loadAsync(arrayBuffer);
    
    // Extract all files
    const extractedFiles = [];
    
    // Iterate through all files in the ZIP
    for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
      // Skip directories
      if (zipEntry.dir) {
        continue;
      }
      
      try {
        // Extract file content as blob
        const blob = await zipEntry.async('blob');
        
        // Determine MIME type from extension
        const lowerPath = relativePath.toLowerCase();
        let mimeType = 'application/octet-stream';
        if (lowerPath.endsWith('.pdf')) mimeType = 'application/pdf';
        else if (lowerPath.endsWith('.jpg') || lowerPath.endsWith('.jpeg')) mimeType = 'image/jpeg';
        else if (lowerPath.endsWith('.png')) mimeType = 'image/png';
        else if (lowerPath.endsWith('.dcm') || lowerPath.endsWith('.dicom')) mimeType = 'application/dicom';
        else if (lowerPath.endsWith('.txt')) mimeType = 'text/plain';
        else if (lowerPath.endsWith('.csv')) mimeType = 'text/csv';
        
        // Create a File object from the blob
        const fileName = relativePath.split('/').pop() || relativePath;
        const file = new File([blob], fileName, {
          type: mimeType,
          lastModified: zipEntry.date ? zipEntry.date.getTime() : Date.now()
        });
        
        extractedFiles.push(file);
      } catch (error) {
        console.warn(`Failed to extract file ${relativePath}:`, error);
        // Continue with other files
      }
    }
    
    return {
      success: true,
      files: extractedFiles,
      count: extractedFiles.length
    };
  } catch (error) {
    console.error('Error extracting files from ZIP:', error);
    return {
      success: false,
      error: error.message || 'Failed to extract files from ZIP',
      files: [],
      count: 0
    };
  }
}
