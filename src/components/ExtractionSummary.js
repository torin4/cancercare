import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

function classifyChange(item = {}) {
  if (item.deleted === true) return 'deleted';
  if (item.updated === true) return 'updated';

  const action = typeof item.action === 'string' ? item.action.trim().toLowerCase() : '';
  if (['delete', 'deleted', 'remove', 'removed'].includes(action)) return 'deleted';
  if (['update', 'updated', 'adjust', 'adjusted', 'edit', 'edited', 'change', 'changed', 'modify', 'modified'].includes(action)) {
    return 'updated';
  }

  return 'added';
}

function formatDate(value) {
  if (!value) return null;
  const parsed = value?.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString();
}

function formatLabLine(lab, change) {
  const label = lab.label || lab.labType || 'Lab';
  if (change === 'deleted') {
    if (lab.duplicatesRemoved && lab.deletedCount > 0) {
      return `${label}: removed ${lab.deletedCount} duplicate value${lab.deletedCount !== 1 ? 's' : ''}`;
    }
    if (lab.deletedCount > 0) {
      return `${label}: removed ${lab.deletedCount} value${lab.deletedCount !== 1 ? 's' : ''}`;
    }
    return `${label}: value removed`;
  }

  const unit = lab.unit ? ` ${lab.unit}` : '';
  const date = formatDate(lab.date);
  return `${label}: ${lab.value ?? '-'}${unit}${date ? ` (${date})` : ''}`;
}

function formatVitalLine(vital, change) {
  const label = vital.label || vital.vitalType || 'Vital';
  if (change === 'deleted') return `${label}: value removed`;

  const unit = vital.unit ? ` ${vital.unit}` : '';
  const date = formatDate(vital.date);
  return `${label}: ${vital.value ?? '-'}${unit}${date ? ` (${date})` : ''}`;
}

function formatSymptomLine(symptom) {
  const label = symptom.name || symptom.type || 'Symptom';
  const severity = symptom.severity ? ` (${symptom.severity})` : '';
  const date = formatDate(symptom.date);
  return `${label}${severity}${date ? ` - ${date}` : ''}`;
}

function formatMedicationLine(med, change) {
  const action = med.action ? ` (${med.action})` : '';
  if (change === 'deleted') return `${med.name || 'Medication'}${action}: removed`;
  return `${med.name || 'Medication'}${action}${med.dosage ? ` - ${med.dosage}` : ''}`;
}

function formatJournalLine(note) {
  const date = formatDate(note.date) || 'today';
  const preview = note.content && note.content.length > 60 ? `${note.content.substring(0, 60)}...` : (note.content || 'Note saved');
  return `Note for ${date}: ${preview}`;
}

export default function ExtractionSummary({ summary }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const computed = useMemo(() => {
    if (!summary) return null;

    const items = [];
    const counts = {
      total: 0,
      added: 0,
      updated: 0,
      deleted: 0
    };

    const pushItems = (rows, formatter) => {
      rows.forEach((row) => {
        const change = classifyChange(row);
        counts.total += 1;
        counts[change] += 1;
        items.push({
          change,
          text: formatter(row, change)
        });
      });
    };

    pushItems(summary.journalNotes || [], (note) => formatJournalLine(note));
    pushItems(summary.labs || [], (lab, change) => formatLabLine(lab, change));
    pushItems(summary.vitals || [], (vital, change) => formatVitalLine(vital, change));
    pushItems(summary.symptoms || [], (symptom) => formatSymptomLine(symptom));
    pushItems(summary.medications || [], (med, change) => formatMedicationLine(med, change));

    if (counts.total === 0) return null;

    const summaryBreakdown = summary.changeBreakdown || {};
    const normalizedBreakdown = {
      total: summaryBreakdown.total ?? counts.total,
      added: summaryBreakdown.added ?? counts.added,
      updated: summaryBreakdown.updated ?? counts.updated,
      deleted: summaryBreakdown.deleted ?? counts.deleted
    };

    return {
      items,
      counts: normalizedBreakdown
    };
  }, [summary]);

  if (!computed) return null;

  const { items, counts } = computed;

  return (
    <div className="text-xs text-medical-neutral-400 mt-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="text-left w-full hover:text-medical-neutral-600 transition-colors flex items-center gap-1"
      >
        {isExpanded ? (
          <ChevronUp className="w-3 h-3 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-3 h-3 flex-shrink-0" />
        )}
        <span>
          {counts.total} change{counts.total !== 1 ? 's' : ''} saved
        </span>
      </button>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {counts.added > 0 && (
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-200">
            {counts.added} added
          </span>
        )}
        {counts.updated > 0 && (
          <span className="inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 border border-amber-200">
            {counts.updated} updated
          </span>
        )}
        {counts.deleted > 0 && (
          <span className="inline-flex items-center rounded-full bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-700 border border-rose-200">
            {counts.deleted} deleted
          </span>
        )}
      </div>
      {isExpanded && items.length > 0 && (
        <div className="mt-2 ml-4 space-y-1">
          {items.map((item, idx) => (
            <div key={idx} className="text-xs text-medical-neutral-500">
              <span
                className={
                  item.change === 'deleted'
                    ? 'text-rose-600'
                    : item.change === 'updated'
                      ? 'text-amber-600'
                      : 'text-emerald-600'
                }
              >
                {item.change === 'deleted' ? 'Deleted:' : item.change === 'updated' ? 'Updated:' : 'Added:'}
              </span>{' '}
              {item.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
