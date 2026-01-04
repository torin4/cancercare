import React from 'react';
import { X } from 'lucide-react';
import { DesignTokens, combineClasses } from '../../design/designTokens';
import { parseLocalDate } from '../../utils/helpers';

export default function DocumentMetadataModal({ show, document, onClose }) {
  if (!show || !document) return null;

  return (
    <div 
      className="fixed inset-0 z-[101] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-fade-scale"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className={combineClasses('text-lg font-bold', DesignTokens.colors.neutral.text[900])}>Document Metadata</h3>
          <button
            onClick={onClose}
            className={combineClasses('p-1.5 rounded-full transition', DesignTokens.colors.neutral[100].replace('bg-', 'hover:bg-'))}
            aria-label="Close"
            type="button"
          >
            <X className={combineClasses('w-5 h-5', DesignTokens.colors.neutral.text[500])} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <p className={combineClasses('text-xs font-semibold uppercase mb-1', DesignTokens.colors.neutral.text[500])}>File Name</p>
            <p className={combineClasses('text-sm', DesignTokens.colors.neutral.text[900])}>{document.fileName || document.name || 'Unknown'}</p>
          </div>

          <div>
            <p className={combineClasses('text-xs font-semibold uppercase mb-1', DesignTokens.colors.neutral.text[500])}>Document Type</p>
            <p className={combineClasses('text-sm', DesignTokens.colors.neutral.text[900])}>{document.documentType || document.type || 'Unknown'}</p>
          </div>

          {document.dataPointCount !== undefined && document.dataPointCount !== null && (
            <div>
              <p className={combineClasses('text-xs font-semibold uppercase mb-1', DesignTokens.colors.neutral.text[500])}>Extracted Data Points</p>
              <p className={combineClasses('text-sm font-semibold', DesignTokens.colors.neutral.text[900])}>{document.dataPointCount} data point{document.dataPointCount !== 1 ? 's' : ''}</p>
            </div>
          )}

          {document.fileSize && (
            <div>
              <p className={combineClasses('text-xs font-semibold uppercase mb-1', DesignTokens.colors.neutral.text[500])}>File Size</p>
              <p className={combineClasses('text-sm', DesignTokens.colors.neutral.text[900])}>
                {document.fileSize < 1024 
                  ? `${document.fileSize} bytes`
                  : document.fileSize < 1024 * 1024
                  ? `${(document.fileSize / 1024).toFixed(2)} KB`
                  : `${(document.fileSize / (1024 * 1024)).toFixed(2)} MB`}
              </p>
            </div>
          )}

          {document.fileType && (
            <div>
              <p className={combineClasses('text-xs font-semibold uppercase mb-1', DesignTokens.colors.neutral.text[500])}>File Type</p>
              <p className={combineClasses('text-sm', DesignTokens.colors.neutral.text[900])}>{document.fileType}</p>
            </div>
          )}

          <div>
            <p className={combineClasses('text-xs font-semibold uppercase mb-1', DesignTokens.colors.neutral.text[500])}>Upload Date</p>
            <p className={combineClasses('text-sm', DesignTokens.colors.neutral.text[900])}>
              {parseLocalDate(document.date).toLocaleDateString('en-US', { 
                month: 'long', 
                day: 'numeric', 
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>

          {document.note && (
            <div>
              <p className={combineClasses('text-xs font-semibold uppercase mb-1', DesignTokens.colors.neutral.text[500])}>Note</p>
              <p className={combineClasses('text-sm italic', DesignTokens.colors.neutral.text[900])}>{document.note}</p>
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className={combineClasses('mt-6 w-full py-3 rounded-xl font-bold text-white transition', DesignTokens.colors.primary[600], DesignTokens.colors.primary[700].replace('bg-', 'hover:bg-'))}
        >
          Close
        </button>
      </div>
    </div>
  );
}

