/**
 * HealthChart - Recharts-based line/area chart for labs and vitals
 * Supports: normal range shading, per-point status colors, custom tooltip with Edit/Delete
 */

import React from 'react';
import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
} from 'recharts';
import { Edit2, Trash2 } from 'lucide-react';
import { DesignTokens, combineClasses } from '../../../../design/designTokens';
import { parseNormalRangeForRecharts, POINTS_PER_VIEWPORT, POINTS_PER_VIEWPORT_MOBILE } from '../utils/chartUtils';

const STATUS_COLORS = {
  green: '#10b981',
  yellow: '#f59e0b',
  red: '#ef4444',
  gray: '#6b7280',
};

/**
 * Custom dot - colors by status (normal/low/high)
 */
function CustomDot(props) {
  const { cx, cy, payload, isLatest, selectedDataPoint, pointKey, onSelect } = props;
  const status = payload?.status || 'normal';
  const color = STATUS_COLORS[status] || STATUS_COLORS.gray;
  const isSelected = selectedDataPoint === pointKey;

  return (
    <g
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(pointKey);
      }}
      style={{ cursor: 'pointer' }}
    >
      <circle
        cx={cx}
        cy={cy}
        r={isSelected || isLatest ? 7 : 5}
        fill={color}
        stroke="white"
        strokeWidth={2}
        style={{ filter: isLatest ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' : undefined }}
      />
    </g>
  );
}

/** Systolic (higher) line color - red/coral for BP */
const SYSTOLIC_COLOR = '#dc2626';
/** Diastolic (lower) line color - blue for BP */
const DIASTOLIC_COLOR = '#2563eb';

/**
 * Custom tooltip - value and date only (Edit/Delete are in the persistent bar when a point is selected)
 */
function CustomTooltipContent({ active, payload, label, unit, isBloodPressure }) {
  if (!active || !payload?.length) return null;

  const data = payload[0]?.payload;
  if (!data) return null;

  const displayValue = data.displayValue ?? (isBloodPressure ? `${data.value}/${data.diastolic ?? '—'}` : data.value);
  const date = data.date ?? label;

  return (
    <div
      className={combineClasses(
        'text-xs rounded-lg py-2 px-3 shadow-xl whitespace-nowrap',
        DesignTokens.colors.neutral[900],
        'text-white'
      )}
    >
      <div className="font-bold text-sm">{displayValue} {unit}</div>
      <div className={combineClasses('text-xs mt-0.5', DesignTokens.colors.neutral.text[300])}>{date}</div>
    </div>
  );
}

/**
 * HealthChart - shared chart for labs and vitals
 * @param {Object} props
 * @param {Array} props.data - [{ date, value, id, displayValue, status }]
 * @param {string} props.unit - Unit label
 * @param {string} props.normalRange - Normal range string for ReferenceArea/Line
 * @param {Object} props.bounds - { yMin, yMax }
 * @param {boolean} props.isScrollable - Enable horizontal scroll
 * @param {number} props.dataLength - For scroll width calc
 * @param {string} props.pointKeyPrefix - e.g. "ca125" or "bp"
 * @param {string} props.selectedDataPoint - Currently selected point key
 * @param {Function} props.onSelectPoint - (pointKey) => void
 * @param {Function} props.onEditPoint - (dataPoint) => void
 * @param {Function} props.onDeletePoint - (dataPoint) => void
 * @param {boolean} props.isBloodPressure - Parse BP format in normal range
 * @param {string} props.chartId - Unique id for gradient defs
 */
/** Mobile breakpoint (matches Tailwind sm) */
const MOBILE_BREAKPOINT = 640;

function HealthChart({
  data,
  unit,
  normalRange,
  bounds,
  isScrollable,
  dataLength,
  pointKeyPrefix,
  selectedDataPoint,
  onSelectPoint,
  onEditPoint,
  onDeletePoint,
  isBloodPressure = false,
  chartId = 'health',
}) {
  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handler = () => setIsMobile(mq.matches);
    handler();
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const pointsPerViewport = isMobile ? POINTS_PER_VIEWPORT_MOBILE : POINTS_PER_VIEWPORT;
  const { yMin, yMax } = bounds || { yMin: 0, yMax: 100 };
  const normalRangeConfig = parseNormalRangeForRecharts(normalRange, yMin, yMax, isBloodPressure);

  // Transform data for Recharts - ensure each point has pointKey for selection
  const chartData = React.useMemo(() => {
    return (data || []).map((d, i) => ({
      ...d,
      pointKey: d.pointKey ?? `${pointKeyPrefix}-${d.id ?? i}`,
      isLatest: i === (data?.length ?? 0) - 1,
    }));
  }, [data, pointKeyPrefix]);

  const selectedPointData = React.useMemo(() => {
    if (!selectedDataPoint || !chartData.length) return null;
    return chartData.find((d) => d.pointKey === selectedDataPoint) ?? null;
  }, [selectedDataPoint, chartData]);

  const chartContent = (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart
        data={chartData}
        margin={{ top: 5, right: 5, left: 0, bottom: 0 }}
        onClick={() => selectedDataPoint && onSelectPoint?.(null)}
      >
        <defs>
          <linearGradient id={`gradient-${chartId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.2} />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.05} />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="0" stroke="#e5e7eb" horizontal={true} vertical={false} />

        <XAxis
          dataKey="date"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: '#6b7280' }}
          interval="preserveStartEnd"
        />

        <YAxis
          domain={[yMin, yMax]}
          axisLine={false}
          tickLine={false}
          hide
          width={0}
        />

        <Tooltip
          content={<CustomTooltipContent unit={unit} isBloodPressure={isBloodPressure} />}
          cursor={false}
          allowEscapeViewBox={false}
          wrapperStyle={{ outline: 'none' }}
        />

        {/* Normal range - ReferenceArea and ReferenceLine */}
        {!isBloodPressure && normalRangeConfig?.area && (
          <ReferenceArea
            y1={normalRangeConfig.area.y1}
            y2={normalRangeConfig.area.y2}
            fill="#3b82f6"
            fillOpacity={0.08}
          />
        )}
        {!isBloodPressure && normalRangeConfig?.line && (
          <ReferenceLine
            y={normalRangeConfig.line.y}
            stroke="#3b82f6"
            strokeDasharray="4 4"
            strokeOpacity={0.4}
          />
        )}
        {/* BP: two reference lines for systolic and diastolic thresholds */}
        {isBloodPressure && normalRangeConfig?.line && (
          <ReferenceLine y={normalRangeConfig.line.y} stroke={SYSTOLIC_COLOR} strokeDasharray="4 4" strokeOpacity={0.5} />
        )}
        {isBloodPressure && normalRangeConfig?.line2 && (
          <ReferenceLine y={normalRangeConfig.line2.y} stroke={DIASTOLIC_COLOR} strokeDasharray="4 4" strokeOpacity={0.5} />
        )}

        {isBloodPressure ? (
          <>
            <Line
              type="monotone"
              dataKey="value"
              name="Systolic"
              stroke={SYSTOLIC_COLOR}
              strokeWidth={2}
              dot={(props) => (
                <CustomDot
                  {...props}
                  isLatest={props.payload?.isLatest}
                  selectedDataPoint={selectedDataPoint}
                  pointKey={props.payload?.pointKey}
                  onSelect={onSelectPoint}
                />
              )}
              activeDot={(props) => (
                <CustomDot
                  {...props}
                  isLatest={props.payload?.isLatest}
                  selectedDataPoint={selectedDataPoint}
                  pointKey={props.payload?.pointKey}
                  onSelect={onSelectPoint}
                />
              )}
              isAnimationActive={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="diastolic"
              name="Diastolic"
              stroke={DIASTOLIC_COLOR}
              strokeWidth={2}
              dot={(props) => (
                <CustomDot
                  {...props}
                  isLatest={props.payload?.isLatest}
                  selectedDataPoint={selectedDataPoint}
                  pointKey={props.payload?.pointKey}
                  onSelect={onSelectPoint}
                />
              )}
              activeDot={(props) => (
                <CustomDot
                  {...props}
                  isLatest={props.payload?.isLatest}
                  selectedDataPoint={selectedDataPoint}
                  pointKey={props.payload?.pointKey}
                  onSelect={onSelectPoint}
                />
              )}
              isAnimationActive={false}
              connectNulls
            />
          </>
        ) : (
          <Area
            type="monotone"
            dataKey="value"
            stroke="#3b82f6"
            strokeWidth={2}
            fill={`url(#gradient-${chartId})`}
            isAnimationActive={false}
            dot={(props) => (
              <CustomDot
                {...props}
                isLatest={props.payload?.isLatest}
                selectedDataPoint={selectedDataPoint}
                pointKey={props.payload?.pointKey}
                onSelect={onSelectPoint}
              />
            )}
            activeDot={(props) => (
              <CustomDot
                {...props}
                isLatest={props.payload?.isLatest}
                selectedDataPoint={selectedDataPoint}
                pointKey={props.payload?.pointKey}
                onSelect={onSelectPoint}
              />
            )}
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );

  return (
    <div className="flex gap-2 sm:gap-3">
      {/* Y-axis labels - manual for alignment with Recharts */}
      <div
        className={combineClasses(
          'flex flex-col justify-between text-xs font-medium py-2 flex-shrink-0',
          DesignTokens.colors.neutral.text[600]
        )}
        style={{ paddingBottom: '1.5rem' }}
      >
        {[4, 3, 2, 1, 0].map((i) => {
          const step = (yMax - yMin) / 4;
          const val = yMin + step * i;
          return (
            <div key={i} className="text-right pr-2 w-10" style={{ lineHeight: 1 }}>
              {yMax > 100 ? val.toFixed(0) : val.toFixed(1)}
            </div>
          );
        })}
      </div>

      {/* Chart area with optional scroll - outline-none prevents blue focus border on graph */}
      <div
        className={combineClasses('flex-1 min-w-0 outline-none focus:outline-none', isScrollable && 'overflow-x-auto overflow-y-hidden')}
      >
        <div
          className="h-40 mb-3 outline-none [&_svg]:outline-none [&_svg]:focus:outline-none"
          style={
            isScrollable
              ? { width: `calc(100% * ${Math.max(dataLength || 0, pointsPerViewport)} / ${pointsPerViewport})`, minWidth: '100%' }
              : { width: '100%' }
          }
        >
          {chartContent}
        </div>

        {/* Persistent bar when a point is selected - stays visible so user can tap Edit/Delete */}
        {selectedPointData && selectedPointData.id && (
          <div
            className={combineClasses(
              'flex items-center justify-between gap-3 rounded-lg py-2 px-3 shadow-md',
              DesignTokens.colors.neutral[900],
              'text-white'
            )}
          >
            <div>
              <div className="font-bold text-sm">
                {selectedPointData.displayValue ?? selectedPointData.value} {unit}
              </div>
              <div className={combineClasses('text-xs mt-0.5', DesignTokens.colors.neutral.text[300])}>
                {selectedPointData.date}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEditPoint?.(selectedPointData);
                  onSelectPoint?.(null);
                }}
                className={combineClasses(
                  'transition-colors p-2 rounded min-h-[36px] min-w-[36px] flex items-center justify-center touch-manipulation',
                  DesignTokens.colors.primary.text[500],
                  'hover:bg-white/20 active:bg-white/30'
                )}
                title="Edit this reading"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeletePoint?.(selectedPointData);
                  onSelectPoint?.(null);
                }}
                className={combineClasses(
                  'transition-colors p-2 rounded min-h-[36px] min-w-[36px] flex items-center justify-center touch-manipulation',
                  DesignTokens.components.status.high.text,
                  'hover:bg-white/20 active:bg-white/30'
                )}
                title="Delete this reading"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default React.memo(HealthChart);
