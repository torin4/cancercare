import React, { useState, useCallback, useEffect } from 'react';
import { X, FileJson, Activity, Heart, BookOpen, Loader2, CheckCircle, Trash2, RefreshCw, AlertTriangle } from 'lucide-react';
import { DesignTokens, combineClasses } from '../../design/designTokens';
import { useBanner } from '../../contexts/BannerContext';
import { vitalService, symptomService, journalNoteService, documentService } from '../../firebase/services';
import { uploadDocument, deleteDocument as deleteStorageDocument } from '../../firebase/storage';
import { parseDayOneExport, isDayOneExport, hasMeaningfulJournalContent } from '../../utils/dayOneImportUtils';
import { formatDateString } from '../../utils/helpers';
import { getVitalDisplayName } from '../../utils/normalizationUtils';
import logger from '../../utils/logger';

/**
 * Day One Import Modal
 *
 * Imports vitals, symptoms, and journal notes from a Day One JSON export.
 * Supports Japanese and English section headers.
 */
export default function DayOneImportModal({ show, onClose, user, onImportComplete, onDocumentsChange }) {
  const { showSuccess, showError } = useBanner();
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [parsedData, setParsedData] = useState(null);
  const [parseError, setParseError] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState('');
  const [importOptions, setImportOptions] = useState({
    importVitals: true,
    importSymptoms: true,
    importJournalNotes: true
  });
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [existingImport, setExistingImport] = useState(null); // Track if this file was previously imported
  const [isCheckingExisting, setIsCheckingExisting] = useState(false);

  // Check for existing Day One imports when modal opens
  useEffect(() => {
    if (show && user) {
      checkForExistingImports();
    }
  }, [show, user]);

  const checkForExistingImports = async () => {
    if (!user) return;
    try {
      const dayOneDocuments = await documentService.getDocumentsByCategory(user.uid, 'Day One Import');
      if (dayOneDocuments && dayOneDocuments.length > 0) {
        // Sort by date, most recent first
        dayOneDocuments.sort((a, b) => {
          const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt) || new Date(0);
          const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt) || new Date(0);
          return dateB - dateA;
        });
        setExistingImport(dayOneDocuments[0]); // Most recent import
      } else {
        setExistingImport(null);
      }
    } catch (err) {
      logger.warn('[DayOneImport] Failed to check for existing imports:', err);
      setExistingImport(null);
    }
  };

  const resetState = useCallback(() => {
    setFile(null);
    setFileName('');
    setParsedData(null);
    setParseError(null);
    setIsImporting(false);
    setImportProgress('');
  }, []);

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setParseError(null);
    setParsedData(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result;
        if (!text) {
          setParseError('Could not read file');
          return;
        }
        const json = JSON.parse(text);
        if (!isDayOneExport(json)) {
          setParseError('This does not appear to be a valid Day One export. Expected a JSON file with an "entries" array.');
          return;
        }
        const { results, summary } = parseDayOneExport(json);
        setParsedData({ results, summary });
        setFile(selectedFile);
        setFileName(selectedFile.name);
      } catch (err) {
        logger.error('[DayOneImport] Parse error:', err);
        setParseError(err.message || 'Failed to parse Day One export file.');
      }
    };
    reader.readAsText(selectedFile);
  };

  const handleDeletePreviousImport = async (docId) => {
    if (!user || !docId) return;
    setIsCleaningUp(true);
    try {
      let vitalsDeleted = 0;
      let symptomsDeleted = 0;
      let journalDeleted = 0;

      // Delete vitals linked to this document
      const vitals = await vitalService.getVitals(user.uid);
      for (const vital of vitals) {
        const values = await vitalService.getVitalValues(vital.id);
        for (const v of values) {
          if (v.documentId === docId) {
            try {
              await vitalService.deleteVitalValue(vital.id, v.id);
              vitalsDeleted++;
            } catch (err) {
              logger.warn('[DayOneImport] Failed to delete vital value:', v.id, err);
            }
          }
        }
      }

      // Delete symptoms linked to this document
      const symptoms = await symptomService.getSymptoms(user.uid);
      for (const s of symptoms) {
        if (s.documentId === docId) {
          try {
            await symptomService.deleteSymptom(s.id);
            symptomsDeleted++;
          } catch (err) {
            logger.warn('[DayOneImport] Failed to delete symptom:', s.id, err);
          }
        }
      }

      // Delete journal notes linked to this document
      const journalNotes = await journalNoteService.getJournalNotes(user.uid);
      for (const note of journalNotes) {
        if (note.documentId === docId) {
          try {
            await journalNoteService.deleteJournalNote(note.id);
            journalDeleted++;
          } catch (err) {
            logger.warn('[DayOneImport] Failed to delete journal note:', note.id, err);
          }
        }
      }

      // Delete the document record itself
      try {
        await deleteStorageDocument(docId, user.uid);
      } catch (err) {
        logger.warn('[DayOneImport] Failed to delete document record:', docId, err);
      }

      // Clean up orphaned vitals
      if (vitalsDeleted > 0) {
        await vitalService.cleanupOrphanedVitals(user.uid);
      }

      const total = vitalsDeleted + symptomsDeleted + journalDeleted;
      logger.log('[DayOneImport] Deleted previous import:', { vitalsDeleted, symptomsDeleted, journalDeleted });

      setExistingImport(null);
      return total;
    } catch (err) {
      logger.error('[DayOneImport] Delete previous import error:', err);
      throw err;
    } finally {
      setIsCleaningUp(false);
    }
  };

  const handleCleanupOrphaned = async () => {
    if (!user) {
      showError('Please sign in to clean up import data.');
      return;
    }
    setIsCleaningUp(true);
    try {
      let vitalsDeleted = 0;
      let symptomsDeleted = 0;
      const errors = [];

      // Find and delete vital values: no documentId AND notes contains "day one" (broad match)
      const vitals = await vitalService.getVitals(user.uid);
      for (const vital of vitals) {
        const values = await vitalService.getVitalValues(vital.id);
        for (const v of values) {
          const notes = String(v.notes || '').trim();
          const hasNoDocId = !v.documentId || String(v.documentId).trim() === '';
          const isDayOneImport = notes.toLowerCase().includes('day one');
          if (hasNoDocId && isDayOneImport) {
            try {
              await vitalService.deleteVitalValue(vital.id, v.id);
              vitalsDeleted++;
            } catch (delErr) {
              logger.warn('[DayOneImport] Failed to delete vital value:', v.id, delErr);
              errors.push(`Vital ${v.id}: ${delErr.message}`);
            }
          }
        }
      }

      // Find and delete symptoms: tags includes 'day-one-import' OR notes contains "imported from day one"
      const symptoms = await symptomService.getSymptoms(user.uid);
      for (const s of symptoms) {
        const tags = s.tags;
        const notes = String(s.notes || '').toLowerCase();
        const hasTag = Array.isArray(tags)
          ? tags.includes('day-one-import')
          : (typeof tags === 'string' && (tags.includes('day-one-import') || tags === 'day-one-import'));
        const hasDayOneNote = notes.includes('imported from day one');
        if (hasTag || hasDayOneNote) {
          try {
            await symptomService.deleteSymptom(s.id);
            symptomsDeleted++;
          } catch (delErr) {
            logger.warn('[DayOneImport] Failed to delete symptom:', s.id, delErr);
            // Don't add permission errors to user-facing errors - continue with other cleanup
            const isPermError = delErr?.code === 'permission-denied' || delErr?.message?.toLowerCase?.()?.includes('permission');
            if (!isPermError) errors.push(`Symptom ${s.id}: ${delErr.message}`);
          }
        }
      }

      // Find and delete journal notes: source === 'day-one-import' OR content has Day One section format
      let journalDeleted = 0;
      const journalNotes = await journalNoteService.getJournalNotes(user.uid);
      logger.log('[DayOneImport] Cleanup: found', journalNotes.length, 'journal notes to check');
      // Day One template section markers (Japanese and English)
      const dayOneSectionMarkers = [
        '**Regimen:**', '**Medication:**', '**Activities:**', '**Meals:**', '**Habits:**', '**Summary:**',
        '###### レジメン', '###### 服薬', '###### 今日やったこと', '###### バイタル', '###### 症状',
        '###### 食事', '###### 習慣化', '###### 総合', '###### 行動',
        '###### Regimen', '###### Medication', '###### Vitals', '###### Symptoms',
        '###### Meals', '###### Habits', '###### Summary', '###### What I Did',
        '# レジメン', '# 服薬', '# 今日やったこと', '# バイタル', '# 症状',
        '# 食事', '# 習慣化', '# 総合', '# 行動'
      ];
      for (const note of journalNotes) {
        const hasSource = note.source === 'day-one-import';
        const content = String(note.content || '');
        const hasDayOneFormat = dayOneSectionMarkers.some((m) => content.includes(m));
        // Match raw Day One format: ###### + any known section (including 食事, 習慣化, 総合)
        const hasDayOneRawFormat = /######/.test(content) && (
          content.includes('レジメン') || content.includes('服薬') || content.includes('今日やったこと') ||
          content.includes('バイタル') || content.includes('症状') || content.includes('食事') ||
          content.includes('習慣化') || content.includes('総合') || content.includes('行動') ||
          /\b(Regimen|Medication|Vitals|Symptoms|Meals|Habits|Summary|What I Did)\b/i.test(content)
        );
        // Only delete template-only entries (no meaningful data) - keep notes with actual content
        const isTemplateOnly = !hasMeaningfulJournalContent(content);
        if ((hasSource || hasDayOneFormat || hasDayOneRawFormat) && isTemplateOnly) {
          try {
            await journalNoteService.deleteJournalNote(note.id);
            journalDeleted++;
            logger.log('[DayOneImport] Deleted journal note', note.id);
          } catch (delErr) {
            logger.warn('[DayOneImport] Failed to delete journal note:', note.id, delErr);
            errors.push(`Journal ${note.id}: ${delErr.message}`);
          }
        }
      }

      // Clean up orphaned vitals (vitals with no values left)
      if (vitalsDeleted > 0) {
        await vitalService.cleanupOrphanedVitals(user.uid);
      }

      const total = vitalsDeleted + symptomsDeleted + journalDeleted;
      if (total > 0) {
        const parts = [];
        if (vitalsDeleted) parts.push(`${vitalsDeleted} vitals`);
        if (symptomsDeleted) parts.push(`${symptomsDeleted} symptoms`);
        if (journalDeleted) parts.push(`${journalDeleted} journal notes`);
        showSuccess(`Removed ${parts.join(', ')} from previous Day One import.`);
        if (onImportComplete) onImportComplete();
      } else if (errors.length > 0) {
        showError(`Cleanup failed: ${errors[0]}`);
      } else {
        showSuccess('No orphaned Day One import data found.');
      }
    } catch (err) {
      logger.error('[DayOneImport] Cleanup error:', err);
      showError(`Cleanup failed: ${err.message}`);
    } finally {
      setIsCleaningUp(false);
    }
  };

  const handleImport = async () => {
    if (!user || !parsedData || !file) return;

    setIsImporting(true);
    const { results, summary } = parsedData;

    let vitalsImported = 0;
    let symptomsImported = 0;
    let journalImported = 0;
    const errors = [];
    let documentId = null;

    try {
      // 1. Upload the Day One JSON file (like other docs) - creates document record and links data
      setImportProgress('Saving Day One export to your documents...');
      const dateStr = summary?.dateRange?.from
        ? formatDateString(summary.dateRange.from)
        : formatDateString(new Date());
      const uploadResult = await uploadDocument(file, user.uid, {
        category: 'Day One Import',
        documentType: 'Day One Import',
        date: dateStr,
        note: `Imported ${summary?.totalEntries || 0} entries, ${summary?.totalVitals || 0} vitals, ${summary?.totalSymptoms || 0} symptoms`
      });
      documentId = uploadResult.id;

      // 2. Import data with documentId linked (like other doc imports)
      for (let i = 0; i < results.length; i++) {
        const entry = results[i];
        setImportProgress(`Processing entry ${i + 1} of ${results.length}...`);

        if (importOptions.importVitals && entry.vitals?.length > 0) {
          for (const vital of entry.vitals) {
            try {
              const vitalType = vital.vitalType || 'other';
              const existingVital = await vitalService.getVitalByType(user.uid, vitalType);
              let vitalId;
              if (existingVital) {
                vitalId = existingVital.id;
              } else {
                vitalId = await vitalService.saveVital({
                  patientId: user.uid,
                  vitalType,
                  label: vital.label || getVitalDisplayName(vitalType),
                  currentValue: vital.value,
                  unit: vital.unit || '',
                  createdAt: vital.date
                });
              }
              await vitalService.addVitalValue(vitalId, {
                value: vital.value,
                date: vital.date,
                notes: 'Imported from Day One',
                systolic: vital.systolic,
                diastolic: vital.diastolic,
                documentId: documentId
              });
              vitalsImported++;
            } catch (err) {
              errors.push(`Vital ${vital.vitalType}: ${err.message}`);
            }
          }
        }

        if (importOptions.importSymptoms && entry.symptoms?.length > 0) {
          for (const symptom of entry.symptoms) {
            try {
              await symptomService.addSymptom({
                patientId: user.uid,
                name: symptom.name,
                type: symptom.name,
                severity: symptom.severity || 'Moderate',
                date: symptom.date,
                notes: symptom.notes || 'Imported from Day One',
                tags: ['day-one-import'],
                documentId: documentId
              });
              symptomsImported++;
            } catch (err) {
              errors.push(`Symptom ${symptom.name}: ${err.message}`);
            }
          }
        }

        if (importOptions.importJournalNotes && entry.journalContent?.trim()) {
          try {
            await journalNoteService.addJournalNote({
              patientId: user.uid,
              date: entry.date,
              content: entry.journalContent,
              source: 'day-one-import',
              documentId: documentId
            });
            journalImported++;
          } catch (err) {
            errors.push(`Journal ${formatDateString(entry.date)}: ${err.message}`);
          }
        }
      }

      setImportProgress('');
      setIsImporting(false);

      const total = vitalsImported + symptomsImported + journalImported;
      if (total > 0) {
        const parts = [];
        if (vitalsImported) parts.push(`${vitalsImported} vitals`);
        if (symptomsImported) parts.push(`${symptomsImported} symptoms`);
        if (journalImported) parts.push(`${journalImported} journal notes`);
        let msg = `Successfully imported ${parts.join(', ')} from Day One!`;
        if (errors.length > 0) {
          logger.warn('[DayOneImport] Some items failed:', errors.slice(0, 5));
          msg += ` (${errors.length} errors - check console for details)`;
        }
        showSuccess(msg);
        setImportProgress('Refreshing your data...');
        if (onImportComplete) await onImportComplete();
        if (onDocumentsChange) await onDocumentsChange();
        resetState();
        onClose();
      } else if (errors.length > 0) {
        showError(`Import failed: ${errors[0]}`);
      } else {
        showError('No data was imported. Try enabling more import options.');
      }
    } catch (err) {
      logger.error('[DayOneImport] Import error:', err);
      showError(`Import failed: ${err.message}`);
      setIsImporting(false);
      setImportProgress('');
    }
  };

  const handleClose = () => {
    if (!isImporting) {
      resetState();
      onClose();
    }
  };

  if (!show) return null;

  const { summary } = parsedData || {};
  const hasData = summary && (summary.totalVitals > 0 || summary.totalSymptoms > 0 || summary.entriesWithJournal > 0);

  return (
    <div className={DesignTokens.components.modal.backdrop}>
      <div className={combineClasses(DesignTokens.components.modal.container, 'max-w-lg')}>
        <div className={DesignTokens.components.modal.header}>
          <h3 className={combineClasses(DesignTokens.components.modal.title, 'flex items-center gap-2')}>
            <FileJson className={combineClasses('w-5 h-5', DesignTokens.colors.app.text[600])} />
            Import from Day One
          </h3>
          <button
            onClick={handleClose}
            disabled={isImporting}
            className={DesignTokens.components.modal.closeButton}
            type="button"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className={combineClasses(DesignTokens.components.modal.body, 'space-y-4')}>
          <p className={combineClasses('text-sm', DesignTokens.colors.app.text[600])}>
            Import vitals, symptoms, and journal notes from a Day One JSON export. The file is saved to your Documents (like other imports), and data points are linked to it. Export from Day One: Settings → Export → JSON.
          </p>

          {/* Show existing import warning with reimport option */}
          {existingImport && (
            <div className={combineClasses('rounded-lg border p-3 bg-amber-50 border-amber-200')}>
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className={combineClasses('text-sm font-medium text-amber-800')}>
                    Previous Day One import found
                  </p>
                  <p className={combineClasses('text-xs text-amber-700 mt-1')}>
                    Imported on {formatDateString(existingImport.createdAt?.toDate?.() || existingImport.createdAt)}
                    {existingImport.note && ` • ${existingImport.note}`}
                  </p>
                  <p className={combineClasses('text-xs text-amber-600 mt-2')}>
                    To reimport, delete the previous import first. This will remove all vitals, symptoms, and journal notes linked to it.
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      if (window.confirm('Delete all data from the previous Day One import? This cannot be undone.')) {
                        try {
                          const deleted = await handleDeletePreviousImport(existingImport.id);
                          showSuccess(`Deleted previous import (${deleted} data points). You can now import fresh.`);
                          if (onImportComplete) onImportComplete();
                          if (onDocumentsChange) onDocumentsChange();
                        } catch (err) {
                          showError(`Failed to delete previous import: ${err.message}`);
                        }
                      }
                    }}
                    disabled={isCleaningUp || isImporting}
                    className={combineClasses(
                      'flex items-center gap-2 px-3 py-2 mt-2 text-xs font-medium rounded-lg transition-colors',
                      'text-amber-800 bg-amber-100 hover:bg-amber-200 border border-amber-300'
                    )}
                  >
                    {isCleaningUp ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    {isCleaningUp ? 'Deleting...' : 'Delete previous import to reimport'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className={combineClasses('rounded-lg border p-3 bg-medical-neutral-50', DesignTokens.colors.app.border[200])}>
            <p className={combineClasses('text-xs font-medium mb-2', DesignTokens.colors.app.text[700])}>
              Clean up orphaned data
            </p>
            <p className={combineClasses('text-xs mb-2', DesignTokens.colors.app.text[600])}>
              Removes Day One data that isn&apos;t linked to a document, and journal notes that only have the template (section headers) with no data entered.
            </p>
            <button
              type="button"
              onClick={handleCleanupOrphaned}
              disabled={isCleaningUp || isImporting}
              className={combineClasses(
                'flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-colors',
                'text-red-700 bg-red-50 hover:bg-red-100 border border-red-200'
              )}
            >
              {isCleaningUp ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              {isCleaningUp ? 'Cleaning up...' : 'Clean up orphaned data'}
            </button>
          </div>

          {!parsedData ? (
            <>
              <label className="block">
                <span className="sr-only">Select Day One JSON file</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileSelect}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                />
              </label>
              {parseError && (
                <p className={combineClasses('text-sm', DesignTokens.colors.semantic.error)}>{parseError}</p>
              )}
            </>
          ) : (
            <>
              <div className={combineClasses('rounded-lg border p-3', DesignTokens.colors.app.border[200])}>
                <p className={combineClasses('text-sm font-medium', DesignTokens.colors.app.text[800])}>
                  {fileName}
                </p>
                <div className="mt-2 flex flex-wrap gap-3 text-sm">
                  <span className={combineClasses('flex items-center gap-1', DesignTokens.colors.app.text[600])}>
                    <BookOpen className="w-4 h-4" />
                    {summary.totalEntries} entries
                  </span>
                  {summary.dateRange && (
                    <span className={DesignTokens.colors.app.text[600]}>
                      {formatDateString(summary.dateRange.from)} – {formatDateString(summary.dateRange.to)}
                    </span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-4">
                  <span className={combineClasses('flex items-center gap-1.5', DesignTokens.moduleAccent.health.text)}>
                    <Activity className="w-4 h-4" />
                    {summary.totalVitals} vitals
                    {summary.vitalCounts && (
                      <span className="text-xs opacity-80">
                        ({[summary.vitalCounts.temp && `${summary.vitalCounts.temp} temp`, summary.vitalCounts.weight && `${summary.vitalCounts.weight} weight`, summary.vitalCounts.bp && `${summary.vitalCounts.bp} BP`].filter(Boolean).join(', ')})
                      </span>
                    )}
                  </span>
                  <span className={combineClasses('flex items-center gap-1.5', DesignTokens.moduleAccent.files.text)}>
                    <Heart className="w-4 h-4" />
                    {summary.totalSymptoms} symptoms
                  </span>
                  <span className={combineClasses('flex items-center gap-1.5', DesignTokens.colors.app.text[600])}>
                    <BookOpen className="w-4 h-4" />
                    {summary.entriesWithJournal} journal notes
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <p className={combineClasses('text-sm font-medium', DesignTokens.colors.app.text[800])}>
                  Import options
                </p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={importOptions.importVitals}
                    onChange={(e) =>
                      setImportOptions((o) => ({ ...o, importVitals: e.target.checked }))
                    }
                    className="rounded"
                  />
                  <span className="text-sm">Vitals (temperature, blood pressure, weight, etc.)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={importOptions.importSymptoms}
                    onChange={(e) =>
                      setImportOptions((o) => ({ ...o, importSymptoms: e.target.checked }))
                    }
                    className="rounded"
                  />
                  <span className="text-sm">Symptoms</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={importOptions.importJournalNotes}
                    onChange={(e) =>
                      setImportOptions((o) => ({ ...o, importJournalNotes: e.target.checked }))
                    }
                    className="rounded"
                  />
                  <span className="text-sm">Journal notes (regimen, medication, activities)</span>
                </label>
              </div>

              {isImporting && (
                <div className={combineClasses('flex items-center gap-2 text-sm', DesignTokens.colors.app.text[600])}>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {importProgress}
                </div>
              )}
            </>
          )}
        </div>

        <div className={DesignTokens.components.modal.footer}>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={isImporting}
              className={combineClasses(DesignTokens.components.button.secondary, DesignTokens.spacing.button.full, 'py-2.5 font-medium')}
            >
              {parsedData ? 'Cancel' : 'Close'}
            </button>
            {parsedData && hasData && (
              <button
                type="button"
                onClick={handleImport}
                disabled={isImporting}
                className={combineClasses(
                  DesignTokens.components.button.primary,
                  DesignTokens.spacing.button.full,
                  'py-2.5 font-medium flex items-center justify-center gap-2'
                )}
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Import
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
