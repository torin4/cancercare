import React from 'react';
import { X, Check } from 'lucide-react';
import { patientService } from '../../firebase/services';
import { useBanner } from '../../contexts/BannerContext';
import { CANCER_TYPES, CANCER_SUBTYPES, STAGE_OPTIONS, TREATMENT_STATUS_OPTIONS, PERFORMANCE_OPTIONS, DISEASE_STATUS_OPTIONS } from '../../constants/cancerTypes';
import DatePicker from '../DatePicker';

export default function UpdateStatusModal({
  show,
  onClose,
  user,
  currentStatus,
  setCurrentStatus,
  updateStatusSubtypeCustom,
  setUpdateStatusSubtypeCustom,
  updateStatusTreatmentCustom,
  setUpdateStatusTreatmentCustom,
  setPatientProfile,
  setMessages
}) {
  const { showSuccess, showError } = useBanner();
  if (!show) return null;

  const handleSave = async () => {
    try {
      // Process subtype - if it's "Other (specify)", use the custom value
      const finalSubtype = currentStatus.subtype === 'Other (specify)' ? '' : (currentStatus.subtype || '');
      // Process treatment status - if it's "Other (specify)", use the custom value
      const finalTreatmentStatus = currentStatus.treatmentLine === 'Other (specify)' ? '' : (currentStatus.treatmentLine || '');
      
      // Prepare the complete currentStatus object with all fields
      const updatedCurrentStatus = {
        ...currentStatus,
        subtype: finalSubtype,
        stage: currentStatus.stage || '',
        treatmentLine: finalTreatmentStatus,
        diagnosis: currentStatus.diagnosis || '',
        diagnosisDate: currentStatus.diagnosisDate || '',
        currentRegimen: currentStatus.currentRegimen || '',
        performanceStatus: currentStatus.performanceStatus || '',
        diseaseStatus: currentStatus.diseaseStatus || '',
        baselineCa125: currentStatus.baselineCa125 || ''
      };
      
      // Save current status and top-level diagnosis to patient document
      await patientService.savePatient(user.uid, {
        currentStatus: updatedCurrentStatus,
        diagnosis: currentStatus.diagnosis || '',
        diagnosisDate: currentStatus.diagnosisDate || '',
        cancerType: finalSubtype || '', // Save subtype to cancerType field
        stage: currentStatus.stage || ''
      });
      
      // Update local UI state with complete currentStatus
      setCurrentStatus(updatedCurrentStatus);
      setPatientProfile(prev => ({ 
        ...prev, 
        currentStatus: updatedCurrentStatus,
        diagnosis: currentStatus.diagnosis || prev.diagnosis, 
        diagnosisDate: currentStatus.diagnosisDate || prev.diagnosisDate,
        cancerType: finalSubtype || prev.cancerType,
        stage: currentStatus.stage || prev.stage
      }));
      showSuccess('Current status updated successfully!');
      if (setMessages) {
        setMessages(prev => [...prev, { type: 'ai', text: 'Current status updated successfully!' }]);
      }
      onClose();
    } catch (err) {
      console.error('Failed to save current status', err);
      showError('Failed to save current status.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-white w-full h-full md:h-auto md:rounded-2xl md:max-w-md md:max-h-[85vh] overflow-hidden flex flex-col animate-slide-up">
        <div className="flex-shrink-0 bg-white border-b p-4 flex items-center justify-between">
          <h3 className="font-bold text-lg text-gray-800">Update Current Status</h3>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="text-gray-500 hover:text-gray-700"
            type="button"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            {/* Cancer Type - matching onboarding */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cancer Type *</label>
              <select
                value={currentStatus.diagnosis || ''}
                onChange={(e) => {
                  const newDiagnosis = e.target.value;
                  setCurrentStatus({
                    ...currentStatus,
                    diagnosis: newDiagnosis,
                    subtype: '' // Clear subtype when cancer type changes
                  });
                  setUpdateStatusSubtypeCustom(false);
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select cancer type</option>
                {CANCER_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Cancer Subtype - matching onboarding */}
            {currentStatus.diagnosis && (CANCER_SUBTYPES[currentStatus.diagnosis] || []).length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cancer Subtype (optional)</label>
                <select
                  value={currentStatus.subtype === 'Other (specify)' ? 'Other (specify)' : (currentStatus.subtype || '')}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === 'Other (specify)') {
                      setCurrentStatus({ ...currentStatus, subtype: 'Other (specify)' });
                      setUpdateStatusSubtypeCustom(true);
                    } else {
                      setCurrentStatus({ ...currentStatus, subtype: value });
                      setUpdateStatusSubtypeCustom(false);
                    }
                  }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select subtype (optional)</option>
                  {CANCER_SUBTYPES[currentStatus.diagnosis].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                {updateStatusSubtypeCustom && (
                  <input
                    type="text"
                    value={currentStatus.subtype === 'Other (specify)' ? '' : currentStatus.subtype}
                    onChange={(e) => setCurrentStatus({ ...currentStatus, subtype: e.target.value })}
                    className="w-full mt-2 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Specify subtype"
                  />
                )}
              </div>
            )}

            {/* Stage - matching onboarding */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Stage *</label>
              <select
                value={currentStatus.stage || ''}
                onChange={(e) => setCurrentStatus({...currentStatus, stage: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select stage</option>
                {STAGE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Diagnosis Date - matching onboarding */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date of Diagnosis *</label>
              <DatePicker
                value={currentStatus.diagnosisDate || ''}
                onChange={(e) => setCurrentStatus({...currentStatus, diagnosisDate: e.target.value})}
                max={new Date().toISOString().split('T')[0]}
                placeholder="Select diagnosis date"
              />
            </div>

            {/* Treatment Status - matching onboarding */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Treatment Status *</label>
              <select
                value={currentStatus.treatmentLine === 'Other (specify)' ? 'Other (specify)' : (currentStatus.treatmentLine || '')}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === 'Other (specify)') {
                    setCurrentStatus({ ...currentStatus, treatmentLine: 'Other (specify)' });
                    setUpdateStatusTreatmentCustom(true);
                  } else {
                    setCurrentStatus({ ...currentStatus, treatmentLine: value });
                    setUpdateStatusTreatmentCustom(false);
                  }
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select treatment status</option>
                {TREATMENT_STATUS_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              {updateStatusTreatmentCustom && (
                <input
                  type="text"
                  value={currentStatus.treatmentLine === 'Other (specify)' ? '' : currentStatus.treatmentLine}
                  onChange={(e) => setCurrentStatus({ ...currentStatus, treatmentLine: e.target.value })}
                  className="w-full mt-2 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Specify treatment status"
                />
              )}
            </div>

            {/* Current Regimen - keep this as it's useful */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Regimen</label>
              <input
                type="text"
                value={currentStatus.currentRegimen || ''}
                onChange={(e) => setCurrentStatus({...currentStatus, currentRegimen: e.target.value})}
                placeholder="e.g., Carboplatin + Paclitaxel"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Performance Status - matching onboarding */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ECOG Performance *</label>
              <select
                value={currentStatus.performanceStatus || ''}
                onChange={(e) => setCurrentStatus({...currentStatus, performanceStatus: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select ECOG</option>
                {PERFORMANCE_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            {/* Disease Status - matching onboarding */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Disease Status *</label>
              <select
                value={currentStatus.diseaseStatus || ''}
                onChange={(e) => setCurrentStatus({...currentStatus, diseaseStatus: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select status</option>
                {DISEASE_STATUS_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            {/* Baseline CA-125 - matching onboarding */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Baseline CA-125 (optional)</label>
              <input
                type="number"
                step="any"
                value={currentStatus.baselineCa125 || ''}
                onChange={(e) => setCurrentStatus({...currentStatus, baselineCa125: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 border-t p-4 bg-white">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 bg-gray-200 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-300 transition flex items-center justify-center gap-2"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

