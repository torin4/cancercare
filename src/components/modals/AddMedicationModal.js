import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Plus, Edit2 } from 'lucide-react';
import { DesignTokens, combineClasses } from '../../design/designTokens';
import { useBanner } from '../../contexts/BannerContext';
import { medicationActivityService, medicationService, journalNoteService } from '../../firebase/services';
import { getTodayLocalDate, formatDateString } from '../../utils/helpers';
import DatePicker from '../DatePicker';

const PURPOSE_OPTIONS = ['Chemotherapy', 'Targeted therapy', 'Immunotherapy', 'Hormone therapy', 'Anti-nausea', 'Pain management', 'Anti-inflammatory', 'Antibiotic', 'Stomach protection', 'Vitamin/Supplement', 'Other'];
const PURPOSE_COLOR_MAP = {
  'Chemotherapy': 'purple', 'Targeted therapy': 'blue', 'Immunotherapy': 'green', 'Hormone therapy': 'orange',
  'Anti-nausea': 'teal', 'Pain management': 'blue', 'Anti-inflammatory': 'green', 'Antibiotic': 'blue',
  'Stomach protection': 'teal', 'Vitamin/Supplement': 'green', 'Other': 'blue', 'Custom': 'blue'
};

function parsePurposes(purposeStr) {
  return (purposeStr || '').split(',').map(s => s.trim()).filter(Boolean);
}

export default function AddMedicationModal({ show, onClose, user, onMedicationAdded, editingMedication }) {
  const { showSuccess, showError } = useBanner();
  const [formData, setFormData] = useState({
    name: '',
    dosage: '',
    unit: '',
    quantity: '',
    frequency: '',
    schedule: '',
    purposes: [],
    purposeDropdown: '',
    customPurposeInput: '',
    startDate: getTodayLocalDate(),
    notes: ''
  });
  const [selectedTimes, setSelectedTimes] = useState({
    morning: false,
    afternoon: false,
    evening: false,
    night: false
  });
  const [isSaving, setIsSaving] = useState(false);

  // Auto-select checkboxes when frequency changes
  useEffect(() => {
    if (!show || editingMedication) return; // Don't auto-select when editing

    const freq = formData.frequency;
    if (!freq) return;

    // Auto-select checkboxes based on frequency
    if (freq === 'Once daily') {
      setSelectedTimes({ morning: true, afternoon: false, evening: false, night: false });
    } else if (freq === 'Twice daily') {
      setSelectedTimes({ morning: true, afternoon: false, evening: true, night: false });
    } else if (freq === 'Three times daily') {
      setSelectedTimes({ morning: true, afternoon: true, evening: true, night: false });
    } else if (freq === 'Four times daily') {
      setSelectedTimes({ morning: true, afternoon: true, evening: true, night: true });
    } else {
      // For other frequencies (weekly, monthly, as needed, etc), clear all checkboxes
      setSelectedTimes({ morning: false, afternoon: false, evening: false, night: false });
    }
  }, [formData.frequency, show, editingMedication]);

  // Reset form when modal opens or editing medication changes
  useEffect(() => {
    if (show) {
      if (editingMedication) {
        // Pre-fill form with medication data
        // Parse dosage string - handle formats like "2 × 20 mg" or "20 mg"
        let dosageValue = '';
        let unitValue = '';
        let quantityValue = editingMedication.quantity || '';
        
        if (editingMedication.dosage) {
          // Check if dosage contains quantity (format: "2 × 20 mg" or "2x20 mg")
          const quantityMatch = editingMedication.dosage.match(/^(\d+(?:\.\d+)?)\s*[×x]\s*/i);
          if (quantityMatch) {
            quantityValue = quantityMatch[1];
            const remainingDosage = editingMedication.dosage.replace(/^\d+(?:\.\d+)?\s*[×x]\s*/i, '').trim();
            const dosageParts = remainingDosage.split(' ');
            dosageValue = dosageParts[0] || '';
            unitValue = dosageParts.slice(1).join(' ') || '';
          } else {
            // No quantity prefix, parse normally
            const dosageParts = editingMedication.dosage.split(' ');
            dosageValue = dosageParts[0] || '';
            unitValue = dosageParts.slice(1).join(' ') || '';
          }
        }
        
        // Parse schedule times and set checkboxes by matching exact canonical times
        // Canonical times: Morning=8:00 AM, Afternoon=2:00 PM, Evening=8:00 PM, Night=10:00 PM
        const savedTimes = (editingMedication.schedule &&
            editingMedication.schedule !== editingMedication.frequency &&
            editingMedication.schedule.includes(':'))
          ? editingMedication.schedule.split(',').map(t => t.trim().toLowerCase())
          : [];

        setSelectedTimes({
          morning:   savedTimes.some(t => t === '8:00 am'),
          afternoon: savedTimes.some(t => t === '2:00 pm'),
          evening:   savedTimes.some(t => t === '8:00 pm'),
          night:     savedTimes.some(t => t === '10:00 pm'),
        });
        
        // If schedule equals frequency, treat it as empty (no specific times entered)
        // Only show schedule if it contains actual times (contains ':')
        const scheduleValue = editingMedication.schedule && 
          editingMedication.schedule !== editingMedication.frequency &&
          editingMedication.schedule.includes(':') 
          ? editingMedication.schedule 
          : '';
        
        setFormData({
          name: editingMedication.name || '',
          dosage: dosageValue,
          unit: unitValue,
          quantity: quantityValue,
          frequency: editingMedication.frequency || '',
          schedule: scheduleValue,
          purposes: parsePurposes(editingMedication.purpose),
          purposeDropdown: '',
          customPurposeInput: '',
          startDate: editingMedication.startDate ? formatDateString(editingMedication.startDate) : getTodayLocalDate(),
          notes: editingMedication.notes || editingMedication.instructions || ''
        });
      } else {
        // Reset form for new medication
        setFormData({
          name: '',
          dosage: '',
          unit: '',
          quantity: '',
          frequency: '',
          schedule: '',
          purposes: [],
          purposeDropdown: '',
          customPurposeInput: '',
          startDate: getTodayLocalDate(),
          notes: ''
        });
        setSelectedTimes({
          morning: false,
          afternoon: false,
          evening: false,
          night: false
        });
      }
      setIsSaving(false);
    }
  }, [show, editingMedication]);

  if (!show) return null;

  // Helper to calculate next dose based on schedule
  const calculateNextDose = (frequency, schedule, startDate) => {
    const start = new Date(startDate);
    const now = new Date();
    
    if (!schedule) {
      // Default to tomorrow if no schedule
      const next = new Date(now);
      next.setDate(next.getDate() + 1);
      return next;
    }

    // Parse schedule times (e.g., "8:00 AM, 8:00 PM")
    const times = schedule.split(',').map(t => t.trim()).filter(t => t.includes(':'));
    if (times.length === 0) {
      const next = new Date(now);
      next.setDate(next.getDate() + 1);
      return next;
    }

    // Find next scheduled time today or tomorrow
    const todayTimes = times.map(time => {
      const [hours, mins, period] = time.match(/(\d+):(\d+)\s*(AM|PM)?/i) || [];
      if (!hours) return null;
      let hour = parseInt(hours);
      const minute = parseInt(mins || 0);
      if (period) {
        if (period.toUpperCase() === 'PM' && hour !== 12) hour += 12;
        if (period.toUpperCase() === 'AM' && hour === 12) hour = 0;
      }
      const date = new Date(now);
      date.setHours(hour, minute, 0, 0);
      return date;
    }).filter(d => d);

    const futureTimes = todayTimes.filter(d => d > now);
    if (futureTimes.length > 0) {
      return futureTimes[0];
    }
    
    // If no times today, return first time tomorrow
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (todayTimes.length > 0) {
      const firstTime = todayTimes[0];
      tomorrow.setHours(firstTime.getHours(), firstTime.getMinutes(), 0, 0);
      return tomorrow;
    }

    return tomorrow;
  };

  const handleSave = async () => {
    // Validation
    const purposeToSave = formData.purposes.join(', ');
    if (!formData.name || !formData.dosage || !formData.unit || !formData.frequency || formData.purposes.length === 0) {
      showError('Please fill in all required fields');
      return;
    }

    if (!user) {
      showError('Please log in to save medications');
      return;
    }

    setIsSaving(true);

    try {
      // Build dosage string - include quantity if provided
      let dosage = `${formData.dosage} ${formData.unit}`;
      if (formData.quantity) {
        dosage = `${formData.quantity} × ${dosage}`;
      }
      
      // Calculate next dose
      const nextDose = calculateNextDose(formData.frequency, formData.schedule, formData.startDate);

      // Build schedule from selected checkboxes
      const times = [];
      if (selectedTimes.morning) times.push('8:00 AM');
      // For 4x daily support we use a more standard q6h-style daytime split
      if (selectedTimes.afternoon) times.push('2:00 PM');
      if (selectedTimes.evening) times.push('8:00 PM');
      if (selectedTimes.night) times.push('10:00 PM');
      
      // Determine schedule: if times are selected, use them; otherwise use frequency as fallback
      const scheduleValue = times.length > 0 
        ? times.join(', ') 
        : formData.frequency;

      const medicationData = {
        ...(editingMedication?.id && { id: editingMedication.id }),
        patientId: user.uid,
        name: formData.name,
        dosage: dosage,
        quantity: formData.quantity || null,
        frequency: formData.frequency,
        schedule: scheduleValue,
        purpose: purposeToSave,
        startDate: new Date(formData.startDate),
        notes: formData.notes || '',
        active: editingMedication?.active !== undefined ? editingMedication.active : true,
        nextDose: nextDose,
        color: PURPOSE_COLOR_MAP[formData.purposes[0]] || 'blue'
      };

      const savedId = await medicationService.saveMedication(medicationData);

      // Activity log (separate from adherence "taken" logs)
      try {
        await medicationActivityService.addActivity({
          patientId: user.uid,
          medId: editingMedication?.id || savedId,
          action: editingMedication ? 'updated' : 'added',
          medName: medicationData.name,
          details: {
            frequency: medicationData.frequency,
            schedule: medicationData.schedule,
            dosage: medicationData.dosage,
            purpose: purposeToSave
          }
        });
      } catch (e) {
        // Non-blocking: activity log should not prevent saving meds
      }

      // Add journal note
      try {
        const scheduleText = medicationData.schedule && medicationData.schedule !== medicationData.frequency
          ? ` Schedule: ${medicationData.schedule}.`
          : '';
        await journalNoteService.addJournalNote({
          patientId: user.uid,
          date: new Date(),
          content: editingMedication
            ? `Updated medication: ${medicationData.name} (${medicationData.dosage}, ${medicationData.frequency}).${scheduleText}`
            : `Added medication: ${medicationData.name} (${medicationData.dosage}, ${medicationData.frequency}).${scheduleText}`
        });
      } catch (e) {
        // Non-blocking
      }

      showSuccess(editingMedication ? 'Medication updated (activity logged).' : 'Medication added (activity logged).');
      onClose();
      
      // Notify parent to reload medications
      if (onMedicationAdded) {
        await onMedicationAdded();
      }
    } catch (error) {
      console.error('Error saving medication:', error);
      showError('Failed to save medication. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!show) return null;

  return (
    <div 
      className={DesignTokens.components.modal.backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className={combineClasses('w-full h-full md:h-auto', DesignTokens.borders.radius.lg, 'md:max-w-md md:max-h-[90vh] overflow-hidden flex flex-col animate-slide-up', DesignTokens.components.modal.container)}>
        <div className={combineClasses('flex-shrink-0 border-b', DesignTokens.components.modal.header, DesignTokens.colors.neutral.border[200])}>
          <h3 className={combineClasses(DesignTokens.typography.h2.full, DesignTokens.typography.h2.weight, DesignTokens.colors.neutral.text[900])}>{editingMedication ? 'Edit Medication' : 'Add Medication'}</h3>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className={combineClasses(DesignTokens.transitions.default, DesignTokens.components.modal.closeButton)}
            type="button"
          >
            <X className={DesignTokens.icons.header.size.full} />
          </button>
        </div>

        <div className={combineClasses('flex-1 overflow-y-auto', DesignTokens.components.modal.body)}>
          <div className={combineClasses('space-y-4', DesignTokens.spacing.gap.lg)}>
            <div className={combineClasses(DesignTokens.borders.width.default, DesignTokens.borders.radius.sm, DesignTokens.spacing.card.mobile, DesignTokens.components.alert.info.bg, DesignTokens.components.alert.info.border)}>
              <div className={combineClasses('flex items-start', DesignTokens.spacing.gap.sm)}>
                <AlertCircle className={combineClasses(DesignTokens.icons.button.size.full, 'mt-0.5 flex-shrink-0', DesignTokens.components.alert.text.info.replace('700', '600'))} />
                <div className="flex-1">
                  <p className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, DesignTokens.components.alert.text.info.replace('700', '900'))}>Medication Tracking</p>
                  <p className={combineClasses(DesignTokens.typography.body.xs, 'mt-1', DesignTokens.components.alert.text.info)}>
                    Add any medication to track dosage, schedule, and adherence.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className={combineClasses('block', DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, 'mb-2', DesignTokens.colors.neutral.text[700])}>
                Medication Name <span className={combineClasses(DesignTokens.components.alert.text.error)}>*</span>
              </label>
              <input
                type="text"
                placeholder="e.g., Paclitaxel, Ibuprofen"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className={combineClasses(DesignTokens.components.input.base, DesignTokens.borders.radius.sm)}
              />
            </div>

            <div className={combineClasses('grid grid-cols-3', DesignTokens.spacing.gap.md)}>
              <div>
                <label className={combineClasses('block', DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, 'mb-1', DesignTokens.colors.neutral.text[700])}>
                  Dosage <span className={combineClasses(DesignTokens.components.alert.text.error)}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., 20"
                  value={formData.dosage}
                  onChange={(e) => setFormData({...formData, dosage: e.target.value})}
                  className={combineClasses(DesignTokens.components.input.base, DesignTokens.borders.radius.sm)}
                />
              </div>

              <div>
                <label className={combineClasses('block', DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, 'mb-1', DesignTokens.colors.neutral.text[700])}>
                  Unit <span className={combineClasses(DesignTokens.components.alert.text.error)}>*</span>
                </label>
                <select 
                  value={formData.unit}
                  onChange={(e) => setFormData({...formData, unit: e.target.value})}
                  className={combineClasses(DesignTokens.components.input.base, DesignTokens.borders.radius.sm)}
                >
                  <option value="">Select...</option>
                  <option value="mg">mg</option>
                  <option value="mg/m²">mg/m²</option>
                  <option value="mg/kg">mg/kg</option>
                  <option value="mcg">mcg</option>
                  <option value="mL">mL</option>
                  <option value="units">units</option>
                  <option value="tablets">tablet(s)</option>
                  <option value="capsules">capsule(s)</option>
                  <option value="cups">cup(s)</option>
                  <option value="drops">drop(s)</option>
                </select>
              </div>

              <div>
                <label className={combineClasses('block', DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, 'mb-1', DesignTokens.colors.neutral.text[700])}>
                  Quantity <span className={combineClasses(DesignTokens.typography.body.xs, DesignTokens.colors.neutral.text[500])}>(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., 2"
                  value={formData.quantity}
                  onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                  className={combineClasses(DesignTokens.components.input.base, DesignTokens.borders.radius.sm)}
                />
                <p className={combineClasses(DesignTokens.typography.body.xs, 'mt-1', DesignTokens.colors.neutral.text[500])}>How many to take</p>
              </div>
            </div>

            <div>
              <label className={combineClasses('block', DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, 'mb-2', DesignTokens.colors.neutral.text[700])}>
                Frequency <span className={combineClasses(DesignTokens.components.alert.text.error)}>*</span>
              </label>
              <select 
                value={formData.frequency}
                onChange={(e) => setFormData({...formData, frequency: e.target.value})}
                className={combineClasses(DesignTokens.components.input.base, DesignTokens.borders.radius.sm)}
              >
                <option value="">Select frequency...</option>
                <option value="Once daily">Once daily</option>
                <option value="Twice daily">Twice daily</option>
                <option value="Three times daily">Three times daily</option>
                <option value="Four times daily">Four times daily</option>
                <option value="Every other day">Every other day</option>
                <option value="Weekly">Weekly</option>
                <option value="Every 2 weeks">Every 2 weeks</option>
                <option value="Every 3 weeks">Every 3 weeks</option>
                <option value="Monthly">Monthly</option>
                <option value="As needed">As needed</option>
                <option value="Custom">Custom</option>
              </select>
            </div>

            <div>
              <label className={combineClasses('block', DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, 'mb-2', DesignTokens.colors.neutral.text[700])}>
                Time(s) of Day <span className={combineClasses(DesignTokens.typography.body.xs, DesignTokens.colors.neutral.text[500])}>(optional)</span>
              </label>
              <div className={combineClasses('flex flex-wrap', DesignTokens.spacing.gap.lg)}>
                <label className={combineClasses('flex items-center cursor-pointer', DesignTokens.spacing.gap.sm)}>
                  <input
                    type="checkbox"
                    checked={selectedTimes.morning}
                    onChange={(e) => setSelectedTimes({...selectedTimes, morning: e.target.checked})}
                    className={combineClasses('w-4 h-4', DesignTokens.borders.radius.sm, 'focus:ring-anchor-900', DesignTokens.colors.app.text[600], DesignTokens.colors.neutral.border[300])}
                  />
                  <span className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.colors.neutral.text[700])}>Morning</span>
                </label>
                <label className={combineClasses('flex items-center cursor-pointer', DesignTokens.spacing.gap.sm)}>
                  <input
                    type="checkbox"
                    checked={selectedTimes.afternoon}
                    onChange={(e) => setSelectedTimes({...selectedTimes, afternoon: e.target.checked})}
                    className={combineClasses('w-4 h-4', DesignTokens.borders.radius.sm, 'focus:ring-anchor-900', DesignTokens.colors.app.text[600], DesignTokens.colors.neutral.border[300])}
                  />
                  <span className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.colors.neutral.text[700])}>Afternoon</span>
                </label>
                <label className={combineClasses('flex items-center cursor-pointer', DesignTokens.spacing.gap.sm)}>
                  <input
                    type="checkbox"
                    checked={selectedTimes.evening}
                    onChange={(e) => setSelectedTimes({...selectedTimes, evening: e.target.checked})}
                    className={combineClasses('w-4 h-4', DesignTokens.borders.radius.sm, 'focus:ring-anchor-900', DesignTokens.colors.app.text[600], DesignTokens.colors.neutral.border[300])}
                  />
                  <span className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.colors.neutral.text[700])}>Evening</span>
                </label>
                <label className={combineClasses('flex items-center cursor-pointer', DesignTokens.spacing.gap.sm)}>
                  <input
                    type="checkbox"
                    checked={selectedTimes.night}
                    onChange={(e) => setSelectedTimes({...selectedTimes, night: e.target.checked})}
                    className={combineClasses('w-4 h-4', DesignTokens.borders.radius.sm, 'focus:ring-anchor-900', DesignTokens.colors.app.text[600], DesignTokens.colors.neutral.border[300])}
                  />
                  <span className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.colors.neutral.text[700])}>Night</span>
                </label>
              </div>
              {(() => {
                const checkedCount = Object.values(selectedTimes).filter(Boolean).length;
                const freq = formData.frequency;
                let expectedCount = 0;

                if (freq === 'Once daily') expectedCount = 1;
                else if (freq === 'Twice daily') expectedCount = 2;
                else if (freq === 'Three times daily') expectedCount = 3;
                else if (freq === 'Four times daily') expectedCount = 4;

                if (expectedCount > 0 && checkedCount > 0 && checkedCount !== expectedCount) {
                  return (
                    <p className={combineClasses(DesignTokens.typography.body.xs, 'mt-2', DesignTokens.components.alert.text.warning)}>
                      Note: {freq} selected but {checkedCount} time{checkedCount !== 1 ? 's' : ''} checked. Consider selecting {expectedCount} time{expectedCount !== 1 ? 's' : ''}.
                    </p>
                  );
                }
                return null;
              })()}
            </div>

            <div>
              <label className={combineClasses('block', DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, 'mb-2', DesignTokens.colors.neutral.text[700])}>
                Purpose/Type <span className={combineClasses(DesignTokens.components.alert.text.error)}>*</span>
              </label>
              {formData.purposes.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {formData.purposes.map((p) => (
                    <span
                      key={p}
                      className={combineClasses('inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium', 'bg-gray-100 border-gray-200 text-gray-800')}
                    >
                      {p}
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, purposes: formData.purposes.filter(x => x !== p) })}
                        className="rounded hover:bg-gray-200 p-0.5"
                        aria-label={`Remove ${p}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={formData.purposeDropdown}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFormData((prev) => {
                      if (!v || v === 'Custom') return { ...prev, purposeDropdown: v };
                      const added = prev.purposes.includes(v) ? prev.purposes : [...prev.purposes, v];
                      return { ...prev, purposes: added, purposeDropdown: '' };
                    });
                  }}
                  className={combineClasses(DesignTokens.components.input.base, DesignTokens.borders.radius.sm, 'flex-1 min-w-0 max-w-[200px]')}
                >
                  <option value="">Add purpose...</option>
                  {PURPOSE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                  <option value="Custom">Custom</option>
                </select>
                {formData.purposeDropdown === 'Custom' && (
                  <>
                    <input
                      type="text"
                      value={formData.customPurposeInput}
                      onChange={(e) => setFormData({ ...formData, customPurposeInput: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const parts = formData.customPurposeInput.split(',').map(s => s.trim()).filter(Boolean);
                          if (parts.length) {
                            setFormData((prev) => ({
                              ...prev,
                              purposes: [...new Set([...prev.purposes, ...parts])],
                              customPurposeInput: '',
                              purposeDropdown: ''
                            }));
                          }
                        }
                      }}
                      placeholder="e.g. Pain relief, Other (comma for multiple)"
                      className={combineClasses(DesignTokens.components.input.base, DesignTokens.borders.radius.sm, 'flex-1 min-w-[140px]')}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const parts = formData.customPurposeInput.split(',').map(s => s.trim()).filter(Boolean);
                        if (parts.length) {
                          setFormData((prev) => ({
                            ...prev,
                            purposes: [...new Set([...prev.purposes, ...parts])],
                            customPurposeInput: '',
                            purposeDropdown: ''
                          }));
                        }
                      }}
                      className={combineClasses(DesignTokens.components.button.outline.primary, 'text-xs py-1.5 px-2')}
                    >
                      Add
                    </button>
                  </>
                )}
              </div>
            </div>

            <div>
              <label className={combineClasses('block', DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, 'mb-1', DesignTokens.colors.neutral.text[700])}>Start Date</label>
                <DatePicker
                  value={formData.startDate}
                  onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                  placeholder="YYYY-MM-DD"
                />
            </div>

            <div>
              <label className={combineClasses('block', DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, 'mb-1', DesignTokens.colors.neutral.text[700])}>
                Special Instructions <span className={combineClasses(DesignTokens.typography.body.xs, DesignTokens.colors.neutral.text[500])}>(optional)</span>
              </label>
              <textarea
                rows="2"
                placeholder="e.g., Take with food, Avoid grapefruit"
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                className={combineClasses(DesignTokens.components.input.base, DesignTokens.components.input.textarea, DesignTokens.borders.radius.sm)}
              ></textarea>
            </div>
          </div>
        </div>

        <div className={combineClasses('flex-shrink-0 border-t', DesignTokens.components.modal.footer, DesignTokens.colors.neutral.border[200])}>
          <div className={combineClasses('flex', DesignTokens.spacing.gap.md)}>
            <button
              onClick={onClose}
              className={combineClasses('flex-1 py-2.5', DesignTokens.borders.radius.sm, DesignTokens.typography.h3.weight, DesignTokens.transitions.default, 'flex items-center justify-center', DesignTokens.spacing.gap.sm, DesignTokens.components.button.secondary)}
            >
              <X className={DesignTokens.icons.standard.size.full} />
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !formData.name?.trim() || !formData.dosage?.trim() || !formData.unit || !formData.frequency || formData.purposes.length === 0}
              className={combineClasses(DesignTokens.components.button.primary, DesignTokens.spacing.button.full, 'py-2.5 font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed')}
            >
              {isSaving ? (
                <>
                  <div className={combineClasses(DesignTokens.icons.standard.size.full, 'border-2 border-white border-t-transparent rounded-full animate-spin')}></div>
                  Saving...
                </>
              ) : (
                <>
                  {editingMedication ? (
                    <>
                      <Edit2 className={DesignTokens.icons.standard.size.full} />
                      Save Changes
                    </>
                  ) : (
                    <>
                      <Plus className={DesignTokens.icons.standard.size.full} />
                      Add Medication
                    </>
                  )}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

