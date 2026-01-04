import React from 'react';
import { X, AlertCircle, Activity, RefreshCw } from 'lucide-react';
import { DesignTokens, combineClasses } from '../../design/designTokens';

export default function ConfirmationModal({
  show,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isProcessing = false,
  icon: Icon = RefreshCw,
  iconColor = DesignTokens.colors.primary.text[600],
  iconBgColor = DesignTokens.colors.primary[100],
  confirmButtonColor = `${DesignTokens.colors.primary[600]} ${DesignTokens.colors.primary[700].replace('bg-', 'hover:bg-')}`
}) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl animate-fade-scale">
        <div className={`w-12 h-12 ${iconBgColor} rounded-full flex items-center justify-center mb-4 mx-auto`}>
          <Icon className={iconColor} size={24} />
        </div>

        <h3 className={combineClasses('text-lg font-bold text-center mb-2', DesignTokens.colors.neutral.text[900])}>
          {title}
        </h3>

        <p className={combineClasses('text-sm text-center mb-6', DesignTokens.colors.neutral.text[600])}>
          {message}
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={onConfirm}
            disabled={isProcessing}
            className={combineClasses('w-full py-3 rounded-xl font-bold text-white transition-all shadow-lg flex items-center justify-center gap-2', isProcessing ? DesignTokens.colors.neutral[300] : `${confirmButtonColor} active:scale-[0.98]`)}
          >
            {isProcessing ? (
              <>
                <Activity className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              confirmText
            )}
          </button>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className={combineClasses('w-full py-3 rounded-xl font-bold transition flex items-center justify-center gap-2', DesignTokens.colors.neutral.text[700], DesignTokens.colors.neutral[100].replace('bg-', 'hover:bg-'))}
          >
            <X className="w-4 h-4" />
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
}



