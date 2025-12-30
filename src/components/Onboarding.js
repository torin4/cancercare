import React, { useState, useEffect, useRef } from 'react';
import { User, Activity, ChevronRight, Search, Camera } from 'lucide-react';

// Map of common histologic subtypes / diagnoses by main cancer category
const CANCER_SUBTYPES = {
  'Ovarian Cancer': ['High-grade serous', 'Low-grade serous', 'Clear cell', 'Endometrioid', 'Mucinous', 'Other (specify)'],
  'Breast Cancer': ['Invasive ductal (IDC)', 'Invasive lobular (ILC)', 'Triple-negative', 'HER2+', 'ER+/PR+', 'Other (specify)'],
  'Lung Cancer': ['Adenocarcinoma', 'Squamous cell carcinoma', 'Small cell lung cancer', 'Large cell carcinoma', 'Other (specify)'],
  'Colorectal Cancer': ['Adenocarcinoma', 'Mucinous adenocarcinoma', 'Signet ring cell carcinoma', 'Other (specify)'],
  'Endometrial Cancer': ['Endometrioid', 'Serous (Type II)', 'Clear cell', 'Carcinosarcoma', 'Other (specify)'],
  'Pancreatic Cancer': ['Pancreatic ductal adenocarcinoma', 'Pancreatic neuroendocrine tumor (PNET)', 'Other (specify)']
};

const STAGE_OPTIONS = ['Unknown','Stage I','Stage II','Stage III','Stage IV','Recurrent','Other (specify)'];

export default function Onboarding({ onComplete }) {
  const CANCER_TYPES = [...Object.keys(CANCER_SUBTYPES), 'Other (Please Specify)'];
  const TOTAL_STEPS = 2;
  const [step, setStep] = useState(1);
  const [showCustomSubtypeInput, setShowCustomSubtypeInput] = useState(false);
  const [showCustomStageInput, setShowCustomStageInput] = useState(false);
  const [formData, setFormData] = useState({
    // Personal
    name: '',
    dateOfBirth: '',
    gender: '',
    country: 'United States',
    height: '',
    weight: '',
    // Diagnosis
    cancerType: '',
    cancerSubtype: '',
    stage: '',
    stageOther: '',
    diagnosisDate: '',
    treatmentLine: '',
    currentRegimen: '',
    performanceStatus: '',
    diseaseStatus: '',
    baselineCa125: ''
  });

  const updateField = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  const subtypeOptions = (() => {
    const key = formData.cancerType || '';
    if (!key) return [];
    return CANCER_SUBTYPES[key] || ['Other (specify)'];
  })();

  const isStepValid = () => {
    if (step === 1) return formData.name && formData.dateOfBirth && formData.height && formData.weight;
    // step 2 requires cancerType, cancerSubtype, stage
    return !!(formData.cancerType && formData.cancerSubtype && (formData.stage || formData.stageOther));
  };

  const handleNext = () => {
    if (!isStepValid()) { alert('Please fill required fields'); return; }
    if (step < TOTAL_STEPS) setStep(step + 1);
  };

  const handleBack = () => { if (step > 1) setStep(step - 1); };

  const handleComplete = () => {
    // assemble human-readable diagnosis for compatibility
    const stageValue = formData.stageOther || formData.stage || '';
    const diagnosis = `${formData.cancerType || ''}${formData.cancerSubtype ? ' - ' + formData.cancerSubtype : ''}${stageValue ? ', ' + stageValue : ''}`;
    onComplete({ ...formData, diagnosis });
  };

  // simple outside click handler placeholder if needed for search in future
  const diagnosisRef = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (diagnosisRef.current && !diagnosisRef.current.contains(e.target)) {} };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
          <h1 className="text-2xl font-bold mb-2">Welcome to CancerCare</h1>
          <p className="text-blue-100">Let's set up your health profile</p>
          <div className="mt-4 flex gap-2">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map(i => (
              <div key={i} className={`flex-1 h-2 rounded-full ${i <= step ? 'bg-white' : 'bg-blue-400'}`} />
            ))}
          </div>
          <p className="text-sm text-blue-100 mt-2">Step {step} of {TOTAL_STEPS}</p>
        </div>

        <div className="p-8">
          {step === 1 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Personal Information</h2>
                  <p className="text-sm text-gray-600">Tell us about yourself</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                <input type="text" value={formData.name} onChange={(e) => updateField('name', e.target.value)} className="w-full px-4 py-2.5 border rounded" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth *</label>
                  <input type="date" value={formData.dateOfBirth} onChange={(e) => updateField('dateOfBirth', e.target.value)} className="w-full px-4 py-2.5 border rounded" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                  <select value={formData.gender} onChange={(e) => updateField('gender', e.target.value)} className="w-full px-4 py-2.5 border rounded">
                    <option value="">Select...</option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Height (cm) *</label>
                  <input type="number" value={formData.height} onChange={(e) => updateField('height', e.target.value)} className="w-full px-4 py-2.5 border rounded" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg) *</label>
                  <input type="number" value={formData.weight} onChange={(e) => updateField('weight', e.target.value)} className="w-full px-4 py-2.5 border rounded" />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <Activity className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Diagnosis</h2>
                  <p className="text-sm text-gray-600">Select cancer type, subtype and stage</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cancer Type *</label>
                <select value={formData.cancerType} onChange={(e) => { updateField('cancerType', e.target.value); updateField('cancerSubtype',''); }} className="w-full px-4 py-2.5 border rounded">
                  <option value="">Select cancer type...</option>
                  {CANCER_TYPES.map(ct => <option key={ct} value={ct}>{ct}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subtype *</label>
                {subtypeOptions.length > 0 ? (
                  <select value={formData.cancerSubtype} onChange={(e) => updateField('cancerSubtype', e.target.value)} className="w-full px-4 py-2.5 border rounded">
                    <option value="">Select subtype...</option>
                    {subtypeOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                ) : (
                  <input type="text" value={formData.cancerSubtype} onChange={(e) => updateField('cancerSubtype', e.target.value)} className="w-full px-4 py-2.5 border rounded" placeholder="Specify subtype" />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stage *</label>
                <select value={formData.stage} onChange={(e) => updateField('stage', e.target.value)} className="w-full px-4 py-2.5 border rounded">
                  <option value="">Select stage...</option>
                  {STAGE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Diagnosis Date</label>
                  <input type="date" value={formData.diagnosisDate} onChange={(e) => updateField('diagnosisDate', e.target.value)} className="w-full px-4 py-2.5 border rounded" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Treatment Line</label>
                  <input type="text" value={formData.treatmentLine} onChange={(e) => updateField('treatmentLine', e.target.value)} className="w-full px-4 py-2.5 border rounded" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Regimen</label>
                <input type="text" value={formData.currentRegimen} onChange={(e) => updateField('currentRegimen', e.target.value)} className="w-full px-4 py-2.5 border rounded" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Performance Status (ECOG)</label>
                  <select value={formData.performanceStatus} onChange={(e) => updateField('performanceStatus', e.target.value)} className="w-full px-4 py-2.5 border rounded">
                    <option value="">Select...</option>
                    <option value="0">ECOG 0 - Fully active</option>
                    <option value="1">ECOG 1 - Restricted in strenuous activity</option>
                    <option value="2">ECOG 2 - Ambulatory, capable of self-care</option>
                    <option value="3">ECOG 3 - Limited self-care</option>
                    <option value="4">ECOG 4 - Completely disabled</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Disease Status</label>
                  <select value={formData.diseaseStatus} onChange={(e) => updateField('diseaseStatus', e.target.value)} className="w-full px-4 py-2.5 border rounded">
                    <option value="">Select...</option>
                    <option value="stable">Stable Disease</option>
                    <option value="responding">Responding to Treatment</option>
                    <option value="progression">Progression Detected</option>
                    <option value="remission">Complete Remission</option>
                    <option value="partial">Partial Response</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Baseline CA-125 (U/mL)</label>
                <input type="number" value={formData.baselineCa125} onChange={(e) => updateField('baselineCa125', e.target.value)} className="w-full px-4 py-2.5 border rounded" />
              </div>
            </div>
          )}

          <div className="flex justify-between mt-8 pt-6 border-t">
            <button onClick={handleBack} disabled={step === 1} className="px-6 py-2.5 text-gray-700">Back</button>
            {step < TOTAL_STEPS ? (
              <button onClick={handleNext} disabled={!isStepValid()} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg">Next <ChevronRight className="w-4 h-4 inline-block" /></button>
            ) : (
              <button onClick={handleComplete} disabled={!isStepValid()} className="px-6 py-2.5 bg-green-600 text-white rounded-lg">Complete Setup</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
          {/* Step 2: Diagnosis / Current Treatment Info */}
          {step === 2 && (
            <div className="space-y-6 animate-fade-scale">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <Activity className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Diagnosis & Treatment</h2>
                  <p className="text-sm text-gray-600">Provide your diagnosis and current treatment details</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cancer Type *</label>
                <select
                  value={formData.cancerType}
                  onChange={(e) => { updateField('cancerType', e.target.value); updateField('cancerSubtype', ''); }}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="">Select cancer type...</option>
                  {CANCER_TYPES.map(ct => <option key={ct} value={ct}>{ct}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subtype *</label>
                {subtypeOptions.length > 0 ? (
                  <select
                    value={formData.cancerSubtype}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === 'Other (specify)') {
                        setShowCustomSubtypeInput(true);
                        updateField('cancerSubtype', '');
                      } else {
                        setShowCustomSubtypeInput(false);
                        updateField('cancerSubtype', v);
                      }
                    }}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="">Select subtype...</option>
                    {subtypeOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={formData.cancerSubtype}
                    onChange={(e) => updateField('cancerSubtype', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Specify subtype"
                  />
                )}
                {showCustomSubtypeInput && (
                  <input
                    type="text"
                    value={formData.cancerSubtype}
                    onChange={(e) => updateField('cancerSubtype', e.target.value)}
                    className="w-full mt-2 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Specify subtype"
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stage *</label>
                <select
                  value={formData.stage}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === 'Other (specify)') {
                      setShowCustomStageInput(true);
                      updateField('stage', '');
                    } else {
                      setShowCustomStageInput(false);
                      updateField('stage', v);
                    }
                  }}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="">Select stage...</option>
                  {STAGE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {showCustomStageInput && (
                  <input
                    type="text"
                    value={formData.stageOther}
                    onChange={(e) => updateField('stageOther', e.target.value)}
                    className="w-full mt-2 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Specify stage (e.g., Stage IIIC)"
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Diagnosis Date</label>
                  <input
                    type="date"
                    value={formData.diagnosisDate}
                    onChange={(e) => updateField('diagnosisDate', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="yyyy/mm/dd"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Treatment Line</label>
                  <input
                    type="text"
                    value={formData.treatmentLine}
                    onChange={(e) => updateField('treatmentLine', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="e.g., 1st Line, 2nd Line, Maintenance"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Regimen</label>
                <input
                  type="text"
                  value={formData.currentRegimen}
                  onChange={(e) => updateField('currentRegimen', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="e.g., Carboplatin + Paclitaxel"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Performance Status (ECOG)</label>
                  <select
                    value={formData.performanceStatus}
                    onChange={(e) => updateField('performanceStatus', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="">Select...</option>
                    <option value="0">ECOG 0 - Fully active</option>
                    <option value="1">ECOG 1 - Restricted in strenuous activity</option>
                    <option value="2">ECOG 2 - Ambulatory, capable of self-care</option>
                    <option value="3">ECOG 3 - Limited self-care</option>
                    <option value="4">ECOG 4 - Completely disabled</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Disease Status</label>
                  <select
                    value={formData.diseaseStatus}
                    onChange={(e) => updateField('diseaseStatus', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="">Select...</option>
                    <option value="stable">Stable Disease</option>
                    <option value="responding">Responding to Treatment</option>
                    <option value="progression">Progression Detected</option>
                    <option value="remission">Complete Remission</option>
                    <option value="partial">Partial Response</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Baseline CA-125 (U/mL)</label>
                <input
                  type="number"
                  value={formData.baselineCa125}
                  onChange={(e) => updateField('baselineCa125', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Initial CA-125 value"
                />
              </div>
            </div>
          )}
  const subtypeOptions = (() => {
    const key = formData.cancerType || '';
    if (!key) return [];
    return CANCER_SUBTYPES[key] || ['Other (specify)'];
  })();
  const STAGE_OPTIONS = ['Unknown','Stage I','Stage II','Stage III','Stage IV','Recurrent','Other (specify)'];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (diagnosisRef.current && !diagnosisRef.current.contains(event.target)) {
        setShowDiagnosisDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isStepValid = () => {
    switch(step) {
      case 1:
        // name, dob, height, weight required; country optional
        return !!(formData.name && formData.dateOfBirth && formData.height && formData.weight);
      case 2:
        // Require structured diagnosis fields
        return !!(formData.cancerType && formData.cancerSubtype && (formData.stage || formData.stageOther));
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
          <h1 className="text-2xl font-bold mb-2">Welcome to CancerCare</h1>
          <p className="text-blue-100">Let's set up your health profile</p>

          {/* Progress Bar */}
          <div className="mt-4 flex gap-2">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map(i => (
              <div
                key={i}
                className={`flex-1 h-2 rounded-full transition-all ${
                  i <= step ? 'bg-white' : 'bg-blue-400'
                }`}
              />
            ))}
          </div>
          <p className="text-sm text-blue-100 mt-2">Step {step} of {TOTAL_STEPS}</p>
        </div>

        {/* Form Content */}
        <div className="p-8">

          {/* Step 1: Personal Information */}
          {step === 1 && (
            <div className="space-y-6 animate-fade-scale">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Personal Information</h2>
                  <p className="text-sm text-gray-600">Tell us about yourself</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="John Doe"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth *</label>
                  <input
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => updateField('dateOfBirth', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                  <select
                    value={formData.country}
                    onChange={(e) => updateField('country', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="United States">United States</option>
                    <option value="United Kingdom">United Kingdom</option>
                    <option value="Canada">Canada</option>
                    <option value="Australia">Australia</option>
                    <option value="Japan">Japan</option>
                    <option value="Germany">Germany</option>
                    <option value="France">France</option>
                    <option value="India">India</option>
                    <option value="China">China</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Height (cm) *</label>
                  <input
                    type="number"
                    value={formData.height}
                    onChange={(e) => updateField('height', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., 170"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg) *</label>
                  <input
                    type="number"
                    value={formData.weight}
                    onChange={(e) => updateField('weight', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., 70"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Diagnosis / Current Treatment Info */}
          {step === 2 && (
            <div className="space-y-6 animate-fade-scale">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <Activity className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Diagnosis & Treatment</h2>
                  <p className="text-sm text-gray-600">Provide your diagnosis and current treatment details</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cancer Type *</label>
                <select
                  value={formData.cancerType}
                  onChange={(e) => { updateField('cancerType', e.target.value); updateField('cancerSubtype', ''); }}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="">Select cancer type...</option>
                  {CANCER_TYPES.map(ct => <option key={ct} value={ct}>{ct}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subtype *</label>
                {subtypeOptions.length > 0 ? (
                  <select
                    value={formData.cancerSubtype}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === 'Other (specify)') {
                        setShowCustomSubtypeInput(true);
                        updateField('cancerSubtype', '');
                      } else {
                        setShowCustomSubtypeInput(false);
                        updateField('cancerSubtype', v);
                      }
                    }}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="">Select subtype...</option>
                    {subtypeOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={formData.cancerSubtype}
                    onChange={(e) => updateField('cancerSubtype', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Specify subtype"
                  />
                )}
                {showCustomSubtypeInput && (
                  <input
                    type="text"
                    value={formData.cancerSubtype}
                    onChange={(e) => updateField('cancerSubtype', e.target.value)}
                    className="w-full mt-2 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Specify subtype"
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Diagnosis Date</label>
                  <input
                    type="date"
                    value={formData.diagnosisDate}
                    onChange={(e) => updateField('diagnosisDate', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="yyyy/mm/dd"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Treatment Line</label>
                  <input
                    type="text"
                    value={formData.treatmentLine}
                    onChange={(e) => updateField('treatmentLine', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="e.g., 1st Line, 2nd Line, Maintenance"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Regimen</label>
                <input
                  type="text"
                  value={formData.currentRegimen}
                  onChange={(e) => updateField('currentRegimen', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="e.g., Carboplatin + Paclitaxel"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Performance Status (ECOG)</label>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Stage *</label>
                    <select
                      value={formData.stage}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === 'Other (specify)') {
                          setShowCustomStageInput(true);
                          updateField('stage', '');
                        } else {
                          setShowCustomStageInput(false);
                          updateField('stage', v);
                        }
                      }}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    >
                      <option value="">Select stage...</option>
                      {STAGE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    {showCustomStageInput && (
                      <input
                        type="text"
                        value={formData.stageOther}
                        onChange={(e) => updateField('stageOther', e.target.value)}
                        className="w-full mt-2 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder="Specify stage (e.g., Stage IIIC)"
                      />
                    )}
                  </div>
                  >
                    <option value="">Select...</option>
                    <option value="stable">Stable Disease</option>
                    <option value="responding">Responding to Treatment</option>
                    <option value="progression">Progression Detected</option>
                    <option value="remission">Complete Remission</option>
                    <option value="partial">Partial Response</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Baseline CA-125 (U/mL)</label>
                <input
                  type="number"
                  value={formData.baselineCa125}
                  onChange={(e) => updateField('baselineCa125', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Initial CA-125 value"
                />
              </div>
            </div>
          )}

          {/* Step 3: Medical Information */}
          {step === 3 && (
            <div className="space-y-6 animate-fade-scale">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <Activity className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Medical Information</h2>
                  <p className="text-sm text-gray-600">Help us understand your diagnosis</p>
                </div>
              </div>

              <div className="relative" ref={diagnosisRef}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Diagnosis *
                </label>

                {/* Searchable Dropdown */}
                <div className="relative">
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <Search className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={diagnosisSearch}
                      onChange={(e) => {
                        setDiagnosisSearch(e.target.value);
                        setShowDiagnosisDropdown(true);
                        setShowCustomDiagnosisInput(false);
                        updateField('diagnosis', '');
                      }}
                      onFocus={() => setShowDiagnosisDropdown(true)}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Search diagnosis..."
                      aria-label="Search diagnosis"
                    />
                  </div>

                  {showCustomDiagnosisInput && (
                    <div className="mt-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Custom Diagnosis *
                      </label>
                      <input
                        type="text"
                        value={formData.diagnosis}
                        onChange={(e) => updateField('diagnosis', e.target.value)}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder="Type your diagnosis"
                      />
                    </div>
                  )}

                  {showDiagnosisDropdown && !showCustomDiagnosisInput && (
                    <div className="absolute z-20 mt-2 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-auto">
                      {filteredCancerTypes.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-gray-500">No matches found.</div>
                      ) : (
                        filteredCancerTypes.map((cancer) => (
                          <button
                            type="button"
                            key={cancer}
                            onClick={() => handleDiagnosisSelect(cancer)}
                            className="w-full text-left px-4 py-2.5 hover:bg-green-50 focus:bg-green-50 focus:outline-none transition text-sm text-gray-700"
                          >
                            {cancer}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Selected Diagnosis Display */}
                {formData.diagnosis && (
                  <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                    <span className="text-sm text-green-700 font-medium">
                      Selected: {formData.diagnosis}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        updateField('diagnosis', '');
                        setDiagnosisSearch('');
                        setShowCustomDiagnosisInput(false);
                      }}
                      className="text-xs text-green-600 hover:text-green-700 underline"
                    >
                      Change
                    </button>
                  </div>
                )}

                <p className="text-xs text-gray-500 mt-1">
                  Search from our list or type your own diagnosis
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Diagnosis Date *
                  </label>
                  <input
                    type="date"
                    value={formData.diagnosisDate}
                    onChange={(e) => updateField('diagnosisDate', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cancer Subtype
                  </label>
                  {subtypeOptions.length > 0 ? (
                    <>
                      <select
                        value={formData.cancerType}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === 'Other (specify)') {
                            setShowCustomSubtypeInput(true);
                            updateField('cancerType', '');
                          } else {
                            setShowCustomSubtypeInput(false);
                            updateField('cancerType', v);
                          }
                        }}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      >
                        <option value="">Select subtype...</option>
                        {subtypeOptions.map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                      {showCustomSubtypeInput && (
                        <input
                          type="text"
                          value={formData.cancerType}
                          onChange={(e) => updateField('cancerType', e.target.value)}
                          className="w-full mt-2 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          placeholder="Specify subtype"
                        />
                      )}
                    </>
                  ) : (
                    <input
                      type="text"
                      value={formData.cancerType}
                      onChange={(e) => updateField('cancerType', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="e.g., Serous, Clear Cell"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stage</label>
                <div>
                  <select
                    value={formData.stage}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === 'Other (specify)') {
                        setShowCustomStageInput(true);
                        updateField('stage', '');
                      } else {
                        setShowCustomStageInput(false);
                        updateField('stage', v);
                      }
                    }}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    {STAGE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {showCustomStageInput && (
                    <input
                      type="text"
                      value={formData.stageOther}
                      onChange={(e) => updateField('stageOther', e.target.value)}
                      className="w-full mt-2 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Specify stage (e.g., Stage IIIC)"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Oncologist Name
                </label>
                <input
                  type="text"
                  value={formData.oncologist}
                  onChange={(e) => updateField('oncologist', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Dr. Jane Smith"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hospital/Clinic
                </label>
                <input
                  type="text"
                  value={formData.hospital}
                  onChange={(e) => updateField('hospital', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Seattle Cancer Care Alliance"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Treatment Line</label>
                <input
                  type="text"
                  value={formData.treatmentLine}
                  onChange={(e) => updateField('treatmentLine', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="e.g., 1st Line, 2nd Line (Platinum-resistant)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Regimen</label>
                <input
                  type="text"
                  value={formData.currentRegimen}
                  onChange={(e) => updateField('currentRegimen', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="e.g., Carboplatin + Paclitaxel"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Performance Status (ECOG)</label>
                  <select
                    value={formData.performanceStatus}
                    onChange={(e) => updateField('performanceStatus', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="">Select...</option>
                    <option value="0">ECOG 0 - Fully active</option>
                    <option value="1">ECOG 1 - Restricted in strenuous activity</option>
                    <option value="2">ECOG 2 - Ambulatory, capable of self-care</option>
                    <option value="3">ECOG 3 - Limited self-care</option>
                    <option value="4">ECOG 4 - Completely disabled</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Disease Status</label>
                  <select
                    value={formData.diseaseStatus}
                    onChange={(e) => updateField('diseaseStatus', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="">Select...</option>
                    <option value="stable">Stable Disease</option>
                    <option value="responding">Responding to Treatment</option>
                    <option value="progression">Progression Detected</option>
                    <option value="remission">Complete Remission</option>
                    <option value="partial">Partial Response</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Baseline CA-125 (U/mL)</label>
                <input
                  type="number"
                  value={formData.baselineCa125}
                  onChange={(e) => updateField('baselineCa125', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="e.g., 38"
                />
              </div>
            </div>
          )}

          {/* Step 4: Emergency Contact */}
          {step === 4 && (
            <div className="space-y-6 animate-fade-scale">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Emergency Contact</h2>
                  <p className="text-sm text-gray-600">Who should we contact in case of emergency?</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Name *
                </label>
                <input
                  type="text"
                  value={formData.emergencyContactName}
                  onChange={(e) => updateField('emergencyContactName', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Jane Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Phone *
                </label>
                <input
                  type="tel"
                  value={formData.emergencyContactPhone}
                  onChange={(e) => updateField('emergencyContactPhone', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="(555) 987-6543"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Relationship *
                </label>
                <select
                  value={formData.emergencyContactRelationship}
                  onChange={(e) => updateField('emergencyContactRelationship', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                >
                  <option value="">Select...</option>
                  <option value="spouse">Spouse</option>
                  <option value="partner">Partner</option>
                  <option value="parent">Parent</option>
                  <option value="child">Child</option>
                  <option value="sibling">Sibling</option>
                  <option value="friend">Friend</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Email
                </label>
                <input
                  type="email"
                  value={formData.emergencyContactEmail}
                  onChange={(e) => updateField('emergencyContactEmail', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="jane.doe@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Address
                </label>
                <input
                  type="text"
                  value={formData.emergencyContactAddress}
                  onChange={(e) => updateField('emergencyContactAddress', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="123 Elm St"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    value={formData.emergencyContactCity}
                    onChange={(e) => updateField('emergencyContactCity', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="Seattle"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                  <input
                    type="text"
                    value={formData.emergencyContactState}
                    onChange={(e) => updateField('emergencyContactState', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="WA"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ZIP</label>
                  <input
                    type="text"
                    value={formData.emergencyContactZip}
                    onChange={(e) => updateField('emergencyContactZip', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="98109"
                  />
                </div>
              </div>

              <hr className="my-4" />

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Primary Care / Clinic</h3>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Primary Care Doctor</label>
                <input
                  type="text"
                  value={formData.primaryCareName}
                  onChange={(e) => updateField('primaryCareName', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Dr. John Primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Primary Care Phone</label>
                <input
                  type="tel"
                  value={formData.primaryCarePhone}
                  onChange={(e) => updateField('primaryCarePhone', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="(555) 111-2222"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Primary Care Clinic / Hospital</label>
                <input
                  type="text"
                  value={formData.primaryCareClinic}
                  onChange={(e) => updateField('primaryCareClinic', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Seattle Primary Care Clinic"
                />
              </div>

              {/* Summary / Display of entered contacts */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Emergency Contact</h4>
                  <p className="text-sm text-gray-800"><strong>Name:</strong> {formData.emergencyContactName || '—'}</p>
                  <p className="text-sm text-gray-800"><strong>Phone:</strong> {formData.emergencyContactPhone || '—'}</p>
                  <p className="text-sm text-gray-800"><strong>Email:</strong> {formData.emergencyContactEmail || '—'}</p>
                  <p className="text-sm text-gray-800"><strong>Relationship:</strong> {formData.emergencyContactRelationship || '—'}</p>
                  <p className="text-sm text-gray-800"><strong>Address:</strong> {formData.emergencyContactAddress ? `${formData.emergencyContactAddress}, ${formData.emergencyContactCity || ''} ${formData.emergencyContactState || ''} ${formData.emergencyContactZip || ''}` : '—'}</p>
                </div>

                <div className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">Primary Care / Clinic</h4>
                  <p className="text-sm text-gray-800"><strong>Doctor:</strong> {formData.primaryCareName || '—'}</p>
                  <p className="text-sm text-gray-800"><strong>Phone:</strong> {formData.primaryCarePhone || '—'}</p>
                  <p className="text-sm text-gray-800"><strong>Clinic/Hospital:</strong> {formData.primaryCareClinic || formData.hospital || '—'}</p>
                </div>
              </div>
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900 font-medium mb-2">You're all set!</p>
                <p className="text-xs text-blue-700">
                  Click "Complete Setup" to finish your profile. You can update this information anytime from your profile settings.
                </p>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t">
            <button
              onClick={handleBack}
              disabled={step === 1}
              className="px-6 py-2.5 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Back
            </button>

            {step < 4 ? (
              <button
                onClick={handleNext}
                disabled={!isStepValid()}
                className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleComplete}
                disabled={!isStepValid()}
                className="px-6 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Complete Setup
              </button>
            )}
          </div>

          <p className="text-xs text-gray-500 text-center mt-4">
            * Required fields
          </p>
        </div>
      </div>
    </div>
  );
}
