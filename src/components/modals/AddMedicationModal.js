import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Plus, Edit2 } from 'lucide-react';
import { DesignTokens, combineClasses } from '../../design/designTokens';
import { useBanner } from '../../contexts/BannerContext';
import { medicationService } from '../../firebase/services';
import { getTodayLocalDate, formatDateString } from '../../utils/helpers';
import DatePicker from '../DatePicker';

export default function AddMedicationModal({ show, onClose, user, onMedicationAdded, editingMedication }) {
  const { showSuccess, showError } = useBanner();
  const [formData, setFormData] = useState({
    name: '',
    dosage: '',
    unit: '',
    quantity: '',
    frequency: '',
    schedule: '',
    purpose: '',
    startDate: getTodayLocalDate(),
    notes: ''
  });
  const [selectedTimes, setSelectedTimes] = useState({
    morning: false,
    afternoon: false,
    evening: false
  });
  const [isSaving, setIsSaving] = useState(false);

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
        
        // Parse schedule times and set checkboxes
        let morningChecked = false;
        let afternoonChecked = false;
        let eveningChecked = false;
        
        if (editingMedication.schedule && 
            editingMedication.schedule !== editingMedication.frequency &&
            editingMedication.schedule.includes(':')) {
          const scheduleStr = editingMedication.schedule.toLowerCase();
          
          // Check for morning times (before 12 PM)
          if (scheduleStr.match(/\b(?:12|1|2|3|4|5|6|7|8|9|10|11):\d+\s*am/i) || 
              scheduleStr.match(/\b(?:8|9|10|11):\d+/i) && !scheduleStr.includes('pm')) {
            morningChecked = true;
          }
          
          // Check for afternoon times (12 PM - 4 PM)
          if (scheduleStr.match(/\b(?:12|1|2|3|4):\d+\s*pm/i) ||
              scheduleStr.match(/\b(?:12|1|2|3):\d+/i) && scheduleStr.includes('pm')) {
            afternoonChecked = true;
          }
          
          // Check for evening times (after 5 PM)
          if (scheduleStr.match(/\b(?:5|6|7|8|9|10|11|12):\d+\s*pm/i) ||
              scheduleStr.match(/\b(?:5|6|7|8|9|10|11|12):\d+/i) && scheduleStr.includes('pm')) {
            eveningChecked = true;
          }
        }
        
        setSelectedTimes({
          morning: morningChecked,
          afternoon: afternoonChecked,
          evening: eveningChecked
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
          purpose: editingMedication.purpose || '',
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
          purpose: '',
          startDate: getTodayLocalDate(),
          notes: ''
        });
        setSelectedTimes({
          morning: false,
          afternoon: false,
          evening: false
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
    if (!formData.name || !formData.dosage || !formData.unit || !formData.frequency || !formData.purpose) {
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

      // Map purpose to color
      const colorMap = {
        'Chemotherapy': 'purple',
        'Targeted therapy': 'blue',
        'Immunotherapy': 'green',
        'Hormone therapy': 'orange',
        'Anti-nausea': 'teal',
        'Pain management': 'blue',
        'Anti-inflammatory': 'green',
        'Antibiotic': 'blue',
        'Stomach protection': 'teal',
        'Vitamin/Supplement': 'green',
        'Other': 'blue'
      };

      // Build schedule from selected checkboxes
      const times = [];
      if (selectedTimes.morning) times.push('8:00 AM');
      if (selectedTimes.afternoon) times.push('2:00 PM');
      if (selectedTimes.evening) times.push('8:00 PM');
      
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
        purpose: formData.purpose,
        startDate: new Date(formData.startDate),
        notes: formData.notes || '',
        active: editingMedication?.active !== undefined ? editingMedication.active : true,
        nextDose: nextDose,
        color: colorMap[formData.purpose] || 'blue'
      };

      await medicationService.saveMedication(medicationData);

      showSuccess(editingMedication ? 'Medication updated successfully!' : 'Medication added successfully!');
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

  return (
    <div className={combineClasses("fixed inset-0 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-0 md:p-4", DesignTokens.components.modal.backdrop)}>
      <div className={combineClasses("w-full h-full md:h-auto md:rounded-2xl md:max-w-md md:max-h-[85vh] overflow-hidden flex flex-col animate-slide-up", DesignTokens.components.modal.container)}>
        <div className={combineClasses("flex-shrink-0 border-b p-4 flex items-center justify-between", DesignTokens.components.modal.container, DesignTokens.colors.neutral.border[200])}>
          <h3 className={combineClasses('font-bold text-lg', DesignTokens.colors.neutral.text[800])}>{editingMedication ? 'Edit Medication' : 'Add Medication'}</h3>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className={combineClasses('transition', DesignTokens.components.modal.closeButton)}
            type="button"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            <div className={combineClasses('border rounded-lg p-3', DesignTokens.components.alert.info.bg, DesignTokens.components.alert.info.border)}>
              <div className="flex items-start gap-2">
                <AlertCircle className={combineClasses('w-5 h-5 mt-0.5 flex-shrink-0', DesignTokens.components.alert.text.info.replace('700', '600'))} />
                <div className="flex-1">
                  <p className={combineClasses('text-sm font-medium', DesignTokens.components.alert.text.info.replace('700', '900'))}>Medication Tracking</p>
                  <p className={combineClasses('text-xs mt-1', DesignTokens.components.alert.text.info)}>
                    Add any medication to track dosage, schedule, and adherence.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className={combineClasses('block text-sm font-medium mb-2', DesignTokens.colors.neutral.text[700])}>
                Medication Name <span className={combineClasses('', DesignTokens.components.alert.text.error)}>*</span>
              </label>
              <input
                type="text"
                placeholder="e.g., Paclitaxel, Ibuprofen"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className={combineClasses('w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-medical-primary-500', DesignTokens.components.input.base)}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={combineClasses('block text-sm font-medium mb-1', DesignTokens.colors.neutral.text[700])}>
                  Dosage <span className={combineClasses('', DesignTokens.components.alert.text.error)}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., 20"
                  value={formData.dosage}
                  onChange={(e) => setFormData({...formData, dosage: e.target.value})}
                  className={combineClasses('w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-medical-primary-500', DesignTokens.components.input.base)}
                />
              </div>

              <div>
                <label className={combineClasses('block text-sm font-medium mb-1', DesignTokens.colors.neutral.text[700])}>
                  Unit <span className={combineClasses('', DesignTokens.components.alert.text.error)}>*</span>
                </label>
                <select 
                  value={formData.unit}
                  onChange={(e) => setFormData({...formData, unit: e.target.value})}
                  className={combineClasses('w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-medical-primary-500', DesignTokens.components.input.base)}
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
                <label className={combineClasses('block text-sm font-medium mb-1', DesignTokens.colors.neutral.text[700])}>
                  Quantity <span className={combineClasses('text-xs', DesignTokens.colors.neutral.text[500])}>(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., 2"
                  value={formData.quantity}
                  onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                  className={combineClasses('w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-medical-primary-500', DesignTokens.components.input.base)}
                />
                <p className={combineClasses('text-xs mt-1', DesignTokens.colors.neutral.text[500])}>How many to take</p>
              </div>
            </div>

            <div>
              <label className={combineClasses('block text-sm font-medium mb-2', DesignTokens.colors.neutral.text[700])}>
                Frequency <span className={combineClasses('', DesignTokens.components.alert.text.error)}>*</span>
              </label>
              <select 
                value={formData.frequency}
                onChange={(e) => setFormData({...formData, frequency: e.target.value})}
                className={combineClasses('w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-medical-primary-500', DesignTokens.components.input.base)}
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
              <label className={combineClasses('block text-sm font-medium mb-2', DesignTokens.colors.neutral.text[700])}>
                Time(s) of Day <span className={combineClasses('text-xs', DesignTokens.colors.neutral.text[500])}>(optional)</span>
              </label>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedTimes.morning}
                    onChange={(e) => setSelectedTimes({...selectedTimes, morning: e.target.checked})}
                    className={combineClasses('w-4 h-4 rounded focus:ring-blue-500', DesignTokens.colors.primary[600].replace('bg-', 'text-'), DesignTokens.colors.neutral.border[300])}
                  />
                  <span className={combineClasses('text-sm', DesignTokens.colors.neutral.text[700])}>Morning</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedTimes.afternoon}
                    onChange={(e) => setSelectedTimes({...selectedTimes, afternoon: e.target.checked})}
                    className={combineClasses('w-4 h-4 rounded focus:ring-blue-500', DesignTokens.colors.primary[600].replace('bg-', 'text-'), DesignTokens.colors.neutral.border[300])}
                  />
                  <span className={combineClasses('text-sm', DesignTokens.colors.neutral.text[700])}>Afternoon</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedTimes.evening}
                    onChange={(e) => setSelectedTimes({...selectedTimes, evening: e.target.checked})}
                    className={combineClasses('w-4 h-4 rounded focus:ring-blue-500', DesignTokens.colors.primary[600].replace('bg-', 'text-'), DesignTokens.colors.neutral.border[300])}
                  />
                  <span className={combineClasses('text-sm', DesignTokens.colors.neutral.text[700])}>Evening</span>
                </label>
              </div>
            </div>

            <div>
              <label className={combineClasses('block text-sm font-medium mb-2', DesignTokens.colors.neutral.text[700])}>
                Purpose/Type <span className={combineClasses('', DesignTokens.components.alert.text.error)}>*</span>
              </label>
              <select 
                value={formData.purpose}
                onChange={(e) => setFormData({...formData, purpose: e.target.value})}
                className={combineClasses('w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-medical-primary-500', DesignTokens.components.input.base)}
              >
                <option value="">Select purpose...</option>
                <option value="Chemotherapy">Chemotherapy</option>
                <option value="Targeted therapy">Targeted therapy</option>
                <option value="Immunotherapy">Immunotherapy</option>
                <option value="Hormone therapy">Hormone therapy</option>
                <option value="Anti-nausea">Anti-nausea</option>
                <option value="Pain management">Pain management</option>
                <option value="Anti-inflammatory">Anti-inflammatory</option>
                <option value="Antibiotic">Antibiotic</option>
                <option value="Stomach protection">Stomach protection</option>
                <option value="Vitamin/Supplement">Vitamin/Supplement</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className={combineClasses('block text-sm font-medium mb-1', DesignTokens.colors.neutral.text[700])}>Start Date</label>
                <DatePicker
                  value={formData.startDate}
                  onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                  placeholder="YYYY-MM-DD"
                />
            </div>

            <div>
              <label className={combineClasses('block text-sm font-medium mb-1', DesignTokens.colors.neutral.text[700])}>
                Special Instructions <span className={combineClasses('text-xs', DesignTokens.colors.neutral.text[500])}>(optional)</span>
              </label>
              <textarea
                rows="2"
                placeholder="e.g., Take with food, Avoid grapefruit"
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                className={combineClasses('w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-medical-primary-500 resize-none', DesignTokens.components.input.base, DesignTokens.components.input.textarea)}
              ></textarea>
            </div>
          </div>
        </div>

        <div className={combineClasses('flex-shrink-0 border-t p-4', DesignTokens.components.modal.container, DesignTokens.colors.neutral.border[200])}>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className={combineClasses('flex-1 py-2.5 rounded-lg font-medium transition flex items-center justify-center gap-2', DesignTokens.components.button.secondary)}
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={combineClasses('flex-1 text-white py-2.5 rounded-lg font-medium transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed', DesignTokens.components.button.primary)}
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Saving...
                </>
              ) : (
                <>
                  {editingMedication ? (
                    <>
                      <Edit2 className="w-4 h-4" />
                      Save Changes
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
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

