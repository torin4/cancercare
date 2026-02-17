/**
 * Update Dosage & Frequency Modal
 * Updates a medication's dosage and frequency going forward while keeping previous values in history.
 */

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { DesignTokens, combineClasses } from '../../design/designTokens';
import { medicationService } from '../../firebase/services';
import { useBanner } from '../../contexts/BannerContext';

function getTodayLocalISO() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

const FREQUENCY_OPTIONS = [
  'Once daily',
  'Twice daily',
  'Three times daily',
  'Four times daily',
  'Every other day',
  'Weekly',
  'Every 2 weeks',
  'Every 3 weeks',
  'Monthly',
  'As needed',
  'Custom',
];

function parseScheduleToTimes(schedule) {
  const out = { morning: false, afternoon: false, evening: false, night: false };
  if (!schedule || typeof schedule !== 'string' || schedule === '' || !schedule.includes(':')) return out;
  const s = schedule.toLowerCase();
  if (s.match(/\b(?:12|1|2|3|4|5|6|7|8|9|10|11):\d+\s*am/i) || (s.match(/\b(?:8|9|10|11):\d+/i) && !s.includes('pm'))) out.morning = true;
  if (s.match(/\b(?:12|1|2|3|4):\d+\s*pm/i) || (s.match(/\b(?:12|1|2|3):\d+/i) && s.includes('pm'))) out.afternoon = true;
  if (s.match(/\b(?:5|6|7|8|9|10|11|12):\d+\s*pm/i) || (s.match(/\b(?:5|6|7|8|9|10|11|12):\d+/i) && s.includes('pm'))) out.evening = true;
  if (s.includes('10:00 pm') || s.includes('22:00')) out.night = true;
  return out;
}

function timesToSchedule(selectedTimes, frequencyFallback = '') {
  const times = [];
  if (selectedTimes.morning) times.push('8:00 AM');
  if (selectedTimes.afternoon) times.push('2:00 PM');
  if (selectedTimes.evening) times.push('8:00 PM');
  if (selectedTimes.night) times.push('10:00 PM');
  return times.length > 0 ? times.join(', ') : frequencyFallback;
}

export default function UpdateDosageModal({ show, onClose, medication, onSaved }) {
  const { showSuccess, showError } = useBanner();
  const [newDosage, setNewDosage] = useState('');
  const [newFrequency, setNewFrequency] = useState('');
  const [selectedTimes, setSelectedTimes] = useState({ morning: false, afternoon: false, evening: false, night: false });
  const [effectiveDate, setEffectiveDate] = useState(getTodayLocalISO());
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (show && medication) {
      setNewDosage(medication.dosage || '');
      setNewFrequency(medication.frequency || '');
      setSelectedTimes(parseScheduleToTimes(medication.schedule));
      setEffectiveDate(getTodayLocalISO());
    }
  }, [show, medication]);

  const handleSave = async () => {
    if (!medication?.id || !newDosage?.trim() || !newFrequency?.trim()) {
      showError('Enter dosage and frequency.');
      return;
    }
    setIsSaving(true);
    try {
      const [y, mo, d] = effectiveDate.split('-').map(Number);
      const effectiveDateObj = new Date(y, mo - 1, d, 0, 0, 0, 0);
      const newSchedule = timesToSchedule(selectedTimes, newFrequency.trim());
      await medicationService.updateMedicationDosageAndFrequency(medication.id, newDosage.trim(), newFrequency.trim(), effectiveDateObj, newSchedule);
      showSuccess('Dosage and frequency updated. Previous values kept in history.');
      onSaved?.();
      onClose();
    } catch (e) {
      showError('Failed to update. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!show) return null;

  return (
    <div
      className={combineClasses(DesignTokens.components.modal.backdrop, 'z-[101]')}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={combineClasses('bg-white rounded-xl shadow-lg max-w-sm w-full mx-4 p-4 max-h-[90vh] overflow-y-auto')}>
        <div className="flex items-center justify-between mb-3">
          <h3 className={combineClasses('text-base font-semibold', DesignTokens.colors.neutral.text[900])}>
            Update dosage & frequency
          </h3>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-gray-100" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        {medication && (
          <>
            <p className={combineClasses('text-sm mb-3', DesignTokens.colors.neutral.text[600])}>
              {medication.name}
            </p>
            <div className="space-y-3">
              <div>
                <label className={combineClasses('block text-xs font-medium mb-1', DesignTokens.colors.neutral.text[600])}>
                  Current dosage (kept in history)
                </label>
                <p className={combineClasses('text-sm py-2 px-3 rounded border bg-gray-50', DesignTokens.colors.neutral.border[200], DesignTokens.colors.neutral.text[700])}>
                  {medication.dosage || '—'}
                </p>
              </div>
              <div>
                <label className={combineClasses('block text-xs font-medium mb-1', DesignTokens.colors.neutral.text[600])}>
                  New dosage (for future doses)
                </label>
                <input
                  type="text"
                  value={newDosage}
                  onChange={(e) => setNewDosage(e.target.value)}
                  placeholder="e.g. 20 mg"
                  className={combineClasses('w-full text-sm rounded border py-2 px-3 min-h-[44px]', DesignTokens.colors.neutral.border[300])}
                />
              </div>
              <div>
                <label className={combineClasses('block text-xs font-medium mb-1', DesignTokens.colors.neutral.text[600])}>
                  Current frequency (kept in history)
                </label>
                <p className={combineClasses('text-sm py-2 px-3 rounded border bg-gray-50', DesignTokens.colors.neutral.border[200], DesignTokens.colors.neutral.text[700])}>
                  {medication.frequency || '—'}
                </p>
              </div>
              <div>
                <label className={combineClasses('block text-xs font-medium mb-1', DesignTokens.colors.neutral.text[600])}>
                  New frequency (for future doses)
                </label>
                <select
                  value={newFrequency}
                  onChange={(e) => setNewFrequency(e.target.value)}
                  className={combineClasses('w-full text-sm rounded border py-2 px-3 min-h-[44px]', DesignTokens.colors.neutral.border[300])}
                >
                  <option value="">Select frequency...</option>
                  {FREQUENCY_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                  {medication.frequency && !FREQUENCY_OPTIONS.includes(medication.frequency) && (
                    <option value={medication.frequency}>{medication.frequency}</option>
                  )}
                </select>
              </div>
              <div>
                <label className={combineClasses('block text-xs font-medium mb-1', DesignTokens.colors.neutral.text[600])}>
                  Time(s) of day <span className="text-gray-400">(optional)</span>
                </label>
                <div className="flex flex-wrap gap-3">
                  {[
                    { key: 'morning', label: 'Morning' },
                    { key: 'afternoon', label: 'Afternoon' },
                    { key: 'evening', label: 'Evening' },
                    { key: 'night', label: 'Night' },
                  ].map(({ key, label }) => (
                    <label key={key} className={combineClasses('flex items-center gap-2 cursor-pointer', DesignTokens.colors.neutral.text[700])}>
                      <input
                        type="checkbox"
                        checked={selectedTimes[key]}
                        onChange={(e) => setSelectedTimes((t) => ({ ...t, [key]: e.target.checked }))}
                        className={combineClasses('w-4 h-4 rounded', DesignTokens.colors.neutral.border[300])}
                      />
                      <span className="text-sm">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className={combineClasses('block text-xs font-medium mb-1', DesignTokens.colors.neutral.text[600])}>
                  Effective date
                </label>
                <input
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  className={combineClasses('w-full text-sm rounded border py-2 px-3 min-h-[44px]', DesignTokens.colors.neutral.border[300])}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={onClose}
                className={combineClasses('flex-1 py-2 rounded-lg border text-sm font-medium min-h-[44px] touch-manipulation', DesignTokens.colors.neutral.border[300], 'hover:bg-gray-50')}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || !newDosage?.trim() || !newFrequency?.trim()}
                className={combineClasses('flex-1 py-2 rounded-lg text-sm font-medium min-h-[44px] touch-manipulation text-white', DesignTokens.components.button.primary, 'disabled:opacity-50')}
              >
                {isSaving ? 'Saving…' : 'Update'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
