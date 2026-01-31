import React from 'react';
import { X, AlertCircle, Loader2, Trash2 } from 'lucide-react';
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
    <div className={combineClasses(DesignTokens.components.modal.backdrop, 'z-[101] animate-in fade-in duration-200')}>
      <div className={combineClasses('bg-white', DesignTokens.borders.radius.lg, 'max-w-sm w-full', DesignTokens.spacing.card.desktop, DesignTokens.shadows.lg, 'animate-fade-scale')}>
        <div className={combineClasses('w-12 h-12', DesignTokens.borders.radius.full, 'flex items-center justify-center', DesignTokens.spacing.header.mobile, 'mx-auto', DesignTokens.components.status.high.bg)}>
          <AlertCircle className={combineClasses(DesignTokens.components.status.high.icon)} size={24} />
        </div>

        <h3 className={combineClasses(DesignTokens.typography.h2.full, DesignTokens.typography.h2.weight, 'text-center mb-2', DesignTokens.colors.neutral.text[900])}>
          {getTitle()}
        </h3>

        <p className={combineClasses(DesignTokens.typography.body.sm, 'text-center', DesignTokens.spacing.header.mobile, DesignTokens.colors.neutral.text[600])}>
          {getMessage()}
          <br />
          <span className={combineClasses(DesignTokens.typography.h3.weight, 'mt-2 block', DesignTokens.components.alert.text.error)}>This action is irreversible.</span>
        </p>

        <div className={combineClasses('flex flex-col', DesignTokens.spacing.gap.md)}>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className={combineClasses('w-full py-3', DesignTokens.borders.radius.md, DesignTokens.typography.h2.weight, 'text-white', DesignTokens.transitions.all, DesignTokens.shadows.lg, 'flex items-center justify-center', DesignTokens.spacing.gap.sm, isDeleting ? DesignTokens.colors.neutral[300] : `${DesignTokens.components.status.high.text.replace('text-', 'bg-').replace('600', '600')} ${DesignTokens.components.status.high.text.replace('text-', 'hover:bg-').replace('600', '700')} active:scale-[0.98]`)}
          >
            {isDeleting ? (
              <>
                <Loader2 className={combineClasses(DesignTokens.icons.standard.size.full, 'animate-spin')} />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className={DesignTokens.icons.standard.size.full} />
                {confirmText}
              </>
            )}
          </button>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className={combineClasses('w-full py-3', DesignTokens.borders.radius.md, DesignTokens.typography.h2.weight, DesignTokens.transitions.default, 'flex items-center justify-center', DesignTokens.spacing.gap.sm, DesignTokens.colors.neutral.text[700], DesignTokens.colors.neutral[100].replace('bg-', 'hover:bg-'))}
          >
            <X className={DesignTokens.icons.standard.size.full} />
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

