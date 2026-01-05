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
  const [onlyExistingMetrics, setOnlyExistingMetrics] = useState(false);

  // Check for multiple dates when modal opens
  useEffect(() => {
    const checkMultipleDates = async () => {
      if (show && document && user) {
        setIsCheckingDates(true);
        try {
          // OPTIMIZATION: Use stored document metadata if available (much faster)
          if (document.hasMultipleDates && document.minDate && document.maxDate) {
            const minDate = document.minDate?.toDate ? document.minDate.toDate() : new Date(document.minDate);
            const maxDate = document.maxDate?.toDate ? document.maxDate.toDate() : new Date(document.maxDate);
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
              if (value.documentId === document.id && value.date) {
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
              if (value.documentId === document.id && value.date) {
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
  }, [show, document, user]);

  // Update state when document changes
  useEffect(() => {
    if (document) {
      
      // Format date for input[type="date"] - use local timezone to avoid one-day shift
      let dateValue = '';
      if (document.date) {
        if (typeof document.date === 'string') {
          // If it's already a string in YYYY-MM-DD format, use it directly
          if (/^\d{4}-\d{2}-\d{2}$/.test(document.date)) {
            dateValue = document.date;
          } else {
            // Try to parse other string formats using local date parsing
            try {
              const d = parseLocalDate(document.date);
              if (!isNaN(d.getTime())) {
                // Format as YYYY-MM-DD using local date components
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                dateValue = `${year}-${month}-${day}`;
              }
            } catch (e) {
            }
          }
        } else if (document.date.toDate) {
          // If it's a Firestore Timestamp, convert to Date then format using local timezone
          const d = parseLocalDate(document.date.toDate());
          if (!isNaN(d.getTime())) {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            dateValue = `${year}-${month}-${day}`;
          }
        } else if (document.date instanceof Date) {
          // If it's a Date object, format using local timezone
          const d = parseLocalDate(document.date);
          if (!isNaN(d.getTime())) {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            dateValue = `${year}-${month}-${day}`;
          }
        } else {
          // Try to parse as Date using local date parsing
          try {
            const d = parseLocalDate(document.date);
            if (!isNaN(d.getTime())) {
              const year = d.getFullYear();
              const month = String(d.getMonth() + 1).padStart(2, '0');
              const day = String(d.getDate()).padStart(2, '0');
              dateValue = `${year}-${month}-${day}`;
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
      note: editedNote || null,
      onlyExistingMetrics
    });
  };

  return (
    <div className={combineClasses(DesignTokens.components.modal.backdrop, 'z-[101] animate-in fade-in duration-200')}>
      <div className={combineClasses('bg-white', DesignTokens.borders.radius.lg, 'max-w-md w-full', DesignTokens.spacing.card.desktop, DesignTokens.shadows.lg, 'animate-fade-scale')}>
        <div className={combineClasses('w-12 h-12', DesignTokens.borders.radius.full, 'flex items-center justify-center', DesignTokens.spacing.header.mobile, 'mx-auto', DesignTokens.colors.primary[100])}>
          <RefreshCw className={combineClasses(DesignTokens.colors.primary.text[600])} size={24} />
        </div>

        <h3 className={combineClasses(DesignTokens.typography.h2.full, DesignTokens.typography.h2.weight, 'text-center mb-2', DesignTokens.colors.neutral.text[900])}>
          Rescan {docType} Document?
        </h3>

        <p className={combineClasses(DesignTokens.typography.body.sm, 'text-center', DesignTokens.spacing.header.mobile, DesignTokens.colors.neutral.text[600])}>
          This will re-extract all data from "<span className={DesignTokens.typography.h3.weight}>{fileName}</span>". You can edit the date and note below.
        </p>

        {/* Edit Form */}
        <div className={combineClasses('space-y-4', DesignTokens.spacing.gap.lg, DesignTokens.spacing.header.mobile)}>
          {/* Date Input */}
          <div>
            <label className={combineClasses('block', DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, 'mb-2', DesignTokens.colors.neutral.text[900])}>
              Document Date
            </label>
            
            {/* Warning for multiple dates */}
            {hasMultipleDates && (
              <div className={combineClasses('mb-3', DesignTokens.spacing.card.mobile, DesignTokens.borders.width.default, DesignTokens.borders.radius.sm, DesignTokens.components.status.low.bg, DesignTokens.components.status.low.border)}>
                <div className={combineClasses('flex items-start', DesignTokens.spacing.gap.sm)}>
                  <AlertTriangle className={combineClasses(DesignTokens.icons.button.size.full, 'flex-shrink-0 mt-0.5', DesignTokens.components.status.low.icon)} />
                  <div className="flex-1">
                    <p className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, 'mb-1', DesignTokens.components.status.low.text.replace('600', '900'))}>
                      Multiple Dates Detected
                    </p>
                    <p className={combineClasses(DesignTokens.typography.body.xs, 'mb-3', DesignTokens.components.status.low.text.replace('600', '800'))}>
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
                      <span className={combineClasses(DesignTokens.typography.body.xs, DesignTokens.components.status.low.text.replace('600', '900'))}>
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
            <label className={combineClasses('block', DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, 'mb-2', DesignTokens.colors.neutral.text[900])}>
              Document Note
            </label>
            <textarea
              value={editedNote}
              onChange={(e) => setEditedNote(e.target.value)}
              disabled={isProcessing}
              placeholder="Add a note about this document (optional)"
              rows={3}
              className={combineClasses(DesignTokens.components.input.base, DesignTokens.components.input.textarea, DesignTokens.components.input.disabled, DesignTokens.borders.radius.sm, 'focus:ring-2 focus:ring-medical-primary-500 focus:border-medical-primary-500')}
            />
            <p className={combineClasses(DesignTokens.typography.body.xs, 'mt-1', DesignTokens.colors.neutral.text[500])}>
              {editedNote.length}/200 characters
            </p>
          </div>

          {/* Extract Only Existing Metrics Option */}
          <div className={combineClasses(DesignTokens.spacing.card.mobile, DesignTokens.borders.width.default, DesignTokens.borders.radius.sm, DesignTokens.colors.neutral[50], DesignTokens.colors.neutral.border[200])}>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyExistingMetrics}
                onChange={(e) => setOnlyExistingMetrics(e.target.checked)}
                disabled={isProcessing}
                className={combineClasses('mt-1', DesignTokens.components.input.checkbox)}
              />
              <div className="flex-1">
                <p className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, 'mb-1', DesignTokens.colors.neutral.text[900])}>
                  Extract only metrics that exist in my profile
                </p>
                <p className={combineClasses(DesignTokens.typography.body.xs, DesignTokens.colors.neutral.text[600])}>
                  Only extract lab values and vitals that you've already added to your health profile. This helps avoid creating duplicate entries for tests you don't track.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Action Buttons */}
        <div className={combineClasses('flex flex-col', DesignTokens.spacing.gap.md)}>
          <button
            onClick={handleConfirm}
            disabled={isProcessing}
            className={combineClasses('w-full py-3', DesignTokens.borders.radius.md, DesignTokens.typography.h2.weight, 'text-white', DesignTokens.transitions.all, DesignTokens.shadows.lg, 'flex items-center justify-center', DesignTokens.spacing.gap.sm, 'active:scale-[0.98]', isProcessing ? `${DesignTokens.colors.neutral[400]} cursor-not-allowed` : `${DesignTokens.colors.primary[600]} ${DesignTokens.colors.primary[700].replace('bg-', 'hover:bg-')}`)}
          >
            {isProcessing ? (
              <>
                <Activity className={combineClasses(DesignTokens.icons.standard.size.full, 'animate-spin')} />
                Processing...
              </>
            ) : (
              <>
                <RefreshCw className={DesignTokens.icons.standard.size.full} />
                Rescan Document
              </>
            )}
          </button>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className={combineClasses('w-full py-3', DesignTokens.borders.radius.md, DesignTokens.typography.h2.weight, DesignTokens.transitions.default, 'flex items-center justify-center', DesignTokens.spacing.gap.sm, 'disabled:opacity-50 disabled:cursor-not-allowed', DesignTokens.colors.neutral.text[700], DesignTokens.colors.neutral[100].replace('bg-', 'hover:bg-'))}
          >
            <X className={DesignTokens.icons.standard.size.full} />
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
