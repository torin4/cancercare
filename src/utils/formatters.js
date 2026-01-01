// Format mutation labels (remove underscores, title case, map common codes)
export const formatLabel = (raw) => {
  if (!raw && raw !== 0) return '';
  let s = String(raw).trim();
  // common mapping for known codes
  const lower = s.toLowerCase();
  if (lower === 'vus' || lower === 'vsu') return 'VUS (Variant of Uncertain Significance)';
  if (lower === 'likely_pathogenic' || lower === 'likely pathogenic') return 'Likely pathogenic';
  if (lower === 'pathogenic') return 'Pathogenic';
  if (lower === 'benign') return 'Benign';
  // replace underscores and camelCase separation with spaces
  s = s.replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2');
  // Title case small words preserved
  return s.split(' ').map(w => w.length > 0 ? (w[0].toUpperCase() + w.slice(1).toLowerCase()) : '').join(' ');
};

export const formatSignificance = (sig) => {
  if (!sig) return '';
  // If it's already a short code like 'likely_pathogenic', map to nicer text
  return formatLabel(sig).replace('Vus (Variant Of Uncertain Significance)', 'VUS (Variant of Uncertain Significance)');
};

export const significanceExplanation = (sig) => {
  if (!sig) return '';
  const key = formatSignificance(sig).toLowerCase();
  if (key.includes('vus') || key.includes('variant of uncertain')) return 'Uncertain clinical significance — evidence is insufficient to determine if this variant causes disease.';
  if (key.includes('likely pathogenic')) return 'Likely pathogenic — evidence suggests this variant is likely to be disease-causing.';
  if (key.includes('pathogenic')) return 'Pathogenic — this variant is known to be disease-causing.';
  if (key.includes('benign')) return 'Benign — this variant is not associated with disease.';
  return '';
};

