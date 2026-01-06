import React, { useState, useEffect } from 'react';
import { X, Save, Calendar } from 'lucide-react';
import { DesignTokens, combineClasses } from '../../design/designTokens';
import { journalNoteService } from '../../firebase/services';
import { useBanner } from '../../contexts/BannerContext';
import { formatDateString, parseLocalDate } from '../../utils/helpers';
import DatePicker from '../DatePicker';

export default function EditJournalNoteModal({
  show,
  onClose,
  user,
  editingNote,
  setEditingNote,
  onNoteUpdated
}) {
  const { showSuccess, showError } = useBanner();
  const [noteContent, setNoteContent] = useState('');
  const [noteDate, setNoteDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (show && editingNote) {
      // Load the note data
      setNoteContent(editingNote.content || '');
      setNoteDate(formatDateString(editingNote.date) || formatDateString(new Date()));
    } else {
      // Reset when modal closes
      setNoteDate('');
      setNoteContent('');
    }
  }, [show, editingNote]);

  if (!show || !editingNote) return null;

  const handleSave = async () => {
    if (!user || !noteContent.trim() || !noteDate) {
      showError('Please enter a note and select a date');
      return;
    }

    try {
      setIsSaving(true);

      const parsedDate = parseLocalDate(noteDate);

      await journalNoteService.updateJournalNote(editingNote.sourceId, {
        content: noteContent.trim(),
        date: parsedDate
      });

      showSuccess('Note updated successfully');
      setNoteContent('');
      setNoteDate('');

      if (onNoteUpdated) {
        onNoteUpdated();
      }

      setEditingNote(null);
      onClose();
    } catch (error) {
      showError('Failed to update note. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setNoteContent('');
    setNoteDate('');
    setEditingNote(null);
    onClose();
  };

  return (
    <div className={DesignTokens.components.modal.backdrop}>
      <div className={DesignTokens.components.modal.container}>
        <div className={DesignTokens.components.modal.header}>
          <h3 className={combineClasses(DesignTokens.components.modal.title, 'flex items-center gap-2')}>
            <Calendar className={combineClasses('w-5 h-5', DesignTokens.colors.app.text[600])} />
            Edit Journal Note
          </h3>
          <button
            onClick={handleClose}
            className={DesignTokens.components.modal.closeButton}
            type="button"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className={combineClasses(DesignTokens.components.modal.body, 'space-y-4')}>
          <p className={combineClasses('text-sm', DesignTokens.colors.app.text[600])}>
            Edit your journal note. You can change the content and date.
          </p>

          {/* Date Input */}
          <div>
            <label className={combineClasses('block text-sm font-semibold mb-2', DesignTokens.colors.app.text[900])}>
              Date
            </label>
            <DatePicker
              value={noteDate}
              onChange={(e) => setNoteDate(e.target.value)}
              disabled={isSaving}
              placeholder="YYYY-MM-DD"
              className="w-full"
            />
            <p className={combineClasses('text-xs mt-1', DesignTokens.colors.app.text[500])}>
              The date this note is associated with
            </p>
          </div>

          {/* Note Content */}
          <div>
            <label className={combineClasses('block text-sm font-semibold mb-2', DesignTokens.colors.app.text[900])}>
              Note
            </label>
            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Enter your note here..."
              rows={6}
              disabled={isSaving}
              className={combineClasses(DesignTokens.components.input.base, DesignTokens.components.input.textarea, DesignTokens.components.input.disabled)}
            />
            <p className={combineClasses('text-xs mt-1', DesignTokens.colors.app.text[500])}>
              {noteContent.length}/2000 characters
            </p>
          </div>
        </div>

        <div className={DesignTokens.components.modal.footer}>
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              disabled={isSaving}
              className={combineClasses(DesignTokens.components.button.secondary, DesignTokens.spacing.button.full, 'py-2.5 font-medium disabled:opacity-50 disabled:cursor-not-allowed')}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !noteContent.trim() || !noteDate}
              className={combineClasses(DesignTokens.components.button.primary, DesignTokens.spacing.button.full, 'py-2.5 font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed')}
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

