import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  listAll,
  getBytes
} from 'firebase/storage';
import { storage } from './config';
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
    // SECURITY: Validate file before upload
    const fileValidation = validateFile(file);
    if (!fileValidation.valid) {
      throw new Error(fileValidation.error || 'File validation failed');
    }
    
    // SECURITY: Check rate limiting
    const rateLimit = checkUploadRateLimit(userId, 50, 60 * 60 * 1000); // 50 uploads per hour
    if (!rateLimit.allowed) {
      throw new Error(rateLimit.error || 'Upload rate limit exceeded');
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
    const fileExtension = originalName.includes('.') 
      ? originalName.substring(originalName.lastIndexOf('.'))
      : '';
    
    // Generate date-based filename: YYYY-MM-DD_timestamp.extension
    // Use timestamp to avoid collisions if multiple files uploaded on same date
    const timestamp = Date.now();
    const dateBasedFileName = `${dateStr}_${timestamp}${fileExtension}`;
    
    // 2. Create a reference to the file location in Storage
    const storagePath = `documents/${userId}/${dateBasedFileName}`;
    const storageRef = ref(storage, storagePath);

    // 2. Upload the file to Firebase Storage
    const snapshot = await uploadBytes(storageRef, file);

    // 3. Get the download URL
    const fileUrl = await getDownloadURL(snapshot.ref);

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

    // 2. Delete from Storage
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
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
    const storageRef = ref(storage, storagePath);
    const downloadUrl = await getDownloadURL(storageRef);
    
    // SECURITY: Log document access for audit trail
    if (userId && documentId) {
      await logDocumentAccess(userId, documentId, 'view', {
        storagePath: storagePath
      });
    }
    
    return downloadUrl;
  } catch (error) {
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
  // Get storage reference
  const storageRef = ref(storage, storagePath);

  // SECURITY: Log document download for audit trail
  if (userId && documentId) {
    await logDocumentAccess(userId, documentId, 'download', {
      storagePath: storagePath
    });
  }

  // Get download URL (use existing or get fresh one)
  // Note: Firebase Storage URLs are signed tokens that require authentication
  let downloadUrl = existingUrl;
  if (!downloadUrl) {
    downloadUrl = await getDownloadURL(storageRef);
  }

  // Firebase Storage has CORS restrictions in browsers, so we need to use a proxy
  // In production on Vercel, this uses the /api/storage-proxy serverless function
  // In development, the React dev server's setupProxy.js forwards /api/* to localhost:4000
  // But we need a server running on port 4000 OR we can use the Vercel function locally
  const isProduction = process.env.NODE_ENV === 'production' || window.location.hostname !== 'localhost';
  const proxyBaseUrl = process.env.REACT_APP_PROXY_URL || '';
  const proxyUrl = proxyBaseUrl
    ? `${proxyBaseUrl}/api/storage-proxy?url=${encodeURIComponent(downloadUrl)}`
    : `/api/storage-proxy?url=${encodeURIComponent(downloadUrl)}`;

  // Try proxy first (this is the most reliable method)
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
    // If proxy fails and direct download was requested, try it as fallback
    // Note: This will likely fail due to CORS, but we try anyway
    if (useDirectDownload) {
      try {
        console.log('Proxy failed, attempting direct Firebase SDK download as fallback...');
        const bytes = await getBytes(storageRef);
        return new Blob([bytes]);
      } catch (directError) {
        // Both methods failed - provide helpful error message
        const isCorsError = directError.message?.includes('CORS') || directError.message?.includes('Access-Control-Allow-Origin');
        
        if (isCorsError) {
          const helpMessage = isProduction
            ? 'CORS error: The Vercel serverless function (/api/storage-proxy) may not be working. Check your Vercel deployment and ensure the serverless function is deployed.'
            : 'CORS error: Direct download from Firebase Storage is blocked by browser security. You need to use the proxy server. Run "npm run start:proxy" in a separate terminal, or use "npm run start:all" to start both services.';
          throw new Error(`Cannot download file due to CORS restrictions. ${helpMessage}`);
        }
        
        // If it's not a CORS error, throw the direct download error
        throw directError;
      }
    }
    
    // Proxy failed and direct download wasn't requested or also failed
    const proxyInfo = isProduction
      ? 'The Vercel serverless function (/api/storage-proxy) may not be deployed or is not responding. Check your Vercel deployment.'
      : 'Cannot connect to proxy server. For local development: Run "npm run start:proxy" in a separate terminal to start the proxy server on port 4000, or use "npm run start:all" to start both the proxy and React app together.';

    if (proxyError.name === 'AbortError' || proxyError.message.includes('timeout') || proxyError.message.includes('504')) {
      throw new Error(`Download failed: Proxy request timed out after 240 seconds. The file may be too large or the proxy server is slow. ${proxyInfo}`);
    }

    if (proxyError.message.includes('Failed to fetch') || proxyError.message.includes('NetworkError') || proxyError.message.includes('ECONNREFUSED')) {
      throw new Error(`${proxyInfo} Network error: ${proxyError.message}`);
    }

    throw new Error(`Failed to download file via proxy: ${proxyError.message}. ${proxyInfo}`);
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
