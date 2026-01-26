import React from 'react';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';

/**
 * SectionInsightBadge Component
 *
 * Displays a visual health insight for a lab category section.
 * Adapts its display based on the insight type:
 * - CTCAE: Shows a progress bar with health score
 * - Status: Shows normal/abnormal counts
 * - Trend: Shows trend indicators for tumor markers
 *
 * Sources for CTCAE grading:
 * - NCI CTCAE v5.0: https://ctep.cancer.gov/protocoldevelopment/electronic_applications/ctcae.htm
 * - eviQ: https://www.eviq.org.au/dose-mod-gradings/standard-ctcae
 */

const colorClasses = {
  green: {
    bg: 'bg-green-100',
    fill: 'bg-green-500',
    text: 'text-green-700',
    border: 'border-green-200',
    icon: 'text-green-600'
  },
  yellow: {
    bg: 'bg-yellow-100',
    fill: 'bg-yellow-500',
    text: 'text-yellow-700',
    border: 'border-yellow-200',
    icon: 'text-yellow-600'
  },
  red: {
    bg: 'bg-red-100',
    fill: 'bg-red-500',
    text: 'text-red-700',
    border: 'border-red-200',
    icon: 'text-red-600'
  },
  gray: {
    bg: 'bg-gray-100',
    fill: 'bg-gray-400',
    text: 'text-gray-600',
    border: 'border-gray-200',
    icon: 'text-gray-500'
  }
};

/**
 * Progress bar component for CTCAE-based insights
 */
function ProgressBar({ score, color }) {
  const colors = colorClasses[color] || colorClasses.gray;
  const clampedScore = Math.max(0, Math.min(100, score || 0));

  return (
    <div className={`w-16 sm:w-20 h-1.5 ${colors.bg} rounded-full overflow-hidden`}>
      <div
        className={`h-full ${colors.fill} rounded-full transition-all duration-300`}
        style={{ width: `${clampedScore}%` }}
      />
    </div>
  );
}

/**
 * Icon component based on insight type and status
 */
function InsightIcon({ type, color, details }) {
  const colors = colorClasses[color] || colorClasses.gray;
  const iconClass = `w-3.5 h-3.5 ${colors.icon}`;

  if (type === 'trend') {
    const { trends } = details || {};
    if (trends?.increasing > 0) {
      return <TrendingUp className={iconClass} />;
    }
    if (trends?.decreasing > 0) {
      return <TrendingDown className={iconClass} />;
    }
    return <Minus className={iconClass} />;
  }

  if (color === 'green') {
    return <CheckCircle className={iconClass} />;
  }
  if (color === 'red') {
    return <AlertTriangle className={iconClass} />;
  }
  if (color === 'yellow') {
    return <AlertCircle className={iconClass} />;
  }

  return null;
}

/**
 * Main SectionInsightBadge component
 */
export default function SectionInsightBadge({ insight, compact = false }) {
  if (!insight || insight.type === 'empty') {
    return null;
  }

  const { type, score, label, color, details } = insight;
  const colors = colorClasses[color] || colorClasses.gray;

  // Compact mode: just show a colored dot
  if (compact) {
    return (
      <div
        className={`w-2 h-2 rounded-full ${colors.fill}`}
        title={label}
      />
    );
  }

  // CTCAE insight: show progress bar with score
  if (type === 'ctcae' && score !== null) {
    return (
      <div className="flex items-center gap-2">
        <ProgressBar score={score} color={color} />
        <span className={`text-xs font-medium ${colors.text} hidden sm:inline`}>
          {label}
        </span>
      </div>
    );
  }

  // Trend insight: show icon with label
  if (type === 'trend') {
    return (
      <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${colors.bg} ${colors.border} border`}>
        <InsightIcon type={type} color={color} details={details} />
        <span className={`text-xs font-medium ${colors.text}`}>
          {label}
        </span>
      </div>
    );
  }

  // Status insight: show counts badge
  if (type === 'status') {
    return (
      <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full ${colors.bg} ${colors.border} border`}>
        <InsightIcon type={type} color={color} details={details} />
        <span className={`text-xs font-medium ${colors.text}`}>
          {label}
        </span>
      </div>
    );
  }

  // Fallback: simple label
  return (
    <span className={`text-xs font-medium ${colors.text}`}>
      {label}
    </span>
  );
}

/**
 * Tooltip content for detailed insight information
 * Can be used with a tooltip library for hover details
 */
export function getInsightTooltip(insight) {
  if (!insight || insight.type === 'empty') {
    return 'No data available';
  }

  const { type, score, details } = insight;

  if (type === 'ctcae' && details) {
    const { gradeCounts, gradableCount } = details;
    const lines = [
      `Health Score: ${score}%`,
      `${gradableCount} labs graded`,
      '',
      'Grade Distribution:',
      `  Normal (G0): ${gradeCounts?.[0] || 0}`,
      `  Mild (G1): ${gradeCounts?.[1] || 0}`,
      `  Moderate (G2): ${gradeCounts?.[2] || 0}`,
      `  Severe (G3): ${gradeCounts?.[3] || 0}`,
      `  Life-threatening (G4): ${gradeCounts?.[4] || 0}`
    ];
    return lines.join('\n');
  }

  if (type === 'trend' && details) {
    const { trends } = details;
    return [
      'Tumor Marker Trends:',
      `  Rising: ${trends?.increasing || 0}`,
      `  Falling: ${trends?.decreasing || 0}`,
      `  Stable: ${trends?.stable || 0}`
    ].join('\n');
  }

  if (type === 'status' && details) {
    const { statusCounts } = details;
    return [
      'Status Summary:',
      `  Normal: ${statusCounts?.normal || 0}`,
      `  High: ${statusCounts?.high || 0}`,
      `  Low: ${statusCounts?.low || 0}`,
      `  Unknown: ${statusCounts?.unknown || 0}`
    ].join('\n');
  }

  return insight.label || 'No details available';
}
