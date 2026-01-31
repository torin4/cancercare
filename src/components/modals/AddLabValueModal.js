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
  setSelectedLab,
  availableLabs = null
}) {
  const { showSuccess, showError } = useBanner();
  useEffect(() => {
    // Only reset form when opening for a new entry (not editing)
    // When editing, the form is pre-filled by the parent component
    if (show && !isEditingLabValue) {
      // Reset form for new entry
      setNewLabValue({ value: '', date: getTodayLocalDate(), notes: '' });
    }
    // Note: When editing, we don't modify newLabValue here because it's already
    // set by the parent component (LabsSection) before opening the modal
  }, [show, isEditingLabValue]);

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
        console.log('Updating lab value:', {
          labId: selectedLabForValue.id,
          valueId: editingLabValueId,
          value: parseFloat(newLabValue.value),
          date: valueDate,
          notes: newLabValue.notes || ''
        });
        await labService.updateLabValue(selectedLabForValue.id, editingLabValueId, {
          value: parseFloat(newLabValue.value),
          date: valueDate,
          notes: newLabValue.notes || ''
        });
        console.log('Lab value update completed');
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

      // Reload health data to ensure UI reflects the update
      console.log('Reloading health data after lab value update');
      await reloadHealthData();
      console.log('Health data reloaded');

      // Select this lab in the chart view
      if (setSelectedLab && selectedLabForValue.key) {
        setSelectedLab(selectedLabForValue.key);
      }

      showSuccess(isEditingLabValue ? 'Lab value updated successfully!' : 'Lab value added successfully!');
      handleClose();
    } catch (error) {
      console.error('Error saving lab value:', error);
      showError(`Failed to save lab value: ${error.message || 'Please try again.'}`);
    }
  };

  return (
    <div className={combineClasses(DesignTokens.components.modal.backdrop, 'z-50')}>
      <div className={combineClasses('bg-white w-full h-full md:h-auto', DesignTokens.borders.radius.lg, 'md:max-w-md md:max-h-[85vh] overflow-hidden flex flex-col animate-slide-up')}>
        <div className={DesignTokens.components.modal.header}>
          <h3 className={combineClasses(DesignTokens.typography.h2.full, DesignTokens.typography.h2.weight, DesignTokens.colors.primary.text[700])}>{isEditingLabValue ? 'Edit Metric Value' : `Add ${selectedLabForValue.name} Value`}</h3>
          <button
            onClick={handleClose}
            className={combineClasses(DesignTokens.transitions.default, DesignTokens.components.modal.closeButton)}
            type="button"
          >
            <X className={DesignTokens.icons.header.size.full} />
          </button>
        </div>

        <div className={combineClasses('flex-1 overflow-y-auto', DesignTokens.components.modal.body)}>
          <div className={combineClasses('space-y-4', DesignTokens.spacing.gap.lg)}>
            {availableLabs && availableLabs.length > 1 && (
              <div>
                <label className={combineClasses('block', DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, 'mb-2', DesignTokens.colors.neutral.text[700])}>
                  Lab <span className={combineClasses(DesignTokens.components.alert.text.error)}>*</span>
                </label>
                <select
                  value={selectedLabForValue?.key ?? selectedLabForValue?.id ?? ''}
                  onChange={(e) => {
                    const chosen = availableLabs.find(l => (l.key ?? l.id) === e.target.value);
                    if (chosen) {
                      setSelectedLabForValue(chosen);
                      setNewLabValue({ value: '', date: getTodayLocalDate(), notes: '' });
                    }
                  }}
                  className={combineClasses(DesignTokens.components.select.base, 'min-h-[44px] w-full', DesignTokens.colors.neutral.border[300])}
                >
                  {availableLabs.map((l) => (
                    <option key={l.key ?? l.id} value={l.key ?? l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className={combineClasses('block', DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, 'mb-2', DesignTokens.colors.neutral.text[700])}>
                Value <span className={combineClasses(DesignTokens.components.alert.text.error)}>*</span>
              </label>
              <input
                type="number"
                step="any"
                value={newLabValue.value}
                onChange={(e) => setNewLabValue({ ...newLabValue, value: e.target.value })}
                placeholder={`Enter ${selectedLabForValue.name} value`}
                className={combineClasses(DesignTokens.components.input.base, DesignTokens.borders.radius.sm)}
              />
              {selectedLabForValue.unit && (
                <p className={combineClasses(DesignTokens.typography.body.xs, 'mt-1', DesignTokens.colors.neutral.text[500])}>Unit: {selectedLabForValue.unit}</p>
              )}
            </div>

            <div>
              <label className={combineClasses('block', DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, 'mb-2', DesignTokens.colors.neutral.text[700])}>
                Date <span className={combineClasses(DesignTokens.components.alert.text.error)}>*</span>
              </label>
              <DatePicker
                value={newLabValue.date}
                onChange={(e) => setNewLabValue({ ...newLabValue, date: e.target.value })}
                max={getTodayLocalDate()}
                placeholder="YYYY-MM-DD"
              />
            </div>

            <div>
              <label className={combineClasses('block', DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, 'mb-2', DesignTokens.colors.neutral.text[700])}>
                Notes <span className={combineClasses(DesignTokens.typography.body.xs, DesignTokens.colors.neutral.text[500])}>(optional)</span>
              </label>
              <textarea
                rows={3}
                value={newLabValue.notes}
                onChange={(e) => setNewLabValue({ ...newLabValue, notes: e.target.value })}
                placeholder="Add any context about this reading..."
                className={combineClasses(DesignTokens.components.input.base, DesignTokens.components.input.textarea, DesignTokens.borders.radius.sm)}
              />
            </div>
          </div>
        </div>

        <div className={combineClasses('flex-shrink-0 border-t', DesignTokens.components.modal.footer, DesignTokens.colors.neutral.border[200])}>
          <div className={combineClasses('flex', DesignTokens.spacing.gap.md)}>
            <button
              onClick={handleClose}
              className={combineClasses('flex-1 py-2.5', DesignTokens.borders.radius.sm, DesignTokens.typography.h3.weight, DesignTokens.transitions.default, 'flex items-center justify-center', DesignTokens.spacing.gap.sm, DesignTokens.colors.neutral[200], DesignTokens.colors.neutral.text[700], DesignTokens.colors.neutral[300].replace('bg-', 'hover:bg-'))}
            >
              <X className={DesignTokens.icons.standard.size.full} />
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!newLabValue.value || !newLabValue.date}
              className={combineClasses(DesignTokens.components.button.primary, DesignTokens.spacing.button.full, 'py-2.5 font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed')}
            >
              <Check className={DesignTokens.icons.standard.size.full} />
              {isEditingLabValue ? 'Save' : 'Add Value'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

