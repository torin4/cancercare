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
        <div className="flex items-start justify-between mb-3">
          <h3 className={combineClasses('text-lg font-bold pr-2', DesignTokens.colors.neutral.text[900])}>{labTooltip.labName}</h3>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className={combineClasses('p-2 -mr-2 transition-colors flex-shrink-0 touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center', DesignTokens.components.modal.closeButton)}
            aria-label="Close"
            type="button"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className={combineClasses('text-sm leading-relaxed', DesignTokens.colors.neutral.text[700])}>{labTooltip.description}</p>
      </div>
    </>
  );
}

