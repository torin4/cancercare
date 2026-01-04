import React, { useState } from 'react';
import { X, AlertCircle, Check } from 'lucide-react';
import { DesignTokens, combineClasses } from '../../design/designTokens';
import { patientService } from '../../firebase/services';
import { useBanner } from '../../contexts/BannerContext';

export default function EditMedicalTeamModal({ 
  show, 
  onClose, 
  patientProfile, 
  setPatientProfile, 
  user,
  setMessages,
  emergencyContacts = []
}) {
  const { showSuccess, showError } = useBanner();
  if (!show) return null;

  const [caregiverSource, setCaregiverSource] = useState(
    patientProfile.caregiverName ? 'manual' : emergencyContacts.length > 0 ? 'select' : 'manual'
  );
  const [selectedEmergencyContactId, setSelectedEmergencyContactId] = useState('');

  const handleSave = async () => {
    try {
      // If caregiver is selected from emergency contacts, populate from that contact
      let caregiverName = patientProfile.caregiverName || '';
      let caregiverPhone = patientProfile.caregiverPhone || '';
      let caregiverEmail = patientProfile.caregiverEmail || '';

      if (caregiverSource === 'select' && selectedEmergencyContactId) {
        const selectedContact = emergencyContacts.find(c => c.id === selectedEmergencyContactId);
        if (selectedContact) {
          caregiverName = selectedContact.name || '';
          caregiverPhone = selectedContact.phone || '';
          caregiverEmail = selectedContact.email || '';
        }
      }

      const toSave = {
        oncologist: patientProfile.oncologist || '',
        oncologistPhone: patientProfile.oncologistPhone || '',
        oncologistEmail: patientProfile.oncologistEmail || '',
        hospital: patientProfile.hospital || '',
        clinicalTrialCoordinator: patientProfile.clinicalTrialCoordinator || '',
        clinicalTrialCoordinatorPhone: patientProfile.clinicalTrialCoordinatorPhone || '',
        clinicalTrialCoordinatorEmail: patientProfile.clinicalTrialCoordinatorEmail || '',
        caregiverName: caregiverName,
        caregiverPhone: caregiverPhone,
        caregiverEmail: caregiverEmail
      };
      await patientService.savePatient(user.uid, toSave);
      // Update local state
      setPatientProfile(prev => ({
        ...prev,
        oncologist: patientProfile.oncologist || prev.oncologist,
        oncologistPhone: patientProfile.oncologistPhone || prev.oncologistPhone,
        oncologistEmail: patientProfile.oncologistEmail || prev.oncologistEmail,
        hospital: patientProfile.hospital || prev.hospital,
        clinicalTrialCoordinator: patientProfile.clinicalTrialCoordinator || prev.clinicalTrialCoordinator,
        clinicalTrialCoordinatorPhone: patientProfile.clinicalTrialCoordinatorPhone || prev.clinicalTrialCoordinatorPhone,
        clinicalTrialCoordinatorEmail: patientProfile.clinicalTrialCoordinatorEmail || prev.clinicalTrialCoordinatorEmail,
        caregiverName: caregiverName,
        caregiverPhone: caregiverPhone,
        caregiverEmail: caregiverEmail
      }));
      showSuccess('Medical team information updated successfully!');
      onClose();
      if (setMessages) {
        setMessages(prev => [...prev, {
          type: 'ai',
          text: 'Medical team information updated successfully!'
        }]);
      }
    } catch (error) {
      showError('Failed to save medical team information. Please try again.');
    }
  };

  // Handle emergency contact selection
  const handleEmergencyContactSelect = (contactId) => {
    setSelectedEmergencyContactId(contactId);
    if (contactId) {
      const selectedContact = emergencyContacts.find(c => c.id === contactId);
      if (selectedContact) {
        setPatientProfile({
          ...patientProfile,
          caregiverName: selectedContact.name || '',
          caregiverPhone: selectedContact.phone || '',
          caregiverEmail: selectedContact.email || ''
        });
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-white w-full h-full md:h-auto md:rounded-2xl md:max-w-lg md:max-h-[85vh] overflow-hidden flex flex-col animate-slide-up">
        <div className="flex-shrink-0 bg-white border-b p-4 flex items-center justify-between">
          <h3 className={combineClasses('font-bold text-lg', DesignTokens.colors.neutral.text[800])}>Edit Medical Team</h3>
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

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className={combineClasses('border rounded-lg p-3', DesignTokens.colors.primary[50], DesignTokens.colors.primary.border[200])}>
            <div className="flex items-start gap-2">
              <AlertCircle className={combineClasses('w-5 h-5 mt-0.5 flex-shrink-0', DesignTokens.colors.primary.text[600])} />
              <div className="flex-1">
                <p className={combineClasses('text-sm font-medium', DesignTokens.colors.primary.text[700].replace('600', '900'))}>Medical Team Information</p>
                <p className={combineClasses('text-xs mt-0.5', DesignTokens.colors.primary.text[700])}>
                  Keep your medical team information up to date for better care coordination
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className={combineClasses('block text-sm font-medium mb-1', DesignTokens.colors.neutral.text[700])}>Oncologist</label>
              <input
                type="text"
                value={patientProfile.oncologist || ''}
                onChange={(e) => setPatientProfile({ ...patientProfile, oncologist: e.target.value })}
                placeholder="e.g., Dr. Jane Smith"
                className={combineClasses('w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-medical-primary-500', DesignTokens.components.input.base)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={combineClasses('block text-sm font-medium mb-1', DesignTokens.colors.neutral.text[700])}>Oncologist Phone</label>
                <input
                  type="tel"
                  value={patientProfile.oncologistPhone || ''}
                  onChange={(e) => setPatientProfile({ ...patientProfile, oncologistPhone: e.target.value })}
                  placeholder="e.g., (555) 123-4567"
                  className={combineClasses('w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-medical-primary-500', DesignTokens.components.input.base)}
                />
              </div>
              <div>
                <label className={combineClasses('block text-sm font-medium mb-1', DesignTokens.colors.neutral.text[700])}>Oncologist Email</label>
                <input
                  type="email"
                  value={patientProfile.oncologistEmail || ''}
                  onChange={(e) => setPatientProfile({ ...patientProfile, oncologistEmail: e.target.value })}
                  placeholder="e.g., doctor@hospital.com"
                  className={combineClasses('w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-medical-primary-500', DesignTokens.components.input.base)}
                />
              </div>
            </div>

            <div>
              <label className={combineClasses('block text-sm font-medium mb-1', DesignTokens.colors.neutral.text[700])}>Hospital/Clinic</label>
              <input
                type="text"
                value={patientProfile.hospital || ''}
                onChange={(e) => setPatientProfile({ ...patientProfile, hospital: e.target.value })}
                placeholder="e.g., Seattle Cancer Care Alliance"
                className={combineClasses('w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-medical-primary-500', DesignTokens.components.input.base)}
              />
            </div>

            <div className={combineClasses('pt-4', DesignTokens.colors.neutral.border[200].replace('border', 'border-t'))}>
              <label className={combineClasses('block text-sm font-medium mb-3', DesignTokens.colors.neutral.text[700])}>Clinical Trial Coordinator</label>
              <div>
                <label className={combineClasses('block text-sm font-medium mb-1', DesignTokens.colors.neutral.text[700])}>Name</label>
                <input
                  type="text"
                  value={patientProfile.clinicalTrialCoordinator || ''}
                  onChange={(e) => setPatientProfile({ ...patientProfile, clinicalTrialCoordinator: e.target.value })}
                  placeholder="e.g., Jane Smith, RN"
                  className={combineClasses('w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-medical-primary-500', DesignTokens.components.input.base)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className={combineClasses('block text-sm font-medium mb-1', DesignTokens.colors.neutral.text[700])}>Phone</label>
                  <input
                    type="tel"
                    value={patientProfile.clinicalTrialCoordinatorPhone || ''}
                    onChange={(e) => setPatientProfile({ ...patientProfile, clinicalTrialCoordinatorPhone: e.target.value })}
                    placeholder="e.g., (555) 123-4567"
                    className={combineClasses('w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-medical-primary-500', DesignTokens.components.input.base)}
                  />
                </div>
                <div>
                  <label className={combineClasses('block text-sm font-medium mb-1', DesignTokens.colors.neutral.text[700])}>Email</label>
                  <input
                    type="email"
                    value={patientProfile.clinicalTrialCoordinatorEmail || ''}
                    onChange={(e) => setPatientProfile({ ...patientProfile, clinicalTrialCoordinatorEmail: e.target.value })}
                    placeholder="e.g., coordinator@trialcenter.com"
                    className={combineClasses('w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-medical-primary-500', DesignTokens.components.input.base)}
                  />
                </div>
              </div>
            </div>

            <div className={combineClasses('pt-4', DesignTokens.colors.neutral.border[200].replace('border', 'border-t'))}>
              <label className={combineClasses('block text-sm font-medium mb-3', DesignTokens.colors.neutral.text[700])}>Caregiver</label>
              
              {emergencyContacts.length > 0 && (
                <div className="mb-3">
                  <label className={combineClasses('block text-sm font-medium mb-2', DesignTokens.colors.neutral.text[700])}>Select from Emergency Contacts</label>
                  <div className="flex gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCaregiverSource('select');
                        if (selectedEmergencyContactId) {
                          handleEmergencyContactSelect(selectedEmergencyContactId);
                        }
                      }}
                      className={combineClasses('flex-1 px-3 py-2 rounded-lg text-sm font-medium transition', caregiverSource === 'select' ? `${DesignTokens.colors.primary[600]} text-white` : `${DesignTokens.colors.neutral[100]} ${DesignTokens.colors.neutral.text[700]} ${DesignTokens.colors.neutral[200].replace('bg-', 'hover:bg-')}`)}
                    >
                      Select from Contacts
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCaregiverSource('manual');
                        setSelectedEmergencyContactId('');
                      }}
                      className={combineClasses('flex-1 px-3 py-2 rounded-lg text-sm font-medium transition', caregiverSource === 'manual' ? `${DesignTokens.colors.primary[600]} text-white` : `${DesignTokens.colors.neutral[100]} ${DesignTokens.colors.neutral.text[700]} ${DesignTokens.colors.neutral[200].replace('bg-', 'hover:bg-')}`)}
                    >
                      Enter Manually
                    </button>
                  </div>
                  
                  {caregiverSource === 'select' && (
                    <select
                      value={selectedEmergencyContactId}
                      onChange={(e) => {
                        setSelectedEmergencyContactId(e.target.value);
                        handleEmergencyContactSelect(e.target.value);
                      }}
                      className={combineClasses('w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-medical-primary-500', DesignTokens.components.input.base)}
                    >
                      <option value="">Select an emergency contact...</option>
                      {emergencyContacts.map((contact) => (
                        <option key={contact.id} value={contact.id}>
                          {contact.name || 'Unnamed'} {contact.phone ? `(${contact.phone})` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {caregiverSource === 'manual' && (
                <>
                  <div>
                    <label className={combineClasses('block text-sm font-medium mb-1', DesignTokens.colors.neutral.text[700])}>Caregiver Name</label>
                    <input
                      type="text"
                      value={patientProfile.caregiverName || ''}
                      onChange={(e) => setPatientProfile({ ...patientProfile, caregiverName: e.target.value })}
                      placeholder="e.g., John Doe"
                      className={combineClasses('w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-medical-primary-500', DesignTokens.components.input.base)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className={combineClasses('block text-sm font-medium mb-1', DesignTokens.colors.neutral.text[700])}>Phone</label>
                      <input
                        type="tel"
                        value={patientProfile.caregiverPhone || ''}
                        onChange={(e) => setPatientProfile({ ...patientProfile, caregiverPhone: e.target.value })}
                        placeholder="e.g., (555) 123-4567"
                        className={combineClasses('w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-medical-primary-500', DesignTokens.components.input.base)}
                      />
                    </div>
                    <div>
                      <label className={combineClasses('block text-sm font-medium mb-1', DesignTokens.colors.neutral.text[700])}>Email</label>
                      <input
                        type="email"
                        value={patientProfile.caregiverEmail || ''}
                        onChange={(e) => setPatientProfile({ ...patientProfile, caregiverEmail: e.target.value })}
                        placeholder="e.g., caregiver@email.com"
                        className={combineClasses('w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-medical-primary-500', DesignTokens.components.input.base)}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className={combineClasses('flex-shrink-0 bg-white p-4', DesignTokens.colors.neutral.border[200].replace('border', 'border-t'))}>
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

