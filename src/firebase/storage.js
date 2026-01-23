import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  listAll,
  getBytes
} from 'firebase/storage';
import { storage, auth } from './config';
import { documentService } from './services';
import { parseLocalDate, getTodayLocalDate } from '../utils/helpers';
import { 
  validateFile, 
  sanitizeFilename, 
  logDocumentAccess, 
  checkUploadRateLimit 
} from '../services/documentSecurityService';

/**
 * Upload a file to Firebase Storage and save metadata to Firestore
 *
 * @param {File} file - The file to upload
 * @param {string} userId - The authenticated user's ID
 * @param {object} metadata - Additional metadata (category, notes, etc.)
 * @returns {Promise<object>} - Document metadata with file URL
 */
export const uploadDocument = async (file, userId, metadata = {}) => {
  try {
    // SECURITY: Verify user is authenticated and matches userId
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('You must be logged in to upload files. Please refresh the page and log in again.');
    }
    
    if (currentUser.uid !== userId) {
      console.error('Authentication mismatch:', {
        currentUserUid: currentUser.uid,
        providedUserId: userId
      });
      throw new Error('Authentication error: Your user ID does not match. Please refresh the page and try again.');
    }
    
    // SECURITY: Validate file before upload (now async to check DICOM headers)
    const fileValidation = await validateFile(file);
    if (!fileValidation.valid) {
      throw new Error(fileValidation.error || 'File validation failed');
    }
    
    // SECURITY: Check rate limiting
    // Skip rate limit for ZIP batch uploads (metadata.isZipBatch) - these are legitimate bulk operations
    // Rate limit still applies to individual file uploads to prevent abuse
    if (!metadata.isZipBatch) {
      const rateLimit = checkUploadRateLimit(userId, 50, 60 * 60 * 1000); // 50 uploads per hour
      if (!rateLimit.allowed) {
        throw new Error(rateLimit.error || 'Upload rate limit exceeded');
      }
    }
    
    // 1. Determine the date for filename (user-provided or AI-extracted, or today)
    const providedDate = (metadata.date && typeof metadata.date === 'string' && metadata.date.trim() !== '') 
      ? metadata.date.trim() 
      : (metadata.date || null);
    
    // Format date as YYYY-MM-DD for filename (use local timezone, not UTC)
    let dateStr;
    if (providedDate) {
      // If date is provided, use it directly (already in YYYY-MM-DD format)
      dateStr = providedDate;
    } else {
      // Use today's date in local timezone
      dateStr = getTodayLocalDate();
    }
    
    // Parse the date string for Firestore storage (use local date parsing)
    const documentDate = parseLocalDate(dateStr);
    
    // SECURITY: Sanitize original filename
    const originalName = sanitizeFilename(file.name || 'document');
    let fileExtension = originalName.includes('.') 
      ? originalName.substring(originalName.lastIndexOf('.'))
      : '';
    
    // For files without extensions, check if it's a DICOM file and add .dcm extension
    // This ensures Firebase Storage rules accept the file
    if (!fileExtension) {
      // Check if file type suggests DICOM
      if (file.type === 'application/dicom' || file.type === 'application/x-dicom') {
        fileExtension = '.dcm';
      } else if (metadata.dicomMetadata) {
        // If dicomMetadata is present, it's definitely a DICOM file
        fileExtension = '.dcm';
      }
    }
    
    // Generate date-based filename: YYYY-MM-DD_timestamp.extension
    // Use timestamp to avoid collisions if multiple files uploaded on same date
    const timestamp = Date.now();
    const dateBasedFileName = `${dateStr}_${timestamp}${fileExtension}`;
    
    // 2. Create a reference to the file location in Storage
    const storagePath = `documents/${userId}/${dateBasedFileName}`;
    const storageRef = ref(storage, storagePath);

    // Log upload attempt for debugging
    console.log('Uploading file to Storage:', {
      storagePath,
      userId,
      fileName: dateBasedFileName,
      fileSize: file.size,
      fileType: file.type
    });

    // 2. Upload the file to Firebase Storage with explicit content type
    // Firebase Storage rules check request.resource.contentType, so we need to set it explicitly
    let contentType = file.type || 'application/octet-stream';
    
    // Ensure DICOM files have the correct content type
    if (fileExtension === '.dcm' || fileExtension === '.dicom' || metadata.dicomMetadata) {
      contentType = 'application/dicom';
    }
    
    // Set metadata for the upload
    const uploadMetadata = {
      contentType: contentType,
      customMetadata: {
        originalFileName: originalName,
        uploadedBy: userId,
        uploadedAt: new Date().toISOString()
      }
    };
    
    let snapshot;
    try {
      snapshot = await uploadBytes(storageRef, file, uploadMetadata);
      console.log('File uploaded successfully to Storage:', {
        storagePath,
        contentType,
        fileSize: file.size
      });
    } catch (uploadError) {
      console.error('Upload error:', {
        storagePath,
        userId,
        currentUserUid: currentUser.uid,
        contentType,
        fileExtension,
        error: uploadError.message,
        code: uploadError.code,
        fullError: uploadError
      });
      
      // Provide more helpful error messages
      if (uploadError.code === 'storage/unauthorized') {
        throw new Error(`Permission denied: You don't have permission to upload files. Please ensure you are logged in as user ${userId}. Current user: ${currentUser.uid}`);
      } else if (uploadError.code === 'storage/quota-exceeded') {
        throw new Error('Storage quota exceeded. Please contact support or delete some files.');
      } else {
        throw new Error(`Failed to upload file to Storage: ${uploadError.message || 'Unknown error. Please check your authentication and try again.'}`);
      }
    }

    // 3. Get the download URL
    let fileUrl;
    try {
      fileUrl = await getDownloadURL(snapshot.ref);
      console.log('Download URL obtained successfully');
    } catch (urlError) {
      console.error('getDownloadURL error:', {
        storagePath,
        userId,
        error: urlError.message,
        code: urlError.code
      });
      throw new Error(`Failed to get download URL: ${urlError.message || 'Permission denied. Please ensure you are logged in and the file was uploaded correctly.'}`);
    }

    // 4. Save metadata to Firestore
    // documentDate is already calculated above for filename
    
    // Normalize note - empty strings become null, but preserve actual note values
    let normalizedNote = null;
    if (metadata.note !== undefined && metadata.note !== null) {
      if (typeof metadata.note === 'string' && metadata.note.trim() !== '') {
        normalizedNote = metadata.note.trim();
      } else if (metadata.note) {
        // If it's not a string but truthy, keep it
        normalizedNote = metadata.note;
      }
    }
    
    // Build document data - put date and note AFTER metadata spread to ensure they're not overwritten
    const documentData = {
      patientId: userId,
      fileName: dateBasedFileName, // Use date-based filename
      name: originalName, // Preserve original filename for reference
      fileUrl: fileUrl,
      storagePath: storagePath,
      fileSize: file.size,
      fileType: file.type,
      ...metadata, // category, documentType, dataPointCount, etc. (but NOT date/note)
      // Explicitly set date and note AFTER spread to ensure they're not overwritten
      date: documentDate,
      note: normalizedNote
    };

    const docId = await documentService.saveDocument(documentData);

    // SECURITY: Log document upload for audit trail
    await logDocumentAccess(userId, docId, 'upload', {
      fileName: originalName,
      fileSize: file.size,
      fileType: file.type,
      storagePath: storagePath
    });

    return {
      id: docId,
      ...documentData
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Delete a file from both Storage and Firestore
 *
 * @param {string} docId - The Firestore document ID
 * @param {string} storagePath - The path to the file in Storage
 */
/**
 * Clean up all health data associated with a specific document ID
 * This is a wrapper that calls the comprehensive cleanup service
 * @deprecated Use cleanupDocumentData from documentCleanupService directly
 */
export const cleanupDocumentData = async (docId, userId, aggressiveCleanup = false) => {
  // Delegate to the comprehensive cleanup service
  const { cleanupDocumentData: comprehensiveCleanup } = await import('../services/documentCleanupService');
  return await comprehensiveCleanup(docId, userId, aggressiveCleanup);
};

export const deleteDocument = async (docId, storagePath, userId = null) => {
  try {
    // SECURITY: Log document deletion for audit trail (before deletion)
    if (userId) {
      try {
        const { db } = await import('./config');
        const { doc, getDoc } = await import('firebase/firestore');
        const docSnapshot = await getDoc(doc(db, 'documents', docId));
        if (docSnapshot.exists()) {
          const docData = docSnapshot.data();
          await logDocumentAccess(userId, docId, 'delete', {
            fileName: docData.fileName || docData.name,
            fileSize: docData.fileSize,
            fileType: docData.fileType
          });
        }
      } catch (logError) {
        // Don't fail deletion if logging fails
        console.error('Failed to log document deletion:', logError);
      }
    }
    
    // 1. Delete from Firestore
    await documentService.deleteDocument(docId);

    // 2. Delete from Storage (if it exists)
    // If the file doesn't exist in Storage, that's okay - treat as success
    try {
      const storageRef = ref(storage, storagePath);
      await deleteObject(storageRef);
    } catch (storageError) {
      // If file doesn't exist in Storage, that's fine - it's already deleted
      // This can happen if the file was never uploaded or was already deleted
      if (storageError.code === 'storage/object-not-found') {
        // File doesn't exist - this is fine, continue silently
        console.warn(`File not found in Storage (already deleted?): ${storagePath}`);
        return; // Success - file is already gone
      }
      // For other errors (permission, network, etc.), rethrow
      throw storageError;
    }
  } catch (error) {
    throw error;
  }
};

/**
 * Get all files for a user from Storage
 *
 * @param {string} userId - The user's ID
 * @returns {Promise<Array>} - List of file references
 */
export const listUserFiles = async (userId) => {
  try {
    const listRef = ref(storage, `documents/${userId}`);
    const result = await listAll(listRef);
    return result.items;
  } catch (error) {
    throw error;
  }
};

/**
 * Download a file (get its URL)
 * Note: Firebase Storage URLs are already secure and require authentication through storage rules
 * The URL itself is a signed token that validates access
 *
 * @param {string} storagePath - The path to the file in Storage
 * @param {string} userId - User ID for audit logging (optional)
 * @param {string} documentId - Document ID for audit logging (optional)
 * @returns {Promise<string>} - Download URL (signed and secure)
 */
export const getFileUrl = async (storagePath, userId = null, documentId = null) => {
  try {
    // SECURITY: Verify user is authenticated
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('You must be logged in to access files. Please refresh the page and log in again.');
    }
    
    // Verify userId matches if provided
    if (userId && currentUser.uid !== userId) {
      console.error('Authentication mismatch in getFileUrl:', {
        currentUserUid: currentUser.uid,
        providedUserId: userId,
        storagePath
      });
      throw new Error('Authentication error: Your user ID does not match the file owner. Please refresh the page and try again.');
    }
    
    const storageRef = ref(storage, storagePath);
    
    // Log for debugging permission issues
    console.log('getFileUrl called:', {
      storagePath,
      userId,
      currentUserUid: currentUser.uid,
      documentId,
      pathMatches: storagePath.startsWith('documents/')
    });
    
    const downloadUrl = await getDownloadURL(storageRef);
    
    // SECURITY: Log document access for audit trail
    if (userId && documentId) {
      try {
        await logDocumentAccess(userId, documentId, 'view', {
          storagePath: storagePath
        });
      } catch (logError) {
        // Don't fail if logging fails
        console.warn('Failed to log document access:', logError);
      }
    }
    
    return downloadUrl;
  } catch (error) {
    console.error('getFileUrl error:', {
      storagePath,
      userId,
      error: error.message,
      code: error.code
    });
    throw error;
  }
};

/**
 * Download a file as a Blob (avoids CORS issues)
 * Uses server-side proxy to bypass CORS restrictions
 * Note: Firebase Storage has CORS restrictions in browsers, so proxy is required
 *
 * @param {string} storagePath - The path to the file in Storage
 * @param {string} existingUrl - Optional existing download URL to use if available
 * @returns {Promise<Blob>} - File as Blob
 */
export const downloadFileAsBlob = async (storagePath, existingUrl = null, userId = null, documentId = null, useDirectDownload = false) => {
  // SECURITY: Verify user is authenticated
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('You must be logged in to download files. Please refresh the page and log in again.');
  }
  
  // Verify userId matches if provided
  if (userId && currentUser.uid !== userId) {
    console.error('Authentication mismatch in downloadFileAsBlob:', {
      currentUserUid: currentUser.uid,
      providedUserId: userId,
      storagePath
    });
    throw new Error('Authentication error: Your user ID does not match the file owner. Please refresh the page and try again.');
  }
  
  // Get storage reference
  const storageRef = ref(storage, storagePath);

  // Log for debugging permission issues
  console.log('downloadFileAsBlob called:', {
    storagePath,
    userId,
    currentUserUid: currentUser.uid,
    documentId,
    hasExistingUrl: !!existingUrl,
    pathMatches: storagePath.startsWith('documents/')
  });

  // SECURITY: Log document download for audit trail
  if (userId && documentId) {
    try {
      await logDocumentAccess(userId, documentId, 'download', {
        storagePath: storagePath
      });
    } catch (logError) {
      // Don't fail if logging fails
      console.warn('Failed to log document access:', logError);
    }
  }

  // Firebase Storage has CORS restrictions when using fetch/XMLHttpRequest
  // Firebase SDK's getBytes() uses XMLHttpRequest internally, which hits CORS in browsers
  // For DICOM files, we skip getBytes() and go straight to proxy to avoid CORS issues
  // Note: getBytes() only works without CORS in Node.js environments, not browsers
  let getBytesFailed = false;
  let getBytesError = null;
  
  // Check if this is a DICOM file - if so, skip getBytes() and use proxy directly
  const isDicomFile = storagePath && (storagePath.toLowerCase().endsWith('.dcm') || storagePath.toLowerCase().endsWith('.dicom'));
  
  if (useDirectDownload && !isDicomFile) {
    // For non-DICOM files, try getBytes() first (might work in some cases)
    try {
      console.log('Attempting Firebase SDK getBytes (uses Firebase auth)...', {
        storagePath,
        userId,
        currentUserUid: currentUser.uid
      });
      
      const bytes = await getBytes(storageRef);
      console.log('Successfully downloaded file using Firebase SDK getBytes, size:', bytes.length);
      return new Blob([bytes]);
    } catch (sdkError) {
      console.warn('Firebase SDK getBytes failed, will try proxy as fallback:', {
        storagePath,
        userId,
        currentUserUid: currentUser.uid,
        error: sdkError.message,
        code: sdkError.code
      });
      
      getBytesFailed = true;
      getBytesError = sdkError;
      
      // Only throw immediately for auth/not-found errors - these won't be fixed by proxy
      if (sdkError.code === 'storage/unauthorized') {
        throw new Error(`Permission denied: You don't have permission to access this file. Please ensure you are logged in as user ${userId}. Current user: ${currentUser.uid}`);
      } else if (sdkError.code === 'storage/object-not-found') {
        throw new Error(`File not found: The file at ${storagePath} does not exist or has been deleted.`);
      }
      // For retry/timeout/CORS errors, fall through to proxy method below
    }
  } else if (useDirectDownload && isDicomFile) {
    // For DICOM files, skip getBytes() entirely (will always hit CORS) and go straight to proxy
    console.log('DICOM file detected - skipping getBytes() (CORS issue) and using proxy directly');
    getBytesFailed = true;
    getBytesError = new Error('DICOM files require proxy due to CORS restrictions');
  }

  // Try proxy (for production, or as fallback when getBytes() fails)
  // Get download URL (use existing or get fresh one) - needed for proxy
  let downloadUrl = existingUrl;
  if (!downloadUrl) {
    try {
      downloadUrl = await getDownloadURL(storageRef);
    } catch (urlError) {
      console.error('getDownloadURL error:', {
        storagePath,
        userId,
        error: urlError.message,
        code: urlError.code
      });
      throw urlError;
    }
  }

  const isProduction = process.env.NODE_ENV === 'production' || window.location.hostname !== 'localhost';
  const proxyBaseUrl = process.env.REACT_APP_PROXY_URL || '';
  const proxyUrl = proxyBaseUrl
    ? `${proxyBaseUrl}/api/storage-proxy?url=${encodeURIComponent(downloadUrl)}`
    : `/api/storage-proxy?url=${encodeURIComponent(downloadUrl)}`;

  try {
    // Increase timeout for large files (240 seconds / 4 minutes for very large PDFs)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 240000);

    const response = await fetch(proxyUrl, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      const proxyInfo = isProduction
        ? 'The Vercel serverless function may not be deployed. Check your Vercel deployment.'
        : 'For local development: The proxy server needs to be running. Run "npm run start:proxy" in a separate terminal, or use "npm run start:all" to start both the proxy and React app.';
      throw new Error(`Proxy server returned error ${response.status}: ${response.statusText}. ${proxyInfo}`);
    }

    return await response.blob();
  } catch (proxyError) {
    // If this is a DICOM file, don't try getBytes() as fallback (will always fail with CORS)
    if (isDicomFile) {
      const proxyInfo = isProduction
        ? 'The Vercel serverless function (/api/storage-proxy) may not be deployed or is not responding. Check your Vercel deployment.'
        : 'Cannot connect to proxy server. DICOM files require the proxy server to download. For local development: Run "npm run start:proxy" in a separate terminal to start the proxy server on port 4000, or use "npm run start:all" to start both the proxy and React app together.';

      if (proxyError.message.includes('Failed to fetch') || proxyError.message.includes('NetworkError') || proxyError.message.includes('ECONNREFUSED')) {
        throw new Error(`Failed to download DICOM file: Proxy server is not running. ${proxyInfo}`);
      }

      throw new Error(`Failed to download DICOM file via proxy: ${proxyError.message}. ${proxyInfo}`);
    }
    
    // If proxy fails and we already tried getBytes(), both methods failed
    if (getBytesFailed) {
      const proxyInfo = isProduction
        ? 'The Vercel serverless function (/api/storage-proxy) may not be deployed or is not responding. Check your Vercel deployment.'
        : 'Cannot connect to proxy server. For local development: Run "npm run start:proxy" in a separate terminal to start the proxy server on port 4000, or use "npm run start:all" to start both the proxy and React app together.';

      if (proxyError.name === 'AbortError' || proxyError.message.includes('timeout') || proxyError.message.includes('504')) {
        throw new Error(`Download failed: Both getBytes() and proxy methods failed. Proxy request timed out after 240 seconds. ${proxyInfo} Original getBytes() error: ${getBytesError?.message || 'Unknown'}`);
      }

      if (proxyError.message.includes('Failed to fetch') || proxyError.message.includes('NetworkError') || proxyError.message.includes('ECONNREFUSED')) {
        throw new Error(`Failed to download file: Both getBytes() (${getBytesError?.message || 'retry limit exceeded'}) and proxy (${proxyError.message}) failed. ${proxyInfo}`);
      }

      throw new Error(`Failed to download file: Both methods failed. getBytes() error: ${getBytesError?.message || 'Unknown'}. Proxy error: ${proxyError.message}. ${proxyInfo}`);
    }
    
    // If proxy fails and we haven't tried getBytes() yet (useDirectDownload was false), try it as fallback
    // But only for non-DICOM files (DICOM files will always fail with CORS)
    if (!isDicomFile) {
      try {
        console.log('Proxy failed, attempting Firebase SDK getBytes as fallback...');
        const bytes = await getBytes(storageRef);
        return new Blob([bytes]);
      } catch (sdkError) {
        // Both methods failed
        const proxyInfo = isProduction
          ? 'The Vercel serverless function (/api/storage-proxy) may not be deployed or is not responding. Check your Vercel deployment.'
          : 'Cannot connect to proxy server. For local development: Run "npm run start:proxy" in a separate terminal to start the proxy server on port 4000, or use "npm run start:all" to start both the proxy and React app together.';

        if (proxyError.name === 'AbortError' || proxyError.message.includes('timeout') || proxyError.message.includes('504')) {
          throw new Error(`Download failed: Proxy request timed out after 240 seconds. The file may be too large or the proxy server is slow. ${proxyInfo}`);
        }

        if (proxyError.message.includes('Failed to fetch') || proxyError.message.includes('NetworkError') || proxyError.message.includes('ECONNREFUSED')) {
          throw new Error(`Failed to download file. ${proxyInfo} SDK fallback also failed: ${sdkError.message}`);
        }

        throw new Error(`Failed to download file via proxy: ${proxyError.message}. SDK fallback also failed: ${sdkError.message}`);
      }
    } else {
      // DICOM file and proxy failed - don't try getBytes() (will fail with CORS)
      const proxyInfo = isProduction
        ? 'The Vercel serverless function (/api/storage-proxy) may not be deployed or is not responding. Check your Vercel deployment.'
        : 'Cannot connect to proxy server. DICOM files require the proxy server to download. For local development: Run "npm run start:proxy" in a separate terminal to start the proxy server on port 4000, or use "npm run start:all" to start both the proxy and React app together.';
      
      throw new Error(`Failed to download DICOM file via proxy: ${proxyError.message}. ${proxyInfo}`);
    }
  }
};
/**
 * Delete all files in a user's directory in Storage
 * 
 * @param {string} userId - The user's ID
 */
export const deleteUserDirectory = async (userId) => {
  try {
    const listRef = ref(storage, `documents/${userId}`);
    const result = await listAll(listRef);

    const deletePromises = result.items.map(fileRef => deleteObject(fileRef));
    await Promise.all(deletePromises);

    // Also check for subdirectories if any exist in the future
    const folderPromises = result.prefixes.map(folderRef => {
      // Recursively delete subfolders if needed, or just list and delete
      // For now, our structure is flat: documents/{userId}/{fileName}
      return Promise.resolve();
    });
    await Promise.all(folderPromises);

  } catch (error) {
    // If directory doesn't exist, that's okay - just log and continue
    if (error.code === 'storage/object-not-found' || error.code === 'storage/unauthorized') {
      return;
    }
    throw error;
  }
};
