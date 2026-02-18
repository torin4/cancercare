import React from 'react';
import { X } from 'lucide-react';
import { DesignTokens, combineClasses } from '../../design/designTokens';

export default function LabTooltipModal({ show, labTooltip, onClose }) {
  if (!show || !labTooltip) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={combineClasses("fixed inset-0 z-[70] backdrop-blur-sm", DesignTokens.components.modal.backdrop.replace('/60', '/20'))}
        onClick={onClose}
      />
      {/* Tooltip - wrapper preserves center position while inner animates up */}
      <div
        className="fixed z-[71] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center w-[90vw] sm:w-96 max-w-sm max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={combineClasses("w-full rounded-xl shadow-2xl border p-5 bg-white animate-slide-up overflow-y-auto max-h-[80vh]", DesignTokens.colors.neutral.border[200])}
        >
        <div className={combineClasses('flex items-start justify-between', DesignTokens.spacing.gap.md)}>
          <h3 className={combineClasses(DesignTokens.typography.h2.full, DesignTokens.typography.h2.weight, 'pr-2', DesignTokens.colors.neutral.text[900])}>{labTooltip.labName}</h3>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className={combineClasses('p-2 -mr-2', DesignTokens.transitions.default, 'flex-shrink-0', DesignTokens.spacing.touchTarget, 'flex items-center justify-center', DesignTokens.components.modal.closeButton)}
            aria-label="Close"
            type="button"
          >
            <X className={DesignTokens.icons.button.size.full} />
          </button>
        </div>
        <p className={combineClasses(DesignTokens.typography.body.sm, 'leading-relaxed', DesignTokens.colors.neutral.text[700])}>{labTooltip.description}</p>
        </div>
      </div>
    </>
  );
}

