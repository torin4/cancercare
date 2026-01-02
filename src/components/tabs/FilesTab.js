import React, { useState, useEffect } from 'react';
import { Upload, FolderOpen, X, Edit2, RefreshCw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePatientContext } from '../../contexts/PatientContext';
import { useHealthContext } from '../../contexts/HealthContext';
import { useBanner } from '../../contexts/BannerContext';
import { documentService } from '../../firebase/services';
import { uploadDocument, deleteDocument } from '../../firebase/storage';
import { processDocument, generateExtractionSummary } from '../../services/documentProcessor';
import DocumentUploadOnboarding from '../DocumentUploadOnboarding';
import EditDocumentNoteModal from '../modals/EditDocumentNoteModal';
import UploadProgressOverlay from '../UploadProgressOverlay';
import DeletionConfirmationModal from '../modals/DeletionConfirmationModal';

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
  const [editingDocumentNote, setEditingDocumentNote] = useState(null);
  const [documentNoteEdit, setDocumentNoteEdit] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState({
    show: false,
    title: '',
    message: '',
    onConfirm: null,
    itemName: '',
    confirmText: 'Yes, Delete Permanently'
  });

  // Load documents from Firestore when user logs in
  useEffect(() => {
    const loadDocuments = async () => {
      if (user) {
        try {
          const docs = await documentService.getDocuments(user.uid);
          setDocuments(docs);
          setHasUploadedDocument(docs.length > 0);
        } catch (error) {
          console.error('Error loading documents:', error);
        }
      }
    };

    loadDocuments();
  }, [user]);

  const openDocumentOnboarding = (docType = null, method = 'picker') => {
    setDocumentOnboardingMethod(method || 'picker');
    setShowDocumentOnboarding(true);
  };

  const simulateDocumentUpload = (docType) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.vcf,.vcf.gz,.maf,.bed,.txt,.csv,.tsv,.zip,.gz,.xlsx,.xls';

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        await handleRealFileUpload(file, docType);
      }
    };

    input.click();
  };

  const simulateCameraUpload = (docType) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.vcf,.vcf.gz,.maf,.bed,.txt,.csv,.tsv,.zip,.gz,.xlsx,.xls,image/*';
    input.capture = 'environment';

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        await handleRealFileUpload(file, docType);
      }
    };

    input.click();
  };

  const handleRealFileUpload = async (file, docType) => {
    if (!user) {
      showError('Please log in to upload files');
      return;
    }

    try {
      // Show loading overlay
      setIsUploading(true);
      setUploadProgress('Reading document...');

      // Get document date and note (user-provided or null)
      const providedDate = pendingDocumentDate;
      const providedNote = pendingDocumentNote;
      // Clear pending date and note after use
      setPendingDocumentDate(null);
      setPendingDocumentNote(null);

      // Step 1: Process document with AI to extract medical data
      setUploadProgress('Analyzing document with AI...');
      const processingResult = await processDocument(file, user.uid, patientProfile, providedDate, providedNote, null);
      console.log('Document processing result:', processingResult);

      // Step 2: Upload file to Firebase Storage
      setUploadProgress('Uploading to secure storage...');
      const uploadResult = await uploadDocument(file, user.uid, {
        category: processingResult.documentType || docType,
        documentType: processingResult.documentType || docType,
        note: providedNote || null
      });

      console.log('File uploaded successfully:', uploadResult);

      setUploadProgress('Saving extracted data...');

      // Step 3: Add to local documents state
      const docDate = providedDate || new Date().toISOString().split('T')[0];
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
        note: providedNote || null
      };

      setDocuments([newDoc, ...documents]);
      setHasUploadedDocument(true);

      // Reload health data to show new values
      setUploadProgress('Refreshing your health data...');
      await reloadHealthData();

      setIsUploading(false);
      setUploadProgress('');
      showSuccess('Document uploaded and processed successfully! All extracted data has been saved to your health records.');
    } catch (error) {
      console.error('Upload error:', error);
      showError(`Failed to process document: ${error.message}. The file was not uploaded. Please try again or contact support if the issue persists.`);
      setIsUploading(false);
      setUploadProgress('');
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
          bgColor: 'bg-blue-100',
          iconColor: 'text-blue-600',
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
          bgColor: 'bg-green-100',
          iconColor: 'text-green-600',
          icon: (
            <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          ),
          label: "Clinical Report"
        };
      case 'Genomic':
        return {
          bgColor: 'bg-amber-100',
          iconColor: 'text-amber-600',
          icon: (
            <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
          ),
          label: "Genomic Test"
        };
      default:
        return {
          bgColor: 'bg-gray-100',
          iconColor: 'text-gray-600',
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
    <div className="p-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4">
      <div className="bg-white rounded-lg shadow p-3 sm:p-4 md:p-5 border border-medical-neutral-200">
        {documents.length > 0 && (
          <h3 className="text-sm sm:text-base md:text-lg font-semibold text-medical-neutral-900 mb-3 sm:mb-4 flex items-center gap-2">
            <div className="bg-gray-100 p-1.5 sm:p-2 rounded-lg">
              <FolderOpen className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
            </div>
            Medical Documents
          </h3>
        )}
        {documents.length === 0 ? (
          <div className="bg-white rounded-lg sm:rounded-xl p-4 sm:p-6 md:p-8 text-center">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
              <FolderOpen className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" />
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-medical-neutral-900 mb-1.5 sm:mb-2">No documents uploaded yet</h3>
            <p className="text-xs sm:text-sm text-medical-neutral-600 mb-4 sm:mb-6">Upload lab results, imaging scans, clinical reports, or genomic test results</p>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center">
              <button
                onClick={() => openDocumentOnboarding('general')}
                className="px-4 sm:px-6 py-2.5 sm:py-3 bg-medical-primary-500 text-white rounded-lg hover:bg-medical-primary-600 transition-all duration-200 text-xs sm:text-sm font-semibold shadow-sm hover:shadow-md flex items-center justify-center gap-2 min-h-[44px] touch-manipulation active:opacity-70"
              >
                <Upload className="w-4 h-4" />
                Upload Your First Document
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map(doc => {
              const iconConfig = getIconConfig(doc.documentType || doc.type);
              const fileName = doc.fileName || doc.name || 'Untitled Document';

              const handleDelete = (e) => {
                e.stopPropagation();
                setDeleteConfirm({
                  show: true,
                  title: `Delete "${fileName}"?`,
                  message: `This will permanently delete "${fileName}" and all extracted data from it.`,
                  itemName: `"${fileName}"`,
                  confirmText: 'Yes, Delete',
                  onConfirm: async () => {
                    try {
                      await deleteDocument(doc.id, doc.storagePath);
                      // Reload documents
                      const updatedDocs = await documentService.getDocuments(user.uid);
                      setDocuments(updatedDocs);
                      setHasUploadedDocument(updatedDocs.length > 0);
                    } catch (error) {
                      console.error('Error deleting document:', error);
                      showError('Failed to delete document. Please try again.');
                    }
                  }
                });
              };

              return (
                <div key={doc.id} className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 border rounded-lg hover:bg-gray-50 transition">
                  <div className={`w-10 h-10 sm:w-12 sm:h-12 ${iconConfig.bgColor} rounded-lg flex items-center justify-center flex-shrink-0`}>
                    <div className={`${iconConfig.iconColor} w-5 h-5 sm:w-6 sm:h-6`}>
                      {iconConfig.icon}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm sm:text-base font-semibold truncate">{fileName}</p>
                    <p className="text-xs text-gray-700 mt-0.5">{iconConfig.label}</p>
                    {doc.note && (
                      <p className="text-xs text-medical-primary-600 mt-0.5 italic break-words">{doc.note}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-0.5">
                      {new Date(doc.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-1 sm:gap-2">
                    {doc.fileUrl && (
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 sm:px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded hover:bg-blue-700 transition min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation active:opacity-70"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="hidden sm:inline">View</span>
                        <span className="sm:hidden">View</span>
                      </a>
                    )}
                    {(doc.documentType === 'Lab' || doc.type === 'Lab' || doc.documentType === 'Vitals' || doc.type === 'Vitals' || doc.documentType === 'blood-test') && (
                      <>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (!window.confirm('Rescan this document? This will re-extract all lab/vital values. Existing values will be preserved.')) return;
                            try {
                              setIsUploading(true);
                              setUploadProgress('Downloading document...');
                              // Download file from storage
                              const response = await fetch(doc.fileUrl);
                              const blob = await response.blob();
                              const file = new File([blob], doc.fileName || doc.name || 'document.pdf', { type: blob.type });
                              
                              setUploadProgress('Re-processing document...');
                              // Re-process with existing note and documentId
                              const docDate = doc.date ? (typeof doc.date === 'string' ? doc.date : new Date(doc.date).toISOString().split('T')[0]) : null;
                              const processingResult = await processDocument(file, user.uid, patientProfile, docDate, doc.note || null, doc.id);
                              
                              // Reload health data
                              await reloadHealthData();
                              
                              setIsUploading(false);
                              setUploadProgress('');
                              showSuccess('Document rescanned successfully! New values have been extracted.');
                            } catch (error) {
                              console.error('Error rescanning document:', error);
                              showError('Error rescanning document. Please try again.');
                              setIsUploading(false);
                              setUploadProgress('');
                            }
                          }}
                          className="p-1.5 sm:p-1.5 rounded-full text-gray-500 hover:bg-blue-100 hover:text-blue-600 transition min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation active:opacity-70"
                          title="Rescan document"
                        >
                          <RefreshCw className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingDocumentNote(doc);
                            setDocumentNoteEdit(doc.note || '');
                          }}
                          className="p-1.5 sm:p-1.5 rounded-full text-gray-500 hover:bg-green-100 hover:text-green-600 transition min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation active:opacity-70"
                          title="Edit note"
                        >
                          <Edit2 className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={handleDelete}
                      className="p-1.5 sm:p-1.5 rounded-full text-gray-500 hover:bg-red-100 hover:text-red-600 transition min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation active:opacity-70"
                      aria-label="Delete document"
                    >
                      <X className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {documents.length > 0 && (
        <button
          onClick={() => openDocumentOnboarding('general')}
          className="w-full py-2.5 sm:py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition flex items-center justify-center gap-2 text-sm sm:text-base min-h-[44px] touch-manipulation active:opacity-70"
        >
          <Upload className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
          Upload Document
        </button>
      )}

      {/* Modals */}
      {showDocumentOnboarding && (
        <DocumentUploadOnboarding
          isOnboarding={!hasUploadedDocument}
          onClose={() => setShowDocumentOnboarding(false)}
          onUploadClick={(documentType, documentDate = null, documentNote = null) => {
            setShowDocumentOnboarding(false);
            setPendingDocumentDate(documentDate);
            setPendingDocumentNote(documentNote);
            // Check if mobile device
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            
            if (documentOnboardingMethod === 'camera') {
              simulateCameraUpload(documentType);
            } else if (isMobile) {
              simulateCameraUpload(documentType);
            } else {
              simulateDocumentUpload(documentType);
            }
          }}
        />
      )}

      <EditDocumentNoteModal
        show={!!editingDocumentNote}
        onClose={() => {
          setEditingDocumentNote(null);
          setDocumentNoteEdit('');
        }}
        user={user}
        editingDocumentNote={editingDocumentNote}
        setEditingDocumentNote={setEditingDocumentNote}
        documentNoteEdit={documentNoteEdit}
        setDocumentNoteEdit={setDocumentNoteEdit}
        setIsUploading={setIsUploading}
        setUploadProgress={setUploadProgress}
        reloadHealthData={reloadHealthData}
        setDocuments={setDocuments}
      />

      <UploadProgressOverlay
        show={isUploading}
        uploadProgress={uploadProgress}
      />

      <DeletionConfirmationModal
        show={deleteConfirm.show}
        onClose={() => setDeleteConfirm({ show: false, title: '', message: '', onConfirm: null, itemName: '', confirmText: 'Yes, Delete Permanently' })}
        onConfirm={async () => {
          if (deleteConfirm.onConfirm) {
            await deleteConfirm.onConfirm();
          }
          setDeleteConfirm({ show: false, title: '', message: '', onConfirm: null, itemName: '', confirmText: 'Yes, Delete Permanently' });
        }}
        title={deleteConfirm.title}
        message={deleteConfirm.message}
        itemName={deleteConfirm.itemName}
        confirmText={deleteConfirm.confirmText}
        isDeleting={false}
      />
    </div>
  );
}

