/**
 * Document type constants
 * These match the document types returned by the AI model
 */
export const DOCUMENT_TYPES = {
  LAB: 'Lab',
  SCAN: 'Scan',
  REPORT: 'Report',
  GENOMIC: 'Genomic',
  VITALS: 'Vitals',
  MEDICATION: 'Medication'
};

/**
 * Get document type label for display
 */
export function getDocumentTypeLabel(documentType) {
  const labels = {
    [DOCUMENT_TYPES.LAB]: 'Lab Results',
    [DOCUMENT_TYPES.SCAN]: 'Imaging/Scan',
    [DOCUMENT_TYPES.REPORT]: 'Clinical Report',
    [DOCUMENT_TYPES.GENOMIC]: 'Genomic Test',
    [DOCUMENT_TYPES.VITALS]: 'Vital Signs',
    [DOCUMENT_TYPES.MEDICATION]: 'Medication'
  };
  return labels[documentType] || documentType;
}

