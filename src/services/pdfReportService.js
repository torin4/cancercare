/**
 * PDF Report Service
 *
 * Generates a clinician-friendly PDF from the doctor summary payload.
 * Uses jsPDF for client-side generation.
 */

import { jsPDF } from 'jspdf';
import { categorizeLabs, normalizeVitalName, getLabDisplayName, getVitalDisplayName } from '../utils/normalizationUtils';
import { parseDaysOfWeekFrequency } from '../utils/helpers';
import logger from '../utils/logger';

const MARGIN = 20;
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const LINE_HEIGHT = 6;
const SECTION_GAP = 8;
const FONT_SIZE_NORMAL = 10;
const FONT_SIZE_SMALL = 9;
const FONT_SIZE_HEADING = 12;

// ---------------------------------------------------------------------------
// Report language — all static labels in English and Japanese.
// Patient-entered data (med names, notes, etc.) is rendered as stored.
// ---------------------------------------------------------------------------
const PDF_STRINGS = {
  en: {
    lang: 'en',
    locale: 'en-US',
    title: 'CancerCare — Summary for Your Care Team',
    patient: 'Patient',
    dob: 'DOB',
    exportDate: 'Export date',
    disclaimer: 'Patient-generated summary from CancerCare. Not a substitute for official medical records.',
    demographics: 'Demographics & Care Team',
    oncologist: 'Oncologist',
    hospital: 'Hospital/Clinic',
    trialCoordinator: 'Trial Coordinator',
    caregiver: 'Caregiver',
    diagnosis: 'Diagnosis',
    stage: 'Stage',
    currentRegimen: 'Current regimen',
    noDemographics: 'No demographics recorded.',
    labs: 'Labs',
    vitals: 'Vital Signs',
    medications: 'Medications',
    medsScheduleHeading: 'Current medications — daily schedule',
    medsCurrentHeading: 'Current medications',
    medsOtherHeading: 'Other current medications (no fixed time)',
    medsInactiveHeading: 'Paused / stopped medications',
    medsLogsHeading: 'Recent logs (taken)',
    medicationCol: 'Medication',
    morning: 'Morning',
    afternoon: 'Afternoon',
    evening: 'Evening',
    night: 'Night',
    pausedTag: ' [paused]',
    stoppedTag: ' [stopped]',
    medicationFallback: 'Medication',
    symptoms: 'Symptoms',
    symptomFallback: 'Symptom',
    journalNotes: 'Journal Notes',
    genomic: 'Genomic Summary',
    genomicTest: 'Test',
    genomicMutations: 'Mutations:',
    genomicFdaOptions: 'FDA-approved options',
    genomicGermline: 'Germline',
    genomicCounseling: 'genetic counseling recommended',
    noGenomic: 'No genomic data in this export.',
    documents: 'Documents',
    documentFallback: 'Document',
    ref: 'ref',
    andMore: (n) => `... and ${n} more`,
    andMoreValues: (n) => `... and ${n} more values`,
    andMoreEntries: (n) => `... and ${n} more entries`
  },
  ja: {
    lang: 'ja',
    locale: 'ja-JP',
    title: 'CancerCare — 医療チーム向けサマリー',
    patient: '患者',
    dob: '生年月日',
    exportDate: '出力日',
    disclaimer: 'CancerCareで患者が作成したサマリーです。正式な医療記録の代わりとなるものではありません。',
    demographics: '患者情報・医療チーム',
    oncologist: '担当医（腫瘍科）',
    hospital: '病院・クリニック',
    trialCoordinator: '治験コーディネーター',
    caregiver: '介護者',
    diagnosis: '診断',
    stage: '病期',
    currentRegimen: '現在の治療レジメン',
    noDemographics: '患者情報の記録がありません。',
    labs: '検査値',
    vitals: 'バイタルサイン',
    medications: 'お薬',
    medsScheduleHeading: '現在服用中の薬 — 1日のスケジュール',
    medsCurrentHeading: '現在服用中の薬',
    medsOtherHeading: 'その他の服用中の薬（時間指定なし）',
    medsInactiveHeading: '休薬中・中止した薬',
    medsLogsHeading: '服薬記録（服用済み）',
    medicationCol: '薬剤名',
    morning: '朝',
    afternoon: '昼',
    evening: '夕',
    night: '就寝前',
    pausedTag: '【休薬中】',
    stoppedTag: '【中止】',
    medicationFallback: '薬剤',
    symptoms: '症状',
    symptomFallback: '症状',
    journalNotes: '記録ノート',
    genomic: '遺伝子検査サマリー',
    genomicTest: '検査名',
    genomicMutations: '遺伝子変異:',
    genomicFdaOptions: 'FDA承認の治療選択肢',
    genomicGermline: '生殖細胞系列',
    genomicCounseling: '遺伝カウンセリング推奨',
    noGenomic: 'この出力に遺伝子データはありません。',
    documents: '書類',
    documentFallback: '書類',
    ref: '基準値',
    andMore: (n) => `…ほか${n}件`,
    andMoreValues: (n) => `…ほか${n}件`,
    andMoreEntries: (n) => `…ほか${n}件`
  }
};

/** Known frequency strings → Japanese */
const FREQUENCY_JA = {
  'Once daily': '1日1回',
  'Twice daily': '1日2回',
  'Three times daily': '1日3回',
  'Four times daily': '1日4回',
  'Every other day': '隔日',
  'Weekly': '週1回',
  'Every 2 weeks': '2週間ごと',
  'Every 3 weeks': '3週間ごと',
  'Monthly': '月1回',
  'As needed': '頓用',
  'Custom': 'カスタム'
};

const JA_DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];

/** Translate a stored frequency string for display (no-op for English) */
function translateFrequency(freq, L) {
  if (!freq || L.lang !== 'ja') return freq;
  const days = parseDaysOfWeekFrequency(freq);
  if (days) {
    // Mon-first display order, e.g. 月・水・金
    return [1, 2, 3, 4, 5, 6, 0].filter((i) => days.includes(i)).map((i) => JA_DAY_NAMES[i]).join('・');
  }
  return FREQUENCY_JA[freq] || freq;
}

// Locale used by formatDateStr; set per-export from the selected language
let currentDateLocale = 'en-US';

// Unicode font (CJK support) — jsPDF's built-in fonts only cover Latin-1, so
// Japanese medication names etc. render as garbage without an embedded font.
const PDF_FONT = 'NotoSansJP';
let jpFontsPromise = null;

async function fetchFontBase64(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Font fetch failed (${res.status}): ${url}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Load Noto Sans JP (regular + bold) once and cache; returns null on failure */
function loadUnicodeFonts() {
  if (!jpFontsPromise) {
    const base = process.env.PUBLIC_URL || '';
    jpFontsPromise = Promise.all([
      fetchFontBase64(`${base}/fonts/NotoSansJP-Regular.ttf`),
      fetchFontBase64(`${base}/fonts/NotoSansJP-Bold.ttf`)
    ])
      .then(([regular, bold]) => ({ regular, bold }))
      .catch((err) => {
        logger.error('PDF font load failed; falling back to built-in fonts (non-Latin text may garble)', err);
        jpFontsPromise = null; // allow retry on next export
        return null;
      });
  }
  return jpFontsPromise;
}

/** Register the Unicode font on a jsPDF doc and make it the active font */
async function applyUnicodeFont(doc) {
  const fonts = await loadUnicodeFonts();
  if (!fonts) return;
  doc.addFileToVFS('NotoSansJP-Regular.ttf', fonts.regular);
  doc.addFont('NotoSansJP-Regular.ttf', PDF_FONT, 'normal');
  doc.addFileToVFS('NotoSansJP-Bold.ttf', fonts.bold);
  doc.addFont('NotoSansJP-Bold.ttf', PDF_FONT, 'bold');
  doc.setFont(PDF_FONT, 'normal');
}

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

/** Time-of-day slots for the medication schedule table (matches the app's tracker) */
const MED_TIME_SLOTS = [
  { key: 'morning', label: 'Morning' },     // before 12:00 PM
  { key: 'afternoon', label: 'Afternoon' }, // 12:00 PM – 4:59 PM
  { key: 'evening', label: 'Evening' },     // 5:00 PM – 8:59 PM
  { key: 'night', label: 'Night' }          // 9:00 PM onward
];

/** Parse a "8:00 AM" / "14:00" style time into minutes since midnight */
function medTimeToMinutes(timeStr) {
  const m = String(timeStr || '').trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!m) return null;
  let hour = parseInt(m[1], 10);
  const minute = parseInt(m[2], 10);
  const period = m[3] ? m[3].toUpperCase() : null;
  if (period === 'PM' && hour !== 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;
  return hour * 60 + minute;
}

function medSlotKey(timeStr) {
  const minutes = medTimeToMinutes(timeStr);
  if (minutes === null) return null;
  if (minutes < 12 * 60) return 'morning';
  if (minutes < 17 * 60) return 'afternoon';
  if (minutes < 21 * 60) return 'evening';
  return 'night';
}

/**
 * Draw the current medications as a daily schedule grid:
 * rows = medications, columns = Morning/Afternoon/Evening/Night,
 * cells = dose + exact time. Returns new y.
 */
function drawMedicationScheduleTable(doc, meds, x, y, L) {
  const medColWidth = 62;
  const slotColWidth = (CONTENT_WIDTH - medColWidth) / MED_TIME_SLOTS.length;
  const pad = 1.6;
  const cellLineHeight = 3.6;
  const headerHeight = 7;
  const textTopOffset = pad + 2.6;

  const drawHeader = (yy) => {
    doc.setFillColor(243, 244, 246);
    doc.rect(x, yy, CONTENT_WIDTH, headerHeight, 'F');
    doc.rect(x, yy, medColWidth, headerHeight);
    MED_TIME_SLOTS.forEach((slot, i) => {
      doc.rect(x + medColWidth + i * slotColWidth, yy, slotColWidth, headerHeight);
    });
    doc.setFontSize(8);
    doc.setFont(undefined, 'bold');
    doc.text(L.medicationCol, x + pad, yy + headerHeight - 2.4);
    MED_TIME_SLOTS.forEach((slot, i) => {
      doc.text(L[slot.key], x + medColWidth + i * slotColWidth + slotColWidth / 2, yy + headerHeight - 2.4, { align: 'center' });
    });
    doc.setFont(undefined, 'normal');
    return yy + headerHeight;
  };

  doc.setDrawColor(180, 180, 180);
  if (y + headerHeight + 14 > PAGE_HEIGHT - MARGIN) {
    doc.addPage();
    y = MARGIN;
  }
  y = drawHeader(y);
  doc.setFontSize(8);

  for (const med of meds) {
    const times = String(med.schedule || '')
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.includes(':'));

    // Cell entries per slot: dose (dark) + exact time (gray) for each scheduled dose
    const slotEntries = MED_TIME_SLOTS.map((slot) => {
      const inSlot = times
        .filter((t) => medSlotKey(t) === slot.key)
        .sort((a, b) => (medTimeToMinutes(a) || 0) - (medTimeToMinutes(b) || 0));
      const entries = [];
      for (const t of inSlot) {
        if (med.dosage) {
          for (const line of doc.splitTextToSize(String(med.dosage), slotColWidth - pad * 2)) {
            entries.push({ text: line, gray: false });
          }
          entries.push({ text: t, gray: true });
        } else {
          entries.push({ text: t, gray: false });
        }
      }
      return entries;
    });

    const nameLines = doc.splitTextToSize(String(med.name || ''), medColWidth - pad * 2);
    const displayFrequency = translateFrequency(med.frequency, L);
    const freqLines = displayFrequency ? doc.splitTextToSize(String(displayFrequency), medColWidth - pad * 2) : [];
    const maxLines = Math.max(nameLines.length + freqLines.length, ...slotEntries.map((e) => e.length || 1));
    const rowHeight = maxLines * cellLineHeight + pad * 2;

    if (y + rowHeight > PAGE_HEIGHT - MARGIN - 5) {
      doc.addPage();
      y = MARGIN;
      y = drawHeader(y);
      doc.setFontSize(8);
    }

    // Cell borders
    doc.rect(x, y, medColWidth, rowHeight);
    MED_TIME_SLOTS.forEach((slot, i) => {
      doc.rect(x + medColWidth + i * slotColWidth, y, slotColWidth, rowHeight);
    });

    // Medication cell: name, then frequency in gray
    let ty = y + textTopOffset;
    for (const line of nameLines) {
      doc.text(line, x + pad, ty);
      ty += cellLineHeight;
    }
    if (freqLines.length > 0) {
      doc.setTextColor(120, 120, 120);
      for (const line of freqLines) {
        doc.text(line, x + pad, ty);
        ty += cellLineHeight;
      }
      doc.setTextColor(0, 0, 0);
    }

    // Time slot cells
    MED_TIME_SLOTS.forEach((slot, i) => {
      const cx = x + medColWidth + i * slotColWidth + slotColWidth / 2;
      const entries = slotEntries[i];
      let cy = y + textTopOffset;
      if (entries.length === 0) {
        doc.setTextColor(190, 190, 190);
        doc.text('—', cx, cy, { align: 'center' });
        doc.setTextColor(0, 0, 0);
      } else {
        for (const entry of entries) {
          if (entry.gray) doc.setTextColor(120, 120, 120);
          doc.text(entry.text, cx, cy, { align: 'center' });
          if (entry.gray) doc.setTextColor(0, 0, 0);
          cy += cellLineHeight;
        }
      }
    });

    y += rowHeight;
  }

  doc.setFontSize(FONT_SIZE_NORMAL);
  return y + 4;
}

function formatDateStr(isoOrDate) {
  if (!isoOrDate) return '';
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  return isNaN(d.getTime()) ? String(isoOrDate) : d.toLocaleDateString(currentDateLocale, { year: 'numeric', month: 'short', day: 'numeric' });
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
 * @param {Object} [options] - { displayMode: 'list'|'graph', language: 'en'|'ja' }
 * @returns {Promise<Blob>} PDF blob
 */
export async function generateDoctorSummaryPdf(summaryPayload, options = {}) {
  const displayMode = options.displayMode || 'list';
  const L = PDF_STRINGS[options.language === 'ja' ? 'ja' : 'en'];
  currentDateLocale = L.locale;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  await applyUnicodeFont(doc);
  const data = summaryPayload.data || {};
  let y = MARGIN;
  const x = MARGIN;
  const chartWidth = CONTENT_WIDTH;
  const chartHeight = 32;

  // Title and disclaimer
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text(L.title, x, y);
  y += LINE_HEIGHT + 4;
  doc.setFont(undefined, 'normal');
  doc.setFontSize(FONT_SIZE_SMALL);

  const patientName =
    data.patientProfile &&
    [data.patientProfile.firstName, data.patientProfile.lastName].filter(Boolean).join(' ');
  const dob = data.patientProfile?.dateOfBirth ? formatDateStr(data.patientProfile.dateOfBirth) : '';
  doc.text(`${L.patient}: ${patientName || '—'}${dob ? `  |  ${L.dob}: ${dob}` : ''}`, x, y);
  y += LINE_HEIGHT;
  doc.text(`${L.exportDate}: ${formatDateStr(summaryPayload.exportedAt)}`, x, y);
  y += LINE_HEIGHT + 2;
  y = addWrappedText(
    doc,
    L.disclaimer,
    x,
    y,
    CONTENT_WIDTH,
    { fontSize: FONT_SIZE_SMALL }
  );
  y += SECTION_GAP;

  // Demographics & care team
  if (data.patientProfile) {
    y = addSectionHeading(doc, L.demographics, x, y);
    const p = data.patientProfile;
    const lines = [];
    if (p.oncologist) lines.push(`${L.oncologist}: ${p.oncologist}${p.oncologistPhone ? ` (${p.oncologistPhone})` : ''}`);
    if (p.hospital) lines.push(`${L.hospital}: ${p.hospital}`);
    if (p.clinicalTrialCoordinator) lines.push(`${L.trialCoordinator}: ${p.clinicalTrialCoordinator}`);
    if (p.caregiverName) lines.push(`${L.caregiver}: ${p.caregiverName}`);
    if (p.diagnosis || p.cancerType) lines.push(`${L.diagnosis}: ${p.diagnosis || p.cancerType || '—'}`);
    if (p.stage) lines.push(`${L.stage}: ${p.stage}`);
    if (p.currentRegimen) lines.push(`${L.currentRegimen}: ${p.currentRegimen}`);
    if (lines.length === 0) lines.push(L.noDemographics);
    for (const line of lines) {
      y = addWrappedText(doc, line, x, y, CONTENT_WIDTH);
    }
    y += SECTION_GAP;
  }

  // Labs — always graph + list together: for each marker, header → graph → list
  if (data.labs && data.labs.length > 0) {
    y = addSectionHeading(doc, L.labs, x, y);
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
        const ref = lab.normalRange ? ` (${L.ref}: ${lab.normalRange})` : '';
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
          y = addWrappedText(doc, L.andMoreValues(values.length - 20), x, y, CONTENT_WIDTH, { fontSize: FONT_SIZE_SMALL });
        }
        y += 2;
      }
    }
    y += SECTION_GAP;
  }

  // Vitals — always graph + list together: for each marker, header → graph → list
  if (data.vitals && data.vitals.length > 0) {
    y = addSectionHeading(doc, L.vitals, x, y);
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
          y = addWrappedText(doc, L.andMoreValues(values.length - 20), x, y, CONTENT_WIDTH, { fontSize: FONT_SIZE_SMALL });
        }
        y += 2;
      }
    }
    y += SECTION_GAP;
  }

  // Medications — list and taken-dose log are independently includable
  const medsList = data.medications || [];
  const medLogs = data.medicationLogs || [];
  if (medsList.length > 0 || medLogs.length > 0) {
    y = addSectionHeading(doc, L.medications, x, y);

    if (medsList.length > 0) {
      const medStatus = (m) => m.status || (m.active === false ? 'paused' : 'active');
      const medLine = (m) => {
        const details = [m.dosage, translateFrequency(m.frequency, L)].filter(Boolean).join(', ');
        const status = medStatus(m);
        const tag = status === 'paused' ? L.pausedTag : status === 'stopped' ? L.stoppedTag : '';
        return `• ${m.name}${details ? ` — ${details}` : ''}${tag}`;
      };
      const currentMeds = medsList.filter((m) => medStatus(m) === 'active');
      const inactiveMeds = medsList.filter((m) => medStatus(m) !== 'active');
      const hasTimedSchedule = (m) => typeof m.schedule === 'string' && m.schedule.includes(':');
      const scheduledMeds = currentMeds.filter(hasTimedSchedule);
      const unscheduledMeds = currentMeds.filter((m) => !hasTimedSchedule(m));
      if (scheduledMeds.length > 0) {
        doc.setFont(undefined, 'bold');
        y = addWrappedText(doc, L.medsScheduleHeading, x, y, CONTENT_WIDTH, { fontSize: FONT_SIZE_SMALL });
        doc.setFont(undefined, 'normal');
        y = drawMedicationScheduleTable(doc, scheduledMeds, x, y, L);
      }
      if (unscheduledMeds.length > 0) {
        doc.setFont(undefined, 'bold');
        y = addWrappedText(
          doc,
          scheduledMeds.length > 0 ? L.medsOtherHeading : L.medsCurrentHeading,
          x, y, CONTENT_WIDTH, { fontSize: FONT_SIZE_SMALL }
        );
        doc.setFont(undefined, 'normal');
        for (const med of unscheduledMeds) {
          y = addWrappedText(doc, medLine(med), x, y, CONTENT_WIDTH);
        }
      }
      if (inactiveMeds.length > 0) {
        y += 2;
        doc.setFont(undefined, 'bold');
        y = addWrappedText(doc, L.medsInactiveHeading, x, y, CONTENT_WIDTH, { fontSize: FONT_SIZE_SMALL });
        doc.setFont(undefined, 'normal');
        for (const med of inactiveMeds) {
          y = addWrappedText(doc, medLine(med), x, y, CONTENT_WIDTH);
        }
      }
    }

    if (medLogs.length > 0) {
      y += 2;
      doc.setFont(undefined, 'bold');
      y = addWrappedText(doc, L.medsLogsHeading, x, y, CONTENT_WIDTH, { fontSize: FONT_SIZE_SMALL });
      doc.setFont(undefined, 'normal');
      for (const log of medLogs.slice(0, 15)) {
        const d = formatDateStr(log.takenAt || log.createdAt);
        y = addWrappedText(doc, `${d} — ${log.medicationName || L.medicationFallback}`, x, y, CONTENT_WIDTH, { fontSize: FONT_SIZE_SMALL });
      }
      if (medLogs.length > 15) {
        y = addWrappedText(doc, L.andMore(medLogs.length - 15), x, y, CONTENT_WIDTH, { fontSize: FONT_SIZE_SMALL });
      }
    }
    y += SECTION_GAP;
  }

  // Symptoms
  if (data.symptoms && data.symptoms.length > 0) {
    y = addSectionHeading(doc, L.symptoms, x, y);
    for (const s of data.symptoms.slice(0, 50)) {
      const date = formatDateStr(s.date);
      const sev = s.severity ? ` (${s.severity})` : '';
      y = addWrappedText(doc, `${date} — ${s.name || s.symptomName || L.symptomFallback}${sev}${s.notes ? `: ${s.notes}` : ''}`, x, y, CONTENT_WIDTH, { fontSize: FONT_SIZE_SMALL });
    }
    if (data.symptoms.length > 50) {
      y = addWrappedText(doc, L.andMoreEntries(data.symptoms.length - 50), x, y, CONTENT_WIDTH, { fontSize: FONT_SIZE_SMALL });
    }
    y += SECTION_GAP;
  }

  // Journal notes (if included)
  if (data.journalNotes && data.journalNotes.length > 0) {
    y = addSectionHeading(doc, L.journalNotes, x, y);
    for (const n of data.journalNotes.slice(0, 20)) {
      const date = formatDateStr(n.date);
      const content = (n.content || n.text || '').slice(0, 200);
      y = addWrappedText(doc, `${date}: ${content}${(n.content || n.text || '').length > 200 ? '...' : ''}`, x, y, CONTENT_WIDTH, { fontSize: FONT_SIZE_SMALL });
    }
    if (data.journalNotes.length > 20) {
      y = addWrappedText(doc, L.andMore(data.journalNotes.length - 20), x, y, CONTENT_WIDTH, { fontSize: FONT_SIZE_SMALL });
    }
    y += SECTION_GAP;
  }

  // Genomic summary
  if (data.genomicProfile) {
    y = addSectionHeading(doc, L.genomic, x, y);
    const g = data.genomicProfile;
    const glines = [];
    if (g.testInfo?.testName) glines.push(`${L.genomicTest}: ${g.testInfo.testName}`);
    if (g.mutations && g.mutations.length > 0) {
      glines.push(L.genomicMutations);
      g.mutations.slice(0, 15).forEach((m) => {
        glines.push(`  • ${m.gene}: ${m.alteration || m.significance || ''}${m.fdaApprovedTherapy ? ` → ${m.fdaApprovedTherapy}` : ''}`);
      });
      if (g.mutations.length > 15) glines.push(`  ${L.andMore(g.mutations.length - 15)}`);
    }
    if (g.biomarkers) {
      const b = g.biomarkers;
      if (b.tumorMutationalBurden) glines.push(`TMB: ${b.tumorMutationalBurden.value || ''} ${b.tumorMutationalBurden.unit || ''} (${b.tumorMutationalBurden.interpretation || ''})`);
      if (b.microsatelliteInstability) glines.push(`MSI: ${b.microsatelliteInstability.status || ''}`);
      if (b.hrdScore) glines.push(`HRD: ${b.hrdScore.value} (${b.hrdScore.interpretation || ''})`);
    }
    if (g.fdaApprovedTherapies && g.fdaApprovedTherapies.length > 0) {
      glines.push(`${L.genomicFdaOptions}: ${g.fdaApprovedTherapies.join(', ')}`);
    }
    if (g.germlineFindings && g.germlineFindings.length > 0) {
      glines.push(`${L.genomicGermline}: ${g.germlineFindings.map((f) => f.gene).join(', ')} (${L.genomicCounseling})`);
    }
    if (glines.length === 0) glines.push(L.noGenomic);
    for (const line of glines) {
      y = addWrappedText(doc, line, x, y, CONTENT_WIDTH, { fontSize: FONT_SIZE_SMALL });
    }
    y += SECTION_GAP;
  }

  // Documents list
  if (data.documents && data.documents.length > 0) {
    y = addSectionHeading(doc, L.documents, x, y);
    for (const d of data.documents) {
      const date = formatDateStr(d.date);
      const name = d.name || d.fileName || d.id || L.documentFallback;
      y = addWrappedText(doc, `• ${date} — ${name}`, x, y, CONTENT_WIDTH, { fontSize: FONT_SIZE_SMALL });
      if (d.extractionSummary && typeof d.extractionSummary === 'string') {
        y = addWrappedText(doc, d.extractionSummary.slice(0, 150) + (d.extractionSummary.length > 150 ? '...' : ''), x + 5, y, CONTENT_WIDTH - 5, { fontSize: FONT_SIZE_SMALL });
      }
    }
  }

  return doc.output('blob');
}
