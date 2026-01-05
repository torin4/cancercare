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
    <div className={combineClasses(DesignTokens.components.modal.backdrop, 'z-50')}>
      <div className={combineClasses('w-full h-full md:h-auto md:max-w-4xl md:max-h-[90vh] overflow-hidden flex flex-col animate-slide-up', DesignTokens.borders.radius.lg, DesignTokens.components.modal.container)}>
        <div className={combineClasses('flex-shrink-0 border-b', DesignTokens.components.modal.header, DesignTokens.colors.neutral.border[200], 'bg-gray-50')}>
          <h3 className={combineClasses(DesignTokens.typography.h2.full, DesignTokens.typography.h2.weight, 'text-gray-800')}>Edit Genomic Profile</h3>
          <button
            onClick={handleCancel}
            className={combineClasses(DesignTokens.transitions.default, DesignTokens.components.modal.closeButton)}
          >
            <X className={DesignTokens.icons.header.size.full} />
          </button>
        </div>

        <div className={combineClasses('flex-1 overflow-y-auto', DesignTokens.components.modal.body, 'space-y-6', DesignTokens.spacing.gap.lg)}>
          <div className={combineClasses(DesignTokens.borders.radius.sm, DesignTokens.spacing.card.mobile, DesignTokens.components.alert.info.bg, DesignTokens.components.alert.info.border)}>
            <div className={combineClasses('flex items-start', DesignTokens.spacing.gap.sm)}>
              <AlertCircle className={combineClasses(DesignTokens.icons.button.size.full, 'mt-0.5 flex-shrink-0', DesignTokens.components.alert.info.icon)} />
              <div className="flex-1">
                <p className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, DesignTokens.components.alert.info.text)}>Genomic Testing</p>
                <p className={combineClasses(DesignTokens.typography.body.xs, 'mt-0.5', DesignTokens.components.alert.info.textSecondary)}>
                  Update your genomic test results to help match with relevant clinical trials
                </p>
              </div>
            </div>
          </div>

          {/* Test Information */}
          <div>
            <h4 className={combineClasses(DesignTokens.typography.h3.weight, 'mb-3', DesignTokens.colors.neutral.text[800])}>Test Information</h4>
            <div className={combineClasses('grid grid-cols-2', DesignTokens.spacing.gap.md)}>
              <div>
                <label className={combineClasses('block', DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, 'mb-1', DesignTokens.colors.neutral.text[700])}>Test Name</label>
                <input
                  type="text"
                  value={editingGenomicProfile.testName || ''}
                  onChange={(e) => setEditingGenomicProfile({...editingGenomicProfile, testName: e.target.value})}
                  placeholder="e.g., FoundationOne CDx, Guardant360"
                  className={combineClasses(DesignTokens.components.input.base, DesignTokens.borders.radius.sm, 'focus:ring-2 focus:ring-medical-primary-500')}
                />
              </div>
              <div>
                <label className={combineClasses('block', DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, 'mb-1', DesignTokens.colors.neutral.text[700])}>Test Date</label>
                <DatePicker
                  value={editingGenomicProfile.testDate || ''}
                  onChange={(e) => setEditingGenomicProfile({...editingGenomicProfile, testDate: e.target.value})}
                  max={new Date().toISOString().split('T')[0]}
                  placeholder="YYYY-MM-DD"
                />
              </div>
              <div>
                <label className={combineClasses('block', DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, 'mb-1', DesignTokens.colors.neutral.text[700])}>Laboratory Name</label>
                <input
                  type="text"
                  value={editingGenomicProfile.laboratoryName || ''}
                  onChange={(e) => setEditingGenomicProfile({...editingGenomicProfile, laboratoryName: e.target.value})}
                  placeholder="e.g., Foundation Medicine"
                  className={combineClasses(DesignTokens.components.input.base, DesignTokens.borders.radius.sm, 'focus:ring-2 focus:ring-medical-primary-500')}
                />
              </div>
              <div>
                <label className={combineClasses('block', DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, 'mb-1', DesignTokens.colors.neutral.text[700])}>Specimen Type</label>
                <input
                  type="text"
                  value={editingGenomicProfile.specimenType || ''}
                  onChange={(e) => setEditingGenomicProfile({...editingGenomicProfile, specimenType: e.target.value})}
                  placeholder="e.g., FFPE tissue, Blood (ctDNA)"
                  className={combineClasses(DesignTokens.components.input.base, DesignTokens.borders.radius.sm, 'focus:ring-2 focus:ring-medical-primary-500')}
                />
              </div>
              <div>
                <label className={combineClasses('block', DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, 'mb-1', DesignTokens.colors.neutral.text[700])}>Tumor Purity</label>
                <input
                  type="text"
                  value={editingGenomicProfile.tumorPurity || ''}
                  onChange={(e) => setEditingGenomicProfile({...editingGenomicProfile, tumorPurity: e.target.value})}
                  placeholder="e.g., 70%"
                  className={combineClasses(DesignTokens.components.input.base, DesignTokens.borders.radius.sm, 'focus:ring-2 focus:ring-medical-primary-500')}
                />
              </div>
            </div>
          </div>

          {/* Mutations */}
          <div>
            <div className={combineClasses('flex items-center justify-between mb-3')}>
              <h4 className={combineClasses(DesignTokens.typography.h3.weight, DesignTokens.colors.neutral.text[800])}>Mutations</h4>
              <button
                onClick={() => {
                  setEditingGenomicProfile({
                    ...editingGenomicProfile,
                    mutations: [...(editingGenomicProfile.mutations || []), { gene: '', variant: '', dna: '', protein: '', significance: '', type: '' }]
                  });
                }}
                className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, 'flex items-center transition', DesignTokens.spacing.gap.sm, DesignTokens.colors.primary.text[600], DesignTokens.colors.primary.text[700].replace('text-', 'hover:text-'))}
              >
                <Plus className={DesignTokens.icons.standard.size.full} />
                Add Mutation
              </button>
            </div>
            <div className={combineClasses('space-y-3', DesignTokens.spacing.gap.md)}>
              {editingGenomicProfile.mutations && editingGenomicProfile.mutations.length > 0 ? (
                editingGenomicProfile.mutations.map((mutation, idx) => (
                  <div key={idx} className={combineClasses(DesignTokens.borders.radius.sm, DesignTokens.spacing.card.mobile, 'space-y-2', DesignTokens.spacing.gap.sm, DesignTokens.components.card.nested)}>
                    <div className={combineClasses('grid grid-cols-2', DesignTokens.spacing.gap.sm)}>
                      <div>
                        <label className={combineClasses('block', DesignTokens.typography.body.xs, DesignTokens.typography.h3.weight, 'mb-1', DesignTokens.colors.neutral.text[600])}>Gene</label>
                        <input
                          type="text"
                          value={mutation.gene || ''}
                          onChange={(e) => {
                            const updated = [...editingGenomicProfile.mutations];
                            updated[idx] = {...updated[idx], gene: e.target.value};
                            setEditingGenomicProfile({...editingGenomicProfile, mutations: updated});
                          }}
                          placeholder="e.g., BRCA1"
                          className={combineClasses(DesignTokens.components.input.base, DesignTokens.borders.radius.sm, 'focus:ring-2 focus:ring-medical-primary-500')}
                        />
                      </div>
                      <div>
                        <label className={combineClasses('block', DesignTokens.typography.body.xs, DesignTokens.typography.h3.weight, 'mb-1', DesignTokens.colors.neutral.text[600])}>Variant/Alteration</label>
                        <input
                          type="text"
                          value={mutation.variant || mutation.alteration || ''}
                          onChange={(e) => {
                            const updated = [...editingGenomicProfile.mutations];
                            updated[idx] = {...updated[idx], variant: e.target.value, alteration: e.target.value};
                            setEditingGenomicProfile({...editingGenomicProfile, mutations: updated});
                          }}
                          placeholder="e.g., c.5266dupC"
                          className={combineClasses(DesignTokens.components.input.base, DesignTokens.borders.radius.sm, 'focus:ring-2 focus:ring-medical-primary-500')}
                        />
                      </div>
                      <div>
                        <label className={combineClasses('block', DesignTokens.typography.body.xs, DesignTokens.typography.h3.weight, 'mb-1', DesignTokens.colors.neutral.text[600])}>DNA Change</label>
                        <input
                          type="text"
                          value={mutation.dna || mutation.dnaChange || ''}
                          onChange={(e) => {
                            const updated = [...editingGenomicProfile.mutations];
                            updated[idx] = {...updated[idx], dna: e.target.value, dnaChange: e.target.value};
                            setEditingGenomicProfile({...editingGenomicProfile, mutations: updated});
                          }}
                          placeholder="e.g., c.5266dupC"
                          className={combineClasses(DesignTokens.components.input.base, DesignTokens.borders.radius.sm, 'focus:ring-2 focus:ring-medical-primary-500')}
                        />
                      </div>
                      <div>
                        <label className={combineClasses('block', DesignTokens.typography.body.xs, DesignTokens.typography.h3.weight, 'mb-1', DesignTokens.colors.neutral.text[600])}>Protein Change</label>
                        <input
                          type="text"
                          value={mutation.protein || mutation.aminoAcidChange || ''}
                          onChange={(e) => {
                            const updated = [...editingGenomicProfile.mutations];
                            updated[idx] = {...updated[idx], protein: e.target.value, aminoAcidChange: e.target.value};
                            setEditingGenomicProfile({...editingGenomicProfile, mutations: updated});
                          }}
                          placeholder="e.g., p.Gln1756Profs*74"
                          className={combineClasses(DesignTokens.components.input.base, DesignTokens.borders.radius.sm, 'focus:ring-2 focus:ring-medical-primary-500')}
                        />
                      </div>
                      <div>
                        <label className={combineClasses('block', DesignTokens.typography.body.xs, DesignTokens.typography.h3.weight, 'mb-1', DesignTokens.colors.neutral.text[600])}>Significance</label>
                        <select
                          value={mutation.significance || mutation.clinicalSignificance || ''}
                          onChange={(e) => {
                            const updated = [...editingGenomicProfile.mutations];
                            updated[idx] = {...updated[idx], significance: e.target.value, clinicalSignificance: e.target.value};
                            setEditingGenomicProfile({...editingGenomicProfile, mutations: updated});
                          }}
                          className={combineClasses(DesignTokens.components.input.base, DesignTokens.borders.radius.sm, 'focus:ring-2 focus:ring-medical-primary-500')}
                        >
                          <option value="">Select...</option>
                          <option value="pathogenic">Pathogenic</option>
                          <option value="likely_pathogenic">Likely Pathogenic</option>
                          <option value="VUS">VUS (Variant of Uncertain Significance)</option>
                          <option value="benign">Benign</option>
                        </select>
                      </div>
                      <div>
                        <label className={combineClasses('block', DesignTokens.typography.body.xs, DesignTokens.typography.h3.weight, 'mb-1', DesignTokens.colors.neutral.text[600])}>Type</label>
                        <select
                          value={mutation.type || ''}
                          onChange={(e) => {
                            const updated = [...editingGenomicProfile.mutations];
                            updated[idx] = {...updated[idx], type: e.target.value};
                            setEditingGenomicProfile({...editingGenomicProfile, mutations: updated});
                          }}
                          className={combineClasses(DesignTokens.components.input.base, DesignTokens.borders.radius.sm, 'focus:ring-2 focus:ring-medical-primary-500')}
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
                      className={combineClasses(DesignTokens.typography.body.xs, 'flex items-center transition', DesignTokens.spacing.gap.sm, DesignTokens.components.alert.text.error, DesignTokens.components.alert.text.error.replace('text-', 'hover:text-').replace('600', '700'))}
                    >
                      <Trash2 className={DesignTokens.icons.small.size.full} />
                      Remove
                    </button>
                  </div>
                ))
              ) : (
                <p className={combineClasses(DesignTokens.typography.body.sm, 'italic', DesignTokens.colors.neutral.text[500])}>No mutations added yet</p>
              )}
            </div>
          </div>

          {/* Biomarkers */}
          <div>
            <h4 className={combineClasses(DesignTokens.typography.h3.weight, 'mb-3', DesignTokens.colors.neutral.text[800])}>Biomarkers</h4>
            <div className={combineClasses('grid grid-cols-2', DesignTokens.spacing.gap.md)}>
              <div>
                <label className={combineClasses('block', DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, 'mb-1', DesignTokens.colors.neutral.text[700])}>TMB (Tumor Mutational Burden)</label>
                <input
                  type="text"
                  value={editingGenomicProfile.tmb || ''}
                  onChange={(e) => setEditingGenomicProfile({...editingGenomicProfile, tmb: e.target.value})}
                  placeholder="e.g., 12.5 mutations/megabase"
                  className={combineClasses(DesignTokens.components.input.base, DesignTokens.borders.radius.sm, 'focus:ring-2 focus:ring-medical-primary-500')}
                />
              </div>
              <div>
                <label className={combineClasses('block', DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, 'mb-1', DesignTokens.colors.neutral.text[700])}>MSI (Microsatellite Instability)</label>
                <select
                  value={editingGenomicProfile.msi || ''}
                  onChange={(e) => setEditingGenomicProfile({...editingGenomicProfile, msi: e.target.value})}
                  className={combineClasses(DesignTokens.components.input.base, DesignTokens.borders.radius.sm, 'focus:ring-2 focus:ring-medical-primary-500')}
                >
                  <option value="">Select...</option>
                  <option value="MSI-H">MSI-H (High)</option>
                  <option value="MSS">MSS (Stable)</option>
                  <option value="MSI-L">MSI-L (Low)</option>
                </select>
              </div>
              <div>
                <label className={combineClasses('block', DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, 'mb-1', DesignTokens.colors.neutral.text[700])}>HRD Score</label>
                <input
                  type="number"
                  value={editingGenomicProfile.hrdScore || ''}
                  onChange={(e) => setEditingGenomicProfile({...editingGenomicProfile, hrdScore: e.target.value})}
                  placeholder="e.g., 48"
                  className={combineClasses(DesignTokens.components.input.base, DesignTokens.borders.radius.sm, 'focus:ring-2 focus:ring-medical-primary-500')}
                />
              </div>
            </div>
          </div>
        </div>

        <div className={combineClasses('flex-shrink-0 border-t', DesignTokens.components.modal.footer, DesignTokens.colors.neutral.border[200])}>
          <div className={combineClasses('flex', DesignTokens.spacing.gap.md)}>
            <button
              onClick={handleCancel}
              className={combineClasses('flex-1 py-2.5', DesignTokens.borders.radius.sm, DesignTokens.typography.h3.weight, DesignTokens.transitions.default, 'flex items-center justify-center', DesignTokens.spacing.gap.sm, DesignTokens.components.button.secondary)}
            >
              <X className={DesignTokens.icons.standard.size.full} />
              Cancel
            </button>
            <button
              onClick={handleSave}
              className={combineClasses('flex-1 text-white py-2.5', DesignTokens.borders.radius.sm, DesignTokens.typography.h3.weight, DesignTokens.transitions.default, 'flex items-center justify-center', DesignTokens.spacing.gap.sm, 'bg-gray-800 hover:bg-gray-700')}
            >
              <Check className={DesignTokens.icons.standard.size.full} />
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

