import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, X } from 'lucide-react';

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
  const bgColor = isSuccess 
    ? 'bg-green-50 border-green-200' 
    : 'bg-red-50 border-red-200';
  const textColor = isSuccess 
    ? 'text-green-800' 
    : 'text-red-800';
  const iconColor = isSuccess 
    ? 'text-green-600' 
    : 'text-red-600';

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[100] transition-transform duration-300 ease-out ${
        isVisible && !isExiting ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <div className={`${bgColor} border-b shadow-lg`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {isSuccess ? (
                <CheckCircle className={`w-5 h-5 ${iconColor} flex-shrink-0`} />
              ) : (
                <XCircle className={`w-5 h-5 ${iconColor} flex-shrink-0`} />
              )}
              <p className={`text-sm font-medium ${textColor} break-words`}>
                {message}
              </p>
            </div>
            <button
              onClick={handleClose}
              className={`ml-4 flex-shrink-0 ${textColor} hover:opacity-70 transition-opacity`}
              aria-label="Close banner"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

