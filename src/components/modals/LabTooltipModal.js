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
      {/* Tooltip */}
      <div
        className={combineClasses("fixed z-[71] rounded-xl shadow-2xl border max-w-sm w-[90vw] sm:w-96 p-5 animate-fade-scale", DesignTokens.components.modal.container, DesignTokens.colors.neutral.border[200])}
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
    </>
  );
}

