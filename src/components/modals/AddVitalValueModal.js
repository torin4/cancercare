import React, { useEffect } from 'react';
import { X, Heart } from 'lucide-react';
import { vitalService } from '../../firebase/services';
import { useBanner } from '../../contexts/BannerContext';
import DateTimePicker from '../DateTimePicker';

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
  useEffect(() => {
    if (show && selectedVitalForValue && isEditingVitalValue && editingVitalValueId && vitalsData) {
      // Find the specific vital value to pre-fill the form
      const vitalKey = selectedVitalForValue.key || selectedVitalForValue.vitalType;
      const currentVital = vitalsData[vitalKey];
      if (currentVital && currentVital.data) {
        const valueToEdit = currentVital.data.find(v => v.id === editingVitalValueId);
        if (valueToEdit) {
          // Extract date from various possible formats
          let dateTimeValue = new Date().toISOString().slice(0, 16);
          
          // Check for Firestore Timestamp (has toDate method)
          if (valueToEdit.date && typeof valueToEdit.date.toDate === 'function') {
            dateTimeValue = valueToEdit.date.toDate().toISOString().slice(0, 16);
          } 
          // Check for dateOriginal (Firestore Timestamp)
          else if (valueToEdit.dateOriginal && typeof valueToEdit.dateOriginal.toDate === 'function') {
            dateTimeValue = valueToEdit.dateOriginal.toDate().toISOString().slice(0, 16);
          }
          // Check for timestamp (number)
          else if (valueToEdit.timestamp) {
            dateTimeValue = new Date(valueToEdit.timestamp).toISOString().slice(0, 16);
          }
          // Check for date as Date object
          else if (valueToEdit.date instanceof Date) {
            dateTimeValue = valueToEdit.date.toISOString().slice(0, 16);
          }
          // Check for date as string (formatted or ISO)
          else if (valueToEdit.date) {
            const parsed = new Date(valueToEdit.date);
            if (!isNaN(parsed.getTime())) {
              dateTimeValue = parsed.toISOString().slice(0, 16);
            }
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

    if (!newVitalValue.dateTime) {
      showError('Please enter a date and time.');
      return;
    }

    try {
      const vitalDate = new Date(newVitalValue.dateTime);
      if (isNaN(vitalDate.getTime())) {
        showError('Please enter a valid date and time.');
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
      setSelectedVitalForValue(null);
      showSuccess(isEditingVitalValue ? 'Vital reading updated successfully!' : 'Vital reading added successfully!');
      onClose();
    } catch (error) {
      console.error('Error adding vital value:', error);
      showError('Failed to add vital reading. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-white w-full h-full md:h-auto md:rounded-2xl md:max-w-md md:max-h-[85vh] overflow-hidden flex flex-col animate-slide-up">
        <div className="flex-shrink-0 bg-white border-b p-4 flex items-center justify-between">
          <h3 className="font-bold text-lg text-gray-800">{isEditingVitalValue ? 'Edit Metric Value' : `Add ${selectedVitalForValue.name} Value`}</h3>
          <button
            onClick={handleCancel}
            className="text-gray-500 hover:text-gray-700"
            type="button"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="space-y-4">
            {isBloodPressure() ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reading <span className="text-red-600">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    placeholder="Systolic"
                    value={newVitalValue.systolic || ''}
                    onChange={(e) => setNewVitalValue({ ...newVitalValue, systolic: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    placeholder="Diastolic"
                    value={newVitalValue.diastolic || ''}
                    onChange={(e) => setNewVitalValue({ ...newVitalValue, diastolic: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {selectedVitalForValue.unit && (
                  <p className="text-xs text-gray-500 mt-1">Unit: {selectedVitalForValue.unit}</p>
                )}
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Value <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  value={newVitalValue.value}
                  onChange={(e) => setNewVitalValue({ ...newVitalValue, value: e.target.value })}
                  placeholder={`Enter ${selectedVitalForValue.name} value`}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {selectedVitalForValue.unit && (
                  <p className="text-xs text-gray-500 mt-1">Unit: {selectedVitalForValue.unit}</p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date & Time <span className="text-red-600">*</span>
              </label>
              <DateTimePicker
                value={newVitalValue.dateTime || new Date().toISOString().slice(0, 16)}
                onChange={(e) => setNewVitalValue({ ...newVitalValue, dateTime: e.target.value })}
                max={new Date().toISOString().slice(0, 16)}
                placeholder="Select date and time"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes <span className="text-gray-500 text-xs">(optional)</span>
              </label>
              <textarea
                rows={3}
                value={newVitalValue.notes}
                onChange={(e) => setNewVitalValue({ ...newVitalValue, notes: e.target.value })}
                placeholder="Add any context about this reading..."
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 bg-white border-t p-4">
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              className="flex-1 bg-gray-200 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-300 transition flex items-center justify-center gap-2"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition flex items-center justify-center gap-2"
            >
              <Heart className="w-4 h-4" />
              {isEditingVitalValue ? 'Save' : 'Add Value'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

