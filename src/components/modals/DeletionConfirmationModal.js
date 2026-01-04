import React from 'react';
import { X, AlertCircle, Activity, Trash2 } from 'lucide-react';
import { DesignTokens, combineClasses } from '../../design/designTokens';

export default function DeletionConfirmationModal({
  show,
  onClose,
  deletionType,
  isDeleting,
  onConfirm,
  title,
  message,
  confirmText = 'Yes, Delete Permanently',
  itemName
}) {
  if (!show) return null;

  // Default titles and messages based on deletionType
  const getTitle = () => {
    if (title) return title;
    if (deletionType === 'data') return 'Clear Health Records?';
    if (deletionType === 'account') return 'Delete Account Forever?';
    if (itemName) return `Delete ${itemName}?`;
    return 'Delete Item?';
  };

  const getMessage = () => {
    if (message) return message;
    if (deletionType === 'data') {
      return 'This will erase all your labs, vitals, and documents. Your profile and login will remain.';
    }
    if (deletionType === 'account') {
      return 'This will permanently delete your account and all health data from our servers.';
    }
    if (itemName) {
      return `This will permanently delete ${itemName}. This action cannot be undone.`;
    }
    return 'This action cannot be undone.';
  };

  return (
    <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl animate-fade-scale">
        <div className={combineClasses('w-12 h-12 rounded-full flex items-center justify-center mb-4 mx-auto', DesignTokens.components.status.high.bg)}>
          <AlertCircle className={combineClasses('', DesignTokens.components.status.high.icon)} size={24} />
        </div>

        <h3 className={combineClasses('text-lg font-bold text-center mb-2', DesignTokens.colors.neutral.text[900])}>
          {getTitle()}
        </h3>

        <p className={combineClasses('text-sm text-center mb-6', DesignTokens.colors.neutral.text[600])}>
          {getMessage()}
          <br />
          <span className={combineClasses('font-bold mt-2 block', DesignTokens.components.alert.text.error)}>This action is irreversible.</span>
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className={combineClasses('w-full py-3 rounded-xl font-bold text-white transition-all shadow-lg flex items-center justify-center gap-2', isDeleting ? DesignTokens.colors.neutral[300] : `${DesignTokens.components.status.high.text.replace('text-', 'bg-').replace('600', '600')} ${DesignTokens.components.status.high.text.replace('text-', 'hover:bg-').replace('600', '700')} active:scale-[0.98]`)}
          >
            {isDeleting ? (
              <>
                <Activity className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                {confirmText}
              </>
            )}
          </button>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className={combineClasses('w-full py-3 rounded-xl font-bold transition flex items-center justify-center gap-2', DesignTokens.colors.neutral.text[700], DesignTokens.colors.neutral[100].replace('bg-', 'hover:bg-'))}
          >
            <X className="w-4 h-4" />
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

