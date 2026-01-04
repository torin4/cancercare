import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { DesignTokens, combineClasses } from '../../design/designTokens';
import { labService } from '../../firebase/services';
import { getTodayLocalDate, formatDateString, parseLocalDate } from '../../utils/helpers';
import { useBanner } from '../../contexts/BannerContext';
import DatePicker from '../DatePicker';

export default function AddLabValueModal({
  show,
  onClose,
  user,
  selectedLabForValue,
  setSelectedLabForValue,
  newLabValue,
  setNewLabValue,
  isEditingLabValue,
  setIsEditingLabValue,
  editingLabValueId,
  setEditingLabValueId,
  reloadHealthData,
  setSelectedLab
}) {
  const { showSuccess, showError } = useBanner();
  useEffect(() => {
    if (show && selectedLabForValue && isEditingLabValue && editingLabValueId) {
      // Find the specific lab value to pre-fill the form
      const valueToEdit = selectedLabForValue.data?.find(v => v.id === editingLabValueId);
      if (valueToEdit) {
        const date = valueToEdit.dateOriginal || new Date();
        // Use formatDateString to ensure local time (not UTC) - prevents one-day shift
        const dateStr = formatDateString(date) || getTodayLocalDate();
        setNewLabValue({
          value: valueToEdit.value || '',
          date: dateStr,
          notes: valueToEdit.notes || ''
        });
      }
    } else if (show && !isEditingLabValue) {
      // Reset form for new entry
      setNewLabValue({ value: '', date: getTodayLocalDate(), notes: '' });
    }
  }, [show, selectedLabForValue, isEditingLabValue, editingLabValueId]);

  if (!show || !selectedLabForValue) return null;

  const handleClose = () => {
    setSelectedLabForValue(null);
    setIsEditingLabValue(false);
    setEditingLabValueId(null);
    setNewLabValue({ value: '', date: getTodayLocalDate(), notes: '' });
    onClose();
  };

  const handleSave = async () => {
    if (!newLabValue.value || !newLabValue.date || !selectedLabForValue || !user) {
      showError('Please fill in all required fields.');
      return;
    }

    try {
      // Use parseLocalDate to ensure local time (not UTC) - prevents one-day shift
      const valueDate = parseLocalDate(newLabValue.date);
      if (isNaN(valueDate.getTime())) {
        showError('Please enter a valid date.');
        return;
      }

      if (isEditingLabValue && editingLabValueId) {
        // Update existing value
        await labService.updateLabValue(selectedLabForValue.id, editingLabValueId, {
          value: parseFloat(newLabValue.value),
          date: valueDate,
          notes: newLabValue.notes || ''
        });
      } else {
        // Add new value
        await labService.addLabValue(selectedLabForValue.id, {
          value: parseFloat(newLabValue.value),
          date: valueDate,
          notes: newLabValue.notes || ''
        });
      }

      // Update the lab's current value
      const lab = await labService.getLab(selectedLabForValue.id);
      if (lab) {
        await labService.saveLab({
          id: selectedLabForValue.id,
          currentValue: parseFloat(newLabValue.value)
        });
      }

      // Reload health data
      await reloadHealthData();

      // Select this lab in the chart view
      if (setSelectedLab && selectedLabForValue.key) {
        setSelectedLab(selectedLabForValue.key);
      }

      showSuccess(isEditingLabValue ? 'Lab value updated successfully!' : 'Lab value added successfully!');
      handleClose();
    } catch (error) {
      showError('Failed to save lab value. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-white w-full h-full md:h-auto md:rounded-2xl md:max-w-md md:max-h-[85vh] overflow-hidden flex flex-col animate-slide-up">
        <div className="flex-shrink-0 bg-white border-b p-4 flex items-center justify-between">
          <h3 className={combineClasses('font-bold text-lg', DesignTokens.colors.neutral.text[800])}>{isEditingLabValue ? 'Edit Metric Value' : `Add ${selectedLabForValue.name} Value`}</h3>
          <button
            onClick={handleClose}
            className={combineClasses('transition', DesignTokens.colors.neutral.text[500], DesignTokens.colors.neutral.text[700].replace('text-', 'hover:text-'))}
            type="button"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="space-y-4">
            <div>
              <label className={combineClasses('block text-sm font-medium mb-2', DesignTokens.colors.neutral.text[700])}>
                Value <span className={combineClasses('', DesignTokens.components.alert.text.error)}>*</span>
              </label>
              <input
                type="number"
                step="any"
                value={newLabValue.value}
                onChange={(e) => setNewLabValue({ ...newLabValue, value: e.target.value })}
                placeholder={`Enter ${selectedLabForValue.name} value`}
                className={combineClasses('w-full rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-medical-primary-500', DesignTokens.components.input.base)}
              />
              {selectedLabForValue.unit && (
                <p className={combineClasses('text-xs mt-1', DesignTokens.colors.neutral.text[500])}>Unit: {selectedLabForValue.unit}</p>
              )}
            </div>

            <div>
              <label className={combineClasses('block text-sm font-medium mb-2', DesignTokens.colors.neutral.text[700])}>
                Date <span className={combineClasses('', DesignTokens.components.alert.text.error)}>*</span>
              </label>
              <DatePicker
                value={newLabValue.date}
                onChange={(e) => setNewLabValue({ ...newLabValue, date: e.target.value })}
                max={getTodayLocalDate()}
                placeholder="YYYY-MM-DD"
              />
            </div>

            <div>
              <label className={combineClasses('block text-sm font-medium mb-2', DesignTokens.colors.neutral.text[700])}>
                Notes <span className={combineClasses('text-xs', DesignTokens.colors.neutral.text[500])}>(optional)</span>
              </label>
              <textarea
                rows={3}
                value={newLabValue.notes}
                onChange={(e) => setNewLabValue({ ...newLabValue, notes: e.target.value })}
                placeholder="Add any context about this reading..."
                className={combineClasses('w-full rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-medical-primary-500 resize-none', DesignTokens.components.input.base, DesignTokens.components.input.textarea)}
              />
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 bg-white border-t p-4">
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className={combineClasses('flex-1 py-2.5 rounded-lg font-medium transition flex items-center justify-center gap-2', DesignTokens.colors.neutral[200], DesignTokens.colors.neutral.text[700], DesignTokens.colors.neutral[300].replace('bg-', 'hover:bg-'))}
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
            <button
              onClick={handleSave}
              className={combineClasses('flex-1 text-white py-2.5 rounded-lg font-medium transition flex items-center justify-center gap-2', DesignTokens.colors.primary[600], DesignTokens.colors.primary[700].replace('bg-', 'hover:bg-'))}
            >
              <Check className="w-4 h-4" />
              {isEditingLabValue ? 'Save' : 'Add Value'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

