import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, ChevronRight, Search } from 'lucide-react';
import { DesignTokens, combineClasses } from '../design/designTokens';

// Map of common histologic subtypes / diagnoses by main cancer category
// Includes most common subtypes and an "Other (specify)" option for custom entries
const CANCER_SUBTYPES = {
  'Ovarian Cancer': ['High-grade serous', 'Low-grade serous', 'Clear Cell Carcinoma', 'Clear Cell Sarcoma', 'Endometrioid', 'Mucinous', 'Other (specify)'],
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
  const [step, setStep] = useState(0); // Start at step 0 for user role question
  const [formData, setFormData] = useState({
    // Step 0 - User Role
    isPatient: true, // true = patient, false = caregiver

    // Step 1 - Patient Information
    firstName: '',
    middleName: '',
    lastName: '',
    dateOfBirth: '',
    height: '',
    weight: '',
    country: '',
    gender: '',

    // Caregiver Information (shown if isPatient is false)
    caregiverName: '',
    caregiverPhone: '',
    caregiverEmail: '',

    // Step 2 - Diagnosis Information
    cancerType: '',
    diagnosis: '', // This will store either selected cancerType or a custom entry
    subtype: '', // Cancer subtype (e.g., "Clear Cell" for Ovarian Cancer)
    stage: '',
    diagnosisDate: '',
    treatmentLine: '',
    performanceStatus: '',
    diseaseStatus: '',
    baselineCa125: '',
  });

  // State for managing custom entries for 'Other (specify)'
  const [customDiagnosis, setCustomDiagnosis] = useState('');
  const [customSubtype, setCustomSubtype] = useState('');
  const [customTreatmentStatus, setCustomTreatmentStatus] = useState('');

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
  const TREATMENT_STATUS_OPTIONS = ['First-line', 'Second-line', 'Third-line', 'Fourth-line or later', 'Maintenance', 'Adjuvant', 'Neoadjuvant', 'Palliative', 'Other (specify)'];


  const handleNext = () => { 
    if (step === 0 && isStepValid()) setStep(1);
    else if (step === 1 && isStepValid()) setStep(2); 
  };
  const handleBack = () => { 
    if (step === 2) setStep(1);
    else if (step === 1) setStep(0);
  };

  const handleComplete = () => {
    if (!isStepValid()) return;
    const payload = { ...formData };
    // Combine name fields into single name field for backend
    const nameParts = [payload.firstName, payload.middleName, payload.lastName].filter(Boolean);
    payload.name = nameParts.join(' ');
    // Remove individual name fields from payload
    delete payload.firstName;
    delete payload.middleName;
    delete payload.lastName;
    if (!payload.diagnosis && payload.cancerType) payload.diagnosis = payload.cancerType;
    // Ensure subtype is saved (it's optional, so it might be empty)
    if (payload.subtype === 'Other (specify)') {
      payload.subtype = customSubtype || '';
    }
    // Ensure treatment status is saved
    if (payload.treatmentLine === 'Other (specify)') {
      payload.treatmentLine = customTreatmentStatus || '';
    }
    onComplete(payload);
  };

  const isStepValid = () => {
    if (step === 0) return formData.isPatient !== undefined && formData.isPatient !== null;
    if (step === 1) {
      const patientInfoValid = !!(formData.firstName && formData.lastName && formData.dateOfBirth && formData.height && formData.weight && formData.gender);
      // If caregiver mode, also require caregiver name
      if (!formData.isPatient) {
        return patientInfoValid && !!formData.caregiverName;
      }
      return patientInfoValid;
    }
    if (step === 2) return !!(formData.cancerType && formData.stage && formData.diagnosisDate && formData.treatmentLine && formData.performanceStatus && formData.diseaseStatus);
    return false;
  };

  const totalSteps = 3;
  const progressPercentage = (step / totalSteps) * 100;

  return (
    <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-fade-scale">
        {/* Progress Bar with Step Indicator */}
        <div className="px-8 pt-6 pb-4">
          <div className="flex items-center justify-between mb-2">
            <span className={combineClasses('text-sm font-medium', DesignTokens.colors.neutral.text[600])}>Step {step} of {totalSteps}</span>
            <span className={combineClasses('text-sm font-medium', DesignTokens.colors.neutral.text[600])}>{Math.round(progressPercentage)}%</span>
          </div>
          <div className={combineClasses('w-full h-2 rounded-full overflow-hidden', DesignTokens.colors.neutral[100])}>
            <div 
              className={combineClasses('h-full transition-all duration-500 ease-out rounded-full bg-gradient-to-r', 'from-medical-primary-500', 'to-medical-primary-600')}
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* Form Content */}
        <div className="p-8 overflow-y-auto flex-1">

          {/* Step 0: User Role */}
          {step === 0 && (
            <div className="space-y-6 animate-fade-scale">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-medical-primary-100 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-medical-primary-600" />
                </div>
                <div>
                  <h2 className={combineClasses('text-xl font-bold', DesignTokens.colors.neutral.text[900])}>Who is using this app?</h2>
                  <p className={combineClasses('text-sm', DesignTokens.colors.neutral.text[600])}>This helps us personalize your experience.</p>
                </div>
              </div>

              <div className="space-y-4">
                <button
                  onClick={() => updateField('isPatient', true)}
                  className={`w-full p-6 rounded-xl border-2 transition-all text-left ${
                    formData.isPatient === true
                      ? 'border-medical-primary-500 bg-medical-primary-50'
                      : combineClasses(DesignTokens.colors.neutral.border[200], 'bg-white', 'hover:border-medical-primary-200')
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      formData.isPatient === true
                        ? 'border-medical-primary-500 bg-medical-primary-500'
                        : DesignTokens.colors.neutral.border[300]
                    }`}>
                      {formData.isPatient === true && (
                        <div className="w-3 h-3 rounded-full bg-white" />
                      )}
                    </div>
                    <div>
                      <h3 className={combineClasses('font-semibold', DesignTokens.colors.neutral.text[900])}>I am the patient</h3>
                      <p className={combineClasses('text-sm mt-1', DesignTokens.colors.neutral.text[600])}>I'm managing my own cancer care</p>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => updateField('isPatient', false)}
                  className={`w-full p-6 rounded-xl border-2 transition-all text-left ${
                    formData.isPatient === false
                      ? 'border-medical-primary-500 bg-medical-primary-50'
                      : combineClasses(DesignTokens.colors.neutral.border[200], 'bg-white', 'hover:border-medical-primary-200')
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                      formData.isPatient === false
                        ? 'border-medical-primary-500 bg-medical-primary-500'
                        : DesignTokens.colors.neutral.border[300]
                    }`}>
                      {formData.isPatient === false && (
                        <div className="w-3 h-3 rounded-full bg-white" />
                      )}
                    </div>
                    <div>
                      <h3 className={combineClasses('font-semibold', DesignTokens.colors.neutral.text[900])}>I am a caregiver</h3>
                      <p className={combineClasses('text-sm mt-1', DesignTokens.colors.neutral.text[600])}>I'm helping manage someone else's cancer care</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Step 1: Patient Information */}
          {step === 1 && (
            <div className="space-y-6 animate-fade-scale">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-medical-primary-100 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-medical-primary-600" />
                </div>
                <div>
                  <h2 className={combineClasses('text-xl font-bold', DesignTokens.colors.neutral.text[900])}>Patient Information</h2>
                  <p className={combineClasses('text-sm', DesignTokens.colors.neutral.text[600])}>Required: name, date of birth, height, weight. Country optional.</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="firstName" className={combineClasses('block text-sm font-medium mb-1.5', DesignTokens.colors.neutral.text[700])}>First Name *</label>
                    <input 
                      id="firstName"
                      type="text" 
                      value={formData.firstName} 
                      onChange={(e) => updateField('firstName', e.target.value)} 
                      className={combineClasses(DesignTokens.components.input.base, 'bg-white')} 
                      placeholder="Enter first name"
                      aria-required="true"
                    />
                  </div>
                  <div>
                    <label htmlFor="middleName" className={combineClasses('block text-sm font-medium mb-1.5', DesignTokens.colors.neutral.text[700])}>Middle Name</label>
                    <input 
                      id="middleName"
                      type="text" 
                      value={formData.middleName} 
                      onChange={(e) => updateField('middleName', e.target.value)} 
                      className={combineClasses(DesignTokens.components.input.base, 'bg-white')} 
                      placeholder="Enter middle name (optional)"
                    />
                  </div>
                <div>
                    <label htmlFor="lastName" className={combineClasses('block text-sm font-medium mb-1.5', DesignTokens.colors.neutral.text[700])}>Last Name *</label>
                    <input 
                      id="lastName"
                      type="text" 
                      value={formData.lastName} 
                      onChange={(e) => updateField('lastName', e.target.value)} 
                      className={combineClasses(DesignTokens.components.input.base, 'bg-white')} 
                      placeholder="Enter last name"
                      aria-required="true"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="dateOfBirth" className={combineClasses('block text-sm font-medium mb-1.5', DesignTokens.colors.neutral.text[700])}>Date of Birth *</label>
                    <input 
                      id="dateOfBirth"
                      type="date" 
                      value={formData.dateOfBirth} 
                      onChange={(e) => updateField('dateOfBirth', e.target.value)} 
                      className={combineClasses(DesignTokens.components.input.base, 'bg-white')} 
                      aria-required="true"
                    />
                  </div>
                  <div>
                    <label htmlFor="country" className={combineClasses('block text-sm font-medium mb-1.5', DesignTokens.colors.neutral.text[700])}>Country</label>
                    <select 
                      id="country"
                      value={formData.country} 
                      onChange={(e) => updateField('country', e.target.value)} 
                      className={combineClasses(DesignTokens.components.input.base, 'bg-white')}
                    >
                      <option value="">Select country</option>
                      {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="height" className={combineClasses('block text-sm font-medium mb-1.5', DesignTokens.colors.neutral.text[700])}>Height (cm) *</label>
                    <input 
                      id="height"
                      type="number" 
                      value={formData.height} 
                      onChange={(e) => updateField('height', e.target.value)} 
                      className={combineClasses(DesignTokens.components.input.base, 'bg-white')} 
                      placeholder="e.g., 170"
                      aria-required="true"
                    />
                  </div>
                  <div>
                    <label htmlFor="weight" className={combineClasses('block text-sm font-medium mb-1.5', DesignTokens.colors.neutral.text[700])}>Weight (kg) *</label>
                    <input 
                      id="weight"
                      type="number" 
                      value={formData.weight} 
                      onChange={(e) => updateField('weight', e.target.value)} 
                      className={combineClasses(DesignTokens.components.input.base, 'bg-white')} 
                      placeholder="e.g., 70"
                      aria-required="true"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="gender" className={combineClasses('block text-sm font-medium mb-1.5', DesignTokens.colors.neutral.text[700])}>Gender *</label>
                  <select 
                    id="gender"
                    value={formData.gender} 
                    onChange={(e) => updateField('gender', e.target.value)} 
                    className={combineClasses(DesignTokens.components.input.base, 'bg-white')}
                  >
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>

                {/* Caregiver Information - Only show if user selected caregiver mode */}
                {!formData.isPatient && (
                  <div className="border-t pt-6 mt-6">
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Your Information</h3>
                      <p className="text-sm text-gray-600">Enter your contact information as the caregiver</p>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="caregiverName" className={combineClasses('block text-sm font-medium mb-1.5', DesignTokens.colors.neutral.text[700])}>Your Name *</label>
                        <input 
                          id="caregiverName"
                          type="text" 
                          value={formData.caregiverName} 
                          onChange={(e) => updateField('caregiverName', e.target.value)} 
                          className={combineClasses(DesignTokens.components.input.base, 'bg-white')} 
                          placeholder="Enter your name"
                          aria-required="true"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="caregiverPhone" className={combineClasses('block text-sm font-medium mb-1.5', DesignTokens.colors.neutral.text[700])}>Your Phone</label>
                          <input 
                            id="caregiverPhone"
                            type="tel" 
                            value={formData.caregiverPhone} 
                            onChange={(e) => updateField('caregiverPhone', e.target.value)} 
                            className={combineClasses(DesignTokens.components.input.base, 'bg-white')} 
                            placeholder="e.g., (555) 123-4567"
                          />
                        </div>
                        <div>
                          <label htmlFor="caregiverEmail" className={combineClasses('block text-sm font-medium mb-1.5', DesignTokens.colors.neutral.text[700])}>Your Email</label>
                          <input 
                            id="caregiverEmail"
                            type="email" 
                            value={formData.caregiverEmail} 
                            onChange={(e) => updateField('caregiverEmail', e.target.value)} 
                            className={combineClasses(DesignTokens.components.input.base, 'bg-white')} 
                            placeholder="e.g., your@email.com"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Diagnosis */}
          {step === 2 && (
            <div className="space-y-6 animate-fade-scale">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-medical-accent-100 rounded-full flex items-center justify-center">
                  <Search className="w-6 h-6 text-medical-accent-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Diagnosis</h2>
                  <p className="text-sm text-gray-600">All fields required except Baseline CA-125</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className={combineClasses('block text-sm font-medium mb-1', DesignTokens.colors.neutral.text[700])}>Cancer Type *</label>
                  <select value={formData.cancerType} onChange={(e) => { 
                    updateField('cancerType', e.target.value); 
                    updateField('diagnosis', e.target.value);
                    // Clear subtype when cancer type changes
                    updateField('subtype', '');
                    setCustomSubtype('');
                  }} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900">
                    <option value="">Select cancer type</option>
                    {CANCER_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {formData.cancerType === 'Other (Please Specify)' && (
                    <input
                      type="text"
                      value={customDiagnosis}
                      onChange={(e) => {
                        setCustomDiagnosis(e.target.value);
                        updateField('diagnosis', e.target.value);
                      }}
                      className="w-full mt-2 px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900"
                      placeholder="Specify cancer type"
                    />
                  )}
                </div>

                {/* Cancer Subtype Selection */}
                {formData.cancerType && (CANCER_SUBTYPES[formData.cancerType] || []).length > 0 && (
                  <div>
                    <label className={combineClasses('block text-sm font-medium mb-1', DesignTokens.colors.neutral.text[700])}>Cancer Subtype (optional)</label>
                    <select 
                      value={formData.subtype === 'Other (specify)' ? 'Other (specify)' : formData.subtype} 
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === 'Other (specify)') {
                          updateField('subtype', 'Other (specify)');
                        } else {
                          updateField('subtype', value);
                          setCustomSubtype('');
                        }
                      }} 
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900"
                    >
                      <option value="">Select subtype (optional)</option>
                      {CANCER_SUBTYPES[formData.cancerType].map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    {formData.subtype === 'Other (specify)' && (
                      <input
                        type="text"
                        value={customSubtype}
                        onChange={(e) => {
                          setCustomSubtype(e.target.value);
                          updateField('subtype', e.target.value);
                        }}
                        className="w-full mt-2 px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900"
                        placeholder="Specify subtype"
                      />
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={combineClasses('block text-sm font-medium mb-1', DesignTokens.colors.neutral.text[700])}>Stage *</label>
                    <select value={formData.stage} onChange={(e) => updateField('stage', e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900">
                      <option value="">Select stage</option>
                      {STAGE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={combineClasses('block text-sm font-medium mb-1', DesignTokens.colors.neutral.text[700])}>Date of Diagnosis *</label>
                    <input type="date" value={formData.diagnosisDate} onChange={(e) => updateField('diagnosisDate', e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900" />
                  </div>
                </div>

                <div>
                  <label className={combineClasses('block text-sm font-medium mb-1', DesignTokens.colors.neutral.text[700])}>Treatment Status *</label>
                  <select
                    value={formData.treatmentLine === 'Other (specify)' ? 'Other (specify)' : formData.treatmentLine}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === 'Other (specify)') {
                        updateField('treatmentLine', 'Other (specify)');
                      } else {
                        updateField('treatmentLine', value);
                        setCustomTreatmentStatus('');
                      }
                    }}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900"
                  >
                    <option value="">Select treatment status</option>
                    {TREATMENT_STATUS_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {formData.treatmentLine === 'Other (specify)' && (
                    <input
                      type="text"
                      value={customTreatmentStatus}
                      onChange={(e) => {
                        setCustomTreatmentStatus(e.target.value);
                        updateField('treatmentLine', e.target.value);
                      }}
                      className="w-full mt-2 px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900"
                      placeholder="Specify treatment status"
                    />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={combineClasses('block text-sm font-medium mb-1', DesignTokens.colors.neutral.text[700])}>ECOG Performance *</label>
                    <select value={formData.performanceStatus} onChange={(e) => updateField('performanceStatus', e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900">
                      <option value="">Select ECOG</option>
                      {PERFORMANCE_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={combineClasses('block text-sm font-medium mb-1', DesignTokens.colors.neutral.text[700])}>Disease Status *</label>
                    <select value={formData.diseaseStatus} onChange={(e) => updateField('diseaseStatus', e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900">
                      <option value="">Select status</option>
                      {DISEASE_STATUS_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className={combineClasses('block text-sm font-medium mb-1', DesignTokens.colors.neutral.text[700])}>Baseline CA-125 (optional)</label>
                  <input type="number" step="any" value={formData.baselineCa125} onChange={(e) => updateField('baselineCa125', e.target.value)} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white text-gray-900" />
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t">
            <button onClick={handleBack} disabled={step === 0} className="px-6 py-2.5 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed">Back</button>

            {step === 0 ? (
              <button onClick={handleNext} disabled={!isStepValid()} className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed">Next <ChevronRight className="w-4 h-4 inline-block ml-2" /></button>
            ) : step === 1 ? (
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
