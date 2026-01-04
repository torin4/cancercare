import React, { useState, useEffect } from 'react';
import { X, Trash2, Save, Calendar } from 'lucide-react';
import { DesignTokens, combineClasses } from '../../design/designTokens';
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
  const [labNormalRange, setLabNormalRange] = useState('');
  const [values, setValues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingValueId, setDeletingValueId] = useState(null);

  useEffect(() => {
    if (show && lab) {
      setLabName(lab.name || '');
      setLabUnit(lab.unit || '');
      setLabNormalRange(lab.normalRange || '');
      setLoading(true);
      // Load fresh values from Firestore
      const loadValues = async () => {
        try {
          if (lab.id) {
            const freshValues = await labService.getLabValues(lab.id);
            // Transform to match the format expected by the UI
            const transformedValues = (freshValues || []).map(v => {
              let date;
              if (v.date?.toDate) {
                const firestoreDate = v.date.toDate();
                date = new Date(firestoreDate.getFullYear(), firestoreDate.getMonth(), firestoreDate.getDate());
              } else if (v.date) {
                date = v.date instanceof Date ? v.date : new Date(v.date);
              } else {
                date = new Date();
              }
              
              return {
                id: v.id,
                value: v.value,
                date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                dateOriginal: date,
                timestamp: date.getTime(),
                notes: v.notes || ''
              };
            });
            
            // Sort by date (newest first)
            const sortedValues = transformedValues.sort((a, b) => b.timestamp - a.timestamp);
            setValues(sortedValues);
          } else {
            // Fallback to lab.data if no ID
            const sortedValues = [...(lab.data || [])].sort((a, b) => {
              const dateA = a.timestamp || (a.dateOriginal ? a.dateOriginal.getTime() : 0);
              const dateB = b.timestamp || (b.dateOriginal ? b.dateOriginal.getTime() : 0);
              return dateB - dateA;
            });
            setValues(sortedValues);
          }
        } catch (error) {
          // Fallback to lab.data
          const sortedValues = [...(lab.data || [])].sort((a, b) => {
            const dateA = a.timestamp || (a.dateOriginal ? a.dateOriginal.getTime() : 0);
            const dateB = b.timestamp || (b.dateOriginal ? b.dateOriginal.getTime() : 0);
            return dateB - dateA;
          });
          setValues(sortedValues);
        } finally {
          setLoading(false);
        }
      };
      
      loadValues();
    }
  }, [show, lab]);

  const handleSave = async () => {
    if (!lab || !lab.id || !user) return;

    setIsSaving(true);
    try {
      // Update lab document with new name, unit, and normal range
      await labService.saveLab({
        id: lab.id,
        label: labName,
        unit: labUnit,
        normalRange: labNormalRange || null,
        patientId: user.uid
      });

      if (onSave) {
        await onSave();
      }

      onClose();
      setIsSaving(false);
    } catch (error) {
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
        <div className={combineClasses('flex items-center justify-between p-6 border-b', DesignTokens.colors.neutral.border[200])}>
          <h2 className={combineClasses('text-xl font-bold', DesignTokens.colors.neutral.text[900])}>Edit Metric</h2>
          <button
            onClick={onClose}
            className={combineClasses('transition-colors', DesignTokens.colors.neutral.text[400], DesignTokens.colors.neutral.text[600].replace('text-', 'hover:text-'))}
            disabled={isSaving}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Metric Name */}
          <div>
            <label className={combineClasses('block text-sm font-medium mb-2', DesignTokens.colors.neutral.text[700])}>
              Metric Name
            </label>
            <input
              type="text"
              value={labName}
              onChange={(e) => setLabName(e.target.value)}
              className={combineClasses('w-full px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-medical-primary-500 focus:border-medical-primary-500 text-sm', DesignTokens.components.input.base)}
              placeholder="Enter metric name"
              disabled={isSaving}
            />
          </div>

          {/* Unit */}
          <div>
            <label className={combineClasses('block text-sm font-medium mb-2', DesignTokens.colors.neutral.text[700])}>
              Unit
            </label>
            <input
              type="text"
              value={labUnit}
              onChange={(e) => setLabUnit(e.target.value)}
              className={combineClasses('w-full px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-medical-primary-500 focus:border-medical-primary-500 text-sm', DesignTokens.components.input.base)}
              placeholder="Enter unit (e.g., mg/dL, U/mL)"
              disabled={isSaving}
            />
          </div>

          {/* Normal Range */}
          <div>
            <label className={combineClasses('block text-sm font-medium mb-2', DesignTokens.colors.neutral.text[700])}>
              Normal Range
            </label>
            <input
              type="text"
              value={labNormalRange}
              onChange={(e) => setLabNormalRange(e.target.value)}
              className={combineClasses('w-full px-4 py-2.5 rounded-lg focus:ring-2 focus:ring-medical-primary-500 focus:border-medical-primary-500 text-sm', DesignTokens.components.input.base)}
              placeholder="Enter normal range (e.g., <0.3, 0-35, 4.5-11.0)"
              disabled={isSaving}
            />
          </div>

          {/* Values List */}
          <div>
            <label className={combineClasses('block text-sm font-medium mb-3', DesignTokens.colors.neutral.text[700])}>
              Values ({values.length})
            </label>
            {values.length === 0 ? (
              <div className={combineClasses('text-center py-8 rounded-lg', DesignTokens.colors.neutral.text[500], DesignTokens.colors.neutral.border[200])}>
                <p>No values recorded</p>
              </div>
            ) : (
              <div className={combineClasses('border rounded-lg overflow-hidden', DesignTokens.colors.neutral.border[200])}>
                <div className="max-h-96 overflow-y-auto">
                  {values.map((value, index) => (
                    <div
                      key={value.id || index}
                      className={combineClasses('flex items-center justify-between p-4 last:border-b-0 transition-colors', DesignTokens.colors.neutral.border[100], DesignTokens.colors.neutral[50].replace('bg-', 'hover:bg-'))}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <Calendar className={combineClasses('w-4 h-4', DesignTokens.colors.neutral.text[400])} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className={combineClasses('font-medium', DesignTokens.colors.neutral.text[900])}>
                              {value.value}
                            </span>
                            <span className={combineClasses('text-sm', DesignTokens.colors.neutral.text[500])}>
                              {labUnit || 'units'}
                            </span>
                          </div>
                          <div className={combineClasses('text-sm mt-1', DesignTokens.colors.neutral.text[500])}>
                            {formatDate(value)}
                            {value.notes && (
                              <span className={combineClasses('ml-2', DesignTokens.colors.neutral.text[400])}>
                                • {value.notes}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteValue(value.id)}
                        disabled={deletingValueId === value.id || isSaving}
                        className={combineClasses('p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation active:opacity-70', DesignTokens.components.alert.text.error, DesignTokens.components.alert.text.error.replace('600', '700').replace('text-', 'hover:text-'), DesignTokens.components.status.high.bg.replace('bg-', 'hover:bg-'))}
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
        <div className={combineClasses('flex items-center justify-end gap-3 p-6 border-t', DesignTokens.colors.neutral.border[200])}>
          <button
            onClick={onClose}
            disabled={isSaving}
            className={combineClasses('px-4 py-2.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] touch-manipulation active:opacity-70', DesignTokens.colors.neutral.text[700], DesignTokens.colors.neutral[100].replace('bg-', 'hover:bg-'))}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !labName.trim()}
            className={combineClasses('px-4 py-2.5 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-h-[44px] touch-manipulation active:opacity-70', DesignTokens.colors.primary[600], DesignTokens.colors.primary[700].replace('bg-', 'hover:bg-'))}
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

