import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, X } from 'lucide-react';
import { DesignTokens, combineClasses } from '../design/designTokens';

/**
 * Banner component for displaying success and error notifications
 * Appears at the top of the screen with slide-in/slide-out animations
 */
export default function Banner({ message, type = 'success', duration = 4000, onClose }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Trigger slide-in animation
    const timer = setTimeout(() => setIsVisible(true), 10);

    // Auto-dismiss after duration
    const autoCloseTimer = setTimeout(() => {
      handleClose();
    }, duration);

    return () => {
      clearTimeout(timer);
      clearTimeout(autoCloseTimer);
    };
  }, [duration]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      if (onClose) onClose();
    }, 300); // Match animation duration
  };

  if (!message) return null;

  const isSuccess = type === 'success';
  const alertClasses = isSuccess 
    ? DesignTokens.components.alert.success 
    : DesignTokens.components.alert.error;
  const textColor = isSuccess 
    ? DesignTokens.components.alert.text.success 
    : DesignTokens.components.alert.text.error;
  const iconColor = isSuccess 
    ? 'text-green-600' 
    : 'text-red-600';

  return (
    <div
      className={combineClasses(
        'fixed top-0 left-0 right-0 z-[100]',
        DesignTokens.transitions.slow,
        'transition-transform duration-300 ease-out',
        isVisible && !isExiting ? 'translate-y-0' : '-translate-y-full'
      )}
    >
      <div className={combineClasses(alertClasses, 'border-b', DesignTokens.shadows.lg)}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <div className={combineClasses('flex items-center', DesignTokens.spacing.gap.md, 'flex-1 min-w-0')}>
              {isSuccess ? (
                <CheckCircle className={combineClasses(DesignTokens.icons.standard.size.full, iconColor, 'flex-shrink-0')} />
              ) : (
                <XCircle className={combineClasses(DesignTokens.icons.standard.size.full, iconColor, 'flex-shrink-0')} />
              )}
              <p className={combineClasses(DesignTokens.typography.body.base, 'font-medium', textColor, 'break-words')}>
                {message}
              </p>
            </div>
            <button
              onClick={handleClose}
              className={combineClasses('ml-4 flex-shrink-0', textColor, 'hover:opacity-70', DesignTokens.transitions.default)}
              aria-label="Close banner"
            >
              <X className={DesignTokens.icons.standard.size.full} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

