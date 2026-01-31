/**
 * SymptomsSection Component
 * 
 * Extracted from HealthTab to improve organization and maintainability.
 * This component handles all symptoms-related functionality including:
 * - Symptom calendar view
 * - Symptom tracking and display
 * - Adding/editing/deleting symptoms
 */

import React, { useState, useEffect } from 'react';
import { 
  Thermometer, Edit2, X, Plus, MessageSquare, AlertCircle,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import { DesignTokens, combineClasses } from '../../../../design/designTokens';
import { useAuth } from '../../../../contexts/AuthContext';
import { useHealthContext } from '../../../../contexts/HealthContext';
import { useBanner } from '../../../../contexts/BannerContext';
import { symptomService } from '../../../../firebase/services';
import { getTodayLocalDate } from '../../../../utils/helpers';
import AddSymptomModal from '../../../modals/AddSymptomModal';
import DeletionConfirmationModal from '../../../modals/DeletionConfirmationModal';

function SymptomsSection({ onTabChange }) {
  const { user } = useAuth();
  const { reloadHealthData } = useHealthContext();
  const { showSuccess, showError } = useBanner();

  // Symptoms-specific state
  const [symptoms, setSymptoms] = useState([]);
  const [symptomCalendarDate, setSymptomCalendarDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [showAddSymptomModal, setShowAddSymptomModal] = useState(false);
  const [symptomForm, setSymptomForm] = useState({
    name: '',
    severity: '',
    date: getTodayLocalDate(),
    time: new Date().toTimeString().slice(0, 5),
    notes: '',
    customSymptomName: '',
    tags: []
  });
  const [isDeletingSymptom, setIsDeletingSymptom] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ 
    show: false, 
    title: '', 
    message: '', 
    onConfirm: null, 
    itemName: '', 
    confirmText: 'Yes, Delete Permanently' 
  });

  // Auto-locate to today when symptoms section is opened
  useEffect(() => {
    const today = new Date();
    const localToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    setSymptomCalendarDate(localToday);
    const todayDay = localToday.getDate().toString();
    const hasSymptomsToday = symptoms.some(s => {
      const symptomDate = s.date instanceof Date ? s.date : new Date(s.date);
      const localSymptomDate = new Date(symptomDate.getFullYear(), symptomDate.getMonth(), symptomDate.getDate());
      return localSymptomDate.getDate().toString() === todayDay && 
             localSymptomDate.getMonth() === localToday.getMonth() && 
             localSymptomDate.getFullYear() === localToday.getFullYear();
    });
    if (hasSymptomsToday) {
      setSelectedDate(todayDay);
    }
  }, [symptoms]);

  // Real-time subscription for symptoms
  useEffect(() => {
    if (!user || !user.uid) return;

    const unsub = symptomService.subscribeSymptoms(user.uid, (items) => {
      setSymptoms(items);
    });

    return () => {
      if (unsub) unsub();
    };
  }, [user]);

  return (
    <div className="space-y-4">
      {symptoms.length === 0 ? (
        <div className={combineClasses(DesignTokens.components.card.container, 'p-4 sm:p-6 text-center')}>
          <div className="flex flex-col items-center gap-3">
            <Thermometer className={combineClasses('w-10 h-10 sm:w-12 sm:h-12', DesignTokens.colors.app.text[400])} />
            <div>
              <h3 className={combineClasses('text-base sm:text-lg font-semibold mb-1', DesignTokens.colors.app.text[900])}>No Symptoms Tracked Yet</h3>
              <p className={combineClasses('text-xs sm:text-sm mb-4', DesignTokens.colors.app.text[700])}>
                Track symptoms to identify patterns and correlations with your health data
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => setShowAddSymptomModal(true)}
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
          {symptoms.length > 5 && (
            <div className={combineClasses(DesignTokens.components.alert.info.bg, DesignTokens.components.alert.info.border, 'rounded-lg p-3 sm:p-4')}>
              <div className="flex items-start gap-2">
                <AlertCircle className={combineClasses("w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 mt-0.5", DesignTokens.components.alert.text.info.replace('800', '600'))} />
                <div>
                  <p className={combineClasses("text-xs sm:text-sm font-semibold", DesignTokens.components.alert.text.info.replace('800', '900'))}>AI Pattern Detection</p>
                  <p className={combineClasses("text-xs mt-1", DesignTokens.components.alert.text.info.replace('800', '700'))}>
                    Track more symptoms to enable pattern detection and correlations with your lab values.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Symptom Calendar */}
          <div className={DesignTokens.components.card.nestedWithShadow}>
            {/* Date Pager */}
            <div className="flex items-center justify-between mb-2 sm:mb-3 gap-2">
              <button
                onClick={() => {
                  const prevMonth = new Date(symptomCalendarDate);
                  prevMonth.setMonth(prevMonth.getMonth() - 1);
                  setSymptomCalendarDate(prevMonth);
                }}
                className={combineClasses("p-1.5 sm:p-2 rounded-lg transition min-h-[32px] min-w-[32px] sm:min-h-[36px] sm:min-w-[36px] flex items-center justify-center touch-manipulation active:opacity-70 hover:bg-medical-neutral-100")}
              >
                <ChevronLeft className={combineClasses("w-4 h-4 sm:w-5 sm:h-5", DesignTokens.colors.neutral.text[600])} />
              </button>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <h3 className={combineClasses("font-semibold text-xs sm:text-sm text-center truncate", DesignTokens.colors.neutral.text[900])}>
                  {symptomCalendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </h3>
                <button
                  onClick={() => {
                    const today = new Date();
                    const localToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                    setSymptomCalendarDate(localToday);
                    setSelectedDate(localToday.getDate().toString());
                  }}
                  className={combineClasses('px-2 py-1 text-xs rounded transition min-h-[32px] touch-manipulation active:opacity-70 whitespace-nowrap', DesignTokens.colors.app.text[600], 'hover:' + DesignTokens.colors.app[50])}
                >
                  Today
                </button>
              </div>
              <button
                onClick={() => {
                  const nextMonth = new Date(symptomCalendarDate);
                  nextMonth.setMonth(nextMonth.getMonth() + 1);
                  setSymptomCalendarDate(nextMonth);
                }}
                className={combineClasses("p-1.5 sm:p-2 rounded-lg transition min-h-[32px] min-w-[32px] sm:min-h-[36px] sm:min-w-[36px] flex items-center justify-center touch-manipulation active:opacity-70 hover:bg-medical-neutral-100")}
              >
                <ChevronRight className={combineClasses("w-4 h-4 sm:w-5 sm:h-5", DesignTokens.colors.neutral.text[600])} />
              </button>
              <button
                onClick={() => setShowAddSymptomModal(true)}
                className={combineClasses("text-xs sm:text-sm font-medium flex items-center gap-1 min-h-[32px] touch-manipulation active:opacity-70", DesignTokens.colors.primary.text[600], DesignTokens.colors.primary.text[700])}
              >
                <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">Add Symptom</span>
              </button>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-0.5 sm:gap-1 mb-1">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className={combineClasses('text-center text-[10px] sm:text-xs font-medium py-1', DesignTokens.colors.neutral.text[500])}>
                  {day.slice(0, 3)}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {(() => {
                const currentMonth = symptomCalendarDate.getMonth();
                const currentYear = symptomCalendarDate.getFullYear();
                const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
                const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();
                const calendar = [];
                const today = new Date();
                const localToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                const isCurrentMonth = localToday.getMonth() === currentMonth && localToday.getFullYear() === currentYear;

                // Map real symptoms to dates (using local timezone)
                const symptomsByDate = {};
                symptoms.forEach(symptom => {
                  const symptomDate = symptom.date instanceof Date ? symptom.date : new Date(symptom.date);
                  const localSymptomDate = new Date(symptomDate.getFullYear(), symptomDate.getMonth(), symptomDate.getDate());
                  if (localSymptomDate.getMonth() === currentMonth && localSymptomDate.getFullYear() === currentYear) {
                    const day = localSymptomDate.getDate().toString();
                    if (!symptomsByDate[day]) {
                      symptomsByDate[day] = [];
                    }
                    symptomsByDate[day].push({
                      id: symptom.id,
                      type: symptom.name || symptom.type,
                      severity: symptom.severity,
                      time: symptom.time || symptomDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
                      tags: symptom.tags || []
                    });
                  }
                });

                // Symptom type colors
                const symptomColors = {
                  'Fatigue': 'bg-blue-500',
                  'Pain': 'bg-red-500',
                  'Nausea': 'bg-green-500',
                  'Headache': 'bg-purple-500',
                  'Dizziness': 'bg-yellow-500',
                  'Fever': 'bg-orange-500',
                  'Shortness of Breath': 'bg-cyan-500',
                  'Loss of Appetite': 'bg-amber-500',
                  'Sleep Issues': 'bg-indigo-500'
                };
                
                const getSymptomColor = (symptomType) => {
                  return symptomColors[symptomType] || 'bg-gray-700';
                };

                // Add empty cells for days before month starts
                for (let i = 0; i < firstDayOfWeek; i++) {
                  calendar.push(
                    <div key={`empty-${i}`} className="h-8 sm:h-10"></div>
                  );
                }

                // Add days of month
                for (let day = 1; day <= daysInMonth; day++) {
                  const dayStr = day.toString();
                  const hasSymptoms = symptomsByDate[dayStr];
                  const isToday = isCurrentMonth && localToday.getDate() === day;
                  const uniqueSymptomTypes = hasSymptoms ? [...new Set(hasSymptoms.map(s => s.type))] : [];

                  calendar.push(
                    <button
                      key={day}
                      onClick={() => {
                        if (hasSymptoms) {
                          if (selectedDate === dayStr) {
                            setSelectedDate(null);
                          } else {
                            setSelectedDate(dayStr);
                          }
                        }
                      }}
                      className={`h-8 sm:h-10 rounded flex flex-col items-center justify-center text-[10px] sm:text-xs transition-all relative ${isToday
                        ? combineClasses(DesignTokens.moduleAccent.health.bg, 'border', DesignTokens.moduleAccent.health.border, 'font-semibold')
                        : hasSymptoms
                          ? combineClasses('hover:bg-medical-neutral-100 border', DesignTokens.colors.neutral.border[200])
                          : combineClasses('border border-transparent', DesignTokens.colors.neutral.text[300])
                        } ${selectedDate === dayStr ? combineClasses('ring-1 ring-anchor-900', DesignTokens.colors.app[50]) : ''}`}
                    >
                      <span className={combineClasses(isToday ? DesignTokens.moduleAccent.health.text : hasSymptoms ? DesignTokens.colors.neutral.text[900] : DesignTokens.colors.neutral.text[400], 'leading-tight')}>{day}</span>

                      {/* Symptom dots */}
                      {hasSymptoms && (
                        <div className="flex gap-0.5 mt-0.5">
                          {uniqueSymptomTypes.slice(0, 3).map((type, idx) => (
                            <div
                              key={idx}
                              className={`w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full ${getSymptomColor(type)}`}
                              title={type}
                            />
                          ))}
                        </div>
                      )}
                    </button>
                  );
                }

                return (
                  <>
                    {calendar}

                    {/* Selected Date Details */}
                    {selectedDate && symptomsByDate[selectedDate] && (
                      <div className={combineClasses('col-span-7 mt-2 sm:mt-3 rounded-lg p-2 sm:p-3 animate-fade-scale', DesignTokens.colors.neutral[50])}>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className={combineClasses('font-semibold text-xs sm:text-sm', DesignTokens.colors.neutral.text[900])}>
                            {symptomCalendarDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).replace(selectedDate, selectedDate)}
                          </h4>
                          <button
                            onClick={() => setSelectedDate(null)}
                            className={combineClasses('p-1', DesignTokens.colors.neutral.text[500], 'hover:text-medical-neutral-700')}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="space-y-1.5">
                          {symptomsByDate[selectedDate].map((symptom, idx) => (
                            <div
                              key={symptom.id || idx}
                              className={combineClasses("border-l-3 pl-2 py-1.5 pr-2 rounded-r", symptom.severity === 'Severe' ? combineClasses(DesignTokens.components.status.high.border.replace('200', '400'), DesignTokens.components.status.high.bg) :
                                symptom.severity === 'Moderate' ? combineClasses(DesignTokens.components.status.low.border.replace('200', '400'), DesignTokens.components.status.low.bg) :
                                  combineClasses(DesignTokens.components.status.normal.border.replace('200', '400'), DesignTokens.components.status.normal.bg)
                                )}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${getSymptomColor(symptom.type)}`}></div>
                                  <p className={combineClasses('text-xs font-medium truncate', DesignTokens.colors.neutral.text[900])}>{symptom.type}</p>
                                  <p className={combineClasses('text-[10px] font-medium', symptom.severity === 'Severe' ? DesignTokens.components.alert.text.error :
                                    symptom.severity === 'Moderate' ? DesignTokens.components.alert.text.warning :
                                      DesignTokens.components.status.normal.text
                                  )}>
                                    {symptom.severity}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  {symptom.time && symptom.time !== '00:00' && (
                                    <span className={combineClasses('text-[10px]', DesignTokens.colors.neutral.text[600])}>{symptom.time}</span>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeleteConfirm({
                                        show: true,
                                        title: 'Delete Symptom Entry?',
                                        message: `This will permanently delete this ${symptom.type} symptom entry.`,
                                        itemName: 'symptom entry',
                                        confirmText: 'Yes, Delete',
                                        onConfirm: async () => {
                                          setIsDeletingSymptom(true);
                                          try {
                                            await symptomService.deleteSymptom(symptom.id);
                                          } catch (error) {
                                            showError('Failed to delete symptom. Please try again.');
                                          } finally {
                                            setIsDeletingSymptom(false);
                                          }
                                        }
                                      });
                                    }}
                                    className={combineClasses("transition-colors p-0.5 rounded", DesignTokens.components.status.high.text, 'hover:text-red-700', DesignTokens.components.status.high.bg.replace('bg-', 'hover:bg-'))}
                                    title="Delete symptom"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                              {symptom.tags && symptom.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {symptom.tags.map((tagId, tagIdx) => {
                                    const tagLabels = {
                                      'treatment-related': { label: 'Related to treatment', color: combineClasses(DesignTokens.colors.primary[100], DesignTokens.colors.primary.text[700]) },
                                      'discuss-doctor': { label: 'Discuss with doctor', color: combineClasses(DesignTokens.colors.accent[100], 'text-medical-accent-700') },
                                      'medication-needed': { label: 'Medication needed', color: combineClasses(DesignTokens.components.status.high.bg, DesignTokens.components.status.high.text) },
                                      'side-effect': { label: 'Side effect', color: combineClasses(DesignTokens.components.status.low.bg.replace('yellow', 'orange'), DesignTokens.components.status.low.text.replace('yellow', 'orange')) },
                                      'emergency': { label: 'Emergency', color: combineClasses('bg-red-200', 'text-red-800') },
                                      'recurring': { label: 'Recurring', color: combineClasses('bg-indigo-100', 'text-indigo-700') },
                                      'new-symptom': { label: 'New symptom', color: combineClasses(DesignTokens.components.status.normal.bg, DesignTokens.components.status.normal.text) },
                                      'worsening': { label: 'Worsening', color: combineClasses(DesignTokens.components.status.low.bg, DesignTokens.components.status.low.text) }
                                    };
                                    const tag = tagLabels[tagId] || { label: tagId, color: combineClasses(DesignTokens.colors.neutral[100], DesignTokens.colors.neutral.text[700]) };
                                    return (
                                      <span
                                        key={tagIdx}
                                        className={`text-[10px] rounded-full px-1.5 py-0.5 ${tag.color}`}
                                      >
                                        {tag.label}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          {/* Legend */}
          <div className={DesignTokens.components.card.nestedWithShadow}>
            <h4 className={combineClasses('font-semibold mb-2 text-[10px] sm:text-xs', DesignTokens.colors.neutral.text[900])}>Symptom Types</h4>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 sm:gap-2">
              {[
                { type: 'Fatigue', color: 'bg-blue-500' },
                { type: 'Pain', color: 'bg-red-500' },
                { type: 'Nausea', color: 'bg-green-500' },
                { type: 'Headache', color: 'bg-purple-500' },
                { type: 'Dizziness', color: 'bg-yellow-500' },
                { type: 'Other', color: 'bg-medical-neutral-50' },
              ].map(item => (
                <div key={item.type} className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${item.color}`}></div>
                  <span className={combineClasses('text-[10px] sm:text-xs', DesignTokens.colors.neutral.text[700])}>{item.type}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Modals */}
      <AddSymptomModal
        show={showAddSymptomModal}
        onClose={() => {
          setShowAddSymptomModal(false);
          // Reset form when closing
          setSymptomForm({
            name: '',
            severity: '',
            date: getTodayLocalDate(),
            time: new Date().toTimeString().slice(0, 5),
            notes: '',
            customSymptomName: '',
            tags: []
          });
        }}
        symptomForm={symptomForm}
        setSymptomForm={setSymptomForm}
        user={user}
      />

      <DeletionConfirmationModal
        show={deleteConfirm.show}
        title={deleteConfirm.title}
        message={deleteConfirm.message}
        itemName={deleteConfirm.itemName}
        confirmText={deleteConfirm.confirmText}
        isDeleting={isDeletingSymptom}
        onConfirm={async () => {
          const onConfirmFn = deleteConfirm.onConfirm;
          if (!onConfirmFn) return;
          try {
            await onConfirmFn();
          } finally {
            setIsDeletingSymptom(false);
            setDeleteConfirm({ show: false, title: '', message: '', onConfirm: null, itemName: '', confirmText: 'Yes, Delete Permanently' });
          }
        }}
        onClose={() => {
          if (!isDeletingSymptom) {
            setDeleteConfirm({ ...deleteConfirm, show: false });
          }
        }}
      />
    </div>
  );
}

// Memoize component to prevent unnecessary re-renders
export default React.memo(SymptomsSection, (prevProps, nextProps) => {
  return prevProps.onTabChange === nextProps.onTabChange;
});
