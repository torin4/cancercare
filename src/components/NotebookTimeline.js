import React, { useState } from 'react';
import { FileText, Activity, Calendar, FileIcon, ChevronDown, ChevronUp, Eye, Plus, Trash2, Edit2 } from 'lucide-react';
import { formatDateString } from '../utils/helpers';

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
      {/* Add Entry Button */}
      {onAddNote && (
        <div className="flex justify-end mb-4">
          <button
            onClick={() => onAddNote(null)}
            className="flex items-center gap-2 px-4 py-2 bg-medical-primary-500 text-white rounded-lg hover:bg-medical-primary-600 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Entry
          </button>
        </div>
      )}

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
                  className="relative pl-8 pb-3 border-l-2 border-medical-primary-300 last:border-transparent last:pb-0"
                >
                  {/* Timeline Dot */}
                  <div className="absolute left-0 top-0 w-4 h-4 rounded-full border-2 bg-medical-primary-500 border-medical-primary-200 -ml-[9px]" />

                  {/* Entry Card */}
                  <div className="bg-white rounded-lg border-2 border-medical-primary-100 shadow-sm hover:shadow-md transition-all">
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
                                className="flex items-center gap-1 px-2 py-1 text-xs text-medical-primary-600 hover:text-medical-primary-700 hover:bg-medical-primary-50 rounded transition-colors"
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
                                const canDelete = isJournalNote && onDeleteNote;
                                return (
                                  <div
                                    key={note.id}
                                    className={`rounded-lg p-3 border relative group ${
                                      isJournalNote
                                        ? 'bg-yellow-50 border-yellow-200'
                                        : 'bg-medical-accent-50 border-medical-accent-100'
                                    }`}
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
                                            className="text-medical-primary-600 hover:text-medical-primary-700 hover:bg-medical-primary-50 p-1.5 rounded transition-colors"
                                            title="Edit note"
                                          >
                                            <Edit2 className="w-4 h-4" />
                                          </button>
                                        )}
                                        {canDelete && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onDeleteNote(note.sourceId);
                                            }}
                                            className="text-red-600 hover:text-red-700 hover:bg-red-50 p-1.5 rounded transition-colors"
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
                                className="mt-2 flex items-center gap-2 px-4 py-2 bg-medical-primary-500 text-white rounded-lg hover:bg-medical-primary-600 transition-colors text-sm font-medium mx-auto"
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
                                  className="flex items-center justify-between bg-blue-50 rounded-lg p-3 border border-blue-100"
                                >
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <FileIcon className="w-4 h-4 text-blue-600 flex-shrink-0" />
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
                                      className="text-blue-600 hover:text-blue-700 flex-shrink-0 ml-2"
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
                                  className="bg-orange-50 rounded-lg p-3 border border-orange-100"
                                >
                                  <div className="flex items-center gap-2">
                                    <Activity className="w-4 h-4 text-orange-600" />
                                    <p className="text-sm font-medium text-medical-neutral-900">
                                      {symptom.type}
                                    </p>
                                    <span className={`text-xs px-2 py-0.5 rounded ${
                                      symptom.severity === 'Severe' ? 'bg-red-100 text-red-700' :
                                      symptom.severity === 'Moderate' ? 'bg-orange-100 text-orange-700' :
                                      'bg-yellow-100 text-yellow-700'
                                    }`}>
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

