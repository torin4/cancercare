import React, { useMemo, useState } from 'react';
import { Activity, ChevronRight, FlaskConical, HeartPulse, Thermometer, TrendingDown, Pill, Info } from 'lucide-react';
import { DesignTokens, combineClasses } from '../../../design/designTokens';
import { calculateWellnessScore } from '../../../utils/wellnessScore';

const PILLAR_META = {
  labSafety: {
    label: 'Lab Safety',
    Icon: FlaskConical,
    tooltip: 'Organ function health based on CTCAE-graded lab results across liver, kidney, blood counts, electrolytes, and coagulation panels.',
  },
  vitals: {
    label: 'Vitals',
    Icon: HeartPulse,
    tooltip: 'Stability of your vital signs — blood pressure, heart rate, temperature, oxygen saturation, and weight — compared to normal ranges.',
  },
  symptoms: {
    label: 'Symptoms',
    Icon: Thermometer,
    tooltip: 'Impact of symptoms reported in the last 2 weeks, weighted by severity. Fewer and milder symptoms raise this score.',
  },
  diseaseMarkers: {
    label: 'Tumor Markers',
    Icon: TrendingDown,
    tooltip: 'Direction of your tumor marker trends. Stable or decreasing markers score higher; rising markers lower this pillar.',
  },
  medications: {
    label: 'Medications',
    Icon: Pill,
    tooltip: 'How consistently you have logged doses for active medications over the past week.',
  },
};

const COLOR_MAP = {
  green: { ring: '#22c55e', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-300', bar: 'bg-green-500' },
  yellow: { ring: '#eab308', bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-300', bar: 'bg-yellow-500' },
  orange: { ring: '#f97316', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-300', bar: 'bg-orange-500' },
  red: { ring: '#ef4444', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-300', bar: 'bg-red-500' },
  gray: { ring: '#9ca3af', bg: 'bg-gray-50', text: 'text-gray-500', border: 'border-gray-300', bar: 'bg-gray-300' },
};

/**
 * SVG arc showing the score as a partial ring (270° sweep).
 */
function ScoreArc({ score, color, size = 120 }) {
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;

  // 270° arc starting from bottom-left
  const startAngle = 135; // degrees
  const totalSweep = 270;
  const endAngle = startAngle + totalSweep;

  const toRad = (deg) => (deg * Math.PI) / 180;
  const arcX = (angle) => cx + radius * Math.cos(toRad(angle));
  const arcY = (angle) => cy + radius * Math.sin(toRad(angle));

  // Background track
  const trackStart = `${arcX(startAngle)},${arcY(startAngle)}`;
  const trackEnd = `${arcX(endAngle)},${arcY(endAngle)}`;
  const trackPath = `M ${trackStart} A ${radius} ${radius} 0 1 1 ${trackEnd}`;

  // Filled portion
  const fillSweep = (score / 100) * totalSweep;
  const fillEndAngle = startAngle + fillSweep;
  const fillEnd = `${arcX(fillEndAngle)},${arcY(fillEndAngle)}`;
  const largeArc = fillSweep > 180 ? 1 : 0;
  const fillPath = `M ${trackStart} A ${radius} ${radius} 0 ${largeArc} 1 ${fillEnd}`;

  const ringColor = COLOR_MAP[color]?.ring || COLOR_MAP.gray.ring;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
      <path d={trackPath} fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth} strokeLinecap="round" />
      {score > 0 && (
        <path d={fillPath} fill="none" stroke={ringColor} strokeWidth={strokeWidth} strokeLinecap="round" />
      )}
      <text x={cx} y={cy - 6} textAnchor="middle" className="fill-current text-gray-900" fontSize="28" fontWeight="700">
        {score}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" className="fill-current text-gray-500" fontSize="11" fontWeight="500">
        / 100
      </text>
    </svg>
  );
}

function PillarBar({ pillarKey, pillar, isTooltipOpen, onToggleTooltip }) {
  const meta = PILLAR_META[pillarKey] || { label: pillarKey, Icon: Activity, tooltip: '' };
  const { label, Icon, tooltip } = meta;
  const colors = COLOR_MAP[pillar.color] || COLOR_MAP.gray;
  const hasData = pillar.score != null;
  const pct = hasData ? pillar.score : 0;
  const weightPct = Math.round(pillar.weight * 100);

  return (
    <div>
      <div className="flex items-center gap-2.5">
        {/* Icon */}
        <Icon className={combineClasses('w-3.5 h-3.5 flex-shrink-0', hasData ? colors.text : 'text-gray-400')} />
        {/* Label + weight + info button */}
        <div className="w-24 sm:w-28 flex-shrink-0 flex items-center gap-1">
          <span className={combineClasses('text-xs font-medium', hasData ? 'text-gray-700' : 'text-gray-400')}>
            {label}
          </span>
          <span className="text-[10px] text-gray-400">({weightPct}%)</span>
          <button
            onClick={(e) => { e.stopPropagation(); onToggleTooltip(); }}
            className="text-gray-400 hover:text-gray-600 transition-colors p-0.5 -m-0.5"
            aria-label={`About ${label}`}
          >
            <Info className="w-3 h-3" />
          </button>
        </div>
        {/* Bar */}
        <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
          {hasData && (
            <div
              className={combineClasses('h-full rounded-full transition-all', colors.bar)}
              style={{ width: `${pct}%` }}
            />
          )}
        </div>
        {/* Score */}
        <span className={combineClasses('w-8 text-right text-xs font-semibold', hasData ? colors.text : 'text-gray-400')}>
          {hasData ? pct : '—'}
        </span>
      </div>
      {/* Tooltip */}
      {isTooltipOpen && (
        <p className="mt-1.5 ml-6 text-[11px] leading-relaxed text-gray-500 bg-gray-50 rounded-md px-2.5 py-2">
          {tooltip}
        </p>
      )}
    </div>
  );
}

export default function WellnessScoreCard({
  labsData,
  vitalsData,
  symptoms,
  medications,
  medicationLogs,
  trendAlerts,
}) {
  const [expanded, setExpanded] = useState(false);
  const [openTooltip, setOpenTooltip] = useState(null);

  const result = useMemo(
    () =>
      calculateWellnessScore({
        labsData,
        vitalsData,
        symptoms,
        medications,
        medicationLogs,
        trendAlerts,
      }),
    [labsData, vitalsData, symptoms, medications, medicationLogs, trendAlerts]
  );

  const { overall, pillars, dataCompleteness } = result;
  const hasScore = overall.score != null;
  const colors = COLOR_MAP[overall.color] || COLOR_MAP.gray;

  return (
    <div
      className={combineClasses(
        DesignTokens.components.card.container,
        'relative overflow-hidden'
      )}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-lg bg-gray-100">
          <Activity className="w-4 h-4 text-gray-700" />
        </div>
        <h3 className={combineClasses('text-sm font-semibold', 'text-gray-800')}>
          Treatment Wellness Score
        </h3>
      </div>

      {hasScore ? (
        <>
          {/* Score + label row */}
          <div className="flex items-center gap-4">
            <ScoreArc score={overall.score} color={overall.color} size={110} />
            <div className="flex-1 min-w-0">
              <span className={combineClasses('inline-block px-2.5 py-1 rounded-full text-xs font-semibold', colors.bg, colors.text)}>
                {overall.label}
              </span>
              <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                Based on {Math.round(dataCompleteness * 5)} of 5 health pillars.
                {dataCompleteness < 1 && ' Add more data to improve accuracy.'}
              </p>
            </div>
          </div>

          {/* Expand toggle */}
          <button
            onClick={() => setExpanded((v) => !v)}
            className={combineClasses(
              'w-full flex items-center justify-between mt-3 pt-3 border-t border-gray-100',
              'text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors'
            )}
          >
            <span>{expanded ? 'Hide breakdown' : 'View breakdown'}</span>
            <ChevronRight className={combineClasses('w-3.5 h-3.5 transition-transform', expanded && 'rotate-90')} />
          </button>

          {/* Pillar breakdown */}
          {expanded && (
            <div className="mt-3 space-y-2.5">
              {Object.entries(pillars).map(([key, pillar]) => (
                <PillarBar
                  key={key}
                  pillarKey={key}
                  pillar={pillar}
                  isTooltipOpen={openTooltip === key}
                  onToggleTooltip={() => setOpenTooltip((prev) => (prev === key ? null : key))}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        /* Insufficient data state */
        <div className="text-center py-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-gray-100 flex items-center justify-center mb-3">
            <Activity className="w-7 h-7 text-gray-400" />
          </div>
          <p className="text-sm font-medium text-gray-600">Insufficient Data</p>
          <p className="text-xs text-gray-400 mt-1">
            Add labs, vitals, or symptoms to see your wellness score.
          </p>
        </div>
      )}
    </div>
  );
}
