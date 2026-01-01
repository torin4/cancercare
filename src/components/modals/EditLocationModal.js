import React from 'react';
import { X, AlertCircle, Check } from 'lucide-react';
import { COUNTRIES } from '../../constants/countries';
import { trialLocationService } from '../../firebase/services';

export default function EditLocationModal({
  show,
  onClose,
  user,
  trialLocation,
  setTrialLocation,
  setMessages
}) {
  if (!show) return null;

  const handleSave = async () => {
    try {
      await trialLocationService.saveTrialLocation(user.uid, trialLocation);
      onClose();
      if (setMessages) {
        setMessages(prev => [...prev, {
          type: 'ai',
          text: 'Trial search location updated successfully!'
        }]);
      }
    } catch (error) {
      console.error('Error saving trial location:', error);
      alert('Failed to save location settings. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white w-full h-full sm:h-auto sm:max-w-lg sm:rounded-xl sm:max-h-[85vh] flex flex-col animate-slide-up">
        <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
          <h3 className="text-lg font-semibold text-gray-900">Trial Search Location</h3>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
            type="button"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-900">Trial Matching</p>
                <p className="text-xs text-green-700 mt-0.5">
                  Your location helps us find clinical trials from ClinicalTrials.gov. You can enable global search to include international trials.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={trialLocation.includeAllLocations}
                onChange={(e) => setTrialLocation({ ...trialLocation, includeAllLocations: e.target.checked })}
                className="mt-1 w-4 h-4 text-green-600 rounded focus:ring-green-500"
              />
              <div>
                <p className="font-semibold text-gray-800">Include Global Locations</p>
                <p className="text-xs text-gray-600 mt-1">
                  Search international databases for all available clinical trials worldwide
                </p>
              </div>
            </label>
          </div>

          <div className={trialLocation.includeAllLocations ? 'opacity-50' : ''}>
            <h4 className="font-semibold text-gray-800 mb-3">Search Country</h4>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
              <select
                value={trialLocation.country}
                onChange={(e) => setTrialLocation({ ...trialLocation, country: e.target.value })}
                disabled={trialLocation.includeAllLocations}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
              >
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {trialLocation.includeAllLocations 
                  ? 'Global search is enabled - country selection disabled'
                  : 'Trials will be searched within this country'}
              </p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-3">
            <h5 className="text-sm font-semibold text-gray-800 mb-2">Database</h5>
            <div className="space-y-1 text-xs text-gray-600">
              <div className="flex items-center gap-2">
                <div className="w-1 h-1 bg-green-600 rounded-full"></div>
                <span>ClinicalTrials.gov</span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t p-4 flex gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-200 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-300 transition flex items-center justify-center gap-2"
          >
            <X className="w-4 h-4" />
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 bg-green-600 text-white py-2.5 rounded-lg font-medium hover:bg-green-700 transition flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

