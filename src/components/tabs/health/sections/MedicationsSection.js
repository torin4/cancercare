/**
 * MedicationsSection Component
 * 
 * Extracted from HealthTab to improve organization and maintainability.
 * This component handles all medications-related functionality including:
 * - Medication tracking and display
 * - Medication adherence monitoring
 * - Today's schedule view
 * - Adding/editing/deleting medications
 */

import React, { useState, useEffect } from 'react';
import {
  Pill, Edit2, Plus, MessageSquare, AlertCircle, Check, Trash2, MoreVertical, PauseCircle, PlayCircle, Square, Calendar
} from 'lucide-react';
import { DesignTokens, combineClasses } from '../../../../design/designTokens';
import { useAuth } from '../../../../contexts/AuthContext';
import { useBanner } from '../../../../contexts/BannerContext';
import { medicationActivityService, medicationService, medicationLogService, journalNoteService } from '../../../../firebase/services';
import AddMedicationModal from '../../../modals/AddMedicationModal';
import DeletionConfirmationModal from '../../../modals/DeletionConfirmationModal';
import UpdateDosageModal from '../../../modals/UpdateDosageModal';

function MedicationsSection({ onTabChange }) {
  const { user } = useAuth();
  const { showSuccess, showError } = useBanner();

  // Medications-specific state
  const [medications, setMedications] = useState([]);
  const [medicationLog, setMedicationLog] = useState([]);
  const [showAddMedication, setShowAddMedication] = useState(false);
  const [editingMedication, setEditingMedication] = useState(null);
  const [isDeletingMedication, setIsDeletingMedication] = useState(false);
  const [isTogglingMedication, setIsTogglingMedication] = useState(false);
  const [openMedicationMenu, setOpenMedicationMenu] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({
    show: false,
    title: '',
    message: '',
    onConfirm: null,
    itemName: '',
    confirmText: 'Yes, Delete Permanently'
  });
  const [logRange, setLogRange] = useState('7'); // '7' | '30' | '90' | 'all'
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [removeLogConfirm, setRemoveLogConfirm] = useState({ show: false, log: null });
  const [markingTakenFor, setMarkingTakenFor] = useState(null); // { dateKey, medId, scheduledTime }
  const [updateDosageMedication, setUpdateDosageMedication] = useState(null);

  // Load medications
  useEffect(() => {
    const loadMedications = async () => {
      if (user) {
        try {
          const meds = await medicationService.getMedications(user.uid);
          setMedications(meds);
        } catch (error) {
          // Error is silently handled; medications are not critical for app functionality
        }
      }
    };
    loadMedications();
  }, [user]);

  // Load medication logs
  useEffect(() => {
    const loadMedicationLogs = async () => {
      if (user) {
        try {
          const logs = await medicationLogService.getMedicationLogs(user.uid);
          setMedicationLog(logs);
        } catch (error) {
          console.error('Error loading medication logs:', error);
        }
      }
    };
    loadMedicationLogs();
  }, [user]);

  // Check if medication was taken for a specific scheduled time today
  const isMedicationTaken = (medId, scheduledTime) => {
    const today = new Date().toDateString();
    return medicationLog.some(log => {
      const logDate = new Date(log.takenAt).toDateString();
      return log.medId === medId &&
        log.scheduledTime === scheduledTime &&
        logDate === today;
    });
  };

  const findTodaysMedicationLog = (medId, scheduledTime) => {
    const today = new Date().toDateString();
    return medicationLog.find((log) => {
      const logDate = new Date(log.takenAt).toDateString();
      return log.medId === medId && log.scheduledTime === scheduledTime && logDate === today;
    }) || null;
  };

  // Filter logs by selected range (7 days, 1 month, 3 months, all)
  const getLogsInRange = () => {
    if (!medicationLog.length) return [];
    const now = Date.now();
    let cutoffMs = 0;
    if (logRange === '7') cutoffMs = now - 7 * 24 * 60 * 60 * 1000;
    else if (logRange === '30') cutoffMs = now - 30 * 24 * 60 * 60 * 1000;
    else if (logRange === '90') cutoffMs = now - 90 * 24 * 60 * 60 * 1000;
    return medicationLog.filter((log) => {
      const t = log.takenAt instanceof Date ? log.takenAt.getTime() : new Date(log.takenAt).getTime();
      return t >= cutoffMs;
    });
  };

  // Flat list of filtered logs, newest first. Cap at 50 for "All".
  const getLogsFlat = () => {
    const logs = getLogsInRange();
    const sorted = [...logs].sort((a, b) => (new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime()));
    return logRange === 'all' ? sorted.slice(0, 50) : sorted;
  };

  // Parse a "8:00 AM" / "14:00" style time into minutes since midnight (local)
  const timeToMinutes = (timeStr) => {
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
  };

  const getNextDueTimeForToday = (med) => {
    if (!med?.schedule?.includes(':')) return null;
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const times = med.schedule
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.includes(':'));

    const parsed = times
      .map((t) => ({ t, minutes: timeToMinutes(t) }))
      .filter((x) => x.minutes !== null)
      .sort((a, b) => a.minutes - b.minutes);

    // First not-taken time that is still due today (>= now), else first not-taken time
    const notTaken = parsed.filter((x) => !isMedicationTaken(med.id, x.t));
    const dueLater = notTaken.find((x) => x.minutes >= nowMinutes);
    return (dueLater || notTaken[0] || parsed[0])?.t || null;
  };

  const hasTimedSchedule = (med) => typeof med?.schedule === 'string' && med.schedule.includes(':');

  /**
   * Returns true if the medication is due on the given date, based on its frequency and startDate.
   * Defaults to true for unknown/daily frequencies so they always appear.
   */
  const isMedicationDueOnDate = (med, date) => {
    const freq = med?.frequency;
    if (!freq) return true;

    // Daily or more frequent — always due
    if (['Once daily', 'Twice daily', 'Three times daily', 'Four times daily', 'As needed', 'Custom'].includes(freq)) {
      return true;
    }

    // For interval-based frequencies we need a reference start date
    const rawStart = med?.startDate;
    if (!rawStart) return true; // no start date stored — show it (safe default)

    // Normalise both dates to midnight local time for whole-day arithmetic
    const startMidnight = new Date(rawStart instanceof Date ? rawStart : new Date(rawStart));
    startMidnight.setHours(0, 0, 0, 0);
    const targetMidnight = new Date(date);
    targetMidnight.setHours(0, 0, 0, 0);

    const daysDiff = Math.round((targetMidnight - startMidnight) / (1000 * 60 * 60 * 24));

    if (freq === 'Every other day') {
      // Due on day 0, 2, 4, … from start
      return daysDiff >= 0 && daysDiff % 2 === 0;
    }
    if (freq === 'Weekly') {
      return daysDiff >= 0 && daysDiff % 7 === 0;
    }
    if (freq === 'Every 2 weeks') {
      return daysDiff >= 0 && daysDiff % 14 === 0;
    }
    if (freq === 'Every 3 weeks') {
      return daysDiff >= 0 && daysDiff % 21 === 0;
    }
    if (freq === 'Monthly') {
      // Due on the same day-of-month as startDate
      return targetMidnight.getDate() === startMidnight.getDate() && daysDiff >= 0;
    }

    return true; // unknown frequency — show it
  };

  // All dates in the selected range (for showing taken + missed per day).
  const getDatesInRange = () => {
    const now = new Date();
    const today = now.toDateString();
    let numDays = 7;
    if (logRange === '30') numDays = 30;
    else if (logRange === '90') numDays = 90;
    else if (logRange === 'all') numDays = 90;
    const dates = [];
    for (let i = 0; i < numDays; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toDateString();
      const label = key === today ? 'Today' : i === 1 ? 'Yesterday' : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
      dates.push({ dateKey: key, label });
    }
    return dates;
  };

  // For a given date, slots that were scheduled but not logged (missed).
  const getMissedSlotsForDate = (dateKey) => {
    const dateObj = new Date(dateKey);
    const activeWithSchedule = medications.filter((m) => m.active && (m.status || 'active') !== 'stopped' && hasTimedSchedule(m) && isMedicationDueOnDate(m, dateObj));
    const takenSet = new Set();
    medicationLog.forEach((log) => {
      const logDate = log.takenAt instanceof Date ? log.takenAt : new Date(log.takenAt);
      if (logDate.toDateString() === dateKey && log.scheduledTime) {
        takenSet.add(log.medId + '|' + log.scheduledTime);
      }
    });
    const missed = [];
    activeWithSchedule.forEach((med) => {
      const times = med.schedule.split(',').map((t) => t.trim()).filter((t) => t.includes(':'));
      times.forEach((scheduledTime) => {
        if (!takenSet.has(med.id + '|' + scheduledTime)) {
          missed.push({ medId: med.id, medName: med.name, scheduledTime });
        }
      });
    });
    return missed.sort((a, b) => {
      const aMin = timeToMinutes(a.scheduledTime) ?? 0;
      const bMin = timeToMinutes(b.scheduledTime) ?? 0;
      return aMin - bMin;
    });
  };

  // Group by date: each day in range has logs (taken) and missedSlots. Only include days that have logs or missed.
  const getLogsGroupedByDate = () => {
    const dates = getDatesInRange();
    const logsByDate = {};
    getLogsFlat().forEach((log) => {
      const d = log.takenAt instanceof Date ? log.takenAt : new Date(log.takenAt);
      const key = d.toDateString();
      if (!logsByDate[key]) logsByDate[key] = [];
      logsByDate[key].push(log);
    });
    return dates
      .map(({ dateKey, label }) => {
        const logs = (logsByDate[dateKey] || []).sort((a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime());
        const missedSlots = getMissedSlotsForDate(dateKey);
        return { dateKey, label, logs, missedSlots };
      })
      .filter((g) => g.logs.length > 0 || g.missedSlots.length > 0);
  };

  const logRangeLabel = logRange === '7' ? '7 days' : logRange === '30' ? '1 month' : logRange === '90' ? '3 months' : 'All';
  const groupedLogs = getLogsGroupedByDate();
  const totalInRange = getLogsInRange().length;
  const showingCap = logRange === 'all' && totalInRange > 50;

  // Mark medication as taken
  const markMedicationTaken = async (medId, scheduledTime) => {
    if (!user || !user.uid) {
      showError('You must be logged in to mark medications as taken.');
      return;
    }

    try {
      // Toggle off if already taken today
      if (isMedicationTaken(medId, scheduledTime)) {
        const existing = findTodaysMedicationLog(medId, scheduledTime);
        if (existing?.id) {
          await medicationLogService.deleteMedicationLog(existing.id);
        } else {
          // Fallback: if we don't have an id in local state, refetch and delete matching log(s)
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
      const logEntry = {
        patientId: user.uid,
        medId: medId,
        scheduledTime: scheduledTime,
        takenAt: now
      };

      // Persist to Firebase
      const logId = await medicationLogService.addMedicationLog(logEntry);

      // Update local state immediately for instant UI feedback
      setMedicationLog([...medicationLog, {
        id: logId,
        medId: medId,
        scheduledTime: scheduledTime,
        takenAt: now.toISOString()
      }]);

      showSuccess('Medication marked as taken');
    } catch (error) {
      showError('Failed to save medication log. Please try again.');
      console.error('Error saving medication log:', error);
    }
  };

  const confirmDeleteMedication = (med) => {
    setDeleteConfirm({
      show: true,
      title: `Delete ${med.name}?`,
      message: 'This will permanently delete this medication. Your adherence history for this medication will also be removed.',
      itemName: 'medication',
      confirmText: 'Yes, Delete',
      onConfirm: async () => {
        if (!user?.uid) {
          showError('You must be logged in to delete medications.');
          return;
        }

        setIsDeletingMedication(true);
        try {
          // Activity log (best-effort) BEFORE deletion
          try {
            await medicationActivityService.addActivity({
              patientId: user.uid,
              medId: med.id,
              action: 'deleted',
              medName: med.name,
              details: { reason: 'user_action' }
            });
          } catch (e) {
            // non-blocking
          }

          // Best-effort: delete associated adherence logs first
          try {
            const logs = await medicationLogService.getMedicationLogsByMed(user.uid, med.id);
            if (logs?.length) {
              await Promise.all(logs.map((l) => medicationLogService.deleteMedicationLog(l.id)));
              setMedicationLog((prev) => prev.filter((l) => l.medId !== med.id));
            }
          } catch (logErr) {
            // If log cleanup fails, still proceed with medication deletion
          }

          await medicationService.deleteMedication(med.id);
          setMedications((prev) => prev.filter((m) => m.id !== med.id));

          // Add journal note
          try {
            await journalNoteService.addJournalNote({
              patientId: user.uid,
              date: new Date(),
              content: `Deleted medication: ${med.name} (${med.dosage}, ${med.frequency}). All history removed.`
            });
          } catch (e) {
            // Non-blocking
          }

          showSuccess('Medication deleted (activity logged).');
        } catch (error) {
          showError('Failed to delete medication. Please try again.');
        } finally {
          setIsDeletingMedication(false);
          setDeleteConfirm((prev) => ({ ...prev, show: false }));
        }
      }
    });
  };

  const handleRemoveLogFromHistory = async () => {
    const { log } = removeLogConfirm;
    if (!log || !user?.uid) return;
    try {
      await medicationLogService.deleteMedicationLog(log.id);
      setMedicationLog((prev) => prev.filter((l) => l.id !== log.id));
      setRemoveLogConfirm({ show: false, log: null });
      showSuccess('Dose removed from history.');
    } catch (e) {
      showError('Failed to remove dose. Please try again.');
    }
  };

  // Mark a missed slot as taken (for a past date).
  const markMedicationTakenForDate = async (dateKey, medId, scheduledTime) => {
    if (!user?.uid) return;
    setMarkingTakenFor({ dateKey, medId, scheduledTime });
    try {
      const minutes = timeToMinutes(scheduledTime);
      const d = new Date(dateKey);
      const y = d.getFullYear(), mo = d.getMonth(), day = d.getDate();
      const hours = minutes != null ? Math.floor(minutes / 60) : 8;
      const mins = minutes != null ? minutes % 60 : 0;
      const takenAt = new Date(y, mo, day, hours, mins, 0, 0);
      const logId = await medicationLogService.addMedicationLog({
        patientId: user.uid,
        medId,
        scheduledTime,
        takenAt,
      });
      setMedicationLog((prev) => [{ id: logId, medId, scheduledTime, takenAt: takenAt.toISOString() }, ...prev]);
      showSuccess('Marked as taken.');
    } catch (e) {
      showError('Failed to save. Please try again.');
    } finally {
      setMarkingTakenFor(null);
    }
  };

  const toggleMedicationActive = async (med, nextActive) => {
    if (!user?.uid) {
      showError('You must be logged in to update medications.');
      return;
    }

    setIsTogglingMedication(true);
    try {
      await medicationService.setMedicationActive(med.id, nextActive);
      setMedications((prev) => prev.map((m) => (m.id === med.id ? { ...m, active: !!nextActive } : m)));

      // Activity log (best-effort)
      try {
        await medicationActivityService.addActivity({
          patientId: user.uid,
          medId: med.id,
          action: nextActive ? 'resumed' : 'paused',
          medName: med.name,
          details: { active: !!nextActive }
        });
      } catch (e) {
        // non-blocking
      }

      // Add journal note
      try {
        await journalNoteService.addJournalNote({
          patientId: user.uid,
          date: new Date(),
          content: nextActive
            ? `Resumed medication: ${med.name} (${med.dosage}, ${med.frequency}).`
            : `Paused medication: ${med.name} (${med.dosage}, ${med.frequency}).`
        });
      } catch (e) {
        // Non-blocking
      }

      showSuccess(nextActive ? 'Medication resumed (activity logged).' : 'Medication paused (activity logged).');
    } catch (e) {
      showError('Failed to update medication. Please try again.');
    } finally {
      setIsTogglingMedication(false);
    }
  };

  const stopMedication = async (med) => {
    if (!user?.uid) {
      showError('You must be logged in to update medications.');
      return;
    }

    setIsTogglingMedication(true);
    try {
      await medicationService.stopMedication(med.id);
      setMedications((prev) =>
        prev.map((m) => (m.id === med.id ? { ...m, active: false, status: 'stopped', stoppedAt: new Date() } : m))
      );

      try {
        await medicationActivityService.addActivity({
          patientId: user.uid,
          medId: med.id,
          action: 'stopped',
          medName: med.name,
          details: { status: 'stopped' }
        });
      } catch (e) { }

      // Add journal note
      try {
        await journalNoteService.addJournalNote({
          patientId: user.uid,
          date: new Date(),
          content: `Stopped medication: ${med.name} (${med.dosage}, ${med.frequency}). History preserved.`
        });
      } catch (e) {
        // Non-blocking
      }

      showSuccess('Medication stopped (history preserved).');
    } catch (e) {
      showError('Failed to stop medication. Please try again.');
    } finally {
      setIsTogglingMedication(false);
    }
  };

  const restartMedication = async (med) => {
    if (!user?.uid) {
      showError('You must be logged in to update medications.');
      return;
    }

    setIsTogglingMedication(true);
    try {
      await medicationService.restartMedication(med.id);
      setMedications((prev) =>
        prev.map((m) => (m.id === med.id ? { ...m, active: true, status: 'active', stoppedAt: null } : m))
      );

      try {
        await medicationActivityService.addActivity({
          patientId: user.uid,
          medId: med.id,
          action: 'restarted',
          medName: med.name,
          details: { status: 'active' }
        });
      } catch (e) { }

      // Add journal note
      try {
        await journalNoteService.addJournalNote({
          patientId: user.uid,
          date: new Date(),
          content: `Restarted medication: ${med.name} (${med.dosage}, ${med.frequency}).`
        });
      } catch (e) {
        // Non-blocking
      }

      showSuccess('Medication restarted.');
    } catch (e) {
      showError('Failed to restart medication. Please try again.');
    } finally {
      setIsTogglingMedication(false);
    }
  };

  return (
    <div className="space-y-4">
      {medications.length === 0 ? (
        <div className={combineClasses(DesignTokens.components.card.container, 'p-4 sm:p-6 text-center')}>
          <div className="flex flex-col items-center gap-3">
            <Pill className={combineClasses('w-10 h-10 sm:w-12 sm:h-12', DesignTokens.colors.app.text[400])} />
            <div>
              <h3 className={combineClasses('text-base sm:text-lg font-semibold mb-1', DesignTokens.colors.app.text[900])}>No Medications Tracked Yet</h3>
              <p className={combineClasses('text-xs sm:text-sm mb-4', DesignTokens.colors.app.text[700])}>
                Track your medications to monitor adherence and schedule doses
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => {
                    setEditingMedication(null);
                    setShowAddMedication(true);
                  }}
                  className={combineClasses(DesignTokens.components.button.outline.primary, DesignTokens.spacing.button.full, 'py-2.5 text-sm font-medium', DesignTokens.spacing.gap.sm, 'min-h-[44px] touch-manipulation active:opacity-70')}
                >
                  <Edit2 className="w-4 h-4" />
                  Manual Enter
                </button>
                <button
                  onClick={() => onTabChange('chat')}
                  className={combineClasses(DesignTokens.components.button.primary, DesignTokens.spacing.button.full, 'py-2.5', DesignTokens.spacing.gap.sm, DesignTokens.shadows.sm)}
                >
                  <MessageSquare className="w-4 h-4" />
                  Add via Chat
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Medication Adherence Banner */}
          {(() => {
            const activeMeds = medications.filter(med => med.active);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const medsWithSchedule = activeMeds.filter((med) => hasTimedSchedule(med) && isMedicationDueOnDate(med, new Date()));

            let takenCount = 0;
            let totalDueToday = 0;

            medsWithSchedule.forEach(med => {
              const times = med.schedule.split(',').map(t => t.trim());
              times.forEach(time => {
                if (time.includes(':')) {
                  totalDueToday++;
                  if (isMedicationTaken(med.id, time)) {
                    takenCount++;
                  }
                }
              });
            });

            let nextDose = null;
            let nextDoseMed = null;

            activeMeds.forEach(med => {
              if (med.nextDose) {
                const doseDate = new Date(med.nextDose);
                if (doseDate >= today) {
                  if (!nextDose || doseDate < nextDose) {
                    nextDose = doseDate;
                    nextDoseMed = med;
                  }
                }
              }
            });

            let adherenceMessage = '';
            let messageType = 'info';

            if (totalDueToday > 0) {
              const adherencePercent = Math.round((takenCount / totalDueToday) * 100);
              if (adherencePercent === 100) {
                adherenceMessage = `All medications taken on schedule today (${takenCount}/${totalDueToday} doses).`;
                messageType = 'success';
              } else if (adherencePercent >= 75) {
                adherenceMessage = `${takenCount} of ${totalDueToday} doses taken today. Keep up the good work!`;
                messageType = 'info';
              } else {
                adherenceMessage = `${totalDueToday - takenCount} dose(s) remaining today.`;
                messageType = 'warning';
              }
            } else {
              adherenceMessage = 'No scheduled doses today.';
              messageType = 'info';
            }

            if (nextDose && nextDoseMed) {
              const nextDoseDate = new Date(nextDose);
              const daysUntil = Math.ceil((nextDoseDate - today) / (1000 * 60 * 60 * 24));
              let nextDoseText = '';

              if (daysUntil === 0) {
                nextDoseText = `Next dose: ${nextDoseMed.name} today`;
              } else if (daysUntil === 1) {
                nextDoseText = `Next dose: ${nextDoseMed.name} tomorrow`;
              } else if (daysUntil <= 7) {
                nextDoseText = `Next dose: ${nextDoseMed.name} in ${daysUntil} days`;
              } else {
                const month = nextDoseDate.toLocaleString('en-US', { month: 'short' });
                const day = nextDoseDate.getDate();
                nextDoseText = `Next dose: ${nextDoseMed.name} on ${month} ${day}`;
              }

              if (adherenceMessage) {
                adherenceMessage += ` ${nextDoseText}.`;
              } else {
                adherenceMessage = nextDoseText + '.';
              }
            }

            const alertClasses = {
              success: DesignTokens.components.alert.success,
              info: DesignTokens.components.alert.info,
              warning: DesignTokens.components.alert.warning
            };

            const textClasses = {
              success: DesignTokens.components.alert.text.success,
              info: DesignTokens.components.alert.text.info,
              warning: DesignTokens.components.alert.text.warning
            };

            const textSecondaryClasses = {
              success: DesignTokens.components.status.normal.text,
              info: DesignTokens.colors.primary.text[700],
              warning: DesignTokens.components.alert.text.warning.replace('800', '700')
            };

            const iconClasses = {
              success: DesignTokens.components.status.normal.text,
              info: DesignTokens.components.alert.text.info.replace('800', '600'),
              warning: DesignTokens.components.alert.text.warning.replace('800', '600')
            };

            return (
              <div className={`${alertClasses[messageType]} border rounded-lg p-3 sm:p-4`}>
                <div className="flex items-start gap-2">
                  <AlertCircle className={`w-4 h-4 sm:w-5 sm:h-5 ${iconClasses[messageType]} flex-shrink-0 mt-0.5`} />
                  <div>
                    <p className={`text-xs sm:text-sm font-semibold ${textClasses[messageType]}`}>Medication Adherence</p>
                    <p className={`text-xs ${textSecondaryClasses[messageType]} mt-1`}>
                      {adherenceMessage || 'Track your medications to monitor adherence.'}
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Active Medications Header */}
          <div className="flex items-center justify-between mb-2">
            <h2 className={combineClasses('text-base sm:text-lg font-semibold', DesignTokens.colors.neutral.text[900])}>Medications</h2>
            <button
              onClick={() => {
                setEditingMedication(null);
                setShowAddMedication(true);
              }}
              className={combineClasses("flex items-center gap-2 transition-colors min-h-[44px] touch-manipulation active:opacity-70 px-2 py-1", DesignTokens.components.status.normal.text, 'hover:text-green-700')}
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm font-medium">Add Medication</span>
            </button>
          </div>

          {/* Today's Schedule */}
          <div className={DesignTokens.components.card.nestedWithShadow}>
            <h3 className={combineClasses("text-sm sm:text-base font-semibold mb-3", DesignTokens.colors.neutral.text[900])}>Today's Schedule</h3>
            <div className="space-y-2">
              {medications
                .filter((med) => med.active && (med.status || 'active') !== 'stopped' && hasTimedSchedule(med) && isMedicationDueOnDate(med, new Date()))
                .flatMap(med =>
                  med.schedule.split(',').map(time => ({
                    ...med,
                    specificTime: time.trim()
                  }))
                )
                .sort((a, b) => {
                  const aMin = timeToMinutes(a.specificTime);
                  const bMin = timeToMinutes(b.specificTime);
                  if (aMin === null && bMin === null) return a.specificTime.localeCompare(b.specificTime);
                  if (aMin === null) return 1;
                  if (bMin === null) return -1;
                  return aMin - bMin;
                })
                .map((med, idx) => {
                  const taken = isMedicationTaken(med.id, med.specificTime);

                  return (
                    <button
                      key={`schedule-${med.id}-${idx}`}
                      onClick={() => markMedicationTaken(med.id, med.specificTime)}
                      className={combineClasses("w-full flex items-center gap-2 sm:gap-3 p-3 border-2 rounded-lg transition min-h-[60px] touch-manipulation active:opacity-70", taken
                        ? combineClasses(DesignTokens.components.status.normal.border.replace('200', '300'), DesignTokens.components.status.normal.bg, 'cursor-default')
                        : combineClasses(DesignTokens.colors.neutral.border[200], DesignTokens.components.status.normal.border.replace('200', '500').replace('border-', 'hover:border-'), DesignTokens.components.status.normal.bg.replace('bg-', 'hover:bg-'))
                      )}
                    >
                      <div className={combineClasses("text-xs sm:text-sm font-semibold w-16 sm:w-20 flex-shrink-0", DesignTokens.colors.neutral.text[700])}>
                        {med.specificTime}
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <p className={combineClasses("text-sm font-medium truncate", DesignTokens.colors.neutral.text[900])}>{med.name}</p>
                        <p className={combineClasses("text-xs", DesignTokens.colors.neutral.text[600])}>{med.dosage}</p>
                      </div>
                      <div className={combineClasses("w-6 h-6 flex-shrink-0 rounded-full border-2 flex items-center justify-center", taken ? 'border-green-500 bg-green-500' : DesignTokens.colors.neutral.border[300])}>
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
          </div>

          {/* Adherence history: collapsible, compact list */}
          <div className={DesignTokens.components.card.nestedWithShadow}>
            <button
              type="button"
              onClick={() => setHistoryExpanded((e) => !e)}
              className={combineClasses(
                'w-full flex items-center justify-between gap-2 py-2 pr-1 -ml-1 rounded-lg touch-manipulation',
                DesignTokens.colors.neutral.text[700],
                'hover:bg-gray-50 active:bg-gray-100'
              )}
              aria-expanded={historyExpanded}
            >
              <span className="flex items-center gap-2 min-w-0">
                <Calendar className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm font-medium truncate">Adherence history</span>
                <span className={combineClasses('text-xs flex-shrink-0', DesignTokens.colors.neutral.text[500])}>
                  ({logRangeLabel} · {totalInRange})
                </span>
              </span>
              <span className={combineClasses('flex-shrink-0 transition-transform', historyExpanded && 'rotate-180')}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </span>
            </button>
            {historyExpanded && (
              <div className="pt-1 border-t border-gray-100">
                <div className="flex flex-wrap items-center gap-2 py-1.5">
                  <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Range</span>
                  <select
                    value={logRange}
                    onChange={(e) => setLogRange(e.target.value)}
                    className={combineClasses(
                      'text-xs rounded border py-1 px-2 min-h-[32px] touch-manipulation',
                      DesignTokens.colors.neutral.border[300],
                      DesignTokens.colors.neutral.text[800]
                    )}
                  >
                    <option value="7">7 days</option>
                    <option value="30">1 month</option>
                    <option value="90">3 months</option>
                    <option value="all">All</option>
                  </select>
                </div>
                <div className="max-h-[180px] overflow-y-auto -mx-1 px-1">
                  {groupedLogs.length === 0 ? (
                    <p className={combineClasses('text-xs py-3', DesignTokens.colors.neutral.text[500])}>No doses in this period.</p>
                  ) : (
                    <div className="space-y-2">
                      {groupedLogs.map(({ dateKey, label, logs, missedSlots }) => (
                        <div key={dateKey}>
                          <p className={combineClasses('text-[11px] font-semibold uppercase tracking-wide py-1 sticky top-0 bg-white/95 backdrop-blur', DesignTokens.colors.neutral.text[500])}>
                            {label}
                          </p>
                          <ul className="divide-y divide-gray-50">
                            {logs.map((log) => {
                              const med = medications.find((m) => m.id === log.medId);
                              const d = log.takenAt instanceof Date ? log.takenAt : new Date(log.takenAt);
                              const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
                              return (
                                <li key={log.id} className="flex items-center gap-2 py-1.5 text-xs min-w-0 pl-0 group">
                                  <span className={combineClasses('w-12 flex-shrink-0', DesignTokens.colors.neutral.text[600])}>{timeStr}</span>
                                  <span className={combineClasses('truncate flex-1 min-w-0', DesignTokens.colors.neutral.text[800])}>{med?.name ?? '—'}</span>
                                  <Check className={combineClasses('w-3.5 h-3.5 flex-shrink-0', DesignTokens.components.status.normal.text)} />
                                  <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setRemoveLogConfirm({ show: true, log }); }}
                                    className={combineClasses(
                                      'p-1 rounded touch-manipulation opacity-60 group-hover:opacity-100 hover:bg-red-50 text-gray-500 hover:text-red-600 transition'
                                    )}
                                    aria-label="Remove dose from history"
                                    title="Remove from history"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </li>
                              );
                            })}
                            {missedSlots.map((slot) => {
                              const isMarking = markingTakenFor?.dateKey === dateKey && markingTakenFor?.medId === slot.medId && markingTakenFor?.scheduledTime === slot.scheduledTime;
                              return (
                                <li key={slot.medId + '|' + slot.scheduledTime} className="flex items-center gap-2 py-1.5 text-xs min-w-0 pl-0">
                                  <span className={combineClasses('w-12 flex-shrink-0', DesignTokens.colors.neutral.text[500])}>{slot.scheduledTime}</span>
                                  <span className={combineClasses('truncate flex-1 min-w-0', DesignTokens.colors.neutral.text[600])}>{slot.medName}</span>
                                  <button
                                    type="button"
                                    onClick={() => markMedicationTakenForDate(dateKey, slot.medId, slot.scheduledTime)}
                                    disabled={isMarking}
                                    className={combineClasses(
                                      'text-[11px] font-medium px-2 py-1 rounded border min-h-[28px] touch-manipulation',
                                      DesignTokens.components.status.normal.border,
                                      DesignTokens.components.status.normal.text,
                                      'hover:bg-green-50 disabled:opacity-50'
                                    )}
                                  >
                                    {isMarking ? '…' : 'Mark taken'}
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {showingCap && (
                  <p className={combineClasses('text-[11px] pt-1.5', DesignTokens.colors.neutral.text[500])}>
                    Showing latest 50 of {totalInRange}.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Active Medications */}
          <div className={DesignTokens.components.card.nestedWithShadow}>
            <h3 className={combineClasses('text-sm sm:text-base font-semibold mb-3', DesignTokens.colors.neutral.text[900])}>Active Medications</h3>
            <div className="space-y-3">
              {medications.filter(med => med.active && (med.status || 'active') !== 'stopped').map(med => {
                const colorClasses = {
                  purple: combineClasses(DesignTokens.colors.accent[100], DesignTokens.colors.accent.border[300], 'text-medical-accent-800'),
                  blue: combineClasses(DesignTokens.colors.primary[100], DesignTokens.colors.primary.border[300], 'text-medical-primary-800'),
                  green: combineClasses(DesignTokens.components.status.normal.bg, DesignTokens.components.status.normal.border, DesignTokens.components.status.normal.text),
                  orange: 'bg-orange-100 border-orange-300 text-orange-800',
                  teal: 'bg-teal-100 border-teal-300 text-teal-800',
                };
                const purposeToColor = {
                  'Chemotherapy': 'purple', 'Targeted therapy': 'blue', 'Immunotherapy': 'green', 'Hormone therapy': 'orange',
                  'Anti-nausea': 'teal', 'Pain management': 'blue', 'Anti-inflammatory': 'green', 'Antibiotic': 'blue',
                  'Stomach protection': 'teal', 'Vitamin/Supplement': 'green', 'Other': 'blue',
                };
                const purposes = (med.purpose || '').split(',').map(s => s.trim()).filter(Boolean);
                if (purposes.length === 0) purposes.push(med.purpose || 'Other');

                return (
                  <div
                    key={med.id}
                    className={combineClasses(
                      'border rounded-lg p-3 hover:shadow-md transition relative isolate',
                      DesignTokens.colors.neutral.border[200]
                    )}
                  >
                    {/* Mobile: three-dot menu in top-right */}
                    <div className="absolute top-2 right-2 sm:hidden z-[9999]">
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setOpenMedicationMenu(openMedicationMenu === med.id ? null : med.id);
                          }}
                          className="p-2 text-medical-neutral-500 hover:bg-medical-neutral-100 rounded transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation active:opacity-70"
                          title="More options"
                          aria-label="More options"
                          type="button"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {openMedicationMenu === med.id && (
                          <>
                            <div
                              className="fixed inset-0 z-[9998]"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                setOpenMedicationMenu(null);
                              }}
                            />
                            <div className="absolute right-0 top-10 z-[9999] bg-white rounded-lg shadow-lg border border-medical-neutral-200 py-1 min-w-[160px]">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  setOpenMedicationMenu(null);
                                  setEditingMedication(med);
                                  setShowAddMedication(true);
                                }}
                                className={combineClasses(
                                  'w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 min-h-[44px] touch-manipulation active:opacity-70',
                                  DesignTokens.colors.neutral.text[700],
                                  'hover:bg-medical-neutral-100'
                                )}
                                type="button"
                              >
                                <Edit2 className="w-4 h-4" />
                                Edit
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  setOpenMedicationMenu(null);
                                  setUpdateDosageMedication(med);
                                }}
                                className={combineClasses(
                                  'w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 min-h-[44px] touch-manipulation active:opacity-70',
                                  DesignTokens.colors.neutral.text[700],
                                  'hover:bg-medical-neutral-100'
                                )}
                                type="button"
                              >
                                <Pill className="w-4 h-4" />
                                Update dosage & frequency
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  setOpenMedicationMenu(null);
                                  toggleMedicationActive(med, false);
                                }}
                                className={combineClasses(
                                  'w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 min-h-[44px] touch-manipulation active:opacity-70',
                                  DesignTokens.colors.neutral.text[700],
                                  'hover:bg-medical-neutral-100'
                                )}
                                type="button"
                                disabled={isTogglingMedication}
                              >
                                <PauseCircle className="w-4 h-4" />
                                Pause
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  setOpenMedicationMenu(null);
                                  stopMedication(med);
                                }}
                                className={combineClasses(
                                  'w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 min-h-[44px] touch-manipulation active:opacity-70',
                                  DesignTokens.components.status.high.text,
                                  'hover:bg-medical-neutral-100'
                                )}
                                type="button"
                                disabled={isTogglingMedication}
                              >
                                <Square className="w-4 h-4" />
                                Stop (keep history)
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  setOpenMedicationMenu(null);
                                  confirmDeleteMedication(med);
                                }}
                                className={combineClasses(
                                  'w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 min-h-[44px] touch-manipulation active:opacity-70',
                                  DesignTokens.components.status.high.text,
                                  'hover:bg-medical-neutral-100'
                                )}
                                type="button"
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete permanently
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="mb-2">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                        <div className="flex-1 flex items-center gap-2 pr-20 sm:pr-0 flex-wrap">
                          <h4 className={combineClasses('text-sm sm:text-base font-semibold', DesignTokens.colors.neutral.text[900])}>{med.name}</h4>
                          {purposes.map((p) => (
                            <span key={p} className={combineClasses('text-xs px-2 py-0.5 rounded-full border w-fit', colorClasses[purposeToColor[p]] || colorClasses[med.color] || colorClasses.blue)}>
                              {p}
                            </span>
                          ))}
                        </div>
                        {/* Desktop/tablet: actions inline */}
                        <div className="hidden sm:flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingMedication(med);
                              setShowAddMedication(true);
                            }}
                            className={combineClasses('p-1.5 rounded-lg transition min-w-[32px] min-h-[32px] flex items-center justify-center touch-manipulation', DesignTokens.colors.app.text[600], 'hover:' + DesignTokens.colors.app[50])}
                            aria-label="Edit medication"
                            title="Edit"
                            type="button"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setUpdateDosageMedication(med)}
                            className={combineClasses('p-1.5 rounded-lg transition min-w-[32px] min-h-[32px] flex items-center justify-center touch-manipulation', DesignTokens.colors.app.text[600], 'hover:' + DesignTokens.colors.app[50])}
                            aria-label="Update dosage & frequency"
                            title="Update dosage & frequency (keeps history)"
                            type="button"
                          >
                            <Pill className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => toggleMedicationActive(med, false)}
                            className={combineClasses(
                              'p-1.5 rounded-lg transition min-w-[32px] min-h-[32px] flex items-center justify-center touch-manipulation',
                              DesignTokens.colors.neutral.text[600],
                              'hover:' + DesignTokens.colors.app[50]
                            )}
                            aria-label="Pause medication"
                            title="Pause"
                            type="button"
                            disabled={isTogglingMedication}
                          >
                            <PauseCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => stopMedication(med)}
                            className={combineClasses(
                              'p-1.5 rounded-lg transition min-w-[32px] min-h-[32px] flex items-center justify-center touch-manipulation',
                              DesignTokens.components.status.high.text,
                              DesignTokens.components.status.high.bg.replace('bg-', 'hover:bg-'),
                              'hover:text-red-700'
                            )}
                            aria-label="Stop medication (keep history)"
                            title="Stop (keep history)"
                            type="button"
                            disabled={isTogglingMedication}
                          >
                            <Square className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => confirmDeleteMedication(med)}
                            className={combineClasses('p-1.5 rounded-lg transition min-w-[32px] min-h-[32px] flex items-center justify-center touch-manipulation', DesignTokens.components.status.high.text, DesignTokens.components.status.high.bg.replace('bg-', 'hover:bg-'), 'hover:text-red-700')}
                            aria-label="Delete medication"
                            title="Delete permanently"
                            type="button"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <p className={combineClasses('text-xs sm:text-sm', DesignTokens.colors.neutral.text[600])}>
                        <span className="font-medium">{med.dosage}</span> • {med.frequency}
                      </p>
                    </div>

                    <div className={combineClasses("flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-2 pt-2 border-t", DesignTokens.colors.neutral.border[200])}>
                      <div className="flex-1 min-w-0">
                        <p className={combineClasses('text-xs mb-0.5', DesignTokens.colors.neutral.text[500])}>Next dose</p>
                        <p className={combineClasses('text-xs sm:text-sm font-medium', DesignTokens.colors.neutral.text[700])}>
                          {new Date(med.nextDose).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: hasTimedSchedule(med) ? 'numeric' : undefined,
                            minute: hasTimedSchedule(med) ? '2-digit' : undefined
                          })}
                        </p>
                      </div>
                      {hasTimedSchedule(med) && (
                        (() => {
                          const nextTime = getNextDueTimeForToday(med);
                          const taken = isMedicationTaken(med.id, nextTime);

                          return taken ? (
                            <button
                              type="button"
                              onClick={() => markMedicationTaken(med.id, nextTime)}
                              className={combineClasses(
                                "flex items-center gap-2 px-3 py-1.5 rounded-lg w-fit transition",
                                DesignTokens.components.status.normal.bg,
                                "hover:opacity-90 active:opacity-80"
                              )}
                              title="Tap to undo"
                            >
                              <svg className={combineClasses("w-4 h-4", DesignTokens.components.status.normal.text)} fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              <span className={combineClasses("text-xs font-medium", DesignTokens.components.status.normal.text)}>Taken</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => markMedicationTaken(med.id, nextTime)}
                              className={combineClasses("text-white text-xs px-3 py-2 rounded-lg transition font-medium min-h-[44px] w-full sm:w-auto touch-manipulation active:opacity-90", 'bg-green-600', 'hover:bg-green-700')}
                            >
                              Mark Taken
                            </button>
                          );
                        })()
                      )}
                    </div>

                    <div className={combineClasses("mt-2 pt-2 border-t", DesignTokens.colors.neutral.border[200])}>
                      <p className={combineClasses("text-xs", DesignTokens.colors.neutral.text[600])}>
                        <span className="font-medium">Schedule:</span> {med.schedule}
                      </p>
                      {med.notes && (
                        <p className={combineClasses('text-xs mt-1', DesignTokens.colors.neutral.text[600])}>
                          <span className="font-medium">Instructions:</span> {med.notes}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Paused Medications */}
          {medications.some(med => !med.active && (med.status || 'paused') !== 'stopped') && (
            <div className={DesignTokens.components.card.nestedWithShadow}>
              <h3 className={combineClasses('text-sm sm:text-base font-semibold mb-3', DesignTokens.colors.neutral.text[900])}>Paused Medications</h3>
              <div className="space-y-3">
                {medications.filter(med => !med.active && (med.status || 'paused') !== 'stopped').map(med => (
                  <div
                    key={med.id}
                    className={combineClasses(
                      'border rounded-lg p-3 transition relative isolate opacity-90',
                      DesignTokens.colors.neutral.border[200]
                    )}
                  >
                    {/* Mobile: three-dot menu in top-right */}
                    <div className="absolute top-2 right-2 sm:hidden z-[9999]">
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setOpenMedicationMenu(openMedicationMenu === `paused:${med.id}` ? null : `paused:${med.id}`);
                          }}
                          className="p-2 text-medical-neutral-500 hover:bg-medical-neutral-100 rounded transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation active:opacity-70"
                          title="More options"
                          aria-label="More options"
                          type="button"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {openMedicationMenu === `paused:${med.id}` && (
                          <>
                            <div
                              className="fixed inset-0 z-[9998]"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                setOpenMedicationMenu(null);
                              }}
                            />
                            <div className="absolute right-0 top-10 z-[9999] bg-white rounded-lg shadow-lg border border-medical-neutral-200 py-1 min-w-[160px]">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  setOpenMedicationMenu(null);
                                  toggleMedicationActive(med, true);
                                }}
                                className={combineClasses(
                                  'w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 min-h-[44px] touch-manipulation active:opacity-70',
                                  DesignTokens.colors.neutral.text[700],
                                  'hover:bg-medical-neutral-100'
                                )}
                                type="button"
                                disabled={isTogglingMedication}
                              >
                                <PlayCircle className="w-4 h-4" />
                                Resume
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  setOpenMedicationMenu(null);
                                  stopMedication(med);
                                }}
                                className={combineClasses(
                                  'w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 min-h-[44px] touch-manipulation active:opacity-70',
                                  DesignTokens.components.status.high.text,
                                  'hover:bg-medical-neutral-100'
                                )}
                                type="button"
                                disabled={isTogglingMedication}
                              >
                                <Square className="w-4 h-4" />
                                Stop (keep history)
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  setOpenMedicationMenu(null);
                                  confirmDeleteMedication(med);
                                }}
                                className={combineClasses(
                                  'w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 min-h-[44px] touch-manipulation active:opacity-70',
                                  DesignTokens.components.status.high.text,
                                  'hover:bg-medical-neutral-100'
                                )}
                                type="button"
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete permanently
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="mb-2">
                      <div className="flex items-start justify-between gap-2 pr-20 sm:pr-0">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className={combineClasses('text-sm sm:text-base font-semibold truncate', DesignTokens.colors.neutral.text[900])}>{med.name}</h4>
                            <span className={combineClasses('text-[10px] sm:text-xs px-2 py-0.5 rounded-full border', DesignTokens.colors.neutral[100], DesignTokens.colors.neutral.border[300], DesignTokens.colors.neutral.text[700])}>
                              Paused
                            </span>
                          </div>
                          <p className={combineClasses('text-xs sm:text-sm mt-1', DesignTokens.colors.neutral.text[600])}>
                            <span className="font-medium">{med.dosage}</span> • {med.frequency}
                          </p>
                        </div>

                        {/* Desktop/tablet actions */}
                        <div className="hidden sm:flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => toggleMedicationActive(med, true)}
                            className={combineClasses(
                              'p-1.5 rounded-lg transition min-w-[32px] min-h-[32px] flex items-center justify-center touch-manipulation',
                              DesignTokens.colors.neutral.text[600],
                              'hover:' + DesignTokens.colors.app[50]
                            )}
                            aria-label="Resume medication"
                            title="Resume"
                            type="button"
                            disabled={isTogglingMedication}
                          >
                            <PlayCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => stopMedication(med)}
                            className={combineClasses(
                              'p-1.5 rounded-lg transition min-w-[32px] min-h-[32px] flex items-center justify-center touch-manipulation',
                              DesignTokens.components.status.high.text,
                              DesignTokens.components.status.high.bg.replace('bg-', 'hover:bg-'),
                              'hover:text-red-700'
                            )}
                            aria-label="Stop medication (keep history)"
                            title="Stop (keep history)"
                            type="button"
                            disabled={isTogglingMedication}
                          >
                            <Square className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => confirmDeleteMedication(med)}
                            className={combineClasses(
                              'p-1.5 rounded-lg transition min-w-[32px] min-h-[32px] flex items-center justify-center touch-manipulation',
                              DesignTokens.components.status.high.text,
                              DesignTokens.components.status.high.bg.replace('bg-', 'hover:bg-'),
                              'hover:text-red-700'
                            )}
                            aria-label="Delete medication"
                            title="Delete permanently"
                            type="button"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <p className={combineClasses("text-xs", DesignTokens.colors.neutral.text[600])}>
                      <span className="font-medium">Schedule:</span> {med.schedule}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Stopped Medications (history) */}
          {medications.some((med) => med.status === 'stopped') && (
            <div className={combineClasses(DesignTokens.components.card.nestedSubtle, 'border border-medical-neutral-200')}>
              <div className="flex items-center justify-between mb-2">
                <h3 className={combineClasses('text-xs sm:text-sm font-semibold', DesignTokens.colors.neutral.text[900])}>
                  Stopped Medications (History)
                </h3>
              </div>
              <div className="space-y-2">
                {medications
                  .filter((med) => med.status === 'stopped')
                  .map((med) => {
                    const start = med.startDate ? new Date(med.startDate) : null;
                    const stopped = med.stoppedAt ? new Date(med.stoppedAt) : null;
                    const fromText = start
                      ? start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : '—';
                    const toText = stopped
                      ? stopped.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                      : '—';

                    return (
                      <div
                        key={`stopped-${med.id}`}
                        className={combineClasses(
                          'flex items-start justify-between gap-2 p-2 rounded-lg bg-white border',
                          DesignTokens.colors.neutral.border[200]
                        )}
                      >
                        <div className="min-w-0">
                          <p className={combineClasses('text-xs sm:text-sm font-semibold truncate', DesignTokens.colors.neutral.text[900])}>
                            {med.name}
                          </p>
                          <p className={combineClasses('text-[11px] sm:text-xs', DesignTokens.colors.neutral.text[600])}>
                            {fromText} → {toText}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => restartMedication(med)}
                            className={combineClasses(
                              'px-2 py-1.5 text-xs rounded-lg border transition min-h-[44px] touch-manipulation',
                              DesignTokens.colors.neutral.border[300],
                              DesignTokens.colors.neutral.text[700],
                              'hover:bg-medical-neutral-100'
                            )}
                            disabled={isTogglingMedication}
                          >
                            Restart
                          </button>
                          <button
                            type="button"
                            onClick={() => confirmDeleteMedication(med)}
                            className={combineClasses(
                              'px-2 py-1.5 text-xs rounded-lg border transition min-h-[44px] touch-manipulation',
                              DesignTokens.components.status.high.text,
                              DesignTokens.colors.neutral.border[300],
                              'hover:bg-medical-neutral-100'
                            )}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <AddMedicationModal
        show={showAddMedication}
        onClose={() => {
          setShowAddMedication(false);
          setEditingMedication(null);
        }}
        user={user}
        editingMedication={editingMedication}
        onMedicationAdded={async () => {
          if (user) {
            try {
              const meds = await medicationService.getMedications(user.uid);
              setMedications(meds);
            } catch (error) {
              console.error('Error reloading medications:', error);
            }
          }
          setEditingMedication(null);
        }}
      />

      <DeletionConfirmationModal
        show={deleteConfirm.show}
        title={deleteConfirm.title}
        message={deleteConfirm.message}
        itemName={deleteConfirm.itemName}
        confirmText={deleteConfirm.confirmText}
        isDeleting={isDeletingMedication}
        onConfirm={deleteConfirm.onConfirm}
        onClose={() => !isDeletingMedication && setDeleteConfirm({ ...deleteConfirm, show: false })}
      />

      <DeletionConfirmationModal
        show={removeLogConfirm.show}
        title="Remove dose from history?"
        message="This logged dose will be removed. You can add it back later with Log missed dose."
        confirmText="Remove"
        isDeleting={false}
        onConfirm={handleRemoveLogFromHistory}
        onClose={() => setRemoveLogConfirm({ show: false, log: null })}
      />

      <UpdateDosageModal
        show={!!updateDosageMedication}
        onClose={() => setUpdateDosageMedication(null)}
        medication={updateDosageMedication}
        onSaved={async () => {
          if (user) {
            try {
              const meds = await medicationService.getMedications(user.uid);
              setMedications(meds);
            } catch (e) {
              console.error('Error reloading medications:', e);
            }
          }
        }}
      />
    </div>
  );
}

// Memoize component to prevent unnecessary re-renders
export default React.memo(MedicationsSection, (prevProps, nextProps) => {
  return prevProps.onTabChange === nextProps.onTabChange;
});
