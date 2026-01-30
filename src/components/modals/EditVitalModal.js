import React, { useState, useEffect } from 'react';
import { X, Trash2, Save, Calendar } from 'lucide-react';
import { DesignTokens, combineClasses } from '../../design/designTokens';
import { vitalService } from '../../firebase/services';
import { getVitalDisplayName } from '../../utils/normalizationUtils';

export default function EditVitalModal({
  show,
  onClose,
  vital,
  vitalKey,
  onSave,
  onDeleteValue,
  user
}) {
  const [vitalLabel, setVitalLabel] = useState('');
  const [vitalUnit, setVitalUnit] = useState('');
  const [vitalNormalRange, setVitalNormalRange] = useState('');
  const [values, setValues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingValueId, setDeletingValueId] = useState(null);

  const loadValues = React.useCallback(async () => {
    if (!vital || !vital.id) {
      const sortedValues = [...(vital?.data || [])].sort((a, b) => {
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
      const freshValues = await vitalService.getVitalValues(vital.id);
      const transformedValues = (freshValues || []).map((v) => {
        let date;
        if (v.date?.toDate) {
          const firestoreDate = v.date.toDate();
          date = new Date(firestoreDate.getFullYear(), firestoreDate.getMonth(), firestoreDate.getDate());
        } else if (v.date) {
          date = v.date instanceof Date ? v.date : new Date(v.date);
        } else {
          date = new Date();
        }
        let displayValue = v.value;
        if (v.systolic != null && v.diastolic != null) {
          displayValue = `${v.systolic}/${v.diastolic}`;
        }
        return {
          id: v.id,
          value: displayValue,
          date,
          dateOriginal: date,
          timestamp: date.getTime(),
          notes: v.notes || ''
        };
      });
      const sortedValues = transformedValues.sort((a, b) => b.timestamp - a.timestamp);
      setValues(sortedValues);
    } catch (error) {
      const sortedValues = [...(vital?.data || [])].sort((a, b) => {
        const dateA = a.timestamp || (a.dateOriginal ? a.dateOriginal.getTime() : 0);
        const dateB = b.timestamp || (b.dateOriginal ? b.dateOriginal.getTime() : 0);
        return dateB - dateA;
      });
      setValues(sortedValues);
    } finally {
      setLoading(false);
    }
  }, [vital]);

  useEffect(() => {
    if (show && vital) {
      const displayName = getVitalDisplayName(vitalKey) || vital.name || vital.label || vitalKey;
      setVitalLabel(displayName);
      setVitalUnit(vital.unit || '');
      setVitalNormalRange(vital.normalRange || '');
      loadValues();
    } else if (!show) {
      setValues([]);
      setLoading(false);
    }
  }, [show, vital, vitalKey, loadValues]);

  const handleSave = async () => {
    if (!vital || !vital.id || !user) return;

    setIsSaving(true);
    try {
      await vitalService.saveVital({
        id: vital.id,
        label: vitalLabel.trim() || getVitalDisplayName(vitalKey),
        vitalType: vital.vitalType || vitalKey,
        unit: vitalUnit || '',
        normalRange: vitalNormalRange.trim() || null,
        patientId: user.uid
      });

      await loadValues();
      if (onSave) await onSave();
      onClose();
    } catch (error) {
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteValue = async (valueId) => {
    if (!vital || !vital.id || !user || !valueId) return;

    setDeletingValueId(valueId);
    try {
      if (onDeleteValue) {
        await onDeleteValue(vital.id, valueId, vitalKey);
      } else {
        await vitalService.deleteVitalValue(vital.id, valueId);
      }
      await loadValues();
    } catch (error) {
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
      return value.date instanceof Date
        ? value.date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
        : value.date;
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

  if (!show || !vital) return null;

  return (
    <div className={combineClasses(DesignTokens.components.modal.backdrop, 'z-[101] animate-in fade-in duration-200')}>
      <div
        className={combineClasses(
          'bg-white max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col',
          DesignTokens.borders.radius.lg,
          DesignTokens.shadows.xl
        )}
      >
        <div className={DesignTokens.components.modal.header}>
          <h2 className={combineClasses(DesignTokens.typography.h1.full, DesignTokens.typography.h1.weight, DesignTokens.colors.primary.text[700])}>
            Edit Vital Metric
          </h2>
          <button
            onClick={onClose}
            className={combineClasses(DesignTokens.transitions.default, DesignTokens.components.modal.closeButton)}
            disabled={isSaving}
          >
            <X className={DesignTokens.icons.header.size.full} />
          </button>
        </div>

        <div className={combineClasses('flex-1 overflow-y-auto', DesignTokens.components.modal.body, 'space-y-6', DesignTokens.spacing.gap.lg)}>
          <div>
            <label className={combineClasses('block', DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, 'mb-2', DesignTokens.colors.neutral.text[700])}>
              Metric Name
            </label>
            <input
              type="text"
              value={vitalLabel}
              onChange={(e) => setVitalLabel(e.target.value)}
              className={combineClasses(DesignTokens.components.input.base, DesignTokens.borders.radius.sm)}
              placeholder="e.g., Blood Pressure, Temperature"
              disabled={isSaving}
            />
          </div>

          <div>
            <label className={combineClasses('block', DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, 'mb-2', DesignTokens.colors.neutral.text[700])}>
              Unit
            </label>
            <input
              type="text"
              value={vitalUnit}
              onChange={(e) => setVitalUnit(e.target.value)}
              className={combineClasses(DesignTokens.components.input.base, DesignTokens.borders.radius.sm)}
              placeholder="e.g., mmHg, °F, kg, BPM"
              disabled={isSaving}
            />
          </div>

          <div>
            <label className={combineClasses('block', DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, 'mb-2', DesignTokens.colors.neutral.text[700])}>
              Normal Range
            </label>
            <input
              type="text"
              value={vitalNormalRange}
              onChange={(e) => setVitalNormalRange(e.target.value)}
              className={combineClasses(DesignTokens.components.input.base, DesignTokens.borders.radius.sm)}
              placeholder="e.g., <140/90, 97.5-99.5, 60-100"
              disabled={isSaving}
            />
            <p className={combineClasses('text-xs mt-1', DesignTokens.colors.neutral.text[500])}>
              For BP use format like &lt;140/90. For ranges use min-max (e.g., 60-100).
            </p>
          </div>

          <div>
            <label className={combineClasses('block', DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, 'mb-3', DesignTokens.colors.neutral.text[700])}>
              Values ({values.length})
            </label>
            {loading ? (
              <div className={combineClasses('text-center py-8', DesignTokens.colors.neutral.text[500])}>Loading...</div>
            ) : values.length === 0 ? (
              <div className={combineClasses('text-center py-8', DesignTokens.borders.radius.sm, DesignTokens.colors.neutral.text[500], DesignTokens.colors.neutral.border[200])}>
                <p>No values recorded</p>
              </div>
            ) : (
              <div className={combineClasses(DesignTokens.borders.width.default, DesignTokens.borders.radius.sm, 'overflow-hidden', DesignTokens.colors.neutral.border[200])}>
                <div className="max-h-96 overflow-y-auto">
                  {values.map((value, index) => (
                    <div
                      key={value.id || index}
                      className={combineClasses(
                        'flex items-center justify-between last:border-b-0',
                        DesignTokens.spacing.card.mobile,
                        DesignTokens.transitions.default,
                        DesignTokens.colors.neutral.border[100],
                        DesignTokens.colors.neutral[50].replace('bg-', 'hover:bg-')
                      )}
                    >
                      <div className={combineClasses('flex items-center flex-1', DesignTokens.spacing.gap.md)}>
                        <Calendar className={combineClasses(DesignTokens.icons.standard.size.full, DesignTokens.colors.neutral.text[400])} />
                        <div className="flex-1">
                          <div className={combineClasses('flex items-center', DesignTokens.spacing.gap.sm)}>
                            <span className={combineClasses(DesignTokens.typography.h3.weight, DesignTokens.colors.neutral.text[900])}>
                              {value.value}
                            </span>
                            <span className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.colors.neutral.text[500])}>
                              {vitalUnit || 'units'}
                            </span>
                          </div>
                          <div className={combineClasses(DesignTokens.typography.body.sm, 'mt-1', DesignTokens.colors.neutral.text[500])}>
                            {formatDate(value)}
                            {value.notes && (
                              <span className={combineClasses('ml-2', DesignTokens.colors.neutral.text[400])}>• {value.notes}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteValue(value.id)}
                        disabled={deletingValueId === value.id || isSaving}
                        className={combineClasses(
                          DesignTokens.spacing.iconContainer.mobile,
                          DesignTokens.borders.radius.sm,
                          DesignTokens.transitions.default,
                          'disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation active:opacity-70',
                          DesignTokens.components.alert.text.error,
                          DesignTokens.components.alert.text.error.replace('600', '700').replace('text-', 'hover:text-'),
                          DesignTokens.components.status.high.bg.replace('bg-', 'hover:bg-')
                        )}
                        title="Delete value"
                      >
                        {deletingValueId === value.id ? (
                          <div
                            className={combineClasses(
                              DesignTokens.icons.standard.size.full,
                              'border-2 border-red-600 border-t-transparent rounded-full animate-spin'
                            )}
                          />
                        ) : (
                          <Trash2 className={DesignTokens.icons.standard.size.full} />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className={combineClasses('flex items-center justify-end border-t', DesignTokens.components.modal.footer, DesignTokens.colors.neutral.border[200])}>
          <div className={combineClasses('flex', DesignTokens.spacing.gap.md)}>
            <button
              onClick={onClose}
              disabled={isSaving}
              className={combineClasses(
                DesignTokens.spacing.button.full,
                'py-2.5',
                DesignTokens.borders.radius.sm,
                DesignTokens.typography.body.sm,
                DesignTokens.typography.h3.weight,
                DesignTokens.transitions.default,
                'disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] touch-manipulation active:opacity-70',
                DesignTokens.components.button.secondary
              )}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !vitalLabel.trim()}
              className={combineClasses(
                DesignTokens.components.button.primary,
                DesignTokens.spacing.button.full,
                'py-2.5 font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] touch-manipulation active:opacity-70'
              )}
            >
              {isSaving ? (
                <>
                  <div
                    className={combineClasses(
                      DesignTokens.icons.standard.size.full,
                      'border-2 border-white border-t-transparent rounded-full animate-spin'
                    )}
                  />
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
