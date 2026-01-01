import React from 'react';
import { X, AlertCircle, Check } from 'lucide-react';
import { patientService } from '../../firebase/services';

export default function EditMedicalTeamModal({ 
  show, 
  onClose, 
  patientProfile, 
  setPatientProfile, 
  user,
  setMessages 
}) {
  if (!show) return null;

  const handleSave = async () => {
    try {
      const toSave = {
        oncologist: patientProfile.oncologist || '',
        oncologistPhone: patientProfile.oncologistPhone || '',
        oncologistEmail: patientProfile.oncologistEmail || '',
        hospital: patientProfile.hospital || '',
        clinicalTrialCoordinator: patientProfile.clinicalTrialCoordinator || '',
        clinicalTrialCoordinatorPhone: patientProfile.clinicalTrialCoordinatorPhone || '',
        clinicalTrialCoordinatorEmail: patientProfile.clinicalTrialCoordinatorEmail || ''
      };
      console.log('Saving Medical Team:', toSave);
      await patientService.savePatient(user.uid, toSave);
      // Verify saved
      const saved = await patientService.getPatient(user.uid);
      console.log('Saved medical team:', saved);
      // Update local state
      setPatientProfile(prev => ({
        ...prev,
        oncologist: patientProfile.oncologist || prev.oncologist,
        oncologistPhone: patientProfile.oncologistPhone || prev.oncologistPhone,
        oncologistEmail: patientProfile.oncologistEmail || prev.oncologistEmail,
        hospital: patientProfile.hospital || prev.hospital,
        clinicalTrialCoordinator: patientProfile.clinicalTrialCoordinator || prev.clinicalTrialCoordinator,
        clinicalTrialCoordinatorPhone: patientProfile.clinicalTrialCoordinatorPhone || prev.clinicalTrialCoordinatorPhone,
        clinicalTrialCoordinatorEmail: patientProfile.clinicalTrialCoordinatorEmail || prev.clinicalTrialCoordinatorEmail
      }));
      onClose();
      setMessages(prev => [...prev, {
        type: 'ai',
        text: 'Medical team information updated successfully!'
      }]);
    } catch (error) {
      console.error('Error saving medical team:', error);
      alert('Failed to save medical team information. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-white w-full h-full md:h-auto md:rounded-2xl md:max-w-lg md:max-h-[85vh] overflow-hidden flex flex-col animate-slide-up">
        <div className="flex-shrink-0 bg-white border-b p-4 flex items-center justify-between">
          <h3 className="font-bold text-lg text-gray-800">Edit Medical Team</h3>
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

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900">Medical Team Information</p>
                <p className="text-xs text-blue-700 mt-0.5">
                  Keep your medical team information up to date for better care coordination
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Oncologist</label>
              <input
                type="text"
                value={patientProfile.oncologist || ''}
                onChange={(e) => setPatientProfile({ ...patientProfile, oncologist: e.target.value })}
                placeholder="e.g., Dr. Jane Smith"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Oncologist Phone</label>
                <input
                  type="tel"
                  value={patientProfile.oncologistPhone || ''}
                  onChange={(e) => setPatientProfile({ ...patientProfile, oncologistPhone: e.target.value })}
                  placeholder="e.g., (555) 123-4567"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Oncologist Email</label>
                <input
                  type="email"
                  value={patientProfile.oncologistEmail || ''}
                  onChange={(e) => setPatientProfile({ ...patientProfile, oncologistEmail: e.target.value })}
                  placeholder="e.g., doctor@hospital.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hospital/Clinic</label>
              <input
                type="text"
                value={patientProfile.hospital || ''}
                onChange={(e) => setPatientProfile({ ...patientProfile, hospital: e.target.value })}
                placeholder="e.g., Seattle Cancer Care Alliance"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-3">Clinical Trial Coordinator</label>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={patientProfile.clinicalTrialCoordinator || ''}
                  onChange={(e) => setPatientProfile({ ...patientProfile, clinicalTrialCoordinator: e.target.value })}
                  placeholder="e.g., Jane Smith, RN"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={patientProfile.clinicalTrialCoordinatorPhone || ''}
                    onChange={(e) => setPatientProfile({ ...patientProfile, clinicalTrialCoordinatorPhone: e.target.value })}
                    placeholder="e.g., (555) 123-4567"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={patientProfile.clinicalTrialCoordinatorEmail || ''}
                    onChange={(e) => setPatientProfile({ ...patientProfile, clinicalTrialCoordinatorEmail: e.target.value })}
                    placeholder="e.g., coordinator@trialcenter.com"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 bg-white border-t p-4">
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

