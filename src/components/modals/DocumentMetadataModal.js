import React, { useState } from 'react';
import { X, ChevronDown, ChevronUp, Activity, FileText, Pill, Dna } from 'lucide-react';
import { DesignTokens, combineClasses } from '../../design/designTokens';
import { parseLocalDate } from '../../utils/helpers';
import { getLabDisplayName } from '../../utils/normalizationUtils';

export default function DocumentMetadataModal({ show, document, onClose }) {
  const [expandedSections, setExpandedSections] = useState({
    summary: false,
    metrics: false,
    details: false
  });

  if (!show || !document) return null;

  const extractionSummary = document.extractionSummary;
  const hasExtractionData = extractionSummary && (
    extractionSummary.counts?.labs > 0 ||
    extractionSummary.counts?.vitals > 0 ||
    extractionSummary.counts?.medications > 0 ||
    extractionSummary.counts?.hasGenomic
  );

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  return (
    <div 
      className={combineClasses(DesignTokens.components.modal.backdrop, 'z-[101] animate-in fade-in duration-200')}
      onClick={onClose}
    >
      <div 
        className={combineClasses('bg-white', DesignTokens.borders.radius.lg, 'max-w-md w-full', DesignTokens.spacing.card.desktop, DesignTokens.shadows.lg, 'animate-fade-scale')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={combineClasses('flex items-center justify-between', DesignTokens.spacing.header.mobile)}>
          <h3 className={combineClasses(DesignTokens.typography.h2.full, DesignTokens.typography.h2.weight, DesignTokens.colors.neutral.text[900])}>Document Metadata</h3>
          <button
            onClick={onClose}
            className={combineClasses('p-1.5', DesignTokens.borders.radius.full, DesignTokens.transitions.default, DesignTokens.colors.neutral[100].replace('bg-', 'hover:bg-'))}
            aria-label="Close"
            type="button"
          >
            <X className={combineClasses(DesignTokens.icons.button.size.full, DesignTokens.colors.neutral.text[500])} />
          </button>
        </div>

        <div className={combineClasses('space-y-3', DesignTokens.spacing.gap.md)}>
          <div>
            <p className={combineClasses(DesignTokens.typography.body.xs, DesignTokens.typography.h3.weight, 'uppercase mb-1', DesignTokens.colors.neutral.text[500])}>File Name</p>
            <p className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.colors.neutral.text[900])}>{document.fileName || document.name || 'Unknown'}</p>
          </div>

          <div>
            <p className={combineClasses(DesignTokens.typography.body.xs, DesignTokens.typography.h3.weight, 'uppercase mb-1', DesignTokens.colors.neutral.text[500])}>Document Type</p>
            <p className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.colors.neutral.text[900])}>{document.documentType || document.type || 'Unknown'}</p>
          </div>

          {document.dataPointCount !== undefined && document.dataPointCount !== null && (
            <div>
              <p className={combineClasses(DesignTokens.typography.body.xs, DesignTokens.typography.h3.weight, 'uppercase mb-1', DesignTokens.colors.neutral.text[500])}>Extracted Data Points</p>
              <p className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, DesignTokens.colors.neutral.text[900])}>{document.dataPointCount} data point{document.dataPointCount !== 1 ? 's' : ''}</p>
            </div>
          )}

          {document.fileSize && (
            <div>
              <p className={combineClasses(DesignTokens.typography.body.xs, DesignTokens.typography.h3.weight, 'uppercase mb-1', DesignTokens.colors.neutral.text[500])}>File Size</p>
              <p className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.colors.neutral.text[900])}>
                {document.fileSize < 1024 
                  ? `${document.fileSize} bytes`
                  : document.fileSize < 1024 * 1024
                  ? `${(document.fileSize / 1024).toFixed(2)} KB`
                  : `${(document.fileSize / (1024 * 1024)).toFixed(2)} MB`}
              </p>
            </div>
          )}

          {document.fileType && (
            <div>
              <p className={combineClasses(DesignTokens.typography.body.xs, DesignTokens.typography.h3.weight, 'uppercase mb-1', DesignTokens.colors.neutral.text[500])}>File Type</p>
              <p className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.colors.neutral.text[900])}>{document.fileType}</p>
            </div>
          )}

          <div>
            <p className={combineClasses(DesignTokens.typography.body.xs, DesignTokens.typography.h3.weight, 'uppercase mb-1', DesignTokens.colors.neutral.text[500])}>Upload Date</p>
            <p className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.colors.neutral.text[900])}>
              {parseLocalDate(document.date).toLocaleDateString('en-US', { 
                month: 'long', 
                day: 'numeric', 
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>

          {document.note && (
            <div>
              <p className={combineClasses(DesignTokens.typography.body.xs, DesignTokens.typography.h3.weight, 'uppercase mb-1', DesignTokens.colors.neutral.text[500])}>Note</p>
              <p className={combineClasses(DesignTokens.typography.body.sm, 'italic', DesignTokens.colors.neutral.text[900])}>{document.note}</p>
            </div>
          )}

          {/* Extraction Summary Accordion */}
          {hasExtractionData && (
            <div className={combineClasses('border-t pt-4 mt-4', DesignTokens.borders.color.default)}>
              <h4 className={combineClasses(DesignTokens.typography.h3.full, DesignTokens.typography.h3.weight, 'mb-3', DesignTokens.colors.neutral.text[900])}>
                Extracted Data
              </h4>

              {/* Summary Section */}
              {extractionSummary.summary && extractionSummary.summary !== 'No summary available' && (
                <div className="mb-3">
                  <button
                    onClick={() => toggleSection('summary')}
                    className={combineClasses(
                      'w-full flex items-center justify-between p-3 rounded-lg transition-colors',
                      expandedSections.summary 
                        ? DesignTokens.colors.neutral[50] 
                        : 'hover:bg-gray-50'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <FileText className={combineClasses('w-4 h-4', DesignTokens.colors.neutral.text[600])} />
                      <span className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, DesignTokens.colors.neutral.text[900])}>
                        Summary
                      </span>
                    </div>
                    {expandedSections.summary ? (
                      <ChevronUp className={combineClasses('w-4 h-4', DesignTokens.colors.neutral.text[500])} />
                    ) : (
                      <ChevronDown className={combineClasses('w-4 h-4', DesignTokens.colors.neutral.text[500])} />
                    )}
                  </button>
                  {expandedSections.summary && (
                    <div className={combineClasses('px-3 pb-3', DesignTokens.colors.neutral.text[700])}>
                      <p className={combineClasses(DesignTokens.typography.body.sm, 'whitespace-pre-wrap')}>
                        {extractionSummary.summary}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Metrics Section */}
              <div className="mb-3">
                <button
                  onClick={() => toggleSection('metrics')}
                  className={combineClasses(
                    'w-full flex items-center justify-between p-3 rounded-lg transition-colors',
                    expandedSections.metrics 
                      ? DesignTokens.colors.neutral[50] 
                      : 'hover:bg-gray-50'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Activity className={combineClasses('w-4 h-4', DesignTokens.colors.neutral.text[600])} />
                    <span className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, DesignTokens.colors.neutral.text[900])}>
                      Extracted Metrics
                    </span>
                    <span className={combineClasses(DesignTokens.typography.body.xs, 'px-2 py-0.5 rounded-full', DesignTokens.colors.neutral[200], DesignTokens.colors.neutral.text[600])}>
                      {extractionSummary.counts.labs + extractionSummary.counts.vitals + extractionSummary.counts.medications + (extractionSummary.counts.hasGenomic ? 1 : 0)}
                    </span>
                  </div>
                  {expandedSections.metrics ? (
                    <ChevronUp className={combineClasses('w-4 h-4', DesignTokens.colors.neutral.text[500])} />
                  ) : (
                    <ChevronDown className={combineClasses('w-4 h-4', DesignTokens.colors.neutral.text[500])} />
                  )}
                </button>
                {expandedSections.metrics && (
                  <div className={combineClasses('px-3 pb-3 max-h-96 overflow-y-auto space-y-3', DesignTokens.colors.neutral.text[700])}>
                    {/* Lab Metrics */}
                    {extractionSummary.counts.labs > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Activity className={combineClasses('w-4 h-4', DesignTokens.colors.neutral.text[600])} />
                          <span className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, DesignTokens.colors.neutral.text[900])}>
                            Lab Values ({extractionSummary.counts.labs})
                          </span>
                        </div>
                        {extractionSummary.values?.labs && extractionSummary.values.labs.length > 0 ? (
                          <div className="space-y-1">
                            {extractionSummary.values.labs.map((lab, idx) => (
                              <div key={idx} className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.colors.neutral.text[900])}>
                                <span className={DesignTokens.typography.h3.weight}>
                                  {getLabDisplayName(lab.labType) || lab.label}:
                                </span>
                                {' '}
                                <span>{lab.value}</span>
                                {lab.unit && <span className={combineClasses(DesignTokens.colors.neutral.text[500])}> {lab.unit}</span>}
                                {lab.status && (
                                  <span className={combineClasses('ml-2 text-xs', 
                                    lab.status === 'high' ? 'text-red-600' :
                                    lab.status === 'low' ? 'text-blue-600' :
                                    'text-green-600'
                                  )}>
                                    ({lab.status})
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : extractionSummary.metricTypes?.labs && extractionSummary.metricTypes.labs.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {extractionSummary.metricTypes.labs.map((labType, idx) => (
                              <span
                                key={idx}
                                className={combineClasses(
                                  'px-2 py-1 rounded text-xs',
                                  DesignTokens.colors.neutral[100],
                                  DesignTokens.colors.neutral.text[700]
                                )}
                              >
                                {getLabDisplayName(labType)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className={combineClasses(DesignTokens.typography.body.xs, DesignTokens.colors.neutral.text[500], 'italic')}>
                            {extractionSummary.counts.labs} lab value{extractionSummary.counts.labs !== 1 ? 's' : ''} extracted
                          </p>
                        )}
                      </div>
                    )}

                    {/* Vital Metrics */}
                    {extractionSummary.counts.vitals > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Activity className={combineClasses('w-4 h-4', DesignTokens.colors.neutral.text[600])} />
                          <span className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, DesignTokens.colors.neutral.text[900])}>
                            Vital Signs ({extractionSummary.counts.vitals})
                          </span>
                        </div>
                        {extractionSummary.values?.vitals && extractionSummary.values.vitals.length > 0 ? (
                          <div className="space-y-1">
                            {extractionSummary.values.vitals.map((vital, idx) => (
                              <div key={idx} className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.colors.neutral.text[900])}>
                                <span className={combineClasses('capitalize', DesignTokens.typography.h3.weight)}>
                                  {vital.label || vital.vitalType.replace(/_/g, ' ')}:
                                </span>
                                {' '}
                                <span>{vital.value}</span>
                                {vital.unit && <span className={combineClasses(DesignTokens.colors.neutral.text[500])}> {vital.unit}</span>}
                              </div>
                            ))}
                          </div>
                        ) : extractionSummary.metricTypes?.vitals && extractionSummary.metricTypes.vitals.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {extractionSummary.metricTypes.vitals.map((vitalType, idx) => (
                              <span
                                key={idx}
                                className={combineClasses(
                                  'px-2 py-1 rounded text-xs capitalize',
                                  DesignTokens.colors.neutral[100],
                                  DesignTokens.colors.neutral.text[700]
                                )}
                              >
                                {vitalType.replace(/_/g, ' ')}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className={combineClasses(DesignTokens.typography.body.xs, DesignTokens.colors.neutral.text[500], 'italic')}>
                            {extractionSummary.counts.vitals} vital value{extractionSummary.counts.vitals !== 1 ? 's' : ''} extracted
                          </p>
                        )}
                      </div>
                    )}

                    {/* Medications */}
                    {extractionSummary.counts.medications > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Pill className={combineClasses('w-4 h-4', DesignTokens.colors.neutral.text[600])} />
                          <span className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, DesignTokens.colors.neutral.text[900])}>
                            Medications ({extractionSummary.counts.medications})
                          </span>
                        </div>
                        {extractionSummary.values?.medications && extractionSummary.values.medications.length > 0 ? (
                          <div className="space-y-1">
                            {extractionSummary.values.medications.map((med, idx) => (
                              <div key={idx} className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.colors.neutral.text[900])}>
                                <span className={DesignTokens.typography.h3.weight}>{med.name}</span>
                                {(med.dosage || med.frequency) && (
                                  <span className={combineClasses('ml-2 text-xs', DesignTokens.colors.neutral.text[500])}>
                                    {med.dosage && <span>{med.dosage}</span>}
                                    {med.dosage && med.frequency && <span> • </span>}
                                    {med.frequency && <span>{med.frequency}</span>}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className={combineClasses(DesignTokens.typography.body.xs, DesignTokens.colors.neutral.text[500], 'italic')}>
                            {extractionSummary.counts.medications} medication{extractionSummary.counts.medications !== 1 ? 's' : ''} extracted
                          </p>
                        )}
                      </div>
                    )}

                    {/* Genomic Data */}
                    {extractionSummary.counts.hasGenomic && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Dna className={combineClasses('w-4 h-4', DesignTokens.colors.neutral.text[600])} />
                          <span className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, DesignTokens.colors.neutral.text[900])}>
                            Genomic Data
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Details Section */}
              <div>
                <button
                  onClick={() => toggleSection('details')}
                  className={combineClasses(
                    'w-full flex items-center justify-between p-3 rounded-lg transition-colors',
                    expandedSections.details 
                      ? DesignTokens.colors.neutral[50] 
                      : 'hover:bg-gray-50'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <FileText className={combineClasses('w-4 h-4', DesignTokens.colors.neutral.text[600])} />
                    <span className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, DesignTokens.colors.neutral.text[900])}>
                      Extraction Details
                    </span>
                  </div>
                  {expandedSections.details ? (
                    <ChevronUp className={combineClasses('w-4 h-4', DesignTokens.colors.neutral.text[500])} />
                  ) : (
                    <ChevronDown className={combineClasses('w-4 h-4', DesignTokens.colors.neutral.text[500])} />
                  )}
                </button>
                {expandedSections.details && (
                  <div className={combineClasses('px-3 pb-3 max-h-96 overflow-y-auto space-y-2', DesignTokens.colors.neutral.text[700])}>
                    {extractionSummary.extractedAt && (
                      <div>
                        <p className={combineClasses(DesignTokens.typography.body.xs, DesignTokens.typography.h3.weight, 'uppercase mb-1', DesignTokens.colors.neutral.text[500])}>
                          Extracted At
                        </p>
                        <p className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.colors.neutral.text[900])}>
                          {new Date(extractionSummary.extractedAt).toLocaleString('en-US', {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    )}
                    {extractionSummary.customInstructions && (
                      <div>
                        <p className={combineClasses(DesignTokens.typography.body.xs, DesignTokens.typography.h3.weight, 'uppercase mb-1', DesignTokens.colors.neutral.text[500])}>
                          Custom Instructions
                        </p>
                        <p className={combineClasses(DesignTokens.typography.body.sm, 'italic', DesignTokens.colors.neutral.text[900])}>
                          {extractionSummary.customInstructions}
                        </p>
                      </div>
                    )}
                    {extractionSummary.onlyExistingMetrics !== undefined && (
                      <div>
                        <p className={combineClasses(DesignTokens.typography.body.xs, DesignTokens.typography.h3.weight, 'uppercase mb-1', DesignTokens.colors.neutral.text[500])}>
                          Extraction Mode
                        </p>
                        <p className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.colors.neutral.text[900])}>
                          {extractionSummary.onlyExistingMetrics 
                            ? 'Only existing metrics' 
                            : 'All metrics (created new if needed)'}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          className={combineClasses(DesignTokens.components.button.primary, 'mt-6 w-full py-3 font-medium disabled:opacity-50 disabled:cursor-not-allowed')}
        >
          Close
        </button>
      </div>
    </div>
  );
}

