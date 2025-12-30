import React, { useState, useEffect, useRef } from 'react';
import { User, Calendar, MapPin, Activity, ChevronRight, Search } from 'lucide-react';

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
  const [diagnosisSearch, setDiagnosisSearch] = useState('');
  const [showDiagnosisDropdown, setShowDiagnosisDropdown] = useState(false);
  const [showCustomDiagnosisInput, setShowCustomDiagnosisInput] = useState(false);
  const [showCustomSubtypeInput, setShowCustomSubtypeInput] = useState(false);
  const [showCustomStageInput, setShowCustomStageInput] = useState(false);
  const diagnosisRef = useRef(null);
  const [formData, setFormData] = useState({
    // Full name
    name: '',
    // Personal Info
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: '',

    // Contact Info
    phone: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    country: 'United States',

    // Medical Info
    diagnosis: '',
    diagnosisDate: '',
    cancerType: '',
    stage: '',
    stageOther: '',
    oncologist: '',
    hospital: '',
    treatmentLine: '',
    currentRegimen: '',
    performanceStatus: '',
    diseaseStatus: '',
    baselineCa125: '',

    // Emergency Contact
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelationship: '',
    emergencyContactEmail: '',
    emergencyContactAddress: '',
    emergencyContactCity: '',
    emergencyContactState: '',
    emergencyContactZip: '',

    // Primary Care / Additional Contacts
    primaryCareName: '',
    primaryCarePhone: '',
    primaryCareClinic: ''
  });

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Helpers for country-specific address labels/placeholders
  const getStateLabel = (country) => {
    if (!country) return 'State/Region';
    const c = country.toLowerCase();
    if (c.includes('japan')) return 'Prefecture';
    if (c.includes('canada') || c.includes('australia')) return 'Province/State';
    if (c.includes('united kingdom') || c.includes('uk')) return 'County/Region';
    return 'State/Region';
  };

  const getStatePlaceholder = (country) => {
    if (!country) return '';
    const c = country.toLowerCase();
    if (c.includes('japan')) return 'Tokyo';
    if (c.includes('canada')) return 'BC';
    if (c.includes('united states') || c.includes('united states of america')) return 'WA';
    return '';
  };

  const getPostalLabel = (country) => {
    if (!country) return 'Postal Code';
    const c = country.toLowerCase();
    if (c.includes('united states')) return 'ZIP Code';
    return 'Postal Code';
  };

  const getPostalPlaceholder = (country) => {
    if (!country) return '';
    const c = country.toLowerCase();
    if (c.includes('japan')) return '100-0001';
    if (c.includes('united states')) return '98109';
    if (c.includes('canada')) return 'V6B 1A1';
    return '';
  };

  const handleNext = () => {
    if (step < 4) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleComplete = () => {
    onComplete(formData);
  };

  // Filter cancer types based on search
  const filteredCancerTypes = CANCER_TYPES.filter(cancer =>
    cancer.toLowerCase().includes(diagnosisSearch.toLowerCase())
  );

  // Handle diagnosis selection
  const handleDiagnosisSelect = (cancer) => {
    if (cancer === 'Other (Please Specify)') {
      setShowCustomDiagnosisInput(true);
      updateField('diagnosis', '');
      setDiagnosisSearch('');
    } else {
      updateField('diagnosis', cancer);
      setDiagnosisSearch(cancer);
      setShowCustomDiagnosisInput(false);
    }
    setShowDiagnosisDropdown(false);
  };

  // Get subtype options based on selected diagnosis (main cancer)
  const subtypeOptions = (() => {
    const key = formData.diagnosis || formData.cancerType || '';
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
        // accept either full name or first+last
        return (formData.name || (formData.firstName && formData.lastName)) && formData.dateOfBirth && formData.gender;
      case 2:
        return formData.phone && formData.city && formData.state;
      case 3:
        return formData.diagnosis && formData.diagnosisDate;
      case 4:
        return formData.emergencyContactName && formData.emergencyContactPhone;
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
            {[1, 2, 3, 4].map(i => (
              <div
                key={i}
                className={`flex-1 h-2 rounded-full transition-all ${
                  i <= step ? 'bg-white' : 'bg-blue-400'
                }`}
              />
            ))}
          </div>
          <p className="text-sm text-blue-100 mt-2">Step {step} of 4</p>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => updateField('firstName', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="John"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => updateField('lastName', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date of Birth *
                  </label>
                  <input
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => updateField('dateOfBirth', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Gender *
                  </label>
                  <select
                    value={formData.gender}
                    onChange={(e) => updateField('gender', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select...</option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="other">Other</option>
                    <option value="prefer-not-to-say">Prefer not to say</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Contact Information */}
          {step === 2 && (
            <div className="space-y-6 animate-fade-scale">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <MapPin className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Contact Information</h2>
                  <p className="text-sm text-gray-600">How can we reach you?</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="(555) 123-4567"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => updateField('address', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="123 Main St"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    City *
                  </label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => updateField('city', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Seattle"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    State *
                  </label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => updateField('state', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="WA"
                    maxLength={2}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ZIP Code
                </label>
                <input
                  type="text"
                  value={formData.zip}
                  onChange={(e) => updateField('zip', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="98109"
                  maxLength={5}
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
