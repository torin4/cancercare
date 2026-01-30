/**
 * Day One JSON Import Utilities
 *
 * Parses Day One journal export (JSON format) and extracts:
 * - Vitals (temperature, blood pressure, weight)
 * - Symptoms
 * - Journal notes
 * - Regimen/treatment info
 * - Medication info
 * - Mood, tags, location (metadata)
 *
 * Supports both Japanese and English section headers.
 */

// Section header patterns (Japanese and English)
const SECTION_PATTERNS = {
  vitals: [
    /######\s*バイタル/i,
    /######\s*[Vv]itals/i,
    /^#+\s*バイタル/i,
    /^#+\s*[Vv]itals/i
  ],
  symptoms: [
    /######\s*症状/i,
    /######\s*[Ss]ymptoms/i,
    /^#+\s*症状/i,
    /^#+\s*[Ss]ymptoms/i
  ],
  regimen: [
    /######\s*レジメン/i,
    /######\s*[Rr]egimen/i,
    /^#+\s*レジメン/i,
    /^#+\s*[Rr]egimen/i
  ],
  medication: [
    /######\s*服薬/i,
    /######\s*[Mm]edication/i,
    /^#+\s*服薬/i,
    /^#+\s*[Mm]edication/i
  ],
  activities: [
    /######\s*今日やったこと/i,
    /######\s*[Ww]hat\s*[Ii]\s*[Dd]id/i,
    /^#+\s*今日やったこと/i,
    /^#+\s*[Ww]hat\s*[Ii]\s*[Dd]id/i
  ],
  // Additional Day One template sections (食事, 行動・体調・気分, 習慣化, 総合)
  meals: [
    /######\s*食事/i,
    /^#+\s*食事/i,
    /######\s*[Mm]eals/i,
    /^#+\s*[Mm]eals/i
  ],
  moodActivities: [
    /######\s*行動[、,]?\s*体調と気分の変化/i,
    /######\s*行動[、,]?\s*体調と気分/i,
    /######\s*行動/i,
    /^#+\s*行動[、,]?\s*体調と気分の変化/i,
    /^#+\s*行動/i
  ],
  habits: [
    /######\s*習慣化/i,
    /^#+\s*習慣化/i,
    /######\s*[Hh]abits/i,
    /^#+\s*[Hh]abits/i
  ],
  summary: [
    /######\s*総合/i,
    /^#+\s*総合/i,
    /######\s*[Ss]ummary/i,
    /^#+\s*[Ss]ummary/i
  ]
};

function matchesSection(text, sectionKey) {
  const patterns = SECTION_PATTERNS[sectionKey];
  if (!patterns) return false;
  return patterns.some((p) => p.test(text));
}

function extractSectionContent(fullText, sectionKey) {
  const patterns = SECTION_PATTERNS[sectionKey];
  if (!patterns) return null;

  const lines = fullText.split('\n');
  let inSection = false;
  const content = [];

  for (const line of lines) {
    const isHeader = patterns.some((p) => p.test(line));
    if (isHeader) {
      inSection = true;
      // Header may have content on same line (e.g. "###### バイタル - 体温（朝）：36.5 - ...")
      const afterHeader = line.replace(/^#+\s+\S+/, '').replace(/^\s*-\s*/, '').trim();
      if (afterHeader) content.push(afterHeader);
      continue;
    }
    if (inSection) {
      // Stop at next section (line starting with #)
      if (/^#+\s/.test(line) && line.trim()) {
        break;
      }
      if (line.trim()) {
        content.push(line.trim());
      }
    }
  }

  return content.length > 0 ? content.join('\n') : null;
}

// Vital extraction patterns (Japanese and English)
const VITAL_PATTERNS = {
  bp: [
    /血圧[：:]\s*(\d+)\s*[\/／]\s*(\d+)(?:[､,、]\s*(\d+))?/,
    /[Bb]lood\s*[Pp]ressure[：:]\s*(\d+)\s*[\/／]\s*(\d+)(?:[､,、]\s*(\d+))?/i,
    /[Bb][Pp][：:]\s*(\d+)\s*[\/／]\s*(\d+)(?:[､,、]\s*(\d+))?/i,
    /(\d+)\s*[\/／]\s*(\d+)\s*[Mm][Mm][Hh][Gg]/i
  ],
  weight: [
    /体重\s*[（(]?[^）):：]*[）)]?[：:\s]*([\d.]+)/i, // 体重：46.0, 体重(朝)：46.0, 体重（朝）: 46.0
    /体重[：:\s]+([\d.]+)/i,
    /[Ww]eight[：:\s]+([\d.]+)/i,
    /[Ww]t[：:\s]+([\d.]+)/i,
    /[Ww]eight\s*[（(]?[^）):：]*[）)]?[：:\s]*([\d.]+)/i
  ],
  hr: [
    /心拍[：:]\s*(\d+)/i,
    /[Hh]eart\s*[Rr]ate[：:]\s*(\d+)/i,
    /[Pp]ulse[：:]\s*(\d+)/i,
    /[Hh][Rr][：:]\s*(\d+)/i
  ],
  o2sat: [
    /酸素[：:]\s*(\d+)/i,
    /[Oo]2\s*[Ss]at[：:]\s*(\d+)/i,
    /[Ss]p[Oo]2[：:]\s*(\d+)/i
  ]
};

function preprocessVitalText(text) {
  return String(text || '')
    .replace(/\\\./g, '.') // 36\.5 -> 36.5
    .replace(/[\uFF10-\uFF19]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)) // Full-width ０-９ -> 0-9
    .replace(/^[-•*]\s*/gm, '') // Remove bullet point prefixes from start of lines
    .replace(/\n[-•*]\s*/g, '\n'); // Remove bullet point prefixes after newlines
}

function extractVitals(text) {
  const vitals = [];
  // Use BOTH vital section (if present) AND full text - some formats put vitals in different places
  const vitalSection = extractSectionContent(text, 'vitals');
  const combinedText = [vitalSection, text].filter(Boolean).join('\n');
  const searchText = preprocessVitalText(combinedText);

  // Debug logging for vital extraction (dev only)
  if (process.env.NODE_ENV === 'development') {
    console.log('[DayOne] Vital section found:', !!vitalSection);
    console.log('[DayOne] Search text (first 500 chars):', searchText.substring(0, 500));
  }

  // Temperature: extract ALL readings (朝/昼/夕/寝る前) - each gets its own vital value
  const tempValues = [];
  const tempPatterns = [
    /体温\s*[（(][^）)]*[）)]\s*[：:]\s*([\d.]+)/gi, // 体温(朝)：37.1 or 体温（朝）：37.1
    /体温\s*[（(][^）)]*[）)][：:\s]*([\d.]+)/gi,
    /体温\s*[：:]\s*([\d.]+)/gi, // 体温：37.1
    /体温[：:]\s*([\d.]+)/gi,
    /体温[：:]([\d.]+)/gi, // 体温:37.1 (no space)
    /体温\s+([\d.]+)/gi, // 体温 37.1 (space, no colon)
    /体温[^\d]*?([\d.]+)/gi, // 体温 followed by number anywhere
    /[Tt]emperature\s*[：:]\s*([\d.]+)/gi,
    /[Tt]emp\s*[：:]\s*([\d.]+)/gi,
    /[Tt]emp\s*[（(][^）)]*[）)]\s*[：:]\s*([\d.]+)/gi,
    /[Tt]emp[^\d]*?([\d.]+)/gi
  ];
  for (const pattern of tempPatterns) {
    let match;
    while ((match = pattern.exec(searchText)) !== null) {
      const val = parseFloat(match[1]);
      // Valid temperature range: 30-45°C or 86-113°F
      if (!isNaN(val) && val >= 30 && val <= 45) {
        // Already Celsius
        if (!tempValues.includes(val)) {
          tempValues.push(val);
        }
      } else if (!isNaN(val) && val >= 86 && val <= 113) {
        // Fahrenheit - convert to Celsius
        const celsius = (val - 32) * (5 / 9);
        if (!tempValues.includes(celsius)) {
          tempValues.push(celsius);
        }
      }
    }
    if (tempValues.length > 0) break;
  }
  tempValues.forEach((val) => {
    vitals.push({
      vitalType: 'temp',
      value: val,
      unit: '°C',
      label: 'Temperature'
    });
  });

  // Weight: extract ALL readings (same approach as temp - 体重(朝), 体重：46.0, etc.)
  const weightPatterns = [
    /体重\s*[（(][^）)]*[）)]\s*[：:]\s*([\d.]+)/gi, // 体重(朝)：46.0 or 体重（朝）：46.0
    /体重\s*[（(][^）)]*[）)][：:\s]*([\d.]+)/gi,
    /体重\s*[：:]\s*([\d.]+)/gi, // 体重：46.0
    /体重[：:]\s*([\d.]+)/gi,
    /体重[：:]([\d.]+)/gi, // 体重:46.0 (no space)
    /体重\s+([\d.]+)/gi, // 体重 46.0 (space, no colon)
    /体重[^\d]*?([\d.]+)/gi, // 体重 followed by number anywhere
    /[Ww]eight\s*[：:]\s*([\d.]+)/gi,
    /[Ww]eight[：:]\s*([\d.]+)/gi,
    /[Ww]eight\s+([\d.]+)/gi,
    /[Ww]eight[^\d]*?([\d.]+)/gi,
    /[Ww]t\s*[：:]\s*([\d.]+)/gi
  ];
  const weightValues = [];
  for (const pattern of weightPatterns) {
    let match;
    while ((match = pattern.exec(searchText)) !== null) {
      const val = parseFloat(match[1]);
      // Valid weight range: 1-500 kg (covers infants to very heavy adults)
      if (!isNaN(val) && val >= 1 && val <= 500) {
        if (!weightValues.includes(val)) {
          weightValues.push(val);
        }
      }
    }
    if (weightValues.length > 0) break;
  }
  weightValues.forEach((val) => {
    vitals.push({
      vitalType: 'weight',
      value: val,
      unit: 'kg',
      label: 'Weight'
    });
  });

  // Other vitals: first match only (bp, hr, o2sat)
  for (const [vitalType, patterns] of Object.entries(VITAL_PATTERNS)) {
    if (vitalType === 'weight') continue; // Already handled above
    for (const pattern of patterns) {
      const match = searchText.match(pattern);
      if (match) {
        if (vitalType === 'bp') {
          const systolic = parseInt(match[1], 10);
          const diastolic = parseInt(match[2], 10);
          const hr = match[3] ? parseInt(match[3], 10) : null;
          vitals.push({
            vitalType: 'bp',
            value: `${systolic}/${diastolic}`,
            systolic,
            diastolic,
            unit: 'mmHg',
            label: 'Blood Pressure',
            ...(hr && { heartRate: hr })
          });
        } else if (vitalType === 'hr') {
          vitals.push({
            vitalType: 'hr',
            value: parseFloat(match[1]),
            unit: 'BPM',
            label: 'Heart Rate'
          });
        } else if (vitalType === 'weight') {
          vitals.push({
            vitalType: 'weight',
            value: parseFloat(match[1]),
            unit: 'kg',
            label: 'Weight'
          });
        } else if (vitalType === 'o2sat') {
          vitals.push({
            vitalType: 'o2sat',
            value: parseFloat(match[1]),
            unit: '%',
            label: 'Oxygen Saturation'
          });
        }
        break;
      }
    }
  }

  return vitals;
}

// Symptom extraction: comma-separated, parentheses, or bullet lists
function extractSymptoms(text) {
  const symptoms = [];
  const symptomSection = extractSectionContent(text, 'symptoms');
  if (!symptomSection) return symptoms;

  const lines = symptomSection.split('\n');
  const seen = new Set();

  for (const line of lines) {
    // Split by common delimiters: comma, semicolon, parentheses
    const parts = line
      .split(/[,;、，；]|\(|（|\)|）/)
      .map((p) => p.trim())
      .filter((p) => p.length >= 1 && p.length < 100);

    for (const part of parts) {
      const cleaned = part.replace(/^[-•*]\s*/, '').trim();
      if (cleaned && !seen.has(cleaned.toLowerCase())) {
        seen.add(cleaned.toLowerCase());
        symptoms.push({
          name: cleaned,
          notes: line.length > cleaned.length ? line : '',
          severity: 'Moderate'
        });
      }
    }
  }

  return symptoms;
}

/**
 * Parse Day One creation date to local Date
 * Day One uses ISO 8601 (e.g. "2024-01-15T10:30:00.000Z") and may include timeZone
 */
function parseDayOneDate(entry) {
  const dateStr = entry.creationDate || entry.modifiedDate;
  if (!dateStr) return new Date();

  let date = new Date(dateStr);
  const tz = entry.timeZone || entry.timezone;
  if (tz) {
    try {
      const localStr = date.toLocaleString('en-US', { timeZone: tz });
      date = new Date(localStr);
    } catch {
      // Fallback to raw parse
    }
  }
  return date;
}

/**
 * Check if section content has meaningful data (not just template placeholders).
 * Returns false for: empty labels (朝食：), unchecked boxes (- [ ] 散歩), header-only lines (###### 食事), whitespace-only.
 */
function sectionHasMeaningfulContent(sectionText) {
  if (!sectionText || !sectionText.trim()) return false;
  const lines = sectionText.split('\n').map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const stripped = line.replace(/^[-•*]\s*/, '').trim();
    if (!stripped) continue;
    // Skip markdown headers only: "###### 食事", "# 習慣化", "**Meals:**" (header with no body)
    if (/^#+\s+\S+$/.test(stripped)) continue;
    if (/^\*\*[^*]+\*\*\s*$/.test(stripped)) continue; // **Section:** with nothing after
    // Skip label-only: "朝食：" "昼食：" "元気度：" "1行まとめ：" (colon with nothing after)
    if (/^[^：:]+[：:]\s*$/.test(stripped)) continue;
    // Skip unchecked checkbox: "- [ ] 散歩" or "- [ ] 読書"
    if (/^\[\s*\]\s*\S*$/.test(stripped)) continue;
    // Meaningful: checked box [x] [✓] [✔], text after colon, numbers, or substantial content
    if (/\[\s*[xX✓✔]\s*\]/.test(stripped)) return true;
    if (/[：:]\s*\S/.test(stripped)) return true; // "朝食：oatmeal"
    if (/\d/.test(stripped) && stripped.length >= 2) return true; // "8:30 起床"
    if (stripped.length >= 4) return true; // Substantial text
  }
  return false;
}

/**
 * Check if journal content has meaningful data (not just empty template).
 */
function hasMeaningfulJournalContentInternal(content) {
  if (!content || !content.trim()) return false;
  const sections = content.split(/\n\n+/);
  for (const section of sections) {
    const lines = section.split('\n');
    const sectionBody = lines.slice(1).join('\n').trim() || lines[0]?.replace(/^[^:：]+[：:]\s*/, '').trim() || '';
    if (sectionHasMeaningfulContent(sectionBody) || sectionHasMeaningfulContent(section)) return true;
  }
  return false;
}

/**
 * Format raw Day One content for readable display.
 * Converts ###### Section headers to clean labels and excludes vitals/symptoms (extracted separately).
 */
function formatDayOneJournalContent(rawText) {
  const lines = rawText.split('\n');
  const journalSections = [];
  const excludeHeaders = ['バイタル', 'Vitals', '症状', 'Symptoms'];
  const sectionLabels = {
    '食事': '食事 (Meals)',
    'Meals': 'Meals',
    '服薬': '服薬 (Medication)',
    'Medication': 'Medication',
    '行動、体調と気分の変化': '行動・体調・気分 (Mood & Activities)',
    '行動、体調と気分': '行動・体調・気分',
    '行動': '行動 (Activities)',
    '習慣化': '習慣化 (Habits)',
    'Habits': 'Habits',
    '総合': '総合 (Summary)',
    'Summary': 'Summary',
    'レジメン': 'レジメン (Regimen)',
    'Regimen': 'Regimen',
    '今日やったこと': '今日やったこと (What I Did)',
    'What I Did': 'What I Did'
  };

  let currentSection = null;
  let currentContent = [];

  for (const line of lines) {
    const headerMatch = line.match(/^#+\s+(.+)$/);
    if (headerMatch) {
      if (currentSection && currentContent.length > 0) {
        const body = currentContent.join('\n').trim();
        if (sectionHasMeaningfulContent(body)) {
          const label = sectionLabels[currentSection] || currentSection;
          journalSections.push(`${label}:\n${body}`);
        }
      }
      const headerText = headerMatch[1].trim();
      const shouldExclude = excludeHeaders.some((h) =>
        headerText.includes(h) || headerText.toLowerCase().includes(h.toLowerCase())
      );
      currentSection = shouldExclude ? null : headerText;
      currentContent = [];
    } else if (currentSection !== null && line.trim()) {
      currentContent.push(line.trim());
    }
  }
  if (currentSection && currentContent.length > 0) {
    const body = currentContent.join('\n').trim();
    if (sectionHasMeaningfulContent(body)) {
      const label = sectionLabels[currentSection] || currentSection;
      journalSections.push(`${label}:\n${body}`);
    }
  }
  return journalSections.join('\n\n');
}

/**
 * Check if journal content has meaningful data (not just empty template).
 * Use for filtering out template-only Day One entries.
 * @param {string} content - Journal note content
 * @returns {boolean} - True if content has meaningful data
 */
export function hasMeaningfulJournalContent(content) {
  return hasMeaningfulJournalContentInternal(String(content || ''));
}

/**
 * Format journal note content for display.
 * If content looks like raw Day One format (###### headers), format it for readability.
 * @param {string} content - Raw journal note content
 * @returns {string} - Formatted content for display
 */
export function formatJournalContentForDisplay(content) {
  const text = String(content || '').trim();
  if (!text) return '';
  if (/######/.test(text) && (text.includes('バイタル') || text.includes('食事') || text.includes('服薬') || text.includes('症状'))) {
    return formatDayOneJournalContent(text);
  }
  return text;
}

/**
 * Parse a single Day One entry
 */
export function parseDayOneEntry(entry) {
  const text = entry.text || '';
  const entryDate = parseDayOneDate(entry);

  const vitals = extractVitals(text);
  const symptoms = extractSymptoms(text);

  const regimenSection = extractSectionContent(text, 'regimen');
  const medicationSection = extractSectionContent(text, 'medication');
  const activitiesSection = extractSectionContent(text, 'activities');
  const mealsSection = extractSectionContent(text, 'meals');
  const moodActivitiesSection = extractSectionContent(text, 'moodActivities');
  const habitsSection = extractSectionContent(text, 'habits');
  const summarySection = extractSectionContent(text, 'summary');

  const journalContent = [];
  if (regimenSection && sectionHasMeaningfulContent(regimenSection)) journalContent.push(`Regimen:\n${regimenSection}`);
  if (medicationSection && sectionHasMeaningfulContent(medicationSection)) journalContent.push(`Medication:\n${medicationSection}`);
  if (activitiesSection && sectionHasMeaningfulContent(activitiesSection)) journalContent.push(`Activities:\n${activitiesSection}`);
  if (mealsSection && sectionHasMeaningfulContent(mealsSection)) journalContent.push(`Meals:\n${mealsSection}`);
  if (moodActivitiesSection && sectionHasMeaningfulContent(moodActivitiesSection)) journalContent.push(`Mood & Activities:\n${moodActivitiesSection}`);
  if (habitsSection && sectionHasMeaningfulContent(habitsSection)) journalContent.push(`Habits:\n${habitsSection}`);
  if (summarySection && sectionHasMeaningfulContent(summarySection)) journalContent.push(`Summary:\n${summarySection}`);

  let finalJournalContent;
  if (journalContent.length > 0) {
    finalJournalContent = journalContent.join('\n\n');
  } else if (text.trim()) {
    const formatted = formatDayOneJournalContent(text);
    finalJournalContent = hasMeaningfulJournalContentInternal(formatted) ? formatted : '';
  } else {
    finalJournalContent = '';
  }

  return {
    date: entryDate,
    vitals: vitals.map((v) => ({ ...v, date: entryDate })),
    symptoms: symptoms.map((s) => ({ ...s, date: entryDate })),
    journalContent: finalJournalContent,
    metadata: {
      mood: entry.mood,
      tags: entry.tags || [],
      location: entry.location,
      weather: entry.weather,
      photoCount: (entry.photos && entry.photos.length) || 0
    }
  };
}

/**
 * Parse full Day One JSON export
 * Expected structure: { entries: [...] } or { journal: { entries: [...] } }
 */
export function parseDayOneExport(json) {
  let entries = [];
  if (Array.isArray(json)) {
    entries = json;
  } else if (json.entries && Array.isArray(json.entries)) {
    entries = json.entries;
  } else if (json.journal?.entries && Array.isArray(json.journal.entries)) {
    entries = json.journal.entries;
  } else {
    throw new Error('Invalid Day One export format. Expected { entries: [...] } or { journal: { entries: [...] } }');
  }

  const results = entries.map((entry) => parseDayOneEntry(entry));

  // Vital breakdown by type for preview
  const vitalCounts = { temp: 0, weight: 0, bp: 0, hr: 0, o2sat: 0, other: 0 };
  results.forEach((r) => {
    r.vitals.forEach((v) => {
      const t = v.vitalType || 'other';
      vitalCounts[t] = (vitalCounts[t] || 0) + 1;
    });
  });

  const summary = {
    totalEntries: results.length,
    totalVitals: results.reduce((sum, r) => sum + r.vitals.length, 0),
    vitalCounts,
    totalSymptoms: results.reduce((sum, r) => sum + r.symptoms.length, 0),
    entriesWithJournal: results.filter((r) => r.journalContent).length,
    dateRange: null
  };

  const dates = results.map((r) => r.date.getTime()).filter(Boolean);
  if (dates.length > 0) {
    summary.dateRange = {
      from: new Date(Math.min(...dates)),
      to: new Date(Math.max(...dates))
    };
  }

  return { results, summary };
}

/**
 * Validate that a file/object looks like a Day One export
 */
export function isDayOneExport(data) {
  try {
    const json = typeof data === 'string' ? JSON.parse(data) : data;
    if (Array.isArray(json) && json.length > 0) {
      const first = json[0];
      return !!(first.text !== undefined || first.creationDate);
    }
    if (json.entries && Array.isArray(json.entries) && json.entries.length > 0) {
      const first = json.entries[0];
      return !!(first.text !== undefined || first.creationDate);
    }
    if (json.journal?.entries?.length > 0) {
      const first = json.journal.entries[0];
      return !!(first.text !== undefined || first.creationDate);
    }
    return false;
  } catch {
    return false;
  }
}
