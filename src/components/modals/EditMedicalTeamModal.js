import React, { useState } from 'react';
import { X, AlertCircle, Check } from 'lucide-react';
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
      console.error('Error saving medical team:', error);
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
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

            <div className="border-t pt-4">
              <label className="block text-sm font-medium text-gray-700 mb-3">Caregiver</label>
              
              {emergencyContacts.length > 0 && (
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select from Emergency Contacts</label>
                  <div className="flex gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCaregiverSource('select');
                        if (selectedEmergencyContactId) {
                          handleEmergencyContactSelect(selectedEmergencyContactId);
                        }
                      }}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition ${
                        caregiverSource === 'select'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Select from Contacts
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCaregiverSource('manual');
                        setSelectedEmergencyContactId('');
                      }}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition ${
                        caregiverSource === 'manual'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
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
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Caregiver Name</label>
                    <input
                      type="text"
                      value={patientProfile.caregiverName || ''}
                      onChange={(e) => setPatientProfile({ ...patientProfile, caregiverName: e.target.value })}
                      placeholder="e.g., John Doe"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                      <input
                        type="tel"
                        value={patientProfile.caregiverPhone || ''}
                        onChange={(e) => setPatientProfile({ ...patientProfile, caregiverPhone: e.target.value })}
                        placeholder="e.g., (555) 123-4567"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={patientProfile.caregiverEmail || ''}
                        onChange={(e) => setPatientProfile({ ...patientProfile, caregiverEmail: e.target.value })}
                        placeholder="e.g., caregiver@email.com"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </>
              )}
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

