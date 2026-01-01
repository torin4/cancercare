import React, { useState } from 'react';
import { X, AlertCircle, Heart } from 'lucide-react';
import { vitalService } from '../../firebase/services';

export default function AddVitalModal({ 
  show, 
  onClose, 
  user,
  patientProfile,
  isEditingVital,
  editingVitalValueId,
  newVital,
  setNewVital,
  setIsEditingVital,
  setEditingVitalValueId,
  allVitalsData,
  reloadHealthData,
  getWeightNormalRange
}) {
  if (!show) return null;

  const handleCancel = () => {
    setIsEditingVital(false);
    setEditingVitalValueId(null);
    setNewVital({ vitalType: '', value: '', systolic: '', diastolic: '', dateTime: new Date().toISOString().slice(0, 16), notes: '' });
    onClose();
  };

  const handleSave = async () => {
    if (!newVital.vitalType || !user) {
      alert('Please select a vital sign.');
      return;
    }

    if (newVital.vitalType === 'bp') {
      if (!newVital.systolic || !newVital.diastolic) {
        alert('Please enter both systolic and diastolic values for blood pressure.');
        return;
      }
    } else {
      if (!newVital.value) {
        alert('Please enter a reading.');
        return;
      }
    }

    try {
      const vitalDate = new Date(newVital.dateTime || new Date());
      if (isNaN(vitalDate.getTime())) {
        alert('Please enter a valid date and time.');
        return;
      }

      // Get vital label
      const vitalLabels = {
        bp: 'Blood Pressure',
        hr: 'Resting Heart Rate',
        temp: 'Temperature',
        weight: 'Weight',
        o2sat: 'Oxygen Saturation',
        rr: 'Respiratory Rate'
      };

      const vitalUnits = {
        bp: 'mmHg',
        hr: 'BPM',
        temp: '°F',
        weight: 'kg',
        o2sat: '%',
        rr: '/min'
      };

      // Calculate normal ranges based on patient demographics
      const getVitalNormalRange = (vitalType) => {
        const age = patientProfile?.age || (patientProfile?.dateOfBirth ? Math.floor((new Date() - new Date(patientProfile.dateOfBirth)) / (365.25 * 24 * 60 * 60 * 1000)) : null);
        
        switch (vitalType) {
          case 'bp':
            // Blood pressure: <140/90 for adults, may vary by age
            if (age && age < 18) {
              // Pediatric BP varies by age, height, and gender - simplified here
              return '<120/80';
            }
            return '<140/90';
          
          case 'hr':
            // Heart rate: varies by age
            if (age) {
              if (age < 1) return '100-160'; // Infants
              if (age < 3) return '90-150'; // Toddlers
              if (age < 10) return '70-120'; // Children
              if (age < 18) return '60-100'; // Adolescents
              // Adults: 60-100
            }
            return '60-100';
          
          case 'temp':
            // Temperature: generally consistent, but may vary slightly
            return '97.5-99.5';
          
          case 'weight':
            // Calculate weight normal range based on BMI (18.5-24.9) using height
            if (patientProfile?.height && getWeightNormalRange) {
              return getWeightNormalRange(patientProfile.height, patientProfile.gender);
            }
            return '';
          
          case 'o2sat':
            // Oxygen saturation: generally consistent, may be lower at altitude
            return '>95';
          
          case 'rr':
            // Respiratory rate: varies by age
            if (age) {
              if (age < 1) return '30-60'; // Infants
              if (age < 3) return '24-40'; // Toddlers
              if (age < 12) return '20-30'; // Children
              // Adults: 12-20
            }
            return '12-20';
          
          default:
            return '';
        }
      };

      let vitalId;

      if (isEditingVital && editingVitalValueId) {
        // When editing, get the vitalId from the current vital document
        const currentVitalDoc = allVitalsData?.[newVital.vitalType];
        if (currentVitalDoc && currentVitalDoc.id) {
          vitalId = currentVitalDoc.id;
        } else {
          // Fallback: try to get existing vital
          const existingVital = await vitalService.getVitalByType(user.uid, newVital.vitalType);
          if (existingVital) {
            vitalId = existingVital.id;
          } else {
            alert('Error: Could not find vital document to update.');
            return;
          }
        }
      } else {
        // When adding new value, check if vital already exists
        let existingVital = await vitalService.getVitalByType(user.uid, newVital.vitalType);
        if (existingVital) {
          vitalId = existingVital.id;
          // Update normal range if it's missing
          if (!existingVital.normalRange) {
            const calculatedNormalRange = getVitalNormalRange(newVital.vitalType);
            if (calculatedNormalRange) {
              await vitalService.saveVital({
                id: vitalId,
                normalRange: calculatedNormalRange
              });
            }
          }
        } else {
          // Create new vital
          vitalId = await vitalService.saveVital({
            patientId: user.uid,
            vitalType: newVital.vitalType,
            label: vitalLabels[newVital.vitalType],
            currentValue: newVital.vitalType === 'bp' ? `${newVital.systolic}/${newVital.diastolic}` : parseFloat(newVital.value),
            unit: vitalUnits[newVital.vitalType],
            normalRange: getVitalNormalRange(newVital.vitalType),
            createdAt: vitalDate
          });
        }
      }

      // Prepare value data
      const valueData = {
        date: vitalDate,
        notes: newVital.notes || ''
      };

      if (newVital.vitalType === 'bp') {
        valueData.systolic = parseFloat(newVital.systolic);
        valueData.diastolic = parseFloat(newVital.diastolic);
        valueData.value = `${newVital.systolic}/${newVital.diastolic}`;
      } else {
        valueData.value = parseFloat(newVital.value);
      }

      if (isEditingVital && editingVitalValueId) {
        // Update existing value
        await vitalService.updateVitalValue(vitalId, editingVitalValueId, valueData);
      } else {
        // Add new value
        await vitalService.addVitalValue(vitalId, valueData);
      }

      // Update current value
      const vital = await vitalService.getVital(vitalId);
      if (vital) {
        await vitalService.saveVital({
          id: vitalId,
          currentValue: newVital.vitalType === 'bp' ? `${newVital.systolic}/${newVital.diastolic}` : parseFloat(newVital.value)
        });
      }

      // Reload health data
      if (reloadHealthData) {
        await reloadHealthData();
      }

      setIsEditingVital(false);
      setEditingVitalValueId(null);
      setNewVital({ vitalType: '', value: '', systolic: '', diastolic: '', dateTime: new Date().toISOString().slice(0, 16), notes: '' });
      onClose();
    } catch (error) {
      console.error('Error adding vital:', error);
      alert('Failed to add vital reading. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-white w-full h-full md:h-auto md:rounded-2xl md:max-w-md md:max-h-[85vh] overflow-hidden flex flex-col animate-slide-up">
        <div className="flex-shrink-0 bg-white border-b p-4 flex items-center justify-between">
          <h3 className="font-bold text-lg text-gray-800">{isEditingVital ? 'Edit Vital Value' : 'Log Vital Reading'}</h3>
          <button
            onClick={handleCancel}
            className="text-gray-500 hover:text-gray-700"
            type="button"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900">Log Vital Reading</p>
                <p className="text-xs text-blue-700 mt-1">
                  All vitals are tracked automatically. Select which vital you measured and enter the reading.
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Vital Sign <span className="text-red-600">*</span>
            </label>
            <select 
              value={newVital.vitalType || ''}
              onChange={(e) => setNewVital({ ...newVital, vitalType: e.target.value, value: '', systolic: '', diastolic: '' })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={!!newVital.vitalType}
            >
              <option value="">Select vital sign...</option>
              <option value="bp">Blood Pressure</option>
              <option value="hr">Resting Heart Rate</option>
              <option value="temp">Temperature</option>
              <option value="weight">Weight</option>
              <option value="o2sat">Oxygen Saturation</option>
              <option value="rr">Respiratory Rate</option>
            </select>
          </div>

          {newVital.vitalType === 'bp' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reading <span className="text-red-600">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="Systolic"
                  value={newVital.systolic || ''}
                  onChange={(e) => setNewVital({ ...newVital, systolic: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="number"
                  placeholder="Diastolic"
                  value={newVital.diastolic || ''}
                  onChange={(e) => setNewVital({ ...newVital, diastolic: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">For blood pressure, enter both values</p>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reading <span className="text-red-600">*</span>
              </label>
              <input
                type="number"
                step="any"
                value={newVital.value || ''}
                onChange={(e) => setNewVital({ ...newVital, value: e.target.value })}
                placeholder="Enter reading"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date & Time</label>
            <input
              type="datetime-local"
              value={newVital.dateTime || new Date().toISOString().slice(0, 16)}
              onChange={(e) => setNewVital({ ...newVital, dateTime: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes <span className="text-gray-500 text-xs">(optional)</span>
            </label>
            <textarea
              rows="2"
              value={newVital.notes || ''}
              onChange={(e) => setNewVital({ ...newVital, notes: e.target.value })}
              placeholder="e.g., Taken after rest, morning reading"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            ></textarea>
          </div>
        </div>

        <div className="flex-shrink-0 border-t p-4 bg-white">
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
              {isEditingVital ? 'Save' : 'Log Reading'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

