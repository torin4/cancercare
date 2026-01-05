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

  // Load values function - can be called independently
  const loadValues = React.useCallback(async () => {
    if (!lab || !lab.id) {
      // Fallback to lab.data if no ID
      const sortedValues = [...(lab?.data || [])].sort((a, b) => {
        const dateA = a.timestamp || (a.dateOriginal ? a.dateOriginal.getTime() : 0);
        const dateB = b.timestamp || (b.dateOriginal ? b.dateOriginal.getTime() : 0);
        return dateB - dateA;
      });
      setValues(sortedValues);
      setLoading(false);
      return;
    }

      setLoading(true);
        try {
      // Always fetch fresh values from Firestore to ensure we have all values
            const freshValues = await labService.getLabValues(lab.id);
      console.log(`EditLabModal: Loaded ${freshValues?.length || 0} values for lab ${lab.id} (${lab.name || lab.label})`);
      
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
        } catch (error) {
      console.error('Error loading lab values:', error);
          // Fallback to lab.data
      const sortedValues = [...(lab?.data || [])].sort((a, b) => {
            const dateA = a.timestamp || (a.dateOriginal ? a.dateOriginal.getTime() : 0);
            const dateB = b.timestamp || (b.dateOriginal ? b.dateOriginal.getTime() : 0);
            return dateB - dateA;
          });
          setValues(sortedValues);
        } finally {
          setLoading(false);
        }
  }, [lab]);
      
  useEffect(() => {
    if (show && lab) {
      console.log('EditLabModal: Modal opened', { 
        labId: lab.id, 
        labName: lab.name || lab.label, 
        labKey,
        hasUser: !!user,
        valuesCount: lab.data?.length || 0
      });
      setLabName(lab.name || lab.label || '');
      setLabUnit(lab.unit || '');
      setLabNormalRange(lab.normalRange || '');
      // Always reload values when modal opens
      loadValues();
    } else if (!show) {
      // Reset when modal closes
      setValues([]);
      setLoading(false);
    }
  }, [show, lab, loadValues, labKey, user]);

  const handleSave = async () => {
    if (!lab || !lab.id || !user) return;

    setIsSaving(true);
    try {
      // Update lab document with new name, unit, and normal range
      // Note: Firestore uses 'name' field, but we also update 'label' for compatibility
      await labService.saveLab({
        id: lab.id,
        name: labName,
        label: labName, // Also update label for backward compatibility
        unit: labUnit,
        normalRange: labNormalRange || null,
        patientId: user.uid
      });

      // Reload values after saving to ensure UI is up to date
      await loadValues();

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
    console.log('EditLabModal: handleDeleteValue called', { valueId, lab: lab?.id, labName: lab?.name || lab?.label, user: user?.uid, labKey });
    
    if (!lab || !lab.id || !user || !valueId) {
      console.error('EditLabModal: Cannot delete - missing required data', { lab: lab?.id, valueId, user: user?.uid });
      return;
    }

    setDeletingValueId(valueId);
    try {
      console.log('EditLabModal: Attempting to delete value', { labId: lab.id, labName: lab.name || lab.label, valueId });
      
      // Use the existing deleteLabValue function
      if (onDeleteValue) {
        await onDeleteValue(lab.id, valueId, labKey);
      } else {
        await labService.deleteLabValue(lab.id, valueId);
      }

      console.log('EditLabModal: Value deleted successfully, reloading...');
      // Reload values from Firestore to ensure we have the latest data
      await loadValues();
    } catch (error) {
      console.error('EditLabModal: Error deleting value', { 
        error: error.message, 
        stack: error.stack,
        labId: lab.id, 
        labName: lab.name || lab.label,
        valueId 
      });
      // Re-throw so parent can handle it (show error message)
      throw error;
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
    <div className={combineClasses(DesignTokens.components.modal.backdrop, 'z-[101] animate-in fade-in duration-200')}>
      <div className={combineClasses('bg-white max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col', DesignTokens.borders.radius.lg, DesignTokens.shadows.xl)}>
        {/* Header */}
        <div className={combineClasses('flex items-center justify-between border-b', DesignTokens.components.modal.header, DesignTokens.colors.neutral.border[200])}>
          <h2 className={combineClasses(DesignTokens.typography.h1.full, DesignTokens.typography.h1.weight, DesignTokens.colors.neutral.text[900])}>Edit Metric</h2>
          <button
            onClick={onClose}
            className={combineClasses(DesignTokens.transitions.default, DesignTokens.components.modal.closeButton)}
            disabled={isSaving}
          >
            <X className={DesignTokens.icons.header.size.full} />
          </button>
        </div>

        {/* Content */}
        <div className={combineClasses('flex-1 overflow-y-auto', DesignTokens.components.modal.body, 'space-y-6', DesignTokens.spacing.gap.lg)}>
          {/* Metric Name */}
          <div>
            <label className={combineClasses('block', DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, 'mb-2', DesignTokens.colors.neutral.text[700])}>
              Metric Name
            </label>
            <input
              type="text"
              value={labName}
              onChange={(e) => setLabName(e.target.value)}
              className={combineClasses(DesignTokens.components.input.base, DesignTokens.borders.radius.sm, 'focus:ring-2 focus:ring-medical-primary-500 focus:border-medical-primary-500')}
              placeholder="Enter metric name"
              disabled={isSaving}
            />
          </div>

          {/* Unit */}
          <div>
            <label className={combineClasses('block', DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, 'mb-2', DesignTokens.colors.neutral.text[700])}>
              Unit
            </label>
            <input
              type="text"
              value={labUnit}
              onChange={(e) => setLabUnit(e.target.value)}
              className={combineClasses(DesignTokens.components.input.base, DesignTokens.borders.radius.sm, 'focus:ring-2 focus:ring-medical-primary-500 focus:border-medical-primary-500')}
              placeholder="Enter unit (e.g., mg/dL, U/mL)"
              disabled={isSaving}
            />
          </div>

          {/* Normal Range */}
          <div>
            <label className={combineClasses('block', DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, 'mb-2', DesignTokens.colors.neutral.text[700])}>
              Normal Range
            </label>
            <input
              type="text"
              value={labNormalRange}
              onChange={(e) => setLabNormalRange(e.target.value)}
              className={combineClasses(DesignTokens.components.input.base, DesignTokens.borders.radius.sm, 'focus:ring-2 focus:ring-medical-primary-500 focus:border-medical-primary-500')}
              placeholder="Enter normal range (e.g., <0.3, 0-35, 4.5-11.0)"
              disabled={isSaving}
            />
          </div>

          {/* Values List */}
          <div>
            <label className={combineClasses('block', DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, 'mb-3', DesignTokens.colors.neutral.text[700])}>
              Values ({values.length})
            </label>
            {values.length === 0 ? (
              <div className={combineClasses('text-center py-8', DesignTokens.borders.radius.sm, DesignTokens.colors.neutral.text[500], DesignTokens.colors.neutral.border[200])}>
                <p>No values recorded</p>
              </div>
            ) : (
              <div className={combineClasses(DesignTokens.borders.width.default, DesignTokens.borders.radius.sm, 'overflow-hidden', DesignTokens.colors.neutral.border[200])}>
                <div className="max-h-96 overflow-y-auto">
                  {values.map((value, index) => {
                    console.log('EditLabModal: Rendering value', { index, valueId: value.id, value, hasLabId: !!lab?.id });
                    return (
                    <div
                      key={value.id || index}
                      className={combineClasses('flex items-center justify-between last:border-b-0', DesignTokens.spacing.card.mobile, DesignTokens.transitions.default, DesignTokens.colors.neutral.border[100], DesignTokens.colors.neutral[50].replace('bg-', 'hover:bg-'))}
                    >
                      <div className={combineClasses('flex items-center flex-1', DesignTokens.spacing.gap.md)}>
                        <Calendar className={combineClasses(DesignTokens.icons.standard.size.full, DesignTokens.colors.neutral.text[400])} />
                        <div className="flex-1">
                          <div className={combineClasses('flex items-center', DesignTokens.spacing.gap.sm)}>
                            <span className={combineClasses(DesignTokens.typography.h3.weight, DesignTokens.colors.neutral.text[900])}>
                              {value.value}
                            </span>
                            <span className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.colors.neutral.text[500])}>
                              {labUnit || 'units'}
                            </span>
                          </div>
                          <div className={combineClasses(DesignTokens.typography.body.sm, 'mt-1', DesignTokens.colors.neutral.text[500])}>
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
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log('EditLabModal: Delete button clicked', { valueId: value.id, value, hasLabId: !!lab?.id, hasUser: !!user });
                          handleDeleteValue(value.id);
                        }}
                        disabled={deletingValueId === value.id || isSaving}
                        className={combineClasses(DesignTokens.spacing.iconContainer.mobile, DesignTokens.borders.radius.sm, DesignTokens.transitions.default, 'disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation active:opacity-70', DesignTokens.components.alert.text.error, DesignTokens.components.alert.text.error.replace('600', '700').replace('text-', 'hover:text-'), DesignTokens.components.status.high.bg.replace('bg-', 'hover:bg-'))}
                        title="Delete value"
                      >
                        {deletingValueId === value.id ? (
                          <div className={combineClasses(DesignTokens.icons.standard.size.full, 'border-2 border-red-600 border-t-transparent rounded-full animate-spin')} />
                        ) : (
                          <Trash2 className={DesignTokens.icons.standard.size.full} />
                        )}
                      </button>
                    </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className={combineClasses('flex items-center justify-end border-t', DesignTokens.components.modal.footer, DesignTokens.colors.neutral.border[200])}>
          <div className={combineClasses('flex', DesignTokens.spacing.gap.md)}>
          <button
            onClick={onClose}
            disabled={isSaving}
              className={combineClasses(DesignTokens.spacing.button.full, 'py-2.5', DesignTokens.borders.radius.sm, DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, DesignTokens.transitions.default, 'disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] touch-manipulation active:opacity-70', DesignTokens.components.button.secondary)}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !labName.trim()}
              className={combineClasses(DesignTokens.spacing.button.full, 'py-2.5 text-white', DesignTokens.borders.radius.sm, DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, DesignTokens.transitions.default, 'disabled:opacity-50 disabled:cursor-not-allowed flex items-center min-h-[44px] touch-manipulation active:opacity-70', DesignTokens.spacing.gap.sm, DesignTokens.components.button.primary)}
          >
            {isSaving ? (
              <>
                  <div className={combineClasses(DesignTokens.icons.standard.size.full, 'border-2 border-white border-t-transparent rounded-full animate-spin')} />
                Saving...
              </>
            ) : (
              <>
                  <Save className={DesignTokens.icons.standard.size.full} />
                Save Changes
              </>
            )}
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}

