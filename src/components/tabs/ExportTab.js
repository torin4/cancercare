import React, { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {
  CalendarRange,
  CheckCircle2,
  Cloud,
  Download,
  Loader2,
  Search,
  Share,
  X
} from 'lucide-react';
import { DesignTokens, Layouts, combineClasses } from '../../design/designTokens';
import { useAuth } from '../../contexts/AuthContext';
import { usePatientContext } from '../../contexts/PatientContext';
import { useBanner } from '../../contexts/BannerContext';
import { labService, vitalService } from '../../firebase/services';
import { exportDoctorSummary } from '../../services/doctorSummaryService';
import { generateDoctorSummaryPdf } from '../../services/pdfReportService';
import { uploadFileToDrive, isGoogleDriveConfigured } from '../../services/googleDriveBackupService';
import {
  categorizeLabs,
  getLabDisplayName,
  getVitalDisplayName,
  normalizeLabName,
  normalizeVitalName,
  shouldMergeLabNames
} from '../../utils/normalizationUtils';

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

const CURATED_KEY_LAB_SET = new Set([
  'ca125',
  'ca199',
  'cea',
  'afp',
  'betahcg',
  'scc_antigen',
  'nse',
  'wbc',
  'rbc',
  'hemoglobin',
  'hematocrit',
  'platelets',
  'creatinine',
  'egfr',
  'bun',
  'uric_acid',
  'sodium',
  'potassium',
  'chloride',
  'calcium',
  'magnesium',
  'phosphorus',
  'albumin',
  'alt',
  'ast',
  'alp',
  'bilirubin_total',
  'ldh',
  'ggt',
  'ck',
  'crp',
  'ferritin',
  'fibrinogen',
  'd_dimer',
  'pt',
  'inr',
  'aptt'
]);

const CURATED_KEY_VITAL_SET = new Set([
  'blood_pressure',
  'heart_rate',
  'temperature',
  'weight',
  'oxygen_saturation'
]);

function normalizeLooseKey(raw) {
  return String(raw || '').toLowerCase().replace(/[\s\-_/.]/g, '');
}

function sameSelection(a = [], b = []) {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  if (setA.size !== b.length) return false;
  for (const item of b) {
    if (!setA.has(item)) return false;
  }
  return true;
}

function toValidDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

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

export default function ExportTab({ onTabChange }) {
  const { user } = useAuth();
  const { patientProfile } = usePatientContext();
  const { showSuccess, showError } = useBanner();
  const hiddenLabs = patientProfile?.hiddenLabs || [];

  const [sections, setSections] = useState(DEFAULT_SECTIONS);
  const [dateRange, setDateRange] = useState('6m');
  const [customStart, setCustomStart] = useState(toLocalDateString(new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)));
  const [customEnd, setCustomEnd] = useState(toLocalDateString(new Date()));
  const [keyMetricsOnly, setKeyMetricsOnly] = useState(false);
  const [alsoDownloadJson, setAlsoDownloadJson] = useState(false);
  const [loadingAction, setLoadingAction] = useState(null);
  const [error, setError] = useState(null);
  const [previewPayload, setPreviewPayload] = useState(null);
  const [showShareOptions, setShowShareOptions] = useState(false);
  const [availableLabs, setAvailableLabs] = useState([]);
  const [availableVitals, setAvailableVitals] = useState([]);
  const [selectedVitalIds, setSelectedVitalIds] = useState([]);
  const [labSearch, setLabSearch] = useState('');
  const [vitalSearch, setVitalSearch] = useState('');
  const [showHiddenLabs, setShowHiddenLabs] = useState(false);
  const [selectedLabKeys, setSelectedLabKeys] = useState([]);
  const prevLabsLengthRef = useRef(0);

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

  const favoriteLabSet = useMemo(() => {
    const favoriteLabs = patientProfile?.favoriteMetrics?.labs || [];
    return new Set(favoriteLabs.map((k) => normalizeLabName(k) || normalizeLooseKey(k)));
  }, [patientProfile?.favoriteMetrics?.labs]);

  const favoriteVitalSet = useMemo(() => {
    const favoriteVitals = patientProfile?.favoriteMetrics?.vitals || [];
    return new Set(favoriteVitals.map((k) => normalizeVitalName(k) || normalizeLooseKey(k)));
  }, [patientProfile?.favoriteMetrics?.vitals]);

  const keyLabKeys = useMemo(() => {
    const allKeys = labGroups.allKeys || [];
    if (allKeys.length === 0) return [];

    const favoriteMatches = allKeys.filter((key) => {
      const canonical = normalizeLabName(key) || normalizeLooseKey(key);
      return favoriteLabSet.has(canonical);
    });
    if (favoriteMatches.length > 0) return favoriteMatches;

    return allKeys.filter((key) => {
      const canonical = normalizeLabName(key) || normalizeLooseKey(key);
      return CURATED_KEY_LAB_SET.has(canonical);
    });
  }, [labGroups.allKeys, favoriteLabSet]);

  const keyVitalIds = useMemo(() => {
    if (!Array.isArray(availableVitals) || availableVitals.length === 0) return [];

    const favoriteMatches = availableVitals
      .filter((vital) => {
        const canonical = normalizeVitalName(vital.vitalType || vital.name || vital.id) ||
          normalizeLooseKey(vital.vitalType || vital.name || vital.id);
        return favoriteVitalSet.has(canonical);
      })
      .map((vital) => vital.id);
    if (favoriteMatches.length > 0) return favoriteMatches;

    return availableVitals
      .filter((vital) => {
        const canonical = normalizeVitalName(vital.vitalType || vital.name || vital.id) ||
          normalizeLooseKey(vital.vitalType || vital.name || vital.id);
        return CURATED_KEY_VITAL_SET.has(canonical);
      })
      .map((vital) => vital.id);
  }, [availableVitals, favoriteVitalSet]);

  useEffect(() => {
    if (!keyMetricsOnly) return;

    setSelectedLabKeys((prev) => (sameSelection(prev, keyLabKeys) ? prev : [...keyLabKeys]));
    setSelectedVitalIds((prev) => (sameSelection(prev, keyVitalIds) ? prev : [...keyVitalIds]));
  }, [keyMetricsOnly, keyLabKeys, keyVitalIds]);

  useEffect(() => {
    if (!user?.uid) return;
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
      } catch (loadError) {
        if (!cancelled) {
          setAvailableLabs([]);
          setAvailableVitals([]);
          setError(loadError?.message || 'Failed to load labs and vitals for export.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  useEffect(() => {
    const n = availableLabs.length;
    if (n > prevLabsLengthRef.current && n > 0 && labGroups.allKeys.length > 0) {
      setSelectedLabKeys([...labGroups.allKeys]);
    }
    prevLabsLengthRef.current = n;
  }, [availableLabs.length, labGroups.allKeys]);

  const isBusy = loadingAction !== null;

  const clearOutputState = () => {
    setPreviewPayload(null);
    setError(null);
  };

  const toggleSection = (key) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
    clearOutputState();
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
      const effectiveLabKeys = keyMetricsOnly ? keyLabKeys : selectedLabKeys;
      opts.selectedLabIds = effectiveLabKeys.flatMap((k) => labGroups.keyToDocIds[k] || []);
    }
    if (availableVitals.length > 0) {
      opts.selectedVitalIds = keyMetricsOnly ? keyVitalIds : selectedVitalIds;
    }
    return opts;
  };

  const toggleLab = (key) => {
    setSelectedLabKeys((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]));
    clearOutputState();
  };
  const toggleVital = (id) => {
    setSelectedVitalIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    clearOutputState();
  };
  const selectAllLabs = () => {
    setSelectedLabKeys(labGroups.allKeys);
    clearOutputState();
  };
  const deselectAllLabs = () => {
    setSelectedLabKeys([]);
    clearOutputState();
  };
  const selectAllVitals = () => {
    setSelectedVitalIds(availableVitals.map((v) => v.id));
    clearOutputState();
  };
  const deselectAllVitals = () => {
    setSelectedVitalIds([]);
    clearOutputState();
  };

  const loadPayload = async () => {
    if (!user?.uid) throw new Error('Please sign in to create a summary.');
    if (dateRange === 'custom' && customStart && customEnd && customStart > customEnd) {
      throw new Error('Custom date range is invalid. "From" must be on or before "To".');
    }
    return exportDoctorSummary(user.uid, getOptions());
  };

  const handlePreview = async () => {
    setError(null);
    setLoadingAction('preview');
    try {
      const payload = await loadPayload();
      setPreviewPayload(payload);
    } catch (previewError) {
      setError(previewError.message || 'Failed to load preview.');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSharePdf = async () => {
    setError(null);
    setLoadingAction('share');
    try {
      const payload = await loadPayload();
      const blob = generateDoctorSummaryPdf(payload, {});
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `CancerCare-doctor-summary-${dateStr}.pdf`;

      const file = new File([blob], filename, { type: 'application/pdf' });
      const shareData = {
        title: 'CancerCare Summary',
        text: 'Doctor-ready summary from CancerCare',
        files: [file],
      };

      if (typeof navigator !== 'undefined' && navigator.share) {
        const canShareFiles = typeof navigator.canShare !== 'function' || navigator.canShare(shareData);
        if (canShareFiles) {
          await navigator.share(shareData);
          return;
        }
      }

      setShowShareOptions(true);
    } catch (shareError) {
      // User cancelled share sheet
      if (shareError?.name === 'AbortError') return;
      const message = shareError?.message || 'Failed to share PDF.';
      setError(message);
      showError(message);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDownloadPdf = async () => {
    setError(null);
    setLoadingAction('download');
    try {
      const payload = await loadPayload();
      const blob = generateDoctorSummaryPdf(payload, {});
      const dateStr = new Date().toISOString().slice(0, 10);
      triggerDownload(blob, `CancerCare-doctor-summary-${dateStr}.pdf`);
      if (alsoDownloadJson) {
        const jsonBlob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        triggerDownload(jsonBlob, `CancerCare-doctor-summary-${dateStr}.json`);
      }
      showSuccess(alsoDownloadJson ? 'PDF and JSON downloaded.' : 'PDF downloaded.');
    } catch (downloadError) {
      const message = downloadError.message || 'Failed to generate PDF.';
      setError(message);
      showError(message);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSaveToDrive = async () => {
    setError(null);
    setLoadingAction('drive');
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
    } catch (driveError) {
      const message = driveError.message || 'Failed to upload to Google Drive.';
      setError(message);
      showError(message);
    } finally {
      setLoadingAction(null);
    }
  };

  const includedSectionCount = Object.values(sections).filter(Boolean).length;
  const effectiveLabCount = keyMetricsOnly ? keyLabKeys.length : selectedLabKeys.length;
  const effectiveVitalCount = keyMetricsOnly ? keyVitalIds.length : selectedVitalIds.length;
  const previewInsights = useMemo(() => {
    if (!previewPayload?.data) return null;

    const data = previewPayload.data;
    const labs = Array.isArray(data.labs) ? data.labs : [];
    const vitals = Array.isArray(data.vitals) ? data.vitals : [];
    const symptoms = Array.isArray(data.symptoms) ? data.symptoms : [];
    const medicationLogs = Array.isArray(data.medicationLogs) ? data.medicationLogs : [];
    const journalNotes = Array.isArray(data.journalNotes) ? data.journalNotes : [];
    const documents = Array.isArray(data.documents) ? data.documents : [];

    const labsWithValues = labs.filter((lab) => Array.isArray(lab.values) && lab.values.length > 0);
    const vitalsWithValues = vitals.filter((vital) => Array.isArray(vital.values) && vital.values.length > 0);

    const labValueCount = labsWithValues.reduce((sum, lab) => sum + (lab.values?.length || 0), 0);
    const vitalValueCount = vitalsWithValues.reduce((sum, vital) => sum + (vital.values?.length || 0), 0);
    const totalPoints = labValueCount + vitalValueCount + symptoms.length + medicationLogs.length + journalNotes.length + documents.length;

    const sectionHasData = {
      demographics: !!data.patientProfile,
      labs: labsWithValues.length > 0,
      vitals: vitalsWithValues.length > 0,
      medications: (Array.isArray(data.medications) && data.medications.length > 0) || medicationLogs.length > 0,
      symptoms: symptoms.length > 0,
      genomic: !!data.genomicProfile,
      documents: documents.length > 0,
      journalNotes: journalNotes.length > 0
    };

    const emptySelectedSections = (previewPayload.sectionsIncluded || []).filter((section) => !sectionHasData[section]);

    const dates = [];
    const addDate = (value) => {
      const date = toValidDate(value);
      if (date) dates.push(date);
    };

    labsWithValues.forEach((lab) => (lab.values || []).forEach((value) => addDate(value.date || value.dateTime || value.timestamp)));
    vitalsWithValues.forEach((vital) => (vital.values || []).forEach((value) => addDate(value.date || value.dateTime || value.timestamp)));
    symptoms.forEach((value) => addDate(value.date || value.dateTime));
    medicationLogs.forEach((value) => addDate(value.takenAt || value.date || value.createdAt));
    journalNotes.forEach((value) => addDate(value.date || value.createdAt));
    documents.forEach((value) => addDate(value.date || value.createdAt));

    dates.sort((a, b) => a - b);
    const earliestDate = dates.length > 0 ? dates[0] : null;
    const latestDate = dates.length > 0 ? dates[dates.length - 1] : null;

    const metricNames = [
      ...labsWithValues.map((lab) => getLabDisplayName(lab.name || lab.labType || lab.label || 'Unknown Lab')),
      ...vitalsWithValues.map((vital) => getVitalDisplayName(vital.name || vital.vitalType || vital.id || 'Unknown Vital'))
    ];
    const uniqueMetricNames = [...new Set(metricNames)];

    return {
      totalPoints,
      labsSelected: labs.length,
      labsWithValues: labsWithValues.length,
      vitalsSelected: vitals.length,
      vitalsWithValues: vitalsWithValues.length,
      labValueCount,
      vitalValueCount,
      earliestDate,
      latestDate,
      emptySelectedSections,
      metricNameSample: uniqueMetricNames.slice(0, 8),
      hiddenMetricCount: Math.max(0, uniqueMetricNames.length - 8)
    };
  }, [previewPayload]);

  return (
    <div className={combineClasses(Layouts.container, 'flex flex-col', DesignTokens.spacing.gap.md, 'pb-24 md:pb-8')}>
      <div className={combineClasses(
        DesignTokens.components.card.withColoredBorder(DesignTokens.colors.app.border[200]),
        'relative overflow-hidden bg-white'
      )}>
        <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-anchor-100/60 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 h-48 w-48 rounded-full bg-medical-primary-100/40 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={combineClasses('rounded-xl p-2.5 sm:p-3', DesignTokens.colors.app[100], DesignTokens.colors.app.text[700])}>
              <Share className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h1 className={combineClasses(DesignTokens.components.header.title, 'mb-1')}>Share PDF Summary</h1>
              <p className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.colors.app.text[600], 'max-w-2xl')}>
                Build a clean doctor-ready report with the exact metrics, date range, and sections you want to share.
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={() => onTabChange('health')}
              className={combineClasses(
                'px-4 py-2.5 rounded-lg text-sm font-medium min-h-[44px] touch-manipulation',
                DesignTokens.components.button.secondary
              )}
            >
              Review Health Data
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,0.55fr)] gap-4">
        <div className="space-y-4">
          <section className={combineClasses(DesignTokens.components.card.containerLarge, DesignTokens.components.card.withColoredBorder(DesignTokens.colors.app.border[200]))}>
            <h2 className={combineClasses('text-base sm:text-lg font-semibold mb-3', DesignTokens.colors.app.text[900])}>What to Include</h2>
            <p className={combineClasses('text-sm mb-3', DesignTokens.colors.app.text[600])}>
              Choose the data domains that belong in this export.
            </p>
            <label
              className={combineClasses(
                'mb-3 flex items-start gap-2 rounded-lg border px-3 py-2.5 min-h-[44px] cursor-pointer touch-manipulation',
                keyMetricsOnly ? 'border-anchor-300 bg-anchor-50' : DesignTokens.colors.app.border[200]
              )}
            >
              <input
                type="checkbox"
                checked={keyMetricsOnly}
                onChange={(e) => {
                  const next = e.target.checked;
                  setKeyMetricsOnly(next);
                  if (next) {
                    setSelectedLabKeys([...keyLabKeys]);
                    setSelectedVitalIds([...keyVitalIds]);
                  }
                  clearOutputState();
                }}
                className="rounded w-4 h-4 mt-0.5 shrink-0"
              />
              <span>
                <span className={combineClasses('block text-sm font-medium', DesignTokens.colors.app.text[800])}>
                  Key metrics only
                </span>
                <span className={combineClasses('block text-xs', DesignTokens.colors.app.text[600])}>
                  Export a concise report with key labs and vitals ({keyLabKeys.length} labs, {keyVitalIds.length} vitals).
                </span>
              </span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Object.entries(sections).map(([key, checked]) => (
                <label
                  key={key}
                  className={combineClasses(
                    'flex items-center gap-2 rounded-lg border px-3 py-2.5 min-h-[44px] cursor-pointer touch-manipulation',
                    checked ? 'border-anchor-300 bg-anchor-50' : DesignTokens.colors.app.border[200]
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSection(key)}
                    className="rounded w-4 h-4 shrink-0"
                  />
                  <span className={combineClasses('text-sm', DesignTokens.colors.app.text[800])}>
                    {key === 'journalNotes' ? 'Journal notes' : key.charAt(0).toUpperCase() + key.slice(1)}
                  </span>
                </label>
              ))}
            </div>
          </section>

          {sections.labs && (
            <section className={combineClasses(DesignTokens.components.card.containerLarge, DesignTokens.components.card.withColoredBorder(DesignTokens.colors.app.border[200]))}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                <h2 className={combineClasses('text-base sm:text-lg font-semibold', DesignTokens.colors.app.text[900])}>Lab Metrics</h2>
                <span className={combineClasses('text-xs sm:text-sm', DesignTokens.colors.app.text[500])}>
                  {selectedLabKeys.length} selected
                </span>
              </div>

              <div className="relative mb-3">
                <Search className={combineClasses('absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4', DesignTokens.colors.app.text[500])} />
                <input
                  type="text"
                  placeholder="Search lab metrics..."
                  value={labSearch}
                  onChange={(e) => setLabSearch(e.target.value)}
                  className={combineClasses(
                    'w-full pl-8 pr-3 py-2.5 text-sm border rounded-lg min-h-[44px]',
                    DesignTokens.colors.app.border[200],
                    'placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-anchor-300'
                  )}
                  aria-label="Search lab metrics"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 mb-3">
                <button type="button" onClick={selectAllLabs} className={combineClasses('text-xs px-3 py-2 rounded border min-h-[40px]', DesignTokens.colors.app.border[200], 'hover:bg-gray-50')}>
                  Select all
                </button>
                <button type="button" onClick={deselectAllLabs} className={combineClasses('text-xs px-3 py-2 rounded border min-h-[40px]', DesignTokens.colors.app.border[200], 'hover:bg-gray-50')}>
                  Deselect all
                </button>
                {hiddenLabs.length > 0 && (
                  <label className={combineClasses('flex items-center gap-2 text-xs cursor-pointer min-h-[40px]', DesignTokens.colors.app.text[600])}>
                    <input
                      type="checkbox"
                      checked={showHiddenLabs}
                      onChange={(e) => setShowHiddenLabs(e.target.checked)}
                      className="rounded w-4 h-4"
                    />
                    Show hidden metrics ({hiddenLabs.length})
                  </label>
                )}
              </div>

              <div className={combineClasses('max-h-[40vh] overflow-y-auto overflow-x-hidden border rounded-lg p-2 sm:p-3', DesignTokens.colors.app.border[200])}>
                {availableLabs.length === 0 ? (
                  <p className={combineClasses('text-sm', DesignTokens.colors.app.text[500])}>No labs available yet.</p>
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

                  if (!showHiddenLabs && hiddenLabs.length > 0) {
                    filteredKeys = filteredKeys.filter((key) => !hiddenLabs.includes(key));
                  }

                  if (filteredKeys.length === 0) {
                    return (
                      <p className={combineClasses('text-sm', DesignTokens.colors.app.text[500])}>
                        {q ? `No metrics match "${labSearch.trim()}".` : 'No visible metrics in this view.'}
                      </p>
                    );
                  }

                  const labsObj = {};
                  filteredKeys.forEach((key) => {
                    const lab = keyToRepresentativeLab[key];
                    if (lab) labsObj[key] = lab;
                  });

                  const byCategory = categorizeLabs(labsObj);
                  const categoryOrder = [
                    'Disease-Specific Markers',
                    'Blood Counts',
                    'Kidney Function',
                    'Liver Function',
                    'Thyroid Function',
                    'Cardiac Markers',
                    'Inflammation',
                    'Electrolytes',
                    'Coagulation',
                    'Custom Values',
                    'Others'
                  ];

                  return (
                    <div className="space-y-3">
                      {categoryOrder.map((cat) => {
                        const entries = byCategory[cat] || [];
                        if (entries.length === 0) return null;
                        return (
                          <div key={cat}>
                            <p className={combineClasses('text-xs font-semibold mb-1', DesignTokens.colors.app.text[600])}>{cat}</p>
                            <div className="space-y-1">
                              {entries.map(([key, lab]) => {
                                const isHidden = hiddenLabs.includes(key);
                                return (
                                  <label
                                    key={key}
                                    className={combineClasses(
                                      'flex items-center gap-2 cursor-pointer py-2 px-2 rounded min-h-[40px]',
                                      selectedLabKeys.includes(key) ? 'bg-anchor-50' : 'hover:bg-gray-50',
                                      isHidden && 'opacity-60'
                                    )}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={selectedLabKeys.includes(key)}
                                      onChange={() => toggleLab(key)}
                                      className="rounded w-4 h-4 shrink-0"
                                    />
                                    <span className={combineClasses('text-sm', DesignTokens.colors.app.text[800])}>
                                      {getLabDisplayName(lab?.name || lab?.labType || lab?.label || key)}
                                      {isHidden ? ' (hidden)' : ''}
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
            </section>
          )}

          {sections.vitals && (
            <section className={combineClasses(DesignTokens.components.card.containerLarge, DesignTokens.components.card.withColoredBorder(DesignTokens.colors.app.border[200]))}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                <h2 className={combineClasses('text-base sm:text-lg font-semibold', DesignTokens.colors.app.text[900])}>Vitals</h2>
                <span className={combineClasses('text-xs sm:text-sm', DesignTokens.colors.app.text[500])}>
                  {selectedVitalIds.length} selected
                </span>
              </div>

              <div className="relative mb-3">
                <Search className={combineClasses('absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4', DesignTokens.colors.app.text[500])} />
                <input
                  type="text"
                  placeholder="Search vitals..."
                  value={vitalSearch}
                  onChange={(e) => setVitalSearch(e.target.value)}
                  className={combineClasses(
                    'w-full pl-8 pr-3 py-2.5 text-sm border rounded-lg min-h-[44px]',
                    DesignTokens.colors.app.border[200],
                    'placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-anchor-300'
                  )}
                  aria-label="Search vitals"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 mb-3">
                <button type="button" onClick={selectAllVitals} className={combineClasses('text-xs px-3 py-2 rounded border min-h-[40px]', DesignTokens.colors.app.border[200], 'hover:bg-gray-50')}>
                  Select all
                </button>
                <button type="button" onClick={deselectAllVitals} className={combineClasses('text-xs px-3 py-2 rounded border min-h-[40px]', DesignTokens.colors.app.border[200], 'hover:bg-gray-50')}>
                  Deselect all
                </button>
              </div>

              <div className={combineClasses('max-h-56 overflow-y-auto overflow-x-hidden border rounded-lg p-2 sm:p-3', DesignTokens.colors.app.border[200])}>
                {availableVitals.length === 0 ? (
                  <p className={combineClasses('text-sm', DesignTokens.colors.app.text[500])}>No vitals available yet.</p>
                ) : (() => {
                  const q = vitalSearch.trim().toLowerCase();
                  const filtered = q
                    ? availableVitals.filter((vital) => {
                        const raw = (vital.name || vital.vitalType || vital.id || '').toString().toLowerCase();
                        const display = getVitalDisplayName(vital.name || vital.vitalType || vital.id).toLowerCase();
                        return raw.includes(q) || display.includes(q);
                      })
                    : availableVitals;
                  if (filtered.length === 0) {
                    return (
                      <p className={combineClasses('text-sm', DesignTokens.colors.app.text[500])}>
                        No vitals match "{vitalSearch.trim()}".
                      </p>
                    );
                  }
                  return filtered.map((vital) => (
                    <label
                      key={vital.id}
                      className={combineClasses(
                        'flex items-center gap-2 cursor-pointer py-2 px-2 rounded min-h-[40px]',
                        selectedVitalIds.includes(vital.id) ? 'bg-anchor-50' : 'hover:bg-gray-50'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selectedVitalIds.includes(vital.id)}
                        onChange={() => toggleVital(vital.id)}
                        className="rounded w-4 h-4 shrink-0"
                      />
                      <span className={combineClasses('text-sm', DesignTokens.colors.app.text[800])}>
                        {getVitalDisplayName(vital.name || vital.vitalType || vital.id)}
                      </span>
                    </label>
                  ));
                })()}
              </div>
            </section>
          )}

          <section className={combineClasses(DesignTokens.components.card.containerLarge, DesignTokens.components.card.withColoredBorder(DesignTokens.colors.app.border[200]))}>
            <div className="flex items-center gap-2 mb-3">
              <CalendarRange className={combineClasses('w-5 h-5', DesignTokens.colors.app.text[600])} />
              <h2 className={combineClasses('text-base sm:text-lg font-semibold', DesignTokens.colors.app.text[900])}>Date Range</h2>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {DATE_RANGE_OPTIONS.map((opt) => (
                <label key={opt.value} className={combineClasses('flex items-center gap-2 cursor-pointer min-h-[40px]')}>
                  <input
                    type="radio"
                    name="dateRange"
                    value={opt.value}
                    checked={dateRange === opt.value}
                    onChange={() => {
                      setDateRange(opt.value);
                      clearOutputState();
                    }}
                    className="w-4 h-4 shrink-0"
                  />
                  <span className={combineClasses('text-sm', DesignTokens.colors.app.text[800])}>{opt.label}</span>
                </label>
              ))}
            </div>

            {dateRange === 'custom' && (
              <div className="mt-3 flex flex-col sm:flex-row gap-3">
                <label className="flex-1">
                  <span className={combineClasses('block text-xs mb-1', DesignTokens.colors.app.text[600])}>From</span>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => {
                      setCustomStart(e.target.value);
                      clearOutputState();
                    }}
                    className={combineClasses('w-full border rounded-lg px-3 py-2.5 text-sm min-h-[44px]', DesignTokens.colors.app.border[200])}
                  />
                </label>
                <label className="flex-1">
                  <span className={combineClasses('block text-xs mb-1', DesignTokens.colors.app.text[600])}>To</span>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => {
                      setCustomEnd(e.target.value);
                      clearOutputState();
                    }}
                    className={combineClasses('w-full border rounded-lg px-3 py-2.5 text-sm min-h-[44px]', DesignTokens.colors.app.border[200])}
                  />
                </label>
              </div>
            )}
          </section>
        </div>

        <div className="xl:sticky xl:top-4 h-fit space-y-4">
          <section className={combineClasses(DesignTokens.components.card.containerLarge, DesignTokens.components.card.withColoredBorder(DesignTokens.colors.app.border[200]))}>
            <h2 className={combineClasses('text-base sm:text-lg font-semibold mb-3', DesignTokens.colors.app.text[900])}>Export Summary</h2>
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className={combineClasses('rounded-lg p-3 border', DesignTokens.colors.app.border[200], 'bg-anchor-50')}>
                <p className={combineClasses('text-xs', DesignTokens.colors.app.text[500])}>Sections</p>
                <p className={combineClasses('text-lg font-semibold', DesignTokens.colors.app.text[900])}>{includedSectionCount}</p>
              </div>
              <div className={combineClasses('rounded-lg p-3 border', DesignTokens.colors.app.border[200], 'bg-anchor-50')}>
                <p className={combineClasses('text-xs', DesignTokens.colors.app.text[500])}>Lab metrics</p>
                <p className={combineClasses('text-lg font-semibold', DesignTokens.colors.app.text[900])}>{effectiveLabCount}</p>
              </div>
              <div className={combineClasses('rounded-lg p-3 border', DesignTokens.colors.app.border[200], 'bg-anchor-50')}>
                <p className={combineClasses('text-xs', DesignTokens.colors.app.text[500])}>Vitals</p>
                <p className={combineClasses('text-lg font-semibold', DesignTokens.colors.app.text[900])}>{effectiveVitalCount}</p>
              </div>
              <div className={combineClasses('rounded-lg p-3 border', DesignTokens.colors.app.border[200], 'bg-anchor-50')}>
                <p className={combineClasses('text-xs', DesignTokens.colors.app.text[500])}>Range</p>
                <p className={combineClasses('text-lg font-semibold uppercase', DesignTokens.colors.app.text[900])}>{dateRange}</p>
              </div>
            </div>

            <label className={combineClasses('flex items-center gap-2 cursor-pointer py-1 mb-4')}>
              <input
                type="checkbox"
                checked={alsoDownloadJson}
                onChange={(e) => setAlsoDownloadJson(e.target.checked)}
                className="rounded w-4 h-4 shrink-0"
              />
              <span className={combineClasses('text-sm', DesignTokens.colors.app.text[700])}>Also download JSON</span>
            </label>

            <div className="space-y-2">
              <button
                type="button"
                onClick={handlePreview}
                disabled={isBusy}
                className={combineClasses(
                  'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium min-h-[46px] disabled:opacity-50',
                  DesignTokens.components.button.secondary
                )}
              >
                {loadingAction === 'preview' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Preview Report
              </button>
              <button
                type="button"
                onClick={handleSharePdf}
                disabled={isBusy}
                className={combineClasses(
                  'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium min-h-[46px] disabled:opacity-50',
                  DesignTokens.components.button.secondary
                )}
              >
                {loadingAction === 'share' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share className="w-4 h-4" />}
                Share PDF
              </button>
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isBusy}
                className={combineClasses(
                  'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium min-h-[46px] disabled:opacity-50',
                  DesignTokens.components.button.primary
                )}
              >
                {loadingAction === 'download' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Download PDF
              </button>
              {isGoogleDriveConfigured() ? (
                <button
                  type="button"
                  onClick={handleSaveToDrive}
                  disabled={isBusy}
                  className={combineClasses(
                    'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium min-h-[46px] disabled:opacity-50',
                    DesignTokens.components.button.outline.primary
                  )}
                >
                  {loadingAction === 'drive' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Cloud className="w-4 h-4" />}
                  Save to Google Drive
                </button>
              ) : (
                <div className={combineClasses('w-full rounded-lg border px-3 py-2.5 text-xs', DesignTokens.colors.app.border[200], DesignTokens.colors.app.text[600])}>
                  Google Drive is not configured for this environment.
                </div>
              )}
            </div>

            <p className={combineClasses('text-xs mt-3', DesignTokens.colors.app.text[500])}>
              Exports are patient-generated summaries and should be reviewed alongside official records.
            </p>
          </section>

          {error && (
            <section className={combineClasses('rounded-lg border p-3', DesignTokens.components.status.high.bg, DesignTokens.components.status.high.border, DesignTokens.components.status.high.text)}>
              <p className="text-sm font-medium">{error}</p>
            </section>
          )}

          {previewPayload && (
            <section className={combineClasses('rounded-lg border p-4', DesignTokens.colors.app.border[200], 'bg-white')}>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className={combineClasses('w-4 h-4', DesignTokens.components.status.normal.text)} />
                <p className={combineClasses('text-sm font-semibold', DesignTokens.colors.app.text[900])}>Preview Ready</p>
              </div>
              {previewInsights && (
                <>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className={combineClasses('rounded-lg border p-2.5', DesignTokens.colors.app.border[200], 'bg-anchor-50')}>
                      <p className={combineClasses('text-[11px]', DesignTokens.colors.app.text[500])}>Data points in report</p>
                      <p className={combineClasses('text-base font-semibold', DesignTokens.colors.app.text[900])}>
                        {previewInsights.totalPoints}
                      </p>
                    </div>
                    <div className={combineClasses('rounded-lg border p-2.5', DesignTokens.colors.app.border[200], 'bg-anchor-50')}>
                      <p className={combineClasses('text-[11px]', DesignTokens.colors.app.text[500])}>Metrics with data</p>
                      <p className={combineClasses('text-base font-semibold', DesignTokens.colors.app.text[900])}>
                        {previewInsights.labsWithValues + previewInsights.vitalsWithValues}
                      </p>
                    </div>
                  </div>

                  <p className={combineClasses('text-xs mb-2', DesignTokens.colors.app.text[700])}>
                    Coverage: {previewInsights.earliestDate && previewInsights.latestDate
                      ? `${previewInsights.earliestDate.toLocaleDateString()} - ${previewInsights.latestDate.toLocaleDateString()}`
                      : 'No dated records in this selection'}
                  </p>

                  {(previewInsights.labsWithValues < previewInsights.labsSelected || previewInsights.vitalsWithValues < previewInsights.vitalsSelected) && (
                    <div className={combineClasses('rounded-lg border p-2.5 mb-2 text-xs', 'bg-yellow-50 border-yellow-200 text-yellow-800')}>
                      Excluded for no data in date range: {previewInsights.labsSelected - previewInsights.labsWithValues} lab metric(s), {previewInsights.vitalsSelected - previewInsights.vitalsWithValues} vital(s).
                    </div>
                  )}

                  {previewInsights.emptySelectedSections.length > 0 && (
                    <div className={combineClasses('rounded-lg border p-2.5 mb-2 text-xs', 'bg-medical-neutral-50', DesignTokens.colors.app.border[200], DesignTokens.colors.app.text[700])}>
                      Selected sections with no records: {previewInsights.emptySelectedSections.join(', ')}
                    </div>
                  )}

                  {previewInsights.metricNameSample.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {previewInsights.metricNameSample.map((name) => (
                        <span
                          key={name}
                          className={combineClasses('px-2 py-1 rounded-full text-[11px] border', DesignTokens.colors.app.border[200], DesignTokens.colors.app.text[700], 'bg-white')}
                        >
                          {name}
                        </span>
                      ))}
                      {previewInsights.hiddenMetricCount > 0 && (
                        <span className={combineClasses('px-2 py-1 rounded-full text-[11px] border', DesignTokens.colors.app.border[200], DesignTokens.colors.app.text[600], 'bg-medical-neutral-50')}>
                          +{previewInsights.hiddenMetricCount} more
                        </span>
                      )}
                    </div>
                  )}
                </>
              )}
            </section>
          )}
        </div>
      </div>

      {/* Share options fallback modal (for browsers without file sharing) */}
      {showShareOptions && (
        <>
          <div
            className="fixed inset-0 z-[70] backdrop-blur-sm bg-black/20"
            onClick={() => setShowShareOptions(false)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-label="Share options"
            className={combineClasses(
              'fixed z-[71] rounded-xl shadow-2xl border max-w-sm w-[90vw] sm:w-96 p-5 animate-fade-scale bg-white',
              DesignTokens.colors.neutral.border[200]
            )}
            style={{
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              maxHeight: '80vh',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={combineClasses('flex items-start justify-between', DesignTokens.spacing.gap.md)}>
              <div className={combineClasses('flex items-center', DesignTokens.spacing.gap.sm)}>
                <div className={combineClasses(DesignTokens.colors.app[100], DesignTokens.borders.radius.sm, DesignTokens.spacing.iconContainer.mobile)}>
                  <Share className={combineClasses(DesignTokens.icons.standard.size.full, DesignTokens.colors.app.text[700])} />
                </div>
                <h3 className={combineClasses(DesignTokens.typography.h2.full, DesignTokens.typography.h2.weight, DesignTokens.colors.neutral.text[900])}>
                  Share options
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowShareOptions(false)}
                className={combineClasses('p-2 -mr-2', DesignTokens.transitions.default, 'flex-shrink-0', DesignTokens.spacing.touchTarget, 'flex items-center justify-center', DesignTokens.components.modal.closeButton)}
                aria-label="Close"
              >
                <X className={DesignTokens.icons.button.size.full} />
              </button>
            </div>

            <p className={combineClasses(DesignTokens.typography.body.sm, 'leading-relaxed mt-2', DesignTokens.colors.neutral.text[700])}>
              Choose how you want to share your summary.
            </p>

            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={() => { setShowShareOptions(false); handleDownloadPdf(); }}
                disabled={isBusy}
                className={combineClasses(
                  'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium min-h-[46px] disabled:opacity-50',
                  DesignTokens.components.button.primary
                )}
              >
                <Download className="w-4 h-4" />
                Download PDF
              </button>
              {isGoogleDriveConfigured() ? (
                <button
                  type="button"
                  onClick={() => { setShowShareOptions(false); handleSaveToDrive(); }}
                  disabled={isBusy}
                  className={combineClasses(
                    'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium min-h-[46px] disabled:opacity-50',
                    DesignTokens.components.button.outline.primary
                  )}
                >
                  <Cloud className="w-4 h-4" />
                  Save to Google Drive
                </button>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

ExportTab.propTypes = {
  onTabChange: PropTypes.func.isRequired
};
