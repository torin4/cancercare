import React, { useState, useEffect } from 'react';
import { X, Trash2, Save, Calendar } from 'lucide-react';
import { labService } from '../../firebase/services';

export default function EditLabModal({
  show,
  onClose,
  lab,
  labKey,
  onSave,
  onDeleteValue,
  user
}) {
  const [labName, setLabName] = useState('');
  const [labUnit, setLabUnit] = useState('');
  const [values, setValues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingValueId, setDeletingValueId] = useState(null);

  useEffect(() => {
    if (show && lab) {
      setLabName(lab.name || '');
      setLabUnit(lab.unit || '');
      // Sort values by date (newest first)
      const sortedValues = [...(lab.data || [])].sort((a, b) => {
        const dateA = a.timestamp || (a.dateOriginal ? a.dateOriginal.getTime() : 0);
        const dateB = b.timestamp || (b.dateOriginal ? b.dateOriginal.getTime() : 0);
        return dateB - dateA;
      });
      setValues(sortedValues);
    }
  }, [show, lab]);

  const handleSave = async () => {
    if (!lab || !lab.id || !user) return;

    setIsSaving(true);
    try {
      // Update lab document with new name and unit
      await labService.saveLab({
        id: lab.id,
        label: labName,
        unit: labUnit,
        patientId: user.uid
      });

      if (onSave) {
        await onSave();
      }

      onClose();
      setIsSaving(false);
    } catch (error) {
      console.error('Error saving lab:', error);
      setIsSaving(false);
      throw error;
    }
  };

  const handleDeleteValue = async (valueId) => {
    if (!lab || !lab.id || !user || !valueId) return;

    setDeletingValueId(valueId);
    try {
      // Use the existing deleteLabValue function
      if (onDeleteValue) {
        await onDeleteValue(lab.id, valueId, labKey);
      } else {
        await labService.deleteLabValue(lab.id, valueId);
      }

      // Remove from local state
      setValues(prev => prev.filter(v => v.id !== valueId));
    } catch (error) {
      console.error('Error deleting value:', error);
    } finally {
      setDeletingValueId(null);
    }
  };

  const formatDate = (value) => {
    if (value.dateOriginal) {
      return value.dateOriginal.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    }
    if (value.date) {
      return value.date;
    }
    if (value.timestamp) {
      return new Date(value.timestamp).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    }
    return 'Unknown date';
  };

  if (!show || !lab) return null;

  return (
    <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Edit Metric</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isSaving}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Metric Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Metric Name
            </label>
            <input
              type="text"
              value={labName}
              onChange={(e) => setLabName(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary-500 focus:border-medical-primary-500 text-sm"
              placeholder="Enter metric name"
              disabled={isSaving}
            />
          </div>

          {/* Unit */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Unit
            </label>
            <input
              type="text"
              value={labUnit}
              onChange={(e) => setLabUnit(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-medical-primary-500 focus:border-medical-primary-500 text-sm"
              placeholder="Enter unit (e.g., mg/dL, U/mL)"
              disabled={isSaving}
            />
          </div>

          {/* Values List */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Values ({values.length})
            </label>
            {values.length === 0 ? (
              <div className="text-center py-8 text-gray-500 border border-gray-200 rounded-lg">
                <p>No values recorded</p>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="max-h-96 overflow-y-auto">
                  {values.map((value, index) => (
                    <div
                      key={value.id || index}
                      className="flex items-center justify-between p-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">
                              {value.value}
                            </span>
                            <span className="text-sm text-gray-500">
                              {labUnit || 'units'}
                            </span>
                          </div>
                          <div className="text-sm text-gray-500 mt-1">
                            {formatDate(value)}
                            {value.notes && (
                              <span className="ml-2 text-gray-400">
                                • {value.notes}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteValue(value.id)}
                        disabled={deletingValueId === value.id || isSaving}
                        className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation active:opacity-70"
                        title="Delete value"
                      >
                        {deletingValueId === value.id ? (
                          <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] touch-manipulation active:opacity-70"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !labName.trim()}
            className="px-4 py-2.5 text-sm font-medium text-white bg-medical-primary-600 hover:bg-medical-primary-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-h-[44px] touch-manipulation active:opacity-70"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

