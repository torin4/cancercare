/**
 * Lightweight document classification
 * Tier 1: Heuristic classification (free, instant)
 * Tier 2: Gemini Flash classification (only if Tier 1 returns 'unknown')
 */

/**
 * Tier 1: Quick heuristic classification
 * @param {string} filename - Document filename
 * @param {string} mimetype - MIME type
 * @param {string} firstPageText - First 500 chars of document text (optional)
 * @returns {'lab' | 'genomic' | 'imaging' | 'unknown'}
 */
export function classifyDocumentHeuristic(filename = '', mimetype = '', firstPageText = '') {
  const lowerFilename = filename.toLowerCase();
  const lowerText = firstPageText.toLowerCase();
  
  // DICOM file detection (check extension and MIME type first)
  if (lowerFilename.endsWith('.dcm') || lowerFilename.endsWith('.dicom') ||
      mimetype === 'application/dicom' || mimetype === 'application/x-dicom') {
    return 'imaging';
  }
  
  // Genomic patterns
  const genomicPatterns = [
    /genetic|genomic|23andme|ancestry|brca|foundationone|foundation one|guardant|tempus|mutation|variant|gene|chromosome|dna|vaf|variant allele frequency/i,
    /変異|遺伝子|DNA変化|変異アレル頻度/i
  ];
  
  // Lab patterns
  const labPatterns = [
    /lab|blood|cbc|cmp|chemistry|panel|hemoglobin|platelet|glucose|creatinine|ca-125|cea|wbc|rbc|plt|hgb|hct/i,
    /検査|血液|血球|生化学/i
  ];
  
  // Imaging patterns
  const imagingPatterns = [
    /scan|mri|ct|xray|x-ray|imaging|radiology|ultrasound|pet|findings:|impression:|radiologist/i,
    /画像|CT|MRI|レントゲン|超音波/i
  ];
  
  // Check filename first (most reliable)
  for (const pattern of genomicPatterns) {
    if (pattern.test(lowerFilename)) return 'genomic';
  }
  for (const pattern of labPatterns) {
    if (pattern.test(lowerFilename)) return 'lab';
  }
  for (const pattern of imagingPatterns) {
    if (pattern.test(lowerFilename)) return 'imaging';
  }
  
  // Check first page text if available
  if (firstPageText) {
    const genomicMatches = genomicPatterns.filter(p => p.test(lowerText)).length;
    const labMatches = labPatterns.filter(p => p.test(lowerText)).length;
    const imagingMatches = imagingPatterns.filter(p => p.test(lowerText)).length;
    
    if (genomicMatches > labMatches && genomicMatches > imagingMatches) return 'genomic';
    if (labMatches > genomicMatches && labMatches > imagingMatches) return 'lab';
    if (imagingMatches > genomicMatches && imagingMatches > labMatches) return 'imaging';
  }
  
  return 'unknown';
}

/**
 * Tier 2: Gemini Flash classification (only called if heuristic returns 'unknown')
 * @param {string} firstPageText - First page text of document
 * @param {Function} genAI - GoogleGenerativeAI instance
 * @returns {Promise<'lab' | 'genomic' | 'imaging'>}
 */
export async function classifyDocumentWithAI(firstPageText, genAI) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
  
  const prompt = `Classify this medical document type based on the content below.
Return ONLY one word: LAB, GENOMIC, or IMAGING

Document content:
${firstPageText.substring(0, 2000)}`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim().toUpperCase();
    
    if (text.includes('LAB')) return 'lab';
    if (text.includes('GENOMIC')) return 'genomic';
    if (text.includes('IMAGING')) return 'imaging';
    
    // Default fallback
    return 'lab';
  } catch (error) {
    console.error('Error in AI classification:', error);
    return 'lab'; // Safe fallback
  }
}

/**
 * Main classification function
 * @param {string} filename - Document filename
 * @param {string} mimetype - MIME type
 * @param {string} firstPageText - First page text (optional)
 * @param {Object} genAI - GoogleGenerativeAI instance (optional, only used if heuristic fails)
 * @returns {Promise<'lab' | 'genomic' | 'imaging'>}
 */
export async function classifyDocument(filename, mimetype, firstPageText = '', genAI = null) {
  // Tier 1: Try heuristic first
  const heuristicResult = classifyDocumentHeuristic(filename, mimetype, firstPageText);
  
  if (heuristicResult !== 'unknown') {
    return heuristicResult;
  }
  
  // Tier 2: Use AI classification if available and heuristic failed
  if (genAI && firstPageText) {
    return await classifyDocumentWithAI(firstPageText, genAI);
  }
  
  // Fallback: default to lab (most common type)
  return 'lab';
}

