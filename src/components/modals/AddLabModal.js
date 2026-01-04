import React, { useState } from 'react';
import { X, AlertCircle, Plus } from 'lucide-react';
import { DesignTokens, combineClasses } from '../../design/designTokens';
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
      showError('Failed to add lab metric. Please try again.');
    }
  };

  return (
    <div className={combineClasses('fixed inset-0 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-0 md:p-4', DesignTokens.components.modal.overlay)}>
      <div className={combineClasses('w-full h-full md:h-auto md:rounded-2xl md:max-w-md md:max-h-[85vh] overflow-hidden flex flex-col animate-slide-up', DesignTokens.components.modal.container)}>
        <div className={combineClasses('flex-shrink-0 border-b p-4 flex items-center justify-between', DesignTokens.components.modal.header)}>
          <h3 className={combineClasses('font-bold text-lg', DesignTokens.colors.neutral.text[800])}>Add Lab Metric to Track</h3>
          <button
            onClick={handleCancel}
            className={combineClasses('transition', DesignTokens.components.modal.closeButton)}
            type="button"
          >
            <X size={24} />
          </button>
        </div>

        <div className={combineClasses('flex-1 overflow-y-auto p-4 sm:p-6 space-y-4', DesignTokens.components.modal.body)}>
          <div className={combineClasses('rounded-lg p-3', DesignTokens.components.alert.info.bg, DesignTokens.components.alert.info.border)}>
            <div className="flex items-start gap-2">
              <AlertCircle className={combineClasses('w-5 h-5 mt-0.5 flex-shrink-0', DesignTokens.components.alert.info.icon)} />
              <div className="flex-1">
                <p className={combineClasses('text-sm font-medium', DesignTokens.components.alert.info.text)}>Custom Lab Tracking</p>
                <p className={combineClasses('text-xs mt-1', DesignTokens.components.alert.info.textSecondary)}>
                  Select a common marker or add your own custom lab metric. The AI will track trends and alert you to significant changes.
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className={combineClasses('block text-sm font-medium mb-2', DesignTokens.colors.neutral.text[700])}>
              Lab Metric to Track <span className={combineClasses('', DesignTokens.components.alert.text.error)}>*</span>
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
              className={combineClasses('w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2', DesignTokens.components.input.base, 'focus:ring-medical-primary-500')}
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
                      { name: 'CRP', range: '<0.3', unit: 'mg/dL' },
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
            <p className={combineClasses('text-xs mt-1', DesignTokens.colors.neutral.text[500])}>Common cancer-related lab metrics or enter your own</p>
          </div>

          {newLabData.label === '' && (
          <div className={combineClasses('rounded-lg p-4 space-y-3', DesignTokens.colors.neutral[50])}>
            <h4 className={combineClasses('font-semibold text-sm', DesignTokens.colors.neutral.text[800])}>Custom Lab Metric</h4>

            <div>
              <label className={combineClasses('block text-sm font-medium mb-1', DesignTokens.colors.neutral.text[700])}>Lab Name *</label>
              <input
                type="text"
                value={newLabData.label}
                onChange={(e) => setNewLabData({ ...newLabData, label: e.target.value })}
                placeholder="e.g., Vitamin D, Albumin, Magnesium"
                className={combineClasses('w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2', DesignTokens.components.input.base, 'focus:ring-medical-primary-500')}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={combineClasses('block text-sm font-medium mb-1', DesignTokens.colors.neutral.text[700])}>Normal Range *</label>
                <input
                  type="text"
                  value={newLabData.normalRange}
                  onChange={(e) => setNewLabData({ ...newLabData, normalRange: e.target.value })}
                  placeholder="e.g., <35, 4.5-11.0"
                  className={combineClasses('w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2', DesignTokens.components.input.base, 'focus:ring-medical-primary-500')}
                />
              </div>

              <div>
                <label className={combineClasses('block text-sm font-medium mb-1', DesignTokens.colors.neutral.text[700])}>Unit *</label>
                <input
                  type="text"
                  value={newLabData.unit}
                  onChange={(e) => setNewLabData({ ...newLabData, unit: e.target.value })}
                  placeholder="e.g., U/mL, mg/dL"
                  className={combineClasses('w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2', DesignTokens.components.input.base, 'focus:ring-medical-primary-500')}
                />
              </div>
            </div>
            </div>
          )}

            <div className={combineClasses('rounded-lg p-2', DesignTokens.components.alert.info.bg, DesignTokens.components.alert.info.border)}>
              <p className={combineClasses('text-xs', DesignTokens.components.alert.info.textSecondary)}>
                <span className="font-semibold">Tip:</span> You can add any lab metric from your medical records - the AI will learn what's normal for you over time.
              </p>
          </div>

          {/* Optional: Add Initial Value */}
          {newLabData.label && newLabData.normalRange && newLabData.unit && (
            <div className="border-t pt-4 mt-4">
              <h4 className={combineClasses('font-semibold text-sm mb-3', DesignTokens.colors.neutral.text[800])}>Add Initial Value (Optional)</h4>
              <p className={combineClasses('text-xs mb-3', DesignTokens.colors.neutral.text[600])}>You can add your first lab value now, or add it later from the Health tab.</p>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={combineClasses('block text-sm font-medium mb-1', DesignTokens.colors.neutral.text[700])}>Value</label>
                  <input
                    type="number"
                    step="any"
                    value={newLabData.initialValue}
                    onChange={(e) => setNewLabData({ ...newLabData, initialValue: e.target.value })}
                    placeholder="e.g., 42"
                    className={combineClasses('w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2', DesignTokens.components.input.base, 'focus:ring-medical-primary-500')}
                  />
                </div>

                <div>
                  <label className={combineClasses('block text-sm font-medium mb-1', DesignTokens.colors.neutral.text[700])}>Date</label>
                  <DatePicker
                    value={newLabData.initialDate}
                    onChange={(e) => setNewLabData({ ...newLabData, initialDate: e.target.value })}
                    max={getTodayLocalDate()}
                    placeholder="YYYY-MM-DD"
                  />
                </div>
              </div>
            </div>
          )}

          {newLabData.label && newLabData.normalRange && newLabData.unit && (
            <div className={combineClasses('rounded-lg p-3', DesignTokens.components.alert.success.bg, DesignTokens.components.alert.success.border)}>
              <p className={combineClasses('text-xs font-medium mb-1', DesignTokens.components.alert.success.text)}>Preview:</p>
              <p className={combineClasses('text-sm', DesignTokens.components.alert.success.textSecondary)}>
                <strong>{newLabData.label}</strong> • Normal: {newLabData.normalRange} {newLabData.unit}
                {newLabData.initialValue && (
                  <span> • Initial Value: {newLabData.initialValue} {newLabData.unit}</span>
                )}
              </p>
            </div>
          )}
        </div>

        <div className={combineClasses('flex-shrink-0 border-t p-4', DesignTokens.components.modal.footer)}>
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              className={combineClasses('flex-1 py-2.5 rounded-lg font-medium transition', DesignTokens.components.button.secondary)}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className={combineClasses('flex-1 text-white py-2.5 rounded-lg font-medium transition flex items-center justify-center gap-2 disabled:opacity-50', DesignTokens.components.button.primary)}
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

