import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function ExtractionSummary({ summary }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!summary) return null;

  const items = [];
  let totalCount = 0;

  if (summary.journalNotes?.length > 0) {
    totalCount += summary.journalNotes.length;
    if (isExpanded) {
      summary.journalNotes.forEach(note => {
        const dateStr = note.date ? new Date(note.date).toLocaleDateString() : 'today';
        const preview = note.content && note.content.length > 50 ? note.content.substring(0, 50) + '...' : (note.content || '');
        items.push(`Note for ${dateStr}: ${preview}`);
      });
    }
  }

  if (summary.labs?.length > 0) {
    totalCount += summary.labs.length;
    if (isExpanded) {
      summary.labs.forEach(lab => {
        items.push(`${lab.label}: ${lab.value} ${lab.unit || ''}`);
      });
    }
  }

  if (summary.vitals?.length > 0) {
    totalCount += summary.vitals.length;
    if (isExpanded) {
      summary.vitals.forEach(vital => {
        items.push(`${vital.label}: ${vital.value} ${vital.unit || ''}`);
      });
    }
  }

  if (summary.symptoms?.length > 0) {
    totalCount += summary.symptoms.length;
    if (isExpanded) {
      summary.symptoms.forEach(symptom => {
        items.push(`${symptom.name}${symptom.severity ? ` (${symptom.severity})` : ''}`);
      });
    }
  }

  if (summary.medications?.length > 0) {
    totalCount += summary.medications.length;
    if (isExpanded) {
      summary.medications.forEach(med => {
        items.push(`${med.name}${med.action ? ` - ${med.action}` : ''}`);
      });
    }
  }

  if (totalCount === 0) return null;

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
          {totalCount} data point{totalCount !== 1 ? 's' : ''} logged
        </span>
      </button>
      {isExpanded && items.length > 0 && (
        <div className="mt-2 ml-4 space-y-1">
          {items.map((item, idx) => (
            <div key={idx} className="text-xs text-medical-neutral-500">
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
