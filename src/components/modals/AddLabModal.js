import React, { useState } from 'react';
import { X, AlertCircle, Plus } from 'lucide-react';
import { labService } from '../../firebase/services';
import { getTodayLocalDate } from '../../utils/helpers';
import { useBanner } from '../../contexts/BannerContext';
import DatePicker from '../DatePicker';

const categoryDescriptions = {
  'Disease-Specific Markers': 'Tumor markers and cancer-specific biomarkers used to monitor disease progression and treatment response',
  'Liver Function': 'Enzymes and proteins that assess liver health and detect liver damage or dysfunction',
  'Kidney Function': 'Markers that evaluate kidney health and filtration capacity',
  'Blood Counts': 'Complete blood count (CBC) components including white cells, red cells, and platelets',
  'Thyroid Function': 'Hormones and markers that assess thyroid gland function and metabolism',
  'Cardiac Markers': 'Biomarkers used to detect heart damage, heart failure, or cardiac events',
  'Inflammation': 'Markers that indicate inflammation, infection, or immune system activity',
  'Electrolytes': 'Essential minerals and salts that maintain fluid balance and cellular function',
  'Coagulation': 'Tests that evaluate blood clotting function and bleeding risk',
  'Custom Values': 'User-added lab values not in standard categories',
  'Others': 'Additional lab values that don\'t fit into other categories'
};

// Normalize lab name to canonical key
const normalizeLabName = (rawName, labKeyMap) => {
  if (!rawName) return null;
  
  // Clean the raw name
  let cleaned = rawName.toString().trim();
  
  // Convert to lowercase for matching
  cleaned = cleaned.toLowerCase();
  
  // Remove common separators
  cleaned = cleaned.replace(/[\s\-_\/\.]/g, '');
  
  // Normalize common variants
  cleaned = cleaned.replace(/ntprobnp/g, 'ntprobnp');
  cleaned = cleaned.replace(/ckmb/g, 'ckmb');
  cleaned = cleaned.replace(/ca199/g, 'ca199');
  cleaned = cleaned.replace(/ca125/g, 'ca125');
  cleaned = cleaned.replace(/freet3/g, 'ft3');
  cleaned = cleaned.replace(/freet4/g, 'ft4');
  
  // Look up in synonym map
  const canonicalKey = labKeyMap?.[cleaned];
  return canonicalKey || null;
};

export default function AddLabModal({
  show,
  onClose,
  user,
  reloadHealthData,
  labKeyMap,
  allLabsData
}) {
  const { showSuccess, showError } = useBanner();
  const [newLabData, setNewLabData] = useState({
    label: '',
    normalRange: '',
    unit: '',
    initialValue: '',
    initialDate: getTodayLocalDate()
  });

  if (!show) return null;

  const handleCancel = () => {
    setNewLabData({ label: '', normalRange: '', unit: '', initialValue: '', initialDate: getTodayLocalDate() });
    onClose();
  };

  const handleSave = async () => {
    if (!newLabData.label || !newLabData.normalRange || !newLabData.unit || !user) {
      return;
    }

    try {
      // Normalize lab name to get labType
      const normalizedName = normalizeLabName(newLabData.label, labKeyMap);
      const labType = normalizedName || newLabData.label.toLowerCase().replace(/[^a-z0-9]/g, '');

      // Parse initial value if provided
      const hasInitialValue = newLabData.initialValue && newLabData.initialValue.trim() !== '';
      const initialValueNum = hasInitialValue ? parseFloat(newLabData.initialValue) : null;
      const isValidValue = hasInitialValue && initialValueNum !== null && !isNaN(initialValueNum);

      // Save lab to Firestore
      const labId = await labService.saveLab({
        patientId: user.uid,
        labType: labType,
        label: newLabData.label,
        currentValue: isValidValue ? initialValueNum : null, // Set current value if provided and valid
        unit: newLabData.unit,
        normalRange: newLabData.normalRange,
        status: 'unknown',
        createdAt: new Date()
      });

      // If initial value is provided and valid, add it as a lab value
      if (isValidValue) {
        const valueDate = newLabData.initialDate ? new Date(newLabData.initialDate) : new Date();
        
        // Add the initial value to the lab's values subcollection
        await labService.addLabValue(labId, {
          value: initialValueNum,
          date: valueDate,
          notes: ''
        });
      }

      // Reload health data to update UI
      if (reloadHealthData) {
        await reloadHealthData();
      }

      setNewLabData({ label: '', normalRange: '', unit: '', initialValue: '', initialDate: getTodayLocalDate() });
      showSuccess('Lab metric added successfully!');
      onClose();
    } catch (error) {
      console.error('Error adding lab:', error);
      showError('Failed to add lab metric. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-white w-full h-full md:h-auto md:rounded-2xl md:max-w-md md:max-h-[85vh] overflow-hidden flex flex-col animate-slide-up">
        <div className="flex-shrink-0 bg-white border-b p-4 flex items-center justify-between">
          <h3 className="font-bold text-lg text-gray-800">Add Lab Metric to Track</h3>
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
                <p className="text-sm font-medium text-blue-900">Custom Lab Tracking</p>
                <p className="text-xs text-blue-700 mt-1">
                  Select a common marker or add your own custom lab metric. The AI will track trends and alert you to significant changes.
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Lab Metric to Track <span className="text-red-600">*</span>
            </label>
            <select
              value={newLabData.label ? JSON.stringify({ name: newLabData.label, range: newLabData.normalRange, unit: newLabData.unit }) : ''}
              onChange={(e) => {
                if (e.target.value === 'custom') {
                  setNewLabData({ label: '', normalRange: '', unit: '', initialValue: '', initialDate: getTodayLocalDate() });
                } else if (e.target.value) {
                  const selected = JSON.parse(e.target.value);
                  setNewLabData(prev => ({
                    ...prev,
                    label: selected.name,
                    normalRange: selected.range,
                    unit: selected.unit
                  }));
                } else {
                  setNewLabData({ label: '', normalRange: '', unit: '', initialValue: '', initialDate: getTodayLocalDate() });
                }
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a lab metric to track</option>

              {(() => {
                // Define lab options grouped by category
                const labCategories = [
                  {
                    label: 'Disease-Specific Markers',
                    options: [
                      { name: 'CA-125', range: '<35', unit: 'U/mL' },
                      { name: 'CA 19-9', range: '<37', unit: 'U/mL' },
                      { name: 'CA 15-3', range: '<30', unit: 'U/mL' },
                      { name: 'CEA', range: '<3', unit: 'ng/mL' },
                      { name: 'AFP', range: '<10', unit: 'ng/mL' },
                      { name: 'PSA', range: '<4', unit: 'ng/mL' },
                      { name: 'HE4', range: '<70', unit: 'pmol/L' }
                    ]
                  },
                  {
                    label: 'Blood Counts',
                    options: [
                      { name: 'WBC', range: '4.5-11.0', unit: 'K/μL' },
                      { name: 'RBC', range: '4.5-5.5', unit: 'M/μL' },
                      { name: 'Hemoglobin', range: '12.0-16.0', unit: 'g/dL' },
                      { name: 'Hematocrit', range: '36-48', unit: '%' },
                      { name: 'Platelets', range: '150-400', unit: 'K/μL' },
                      { name: 'ANC', range: '>1500', unit: '/μL' },
                      { name: 'Neutrophils', range: '40-70', unit: '%' },
                      { name: 'Lymphocytes', range: '20-40', unit: '%' }
                    ]
                  },
                  {
                    label: 'Kidney Function',
                    options: [
                      { name: 'Creatinine', range: '0.6-1.2', unit: 'mg/dL' },
                      { name: 'eGFR', range: '>60', unit: 'mL/min' },
                      { name: 'BUN', range: '7-20', unit: 'mg/dL' }
                    ]
                  },
                  {
                    label: 'Liver Function',
                    options: [
                      { name: 'ALT', range: '7-56', unit: 'U/L' },
                      { name: 'AST', range: '10-40', unit: 'U/L' },
                      { name: 'ALP', range: '44-147', unit: 'U/L' },
                      { name: 'Bilirubin', range: '0.1-1.2', unit: 'mg/dL' },
                      { name: 'Albumin', range: '3.5-5.5', unit: 'g/dL' }
                    ]
                  },
                  {
                    label: 'Electrolytes',
                    options: [
                      { name: 'Sodium', range: '136-145', unit: 'mmol/L' },
                      { name: 'Potassium', range: '3.5-5.0', unit: 'mmol/L' },
                      { name: 'Calcium', range: '8.5-10.5', unit: 'mg/dL' },
                      { name: 'Magnesium', range: '1.7-2.2', unit: 'mg/dL' },
                      { name: 'Glucose', range: '70-100', unit: 'mg/dL' }
                    ]
                  },
                  {
                    label: 'Thyroid Function',
                    options: [
                      { name: 'TSH', range: '0.4-4.0', unit: 'mIU/L' }
                    ]
                  },
                  {
                    label: 'Cardiac Markers',
                    options: [
                      { name: 'Troponin', range: '<0.04', unit: 'ng/mL' },
                      { name: 'BNP', range: '<100', unit: 'pg/mL' }
                    ]
                  },
                  {
                    label: 'Inflammation',
                    options: [
                      { name: 'CRP', range: '<3', unit: 'mg/L' },
                      { name: 'ESR', range: '0-20', unit: 'mm/hr' },
                      { name: 'Ferritin', range: '15-200', unit: 'ng/mL' }
                    ]
                  },
                  {
                    label: 'Coagulation',
                    options: [
                      { name: 'PT', range: '11-13', unit: 'seconds' },
                      { name: 'INR', range: '0.9-1.1', unit: '' },
                      { name: 'D-dimer', range: '<0.5', unit: 'mg/L' }
                    ]
                  },
                  {
                    label: 'Others',
                    options: [
                      { name: 'LDH', range: '140-280', unit: 'U/L' },
                      { name: 'Vitamin D', range: '30-100', unit: 'ng/mL' },
                      { name: 'HbA1c', range: '<5.7', unit: '%' }
                    ]
                  }
                ];

                // Helper function to check if a lab already exists
                const checkLabExists = (labName) => {
                  if (!allLabsData) return false;

                  // Normalize the lab name for comparison
                  const normalizedName = labName.toLowerCase().replace(/[^a-z0-9]/g, '');

                  // Check if any existing lab matches
                  return Object.keys(allLabsData).some(existingKey => {
                    const normalizedKey = existingKey.toLowerCase().replace(/[^a-z0-9]/g, '');
                    return normalizedKey === normalizedName;
                  });
                };

                return labCategories.map(category => (
                  <optgroup key={category.label} label={category.label}>
                    {category.options.map(lab => {
                      const exists = checkLabExists(lab.name);
                      return (
                        <option
                          key={lab.name}
                          value={JSON.stringify({ name: lab.name, range: lab.range, unit: lab.unit })}
                          disabled={exists}
                          style={exists ? { color: '#9ca3af', fontStyle: 'italic' } : {}}
                        >
                          {lab.name}{exists ? ' (Already added)' : ''}
                        </option>
                      );
                    })}
                  </optgroup>
                ));
              })()}

              <optgroup label="Custom">
                <option value="custom">Enter Custom Lab Metric</option>
              </optgroup>
            </select>
            <p className="text-xs text-gray-500 mt-1">Common cancer-related lab metrics or enter your own</p>
          </div>

          {newLabData.label === '' && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h4 className="font-semibold text-gray-800 text-sm">Custom Lab Metric</h4>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lab Name *</label>
                <input
                  type="text"
                  value={newLabData.label}
                  onChange={(e) => setNewLabData({ ...newLabData, label: e.target.value })}
                  placeholder="e.g., Vitamin D, Albumin, Magnesium"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Normal Range *</label>
                  <input
                    type="text"
                    value={newLabData.normalRange}
                    onChange={(e) => setNewLabData({ ...newLabData, normalRange: e.target.value })}
                    placeholder="e.g., <35, 4.5-11.0"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit *</label>
                  <input
                    type="text"
                    value={newLabData.unit}
                    onChange={(e) => setNewLabData({ ...newLabData, unit: e.target.value })}
                    placeholder="e.g., U/mL, mg/dL"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
            <p className="text-xs text-blue-700">
              <span className="font-semibold">Tip:</span> You can add any lab metric from your medical records - the AI will learn what's normal for you over time.
            </p>
          </div>

          {/* Optional: Add Initial Value */}
          {newLabData.label && newLabData.normalRange && newLabData.unit && (
            <div className="border-t pt-4 mt-4">
              <h4 className="font-semibold text-gray-800 text-sm mb-3">Add Initial Value (Optional)</h4>
              <p className="text-xs text-gray-600 mb-3">You can add your first lab value now, or add it later from the Health tab.</p>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Value</label>
                  <input
                    type="number"
                    step="any"
                    value={newLabData.initialValue}
                    onChange={(e) => setNewLabData({ ...newLabData, initialValue: e.target.value })}
                    placeholder="e.g., 42"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <DatePicker
                    value={newLabData.initialDate}
                    onChange={(e) => setNewLabData({ ...newLabData, initialDate: e.target.value })}
                    max={getTodayLocalDate()}
                    placeholder="Select date"
                  />
                </div>
              </div>
            </div>
          )}

          {newLabData.label && newLabData.normalRange && newLabData.unit && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-xs font-medium text-green-900 mb-1">Preview:</p>
              <p className="text-sm text-green-800">
                <strong>{newLabData.label}</strong> • Normal: {newLabData.normalRange} {newLabData.unit}
                {newLabData.initialValue && (
                  <span> • Initial Value: {newLabData.initialValue} {newLabData.unit}</span>
                )}
              </p>
            </div>
          )}
        </div>

        <div className="flex-shrink-0 border-t p-4 bg-white">
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              className="flex-1 bg-gray-200 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-300 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
              disabled={!newLabData.label || !newLabData.normalRange || !newLabData.unit}
            >
              <Plus className="w-4 h-4" />
              Add Lab Metric
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

