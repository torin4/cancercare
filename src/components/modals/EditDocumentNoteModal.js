import React, { useState, useEffect } from 'react';
import { X, Save, AlertTriangle, Trash2 } from 'lucide-react';
import { DesignTokens, combineClasses } from '../../design/designTokens';
import { documentService, labService, vitalService } from '../../firebase/services';
import { deleteDocument } from '../../firebase/storage';
import { cleanupDocumentData } from '../../services/documentCleanupService';
import { useBanner } from '../../contexts/BannerContext';
import { parseLocalDate, formatDateString } from '../../utils/helpers';
import DatePicker from '../DatePicker';

export default function EditDocumentNoteModal({
  show,
  onClose,
  user,
  editingDocumentNote,
  setEditingDocumentNote,
  setIsUploading,
  setUploadProgress,
  reloadHealthData,
  setDocuments,
  onRescanRequest // Callback to trigger rescan from parent
}) {
  const { showSuccess, showError } = useBanner();
  const [documentDateEdit, setDocumentDateEdit] = useState('');
  const [documentNoteEdit, setDocumentNoteEdit] = useState('');
  const [documentFileNameEdit, setDocumentFileNameEdit] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [keepOriginalDate, setKeepOriginalDate] = useState(false);
  const [hasMultipleDates, setHasMultipleDates] = useState(false);
  const [dateRange, setDateRange] = useState({ min: null, max: null });
  const [isCheckingDates, setIsCheckingDates] = useState(false);
  const [acknowledgeOverwrite, setAcknowledgeOverwrite] = useState(false); // User acknowledges they want to overwrite all dates
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Check for multiple dates when modal opens - OPTIMIZED VERSION
  useEffect(() => {
    const checkMultipleDates = async () => {
      if (show && editingDocumentNote && user) {
        setIsCheckingDates(true);
        try {
          // OPTIMIZATION: Use stored document metadata if available (much faster)
          if (editingDocumentNote.hasMultipleDates && editingDocumentNote.minDate && editingDocumentNote.maxDate) {
            const minDate = editingDocumentNote.minDate?.toDate ? editingDocumentNote.minDate.toDate() : new Date(editingDocumentNote.minDate);
            const maxDate = editingDocumentNote.maxDate?.toDate ? editingDocumentNote.maxDate.toDate() : new Date(editingDocumentNote.maxDate);
            setHasMultipleDates(true);
            setDateRange({ min: minDate, max: maxDate });
            setIsCheckingDates(false);
            return;
          }

          // If document doesn't have stored metadata, check quickly with early exit
          const uniqueDates = new Set();
          let minDate = null;
          let maxDate = null;

          // OPTIMIZATION: Load labs and vitals in parallel
          const [labs, vitals] = await Promise.all([
            labService.getLabs(user.uid),
            vitalService.getVitals(user.uid)
          ]);

          // OPTIMIZATION: Load all values in parallel
          const labValuePromises = labs.map(lab => labService.getLabValues(lab.id));
          const vitalValuePromises = vitals.map(vital => vitalService.getVitalValues(vital.id));
          const [allLabValues, allVitalValues] = await Promise.all([
            Promise.all(labValuePromises),
            Promise.all(vitalValuePromises)
          ]);

          // Process lab values
          for (let i = 0; i < labs.length; i++) {
            const values = allLabValues[i] || [];
            for (const value of values) {
              if (value.documentId === editingDocumentNote.id && value.date) {
                let dateObj = null;
                if (value.date?.toDate) {
                  const firestoreDate = value.date.toDate();
                  dateObj = new Date(firestoreDate.getFullYear(), firestoreDate.getMonth(), firestoreDate.getDate());
                } else if (value.date instanceof Date) {
                  dateObj = new Date(value.date.getFullYear(), value.date.getMonth(), value.date.getDate());
                } else if (typeof value.date === 'string') {
                  dateObj = parseLocalDate(value.date);
                }
                
                if (dateObj && !isNaN(dateObj.getTime())) {
                  const dateStr = formatDateString(dateObj);
                  uniqueDates.add(dateStr);
                  if (!minDate || dateObj < minDate) minDate = dateObj;
                  if (!maxDate || dateObj > maxDate) maxDate = dateObj;
                  
                  // OPTIMIZATION: Early exit if we find 2+ dates
                  if (uniqueDates.size >= 2) {
                    setHasMultipleDates(true);
                    setDateRange({ min: minDate, max: maxDate });
                    setIsCheckingDates(false);
                    return;
                  }
                }
              }
            }
          }

          // Process vital values (only if we haven't found multiple dates yet)
          if (uniqueDates.size < 2) {
            for (let i = 0; i < vitals.length; i++) {
              const values = allVitalValues[i] || [];
            for (const value of values) {
              if (value.documentId === editingDocumentNote.id && value.date) {
                let dateObj = null;
                if (value.date?.toDate) {
                  const firestoreDate = value.date.toDate();
                  dateObj = new Date(firestoreDate.getFullYear(), firestoreDate.getMonth(), firestoreDate.getDate());
                } else if (value.date instanceof Date) {
                  dateObj = new Date(value.date.getFullYear(), value.date.getMonth(), value.date.getDate());
                } else if (typeof value.date === 'string') {
                  dateObj = parseLocalDate(value.date);
                }
                
                if (dateObj && !isNaN(dateObj.getTime())) {
                  const dateStr = formatDateString(dateObj);
                  uniqueDates.add(dateStr);
                  if (!minDate || dateObj < minDate) minDate = dateObj;
                  if (!maxDate || dateObj > maxDate) maxDate = dateObj;
                    
                    // OPTIMIZATION: Early exit if we find 2+ dates
                    if (uniqueDates.size >= 2) {
                      setHasMultipleDates(true);
                      setDateRange({ min: minDate, max: maxDate });
                      setIsCheckingDates(false);
                      return;
                    }
                  }
                }
              }
            }
          }

          const hasMultiple = uniqueDates.size > 1;
          setHasMultipleDates(hasMultiple);
          if (hasMultiple && minDate && maxDate) {
            setDateRange({ min: minDate, max: maxDate });
          } else {
            setDateRange({ min: null, max: null });
          }
        } catch (error) {
          setHasMultipleDates(false);
        } finally {
          setIsCheckingDates(false);
        }
      }
    };

    checkMultipleDates();
  }, [show, editingDocumentNote, user]);

  // Initialize state when modal opens or document changes
  useEffect(() => {
    if (show && editingDocumentNote) {
      // Set note immediately
      const noteValue = editingDocumentNote.note || '';
      setDocumentNoteEdit(noteValue);
      
      // Set filename
      const fileNameValue = editingDocumentNote.fileName || editingDocumentNote.name || '';
      setDocumentFileNameEdit(fileNameValue);
      
      // Format date for input[type="date"] using formatDateString helper
      // This handles Firestore Timestamps, Date objects, and strings consistently
      let dateValue = '';
      if (editingDocumentNote.date) {
        const formatted = formatDateString(editingDocumentNote.date);
        dateValue = formatted || '';
      }
      setDocumentDateEdit(dateValue);
      setKeepOriginalDate(false); // Reset checkbox when opening modal
    } else if (!show) {
      // Reset when modal closes
      setDocumentDateEdit('');
      setDocumentNoteEdit('');
      setDocumentFileNameEdit('');
      setKeepOriginalDate(false);
      setHasMultipleDates(false);
      setDateRange({ min: null, max: null });
      setAcknowledgeOverwrite(false);
    }
  }, [show, editingDocumentNote]);

  if (!show || !editingDocumentNote) return null;

  const handleSave = async () => {
    if (!editingDocumentNote || !user || isSaving) return;
    try {
      setIsSaving(true);
      
      const oldNote = editingDocumentNote.note || '';
      const newNote = documentNoteEdit.trim();
      
      // Format date properly: if keepOriginalDate is checked (and not multiple dates with acknowledgment), use original date; otherwise use new date
      let formattedDate = null;
      if (keepOriginalDate && !hasMultipleDates) {
        // Keep the original date from the document (only when not multiple dates or when acknowledged)
        if (editingDocumentNote.date) {
          // If it's a Firestore Timestamp, convert it; otherwise use as is
          if (editingDocumentNote.date.toDate) {
            formattedDate = editingDocumentNote.date.toDate();
          } else if (editingDocumentNote.date instanceof Date) {
            formattedDate = editingDocumentNote.date;
          } else {
            formattedDate = parseLocalDate(formatDateString(editingDocumentNote.date));
          }
        }
      } else {
        // Use the new date from the input (this will overwrite all dates if hasMultipleDates && acknowledgeOverwrite)
        formattedDate = documentDateEdit ? parseLocalDate(documentDateEdit) : null;
      }
      
      // Update document date, note, and filename
      const newFileName = documentFileNameEdit.trim();
      await documentService.saveDocument({
        id: editingDocumentNote.id,
        date: formattedDate,
        note: newNote || null,
        fileName: newFileName || editingDocumentNote.fileName || editingDocumentNote.name
      });
      
      // Find and update all lab values linked to this document using documentId
      let updatedLabValues = 0;
      let updatedVitalValues = 0;
      
      const labs = await labService.getLabs(user.uid);
      for (const lab of labs) {
        const values = await labService.getLabValues(lab.id);
        for (const value of values) {
          // Use documentId to find related values (more reliable than note pattern)
          if (value.documentId === editingDocumentNote.id) {
            const updatedNote = newNote 
              ? `Extracted from document. Context: ${newNote}`
              : 'Extracted from document';
            
            // Update note and date
            // If hasMultipleDates and acknowledgeOverwrite, use formattedDate to overwrite all dates
            // If keepOriginalDate (and not multiple dates), keep original date
            // Otherwise, use formattedDate
            const dateToUse = (hasMultipleDates && acknowledgeOverwrite && formattedDate) 
              ? formattedDate 
              : (keepOriginalDate && !hasMultipleDates) 
                ? value.date 
                : (formattedDate || value.date);
            
            await labService.updateLabValue(lab.id, value.id, {
              value: value.value, // Keep existing value
              date: dateToUse,
              notes: updatedNote,
              documentId: editingDocumentNote.id // Ensure documentId is set
            });
            updatedLabValues++;
          }
        }
      }
      
      // Find and update all vital values linked to this document using documentId
      const vitals = await vitalService.getVitals(user.uid);
      for (const vital of vitals) {
        const values = await vitalService.getVitalValues(vital.id);
        for (const value of values) {
          // Use documentId to find related values (more reliable than note pattern)
          if (value.documentId === editingDocumentNote.id) {
            const updatedNote = newNote 
              ? `Extracted from document. Context: ${newNote}`
              : 'Extracted from document';
            
            // Update note and date
            // If hasMultipleDates and acknowledgeOverwrite, use formattedDate to overwrite all dates
            // If keepOriginalDate (and not multiple dates), keep original date
            // Otherwise, use formattedDate
            const dateToUse = (hasMultipleDates && acknowledgeOverwrite && formattedDate) 
              ? formattedDate 
              : (keepOriginalDate && !hasMultipleDates) 
                ? value.date 
                : (formattedDate || value.date);
            
            await vitalService.updateVitalValue(vital.id, value.id, {
              value: value.value, // Keep existing value
              date: dateToUse,
              notes: updatedNote,
              systolic: value.systolic, // Keep existing BP values
              diastolic: value.diastolic,
              documentId: editingDocumentNote.id // Ensure documentId is set
            });
            updatedVitalValues++;
          }
        }
      }
      
      
      // Update local documents state
      setDocuments(docs => docs.map(d => 
        d.id === editingDocumentNote.id 
          ? { ...d, date: formattedDate, note: newNote || null, fileName: newFileName || d.fileName || d.name, name: newFileName || d.name || d.fileName }
          : d
      ));
      
      // Reload health data to reflect updated notes and dates
      await reloadHealthData();
      
      setIsSaving(false);
      setEditingDocumentNote(null);
      setDocumentNoteEdit('');
      setDocumentDateEdit('');
      setDocumentFileNameEdit('');
      const valueCount = updatedLabValues + updatedVitalValues;
      showSuccess(`Document updated successfully! ${valueCount} related value${valueCount !== 1 ? 's' : ''} updated.`);
    } catch (error) {
      showError('Error updating document. Please try again.');
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setEditingDocumentNote(null);
    setDocumentNoteEdit('');
    onClose();
  };

  const handleDelete = async () => {
    if (!editingDocumentNote || !user || isDeleting) return;

    const confirmDelete = window.confirm(
      'Delete this document and all related data points (labs, vitals, medications, symptoms)? This cannot be undone.'
    );
    if (!confirmDelete) return;

    try {
      setIsDeleting(true);

      const cleanupResults = await cleanupDocumentData(editingDocumentNote.id, user.uid, false);

      if (editingDocumentNote.storagePath) {
        await deleteDocument(editingDocumentNote.id, editingDocumentNote.storagePath, user.uid);
      } else {
        await documentService.deleteDocument(editingDocumentNote.id);
      }

      setDocuments(docs => docs.filter(d => d.id !== editingDocumentNote.id));
      await reloadHealthData();

      setEditingDocumentNote(null);
      setDocumentNoteEdit('');

      const deletedCount = (
        cleanupResults.labValuesDeleted +
        cleanupResults.vitalValuesDeleted +
        cleanupResults.medicationsDeleted +
        cleanupResults.symptomsDeleted
      );
      showSuccess(`Document deleted. ${deletedCount} related data point${deletedCount !== 1 ? 's' : ''} removed.`);
    } catch (error) {
      showError('Error deleting document. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className={combineClasses(DesignTokens.components.modal.backdrop, 'z-[101] animate-in fade-in duration-200')}>
      <div className={combineClasses('w-full h-full md:h-auto md:rounded-xl md:max-w-md md:max-h-[90vh] overflow-hidden flex flex-col animate-slide-up', DesignTokens.components.modal.container)}>
        <div className={DesignTokens.components.modal.header}>
          <h3 className={DesignTokens.components.modal.title}>Edit Document</h3>
          <button
            onClick={handleClose}
            className={combineClasses('transition', DesignTokens.components.modal.closeButton)}
            type="button"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className={combineClasses('flex-1 overflow-y-auto p-4 sm:p-6 space-y-4', DesignTokens.components.modal.body)}>
          <p className={combineClasses('text-sm mb-4', DesignTokens.colors.neutral.text[600])}>
            Update the document filename, date, and note. The note will be updated for the document and all lab/vital values extracted from it.
          </p>
          
          {/* Filename Input */}
          <div>
            <label className={combineClasses('block text-sm font-semibold mb-2', DesignTokens.colors.neutral.text[900])}>
              File Name
            </label>
            <input
              type="text"
              value={documentFileNameEdit}
              onChange={(e) => setDocumentFileNameEdit(e.target.value)}
              placeholder="Enter file name"
              disabled={isSaving}
              className={combineClasses(DesignTokens.components.input.base, isSaving ? DesignTokens.components.input.disabled : '')}
              maxLength={255}
            />
            <p className={combineClasses('text-xs mt-1', DesignTokens.colors.neutral.text[500])}>
              {documentFileNameEdit.length}/255 characters
            </p>
          </div>
          
          {/* Date Input */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={combineClasses('block text-sm font-semibold', DesignTokens.colors.neutral.text[900])}>
                Document Date
              </label>
              {!hasMultipleDates && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={keepOriginalDate}
                    onChange={(e) => setKeepOriginalDate(e.target.checked)}
                    disabled={isSaving}
                    className={combineClasses('w-4 h-4 rounded focus:ring-anchor-900', DesignTokens.colors.app.text[600], DesignTokens.colors.neutral.border[300], isSaving ? 'disabled:opacity-50' : '')}
                  />
                  <span className={combineClasses('text-xs', DesignTokens.colors.neutral.text[600])}>Keep original date</span>
                </label>
              )}
            </div>
            
            {/* Warning for multiple dates */}
            {hasMultipleDates && (
              <div className={combineClasses('mb-3', DesignTokens.components.alert.warning)}>
                <div className="flex items-start gap-2">
                  <AlertTriangle className={combineClasses('w-5 h-5 flex-shrink-0 mt-0.5', DesignTokens.components.alert.text.warning ? DesignTokens.components.alert.text.warning.replace('800', '600') : 'text-yellow-600')} />
                  <div className="flex-1">
                    <p className={combineClasses('text-sm font-semibold mb-1', DesignTokens.components.alert.text.warning || 'text-yellow-800')}>
                      Multiple Dates Detected
                    </p>
                    <p className={combineClasses('text-xs mb-3', DesignTokens.components.alert.text.warning ? DesignTokens.components.alert.text.warning.replace('800', '700') : 'text-yellow-700')}>
                      This document contains values with different dates ({dateRange.min && dateRange.max ? `${formatDateString(dateRange.min)} to ${formatDateString(dateRange.max)}` : 'various dates'}). 
                      Changing the document date will <strong>overwrite all values with a single date</strong>.
                    </p>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={acknowledgeOverwrite}
                        onChange={(e) => setAcknowledgeOverwrite(e.target.checked)}
                        disabled={isSaving}
                        className={combineClasses('w-4 h-4 rounded focus:ring-anchor-900 mt-0.5', DesignTokens.colors.app.text[600], DesignTokens.colors.neutral.border[300], isSaving ? 'disabled:opacity-50' : '')}
                      />
                      <span className={combineClasses('text-xs', DesignTokens.components.alert.text.warning)}>
                        I understand this will overwrite all dates with a single date
                      </span>
                    </label>
                    {onRescanRequest && !acknowledgeOverwrite && (
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingDocumentNote(null);
                            onClose();
                            onRescanRequest(editingDocumentNote);
                          }}
                          className={combineClasses('text-xs underline font-medium transition', DesignTokens.components.alert.text.warning, 'hover:text-yellow-900')}
                        >
                          Or rescan document to update dates individually →
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {/* Date picker - show if no multiple dates, or if multiple dates and acknowledged */}
            {(!hasMultipleDates || acknowledgeOverwrite) && (
              <DatePicker
                key={`date-input-${editingDocumentNote.id}`}
                value={documentDateEdit}
                onChange={(e) => setDocumentDateEdit(e.target.value)}
                disabled={isSaving || (keepOriginalDate && !hasMultipleDates)}
                placeholder="YYYY-MM-DD"
                className="w-full"
              />
            )}
            
            <p className={combineClasses('text-xs mt-1', DesignTokens.colors.neutral.text[500])}>
              {hasMultipleDates && !acknowledgeOverwrite
                ? 'Check the box above to enable date editing. This will overwrite all values with a single date.'
                : hasMultipleDates && acknowledgeOverwrite
                  ? 'Enter a date to overwrite all values. This will replace all existing dates with the date you enter.'
                  : keepOriginalDate 
                    ? 'The original date will be preserved. Only the note will be updated.'
                    : 'The date when this document was created or the test was performed (not the upload date)'}
            </p>
          </div>
          
          {/* Note Input */}
          <div>
            <label className={combineClasses('block text-sm font-semibold mb-2', DesignTokens.colors.neutral.text[900])}>
              Document Note
            </label>
            <textarea
              value={documentNoteEdit}
              onChange={(e) => setDocumentNoteEdit(e.target.value)}
              placeholder="e.g., Before starting treatment, After cycle 2, Post-surgery..."
              rows={3}
              disabled={isSaving}
              maxLength={200}
              className={combineClasses(DesignTokens.components.input.base, DesignTokens.components.input.textarea, isSaving ? DesignTokens.components.input.disabled : '')}
            />
            <p className={combineClasses('text-xs mt-1', DesignTokens.colors.neutral.text[500])}>
              {documentNoteEdit.length}/200 characters
            </p>
          </div>
        </div>
        <div className={combineClasses('flex-shrink-0 border-t p-4', DesignTokens.components.modal.footer)}>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleClose}
              disabled={isSaving || isDeleting}
              className={combineClasses('flex-1 py-2.5 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed', DesignTokens.components.button.secondary)}
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={isSaving || isDeleting}
              className={combineClasses(
                'flex-1 py-2.5 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2',
                'bg-red-600 text-white hover:bg-red-700'
              )}
            >
              {isDeleting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Delete Document
                </>
              )}
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || isDeleting}
              className={combineClasses(DesignTokens.components.button.primary, DesignTokens.spacing.button.full, 'py-2.5 font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed')}
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

