import React from 'react';
import { X, Check } from 'lucide-react';
import { patientService } from '../../firebase/services';
import { useBanner } from '../../contexts/BannerContext';
import DatePicker from '../DatePicker';

export default function EditPatientInfoModal({
  show,
  onClose,
  user,
  patientProfile,
  setPatientProfile,
  setMessages
}) {
  const { showSuccess, showError } = useBanner();
  if (!show) return null;

  const handleSave = async () => {
    try {
      // Construct name from first/middle/last
      const fullName = `${patientProfile.firstName || ''} ${patientProfile.middleName ? patientProfile.middleName + ' ' : ''}${patientProfile.lastName || ''}`.trim();
      const toSave = {
        firstName: patientProfile.firstName || '',
        middleName: patientProfile.middleName || '',
        lastName: patientProfile.lastName || '',
        name: fullName || patientProfile.name,
        age: parseInt(patientProfile.age) || null,
        dateOfBirth: patientProfile.dateOfBirth,
        gender: patientProfile.gender || '',
        weight: parseFloat(patientProfile.weight) || null,
        height: parseFloat(patientProfile.height) || null,
        country: patientProfile.country || ''
      };
      console.log('Saving Edit Patient Info:', toSave);
      await patientService.savePatient(user.uid, toSave);
      // verify saved
      const saved = await patientService.getPatient(user.uid);
      console.log('Saved patient profile after edit:', saved);
      // Ensure UI reflects saved values
      setPatientProfile(prev => ({
        ...prev,
        firstName: patientProfile.firstName || prev.firstName,
        middleName: patientProfile.middleName || prev.middleName,
        lastName: patientProfile.lastName || prev.lastName,
        name: fullName || patientProfile.name || prev.name,
        age: parseInt(patientProfile.age) || '',
        dateOfBirth: patientProfile.dateOfBirth,
        gender: patientProfile.gender || prev.gender,
        weight: patientProfile.weight,
        height: patientProfile.height,
        country: patientProfile.country || prev.country
      }));
      showSuccess('Patient information updated successfully!');
      onClose();
      if (setMessages) {
        setMessages(prev => [...prev, {
          type: 'ai',
          text: 'Patient information updated successfully!'
        }]);
      }
    } catch (error) {
      console.error('Error saving patient info:', error);
      showError('Failed to save patient information. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-white w-full h-full md:h-auto md:rounded-2xl md:max-w-md md:max-h-[85vh] overflow-hidden flex flex-col animate-slide-up">
        <div className="flex-shrink-0 bg-white border-b p-4 flex items-center justify-between">
          <h3 className="font-bold text-lg text-gray-800">Edit Patient Information</h3>
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                <input
                  type="text"
                  value={patientProfile.firstName || ''}
                  onChange={(e) => setPatientProfile({ ...patientProfile, firstName: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Middle Name</label>
                <input
                  type="text"
                  value={patientProfile.middleName || ''}
                  onChange={(e) => setPatientProfile({ ...patientProfile, middleName: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                <input
                  type="text"
                  value={patientProfile.lastName || ''}
                  onChange={(e) => setPatientProfile({ ...patientProfile, lastName: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Age *</label>
                <input
                  type="number"
                  value={patientProfile.age}
                  onChange={(e) => setPatientProfile({ ...patientProfile, age: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                <DatePicker
                  value={patientProfile.dateOfBirth}
                  onChange={(e) => setPatientProfile({ ...patientProfile, dateOfBirth: e.target.value })}
                  max={new Date().toISOString().split('T')[0]}
                  placeholder="YYYY-MM-DD"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
              <select
                value={patientProfile.gender || ''}
                onChange={(e) => setPatientProfile({ ...patientProfile, gender: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Height (cm)</label>
                <input
                  type="number"
                  value={patientProfile.height}
                  onChange={(e) => setPatientProfile({ ...patientProfile, height: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Weight (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={patientProfile.weight}
                  onChange={(e) => setPatientProfile({ ...patientProfile, weight: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
              <select
                value={patientProfile.country || 'United States'}
                onChange={(e) => setPatientProfile({ ...patientProfile, country: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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

