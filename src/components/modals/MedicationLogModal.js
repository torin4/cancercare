import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { X, Pill, Loader2 } from 'lucide-react';
import { DesignTokens, combineClasses } from '../../design/designTokens';
import { useAuth } from '../../contexts/AuthContext';
import { useBanner } from '../../contexts/BannerContext';
import { medicationService, medicationLogService } from '../../firebase/services';

function timeToMinutes(timeStr) {
  const m = String(timeStr || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!m) return null;
  let hour = parseInt(m[1], 10);
  const minute = parseInt(m[2], 10);
  const period = m[3]?.toUpperCase();
  if (period) {
    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
  }
  return hour * 60 + minute;
}

function hasTimedSchedule(med) {
  return typeof med?.schedule === 'string' && med.schedule.includes(':');
}

export default function MedicationLogModal({ show, onClose }) {
  const { user } = useAuth();
  const { showSuccess, showError } = useBanner();
  const [medications, setMedications] = useState([]);
  const [medicationLog, setMedicationLog] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!show || !user?.uid) return;
    setLoading(true);
    Promise.all([
      medicationService.getMedications(user.uid),
      medicationLogService.getMedicationLogs(user.uid)
    ])
      .then(([meds, logs]) => {
        setMedications(meds || []);
        setMedicationLog(logs || []);
      })
      .catch((err) => {
        console.error('MedicationLogModal load error:', err);
        showError('Failed to load medications.');
      })
      .finally(() => setLoading(false));
  }, [show, user?.uid]);

  const isMedicationTaken = (medId, scheduledTime) => {
    const today = new Date().toDateString();
    return medicationLog.some((log) => {
      const logDate = new Date(log.takenAt).toDateString();
      return log.medId === medId && log.scheduledTime === scheduledTime && logDate === today;
    });
  };

  const findTodaysMedicationLog = (medId, scheduledTime) => {
    const today = new Date().toDateString();
    return medicationLog.find((log) => {
      const logDate = new Date(log.takenAt).toDateString();
      return log.medId === medId && log.scheduledTime === scheduledTime && logDate === today;
    }) || null;
  };

  const markMedicationTaken = async (medId, scheduledTime) => {
    if (!user?.uid) {
      showError('You must be logged in to log medications.');
      return;
    }
    try {
      if (isMedicationTaken(medId, scheduledTime)) {
        const existing = findTodaysMedicationLog(medId, scheduledTime);
        if (existing?.id) {
          await medicationLogService.deleteMedicationLog(existing.id);
        } else {
          const logs = await medicationLogService.getMedicationLogsByMed(user.uid, medId);
          const today = new Date().toDateString();
          const matches = logs.filter((l) => {
            const logDate = new Date(l.takenAt).toDateString();
            return l.scheduledTime === scheduledTime && logDate === today;
          });
          await Promise.all(matches.map((l) => medicationLogService.deleteMedicationLog(l.id)));
        }
        setMedicationLog((prev) => {
          const today = new Date().toDateString();
          return prev.filter((l) => {
            const logDate = new Date(l.takenAt).toDateString();
            return !(l.medId === medId && l.scheduledTime === scheduledTime && logDate === today);
          });
        });
        showSuccess('Marked as not taken');
        return;
      }
      const now = new Date();
      const logEntry = { patientId: user.uid, medId, scheduledTime, takenAt: now };
      const logId = await medicationLogService.addMedicationLog(logEntry);
      setMedicationLog((prev) => [
        ...prev,
        { id: logId, medId, scheduledTime, takenAt: now.toISOString() }
      ]);
      showSuccess('Medication marked as taken');
    } catch (error) {
      showError('Failed to save. Please try again.');
      console.error('MedicationLogModal markMedicationTaken:', error);
    }
  };

  const todaySlots = medications
    .filter((med) => med.active && (med.status || 'active') !== 'stopped' && hasTimedSchedule(med))
    .flatMap((med) =>
      med.schedule.split(',').map((time) => ({ ...med, specificTime: time.trim() }))
    )
    .filter((m) => m.specificTime && m.specificTime.includes(':'))
    .sort((a, b) => {
      const aMin = timeToMinutes(a.specificTime);
      const bMin = timeToMinutes(b.specificTime);
      if (aMin === null && bMin === null) return a.specificTime.localeCompare(b.specificTime);
      if (aMin === null) return 1;
      if (bMin === null) return -1;
      return aMin - bMin;
    });

  if (!show) return null;

  return (
    <div className={combineClasses(DesignTokens.components.modal.backdrop, 'z-50')}>
      <div
        role="dialog"
        aria-label="Log medications for today"
        className={combineClasses('w-full h-full md:h-auto', DesignTokens.borders.radius.lg, 'md:max-w-md md:max-h-[85vh] overflow-hidden flex flex-col animate-slide-up', DesignTokens.components.modal.container)}
      >
        <div className={DesignTokens.components.modal.header}>
          <h3 className={combineClasses(DesignTokens.components.modal.title, 'flex items-center gap-2')}>
            <Pill className={combineClasses('w-5 h-5', DesignTokens.colors.app.text[700])} />
            Log medications
          </h3>
          <button
            type="button"
            onClick={onClose}
            className={combineClasses(DesignTokens.transitions.default, DesignTokens.components.modal.closeButton)}
            aria-label="Close"
          >
            <X className={DesignTokens.icons.header.size.full} />
          </button>
        </div>

        <p className={combineClasses(DesignTokens.typography.body.sm, 'px-4 pt-0 pb-2 flex-shrink-0', DesignTokens.colors.neutral.text[600])}>
          Mark today&apos;s doses as taken or undo.
        </p>

        <div className={combineClasses('flex-1 overflow-y-auto', DesignTokens.components.modal.body, 'pt-0')}>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className={combineClasses('w-6 h-6 animate-spin', DesignTokens.colors.app.text[500])} />
            </div>
          ) : todaySlots.length === 0 ? (
            <p className={combineClasses(DesignTokens.typography.body.sm, 'py-4', DesignTokens.colors.neutral.text[500])}>
              No scheduled medications for today. Add medications in Health to see them here.
            </p>
          ) : (
            <div className="space-y-2">
              {todaySlots.map((med, idx) => {
                const taken = isMedicationTaken(med.id, med.specificTime);
                return (
                  <button
                    key={`${med.id}-${idx}`}
                    type="button"
                    onClick={() => markMedicationTaken(med.id, med.specificTime)}
                    className={combineClasses(
                      'w-full flex items-center gap-2 sm:gap-3 p-3 border-2 rounded-lg transition min-h-[56px] touch-manipulation active:opacity-70',
                      taken
                        ? combineClasses(DesignTokens.components.status.normal.border.replace('200', '300'), DesignTokens.components.status.normal.bg, 'cursor-default')
                        : combineClasses(DesignTokens.colors.neutral.border[200], 'hover:border-green-400 hover:bg-green-50/50')
                    )}
                  >
                    <span className={combineClasses('text-xs sm:text-sm font-semibold w-14 sm:w-20 flex-shrink-0', DesignTokens.colors.neutral.text[700])}>
                      {med.specificTime}
                    </span>
                    <div className="flex-1 text-left min-w-0">
                      <p className={combineClasses('text-sm font-medium truncate', DesignTokens.colors.neutral.text[900])}>{med.name}</p>
                      {med.dosage && (
                        <p className={combineClasses('text-xs truncate', DesignTokens.colors.neutral.text[600])}>{med.dosage}</p>
                      )}
                    </div>
                    <div className={combineClasses('w-6 h-6 flex-shrink-0 rounded-full border-2 flex items-center justify-center', taken ? 'border-green-500 bg-green-500' : DesignTokens.colors.neutral.border[300])}>
                      {taken && (
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

MedicationLogModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired
};
