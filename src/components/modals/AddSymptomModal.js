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
    <div className={combineClasses(DesignTokens.components.modal.backdrop, 'z-50')}>
      <div className={combineClasses('w-full h-full md:h-auto', DesignTokens.borders.radius.lg, 'md:max-w-md md:max-h-[85vh] overflow-hidden flex flex-col animate-slide-up', DesignTokens.components.modal.container)}>
        <div className={combineClasses('flex-shrink-0 border-b', DesignTokens.components.modal.header, DesignTokens.colors.neutral.border[200])}>
          <h3 className={combineClasses(DesignTokens.typography.h2.full, DesignTokens.typography.h2.weight, DesignTokens.colors.neutral.text[800])}>Log Symptom</h3>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleCancel();
            }}
            className={combineClasses(DesignTokens.transitions.default, DesignTokens.components.modal.closeButton)}
            type="button"
          >
            <X className={DesignTokens.icons.header.size.full} />
          </button>
        </div>

        <div className={combineClasses('flex-1 overflow-y-auto', DesignTokens.components.modal.body)}>
          <div className={combineClasses('space-y-4', DesignTokens.spacing.gap.lg)}>
            <div className={combineClasses(DesignTokens.borders.width.default, DesignTokens.borders.radius.sm, DesignTokens.spacing.card.mobile, DesignTokens.colors.primary[50], DesignTokens.colors.primary.border[200])}>
              <div className={combineClasses('flex items-start', DesignTokens.spacing.gap.sm)}>
                <AlertCircle className={combineClasses(DesignTokens.icons.button.size.full, 'mt-0.5 flex-shrink-0', DesignTokens.colors.primary.text[600])} />
                <div className="flex-1">
                  <p className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, DesignTokens.colors.primary.text[700].replace('600', '900'))}>Quick Symptom Logging</p>
                  <p className={combineClasses(DesignTokens.typography.body.xs, 'mt-1', DesignTokens.colors.primary.text[700])}>
                    Track your symptoms to help identify patterns and inform your care team.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className={combineClasses('block', DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, 'mb-2', DesignTokens.colors.neutral.text[700])}>
                Symptom Type <span className={combineClasses(DesignTokens.components.alert.text.error)}>*</span>
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
                className={combineClasses(DesignTokens.components.input.base, DesignTokens.borders.radius.sm, 'focus:ring-2 focus:ring-medical-primary-500')}
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
                  className={combineClasses(DesignTokens.components.input.base, DesignTokens.borders.radius.sm, 'focus:ring-2 focus:ring-medical-primary-500 mt-2')}
                />
              )}
            </div>

            <div>
              <label className={combineClasses('block', DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, 'mb-2', DesignTokens.colors.neutral.text[700])}>
                Severity <span className={combineClasses(DesignTokens.components.alert.text.error)}>*</span>
              </label>
              <div className={combineClasses('grid grid-cols-3', DesignTokens.spacing.gap.sm)}>
                <button 
                  onClick={() => setSymptomForm({...symptomForm, severity: 'mild'})}
                  className={combineClasses(DesignTokens.borders.width.lg, DesignTokens.borders.radius.sm, 'py-3 text-center', DesignTokens.transitions.default, symptomForm.severity === 'mild' ? `${DesignTokens.components.status.normal.border.replace('200', '500')} ${DesignTokens.components.status.normal.bg}` : `${DesignTokens.colors.neutral.border[300]} ${DesignTokens.components.status.normal.border.replace('200', '500').replace('border-', 'hover:border-')} ${DesignTokens.components.status.normal.bg.replace('bg-', 'hover:bg-')}`)}
                >
                  <div className={combineClasses(DesignTokens.icons.small.size.full, DesignTokens.borders.radius.full, 'mx-auto mb-1', DesignTokens.components.status.normal.icon.replace('text-', 'bg-').replace('600', '500'))}></div>
                  <div className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, DesignTokens.colors.neutral.text[700])}>Mild</div>
                </button>
                <button 
                  onClick={() => setSymptomForm({...symptomForm, severity: 'moderate'})}
                  className={combineClasses(DesignTokens.borders.width.lg, DesignTokens.borders.radius.sm, 'py-3 text-center', DesignTokens.transitions.default, symptomForm.severity === 'moderate' ? `${DesignTokens.components.status.low.border.replace('200', '500')} ${DesignTokens.components.status.low.bg}` : `${DesignTokens.colors.neutral.border[300]} ${DesignTokens.components.status.low.border.replace('200', '500').replace('border-', 'hover:border-')} ${DesignTokens.components.status.low.bg.replace('bg-', 'hover:bg-')}`)}
                >
                  <div className={combineClasses(DesignTokens.icons.small.size.full, DesignTokens.borders.radius.full, 'mx-auto mb-1', DesignTokens.components.status.low.icon.replace('text-', 'bg-').replace('600', '500'))}></div>
                  <div className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, DesignTokens.colors.neutral.text[700])}>Moderate</div>
                </button>
                <button 
                  onClick={() => setSymptomForm({...symptomForm, severity: 'severe'})}
                  className={combineClasses(DesignTokens.borders.width.lg, DesignTokens.borders.radius.sm, 'py-3 text-center', DesignTokens.transitions.default, symptomForm.severity === 'severe' ? `${DesignTokens.components.status.high.border.replace('200', '500')} ${DesignTokens.components.status.high.bg}` : `${DesignTokens.colors.neutral.border[300]} ${DesignTokens.components.status.high.border.replace('200', '500').replace('border-', 'hover:border-')} ${DesignTokens.components.status.high.bg.replace('bg-', 'hover:bg-')}`)}
                >
                  <div className={combineClasses(DesignTokens.icons.small.size.full, DesignTokens.borders.radius.full, 'mx-auto mb-1', DesignTokens.components.status.high.icon.replace('text-', 'bg-').replace('600', '500'))}></div>
                  <div className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, DesignTokens.colors.neutral.text[700])}>Severe</div>
                </button>
              </div>
            </div>

            <div>
              <label className={combineClasses('block', DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, 'mb-2', DesignTokens.colors.neutral.text[700])}>
                {isAllDay ? 'Date' : 'Date & Time'} <span className={combineClasses(DesignTokens.components.alert.text.error)}>*</span>
              </label>
              
              <div className="mb-3">
                <label className={combineClasses('flex items-center cursor-pointer', DesignTokens.spacing.gap.sm)}>
                  <input
                    type="checkbox"
                    checked={isAllDay}
                    onChange={(e) => setIsAllDay(e.target.checked)}
                    className={combineClasses('w-4 h-4', DesignTokens.borders.radius.sm, 'focus:ring-blue-500', DesignTokens.colors.primary[600].replace('bg-', 'text-'), DesignTokens.colors.neutral.border[300])}
                  />
                  <span className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.colors.neutral.text[700])}>All Day</span>
                </label>
              </div>
              
              <div className={isAllDay ? 'grid grid-cols-1' : combineClasses('grid grid-cols-2', DesignTokens.spacing.gap.md)}>
                <div>
                  <label className={combineClasses('block', DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, 'mb-1', DesignTokens.colors.neutral.text[700])}>Date</label>
                  <DatePicker
                    value={symptomForm.date}
                    onChange={(e) => setSymptomForm({...symptomForm, date: e.target.value})}
                    max={getTodayLocalDate()}
                    placeholder="YYYY-MM-DD"
                  />
                </div>

                {!isAllDay && (
                  <div>
                    <label className={combineClasses('block', DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, 'mb-1', DesignTokens.colors.neutral.text[700])}>Time</label>
                    <input
                      type="time"
                      value={symptomForm.time}
                      onChange={(e) => setSymptomForm({...symptomForm, time: e.target.value})}
                      className={combineClasses(DesignTokens.components.input.base, DesignTokens.borders.radius.sm, 'focus:ring-2 focus:ring-medical-primary-500')}
                    />
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className={combineClasses('block', DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, 'mb-1', DesignTokens.colors.neutral.text[700])}>
                Notes <span className={combineClasses(DesignTokens.typography.body.xs, DesignTokens.colors.neutral.text[500])}>(optional)</span>
              </label>
              <textarea
                rows="3"
                value={symptomForm.notes}
                onChange={(e) => setSymptomForm({...symptomForm, notes: e.target.value})}
                placeholder="Additional details about the symptom..."
                className={combineClasses(DesignTokens.components.input.base, DesignTokens.components.input.textarea, DesignTokens.borders.radius.sm, 'focus:ring-2 focus:ring-medical-primary-500')}
              ></textarea>
            </div>

            {/* Quick Action Tags */}
            <div className={combineClasses(DesignTokens.borders.radius.sm, DesignTokens.spacing.card.mobile, DesignTokens.colors.neutral[50])}>
              <p className={combineClasses(DesignTokens.typography.body.xs, DesignTokens.typography.h3.weight, 'mb-2', DesignTokens.colors.neutral.text[700])}>Tags (optional):</p>
              <div className={combineClasses('flex flex-wrap', DesignTokens.spacing.gap.sm)}>
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

        <div className={combineClasses('flex-shrink-0 border-t', DesignTokens.components.modal.footer, DesignTokens.colors.neutral.border[200])}>
          <div className={combineClasses('flex', DesignTokens.spacing.gap.md)}>
            <button
              onClick={handleCancel}
              className={combineClasses('flex-1 py-2.5', DesignTokens.borders.radius.sm, DesignTokens.typography.h3.weight, DesignTokens.transitions.default, 'flex items-center justify-center', DesignTokens.spacing.gap.sm, DesignTokens.components.button.secondary)}
            >
              <X className={DesignTokens.icons.standard.size.full} />
              Cancel
            </button>
            <button
              onClick={handleSave}
              className={combineClasses('flex-1 text-white py-2.5', DesignTokens.borders.radius.sm, DesignTokens.typography.h3.weight, DesignTokens.transitions.default, 'flex items-center justify-center', DesignTokens.spacing.gap.sm, DesignTokens.components.button.primary)}
            >
              <Activity className={DesignTokens.icons.standard.size.full} />
              Log Symptom
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

