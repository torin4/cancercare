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
import { parseLocalDate } from '../utils/helpers';
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
    const documentDate = providedDate 
      ? parseLocalDate(providedDate)
      : parseLocalDate(new Date().toISOString().split('T')[0]);
    
    // Format date as YYYY-MM-DD for filename
    const dateStr = documentDate.toISOString().split('T')[0]; // YYYY-MM-DD
    
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
export const downloadFileAsBlob = async (storagePath, existingUrl = null, userId = null, documentId = null) => {
  // Get storage reference
  const storageRef = ref(storage, storagePath);
  
  // Get download URL (use existing or get fresh one)
  // Note: Firebase Storage URLs are signed tokens that require authentication
  let downloadUrl = existingUrl;
  if (!downloadUrl) {
    downloadUrl = await getDownloadURL(storageRef);
  }
  
  // SECURITY: Log document download for audit trail
  if (userId && documentId) {
    await logDocumentAccess(userId, documentId, 'download', {
      storagePath: storagePath
    });
  }
  
  // Firebase Storage has CORS restrictions, so we need to use a proxy
  // Use server-side proxy to bypass CORS (required for browser downloads)
  // In production on Vercel, this uses the /api/storage-proxy serverless function
  // For local development, use the proxy server or set REACT_APP_PROXY_URL
  const proxyBaseUrl = process.env.REACT_APP_PROXY_URL || '';
  const proxyUrl = proxyBaseUrl 
    ? `${proxyBaseUrl}/api/storage-proxy?url=${encodeURIComponent(downloadUrl)}`
    : `/api/storage-proxy?url=${encodeURIComponent(downloadUrl)}`;
  
  
  try {
    // Add timeout to fetch request (60 seconds for large files)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    
    const response = await fetch(proxyUrl, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      const proxyInfo = proxyBaseUrl 
        ? `Make sure the proxy server is running on ${proxyBaseUrl}`
        : 'Make sure the proxy server is running (npm run start:proxy) or the Vercel serverless function is available';
      throw new Error(`Proxy server returned error ${response.status}: ${response.statusText}. ${proxyInfo}`);
    }
    
    return await response.blob();
  } catch (proxyError) {
    
    // Provide clear error message based on the type of failure
    const proxyInfo = proxyBaseUrl
      ? `Cannot connect to proxy server at ${proxyBaseUrl}. Please ensure the proxy server is running.`
      : 'Cannot connect to proxy. For localhost: run "npm run start:proxy" in a separate terminal. For production: ensure Vercel serverless functions are deployed.';
    
    if (proxyError.name === 'AbortError' || proxyError.message.includes('timeout') || proxyError.message.includes('504')) {
      throw new Error(`Proxy request timed out. The file may be too large or the proxy server is slow. ${proxyInfo}`);
    }
    
    if (proxyError.message.includes('Failed to fetch') || proxyError.message.includes('NetworkError')) {
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
