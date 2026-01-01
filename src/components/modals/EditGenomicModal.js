import React from 'react';
import { X, AlertCircle, Check, Plus, Trash2 } from 'lucide-react';
import { genomicProfileService } from '../../firebase/services';

export default function EditGenomicModal({ 
  show, 
  editingGenomicProfile,
  setEditingGenomicProfile,
  onClose, 
  user,
  setGenomicProfile,
  setMessages 
}) {
  if (!show || !editingGenomicProfile) return null;

  const handleSave = async () => {
    try {
      // Build the genomic profile object for saving
      const profileToSave = {
        mutations: editingGenomicProfile.mutations || [],
        biomarkers: {
          ...(editingGenomicProfile.biomarkers || {}),
          ...(editingGenomicProfile.tmb ? { tumorMutationalBurden: { value: editingGenomicProfile.tmb } } : {}),
          ...(editingGenomicProfile.msi ? { microsatelliteInstability: { status: editingGenomicProfile.msi } } : {}),
          ...(editingGenomicProfile.hrdScore ? { hrdScore: { value: parseFloat(editingGenomicProfile.hrdScore) } } : {})
        },
        testName: editingGenomicProfile.testName || '',
        testDate: editingGenomicProfile.testDate ? new Date(editingGenomicProfile.testDate) : null,
        laboratoryName: editingGenomicProfile.laboratoryName || '',
        specimenType: editingGenomicProfile.specimenType || '',
        tumorPurity: editingGenomicProfile.tumorPurity || '',
        tmb: editingGenomicProfile.tmb || '',
        msi: editingGenomicProfile.msi || '',
        hrdScore: editingGenomicProfile.hrdScore ? parseFloat(editingGenomicProfile.hrdScore) : null,
        cnvs: editingGenomicProfile.cnvs || [],
        fusions: editingGenomicProfile.fusions || [],
        germlineFindings: editingGenomicProfile.germlineFindings || []
      };

      await genomicProfileService.saveGenomicProfile(user.uid, profileToSave);
      
      // Reload the profile
      const updated = await genomicProfileService.getGenomicProfile(user.uid);
      setGenomicProfile(updated);
      
      onClose();
      setMessages(prev => [...prev, { type: 'ai', text: 'Genomic profile updated successfully!' }]);
    } catch (err) {
      console.error('Failed to save genomic profile', err);
      alert('Failed to save genomic profile. Please try again.');
    }
  };

  const handleCancel = () => {
    onClose();
    setEditingGenomicProfile(null);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-0 md:p-4">
      <div className="bg-white w-full h-full md:h-auto md:rounded-2xl md:max-w-4xl md:max-h-[90vh] overflow-hidden flex flex-col animate-slide-up">
        <div className="flex-shrink-0 bg-white border-b p-4 flex items-center justify-between">
          <h3 className="font-bold text-lg text-gray-800">Edit Genomic Profile</h3>
          <button
            onClick={handleCancel}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-purple-900">Genomic Testing</p>
                <p className="text-xs text-purple-700 mt-0.5">
                  Update your genomic test results to help match with relevant clinical trials
                </p>
              </div>
            </div>
          </div>

          {/* Test Information */}
          <div>
            <h4 className="font-semibold text-gray-800 mb-3">Test Information</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Test Name</label>
                <input
                  type="text"
                  value={editingGenomicProfile.testName || ''}
                  onChange={(e) => setEditingGenomicProfile({...editingGenomicProfile, testName: e.target.value})}
                  placeholder="e.g., FoundationOne CDx, Guardant360"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Test Date</label>
                <input
                  type="date"
                  value={editingGenomicProfile.testDate || ''}
                  onChange={(e) => setEditingGenomicProfile({...editingGenomicProfile, testDate: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Laboratory Name</label>
                <input
                  type="text"
                  value={editingGenomicProfile.laboratoryName || ''}
                  onChange={(e) => setEditingGenomicProfile({...editingGenomicProfile, laboratoryName: e.target.value})}
                  placeholder="e.g., Foundation Medicine"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Specimen Type</label>
                <input
                  type="text"
                  value={editingGenomicProfile.specimenType || ''}
                  onChange={(e) => setEditingGenomicProfile({...editingGenomicProfile, specimenType: e.target.value})}
                  placeholder="e.g., FFPE tissue, Blood (ctDNA)"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tumor Purity</label>
                <input
                  type="text"
                  value={editingGenomicProfile.tumorPurity || ''}
                  onChange={(e) => setEditingGenomicProfile({...editingGenomicProfile, tumorPurity: e.target.value})}
                  placeholder="e.g., 70%"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          </div>

          {/* Mutations */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-gray-800">Mutations</h4>
              <button
                onClick={() => {
                  setEditingGenomicProfile({
                    ...editingGenomicProfile,
                    mutations: [...(editingGenomicProfile.mutations || []), { gene: '', variant: '', dna: '', protein: '', significance: '', type: '' }]
                  });
                }}
                className="text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Add Mutation
              </button>
            </div>
            <div className="space-y-3">
              {editingGenomicProfile.mutations && editingGenomicProfile.mutations.length > 0 ? (
                editingGenomicProfile.mutations.map((mutation, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-lg p-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Gene</label>
                        <input
                          type="text"
                          value={mutation.gene || ''}
                          onChange={(e) => {
                            const updated = [...editingGenomicProfile.mutations];
                            updated[idx] = {...updated[idx], gene: e.target.value};
                            setEditingGenomicProfile({...editingGenomicProfile, mutations: updated});
                          }}
                          placeholder="e.g., BRCA1"
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Variant/Alteration</label>
                        <input
                          type="text"
                          value={mutation.variant || mutation.alteration || ''}
                          onChange={(e) => {
                            const updated = [...editingGenomicProfile.mutations];
                            updated[idx] = {...updated[idx], variant: e.target.value, alteration: e.target.value};
                            setEditingGenomicProfile({...editingGenomicProfile, mutations: updated});
                          }}
                          placeholder="e.g., c.5266dupC"
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">DNA Change</label>
                        <input
                          type="text"
                          value={mutation.dna || mutation.dnaChange || ''}
                          onChange={(e) => {
                            const updated = [...editingGenomicProfile.mutations];
                            updated[idx] = {...updated[idx], dna: e.target.value, dnaChange: e.target.value};
                            setEditingGenomicProfile({...editingGenomicProfile, mutations: updated});
                          }}
                          placeholder="e.g., c.5266dupC"
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Protein Change</label>
                        <input
                          type="text"
                          value={mutation.protein || mutation.aminoAcidChange || ''}
                          onChange={(e) => {
                            const updated = [...editingGenomicProfile.mutations];
                            updated[idx] = {...updated[idx], protein: e.target.value, aminoAcidChange: e.target.value};
                            setEditingGenomicProfile({...editingGenomicProfile, mutations: updated});
                          }}
                          placeholder="e.g., p.Gln1756Profs*74"
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Significance</label>
                        <select
                          value={mutation.significance || mutation.clinicalSignificance || ''}
                          onChange={(e) => {
                            const updated = [...editingGenomicProfile.mutations];
                            updated[idx] = {...updated[idx], significance: e.target.value, clinicalSignificance: e.target.value};
                            setEditingGenomicProfile({...editingGenomicProfile, mutations: updated});
                          }}
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-purple-500"
                        >
                          <option value="">Select...</option>
                          <option value="pathogenic">Pathogenic</option>
                          <option value="likely_pathogenic">Likely Pathogenic</option>
                          <option value="VUS">VUS (Variant of Uncertain Significance)</option>
                          <option value="benign">Benign</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                        <select
                          value={mutation.type || ''}
                          onChange={(e) => {
                            const updated = [...editingGenomicProfile.mutations];
                            updated[idx] = {...updated[idx], type: e.target.value};
                            setEditingGenomicProfile({...editingGenomicProfile, mutations: updated});
                          }}
                          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:ring-2 focus:ring-purple-500"
                        >
                          <option value="">Select...</option>
                          <option value="somatic">Somatic</option>
                          <option value="germline">Germline</option>
                        </select>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const updated = editingGenomicProfile.mutations.filter((_, i) => i !== idx);
                        setEditingGenomicProfile({...editingGenomicProfile, mutations: updated});
                      }}
                      className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      Remove
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500 italic">No mutations added yet</p>
              )}
            </div>
          </div>

          {/* Biomarkers */}
          <div>
            <h4 className="font-semibold text-gray-800 mb-3">Biomarkers</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">TMB (Tumor Mutational Burden)</label>
                <input
                  type="text"
                  value={editingGenomicProfile.tmb || ''}
                  onChange={(e) => setEditingGenomicProfile({...editingGenomicProfile, tmb: e.target.value})}
                  placeholder="e.g., 12.5 mutations/megabase"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">MSI (Microsatellite Instability)</label>
                <select
                  value={editingGenomicProfile.msi || ''}
                  onChange={(e) => setEditingGenomicProfile({...editingGenomicProfile, msi: e.target.value})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Select...</option>
                  <option value="MSI-H">MSI-H (High)</option>
                  <option value="MSS">MSS (Stable)</option>
                  <option value="MSI-L">MSI-L (Low)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">HRD Score</label>
                <input
                  type="number"
                  value={editingGenomicProfile.hrdScore || ''}
                  onChange={(e) => setEditingGenomicProfile({...editingGenomicProfile, hrdScore: e.target.value})}
                  placeholder="e.g., 48"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 bg-white border-t p-4">
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              className="flex-1 bg-gray-200 text-gray-700 py-2.5 rounded-lg font-medium hover:bg-gray-300 transition flex items-center justify-center gap-2"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 bg-purple-600 text-white py-2.5 rounded-lg font-medium hover:bg-purple-700 transition flex items-center justify-center gap-2"
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

