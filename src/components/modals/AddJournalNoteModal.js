import React, { useState, useEffect } from 'react';
import { X, Save, Calendar } from 'lucide-react';
import { journalNoteService } from '../../firebase/services';
import { useBanner } from '../../contexts/BannerContext';
import { formatDateString, parseLocalDate } from '../../utils/helpers';
import DatePicker from '../DatePicker';

export default function AddJournalNoteModal({
  show,
  onClose,
  user,
  onNoteAdded,
  initialDate = null
}) {
  const { showSuccess, showError } = useBanner();
  const [noteContent, setNoteContent] = useState('');
  const [noteDate, setNoteDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (show) {
      // Set initial date if provided, otherwise use today
      if (initialDate) {
        setNoteDate(formatDateString(initialDate));
      } else {
        setNoteDate(formatDateString(new Date()));
      }
      setNoteContent('');
    } else {
      // Reset when modal closes
      setNoteDate('');
      setNoteContent('');
    }
  }, [show, initialDate]);

  if (!show) return null;

  const handleSave = async () => {
    if (!user || !noteContent.trim() || !noteDate) {
      showError('Please enter a note and select a date');
      return;
    }

    try {
      setIsSaving(true);

      const parsedDate = parseLocalDate(noteDate);

      await journalNoteService.addJournalNote({
        patientId: user.uid,
        date: parsedDate,
        content: noteContent.trim()
      });

      showSuccess('Note added successfully');
      setNoteContent('');
      setNoteDate('');

      if (onNoteAdded) {
        onNoteAdded();
      }

      onClose();
    } catch (error) {
      console.error('Error adding journal note:', error);
      showError('Failed to add note. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setNoteContent('');
    setNoteDate('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-white w-full h-full md:h-auto md:rounded-xl md:max-w-md md:max-h-[90vh] overflow-hidden flex flex-col animate-slide-up">
        <div className="flex-shrink-0 bg-white border-b p-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-medical-primary-600" />
            Add Journal Note
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition"
            type="button"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          <p className="text-sm text-gray-600">
            Add a note to your health journal. This note will be associated with the selected date.
          </p>

          {/* Date Input */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Date
            </label>
            <DatePicker
              value={noteDate}
              onChange={(e) => setNoteDate(e.target.value)}
              disabled={isSaving}
              placeholder="YYYY-MM-DD"
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">
              The date this note is associated with
            </p>
          </div>

          {/* Note Content */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Note
            </label>
            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Enter your note here..."
              rows={6}
              disabled={isSaving}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-medical-primary-500 resize-none disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-1">
              {noteContent.length}/2000 characters
            </p>
          </div>
        </div>

        <div className="flex-shrink-0 border-t p-4 bg-white">
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              disabled={isSaving}
              className="flex-1 bg-gray-200 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !noteContent.trim() || !noteDate}
              className="flex-1 bg-medical-primary-500 text-white py-2.5 rounded-lg font-medium hover:bg-medical-primary-600 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Add Note
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

