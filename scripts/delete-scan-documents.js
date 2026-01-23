/**
 * Script to delete all documents with category "Scan" from Firestore
 * 
 * This script will:
 * 1. Query all documents with category === "Scan"
 * 2. Delete each document from Firestore
 * 3. Delete associated files from Firebase Storage
 * 4. Clean up associated health data (labs, vitals, medications)
 * 
 * Usage:
 *   node scripts/delete-scan-documents.js [userId]
 * 
 * If userId is not provided, it will delete Scan documents for the currently authenticated user
 */

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import { deleteDocument } from '../src/firebase/storage.js';
import { cleanupDocumentData } from '../src/services/documentCleanupService.js';

// Load environment variables
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

async function deleteAllScanDocuments(userId = null) {
  try {
    console.log('🚀 Starting deletion of all Scan documents...\n');

    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);

    // If userId provided, we need to authenticate as that user (or use service account)
    // For now, we'll require authentication
    if (!auth.currentUser) {
      console.log('⚠️  No authenticated user. Please sign in first.');
      console.log('   You can authenticate by running this script from the app context,');
      console.log('   or modify this script to use a service account.\n');
      
      // Try to get userId from command line args
      const userIdArg = process.argv[2];
      if (userIdArg) {
        console.log(`📋 Will query documents for userId: ${userIdArg}\n`);
        userId = userIdArg;
      } else {
        throw new Error('No authenticated user and no userId provided. Please provide userId as argument or authenticate first.');
      }
    }

    // Query all documents with category "Scan"
    console.log('📊 Querying documents with category "Scan"...');
    const documentsRef = collection(db, 'documents');
    
    let q;
    if (userId) {
      q = query(
        documentsRef,
        where('category', '==', 'Scan'),
        where('patientId', '==', userId)
      );
      console.log(`   Filtering by userId: ${userId}`);
    } else {
      q = query(
        documentsRef,
        where('category', '==', 'Scan')
      );
      console.log('   ⚠️  WARNING: No userId filter - will delete ALL Scan documents for ALL users!');
    }

    const querySnapshot = await getDocs(q);
    const scanDocuments = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`\n📋 Found ${scanDocuments.length} Scan document(s) to delete\n`);

    if (scanDocuments.length === 0) {
      console.log('✅ No Scan documents found. Nothing to delete.');
      return;
    }

    // Show summary
    console.log('📄 Documents to delete:');
    scanDocuments.forEach((doc, index) => {
      console.log(`   ${index + 1}. ${doc.fileName || doc.name || doc.id} (${doc.id})`);
      if (doc.fileSize) {
        const sizeMB = (doc.fileSize / (1024 * 1024)).toFixed(2);
        console.log(`      Size: ${sizeMB} MB`);
      }
    });

    console.log('\n⚠️  WARNING: This will permanently delete:');
    console.log('   - All Firestore documents');
    console.log('   - All associated files from Firebase Storage');
    console.log('   - All associated health data (labs, vitals, medications)');
    console.log('\n⏳ Starting deletion in 3 seconds... (Press Ctrl+C to cancel)');
    
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Delete each document
    let successCount = 0;
    let failureCount = 0;
    const errors = [];

    for (let i = 0; i < scanDocuments.length; i++) {
      const doc = scanDocuments[i];
      const docNum = i + 1;
      
      try {
        console.log(`\n[${docNum}/${scanDocuments.length}] Deleting: ${doc.fileName || doc.name || doc.id}...`);
        
        // Clean up associated health data first
        const docUserId = doc.patientId || userId;
        if (docUserId) {
          console.log(`   Cleaning up associated health data...`);
          try {
            const cleanupResult = await cleanupDocumentData(doc.id, docUserId, false);
            console.log(`   ✅ Cleaned up: ${cleanupResult.labValuesDeleted} lab values, ${cleanupResult.vitalValuesDeleted} vital values, ${cleanupResult.medicationsDeleted} medications`);
          } catch (cleanupError) {
            console.warn(`   ⚠️  Health data cleanup warning: ${cleanupError.message}`);
            // Continue with deletion even if cleanup has issues
          }
        }
        
        // Delete document from Firestore and Storage
        const storagePath = doc.storagePath;
        if (storagePath) {
          console.log(`   Deleting from Firestore and Storage...`);
          await deleteDocument(doc.id, storagePath, docUserId);
        } else {
          console.log(`   Deleting from Firestore (no storage path)...`);
          // If no storage path, just delete from Firestore
          const { documentService } = await import('../src/firebase/services/documentService.js');
          await documentService.deleteDocument(doc.id);
        }
        
        successCount++;
        console.log(`   ✅ Successfully deleted document ${docNum}/${scanDocuments.length}`);
        
      } catch (error) {
        failureCount++;
        const errorMsg = `Failed to delete ${doc.fileName || doc.id}: ${error.message}`;
        errors.push(errorMsg);
        console.error(`   ❌ ${errorMsg}`);
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 DELETION SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successfully deleted: ${successCount}/${scanDocuments.length}`);
    console.log(`❌ Failed: ${failureCount}/${scanDocuments.length}`);
    
    if (errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }
    
    console.log('\n✅ Deletion process complete!');

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the script
const userId = process.argv[2] || null;
deleteAllScanDocuments(userId)
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
