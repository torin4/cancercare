import React, { useState, useEffect } from 'react';
import { X, RefreshCw, Activity } from 'lucide-react';
import DatePicker from '../DatePicker';

export default function RescanDocumentModal({
  show,
  onClose,
  onConfirm,
  document,
  isProcessing = false
}) {
  // Initialize with document's current values
  const [editedDate, setEditedDate] = useState('');
  const [editedNote, setEditedNote] = useState('');

  // Update state when document changes
  useEffect(() => {
    if (document) {
      console.log('[RescanDocumentModal] Document received:', {
        id: document.id,
        date: document.date,
        note: document.note,
        fileName: document.fileName || document.name
      });
      
      // Format date for input[type="date"]
      let dateValue = '';
      if (document.date) {
        if (typeof document.date === 'string') {
          // If it's already a string in YYYY-MM-DD format, use it directly
          if (/^\d{4}-\d{2}-\d{2}$/.test(document.date)) {
            dateValue = document.date;
          } else {
            // Try to parse other string formats
            try {
              const d = new Date(document.date);
              if (!isNaN(d.getTime())) {
                dateValue = d.toISOString().split('T')[0];
              }
            } catch (e) {
              console.warn('[RescanDocumentModal] Could not parse date string:', document.date);
            }
          }
        } else if (document.date.toDate) {
          // If it's a Firestore Timestamp, convert to Date then to string
          dateValue = document.date.toDate().toISOString().split('T')[0];
        } else if (document.date instanceof Date) {
          // If it's a Date object, convert to string
          dateValue = document.date.toISOString().split('T')[0];
        } else {
          // Try to parse as Date
          try {
            const d = new Date(document.date);
            if (!isNaN(d.getTime())) {
              dateValue = d.toISOString().split('T')[0];
            }
          } catch (e) {
            console.warn('[RescanDocumentModal] Could not parse document date:', document.date);
            dateValue = '';
          }
        }
      }
      
      console.log('[RescanDocumentModal] Setting date:', dateValue, 'note:', document.note || '');
      console.log('[RescanDocumentModal] Full document object:', JSON.stringify(document, null, 2));
      setEditedDate(dateValue);
      setEditedNote(document.note || document.note || ''); // Ensure note is set even if undefined
    } else {
      // Reset when document is null
      setEditedDate('');
      setEditedNote('');
    }
  }, [document]);

  if (!show || !document) return null;

  const fileName = document.fileName || document.name || 'document';
  const docType = document.documentType || document.type || 'document';

  const handleConfirm = () => {
    onConfirm({
      date: editedDate || null,
      note: editedNote || null
    });
  };

  return (
    <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl animate-fade-scale">
        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-4 mx-auto">
          <RefreshCw className="text-blue-600" size={24} />
        </div>

        <h3 className="text-lg font-bold text-gray-900 text-center mb-2">
          Rescan {docType} Document?
        </h3>

        <p className="text-sm text-gray-600 text-center mb-6">
          This will re-extract all data from "<span className="font-semibold">{fileName}</span>". You can edit the date and note below.
        </p>

        {/* Edit Form */}
        <div className="space-y-4 mb-6">
          {/* Date Input */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Document Date
            </label>
            <DatePicker
              value={editedDate}
              onChange={(e) => setEditedDate(e.target.value)}
              disabled={isProcessing}
              placeholder="YYYY-MM-DD"
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">
              Leave empty to extract date from document
            </p>
          </div>

          {/* Note Input */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Document Note
            </label>
            <textarea
              value={editedNote}
              onChange={(e) => setEditedNote(e.target.value)}
              disabled={isProcessing}
              placeholder="Add a note about this document (optional)"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed text-sm resize-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              {editedNote.length}/200 characters
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          <button
            onClick={handleConfirm}
            disabled={isProcessing}
            className={`w-full py-3 rounded-xl font-bold text-white transition-all shadow-lg flex items-center justify-center gap-2 ${
              isProcessing
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.98]'
            }`}
          >
            {isProcessing ? (
              <>
                <Activity className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Rescan Document
              </>
            )}
          </button>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="w-full py-3 rounded-xl font-bold text-gray-700 hover:bg-gray-100 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-4 h-4" />
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
