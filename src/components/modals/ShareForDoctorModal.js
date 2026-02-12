import React, { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { X, FileText, Loader2, Download, Cloud, Search } from 'lucide-react';
import { DesignTokens, combineClasses } from '../../design/designTokens';
import { usePatientContext } from '../../contexts/PatientContext';
import { labService, vitalService } from '../../firebase/services';
import { exportDoctorSummary } from '../../services/doctorSummaryService';
import { getLabDisplayName, getVitalDisplayName, categorizeLabs, normalizeLabName, shouldMergeLabNames } from '../../utils/normalizationUtils';
import { generateDoctorSummaryPdf } from '../../services/pdfReportService';
import { uploadFileToDrive, isGoogleDriveConfigured } from '../../services/googleDriveBackupService';
import { useBanner } from '../../contexts/BannerContext';

const DEFAULT_SECTIONS = {
  demographics: true,
  labs: true,
  vitals: true,
  medications: true,
  symptoms: true,
  genomic: true,
  documents: true,
  journalNotes: false
};

const DATE_RANGE_OPTIONS = [
  { value: '3m', label: 'Last 3 months' },
  { value: '6m', label: 'Last 6 months' },
  { value: '12m', label: 'Last 12 months' },
  { value: 'all', label: 'All time' },
  { value: 'custom', label: 'Custom range' }
];

function toLocalDateString(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function ShareForDoctorModal({ show, onClose, user }) {
  const { patientProfile } = usePatientContext();
  const { showSuccess, showError } = useBanner();
  const hiddenLabs = patientProfile?.hiddenLabs || [];
  const [sections, setSections] = useState(DEFAULT_SECTIONS);
  const [dateRange, setDateRange] = useState('6m');
  const [customStart, setCustomStart] = useState(toLocalDateString(new Date(Date.now() - 180 * 24 * 60 * 60 * 1000))); // 6 months ago
  const [customEnd, setCustomEnd] = useState(toLocalDateString(new Date()));
  // PDF always exports graph + list per metric (no display mode choice)
  const [alsoDownloadJson, setAlsoDownloadJson] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [previewPayload, setPreviewPayload] = useState(null);
  const [availableLabs, setAvailableLabs] = useState([]);
  const [availableVitals, setAvailableVitals] = useState([]);
  const [selectedVitalIds, setSelectedVitalIds] = useState([]);
  const [labSearch, setLabSearch] = useState('');
  const [vitalSearch, setVitalSearch] = useState('');
  const [showHiddenLabs, setShowHiddenLabs] = useState(false);
  // Lab selection by normalized type (one row per type, matching Labs screen)
  const [selectedLabKeys, setSelectedLabKeys] = useState([]);
  const prevLabsLengthRef = React.useRef(0);

  // Group labs by normalized type (same logic as Labs screen / transformLabsData) so count matches
  const labGroups = useMemo(() => {
    const labs = availableLabs || [];
    const byType = {};
    for (const lab of labs) {
      const normalizedLabType = normalizeLabName(lab.labType || lab.label || lab.name) ||
        (lab.labType || lab.label || 'unknown').toLowerCase().replace(/[\s\-_/.]/g, '');
      let mergedKey = normalizedLabType;
      for (const existingKey of Object.keys(byType)) {
        const labTypeMatch = shouldMergeLabNames(lab.labType, existingKey) ||
          shouldMergeLabNames(lab.label, existingKey) ||
          shouldMergeLabNames(lab.name, existingKey);
        const existingLab = byType[existingKey][0];
        const existingMatch = existingLab && (
          shouldMergeLabNames(existingLab.labType, normalizedLabType) ||
          shouldMergeLabNames(existingLab.label, normalizedLabType) ||
          shouldMergeLabNames(existingLab.name, normalizedLabType)
        );
        if (labTypeMatch || existingMatch) {
          mergedKey = existingKey;
          break;
        }
      }
      if (!byType[mergedKey]) byType[mergedKey] = [];
      byType[mergedKey].push(lab);
    }
    const keyToDocIds = {};
    const keyToRepresentativeLab = {};
    Object.entries(byType).forEach(([key, arr]) => {
      keyToDocIds[key] = arr.map((l) => l.id);
      keyToRepresentativeLab[key] = arr[0];
    });
    const allKeys = Object.keys(byType);
    return { byType, keyToDocIds, keyToRepresentativeLab, allKeys };
  }, [availableLabs]);

  useEffect(() => {
    if (!show || !user?.uid) return;
    let cancelled = false;
    (async () => {
      try {
        const [labs, vitals] = await Promise.all([
          labService.getLabs(user.uid),
          vitalService.getVitals(user.uid)
        ]);
        if (cancelled) return;
        setAvailableLabs(labs || []);
        setAvailableVitals(vitals || []);
        setSelectedVitalIds((prev) => (prev.length === 0 ? (vitals || []).map((v) => v.id) : prev));
      } catch {
        if (!cancelled) {
          setAvailableLabs([]);
          setAvailableVitals([]);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [show, user?.uid]);

  // When labs first load, select all lab types (matching Labs screen count)
  useEffect(() => {
    const n = availableLabs.length;
    if (n > prevLabsLengthRef.current && n > 0 && labGroups.allKeys.length > 0) {
      setSelectedLabKeys([...labGroups.allKeys]);
    }
    prevLabsLengthRef.current = n;
  }, [availableLabs.length, labGroups.allKeys]);

  if (!show) return null;

  const toggleSection = (key) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
    setError(null);
    setPreviewPayload(null);
  };

  const getOptions = () => {
    const opts = {
      sections: { ...sections },
      dateRange
    };
    if (dateRange === 'custom') {
      opts.customStart = customStart ? `${customStart}T00:00:00.000Z` : null;
      opts.customEnd = customEnd ? `${customEnd}T23:59:59.999Z` : null;
    }
    if (availableLabs.length > 0) {
      opts.selectedLabIds = selectedLabKeys.flatMap((k) => labGroups.keyToDocIds[k] || []);
    }
    if (availableVitals.length > 0) opts.selectedVitalIds = selectedVitalIds;
    return opts;
  };

  const toggleLab = (key) => {
    setSelectedLabKeys((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]));
    setPreviewPayload(null);
  };
  const toggleVital = (id) => {
    setSelectedVitalIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setPreviewPayload(null);
  };
  const selectAllLabs = () => {
    setSelectedLabKeys(labGroups.allKeys);
    setPreviewPayload(null);
  };
  const deselectAllLabs = () => {
    setSelectedLabKeys([]);
    setPreviewPayload(null);
  };
  const selectAllVitals = () => {
    setSelectedVitalIds(availableVitals.map((v) => v.id));
    setPreviewPayload(null);
  };
  const deselectAllVitals = () => {
    setSelectedVitalIds([]);
    setPreviewPayload(null);
  };

  const loadPayload = async () => {
    if (!user?.uid) throw new Error('Please sign in to create a summary.');
    return exportDoctorSummary(user.uid, getOptions());
  };

  const handlePreview = async () => {
    setError(null);
    setLoading(true);
    setPreviewPayload(null);
    try {
      const payload = await loadPayload();
      setPreviewPayload(payload);
    } catch (err) {
      setError(err.message || 'Failed to load preview.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    setError(null);
    setLoading(true);
    try {
      const payload = await loadPayload();
      const blob = generateDoctorSummaryPdf(payload, {});
      const dateStr = new Date().toISOString().slice(0, 10);
      triggerDownload(blob, `CancerCare-doctor-summary-${dateStr}.pdf`);
      if (alsoDownloadJson) {
        const jsonBlob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        triggerDownload(jsonBlob, `CancerCare-doctor-summary-${dateStr}.json`);
        showSuccess('PDF and JSON downloaded.');
      } else {
        showSuccess('PDF downloaded.');
      }
    } catch (err) {
      setError(err.message || 'Failed to generate PDF.');
      showError(err.message || 'Failed to generate PDF.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToDrive = async () => {
    setError(null);
    setLoading(true);
    try {
      const payload = await loadPayload();
      const blob = generateDoctorSummaryPdf(payload, {});
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `CancerCare-doctor-summary-${dateStr}.pdf`;
      const result = await uploadFileToDrive(blob, filename);
      showSuccess('Summary saved to Google Drive.');
      if (result.webViewLink) {
        window.open(result.webViewLink, '_blank');
      }
    } catch (err) {
      setError(err.message || 'Failed to upload to Google Drive.');
      showError(err.message || 'Failed to upload to Google Drive.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setPreviewPayload(null);
    setError(null);
    onClose();
  };

  const handleDateRangeChange = (value) => {
    setDateRange(value);
    setPreviewPayload(null);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4 bg-black/50" onClick={handleClose}>
      <div
        className={combineClasses('bg-white rounded-t-2xl sm:rounded-xl shadow-xl max-w-lg w-full max-h-[94vh] sm:max-h-[90vh] overflow-hidden flex flex-col', DesignTokens.colors.app.border[200], 'border')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={combineClasses('flex items-center justify-between p-3 sm:p-4 border-b shrink-0', DesignTokens.colors.app.border[200])}>
          <div className="flex items-center gap-2 min-w-0">
            <FileText className={combineClasses('w-5 h-5 shrink-0', DesignTokens.colors.app.text[600])} />
            <h2 className={combineClasses('text-base sm:text-lg font-semibold truncate', DesignTokens.colors.app.text[900])}>
              Share with your doctor
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className={combineClasses('p-2.5 -m-2.5 rounded-lg hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation', DesignTokens.colors.app.text[600])}
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3 sm:p-4 pb-24 sm:pb-4 space-y-4 overflow-y-auto min-h-0 flex-1">
          <p className={combineClasses('text-sm', DesignTokens.colors.app.text[600])}>
            Choose what to include and the date range. You can preview, download a PDF, or save to Google Drive.
          </p>

          <div>
            <p className={combineClasses('text-xs font-semibold mb-2', DesignTokens.colors.app.text[700])}>Include sections</p>
            <div className="grid grid-cols-2 gap-1 sm:gap-2">
              {Object.entries(sections).map(([key, checked]) => (
                <label key={key} className={combineClasses('flex items-center gap-2 cursor-pointer py-2.5 sm:py-1 min-h-[44px] sm:min-h-0 touch-manipulation', DesignTokens.colors.app.text[800])}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSection(key)}
                    className="rounded w-4 h-4 shrink-0"
                  />
                  <span className={combineClasses('text-sm break-words')}>
                    {key === 'journalNotes' ? 'Journal notes' : key.charAt(0).toUpperCase() + key.slice(1)}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {sections.labs && (
            <div>
              <p className={combineClasses('text-xs font-semibold mb-2', DesignTokens.colors.app.text[700])}>Labs to include</p>
              <div className="relative mb-2">
                <Search className={combineClasses('absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4', DesignTokens.colors.app.text[500])} />
                <input
                  type="text"
                  placeholder="Search labs..."
                  value={labSearch}
                  onChange={(e) => setLabSearch(e.target.value)}
                  className={combineClasses('w-full pl-8 pr-3 py-2.5 sm:py-1.5 text-base sm:text-sm border rounded-lg min-h-[44px] sm:min-h-0', DesignTokens.colors.app.border[200], 'placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-anchor-300')}
                  aria-label="Search labs"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <button type="button" onClick={selectAllLabs} className={combineClasses('text-xs px-3 py-2 rounded border min-h-[44px] touch-manipulation', DesignTokens.colors.app.border[200], DesignTokens.colors.app.text[600], 'hover:bg-gray-100 active:bg-gray-200')}>Select all</button>
                <button type="button" onClick={deselectAllLabs} className={combineClasses('text-xs px-3 py-2 rounded border min-h-[44px] touch-manipulation', DesignTokens.colors.app.border[200], DesignTokens.colors.app.text[600], 'hover:bg-gray-100 active:bg-gray-200')}>Deselect all</button>
                <span className={combineClasses('text-xs', DesignTokens.colors.app.text[500])}>{selectedLabKeys.length} selected</span>
              </div>
              <div className={combineClasses('max-h-[38vh] sm:max-h-32 overflow-y-auto overflow-x-hidden border rounded p-2 space-y-0.5 overscroll-contain', DesignTokens.colors.app.border[200])}>
                {availableLabs.length === 0 ? (
                  <p className={combineClasses('text-xs', DesignTokens.colors.app.text[500])}>No labs yet</p>
                ) : (() => {
                  const { keyToRepresentativeLab, allKeys } = labGroups;
                  const q = labSearch.trim().toLowerCase();
                  let filteredKeys = q
                    ? allKeys.filter((key) => {
                        const lab = keyToRepresentativeLab[key];
                        const raw = (lab?.name || lab?.labType || lab?.label || key || '').toString().toLowerCase();
                        const display = getLabDisplayName(lab?.name || lab?.labType || lab?.label || key).toLowerCase();
                        return raw.includes(q) || display.includes(q) || key.toLowerCase().includes(q);
                      })
                    : allKeys;
                  const hiddenKeyCount = filteredKeys.filter((key) => hiddenLabs.includes(key)).length;
                  if (!showHiddenLabs && hiddenLabs.length > 0) {
                    filteredKeys = filteredKeys.filter((key) => !hiddenLabs.includes(key));
                  }
                  if (filteredKeys.length === 0) {
                    return (
                      <div className="space-y-1">
                        <p className={combineClasses('text-xs', DesignTokens.colors.app.text[500])}>
                          {q ? `No labs match "${labSearch.trim()}"` : showHiddenLabs ? 'No labs' : 'No visible labs. Enable "Show hidden" to see hidden metrics.'}
                        </p>
                        {!showHiddenLabs && hiddenKeyCount > 0 && (
                          <button type="button" onClick={() => setShowHiddenLabs(true)} className={combineClasses('text-xs underline', DesignTokens.colors.app.text[600], 'hover:opacity-80')}>
                            Show hidden metrics ({hiddenKeyCount})
                          </button>
                        )}
                      </div>
                    );
                  }
                  const labsObj = {};
                  filteredKeys.forEach((key) => {
                    const lab = keyToRepresentativeLab[key];
                    if (lab) labsObj[key] = lab;
                  });
                  const byCategory = categorizeLabs(labsObj);
                  const categoryOrder = ['Disease-Specific Markers', 'Blood Counts', 'Kidney Function', 'Liver Function', 'Thyroid Function', 'Cardiac Markers', 'Inflammation', 'Electrolytes', 'Coagulation', 'Custom Values', 'Others'];
                  return (
                    <div className="space-y-3">
                      {hiddenLabs.length > 0 && (
                        <label className={combineClasses('flex items-center gap-2 cursor-pointer text-xs py-2 min-h-[44px] touch-manipulation', DesignTokens.colors.app.text[600])}>
                          <input type="checkbox" checked={showHiddenLabs} onChange={(e) => setShowHiddenLabs(e.target.checked)} className="rounded w-4 h-4 shrink-0" />
                          <span className="break-words">Show hidden metrics ({hiddenLabs.length})</span>
                        </label>
                      )}
                      {categoryOrder.map((cat) => {
                        const entries = byCategory[cat] || [];
                        if (entries.length === 0) return null;
                        return (
                          <div key={cat}>
                            <p className={combineClasses('text-xs font-semibold mb-1 break-words', DesignTokens.colors.app.text[600])}>{cat}</p>
                            <div className="space-y-0.5 pl-1">
                              {entries.map(([key, lab]) => {
                                const isHidden = hiddenLabs.includes(key);
                                return (
                                  <label key={key} className={combineClasses('flex items-center gap-2 cursor-pointer py-2 sm:py-1 min-h-[44px] sm:min-h-0 touch-manipulation', isHidden && 'opacity-60')}>
                                    <input type="checkbox" checked={selectedLabKeys.includes(key)} onChange={() => toggleLab(key)} className="rounded w-4 h-4 shrink-0" />
                                    <span className={combineClasses('text-sm break-words', isHidden ? DesignTokens.colors.app.text[500] : DesignTokens.colors.app.text[800])}>
                                      {getLabDisplayName(lab?.name || lab?.labType || lab?.label || key)}
                                      {isHidden && ' (hidden)'}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {sections.vitals && (
            <div>
              <p className={combineClasses('text-xs font-semibold mb-2', DesignTokens.colors.app.text[700])}>Vitals to include</p>
              <div className="relative mb-2">
                <Search className={combineClasses('absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4', DesignTokens.colors.app.text[500])} />
                <input
                  type="text"
                  placeholder="Search vitals..."
                  value={vitalSearch}
                  onChange={(e) => setVitalSearch(e.target.value)}
                  className={combineClasses('w-full pl-8 pr-3 py-2.5 sm:py-1.5 text-base sm:text-sm border rounded-lg min-h-[44px] sm:min-h-0', DesignTokens.colors.app.border[200], 'placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-anchor-300')}
                  aria-label="Search vitals"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <button type="button" onClick={selectAllVitals} className={combineClasses('text-xs px-3 py-2 rounded border min-h-[44px] touch-manipulation', DesignTokens.colors.app.border[200], DesignTokens.colors.app.text[600], 'hover:bg-gray-100 active:bg-gray-200')}>Select all</button>
                <button type="button" onClick={deselectAllVitals} className={combineClasses('text-xs px-3 py-2 rounded border min-h-[44px] touch-manipulation', DesignTokens.colors.app.border[200], DesignTokens.colors.app.text[600], 'hover:bg-gray-100 active:bg-gray-200')}>Deselect all</button>
                <span className={combineClasses('text-xs', DesignTokens.colors.app.text[500])}>{selectedVitalIds.length} selected</span>
              </div>
              <div className={combineClasses('max-h-[38vh] sm:max-h-32 overflow-y-auto overflow-x-hidden border rounded p-2 space-y-0.5 overscroll-contain', DesignTokens.colors.app.border[200])}>
                {availableVitals.length === 0 ? (
                  <p className={combineClasses('text-xs', DesignTokens.colors.app.text[500])}>No vitals yet</p>
                ) : (() => {
                  const q = vitalSearch.trim().toLowerCase();
                  const filtered = q ? availableVitals.filter((vital) => {
                    const raw = (vital.name || vital.vitalType || vital.id || '').toString().toLowerCase();
                    const display = getVitalDisplayName(vital.name || vital.vitalType || vital.id).toLowerCase();
                    return raw.includes(q) || display.includes(q);
                  }) : availableVitals;
                  return filtered.length === 0 ? (
                    <p className={combineClasses('text-xs', DesignTokens.colors.app.text[500])}>No vitals match &quot;{vitalSearch.trim()}&quot;</p>
                  ) : (
                    filtered.map((vital) => (
                      <label key={vital.id} className={combineClasses('flex items-center gap-2 cursor-pointer py-2 sm:py-1 min-h-[44px] sm:min-h-0 touch-manipulation')}>
                        <input type="checkbox" checked={selectedVitalIds.includes(vital.id)} onChange={() => toggleVital(vital.id)} className="rounded w-4 h-4 shrink-0" />
                        <span className={combineClasses('text-sm break-words', DesignTokens.colors.app.text[800])}>{getVitalDisplayName(vital.name || vital.vitalType || vital.id)}</span>
                      </label>
                    ))
                  );
                })()}
              </div>
            </div>
          )}

          <div>
            <p className={combineClasses('text-xs font-semibold mb-2', DesignTokens.colors.app.text[700])}>Date range</p>
            <div className="flex flex-wrap gap-x-3 gap-y-2">
              {DATE_RANGE_OPTIONS.map((opt) => (
                <label key={opt.value} className={combineClasses('flex items-center gap-2 cursor-pointer py-2 sm:py-0 min-h-[44px] sm:min-h-0 touch-manipulation')}>
                  <input
                    type="radio"
                    name="dateRange"
                    value={opt.value}
                    checked={dateRange === opt.value}
                    onChange={() => handleDateRangeChange(opt.value)}
                    className="w-4 h-4 shrink-0"
                  />
                  <span className={combineClasses('text-sm', DesignTokens.colors.app.text[800])}>{opt.label}</span>
                </label>
              ))}
            </div>
            {dateRange === 'custom' && (
              <div className="mt-3 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
                <label className="flex flex-col gap-1 sm:flex-row sm:items-center gap-2">
                  <span className={combineClasses('text-xs shrink-0', DesignTokens.colors.app.text[600])}>From</span>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => { setCustomStart(e.target.value); setPreviewPayload(null); }}
                    className={combineClasses('border rounded px-3 py-2.5 text-base sm:text-sm min-h-[44px] sm:min-h-0', DesignTokens.colors.app.border[200])}
                  />
                </label>
                <label className="flex flex-col gap-1 sm:flex-row sm:items-center gap-2">
                  <span className={combineClasses('text-xs shrink-0', DesignTokens.colors.app.text[600])}>To</span>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => { setCustomEnd(e.target.value); setPreviewPayload(null); }}
                    className={combineClasses('border rounded px-3 py-2.5 text-base sm:text-sm min-h-[44px] sm:min-h-0', DesignTokens.colors.app.border[200])}
                  />
                </label>
              </div>
            )}
          </div>

          <p className={combineClasses('text-xs break-words', DesignTokens.colors.app.text[500])}>
            Report includes a graph and a date/value list for each lab and vital, grouped by category.
          </p>

          <label className={combineClasses('flex items-center gap-2 cursor-pointer py-2 sm:py-0 min-h-[44px] sm:min-h-0 touch-manipulation')}>
            <input
              type="checkbox"
              checked={alsoDownloadJson}
              onChange={(e) => setAlsoDownloadJson(e.target.checked)}
              className="rounded w-4 h-4 shrink-0"
            />
            <span className={combineClasses('text-sm break-words', DesignTokens.colors.app.text[700])}>
              Also download data (JSON) when downloading PDF
            </span>
          </label>

          <p className={combineClasses('text-xs italic', DesignTokens.colors.app.text[500])}>
            Patient-generated summary from CancerCare. Not a substitute for official medical records.
          </p>

          {error && (
            <div className={combineClasses('p-3 rounded-lg text-sm', DesignTokens.components.status.high.bg, DesignTokens.components.status.high.border, DesignTokens.components.status.high.text)}>
              {error}
            </div>
          )}

          {previewPayload && (
            <div className={combineClasses('p-3 sm:p-4 rounded-lg border-2 border-anchor-200 bg-anchor-50 text-sm space-y-2 overflow-hidden', DesignTokens.colors.app.text[800])}>
              <p className="font-semibold text-anchor-900 break-words">Preview — report will include</p>
              <p className="text-anchor-700">Display: Graph and list for each lab and vital</p>
              <p className="text-anchor-700">Sections: {previewPayload.sectionsIncluded?.join(', ') || '—'}</p>
              <p className="text-anchor-700">
                Date range: {previewPayload.dateRange === 'custom' && previewPayload.customStart && previewPayload.customEnd
                  ? `${new Date(previewPayload.customStart).toLocaleDateString()} – ${new Date(previewPayload.customEnd).toLocaleDateString()}`
                  : previewPayload.dateRange}
              </p>
              <p className="text-anchor-700">Export date: {previewPayload.exportedAt ? new Date(previewPayload.exportedAt).toLocaleDateString() : '—'}</p>
              <ul className="list-disc list-inside text-anchor-700 mt-2 space-y-0.5 break-words">
                {previewPayload.data?.patientProfile && <li>Demographics & care team</li>}
                {previewPayload.data?.labs?.length > 0 && (
                  <li>Labs: {previewPayload.data.labs.length} type(s), {previewPayload.data.labs.reduce((acc, lab) => acc + (lab.values?.length || 0), 0)} value(s)</li>
                )}
                {previewPayload.data?.vitals?.length > 0 && (
                  <li>Vitals: {previewPayload.data.vitals.length} type(s), {previewPayload.data.vitals.reduce((acc, v) => acc + (v.values?.length || 0), 0)} value(s)</li>
                )}
                {previewPayload.data?.medications?.length > 0 && <li>Medications: {previewPayload.data.medications.length}</li>}
                {(previewPayload.data?.symptoms?.length !== undefined) && <li>Symptoms: {previewPayload.data.symptoms?.length || 0} entries</li>}
                {previewPayload.data?.genomicProfile && <li>Genomic summary</li>}
                {(previewPayload.data?.documents?.length !== undefined) && <li>Documents: {previewPayload.data.documents?.length || 0}</li>}
                {previewPayload.data?.journalNotes?.length > 0 && <li>Journal notes: {previewPayload.data.journalNotes.length}</li>}
              </ul>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 pt-2 pb-4 sm:pb-1">
            <button
              type="button"
              onClick={handlePreview}
              disabled={loading}
              className={combineClasses('flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 rounded-lg text-sm font-medium border transition disabled:opacity-50 min-h-[48px] sm:min-h-0 touch-manipulation w-full sm:w-auto', DesignTokens.colors.app.border[200], DesignTokens.colors.app.text[800], 'hover:bg-gray-50 active:bg-gray-100')}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Preview
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={loading}
              className={combineClasses('flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 rounded-lg text-sm font-medium bg-gray-900 text-white transition disabled:opacity-50 min-h-[48px] sm:min-h-0 hover:bg-gray-800 active:bg-gray-700 touch-manipulation w-full sm:w-auto')}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Download PDF
            </button>
            {isGoogleDriveConfigured() && (
              <button
                type="button"
                onClick={handleSaveToDrive}
                disabled={loading}
                className={combineClasses('flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 rounded-lg text-sm font-medium border transition disabled:opacity-50 min-h-[48px] sm:min-h-0 touch-manipulation w-full sm:w-auto', DesignTokens.colors.app.border[200], DesignTokens.colors.app.text[800], 'hover:bg-blue-50 hover:border-blue-200 active:bg-blue-100')}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
                Save to Google Drive
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

ShareForDoctorModal.propTypes = {
  show: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  user: PropTypes.shape({
    uid: PropTypes.string.isRequired
  })
};
