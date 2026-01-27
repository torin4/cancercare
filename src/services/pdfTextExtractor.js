import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

/**
 * Extract text from a PDF file
 * @param {File} file - PDF file
 * @param {Object} options - Extraction options
 * @param {number} options.maxPages - Maximum pages to extract (default: all pages)
 * @param {Function} options.onProgress - Progress callback
 * @returns {Promise<{text: string, pageCount: number}>} - Extracted text and metadata
 */
export async function extractTextFromPDF(file, options = {}) {
  const { maxPages = Infinity, onProgress } = options;

  try {
    // Convert file to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // Load PDF document
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    const pageCount = pdf.numPages;
    const pagesToExtract = Math.min(pageCount, maxPages);

    let fullText = '';

    // Extract text from each page
    for (let pageNum = 1; pageNum <= pagesToExtract; pageNum++) {
      if (onProgress) {
        onProgress({ stage: 'extracting', message: `Extracting text from page ${pageNum}/${pagesToExtract}...` });
      }

      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      // Combine text items with proper spacing
      const pageText = textContent.items
        .map(item => item.str)
        .join(' ')
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();

      fullText += pageText + '\n\n';
    }

    return {
      text: fullText.trim(),
      pageCount,
      extractedPages: pagesToExtract
    };
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
}

/**
 * Determine if a PDF is suitable for text extraction
 * (vs vision API for scanned documents)
 * @param {string} extractedText - Text extracted from PDF
 * @returns {boolean} - True if text extraction was successful
 */
export function isTextExtractionSuccessful(extractedText) {
  // If we got very little text, it's likely a scanned document
  // Fall back to vision API for scanned PDFs
  const minTextLength = 100; // At least 100 characters
  const hasText = extractedText && extractedText.length >= minTextLength;

  // Check for gibberish (lots of special characters, no readable words)
  const wordCount = extractedText.split(/\s+/).filter(word => word.length > 2).length;
  const hasReadableContent = wordCount > 10;

  return hasText && hasReadableContent;
}

/**
 * Extract text from images using vision API fallback
 * (for scanned PDFs or image files)
 */
export function shouldUseVisionAPI(file, extractedText = null) {
  // Use vision API for images
  if (file.type.startsWith('image/')) {
    return true;
  }

  // Use vision API for PDFs with poor text extraction
  if (file.type === 'application/pdf' && extractedText !== null) {
    return !isTextExtractionSuccessful(extractedText);
  }

  return false;
}
