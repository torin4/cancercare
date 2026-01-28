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
        'md:max-w-5xl md:max-h-[90vh]',
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
                Last Updated: January 2026
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
          'px-6 py-6 md:px-8 md:py-8',
          'bg-gray-50'
        )}>
          <div className="max-w-none prose prose-sm md:prose-base lg:prose-lg
            prose-headings:font-semibold
            prose-h1:text-3xl md:prose-h1:text-4xl prose-h1:text-blue-700 prose-h1:mb-6 prose-h1:mt-0 prose-h1:border-b-2 prose-h1:border-blue-200 prose-h1:pb-4
            prose-h2:text-2xl md:prose-h2:text-3xl prose-h2:text-blue-600 prose-h2:mt-10 md:prose-h2:mt-12 prose-h2:mb-5 prose-h2:font-semibold prose-h2:border-t prose-h2:border-gray-200 prose-h2:pt-6
            prose-h3:text-xl md:prose-h3:text-2xl prose-h3:text-gray-800 prose-h3:mt-7 prose-h3:mb-4 prose-h3:font-semibold
            prose-p:text-gray-700 prose-p:leading-relaxed prose-p:mb-5 prose-p:text-base md:prose-p:text-lg
            prose-strong:text-gray-900 prose-strong:font-semibold
            prose-ul:text-gray-700 prose-ul:my-5 prose-ul:space-y-3 prose-ul:ml-6
            prose-li:text-gray-700 prose-li:leading-relaxed prose-li:pl-2
            prose-a:text-blue-600 prose-a:font-medium hover:prose-a:text-blue-700 hover:prose-a:underline
            [&>h1:first-child]:mt-0
            [&>h2:first-of-type]:mt-8
            [&>p:first-child]:text-lg md:[&>p:first-child]:text-xl [&>p:first-child]:font-medium [&>p:first-child]:text-gray-800 [&>p:first-child]:mb-6
            [&>p:first-child+strong]:text-blue-700
          ">
            <ReactMarkdown
              components={{
                h1: ({node, ...props}) => (
                  <h1 className="text-3xl md:text-4xl font-bold text-blue-700 mb-6 mt-0 pb-4 border-b-2 border-blue-200" {...props} />
                ),
                h2: ({node, ...props}) => (
                  <h2 className="text-2xl md:text-3xl font-semibold text-blue-600 mt-10 md:mt-12 mb-5 pt-6 border-t border-gray-200 first:mt-8" {...props} />
                ),
                h3: ({node, ...props}) => (
                  <h3 className="text-xl md:text-2xl font-semibold text-gray-800 mt-7 mb-4" {...props} />
                ),
                p: ({node, ...props}) => {
                  // Check if this is the first paragraph (after title and last updated)
                  const children = node.children || [];
                  const hasStrong = children.some(child => child.type === 'strong');
                  const isIntro = hasStrong && children[0]?.type === 'text' && children[0]?.value?.includes('Please read');
                  return (
                    <p 
                      className={`text-gray-700 leading-relaxed mb-5 ${
                        isIntro 
                          ? 'text-lg md:text-xl font-medium text-gray-800 mb-6' 
                          : 'text-base md:text-lg'
                      }`} 
                      {...props} 
                    />
                  );
                },
                ul: ({node, ...props}) => (
                  <ul className="text-gray-700 my-5 space-y-3 list-disc ml-6" {...props} />
                ),
                li: ({node, ...props}) => (
                  <li className="text-gray-700 leading-relaxed pl-2" {...props} />
                ),
                strong: ({node, ...props}) => (
                  <strong className="text-gray-900 font-semibold" {...props} />
                ),
                a: ({node, ...props}) => (
                  <a className="text-blue-600 font-medium hover:text-blue-700 hover:underline" {...props} />
                ),
              }}
            >
              {privacyPolicyContent}
            </ReactMarkdown>
          </div>
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
