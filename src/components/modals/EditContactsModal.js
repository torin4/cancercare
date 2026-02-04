import React, { useRef, useEffect } from 'react';
import { X, AlertCircle, Check, User, Trash2, Plus } from 'lucide-react';
import { DesignTokens, combineClasses } from '../../design/designTokens';
import { emergencyContactService } from '../../firebase/services';
import { useBanner } from '../../contexts/BannerContext';

export default function EditContactsModal({ 
  show, 
  onClose, 
  editContacts, 
  setEditContacts, 
  emergencyContacts,
  setEmergencyContacts,
  user 
}) {
  const { showSuccess, showError } = useBanner();
  // Snapshot of contact ids when modal opened — used to compute which contacts were removed
  const initialContactIdsRef = useRef(null);

  useEffect(() => {
    if (show && Array.isArray(editContacts)) {
      initialContactIdsRef.current = editContacts
        .filter(c => c && c.id)
        .map(c => c.id);
    } else if (!show) {
      initialContactIdsRef.current = null;
    }
  }, [show]); // Only capture snapshot when modal opens; do not overwrite when editContacts changes

  if (!show) return null;

  const handleSave = async () => {
    const LOG = '[EditContactsModal]';
    try {
      console.log(LOG, 'handleSave started', { editContactsCount: editContacts.length, userId: user?.uid });

      // Filter out empty contacts (must have at least name or phone)
      const validContacts = editContacts.filter(c =>
        (c.name && c.name.trim()) || (c.phone && c.phone.trim())
      );
      console.log(LOG, 'validContacts', { count: validContacts.length, validContacts });

      if (validContacts.length === 0) {
        showError('Please add at least one contact with a name or phone number.');
        return;
      }

      const remainingIds = new Set(validContacts.filter(c => c.id).map(c => c.id));

      // Delete contacts that were in the list when we opened but are no longer in validContacts
      const idsToDelete = (initialContactIdsRef.current || []).filter(id => id && !remainingIds.has(id));
      console.log(LOG, 'contactsToDelete', { count: idsToDelete.length, ids: idsToDelete });

      for (const contactId of idsToDelete) {
        if (!contactId) continue;
        console.log(LOG, 'deleting contact', contactId);
        await emergencyContactService.deleteEmergencyContact(contactId);
        console.log(LOG, 'deleted contact', contactId);
      }

      // Save each valid contact via service
      const savedIds = [];
      for (let i = 0; i < validContacts.length; i++) {
        const c = validContacts[i];
        const toSave = { ...c, patientId: user.uid };
        console.log(LOG, `saveEmergencyContact ${i + 1}/${validContacts.length}`, { hasId: !!c.id, toSave });
        try {
          const id = await emergencyContactService.saveEmergencyContact(toSave);
          savedIds.push(id);
          console.log(LOG, `saved contact ${i + 1}`, { id });
        } catch (saveErr) {
          console.error(LOG, `saveEmergencyContact failed for contact ${i + 1}`, { contact: c, error: saveErr, message: saveErr?.message, code: saveErr?.code });
          throw saveErr;
        }
      }

      console.log(LOG, 'all contacts saved, reloading', { savedIds });

      // Reload contacts and filter out any empty ones
      const allContacts = await emergencyContactService.getEmergencyContacts(user.uid);
      const filteredContacts = allContacts.filter(c =>
        (c.name && c.name.trim()) || (c.phone && c.phone.trim())
      );
      setEmergencyContacts(filteredContacts);
      showSuccess('Emergency contacts updated!');
      onClose();
      console.log(LOG, 'handleSave completed successfully');
    } catch (err) {
      console.error(LOG, 'Save failed');
      console.error(LOG, '  message:', err?.message);
      console.error(LOG, '  code:', err?.code);
      console.error(LOG, '  error:', err);
      if (err?.stack) console.error(LOG, '  stack:', err.stack);
      showError(err?.message || 'Failed to save emergency contacts.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-white w-full h-full md:h-auto md:rounded-2xl md:max-w-2xl md:max-h-[85vh] overflow-hidden flex flex-col animate-slide-up">
        <div className="flex-shrink-0 bg-white border-b p-4 flex items-center justify-between">
          <h3 className={combineClasses('font-bold text-lg', DesignTokens.colors.neutral.text[800])}>Edit Emergency Contacts</h3>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className={combineClasses('transition', DesignTokens.colors.neutral.text[500], DesignTokens.colors.neutral.text[700].replace('text-', 'hover:text-'))}
            type="button"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className={combineClasses('border rounded-lg p-3', DesignTokens.components.status.low.bg, DesignTokens.components.status.low.border)}>
            <div className="flex items-start gap-2">
              <AlertCircle className={combineClasses('w-5 h-5 mt-0.5 flex-shrink-0', DesignTokens.components.status.low.icon)} />
              <div className="flex-1">
                <p className={combineClasses('text-sm font-medium', DesignTokens.components.status.low.text.replace('600', '900'))}>Quick Access</p>
                <p className={combineClasses('text-xs mt-0.5', DesignTokens.components.status.low.text.replace('600', '700'))}>
                  Keep your emergency contacts up to date for quick access
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {editContacts.map((c, i) => (
              <div key={i} className={combineClasses('border rounded-lg p-4', DesignTokens.colors.neutral.border[200])}>
                <div className="flex items-center justify-between mb-3">
                  <h4 className={combineClasses('font-semibold mb-0 flex items-center', DesignTokens.colors.neutral.text[800])}>
                    <User size={18} className={combineClasses('mr-2', DesignTokens.colors.primary.text[600])} />
                    <span className="capitalize">{c.contactType || 'Contact'}</span>
                  </h4>
                  <button
                    onClick={() => setEditContacts(prev => prev.filter((_, idx) => idx !== i))}
                    className={combineClasses('text-sm hover:underline flex items-center gap-1', DesignTokens.components.alert.text.error)}
                  >
                    <Trash2 className="w-4 h-4" />
                    Remove
                  </button>
                </div>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={c.name || ''}
                    onChange={(e) => setEditContacts(prev => prev.map((item, idx) => idx === i ? { ...item, name: e.target.value } : item))}
                    placeholder="Contact name"
                    className={combineClasses(DesignTokens.components.input.base)}
                  />
                  <input
                    type="text"
                    value={c.relationship || ''}
                    onChange={(e) => setEditContacts(prev => prev.map((item, idx) => idx === i ? { ...item, relationship: e.target.value } : item))}
                    placeholder="Relationship"
                    className={combineClasses(DesignTokens.components.input.base)}
                  />
                  <input
                    type="tel"
                    value={c.phone || ''}
                    onChange={(e) => setEditContacts(prev => prev.map((item, idx) => idx === i ? { ...item, phone: e.target.value } : item))}
                    placeholder="Phone number"
                    className={combineClasses(DesignTokens.components.input.base)}
                  />
                  <input
                    type="email"
                    value={c.email || ''}
                    onChange={(e) => setEditContacts(prev => prev.map((item, idx) => idx === i ? { ...item, email: e.target.value } : item))}
                    placeholder="Email (optional)"
                    className={combineClasses(DesignTokens.components.input.base)}
                  />
                  <input
                    type="text"
                    value={c.address || ''}
                    onChange={(e) => setEditContacts(prev => prev.map((item, idx) => idx === i ? { ...item, address: e.target.value } : item))}
                    placeholder="Address (street)"
                    className={combineClasses(DesignTokens.components.input.base)}
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={c.city || ''}
                      onChange={(e) => setEditContacts(prev => prev.map((item, idx) => idx === i ? { ...item, city: e.target.value } : item))}
                      placeholder="City"
                      className={combineClasses(DesignTokens.components.input.base)}
                    />
                    <input
                      type="text"
                      value={c.state || ''}
                      onChange={(e) => setEditContacts(prev => prev.map((item, idx) => idx === i ? { ...item, state: e.target.value } : item))}
                      placeholder="State"
                      className={combineClasses(DesignTokens.components.input.base)}
                    />
                    <input
                      type="text"
                      value={c.zip || ''}
                      onChange={(e) => setEditContacts(prev => prev.map((item, idx) => idx === i ? { ...item, zip: e.target.value } : item))}
                      placeholder="ZIP"
                      className={combineClasses(DesignTokens.components.input.base)}
                    />
                  </div>
                </div>
              </div>
            ))}

            <div>
              <button
                onClick={() => setEditContacts(prev => [...prev, { contactType: 'Emergency', name: '', relationship: '', phone: '', email: '', address: '', city: '', state: '', zip: '' }])}
                className={combineClasses('px-3 py-2 text-white rounded-lg text-sm flex items-center gap-2', DesignTokens.components.status.normal.text.replace('text-', 'bg-').replace('600', '600'))}
              >
                <Plus className="w-4 h-4" />
                Add Contact
              </button>
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 bg-white border-t p-4">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className={combineClasses('flex-1 py-2.5 rounded-lg font-medium transition flex items-center justify-center gap-2', DesignTokens.colors.neutral[200], DesignTokens.colors.neutral.text[700], DesignTokens.colors.neutral[300].replace('bg-', 'hover:bg-'))}
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
            <button
              onClick={handleSave}
              className={combineClasses(DesignTokens.components.button.primary, DesignTokens.spacing.button.full, 'py-2.5 font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed')}
            >
              <Check className="w-4 h-4" />
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

