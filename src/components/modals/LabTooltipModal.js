import React from 'react';
import { X } from 'lucide-react';

export default function LabTooltipModal({ show, labTooltip, onClose }) {
  if (!show || !labTooltip) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[70] bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Tooltip */}
      <div
        className="fixed z-[71] bg-white rounded-xl shadow-2xl border border-medical-neutral-200 max-w-sm w-[90vw] sm:w-96 p-5 animate-fade-scale"
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
          <h3 className="text-lg font-bold text-medical-neutral-900 pr-2">{labTooltip.labName}</h3>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="p-2 -mr-2 text-medical-neutral-400 hover:text-medical-neutral-600 active:text-medical-neutral-700 transition-colors flex-shrink-0 touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Close"
            type="button"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-medical-neutral-700 leading-relaxed">{labTooltip.description}</p>
      </div>
    </>
  );
}

