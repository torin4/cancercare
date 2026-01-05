import React, { useEffect, useState } from 'react';
import { X, Heart } from 'lucide-react';
import { DesignTokens, combineClasses } from '../../design/designTokens';
import { vitalService } from '../../firebase/services';
import { useBanner } from '../../contexts/BannerContext';
import DateTimePicker from '../DateTimePicker';
import DatePicker from '../DatePicker';
import { formatDateString, getTodayLocalDate } from '../../utils/helpers';

export default function AddVitalValueModal({ 
  show, 
  onClose, 
  user,
  selectedVitalForValue,
  newVitalValue,
  setNewVitalValue,
  isEditingVitalValue,
  editingVitalValueId,
  setIsEditingVitalValue,
  setEditingVitalValueId,
  setSelectedVitalForValue,
  reloadHealthData,
  vitalsData
}) {
  const { showSuccess, showError } = useBanner();
  const [isAllDay, setIsAllDay] = useState(false);
  const [dateOnly, setDateOnly] = useState(getTodayLocalDate());
  
  useEffect(() => {
    if (show && selectedVitalForValue && isEditingVitalValue && editingVitalValueId && vitalsData) {
      // Find the specific vital value to pre-fill the form
      const vitalKey = selectedVitalForValue.key || selectedVitalForValue.vitalType;
      const currentVital = vitalsData[vitalKey];
      if (currentVital && currentVital.data) {
        const valueToEdit = currentVital.data.find(v => v.id === editingVitalValueId);
        if (valueToEdit) {
          // Extract date from various possible formats, using local time to avoid timezone shift
          let dateTimeValue = new Date().toISOString().slice(0, 16);
          
          // Get the date value (prioritize dateOriginal, then date)
          let dateValue = valueToEdit.dateOriginal || valueToEdit.date;
          
          if (dateValue) {
          // Check for Firestore Timestamp (has toDate method)
            if (dateValue && typeof dateValue.toDate === 'function') {
              const firestoreDate = dateValue.toDate();
              // Use local date components to avoid timezone shift
              const year = firestoreDate.getFullYear();
              const month = String(firestoreDate.getMonth() + 1).padStart(2, '0');
              const day = String(firestoreDate.getDate()).padStart(2, '0');
              const hours = String(firestoreDate.getHours()).padStart(2, '0');
              const minutes = String(firestoreDate.getMinutes()).padStart(2, '0');
              dateTimeValue = `${year}-${month}-${day}T${hours}:${minutes}`;
          }
          // Check for timestamp (number)
          else if (valueToEdit.timestamp) {
              const dateFromTimestamp = new Date(valueToEdit.timestamp);
              const year = dateFromTimestamp.getFullYear();
              const month = String(dateFromTimestamp.getMonth() + 1).padStart(2, '0');
              const day = String(dateFromTimestamp.getDate()).padStart(2, '0');
              const hours = String(dateFromTimestamp.getHours()).padStart(2, '0');
              const minutes = String(dateFromTimestamp.getMinutes()).padStart(2, '0');
              dateTimeValue = `${year}-${month}-${day}T${hours}:${minutes}`;
          }
          // Check for date as Date object
            else if (dateValue instanceof Date) {
              const year = dateValue.getFullYear();
              const month = String(dateValue.getMonth() + 1).padStart(2, '0');
              const day = String(dateValue.getDate()).padStart(2, '0');
              const hours = String(dateValue.getHours()).padStart(2, '0');
              const minutes = String(dateValue.getMinutes()).padStart(2, '0');
              dateTimeValue = `${year}-${month}-${day}T${hours}:${minutes}`;
          }
          // Check for date as string (formatted or ISO)
            else if (typeof dateValue === 'string') {
              // Try to parse and format using local time
              const parsed = new Date(dateValue);
            if (!isNaN(parsed.getTime())) {
                const year = parsed.getFullYear();
                const month = String(parsed.getMonth() + 1).padStart(2, '0');
                const day = String(parsed.getDate()).padStart(2, '0');
                const hours = String(parsed.getHours()).padStart(2, '0');
                const minutes = String(parsed.getMinutes()).padStart(2, '0');
                dateTimeValue = `${year}-${month}-${day}T${hours}:${minutes}`;
                
                // Check if it's all day (time is midnight)
                if (hours === '00' && minutes === '00') {
                  setIsAllDay(true);
                  setDateOnly(`${year}-${month}-${day}`);
                }
              }
            }
          }
          // Check if this is an all-day entry (check all date parsing paths above)
          // Also check Firestore timestamp path
          let allDayDetected = false;
          if (dateValue) {
            if (dateValue && typeof dateValue.toDate === 'function') {
              const firestoreDate = dateValue.toDate();
              allDayDetected = firestoreDate.getHours() === 0 && firestoreDate.getMinutes() === 0;
            } else if (dateValue instanceof Date) {
              allDayDetected = dateValue.getHours() === 0 && dateValue.getMinutes() === 0;
            } else if (valueToEdit.timestamp) {
              const dateFromTimestamp = new Date(valueToEdit.timestamp);
              allDayDetected = dateFromTimestamp.getHours() === 0 && dateFromTimestamp.getMinutes() === 0;
            }
          }
          
          if (allDayDetected) {
            setIsAllDay(true);
            const [datePart] = dateTimeValue.split('T');
            setDateOnly(datePart);
          } else {
            setIsAllDay(false);
          }
          
          // For blood pressure, extract systolic and diastolic from value if not stored separately
          let systolic = valueToEdit.systolic || '';
          let diastolic = valueToEdit.diastolic || '';
          
          // If systolic/diastolic not stored separately, try to parse from value field (format: "120/80" or numeric)
          const vitalType = selectedVitalForValue.vitalType || selectedVitalForValue.key;
          if ((vitalType === 'bp' || vitalType === 'bloodpressure' || vitalType === 'blood_pressure') && (!systolic || !diastolic)) {
            if (typeof valueToEdit.value === 'string' && valueToEdit.value.includes('/')) {
              // Parse from "120/80" format
              const parts = valueToEdit.value.split('/');
              if (parts.length === 2) {
                systolic = parts[0].trim();
                diastolic = parts[1].trim();
              }
            } else if (valueToEdit.value && !systolic) {
              // If only numeric value is stored, use it as systolic (fallback)
              systolic = valueToEdit.value.toString();
            }
          }
          
          setNewVitalValue({
            value: valueToEdit.value || '',
            systolic: systolic,
            diastolic: diastolic,
            dateTime: dateTimeValue,
            notes: valueToEdit.notes || ''
          });
        }
      }
    } else if (show && !isEditingVitalValue) {
      // Reset form for new entry
      setNewVitalValue({ value: '', systolic: '', diastolic: '', dateTime: new Date().toISOString().slice(0, 16), notes: '' });
      setIsAllDay(false);
      setDateOnly(getTodayLocalDate());
    }
  }, [show, selectedVitalForValue, isEditingVitalValue, editingVitalValueId, vitalsData]);

  if (!show || !selectedVitalForValue) return null;

  // Helper function to check if this is a blood pressure vital
  const isBloodPressure = () => {
    const vitalType = selectedVitalForValue.vitalType || selectedVitalForValue.key;
    return vitalType === 'bp' || vitalType === 'bloodpressure' || vitalType === 'blood_pressure';
  };

  const handleCancel = () => {
    setSelectedVitalForValue(null);
    setIsEditingVitalValue(false);
    setEditingVitalValueId(null);
    setNewVitalValue({ value: '', systolic: '', diastolic: '', dateTime: new Date().toISOString().slice(0, 16), notes: '' });
    setIsAllDay(false);
    setDateOnly(getTodayLocalDate());
    onClose();
  };

  const handleSave = async () => {
    if (!selectedVitalForValue || !user) {
      showError('Please fill in all required fields.');
      return;
    }

    if (isBloodPressure()) {
      if (!newVitalValue.systolic || !newVitalValue.diastolic) {
        showError('Please enter both systolic and diastolic values for blood pressure.');
        return;
      }
    } else {
      if (!newVitalValue.value) {
        showError('Please enter a value.');
        return;
      }
    }

    if (isAllDay) {
      if (!dateOnly) {
        showError('Please select a date.');
        return;
      }
    } else {
      if (!newVitalValue.dateTime) {
        showError('Please enter a date and time.');
        return;
      }
    }

    try {
      let vitalDate;
      
      if (isAllDay) {
        // For all-day entries, use midnight (00:00)
        const [year, month, day] = dateOnly.split('-').map(Number);
        vitalDate = new Date(year, month - 1, day, 0, 0);
      } else {
        // Parse dateTime string (YYYY-MM-DDTHH:mm format) as local time
        // Split into date and time parts to avoid timezone shift
        const [datePart, timePart] = newVitalValue.dateTime.split('T');
        const [year, month, day] = datePart.split('-').map(Number);
        const [hours = 0, minutes = 0] = (timePart || '').split(':').map(Number);
        
        // Create date in local timezone (not UTC) - prevents one-day shift
        vitalDate = new Date(year, month - 1, day, hours, minutes);
      }
      
      if (isNaN(vitalDate.getTime())) {
        showError('Please enter a valid date.');
        return;
      }

      // Prepare value data
      const valueData = {
        date: vitalDate,
        notes: newVitalValue.notes || ''
      };

      if (isBloodPressure()) {
        valueData.systolic = parseFloat(newVitalValue.systolic);
        valueData.diastolic = parseFloat(newVitalValue.diastolic);
        valueData.value = parseFloat(newVitalValue.systolic); // Keep numeric value for charting
      } else {
        valueData.value = parseFloat(newVitalValue.value);
      }

      if (isEditingVitalValue && editingVitalValueId) {
        // Update existing value
        await vitalService.updateVitalValue(selectedVitalForValue.id, editingVitalValueId, valueData);
      } else {
        // Add new value
        await vitalService.addVitalValue(selectedVitalForValue.id, valueData);
      }

      // Update current value
      const vital = await vitalService.getVital(selectedVitalForValue.id);
      if (vital) {
        await vitalService.saveVital({
          id: selectedVitalForValue.id,
          currentValue: isBloodPressure() ? `${newVitalValue.systolic}/${newVitalValue.diastolic}` : parseFloat(newVitalValue.value)
        });
      }

      // Reload health data
      if (reloadHealthData) {
        await reloadHealthData();
      }

      setIsEditingVitalValue(false);
      setEditingVitalValueId(null);
      setNewVitalValue({ value: '', systolic: '', diastolic: '', dateTime: new Date().toISOString().slice(0, 16), notes: '' });
      setIsAllDay(false);
      setDateOnly(getTodayLocalDate());
      setSelectedVitalForValue(null);
      showSuccess(isEditingVitalValue ? 'Vital reading updated successfully!' : 'Vital reading added successfully!');
      onClose();
    } catch (error) {
      showError('Failed to add vital reading. Please try again.');
    }
  };

  return (
    <div className={combineClasses(DesignTokens.components.modal.backdrop, 'z-50')}>
      <div className={combineClasses('bg-white w-full h-full md:h-auto', DesignTokens.borders.radius.lg, 'md:max-w-md md:max-h-[85vh] overflow-hidden flex flex-col animate-slide-up')}>
        <div className={combineClasses('flex-shrink-0 border-b', DesignTokens.components.modal.header, DesignTokens.colors.neutral.border[200], 'bg-medical-primary-50')}>
          <h3 className={combineClasses(DesignTokens.typography.h2.full, DesignTokens.typography.h2.weight, DesignTokens.colors.primary.text[700])}>{isEditingVitalValue ? 'Edit Metric Value' : `Add ${selectedVitalForValue.name} Value`}</h3>
          <button
            onClick={handleCancel}
            className={combineClasses(DesignTokens.transitions.default, DesignTokens.components.modal.closeButton)}
            type="button"
          >
            <X className={DesignTokens.icons.header.size.full} />
          </button>
        </div>

        <div className={combineClasses('flex-1 overflow-y-auto', DesignTokens.components.modal.body)}>
          <div className={combineClasses('space-y-4', DesignTokens.spacing.gap.lg)}>
            {isBloodPressure() ? (
              <div>
                <label className={combineClasses('block', DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, 'mb-2', DesignTokens.colors.neutral.text[700])}>
                  Reading <span className={combineClasses(DesignTokens.components.alert.text.error)}>*</span>
                </label>
                <div className={combineClasses('grid grid-cols-2', DesignTokens.spacing.gap.sm)}>
                  <input
                    type="number"
                    placeholder="Systolic"
                    value={newVitalValue.systolic || ''}
                    onChange={(e) => setNewVitalValue({ ...newVitalValue, systolic: e.target.value })}
                    className={combineClasses(DesignTokens.components.input.base, DesignTokens.borders.radius.sm, 'focus:ring-2 focus:ring-medical-primary-500')}
                  />
                  <input
                    type="number"
                    placeholder="Diastolic"
                    value={newVitalValue.diastolic || ''}
                    onChange={(e) => setNewVitalValue({ ...newVitalValue, diastolic: e.target.value })}
                    className={combineClasses(DesignTokens.components.input.base, DesignTokens.borders.radius.sm, 'focus:ring-2 focus:ring-medical-primary-500')}
                  />
                </div>
                {selectedVitalForValue.unit && (
                  <p className={combineClasses(DesignTokens.typography.body.xs, 'mt-1', DesignTokens.colors.neutral.text[500])}>Unit: {selectedVitalForValue.unit}</p>
                )}
              </div>
            ) : (
              <div>
                <label className={combineClasses('block', DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, 'mb-2', DesignTokens.colors.neutral.text[700])}>
                  Value <span className={combineClasses(DesignTokens.components.alert.text.error)}>*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  value={newVitalValue.value}
                  onChange={(e) => setNewVitalValue({ ...newVitalValue, value: e.target.value })}
                  placeholder={`Enter ${selectedVitalForValue.name} value`}
                  className={combineClasses(DesignTokens.components.input.base, DesignTokens.borders.radius.sm, 'focus:ring-2 focus:ring-medical-primary-500')}
                />
                {selectedVitalForValue.unit && (
                  <p className={combineClasses(DesignTokens.typography.body.xs, 'mt-1', DesignTokens.colors.neutral.text[500])}>Unit: {selectedVitalForValue.unit}</p>
                )}
              </div>
            )}

            <div>
              <label className={combineClasses('block', DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, 'mb-2', DesignTokens.colors.neutral.text[700])}>
                {isAllDay ? 'Date' : 'Date & Time'} <span className={combineClasses(DesignTokens.components.alert.text.error)}>*</span>
              </label>
              
              <div className="mb-3">
                <label className={combineClasses('flex items-center cursor-pointer', DesignTokens.spacing.gap.sm)}>
                  <input
                    type="checkbox"
                    checked={isAllDay}
                    onChange={(e) => {
                      setIsAllDay(e.target.checked);
                      if (e.target.checked) {
                        // When checking all day, set dateOnly from current dateTime or today
                        const currentDate = newVitalValue.dateTime 
                          ? newVitalValue.dateTime.split('T')[0]
                          : getTodayLocalDate();
                        setDateOnly(currentDate);
                      }
                    }}
                    className={combineClasses('w-4 h-4', DesignTokens.borders.radius.sm, 'focus:ring-blue-500', DesignTokens.colors.primary[600].replace('bg-', 'text-'), DesignTokens.colors.neutral.border[300])}
                  />
                  <span className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.colors.neutral.text[700])}>All Day</span>
                </label>
              </div>
              
              {isAllDay ? (
                <DatePicker
                  value={dateOnly}
                  onChange={(e) => setDateOnly(e.target.value)}
                  max={getTodayLocalDate()}
                  placeholder="YYYY-MM-DD"
                />
              ) : (
                <DateTimePicker
                  value={newVitalValue.dateTime || new Date().toISOString().slice(0, 16)}
                  onChange={(e) => setNewVitalValue({ ...newVitalValue, dateTime: e.target.value })}
                  max={new Date().toISOString().slice(0, 16)}
                  placeholder="Select date and time"
                />
              )}
            </div>

            <div>
              <label className={combineClasses('block', DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, 'mb-2', DesignTokens.colors.neutral.text[700])}>
                Notes <span className={combineClasses(DesignTokens.typography.body.xs, DesignTokens.colors.neutral.text[500])}>(optional)</span>
              </label>
              <textarea
                rows={3}
                value={newVitalValue.notes}
                onChange={(e) => setNewVitalValue({ ...newVitalValue, notes: e.target.value })}
                placeholder="Add any context about this reading..."
                className={combineClasses(DesignTokens.components.input.base, DesignTokens.components.input.textarea, DesignTokens.borders.radius.sm, 'focus:ring-2 focus:ring-medical-primary-500')}
              />
            </div>
          </div>
        </div>

        <div className={combineClasses('flex-shrink-0 border-t', DesignTokens.components.modal.footer, DesignTokens.colors.neutral.border[200])}>
          <div className={combineClasses('flex', DesignTokens.spacing.gap.md)}>
            <button
              onClick={handleCancel}
              className={combineClasses('flex-1 py-2.5', DesignTokens.borders.radius.sm, DesignTokens.typography.h3.weight, DesignTokens.transitions.default, 'flex items-center justify-center', DesignTokens.spacing.gap.sm, DesignTokens.colors.neutral[200], DesignTokens.colors.neutral.text[700], DesignTokens.colors.neutral[300].replace('bg-', 'hover:bg-'))}
            >
              <X className={DesignTokens.icons.standard.size.full} />
              Cancel
            </button>
            <button
              onClick={handleSave}
              className={combineClasses('flex-1 text-white py-2.5', DesignTokens.borders.radius.sm, DesignTokens.typography.h3.weight, DesignTokens.transitions.default, 'flex items-center justify-center', DesignTokens.spacing.gap.sm, DesignTokens.colors.primary[600], DesignTokens.colors.primary[700].replace('bg-', 'hover:bg-'))}
            >
              <Heart className={DesignTokens.icons.standard.size.full} />
              {isEditingVitalValue ? 'Save' : 'Add Value'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

