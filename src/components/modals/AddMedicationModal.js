import React from 'react';
import { X, AlertCircle, Plus } from 'lucide-react';
import { useBanner } from '../../contexts/BannerContext';
import DatePicker from '../DatePicker';

export default function AddMedicationModal({ show, onClose }) {
  const { showSuccess } = useBanner();
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-white w-full h-full md:h-auto md:rounded-2xl md:max-w-md md:max-h-[85vh] overflow-hidden flex flex-col animate-slide-up">
        <div className="flex-shrink-0 bg-white border-b p-4 flex items-center justify-between">
          <h3 className="font-bold text-lg text-gray-800">Add Medication</h3>
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
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900">Medication Tracking</p>
                  <p className="text-xs text-blue-700 mt-1">
                    Add any medication to track dosage, schedule, and adherence.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Medication Name <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g., Paclitaxel, Ibuprofen"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dosage <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., 20"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Unit <span className="text-red-600">*</span>
                </label>
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select...</option>
                  <option value="mg">mg</option>
                  <option value="mg/m²">mg/m²</option>
                  <option value="mg/kg">mg/kg</option>
                  <option value="mcg">mcg</option>
                  <option value="mL">mL</option>
                  <option value="units">units</option>
                  <option value="tablets">tablet(s)</option>
                  <option value="capsules">capsule(s)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Frequency <span className="text-red-600">*</span>
              </label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select frequency...</option>
                <option value="once-daily">Once daily</option>
                <option value="twice-daily">Twice daily</option>
                <option value="three-daily">Three times daily</option>
                <option value="four-daily">Four times daily</option>
                <option value="every-other">Every other day</option>
                <option value="weekly">Weekly</option>
                <option value="every-2-weeks">Every 2 weeks</option>
                <option value="every-3-weeks">Every 3 weeks</option>
                <option value="monthly">Monthly</option>
                <option value="as-needed">As needed</option>
                <option value="custom">Custom</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Time(s) of Day
              </label>
              <input
                type="text"
                placeholder="e.g., 8:00 AM, 8:00 PM"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">For daily medications, specify times</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Purpose/Type <span className="text-red-600">*</span>
              </label>
              <select className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Select purpose...</option>
                <option value="chemotherapy">Chemotherapy</option>
                <option value="targeted">Targeted therapy</option>
                <option value="immunotherapy">Immunotherapy</option>
                <option value="hormone">Hormone therapy</option>
                <option value="anti-nausea">Anti-nausea</option>
                <option value="pain">Pain management</option>
                <option value="anti-inflammatory">Anti-inflammatory</option>
                <option value="antibiotic">Antibiotic</option>
                <option value="stomach">Stomach protection</option>
                <option value="vitamin">Vitamin/Supplement</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <DatePicker
                  value=""
                  onChange={() => {}}
                  placeholder="Select start date"
                />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Special Instructions <span className="text-gray-500 text-xs">(optional)</span>
              </label>
              <textarea
                rows="2"
                placeholder="e.g., Take with food, Avoid grapefruit"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              ></textarea>
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
              onClick={() => {
                showSuccess('Medication added successfully!');
                onClose();
              }}
              className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Medication
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

