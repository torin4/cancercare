/**
 * PDF Report Service
 *
 * Generates a clinician-friendly PDF from the doctor summary payload.
 * Uses jsPDF for client-side generation.
 */

import { jsPDF } from 'jspdf';
import { categorizeLabs, normalizeVitalName, getLabDisplayName, getVitalDisplayName } from '../utils/normalizationUtils';

const MARGIN = 20;
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const LINE_HEIGHT = 6;
const SECTION_GAP = 8;
const FONT_SIZE_NORMAL = 10;
const FONT_SIZE_SMALL = 9;
const FONT_SIZE_HEADING = 12;

/**
 * Add text with wrapping and optional new page; returns new y position
 */
function addWrappedText(doc, text, x, y, maxWidth, options = {}) {
  const { fontSize = FONT_SIZE_NORMAL, lineHeight = LINE_HEIGHT } = options;
  doc.setFontSize(fontSize);
  const lines = doc.splitTextToSize(String(text || ''), maxWidth);
  for (const line of lines) {
    if (y > PAGE_HEIGHT - MARGIN - 15) {
      doc.addPage();
      y = MARGIN;
    }
    doc.text(line, x, y);
    y += lineHeight;
  }
  return y;
}

/**
 * Add a section heading; returns new y
 */
function addSectionHeading(doc, title, x, y) {
  if (y > PAGE_HEIGHT - MARGIN - 20) {
    doc.addPage();
    y = MARGIN;
  }
  doc.setFontSize(FONT_SIZE_HEADING);
  doc.setFont(undefined, 'bold');
  doc.text(title, x, y);
  y += LINE_HEIGHT + 2;
  doc.setFont(undefined, 'normal');
  doc.setFontSize(FONT_SIZE_NORMAL);
  return y;
}

function formatDateStr(isoOrDate) {
  if (!isoOrDate) return '';
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  return isNaN(d.getTime()) ? String(isoOrDate) : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * Parse a numeric value from lab/vital value (handles "120/80" as first number, or single number)
 */
function parseNumericValue(val) {
  if (val == null) return NaN;
  if (typeof val === 'number' && !Number.isNaN(val)) return val;
  const s = String(val).trim();
  if (s.includes('/')) {
    const n = parseFloat(s.split('/')[0]);
    return Number.isNaN(n) ? NaN : n;
  }
  const n = parseFloat(s);
  return Number.isNaN(n) ? NaN : n;
}

const CHART_PADDING = 4;
const CHART_LABEL_FONT = 7;
const MULTI_SERIES_CHART_HEIGHT = 48;

/** Lab category order for 11+ separate charts (matches app categories) */
const LAB_CATEGORY_ORDER = [
  'Disease-Specific Markers',
  'Blood Counts',
  'Kidney Function',
  'Liver Function',
  'Thyroid Function',
  'Cardiac Markers',
  'Inflammation',
  'Electrolytes',
  'Coagulation',
  'Custom Values',
  'Others'
];

/** Vital category map: canonical key -> display name. Order for 11+ separate charts. */
const VITAL_CATEGORY_MAP = {
  blood_pressure: 'Cardiovascular',
  heart_rate: 'Cardiovascular',
  oxygen_saturation: 'Respiratory',
  respiratory_rate: 'Respiratory',
  temperature: 'General',
  weight: 'Metabolic'
};
const VITAL_CATEGORY_ORDER = ['Cardiovascular', 'Respiratory', 'Metabolic', 'General'];

/** Distinct colors for up to 10 series (RGB) */
const CHART_COLORS = [
  [30, 64, 175],   // blue
  [5, 150, 105],   // emerald
  [194, 65, 12],   // orange
  [124, 58, 237],  // violet
  [0, 120, 212],   // blue
  [16, 185, 129],  // green
  [217, 119, 6],   // amber
  [139, 92, 246],  // purple
  [6, 95, 70],    // teal
  [185, 28, 28],  // red
];

/**
 * Draw a simple line chart: dates on X, values on Y. Returns new y position.
 */
function drawSimpleLineChart(doc, x, y, width, height, points, options = {}) {
  const { title = '', unit = '' } = options;
  if (!points || points.length === 0) return y;

  const sorted = [...points]
    .map((p) => ({
      date: typeof p.date === 'string' ? new Date(p.date) : p.date,
      value: typeof p.value === 'number' ? p.value : parseNumericValue(p.value)
    }))
    .filter((p) => !Number.isNaN(p.value) && p.date && !Number.isNaN(p.date.getTime()))
    .sort((a, b) => a.date - b.date);
  if (sorted.length === 0) return y;

  const minVal = Math.min(...sorted.map((p) => p.value));
  const maxVal = Math.max(...sorted.map((p) => p.value));
  const range = maxVal - minVal || 1;
  const padding = range * 0.05 || 1;
  const yMin = minVal - padding;
  const yMax = maxVal + padding;
  const yRange = yMax - yMin;

  doc.setFontSize(FONT_SIZE_SMALL);
  doc.setFont(undefined, 'bold');
  doc.text(title + (unit ? ` (${unit})` : ''), x, y + 4);
  doc.setFont(undefined, 'normal');
  const chartTop = y + LINE_HEIGHT;
  const chartBoxHeight = height - LINE_HEIGHT - 2;
  const chartLeft = x + CHART_PADDING;
  const chartBottom = chartTop + chartBoxHeight - CHART_PADDING;
  const plotLeft = chartLeft + 20;
  const plotRight = x + width - CHART_PADDING - 4;
  const plotTop = chartTop + 4;
  const plotBottom = chartBottom - 8;
  const plotWidth = plotRight - plotLeft;
  const plotHeight = plotBottom - plotTop;

  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.2);
  doc.rect(x, chartTop, width, chartBoxHeight);

  doc.setFontSize(CHART_LABEL_FONT);
  doc.setTextColor(80, 80, 80);
  doc.text(String(yMin.toFixed(1)), chartLeft, plotBottom + 3);
  doc.text(String(yMax.toFixed(1)), chartLeft, plotTop + 2);
  const firstDate = formatDateStr(sorted[0].date).replace(/,\s*\d{4}/, '');
  const lastDate = formatDateStr(sorted[sorted.length - 1].date).replace(/,\s*\d{4}/, '');
  doc.text(firstDate, plotLeft, plotBottom + 4);
  doc.text(lastDate, plotRight - doc.getTextWidth(lastDate), plotBottom + 4);
  doc.setTextColor(0, 0, 0);

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.25);
  const n = sorted.length;
  for (let i = 0; i < n - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    const xA = plotLeft + (i / Math.max(1, n - 1)) * plotWidth;
    const xB = plotLeft + ((i + 1) / Math.max(1, n - 1)) * plotWidth;
    const pyA = plotBottom - ((a.value - yMin) / yRange) * plotHeight;
    const pyB = plotBottom - ((b.value - yMin) / yRange) * plotHeight;
    doc.line(xA, pyA, xB, pyB);
  }
  sorted.forEach((p, i) => {
    const px = plotLeft + (i / Math.max(1, n - 1)) * plotWidth;
    const py = plotBottom - ((p.value - yMin) / yRange) * plotHeight;
    doc.circle(px, py, 0.6);
  });

  doc.setFontSize(FONT_SIZE_NORMAL);
  return chartTop + chartBoxHeight + 2;
}

/**
 * Draw multiple series on one chart (normalized Y per series, color-coded). Returns new y.
 * seriesArray: [{ name, unit, points: [{ date, value }] }, ...]
 */
function drawMultiSeriesChart(doc, x, y, width, height, seriesArray, title) {
  if (!seriesArray || seriesArray.length === 0) return y;

  const allPoints = seriesArray.flatMap((s) =>
    (s.points || [])
      .map((p) => ({
        date: typeof p.date === 'string' ? new Date(p.date) : p.date,
        value: typeof p.value === 'number' ? p.value : parseNumericValue(p.value)
      }))
      .filter((p) => !Number.isNaN(p.value) && p.date && !Number.isNaN(p.date.getTime()))
  );
  if (allPoints.length === 0) return y;

  const allDates = [...new Set(allPoints.map((p) => p.date.getTime()))].sort((a, b) => a - b).map((t) => new Date(t));
  const dateMin = allDates[0].getTime();
  const dateMax = allDates[allDates.length - 1].getTime();
  const dateRange = dateMax - dateMin || 1;

  const seriesWithSorted = seriesArray.map((s) => {
    const points = (s.points || [])
      .map((p) => ({
        date: typeof p.date === 'string' ? new Date(p.date) : p.date,
        value: typeof p.value === 'number' ? p.value : parseNumericValue(p.value)
      }))
      .filter((p) => !Number.isNaN(p.value) && p.date && !Number.isNaN(p.date.getTime()))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    const minV = points.length ? Math.min(...points.map((p) => p.value)) : 0;
    const maxV = points.length ? Math.max(...points.map((p) => p.value)) : 1;
    const vRange = maxV - minV || 1;
    return { name: s.name, unit: s.unit || '', points, minV, maxV, vRange };
  }).filter((s) => s.points.length > 0);
  if (seriesWithSorted.length === 0) return y;

  doc.setFontSize(FONT_SIZE_SMALL);
  doc.setFont(undefined, 'bold');
  doc.text(title, x, y + 4);
  doc.setFont(undefined, 'normal');
  const chartTop = y + LINE_HEIGHT;
  const chartBoxHeight = height - LINE_HEIGHT - 2;
  const plotLeft = x + CHART_PADDING + 22;
  const plotRight = x + width - CHART_PADDING - 4;
  const plotTop = chartTop + 4;
  const plotBottom = chartTop + chartBoxHeight - 18;
  const plotWidth = plotRight - plotLeft;
  const plotHeight = plotBottom - plotTop;

  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.2);
  doc.rect(x, chartTop, width, chartBoxHeight);

  doc.setFontSize(CHART_LABEL_FONT);
  doc.setTextColor(80, 80, 80);
  const firstDate = formatDateStr(allDates[0]).replace(/,\s*\d{4}/, '');
  const lastDate = formatDateStr(allDates[allDates.length - 1]).replace(/,\s*\d{4}/, '');
  doc.text(firstDate, plotLeft, plotBottom + 4);
  doc.text(lastDate, plotRight - doc.getTextWidth(lastDate), plotBottom + 4);
  doc.text('0%', x + CHART_PADDING, plotBottom + 2);
  doc.text('100%', x + CHART_PADDING, plotTop + 2);
  doc.setTextColor(0, 0, 0);

  seriesWithSorted.forEach((series, idx) => {
    const color = CHART_COLORS[idx % CHART_COLORS.length];
    doc.setDrawColor(color[0], color[1], color[2]);
    doc.setLineWidth(0.35);
    const pts = series.points;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const xA = plotLeft + ((a.date.getTime() - dateMin) / dateRange) * plotWidth;
      const xB = plotLeft + ((b.date.getTime() - dateMin) / dateRange) * plotWidth;
      const normA = series.vRange ? (a.value - series.minV) / series.vRange : 0;
      const normB = series.vRange ? (b.value - series.minV) / series.vRange : 0;
      const pyA = plotBottom - normA * plotHeight;
      const pyB = plotBottom - normB * plotHeight;
      doc.line(xA, pyA, xB, pyB);
    }
    pts.forEach((p) => {
      const px = plotLeft + ((p.date.getTime() - dateMin) / dateRange) * plotWidth;
      const norm = series.vRange ? (p.value - series.minV) / series.vRange : 0;
      const py = plotBottom - norm * plotHeight;
      doc.circle(px, py, 0.5);
    });
  });

  doc.setFontSize(CHART_LABEL_FONT);
  doc.setTextColor(0, 0, 0);
  let legendY = plotBottom + 10;
  seriesWithSorted.forEach((series, idx) => {
    const color = CHART_COLORS[idx % CHART_COLORS.length];
    doc.setDrawColor(color[0], color[1], color[2]);
    doc.setLineWidth(0.5);
    doc.line(x + CHART_PADDING, legendY - 1, x + CHART_PADDING + 6, legendY - 1);
    const label = `${series.name}: ${series.minV.toFixed(1)}–${series.maxV.toFixed(1)} ${series.unit}`.trim();
    doc.setTextColor(60, 60, 60);
    doc.text(label, x + CHART_PADDING + 8, legendY);
    doc.setTextColor(0, 0, 0);
    legendY += 3.5;
  });

  doc.setFontSize(FONT_SIZE_NORMAL);
  return chartTop + chartBoxHeight + 2;
}

/**
 * Generate PDF from doctor summary payload
 * @param {Object} summaryPayload - Result from exportDoctorSummary
 * @param {Object} [options] - { displayMode: 'list'|'graph' }
 * @returns {Blob} PDF blob
 */
export function generateDoctorSummaryPdf(summaryPayload, options = {}) {
  const displayMode = options.displayMode || 'list';
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const data = summaryPayload.data || {};
  let y = MARGIN;
  const x = MARGIN;
  const chartWidth = CONTENT_WIDTH;
  const chartHeight = 32;

  // Title and disclaimer
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text('CancerCare — Summary for Your Care Team', x, y);
  y += LINE_HEIGHT + 4;
  doc.setFont(undefined, 'normal');
  doc.setFontSize(FONT_SIZE_SMALL);

  const patientName =
    data.patientProfile &&
    [data.patientProfile.firstName, data.patientProfile.lastName].filter(Boolean).join(' ');
  const dob = data.patientProfile?.dateOfBirth ? formatDateStr(data.patientProfile.dateOfBirth) : '';
  doc.text(`Patient: ${patientName || '—'}${dob ? `  |  DOB: ${dob}` : ''}`, x, y);
  y += LINE_HEIGHT;
  doc.text(`Export date: ${formatDateStr(summaryPayload.exportedAt)}`, x, y);
  y += LINE_HEIGHT + 2;
  y = addWrappedText(
    doc,
    'Patient-generated summary from CancerCare. Not a substitute for official medical records.',
    x,
    y,
    CONTENT_WIDTH,
    { fontSize: FONT_SIZE_SMALL }
  );
  y += SECTION_GAP;

  // Demographics & care team
  if (data.patientProfile) {
    y = addSectionHeading(doc, 'Demographics & Care Team', x, y);
    const p = data.patientProfile;
    const lines = [];
    if (p.oncologist) lines.push(`Oncologist: ${p.oncologist}${p.oncologistPhone ? ` (${p.oncologistPhone})` : ''}`);
    if (p.hospital) lines.push(`Hospital/Clinic: ${p.hospital}`);
    if (p.clinicalTrialCoordinator) lines.push(`Trial Coordinator: ${p.clinicalTrialCoordinator}`);
    if (p.caregiverName) lines.push(`Caregiver: ${p.caregiverName}`);
    if (p.diagnosis || p.cancerType) lines.push(`Diagnosis: ${p.diagnosis || p.cancerType || '—'}`);
    if (p.stage) lines.push(`Stage: ${p.stage}`);
    if (p.currentRegimen) lines.push(`Current regimen: ${p.currentRegimen}`);
    if (lines.length === 0) lines.push('No demographics recorded.');
    for (const line of lines) {
      y = addWrappedText(doc, line, x, y, CONTENT_WIDTH);
    }
    y += SECTION_GAP;
  }

  // Labs — always graph + list together: for each marker, header → graph → list
  if (data.labs && data.labs.length > 0) {
    y = addSectionHeading(doc, 'Labs', x, y);
    const labsObj = {};
    data.labs.forEach((lab) => {
      let key = lab.labType || lab.name || lab.id;
      if (!key) key = lab.id;
      key = String(key).toLowerCase().replace(/\s+/g, '_');
      if (labsObj[key]) key = `${key}_${lab.id}`;
      labsObj[key] = lab;
    });
    const categorizedLabs = categorizeLabs(labsObj);
    for (const categoryName of LAB_CATEGORY_ORDER) {
      const entries = categorizedLabs[categoryName] || [];
      if (entries.length === 0) continue;
      if (y + LINE_HEIGHT + chartHeight > PAGE_HEIGHT - MARGIN - 15) {
        doc.addPage();
        y = MARGIN;
      }
      doc.setFontSize(FONT_SIZE_SMALL);
      doc.setFont(undefined, 'bold');
      doc.text(categoryName, x, y + 4);
      y += LINE_HEIGHT + 2;
      doc.setFont(undefined, 'normal');
      doc.setFontSize(FONT_SIZE_NORMAL);
      for (const [, lab] of entries) {
        const name = getLabDisplayName(lab.name || lab.labType || lab.id) || 'Lab';
        const unit = lab.unit || '';
        const ref = lab.normalRange ? ` (ref: ${lab.normalRange})` : '';
        const values = lab.values || [];
        const points = values.slice(0, 100).map((v) => ({
          date: v.date,
          value: v.systolic != null && v.diastolic != null ? Number(v.systolic) : parseNumericValue(v.value)
        })).filter((p) => p.date && !Number.isNaN(p.value));
        // Marker header
        if (y + LINE_HEIGHT > PAGE_HEIGHT - MARGIN - 15) {
          doc.addPage();
          y = MARGIN;
        }
        doc.setFontSize(FONT_SIZE_SMALL);
        doc.setFont(undefined, 'bold');
        doc.text(name + (unit ? ` (${unit})` : ''), x, y + 4);
        y += LINE_HEIGHT + 2;
        doc.setFont(undefined, 'normal');
        doc.setFontSize(FONT_SIZE_NORMAL);
        // Graph above list
        if (points.length > 0) {
          if (y + chartHeight > PAGE_HEIGHT - MARGIN - 15) {
            doc.addPage();
            y = MARGIN;
          }
          y = drawSimpleLineChart(doc, x, y, chartWidth, chartHeight, points, { title: '', unit: '' });
          y += SECTION_GAP + 4;
        }
        // List below graph
        const listValues = values.slice(0, 20);
        for (const v of listValues) {
          const date = formatDateStr(v.date);
          const val = v.value != null ? String(v.value) : '—';
          const status = v.status ? ` [${v.status}]` : '';
          y = addWrappedText(doc, `${date} — ${val} ${unit}${ref}${status}`, x, y, CONTENT_WIDTH, { fontSize: FONT_SIZE_SMALL });
        }
        if (values.length > 20) {
          y = addWrappedText(doc, `... and ${values.length - 20} more values`, x, y, CONTENT_WIDTH, { fontSize: FONT_SIZE_SMALL });
        }
        y += 2;
      }
    }
    y += SECTION_GAP;
  }

  // Vitals — always graph + list together: for each marker, header → graph → list
  if (data.vitals && data.vitals.length > 0) {
    y = addSectionHeading(doc, 'Vital Signs', x, y);
    const vitalsByCategory = {};
    data.vitals.forEach((vital) => {
      const canonicalKey = normalizeVitalName(vital.vitalType || vital.name || vital.id) || (vital.vitalType || vital.name || vital.id || '').toString().toLowerCase();
      const category = VITAL_CATEGORY_MAP[canonicalKey] || 'General';
      if (!vitalsByCategory[category]) vitalsByCategory[category] = [];
      vitalsByCategory[category].push(vital);
    });
    for (const categoryName of VITAL_CATEGORY_ORDER) {
      const vitalsInCategory = vitalsByCategory[categoryName] || [];
      if (vitalsInCategory.length === 0) continue;
      if (y + LINE_HEIGHT + chartHeight > PAGE_HEIGHT - MARGIN - 15) {
        doc.addPage();
        y = MARGIN;
      }
      doc.setFontSize(FONT_SIZE_SMALL);
      doc.setFont(undefined, 'bold');
      doc.text(categoryName, x, y + 4);
      y += LINE_HEIGHT + 2;
      doc.setFont(undefined, 'normal');
      doc.setFontSize(FONT_SIZE_NORMAL);
      for (const vital of vitalsInCategory) {
        const name = getVitalDisplayName(vital.name || vital.vitalType || vital.id) || 'Vital';
        const unit = vital.unit || '';
        const values = vital.values || [];
        const points = values.slice(0, 100).map((v) => {
          const date = v.date || v.dateTime;
          const val = v.systolic != null && v.diastolic != null ? Number(v.systolic) : parseNumericValue(v.value);
          return { date, value: val };
        }).filter((p) => p.date && !Number.isNaN(p.value));
        // Marker header
        if (y + LINE_HEIGHT > PAGE_HEIGHT - MARGIN - 15) {
          doc.addPage();
          y = MARGIN;
        }
        doc.setFontSize(FONT_SIZE_SMALL);
        doc.setFont(undefined, 'bold');
        doc.text(name + (unit ? ` (${unit})` : ''), x, y + 4);
        y += LINE_HEIGHT + 2;
        doc.setFont(undefined, 'normal');
        doc.setFontSize(FONT_SIZE_NORMAL);
        // Graph above list
        if (points.length > 0) {
          if (y + chartHeight > PAGE_HEIGHT - MARGIN - 15) {
            doc.addPage();
            y = MARGIN;
          }
          y = drawSimpleLineChart(doc, x, y, chartWidth, chartHeight, points, { title: '', unit: '' });
          y += SECTION_GAP + 4;
        }
        // List below graph
        const listValues = values.slice(0, 20);
        for (const v of listValues) {
          const date = formatDateStr(v.date || v.dateTime);
          const val = v.systolic != null && v.diastolic != null ? `${v.systolic}/${v.diastolic}` : (v.value != null ? String(v.value) : '—');
          y = addWrappedText(doc, `${date} — ${val} ${unit}`, x, y, CONTENT_WIDTH, { fontSize: FONT_SIZE_SMALL });
        }
        if (values.length > 20) {
          y = addWrappedText(doc, `... and ${values.length - 20} more values`, x, y, CONTENT_WIDTH, { fontSize: FONT_SIZE_SMALL });
        }
        y += 2;
      }
    }
    y += SECTION_GAP;
  }

  // Medications
  if (data.medications && data.medications.length > 0) {
    y = addSectionHeading(doc, 'Medications', x, y);
    for (const med of data.medications) {
      y = addWrappedText(doc, `• ${med.name}${med.dosage ? ` — ${med.dosage}` : ''}`, x, y, CONTENT_WIDTH);
    }
    if (data.medicationLogs && data.medicationLogs.length > 0) {
      y += 2;
      doc.setFont(undefined, 'bold');
      y = addWrappedText(doc, 'Recent logs (taken)', x, y, CONTENT_WIDTH, { fontSize: FONT_SIZE_SMALL });
      doc.setFont(undefined, 'normal');
      for (const log of data.medicationLogs.slice(0, 15)) {
        const d = formatDateStr(log.takenAt || log.createdAt);
        y = addWrappedText(doc, `${d} — ${log.medicationName || 'Medication'}`, x, y, CONTENT_WIDTH, { fontSize: FONT_SIZE_SMALL });
      }
      if (data.medicationLogs.length > 15) {
        y = addWrappedText(doc, `... and ${data.medicationLogs.length - 15} more`, x, y, CONTENT_WIDTH, { fontSize: FONT_SIZE_SMALL });
      }
    }
    y += SECTION_GAP;
  }

  // Symptoms
  if (data.symptoms && data.symptoms.length > 0) {
    y = addSectionHeading(doc, 'Symptoms', x, y);
    for (const s of data.symptoms.slice(0, 50)) {
      const date = formatDateStr(s.date);
      const sev = s.severity ? ` (${s.severity})` : '';
      y = addWrappedText(doc, `${date} — ${s.name || s.symptomName || 'Symptom'}${sev}${s.notes ? `: ${s.notes}` : ''}`, x, y, CONTENT_WIDTH, { fontSize: FONT_SIZE_SMALL });
    }
    if (data.symptoms.length > 50) {
      y = addWrappedText(doc, `... and ${data.symptoms.length - 50} more entries`, x, y, CONTENT_WIDTH, { fontSize: FONT_SIZE_SMALL });
    }
    y += SECTION_GAP;
  }

  // Journal notes (if included)
  if (data.journalNotes && data.journalNotes.length > 0) {
    y = addSectionHeading(doc, 'Journal Notes', x, y);
    for (const n of data.journalNotes.slice(0, 20)) {
      const date = formatDateStr(n.date);
      const content = (n.content || n.text || '').slice(0, 200);
      y = addWrappedText(doc, `${date}: ${content}${(n.content || n.text || '').length > 200 ? '...' : ''}`, x, y, CONTENT_WIDTH, { fontSize: FONT_SIZE_SMALL });
    }
    if (data.journalNotes.length > 20) {
      y = addWrappedText(doc, `... and ${data.journalNotes.length - 20} more`, x, y, CONTENT_WIDTH, { fontSize: FONT_SIZE_SMALL });
    }
    y += SECTION_GAP;
  }

  // Genomic summary
  if (data.genomicProfile) {
    y = addSectionHeading(doc, 'Genomic Summary', x, y);
    const g = data.genomicProfile;
    const glines = [];
    if (g.testInfo?.testName) glines.push(`Test: ${g.testInfo.testName}`);
    if (g.mutations && g.mutations.length > 0) {
      glines.push('Mutations:');
      g.mutations.slice(0, 15).forEach((m) => {
        glines.push(`  • ${m.gene}: ${m.alteration || m.significance || ''}${m.fdaApprovedTherapy ? ` → ${m.fdaApprovedTherapy}` : ''}`);
      });
      if (g.mutations.length > 15) glines.push(`  ... and ${g.mutations.length - 15} more`);
    }
    if (g.biomarkers) {
      const b = g.biomarkers;
      if (b.tumorMutationalBurden) glines.push(`TMB: ${b.tumorMutationalBurden.value || ''} ${b.tumorMutationalBurden.unit || ''} (${b.tumorMutationalBurden.interpretation || ''})`);
      if (b.microsatelliteInstability) glines.push(`MSI: ${b.microsatelliteInstability.status || ''}`);
      if (b.hrdScore) glines.push(`HRD: ${b.hrdScore.value} (${b.hrdScore.interpretation || ''})`);
    }
    if (g.fdaApprovedTherapies && g.fdaApprovedTherapies.length > 0) {
      glines.push(`FDA-approved options: ${g.fdaApprovedTherapies.join(', ')}`);
    }
    if (g.germlineFindings && g.germlineFindings.length > 0) {
      glines.push(`Germline: ${g.germlineFindings.map((f) => f.gene).join(', ')} (genetic counseling recommended)`);
    }
    if (glines.length === 0) glines.push('No genomic data in this export.');
    for (const line of glines) {
      y = addWrappedText(doc, line, x, y, CONTENT_WIDTH, { fontSize: FONT_SIZE_SMALL });
    }
    y += SECTION_GAP;
  }

  // Documents list
  if (data.documents && data.documents.length > 0) {
    y = addSectionHeading(doc, 'Documents', x, y);
    for (const d of data.documents) {
      const date = formatDateStr(d.date);
      const name = d.name || d.fileName || d.id || 'Document';
      y = addWrappedText(doc, `• ${date} — ${name}`, x, y, CONTENT_WIDTH, { fontSize: FONT_SIZE_SMALL });
      if (d.extractionSummary && typeof d.extractionSummary === 'string') {
        y = addWrappedText(doc, d.extractionSummary.slice(0, 150) + (d.extractionSummary.length > 150 ? '...' : ''), x + 5, y, CONTENT_WIDTH - 5, { fontSize: FONT_SIZE_SMALL });
      }
    }
  }

  return doc.output('blob');
}
