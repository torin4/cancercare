import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, ChevronRight, Search } from 'lucide-react';

// Map of common histologic subtypes / diagnoses by main cancer category
// Includes most common subtypes and an "Other (specify)" option for custom entries
const CANCER_SUBTYPES = {
  'Ovarian Cancer': ['High-grade serous', 'Low-grade serous', 'Clear cell', 'Endometrioid', 'Mucinous', 'Other (specify)'],
  'Breast Cancer': ['Invasive ductal (IDC)', 'Invasive lobular (ILC)', 'Triple-negative', 'HER2+', 'ER+/PR+', 'Other (specify)'],
  'Lung Cancer': ['Adenocarcinoma', 'Squamous cell carcinoma', 'Small cell lung cancer', 'Large cell carcinoma', 'Other (specify)'],
  'Colorectal Cancer': ['Adenocarcinoma', 'Mucinous adenocarcinoma', 'Signet ring cell carcinoma', 'Other (specify)'],
  'Endometrial Cancer': ['Endometrioid', 'Serous (Type II)', 'Clear cell', 'Carcinosarcoma', 'Other (specify)'],
  'Pancreatic Cancer': ['Pancreatic ductal adenocarcinoma', 'Pancreatic neuroendocrine tumor (PNET)', 'Other (specify)'],
  'Prostate Cancer': ['Adenocarcinoma', 'Neuroendocrine', 'Other (specify)'],
  'Bladder Cancer': ['Urothelial (transitional) carcinoma', 'Squamous cell carcinoma', 'Adenocarcinoma', 'Other (specify)'],
  'Kidney Cancer': ['Clear cell RCC', 'Papillary RCC', 'Chromophobe RCC', 'Other (specify)'],
  'Cervical Cancer': ['Squamous cell carcinoma', 'Adenocarcinoma', 'Adenosquamous', 'Other (specify)'],
  'Uterine Cancer': ['Endometrial (endometrioid)', 'Serous', 'Carcinosarcoma', 'Other (specify)'],
  'Brain Cancer': ['Glioblastoma', 'Astrocytoma', 'Oligodendroglioma', 'Other (specify)'],
  'Skin Cancer': ['Melanoma', 'Basal cell carcinoma', 'Squamous cell carcinoma', 'Other (specify)'],
  'Thyroid Cancer': ['Papillary', 'Follicular', 'Medullary', 'Anaplastic', 'Other (specify)'],
  // fallback - other cancers will show an "Other (specify)" option by default via code
};

// Comprehensive list of cancer types for dropdown
const COUNTRIES = [
  "United States", "Canada", "United Kingdom", "Australia", "Germany", "France", "India", "China", "Japan",
  "Brazil", "Mexico", "Italy", "Spain", "South Africa", "Nigeria", "Egypt", "Argentina", "Colombia",
  "Indonesia", "Pakistan", "Bangladesh", "Russia", "South Korea", "Vietnam", "Philippines", "Turkey",
  "Iran", "Thailand", "Myanmar", "Kenya", "Ukraine", "Poland", "Algeria", "Morocco", "Peru",
  "Venezuela", "Malaysia", "Uzbekistan", "Saudi Arabia", "Yemen", "Ghana", "Nepal", "Madagascar",
  "Cameroon", "Chile", "Netherlands", "Belgium", "Greece", "Portugal", "Sweden", "Switzerland",
  "Austria", "Israel", "United Arab Emirates", "Singapore", "Ireland", "New Zealand", "Denmark",
  "Finland", "Norway", "Cuba", "Dominican Republic", "Haiti", "Guatemala", "Ecuador", "Bolivia",
  "Paraguay", "Uruguay", "Honduras", "Nicaragua", "El Salvador", "Costa Rica", "Panama", "Jamaica",
  "Trinidad and Tobago", "Ethiopia", "Sudan", "Angola", "Mozambique", "Uganda", "Tanzania", "Democratic Republic of the Congo",
  "Afghanistan", "Iraq", "Syria", "Kazakhstan", "Sri Lanka", "Romania", "Hungary", "Czech Republic",
  "Bulgaria", "Serbia", "Croatia", "Bosnia and Herzegovina", "Albania", "North Macedonia", "Slovenia",
  "Estonia", "Latvia", "Lithuania", "Belarus", "Moldova", "Cyprus", "Malta", "Luxembourg", "Iceland",
  "Greenland", "Fiji", "Papua New Guinea", "Solomon Islands", "Vanuatu", "Samoa", "Tonga", "Kiribati",
  "Micronesia", "Marshall Islands", "Palau", "Nauru", "Tuvalu", "San Marino", "Monaco", "Liechtenstein",
  "Andorra", "Vatican City"
].sort();

const CANCER_TYPES = [
  // Gynecological Cancers
  'Ovarian Cancer',
  'Endometrial Cancer',
  'Cervical Cancer',
  'Uterine Cancer',
  'Vaginal Cancer',
  'Vulvar Cancer',
  'Fallopian Tube Cancer',

  // Breast Cancer
  'Breast Cancer',
  'Male Breast Cancer',
  'Inflammatory Breast Cancer',
  'Triple-Negative Breast Cancer',

  // Lung Cancer
  'Lung Cancer',
  'Non-Small Cell Lung Cancer',
  'Small Cell Lung Cancer',
  'Mesothelioma',

  // Gastrointestinal Cancers
  'Colorectal Cancer',
  'Colon Cancer',
  'Rectal Cancer',
  'Stomach Cancer',
  'Esophageal Cancer',
  'Pancreatic Cancer',
  'Liver Cancer',
  'Gallbladder Cancer',
  'Bile Duct Cancer',
  'Anal Cancer',
  'Gastrointestinal Stromal Tumor (GIST)',

  // Blood Cancers
  'Leukemia',
  'Acute Lymphoblastic Leukemia (ALL)',
  'Acute Myeloid Leukemia (AML)',
  'Chronic Lymphocytic Leukemia (CLL)',
  'Chronic Myeloid Leukemia (CML)',
  'Lymphoma',
  'Hodgkin Lymphoma',
  'Non-Hodgkin Lymphoma',
  'Multiple Myeloma',
  'Myelodysplastic Syndrome',

  // Skin Cancer
  'Melanoma',
  'Basal Cell Carcinoma',
  'Squamous Cell Carcinoma',
  'Merkel Cell Carcinoma',

  // Genitourinary Cancers
  'Prostate Cancer',
  'Bladder Cancer',
  'Kidney Cancer',
  'Renal Cell Carcinoma',
  'Testicular Cancer',
  'Penile Cancer',

  // Head and Neck Cancers
  'Head and Neck Cancer',
  'Thyroid Cancer',
  'Oral Cancer',
  'Throat Cancer',
  'Laryngeal Cancer',
  'Nasopharyngeal Cancer',
  'Salivary Gland Cancer',

  // Brain and Nervous System
  'Brain Cancer',
  'Glioblastoma',
  'Astrocytoma',
  'Meningioma',
  'Neuroblastoma',
  'Spinal Cord Tumor',

  // Bone and Soft Tissue
  'Bone Cancer',
  'Osteosarcoma',
  'Ewing Sarcoma',
  'Soft Tissue Sarcoma',
  'Rhabdomyosarcoma',

  // Endocrine Cancers
  'Adrenal Cancer',
  'Pituitary Tumor',
  'Parathyroid Cancer',
  'Neuroendocrine Tumor',
  'Carcinoid Tumor',

  // Pediatric Cancers
  'Wilms Tumor',
  'Retinoblastoma',

  // Other Cancers
  'Mesothelioma',
  'Thymoma',
  'Carcinoma of Unknown Primary',
  'Other (Please Specify)'
].sort();

export default function Onboarding({ onComplete }) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    // Step 1 - Patient Information
    name: '',
    dateOfBirth: '',
    height: '',
    weight: '',
    country: '',
    gender: '',

    // Step 2 - Diagnosis Information
    cancerType: '',
    diagnosis: '', // This will store either selected cancerType or a custom entry
    stage: '',
    diagnosisDate: '',
    treatmentLine: '',
    performanceStatus: '',
    diseaseStatus: '',
    baselineCa125: '',
  });

  // State for managing custom entries for 'Other (specify)'
  const [customDiagnosis, setCustomDiagnosis] = useState('');

  const diagnosisRef = useRef(null);

  // Handle field updates
  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Handle 'Other (specify)' for diagnosis
  useEffect(() => {
    if (formData.cancerType === 'Other (Please Specify)') {
      updateField('diagnosis', customDiagnosis);
    } else if (formData.cancerType && formData.cancerType !== customDiagnosis) {
      // If a specific cancer type is selected, clear custom diagnosis
      setCustomDiagnosis('');
      updateField('diagnosis', formData.cancerType);
    }
  }, [formData.cancerType, customDiagnosis]);

  // Options for form fields
  const STAGE_OPTIONS = ['Stage I', 'Stage II', 'Stage III', 'Stage IV', 'Not Applicable', 'Unknown'];
  const PERFORMANCE_OPTIONS = ['0 - Fully active', '1 - Restricted in physically strenuous activity', '2 - Ambulatory, capable of all self-care', '3 - Limited self-care, confined to bed or chair 50%', '4 - Completely disabled, confined to bed or chair 100%'];
  const DISEASE_STATUS_OPTIONS = ['Newly Diagnosed', 'In Remission', 'Stable Disease', 'Progressive Disease', 'Recurrent Disease', 'Unknown'];


  const handleNext = () => { if (step === 1 && isStepValid()) setStep(2); };
  const handleBack = () => { if (step === 2) setStep(1); };

  const handleComplete = () => {
    if (!isStepValid()) return;
    const payload = { ...formData };
    if (!payload.diagnosis && payload.cancerType) payload.diagnosis = payload.cancerType;
    onComplete(payload);
  };

  const isStepValid = () => {
    if (step === 1) return !!(formData.name && formData.dateOfBirth && formData.height && formData.weight && formData.gender);
    if (step === 2) return !!(formData.cancerType && formData.stage && formData.diagnosisDate && formData.treatmentLine && formData.performanceStatus && formData.diseaseStatus);
    return false;
  };

  const totalSteps = 2;
  const progressPercentage = (step / totalSteps) * 100;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-fade-scale">
        {/* Progress Bar with Step Indicator */}
        <div className="px-8 pt-6 pb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Step {step} of {totalSteps}</span>
            <span className="text-sm font-medium text-gray-600">{Math.round(progressPercentage)}%</span>
          </div>
          <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500 ease-out rounded-full"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* Form Content */}
        <div className="p-8 overflow-y-auto flex-1">

          {/* Step 1: Patient Information */}
          {step === 1 && (
            <div className="space-y-6 animate-fade-scale">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Patient Information</h2>
                  <p className="text-sm text-gray-600">Required: name, date of birth, height, weight. Country optional.</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                  <input type="text" value={formData.name} onChange={(e) => updateField('name', e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth *</label>
                    <input type="date" value={formData.dateOfBirth} onChange={(e) => updateField('dateOfBirth', e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                    <select value={formData.country} onChange={(e) => updateField('country', e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg">
                      <option value="">Select country</option>
                      {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Height (cm) *</label>
                    <input type="number" value={formData.height} onChange={(e) => updateField('height', e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg) *</label>
                    <input type="number" value={formData.weight} onChange={(e) => updateField('weight', e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender *</label>
                  <select value={formData.gender} onChange={(e) => updateField('gender', e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg">
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Diagnosis */}
          {step === 2 && (
            <div className="space-y-6 animate-fade-scale">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <Search className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Diagnosis</h2>
                  <p className="text-sm text-gray-600">All fields required except Baseline CA-125</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cancer Type *</label>
                  <select value={formData.cancerType} onChange={(e) => { updateField('cancerType', e.target.value); updateField('diagnosis', e.target.value); }} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg">
                    <option value="">Select cancer type</option>
                    {CANCER_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>


                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Stage *</label>
                    <select value={formData.stage} onChange={(e) => updateField('stage', e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg">
                      <option value="">Select stage</option>
                      {STAGE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date of Diagnosis *</label>
                    <input type="date" value={formData.diagnosisDate} onChange={(e) => updateField('diagnosisDate', e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Treatment Status *</label>
                  <input type="text" value={formData.treatmentLine} onChange={(e) => updateField('treatmentLine', e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg" placeholder="e.g., First-line, Maintenance" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ECOG Performance *</label>
                    <select value={formData.performanceStatus} onChange={(e) => updateField('performanceStatus', e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg">
                      <option value="">Select ECOG</option>
                      {PERFORMANCE_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Disease Status *</label>
                    <select value={formData.diseaseStatus} onChange={(e) => updateField('diseaseStatus', e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg">
                      <option value="">Select status</option>
                      {DISEASE_STATUS_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Baseline CA-125 (optional)</label>
                  <input type="number" step="any" value={formData.baselineCa125} onChange={(e) => updateField('baselineCa125', e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg" />
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t">
            <button onClick={handleBack} disabled={step === 1} className="px-6 py-2.5 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed">Back</button>

            {step === 1 ? (
              <button onClick={handleNext} disabled={!isStepValid()} className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed">Next <ChevronRight className="w-4 h-4 inline-block ml-2" /></button>
            ) : (
              <button onClick={handleComplete} disabled={!isStepValid()} className="px-6 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed">Complete Setup</button>
            )}
          </div>

          <p className="text-xs text-gray-500 text-center mt-4">* Required fields</p>
        </div>
      </div>
    </div>
  );
}
