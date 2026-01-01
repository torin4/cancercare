import React from 'react';
import { X, AlertCircle, Activity } from 'lucide-react';
import { getTodayLocalDate } from '../../utils/helpers';
import { symptomService } from '../../firebase/services';

export default function AddSymptomModal({ 
  show, 
  onClose, 
  symptomForm, 
  setSymptomForm, 
  user 
}) {
  if (!show) return null;

  const handleSave = async () => {
    // Use custom symptom name if "Other" is selected
    const symptomName = symptomForm.name === 'Other' 
      ? (symptomForm.customSymptomName || 'Other')
      : symptomForm.name;
    
    if (!symptomForm.name || !symptomForm.severity || (symptomForm.name === 'Other' && !symptomForm.customSymptomName)) {
      alert('Please fill in all required fields (Symptom Type and Severity)');
      return;
    }
    
    if (!user) {
      alert('Please log in to save symptoms');
      return;
    }

    try {
      // Combine date and time into a single datetime
      const dateTime = new Date(`${symptomForm.date}T${symptomForm.time}`);
      
      await symptomService.addSymptom({
        patientId: user.uid,
        name: symptomName,
        severity: symptomForm.severity,
        date: dateTime,
        notes: symptomForm.notes || '',
        tags: symptomForm.tags || []
      });

      // Reset form and close modal
      setSymptomForm({
        name: '',
        severity: '',
        date: getTodayLocalDate(),
        time: new Date().toTimeString().slice(0, 5),
        notes: '',
        customSymptomName: '',
        tags: []
      });
      onClose();
      
      // Symptoms will automatically update via the subscription
    } catch (error) {
      console.error('Error saving symptom:', error);
      alert('Failed to save symptom. Please try again.');
    }
  };

  const handleCancel = () => {
    setSymptomForm({
      name: '',
      severity: '',
      date: getTodayLocalDate(),
      time: new Date().toTimeString().slice(0, 5),
      notes: ''
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-white w-full h-full md:h-auto md:rounded-2xl md:max-w-md md:max-h-[85vh] overflow-hidden flex flex-col animate-slide-up">
        <div className="flex-shrink-0 bg-white border-b p-4 flex items-center justify-between">
          <h3 className="font-bold text-lg text-gray-800">Log Symptom</h3>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleCancel();
            }}
            className="text-gray-500 hover:text-gray-700"
            type="button"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900">Quick Symptom Logging</p>
                  <p className="text-xs text-blue-700 mt-1">
                    Track your symptoms to help identify patterns and inform your care team.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Symptom Type <span className="text-red-600">*</span>
              </label>
              <select 
                value={symptomForm.name === 'Other' ? 'Other' : symptomForm.name}
                onChange={(e) => {
                  if (e.target.value === 'Other') {
                    setSymptomForm({...symptomForm, name: 'Other', customSymptomName: ''});
                  } else {
                    setSymptomForm({...symptomForm, name: e.target.value, customSymptomName: ''});
                  }
                }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select symptom type...</option>
                <option value="Fatigue">Fatigue</option>
                <option value="Pain">Pain</option>
                <option value="Nausea">Nausea</option>
                <option value="Headache">Headache</option>
                <option value="Dizziness">Dizziness</option>
                <option value="Fever">Fever</option>
                <option value="Shortness of Breath">Shortness of Breath</option>
                <option value="Loss of Appetite">Loss of Appetite</option>
                <option value="Sleep Issues">Sleep Issues</option>
                <option value="Other">Other</option>
              </select>
              {symptomForm.name === 'Other' && (
                <input
                  type="text"
                  value={symptomForm.customSymptomName || ''}
                  onChange={(e) => setSymptomForm({...symptomForm, customSymptomName: e.target.value})}
                  placeholder="Enter symptom name..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mt-2"
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Severity <span className="text-red-600">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button 
                  onClick={() => setSymptomForm({...symptomForm, severity: 'mild'})}
                  className={`border-2 rounded-lg py-3 text-center transition ${symptomForm.severity === 'mild' ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-green-500 hover:bg-green-50'}`}
                >
                  <div className="w-3 h-3 bg-green-500 rounded-full mx-auto mb-1"></div>
                  <div className="text-sm font-medium text-gray-700">Mild</div>
                </button>
                <button 
                  onClick={() => setSymptomForm({...symptomForm, severity: 'moderate'})}
                  className={`border-2 rounded-lg py-3 text-center transition ${symptomForm.severity === 'moderate' ? 'border-yellow-500 bg-yellow-50' : 'border-gray-300 hover:border-yellow-500 hover:bg-yellow-50'}`}
                >
                  <div className="w-3 h-3 bg-yellow-500 rounded-full mx-auto mb-1"></div>
                  <div className="text-sm font-medium text-gray-700">Moderate</div>
                </button>
                <button 
                  onClick={() => setSymptomForm({...symptomForm, severity: 'severe'})}
                  className={`border-2 rounded-lg py-3 text-center transition ${symptomForm.severity === 'severe' ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-red-500 hover:bg-red-50'}`}
                >
                  <div className="w-3 h-3 bg-red-500 rounded-full mx-auto mb-1"></div>
                  <div className="text-sm font-medium text-gray-700">Severe</div>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={symptomForm.date}
                  onChange={(e) => setSymptomForm({...symptomForm, date: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                <input
                  type="time"
                  value={symptomForm.time}
                  onChange={(e) => setSymptomForm({...symptomForm, time: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes <span className="text-gray-500 text-xs">(optional)</span>
              </label>
              <textarea
                rows="3"
                value={symptomForm.notes}
                onChange={(e) => setSymptomForm({...symptomForm, notes: e.target.value})}
                placeholder="Additional details about the symptom..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              ></textarea>
            </div>

            {/* Quick Action Tags */}
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs font-medium text-gray-700 mb-2">Tags (optional):</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'treatment-related', label: 'Related to treatment' },
                  { id: 'discuss-doctor', label: 'Discuss with doctor' },
                  { id: 'medication-needed', label: 'Medication needed' },
                  { id: 'side-effect', label: 'Side effect' },
                  { id: 'emergency', label: 'Emergency' },
                  { id: 'recurring', label: 'Recurring' },
                  { id: 'new-symptom', label: 'New symptom' },
                  { id: 'worsening', label: 'Worsening' }
                ].map(tag => {
                  const isSelected = symptomForm.tags?.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setSymptomForm({
                            ...symptomForm,
                            tags: symptomForm.tags.filter(t => t !== tag.id)
                          });
                        } else {
                          setSymptomForm({
                            ...symptomForm,
                            tags: [...(symptomForm.tags || []), tag.id]
                          });
                        }
                      }}
                      className={`text-xs rounded-full px-3 py-1.5 transition ${
                        isSelected
                          ? 'bg-medical-primary-100 border-2 border-medical-primary-500 text-medical-primary-700 font-medium'
                          : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {tag.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 border-t p-4 bg-white">
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              className="flex-1 bg-gray-200 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-300 transition flex items-center justify-center gap-2"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition flex items-center justify-center gap-2"
            >
              <Activity className="w-4 h-4" />
              Log Symptom
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

