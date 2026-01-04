import React from 'react';
import { X, AlertCircle, Check } from 'lucide-react';
import { DesignTokens, combineClasses } from '../../design/designTokens';
import { COUNTRIES } from '../../constants/countries';
import { trialLocationService } from '../../firebase/services';
import { useBanner } from '../../contexts/BannerContext';

export default function EditLocationModal({
  show,
  onClose,
  user,
  trialLocation,
  setTrialLocation,
  setMessages
}) {
  const { showSuccess, showError } = useBanner();
  if (!show) return null;

  const handleSave = async () => {
    try {
      await trialLocationService.saveTrialLocation(user.uid, trialLocation);
      showSuccess('Trial search location updated successfully!');
      onClose();
      if (setMessages) {
        setMessages(prev => [...prev, {
          type: 'ai',
          text: 'Trial search location updated successfully!'
        }]);
      }
    } catch (error) {
      showError('Failed to save location settings. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-white w-full h-full md:h-auto md:max-w-lg md:rounded-xl md:max-h-[85vh] flex flex-col animate-slide-up">
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <h3 className={combineClasses('text-lg font-semibold', DesignTokens.colors.neutral.text[900])}>Trial Search Location</h3>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className={combineClasses('p-2 rounded-lg transition', DesignTokens.colors.neutral[100].replace('bg-', 'hover:bg-'))}
            type="button"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className={combineClasses('border rounded-lg p-3', DesignTokens.components.status.normal.bg, DesignTokens.components.status.normal.border)}>
            <div className="flex items-start gap-2">
              <AlertCircle className={combineClasses('w-5 h-5 mt-0.5 flex-shrink-0', DesignTokens.components.status.normal.icon)} />
              <div className="flex-1">
                <p className={combineClasses('text-sm font-medium', DesignTokens.components.status.normal.text.replace('600', '900'))}>Trial Matching</p>
                <p className={combineClasses('text-xs mt-0.5', DesignTokens.components.status.normal.text.replace('600', '700'))}>
                  Your location helps us find clinical trials from ClinicalTrials.gov. You can enable global search to include international trials.
                </p>
              </div>
            </div>
          </div>

          <div className={combineClasses('border rounded-lg p-4', DesignTokens.colors.primary[50], DesignTokens.colors.primary.border[200])}>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={trialLocation.includeAllLocations}
                onChange={(e) => setTrialLocation({ ...trialLocation, includeAllLocations: e.target.checked })}
                className={combineClasses('mt-1 w-4 h-4 rounded', DesignTokens.components.status.normal.text, 'focus:ring-medical-primary-500')}
              />
              <div>
                <p className={combineClasses('font-semibold', DesignTokens.colors.neutral.text[800])}>Include Global Locations</p>
                <p className={combineClasses('text-xs mt-1', DesignTokens.colors.neutral.text[600])}>
                  Search international databases for all available clinical trials worldwide
                </p>
              </div>
            </label>
          </div>

          <div className={trialLocation.includeAllLocations ? 'opacity-50' : ''}>
            <h4 className={combineClasses('font-semibold mb-3', DesignTokens.colors.neutral.text[800])}>Search Country</h4>
            <div>
              <label className={combineClasses('block text-sm font-medium mb-1', DesignTokens.colors.neutral.text[700])}>Country</label>
              <select
                value={trialLocation.country}
                onChange={(e) => setTrialLocation({ ...trialLocation, country: e.target.value })}
                disabled={trialLocation.includeAllLocations}
                className={combineClasses('w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-medical-primary-500', DesignTokens.colors.neutral.border[300], DesignTokens.components.input.disabled)}
              >
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <p className={combineClasses('text-xs mt-1', DesignTokens.colors.neutral.text[500])}>
                {trialLocation.includeAllLocations 
                  ? 'Global search is enabled - country selection disabled'
                  : 'Trials will be searched within this country'}
              </p>
            </div>
          </div>

          <div className={combineClasses('rounded-lg p-3', DesignTokens.colors.neutral[50])}>
            <h5 className={combineClasses('text-sm font-semibold mb-2', DesignTokens.colors.neutral.text[800])}>Database</h5>
            <div className={combineClasses('space-y-1 text-xs', DesignTokens.colors.neutral.text[600])}>
              <div className="flex items-center gap-2">
                <div className={combineClasses('w-1 h-1 rounded-full', DesignTokens.components.status.normal.icon.replace('text-', 'bg-'))}></div>
                <span>ClinicalTrials.gov</span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t p-4 flex gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className={combineClasses('flex-1 py-2.5 rounded-lg font-medium transition flex items-center justify-center gap-2', DesignTokens.colors.neutral[200], DesignTokens.colors.neutral.text[700], DesignTokens.colors.neutral[300].replace('bg-', 'hover:bg-'))}
          >
            <X className="w-4 h-4" />
            Cancel
          </button>
          <button
            onClick={handleSave}
            className={combineClasses('flex-1 text-white py-2.5 rounded-lg font-medium transition flex items-center justify-center gap-2', DesignTokens.components.status.normal.text.replace('text-', 'bg-').replace('600', '600'), DesignTokens.components.status.normal.text.replace('text-', 'hover:bg-').replace('600', '700'))}
          >
            <Check className="w-4 h-4" />
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

