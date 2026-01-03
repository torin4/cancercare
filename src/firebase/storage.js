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
    // 1. Create a reference to the file location in Storage
    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.name}`;
    const storagePath = `documents/${userId}/${fileName}`;
    const storageRef = ref(storage, storagePath);

    // 2. Upload the file to Firebase Storage
    const snapshot = await uploadBytes(storageRef, file);

    // 3. Get the download URL
    const fileUrl = await getDownloadURL(snapshot.ref);

    // 4. Save metadata to Firestore
    // Use date from metadata if provided, otherwise use today's date
    // Normalize empty strings to null
    const providedDate = (metadata.date && typeof metadata.date === 'string' && metadata.date.trim() !== '') 
      ? metadata.date.trim() 
      : (metadata.date || null);
    const documentDate = providedDate 
      ? parseLocalDate(providedDate)
      : parseLocalDate(new Date().toISOString().split('T')[0]);
    
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
      fileName: file.name,
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

    return {
      id: docId,
      ...documentData
    };
  } catch (error) {
    console.error('Error uploading document:', error);
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

export const deleteDocument = async (docId, storagePath) => {
  try {
    // 1. Delete from Firestore
    await documentService.deleteDocument(docId);

    // 2. Delete from Storage
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
  } catch (error) {
    console.error('Error deleting document:', error);
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
    console.error('Error listing files:', error);
    throw error;
  }
};

/**
 * Download a file (get its URL)
 *
 * @param {string} storagePath - The path to the file in Storage
 * @returns {Promise<string>} - Download URL
 */
export const getFileUrl = async (storagePath) => {
  try {
    const storageRef = ref(storage, storagePath);
    return await getDownloadURL(storageRef);
  } catch (error) {
    console.error('Error getting file URL:', error);
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
export const downloadFileAsBlob = async (storagePath, existingUrl = null) => {
  // Get storage reference
  const storageRef = ref(storage, storagePath);
  
  // Get download URL (use existing or get fresh one)
  let downloadUrl = existingUrl;
  if (!downloadUrl) {
    downloadUrl = await getDownloadURL(storageRef);
  }
  
  // Firebase Storage has CORS restrictions, so we need to use a proxy
  // Use server-side proxy to bypass CORS (required for browser downloads)
  // In production on Vercel, this uses the /api/storage-proxy serverless function
  // For local development, use the proxy server or set REACT_APP_PROXY_URL
  const proxyBaseUrl = process.env.REACT_APP_PROXY_URL || '';
  const proxyUrl = proxyBaseUrl 
    ? `${proxyBaseUrl}/api/storage-proxy?url=${encodeURIComponent(downloadUrl)}`
    : `/api/storage-proxy?url=${encodeURIComponent(downloadUrl)}`;
  
  console.log('Downloading file via proxy:', proxyUrl);
  
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
      console.error('Proxy response error:', response.status, errorText);
      const proxyInfo = proxyBaseUrl 
        ? `Make sure the proxy server is running on ${proxyBaseUrl}`
        : 'Make sure the proxy server is running (npm run start:proxy) or the Vercel serverless function is available';
      throw new Error(`Proxy server returned error ${response.status}: ${response.statusText}. ${proxyInfo}`);
    }
    
    return await response.blob();
  } catch (proxyError) {
    console.error('Error downloading file via proxy:', proxyError);
    
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

    console.log(`Storage directory for ${userId} cleared.`);
  } catch (error) {
    // If directory doesn't exist, that's okay - just log and continue
    if (error.code === 'storage/object-not-found' || error.code === 'storage/unauthorized') {
      console.log(`Storage directory for ${userId} not found or already deleted.`);
      return;
    }
    console.error('Error deleting user directory:', error);
    throw error;
  }
};
