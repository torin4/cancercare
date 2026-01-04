import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Plus, Edit2 } from 'lucide-react';
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
    frequency: '',
    schedule: '',
    purpose: '',
    startDate: getTodayLocalDate(),
    notes: ''
  });
  const [isSaving, setIsSaving] = useState(false);

  // Reset form when modal opens or editing medication changes
  useEffect(() => {
    if (show) {
      if (editingMedication) {
        // Pre-fill form with medication data
        const dosageParts = editingMedication.dosage ? editingMedication.dosage.split(' ') : ['', ''];
        const dosageValue = dosageParts[0] || '';
        const unitValue = dosageParts.slice(1).join(' ') || '';
        
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
          frequency: '',
          schedule: '',
          purpose: '',
          startDate: getTodayLocalDate(),
          notes: ''
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
      // Build dosage string
      const dosage = `${formData.dosage} ${formData.unit}`;
      
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

      // Determine schedule: if times are entered, use them; otherwise use frequency as fallback
      // But preserve empty string if user explicitly cleared the times field
      const scheduleValue = formData.schedule.trim() 
        ? formData.schedule.trim() 
        : formData.frequency;

      const medicationData = {
        ...(editingMedication?.id && { id: editingMedication.id }),
        patientId: user.uid,
        name: formData.name,
        dosage: dosage,
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-white w-full h-full md:h-auto md:rounded-2xl md:max-w-md md:max-h-[85vh] overflow-hidden flex flex-col animate-slide-up">
        <div className="flex-shrink-0 bg-white border-b p-4 flex items-center justify-between">
          <h3 className="font-bold text-lg text-gray-800">{editingMedication ? 'Edit Medication' : 'Add Medication'}</h3>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="text-gray-500 hover:text-gray-700"
            type="button"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900">Medication Tracking</p>
                  <p className="text-xs text-blue-700 mt-1">
                    Add any medication to track dosage, schedule, and adherence.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Medication Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g., Paclitaxel, Ibuprofen"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dosage <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., 20"
                  value={formData.dosage}
                  onChange={(e) => setFormData({...formData, dosage: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Unit <span className="text-red-600">*</span>
                </label>
                <select 
                  value={formData.unit}
                  onChange={(e) => setFormData({...formData, unit: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Frequency <span className="text-red-600">*</span>
              </label>
              <select 
                value={formData.frequency}
                onChange={(e) => setFormData({...formData, frequency: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Time(s) of Day
              </label>
              <input
                type="text"
                placeholder="e.g., 8:00 AM, 8:00 PM"
                value={formData.schedule}
                onChange={(e) => setFormData({...formData, schedule: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">For daily medications, specify times</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Purpose/Type <span className="text-red-600">*</span>
              </label>
              <select 
                value={formData.purpose}
                onChange={(e) => setFormData({...formData, purpose: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <DatePicker
                  value={formData.startDate}
                  onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                  placeholder="YYYY-MM-DD"
                />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Special Instructions <span className="text-gray-500 text-xs">(optional)</span>
              </label>
              <textarea
                rows="2"
                placeholder="e.g., Take with food, Avoid grapefruit"
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              ></textarea>
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 border-t p-4 bg-white">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 bg-gray-200 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-300 transition flex items-center justify-center gap-2"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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

