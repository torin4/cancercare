import React, { useState, useEffect } from 'react';
import { X, RefreshCw, Activity, AlertTriangle } from 'lucide-react';
import { DesignTokens, combineClasses } from '../../design/designTokens';
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
        <div className={combineClasses('w-12 h-12 rounded-full flex items-center justify-center mb-4 mx-auto', DesignTokens.colors.primary[100])}>
          <RefreshCw className={combineClasses('', DesignTokens.colors.primary.text[600])} size={24} />
        </div>

        <h3 className={combineClasses('text-lg font-bold text-center mb-2', DesignTokens.colors.neutral.text[900])}>
          Rescan {docType} Document?
        </h3>

        <p className={combineClasses('text-sm text-center mb-6', DesignTokens.colors.neutral.text[600])}>
          This will re-extract all data from "<span className="font-semibold">{fileName}</span>". You can edit the date and note below.
        </p>

        {/* Edit Form */}
        <div className="space-y-4 mb-6">
          {/* Date Input */}
          <div>
            <label className={combineClasses('block text-sm font-semibold mb-2', DesignTokens.colors.neutral.text[900])}>
              Document Date
            </label>
            
            {/* Warning for multiple dates */}
            {hasMultipleDates && (
              <div className={combineClasses('mb-3 p-3 border rounded-lg', DesignTokens.components.status.low.bg, DesignTokens.components.status.low.border)}>
                <div className="flex items-start gap-2">
                  <AlertTriangle className={combineClasses('w-5 h-5 flex-shrink-0 mt-0.5', DesignTokens.components.status.low.icon)} />
                  <div className="flex-1">
                    <p className={combineClasses('text-sm font-semibold mb-1', DesignTokens.components.status.low.text.replace('600', '900'))}>
                      Multiple Dates Detected
                    </p>
                    <p className={combineClasses('text-xs mb-3', DesignTokens.components.status.low.text.replace('600', '800'))}>
                      This document contains values with different dates ({dateRange.min && dateRange.max ? `${formatDateString(dateRange.min)} to ${formatDateString(dateRange.max)}` : 'various dates'}). 
                      Entering a date here will <strong>overwrite all values with a single date</strong>.
                    </p>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={acknowledgeOverwrite}
                        onChange={(e) => setAcknowledgeOverwrite(e.target.checked)}
                        disabled={isProcessing}
                        className={combineClasses('w-4 h-4 rounded focus:ring-medical-primary-500 disabled:opacity-50 mt-0.5', DesignTokens.components.status.low.icon, DesignTokens.colors.neutral.border[300])}
                      />
                      <span className={combineClasses('text-xs', DesignTokens.components.status.low.text.replace('600', '900'))}>
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
            
            <p className={combineClasses('text-xs mt-1', DesignTokens.colors.neutral.text[500])}>
              {hasMultipleDates && !acknowledgeOverwrite
                ? 'Check the box above to enable date editing. This will overwrite all values with a single date.'
                : hasMultipleDates && acknowledgeOverwrite
                  ? 'Enter a date to overwrite all values. Leave empty to extract dates from document.'
                  : 'Leave empty to extract date from document'}
            </p>
          </div>

          {/* Note Input */}
          <div>
            <label className={combineClasses('block text-sm font-semibold mb-2', DesignTokens.colors.neutral.text[900])}>
              Document Note
            </label>
            <textarea
              value={editedNote}
              onChange={(e) => setEditedNote(e.target.value)}
              disabled={isProcessing}
              placeholder="Add a note about this document (optional)"
              rows={3}
              className={combineClasses('w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-medical-primary-500 focus:border-medical-primary-500 disabled:cursor-not-allowed text-sm resize-none', DesignTokens.components.input.base, DesignTokens.components.input.textarea, DesignTokens.components.input.disabled)}
            />
            <p className={combineClasses('text-xs mt-1', DesignTokens.colors.neutral.text[500])}>
              {editedNote.length}/200 characters
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          <button
            onClick={handleConfirm}
            disabled={isProcessing}
            className={combineClasses('w-full py-3 rounded-xl font-bold text-white transition-all shadow-lg flex items-center justify-center gap-2 active:scale-[0.98]', isProcessing ? `${DesignTokens.colors.neutral[400]} cursor-not-allowed` : `${DesignTokens.colors.primary[600]} ${DesignTokens.colors.primary[700].replace('bg-', 'hover:bg-')}`)}
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
            className={combineClasses('w-full py-3 rounded-xl font-bold transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed', DesignTokens.colors.neutral.text[700], DesignTokens.colors.neutral[100].replace('bg-', 'hover:bg-'))}
          >
            <X className="w-4 h-4" />
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
