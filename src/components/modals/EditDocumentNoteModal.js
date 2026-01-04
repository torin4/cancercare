import React, { useState, useEffect } from 'react';
import { X, Save, AlertTriangle } from 'lucide-react';
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-white w-full h-full md:h-auto md:rounded-xl md:max-w-md md:max-h-[90vh] overflow-hidden flex flex-col animate-slide-up">
        <div className="flex-shrink-0 bg-white border-b p-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Edit Document</h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition"
            type="button"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          <p className="text-sm text-gray-600 mb-4">
            Update the document filename, date, and note. The note will be updated for the document and all lab/vital values extracted from it.
          </p>
          
          {/* Filename Input */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              File Name
            </label>
            <input
              type="text"
              value={documentFileNameEdit}
              onChange={(e) => setDocumentFileNameEdit(e.target.value)}
              placeholder="Enter file name"
              disabled={isSaving}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-medical-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              maxLength={255}
            />
            <p className="text-xs text-gray-500 mt-1">
              {documentFileNameEdit.length}/255 characters
            </p>
          </div>
          
          {/* Date Input */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-gray-900">
                Document Date
              </label>
              {!hasMultipleDates && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={keepOriginalDate}
                    onChange={(e) => setKeepOriginalDate(e.target.checked)}
                    disabled={isSaving}
                    className="w-4 h-4 text-medical-primary-600 border-gray-300 rounded focus:ring-medical-primary-500 disabled:opacity-50"
                  />
                  <span className="text-xs text-gray-600">Keep original date</span>
                </label>
              )}
            </div>
            
            {/* Warning for multiple dates */}
            {hasMultipleDates && (
              <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-amber-900 mb-1">
                      Multiple Dates Detected
                    </p>
                    <p className="text-xs text-amber-800 mb-3">
                      This document contains values with different dates ({dateRange.min && dateRange.max ? `${formatDateString(dateRange.min)} to ${formatDateString(dateRange.max)}` : 'various dates'}). 
                      Changing the document date will <strong>overwrite all values with a single date</strong>.
                    </p>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={acknowledgeOverwrite}
                        onChange={(e) => setAcknowledgeOverwrite(e.target.checked)}
                        disabled={isSaving}
                        className="w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500 disabled:opacity-50 mt-0.5"
                      />
                      <span className="text-xs text-amber-900">
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
                          className="text-xs text-amber-700 hover:text-amber-900 underline font-medium"
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
            
            <p className="text-xs text-gray-500 mt-1">
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
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Document Note
            </label>
            <textarea
              value={documentNoteEdit}
              onChange={(e) => setDocumentNoteEdit(e.target.value)}
              placeholder="e.g., Before starting treatment, After cycle 2, Post-surgery..."
              rows={3}
              disabled={isSaving}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-medical-primary-500 resize-none disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-1">
              {documentNoteEdit.length}/200 characters
            </p>
          </div>
        </div>
        <div className="flex-shrink-0 border-t p-4 bg-white">
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              disabled={isSaving}
              className="flex-1 bg-gray-200 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 bg-medical-primary-500 text-white py-2.5 rounded-lg font-medium hover:bg-medical-primary-600 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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

