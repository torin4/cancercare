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
  Pill, Edit2, Plus, MessageSquare, AlertCircle, Check
} from 'lucide-react';
import { DesignTokens, combineClasses } from '../../../../design/designTokens';
import { useAuth } from '../../../../contexts/AuthContext';
import { useBanner } from '../../../../contexts/BannerContext';
import { medicationService, medicationLogService } from '../../../../firebase/services';
import AddMedicationModal from '../../../modals/AddMedicationModal';

function MedicationsSection({ onTabChange }) {
  const { user } = useAuth();
  const { showSuccess, showError } = useBanner();

  // Medications-specific state
  const [medications, setMedications] = useState([]);
  const [medicationLog, setMedicationLog] = useState([]);
  const [showAddMedication, setShowAddMedication] = useState(false);
  const [editingMedication, setEditingMedication] = useState(null);

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

  // Mark medication as taken
  const markMedicationTaken = async (medId, scheduledTime) => {
    if (!user || !user.uid) {
      showError('You must be logged in to mark medications as taken.');
      return;
    }
    
    try {
      const now = new Date();
      const logEntry = {
        patientId: user.uid,
        medId: medId,
        scheduledTime: scheduledTime,
        takenAt: now
      };
      
      // Persist to Firebase
      await medicationLogService.addMedicationLog(logEntry);
      
      // Update local state immediately for instant UI feedback
      setMedicationLog([...medicationLog, {
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
            
            const medsWithSchedule = activeMeds.filter(med => 
              med.schedule && med.schedule.includes(':')
            );
            
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

          {/* Active Medications */}
          <div className={DesignTokens.components.card.nestedWithShadow}>
            <h3 className={combineClasses('text-sm sm:text-base font-semibold mb-3', DesignTokens.colors.neutral.text[900])}>Active Medications</h3>
            <div className="space-y-3">
              {medications.filter(med => med.active).map(med => {
                const colorClasses = {
                  purple: combineClasses(DesignTokens.colors.accent[100], DesignTokens.colors.accent.border[300], 'text-medical-accent-800'),
                  blue: combineClasses(DesignTokens.colors.primary[100], DesignTokens.colors.primary.border[300], 'text-medical-primary-800'),
                  green: combineClasses(DesignTokens.components.status.normal.bg, DesignTokens.components.status.normal.border, DesignTokens.components.status.normal.text),
                  orange: 'bg-orange-100 border-orange-300 text-orange-800',
                  teal: 'bg-teal-100 border-teal-300 text-teal-800',
                };

                return (
                  <div key={med.id} className={combineClasses('border rounded-lg p-3 hover:shadow-md transition', DesignTokens.colors.neutral.border[200])}>
                    <div className="mb-2">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                        <div className="flex-1 flex items-center gap-2">
                          <h4 className={combineClasses('text-sm sm:text-base font-semibold', DesignTokens.colors.neutral.text[900])}>{med.name}</h4>
                          <span className={`text-xs px-2 py-0.5 rounded-full border ${colorClasses[med.color]} w-fit`}>
                            {med.purpose}
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            setEditingMedication(med);
                            setShowAddMedication(true);
                          }}
                          className={combineClasses('p-1.5 rounded-lg transition min-w-[32px] min-h-[32px] flex items-center justify-center touch-manipulation', DesignTokens.colors.app.text[600], 'hover:' + DesignTokens.colors.app[50])}
                          aria-label="Edit medication"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
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
                            hour: med.schedule.includes(':') ? 'numeric' : undefined,
                            minute: med.schedule.includes(':') ? '2-digit' : undefined
                          })}
                        </p>
                      </div>
                      {med.schedule.includes(':') && (
                        (() => {
                          const times = med.schedule.split(',').map(t => t.trim());
                          const nextTime = times[0];
                          const taken = isMedicationTaken(med.id, nextTime);

                          return taken ? (
                            <div className={combineClasses("flex items-center gap-2 px-3 py-1.5 rounded-lg w-fit", DesignTokens.components.status.normal.bg)}>
                              <svg className={combineClasses("w-4 h-4", DesignTokens.components.status.normal.text)} fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              <span className={combineClasses("text-xs font-medium", DesignTokens.components.status.normal.text)}>Taken</span>
                            </div>
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

          {/* Today's Schedule */}
          <div className={DesignTokens.components.card.nestedWithShadow}>
            <h3 className={combineClasses("text-sm sm:text-base font-semibold mb-3", DesignTokens.colors.neutral.text[900])}>Today's Schedule</h3>
            <div className="space-y-2">
              {medications
                .filter(med => med.active && med.schedule.includes(':'))
                .flatMap(med =>
                  med.schedule.split(',').map(time => ({
                    ...med,
                    specificTime: time.trim()
                  }))
                )
                .sort((a, b) => a.specificTime.localeCompare(b.specificTime))
                .map((med, idx) => {
                  const taken = isMedicationTaken(med.id, med.specificTime);

                  return (
                    <button
                      key={`schedule-${med.id}-${idx}`}
                      onClick={() => !taken && markMedicationTaken(med.id, med.specificTime)}
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
    </div>
  );
}

// Memoize component to prevent unnecessary re-renders
export default React.memo(MedicationsSection, (prevProps, nextProps) => {
  return prevProps.onTabChange === nextProps.onTabChange;
});
