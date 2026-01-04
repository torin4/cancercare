import React from 'react';
import { X, Check } from 'lucide-react';
import { DesignTokens, combineClasses } from '../../design/designTokens';
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
      await patientService.savePatient(user.uid, toSave);
      // verify saved
      const saved = await patientService.getPatient(user.uid);
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
      showError('Failed to save patient information. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-white w-full h-full md:h-auto md:rounded-2xl md:max-w-md md:max-h-[85vh] overflow-hidden flex flex-col animate-slide-up">
        <div className="flex-shrink-0 bg-white border-b p-4 flex items-center justify-between">
          <h3 className={combineClasses('font-bold text-lg', DesignTokens.colors.neutral.text[800])}>Edit Patient Information</h3>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className={combineClasses('transition', DesignTokens.colors.neutral.text[500], DesignTokens.colors.neutral.text[700].replace('text-', 'hover:text-'))}
            type="button"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={combineClasses('block text-sm font-medium mb-1', DesignTokens.colors.neutral.text[700])}>First Name *</label>
                <input
                  type="text"
                  value={patientProfile.firstName || ''}
                  onChange={(e) => setPatientProfile({ ...patientProfile, firstName: e.target.value })}
                  className={combineClasses('w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-medical-primary-500', DesignTokens.components.input.base)}
                />
              </div>
              <div>
                <label className={combineClasses('block text-sm font-medium mb-1', DesignTokens.colors.neutral.text[700])}>Middle Name</label>
                <input
                  type="text"
                  value={patientProfile.middleName || ''}
                  onChange={(e) => setPatientProfile({ ...patientProfile, middleName: e.target.value })}
                  className={combineClasses('w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-medical-primary-500', DesignTokens.components.input.base)}
                />
              </div>
              <div>
                <label className={combineClasses('block text-sm font-medium mb-1', DesignTokens.colors.neutral.text[700])}>Last Name *</label>
                <input
                  type="text"
                  value={patientProfile.lastName || ''}
                  onChange={(e) => setPatientProfile({ ...patientProfile, lastName: e.target.value })}
                  className={combineClasses('w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-medical-primary-500', DesignTokens.components.input.base)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={combineClasses('block text-sm font-medium mb-1', DesignTokens.colors.neutral.text[700])}>Age *</label>
                <input
                  type="number"
                  value={patientProfile.age}
                  onChange={(e) => setPatientProfile({ ...patientProfile, age: e.target.value })}
                  className={combineClasses('w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-medical-primary-500', DesignTokens.components.input.base)}
                />
              </div>

              <div>
                <label className={combineClasses('block text-sm font-medium mb-1', DesignTokens.colors.neutral.text[700])}>Date of Birth</label>
                <DatePicker
                  value={patientProfile.dateOfBirth}
                  onChange={(e) => setPatientProfile({ ...patientProfile, dateOfBirth: e.target.value })}
                  max={new Date().toISOString().split('T')[0]}
                  placeholder="YYYY-MM-DD"
                />
              </div>
            </div>

            <div>
              <label className={combineClasses('block text-sm font-medium mb-1', DesignTokens.colors.neutral.text[700])}>Gender</label>
              <select
                value={patientProfile.gender || ''}
                onChange={(e) => setPatientProfile({ ...patientProfile, gender: e.target.value })}
                className={combineClasses('w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-medical-primary-500', DesignTokens.components.input.base)}
              >
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={combineClasses('block text-sm font-medium mb-1', DesignTokens.colors.neutral.text[700])}>Height (cm)</label>
                <input
                  type="number"
                  value={patientProfile.height}
                  onChange={(e) => setPatientProfile({ ...patientProfile, height: e.target.value })}
                  className={combineClasses('w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-medical-primary-500', DesignTokens.components.input.base)}
                />
              </div>

              <div>
                <label className={combineClasses('block text-sm font-medium mb-1', DesignTokens.colors.neutral.text[700])}>Weight (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={patientProfile.weight}
                  onChange={(e) => setPatientProfile({ ...patientProfile, weight: e.target.value })}
                  className={combineClasses('w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-medical-primary-500', DesignTokens.components.input.base)}
                />
              </div>
            </div>

            <div>
              <label className={combineClasses('block text-sm font-medium mb-1', DesignTokens.colors.neutral.text[700])}>Country</label>
              <select
                value={patientProfile.country || 'United States'}
                onChange={(e) => setPatientProfile({ ...patientProfile, country: e.target.value })}
                className={combineClasses('w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-medical-primary-500', DesignTokens.components.input.base)}
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
              className={combineClasses('flex-1 py-2.5 rounded-lg font-medium transition flex items-center justify-center gap-2', DesignTokens.colors.neutral[200], DesignTokens.colors.neutral.text[700], DesignTokens.colors.neutral[300].replace('bg-', 'hover:bg-'))}
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
            <button
              onClick={handleSave}
              className={combineClasses('flex-1 text-white py-2.5 rounded-lg font-medium transition flex items-center justify-center gap-2', DesignTokens.colors.primary[600], DesignTokens.colors.primary[700].replace('bg-', 'hover:bg-'))}
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

