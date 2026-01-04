import React, { useState, useEffect } from 'react';
import { X, Save, AlertTriangle } from 'lucide-react';
import { DesignTokens, combineClasses } from '../../design/designTokens';
import { documentService, labService, vitalService } from '../../firebase/services';
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
  
  // Check for multiple dates when modal opens
  useEffect(() => {
    const checkMultipleDates = async () => {
      if (show && editingDocumentNote && user) {
        setIsCheckingDates(true);
        try {
          const uniqueDates = new Set();
          let minDate = null;
          let maxDate = null;

          // Check lab values
          const labs = await labService.getLabs(user.uid);
          for (const lab of labs) {
            const values = await labService.getLabValues(lab.id);
            for (const value of values) {
              if (value.documentId === editingDocumentNote.id && value.date) {
                let dateObj = null;
                if (value.date?.toDate) {
                  const firestoreDate = value.date.toDate();
                  // Use local date components to normalize to day-level
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
                }
              }
            }
          }

          // Check vital values
          const vitals = await vitalService.getVitals(user.uid);
          for (const vital of vitals) {
            const values = await vitalService.getVitalValues(vital.id);
            for (const value of values) {
              if (value.documentId === editingDocumentNote.id && value.date) {
                let dateObj = null;
                if (value.date?.toDate) {
                  const firestoreDate = value.date.toDate();
                  // Use local date components to normalize to day-level
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

  return (
    <div className={combineClasses('fixed inset-0 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-0 md:p-4', DesignTokens.components.modal.overlay)}>
      <div className={combineClasses('w-full h-full md:h-auto md:rounded-xl md:max-w-md md:max-h-[90vh] overflow-hidden flex flex-col animate-slide-up', DesignTokens.components.modal.container)}>
        <div className={combineClasses('flex-shrink-0 border-b p-4 flex items-center justify-between', DesignTokens.components.modal.header)}>
          <h3 className={combineClasses('text-lg font-semibold', DesignTokens.colors.neutral.text[900])}>Edit Document</h3>
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
              className={combineClasses('w-full rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-medical-primary-500', DesignTokens.components.input.base, isSaving ? DesignTokens.components.input.disabled : '')}
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
                    className={combineClasses('w-4 h-4 rounded focus:ring-medical-primary-500', DesignTokens.colors.primary[600].replace('bg-', 'text-'), DesignTokens.colors.neutral.border[300], isSaving ? 'disabled:opacity-50' : '')}
                  />
                  <span className={combineClasses('text-xs', DesignTokens.colors.neutral.text[600])}>Keep original date</span>
                </label>
              )}
            </div>
            
            {/* Warning for multiple dates */}
            {hasMultipleDates && (
              <div className={combineClasses('mb-3 p-3 rounded-lg', DesignTokens.components.alert.warning.bg, DesignTokens.components.alert.warning.border)}>
                <div className="flex items-start gap-2">
                  <AlertTriangle className={combineClasses('w-5 h-5 flex-shrink-0 mt-0.5', DesignTokens.components.alert.warning.icon)} />
                  <div className="flex-1">
                    <p className={combineClasses('text-sm font-semibold mb-1', DesignTokens.components.alert.warning.text)}>
                      Multiple Dates Detected
                    </p>
                    <p className={combineClasses('text-xs mb-3', DesignTokens.components.alert.warning.textSecondary)}>
                      This document contains values with different dates ({dateRange.min && dateRange.max ? `${formatDateString(dateRange.min)} to ${formatDateString(dateRange.max)}` : 'various dates'}). 
                      Changing the document date will <strong>overwrite all values with a single date</strong>.
                    </p>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={acknowledgeOverwrite}
                        onChange={(e) => setAcknowledgeOverwrite(e.target.checked)}
                        disabled={isSaving}
                        className={combineClasses('w-4 h-4 rounded focus:ring-amber-500 mt-0.5', DesignTokens.colors.accent[600].replace('bg-', 'text-'), DesignTokens.colors.neutral.border[300], isSaving ? 'disabled:opacity-50' : '')}
                      />
                      <span className={combineClasses('text-xs', DesignTokens.components.alert.warning.text)}>
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
                          className={combineClasses('text-xs underline font-medium transition', DesignTokens.components.alert.warning.textSecondary, DesignTokens.components.alert.warning.text.replace('600', '900').replace('text-', 'hover:text-'))}
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
              className={combineClasses('w-full rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-medical-primary-500 resize-none', DesignTokens.components.input.base, DesignTokens.components.input.textarea, isSaving ? DesignTokens.components.input.disabled : '')}
            />
            <p className={combineClasses('text-xs mt-1', DesignTokens.colors.neutral.text[500])}>
              {documentNoteEdit.length}/200 characters
            </p>
          </div>
        </div>
        <div className={combineClasses('flex-shrink-0 border-t p-4', DesignTokens.components.modal.footer)}>
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              disabled={isSaving}
              className={combineClasses('flex-1 py-2.5 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed', DesignTokens.components.button.secondary)}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={combineClasses('flex-1 text-white py-2.5 rounded-lg font-medium transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed', DesignTokens.components.button.primary)}
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

