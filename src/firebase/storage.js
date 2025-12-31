import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  listAll
} from 'firebase/storage';
import { storage } from './config';
import { documentService } from './services';

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
    const documentData = {
      patientId: userId,
      fileName: file.name,
      fileUrl: fileUrl,
      storagePath: storagePath,
      fileSize: file.size,
      fileType: file.type,
      date: new Date(),
      ...metadata // category, notes, documentType, etc.
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
