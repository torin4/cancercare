import React, { useState } from 'react';
import { FileText, Activity, Calendar, FileIcon, ChevronDown, ChevronUp, Eye, Plus, Trash2, Edit2 } from 'lucide-react';
import { formatDateString } from '../utils/helpers';
import { DesignTokens, combineClasses } from '../design/designTokens';

/**
 * NotebookTimeline Component
 *
 * Displays a date-centric timeline of health journal entries
 * Each entry represents a single date with all associated activities:
 * - Notes (from documents, symptoms, or manual entries)
 * - Documents uploaded that day
 * - Symptoms logged that day
 */
export default function NotebookTimeline({ entries, onEntryClick, onAddNote, onDeleteNote, onEditNote }) {
  const [expandedEntries, setExpandedEntries] = useState({});

  if (!entries || entries.length === 0) {
    return (
      <div className="text-center py-12 text-medical-neutral-500">
        <FileText className="w-12 h-12 mx-auto mb-3 text-medical-neutral-400" />
        <p className="text-sm">No journal entries yet</p>
        <p className="text-xs mt-1">Upload documents or log symptoms to start building your health journal</p>
      </div>
    );
  }

  const toggleEntry = (dateKey) => {
    setExpandedEntries(prev => ({
      ...prev,
      [dateKey]: !prev[dateKey]
    }));
  };

  // Group entries by month for the timeline
  const entriesByMonth = {};
  entries.forEach(entry => {
    const monthKey = entry.date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    if (!entriesByMonth[monthKey]) {
      entriesByMonth[monthKey] = [];
    }
    entriesByMonth[monthKey].push(entry);
  });

  return (
    <div className="space-y-8">
      {Object.entries(entriesByMonth).map(([month, monthEntries]) => (
        <div key={month}>
          {/* Month Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-2 text-medical-neutral-700">
              <Calendar className="w-4 h-4" />
              <h3 className="text-sm font-semibold">{month}</h3>
            </div>
            <div className="flex-1 h-px bg-medical-neutral-200" />
            <span className="text-xs text-medical-neutral-500">
              {monthEntries.length} {monthEntries.length === 1 ? 'day' : 'days'}
            </span>
          </div>

          {/* Timeline Entries */}
          <div className="space-y-3">
            {monthEntries.map((entry) => {
              const isExpanded = expandedEntries[entry.dateKey];
              const hasContent = entry.notes.length > 0 || entry.documents.length > 0 || entry.symptoms.length > 0;
              const itemCount = entry.notes.length + entry.documents.length + entry.symptoms.length;

              return (
                <div
                  key={entry.dateKey}
                  className={combineClasses('relative pl-8 pb-3 border-l-2 last:border-transparent last:pb-0', DesignTokens.moduleAccent.files.border)}
                >
                  {/* Timeline Dot */}
                  <div className={combineClasses('absolute left-0 top-0 w-4 h-4 rounded-full border-2 -ml-[9px]', 'bg-medical-secondary-600', DesignTokens.moduleAccent.files.border)} />

                  {/* Entry Card */}
                  <div className={combineClasses('bg-white rounded-lg border-2 shadow-sm hover:shadow-md transition-all', DesignTokens.moduleAccent.files.border)}>
                    {/* Date Header - Always visible */}
                    <div className="p-4">
                      <div className="flex items-center justify-between">
                        <div
                          className="flex items-center gap-3 flex-1 cursor-pointer"
                          onClick={() => hasContent && toggleEntry(entry.dateKey)}
                        >
                          <div className="flex items-center gap-2">
                            <h4 className="text-base font-bold text-medical-neutral-900">
                              {formatDateString(entry.date)}
                            </h4>
                            <span className="text-xs text-medical-neutral-500">
                              ({itemCount} {itemCount === 1 ? 'item' : 'items'})
                            </span>
                          </div>
                        </div>
                        {hasContent && (
                          <button
                            className="text-medical-neutral-400 hover:text-medical-neutral-600"
                            onClick={() => toggleEntry(entry.dateKey)}
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-5 h-5" />
                            ) : (
                              <ChevronDown className="w-5 h-5" />
                            )}
                          </button>
                        )}
                      </div>

                      {/* Quick Preview - show first note when collapsed */}
                      {!isExpanded && entry.notes.length > 0 && (
                        <div
                          className="cursor-pointer"
                          onClick={() => hasContent && toggleEntry(entry.dateKey)}
                        >
                          <p className="text-sm text-medical-neutral-600 mt-2 line-clamp-2">
                            {entry.notes[0].content}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="border-t border-medical-neutral-100 p-4 space-y-4">
                        {/* Notes Section */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="text-xs font-semibold text-medical-neutral-700 uppercase">
                              Notes
                            </h5>
                            {onAddNote && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onAddNote(entry.date);
                                }}
                                className={combineClasses('flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors', DesignTokens.moduleAccent.files.text, `hover:${DesignTokens.moduleAccent.files.text.replace('600', '700')}`, `hover:${DesignTokens.moduleAccent.files.bg}`)}
                              >
                                <Plus className="w-3 h-3" />
                                Add Note
                              </button>
                            )}
                          </div>
                          {entry.notes.length > 0 ? (
                            <div className="space-y-2">
                              {entry.notes.map((note) => {
                                const isJournalNote = note.source === 'journal';
                                const isDocumentNote = note.source === 'document';
                                const canEdit = (isJournalNote || isDocumentNote) && onEditNote;
                                const canDelete = (isJournalNote || isDocumentNote) && onDeleteNote;
                                return (
                                  <div
                                    key={note.id}
                                    className={combineClasses(
                                      'rounded-lg p-3 border relative group',
                                      isJournalNote
                                        ? combineClasses(DesignTokens.components.status.low.bg, DesignTokens.components.status.low.border)
                                        : combineClasses('bg-medical-accent-50', 'border-medical-accent-100')
                                    )}
                                  >
                                    <p className="text-sm text-medical-neutral-800">{note.content}</p>
                                  <div className="flex items-center justify-between mt-1">
                                    <p className="text-xs text-medical-neutral-500">
                                      From: {note.sourceName}
                                    </p>
                                    {(canEdit || canDelete) && (
                                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {canEdit && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onEditNote(note.sourceId, entry.date, note.source);
                                            }}
                                            className={combineClasses('p-1.5 rounded transition-colors', DesignTokens.moduleAccent.files.text, `hover:${DesignTokens.moduleAccent.files.text.replace('600', '700')}`, `hover:${DesignTokens.moduleAccent.files.bg}`)}
                                            title="Edit note"
                                          >
                                            <Edit2 className="w-4 h-4" />
                                          </button>
                                        )}
                                        {canDelete && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onDeleteNote(note.sourceId, note.source);
                                            }}
                                            className={combineClasses(DesignTokens.components.status.high.text, `hover:${DesignTokens.components.alert.text.error}`, `hover:${DesignTokens.components.status.high.bg}`, 'p-1.5 rounded', DesignTokens.transitions.default)}
                                            title="Delete note"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : onAddNote ? (
                            <div className="text-center py-4 text-medical-neutral-500">
                              <p className="text-sm">No notes for this date</p>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onAddNote(entry.date);
                                }}
                                className={combineClasses('mt-2 flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors text-sm font-medium mx-auto', DesignTokens.components.button.primary)}
                              >
                                <Plus className="w-4 h-4" />
                                Add Note
                              </button>
                            </div>
                          ) : null}
                        </div>

                        {/* Documents Section */}
                        {entry.documents.length > 0 && (
                          <div>
                            <h5 className="text-xs font-semibold text-medical-neutral-700 uppercase mb-2">
                              Documents Uploaded ({entry.documents.length})
                            </h5>
                            <div className="space-y-2">
                              {entry.documents.map((doc) => (
                                <div
                                  key={doc.id}
                                  className={combineClasses('flex items-center justify-between rounded-lg p-3 border', DesignTokens.moduleAccent.files.bg, DesignTokens.moduleAccent.files.border)}
                                >
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <FileIcon className={combineClasses('w-4 h-4 flex-shrink-0', DesignTokens.moduleAccent.files.text)} />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-medical-neutral-900 truncate">
                                        {doc.name}
                                      </p>
                                      <p className="text-xs text-medical-neutral-600">
                                        {doc.type}
                                        {doc.dataPointCount > 0 && ` • ${doc.dataPointCount} data points`}
                                      </p>
                                    </div>
                                  </div>
                                  {doc.fileUrl && (
                                    <a
                                      href={doc.fileUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={combineClasses('flex-shrink-0 ml-2', DesignTokens.moduleAccent.files.text, `hover:${DesignTokens.moduleAccent.files.text.replace('600', '700')}`, DesignTokens.transitions.default)}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Eye className="w-4 h-4" />
                                    </a>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Symptoms Section */}
                        {entry.symptoms.length > 0 && (
                          <div>
                            <h5 className="text-xs font-semibold text-medical-neutral-700 uppercase mb-2">
                              Symptoms Logged ({entry.symptoms.length})
                            </h5>
                            <div className="space-y-2">
                              {entry.symptoms.map((symptom) => (
                                <div
                                  key={symptom.id}
                                  className={combineClasses('bg-orange-50 rounded-lg p-3 border border-orange-100')}
                                >
                                  <div className="flex items-center gap-2">
                                    <Activity className="w-4 h-4 text-orange-600" />
                                    <p className="text-sm font-medium text-medical-neutral-900">
                                      {symptom.type}
                                    </p>
                                    <span className={combineClasses(
                                      'text-xs px-2 py-0.5 rounded',
                                      symptom.severity === 'Severe' ? combineClasses(DesignTokens.components.status.high.bg, DesignTokens.components.alert.text.error) :
                                      symptom.severity === 'Moderate' ? combineClasses('bg-orange-100', 'text-orange-700') :
                                      combineClasses(DesignTokens.components.status.low.bg, DesignTokens.components.alert.text.warning)
                                    )}>
                                      {symptom.severity}
                                    </span>
                                  </div>
                                  {symptom.notes && (
                                    <p className="text-sm text-medical-neutral-700 mt-2">{symptom.notes}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

