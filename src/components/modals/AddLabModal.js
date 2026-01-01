import React, { useState } from 'react';
import { X, AlertCircle, Plus } from 'lucide-react';
import { labService } from '../../firebase/services';

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
  labKeyMap 
}) {
  const [newLabData, setNewLabData] = useState({
    label: '',
    normalRange: '',
    unit: ''
  });

  if (!show) return null;

  const handleCancel = () => {
    setNewLabData({ label: '', normalRange: '', unit: '' });
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

      // Save lab to Firestore
      await labService.saveLab({
        patientId: user.uid,
        labType: labType,
        label: newLabData.label,
        currentValue: null, // No initial value, just the metric
        unit: newLabData.unit,
        normalRange: newLabData.normalRange,
        status: 'unknown',
        createdAt: new Date()
      });

      // Reload health data to update UI
      if (reloadHealthData) {
        await reloadHealthData();
      }

      setNewLabData({ label: '', normalRange: '', unit: '' });
      onClose();
    } catch (error) {
      console.error('Error adding lab:', error);
      alert('Failed to add lab metric. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 md:p-4">
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
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  const selected = JSON.parse(e.target.value);
                  setNewLabData({
                    label: selected.name,
                    normalRange: selected.range,
                    unit: selected.unit
                  });
                }
              }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a lab metric to track</option>

              <optgroup label={`Disease-Specific Markers - ${categoryDescriptions['Disease-Specific Markers']}`}>
                <option value={JSON.stringify({ name: 'CA-125', range: '<35', unit: 'U/mL' })}>CA-125 (Ovarian) - &lt;35 U/mL</option>
                <option value={JSON.stringify({ name: 'CA 19-9', range: '<37', unit: 'U/mL' })}>CA 19-9 (Pancreatic) - &lt;37 U/mL</option>
                <option value={JSON.stringify({ name: 'CA 15-3', range: '<30', unit: 'U/mL' })}>CA 15-3 (Breast) - &lt;30 U/mL</option>
                <option value={JSON.stringify({ name: 'CEA', range: '<3', unit: 'ng/mL' })}>CEA (Colorectal) - &lt;3 ng/mL</option>
                <option value={JSON.stringify({ name: 'AFP', range: '<10', unit: 'ng/mL' })}>AFP (Liver) - &lt;10 ng/mL</option>
                <option value={JSON.stringify({ name: 'PSA', range: '<4', unit: 'ng/mL' })}>PSA (Prostate) - &lt;4 ng/mL</option>
                <option value={JSON.stringify({ name: 'HE4', range: '<70', unit: 'pmol/L' })}>HE4 (Ovarian) - &lt;70 pmol/L</option>
              </optgroup>

              <optgroup label={`Blood Counts - ${categoryDescriptions['Blood Counts']}`}>
                <option value={JSON.stringify({ name: 'WBC', range: '4.5-11.0', unit: 'K/μL' })}>WBC (White Blood Cells) - 4.5-11.0 K/μL</option>
                <option value={JSON.stringify({ name: 'RBC', range: '4.5-5.5', unit: 'M/μL' })}>RBC (Red Blood Cells) - 4.5-5.5 M/μL</option>
                <option value={JSON.stringify({ name: 'Hemoglobin', range: '12.0-16.0', unit: 'g/dL' })}>Hemoglobin - 12.0-16.0 g/dL</option>
                <option value={JSON.stringify({ name: 'Hematocrit', range: '36-48', unit: '%' })}>Hematocrit - 36-48%</option>
                <option value={JSON.stringify({ name: 'Platelets', range: '150-400', unit: 'K/μL' })}>Platelets - 150-400 K/μL</option>
                <option value={JSON.stringify({ name: 'ANC', range: '>1500', unit: '/μL' })}>ANC (Absolute Neutrophil Count) - &gt;1500 /μL</option>
                <option value={JSON.stringify({ name: 'Neutrophils', range: '40-70', unit: '%' })}>Neutrophils - 40-70%</option>
                <option value={JSON.stringify({ name: 'Lymphocytes', range: '20-40', unit: '%' })}>Lymphocytes - 20-40%</option>
              </optgroup>

              <optgroup label={`Kidney Function - ${categoryDescriptions['Kidney Function']}`}>
                <option value={JSON.stringify({ name: 'Creatinine', range: '0.6-1.2', unit: 'mg/dL' })}>Creatinine - 0.6-1.2 mg/dL</option>
                <option value={JSON.stringify({ name: 'eGFR', range: '>60', unit: 'mL/min' })}>eGFR - &gt;60 mL/min</option>
                <option value={JSON.stringify({ name: 'BUN', range: '7-20', unit: 'mg/dL' })}>BUN (Blood Urea Nitrogen) - 7-20 mg/dL</option>
              </optgroup>

              <optgroup label={`Liver Function - ${categoryDescriptions['Liver Function']}`}>
                <option value={JSON.stringify({ name: 'ALT', range: '7-56', unit: 'U/L' })}>ALT - 7-56 U/L</option>
                <option value={JSON.stringify({ name: 'AST', range: '10-40', unit: 'U/L' })}>AST - 10-40 U/L</option>
                <option value={JSON.stringify({ name: 'ALP', range: '44-147', unit: 'U/L' })}>ALP (Alkaline Phosphatase) - 44-147 U/L</option>
                <option value={JSON.stringify({ name: 'Bilirubin', range: '0.1-1.2', unit: 'mg/dL' })}>Bilirubin (Total) - 0.1-1.2 mg/dL</option>
                <option value={JSON.stringify({ name: 'Albumin', range: '3.5-5.5', unit: 'g/dL' })}>Albumin - 3.5-5.5 g/dL</option>
              </optgroup>

              <optgroup label={`Electrolytes - ${categoryDescriptions['Electrolytes']}`}>
                <option value={JSON.stringify({ name: 'Sodium', range: '136-145', unit: 'mmol/L' })}>Sodium - 136-145 mmol/L</option>
                <option value={JSON.stringify({ name: 'Potassium', range: '3.5-5.0', unit: 'mmol/L' })}>Potassium - 3.5-5.0 mmol/L</option>
                <option value={JSON.stringify({ name: 'Calcium', range: '8.5-10.5', unit: 'mg/dL' })}>Calcium - 8.5-10.5 mg/dL</option>
                <option value={JSON.stringify({ name: 'Magnesium', range: '1.7-2.2', unit: 'mg/dL' })}>Magnesium - 1.7-2.2 mg/dL</option>
                <option value={JSON.stringify({ name: 'Glucose', range: '70-100', unit: 'mg/dL' })}>Glucose (Fasting) - 70-100 mg/dL</option>
              </optgroup>

              <optgroup label={`Thyroid Function - ${categoryDescriptions['Thyroid Function']}`}>
                <option value={JSON.stringify({ name: 'TSH', range: '0.4-4.0', unit: 'mIU/L' })}>TSH (Thyroid) - 0.4-4.0 mIU/L</option>
              </optgroup>

              <optgroup label={`Cardiac Markers - ${categoryDescriptions['Cardiac Markers']}`}>
                <option value={JSON.stringify({ name: 'Troponin', range: '<0.04', unit: 'ng/mL' })}>Troponin - &lt;0.04 ng/mL</option>
                <option value={JSON.stringify({ name: 'BNP', range: '<100', unit: 'pg/mL' })}>BNP - &lt;100 pg/mL</option>
              </optgroup>

              <optgroup label={`Inflammation - ${categoryDescriptions['Inflammation']}`}>
                <option value={JSON.stringify({ name: 'CRP', range: '<3', unit: 'mg/L' })}>CRP (C-Reactive Protein) - &lt;3 mg/L</option>
                <option value={JSON.stringify({ name: 'ESR', range: '0-20', unit: 'mm/hr' })}>ESR (Erythrocyte Sedimentation Rate) - 0-20 mm/hr</option>
                <option value={JSON.stringify({ name: 'Ferritin', range: '15-200', unit: 'ng/mL' })}>Ferritin - 15-200 ng/mL</option>
              </optgroup>

              <optgroup label={`Coagulation - ${categoryDescriptions['Coagulation']}`}>
                <option value={JSON.stringify({ name: 'PT', range: '11-13', unit: 'seconds' })}>PT (Prothrombin Time) - 11-13 seconds</option>
                <option value={JSON.stringify({ name: 'INR', range: '0.9-1.1', unit: '' })}>INR - 0.9-1.1</option>
                <option value={JSON.stringify({ name: 'D-dimer', range: '<0.5', unit: 'mg/L' })}>D-dimer - &lt;0.5 mg/L</option>
              </optgroup>

              <optgroup label={`Custom Values - ${categoryDescriptions['Custom Values']}`}>
                <option disabled value="">(Add custom labs using the form below)</option>
              </optgroup>

              <optgroup label={`Others - ${categoryDescriptions['Others']}`}>
                <option value={JSON.stringify({ name: 'LDH', range: '140-280', unit: 'U/L' })}>LDH (Lactate Dehydrogenase) - 140-280 U/L</option>
                <option value={JSON.stringify({ name: 'Vitamin D', range: '30-100', unit: 'ng/mL' })}>Vitamin D - 30-100 ng/mL</option>
                <option value={JSON.stringify({ name: 'HbA1c', range: '<5.7', unit: '%' })}>HbA1c (Diabetes) - &lt;5.7%</option>
              </optgroup>
            </select>
            <p className="text-xs text-gray-500 mt-1">Common cancer-related lab metrics</p>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500 font-medium">Or add custom lab</span>
            </div>
          </div>

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

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
              <p className="text-xs text-blue-700">
                <span className="font-semibold">Tip:</span> You can add any lab metric from your medical records - the AI will learn what's normal for you over time.
              </p>
            </div>
          </div>

          {newLabData.label && newLabData.normalRange && newLabData.unit && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-xs font-medium text-green-900 mb-1">Preview:</p>
              <p className="text-sm text-green-800">
                <strong>{newLabData.label}</strong> • Normal: {newLabData.normalRange} {newLabData.unit}
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

