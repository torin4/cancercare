import React, { useState, useEffect, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { Upload, FolderOpen, X, Edit2, RefreshCw, Info, Plus, MoreVertical, Loader2, BookOpen, FileText, MessageSquare, Search, Bot, Trash2, Eye, FileImage } from 'lucide-react';
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
import { prepareZipForViewing } from '../../services/zipViewerService';
import DocumentUploadOnboarding from '../modals/DocumentUploadOnboarding';
import DicomImportFlow from '../modals/DicomImportFlow';
import DayOneImportModal from '../modals/DayOneImportModal';
import EditDocumentNoteModal from '../modals/EditDocumentNoteModal';
import UploadProgressOverlay from '../UploadProgressOverlay';
import DeletionConfirmationModal from '../modals/DeletionConfirmationModal';
import RescanDocumentModal from '../modals/RescanDocumentModal';
import NotebookTimeline from '../NotebookTimeline';
import AddJournalNoteModal from '../modals/AddJournalNoteModal';
import EditJournalNoteModal from '../modals/EditJournalNoteModal';
import DocumentMetadataModal from '../modals/DocumentMetadataModal';
import logger from '../../utils/logger';
// DicomViewerModal removed - using full-screen DicomViewerPage instead

export default function FilesTab({ onTabChange, onOpenMobileChat, onOpenDicomViewer }) {
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
  const [pendingCustomInstructions, setPendingCustomInstructions] = useState(null);
  const [pendingOnlyExistingMetrics, setPendingOnlyExistingMetrics] = useState(false);
  const [editingDocumentNote, setEditingDocumentNote] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [aiStatus, setAiStatus] = useState(null);
  const [extractedDataCounts, setExtractedDataCounts] = useState(null);
  const [currentDocumentType, setCurrentDocumentType] = useState(null);
  const [documentProgress, setDocumentProgress] = useState({ current: 0, total: 0 }); // Track document processing progress
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
  // DICOM viewer now handled by parent (full-screen page)
  const [hoveredTooltip, setHoveredTooltip] = useState(null); // Track which tooltip is showing
  // Debug logs removed - no longer showing debug panel
  // const [debugLogs, setDebugLogs] = useState([]); // Visual debug logs for mobile
  const [documentDateRanges, setDocumentDateRanges] = useState({}); // Cache date ranges for documents
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false); // Loading state for documents
  const [openMenuId, setOpenMenuId] = useState(null); // Track which file's menu is open (for mobile)
  const [expandedDicomGroups, setExpandedDicomGroups] = useState(new Set()); // Track expanded DICOM groups
  const [highlightedDocumentId, setHighlightedDocumentId] = useState(null); // Track which document to highlight
  const [zipChoiceModal, setZipChoiceModal] = useState(null); // { file, processingResult, onViewNow, onSaveToLibrary }
  const [showDicomImportFlow, setShowDicomImportFlow] = useState(false); // DICOM import flow modal
  const [showDayOneImportModal, setShowDayOneImportModal] = useState(false); // Day One JSON import

  // Tab state for Documents vs Notes view
  const [activeSubTab, setActiveSubTab] = useState('notes'); // 'documents' or 'notes'
  const [initialExpandedNotebookEntries, setInitialExpandedNotebookEntries] = useState({});

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

  // Debug log helper function - disabled (no longer showing debug panel)
  const addDebugLog = useCallback((message, type = 'log') => {
    // Debug logging disabled - no longer showing debug panel
    // setDebugLogs(prev => {
    //   const newLog = { message, type, timestamp: new Date().toLocaleTimeString() };
    //   return [...prev.slice(-9), newLog]; // Keep last 10 logs
    // });
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

  // Helper function to expand a document
  const expandDocument = useCallback((expandDocumentId) => {
    if (!expandDocumentId) return;

    // Clear the sessionStorage immediately to prevent re-expanding
    sessionStorage.removeItem('expandDocumentId');

    // Find the document in the list
    const doc = documents.find(d => d.id === expandDocumentId);
    if (!doc) return;

    // Check if it's a DICOM file that might be in a group
    const isDicom = doc.dicomMetadata ||
      (doc.fileName && (doc.fileName.toLowerCase().endsWith('.dcm') || doc.fileName.toLowerCase().endsWith('.dicom'))) ||
      (doc.fileType && (doc.fileType === 'application/dicom' || doc.fileType === 'application/x-dicom'));

    if (isDicom && doc.dicomMetadata) {
      // Find the group key for this DICOM file
      const md = doc.dicomMetadata;
      const ddm = doc.dicomDirMeta || null;
      const studyUID = (ddm?.study?.studyInstanceUID) || md.studyInstanceUID;
      const seriesUID = (ddm?.series?.seriesInstanceUID) || md.seriesInstanceUID;
      const groupKey = seriesUID || studyUID;

      if (groupKey) {
        // Expand the DICOM group
        setExpandedDicomGroups(prev => {
          const next = new Set(prev);
          next.add(groupKey);
          return next;
        });

        // Highlight and scroll to the document within the group after expansion
        setTimeout(() => {
          setHighlightedDocumentId(expandDocumentId);
          const docElement = document.querySelector(`[data-document-id="${expandDocumentId}"]`);
          if (docElement) {
            docElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Remove highlight after 3 seconds
            setTimeout(() => {
              setHighlightedDocumentId(null);
            }, 3000);
          } else {
            // If document not found, scroll to group
            const groupElement = document.querySelector(`[data-dicom-group-key="${groupKey}"]`);
            if (groupElement) {
              groupElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }
        }, 300); // Increased delay to allow group expansion to render
        return;
      }
    }

    // For non-DICOM or standalone documents, highlight and scroll to the document
    setTimeout(() => {
      setHighlightedDocumentId(expandDocumentId);
      const docElement = document.querySelector(`[data-document-id="${expandDocumentId}"]`);
      if (docElement) {
        docElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Remove highlight after 3 seconds
        setTimeout(() => {
          setHighlightedDocumentId(null);
        }, 3000);
      }
    }, 200);
  }, [documents]);

  // Handle expanding document from dashboard click
  useEffect(() => {
    const expandDocumentId = sessionStorage.getItem('expandDocumentId');
    if (!expandDocumentId || documents.length === 0) return;

    // Switch to documents sub-tab if we're on notes
    if (activeSubTab === 'notes') {
      setActiveSubTab('documents');
      // Wait for tab switch before expanding
      setTimeout(() => {
        expandDocument(expandDocumentId);
      }, 100);
      return;
    }

    expandDocument(expandDocumentId);
  }, [documents, activeSubTab, expandDocument]);

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

  // Handle expanding notebook entry from dashboard click
  useEffect(() => {
    const expandEntryDateKey = sessionStorage.getItem('expandNotebookEntry');
    if (!expandEntryDateKey || notebookEntries.length === 0) return;

    // Switch to notes sub-tab if we're on documents
    if (activeSubTab === 'documents') {
      setActiveSubTab('notes');
      // Wait for tab switch before expanding
      setTimeout(() => {
        setInitialExpandedNotebookEntries({ [expandEntryDateKey]: true });
        sessionStorage.removeItem('expandNotebookEntry');
        
        // Scroll to the entry after a short delay
        setTimeout(() => {
          const entryElement = document.querySelector(`[data-notebook-entry-datekey="${expandEntryDateKey}"]`);
          if (entryElement) {
            entryElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 200);
      }, 100);
      return;
    }

    // Already on notes tab, expand immediately
    setInitialExpandedNotebookEntries({ [expandEntryDateKey]: true });
    sessionStorage.removeItem('expandNotebookEntry');
    
    // Scroll to the entry after a short delay
    setTimeout(() => {
      const entryElement = document.querySelector(`[data-notebook-entry-datekey="${expandEntryDateKey}"]`);
      if (entryElement) {
        entryElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 200);
  }, [notebookEntries, activeSubTab]);

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

  // Handle delete note (journal or document) - show confirmation modal
  const handleDeleteNotebookNote = (noteId, sourceType = 'journal') => {
    if (!user?.uid || !noteId) return;

    if (sourceType === 'document') {
      setDeleteConfirm({
        show: true,
        title: 'Delete Document and Data?',
        message: 'This will permanently delete the document and all extracted labs, vitals, medications, and symptoms from it. This action cannot be undone.',
        itemName: 'document',
        confirmText: 'Yes, Delete Permanently',
        onConfirm: async () => {
          setIsDeleting(true);
          try {
            const doc = await documentService.getDocument(noteId);
            if (!doc) {
              showError('Document not found. Please refresh and try again.');
              return;
            }

            // Clean up associated health data first (non-aggressive)
            await cleanupDocumentData(doc.id, user.uid, false);

            // Delete document + storage file if available
            if (doc.storagePath) {
              await deleteDocument(doc.id, doc.storagePath, user.uid);
            } else {
              await documentService.deleteDocument(doc.id);
            }

            const updatedDocs = await documentService.getDocuments(user.uid);
            setDocuments(updatedDocs);
            setHasUploadedDocument(updatedDocs.length > 0);
            reloadNotebookEntries();
            await reloadHealthData();
            showSuccess('Document and related data deleted successfully.');
          } catch (error) {
            showError('Failed to delete document. Please try again.');
          } finally {
            setIsDeleting(false);
          }
        }
      });
      return;
    }

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

  const handleImportDicom = () => {
    setShowDicomImportFlow(true);
  };

  const handleImportDayOne = () => {
    setShowDayOneImportModal(true);
  };

  const simulateDocumentUpload = (docType) => {
    const input = document.createElement('input');
    input.type = 'file';
    // Allow all files - validation happens after selection (files without extensions like DICOM need this)
    input.accept = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.vcf,.vcf.gz,.maf,.bed,.txt,.csv,.tsv,.zip,.ZIP,.gz,.xlsx,.xls,.dcm,.dicom,application/dicom,application/x-dicom,application/zip,*/*';
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
    input.accept = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.vcf,.vcf.gz,.maf,.bed,.txt,.csv,.tsv,.zip,.ZIP,.gz,.xlsx,.xls,.dcm,.dicom,application/dicom,application/x-dicom,application/zip,image/*,*/*';
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

  const handleMultipleFileUpload = async (files, docType, providedDate = null, providedNote = null, onlyExistingMetrics = false, customInstructions = null) => {
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
            onlyExistingMetrics,
            customInstructions
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
      setExtractedDataCounts(null);
      setCurrentDocumentType(null);
      setDocumentProgress({ current: 0, total: 0 }); // Reset document progress
      
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
      setExtractedDataCounts(null);
      setCurrentDocumentType(null);
    }
  };

  const handleRealFileUpload = async (file, docType, providedDateOverride = null, providedNoteOverride = null, currentFileNumber = null, totalFiles = null, onlyExistingMetricsOverride = null, customInstructionsOverride = null) => {
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
        setDocumentProgress({ current: 0, total: 0 }); // Reset document progress
        // Small delay to ensure overlay renders before heavy processing
        await new Promise(resolve => setTimeout(resolve, 100));
        addDebugLog('Upload overlay should be visible', 'success');
      }
      
      const fileProgressPrefix = currentFileNumber && totalFiles 
        ? `[File ${currentFileNumber}/${totalFiles}] ` 
        : '';
      
      addDebugLog('Starting document processing', 'info');
      setUploadProgress(`${fileProgressPrefix}Reading document...`);

      // Get document date, note, custom instructions, and onlyExistingMetrics (user-provided or null)
      // Use override parameters if provided (from onUploadClick), otherwise use state
      const providedDate = providedDateOverride !== null ? providedDateOverride : pendingDocumentDate;
      const providedNote = providedNoteOverride !== null ? providedNoteOverride : pendingDocumentNote;
      const providedCustomInstructions = customInstructionsOverride !== null ? customInstructionsOverride : pendingCustomInstructions;
      const onlyExistingMetrics = onlyExistingMetricsOverride !== null ? onlyExistingMetricsOverride : pendingOnlyExistingMetrics;
      // Clear pending values after use
      setPendingDocumentDate(null);
      setPendingDocumentNote(null);
      setPendingCustomInstructions(null);
      setPendingOnlyExistingMetrics(false);

      // For ZIP files, read the file ONCE before processing and store as ArrayBuffer
      // File objects can only be read once, so we need to read it before it gets consumed
      let fileArrayBuffer = null;
      const isZip = file.name?.toLowerCase().endsWith('.zip') || file.type === 'application/zip';
      
      if (isZip) {
        try {
          setUploadProgress(`${fileProgressPrefix}Reading ZIP file...`);
          fileArrayBuffer = await file.arrayBuffer();
          
          if (!fileArrayBuffer || fileArrayBuffer.byteLength === 0) {
            throw new Error('ZIP file appears to be empty or could not be read');
          }
        } catch (readErr) {
          logger.error('[FilesTab] Error pre-reading ZIP file:', readErr);
          logger.error('[FilesTab] Error details:', {
            name: readErr.name,
            message: readErr.message,
            fileSize: file.size,
            fileName: file.name
          });
          throw new Error(`Failed to read ZIP file: ${readErr.message || 'File may be corrupted or already in use'}`);
        }
      }

      // Step 1: Process document with AI to extract medical data
      setUploadProgress(`${fileProgressPrefix}Analyzing document with AI...`);
      setAiStatus('Analyzing document...');
      setExtractedDataCounts(null); // Reset counts
      
      // For ZIP files, pass the ArrayBuffer directly to processing
      // extractDicomFilesFromZip now accepts ArrayBuffer, so we don't need to create a File
      // This avoids the "file already read" error
      const fileForProcessing = (isZip && fileArrayBuffer) 
        ? fileArrayBuffer  // Pass ArrayBuffer directly instead of creating a File
        : file;
      
      const processingResult = await processDocument(
        fileForProcessing,
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
        onlyExistingMetrics,
        docType, // Pass document type from modal to skip classification
        providedCustomInstructions // Pass custom instructions
      );
      
      // Handle ZIP archives - show choice: View Now or Save to Library
      if (processingResult.isZipArchive) {
        const totalFiles = processingResult.totalFiles || (processingResult.extractedFiles ? processingResult.extractedFiles.length : 0);

        if (totalFiles === 0) {
          throw new Error('No scan files found in ZIP archive. Please ensure the ZIP contains .dcm files or CT/MRI/PET scan images.');
        }

        // Show choice modal: View Now (instant) or Save to Library (upload to Firebase)
        // CRITICAL: Ensure fileArrayBuffer is set before creating the modal
        if (!fileArrayBuffer) {
          logger.error('[FilesTab] ERROR: fileArrayBuffer is null when creating modal!');
          throw new Error('Failed to prepare ZIP file for viewing. The file may have been read already.');
        }
        
        // Capture values in closure to ensure they're available when callback is called
        const capturedArrayBuffer = fileArrayBuffer;
        const capturedFile = file;
        
        setZipChoiceModal({
          file: capturedFile,
          fileArrayBuffer: capturedArrayBuffer, // Pass the pre-read arrayBuffer
          processingResult,
          totalFiles,
          onViewNow: async () => {
            setZipChoiceModal(null);
            setIsUploading(true);
            setUploadProgress('Preparing ZIP for viewing...');
            try {
              // Use the pre-read ArrayBuffer directly (more reliable than creating a new File)
              // prepareZipForViewing now accepts ArrayBuffer directly
              if (!capturedArrayBuffer) {
                logger.error('[FilesTab] ERROR: capturedArrayBuffer is null or undefined!');
                throw new Error('ZIP file data is not available. The file may have been read already. Please try uploading again.');
              }
              
              if (!(capturedArrayBuffer instanceof ArrayBuffer)) {
                logger.error('[FilesTab] ERROR: capturedArrayBuffer is not an ArrayBuffer!', typeof capturedArrayBuffer, capturedArrayBuffer);
                throw new Error('ZIP file data is in an invalid format. Please try uploading again.');
              }
              
              // Ensure we're passing the ArrayBuffer, not the File
              const zipViewerResult = await prepareZipForViewing(
                capturedArrayBuffer, // Use the captured ArrayBuffer directly
                (current, total, message) => {
                  if (message) setUploadProgress(message);
                }
              );
              if (!zipViewerResult.success) {
                throw new Error(zipViewerResult.error || 'Failed to prepare ZIP for viewing');
              }
              if (onOpenDicomViewer) {
                // Prepare viewer data with ZIP source format
                // Pass loadSeriesFiles for lazy loading - files will be loaded on-demand
                const viewerData = {
                  source: 'zip',
                  zipFile: capturedFile, // Use the captured file reference
                  zip: zipViewerResult.zip,
                  series: zipViewerResult.series.map(s => ({
                    id: s.id,
                    label: s.label,
                    studyInstanceUID: s.studyInstanceUID,
                    seriesInstanceUID: s.seriesInstanceUID,
                    modality: s.modality,
                    bodyPartExamined: s.bodyPartExamined,
                    fileIndices: s.fileIndices || [] // Store indices for lazy loading
                  })),
                  dicomDirStructure: zipViewerResult.dicomDirStructure,
                  loadSeriesFiles: zipViewerResult.loadSeriesFiles // Pass lazy-loading function
                };
                onOpenDicomViewer(viewerData);
              }
              setIsUploading(false);
              showSuccess(`ZIP loaded for viewing (${totalFiles} files)`);
            } catch (error) {
              logger.error('Error preparing ZIP for viewing:', error);
              showError(`Failed to load ZIP for viewing: ${error.message || 'Unknown error'}`);
              setIsUploading(false);
            }
          },
          onSaveToLibrary: async () => {
            setZipChoiceModal(null);
            const extractOnDemand = processingResult.extractOnDemand === true;
            const extractFile = processingResult.extractFile;
            const entries = processingResult.entries || null;
            const dicomDirStructure = processingResult.dicomDirStructure || null;

            // Initialize document progress tracking - show 0/0 initially, then update to 0/totalFiles
            setDocumentProgress({ current: 0, total: 0 });
            setUploadProgress(`${fileProgressPrefix}${extractOnDemand ? 'Preparing to process' : 'Extracting scan files from ZIP'}...`);

            // Small delay to show initial state, then update with actual count
            await new Promise(resolve => setTimeout(resolve, 100));
            setDocumentProgress({ current: 0, total: totalFiles });
            setUploadProgress(`${fileProgressPrefix}Processing ${totalFiles} scan file${totalFiles !== 1 ? 's' : ''} from ZIP...`);

            // Track successes and failures
            let successCount = 0;
            let failureCount = 0;
            const failedFiles = [];

            // Process and upload DICOM files in batches
            // For large ZIPs with on-demand extraction, use smaller batches to save memory
            // For small ZIPs, use larger batches for better performance
            const BATCH_SIZE = extractOnDemand ? 3 : 5;
            const totalBatches = Math.ceil(totalFiles / BATCH_SIZE);
        
        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
          const batchStartIndex = batchIndex * BATCH_SIZE;
          const batchEndIndex = Math.min(batchStartIndex + BATCH_SIZE, totalFiles);
          const batchSize = batchEndIndex - batchStartIndex;
          
          setUploadProgress(`${fileProgressPrefix}Processing batch ${batchIndex + 1}/${totalBatches} (${batchSize} files)...`);
          
          // Process batch in parallel
          const batchPromises = [];
          
          for (let fileIndex = batchStartIndex; fileIndex < batchEndIndex; fileIndex++) {
            const promise = (async () => {
              const displayIndex = fileIndex + 1;
              
              try {
                // Extract file if on-demand, otherwise use pre-extracted file
                let dicomFile;
                if (extractOnDemand) {
                  if (!extractFile) {
                    throw new Error('Extract function not available for on-demand extraction');
                  }
                  dicomFile = await extractFile(fileIndex);
                } else {
                  dicomFile = processingResult.extractedFiles[fileIndex];
                  if (!dicomFile) {
                    throw new Error(`File at index ${fileIndex} not found`);
                  }
                }
                
                // Process the DICOM file
                const dicomProcessingResult = await processDocument(
                  dicomFile,
                  user.uid,
                  patientProfile,
                  providedDate,
                  providedNote,
                  null,
                  (message, status) => {
                    if (status) {
                      setAiStatus(`[${displayIndex}/${totalFiles}] ${status}`);
                    }
                  },
                  onlyExistingMetrics,
                  'Scan', // DICOM files are always scans
                  null // No custom instructions for extracted files
                );
                
                // Upload the DICOM file to Firebase Storage
                const noteToSave = (providedNote && typeof providedNote === 'string' && providedNote.trim() !== '')
                  ? providedNote.trim()
                  : (providedNote || null);
                
                const dateForFilename = providedDate || dicomProcessingResult.extractedDate || null;
                const dicomDirMeta = entries?.[fileIndex]?.dicomDirMeta || null;

                await uploadDocument(dicomFile, user.uid, {
                  category: 'Scan',
                  documentType: 'Scan',
                  date: dateForFilename,
                  note: noteToSave,
                  dataPointCount: dicomProcessingResult.dataPointCount || 0,
                  dicomMetadata: dicomProcessingResult.dicomMetadata || null,
                  dicomDirMeta: dicomDirMeta || undefined,
                  isZipBatch: true, // Flag to skip rate limit for ZIP batch uploads
                });

                const uploadedFileName = dicomFile?.name || `File ${displayIndex}`;
                if (extractOnDemand) dicomFile = null;

                return { success: true, fileName: uploadedFileName };
              } catch (error) {
                logger.error(`Error processing DICOM file ${fileIndex + 1} from ZIP:`, error);
                return {
                  success: false,
                  fileName: `File ${displayIndex}`,
                  error: error.message || 'Unknown error'
                };
              }
            })();
            
            batchPromises.push(promise);
          }
          
          // Wait for batch to complete
          const batchResults = await Promise.all(batchPromises);
          
          // Count successes and failures
          batchResults.forEach(result => {
            if (result.success) {
              successCount++;
            } else {
              failureCount++;
              failedFiles.push({
                fileName: result.fileName,
                error: result.error
              });
            }
          });
          
          // Update document progress
          const processedCount = successCount + failureCount;
          setDocumentProgress({ current: processedCount, total: totalFiles });
          
          // Update progress message
          setUploadProgress(`${fileProgressPrefix}Processed ${processedCount}/${totalFiles} files...`);
          
            // For large ZIPs, add a small delay between batches to allow garbage collection
            if (extractOnDemand && batchIndex < totalBatches - 1) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }

          // Clear document progress when done
          setDocumentProgress({ current: 0, total: 0 });

          // Show appropriate message based on results
          if (successCount === 0) {
            const errorDetails = failedFiles.length > 0
              ? `\n\nFailed files:\n${failedFiles.map((f, idx) => `${idx + 1}. ${f.fileName}: ${f.error}`).join('\n')}`
              : '';
            throw new Error(`Failed to process all ${totalFiles} scan file${totalFiles !== 1 ? 's' : ''} from ZIP archive.${errorDetails}`);
          } else if (failureCount > 0) {
            const errorDetails = failedFiles.length <= 5
              ? `\n\nFailed files:\n${failedFiles.map((f, idx) => `${idx + 1}. ${f.fileName}: ${f.error}`).join('\n')}`
              : `\n\n${failedFiles.length} files failed. First 5 errors:\n${failedFiles.slice(0, 5).map((f, idx) => `${idx + 1}. ${f.fileName}: ${f.error}`).join('\n')}`;
            showError(`Processed ${successCount} of ${totalFiles} scan file${totalFiles !== 1 ? 's' : ''} successfully. ${failureCount} file${failureCount !== 1 ? 's' : ''} failed.${errorDetails}`);
          } else {
            showSuccess(`Successfully processed ${successCount} scan file${successCount !== 1 ? 's' : ''} from ZIP archive`);
          }

          // Reload documents and health data
          setUploadProgress(`${fileProgressPrefix}Refreshing document list...`);
          try {
            await reloadHealthData();
            const updatedDocs = await documentService.getDocuments(user.uid);

            if (updatedDocs.length === 0) {
              console.warn('WARNING: No documents found after ZIP processing. Files may not have been saved correctly.');
              showError('Files were processed but could not be found. Please refresh the page or check the console for errors.');
            }

            setDocuments(updatedDocs);
            setHasUploadedDocument(updatedDocs.length > 0);
          } catch (reloadError) {
            logger.error('Error reloading documents after ZIP processing:', reloadError);
            showError('Files were processed but there was an error loading them. Please refresh the page.');
          }

          setIsUploading(false);
          setUploadProgress('');
          setAiStatus(null);
          return;
          }
        });

        return; // Exit early - user will choose via modal
      }
      
      // Extract data counts from processing result (for non-ZIP files)
      if (processingResult.extractedData) {
        const counts = {
          labs: processingResult.extractedData.labs?.length || 0,
          vitals: processingResult.extractedData.vitals?.length || 0,
          mutations: processingResult.extractedData.genomic?.mutations?.length || 0,
          medications: processingResult.extractedData.medications?.length || 0,
          hasGenomic: !!processingResult.extractedData.genomic
        };
        setExtractedDataCounts(counts);
        setCurrentDocumentType(processingResult.documentType);
      }

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
        dataPointCount: processingResult.dataPointCount || 0,
        dicomMetadata: processingResult.dicomMetadata || null // Include DICOM metadata if present
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
        setExtractedDataCounts(null);
        setCurrentDocumentType(null);
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

        // Store summary in sessionStorage for ChatTab to pick up (if user navigates to chat)
        // No longer navigating away - chat is available on all screens
        sessionStorage.setItem('uploadSummary', JSON.stringify({
          summary: chatSummary,
          timestamp: Date.now(),
          documentType: processingResult.documentType || docType
        }));
      }
    } catch (error) {
      // Only show error and close overlay if not part of a batch (batch handler will show summary)
      if (currentFileNumber === null) {
        // Provide more helpful error messages based on error type
        let errorMessage = error.message || 'Unknown error occurred';
        
        // Enhance error messages for common issues
        if (errorMessage.includes('ZIP') || errorMessage.includes('zip')) {
          errorMessage = `Failed to process ZIP file: ${errorMessage}\n\nPlease ensure:\n- The file is a valid ZIP archive\n- The ZIP contains scan images (.dcm or from imaging CDs)\n- The file is not corrupted`;
        } else if (errorMessage.includes('DICOM') || errorMessage.includes('dicom') || errorMessage.includes('scan')) {
          errorMessage = `Failed to process scan file: ${errorMessage}\n\nPlease ensure:\n- The file is a valid CT/MRI/PET scan format\n- The file is not corrupted\n- Try uploading individual files if ZIP upload fails`;
        } else if (errorMessage.includes('validation') || errorMessage.includes('File type not allowed')) {
          errorMessage = `File validation failed: ${errorMessage}\n\nSupported file types: PDF, images, documents, scan files (.dcm), and ZIP archives of scan images`;
        } else if (errorMessage.includes('size') || errorMessage.includes('too large')) {
          errorMessage = `File size error: ${errorMessage}\n\nMaximum file size is 50MB for scan files and ZIP archives`;
        }
        
        showError(`Failed to process document: ${errorMessage}\n\nThe file was not uploaded. Please try again or contact support if the issue persists.`);
        setIsUploading(false);
        setUploadProgress('');
        setAiStatus(null);
        setExtractedDataCounts(null);
        setCurrentDocumentType(null);
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
          bgColor: DesignTokens.moduleAccent.files.bg,
          iconColor: DesignTokens.moduleAccent.files.text,
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
              <div className={combineClasses('w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4', DesignTokens.colors.app[100])}>
                <Loader2 className={combineClasses('w-8 h-8 animate-spin', DesignTokens.colors.app.text[600])} />
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
        'flex items-center justify-between'
      )}>
        <div className={combineClasses('flex items-center', DesignTokens.spacing.gap.sm, 'sm:gap-3')}>
          <div className={combineClasses(DesignTokens.moduleAccent.files.bg, 'p-2 sm:p-2.5 rounded-lg')}>
            <FileText className={combineClasses('w-5 h-5 sm:w-6 sm:h-6', DesignTokens.moduleAccent.files.text)} />
          </div>
          <div>
            <h1 className={combineClasses(DesignTokens.components.header.title, 'mb-0')}>Documents</h1>
          </div>
        </div>
        {/* Mobile Ask Button */}
        {onOpenMobileChat && (
          <button
            onClick={async () => {
              if (!user?.uid) return;
              try {
                if (activeSubTab === 'notes') {
                  const entries = await getNotebookEntries(user.uid, { limit: 50 });
                  sessionStorage.setItem('currentNotebookContext', JSON.stringify({ entries }));
                } else {
                  sessionStorage.setItem('currentDocumentContext', JSON.stringify({ documents }));
                }
                onOpenMobileChat();
              } catch (error) {
                showError('Error loading data. Please try again.');
              }
            }}
            className="lg:hidden text-medical-neutral-600 hover:text-medical-neutral-900 min-h-[44px] min-w-[44px] px-2 touch-manipulation active:opacity-70 flex items-center justify-center transition-colors"
            title="Ask about documents"
          >
            <Bot className="w-6 h-6" />
          </button>
        )}
      </div>
      <div className={combineClasses(Layouts.container, Layouts.section)}>

        {/* Debug panel removed - no longer showing debug logs */}

      {/* Tab Navigation with Ask About Button */}
      <div className={combineClasses('flex items-center', DesignTokens.spacing.gap.responsive.md, Layouts.section, 'overflow-x-auto')}>
        {/* Tab Navigation */}
        <div className={combineClasses('flex', DesignTokens.spacing.gap.responsive.xs, 'overflow-x-auto', 'flex-1', 'mb-0')}>
          <button
            onClick={() => setActiveSubTab('notes')}
            className={combineClasses(
              DesignTokens.components.tabs.button.base,
              activeSubTab === 'notes'
                ? DesignTokens.components.tabs.button.active
                : DesignTokens.components.tabs.button.inactive
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
                ? DesignTokens.components.tabs.button.active
                : DesignTokens.components.tabs.button.inactive
            )}
          >
            <FolderOpen className={DesignTokens.icons.button.size.full} />
            <span className={DesignTokens.typography.body.base}>Files</span>
          </button>
        </div>
      </div>

      {/* Documents Tab Content */}
      {activeSubTab === 'documents' && (
        <div className={combineClasses(DesignTokens.components.card.container)}>
        <>
        {documents.length > 0 && (
          <div className={combineClasses('flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0', DesignTokens.spacing.section.mobile)}>
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
            <span>Medical Documents</span>
            {documents.length > 0 && (
              <span className={combineClasses(
                'px-2 py-0.5 rounded-full text-xs font-medium',
                DesignTokens.colors.neutral[200],
                DesignTokens.colors.neutral.text[600]
              )}>
                {documents.length}
              </span>
            )}
          </div>
            <div className={combineClasses('flex flex-row justify-start gap-2')}>
              <button
                onClick={() => openDocumentOnboarding('general')}
                className={combineClasses(
                  'flex items-center gap-1.5 min-h-[44px] py-2 px-3 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200',
                  DesignTokens.components.button.outline.primary,
                  'hover:bg-medical-secondary-50 hover:border-medical-secondary-400 hover:text-medical-secondary-700'
                )}
              >
                <Upload className="w-4 h-4 flex-shrink-0" />
                <span>Add File</span>
              </button>
              <button
                onClick={handleImportDicom}
                className={combineClasses(
                  'flex items-center gap-1.5 min-h-[44px] py-2 px-3 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200',
                  DesignTokens.components.button.outline.primary,
                  'hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700'
                )}
              >
                <FileImage className="w-4 h-4 flex-shrink-0" />
                <span>View scans</span>
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
            <p className={combineClasses(DesignTokens.components.emptyState.message, DesignTokens.colors.neutral.text[600])}>Upload lab results, clinical reports, or genomic test results. View CT/MRI/PET scans separately.</p>
            <div className={combineClasses(DesignTokens.components.emptyState.actions, 'flex flex-col sm:flex-row gap-3')}>
              <button
                onClick={() => openDocumentOnboarding('general')}
                className={combineClasses(
                  DesignTokens.components.button.primary,
                  DesignTokens.spacing.button.full,
                  'py-2.5 sm:py-3 font-medium min-h-[44px] touch-manipulation active:opacity-70'
                )}
              >
                <Upload className={DesignTokens.icons.button.size.full} />
                Upload Your First Document
              </button>
              <button
                onClick={handleImportDicom}
                className={combineClasses(
                  DesignTokens.components.button.secondary || 'bg-white border-2 border-blue-500 text-blue-600 hover:bg-blue-50',
                  DesignTokens.spacing.button.full,
                  'py-2.5 sm:py-3 font-medium min-h-[44px] touch-manipulation active:opacity-70'
                )}
              >
                <FileImage className={DesignTokens.icons.button.size.full} />
                View scans
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
                  DesignTokens.components.input.withIcon
                )}
              />
            </div>
            
            {/* Filtered Documents */}
            <div className="space-y-2">
              {(() => {
                // First, filter documents
                const filteredDocs = documents.filter(doc => {
                  if (!documentSearchQuery.trim()) return true;
                  const query = documentSearchQuery.toLowerCase();
                  const fileName = (doc.fileName || doc.name || 'Untitled Document').toLowerCase();
                  const docType = (doc.documentType || doc.type || '').toLowerCase();
                  const note = (doc.note || '').toLowerCase();
                  const label = getIconConfig(doc.documentType || doc.type).label.toLowerCase();
                  return fileName.includes(query) || docType.includes(query) || note.includes(query) || label.includes(query);
                });

                // Group DICOM files by study/series. Prefer dicomDirMeta (from DICOMDIR) when available.
                function formatStudyDate(d) {
                  if (!d || typeof d !== 'string') return null;
                  if (d.match(/^\d{8}$/)) return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
                  return d;
                }
                const dicomGroups = new Map();
                const nonDicomDocs = [];

                filteredDocs.forEach(doc => {
                  const isDicom = doc.dicomMetadata ||
                    (doc.fileName && (doc.fileName.toLowerCase().endsWith('.dcm') || doc.fileName.toLowerCase().endsWith('.dicom'))) ||
                    (doc.fileType && (doc.fileType === 'application/dicom' || doc.fileType === 'application/x-dicom'));

                  if (isDicom && doc.dicomMetadata) {
                    const md = doc.dicomMetadata;
                    const ddm = doc.dicomDirMeta || null;
                    const studyUID = (ddm?.study?.studyInstanceUID) || md.studyInstanceUID;
                    const seriesUID = (ddm?.series?.seriesInstanceUID) || md.seriesInstanceUID;
                    const groupKey = seriesUID || studyUID;

                    if (groupKey) {
                      if (!dicomGroups.has(groupKey)) {
                        dicomGroups.set(groupKey, {
                          key: groupKey,
                          studyInstanceUID: studyUID,
                          seriesInstanceUID: seriesUID,
                          studyDescription: (ddm?.study?.studyDescription) ?? md.studyDescription,
                          studyDate: (ddm?.study?.studyDate) ?? md.studyDate,
                          studyDateFormatted: md.studyDateFormatted || (ddm?.study?.studyDate && formatStudyDate(ddm.study.studyDate)),
                          modality: (ddm?.series?.modality) ?? md.modality,
                          bodyPartExamined: (ddm?.series?.bodyPartExamined) ?? md.bodyPartExamined,
                          institutionName: md.institutionName,
                          files: [],
                        });
                      }
                      dicomGroups.get(groupKey).files.push(doc);
                    } else {
                      nonDicomDocs.push(doc);
                    }
                  } else {
                    nonDicomDocs.push(doc);
                  }
                });

                // Convert groups to array and sort files by instance number (slice position) for proper viewing
                const groupsArray = Array.from(dicomGroups.values()).map(group => {
                  const dates = group.files
                    .map(f => f.dicomDirMeta?.study?.studyDate || f.dicomMetadata?.studyDate || f.dicomMetadata?.studyDateFormatted || f.date)
                    .filter(d => d)
                    .map(d => {
                      // Try to parse date - could be YYYYMMDD or YYYY-MM-DD
                      if (typeof d === 'string') {
                        if (d.match(/^\d{8}$/)) {
                          // YYYYMMDD format
                          return new Date(d.substring(0, 4), parseInt(d.substring(4, 6)) - 1, d.substring(6, 8));
                        } else if (d.match(/^\d{4}-\d{2}-\d{2}/)) {
                          // YYYY-MM-DD format
                          return new Date(d);
                        }
                      }
                      return d ? new Date(d) : null;
                    })
                    .filter(d => d && !isNaN(d.getTime()));
                  
                  let dateRange = null;
                  if (dates.length > 0) {
                    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
                    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
                    
                    // Format as YYYY-MM or YYYY if all in same month
                    const minYear = minDate.getFullYear();
                    const minMonth = minDate.getMonth() + 1;
                    const maxYear = maxDate.getFullYear();
                    const maxMonth = maxDate.getMonth() + 1;
                    
                    if (minYear === maxYear && minMonth === maxMonth) {
                      // All files from same month
                      dateRange = `${minYear}-${String(minMonth).padStart(2, '0')}`;
                    } else if (minYear === maxYear) {
                      // Same year, different months
                      dateRange = `${minYear}-${String(minMonth).padStart(2, '0')} to ${String(maxMonth).padStart(2, '0')}`;
                    } else {
                      // Different years
                      dateRange = `${minYear}-${String(minMonth).padStart(2, '0')} to ${maxYear}-${String(maxMonth).padStart(2, '0')}`;
                    }
                  }
                  
                  return {
                    ...group,
                    dateRange, // Add date range to group
                    files: group.files.sort((a, b) => {
                      const instanceA = a.dicomDirMeta?.image?.instanceNumber ?? a.dicomMetadata?.instanceNumber;
                      const instanceB = b.dicomDirMeta?.image?.instanceNumber ?? b.dicomMetadata?.instanceNumber;
                      if (instanceA != null && instanceB != null) {
                        const numA = parseInt(instanceA, 10) || 0;
                        const numB = parseInt(instanceB, 10) || 0;
                        return numA - numB;
                      }
                      const sliceA = a.dicomDirMeta?.image?.sliceLocation ?? a.dicomMetadata?.sliceLocation;
                      const sliceB = b.dicomDirMeta?.image?.sliceLocation ?? b.dicomMetadata?.sliceLocation;
                      if (sliceA != null && sliceB != null) {
                        return (parseFloat(sliceA) || 0) - (parseFloat(sliceB) || 0);
                      }
                      return (a.date || a.createdAt || 0) - (b.date || b.createdAt || 0);
                    })
                  };
                }).sort((a, b) => {
                  // Sort groups by study date (newest first)
                  const dateA = a.studyDate || a.files[0]?.date || a.files[0]?.createdAt || 0;
                  const dateB = b.studyDate || b.files[0]?.date || b.files[0]?.createdAt || 0;
                  return dateB - dateA;
                });

                // Combine groups and non-DICOM docs, interleaving by date
                const allItems = [...groupsArray, ...nonDicomDocs].sort((a, b) => {
                  const dateA = a.studyDate || a.date || a.createdAt || (a.files?.[0]?.date || a.files?.[0]?.createdAt) || 0;
                  const dateB = b.studyDate || b.date || b.createdAt || (b.files?.[0]?.date || b.files?.[0]?.createdAt) || 0;
                  return dateB - dateA;
                });

                return allItems.map((item, index) => {
                  // Check if this is a DICOM group
                  if (item.files && item.files.length > 0) {
                    // This is a DICOM group
                    const group = item;
                    const isExpanded = expandedDicomGroups.has(group.key);
                    const groupDoc = group.files[0]; // Use first file for display
                    const iconConfig = getIconConfig(groupDoc.documentType || groupDoc.type);
                    const groupName = group.studyDescription || 
                                     (group.modality ? `${group.modality} Study` : null) ||
                                     `Scan study (${group.files.length} file${group.files.length !== 1 ? 's' : ''})`;

                    return (
                      <div
                        key={`dicom-group-${group.key}`}
                        data-dicom-group-key={group.key}
                        className={combineClasses(
                          DesignTokens.components.card.base,
                          DesignTokens.borders.radius.lg,
                          DesignTokens.spacing.card.full,
                          'relative',
                          'hover:shadow-md',
                          DesignTokens.transitions.default
                        )}
                      >
                        {/* Group Header */}
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div
                              className={combineClasses(
                                'flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center',
                                iconConfig.bgColor
                              )}
                            >
                              {iconConfig.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className={combineClasses(
                                  DesignTokens.typography.body.base,
                                  'font-semibold',
                                  DesignTokens.colors.neutral.text[900],
                                  'truncate'
                                )}>
                                  {groupName}
                                </h3>
                                <span className={combineClasses(
                                  'px-2 py-0.5 rounded-full text-xs font-medium',
                                  DesignTokens.colors.neutral[200],
                                  DesignTokens.colors.neutral.text[600]
                                )}>
                                  {group.files.length} file{group.files.length !== 1 ? 's' : ''}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 mt-1 flex-wrap">
                                {group.modality && (
                                  <span className={combineClasses(
                                    DesignTokens.typography.body.sm,
                                    DesignTokens.colors.neutral.text[600]
                                  )}>
                                    {group.modality}
                                  </span>
                                )}
                                {group.bodyPartExamined && (
                                  <span className={combineClasses(
                                    DesignTokens.typography.body.sm,
                                    DesignTokens.colors.neutral.text[600]
                                  )}>
                                    {group.bodyPartExamined}
                                  </span>
                                )}
                                {group.dateRange && (
                                  <span className={combineClasses(
                                    DesignTokens.typography.body.sm,
                                    DesignTokens.colors.neutral.text[500],
                                    'font-medium'
                                  )}>
                                    {group.dateRange}
                                  </span>
                                )}
                                {group.studyDateFormatted && !group.dateRange && (
                                  <span className={combineClasses(
                                    DesignTokens.typography.body.sm,
                                    DesignTokens.colors.neutral.text[500]
                                  )}>
                                    {group.studyDateFormatted}
                                  </span>
                                )}
                                {group.institutionName && (
                                  <span className={combineClasses(
                                    DesignTokens.typography.body.sm,
                                    DesignTokens.colors.neutral.text[500],
                                    'truncate max-w-xs'
                                  )}>
                                    {group.institutionName}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                // Open viewer with all files in the group
                                if (onOpenDicomViewer) {
                                  onOpenDicomViewer(group.files);
                                }
                              }}
                              className={combineClasses(
                                'px-3 py-1.5 rounded-md text-sm font-medium',
                                'transition-colors',
                                DesignTokens.colors.app[500],
                                'text-white',
                                'hover:' + DesignTokens.colors.app[600]
                              )}
                              title={`View all ${group.files.length} scan files in viewer`}
                            >
                              View All
                            </button>
                            <button
                              onClick={() => {
                                setExpandedDicomGroups(prev => {
                                  const next = new Set(prev);
                                  if (isExpanded) {
                                    next.delete(group.key);
                                  } else {
                                    next.add(group.key);
                                  }
                                  return next;
                                });
                              }}
                              className={combineClasses(
                                'px-3 py-1.5 rounded-md text-sm font-medium',
                                'transition-colors',
                                DesignTokens.colors.neutral[100],
                                DesignTokens.colors.neutral.text[700],
                                'hover:' + DesignTokens.colors.neutral[200]
                              )}
                            >
                              {isExpanded ? 'Collapse' : 'Expand'} ({group.files.length})
                            </button>
                            {/* Delete button for DICOM group */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const groupName = group.studyDescription || 
                                                group.modality || 
                                                `Scan study (${group.files.length} file${group.files.length !== 1 ? 's' : ''})`;
                                setDeleteConfirm({
                                  show: true,
                                  title: `Delete scan study?`,
                                  message: `This will permanently delete all ${group.files.length} scan file${group.files.length !== 1 ? 's' : ''} in this study "${groupName}". This action cannot be undone.`,
                                  itemName: `"${groupName}"`,
                                  confirmText: 'Yes, Delete Permanently',
                                  onConfirm: async () => {
                                    try {
                                      setIsDeleting(true);
                                      
                                      // Delete all files in the group in parallel batches for better performance
                                      const BATCH_SIZE = 10; // Process 10 files at a time to avoid overwhelming Firebase
                                      const files = group.files;
                                      let successCount = 0;
                                      let failureCount = 0;
                                      
                                      for (let i = 0; i < files.length; i += BATCH_SIZE) {
                                        const batch = files.slice(i, i + BATCH_SIZE);
                                        const batchPromises = batch.map(async (doc) => {
                                          try {
                                            // Clean up associated health data for each file
                                            await cleanupDocumentData(doc.id, user.uid, false);
                                            // Delete the document
                                            await deleteDocument(doc.id, doc.storagePath, user.uid);
                                            return { success: true, fileName: doc.fileName };
                                          } catch (fileError) {
                                            logger.error(`Error deleting file ${doc.fileName}:`, fileError);
                                            return { success: false, fileName: doc.fileName, error: fileError };
                                          }
                                        });
                                        
                                        const batchResults = await Promise.all(batchPromises);
                                        batchResults.forEach(result => {
                                          if (result.success) {
                                            successCount++;
                                          } else {
                                            failureCount++;
                                          }
                                        });
                                      }
                                      
                                      // Reload documents
                                      const updatedDocs = await documentService.getDocuments(user.uid);
                                      setDocuments(updatedDocs);
                                      setHasUploadedDocument(updatedDocs.length > 0);
                                      
                                      // Reload health data to reflect deletions
                                      await reloadHealthData();
                                      
                                      if (failureCount > 0) {
                                        showError(`Deleted ${successCount} file${successCount !== 1 ? 's' : ''} successfully, but ${failureCount} file${failureCount !== 1 ? 's' : ''} failed to delete.`);
                                      } else {
                                        showSuccess(`Deleted ${successCount} scan file${successCount !== 1 ? 's' : ''} successfully.`);
                                      }
                                    } catch (error) {
                                      showError('Failed to delete scan study. Please try again.');
                                    } finally {
                                      setIsDeleting(false);
                                    }
                                  }
                                });
                              }}
                              className={combineClasses(
                                'px-3 py-1.5 rounded-md text-sm font-medium',
                                'transition-colors',
                                DesignTokens.components.status.high.text,
                                DesignTokens.components.status.high.bg,
                                'hover:bg-red-600',
                                'hover:text-white'
                              )}
                              title="Delete all files in this scan study"
                            >
                              <Trash2 className="w-4 h-4 inline mr-1" />
                              Delete
                            </button>
                          </div>
                        </div>

                        {/* Expanded Files List */}
                        {isExpanded && (
                          <div className="mt-4 space-y-2 border-t border-gray-200 pt-4">
                            {group.files.map((doc, fileIndex) => {
                              const fileIconConfig = getIconConfig(doc.documentType || doc.type);
                              const fileName = doc.fileName || doc.name || 'Untitled Document';
                              const fileDate = doc.date ? formatDateString(doc.date) : null;

                              const isHighlighted = highlightedDocumentId === doc.id;
                              return (
                                <div
                                  key={doc.id}
                                  data-document-id={doc.id}
                                  className={combineClasses(
                                    'flex items-center justify-between gap-4 p-3 rounded-lg',
                                    'hover:bg-gray-50',
                                    DesignTokens.transitions.default,
                                    isHighlighted ? 'bg-blue-50 border-2 border-blue-400 shadow-lg' : ''
                                  )}
                                >
                                  <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <div
                                      className={combineClasses(
                                        'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center',
                                        fileIconConfig.bgColor
                                      )}
                                    >
                                      {fileIconConfig.icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className={combineClasses(
                                        DesignTokens.typography.body.sm,
                                        'font-medium',
                                        DesignTokens.colors.neutral.text[900],
                                        'truncate'
                                      )}>
                                        {fileName}
                                      </div>
                                      {fileDate && (
                                        <div className={combineClasses(
                                          DesignTokens.typography.body.xs,
                                          DesignTokens.colors.neutral.text[500]
                                        )}>
                                          {fileDate}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  } else {
                    // Regular non-DICOM document
                    const doc = item;
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

              const isHighlighted = highlightedDocumentId === doc.id;
              return (
                <div 
                  key={doc.id} 
                  data-document-id={doc.id}
                  className={combineClasses(
                    DesignTokens.components.card.nested,
                    'relative flex flex-col sm:flex-row sm:items-center',
                    DesignTokens.spacing.gap.sm,
                    'sm:gap-3',
                    DesignTokens.transitions.default,
                    `hover:${DesignTokens.colors.neutral[50]}`,
                    isHighlighted ? 'bg-blue-50 border-2 border-blue-400 shadow-lg' : ''
                  )}>
                  {/* Action buttons - Desktop: individual buttons, Mobile: three-dot menu */}
                  <div className="absolute top-2 right-2 z-10">
                    {/* Mobile: Three-dot menu */}
                    <div className="relative sm:hidden">
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
                          'min-w-[32px] h-8 flex items-center justify-center touch-manipulation active:opacity-70',
                          DesignTokens.colors.neutral.text[500],
                          openMenuId === doc.id ? DesignTokens.colors.neutral[100] : '',
                          `hover:${DesignTokens.colors.neutral[100]}`,
                          `hover:${DesignTokens.colors.neutral.text[700]}`
                        )}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      
                      {/* Dropdown menu */}
                      {openMenuId === doc.id && (
                        <>
                          {/* Backdrop to close menu on outside click */}
                          <div
                            className="fixed inset-0 z-40"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(null);
                            }}
                          />
                          <div className={combineClasses(
                            'absolute top-full right-0 mt-1 min-w-[180px] rounded-lg shadow-lg z-50',
                            'bg-white border border-gray-200',
                            'py-1'
                          )}>
                            {/* View option */}
                            {doc.fileUrl && (() => {
                              const isDicom = doc.dicomMetadata || 
                                             (doc.fileName && (doc.fileName.toLowerCase().endsWith('.dcm') || doc.fileName.toLowerCase().endsWith('.dicom'))) ||
                                             (doc.fileType && (doc.fileType === 'application/dicom' || doc.fileType === 'application/x-dicom'));
                              
                              return (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenMenuId(null);
                                    if (isDicom) {
                                      if (onOpenDicomViewer) {
                                        onOpenDicomViewer([doc]);
                                      }
                                    } else {
                                      window.open(doc.fileUrl, '_blank', 'noopener,noreferrer');
                                    }
                                  }}
                                  className={combineClasses(
                                    'w-full px-4 py-2 text-left text-sm flex items-center gap-2',
                                    'hover:bg-gray-50',
                                    DesignTokens.colors.neutral.text[700]
                                  )}
                                >
                                  <Eye className="w-4 h-4" />
                                  {isDicom ? 'View scan' : 'View File'}
                                </button>
                              );
                            })()}
                            
                            {/* Metadata option */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuId(null);
                                setShowDocumentMetadata(doc);
                              }}
                              className={combineClasses(
                                'w-full px-4 py-2 text-left text-sm flex items-center gap-2',
                                'hover:bg-gray-50',
                                DesignTokens.colors.neutral.text[700]
                              )}
                            >
                              <Info className="w-4 h-4" />
                              View Metadata
                            </button>
                            
                            {/* Edit option */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuId(null);
                                setEditingDocumentNote(doc);
                              }}
                              className={combineClasses(
                                'w-full px-4 py-2 text-left text-sm flex items-center gap-2',
                                'hover:bg-gray-50',
                                DesignTokens.colors.neutral.text[700]
                              )}
                            >
                              <Edit2 className="w-4 h-4" />
                              Edit Name, Date & Note
                            </button>
                            
                            {/* Rescan option - show for processable document types */}
                            {(doc.documentType === 'Lab' || doc.type === 'Lab' || doc.documentType === 'Vitals' || doc.type === 'Vitals' || doc.documentType === 'Genomic' || doc.type === 'Genomic' || doc.documentType === 'blood-test') && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuId(null);
                                  setRescanDocument(doc);
                                }}
                                className={combineClasses(
                                  'w-full px-4 py-2 text-left text-sm flex items-center gap-2',
                                  'hover:bg-gray-50',
                                  DesignTokens.colors.neutral.text[700]
                                )}
                              >
                                <RefreshCw className="w-4 h-4" />
                                Rescan Document
                              </button>
                            )}
                            
                            {/* Divider */}
                            <div className="border-t border-gray-200 my-1" />
                            
                            {/* Delete option */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuId(null);
                                handleDelete(e);
                              }}
                              className={combineClasses(
                                'w-full px-4 py-2 text-left text-sm flex items-center gap-2',
                                'hover:bg-red-50',
                                DesignTokens.components.status.high.text
                              )}
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete Document
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                    
                    {/* Desktop: Individual buttons with tooltips */}
                    <div className="hidden sm:flex items-center gap-1">
                      {/* View button */}
                      {doc.fileUrl && (
                        <div className="relative">
                          {(() => {
                            // Check if this is a DICOM file
                            const isDicom = doc.dicomMetadata || 
                                           (doc.fileName && (doc.fileName.toLowerCase().endsWith('.dcm') || doc.fileName.toLowerCase().endsWith('.dicom'))) ||
                                           (doc.fileType && (doc.fileType === 'application/dicom' || doc.fileType === 'application/x-dicom'));
                            
                            if (isDicom) {
                              // DICOM file - open viewer modal
                              return (
                                <>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      if (onOpenDicomViewer) {
                                        onOpenDicomViewer([doc]);
                                      }
                                    }}
                                    className={combineClasses(
                                      DesignTokens.spacing.iconContainer.full,
                                      DesignTokens.borders.radius.full,
                                      DesignTokens.transitions.default,
                                      DesignTokens.spacing.touchTarget,
                                      'min-w-[32px] h-8 flex items-center justify-center touch-manipulation active:opacity-70',
                                      DesignTokens.colors.neutral.text[500],
                                      `hover:${DesignTokens.colors.neutral[100]}`,
                                      `hover:${DesignTokens.colors.neutral.text[700]}`
                                    )}
                                    onMouseEnter={() => setHoveredTooltip(`${doc.id}-view`)}
                                    onMouseLeave={() => setHoveredTooltip(null)}
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  {hoveredTooltip === `${doc.id}-view` && (
                                    <div className={combineClasses(
                                      'absolute top-full right-0 mt-1 px-2 py-1 rounded text-xs whitespace-nowrap z-50 pointer-events-none',
                                      'bg-gray-900 text-white shadow-lg'
                                    )}>
                                      View scan
                                    </div>
                                  )}
                                </>
                              );
                            } else {
                              // Regular file - open in new tab
                              return (
                                <>
                                  <a
                                    href={doc.fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={combineClasses(
                                      DesignTokens.spacing.iconContainer.full,
                                      DesignTokens.borders.radius.full,
                                      DesignTokens.transitions.default,
                                      DesignTokens.spacing.touchTarget,
                                      'min-w-[32px] h-8 flex items-center justify-center touch-manipulation active:opacity-70',
                                      DesignTokens.colors.neutral.text[500],
                                      `hover:${DesignTokens.colors.neutral[100]}`,
                                      `hover:${DesignTokens.colors.neutral.text[700]}`
                                    )}
                                    onClick={(e) => e.stopPropagation()}
                                    onMouseEnter={() => setHoveredTooltip(`${doc.id}-view`)}
                                    onMouseLeave={() => setHoveredTooltip(null)}
                                  >
                                    <Eye className="w-4 h-4" />
                                  </a>
                                  {hoveredTooltip === `${doc.id}-view` && (
                                    <div className={combineClasses(
                                      'absolute top-full right-0 mt-1 px-2 py-1 rounded text-xs whitespace-nowrap z-50 pointer-events-none',
                                      'bg-gray-900 text-white shadow-lg'
                                    )}>
                                      View File
                                    </div>
                                  )}
                                </>
                              );
                            }
                          })()}
                        </div>
                      )}

                      {/* Info/Metadata button */}
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setShowDocumentMetadata(doc);
                          }}
                          className={combineClasses(
                            DesignTokens.spacing.iconContainer.full,
                            DesignTokens.borders.radius.full,
                            DesignTokens.transitions.default,
                            DesignTokens.spacing.touchTarget,
                            'min-w-[32px] h-8 flex items-center justify-center touch-manipulation active:opacity-70',
                            DesignTokens.colors.neutral.text[500],
                            `hover:${DesignTokens.colors.neutral[100]}`,
                            `hover:${DesignTokens.colors.neutral.text[700]}`
                          )}
                          onMouseEnter={() => setHoveredTooltip(`${doc.id}-info`)}
                          onMouseLeave={() => setHoveredTooltip(null)}
                        >
                          <Info className="w-4 h-4" />
                        </button>
                        {hoveredTooltip === `${doc.id}-info` && (
                          <div className={combineClasses(
                            'absolute top-full right-0 mt-1 px-2 py-1 rounded text-xs whitespace-nowrap z-50 pointer-events-none',
                            'bg-gray-900 text-white shadow-lg'
                          )}>
                            View Metadata
                          </div>
                        )}
                      </div>
                      
                      {/* Edit button */}
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setEditingDocumentNote(doc);
                          }}
                          className={combineClasses(
                            DesignTokens.spacing.iconContainer.full,
                            DesignTokens.borders.radius.full,
                            DesignTokens.transitions.default,
                            DesignTokens.spacing.touchTarget,
                            'min-w-[32px] h-8 flex items-center justify-center touch-manipulation active:opacity-70',
                            DesignTokens.colors.neutral.text[500],
                            `hover:${DesignTokens.colors.neutral[100]}`,
                            `hover:${DesignTokens.colors.neutral.text[700]}`
                          )}
                          onMouseEnter={() => setHoveredTooltip(`${doc.id}-edit`)}
                          onMouseLeave={() => setHoveredTooltip(null)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {hoveredTooltip === `${doc.id}-edit` && (
                          <div className={combineClasses(
                            'absolute top-full right-0 mt-1 px-2 py-1 rounded text-xs whitespace-nowrap z-50 pointer-events-none',
                            'bg-gray-900 text-white shadow-lg'
                          )}>
                            Edit Name, Date & Note
                          </div>
                        )}
                      </div>

                      {/* Rescan button - show for processable document types */}
                      {(doc.documentType === 'Lab' || doc.type === 'Lab' || doc.documentType === 'Vitals' || doc.type === 'Vitals' || doc.documentType === 'Genomic' || doc.type === 'Genomic' || doc.documentType === 'blood-test') && (
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              setRescanDocument(doc);
                            }}
                            className={combineClasses(
                              DesignTokens.spacing.iconContainer.full,
                              DesignTokens.borders.radius.full,
                              DesignTokens.transitions.default,
                              DesignTokens.spacing.touchTarget,
                              'min-w-[32px] h-8 flex items-center justify-center touch-manipulation active:opacity-70',
                              DesignTokens.colors.neutral.text[500],
                              `hover:${DesignTokens.colors.neutral[100]}`,
                              `hover:${DesignTokens.colors.neutral.text[700]}`
                            )}
                            onMouseEnter={() => setHoveredTooltip(`${doc.id}-rescan`)}
                            onMouseLeave={() => setHoveredTooltip(null)}
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                          {hoveredTooltip === `${doc.id}-rescan` && (
                            <div className={combineClasses(
                              'absolute top-full right-0 mt-1 px-2 py-1 rounded text-xs whitespace-nowrap z-50 pointer-events-none',
                              'bg-gray-900 text-white shadow-lg'
                            )}>
                              Rescan Document
                            </div>
                          )}
                        </div>
                      )}

                      {/* Delete button */}
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            handleDelete(e);
                          }}
                          className={combineClasses(
                            DesignTokens.spacing.iconContainer.full,
                            DesignTokens.borders.radius.full,
                            DesignTokens.transitions.default,
                            DesignTokens.spacing.touchTarget,
                            'min-w-[32px] h-8 flex items-center justify-center touch-manipulation active:opacity-70',
                            DesignTokens.components.status.high.text,
                            `hover:${DesignTokens.components.status.high.bg}`
                          )}
                          onMouseEnter={() => setHoveredTooltip(`${doc.id}-delete`)}
                          onMouseLeave={() => setHoveredTooltip(null)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        {hoveredTooltip === `${doc.id}-delete` && (
                          <div className={combineClasses(
                            'absolute top-full right-0 mt-1 px-2 py-1 rounded text-xs whitespace-nowrap z-50 pointer-events-none',
                            'bg-gray-900 text-white shadow-lg'
                          )}>
                            Delete Document
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className={combineClasses('flex items-center flex-1 min-w-0 pr-20 sm:pr-24', DesignTokens.spacing.gap.sm, 'sm:gap-3')}>
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 ${iconConfig.bgColor} rounded-lg flex items-center justify-center flex-shrink-0`}>
                      <div className={`${iconConfig.iconColor} w-5 h-5 sm:w-6 sm:h-6`}>
                        {iconConfig.icon}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={combineClasses(DesignTokens.typography.body.base, 'font-semibold truncate')}>{fileName}</p>
                      <div className={combineClasses('flex items-center gap-2 mt-0.5 flex-wrap')}>
                        <p className={combineClasses(DesignTokens.typography.body.xs, DesignTokens.colors.neutral.text[700])}>{iconConfig.label}</p>
                        {doc.dataPointCount !== undefined && doc.dataPointCount !== null && doc.dataPointCount > 0 && (
                          <span className={combineClasses(
                            'px-2 py-0.5 rounded-full text-xs font-medium',
                            DesignTokens.moduleAccent.files.bg,
                            DesignTokens.moduleAccent.files.text
                          )}>
                            {doc.dataPointCount} data point{doc.dataPointCount !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      {doc.note && (
                        <p className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.colors.app.text[600], 'mt-1 sm:mt-0.5 italic break-words line-clamp-2 sm:line-clamp-none')}>{doc.note}</p>
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
                  
                </div>
              );
                }
              });
                })()}
          </div>
          </div>
        )}
        </>
        </div>
      )}

      {/* Notes Tab Content */}
      {activeSubTab === 'notes' && (
        <div className={combineClasses(
          DesignTokens.components.card.container
        )}>
        {notebookEntries.length > 0 && (
          <div className={combineClasses('flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0', DesignTokens.spacing.section.mobile)}>
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
            <div className={combineClasses('flex flex-row justify-start gap-2')}>
              <button
                onClick={() => {
                  setAddNoteDate(null);
                  setShowAddJournalNote(true);
                }}
                className={combineClasses(
                  'flex items-center gap-1.5 min-h-[44px] py-2 px-3 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200',
                  DesignTokens.components.button.outline.primary,
                  'hover:bg-medical-secondary-50 hover:border-medical-secondary-400 hover:text-medical-secondary-700'
                )}
              >
                <Plus className="w-4 h-4 flex-shrink-0" />
                <span>Add Entry</span>
              </button>
              <button
                onClick={handleImportDayOne}
                className={combineClasses(
                  'flex items-center gap-1.5 min-h-[44px] py-2 px-3 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200',
                  DesignTokens.components.button.outline.primary,
                  'hover:bg-medical-secondary-50 hover:border-medical-secondary-400 hover:text-medical-secondary-700'
                )}
                title="Import vitals, symptoms, and notes from Day One journal export"
              >
                <FileText className="w-4 h-4 flex-shrink-0" />
                <span>Import Day One</span>
              </button>
            </div>
          </div>
        )}
        {notebookEntries.length === 0 && !isLoadingNotebook && (
          <div className={combineClasses('flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0', DesignTokens.spacing.section.mobile)}>
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
            <div className={combineClasses('flex flex-row justify-start gap-2')}>
              <button
                onClick={() => {
                  setAddNoteDate(null);
                  setShowAddJournalNote(true);
                }}
                className={combineClasses(
                  'flex items-center gap-1.5 min-h-[44px] py-2 px-3 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200',
                  DesignTokens.components.button.outline.primary,
                  'hover:bg-medical-secondary-50 hover:border-medical-secondary-400 hover:text-medical-secondary-700'
                )}
              >
                <Plus className="w-4 h-4 flex-shrink-0" />
                <span>Add Entry</span>
              </button>
              <button
                onClick={handleImportDayOne}
                className={combineClasses(
                  'flex items-center gap-1.5 min-h-[44px] py-2 px-3 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200',
                  DesignTokens.components.button.outline.primary,
                  'hover:bg-medical-secondary-50 hover:border-medical-secondary-400 hover:text-medical-secondary-700'
                )}
                title="Import vitals, symptoms, and notes from Day One journal export"
              >
                <FileText className="w-4 h-4 flex-shrink-0" />
                <span>Import Day One</span>
              </button>
            </div>
          </div>
        )}

        {isLoadingNotebook ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className={combineClasses('w-8 h-8 animate-spin', DesignTokens.colors.app.text[600])} />
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
                    DesignTokens.components.input.withIcon
                  )}
                />
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
              initialExpandedEntries={initialExpandedNotebookEntries}
              onEntryClick={(entry) => {
                // Handle entry click if needed
              }}
              onAddNote={(date) => {
                setAddNoteDate(date);
                setShowAddJournalNote(true);
              }}
              onDeleteNote={handleDeleteNotebookNote}
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
          onImportDicom={handleImportDicom}
          onUploadClick={async (documentType, documentDate = null, documentNote = null, fileOrFiles = null, onlyExistingMetrics = false, customInstructions = null) => {
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
              setPendingCustomInstructions(customInstructions);
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
                  await handleMultipleFileUpload(fileOrFiles, documentType, normalizedDate, normalizedNote, onlyExistingMetrics, customInstructions);
                } else {
                  // Single file - use existing handler
                  addDebugLog(`Processing: ${fileOrFiles.name} (${(fileOrFiles.size / 1024).toFixed(0)}KB)`, 'info');
                  await handleRealFileUpload(fileOrFiles, documentType, normalizedDate, normalizedNote, null, null, onlyExistingMetrics, customInstructions);
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
        documentType={currentDocumentType}
        extractedDataCounts={extractedDataCounts}
        documentProgress={documentProgress}
      />

      <DeletionConfirmationModal
        show={deleteConfirm.show}
        onClose={() => {
          if (!isDeleting) {
            setDeleteConfirm({ show: false, title: '', message: '', onConfirm: null, itemName: '', confirmText: 'Yes, Delete Permanently' });
          }
        }}
        onConfirm={async () => {
          const onConfirmFn = deleteConfirm.onConfirm;
          if (!onConfirmFn) return;
          try {
            await onConfirmFn();
          } finally {
            setIsDeleting(false);
            setDeleteConfirm({ show: false, title: '', message: '', onConfirm: null, itemName: '', confirmText: 'Yes, Delete Permanently' });
          }
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
        onConfirm={async ({ date, note, onlyExistingMetrics = false, customInstructions = null }) => {
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
            setAiStatus('Analyzing document...');
            setExtractedDataCounts(null); // Reset counts
            
            // Use the edited values from the modal (or null if empty)
            const docDate = date || null;
            const docNote = note || null;
            
            // For genomic documents, always extract all data (ignore onlyExistingMetrics)
            const existingDocType = rescanDocument.documentType || rescanDocument.type || null;
            const isGenomic = existingDocType && (
              existingDocType.toLowerCase() === 'genomic' || 
              existingDocType.toLowerCase() === 'genetic' || 
              existingDocType.toLowerCase() === 'genomic-profile'
            );
            const shouldUseOnlyExisting = isGenomic ? false : onlyExistingMetrics;
            
            // Clean up old data before reprocessing
            // Use non-aggressive cleanup - only delete values with matching documentId (not all values)
            await cleanupDocumentData(rescanDocument.id, user.uid, false); // false = only delete matching documentId
            
            // Re-process with edited values - use existing document type to skip classification
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
              shouldUseOnlyExisting, // Force false for genomic documents
              existingDocType, // Pass existing document type to skip classification
              customInstructions // Pass custom instructions from rescan modal
            );
            
            // Extract data counts from processing result
            if (processingResult.extractedData) {
              const counts = {
                labs: processingResult.extractedData.labs?.length || 0,
                vitals: processingResult.extractedData.vitals?.length || 0,
                mutations: processingResult.extractedData.genomic?.mutations?.length || 0,
                medications: processingResult.extractedData.medications?.length || 0,
                hasGenomic: !!processingResult.extractedData.genomic
              };
              setExtractedDataCounts(counts);
              setCurrentDocumentType(processingResult.documentType);
            }

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
            setAiStatus(null);
            setExtractedDataCounts(null);
            setCurrentDocumentType(null);

            const dataPointText = processingResult.dataPointCount > 0
              ? ` ${processingResult.dataPointCount} data point${processingResult.dataPointCount !== 1 ? 's' : ''} extracted.`
              : '';
            showSuccess(`Document rescanned successfully!${dataPointText} Previous data has been cleaned up and new values extracted.`);

            // Generate chat summary with quick action buttons
            const chatSummary = generateChatSummary(processingResult, processingResult.extractedData);

            // Store summary in sessionStorage for ChatTab to pick up (if user navigates to chat)
            // No longer navigating away - chat is available on all screens
            sessionStorage.setItem('uploadSummary', JSON.stringify({
              summary: chatSummary,
              timestamp: Date.now()
            }));
          } catch (error) {
            showError(`Error rescanning document: ${error.message}. Please try again.`);
            // Already closed modal at start, just clean up state
            setIsUploading(false);
            setUploadProgress('');
            setAiStatus(null);
            setExtractedDataCounts(null);
            setCurrentDocumentType(null);
          }
        }}
      />

      {/* Document Metadata Modal */}
      <DocumentMetadataModal
        show={!!showDocumentMetadata}
        document={showDocumentMetadata}
        onClose={() => setShowDocumentMetadata(null)}
      />

      {/* ZIP Choice Modal - View Now vs Save to Library */}
      {zipChoiceModal && (
        <div className={combineClasses(DesignTokens.components.modal.backdrop, 'z-[101] animate-in fade-in duration-200')}>
          <div className={combineClasses('bg-white', DesignTokens.borders.radius.lg, 'max-w-md w-full', DesignTokens.spacing.card.desktop, DesignTokens.shadows.lg, 'animate-fade-scale')}>
            <div className={combineClasses('w-12 h-12', DesignTokens.colors.primary[100], DesignTokens.borders.radius.full, 'flex items-center justify-center', DesignTokens.spacing.header.mobile, 'mx-auto')}>
              <FolderOpen className={combineClasses(DesignTokens.colors.primary.text[600], 'w-6 h-6')} />
            </div>

            <h3 className={combineClasses(DesignTokens.typography.h2.full, DesignTokens.typography.h2.weight, 'text-center mb-2', DesignTokens.colors.neutral.text[900])}>
              ZIP Archive Detected
            </h3>

            <p className={combineClasses(DesignTokens.typography.body.sm, 'text-center mb-6', DesignTokens.colors.neutral.text[600])}>
              Found {zipChoiceModal.totalFiles} scan file{zipChoiceModal.totalFiles !== 1 ? 's' : ''} in this ZIP archive.
              <br />
              <br />
              <strong>View Now:</strong> Load instantly in viewer (no upload, like IMAIOS)
              <br />
              <strong>Save to Library:</strong> Upload all files to your library (permanent storage)
            </p>

            <div className={combineClasses('flex flex-col', DesignTokens.spacing.gap.md)}>
              <button
                onClick={zipChoiceModal.onViewNow}
                className={combineClasses(DesignTokens.components.button.primary, 'w-full py-3 font-medium', DesignTokens.borders.radius.md, DesignTokens.shadows.lg, 'flex items-center justify-center gap-2 active:scale-[0.98]')}
              >
                <Eye className="w-5 h-5" />
                View Now (Instant)
              </button>
              <button
                onClick={zipChoiceModal.onSaveToLibrary}
                className={combineClasses('w-full py-3 font-medium', DesignTokens.borders.radius.md, DesignTokens.typography.h2.weight, DesignTokens.transitions.default, 'flex items-center justify-center gap-2', DesignTokens.colors.neutral.text[700], DesignTokens.colors.neutral[100].replace('bg-', 'hover:bg-'), 'active:scale-[0.98]')}
              >
                <Upload className="w-5 h-5" />
                Save to Library
              </button>
              <button
                onClick={() => {
                  setZipChoiceModal(null);
                  setIsUploading(false);
                  setUploadProgress('');
                }}
                className={combineClasses('w-full py-2 text-sm', DesignTokens.borders.radius.md, DesignTokens.transitions.default, 'flex items-center justify-center gap-2', DesignTokens.colors.neutral.text[500], 'hover:' + DesignTokens.colors.neutral.text[700], 'active:scale-[0.98]')}
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Day One Import Modal */}
      {showDayOneImportModal && (
        <DayOneImportModal
          show={showDayOneImportModal}
          onClose={() => setShowDayOneImportModal(false)}
          user={user}
          onImportComplete={async () => {
            if (reloadHealthData) await reloadHealthData();
            await reloadNotebookEntries();
          }}
          onDocumentsChange={async () => {
            if (user?.uid) {
              const updatedDocs = await documentService.getDocuments(user.uid);
              setDocuments(updatedDocs);
              setHasUploadedDocument(updatedDocs.length > 0);
            }
          }}
        />
      )}

      {/* DICOM Import Flow Modal */}
      {showDicomImportFlow && (
        <DicomImportFlow
          show={showDicomImportFlow}
          onClose={() => setShowDicomImportFlow(false)}
          onViewNow={(viewerData) => {
            setShowDicomImportFlow(false);
            if (onOpenDicomViewer) {
              onOpenDicomViewer(viewerData);
            }
          }}
          onSaveToLibrary={async (files, note) => {
            setShowDicomImportFlow(false);
            setIsUploading(true);
            setUploadProgress('Saving scan files to library...');
            
            try {
              // Process files sequentially (reuse existing logic)
              if (files.length === 1) {
                // Single file - use handleRealFileUpload with null date (DICOM metadata will provide date)
                await handleRealFileUpload(files[0], 'Scan', null, note, null, null, false, null);
              } else {
                // Multiple files - use handleMultipleFileUpload with null date
                await handleMultipleFileUpload(files, 'Scan', null, note, false, null);
              }
              
              // Reload documents
              const updatedDocs = await documentService.getDocuments(user.uid);
              setDocuments(updatedDocs);
              setHasUploadedDocument(updatedDocs.length > 0);
              
              setIsUploading(false);
              setUploadProgress('');
              showSuccess(`Successfully saved ${files.length} scan file${files.length !== 1 ? 's' : ''} to library`);
            } catch (error) {
              logger.error('Error saving scan files to library:', error);
              setIsUploading(false);
              setUploadProgress('');
              showError(`Failed to save files: ${error.message}`);
            }
          }}
          userId={user?.uid}
        />
      )}

      {/* DICOM Viewer is now handled by parent App component as full-screen page */}

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



FilesTab.propTypes = {
  onTabChange: PropTypes.func.isRequired,
  onOpenMobileChat: PropTypes.func,
  onOpenDicomViewer: PropTypes.func
};
