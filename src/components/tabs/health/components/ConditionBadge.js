import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { DesignTokens, combineClasses } from '../../../../design/designTokens';
import { getConditionDescription } from '../../../../utils/conditionDetection';

const colorClasses = {
  orange: 'bg-orange-100 text-orange-700 border-orange-200',
  red:    'bg-red-100 text-red-700 border-red-200',
  yellow: 'bg-yellow-100 text-yellow-700 border-yellow-200',
};

const iconClasses = {
  orange: 'text-orange-600',
  red:    'text-red-600',
  yellow: 'text-yellow-600',
};

/**
 * Small pill badge showing a clinical condition name (e.g. "Anemia", "Hypotension").
 * Click opens a screen-centered modal with blurred backdrop (same as lab card Info).
 * Renders nothing if condition is null/undefined.
 *
 * @param {{ condition: { name: string, severity: string, color: string } | null }} props
 */
export default function ConditionBadge({ condition }) {
  const [showTooltip, setShowTooltip] = useState(false);

  const description = condition ? (getConditionDescription(condition.name) || condition.name) : '';

  if (!condition) return null;

  const colors = colorClasses[condition.color] || colorClasses.orange;
  const iconColor = iconClasses[condition.color] || iconClasses.orange;

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setShowTooltip(true); }}
        className={combineClasses('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold border cursor-pointer touch-manipulation active:opacity-90', colors)}
        aria-expanded={showTooltip}
        aria-haspopup="dialog"
        aria-label={`${condition.name}. Click for description.`}
      >
        <AlertTriangle className={combineClasses('w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0', iconColor)} />
        <span className="whitespace-nowrap">{condition.name}</span>
      </button>
      {showTooltip && description && (
        <>
          {/* Backdrop - screen-centered modal style (blurred, dimmed) */}
          <div
            className="fixed inset-0 z-[70] backdrop-blur-sm bg-black/20"
            onClick={() => setShowTooltip(false)}
            aria-hidden
          />
          {/* Centered panel - matches LabTooltipModal */}
          <div
            role="dialog"
            aria-label={condition.name}
            className={combineClasses(
              'fixed z-[71] rounded-xl shadow-2xl border max-w-sm w-[90vw] sm:w-96 p-5 animate-fade-scale bg-white',
              DesignTokens.colors.neutral.border[200]
            )}
            style={{
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              maxHeight: '80vh',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={combineClasses('flex items-start justify-between', DesignTokens.spacing.gap.md)}>
              <h3 className={combineClasses(DesignTokens.typography.h2.full, DesignTokens.typography.h2.weight, 'pr-2', DesignTokens.colors.neutral.text[900])}>
                {condition.name}
              </h3>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowTooltip(false); }}
                className={combineClasses('p-2 -mr-2', DesignTokens.transitions.default, 'flex-shrink-0', DesignTokens.spacing.touchTarget, 'flex items-center justify-center', DesignTokens.components.modal.closeButton)}
                aria-label="Close"
              >
                <X className={DesignTokens.icons.button.size.full} />
              </button>
            </div>
            <p className={combineClasses(DesignTokens.typography.body.sm, 'leading-relaxed', DesignTokens.colors.neutral.text[700])}>
              {description}
            </p>
          </div>
        </>
      )}
    </>
  );
}
