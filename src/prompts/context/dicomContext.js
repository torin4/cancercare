/**
 * DICOM Context Builder
 *
 * Builds structured context from DICOM metadata for AI chat interactions.
 * Follows best practices for medical imaging AI prompting.
 */

/**
 * Sanitize text to remove mojibake and non-printable characters
 * @param {string} text - Text to sanitize
 * @returns {string} Cleaned text
 */
function sanitizeText(text) {
  if (!text || typeof text !== 'string') return text;

  // Remove common mojibake patterns
  // eslint-disable-next-line no-control-regex
  let cleaned = text.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, '');

  // Replace sequences of replacement characters or question marks
  cleaned = cleaned.replace(/[�?]{3,}/g, '[Invalid Characters]');

  // Trim and collapse multiple spaces
  cleaned = cleaned.trim().replace(/\s+/g, ' ');

  // If mostly unreadable, return placeholder
  const unreadableChars = (cleaned.match(/[�?]/g) || []).length;
  if (unreadableChars > cleaned.length * 0.5) {
    return '[Encoding Error - Information Not Readable]';
  }

  return cleaned || text;
}

/**
 * Build comprehensive DICOM context from metadata
 * @param {Object} metadata - DICOM metadata object
 * @param {number} currentIndex - Current slice index (0-based)
 * @param {number} totalFiles - Total number of slices in series
 * @param {Object} viewerState - Current viewer state (optional)
 * @returns {string} Formatted DICOM context for AI
 */
export function buildDicomContext(metadata, currentIndex, totalFiles, viewerState = {}) {
  if (!metadata) {
    return 'DICOM SCAN CONTEXT: No metadata available';
  }

  const {
    activeTool,
    isInverted,
    probeValue,
    windowLevel,
    measurements
  } = viewerState;

  const hasMeasurements = measurements && Array.isArray(measurements) && measurements.length > 0;

  // Format dates properly
  const formatDate = (dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') return 'N/A';
    const cleaned = dateStr.replace(/[^0-9]/g, '');
    if (cleaned.length !== 8) return dateStr;
    const year = cleaned.substring(0, 4);
    const month = cleaned.substring(4, 6);
    const day = cleaned.substring(6, 8);
    try {
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return `${year}-${month}-${day}`;
    }
  };

  // Format time properly
  const formatTime = (timeStr) => {
    if (!timeStr || typeof timeStr !== 'string') return 'N/A';
    const cleaned = timeStr.replace(/[^0-9]/g, '').substring(0, 6);
    if (cleaned.length < 4) return timeStr;
    const hours = cleaned.substring(0, 2);
    const minutes = cleaned.substring(2, 4);
    const seconds = cleaned.length >= 6 ? cleaned.substring(4, 6) : '00';
    return `${hours}:${minutes}:${seconds}`;
  };

  // Build context sections
  const sections = [];

  // Header
  sections.push('DICOM SCAN CONTEXT:');
  sections.push('');

  // Patient Information
  sections.push('=== PATIENT INFORMATION ===');
  sections.push(`- Patient ID: ${sanitizeText(metadata.patientId) || 'N/A'}`);
  sections.push(`- Patient Name: ${sanitizeText(metadata.patientName) || 'N/A'}`);
  sections.push(`- Age: ${metadata.patientAge || 'N/A'}`);
  sections.push(`- Sex: ${metadata.patientSex || 'N/A'}`);
  sections.push(`- Birth Date: ${formatDate(metadata.patientBirthDate) || 'N/A'}`);
  sections.push('');

  // Study Information
  sections.push('=== STUDY INFORMATION ===');
  sections.push(`- Modality: ${metadata.modality || 'N/A'} (CT/MRI/X-Ray/etc.)`);
  sections.push(`- Study Description: ${sanitizeText(metadata.studyDescription) || 'N/A'}`);
  sections.push(`- Study Date: ${formatDate(metadata.studyDate) || 'N/A'}`);
  sections.push(`- Study Time: ${formatTime(metadata.studyTime) || 'N/A'}`);
  sections.push(`- Study ID: ${sanitizeText(metadata.studyId) || 'N/A'}`);
  sections.push(`- Accession Number: ${sanitizeText(metadata.accessionNumber) || 'N/A'}`);
  sections.push(`- Institution: ${sanitizeText(metadata.institutionName) || 'N/A'}`);
  if (metadata.institutionAddress) {
    sections.push(`- Institution Address: ${sanitizeText(metadata.institutionAddress)}`);
  }
  if (metadata.referringPhysicianName) {
    sections.push(`- Referring Physician: ${sanitizeText(metadata.referringPhysicianName)}`);
  }
  sections.push('');

  // Series Information
  sections.push('=== SERIES INFORMATION ===');
  sections.push(`- Series Description: ${sanitizeText(metadata.seriesDescription) || 'N/A'}`);
  sections.push(`- Body Part Examined: ${sanitizeText(metadata.bodyPartExamined) || 'N/A'}`);
  sections.push(`- Series Number: ${metadata.seriesNumber || 'N/A'}`);
  sections.push(`- Series Date: ${formatDate(metadata.seriesDate) || 'N/A'}`);
  sections.push(`- Series Time: ${formatTime(metadata.seriesTime) || 'N/A'}`);
  if (metadata.protocolName) {
    sections.push(`- Protocol: ${sanitizeText(metadata.protocolName)}`);
  }
  sections.push('');

  // Image Information
  sections.push('=== CURRENT IMAGE ===');
  sections.push(`- Viewing Slice: ${currentIndex + 1} of ${totalFiles} total slices`);
  sections.push(`- Instance Number: ${metadata.instanceNumber || 'N/A'}`);
  sections.push(`- Slice Location: ${metadata.sliceLocation || 'N/A'} mm`);
  sections.push(`- Slice Thickness: ${metadata.sliceThickness || 'N/A'} mm`);
  sections.push(`- Image Dimensions: ${metadata.rows || 'N/A'} x ${metadata.columns || 'N/A'} pixels`);

  if (metadata.pixelSpacing) {
    const spacing = Array.isArray(metadata.pixelSpacing)
      ? metadata.pixelSpacing.join(' x ')
      : metadata.pixelSpacing;
    sections.push(`- Pixel Spacing: ${spacing} mm`);
  }

  if (metadata.numberOfFrames) {
    sections.push(`- Number of Frames: ${metadata.numberOfFrames}`);
  }
  sections.push('');

  // Technical Parameters
  sections.push('=== TECHNICAL PARAMETERS ===');
  sections.push(`- Patient Position: ${metadata.patientPosition || 'N/A'}`);

  if (metadata.contrastBolusAgent) {
    sections.push(`- Contrast Agent: ${metadata.contrastBolusAgent}`);
  } else {
    sections.push('- Contrast Agent: None');
  }

  if (metadata.kvp) {
    sections.push(`- KVP: ${metadata.kvp}`);
  }
  if (metadata.exposureTime) {
    sections.push(`- Exposure Time: ${metadata.exposureTime} ms`);
  }
  if (metadata.manufacturer) {
    sections.push(`- Manufacturer: ${sanitizeText(metadata.manufacturer)}`);
  }
  if (metadata.manufacturerModelName) {
    sections.push(`- Model: ${sanitizeText(metadata.manufacturerModelName)}`);
  }
  if (metadata.stationName) {
    sections.push(`- Station: ${sanitizeText(metadata.stationName)}`);
  }
  sections.push('');

  // Viewer State (if provided)
  if (Object.keys(viewerState).length > 0) {
    sections.push('=== VIEWER STATE ===');

    if (activeTool) {
      const toolNames = {
        windowLevel: 'Window/Level Adjustment',
        length: 'Length Measurement',
        probe: 'Probe Tool (HU Values)'
      };
      sections.push(`- Active Tool: ${toolNames[activeTool] || activeTool}`);
    }

    if (isInverted !== undefined) {
      sections.push(`- Image Inverted: ${isInverted ? 'Yes' : 'No'}`);
    }

    if (windowLevel) {
      sections.push(`- Window/Level: ${windowLevel}`);
    }

    if (probeValue !== null && probeValue !== undefined) {
      sections.push(`- HU Value at Probe: ${probeValue}`);
    }

    if (hasMeasurements) {
      sections.push(`- Active Measurements: ${measurements.length} measurement(s)`);
      measurements.forEach((m) => {
        sections.push(`  ${m.index}. Length: ${m.lengthMm} mm (${m.lengthCm} cm) - Located in ${m.position}`);
      });
    }
    sections.push('');
  }

  // AI Instructions
  sections.push('=== IMPORTANT INSTRUCTIONS ===');
  sections.push('You are an AI assistant analyzing DICOM medical imaging data.');
  sections.push('');
  sections.push('CRITICAL CONSTRAINTS:');
  sections.push('- You provide EDUCATIONAL information only');
  sections.push('- You are NOT providing medical diagnosis or clinical advice');
  sections.push('- You are NOT a replacement for professional medical interpretation');
  sections.push('- All responses must remind users to consult their healthcare provider');
  sections.push('- When uncertain, clearly state your uncertainty');
  sections.push('- Ground all interpretations in the provided metadata');
  sections.push('- Use plain language and explain medical terminology');
  sections.push('- Be empathetic and supportive');
  sections.push('');
  sections.push('RESPONSE GUIDELINES:');
  sections.push('- Describe what the scan shows in educational terms');
  sections.push('- Explain the purpose of this type of imaging study');
  sections.push('- Clarify DICOM terminology when asked');
  sections.push('- Provide anatomical context based on body part examined');
  sections.push('- If asked about specific findings, be cautious and educational');
  sections.push('- Always end responses with: "Please consult your healthcare provider for medical interpretation."');
  sections.push('');

  return sections.join('\n');
}

/**
 * Build DICOM-specific system instructions for AI
 * @param {boolean} isMultiSlice - Whether multiple slices are being analyzed
 * @param {boolean} hasMeasurements - Whether measurements are present
 * @returns {string} System-level instructions for DICOM chat
 */
export function getDicomChatInstructions(isMultiSlice = false, hasMeasurements = false) {
  const multiSliceInstructions = isMultiSlice ? `

MULTI-SLICE ANALYSIS MODE:
- You are analyzing MULTIPLE slices from the scan series (not just one slice)
- The images are provided in sequence order
- The CURRENT SLICE is marked in the image labels
- When describing findings:
  * Note which slices show specific features
  * Describe patterns across multiple slices
  * Explain how structures appear in 3D by looking at adjacent slices
  * Compare differences between slices when relevant
- Use educational language to explain what patterns across slices might indicate
- Be cautious about making conclusions based on limited slices (you're seeing a subset, not the entire series)
- If asked about progression or extent, explain that you're viewing ${isMultiSlice ? 'a sample of slices' : 'only one slice'} and more slices may exist
` : '';

  const measurementInstructions = '';

  return `
You are assisting a user viewing a medical imaging study (DICOM scan). The user may ask questions about:
1. What the scan shows (anatomy, structures visible)
2. What the metadata means (technical parameters, DICOM terminology)
3. What type of imaging study this is
4. Educational information about the body part being examined
5. General questions about medical imaging
${isMultiSlice ? '6. Patterns and comparisons across multiple slices' : ''}

CRITICAL RULES:
- You provide educational information only, NOT medical diagnosis
- Always remind users that this is not a substitute for professional medical advice
- When asked about findings or abnormalities, provide educational context only
- Use plain language and explain medical terms
- Be empathetic and supportive
- Ground responses in the DICOM metadata provided
- If you don't have information to answer, say so clearly
- Never make definitive diagnostic statements
${multiSliceInstructions}${measurementInstructions}
RESPONSE FORMAT:
- CRITICAL: Keep responses extremely brief (3-4 sentences maximum, not paragraphs)
- Start with a direct answer to the user's question in 1-2 sentences
- Provide ONE key educational point if relevant
- Do NOT list multiple anatomical structures unless specifically asked
- Do NOT provide lengthy background explanations
- End with: "Please consult your healthcare provider for medical interpretation."
`;
}

/**
 * Build patient-friendly prompt modifier
 * @param {boolean} isPatientMode - Whether to use patient-friendly language
 * @returns {string} Additional instructions for patient-friendly responses
 */
export function getPatientFriendlyModifier(isPatientMode = true) {
  if (!isPatientMode) {
    return ''; // Default mode for healthcare professionals
  }

  return `

PATIENT-FRIENDLY MODE - ADDITIONAL INSTRUCTIONS:
- Use extremely plain language, avoid ALL medical jargon
- Explain anatomical terms with simple descriptions (e.g., "upper belly area" instead of "superior abdominal region")
- Use helpful analogies (e.g., "about the size of a grape" for measurements)
- Be extra empathetic and supportive in tone
- Break down complex concepts into simple steps
- If technical terms must be used, immediately define them in parentheses
- Acknowledge that medical information can be overwhelming
- Reassure that questions are welcome and important
`;
}

/**
 * Detect if user question likely needs DICOM context
 * @param {string} message - User's message
 * @returns {boolean} True if message seems DICOM-related
 */
export function isDicomRelatedQuestion(message) {
  const lowerMsg = message.toLowerCase();

  const dicomKeywords = [
    // General scan questions
    'scan', 'image', 'slice', 'series', 'study',

    // Anatomical questions
    'what am i looking at', 'what is this', 'what does this show',
    'body part', 'organ', 'anatomy', 'structure',

    // Metadata questions
    'modality', 'ct', 'mri', 'x-ray', 'dicom',
    'when was this taken', 'study date', 'patient',
    'contrast', 'protocol', 'technique',

    // Technical questions
    'slice thickness', 'pixel spacing', 'instance',
    'window', 'level', 'hu value', 'hounsfield',

    // Measurement questions
    'measurement', 'distance', 'size', 'dimension',

    // General medical imaging
    'imaging', 'radiolog', 'medical image'
  ];

  return dicomKeywords.some(keyword => lowerMsg.includes(keyword));
}
