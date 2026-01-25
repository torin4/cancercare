import React from 'react';
import { X, Shield } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { DesignTokens, combineClasses } from '../../design/designTokens';
import privacyPolicyContent from '../../constants/privacyPolicy';

export default function PrivacyPolicyModal({ show, onClose }) {
  if (!show) return null;

  return (
    <div 
      className={combineClasses(DesignTokens.components.modal.backdrop, 'z-[100]')}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className={combineClasses(
        'bg-white w-full h-full md:h-auto',
        DesignTokens.borders.radius.lg,
        'md:max-w-4xl md:max-h-[90vh]',
        'overflow-hidden flex flex-col',
        'animate-slide-up',
        DesignTokens.shadows.xl
      )}>
        {/* Header */}
        <div className={combineClasses(
          'flex-shrink-0 border-b',
          DesignTokens.components.modal.header,
          DesignTokens.colors.neutral.border[200],
          'flex items-center justify-between'
        )}>
          <div className="flex items-center gap-3">
            <div className={combineClasses(
              'w-10 h-10',
              DesignTokens.colors.primary[100],
              DesignTokens.borders.radius.full,
              'flex items-center justify-center'
            )}>
              <Shield className={combineClasses('w-5 h-5', DesignTokens.colors.primary.text[600])} />
            </div>
            <div>
              <h3 className={combineClasses(
                DesignTokens.typography.h2.full,
                DesignTokens.typography.h2.weight,
                DesignTokens.colors.neutral.text[900]
              )}>
                Privacy Policy
              </h3>
              <p className={combineClasses(
                'text-xs mt-0.5',
                DesignTokens.colors.neutral.text[500]
              )}>
                Last Updated: January 2025
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={combineClasses(
              DesignTokens.transitions.default,
              DesignTokens.components.modal.closeButton
            )}
            type="button"
            aria-label="Close"
          >
            <X className={DesignTokens.icons.header.size.full} />
          </button>
        </div>

        {/* Content */}
        <div className={combineClasses(
          'flex-1 overflow-y-auto',
          DesignTokens.components.modal.body,
          'prose prose-sm max-w-none',
          'prose-headings:text-gray-900',
          'prose-p:text-gray-700',
          'prose-ul:text-gray-700',
          'prose-li:text-gray-700',
          'prose-strong:text-gray-900',
          'prose-a:text-blue-600 hover:prose-a:text-blue-700'
        )}>
          <ReactMarkdown>{privacyPolicyContent}</ReactMarkdown>
        </div>

        {/* Footer */}
        <div className={combineClasses(
          'flex-shrink-0 border-t p-4',
          DesignTokens.colors.neutral.border[200],
          'flex justify-end'
        )}>
          <button
            onClick={onClose}
            className={combineClasses(
              DesignTokens.components.button.primary,
              'px-6'
            )}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
