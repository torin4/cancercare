/**
 * Utility function to delete all documents with category "Scan"
 * 
 * This function will:
 * 1. Query all documents with category === "Scan" for the current user
 * 2. Delete each document from Firestore
 * 3. Delete associated files from Firebase Storage
 * 4. Clean up associated health data (labs, vitals, medications)
 * 
 * @param {string} userId - The user ID (optional, defaults to current user)
 * @param {Function} onProgress - Optional progress callback (current, total, message)
 * @returns {Promise<Object>} Results object with success/failure counts
 */

import { documentService } from '../firebase/services/documentService';
import { deleteDocument } from '../firebase/storage';
import { cleanupDocumentData } from './documentCleanupService';
import { deleteDoc, doc } from 'firebase/firestore';
import { deleteObject, ref } from 'firebase/storage';
import { db } from '../firebase/config';
import { storage } from '../firebase/config';
import { COLLECTIONS } from '../firebase/collections';

export async function deleteAllScanDocuments(userId = null, onProgress = null) {
  try {
    // Get current user if userId not provided
    if (!userId) {
      const { auth } = await import('../firebase/config');
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('User not authenticated. Please sign in and try again.');
      }
      userId = currentUser.uid;
    }

    if (onProgress) {
      onProgress(0, 0, 'Querying Scan documents...');
    }

    // Query all documents with category "Scan"
    const scanDocuments = await documentService.getDocumentsByCategory(userId, 'Scan');

    if (onProgress) {
      onProgress(0, scanDocuments.length, `Found ${scanDocuments.length} Scan document(s) to delete`);
    }

    if (scanDocuments.length === 0) {
      return {
        success: true,
        total: 0,
        deleted: 0,
        failed: 0,
        errors: []
      };
    }

    // FAST DELETE: Delete all documents in parallel (no logging, no cleanup)
    // This is much faster than using deleteDocument which does logging
    let successCount = 0;
    let failureCount = 0;
    const errors = [];

    // Delete ALL in parallel - no batching needed, Firebase can handle it
    const deletePromises = scanDocuments.map(async (docData, index) => {
      try {
        // Delete Firestore document and Storage file in parallel (no logging overhead)
        const firestoreDelete = deleteDoc(doc(db, COLLECTIONS.DOCUMENTS, docData.id));
        
        let storageDelete = Promise.resolve();
        if (docData.storagePath) {
          try {
            const storageRef = ref(storage, docData.storagePath);
            storageDelete = deleteObject(storageRef).catch(err => {
              // Ignore "not found" errors - file might already be deleted
              if (err.code !== 'storage/object-not-found') {
                throw err;
              }
            });
          } catch (err) {
            // Storage path invalid, skip
          }
        }

        // Wait for both to complete
        await Promise.all([firestoreDelete, storageDelete]);
        
        return { success: true, index: index + 1 };
      } catch (error) {
        const errorMsg = `Failed to delete ${docData.fileName || docData.id}: ${error.message}`;
        return { success: false, index: index + 1, error: errorMsg };
      }
    });

    // Wait for all deletions to complete
    if (onProgress) {
      onProgress(0, scanDocuments.length, `Deleting ${scanDocuments.length} documents in parallel...`);
    }

    const results = await Promise.all(deletePromises);

    // Count results
    results.forEach((result, index) => {
      if (result.success) {
        successCount++;
      } else {
        failureCount++;
        errors.push(result.error);
      }
      
      if (onProgress && (index + 1) % 10 === 0) {
        onProgress(index + 1, scanDocuments.length, `Deleted ${index + 1}/${scanDocuments.length}...`);
      }
    });

    if (onProgress) {
      onProgress(scanDocuments.length, scanDocuments.length, 'Deletion complete!');
    }

    const result = {
      success: true,
      total: scanDocuments.length,
      deleted: successCount,
      failed: failureCount,
      errors: errors
    };
    
    return result;
  } catch (error) {
    console.error('Error deleting Scan documents:', error);
    throw error;
  }
}
