import { normalizeLabName, getLabDisplayName, getVitalDisplayName } from '../utils/normalizationUtils';

const TREND_THRESHOLDS = {
  labs: {
    ca125: { upPercent: 5, downPercent: 15 },
    ca199: { upPercent: 5, downPercent: 15 },
    ca153: { upPercent: 5, downPercent: 15 },
    ca2729: { upPercent: 5, downPercent: 15 },
    cea: { upPercent: 5, downPercent: 15 },
    psa: { upPercent: 5, downPercent: 15 },
    afp: { upPercent: 5, downPercent: 15 },
    he4: { upPercent: 5, downPercent: 15 },
    scc_antigen: { upPercent: 5, downPercent: 15 },
    cyfra211: { upPercent: 5, downPercent: 15 },
    hemoglobin: { upPercent: 10, downPercent: 10 },
    hematocrit: { upPercent: 10, downPercent: 10 },
    wbc: { upPercent: 25, downPercent: 25 },
    platelets: { upPercent: 15, downPercent: 15 },
    rbc: { upPercent: 10, downPercent: 10 },
    creatinine: { upPercent: 20, downPercent: 20 },
    egfr: { upPercent: 15, downPercent: 15 },
    bun: { upPercent: 25, downPercent: 25 },
    alt: { upPercent: 25, downPercent: 25 },
    ast: { upPercent: 25, downPercent: 25 },
    bilirubin: { upPercent: 20, downPercent: 20 },
    albumin: { upPercent: 15, downPercent: 15 },
    ldh: { upPercent: 25, downPercent: 25 },
    glucose: { upPercent: 20, downPercent: 20 },
    crp: { upPercent: 50, downPercent: 25 },
    default: { upPercent: 10, downPercent: 15 }
  },
  vitals: {
    weight: { upPercent: 5, downPercent: 5 },
    blood_pressure: { upPercent: 10, downPercent: 10 },
    bp: { upPercent: 10, downPercent: 10 },
    bloodpressure: { upPercent: 10, downPercent: 10 },
    temperature: { useAbsolute: true, upAbsolute: 1, downAbsolute: 1 },
    temp: { useAbsolute: true, upAbsolute: 1, downAbsolute: 1 },
    oxygen_saturation: { useAbsolute: true, upAbsolute: 0, downAbsolute: 2 },
    o2sat: { useAbsolute: true, upAbsolute: 0, downAbsolute: 2 },
    heart_rate: { upPercent: 15, downPercent: 15 },
    hr: { upPercent: 15, downPercent: 15 },
    heartrate: { upPercent: 15, downPercent: 15 },
    pulse: { upPercent: 15, downPercent: 15 },
    default: { upPercent: 10, downPercent: 15 }
  }
};

const CRITICAL_LAB_ORDER = ['ca125', 'cea', 'wbc', 'hemoglobin', 'platelets', 'creatinine', 'egfr', 'alt', 'ast', 'albumin', 'ldh', 'ca199', 'psa', 'afp'];
const SEVERITY_WEIGHTS = { high: 3, medium: 2, low: 1 };

const CONCERNING_DIRECTIONS = {
  labs: {
    ca125: 'up',
    ca199: 'up',
    cea: 'up',
    psa: 'up',
    afp: 'up',
    he4: 'up',
    creatinine: 'up',
    bun: 'up',
    alt: 'up',
    ast: 'up',
    bilirubin: 'up',
    ldh: 'up',
    crp: 'up',
    wbc: 'up',
    glucose: 'up',
    hemoglobin: 'down',
    hematocrit: 'down',
    rbc: 'down',
    platelets: 'down',
    egfr: 'down',
    albumin: 'down'
  },
  vitals: {
    blood_pressure: 'up',
    bp: 'up',
    bloodpressure: 'up',
    heart_rate: 'up',
    hr: 'up',
    heartrate: 'up',
    pulse: 'up',
    temperature: 'up',
    temp: 'up',
    oxygen_saturation: 'down',
    o2sat: 'down'
  }
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toIsoDate(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null;
  return value.toISOString().slice(0, 10);
}

function parseDateValue(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    // Support both millisecond and second epoch timestamps.
    const epochMs = value > 1e12 ? value : value * 1000;
    const date = new Date(epochMs);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === 'object' && typeof value.toDate === 'function') {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === 'object' && Number.isFinite(value.seconds)) {
    const date = new Date(value.seconds * 1000);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === 'string') {
    const direct = new Date(value);
    if (!Number.isNaN(direct.getTime())) return direct;

    // "Oct 15" style dates (year missing): infer nearest non-future date.
    const shortMatch = value.trim().match(/^([A-Za-z]{3,9})\s+(\d{1,2})$/);
    if (shortMatch) {
      const month = shortMatch[1];
      const day = Number(shortMatch[2]);
      const now = new Date();
      const withCurrentYear = new Date(`${month} ${day}, ${now.getFullYear()}`);
      if (!Number.isNaN(withCurrentYear.getTime())) {
        if (withCurrentYear.getTime() > now.getTime() + (2 * 24 * 60 * 60 * 1000)) {
          withCurrentYear.setFullYear(withCurrentYear.getFullYear() - 1);
        }
        return withCurrentYear;
      }
    }
  }

  return null;
}

function parseNumericValue(metricType, metricKey, rawPoint) {
  const normalizedVitalKey = normalizeMetricKey(metricType, metricKey);
  const isBloodPressure = metricType === 'vital' && ['bp', 'bloodpressure', 'blood_pressure'].includes(normalizedVitalKey);

  if (isBloodPressure) {
    const systolic = Number.parseFloat(rawPoint?.systolic ?? rawPoint?.value);
    if (Number.isFinite(systolic)) return systolic;
    return null;
  }

  const numeric = Number.parseFloat(rawPoint?.value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeMetricKey(metricType, key) {
  if (!key) return '';
  if (metricType === 'lab') {
    return (normalizeLabName(key) || key).toLowerCase();
  }
  return String(key).toLowerCase().replace(/-/g, '');
}

function formatMetricValue(metricType, metricKey, point) {
  const normalizedVitalKey = normalizeMetricKey(metricType, metricKey);
  const isBloodPressure = metricType === 'vital' && ['bp', 'bloodpressure', 'blood_pressure'].includes(normalizedVitalKey);

  if (isBloodPressure) {
    if (point?.raw?.diastolic != null) {
      return `${point.value}/${point.raw.diastolic}`;
    }
    return `${point.value}`;
  }

  if (Number.isInteger(point.value)) return String(point.value);
  return Number(point.value).toFixed(1).replace(/\.0$/, '');
}

function getThreshold(metricType, key) {
  const bucket = metricType === 'lab' ? TREND_THRESHOLDS.labs : TREND_THRESHOLDS.vitals;
  const normalizedKey = normalizeMetricKey(metricType, key);
  return (
    bucket[key] ||
    bucket[String(key).toLowerCase()] ||
    bucket[normalizedKey] ||
    bucket.default ||
    { upPercent: 10, downPercent: 15 }
  );
}

function getConcerningDirection(metricType, key) {
  const normalized = normalizeMetricKey(metricType, key);
  if (metricType === 'lab') return CONCERNING_DIRECTIONS.labs[normalized] || null;
  return CONCERNING_DIRECTIONS.vitals[normalized] || null;
}

function buildSeries(metricType, metricKey, metricData) {
  const rawValues = Array.isArray(metricData?.data)
    ? metricData.data
    : Array.isArray(metricData?.values)
      ? metricData.values
      : [];

  return rawValues
    .map((point) => ({
      date: parseDateValue(point?.dateOriginal || point?.timestamp || point?.date),
      value: parseNumericValue(metricType, metricKey, point),
      raw: point
    }))
    .filter((point) => point.date && point.value != null)
    .sort((a, b) => a.date - b.date);
}

function getSignalType(metricType, key, direction) {
  const concerningDirection = getConcerningDirection(metricType, key);
  if (!concerningDirection) return 'notable';
  return concerningDirection === direction ? 'concerning' : 'improving';
}

function scoreTrendConfidence(points, thresholdRatio, latestDirection) {
  if (points.length < 2) return 0.4;

  const deltas = [];
  for (let i = 1; i < points.length; i += 1) {
    deltas.push(points[i].value - points[i - 1].value);
  }

  const directionMatches = deltas.filter((delta) => {
    if (latestDirection === 'up') return delta > 0;
    if (latestDirection === 'down') return delta < 0;
    return delta === 0;
  }).length;

  const consistency = deltas.length > 0 ? directionMatches / deltas.length : 0.5;
  const sampleScore = clamp(points.length / 6, 0.35, 1);
  const strengthScore = clamp(thresholdRatio / 2, 0.2, 1);

  return clamp((0.35 * consistency) + (0.4 * sampleScore) + (0.25 * strengthScore), 0.35, 0.98);
}

function confidenceBucket(confidence) {
  if (confidence >= 0.85) return 'high';
  if (confidence >= 0.65) return 'medium';
  return 'low';
}

function resolveSeverity(signalType, thresholdRatio, confidence) {
  if (signalType === 'concerning') {
    if (thresholdRatio >= 2 || confidence >= 0.9) return 'high';
    if (thresholdRatio >= 1.4 || confidence >= 0.75) return 'medium';
    return 'low';
  }

  if (signalType === 'improving') {
    if (thresholdRatio >= 2.2 && confidence >= 0.8) return 'medium';
    return 'low';
  }

  if (thresholdRatio >= 2.2 && confidence >= 0.85) return 'medium';
  return 'low';
}

function evaluateMetric(metricType, key, metricData, displayName) {
  const series = buildSeries(metricType, key, metricData);
  if (series.length < 2) return null;

  const threshold = getThreshold(metricType, key);
  const latest = series[series.length - 1];
  const previous = series[series.length - 2];

  const change = latest.value - previous.value;
  const percentChange = previous.value !== 0 ? (change / previous.value) * 100 : 0;
  const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'stable';
  if (direction === 'stable') return null;

  const useAbsolute = Boolean(threshold.useAbsolute);
  const upThreshold = useAbsolute ? (threshold.upAbsolute ?? 0) : (threshold.upPercent ?? 10);
  const downThreshold = useAbsolute ? (threshold.downAbsolute ?? 0) : (threshold.downPercent ?? 15);

  const triggered = useAbsolute
    ? (direction === 'up' ? change >= upThreshold : Math.abs(change) >= downThreshold)
    : (direction === 'up' ? percentChange >= upThreshold : Math.abs(percentChange) >= downThreshold);

  const thresholdBase = direction === 'up' ? upThreshold : downThreshold;
  const thresholdRatio = thresholdBase > 0
    ? (useAbsolute ? Math.abs(change) / thresholdBase : Math.abs(percentChange) / thresholdBase)
    : 1;

  const recentPoints = series.slice(-Math.min(series.length, 6));
  const confidence = scoreTrendConfidence(recentPoints, thresholdRatio, direction);
  const signalType = getSignalType(metricType, key, direction);
  const severity = triggered ? resolveSeverity(signalType, thresholdRatio, confidence) : 'low';

  const daysDiff = Math.max(0, Math.round((latest.date.getTime() - previous.date.getTime()) / (1000 * 60 * 60 * 24)));
  const unit = metricData?.unit || (metricType === 'vital' && ['bp', 'bloodpressure', 'blood_pressure'].includes(normalizeMetricKey(metricType, key)) ? 'mmHg' : '');
  const previousValue = formatMetricValue(metricType, key, previous);
  const latestValue = formatMetricValue(metricType, key, latest);
  const previousDate = toIsoDate(previous.date);
  const latestDate = toIsoDate(latest.date);

  const changeText = useAbsolute
    ? `${Math.abs(change).toFixed(1).replace(/\.0$/, '')}${unit ? ` ${unit}` : ''}`
    : `${Math.abs(percentChange).toFixed(1)}%`;

  const directionVerb = direction === 'up' ? 'increased' : 'decreased';
  const concernSuffix = signalType === 'concerning'
    ? ' This direction can be clinically important.'
    : signalType === 'improving'
      ? ' This direction may reflect improvement.'
      : '';

  const message = `${displayName} ${directionVerb} from ${previousValue}${unit && !previousValue.includes('/') ? ` ${unit}` : ''} (${previousDate || 'unknown date'}) to ${latestValue}${unit && !latestValue.includes('/') ? ` ${unit}` : ''} (${latestDate || 'unknown date'}) over ${daysDiff} day${daysDiff !== 1 ? 's' : ''} (${changeText}).${concernSuffix}`;

  const windowStart = toIsoDate(recentPoints[0]?.date);
  const insight = `AI confidence ${Math.round(confidence * 100)}% from ${recentPoints.length} recent data points (${windowStart || 'unknown'} to ${latestDate || 'unknown'}).`;
  const watchlistMessage = `${displayName} moved ${direction === 'up' ? 'up' : 'down'} ${useAbsolute ? changeText : `${Math.abs(percentChange).toFixed(1)}%`} from ${previousDate || 'unknown date'} to ${latestDate || 'unknown date'}.`;

  return {
    id: `${metricType}:${key}:${latestDate || 'unknown'}`,
    metricType,
    metricKey: normalizeMetricKey(metricType, key),
    metricName: displayName,
    type: direction,
    direction,
    signalType,
    severity,
    confidence,
    confidenceBucket: confidenceBucket(confidence),
    latestDate,
    previousDate,
    latestTimestamp: latest.date.getTime(),
    message,
    insight,
    change,
    percentChange,
    thresholdRatio,
    triggered,
    watchlistMessage,
    dataPointCount: series.length,
    telemetry: {
      metric_type: metricType,
      metric_key: normalizeMetricKey(metricType, key),
      trend_direction: direction,
      severity,
      signal_type: signalType,
      confidence_bucket: confidenceBucket(confidence),
      data_points_used: recentPoints.length,
      days_between_points: daysDiff
    }
  };
}

function collectMetrics({ labsData, vitalsData, patientProfile, hasRealLabData, hasRealVitalData }) {
  const metrics = [];
  const favoriteLabs = patientProfile?.favoriteMetrics?.labs || [];
  const favoriteVitals = patientProfile?.favoriteMetrics?.vitals || [];

  if (hasRealLabData) {
    const labKeys = favoriteLabs.length > 0
      ? favoriteLabs
      : Object.keys(labsData || {})
        .filter((key) => {
          const count = Array.isArray(labsData?.[key]?.data)
            ? labsData[key].data.length
            : (Array.isArray(labsData?.[key]?.values) ? labsData[key].values.length : 0);
          return count > 0;
        })
        .sort((a, b) => {
          const idxA = CRITICAL_LAB_ORDER.indexOf(String(a).toLowerCase());
          const idxB = CRITICAL_LAB_ORDER.indexOf(String(b).toLowerCase());
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          if (idxA !== -1) return -1;
          if (idxB !== -1) return 1;
          return 0;
        })
        .slice(0, 8);

    labKeys.forEach((key) => {
      const data = labsData?.[key];
      if (!data) return;
      metrics.push({ metricType: 'lab', key, data, displayName: getLabDisplayName(key) });
    });
  }

  if (hasRealVitalData) {
    const vitalKeys = favoriteVitals.length > 0
      ? favoriteVitals
      : Object.keys(vitalsData || {})
        .filter((key) => {
          const count = Array.isArray(vitalsData?.[key]?.data)
            ? vitalsData[key].data.length
            : (Array.isArray(vitalsData?.[key]?.values) ? vitalsData[key].values.length : 0);
          return count > 0;
        })
        .slice(0, 8);

    vitalKeys.forEach((key) => {
      const data = vitalsData?.[key];
      if (!data) return;
      metrics.push({ metricType: 'vital', key, data, displayName: getVitalDisplayName(key) });
    });
  }

  return metrics;
}

function getMetricRawCount(metric) {
  if (Array.isArray(metric?.data?.data)) return metric.data.data.length;
  if (Array.isArray(metric?.data?.values)) return metric.data.values.length;
  return 0;
}

export function buildTrendIntelligence({
  labsData,
  vitalsData,
  patientProfile,
  hasRealLabData,
  hasRealVitalData,
  maxAlerts = 8,
  maxWatchlist = 3
}) {
  const metrics = collectMetrics({ labsData, vitalsData, patientProfile, hasRealLabData, hasRealVitalData });
  const trackedMetricCount = metrics.length;
  const historyReadyCount = metrics.filter((metric) => getMetricRawCount(metric) >= 2).length;
  const evaluated = metrics
    .map((metric) => evaluateMetric(metric.metricType, metric.key, metric.data, metric.displayName))
    .filter(Boolean)
    .sort((a, b) => {
      if (b.latestTimestamp !== a.latestTimestamp) return b.latestTimestamp - a.latestTimestamp;
      return Math.abs(b.percentChange || 0) - Math.abs(a.percentChange || 0);
    });

  const alerts = evaluated
    .filter((candidate) => candidate.triggered)
    .sort((a, b) => {
      const severityDiff = (SEVERITY_WEIGHTS[b.severity] || 0) - (SEVERITY_WEIGHTS[a.severity] || 0);
      if (severityDiff !== 0) return severityDiff;
      if (b.latestTimestamp !== a.latestTimestamp) return b.latestTimestamp - a.latestTimestamp;
      return Math.abs(b.percentChange || 0) - Math.abs(a.percentChange || 0);
    })
    .slice(0, maxAlerts);

  const watchlist = alerts.length > 0
    ? []
    : evaluated
      .filter((candidate) => !candidate.triggered)
      .sort((a, b) => Math.abs(b.percentChange || 0) - Math.abs(a.percentChange || 0))
      .slice(0, maxWatchlist)
      .map((candidate) => ({
        id: candidate.id,
        metricName: candidate.metricName,
        direction: candidate.direction,
        latestDate: candidate.latestDate,
        previousDate: candidate.previousDate,
        percentChange: candidate.percentChange,
        message: candidate.watchlistMessage
      }));

  const summary = {
    totalAlerts: alerts.length,
    evaluatedCount: evaluated.length,
    watchlistCount: watchlist.length,
    trackedMetricCount,
    historyReadyCount,
    highPriorityCount: alerts.filter((alert) => alert.severity === 'high').length,
    concerningCount: alerts.filter((alert) => alert.signalType === 'concerning').length,
    improvingCount: alerts.filter((alert) => alert.signalType === 'improving').length,
    generatedAt: new Date().toISOString()
  };

  return { alerts, watchlist, summary };
}
