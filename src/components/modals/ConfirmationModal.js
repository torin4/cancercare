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
    <div className={combineClasses(DesignTokens.components.modal.backdrop, 'z-[101] animate-in fade-in duration-200')}>
      <div className={combineClasses('bg-white', DesignTokens.borders.radius.lg, 'max-w-sm w-full', DesignTokens.spacing.card.desktop, DesignTokens.shadows.lg, 'animate-fade-scale')}>
        <div className={combineClasses('w-12 h-12', iconBgColor, DesignTokens.borders.radius.full, 'flex items-center justify-center', DesignTokens.spacing.header.mobile, 'mx-auto')}>
          <Icon className={iconColor} size={24} />
        </div>

        <h3 className={combineClasses(DesignTokens.typography.h2.full, DesignTokens.typography.h2.weight, 'text-center mb-2', DesignTokens.colors.neutral.text[900])}>
          {title}
        </h3>

        <p className={combineClasses(DesignTokens.typography.body.sm, 'text-center', DesignTokens.spacing.header.mobile, DesignTokens.colors.neutral.text[600])}>
          {message}
        </p>

        <div className={combineClasses('flex flex-col', DesignTokens.spacing.gap.md)}>
          <button
            onClick={onConfirm}
            disabled={isProcessing}
            className={combineClasses('w-full py-3', DesignTokens.borders.radius.md, DesignTokens.typography.h2.weight, 'text-white', DesignTokens.transitions.all, DesignTokens.shadows.lg, 'flex items-center justify-center', DesignTokens.spacing.gap.sm, isProcessing ? DesignTokens.colors.neutral[300] : `${confirmButtonColor} active:scale-[0.98]`)}
          >
            {isProcessing ? (
              <>
                <Activity className={combineClasses(DesignTokens.icons.standard.size.full, 'animate-spin')} />
                Processing...
              </>
            ) : (
              confirmText
            )}
          </button>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className={combineClasses('w-full py-3', DesignTokens.borders.radius.md, DesignTokens.typography.h2.weight, DesignTokens.transitions.default, 'flex items-center justify-center', DesignTokens.spacing.gap.sm, DesignTokens.colors.neutral.text[700], DesignTokens.colors.neutral[100].replace('bg-', 'hover:bg-'))}
          >
            <X className={DesignTokens.icons.standard.size.full} />
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
}



