import React, { useRef, useState } from 'react';
import { ChevronRight, Search, User } from 'lucide-react';

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
  'Thyroid Cancer': ['Papillary', 'Follicular', 'Medullary', 'Anaplastic', 'Other (specify)']
};

const CANCER_TYPES = [
  'Ovarian Cancer','Endometrial Cancer','Cervical Cancer','Uterine Cancer','Vaginal Cancer','Vulvar Cancer','Fallopian Tube Cancer',
  'Breast Cancer','Male Breast Cancer','Inflammatory Breast Cancer','Triple-Negative Breast Cancer',
  'Lung Cancer','Non-Small Cell Lung Cancer','Small Cell Lung Cancer','Mesothelioma',
  'Colorectal Cancer','Colon Cancer','Rectal Cancer','Stomach Cancer','Esophageal Cancer','Pancreatic Cancer','Liver Cancer','Gallbladder Cancer',
  'Bile Duct Cancer','Anal Cancer','Gastrointestinal Stromal Tumor (GIST)',
  'Leukemia','Acute Lymphoblastic Leukemia (ALL)','Acute Myeloid Leukemia (AML)','Chronic Lymphocytic Leukemia (CLL)','Chronic Myeloid Leukemia (CML)',
  'Lymphoma','Hodgkin Lymphoma','Non-Hodgkin Lymphoma','Multiple Myeloma','Myelodysplastic Syndrome',
  'Melanoma','Basal Cell Carcinoma','Squamous Cell Carcinoma','Merkel Cell Carcinoma',
  'Prostate Cancer','Bladder Cancer','Kidney Cancer','Renal Cell Carcinoma','Testicular Cancer','Penile Cancer',
  'Head and Neck Cancer','Thyroid Cancer','Oral Cancer','Throat Cancer','Laryngeal Cancer','Nasopharyngeal Cancer','Salivary Gland Cancer',
  'Brain Cancer','Glioblastoma','Astrocytoma','Meningioma','Neuroblastoma','Spinal Cord Tumor',
  'Bone Cancer','Osteosarcoma','Ewing Sarcoma','Soft Tissue Sarcoma','Rhabdomyosarcoma',
  'Adrenal Cancer','Pituitary Tumor','Parathyroid Cancer','Neuroendocrine Tumor','Carcinoid Tumor',
  'Wilms Tumor','Retinoblastoma',
  'Thymoma','Carcinoma of Unknown Primary','Other (Please Specify)'
].sort();

const STAGE_OPTIONS = ['Unknown', 'Stage I', 'Stage II', 'Stage III', 'Stage IV', 'Recurrent', 'Other (specify)'];
const PERFORMANCE_OPTIONS = ['Unknown', '0', '1', '2', '3', '4'];
const DISEASE_STATUS_OPTIONS = ['Stable', 'Progressive', 'Responding', 'Unknown'];

export default function Onboarding({ onComplete }) {
  const [step, setStep] = useState(1);
  const diagnosisRef = useRef(null);

  const [formData, setFormData] = useState({
  // Step 1 - Patient Information
  name: '',
  dateOfBirth: '',
  country: '',
  height: '',
  weight: '',

  // Step 2 - Diagnosis
  diagnosis: '',
  cancerType: '',
  subtype: '',
  stage: '',
  diagnosisDate: '',
  treatmentLine: '',
  performanceStatus: '',
  diseaseStatus: '',
  baselineCa125: ''
});

  function updateField(field, value) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  function getSubtypeOptions() {
    const key = formData.cancerType || formData.diagnosis || '';
    if (!key) return [];
    return CANCER_SUBTYPES[key] || ['Other (specify)'];
  }

  function isStepValid() {
    if (step === 1) {
      return Boolean(formData.name && formData.dateOfBirth && formData.height && formData.weight);
    }
    if (step === 2) {
      return Boolean(
        formData.cancerType &&
          formData.subtype &&
          formData.stage &&
          formData.diagnosisDate &&
          formData.treatmentLine &&
          formData.performanceStatus &&
          formData.diseaseStatus
      );
    }
    return false;
  }

  function handleNext() {
    if (step === 1 && isStepValid()) setStep(2);
  }

  function handleBack() {
    if (step === 2) setStep(1);
  }

  function handleComplete() {
    if (!isStepValid()) return;
    const payload = { ...formData };
    if (!payload.diagnosis && payload.cancerType) payload.diagnosis = payload.cancerType;
    onComplete(payload);
  }

  const subtypeOptions = getSubtypeOptions();

  return (
    <div className="p-8">
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
              <input
                type="text"
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth *</label>
                <input
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => updateField('dateOfBirth', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                <input
                  type="text"
                  value={formData.country}
                  onChange={(e) => updateField('country', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Height (cm) *</label>
                <input
                  type="number"
                  value={formData.height}
                  onChange={(e) => updateField('height', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg) *</label>
                <input
                  type="number"
                  value={formData.weight}
                  onChange={(e) => updateField('weight', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6 animate-fade-scale" ref={diagnosisRef}>
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
              <select
                value={formData.cancerType}
                onChange={(e) => {
                  updateField('cancerType', e.target.value);
                  updateField('diagnosis', e.target.value);
                }}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
              >
                <option value="">Select cancer type</option>
                {CANCER_TYPES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subtype *</label>
              <select
                value={formData.subtype}
                onChange={(e) => updateField('subtype', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
              >
                <option value="">Select subtype</option>
                {subtypeOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stage *</label>
                <select
                  value={formData.stage}
                  onChange={(e) => updateField('stage', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                >
                  <option value="">Select stage</option>
                  {STAGE_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date of Diagnosis *</label>
                <input
                  type="date"
                  value={formData.diagnosisDate}
                  onChange={(e) => updateField('diagnosisDate', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Treatment Status *</label>
              <input
                type="text"
                value={formData.treatmentLine}
                onChange={(e) => updateField('treatmentLine', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                placeholder="e.g., First-line, Maintenance"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ECOG Performance *</label>
                <select
                  value={formData.performanceStatus}
                  onChange={(e) => updateField('performanceStatus', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                >
                  <option value="">Select ECOG</option>
                  {PERFORMANCE_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Disease Status *</label>
                <select
                  value={formData.diseaseStatus}
                  onChange={(e) => updateField('diseaseStatus', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                >
                  <option value="">Select status</option>
                  {DISEASE_STATUS_OPTIONS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Baseline CA-125 (optional)</label>
              <input
                type="number"
                step="any"
                value={formData.baselineCa125}
                onChange={(e) => updateField('baselineCa125', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
              />
            </div>
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

        {step === 1 ? (
          <button
            onClick={handleNext}
            disabled={!isStepValid()}
            className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next <ChevronRight className="w-4 h-4 inline-block ml-2" />
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
  );
}