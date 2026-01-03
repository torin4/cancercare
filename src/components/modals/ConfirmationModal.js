import React from 'react';
import { X, AlertCircle, Activity, RefreshCw } from 'lucide-react';

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
  iconColor = 'text-blue-600',
  iconBgColor = 'bg-blue-100',
  confirmButtonColor = 'bg-blue-600 hover:bg-blue-700'
}) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl animate-fade-scale">
        <div className={`w-12 h-12 ${iconBgColor} rounded-full flex items-center justify-center mb-4 mx-auto`}>
          <Icon className={iconColor} size={24} />
        </div>

        <h3 className="text-lg font-bold text-gray-900 text-center mb-2">
          {title}
        </h3>

        <p className="text-sm text-gray-600 text-center mb-6">
          {message}
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={onConfirm}
            disabled={isProcessing}
            className={`w-full py-3 rounded-xl font-bold text-white transition-all shadow-lg flex items-center justify-center gap-2 ${isProcessing ? 'bg-gray-400' : `${confirmButtonColor} active:scale-[0.98]`}`}
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
            className="w-full py-3 rounded-xl font-bold text-gray-700 hover:bg-gray-100 transition flex items-center justify-center gap-2"
          >
            <X className="w-4 h-4" />
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
}



