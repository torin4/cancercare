import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Upload, FolderOpen, X, Edit2, RefreshCw, Info, Plus, MoreVertical, Loader2, BookOpen, FileText, MessageSquare, Search } from 'lucide-react';
import { DesignTokens, Layouts, combineClasses } from '../../design/designTokens';
import { useAuth } from '../../contexts/AuthContext';
import { usePatientContext } from '../../contexts/PatientContext';
import { useHealthContext } from '../../contexts/HealthContext';
import { useBanner } from '../../contexts/BannerContext';
import { documentService, labService, vitalService, journalNoteService } from '../../firebase/services';
import { uploadDocument, deleteDocument, downloadFileAsBlob } from '../../firebase/storage';
import { cleanupDocumentData } from '../../services/documentCleanupService';
import { parseLocalDate, formatDateString } from '../../utils/helpers';
import { processDocument, generateExtractionSummary, generateChatSummary } from '../../services/documentProcessor';
import { getNotebookEntries } from '../../services/notebookService';
import DocumentUploadOnboarding from '../modals/DocumentUploadOnboarding';
import EditDocumentNoteModal from '../modals/EditDocumentNoteModal';
import UploadProgressOverlay from '../UploadProgressOverlay';
import DeletionConfirmationModal from '../modals/DeletionConfirmationModal';
import RescanDocumentModal from '../modals/RescanDocumentModal';
import NotebookTimeline from '../NotebookTimeline';
import AddJournalNoteModal from '../modals/AddJournalNoteModal';
import EditJournalNoteModal from '../modals/EditJournalNoteModal';
import DocumentMetadataModal from '../modals/DocumentMetadataModal';

export default function FilesTab({ onTabChange }) {
  // Use contexts for shared state
  const { user } = useAuth();
  const { patientProfile } = usePatientContext();
  const { reloadHealthData } = useHealthContext();
  const { showSuccess, showError } = useBanner();

  // Tab-specific state
  const [documents, setDocuments] = useState([]);
  const [showDocumentOnboarding, setShowDocumentOnboarding] = useState(false);
  const [documentOnboardingMethod, setDocumentOnboardingMethod] = useState('picker');
  const [hasUploadedDocument, setHasUploadedDocument] = useState(false);
  const [pendingDocumentDate, setPendingDocumentDate] = useState(null);
  const [pendingDocumentNote, setPendingDocumentNote] = useState(null);
  const [pendingOnlyExistingMetrics, setPendingOnlyExistingMetrics] = useState(false);
  const [editingDocumentNote, setEditingDocumentNote] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [aiStatus, setAiStatus] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({
    show: false,
    title: '',
    message: '',
    onConfirm: null,
    itemName: '',
    confirmText: 'Yes, Delete Permanently'
  });
  const [rescanDocument, setRescanDocument] = useState(null);
  const [showDocumentMetadata, setShowDocumentMetadata] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null); // Track which document's menu is open
  const [debugLogs, setDebugLogs] = useState([]); // Visual debug logs for mobile
  const [documentDateRanges, setDocumentDateRanges] = useState({}); // Cache date ranges for documents
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false); // Loading state for documents

  // Tab state for Documents vs Notes view
  const [activeSubTab, setActiveSubTab] = useState('notes'); // 'documents' or 'notes'

  // Track if component is mounted to prevent setState after unmount
  const isMountedRef = useRef(true);

  // Initialize mounted ref
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Notebook state
  const [notebookEntries, setNotebookEntries] = useState([]);
  const [isLoadingNotebook, setIsLoadingNotebook] = useState(false);
  const [showAddJournalNote, setShowAddJournalNote] = useState(false);
  const [addNoteDate, setAddNoteDate] = useState(null);
  const [editingJournalNote, setEditingJournalNote] = useState(null);
  
  // Search state
  const [documentSearchQuery, setDocumentSearchQuery] = useState('');
  const [notebookSearchQuery, setNotebookSearchQuery] = useState('');

  // Debug log helper function
  const addDebugLog = useCallback((message, type = 'log') => {
    setDebugLogs(prev => {
      const newLog = { message, type, timestamp: new Date().toLocaleTimeString() };
      return [...prev.slice(-9), newLog]; // Keep last 10 logs
    });
  }, []);

  // Helper function to get date range for a document
  const getDocumentDateRange = useCallback(async (documentId) => {
    if (!user || !documentId) return null;
    
    try {
      // Get all labs and vitals for the user
      const labs = await labService.getLabs(user.uid);
      const vitals = await vitalService.getVitals(user.uid);
      
      const dates = new Set();
      
      // Check all lab values
      for (const lab of labs) {
        const values = await labService.getLabValues(lab.id);
        for (const value of values) {
          if (value.documentId === documentId && value.date) {
            const dateValue = value.date?.toDate ? value.date.toDate() : (value.date instanceof Date ? value.date : new Date(value.date));
            // Use local date components to avoid timezone issues
            const localDate = new Date(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate());
            dates.add(localDate.getTime());
          }
        }
      }
      
      // Check all vital values
      for (const vital of vitals) {
        const values = await vitalService.getVitalValues(vital.id);
        for (const value of values) {
          if (value.documentId === documentId && value.date) {
            const dateValue = value.date?.toDate ? value.date.toDate() : (value.date instanceof Date ? value.date : new Date(value.date));
            // Use local date components to avoid timezone issues
            const localDate = new Date(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate());
            dates.add(localDate.getTime());
          }
        }
      }
      
      if (dates.size === 0) return null;
      if (dates.size === 1) return null; // Single date, no range needed
      
      // Calculate min and max dates
      const dateArray = Array.from(dates).sort((a, b) => a - b);
      const minDate = new Date(dateArray[0]);
      const maxDate = new Date(dateArray[dateArray.length - 1]);
      
      return { minDate, maxDate };
    } catch (error) {
      return null;
    }
  }, [user]);

  // Helper function to refresh date ranges for all documents
  const refreshDocumentDateRanges = useCallback(async (docs) => {
    if (!user || !docs || docs.length === 0) {
      setDocumentDateRanges({});
      return;
    }
    
    // Load date ranges for all documents (in parallel for better performance)
    const rangePromises = docs.map(doc => getDocumentDateRange(doc.id).then(range => ({ docId: doc.id, range })));
    const rangeResults = await Promise.all(rangePromises);
    const ranges = {};
    rangeResults.forEach(({ docId, range }) => {
      if (range) {
        ranges[docId] = range;
      }
    });
    setDocumentDateRanges(ranges);
  }, [user, getDocumentDateRange]);

  // Load documents from Firestore when user logs in
  useEffect(() => {
    const loadDocuments = async () => {
      if (user && isMountedRef.current) {
        try {
          setIsLoadingDocuments(true);
          const docs = await documentService.getDocuments(user.uid);
          if (isMountedRef.current) {
            setDocuments(docs);
            setHasUploadedDocument(docs.length > 0);
          }
          
          // Date ranges are now calculated and stored in documents by documentService.getDocuments()
          // No need to calculate them here - they're already in doc.minDate/doc.maxDate
        } catch (error) {
          // Log error for debugging; error is silently handled to avoid disrupting user experience
          // Loading state is cleared in finally block
        } finally {
          if (isMountedRef.current) {
            setIsLoadingDocuments(false);
          }
        }
      }
    };

    loadDocuments();
  }, [user]);

  // Load notebook entries
  useEffect(() => {
    const loadNotebookEntries = async () => {
      if (!user?.uid) return;

      if (isMountedRef.current) {
        setIsLoadingNotebook(true);
      }
      try {
        const entries = await getNotebookEntries(user.uid, { limit: 50 });
        if (isMountedRef.current) {
          setNotebookEntries(entries);
        }
      } catch (error) {
        if (isMountedRef.current) {
          showError('Failed to load notebook entries');
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoadingNotebook(false);
        }
      }
    };

    loadNotebookEntries();
  }, [user]);

  // Reload notebook entries (called after adding or deleting a note)
  const reloadNotebookEntries = async () => {
    if (!user?.uid) return;

    if (isMountedRef.current) {
      setIsLoadingNotebook(true);
    }
    try {
      const entries = await getNotebookEntries(user.uid, { limit: 50 });
      if (isMountedRef.current) {
        setNotebookEntries(entries);
      }
    } catch (error) {
    } finally {
      if (isMountedRef.current) {
        setIsLoadingNotebook(false);
      }
    }
  };

  // Handle delete journal note - show confirmation modal
  const handleDeleteJournalNote = (noteId) => {
    if (!user?.uid || !noteId) return;

    setDeleteConfirm({
      show: true,
      title: 'Delete Journal Note?',
      message: 'This will permanently delete this journal note. This action cannot be undone.',
      itemName: 'journal note',
      confirmText: 'Yes, Delete Permanently',
      onConfirm: async () => {
        setIsDeleting(true);
        try {
          await journalNoteService.deleteJournalNote(noteId);
          showSuccess('Note deleted successfully');
          reloadNotebookEntries();
        } catch (error) {
          showError('Failed to delete note. Please try again.');
        } finally {
          setIsDeleting(false);
        }
      }
    });
  };

  // Handle edit note - supports both journal and document notes
  const handleEditNote = async (sourceId, entryDate, sourceType) => {
    if (!user?.uid || !sourceId) return;

    try {
      if (sourceType === 'journal') {
        // Fetch all journal notes to find the one we want to edit
        const allNotes = await journalNoteService.getJournalNotes(user.uid);
        const noteToEdit = allNotes.find(note => note.id === sourceId);
        
        if (noteToEdit) {
          setEditingJournalNote({
            sourceId: sourceId,
            content: noteToEdit.content,
            date: noteToEdit.date
          });
        } else {
          showError('Note not found');
        }
      } else if (sourceType === 'document') {
        // Fetch the document to edit
        const documentToEdit = await documentService.getDocument(sourceId);
        
        if (documentToEdit) {
          setEditingDocumentNote(documentToEdit);
        } else {
          showError('Document not found');
        }
      }
    } catch (error) {
      showError('Failed to load for editing. Please try again.');
    }
  };

  const openDocumentOnboarding = (docType = null, method = 'picker') => {
    setDocumentOnboardingMethod(method || 'picker');
    setShowDocumentOnboarding(true);
  };

  const simulateDocumentUpload = (docType) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.vcf,.vcf.gz,.maf,.bed,.txt,.csv,.tsv,.zip,.gz,.xlsx,.xls';
    input.multiple = true; // Enable multiple file selection

    input.onchange = async (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) {
        if (files.length === 1) {
          await handleRealFileUpload(files[0], docType);
        } else {
          await handleMultipleFileUpload(files, docType, pendingDocumentDate, pendingDocumentNote);
        }
      }
    };

    input.click();
  };

  const simulateCameraUpload = (docType) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.vcf,.vcf.gz,.maf,.bed,.txt,.csv,.tsv,.zip,.gz,.xlsx,.xls,image/*';
    input.capture = 'environment';
    input.multiple = true; // Enable multiple file selection (for camera, user can take multiple photos)

    input.onchange = async (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) {
        if (files.length === 1) {
          await handleRealFileUpload(files[0], docType);
        } else {
          await handleMultipleFileUpload(files, docType, pendingDocumentDate, pendingDocumentNote);
        }
      }
    };

    input.click();
  };

  const handleMultipleFileUpload = async (files, docType, providedDate = null, providedNote = null, onlyExistingMetrics = false) => {
    if (!user || !files || files.length === 0) {
      showError('Please log in to upload files');
      return;
    }

    const totalFiles = files.length;
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    try {
      setIsUploading(true);
      
      // Process files sequentially
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileNumber = i + 1;
        
        try {
          setUploadProgress(`Processing file ${fileNumber} of ${totalFiles}: ${file.name}`);
          setAiStatus(null);
          
          // Process each file with the shared date, note, and onlyExistingMetrics flag
          await handleRealFileUpload(
            file, 
            docType, 
            providedDate, 
            providedNote,
            fileNumber,
            totalFiles,
            onlyExistingMetrics
          );
          
          successCount++;
          
          // Small delay between files to avoid overwhelming the system
          if (i < files.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (error) {
          errorCount++;
          errors.push({ file: file.name, error: error.message });
        }
      }

      // Final summary
      setIsUploading(false);
      setUploadProgress('');
      setAiStatus(null);
      
      if (successCount === totalFiles) {
        showSuccess(`Successfully processed all ${totalFiles} file${totalFiles !== 1 ? 's' : ''}!`);
      } else if (successCount > 0) {
        showError(`Processed ${successCount} of ${totalFiles} files successfully. ${errorCount} file${errorCount !== 1 ? 's' : ''} failed.`);
      } else {
        showError(`Failed to process all files. Please try again.`);
      }
      
      // Reload health data after all files are processed
      await reloadHealthData();
      
    } catch (error) {
      showError(`Failed to process files: ${error.message}`);
      setIsUploading(false);
      setUploadProgress('');
      setAiStatus(null);
    }
  };

  const handleRealFileUpload = async (file, docType, providedDateOverride = null, providedNoteOverride = null, currentFileNumber = null, totalFiles = null, onlyExistingMetricsOverride = null) => {
    addDebugLog(`handleRealFileUpload: ${file?.name || 'unknown'}`, 'info');
    
    if (!user) {
      addDebugLog('ERROR: No user found', 'error');
      showError('Please log in to upload files');
      return;
    }

    try {
      // Show loading overlay (only if not part of a batch)
      if (currentFileNumber === null) {
        addDebugLog('Setting upload overlay to visible', 'info');
        setIsUploading(true);
        setUploadProgress('Preparing upload...');
        // Small delay to ensure overlay renders before heavy processing
        await new Promise(resolve => setTimeout(resolve, 100));
        addDebugLog('Upload overlay should be visible', 'success');
      }
      
      const fileProgressPrefix = currentFileNumber && totalFiles 
        ? `[File ${currentFileNumber}/${totalFiles}] ` 
        : '';
      
      addDebugLog('Starting document processing', 'info');
      setUploadProgress(`${fileProgressPrefix}Reading document...`);

      // Get document date, note, and onlyExistingMetrics (user-provided or null)
      // Use override parameters if provided (from onUploadClick), otherwise use state
      const providedDate = providedDateOverride !== null ? providedDateOverride : pendingDocumentDate;
      const providedNote = providedNoteOverride !== null ? providedNoteOverride : pendingDocumentNote;
      const onlyExistingMetrics = onlyExistingMetricsOverride !== null ? onlyExistingMetricsOverride : pendingOnlyExistingMetrics;
      // Clear pending values after use
      setPendingDocumentDate(null);
      setPendingDocumentNote(null);
      setPendingOnlyExistingMetrics(false);

      // Step 1: Process document with AI to extract medical data
      setUploadProgress(`${fileProgressPrefix}Analyzing document with AI...`);
      setAiStatus('Initializing AI analysis...');
      
      const processingResult = await processDocument(
        file,
        user.uid,
        patientProfile,
        providedDate,
        providedNote,
        null,
        (message, status) => {
          // Progress callback for real-time updates
          if (status) {
            setAiStatus(status);
          }
        },
        onlyExistingMetrics
      );
      
      setAiStatus(null); // Clear AI status after analysis

      // Step 2: Upload file to Firebase Storage
      setUploadProgress(`${fileProgressPrefix}Uploading to secure storage...`);
      // Ensure note is passed correctly - preserve string values, normalize empty strings to null
      const noteToSave = (providedNote && typeof providedNote === 'string' && providedNote.trim() !== '')
        ? providedNote.trim()
        : (providedNote || null);
      
      // Use user-provided date, or AI-extracted date, or null (will default to today)
      const dateForFilename = providedDate || processingResult.extractedDate || null;
      
      const uploadResult = await uploadDocument(file, user.uid, {
        category: processingResult.documentType || docType,
        documentType: processingResult.documentType || docType,
        date: dateForFilename, // Pass the date (user-provided or AI-extracted) for filename
        note: noteToSave, // Pass the note (already normalized)
        dataPointCount: processingResult.dataPointCount || 0
      });


      // Step 3: Link all extracted values to the document ID
      setUploadProgress(`${fileProgressPrefix}Linking data to document...`);
      if (processingResult.extractedData && uploadResult.id) {
        try {
          const { linkValuesToDocument } = await import('../../services/documentProcessor');
          await linkValuesToDocument(processingResult.extractedData, uploadResult.id, user.uid);
        } catch (linkError) {
        }
      }

      // Don't set generic "Saving extracted data" - let the specific aiStatus messages show instead
      // setUploadProgress(`${fileProgressPrefix}Saving extracted data...`);

      // Step 4: Add to local documents state
      // Use providedDate if available, otherwise format the date from uploadResult
      const docDate = providedDate || (uploadResult.date ? formatDateString(uploadResult.date) : formatDateString(new Date()));
      const newDoc = {
        id: uploadResult.id,
        name: file.name,
        fileName: file.name,
        type: processingResult.documentType || docType,
        documentType: processingResult.documentType || docType,
        date: docDate,
        fileUrl: uploadResult.fileUrl,
        storagePath: uploadResult.storagePath,
        icon: (processingResult.documentType || docType).toLowerCase(),
        note: providedNote || null,
        dataPointCount: processingResult.dataPointCount || 0,
        fileSize: file.size,
        fileType: file.type
      };

      const updatedDocsList = [newDoc, ...documents];
      setDocuments(updatedDocsList);
      setHasUploadedDocument(true);
      
      // Date ranges are calculated and stored in documents by documentService.getDocuments()
      // Reload documents to get updated date ranges
      const reloadedDocs = await documentService.getDocuments(user.uid);
      setDocuments(reloadedDocs);

      // Reload health data to show new values (only if not part of a batch)
      if (currentFileNumber === null || currentFileNumber === totalFiles) {
        setUploadProgress(`${fileProgressPrefix}Refreshing your health data...`);
        setAiStatus(null); // Clear AI status
        await reloadHealthData();
      }

      // Only show success message and close overlay if not part of a batch
      if (currentFileNumber === null) {
        setIsUploading(false);
        setUploadProgress('');
        setAiStatus(null);
        const dataPointText = processingResult.dataPointCount > 0
          ? ` ${processingResult.dataPointCount} data point${processingResult.dataPointCount !== 1 ? 's' : ''} extracted.`
          : '';
        showSuccess(`Document uploaded and processed successfully!${dataPointText} All extracted data has been saved to your health records.`);
      } else {
        // For batch uploads, just clear status
        setAiStatus(null);
      }

      // Generate chat summary with quick action buttons (only for single file or last file in batch)
      if (currentFileNumber === null || currentFileNumber === totalFiles) {
        const chatSummary = generateChatSummary(processingResult, processingResult.extractedData);

        // Store summary in sessionStorage for ChatTab to pick up
        sessionStorage.setItem('uploadSummary', JSON.stringify({
          summary: chatSummary,
          timestamp: Date.now(),
          documentType: processingResult.documentType || docType
        }));

        // Navigate to chat tab to show summary (only for single file or last file)
        if (currentFileNumber === null || currentFileNumber === totalFiles) {
          onTabChange('chat');
        }
      }
    } catch (error) {
      // Only show error and close overlay if not part of a batch (batch handler will show summary)
      if (currentFileNumber === null) {
        showError(`Failed to process document: ${error.message}. The file was not uploaded. Please try again or contact support if the issue persists.`);
        setIsUploading(false);
        setUploadProgress('');
        setAiStatus(null);
      }
      // Re-throw error so batch handler can catch it
      throw error;
    }
  };

  if (!user) {
    return null;
  }

  // Define icon and color based on document type
  const getIconConfig = (type) => {
    switch (type) {
      case 'Lab':
        return {
          bgColor: 'bg-yellow-100',
          iconColor: 'text-yellow-600',
          icon: (
            <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          ),
          label: "Lab Results"
        };
      case 'Scan':
        return {
          bgColor: 'bg-purple-100',
          iconColor: 'text-purple-600',
          icon: (
            <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          ),
          label: "Imaging Scan"
        };
      case 'Report':
        return {
          bgColor: DesignTokens.components.status.normal.bg,
          iconColor: DesignTokens.components.status.normal.text,
          icon: (
            <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          ),
          label: "Clinical Report"
        };
      case 'Genomic':
        return {
          bgColor: 'bg-purple-100',
          iconColor: 'text-purple-600',
          icon: (
            <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
          ),
          label: "Genomic Test"
        };
      default:
        return {
          bgColor: DesignTokens.colors.neutral[100],
          iconColor: DesignTokens.colors.neutral.text[600],
          icon: (
            <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          ),
          label: "Document"
        };
    }
  };

  return (
    <div className="relative">
      {/* Loading spinner with blurred background */}
      {isLoadingDocuments && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl">
            <div className="text-center">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Loader2 className="w-8 h-8 text-yellow-600 animate-spin" />
              </div>
              <h3 className={combineClasses('text-xl font-bold mb-2', DesignTokens.colors.neutral.text[900])}>Loading Documents</h3>
              <p className={combineClasses(DesignTokens.colors.neutral.text[600])}>Calculating date ranges...</p>
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <div className={combineClasses(
        DesignTokens.spacing.container.mobile,
        'sm:px-4 md:px-6',
        'py-2 sm:py-3',
        'flex items-center'
      )}>
        <div className={combineClasses('flex items-center', DesignTokens.spacing.gap.sm, 'sm:gap-3')}>
          <div className={combineClasses('bg-yellow-50 p-2 sm:p-2.5 rounded-lg')}>
            <FileText className={combineClasses('w-5 h-5 sm:w-6 sm:h-6 text-yellow-600')} />
          </div>
          <div>
            <h1 className={combineClasses(DesignTokens.components.header.title, 'mb-0')}>Documents</h1>
          </div>
        </div>
      </div>
      <div className={combineClasses(Layouts.container, Layouts.section)}>

        {/* Visual Debug Panel - Only show if there are logs */}
      {debugLogs.length > 0 && (
        <div className="fixed bottom-4 right-4 bg-black/90 text-white p-3 rounded-lg text-xs max-w-xs z-[9999] max-h-64 overflow-y-auto shadow-2xl border border-white/20">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-sm">Debug Logs</span>
            <button 
              onClick={() => setDebugLogs([])}
              className="text-white/70 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-1 font-mono">
            {debugLogs.map((log, idx) => (
              <div key={idx} className={`text-xs break-words ${
                log.type === 'error' ? DesignTokens.components.alert.text.error.replace('600', '400') : 
                log.type === 'success' ? DesignTokens.components.status.normal.text.replace('600', '400') : 
                log.type === 'warning' ? DesignTokens.components.alert.text.warning.replace('700', '400') : 
                'text-white/90'
              }`}>
                <span className="text-white/50 text-[10px]">{log.timestamp}</span> {log.message}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab Navigation with Ask About Button */}
      <div className={combineClasses('flex items-center', DesignTokens.spacing.gap.responsive.md, Layouts.section, 'overflow-x-auto')}>
        {/* Tab Navigation */}
        <div className={combineClasses('flex', DesignTokens.spacing.gap.responsive.xs, 'overflow-x-auto', 'flex-1', 'mb-0')}>
          <button
            onClick={() => setActiveSubTab('notes')}
            className={combineClasses(
              DesignTokens.components.tabs.button.base,
              activeSubTab === 'notes'
                ? 'text-yellow-600 border-b-2 border-yellow-600'
                : 'text-medical-neutral-600 hover:text-yellow-600'
            )}
          >
            <BookOpen className={DesignTokens.icons.button.size.full} />
            <span className={DesignTokens.typography.body.base}>Notes</span>
          </button>
          <button
            onClick={() => setActiveSubTab('documents')}
            className={combineClasses(
              DesignTokens.components.tabs.button.base,
              activeSubTab === 'documents'
                ? 'text-yellow-600 border-b-2 border-yellow-600'
                : 'text-medical-neutral-600 hover:text-yellow-600'
            )}
          >
            <FolderOpen className={DesignTokens.icons.button.size.full} />
            <span className={DesignTokens.typography.body.base}>Files</span>
          </button>
        </div>
        
        {/* Ask About Button */}
        <button
          onClick={async () => {
            if (!user?.uid) return;
            try {
              if (activeSubTab === 'notes') {
                const entries = await getNotebookEntries(user.uid, { limit: 50 });
                sessionStorage.setItem('currentNotebookContext', JSON.stringify({ entries }));
              } else {
                // For documents tab, set document context
                sessionStorage.setItem('currentDocumentContext', JSON.stringify({ documents }));
              }
              onTabChange('chat');
            } catch (error) {
              showError('Error loading data. Please try again.');
            }
          }}
          className={combineClasses('bg-medical-secondary-50 text-medical-secondary-600 px-3 sm:px-6 py-2.5 rounded-lg hover:bg-medical-secondary-100 transition font-medium flex items-center gap-2 shadow-sm border border-medical-secondary-200 min-h-[44px] touch-manipulation active:opacity-70 flex-shrink-0')}
        >
          <MessageSquare className={combineClasses(DesignTokens.icons.button.size.full, 'text-medical-secondary-600')} />
          <span className="hidden sm:inline">Ask About This</span>
        </button>
      </div>

      {/* Documents Tab Content */}
      {activeSubTab === 'documents' && (
        <div className={combineClasses(DesignTokens.components.card.container)}>
        {documents.length > 0 && (
          <div className={combineClasses('flex items-center justify-between', DesignTokens.spacing.section.mobile)}>
            <div className={combineClasses(
              'flex items-center',
              DesignTokens.spacing.gap.sm,
              DesignTokens.typography.body.base,
              'font-semibold',
              DesignTokens.colors.neutral.text[700]
            )}>
            <div className={combineClasses(DesignTokens.spacing.iconContainer.full, DesignTokens.borders.radius.sm, DesignTokens.colors.neutral[100])}>
              <FolderOpen className={combineClasses(DesignTokens.icons.standard.size.full, DesignTokens.colors.neutral.text[500])} />
            </div>
            Medical Documents
          </div>
            <div className={combineClasses('flex items-center', DesignTokens.spacing.gap.sm)}>
            <button
              onClick={() => openDocumentOnboarding('general')}
              className={combineClasses(
                'flex items-center',
                DesignTokens.spacing.gap.sm,
                'text-yellow-600',
                'hover:text-yellow-700',
                DesignTokens.transitions.default
              )}
            >
              <Plus className={DesignTokens.icons.standard.size.full} />
              <span className={combineClasses(DesignTokens.typography.body.sm, 'font-medium')}>Add File</span>
            </button>
            </div>
          </div>
        )}
        {documents.length === 0 ? (
          <div className={DesignTokens.components.emptyState.container}>
            <div className={combineClasses(DesignTokens.components.emptyState.iconContainer, DesignTokens.colors.neutral[100], 'rounded-full')}>
              <FolderOpen className={combineClasses(DesignTokens.components.emptyState.icon, DesignTokens.colors.neutral.text[300])} />
            </div>
            <h3 className={combineClasses(DesignTokens.components.emptyState.title, DesignTokens.typography.h3.color)}>No documents uploaded yet</h3>
            <p className={combineClasses(DesignTokens.components.emptyState.message, DesignTokens.colors.neutral.text[600])}>Upload lab results, imaging scans, clinical reports, or genomic test results</p>
            <div className={DesignTokens.components.emptyState.actions}>
              <button
                onClick={() => openDocumentOnboarding('general')}
                className={combineClasses(
                  'bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors font-medium min-h-[44px] touch-manipulation active:opacity-70',
                  DesignTokens.spacing.button.full,
                  'py-2.5 sm:py-3'
                )}
              >
                <Upload className={DesignTokens.icons.button.size.full} />
                Upload Your First Document
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Search Bar */}
            <div className={combineClasses('relative', DesignTokens.spacing.section.mobile)}>
              <Search className={combineClasses('absolute left-3 top-1/2 -translate-y-1/2', DesignTokens.icons.standard.size.full, DesignTokens.colors.neutral.text[400])} />
              <input
                type="text"
                placeholder="Search documents by name, type, or note..."
                value={documentSearchQuery}
                onChange={(e) => setDocumentSearchQuery(e.target.value)}
                className={combineClasses(
                  DesignTokens.components.input.base,
                  DesignTokens.components.input.withIcon,
                  documentSearchQuery && 'pr-10'
                )}
              />
              {documentSearchQuery && (
                <button
                  onClick={() => setDocumentSearchQuery('')}
                  className={combineClasses('absolute right-3 top-1/2 -translate-y-1/2', DesignTokens.colors.neutral.text[400], 'hover:text-gray-600', DesignTokens.transitions.default)}
                  aria-label="Clear search"
                >
                  <X className={DesignTokens.icons.standard.size.full} />
                </button>
              )}
            </div>
            
            {/* Filtered Documents */}
            <div className="space-y-2">
              {documents
                .filter(doc => {
                  if (!documentSearchQuery.trim()) return true;
                  const query = documentSearchQuery.toLowerCase();
                  const fileName = (doc.fileName || doc.name || 'Untitled Document').toLowerCase();
                  const docType = (doc.documentType || doc.type || '').toLowerCase();
                  const note = (doc.note || '').toLowerCase();
                  const label = getIconConfig(doc.documentType || doc.type).label.toLowerCase();
                  return fileName.includes(query) || docType.includes(query) || note.includes(query) || label.includes(query);
                })
                .map(doc => {
              const iconConfig = getIconConfig(doc.documentType || doc.type);
              const fileName = doc.fileName || doc.name || 'Untitled Document';

              const handleDelete = (e) => {
                e.stopPropagation();
                setDeleteConfirm({
                  show: true,
                  title: `Delete "${fileName}"?`,
                  message: `This will permanently delete "${fileName}" AND ALL extracted lab values, vital signs, and medications from this document. This action cannot be undone.`,
                  itemName: `"${fileName}"`,
                  confirmText: 'Yes, Delete Permanently',
                  onConfirm: async () => {
                    try {
                      setIsDeleting(true);
                      // First clean up all associated health data
                      // Use non-aggressive cleanup - only delete values with matching documentId
                      await cleanupDocumentData(doc.id, user.uid, false);
                      
                      // Then delete the document
                      await deleteDocument(doc.id, doc.storagePath, user.uid);
                      
                      // Reload documents
                      const updatedDocs = await documentService.getDocuments(user.uid);
                      setDocuments(updatedDocs);
                      setHasUploadedDocument(updatedDocs.length > 0);
                      
                      // Date ranges are calculated and stored in documents by documentService.getDocuments()
                      // Reload documents to get updated date ranges
                      const reloadedDocs = await documentService.getDocuments(user.uid);
                      setDocuments(reloadedDocs);
                      
                      // Reload health data to reflect deletions
                      await reloadHealthData();
                      
                      showSuccess('Document and associated data deleted successfully.');
                    } catch (error) {
                      showError('Failed to delete document. Please try again.');
                    } finally {
                      setIsDeleting(false);
                    }
                  }
                });
              };

              return (
                <div key={doc.id} className={combineClasses(
                  DesignTokens.components.card.nested,
                  'relative flex flex-col sm:flex-row sm:items-center',
                  DesignTokens.spacing.gap.sm,
                  'sm:gap-3',
                  DesignTokens.transitions.default,
                  `hover:${DesignTokens.colors.neutral[50]}`
                )}>
                  {/* Menu button - three dots in upper right corner */}
                  <div className="absolute top-2 right-2 z-10">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setOpenMenuId(openMenuId === doc.id ? null : doc.id);
                      }}
                      className={combineClasses(
                        DesignTokens.spacing.iconContainer.full,
                        DesignTokens.borders.radius.full,
                        DesignTokens.transitions.default,
                        DesignTokens.spacing.touchTarget,
                        'min-w-[44px] flex items-center justify-center touch-manipulation active:opacity-70',
                        DesignTokens.colors.neutral.text[500],
                        `hover:${DesignTokens.colors.neutral[100]}`,
                        `hover:${DesignTokens.colors.neutral.text[700]}`
                      )}
                      title="More options"
                    >
                      <MoreVertical className={DesignTokens.icons.standard.size.full} />
                    </button>
                  </div>
                  
                  <div className={combineClasses('flex items-center flex-1 min-w-0 pr-8 sm:pr-10', DesignTokens.spacing.gap.sm, 'sm:gap-3')}>
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 ${iconConfig.bgColor} rounded-lg flex items-center justify-center flex-shrink-0`}>
                      <div className={`${iconConfig.iconColor} w-5 h-5 sm:w-6 sm:h-6`}>
                        {iconConfig.icon}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={combineClasses(DesignTokens.typography.body.base, 'font-semibold truncate')}>{fileName}</p>
                      <p className={combineClasses(DesignTokens.typography.body.xs, 'mt-0.5', DesignTokens.colors.neutral.text[700])}>{iconConfig.label}</p>
                      {doc.note && (
                        <p className={combineClasses(DesignTokens.typography.body.sm, 'text-yellow-600', 'mt-1 sm:mt-0.5 italic break-words line-clamp-2 sm:line-clamp-none')}>{doc.note}</p>
                      )}
                      <p className={combineClasses(DesignTokens.typography.body.xs, 'mt-0.5', DesignTokens.colors.neutral.text[500])}>
                        {(() => {
                          // Use stored date range from document if available (calculated upfront)
                          if (doc.hasMultipleDates && doc.minDate && doc.maxDate) {
                            const minDate = doc.minDate?.toDate ? doc.minDate.toDate() : new Date(doc.minDate);
                            const maxDate = doc.maxDate?.toDate ? doc.maxDate.toDate() : new Date(doc.maxDate);
                            const minStr = minDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                            const maxStr = maxDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                            // If same year, only show year once
                            if (minDate.getFullYear() === maxDate.getFullYear()) {
                              const minStrNoYear = minDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                              const maxStrNoYear = maxDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                              return `${minStrNoYear} - ${maxStrNoYear}, ${minDate.getFullYear()}`;
                            }
                            return `${minStr} - ${maxStr}`;
                          }
                          // Fallback to calculated date range (for backwards compatibility during migration)
                          const dateRange = documentDateRanges[doc.id];
                          if (dateRange) {
                            const minStr = dateRange.minDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                            const maxStr = dateRange.maxDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                            // If same year, only show year once
                            if (dateRange.minDate.getFullYear() === dateRange.maxDate.getFullYear()) {
                              const minStrNoYear = dateRange.minDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                              const maxStrNoYear = dateRange.maxDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                              return `${minStrNoYear} - ${maxStrNoYear}, ${dateRange.minDate.getFullYear()}`;
                            }
                            return `${minStr} - ${maxStr}`;
                          }
                          // Single date or no date
                          return doc.date ? parseLocalDate(doc.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'No date';
                        })()}
                      </p>
                    </div>
                  </div>
                  <div className={combineClasses('flex-shrink-0 flex items-center justify-end mt-2 sm:mt-0 sm:mr-12', DesignTokens.spacing.gap.xs, 'sm:gap-2')}>
                    {/* View button - always visible */}
                    {doc.fileUrl && (
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={combineClasses(
                        'px-3 py-1.5 text-white font-medium rounded-lg',
                        DesignTokens.typography.body.sm,
                        DesignTokens.spacing.touchTarget,
                        'flex items-center justify-center touch-manipulation active:opacity-70 whitespace-nowrap',
                        'bg-yellow-600',
                        'hover:bg-yellow-700',
                        DesignTokens.transitions.default
                      )}
                        onClick={(e) => e.stopPropagation()}
                      >
                        View
                      </a>
                    )}
                  </div>
                  
                  {/* Dropdown menu - positioned relative to menu button */}
                  {openMenuId === doc.id && (
                    <>
                      {/* Backdrop to close menu */}
                      <div 
                        className="fixed inset-0 z-20"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(null);
                        }}
                      />
                      {/* Menu items */}
                      <div className={combineClasses(
                        'absolute top-10 right-2 w-48 bg-white py-1 z-30',
                        DesignTokens.borders.radius.md,
                        DesignTokens.shadows.lg,
                        DesignTokens.borders.width.default,
                        DesignTokens.colors.neutral.border[200]
                      )}>
                            {/* Info button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuId(null);
                                setShowDocumentMetadata(doc);
                              }}
                              className={combineClasses(
                                'w-full px-4 py-2 text-left flex items-center',
                                DesignTokens.spacing.gap.sm,
                                DesignTokens.typography.body.sm,
                                DesignTokens.colors.neutral.text[700],
                                `hover:${DesignTokens.colors.neutral[100]}`
                              )}
                            >
                              <Info className={DesignTokens.icons.standard.size.full} />
                              View Metadata
                            </button>
                            
                            {/* Edit button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuId(null);
                                setEditingDocumentNote(doc);
                              }}
                              className={combineClasses(
                                'w-full px-4 py-2 text-left flex items-center',
                                DesignTokens.spacing.gap.sm,
                                DesignTokens.typography.body.sm,
                                DesignTokens.colors.neutral.text[700],
                                `hover:${DesignTokens.colors.neutral[100]}`
                              )}
                            >
                              <Edit2 className={DesignTokens.icons.standard.size.full} />
                              Edit Name, Date & Note
                            </button>
                            
                            {/* Rescan button - show for processable document types */}
                            {(doc.documentType === 'Lab' || doc.type === 'Lab' || doc.documentType === 'Vitals' || doc.type === 'Vitals' || doc.documentType === 'Genomic' || doc.type === 'Genomic' || doc.documentType === 'blood-test') && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuId(null);
                                  setRescanDocument(doc);
                                }}
                                className={combineClasses(
                                  'w-full px-4 py-2 text-left flex items-center',
                                  DesignTokens.spacing.gap.sm,
                                  DesignTokens.typography.body.sm,
                                  DesignTokens.colors.neutral.text[700],
                                  `hover:${DesignTokens.colors.neutral[100]}`
                                )}
                              >
                                <RefreshCw className={DesignTokens.icons.standard.size.full} />
                                Rescan Document
                              </button>
                            )}
                            
                            {/* Delete button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuId(null);
                                handleDelete(e);
                              }}
                              className={combineClasses(
                                'w-full px-4 py-2 text-left flex items-center',
                                DesignTokens.spacing.gap.sm,
                                DesignTokens.typography.body.sm,
                                DesignTokens.components.status.high.text,
                                `hover:${DesignTokens.components.status.high.bg}`
                              )}
                            >
                              <X className={DesignTokens.icons.standard.size.full} />
                              Delete Document
                            </button>
                          </div>
                        </>
                      )}
                </div>
              );
            })}
          </div>
          </div>
        )}
        </div>
      )}

      {/* Notes Tab Content */}
      {activeSubTab === 'notes' && (
        <div className={combineClasses(
          DesignTokens.components.card.container
        )}>
        {notebookEntries.length > 0 && (
          <div className={combineClasses('flex items-center justify-between', DesignTokens.spacing.section.mobile)}>
            <div className={combineClasses(
              'flex items-center',
              DesignTokens.spacing.gap.sm,
              DesignTokens.typography.body.base,
              'font-semibold',
              DesignTokens.colors.neutral.text[700]
            )}>
              <div className={combineClasses(DesignTokens.spacing.iconContainer.full, DesignTokens.borders.radius.sm, DesignTokens.colors.neutral[100])}>
                <BookOpen className={combineClasses(DesignTokens.icons.standard.size.full, DesignTokens.colors.neutral.text[500])} />
              </div>
              Medical Notebook
            </div>
            <button
              onClick={() => {
                setAddNoteDate(null);
                setShowAddJournalNote(true);
              }}
              className={combineClasses(
                'flex items-center',
                DesignTokens.spacing.gap.sm,
                'text-yellow-600',
                'hover:text-yellow-700',
                DesignTokens.transitions.default
              )}
            >
              <Plus className={DesignTokens.icons.standard.size.full} />
              <span className={combineClasses(DesignTokens.typography.body.sm, 'font-medium')}>Add Entry</span>
            </button>
          </div>
        )}
        {notebookEntries.length === 0 && !isLoadingNotebook && (
          <div className={combineClasses('flex items-center justify-between', DesignTokens.spacing.section.mobile)}>
            <div className={combineClasses(
              'flex items-center',
              DesignTokens.spacing.gap.sm,
              DesignTokens.typography.body.base,
              'font-semibold',
              DesignTokens.colors.neutral.text[700]
            )}>
              <div className={combineClasses(DesignTokens.spacing.iconContainer.full, DesignTokens.borders.radius.sm, DesignTokens.colors.neutral[100])}>
                <BookOpen className={combineClasses(DesignTokens.icons.standard.size.full, DesignTokens.colors.neutral.text[500])} />
              </div>
              Medical Journal
            </div>
          </div>
        )}

        {isLoadingNotebook ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-yellow-600 animate-spin" />
          </div>
        ) : (
          <>
            {/* Search Bar */}
            {notebookEntries.length > 0 && (
              <div className={combineClasses('relative', DesignTokens.spacing.section.mobile)}>
                <Search className={combineClasses('absolute left-3 top-1/2 -translate-y-1/2', DesignTokens.icons.standard.size.full, DesignTokens.colors.neutral.text[400])} />
                <input
                  type="text"
                  placeholder="Search entries by date, note content, or document name..."
                  value={notebookSearchQuery}
                  onChange={(e) => setNotebookSearchQuery(e.target.value)}
                  className={combineClasses(
                    DesignTokens.components.input.base,
                    DesignTokens.components.input.withIcon,
                    notebookSearchQuery && 'pr-10'
                  )}
                />
                {notebookSearchQuery && (
                  <button
                    onClick={() => setNotebookSearchQuery('')}
                    className={combineClasses('absolute right-3 top-1/2 -translate-y-1/2', DesignTokens.colors.neutral.text[400], 'hover:text-gray-600', DesignTokens.transitions.default)}
                    aria-label="Clear search"
                  >
                    <X className={DesignTokens.icons.standard.size.full} />
                  </button>
                )}
              </div>
            )}
            
            <NotebookTimeline 
              entries={notebookEntries.filter(entry => {
                if (!notebookSearchQuery.trim()) return true;
                const query = notebookSearchQuery.toLowerCase();
                const dateStr = entry.date.toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                }).toLowerCase();
                const notesMatch = entry.notes?.some(note => 
                  note.content?.toLowerCase().includes(query) ||
                  note.sourceName?.toLowerCase().includes(query)
                );
                const documentsMatch = entry.documents?.some(doc =>
                  (doc.fileName || doc.name || '').toLowerCase().includes(query) ||
                  (doc.documentType || doc.type || '').toLowerCase().includes(query)
                );
                return dateStr.includes(query) || notesMatch || documentsMatch;
              })} 
              onEntryClick={(entry) => {
                // Handle entry click if needed
              }}
              onAddNote={(date) => {
                setAddNoteDate(date);
                setShowAddJournalNote(true);
              }}
              onDeleteNote={handleDeleteJournalNote}
              onEditNote={handleEditNote}
            />
          </>
        )}
        </div>
      )}
      </div>

      {/* Modals */}
      {showDocumentOnboarding && (
        <DocumentUploadOnboarding
          isOnboarding={!hasUploadedDocument}
          onClose={() => setShowDocumentOnboarding(false)}
          onUploadClick={async (documentType, documentDate = null, documentNote = null, fileOrFiles = null, onlyExistingMetrics = false) => {
            addDebugLog(`onUploadClick: ${documentType}, hasFile: ${!!fileOrFiles}`, 'info');
            
            try {
              // Normalize and set pending state - ensure we preserve actual note values
              const normalizedDate = (documentDate && typeof documentDate === 'string' && documentDate.trim() !== '') 
                ? documentDate.trim() 
                : (documentDate || null);
              const normalizedNote = (documentNote && typeof documentNote === 'string' && documentNote.trim() !== '') 
                ? documentNote.trim() 
                : (documentNote || null);
              
              addDebugLog(`Normalized: date=${normalizedDate}, note=${normalizedNote ? 'yes' : 'no'}, onlyExisting=${onlyExistingMetrics}`, 'info');
              
              setPendingDocumentDate(normalizedDate);
              setPendingDocumentNote(normalizedNote);
              setPendingOnlyExistingMetrics(onlyExistingMetrics);
              
              // Close modal first to show upload progress
              addDebugLog('Closing modal...', 'info');
              setShowDocumentOnboarding(false);
              
              // Small delay to ensure modal closes before starting upload
              await new Promise(resolve => setTimeout(resolve, 150));
              addDebugLog('Modal closed, starting upload', 'info');
              
              // If file(s) is provided (from component's file picker), upload it/them directly
              if (fileOrFiles) {
                addDebugLog(`File received: ${fileOrFiles.name || 'array'}`, 'success');
                if (Array.isArray(fileOrFiles)) {
                  // Multiple files - process sequentially
                  addDebugLog(`Processing ${fileOrFiles.length} files`, 'info');
                  await handleMultipleFileUpload(fileOrFiles, documentType, normalizedDate, normalizedNote, onlyExistingMetrics);
                } else {
                  // Single file - use existing handler
                  addDebugLog(`Processing: ${fileOrFiles.name} (${(fileOrFiles.size / 1024).toFixed(0)}KB)`, 'info');
                  await handleRealFileUpload(fileOrFiles, documentType, normalizedDate, normalizedNote, null, null, onlyExistingMetrics);
                }
              } else {
                // Otherwise, open file picker (fallback)
                addDebugLog('No file, opening picker', 'warning');
                const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                
                if (documentOnboardingMethod === 'camera') {
                  simulateCameraUpload(documentType);
                } else if (isMobile) {
                  simulateCameraUpload(documentType);
                } else {
                  simulateDocumentUpload(documentType);
                }
              }
    } catch (error) {
      addDebugLog(`ERROR: ${error.message}`, 'error');
      addDebugLog(`Stack: ${error.stack?.substring(0, 100)}...`, 'error');
      showError(`Failed to start upload: ${error.message}. Please try again.`);
      // Ensure modal can be reopened if there's an error
      setShowDocumentOnboarding(false);
      setIsUploading(false);
      setUploadProgress('');
      setAiStatus(null);
    }
          }}
        />
      )}

      <EditDocumentNoteModal
        show={!!editingDocumentNote}
        onClose={() => {
          setEditingDocumentNote(null);
        }}
        user={user}
        editingDocumentNote={editingDocumentNote}
        setEditingDocumentNote={setEditingDocumentNote}
        setIsUploading={setIsUploading}
        setUploadProgress={setUploadProgress}
        reloadHealthData={async () => {
          await reloadHealthData();
          // Also reload notebook entries since document notes appear in the timeline
          reloadNotebookEntries();
        }}
        setDocuments={setDocuments}
        onRescanRequest={(doc) => {
          // Close edit modal and open rescan modal
          setEditingDocumentNote(null);
          setRescanDocument(doc);
        }}
      />

      <UploadProgressOverlay
        show={isUploading}
        uploadProgress={uploadProgress}
        aiStatus={aiStatus}
      />

      <DeletionConfirmationModal
        show={deleteConfirm.show}
        onClose={() => {
          if (!isDeleting) {
            setDeleteConfirm({ show: false, title: '', message: '', onConfirm: null, itemName: '', confirmText: 'Yes, Delete Permanently' });
          }
        }}
        onConfirm={async () => {
          if (deleteConfirm.onConfirm) {
            await deleteConfirm.onConfirm();
          }
          // Close modal after deletion completes (isDeleting will be false in finally block)
          setDeleteConfirm({ show: false, title: '', message: '', onConfirm: null, itemName: '', confirmText: 'Yes, Delete Permanently' });
        }}
        title={deleteConfirm.title}
        message={deleteConfirm.message}
        itemName={deleteConfirm.itemName}
        confirmText={deleteConfirm.confirmText}
        isDeleting={isDeleting}
      />

      <RescanDocumentModal
        show={!!rescanDocument}
        user={user}
        onClose={() => setRescanDocument(null)}
        document={rescanDocument}
        isProcessing={isUploading}
        onConfirm={async ({ date, note, onlyExistingMetrics = false }) => {
          if (!rescanDocument) return;

          try {
            // Close the rescan modal first so the progress overlay is visible
            setRescanDocument(null);
            
            setIsUploading(true);
            setUploadProgress('Downloading document...');

            // Download file from storage using Firebase SDK (avoids CORS issues)
            if (!rescanDocument.storagePath) {
              throw new Error('Storage path not found for this document');
            }

            // Use existing fileUrl if available, otherwise get a fresh one
            const blob = await downloadFileAsBlob(rescanDocument.storagePath, rescanDocument.fileUrl);
            const file = new File([blob], rescanDocument.fileName || rescanDocument.name || 'document.pdf', {
              type: rescanDocument.fileType || blob.type || 'application/pdf'
            });

            setUploadProgress('Re-processing document...');
            setAiStatus('Initializing AI analysis...');
            
            // Use the edited values from the modal (or null if empty)
            const docDate = date || null;
            const docNote = note || null;
            
            // Clean up old data before reprocessing
            // Use non-aggressive cleanup - only delete values with matching documentId (not all values)
            await cleanupDocumentData(rescanDocument.id, user.uid, false); // false = only delete matching documentId
            
            // Re-process with edited values
            const processingResult = await processDocument(
              file,
              user.uid,
              patientProfile,
              docDate,
              docNote,
              rescanDocument.id,
              (message, status) => {
                // Progress callback for real-time updates
                if (status) {
                  setAiStatus(status);
                }
              },
              onlyExistingMetrics
            );
            
            setAiStatus(null); // Clear AI status after analysis

            setUploadProgress('Refreshing your health data...');
            setAiStatus(null); // Clear AI status

            // Reload health data
            await reloadHealthData();

            // Update document metadata with new data point count and preserved values
            // Format date properly: if provided, parse it; otherwise use null
            const formattedDate = docDate ? parseLocalDate(docDate) : null;
            const updateData = {
              id: rescanDocument.id,
              dataPointCount: processingResult.dataPointCount,
              // Always save date and note (either preserved values or null)
              date: formattedDate,
              note: docNote || null
            };

            await documentService.saveDocument(updateData);

            // Reload documents to get updated metadata (date ranges are calculated and stored by documentService.getDocuments())
            const updatedDocs = await documentService.getDocuments(user.uid);
            setDocuments(updatedDocs);

            // Already closed modal at start, just clean up state
            setIsUploading(false);
            setUploadProgress('');

            const dataPointText = processingResult.dataPointCount > 0
              ? ` ${processingResult.dataPointCount} data point${processingResult.dataPointCount !== 1 ? 's' : ''} extracted.`
              : '';
            showSuccess(`Document rescanned successfully!${dataPointText} Previous data has been cleaned up and new values extracted.`);

            // Generate chat summary with quick action buttons
            const chatSummary = generateChatSummary(processingResult, processingResult.extractedData);

            // Store summary in sessionStorage for ChatTab to pick up
            sessionStorage.setItem('uploadSummary', JSON.stringify({
              summary: chatSummary,
              timestamp: Date.now()
            }));

            // Navigate to chat tab to show summary
            onTabChange('chat');
          } catch (error) {
            showError(`Error rescanning document: ${error.message}. Please try again.`);
            // Already closed modal at start, just clean up state
            setIsUploading(false);
            setUploadProgress('');
            setAiStatus(null);
          }
        }}
      />

      {/* Document Metadata Modal */}
      <DocumentMetadataModal
        show={!!showDocumentMetadata}
        document={showDocumentMetadata}
        onClose={() => setShowDocumentMetadata(null)}
      />

      <AddJournalNoteModal
        show={showAddJournalNote}
        onClose={() => {
          setShowAddJournalNote(false);
          setAddNoteDate(null);
        }}
        user={user}
        initialDate={addNoteDate}
        onNoteAdded={() => {
          reloadNotebookEntries();
        }}
      />

      <EditJournalNoteModal
        show={!!editingJournalNote}
        onClose={() => {
          setEditingJournalNote(null);
        }}
        user={user}
        editingNote={editingJournalNote}
        setEditingNote={setEditingJournalNote}
        onNoteUpdated={() => {
          reloadNotebookEntries();
        }}
      />
      </div>
  );
}

