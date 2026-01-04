import React, { useState } from 'react';
import { X, AlertCircle, Activity } from 'lucide-react';
import { DesignTokens, combineClasses } from '../../design/designTokens';
import { getTodayLocalDate } from '../../utils/helpers';
import { symptomService } from '../../firebase/services';
import { useBanner } from '../../contexts/BannerContext';
import DatePicker from '../DatePicker';

export default function AddSymptomModal({ 
  show, 
  onClose, 
  symptomForm, 
  setSymptomForm, 
  user 
}) {
  const { showSuccess, showError } = useBanner();
  const [isAllDay, setIsAllDay] = useState(false);
  
  if (!show) return null;

  const handleSave = async () => {
    // Use custom symptom name if "Other" is selected
    const symptomName = symptomForm.name === 'Other' 
      ? (symptomForm.customSymptomName || 'Other')
      : symptomForm.name;
    
    if (!symptomForm.name || !symptomForm.severity || (symptomForm.name === 'Other' && !symptomForm.customSymptomName)) {
      showError('Please fill in all required fields (Symptom Type and Severity)');
      return;
    }
    
    if (!user) {
      showError('Please log in to save symptoms');
      return;
    }

    try {
      // Combine date and time into a single datetime
      // For all-day entries, use midnight (00:00)
      const timeValue = isAllDay ? '00:00' : symptomForm.time;
      const dateTime = new Date(`${symptomForm.date}T${timeValue}`);
      
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
      setIsAllDay(false);
      showSuccess('Symptom logged successfully!');
      onClose();
      
      // Symptoms will automatically update via the subscription
    } catch (error) {
      showError('Failed to save symptom. Please try again.');
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
    setIsAllDay(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-white w-full h-full md:h-auto md:rounded-2xl md:max-w-md md:max-h-[85vh] overflow-hidden flex flex-col animate-slide-up">
        <div className="flex-shrink-0 bg-white border-b p-4 flex items-center justify-between">
          <h3 className={combineClasses('font-bold text-lg', DesignTokens.colors.neutral.text[800])}>Log Symptom</h3>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleCancel();
            }}
            className={combineClasses('transition', DesignTokens.colors.neutral.text[500], DesignTokens.colors.neutral.text[700].replace('text-', 'hover:text-'))}
            type="button"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            <div className={combineClasses('border rounded-lg p-3', DesignTokens.colors.primary[50], DesignTokens.colors.primary.border[200])}>
              <div className="flex items-start gap-2">
                <AlertCircle className={combineClasses('w-5 h-5 mt-0.5 flex-shrink-0', DesignTokens.colors.primary.text[600])} />
                <div className="flex-1">
                  <p className={combineClasses('text-sm font-medium', DesignTokens.colors.primary.text[700].replace('600', '900'))}>Quick Symptom Logging</p>
                  <p className={combineClasses('text-xs mt-1', DesignTokens.colors.primary.text[700])}>
                    Track your symptoms to help identify patterns and inform your care team.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className={combineClasses('block text-sm font-medium mb-2', DesignTokens.colors.neutral.text[700])}>
                Symptom Type <span className={combineClasses('', DesignTokens.components.alert.text.error)}>*</span>
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
                className={combineClasses('w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-medical-primary-500', DesignTokens.components.input.base)}
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
                  className={combineClasses('w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-medical-primary-500 mt-2', DesignTokens.components.input.base)}
                />
              )}
            </div>

            <div>
              <label className={combineClasses('block text-sm font-medium mb-2', DesignTokens.colors.neutral.text[700])}>
                Severity <span className={combineClasses('', DesignTokens.components.alert.text.error)}>*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button 
                  onClick={() => setSymptomForm({...symptomForm, severity: 'mild'})}
                  className={combineClasses('border-2 rounded-lg py-3 text-center transition', symptomForm.severity === 'mild' ? `${DesignTokens.components.status.normal.border.replace('200', '500')} ${DesignTokens.components.status.normal.bg}` : `${DesignTokens.colors.neutral.border[300]} ${DesignTokens.components.status.normal.border.replace('200', '500').replace('border-', 'hover:border-')} ${DesignTokens.components.status.normal.bg.replace('bg-', 'hover:bg-')}`)}
                >
                  <div className={combineClasses('w-3 h-3 rounded-full mx-auto mb-1', DesignTokens.components.status.normal.icon.replace('text-', 'bg-').replace('600', '500'))}></div>
                  <div className={combineClasses('text-sm font-medium', DesignTokens.colors.neutral.text[700])}>Mild</div>
                </button>
                <button 
                  onClick={() => setSymptomForm({...symptomForm, severity: 'moderate'})}
                  className={combineClasses('border-2 rounded-lg py-3 text-center transition', symptomForm.severity === 'moderate' ? `${DesignTokens.components.status.low.border.replace('200', '500')} ${DesignTokens.components.status.low.bg}` : `${DesignTokens.colors.neutral.border[300]} ${DesignTokens.components.status.low.border.replace('200', '500').replace('border-', 'hover:border-')} ${DesignTokens.components.status.low.bg.replace('bg-', 'hover:bg-')}`)}
                >
                  <div className={combineClasses('w-3 h-3 rounded-full mx-auto mb-1', DesignTokens.components.status.low.icon.replace('text-', 'bg-').replace('600', '500'))}></div>
                  <div className={combineClasses('text-sm font-medium', DesignTokens.colors.neutral.text[700])}>Moderate</div>
                </button>
                <button 
                  onClick={() => setSymptomForm({...symptomForm, severity: 'severe'})}
                  className={combineClasses('border-2 rounded-lg py-3 text-center transition', symptomForm.severity === 'severe' ? `${DesignTokens.components.status.high.border.replace('200', '500')} ${DesignTokens.components.status.high.bg}` : `${DesignTokens.colors.neutral.border[300]} ${DesignTokens.components.status.high.border.replace('200', '500').replace('border-', 'hover:border-')} ${DesignTokens.components.status.high.bg.replace('bg-', 'hover:bg-')}`)}
                >
                  <div className={combineClasses('w-3 h-3 rounded-full mx-auto mb-1', DesignTokens.components.status.high.icon.replace('text-', 'bg-').replace('600', '500'))}></div>
                  <div className={combineClasses('text-sm font-medium', DesignTokens.colors.neutral.text[700])}>Severe</div>
                </button>
              </div>
            </div>

            <div>
              <label className={combineClasses('block text-sm font-medium mb-2', DesignTokens.colors.neutral.text[700])}>
                {isAllDay ? 'Date' : 'Date & Time'} <span className={combineClasses('', DesignTokens.components.alert.text.error)}>*</span>
              </label>
              
              <div className="mb-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAllDay}
                    onChange={(e) => setIsAllDay(e.target.checked)}
                    className={combineClasses('w-4 h-4 rounded focus:ring-blue-500', DesignTokens.colors.primary[600].replace('bg-', 'text-'), DesignTokens.colors.neutral.border[300])}
                  />
                  <span className={combineClasses('text-sm', DesignTokens.colors.neutral.text[700])}>All Day</span>
                </label>
              </div>
              
              <div className={isAllDay ? 'grid grid-cols-1' : 'grid grid-cols-2 gap-3'}>
                <div>
                  <label className={combineClasses('block text-sm font-medium mb-1', DesignTokens.colors.neutral.text[700])}>Date</label>
                  <DatePicker
                    value={symptomForm.date}
                    onChange={(e) => setSymptomForm({...symptomForm, date: e.target.value})}
                    max={getTodayLocalDate()}
                    placeholder="YYYY-MM-DD"
                  />
                </div>

                {!isAllDay && (
                  <div>
                    <label className={combineClasses('block text-sm font-medium mb-1', DesignTokens.colors.neutral.text[700])}>Time</label>
                    <input
                      type="time"
                      value={symptomForm.time}
                      onChange={(e) => setSymptomForm({...symptomForm, time: e.target.value})}
                      className={combineClasses('w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-medical-primary-500', DesignTokens.components.input.base)}
                    />
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className={combineClasses('block text-sm font-medium mb-1', DesignTokens.colors.neutral.text[700])}>
                Notes <span className={combineClasses('text-xs', DesignTokens.colors.neutral.text[500])}>(optional)</span>
              </label>
              <textarea
                rows="3"
                value={symptomForm.notes}
                onChange={(e) => setSymptomForm({...symptomForm, notes: e.target.value})}
                placeholder="Additional details about the symptom..."
                className={combineClasses('w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-medical-primary-500 resize-none', DesignTokens.components.input.base, DesignTokens.components.input.textarea)}
              ></textarea>
            </div>

            {/* Quick Action Tags */}
            <div className={combineClasses('rounded-lg p-3', DesignTokens.colors.neutral[50])}>
              <p className={combineClasses('text-xs font-medium mb-2', DesignTokens.colors.neutral.text[700])}>Tags (optional):</p>
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
                      className={combineClasses('text-xs rounded-full px-3 py-1.5 transition', isSelected ? `${DesignTokens.colors.primary[100]} border-2 ${DesignTokens.colors.primary.border[600]} ${DesignTokens.colors.primary.text[700]} font-medium` : `${DesignTokens.colors.neutral[50].replace('bg-', 'bg-white')} ${DesignTokens.colors.neutral.border[300]} ${DesignTokens.colors.neutral.text[700]} ${DesignTokens.colors.neutral[100].replace('bg-', 'hover:bg-')}`)}
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
              className={combineClasses('flex-1 py-2.5 rounded-lg font-medium transition flex items-center justify-center gap-2', DesignTokens.colors.neutral[200], DesignTokens.colors.neutral.text[700], DesignTokens.colors.neutral[300].replace('bg-', 'hover:bg-'))}
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
            <button
              onClick={handleSave}
              className={combineClasses('flex-1 text-white py-2.5 rounded-lg font-medium transition flex items-center justify-center gap-2', DesignTokens.colors.primary[600], DesignTokens.colors.primary[700].replace('bg-', 'hover:bg-'))}
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

