import React from 'react';
import { X, AlertCircle, Activity, Trash2 } from 'lucide-react';

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
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 mx-auto">
          <AlertCircle className="text-red-600" size={24} />
        </div>

        <h3 className="text-lg font-bold text-gray-900 text-center mb-2">
          {getTitle()}
        </h3>

        <p className="text-sm text-gray-600 text-center mb-6">
          {getMessage()}
          <br />
          <span className="font-bold text-red-600 mt-2 block">This action is irreversible.</span>
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className={`w-full py-3 rounded-xl font-bold text-white transition-all shadow-lg flex items-center justify-center gap-2 ${isDeleting ? 'bg-gray-400' : 'bg-red-600 hover:bg-red-700 active:scale-[0.98]'}`}
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
            className="w-full py-3 rounded-xl font-bold text-gray-700 hover:bg-gray-100 transition flex items-center justify-center gap-2"
          >
            <X className="w-4 h-4" />
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

