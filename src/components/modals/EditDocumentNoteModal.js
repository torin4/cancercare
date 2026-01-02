import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { documentService, labService, vitalService } from '../../firebase/services';

export default function EditDocumentNoteModal({
  show,
  onClose,
  user,
  editingDocumentNote,
  setEditingDocumentNote,
  documentNoteEdit,
  setDocumentNoteEdit,
  setIsUploading,
  setUploadProgress,
  reloadHealthData,
  setDocuments
}) {
  useEffect(() => {
    if (show && editingDocumentNote) {
      setDocumentNoteEdit(editingDocumentNote.note || '');
    }
  }, [show, editingDocumentNote]);

  if (!show || !editingDocumentNote) return null;

  const handleSave = async () => {
    if (!editingDocumentNote || !user) return;
    try {
      setIsUploading(true);
      setUploadProgress('Updating note...');
      
      const oldNote = editingDocumentNote.note || '';
      const newNote = documentNoteEdit.trim();
      
      // Update document note
      await documentService.saveDocument({
        id: editingDocumentNote.id,
        note: newNote || null
      });
      
      // Find and update all lab values with matching note pattern
      const labs = await labService.getLabs(user.uid);
      for (const lab of labs) {
        const values = await labService.getLabValues(lab.id);
        for (const value of values) {
          const notePattern = oldNote 
            ? `Extracted from document. Context: ${oldNote}`
            : 'Extracted from document';
          if (value.notes === notePattern || (oldNote && value.notes?.includes(`Context: ${oldNote}`))) {
            const updatedNote = newNote 
              ? `Extracted from document. Context: ${newNote}`
              : 'Extracted from document';
            await labService.updateLabValueNote(lab.id, value.id, updatedNote);
          }
        }
      }
      
      // Find and update all vital values with matching note pattern
      const vitals = await vitalService.getVitals(user.uid);
      for (const vital of vitals) {
        const values = await vitalService.getVitalValues(vital.id);
        for (const value of values) {
          const notePattern = oldNote 
            ? `Extracted from document. Context: ${oldNote}`
            : 'Extracted from document';
          if (value.notes === notePattern || (oldNote && value.notes?.includes(`Context: ${oldNote}`))) {
            const updatedNote = newNote 
              ? `Extracted from document. Context: ${newNote}`
              : 'Extracted from document';
            await vitalService.updateVitalValueNote(vital.id, value.id, updatedNote);
          }
        }
      }
      
      // Update local documents state
      setDocuments(docs => docs.map(d => 
        d.id === editingDocumentNote.id 
          ? { ...d, note: newNote || null }
          : d
      ));
      
      // Reload health data to reflect updated notes
      await reloadHealthData();
      
      setIsUploading(false);
      setUploadProgress('');
      setEditingDocumentNote(null);
      setDocumentNoteEdit('');
      alert('Note updated successfully! All related lab/vital values have been updated.');
    } catch (error) {
      console.error('Error updating note:', error);
      alert('Error updating note. Please try again.');
      setIsUploading(false);
      setUploadProgress('');
    }
  };

  const handleClose = () => {
    setEditingDocumentNote(null);
    setDocumentNoteEdit('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-white w-full h-full md:h-auto md:rounded-xl md:max-w-md md:max-h-[90vh] overflow-hidden flex flex-col animate-slide-up">
        <div className="flex-shrink-0 bg-white border-b p-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Edit Document Note</h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition"
            type="button"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <p className="text-sm text-gray-600 mb-4">
            This note will be updated for the document and all lab/vital values extracted from it.
          </p>
          <textarea
            value={documentNoteEdit}
            onChange={(e) => setDocumentNoteEdit(e.target.value)}
            placeholder="e.g., Before starting treatment, After cycle 2, Post-surgery..."
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-medical-primary-500 resize-none"
          />
        </div>
        <div className="flex-shrink-0 border-t p-4 bg-white">
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="flex-1 bg-gray-200 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-300 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 bg-medical-primary-500 text-white py-2.5 rounded-lg font-medium hover:bg-medical-primary-600 transition flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save Note
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

