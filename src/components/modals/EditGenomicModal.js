import React from 'react';
import { X, AlertCircle, Check, Plus, Trash2 } from 'lucide-react';
import { DesignTokens, combineClasses } from '../../design/designTokens';
import { genomicProfileService } from '../../firebase/services';
import { useBanner } from '../../contexts/BannerContext';
import DatePicker from '../DatePicker';

export default function EditGenomicModal({ 
  show, 
  editingGenomicProfile,
  setEditingGenomicProfile,
  onClose, 
  user,
  setGenomicProfile,
  setMessages 
}) {
  const { showSuccess, showError } = useBanner();
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
      
      showSuccess('Genomic profile updated successfully!');
      onClose();
      setMessages(prev => [...prev, { type: 'ai', text: 'Genomic profile updated successfully!' }]);
    } catch (err) {
      showError('Failed to save genomic profile. Please try again.');
    }
  };

  const handleCancel = () => {
    onClose();
    setEditingGenomicProfile(null);
  };

  return (
    <div className={combineClasses('fixed inset-0 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-0 md:p-4', DesignTokens.components.modal.overlay)}>
      <div className={combineClasses('w-full h-full md:h-auto md:rounded-2xl md:max-w-4xl md:max-h-[90vh] overflow-hidden flex flex-col animate-slide-up', DesignTokens.components.modal.container)}>
        <div className={combineClasses('flex-shrink-0 border-b p-4 flex items-center justify-between', DesignTokens.components.modal.header)}>
          <h3 className={combineClasses('font-bold text-lg', DesignTokens.colors.neutral.text[800])}>Edit Genomic Profile</h3>
          <button
            onClick={handleCancel}
            className={combineClasses('transition', DesignTokens.components.modal.closeButton)}
          >
            <X size={24} />
          </button>
        </div>

        <div className={combineClasses('flex-1 overflow-y-auto p-4 sm:p-6 space-y-6', DesignTokens.components.modal.body)}>
          <div className={combineClasses('rounded-lg p-3', DesignTokens.components.alert.info.bg, DesignTokens.components.alert.info.border)}>
            <div className="flex items-start gap-2">
              <AlertCircle className={combineClasses('w-5 h-5 mt-0.5 flex-shrink-0', DesignTokens.components.alert.info.icon)} />
              <div className="flex-1">
                <p className={combineClasses('text-sm font-medium', DesignTokens.components.alert.info.text)}>Genomic Testing</p>
                <p className={combineClasses('text-xs mt-0.5', DesignTokens.components.alert.info.textSecondary)}>
                  Update your genomic test results to help match with relevant clinical trials
                </p>
              </div>
            </div>
          </div>

          {/* Test Information */}
          <div>
            <h4 className={combineClasses('font-semibold mb-3', DesignTokens.colors.neutral.text[800])}>Test Information</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={combineClasses('block text-sm font-medium mb-1', DesignTokens.colors.neutral.text[700])}>Test Name</label>
                <input
                  type="text"
                  value={editingGenomicProfile.testName || ''}
                  onChange={(e) => setEditingGenomicProfile({...editingGenomicProfile, testName: e.target.value})}
                  placeholder="e.g., FoundationOne CDx, Guardant360"
                  className={combineClasses('w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2', DesignTokens.components.input.base, 'focus:ring-medical-primary-500')}
                />
              </div>
              <div>
                <label className={combineClasses('block text-sm font-medium mb-1', DesignTokens.colors.neutral.text[700])}>Test Date</label>
                <DatePicker
                  value={editingGenomicProfile.testDate || ''}
                  onChange={(e) => setEditingGenomicProfile({...editingGenomicProfile, testDate: e.target.value})}
                  max={new Date().toISOString().split('T')[0]}
                  placeholder="YYYY-MM-DD"
                />
              </div>
              <div>
                <label className={combineClasses('block text-sm font-medium mb-1', DesignTokens.colors.neutral.text[700])}>Laboratory Name</label>
                <input
                  type="text"
                  value={editingGenomicProfile.laboratoryName || ''}
                  onChange={(e) => setEditingGenomicProfile({...editingGenomicProfile, laboratoryName: e.target.value})}
                  placeholder="e.g., Foundation Medicine"
                  className={combineClasses('w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2', DesignTokens.components.input.base, 'focus:ring-medical-primary-500')}
                />
              </div>
              <div>
                <label className={combineClasses('block text-sm font-medium mb-1', DesignTokens.colors.neutral.text[700])}>Specimen Type</label>
                <input
                  type="text"
                  value={editingGenomicProfile.specimenType || ''}
                  onChange={(e) => setEditingGenomicProfile({...editingGenomicProfile, specimenType: e.target.value})}
                  placeholder="e.g., FFPE tissue, Blood (ctDNA)"
                  className={combineClasses('w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2', DesignTokens.components.input.base, 'focus:ring-medical-primary-500')}
                />
              </div>
              <div>
                <label className={combineClasses('block text-sm font-medium mb-1', DesignTokens.colors.neutral.text[700])}>Tumor Purity</label>
                <input
                  type="text"
                  value={editingGenomicProfile.tumorPurity || ''}
                  onChange={(e) => setEditingGenomicProfile({...editingGenomicProfile, tumorPurity: e.target.value})}
                  placeholder="e.g., 70%"
                  className={combineClasses('w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2', DesignTokens.components.input.base, 'focus:ring-medical-primary-500')}
                />
              </div>
            </div>
          </div>

          {/* Mutations */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className={combineClasses('font-semibold', DesignTokens.colors.neutral.text[800])}>Mutations</h4>
              <button
                onClick={() => {
                  setEditingGenomicProfile({
                    ...editingGenomicProfile,
                    mutations: [...(editingGenomicProfile.mutations || []), { gene: '', variant: '', dna: '', protein: '', significance: '', type: '' }]
                  });
                }}
                className={combineClasses('text-sm font-medium flex items-center gap-1 transition', DesignTokens.colors.primary.text[600], DesignTokens.colors.primary.text[700].replace('text-', 'hover:text-'))}
              >
                <Plus className="w-4 h-4" />
                Add Mutation
              </button>
            </div>
            <div className="space-y-3">
              {editingGenomicProfile.mutations && editingGenomicProfile.mutations.length > 0 ? (
                editingGenomicProfile.mutations.map((mutation, idx) => (
                  <div key={idx} className={combineClasses('rounded-lg p-3 space-y-2', DesignTokens.components.card.nested)}>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className={combineClasses('block text-xs font-medium mb-1', DesignTokens.colors.neutral.text[600])}>Gene</label>
                        <input
                          type="text"
                          value={mutation.gene || ''}
                          onChange={(e) => {
                            const updated = [...editingGenomicProfile.mutations];
                            updated[idx] = {...updated[idx], gene: e.target.value};
                            setEditingGenomicProfile({...editingGenomicProfile, mutations: updated});
                          }}
                          placeholder="e.g., BRCA1"
                          className={combineClasses('w-full rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2', DesignTokens.components.input.base, 'focus:ring-medical-primary-500')}
                        />
                      </div>
                      <div>
                        <label className={combineClasses('block text-xs font-medium mb-1', DesignTokens.colors.neutral.text[600])}>Variant/Alteration</label>
                        <input
                          type="text"
                          value={mutation.variant || mutation.alteration || ''}
                          onChange={(e) => {
                            const updated = [...editingGenomicProfile.mutations];
                            updated[idx] = {...updated[idx], variant: e.target.value, alteration: e.target.value};
                            setEditingGenomicProfile({...editingGenomicProfile, mutations: updated});
                          }}
                          placeholder="e.g., c.5266dupC"
                          className={combineClasses('w-full rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2', DesignTokens.components.input.base, 'focus:ring-medical-primary-500')}
                        />
                      </div>
                      <div>
                        <label className={combineClasses('block text-xs font-medium mb-1', DesignTokens.colors.neutral.text[600])}>DNA Change</label>
                        <input
                          type="text"
                          value={mutation.dna || mutation.dnaChange || ''}
                          onChange={(e) => {
                            const updated = [...editingGenomicProfile.mutations];
                            updated[idx] = {...updated[idx], dna: e.target.value, dnaChange: e.target.value};
                            setEditingGenomicProfile({...editingGenomicProfile, mutations: updated});
                          }}
                          placeholder="e.g., c.5266dupC"
                          className={combineClasses('w-full rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2', DesignTokens.components.input.base, 'focus:ring-medical-primary-500')}
                        />
                      </div>
                      <div>
                        <label className={combineClasses('block text-xs font-medium mb-1', DesignTokens.colors.neutral.text[600])}>Protein Change</label>
                        <input
                          type="text"
                          value={mutation.protein || mutation.aminoAcidChange || ''}
                          onChange={(e) => {
                            const updated = [...editingGenomicProfile.mutations];
                            updated[idx] = {...updated[idx], protein: e.target.value, aminoAcidChange: e.target.value};
                            setEditingGenomicProfile({...editingGenomicProfile, mutations: updated});
                          }}
                          placeholder="e.g., p.Gln1756Profs*74"
                          className={combineClasses('w-full rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2', DesignTokens.components.input.base, 'focus:ring-medical-primary-500')}
                        />
                      </div>
                      <div>
                        <label className={combineClasses('block text-xs font-medium mb-1', DesignTokens.colors.neutral.text[600])}>Significance</label>
                        <select
                          value={mutation.significance || mutation.clinicalSignificance || ''}
                          onChange={(e) => {
                            const updated = [...editingGenomicProfile.mutations];
                            updated[idx] = {...updated[idx], significance: e.target.value, clinicalSignificance: e.target.value};
                            setEditingGenomicProfile({...editingGenomicProfile, mutations: updated});
                          }}
                          className={combineClasses('w-full rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2', DesignTokens.components.input.base, 'focus:ring-medical-primary-500')}
                        >
                          <option value="">Select...</option>
                          <option value="pathogenic">Pathogenic</option>
                          <option value="likely_pathogenic">Likely Pathogenic</option>
                          <option value="VUS">VUS (Variant of Uncertain Significance)</option>
                          <option value="benign">Benign</option>
                        </select>
                      </div>
                      <div>
                        <label className={combineClasses('block text-xs font-medium mb-1', DesignTokens.colors.neutral.text[600])}>Type</label>
                        <select
                          value={mutation.type || ''}
                          onChange={(e) => {
                            const updated = [...editingGenomicProfile.mutations];
                            updated[idx] = {...updated[idx], type: e.target.value};
                            setEditingGenomicProfile({...editingGenomicProfile, mutations: updated});
                          }}
                          className={combineClasses('w-full rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2', DesignTokens.components.input.base, 'focus:ring-medical-primary-500')}
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
                      className={combineClasses('text-xs flex items-center gap-1 transition', DesignTokens.components.alert.text.error, DesignTokens.components.alert.text.error.replace('text-', 'hover:text-').replace('600', '700'))}
                    >
                      <Trash2 className="w-3 h-3" />
                      Remove
                    </button>
                  </div>
                ))
              ) : (
                <p className={combineClasses('text-sm italic', DesignTokens.colors.neutral.text[500])}>No mutations added yet</p>
              )}
            </div>
          </div>

          {/* Biomarkers */}
          <div>
            <h4 className={combineClasses('font-semibold mb-3', DesignTokens.colors.neutral.text[800])}>Biomarkers</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={combineClasses('block text-sm font-medium mb-1', DesignTokens.colors.neutral.text[700])}>TMB (Tumor Mutational Burden)</label>
                <input
                  type="text"
                  value={editingGenomicProfile.tmb || ''}
                  onChange={(e) => setEditingGenomicProfile({...editingGenomicProfile, tmb: e.target.value})}
                  placeholder="e.g., 12.5 mutations/megabase"
                  className={combineClasses('w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2', DesignTokens.components.input.base, 'focus:ring-medical-primary-500')}
                />
              </div>
              <div>
                <label className={combineClasses('block text-sm font-medium mb-1', DesignTokens.colors.neutral.text[700])}>MSI (Microsatellite Instability)</label>
                <select
                  value={editingGenomicProfile.msi || ''}
                  onChange={(e) => setEditingGenomicProfile({...editingGenomicProfile, msi: e.target.value})}
                  className={combineClasses('w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2', DesignTokens.components.input.base, 'focus:ring-medical-primary-500')}
                >
                  <option value="">Select...</option>
                  <option value="MSI-H">MSI-H (High)</option>
                  <option value="MSS">MSS (Stable)</option>
                  <option value="MSI-L">MSI-L (Low)</option>
                </select>
              </div>
              <div>
                <label className={combineClasses('block text-sm font-medium mb-1', DesignTokens.colors.neutral.text[700])}>HRD Score</label>
                <input
                  type="number"
                  value={editingGenomicProfile.hrdScore || ''}
                  onChange={(e) => setEditingGenomicProfile({...editingGenomicProfile, hrdScore: e.target.value})}
                  placeholder="e.g., 48"
                  className={combineClasses('w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2', DesignTokens.components.input.base, 'focus:ring-medical-primary-500')}
                />
              </div>
            </div>
          </div>
        </div>

        <div className={combineClasses('flex-shrink-0 border-t p-4', DesignTokens.components.modal.footer)}>
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              className={combineClasses('flex-1 py-2.5 rounded-lg font-medium transition flex items-center justify-center gap-2', DesignTokens.components.button.secondary)}
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
            <button
              onClick={handleSave}
              className={combineClasses('flex-1 text-white py-2.5 rounded-lg font-medium transition flex items-center justify-center gap-2', DesignTokens.components.button.primary)}
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

