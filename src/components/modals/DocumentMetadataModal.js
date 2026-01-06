import React from 'react';
import { X } from 'lucide-react';
import { DesignTokens, combineClasses } from '../../design/designTokens';
import { parseLocalDate } from '../../utils/helpers';

export default function DocumentMetadataModal({ show, document, onClose }) {
  if (!show || !document) return null;

  return (
    <div 
      className={combineClasses(DesignTokens.components.modal.backdrop, 'z-[101] animate-in fade-in duration-200')}
      onClick={onClose}
    >
      <div 
        className={combineClasses('bg-white', DesignTokens.borders.radius.lg, 'max-w-md w-full', DesignTokens.spacing.card.desktop, DesignTokens.shadows.lg, 'animate-fade-scale')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={combineClasses('flex items-center justify-between', DesignTokens.spacing.header.mobile)}>
          <h3 className={combineClasses(DesignTokens.typography.h2.full, DesignTokens.typography.h2.weight, DesignTokens.colors.neutral.text[900])}>Document Metadata</h3>
          <button
            onClick={onClose}
            className={combineClasses('p-1.5', DesignTokens.borders.radius.full, DesignTokens.transitions.default, DesignTokens.colors.neutral[100].replace('bg-', 'hover:bg-'))}
            aria-label="Close"
            type="button"
          >
            <X className={combineClasses(DesignTokens.icons.button.size.full, DesignTokens.colors.neutral.text[500])} />
          </button>
        </div>

        <div className={combineClasses('space-y-3', DesignTokens.spacing.gap.md)}>
          <div>
            <p className={combineClasses(DesignTokens.typography.body.xs, DesignTokens.typography.h3.weight, 'uppercase mb-1', DesignTokens.colors.neutral.text[500])}>File Name</p>
            <p className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.colors.neutral.text[900])}>{document.fileName || document.name || 'Unknown'}</p>
          </div>

          <div>
            <p className={combineClasses(DesignTokens.typography.body.xs, DesignTokens.typography.h3.weight, 'uppercase mb-1', DesignTokens.colors.neutral.text[500])}>Document Type</p>
            <p className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.colors.neutral.text[900])}>{document.documentType || document.type || 'Unknown'}</p>
          </div>

          {document.dataPointCount !== undefined && document.dataPointCount !== null && (
            <div>
              <p className={combineClasses(DesignTokens.typography.body.xs, DesignTokens.typography.h3.weight, 'uppercase mb-1', DesignTokens.colors.neutral.text[500])}>Extracted Data Points</p>
              <p className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, DesignTokens.colors.neutral.text[900])}>{document.dataPointCount} data point{document.dataPointCount !== 1 ? 's' : ''}</p>
            </div>
          )}

          {document.fileSize && (
            <div>
              <p className={combineClasses(DesignTokens.typography.body.xs, DesignTokens.typography.h3.weight, 'uppercase mb-1', DesignTokens.colors.neutral.text[500])}>File Size</p>
              <p className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.colors.neutral.text[900])}>
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
              <p className={combineClasses(DesignTokens.typography.body.xs, DesignTokens.typography.h3.weight, 'uppercase mb-1', DesignTokens.colors.neutral.text[500])}>File Type</p>
              <p className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.colors.neutral.text[900])}>{document.fileType}</p>
            </div>
          )}

          <div>
            <p className={combineClasses(DesignTokens.typography.body.xs, DesignTokens.typography.h3.weight, 'uppercase mb-1', DesignTokens.colors.neutral.text[500])}>Upload Date</p>
            <p className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.colors.neutral.text[900])}>
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
              <p className={combineClasses(DesignTokens.typography.body.xs, DesignTokens.typography.h3.weight, 'uppercase mb-1', DesignTokens.colors.neutral.text[500])}>Note</p>
              <p className={combineClasses(DesignTokens.typography.body.sm, 'italic', DesignTokens.colors.neutral.text[900])}>{document.note}</p>
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className={combineClasses(DesignTokens.components.button.primary, 'mt-6 w-full py-3 font-medium disabled:opacity-50 disabled:cursor-not-allowed')}
        >
          Close
        </button>
      </div>
    </div>
  );
}

