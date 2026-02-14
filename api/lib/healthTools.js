const { runQuery, runSubcollectionQuery } = require('./firestoreRest');

// ---------------------------------------------------------------------------
// Gemini function declarations
// ---------------------------------------------------------------------------

const TOOL_DECLARATIONS = [
  {
    name: 'get_labs',
    description: 'Retrieve the patient\'s lab results (e.g., CA-125, hemoglobin, WBC, platelets). Returns lab types with their historical values.',
    parameters: {
      type: 'object',
      properties: {
        labType: { type: 'string', description: 'Filter by lab type key (e.g., "ca125", "hemoglobin", "wbc"). Omit to get all labs.' },
        startDate: { type: 'string', description: 'ISO date string for start of date range (e.g., "2026-01-01")' },
        endDate: { type: 'string', description: 'ISO date string for end of date range (e.g., "2026-01-31")' },
        limit: { type: 'integer', description: 'Max number of values per lab type. Default 20, max 50.' }
      }
    }
  },
  {
    name: 'get_vitals',
    description: 'Retrieve the patient\'s vital signs (blood pressure, heart rate, temperature, weight, oxygen saturation). Returns vital types with historical values.',
    parameters: {
      type: 'object',
      properties: {
        vitalType: { type: 'string', description: 'Filter by vital type key (e.g., "bp", "hr", "temp", "weight", "o2sat"). Omit to get all vitals.' },
        startDate: { type: 'string', description: 'ISO date string for start of date range' },
        endDate: { type: 'string', description: 'ISO date string for end of date range' },
        limit: { type: 'integer', description: 'Max number of values per vital type. Default 20, max 50.' }
      }
    }
  },
  {
    name: 'get_symptoms',
    description: 'Retrieve the patient\'s logged symptoms (e.g., fatigue, pain, nausea) with severity and dates.',
    parameters: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'ISO date string for start of date range' },
        endDate: { type: 'string', description: 'ISO date string for end of date range' },
        severity: { type: 'string', description: 'Filter by severity: "mild", "moderate", or "severe"' },
        limit: { type: 'integer', description: 'Max number of symptoms. Default 30, max 100.' }
      }
    }
  },
  {
    name: 'get_medications',
    description: 'Retrieve the patient\'s medications with dosage, frequency, and active status.',
    parameters: {
      type: 'object',
      properties: {
        activeOnly: { type: 'boolean', description: 'If true (default), only return active medications. Set false to include stopped medications.' },
        limit: { type: 'integer', description: 'Max number of medications. Default 20, max 50.' }
      }
    }
  },
  {
    name: 'get_journal_notes',
    description: 'Retrieve the patient\'s journal/medical notes with dates.',
    parameters: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'ISO date string for start of date range' },
        endDate: { type: 'string', description: 'ISO date string for end of date range' },
        query: { type: 'string', description: 'Optional case-insensitive keyword filter for note content' },
        limit: { type: 'integer', description: 'Max number of notes. Default 20, max 80.' }
      }
    }
  },
  {
    name: 'get_health_summary',
    description: 'Get a combined overview of the patient\'s health data. Use this for broad questions like "how am I doing?" instead of calling each tool separately.',
    parameters: {
      type: 'object',
      properties: {
        include: {
          type: 'array',
          items: { type: 'string', enum: ['labs', 'vitals', 'symptoms', 'medications', 'journalNotes'] },
          description: 'Which data types to include. Defaults to all.'
        },
        startDate: { type: 'string', description: 'ISO date string for start of date range' },
        endDate: { type: 'string', description: 'ISO date string for end of date range' }
      }
    }
  }
];

const TOOL_ALLOWLIST = new Set(TOOL_DECLARATIONS.map(t => t.name));
const DATE_AWARE_TOOLS = new Set(['get_labs', 'get_vitals', 'get_symptoms', 'get_journal_notes', 'get_health_summary']);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clampLimit(val, defaultVal, max) {
  if (val == null) return defaultVal;
  const n = Math.floor(Number(val));
  if (isNaN(n) || n < 1) return defaultVal;
  return Math.min(n, max);
}

function isValidIsoDate(s) {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}/.test(s) && !isNaN(Date.parse(s));
}

function normalizeIsoDate(s) {
  if (!isValidIsoDate(s)) return null;
  return s.slice(0, 10);
}

function normalizeDateRange(startDate, endDate) {
  let start = normalizeIsoDate(startDate);
  let end = normalizeIsoDate(endDate);
  if (start && end && start > end) {
    const tmp = start;
    start = end;
    end = tmp;
  }
  return { startDate: start, endDate: end };
}

function parseDateValue(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function toTimestamp(value) {
  if (!value) return null;
  const parsed = new Date(value);
  const ms = parsed.getTime();
  if (isNaN(ms)) return null;
  return ms;
}

function getDateTimestamp(record) {
  return toTimestamp(record?.date) || 0;
}

function getEditTimestamp(record) {
  return (
    toTimestamp(record?.updatedAt) ||
    toTimestamp(record?.createdAt) ||
    0
  );
}

function compareByRecency(a, b) {
  const dateDiff = getDateTimestamp(b) - getDateTimestamp(a);
  if (dateDiff !== 0) return dateDiff;
  return getEditTimestamp(b) - getEditTimestamp(a);
}

function getComparableDateValue(record) {
  return (
    parseDateValue(record?.date) ||
    parseDateValue(record?.createdAt) ||
    parseDateValue(record?.updatedAt) ||
    null
  );
}

function normalizeLabTypeKey(value) {
  if (value == null) return 'unknown';
  const raw = String(value).trim().toLowerCase();
  if (!raw) return 'unknown';
  return raw.replace(/[\s\-_/.]/g, '');
}

function isWithinDateRange(value, startDate, endDate) {
  if (!startDate && !endDate) return true;
  const isoDate = parseDateValue(value);
  // Strict mode: if a date range was requested, exclude undated/unparseable rows
  if (!isoDate) return false;
  if (startDate && isoDate < startDate) return false;
  if (endDate && isoDate > endDate) return false;
  return true;
}

function applyRequestedDateRange(name, args = {}, ctx = {}) {
  if (!DATE_AWARE_TOOLS.has(name)) return args;

  const requested = ctx.requestedDateRange || null;
  const requestedStart = normalizeIsoDate(requested?.startDate);
  const requestedEnd = normalizeIsoDate(requested?.endDate);
  if (!requestedStart && !requestedEnd) return args;

  const argStart = normalizeIsoDate(args.startDate);
  const argEnd = normalizeIsoDate(args.endDate);

  let start = argStart || requestedStart;
  let end = argEnd || requestedEnd;

  // Clamp model tool args to the user-requested window
  if (requestedStart && (!start || start < requestedStart)) start = requestedStart;
  if (requestedEnd && (!end || end > requestedEnd)) end = requestedEnd;

  if (start && end && start > end) {
    start = requestedStart || end;
    end = requestedEnd || start;
    if (start && end && start > end) {
      const tmp = start;
      start = end;
      end = tmp;
    }
  }

  const merged = { ...args };
  if (start) merged.startDate = start;
  else delete merged.startDate;
  if (end) merged.endDate = end;
  else delete merged.endDate;

  return merged;
}

/**
 * Build a composite "where" filter for a collection query.
 * Always includes patientId == uid. Additional field filters can be appended.
 */
function buildWhereFilter(uid, extraFilters) {
  const filters = [
    { fieldFilter: { field: { fieldPath: 'patientId' }, op: 'EQUAL', value: { stringValue: uid } } }
  ];
  if (extraFilters) filters.push(...extraFilters);

  if (filters.length === 1) return filters[0];
  return { compositeFilter: { op: 'AND', filters } };
}

/**
 * Build date-range filters for a timestamp field.
 */
function dateRangeFilters(fieldPath, startDate, endDate) {
  const filters = [];
  if (startDate && isValidIsoDate(startDate)) {
    filters.push({
      fieldFilter: {
        field: { fieldPath },
        op: 'GREATER_THAN_OR_EQUAL',
        value: { timestampValue: new Date(startDate).toISOString() }
      }
    });
  }
  if (endDate && isValidIsoDate(endDate)) {
    // Set to end of day
    const end = new Date(endDate);
    end.setUTCHours(23, 59, 59, 999);
    filters.push({
      fieldFilter: {
        field: { fieldPath },
        op: 'LESS_THAN_OR_EQUAL',
        value: { timestampValue: end.toISOString() }
      }
    });
  }
  return filters;
}

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

async function handleGetLabs(args, ctx) {
  const { idToken, uid } = ctx;
  const { startDate, endDate } = normalizeDateRange(args.startDate, args.endDate);
  const limit = clampLimit(args.limit, 12, 30);
  // Use a high cap and avoid parent-doc recency ordering.
  // Lab parent docs are not always updated when new subcollection values are written.
  const labDocLimit = args.labType ? 600 : 1200;
  const requestedLabTypeKey = args.labType ? normalizeLabTypeKey(args.labType) : null;

  const labQuery = {
    from: [{ collectionId: 'labs' }],
    where: buildWhereFilter(uid),
    limit: labDocLimit
  };
  const labDocs = await runQuery(idToken, labQuery);

  const groupedLabs = new Map();

  // Fetch values in parallel across lab documents, then group by normalized lab type.
  await Promise.all(labDocs.map(async (lab) => {
    const normalizedLabType = normalizeLabTypeKey(lab.labType || lab.label || lab.name || 'unknown');
    if (requestedLabTypeKey && normalizedLabType !== requestedLabTypeKey) return;

    const dateFilters = dateRangeFilters('date', startDate, endDate);
    const valuesQuery = {
      from: [{ collectionId: 'values' }],
      orderBy: [{ field: { fieldPath: 'date' }, direction: 'DESCENDING' }],
      limit
    };
    if (dateFilters.length > 0) {
      valuesQuery.where = dateFilters.length === 1 ? dateFilters[0] : { compositeFilter: { op: 'AND', filters: dateFilters } };
    }

    const valueDocs = await runSubcollectionQuery(idToken, `labs/${lab.id}`, valuesQuery);
    const filteredValues = valueDocs.filter(v => isWithinDateRange(v.date || v.createdAt || v.updatedAt, startDate, endDate));
    const mappedValues = filteredValues.map(v => ({
      value: v.value,
      date: v.date || null,
      createdAt: v.createdAt || null,
      updatedAt: v.updatedAt || null,
      notes: v.notes || null
    }));

    // If no value docs, include currentValue as fallback only when it's in requested date range.
    if (mappedValues.length === 0 && lab.currentValue != null && lab.currentValue !== '') {
      const fallbackDate = lab.updatedAt || lab.createdAt || null;
      if (isWithinDateRange(fallbackDate, startDate, endDate)) {
        mappedValues.push({
          value: lab.currentValue,
          date: fallbackDate,
          createdAt: lab.createdAt || null,
          updatedAt: lab.updatedAt || null,
          notes: null
        });
      }
    }

    if (mappedValues.length === 0) return;

    if (!groupedLabs.has(normalizedLabType)) {
      groupedLabs.set(normalizedLabType, {
        labType: lab.labType || normalizedLabType,
        label: lab.label || lab.name || lab.labType || 'Unknown Lab',
        unit: lab.unit || null,
        normalRange: lab.normalRange || null,
        values: []
      });
    }

    const group = groupedLabs.get(normalizedLabType);
    if (!group.unit && lab.unit) group.unit = lab.unit;
    if (!group.normalRange && lab.normalRange) group.normalRange = lab.normalRange;
    if (!group.label || group.label === 'Unknown Lab') {
      group.label = lab.label || lab.name || lab.labType || group.label;
    }
    group.values.push(...mappedValues);
  }));

  const labs = Array.from(groupedLabs.values())
    .map((lab) => {
      const deduped = new Map();
      for (const value of lab.values) {
        const dateKey = getComparableDateValue(value) || 'unknown-date';
        const dedupKey = `${dateKey}::${value.value ?? ''}::${value.notes ?? ''}`;
        if (!deduped.has(dedupKey)) {
          deduped.set(dedupKey, value);
        }
      }

      const values = Array.from(deduped.values())
        .sort(compareByRecency)
        .slice(0, limit)
        .map(v => ({
          value: v.value,
          date: getComparableDateValue(v),
          notes: v.notes || null
        }));

      return {
        labType: lab.labType,
        label: lab.label || lab.labType || 'Unknown Lab',
        unit: lab.unit,
        normalRange: lab.normalRange,
        values
      };
    })
    .filter(lab => lab.values.length > 0)
    .sort((a, b) => (a.label || a.labType || '').localeCompare(b.label || b.labType || ''));

  return {
    labs,
    metricCount: labs.length,
    dateRange: { startDate: startDate || null, endDate: endDate || null }
  };
}

async function handleGetVitals(args, ctx) {
  const { idToken, uid } = ctx;
  const { startDate, endDate } = normalizeDateRange(args.startDate, args.endDate);
  const limit = clampLimit(args.limit, 12, 30);
  // Match labs behavior: do not rely on parent updatedAt ordering for recency.
  const vitalDocLimit = args.vitalType ? 120 : 240;

  const extra = [];
  if (args.vitalType) {
    extra.push({ fieldFilter: { field: { fieldPath: 'vitalType' }, op: 'EQUAL', value: { stringValue: args.vitalType } } });
  }

  const vitalDocs = await runQuery(idToken, {
    from: [{ collectionId: 'vitals' }],
    where: buildWhereFilter(uid, extra),
    limit: vitalDocLimit
  });

  const vitals = (await Promise.all(vitalDocs.map(async (vital) => {
    const dateFilters = dateRangeFilters('date', startDate, endDate);
    const valuesQuery = {
      from: [{ collectionId: 'values' }],
      orderBy: [{ field: { fieldPath: 'date' }, direction: 'DESCENDING' }],
      limit
    };
    if (dateFilters.length > 0) {
      valuesQuery.where = dateFilters.length === 1 ? dateFilters[0] : { compositeFilter: { op: 'AND', filters: dateFilters } };
    }

    const valueDocs = await runSubcollectionQuery(idToken, `vitals/${vital.id}`, valuesQuery);
    const filteredValues = valueDocs.filter(v => isWithinDateRange(v.date || v.createdAt || v.updatedAt, startDate, endDate));
    if (filteredValues.length === 0) return null;
    return {
      vitalType: vital.vitalType,
      label: vital.label || vital.name || vital.vitalType || 'Unknown Vital',
      unit: vital.unit,
      normalRange: vital.normalRange,
      values: filteredValues
        .sort(compareByRecency)
        .slice(0, limit)
        .map(v => {
        const entry = { value: v.value, date: getComparableDateValue(v) };
        if (v.systolic != null) entry.systolic = v.systolic;
        if (v.diastolic != null) entry.diastolic = v.diastolic;
        if (v.notes) entry.notes = v.notes;
        return entry;
      })
    };
  }))).filter(Boolean);
  return { vitals, dateRange: { startDate: startDate || null, endDate: endDate || null } };
}

async function handleGetSymptoms(args, ctx) {
  const { idToken, uid } = ctx;
  const { startDate, endDate } = normalizeDateRange(args.startDate, args.endDate);
  const limit = clampLimit(args.limit, 30, 100);

  const extra = [];
  if (args.severity) {
    extra.push({ fieldFilter: { field: { fieldPath: 'severity' }, op: 'EQUAL', value: { stringValue: args.severity } } });
  }
  extra.push(...dateRangeFilters('date', startDate, endDate));

  const docs = await runQuery(idToken, {
    from: [{ collectionId: 'symptoms' }],
    where: buildWhereFilter(uid, extra.length ? extra : null),
    orderBy: [{ field: { fieldPath: 'date' }, direction: 'DESCENDING' }],
    limit
  });
  const filteredDocs = docs.filter(d => isWithinDateRange(d.date, startDate, endDate));

  return {
    symptoms: filteredDocs.map(d => ({
      name: d.name || d.type || 'Unknown Symptom',
      type: d.type || d.name || null,
      severity: d.severity,
      date: d.date,
      notes: d.notes || null
    })),
    dateRange: { startDate: startDate || null, endDate: endDate || null }
  };
}

async function handleGetMedications(args, ctx) {
  const { idToken, uid } = ctx;
  const limit = clampLimit(args.limit, 20, 50);
  const activeOnly = args.activeOnly !== false; // default true

  const extra = [];
  if (activeOnly) {
    extra.push({ fieldFilter: { field: { fieldPath: 'active' }, op: 'EQUAL', value: { booleanValue: true } } });
  }

  const docs = await runQuery(idToken, {
    from: [{ collectionId: 'medications' }],
    where: buildWhereFilter(uid, extra.length ? extra : null),
    limit
  });

  return {
    medications: docs.map(d => ({
      name: d.name,
      dosage: d.dosage || null,
      frequency: d.frequency || null,
      purpose: d.purpose || null,
      active: d.active
    }))
  };
}

async function handleGetJournalNotes(args, ctx) {
  const { idToken, uid } = ctx;
  const { startDate, endDate } = normalizeDateRange(args.startDate, args.endDate);
  const limit = clampLimit(args.limit, 20, 80);
  const searchQuery = typeof args.query === 'string' ? args.query.trim().toLowerCase() : '';

  const extra = [...dateRangeFilters('date', startDate, endDate)];
  const scanLimit = searchQuery ? Math.min(Math.max(limit * 4, 60), 200) : limit;

  const docs = await runQuery(idToken, {
    from: [{ collectionId: 'journalNotes' }],
    where: buildWhereFilter(uid, extra.length ? extra : null),
    orderBy: [{ field: { fieldPath: 'date' }, direction: 'DESCENDING' }],
    limit: scanLimit
  });

  const filteredDocs = docs
    .filter(d => isWithinDateRange(d.date, startDate, endDate))
    .filter(d => {
      if (!searchQuery) return true;
      const content = (d.content || '').toString().toLowerCase();
      return content.includes(searchQuery);
    })
    .slice(0, limit);

  return {
    journalNotes: filteredDocs.map(d => ({
      id: d.id,
      date: d.date,
      content: d.content || '',
      documentId: d.documentId || null
    })),
    dateRange: { startDate: startDate || null, endDate: endDate || null }
  };
}

async function handleGetHealthSummary(args, ctx) {
  const { startDate, endDate } = normalizeDateRange(args.startDate, args.endDate);
  const include = args.include || ['labs', 'vitals', 'symptoms', 'medications', 'journalNotes'];
  const dateArgs = { startDate, endDate };
  const result = {};

  const promises = [];
  if (include.includes('labs')) promises.push(handleGetLabs({ ...dateArgs, limit: 4 }, ctx).then(r => { result.labs = r.labs; }));
  if (include.includes('vitals')) promises.push(handleGetVitals({ ...dateArgs, limit: 4 }, ctx).then(r => { result.vitals = r.vitals; }));
  if (include.includes('symptoms')) promises.push(handleGetSymptoms({ ...dateArgs, limit: 8 }, ctx).then(r => { result.symptoms = r.symptoms; }));
  if (include.includes('medications')) promises.push(handleGetMedications({ activeOnly: true, limit: 8 }, ctx).then(r => { result.medications = r.medications; }));
  if (include.includes('journalNotes')) promises.push(handleGetJournalNotes({ ...dateArgs, limit: 8 }, ctx).then(r => { result.journalNotes = r.journalNotes; }));

  await Promise.all(promises);
  result.dateRange = { startDate: startDate || null, endDate: endDate || null };
  return result;
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

const HANDLERS = {
  get_labs: handleGetLabs,
  get_vitals: handleGetVitals,
  get_symptoms: handleGetSymptoms,
  get_medications: handleGetMedications,
  get_journal_notes: handleGetJournalNotes,
  get_health_summary: handleGetHealthSummary
};

/**
 * Execute a tool call by name.
 * @param {string} name - Tool name from Gemini's function call
 * @param {Object} args - Arguments from Gemini
 * @param {Object} ctx - { idToken, uid }
 * @returns {Promise<Object>} Tool result
 */
async function executeTool(name, args, ctx) {
  const handler = HANDLERS[name];
  if (!handler) throw new Error(`Unknown tool: ${name}`);
  const mergedArgs = applyRequestedDateRange(name, args || {}, ctx || {});
  return handler(mergedArgs, ctx);
}

module.exports = { TOOL_DECLARATIONS, TOOL_ALLOWLIST, executeTool };
