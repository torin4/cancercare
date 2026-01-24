import React from 'react';
import { AlertCircle, X } from 'lucide-react';
import { DesignTokens, combineClasses } from '../../design/designTokens';

/**
 * DICOM Chat Medical Disclaimer Modal
 *
 * Displays important disclaimers before users can use AI chat with DICOM images.
 * Required for legal/safety compliance.
 */
export default function DicomChatDisclaimerModal({ onAccept, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
      <div
        className={combineClasses(
          'bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto',
          DesignTokens.transitions.default
        )}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-yellow-600" />
            </div>
            <h2 className={combineClasses(DesignTokens.typography.h3.full, DesignTokens.typography.h3.weight, 'text-gray-900')}>
              Important Medical Information Disclaimer
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          {/* Primary Warning */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className={combineClasses('text-base font-semibold', 'text-yellow-900 mb-2')}>
              This AI Assistant is NOT a Medical Professional
            </h3>
            <p className={combineClasses(DesignTokens.typography.body.base, 'text-yellow-800')}>
              The AI assistant provides educational information only and is not a substitute for
              professional medical advice, diagnosis, or treatment.
            </p>
          </div>

          {/* Detailed Disclaimers */}
          <div className="space-y-4">
            <div>
              <h4 className={combineClasses('text-sm font-semibold', 'text-gray-900 mb-2')}>
                What This AI Can Do:
              </h4>
              <ul className={combineClasses(DesignTokens.typography.body.base, 'text-gray-700 space-y-2 list-disc pl-5')}>
                <li>Explain imaging terminology and scan parameters</li>
                <li>Describe general anatomical structures based on scan metadata</li>
                <li>Provide educational context about imaging modalities (CT, MRI, X-Ray, etc.)</li>
                <li>Answer questions about what different scan parameters mean</li>
                <li>Help you understand your medical imaging data in plain language</li>
              </ul>
            </div>

            <div>
              <h4 className={combineClasses('text-sm font-semibold', 'text-gray-900 mb-2')}>
                What This AI Cannot Do:
              </h4>
              <ul className={combineClasses(DesignTokens.typography.body.base, 'text-gray-700 space-y-2 list-disc pl-5')}>
                <li><strong>Cannot diagnose medical conditions</strong> or identify abnormalities</li>
                <li><strong>Cannot provide medical advice</strong> or treatment recommendations</li>
                <li><strong>Cannot replace consultation</strong> with your healthcare provider</li>
                <li><strong>Cannot interpret clinical findings</strong> - only licensed radiologists and physicians can do this</li>
                <li><strong>Cannot guarantee accuracy</strong> - AI models can make mistakes</li>
              </ul>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h4 className={combineClasses('text-sm font-semibold', 'text-red-900 mb-2')}>
                ⚠️ Critical Safety Information
              </h4>
              <ul className={combineClasses(DesignTokens.typography.body.base, 'text-red-800 space-y-2 list-disc pl-5')}>
                <li>
                  <strong>Always consult your healthcare provider</strong> for medical interpretation of your scans
                </li>
                <li>
                  <strong>Do not make medical decisions</strong> based solely on AI responses
                </li>
                <li>
                  <strong>If you have health concerns</strong>, contact your doctor immediately
                </li>
                <li>
                  <strong>In case of emergency</strong>, call 911 or your local emergency services
                </li>
              </ul>
            </div>

            <div>
              <h4 className={combineClasses('text-sm font-semibold', 'text-gray-900 mb-2')}>
                Technology Details:
              </h4>
              <ul className={combineClasses(DesignTokens.typography.body.base, 'text-gray-700 space-y-2 list-disc pl-5')}>
                <li>This assistant uses Google Gemini AI (a general-purpose AI model)</li>
                <li>It is <strong>not a medical-grade diagnostic AI</strong></li>
                <li>It has not been validated for clinical use</li>
                <li>It is not FDA-approved or cleared for medical diagnosis</li>
                <li>Responses are generated based on scan metadata and general medical knowledge</li>
              </ul>
            </div>

            <div>
              <h4 className={combineClasses('text-sm font-semibold', 'text-gray-900 mb-2')}>
                Privacy Notice:
              </h4>
              <p className={combineClasses(DesignTokens.typography.body.base, 'text-gray-700')}>
                Scan metadata (patient information, scan parameters) is sent to Google's Gemini API
                to generate responses. This data is processed according to Google's privacy policies.
                Please review your institution's data sharing policies before using this feature.
              </p>
            </div>
          </div>

          {/* Acknowledgment Section */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className={combineClasses('text-sm font-semibold', 'text-gray-900 mb-2')}>
              By clicking "I Understand", you acknowledge that:
            </h4>
            <ul className={combineClasses(DesignTokens.typography.body.baseSmall, 'text-gray-700 space-y-1 list-disc pl-5')}>
              <li>This AI assistant provides educational information only</li>
              <li>It is not a substitute for professional medical advice</li>
              <li>You will consult your healthcare provider for medical interpretation</li>
              <li>You will not make medical decisions based solely on AI responses</li>
              <li>You understand the limitations and risks of using AI for medical information</li>
            </ul>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-end space-x-3">
          <button
            onClick={onClose}
            className={combineClasses(
              'px-4 py-2',
              DesignTokens.components.button.secondary
            )}
          >
            Cancel
          </button>
          <button
            onClick={onAccept}
            className={combineClasses(
              'px-6 py-2',
              DesignTokens.components.button.primary
            )}
          >
            I Understand - Continue to Chat
          </button>
        </div>
      </div>
    </div>
  );
}
