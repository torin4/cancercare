import React from 'react';
import { AlertTriangle } from 'lucide-react';

const colorClasses = {
  orange: 'bg-orange-100 text-orange-700 border-orange-200',
  red:    'bg-red-100 text-red-700 border-red-200',
  yellow: 'bg-yellow-100 text-yellow-700 border-yellow-200',
};

const iconClasses = {
  orange: 'text-orange-600',
  red:    'text-red-600',
  yellow: 'text-yellow-600',
};

/**
 * Small pill badge showing a clinical condition name (e.g. "Anemia", "Hypotension").
 * Renders nothing if condition is null/undefined.
 *
 * @param {{ condition: { name: string, severity: string, color: string } | null }} props
 */
export default function ConditionBadge({ condition }) {
  if (!condition) return null;

  const colors = colorClasses[condition.color] || colorClasses.orange;
  const iconColor = iconClasses[condition.color] || iconClasses.orange;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold border ${colors}`}>
      <AlertTriangle className={`w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0 ${iconColor}`} />
      <span className="whitespace-nowrap">{condition.name}</span>
    </span>
  );
}
