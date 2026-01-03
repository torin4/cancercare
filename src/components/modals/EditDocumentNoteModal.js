import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { documentService, labService, vitalService } from '../../firebase/services';
import { useBanner } from '../../contexts/BannerContext';
import { parseLocalDate, formatDateString } from '../../utils/helpers';
import DatePicker from '../DatePicker';

export default function EditDocumentNoteModal({
  show,
  onClose,
  user,
  editingDocumentNote,
  setEditingDocumentNote,
  setIsUploading,
  setUploadProgress,
  reloadHealthData,
  setDocuments
}) {
  const { showSuccess, showError } = useBanner();
  const [documentDateEdit, setDocumentDateEdit] = useState('');
  const [documentNoteEdit, setDocumentNoteEdit] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  // Initialize state when modal opens or document changes
  useEffect(() => {
    if (show && editingDocumentNote) {
      // Set note immediately
      const noteValue = editingDocumentNote.note || '';
      setDocumentNoteEdit(noteValue);
      
      // Format date for input[type="date"] using formatDateString helper
      // This handles Firestore Timestamps, Date objects, and strings consistently
      let dateValue = '';
      if (editingDocumentNote.date) {
        const formatted = formatDateString(editingDocumentNote.date);
        dateValue = formatted || '';
      }
      setDocumentDateEdit(dateValue);
    } else if (!show) {
      // Reset when modal closes
      setDocumentDateEdit('');
      setDocumentNoteEdit('');
    }
  }, [show, editingDocumentNote]);

  if (!show || !editingDocumentNote) return null;

  const handleSave = async () => {
    if (!editingDocumentNote || !user || isSaving) return;
    try {
      setIsSaving(true);
      
      const oldNote = editingDocumentNote.note || '';
      const newNote = documentNoteEdit.trim();
      
      // Format date properly: if provided, parse it; otherwise use null
      const formattedDate = documentDateEdit ? parseLocalDate(documentDateEdit) : null;
      
      // Update document date and note
      await documentService.saveDocument({
        id: editingDocumentNote.id,
        date: formattedDate,
        note: newNote || null
      });
      
      // Find and update all lab values linked to this document using documentId
      console.log(`[EditDocumentNoteModal] 🔄 Updating values for document ${editingDocumentNote.id}`);
      let updatedLabValues = 0;
      let updatedVitalValues = 0;
      
      const labs = await labService.getLabs(user.uid);
      for (const lab of labs) {
        const values = await labService.getLabValues(lab.id);
        for (const value of values) {
          // Use documentId to find related values (more reliable than note pattern)
          if (value.documentId === editingDocumentNote.id) {
            const updatedNote = newNote 
              ? `Extracted from document. Context: ${newNote}`
              : 'Extracted from document';
            
            // Update both note and date if document date changed
            await labService.updateLabValue(lab.id, value.id, {
              value: value.value, // Keep existing value
              date: formattedDate || value.date, // Update date if document date changed
              notes: updatedNote,
              documentId: editingDocumentNote.id // Ensure documentId is set
            });
            updatedLabValues++;
            console.log(`[EditDocumentNoteModal] ✓ Updated lab value ${value.id} (${lab.label || lab.labType})`);
          }
        }
      }
      
      // Find and update all vital values linked to this document using documentId
      const vitals = await vitalService.getVitals(user.uid);
      for (const vital of vitals) {
        const values = await vitalService.getVitalValues(vital.id);
        for (const value of values) {
          // Use documentId to find related values (more reliable than note pattern)
          if (value.documentId === editingDocumentNote.id) {
            const updatedNote = newNote 
              ? `Extracted from document. Context: ${newNote}`
              : 'Extracted from document';
            
            // Update both note and date if document date changed
            await vitalService.updateVitalValue(vital.id, value.id, {
              value: value.value, // Keep existing value
              date: formattedDate || value.date, // Update date if document date changed
              notes: updatedNote,
              systolic: value.systolic, // Keep existing BP values
              diastolic: value.diastolic,
              documentId: editingDocumentNote.id // Ensure documentId is set
            });
            updatedVitalValues++;
            console.log(`[EditDocumentNoteModal] ✓ Updated vital value ${value.id} (${vital.label || vital.vitalType})`);
          }
        }
      }
      
      console.log(`[EditDocumentNoteModal] ✅ Updated ${updatedLabValues} lab values and ${updatedVitalValues} vital values for document ${editingDocumentNote.id}`);
      
      // Update local documents state
      setDocuments(docs => docs.map(d => 
        d.id === editingDocumentNote.id 
          ? { ...d, date: formattedDate, note: newNote || null }
          : d
      ));
      
      // Reload health data to reflect updated notes and dates
      await reloadHealthData();
      
      setIsSaving(false);
      setEditingDocumentNote(null);
      setDocumentNoteEdit('');
      setDocumentDateEdit('');
      const valueCount = updatedLabValues + updatedVitalValues;
      showSuccess(`Document date and note updated successfully! ${valueCount} related value${valueCount !== 1 ? 's' : ''} updated.`);
    } catch (error) {
      console.error('Error updating document:', error);
      showError('Error updating document. Please try again.');
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setEditingDocumentNote(null);
    setDocumentNoteEdit('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-white w-full h-full md:h-auto md:rounded-xl md:max-w-md md:max-h-[90vh] overflow-hidden flex flex-col animate-slide-up">
        <div className="flex-shrink-0 bg-white border-b p-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Edit Document Date & Note</h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition"
            type="button"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          <p className="text-sm text-gray-600 mb-4">
            Update the document date and note. The note will be updated for the document and all lab/vital values extracted from it.
          </p>
          
          {/* Date Input */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Document Date
            </label>
            <DatePicker
              key={`date-input-${editingDocumentNote.id}`}
              value={documentDateEdit}
              onChange={(e) => setDocumentDateEdit(e.target.value)}
              disabled={isSaving}
              placeholder="YYYY-MM-DD"
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">
              The date when this document was created or the test was performed (not the upload date)
            </p>
          </div>
          
          {/* Note Input */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Document Note
            </label>
            <textarea
              value={documentNoteEdit}
              onChange={(e) => setDocumentNoteEdit(e.target.value)}
              placeholder="e.g., Before starting treatment, After cycle 2, Post-surgery..."
              rows={3}
              disabled={isSaving}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-medical-primary-500 resize-none disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-1">
              {documentNoteEdit.length}/200 characters
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
              disabled={isSaving}
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

