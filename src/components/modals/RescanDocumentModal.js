import React, { useState, useEffect } from 'react';
import { X, RefreshCw, Activity, AlertTriangle } from 'lucide-react';
import { labService, vitalService } from '../../firebase/services';
import { formatDateString, parseLocalDate } from '../../utils/helpers';
import DatePicker from '../DatePicker';

export default function RescanDocumentModal({
  show,
  onClose,
  onConfirm,
  document,
  user,
  isProcessing = false
}) {
  // Initialize with document's current values
  const [editedDate, setEditedDate] = useState('');
  const [editedNote, setEditedNote] = useState('');
  const [hasMultipleDates, setHasMultipleDates] = useState(false);
  const [dateRange, setDateRange] = useState({ min: null, max: null });
  const [isCheckingDates, setIsCheckingDates] = useState(false);
  const [acknowledgeOverwrite, setAcknowledgeOverwrite] = useState(false);

  // Check for multiple dates when modal opens
  useEffect(() => {
    const checkMultipleDates = async () => {
      if (show && document && user) {
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
              if (value.documentId === document.id && value.date) {
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
              if (value.documentId === document.id && value.date) {
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
  }, [show, document, user]);

  // Update state when document changes
  useEffect(() => {
    if (document) {
      
      // Format date for input[type="date"]
      let dateValue = '';
      if (document.date) {
        if (typeof document.date === 'string') {
          // If it's already a string in YYYY-MM-DD format, use it directly
          if (/^\d{4}-\d{2}-\d{2}$/.test(document.date)) {
            dateValue = document.date;
          } else {
            // Try to parse other string formats
            try {
              const d = new Date(document.date);
              if (!isNaN(d.getTime())) {
                dateValue = d.toISOString().split('T')[0];
              }
            } catch (e) {
            }
          }
        } else if (document.date.toDate) {
          // If it's a Firestore Timestamp, convert to Date then to string
          dateValue = document.date.toDate().toISOString().split('T')[0];
        } else if (document.date instanceof Date) {
          // If it's a Date object, convert to string
          dateValue = document.date.toISOString().split('T')[0];
        } else {
          // Try to parse as Date
          try {
            const d = new Date(document.date);
            if (!isNaN(d.getTime())) {
              dateValue = d.toISOString().split('T')[0];
            }
          } catch (e) {
            dateValue = '';
          }
        }
      }
      
      setEditedDate(dateValue);
      setEditedNote(document.note || document.note || ''); // Ensure note is set even if undefined
      setAcknowledgeOverwrite(false); // Reset acknowledgment when document changes
    } else {
      // Reset when document is null
      setEditedDate('');
      setEditedNote('');
      setHasMultipleDates(false);
      setDateRange({ min: null, max: null });
      setAcknowledgeOverwrite(false);
    }
  }, [document]);

  if (!show || !document) return null;

  const fileName = document.fileName || document.name || 'document';
  const docType = document.documentType || document.type || 'document';

  const handleConfirm = () => {
    onConfirm({
      date: editedDate || null,
      note: editedNote || null
    });
  };

  return (
    <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-fade-scale">
        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4 mx-auto">
          <RefreshCw className="text-blue-600" size={24} />
        </div>

        <h3 className="text-lg font-bold text-gray-900 text-center mb-2">
          Rescan {docType} Document?
        </h3>

        <p className="text-sm text-gray-600 text-center mb-6">
          This will re-extract all data from "<span className="font-semibold">{fileName}</span>". You can edit the date and note below.
        </p>

        {/* Edit Form */}
        <div className="space-y-4 mb-6">
          {/* Date Input */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Document Date
            </label>
            
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
                      Entering a date here will <strong>overwrite all values with a single date</strong>.
                    </p>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={acknowledgeOverwrite}
                        onChange={(e) => setAcknowledgeOverwrite(e.target.checked)}
                        disabled={isProcessing}
                        className="w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500 disabled:opacity-50 mt-0.5"
                      />
                      <span className="text-xs text-amber-900">
                        I understand this will overwrite all dates with a single date
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            )}
            
            {/* Date picker - show if no multiple dates, or if multiple dates and acknowledged */}
            {(!hasMultipleDates || acknowledgeOverwrite) && (
              <DatePicker
                value={editedDate}
                onChange={(e) => setEditedDate(e.target.value)}
                disabled={isProcessing}
                placeholder="YYYY-MM-DD"
                className="w-full"
              />
            )}
            
            <p className="text-xs text-gray-500 mt-1">
              {hasMultipleDates && !acknowledgeOverwrite
                ? 'Check the box above to enable date editing. This will overwrite all values with a single date.'
                : hasMultipleDates && acknowledgeOverwrite
                  ? 'Enter a date to overwrite all values. Leave empty to extract dates from document.'
                  : 'Leave empty to extract date from document'}
            </p>
          </div>

          {/* Note Input */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Document Note
            </label>
            <textarea
              value={editedNote}
              onChange={(e) => setEditedNote(e.target.value)}
              disabled={isProcessing}
              placeholder="Add a note about this document (optional)"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed text-sm resize-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              {editedNote.length}/200 characters
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          <button
            onClick={handleConfirm}
            disabled={isProcessing}
            className={`w-full py-3 rounded-xl font-bold text-white transition-all shadow-lg flex items-center justify-center gap-2 ${
              isProcessing
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98]'
            }`}
          >
            {isProcessing ? (
              <>
                <Activity className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Rescan Document
              </>
            )}
          </button>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="w-full py-3 rounded-xl font-bold text-gray-700 hover:bg-gray-100 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-4 h-4" />
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
