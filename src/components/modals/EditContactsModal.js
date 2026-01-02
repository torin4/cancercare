import React from 'react';
import { X, AlertCircle, Check, User, Trash2, Plus } from 'lucide-react';
import { emergencyContactService } from '../../firebase/services';

export default function EditContactsModal({ 
  show, 
  onClose, 
  editContacts, 
  setEditContacts, 
  emergencyContacts,
  setEmergencyContacts,
  user 
}) {
  if (!show) return null;

  const handleSave = async () => {
    try {
      // Filter out empty contacts (must have at least name or phone)
      const validContacts = editContacts.filter(c => 
        (c.name && c.name.trim()) || (c.phone && c.phone.trim())
      );
      
      if (validContacts.length === 0) {
        alert('Please add at least one contact with a name or phone number.');
        return;
      }

      // Get existing contact IDs
      const existingContactIds = new Set(emergencyContacts.map(c => c.id));
      const newContactIds = new Set(validContacts.filter(c => c.id).map(c => c.id));
      
      // Delete contacts that were removed
      const contactsToDelete = emergencyContacts.filter(c => 
        c.id && !newContactIds.has(c.id)
      );
      for (const contactToDelete of contactsToDelete) {
        await emergencyContactService.deleteEmergencyContact(contactToDelete.id);
      }

      // Save each valid contact via service
      const savedIds = [];
      for (const c of validContacts) {
        const toSave = {
          ...c,
          patientId: user.uid
        };
        const id = await emergencyContactService.saveEmergencyContact(toSave);
        savedIds.push(id);
      }
      
      // Reload contacts and filter out any empty ones
      const allContacts = await emergencyContactService.getEmergencyContacts(user.uid);
      const filteredContacts = allContacts.filter(c => 
        (c.name && c.name.trim()) || (c.phone && c.phone.trim())
      );
      setEmergencyContacts(filteredContacts);
      onClose();
      alert('Emergency contacts updated!');
    } catch (err) {
      console.error('Failed to save emergency contacts', err);
      alert('Failed to save emergency contacts.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end md:items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-white w-full h-full md:h-auto md:rounded-2xl md:max-w-2xl md:max-h-[85vh] overflow-hidden flex flex-col animate-slide-up">
        <div className="flex-shrink-0 bg-white border-b p-4 flex items-center justify-between">
          <h3 className="font-bold text-lg text-gray-800">Edit Emergency Contacts</h3>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="text-gray-500 hover:text-gray-700"
            type="button"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-900">Quick Access</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Keep your emergency contacts up to date for quick access
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {editContacts.map((c, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-800 mb-0 flex items-center">
                    <User size={18} className="mr-2 text-blue-600" />
                    <span className="capitalize">{c.contactType || 'Contact'}</span>
                  </h4>
                  <button
                    onClick={() => setEditContacts(prev => prev.filter((_, idx) => idx !== i))}
                    className="text-sm text-red-600 hover:underline flex items-center gap-1"
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
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={c.relationship || ''}
                    onChange={(e) => setEditContacts(prev => prev.map((item, idx) => idx === i ? { ...item, relationship: e.target.value } : item))}
                    placeholder="Relationship"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="tel"
                    value={c.phone || ''}
                    onChange={(e) => setEditContacts(prev => prev.map((item, idx) => idx === i ? { ...item, phone: e.target.value } : item))}
                    placeholder="Phone number"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="email"
                    value={c.email || ''}
                    onChange={(e) => setEditContacts(prev => prev.map((item, idx) => idx === i ? { ...item, email: e.target.value } : item))}
                    placeholder="Email (optional)"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={c.address || ''}
                    onChange={(e) => setEditContacts(prev => prev.map((item, idx) => idx === i ? { ...item, address: e.target.value } : item))}
                    placeholder="Address (street)"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={c.city || ''}
                      onChange={(e) => setEditContacts(prev => prev.map((item, idx) => idx === i ? { ...item, city: e.target.value } : item))}
                      placeholder="City"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      value={c.state || ''}
                      onChange={(e) => setEditContacts(prev => prev.map((item, idx) => idx === i ? { ...item, state: e.target.value } : item))}
                      placeholder="State"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      value={c.zip || ''}
                      onChange={(e) => setEditContacts(prev => prev.map((item, idx) => idx === i ? { ...item, zip: e.target.value } : item))}
                      placeholder="ZIP"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            ))}

            <div>
              <button
                onClick={() => setEditContacts(prev => [...prev, { contactType: 'Emergency', name: '', relationship: '', phone: '', email: '', address: '', city: '', state: '', zip: '' }])}
                className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm flex items-center gap-2"
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
              className="flex-1 bg-gray-200 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-300 transition flex items-center justify-center gap-2"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition flex items-center justify-center gap-2"
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

