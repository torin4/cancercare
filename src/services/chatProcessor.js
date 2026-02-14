import { labService, vitalService, medicationService, symptomService, journalNoteService, documentService } from '../firebase/services';
import { getSavedTrials } from '../services/clinicalTrials/clinicalTrialsService';
import { getNotebookEntries } from './notebookService';
import { parseLocalDate } from '../utils/helpers';
import { downloadFileAsBlob } from '../firebase/storage';
import { processDocument } from './documentProcessor';
import { detectAllPatterns } from '../utils/patternRecognition';
import { generateCacheKey, getCachedInsights, setCachedInsights, clearContextCache } from '../utils/insightCache';
import { translatePattern, generateHeadline, generateExplanation, suggestAction } from '../utils/insightLanguage';
import { validateAndEnhanceInsights } from '../utils/clinicalInsightValidator';
import logger from '../utils/logger';
// Import prompts
import { buildMainPrompt, complexityToInsightDepth } from '../prompts/chat/mainPrompt';
import { getTaskDescription } from '../prompts/chat/taskDescriptions';
import { getHealthContextInstructions } from '../prompts/context/healthContext';
import { getTrialContextInstructions } from '../prompts/context/trialContext';
import { getNotebookContextInstructions } from '../prompts/context/notebookContext';
import { buildPatientDemographicsContext } from '../prompts/context/patientDemographics';
import { buildDicomContext, getDicomChatInstructions } from '../prompts/context/dicomContext';
import {
  buildNoTrialDataResponse,
  buildNoHealthDataResponse,
  buildNoLabDataResponse,
  buildNoVitalDataResponse,
  buildNoSymptomDataResponse,
  buildInsufficientTrendDataResponse
} from '../prompts/responses/noDataResponses';
import { buildRecoveryInstructionsResponse } from '../prompts/responses/recoveryResponses';
import { generateGeminiText, callToolChat } from './geminiClientService';

// ============================================================================
// BULK SCANNING FUNCTIONALITY
// ============================================================================

/**
 * Handle bulk scan request - scan all documents with custom instructions
 * @param {string} message - User's message containing scan request and instructions
 * @param {string} userId - User ID
 * @param {Object} patientProfile - Patient demographics
 * @returns {Promise<Object>} Response with scan results
 */
async function handleBulkScanRequest(message, userId, patientProfile) {
  try {
    // Extract custom instructions from message
    // Look for patterns like "extract CA-125", "only CA-125", "just CA-125", "scan for CA-125", etc.
    let customInstructions = null;
    let requestedMetricType = null; // Track what metric we're looking for (for smart skipping)
    
    // Pattern 1: "scan files for [value]" or "scan the files for [value]" or "scan files for [name]'s [value]"
    // Handle patterns like "scan files for HGB" or "scan the files for Asuka's HGB values"
    // Use a pattern that captures everything up to "values", "and log", or end of phrase
    const scanForPatternGreedy = /scan\s+(?:the|all|my)?\s*(?:file|document|files|documents)\s+for\s+(.+?)(?:\s+(?:values?|data|results?|tests?|labs?|vitals?|and\s+log|log))?/i;
    let scanForMatch = message.match(scanForPatternGreedy);
    
    // If that didn't work, try matching up to "values" or "and log" explicitly
    if (!scanForMatch || scanForMatch[1].length < 2) {
      const scanForPatternExplicit = /scan\s+(?:the|all|my)?\s*(?:file|document|files|documents)\s+for\s+(.+?)(?:\s+(?:values?|and\s+log|log))/i;
      scanForMatch = message.match(scanForPatternExplicit);
    }
    
    if (scanForMatch && scanForMatch[1]) {
      let requestedValue = scanForMatch[1].trim();
      // Remove possessive names like "Asuka's" or "patient's" - match name followed by apostrophe-s
      requestedValue = requestedValue.replace(/^[a-z]+'s\s+/i, '').trim();
      // Clean up common trailing words
      const finalValue = requestedValue.replace(/\s+(values?|data|results?|tests?|labs?|vitals?)$/i, '').trim();
      if (finalValue) {
        // Normalize HGB to hemoglobin for consistency
        const metricName = finalValue.toLowerCase() === 'hgb' ? 'hemoglobin' : finalValue.toLowerCase();
        customInstructions = `Only extract ${metricName} values. Skip all other labs, vitals, and data.`;
        requestedMetricType = metricName;
      }
    }
    
    // Pattern 2: "extract/only/just/scan for/get/find/log [value]"
    if (!customInstructions) {
      const extractPattern = /(extract|only|just|scan for|get|find|log)\s+([a-z0-9\s\-\+\/]+?)(?:\s+(?:from|in|on|and|,)|$)/i;
      const match = message.match(extractPattern);
      
      if (match && match[2]) {
        const requestedValue = match[2].trim();
        // Remove possessive names like "Asuka's" or "patient's"
        const cleanedValue = requestedValue.replace(/^[a-z]+'s\s+/i, '').trim();
        // Clean up common trailing words
        const finalValue = cleanedValue.replace(/\s+(values?|data|results?|tests?|labs?|vitals?)$/i, '').trim();
        if (finalValue) {
          // Normalize HGB to hemoglobin for consistency
          const metricName = finalValue.toLowerCase() === 'hgb' ? 'hemoglobin' : finalValue.toLowerCase();
          customInstructions = `Only extract ${metricName} values. Skip all other labs, vitals, and data.`;
          requestedMetricType = metricName;
        }
      }
    }
    
    // Pattern 3: If no match, try to find specific lab/vital names
    if (!customInstructions) {
      const labPattern = /(ca-125|ca125|cea|wbc|hemoglobin|hgb|platelets|plt|cd19|cd4|cd8|hct|alt|ast|creatinine|egfr|bun|ldh|albumin|crp|tsh|t3|t4|psa|afp|blood pressure|heart rate|temperature|weight|oxygen|tumor markers?)/i;
      const labMatch = message.match(labPattern);
      if (labMatch) {
        customInstructions = `Only extract ${labMatch[1]} values. Skip all other labs, vitals, and data.`;
        requestedMetricType = labMatch[1].toLowerCase();
      }
    }
    
    // Pattern 3: Look for "all" or "everything" - no custom instructions (extract all)
    if (/extract (all|everything|all data|all values)/i.test(message)) {
      customInstructions = null; // Extract everything
    }
    
    // Get all documents
    const documents = await documentService.getDocuments(userId);
    
    if (!documents || documents.length === 0) {
      return {
        response: "You don't have any documents uploaded yet. Please upload documents first, then I can scan them.",
        extractedData: null,
        insight: 'No documents found for bulk scanning'
      };
    }
    
    // Smart skipping: Check document metadata first, then check actual values
    // This avoids re-scanning documents that already have the data
    let documentsToScan = documents;
    let skippedCount = 0;
    
    if (requestedMetricType && customInstructions) {
      // Normalize metric type for comparison
      const { normalizeLabName } = await import('../utils/normalizationUtils');
      const normalizedRequested = normalizeLabName(requestedMetricType) || requestedMetricType;
      
      // First, check document metadata (extractionSummary) - faster than querying all values
      const documentsToCheck = [];
      const documentsWithMetadata = [];
      
      for (const doc of documents) {
        // Check if document has extractionSummary metadata
        if (doc.extractionSummary) {
          const summary = doc.extractionSummary;
          const extractedLabTypes = summary.metricTypes?.labs || [];
          
          // Check if this metric was already extracted with same or no custom instructions
          const hasMetric = extractedLabTypes.some(extractedType => {
            const normalizedExtracted = normalizeLabName(extractedType) || extractedType.toLowerCase();
            return normalizedExtracted === normalizedRequested;
          });
          
          // Skip if:
          // 1. Metric was already extracted, AND
          // 2. Either no custom instructions were used before, OR same instructions were used
          if (hasMetric) {
            const previousInstructions = summary.customInstructions || null;
            const currentInstructions = customInstructions || null;
            
            // If instructions match (or both null), we can skip
            if (previousInstructions === currentInstructions || 
                (!previousInstructions && !currentInstructions)) {
              documentsWithMetadata.push(doc.id);
              skippedCount++;
              continue;
            }
            // If instructions differ, we need to re-process
          }
        }
        
        // Document needs checking (no metadata or metric not found in metadata)
        documentsToCheck.push(doc);
      }
      
      // For documents without metadata or that need re-processing, check actual values
      if (documentsToCheck.length > 0) {
        // Get existing labs to check
        const existingLabs = await labService.getLabs(userId);
        const existingLabTypes = new Set(
          existingLabs.map(lab => {
            const normalized = normalizeLabName(lab.labType) || lab.labType?.toLowerCase();
            return normalized;
          })
        );
        
        // Check if requested metric already exists
        if (existingLabTypes.has(normalizedRequested)) {
          // Get all lab values for this metric
          const matchingLab = existingLabs.find(lab => {
            const normalized = normalizeLabName(lab.labType) || lab.labType?.toLowerCase();
            return normalized === normalizedRequested;
          });
          
          if (matchingLab) {
            const existingValues = await labService.getLabValues(matchingLab.id);
            const documentsWithValues = new Set(
              existingValues
                .filter(v => v.documentId)
                .map(v => v.documentId)
            );
            
            // Filter out documents that already have values for this metric
            documentsToScan = documentsToCheck.filter(doc => !documentsWithValues.has(doc.id));
            skippedCount += documentsToCheck.length - documentsToScan.length;
          } else {
            documentsToScan = documentsToCheck;
          }
        } else {
          documentsToScan = documentsToCheck;
        }
      } else {
        // All documents were skipped based on metadata
        documentsToScan = [];
      }
    }
    
    const totalDocuments = documentsToScan.length;
    let processedCount = 0;
    let successCount = 0;
    let errorCount = 0;
    const results = [];
    const errors = [];
    
    // Process documents with controlled concurrency (8 at a time for better performance)
    // Increased from 3 to 8 to speed up bulk operations while avoiding rate limits
    const CONCURRENCY_LIMIT = 8;
    const processSingleDocument = async (doc, index) => {
      try {
        // Download file
        if (!doc.storagePath) {
          return { error: 'No storage path found', document: doc.fileName || doc.name || 'Unknown' };
        }
        
        // Download file - proxy will be used (required for CORS)
        // The downloadFileAsBlob function will try proxy first, then fallback to direct if needed
        const blob = await downloadFileAsBlob(doc.storagePath, doc.fileUrl, userId, doc.id, false);
        const file = new File([blob], doc.fileName || doc.name || 'document.pdf', {
          type: doc.fileType || blob.type || 'application/pdf'
        });
        
        // Process document with custom instructions
        const { processDocument } = await import('./documentProcessor');
        const processingResult = await processDocument(
          file,
          userId,
          patientProfile,
          doc.date || null,
          doc.note || null,
          doc.id,
          null, // No progress callback for bulk operations
          false, // Don't limit to existing metrics - CREATE NEW METRICS if they don't exist
          doc.documentType || doc.type || null,
          customInstructions
        );
        
        if (processingResult.extractedData) {
          const labCount = processingResult.extractedData.labs?.length || 0;
          const vitalCount = processingResult.extractedData.vitals?.length || 0;
          const mutationCount = processingResult.extractedData.genomic?.mutations?.length || 0;
          
          if (labCount > 0 || vitalCount > 0 || mutationCount > 0) {
            return {
              success: true,
              document: doc.fileName || doc.name || 'Unknown',
              labs: labCount,
              vitals: vitalCount,
              mutations: mutationCount,
              date: doc.date || 'Unknown date'
            };
          }
        }
        return { success: false, document: doc.fileName || doc.name || 'Unknown', note: 'No data extracted' };
      } catch (error) {
        return { 
          error: error.message || 'Processing failed',
          document: doc.fileName || doc.name || 'Unknown'
        };
      }
    };
    
    // Process in batches with concurrency limit
    for (let i = 0; i < documentsToScan.length; i += CONCURRENCY_LIMIT) {
      const batch = documentsToScan.slice(i, i + CONCURRENCY_LIMIT);
      const batchPromises = batch.map((doc, batchIndex) => processSingleDocument(doc, i + batchIndex));
      const batchResults = await Promise.all(batchPromises);
      
      for (const result of batchResults) {
        processedCount++;
        if (result.error) {
          errors.push(result);
          errorCount++;
        } else if (result.success) {
          results.push(result);
          successCount++;
        }
      }
      
      // No delay needed - concurrency limit already controls rate
    }
    
    // Build response
    let response = `I've processed ${totalDocuments} document${totalDocuments !== 1 ? 's' : ''}`;
    if (skippedCount > 0) {
      response += ` (skipped ${skippedCount} that already had the requested values)`;
    }
    response += '.\n\n';
    
    if (customInstructions) {
      response += `**Extraction Instructions:** ${customInstructions}\n\n`;
      response += `**Note:** I've created new metrics for any requested values that didn't already exist in your profile.\n\n`;
    } else {
      response += `**Note:** I've created new metrics for any values that didn't already exist in your profile.\n\n`;
    }
    
    if (successCount > 0) {
      response += `**✅ Successfully processed ${successCount} document${successCount !== 1 ? 's' : ''}:**\n\n`;
      results.forEach((result, idx) => {
        response += `${idx + 1}. **${result.document}** (${result.date})\n`;
        if (result.labs > 0) response += `   - ${result.labs} lab value${result.labs !== 1 ? 's' : ''}\n`;
        if (result.vitals > 0) response += `   - ${result.vitals} vital value${result.vitals !== 1 ? 's' : ''}\n`;
        if (result.mutations > 0) response += `   - ${result.mutations} mutation${result.mutations !== 1 ? 's' : ''}\n`;
        response += '\n';
      });
    }
    
    if (errorCount > 0) {
      response += `**⚠️ ${errorCount} document${errorCount !== 1 ? 's' : ''} had errors:**\n\n`;
      
      // Check if all errors are proxy-related
      const allProxyErrors = errors.every(e => 
        e.error?.includes('proxy') || 
        e.error?.includes('CORS') || 
        e.error?.includes('localhost:4000') ||
        e.error?.includes('Failed to fetch')
      );
      
      if (allProxyErrors && errors.length > 0) {
        response += `**All errors are related to file download. This usually means the proxy server isn't running.**\n\n`;
        response += `**To fix this:**\n`;
        response += `1. Open a new terminal window\n`;
        response += `2. Run: \`npm run start:proxy\`\n`;
        response += `3. Or run: \`npm run start:all\` (starts both proxy and React app)\n`;
        response += `4. Then try the bulk scan again\n\n`;
        response += `**Error details:**\n`;
      }
      
      // Show first few errors, then summarize if there are many
      const errorsToShow = errors.slice(0, 5);
      errorsToShow.forEach((error, idx) => {
        response += `${idx + 1}. **${error.document}**: ${error.error}\n`;
      });
      
      if (errors.length > 5) {
        response += `\n... and ${errors.length - 5} more document${errors.length - 5 !== 1 ? 's' : ''} with similar errors.\n`;
      }
    }
    
    if (successCount === 0 && errorCount === 0) {
      response += "No data was extracted from any documents. This might be because:\n";
      response += "- The documents don't contain the requested values\n";
      response += "- The extraction instructions were too specific\n";
      response += "- The documents need to be rescanned with different instructions\n";
    }
    
    return {
      response,
      extractedData: null,
      insight: `Bulk scan completed: ${successCount} successful, ${errorCount} errors`
    };
    
  } catch (error) {
    return {
      response: `I encountered an error while scanning your documents: ${error.message}. Please try again or scan documents individually.`,
      extractedData: null,
      insight: `Bulk scan error: ${error.message}`
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS - Context Builders
// ============================================================================

// buildPatientDemographicsContext is now imported from prompts/context/patientDemographics

/**
 * Build trial context section
 */
function buildTrialContextSection(trialContext) {
  if (!trialContext) return '';
  
  // Handle search results context (multiple trials)
  if (trialContext._isSearchResults && trialContext._searchResults && Array.isArray(trialContext._searchResults)) {
    const searchResults = trialContext._searchResults;
    const trialsList = searchResults.map((trial, idx) => {
      const interventions = trial.interventions || [];
      const drugs = interventions.map(int => {
        if (typeof int === 'string') return int;
        return int.name || int.description || JSON.stringify(int);
      }).filter(Boolean).join(', ');
      const trialUrl = trial.url || (trial.id ? `https://clinicaltrials.gov/study/${trial.id}` : null);
      
      return `Trial ${idx + 1}:
- Title: ${trial.title || trial.titleJa || 'Not specified'}
- Trial ID: ${trial.id || 'Not specified'}
- Phase: ${trial.phase || 'Not specified'}
- Status: ${trial.status || 'Not specified'}
- Conditions: ${Array.isArray(trial.conditions) ? trial.conditions.join(', ') : (trial.conditions || 'Not specified')}
- Drugs/Interventions: ${drugs || 'Not specified'}
- Trial URL: ${trialUrl || 'Not available'}
${trial.matchResult ? `- Match Score: ${trial.matchResult.matchPercentage || trial.matchResult.matchScore || 'Not calculated'}%` : ''}`;
    }).join('\n\n');
    
    return `

═══════════════════════════════════════════════════════════════════════════════
TRIAL CONTEXT: The user is asking about clinical trial search results
═══════════════════════════════════════════════════════════════════════════════

Found ${trialContext._searchResultsCount} matching clinical trials:

${trialsList}

${getTrialContextInstructions(true)}

═══════════════════════════════════════════════════════════════════════════════`;
  }
  
  // Handle single trial context (existing behavior)
  const interventions = trialContext.interventions || [];
  const drugs = interventions.map(int => {
    if (typeof int === 'string') return int;
    return int.name || int.description || JSON.stringify(int);
  }).filter(Boolean).join(', ');

  const trialUrl = trialContext.url || (trialContext.id ? `https://clinicaltrials.gov/study/${trialContext.id}` : null);
  
  return `

═══════════════════════════════════════════════════════════════════════════════
TRIAL CONTEXT: The user is asking about a specific clinical trial
═══════════════════════════════════════════════════════════════════════════════

Trial Information:
- Title: ${trialContext.title || 'Not specified'}
- Trial ID: ${trialContext.id || 'Not specified'}
- Phase: ${trialContext.phase || 'Not specified'}
- Status: ${trialContext.status || 'Not specified'}
- Conditions: ${Array.isArray(trialContext.conditions) ? trialContext.conditions.join(', ') : (trialContext.conditions || 'Not specified')}
- Drugs/Interventions: ${drugs || 'Not specified'}
- Summary: ${trialContext.summary || 'Not available'}
- Trial URL: ${trialUrl || 'Not available'}
${trialContext.eligibility ? `- Eligibility Criteria: ${typeof trialContext.eligibility === 'string' ? trialContext.eligibility : JSON.stringify(trialContext.eligibility)}` : ''}
${trialContext.matchResult ? `- Match Score: ${trialContext.matchResult.matchScore || 'Not calculated'}` : ''}

${getTrialContextInstructions(false)}
${trialUrl ? `\n   - For trial information: Include the trial study link: [View trial on ClinicalTrials.gov](${trialUrl})` : ''}

═══════════════════════════════════════════════════════════════════════════════`;
}

/**
 * Build health context section (async due to document fetching)
 * Now also generates structured insights using pattern recognition
 * @param {Object} healthContext - Health context data
 * @param {string} userId - User ID
 * @param {Object} patientProfile - Patient profile for insight depth setting
 * @returns {Object} - { contextString, insights } - Context string and structured insights array
 */
async function buildHealthContextSection(healthContext, userId, patientProfile = null, shouldGenerateInsights = false) {
  if (!healthContext) return { contextString: '', insights: [] };
  
  const complexity = patientProfile?.responseComplexity || 'standard';
  const insightDepth = complexityToInsightDepth(complexity);
  
  // Helper function to format date as YYYY-MM-DD (avoids timezone issues)
  const formatDateString = (date) => {
    if (!date) return null;
    try {
      // Handle Firestore Timestamp
      if (date.toDate) {
        const d = date.toDate();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
      // Handle Date object
      if (date instanceof Date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
      // Handle string (already in YYYY-MM-DD format or needs parsing)
      if (typeof date === 'string') {
        // If already in YYYY-MM-DD format, return as is
        if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return date;
        }
        // Otherwise parse it
        const d = new Date(date);
        if (!isNaN(d.getTime())) {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  };

  // Fetch all documents to get document dates and date ranges
  // This allows us to use the document date entered during upload, or date ranges for multi-date documents
  let documentDateMap = {};
  let documentDateRangeMap = {};
  let dicomScans = [];
  try {
    const { documentService } = await import('../firebase/services');
    const documents = await documentService.getDocuments(userId);
    // Create maps of documentId -> document date and date ranges
    // Also collect DICOM scans for bot context
    documents.forEach(doc => {
      if (doc.id) {
        // For multi-date documents, use the date range
        if (doc.hasMultipleDates && doc.minDate && doc.maxDate) {
          const minDate = doc.minDate?.toDate ? doc.minDate.toDate() : new Date(doc.minDate);
          const maxDate = doc.maxDate?.toDate ? doc.maxDate.toDate() : new Date(doc.maxDate);
          const minDateStr = formatDateString(minDate);
          const maxDateStr = formatDateString(maxDate);
          if (minDateStr && maxDateStr) {
            documentDateRangeMap[doc.id] = { minDate: minDateStr, maxDate: maxDateStr };
            // Also store the range as a string for the date map
            if (minDateStr === maxDateStr) {
              documentDateMap[doc.id] = minDateStr;
            } else {
              documentDateMap[doc.id] = `${minDateStr} to ${maxDateStr}`;
            }
          }
        } else if (doc.date) {
          // Single date document
          const docDate = formatDateString(doc.date);
          if (docDate) {
            documentDateMap[doc.id] = docDate;
          }
        }
        
        // Collect DICOM scans
        if (doc.dicomMetadata) {
          const metadata = doc.dicomMetadata;
          dicomScans.push({
            modality: metadata.modality || 'Unknown',
            studyDate: metadata.studyDateFormatted || metadata.studyDate || formatDateString(doc.date) || 'Unknown date',
            studyDescription: metadata.studyDescription || null,
            bodyPart: metadata.bodyPartExamined || null,
            institution: metadata.institutionName || null
          });
        }
      }
    });
  } catch (error) {
    // Continue without document dates - will fall back to value dates
  }

  // Labs/Vitals are the source of truth. Prefer value-level dates first,
  // then fall back to document dates only when value dates are missing.
  const toMillis = (rawDate) => {
    if (!rawDate) return 0;
    if (rawDate?.toDate) {
      const d = rawDate.toDate();
      return isNaN(d.getTime()) ? 0 : d.getTime();
    }
    const d = rawDate instanceof Date ? rawDate : new Date(rawDate);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  };

  const getValueIsoDate = (value) => {
    return (
      formatDateString(value?.date) ||
      formatDateString(value?.updatedAt) ||
      formatDateString(value?.createdAt) ||
      null
    );
  };

  // Format labs data grouped by metric (same conceptual grouping as Labs tab cards).
  // This avoids counting duplicate lab documents as separate metrics in chat responses.
  const { normalizeLabName, shouldMergeLabNames, getLabDisplayName } = await import('../utils/normalizationUtils');
  const rawLabs = Array.isArray(healthContext.labs) ? healthContext.labs : [];
  const groupedLabs = {};
  const MAX_VALUES_PER_LAB_IN_CONTEXT = 25;

  for (const lab of rawLabs) {
    const normalizedLabType = normalizeLabName(lab.labType || lab.label || lab.name) ||
      (lab.labType || lab.label || lab.name || 'unknown').toString().toLowerCase().replace(/[\s\-_/.]/g, '');

    let mergedKey = normalizedLabType;
    for (const existingKey of Object.keys(groupedLabs)) {
      const existingLab = groupedLabs[existingKey];
      const labTypeMatch = shouldMergeLabNames(lab.labType, existingKey) ||
        shouldMergeLabNames(lab.label, existingKey) ||
        shouldMergeLabNames(lab.name, existingKey);
      const existingMatch = shouldMergeLabNames(existingLab.labType, normalizedLabType) ||
        shouldMergeLabNames(existingLab.label, normalizedLabType) ||
        shouldMergeLabNames(existingLab.name, normalizedLabType);

      if (labTypeMatch || existingMatch) {
        mergedKey = existingKey;
        break;
      }
    }

    if (!groupedLabs[mergedKey]) {
      groupedLabs[mergedKey] = {
        key: mergedKey,
        labType: lab.labType || mergedKey,
        label: lab.label || lab.name || lab.labType || mergedKey,
        name: lab.name || lab.label || lab.labType || mergedKey,
        unit: lab.unit || '',
        normalRange: lab.normalRange || '',
        status: lab.status || '',
        currentValue: lab.currentValue,
        values: []
      };
    }

    const values = Array.isArray(lab.values) && lab.values.length > 0
      ? lab.values
      : Array.isArray(lab.data) && lab.data.length > 0
        ? lab.data
        : [];

    if (values.length > 0) {
      groupedLabs[mergedKey].values.push(...values);
    } else if (lab.currentValue !== null && lab.currentValue !== undefined && lab.currentValue !== '') {
      groupedLabs[mergedKey].values.push({
        value: lab.currentValue,
        date: lab.createdAt || lab.updatedAt || null,
        notes: null,
        documentId: null
      });
    }

    if (!groupedLabs[mergedKey].normalRange && lab.normalRange) {
      groupedLabs[mergedKey].normalRange = lab.normalRange;
    }
    if (!groupedLabs[mergedKey].status && lab.status) {
      groupedLabs[mergedKey].status = lab.status;
    }
    if ((groupedLabs[mergedKey].currentValue === null || groupedLabs[mergedKey].currentValue === undefined || groupedLabs[mergedKey].currentValue === '') &&
      lab.currentValue !== null && lab.currentValue !== undefined && lab.currentValue !== '') {
      groupedLabs[mergedKey].currentValue = lab.currentValue;
    }
  }

  const groupedLabEntries = Object.entries(groupedLabs)
    .map(([key, lab]) => {
      const dedupedValuesMap = new Map();
      (Array.isArray(lab.values) ? lab.values : []).forEach((value) => {
        const dateKey = getValueIsoDate(value) || 'unknown-date';
        const dedupKey = `${dateKey}::${value?.value ?? ''}::${value?.notes ?? ''}::${value?.documentId ?? ''}`;
        if (!dedupedValuesMap.has(dedupKey)) {
          dedupedValuesMap.set(dedupKey, value);
        }
      });

      const dedupedValues = Array.from(dedupedValuesMap.values()).sort((a, b) => {
        const valueDateDiff = toMillis(b?.date) - toMillis(a?.date);
        if (valueDateDiff !== 0) return valueDateDiff;
        return toMillis(b?.updatedAt || b?.createdAt) - toMillis(a?.updatedAt || a?.createdAt);
      });

      return [key, { ...lab, values: dedupedValues }];
    })
    .sort((a, b) => {
      const labelA = getLabDisplayName(a[1].label || a[1].labType || a[0]);
      const labelB = getLabDisplayName(b[1].label || b[1].labType || b[0]);
      return labelA.localeCompare(labelB);
    });

  const labsCount = groupedLabEntries.length;
  const hiddenLabKeys = Array.isArray(patientProfile?.hiddenLabs) ? patientProfile.hiddenLabs : [];
  const trackedLabKeys = new Set(groupedLabEntries.map(([key]) => key));
  const hiddenLabsCount = hiddenLabKeys.filter((key) => trackedLabKeys.has(key)).length;
  const visibleLabsCount = Math.max(labsCount - hiddenLabsCount, 0);

  const labMetricNames = labsCount > 0
    ? groupedLabEntries.map(([key, lab]) => getLabDisplayName(lab.label || lab.labType || key)).join(', ')
    : 'No lab metrics available';

  const labsSummary = labsCount > 0
    ? groupedLabEntries.map(([key, lab]) => {
      const values = Array.isArray(lab.values) ? lab.values : [];
      const displayName = getLabDisplayName(lab.label || lab.labType || key);

      if (values.length === 0) {
        return `${displayName}: ${lab.currentValue || 'N/A'} ${lab.unit || ''} (no historical data)`;
      }

      const visibleValues = values.slice(0, MAX_VALUES_PER_LAB_IN_CONTEXT);
      const formattedValues = visibleValues.map((value) => {
        const valueStr = `${value.value} ${lab.unit || ''}`;

        // Source of truth: use the value-level date first (including manual edits).
        // Fallback to document date/range only when the value has no usable date.
        let dateStr = getValueIsoDate(value);
        if (!dateStr && value?.documentId) {
          if (documentDateRangeMap[value.documentId]) {
            const range = documentDateRangeMap[value.documentId];
            dateStr = `${range.minDate} to ${range.maxDate}`;
          } else if (documentDateMap[value.documentId]) {
            dateStr = documentDateMap[value.documentId];
          }
        }

        const dateDisplay = dateStr ? ` on ${dateStr}` : '';

        // Format note: extract just the context part if it's in "Extracted from document. Context: {note}" format
        let noteStr = '';
        if (value?.notes && value.notes !== 'Extracted from document') {
          if (value.notes.includes('Context: ')) {
            const contextPart = value.notes.split('Context: ')[1];
            noteStr = ` (Note: ${contextPart})`;
          } else {
            noteStr = ` (Note: ${value.notes})`;
          }
        }

        return `${valueStr}${dateDisplay}${noteStr}`;
      }).join('; ');

      const remainingCount = values.length - visibleValues.length;
      const omittedSuffix = remainingCount > 0
        ? `; ... (${remainingCount} older value${remainingCount !== 1 ? 's' : ''} omitted)`
        : '';

      const normalRangeStr = lab.normalRange ? ` (Normal range: ${lab.normalRange})` : '';
      const statusStr = lab.status ? ` [Status: ${lab.status}]` : '';

      return `${displayName}: ${formattedValues}${omittedSuffix}${normalRangeStr}${statusStr}`;
    }).join('\n')
    : 'No lab data available';

  // Format vitals data - show ALL historical values with dates and notes
  // Source of truth is value-level data; document date is a fallback only.
  const vitalsCount = healthContext.vitals ? healthContext.vitals.length : 0;
  const vitalsSummary = vitalsCount > 0
    ? healthContext.vitals.map(vital => {
        const values = vital.values && Array.isArray(vital.values) && vital.values.length > 0
          ? vital.values
          : [];
        
        if (values.length === 0) {
          // No values, just show current if available
          return `${vital.label || vital.vitalType}: ${vital.currentValue || 'N/A'} ${vital.unit || ''} (no historical data)`;
        }
        
        // Format ALL values with dates and notes (sorted by date, newest first)
        const sortedValues = [...values].sort((a, b) => {
          const valueDateDiff = toMillis(b?.date) - toMillis(a?.date);
          if (valueDateDiff !== 0) return valueDateDiff;
          return toMillis(b?.updatedAt || b?.createdAt) - toMillis(a?.updatedAt || a?.createdAt);
        });
        
        const formattedValues = sortedValues.map((value) => {
          // Handle blood pressure specially (systolic/diastolic)
          let valueStr = '';
          if (vital.vitalType === 'bp' || vital.vitalType === 'bloodpressure') {
            if (value.systolic && value.diastolic) {
              valueStr = `${value.systolic}/${value.diastolic}`;
            } else if (value.value) {
              valueStr = value.value;
            } else {
              valueStr = 'N/A';
            }
          } else {
            valueStr = value.value || 'N/A';
          }
          valueStr += ` ${vital.unit || ''}`;
          
          // Source of truth: use value-level date first, then document fallback.
          let dateStr = getValueIsoDate(value);
          if (!dateStr && value?.documentId) {
            if (documentDateRangeMap[value.documentId]) {
              const range = documentDateRangeMap[value.documentId];
              dateStr = `${range.minDate} to ${range.maxDate}`;
            } else if (documentDateMap[value.documentId]) {
              dateStr = documentDateMap[value.documentId];
            }
          }
          
          const dateDisplay = dateStr ? ` on ${dateStr}` : '';
          
          // Format note: extract just the context part if it's in "Extracted from document. Context: {note}" format
          let noteStr = '';
          if (value?.notes && value.notes !== 'Extracted from document') {
            // If note contains "Context: ", extract just the context part for cleaner display
            if (value.notes.includes('Context: ')) {
              const contextPart = value.notes.split('Context: ')[1];
              noteStr = ` (Note: ${contextPart})`;
            } else {
              noteStr = ` (Note: ${value.notes})`;
            }
          }
          
          return `${valueStr}${dateDisplay}${noteStr}`;
        }).join('; ');
        
        // Include normal range if available
        const normalRangeStr = vital.normalRange ? ` (Normal range: ${vital.normalRange})` : '';
        
        return `${vital.label || vital.vitalType}: ${formattedValues}${normalRangeStr}`;
      }).join('\n')
    : 'No vital signs data available';

  // Format symptoms data - show count and recent ones only
  const symptomsCount = healthContext.symptoms ? healthContext.symptoms.length : 0;
  const recentSymptoms = healthContext.symptoms && healthContext.symptoms.length > 0
    ? healthContext.symptoms.slice(-5).map(symptom => {
        return `${symptom.name} (${symptom.severity || 'Not specified'})`;
      }).join(', ')
    : 'No symptoms recorded';

  // Load additional data for pattern recognition (medications, notes)
  let medications = [];
  let notes = [];
  try {
    const { medicationService, journalNoteService } = await import('../firebase/services');
    [medications, notes] = await Promise.all([
      medicationService.getMedications(userId).catch(() => []),
      journalNoteService.getJournalNotes(userId).catch(() => [])
    ]);
  } catch (error) {
    // Continue without medications/notes if loading fails
  }

  // Format medications data - show active medications with details
  const activeMedications = medications.filter(med => med.active && (med.status || 'active') !== 'stopped');
  const medicationsCount = activeMedications.length;
  const medicationsSummary = activeMedications.length > 0
    ? activeMedications.map(med => {
        const scheduleText = med.schedule && med.schedule !== med.frequency && med.schedule.includes(':')
          ? ` (Schedule: ${med.schedule})`
          : '';
        const statusText = med.status === 'paused' ? ' [PAUSED]' : '';
        return `${med.name}: ${med.dosage}, ${med.frequency}${scheduleText}${statusText}`;
      }).join('\n')
    : 'No active medications';

  // Note: Insights are now only generated when patterns are specifically requested
  // Build DICOM scans context section
  let dicomContextSection = '';
  if (dicomScans.length > 0) {
    dicomContextSection = '\n\nDICOM Scans:\n';
    dicomScans.forEach((scan, index) => {
      dicomContextSection += `${index + 1}. ${scan.modality}${scan.bodyPart ? ` - ${scan.bodyPart}` : ''} (${scan.studyDate})`;
      if (scan.studyDescription) {
        dicomContextSection += `: ${scan.studyDescription}`;
      }
      if (scan.institution) {
        dicomContextSection += ` [${scan.institution}]`;
      }
      dicomContextSection += '\n';
    });
  }

  // Only generate insights if specifically requested (patterns/trends/correlations)
  let structuredInsights = [];
  
  if (shouldGenerateInsights) {
    try {
      // Check cache first
      const cacheKey = generateCacheKey(userId, 'health', {
        labs: healthContext.labs || [],
        vitals: healthContext.vitals || [],
        symptoms: healthContext.symptoms || [],
        notes,
        medications,
        dicomScans: dicomScans.length
      });
      
      let insights = getCachedInsights(cacheKey);
      
      if (!insights) {
        // Detect patterns
        const rawPatterns = await detectAllPatterns({
          labs: healthContext.labs || [],
          vitals: healthContext.vitals || [],
          symptoms: healthContext.symptoms || [],
          notes,
          medications
        }, {
          insightDepth,
          timeWindowMonths: 18,
          medications,
          patientProfile
        });
        
        // Translate patterns to structured insights
        const translatedInsights = rawPatterns.map(pattern => {
          const translated = translatePattern(pattern.rawData || pattern, {
            medications,
            patientProfile
          });
          return {
            type: pattern.type,
            priority: pattern.priority || 5,
            headline: generateHeadline({ ...translated, ...pattern }),
            explanation: generateExplanation({ ...translated, ...pattern }),
            actionable: suggestAction({ ...translated, ...pattern }),
            confidence: pattern.confidence || translated.confidence,
            rawData: pattern.rawData || pattern,
            details: translated.details || generateExplanation({ ...translated, ...pattern }),
            ...translated
          };
        });
        
        // Validate and filter to only clinically meaningful insights with plain language
        insights = validateAndEnhanceInsights(translatedInsights);
        
        // Cache the insights
        setCachedInsights(cacheKey, insights);
      }
      
      // Ensure insights is an array before deduplication
      if (insights && Array.isArray(insights) && insights.length > 0) {
        // Deduplicate insights by headline/explanation to avoid repetitive insights
        const uniqueInsights = [];
        const seenContent = new Set();
        insights.forEach(insight => {
          // Check both headline and explanation for duplicates
          const headline = (insight.headline || '').toLowerCase().trim();
          const explanation = (insight.explanation || '').toLowerCase().trim();
          
          // Use headline as primary key, or explanation if headline is empty
          const primaryKey = headline || explanation;
          
          // Also check if headline and explanation are the same (to catch duplicates)
          const isDuplicate = headline && explanation && headline === explanation;
          
          // Create a unique key that combines both if they're different
          const contentKey = headline && explanation && headline !== explanation 
            ? `${headline}|||${explanation}` 
            : primaryKey;
          
          if (contentKey && contentKey.length > 0 && !seenContent.has(contentKey)) {
            seenContent.add(contentKey);
            // If headline and explanation are identical, keep only headline
            if (isDuplicate && insight.headline) {
              uniqueInsights.push({
                ...insight,
                explanation: null // Remove duplicate explanation
              });
            } else {
              uniqueInsights.push(insight);
            }
          }
        });
        
        // Limit to top 3 for initial display, sorted by priority
        structuredInsights = uniqueInsights
          .sort((a, b) => (a.priority || 5) - (b.priority || 5))
          .slice(0, 3);
      }
    } catch (error) {
      logger.error('Error generating insights:', error);
      // Continue without insights if pattern detection fails
      structuredInsights = [];
    }
  }

  const contextString = `

═══════════════════════════════════════════════════════════════════════════════
HEALTH CONTEXT: The user is asking about their health data (labs, vitals, symptoms, medications)
═══════════════════════════════════════════════════════════════════════════════

LAB METRICS (${labsCount} total; ${visibleLabsCount} visible${hiddenLabsCount > 0 ? `; ${hiddenLabsCount} hidden` : ''}):
${labMetricNames}

LAB VALUES (grouped by metric):
${labsSummary}

VITAL SIGNS (${vitalsCount} tracked):
${vitalsSummary}

SYMPTOMS (${symptomsCount} total, recent: ${recentSymptoms})

MEDICATIONS (${medicationsCount} active):
${medicationsSummary}
${dicomContextSection}
${getHealthContextInstructions()}

═══════════════════════════════════════════════════════════════════════════════`;

  return { contextString, insights: structuredInsights };
}

/**
 * Build notebook context section
 */
function buildNotebookContextSection(notebookContext) {
  if (!notebookContext) return '';
  
  // Helper function to format date as YYYY-MM-DD
  const formatDateString = (date) => {
    if (!date) return null;
    try {
      if (date instanceof Date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
      if (typeof date === 'string') {
        if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return date;
        }
        const d = new Date(date);
        if (!isNaN(d.getTime())) {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  };

  const entries = notebookContext.entries || [];
  const entriesCount = entries.length;
  
  if (entriesCount > 0) {
    // Format entries by date (newest first, already sorted)
    const formattedEntries = entries.map(entry => {
      const dateStr = formatDateString(entry.date) || entry.dateKey || 'Unknown date';
      
      const parts = [];
      
      // Notes section
      if (entry.notes && entry.notes.length > 0) {
        const noteList = entry.notes.map(note => {
          const sourceLabel = note.sourceName || (note.source === 'journal' ? 'Journal Entry' : note.source === 'document' ? 'Document Note' : note.source === 'symptom' ? 'Symptom Note' : 'Note');
          return `"${note.content}" (From: ${sourceLabel})`;
        }).join('; ');
        parts.push(`- Notes: ${noteList}`);
      }
      
      // Documents section
      if (entry.documents && entry.documents.length > 0) {
        const docList = entry.documents.map(doc => {
          const dataPointText = doc.dataPointCount > 0 ? ` (${doc.dataPointCount} data point${doc.dataPointCount !== 1 ? 's' : ''} extracted)` : '';
          return `${doc.name} (${doc.type}${dataPointText})`;
        }).join(', ');
        parts.push(`- Documents: ${docList}`);
      }
      
      // Symptoms section
      if (entry.symptoms && entry.symptoms.length > 0) {
        const symptomList = entry.symptoms.map(symptom => {
          const severityText = symptom.severity ? ` (${symptom.severity})` : '';
          return `${symptom.type}${severityText}`;
        }).join(', ');
        parts.push(`- Symptoms: ${symptomList}`);
      }
      
      return `${dateStr}:\n${parts.length > 0 ? parts.join('\n') : '  (No entries for this date)'}`;
    }).join('\n\n');
    
    return `

═══════════════════════════════════════════════════════════════════════════════
NOTEBOOK CONTEXT: The user is asking about their health history/timeline
═══════════════════════════════════════════════════════════════════════════════

HEALTH JOURNAL ENTRIES (${entriesCount} date${entriesCount !== 1 ? 's' : ''} with entries, organized by date, newest first):

${formattedEntries}

${getNotebookContextInstructions()}

═══════════════════════════════════════════════════════════════════════════════`;
  } else {
    return `

═══════════════════════════════════════════════════════════════════════════════
NOTEBOOK CONTEXT: The user is asking about their health history/timeline
═══════════════════════════════════════════════════════════════════════════════

No journal entries found yet. The user can start building their health journal by uploading documents, logging symptoms, or adding journal notes.

═══════════════════════════════════════════════════════════════════════════════`;
  }
}

// ============================================================================
// HELPER FUNCTIONS - Intent Detection
// ============================================================================

/**
 * Detect chat intent from message and trial context
 * Returns an object with boolean flags for different intent types
 */
function detectChatIntent(message, trialContext) {
  // Detect if message requires trial data (but not if trialContext is already provided)
  const requiresTrialData = !trialContext && /(saved trial|saved trials|my trial|my trials|clinical trial|clinical trials|trial i saved|trials i saved|what trials|which trials|show me trials|tell me about trials)/i.test(message);

    // Detect if user is ADDING data (not asking about it)
    // These patterns indicate the user is providing new data to be saved
    const isAddingData = /(my (ca-125|hemoglobin|wbc|platelets|blood pressure|heart rate|temperature|temp|weight|bp|hr) (was|is)|i (had|have|started|am taking|took)|i'm (experiencing|taking)|my (symptom|symptoms)|started taking|taking [a-z]+ (mg|ml|units?)|log|add|record|note (that|down)|journal|write down)/i.test(message);
    
    // Detect if message requires health data ANALYSIS (asking about existing USER'S data, not general questions)
    // Only trigger if user is asking about THEIR OWN data (uses "my", "my labs", etc.), not general health questions
    // General questions like "what is prognosis" or "what are treatment options" should NOT require health data
    // Questions about "my" data, trends in user's data, or analysis of user's specific values require health data
    // Also detect comparison/retrieval queries and edit queries that need health data
    // Support both "my" and "her" for patient data queries, and specific lab/marker names
    const hasUserDataReference = /(my (lab|labs|vital|vitals|symptom|symptoms|health|treatment|medication|medications|data|results|values|numbers|test|tests|current|recent|trends|progress|marker|markers|metric|metrics)|her (lab|labs|vital|vitals|marker|markers|metric|metrics|bilirubin|albumin|alb|liver|function|reading|readings|latest|current)|what do my|how are my|how's my|tell me about my|explain my|analyze my|my ca-125|my hemoglobin|my blood|my tests|my results|what's her|what is her|whats her|look at (her|the|my)|check (her|the|my)|show (her|the|my))/i.test(message);
    const isComparisonOrRetrievalQuery = /(compare|comparison|how does|how did|versus|vs|difference|change from|compared to|last (measurement|value|result|test|date|two|three|few)|previous|before that|one before|earlier|prior|historical|retrieve|show me|tell me about|what (was|were)|the (last|previous|earlier)|and the (one|next)|yes please|yes|yep|yeah|yup|sure|ok|okay)/i.test(message);
    const isEditQuery = /(edit|update|change|correct|fix|modify|replace|set to|change (my|the) (.*) (to|from)|update (my|the) (.*) (to|from)|correct (my|the) (.*)|fix (my|the) (.*))/i.test(message);
    const isDeleteQuery = /(delete|remove|clean up|remove duplicate|remove duplicates|delete duplicate|delete duplicates|clean|deduplicate|dedupe)/i.test(message);
    const isBulkScanQuery = /(scan\s+(?:all|all my|every|each|the|my)?\s*(?:file|document|files|documents)|rescan\s+(?:all|all my|every|each|the|my)?\s*(?:file|document|files|documents)|extract\s+(?:from\s+)?(?:all|every|each|the|my)?\s*(?:file|document|files|documents)|process\s+(?:all|all my|every|each|the|my)?\s*(?:file|document|files|documents)|bulk\s+(?:scan|extract|process)|scan\s+(?:all|all my|every|each)|rescan\s+(?:all|all my|every|each)|extract\s+from\s+(?:all|every|each)|process\s+(?:all|all my|every|each)\s+(?:file|document|files|documents))/i.test(message);
    const isGeneralQuestion = /(what (is|are|would|could|should)|how (does|do|would|could|should)|why (does|do|would|could)|where (is|are)|when (is|are)|prognosis|treatment options|side effects|symptoms of|signs of|typical|common|average|normal|usually|typically|general|in general)/i.test(message);
    const requiresHealthData = !isAddingData && (hasUserDataReference || isComparisonOrRetrievalQuery || isEditQuery || isDeleteQuery) && !isGeneralQuestion && !isBulkScanQuery;
    
  // Check if question requires specific data type that isn't available
  // Only check if user is asking about data, not adding it
  const requiresLabs = !isAddingData && /(lab|labs|ca-125|hemoglobin|wbc|platelets|blood test|test result|bilirubin|albumin|alb|liver|kidney|renal|function|ast|alt|creatinine|egfr|bun|ldh|crp|glucose|a1c|marker|tumor marker|cea|afp|psa)/i.test(message);
  const requiresVitals = !isAddingData && /(vital|vitals|blood pressure|heart rate|pulse|temperature|temp|weight|oxygen|spo2)/i.test(message);
  const requiresSymptoms = !isAddingData && /(symptom|symptoms|feeling|pain|nausea|fatigue)/i.test(message);
  
  // Check for insufficient data for trend analysis
  // Only check if user is asking about trends, not adding data
  const requiresTrendAnalysis = !isAddingData && /(trend|progress|over time|changing|increasing|decreasing|pattern)/i.test(message);
  
  // Detect if question is specifically asking about patterns, correlations, or relationships
  const requiresPatternInsights = !isAddingData && /(pattern|patterns|correlation|correlations|relationship|relationships|connection|connections|related|associate|associated|link|linked|when.*happens.*(then|often|usually|typically)|tend to|tends to|often (follow|follows|occur|occurs|happen|happens)|usually (follow|follows|occur|occurs|happen|happens)|typically (follow|follows|occur|occurs|happen|happens)|what patterns|what correlations|what relationships|any patterns|any correlations|any relationships|do you see.*pattern|do you see.*correlation|do you see.*relationship|notice.*pattern|notice.*correlation|notice.*relationship|detect.*pattern|detect.*correlation|detect.*relationship)/i.test(message);
  
  return {
    isAddingData,
    requiresHealthData,
    requiresLabs,
    isBulkScanQuery,
    requiresVitals,
    requiresSymptoms,
    requiresTrendAnalysis,
    requiresTrialData,
    requiresPatternInsights
  };
}

function toIsoDateOnly(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function isInDateRange(value, startDate, endDate) {
  if (!startDate && !endDate) return true;
  const iso = toIsoDateOnly(value);
  if (!iso) return false;
  if (startDate && iso < startDate) return false;
  if (endDate && iso > endDate) return false;
  return true;
}

function inferRequestedDateRange(message) {
  const text = String(message || '').toLowerCase();
  if (!text) return null;

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const toIso = (d) => d.toISOString().slice(0, 10);

  const explicitRangeMatch = text.match(
    /\b(?:from|between)\s+(\d{4}-\d{2}-\d{2})\s+(?:to|through|until|and|-)\s+(\d{4}-\d{2}-\d{2})\b/
  );
  if (explicitRangeMatch) {
    const a = explicitRangeMatch[1];
    const b = explicitRangeMatch[2];
    return a <= b ? { startDate: a, endDate: b } : { startDate: b, endDate: a };
  }

  const relativeMatch = text.match(/\b(?:last|past)\s+(\d{1,3})\s*(day|days|week|weeks|month|months|year|years)\b/);
  if (relativeMatch) {
    const amount = Math.max(1, Math.min(3650, Number(relativeMatch[1]) || 0));
    const unit = relativeMatch[2];
    const dayFactor = unit.startsWith('day') ? 1 : unit.startsWith('week') ? 7 : unit.startsWith('month') ? 30 : 365;
    const start = new Date(today);
    start.setUTCDate(start.getUTCDate() - ((amount * dayFactor) - 1));
    return { startDate: toIso(start), endDate: toIso(today) };
  }

  if (/\btoday\b/.test(text)) {
    return { startDate: toIso(today), endDate: toIso(today) };
  }

  if (/\byesterday\b/.test(text)) {
    const y = new Date(today);
    y.setUTCDate(y.getUTCDate() - 1);
    return { startDate: toIso(y), endDate: toIso(y) };
  }

  if (/\bthis month\b/.test(text)) {
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    return { startDate: toIso(start), endDate: toIso(today) };
  }

  if (/\blast month\b/.test(text)) {
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
    const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0));
    return { startDate: toIso(start), endDate: toIso(end) };
  }

  return null;
}

function filterHealthContextByDateRange(healthContext, dateRange) {
  if (!healthContext || !dateRange) return healthContext;
  const { startDate, endDate } = dateRange;

  const filterValues = (values) => (values || []).filter((v) => isInDateRange(v?.date, startDate, endDate));

  const labs = (healthContext.labs || [])
    .map((lab) => {
      const values = filterValues(lab.values || lab.data || []);
      if ((lab.values || lab.data) && values.length === 0) return null;
      return {
        ...lab,
        ...(lab.values ? { values } : {}),
        ...(lab.data ? { data: values } : {})
      };
    })
    .filter(Boolean);

  const vitals = (healthContext.vitals || [])
    .map((vital) => {
      const values = filterValues(vital.values || vital.data || []);
      if ((vital.values || vital.data) && values.length === 0) return null;
      return {
        ...vital,
        ...(vital.values ? { values } : {}),
        ...(vital.data ? { data: values } : {})
      };
    })
    .filter(Boolean);

  const symptoms = (healthContext.symptoms || []).filter((s) => isInDateRange(s?.date, startDate, endDate));

  return { ...healthContext, labs, vitals, symptoms };
}

function sanitizeLegacyInsight(insight) {
  if (typeof insight !== 'string') return null;
  const normalized = insight.replace(/\s+/g, ' ').trim();
  if (!normalized) return null;

  const blockedPatterns = [
    /\bphysiologically improbable\b/i,
    /\btranscription error\b/i,
    /\b(normocytic|microcytic|macrocytic)\s+anemia\b/i,
    /\bsuggesting\b.+\b(anemia|diagnosis|disease|progression)\b/i
  ];

  if (blockedPatterns.some((pattern) => pattern.test(normalized))) {
    return null;
  }

  // Legacy single-insight text should be brief and non-diagnostic.
  if (normalized.length > 180) return null;
  return normalized;
}

// ============================================================================
// HELPER FUNCTIONS - Early Exit Responses
// ============================================================================

// Response functions are now imported from prompts/responses/noDataResponses

// ============================================================================
// HELPER FUNCTIONS - Prompt Construction
// ============================================================================

/**
 * Build the final chat prompt
 * Now uses extracted prompts from prompts/chat/mainPrompt.js
 */
function buildChatPrompt({
  message,
  conversationHistory,
  patientProfile,
  patientDemographicsSection,
  trialContextSection,
  healthContextSection,
  notebookContextSection,
  userRoleContext,
  responseComplexity = null,
  dicomContextSection = null
}) {
  const complexity = responseComplexity || patientProfile?.responseComplexity || 'standard';
  
  // Get task description using extracted function
  const taskDescription = getTaskDescription(message, trialContextSection, healthContextSection, notebookContextSection);
  
  // Build main prompt (insight depth is derived from complexity)
  return buildMainPrompt({
    message,
    userRoleContext,
    taskDescription,
    patientDemographicsSection,
    trialContextSection,
    healthContextSection,
    notebookContextSection,
    dicomContextSection,
    conversationHistory,
    patientProfile,
    responseComplexity: complexity
  });
}

/**
 * Process a chat message to extract and save medical data
 * @param {string} message - User's message
 * @param {string} userId - User ID
 * @param {Array} conversationHistory - Previous conversation messages
 * @param {Object} trialContext - Optional trial context (when asking about a specific trial)
 * @param {Object} healthContext - Optional health context (labs, vitals, symptoms)
 * @param {Object} notebookContext - Optional notebook context (timeline entries, journal notes, documents)
 * @param {Object} patientProfile - Patient demographics (age, gender, weight) for normal range adjustments
 * @param {Object} dicomContext - Optional DICOM context (metadata, viewer state) for medical imaging chat
 * @param {Object} imageAttachment - Optional simple image attachment { base64: string, mimeType: string, fileName: string }
 */
export async function processChatMessage(message, userId, conversationHistory = [], trialContext = null, healthContext = null, notebookContext = null, patientProfile = null, abortSignal = null, dicomContext = null, imageAttachment = null) {
  try {
    // Determine if we need vision model (if DICOM image data or simple image attachment is provided)
    const hasImage = dicomContext?.imageData?.imageData || (dicomContext?.images && dicomContext.images.length > 0) || imageAttachment?.base64;
    const modelName = 'gemini-3-flash-preview'; // Same model for text and image; request format differs by hasImage

    // Detect intent from message
    const { 
      isAddingData, 
      requiresHealthData, 
      requiresLabs,
      requiresVitals,
      requiresSymptoms,
      requiresTrendAnalysis,
      requiresTrialData,
      isBulkScanQuery,
      requiresPatternInsights
    } = detectChatIntent(message, trialContext);
    const requestedDateRange = inferRequestedDateRange(message);
    let toolPathFailed = false;

    // --- Tool-backed chat path (read/analysis queries only) ---
    const toolChatEnabled = (typeof window !== 'undefined' && window.__IRIS_TOOL_CHAT_ENABLED) ||
      process.env.REACT_APP_IRIS_TOOL_CHAT_ENABLED === 'true';

    const isEligibleForToolPath = toolChatEnabled &&
      !isAddingData &&
      !isBulkScanQuery &&
      !dicomContext &&
      !imageAttachment &&
      (requiresHealthData || requiresLabs || requiresVitals || requiresSymptoms || requiresTrendAnalysis || requiresPatternInsights);

    if (isEligibleForToolPath) {
      try {
        const toolResult = await callToolChat({
          message,
          conversationHistory: conversationHistory.slice(-10).map(msg => ({
            role: msg.type === 'ai' || msg.role === 'assistant' ? 'assistant' : 'user',
            content: msg.content || msg.text || ''
          })),
          patientProfile,
          trialContext,
          notebookContext,
          abortSignal
        });

        return {
          response: toolResult.response,
          extractedData: toolResult.extractedData || null,
          savedData: null,
          insight: toolResult.insight || null,
          insights: toolResult.insights || null,
          source: toolResult.source || 'tool-backed',
          requestId: toolResult.requestId || null,
          requestedDateRange: toolResult.requestedDateRange || null,
          toolCallCount: toolResult.toolCallCount || 0,
          toolsUsed: Array.isArray(toolResult.toolsUsed) ? toolResult.toolsUsed : []
        };
      } catch (toolError) {
        logger.warn('[chatProcessor] Tool chat failed; falling back to legacy context path:', toolError.message);
        toolPathFailed = true;
      }
    }

    // Check if this is a recovery query about deleted/lost data (NOT medical recovery questions)
    // Use word boundaries and require context words like "deleted", "values", "data", etc.
    // to avoid matching medical questions like "is kidney damage recoverable?"
    const isRecoveryQuery = (
      // Explicit recovery phrases about deleted data
      /(restore deleted|undo delete|recover deleted|get my values back|how can i undo|how do i recover|recover my (data|values|labs?)|restore my (data|values|labs?)|undo (the )?deletion|get back my (data|values|labs?)|bring back my (data|values|labs?))/i.test(message) ||
      // Generic recovery words BUT only if also mentioning data/values/deletion
      (/(undo|recover|restore|get back|bring back|revert)\b/i.test(message) && /(data|values?|labs?|delete|deleted|lost|removed|missing|gone)/i.test(message))
    );
    
    if (isRecoveryQuery) {
      return {
        response: buildRecoveryInstructionsResponse(),
        extractedData: null,
        insight: 'Recovery instructions provided - values can be restored by rescanning source documents',
        source: 'legacy-context'
      };
    }
    
    // Check if this is a bulk scan query
    if (isBulkScanQuery && userId) {
      return await handleBulkScanRequest(message, userId, patientProfile);
    }
    
    // Check if saved trials exist (only if question requires trial data)
    if (requiresTrialData && userId) {
      try {
        const savedTrials = await getSavedTrials(userId);
        if (!savedTrials || savedTrials.length === 0) {
      return {
            response: buildNoTrialDataResponse(),
        extractedData: null,
        source: 'legacy-context'
      };
        }
      } catch (error) {
        // Continue with normal processing if there's an error
      }
    }

    // Fallback behavior: if tool path failed for a read query, lazy-load health context so Iris still answers.
    if (
      toolPathFailed &&
      !healthContext &&
      userId &&
      !dicomContext &&
      (requiresHealthData || requiresLabs || requiresVitals || requiresSymptoms || requiresTrendAnalysis || requiresPatternInsights)
    ) {
      try {
        const [labs, vitals, symptoms] = await Promise.all([
          labService.getLabs(userId),
          vitalService.getVitals(userId),
          symptomService.getSymptoms(userId)
        ]);

        const [labsWithValues, vitalsWithValues] = await Promise.all([
          Promise.all((labs || []).map(async (lab) => {
            if (!lab.id) return lab;
            const values = await labService.getLabValues(lab.id);
            return { ...lab, values: values || [] };
          })),
          Promise.all((vitals || []).map(async (vital) => {
            if (!vital.id) return vital;
            const values = await vitalService.getVitalValues(vital.id);
            return { ...vital, values: values || [] };
          }))
        ]);

        healthContext = {
          labs: labsWithValues,
          vitals: vitalsWithValues,
          symptoms: symptoms || []
        };
      } catch (fallbackLoadError) {
        logger.warn('[chatProcessor] Fallback health context load failed:', fallbackLoadError.message);
      }
    }

    // Apply explicit/relative date window to legacy fallback context.
    if (requestedDateRange && healthContext) {
      healthContext = filterHealthContextByDateRange(healthContext, requestedDateRange);
    }

    // Check if health data is available
    const hasLabs = healthContext?.labs && healthContext.labs.length > 0;
    const hasVitals = healthContext?.vitals && healthContext.vitals.length > 0;
    const hasSymptoms = healthContext?.symptoms && healthContext.symptoms.length > 0;
    const hasHealthData = hasLabs || hasVitals || hasSymptoms;

    // If question requires health data analysis but none is available, provide helpful response
    // BUT skip this if user is adding data (they're providing it now)
    // ALSO skip this if DICOM context is provided (this is a DICOM scan question, not health data)
    if (requiresHealthData && !hasHealthData && !dicomContext) {
      return {
        response: buildNoHealthDataResponse(),
        extractedData: null,
        source: 'legacy-context'
      };
    }
    
    if (requiresLabs && !hasLabs && hasHealthData && !dicomContext) {
      return {
        response: buildNoLabDataResponse(),
        extractedData: null,
        source: 'legacy-context'
      };
    }

    if (requiresVitals && !hasVitals && hasHealthData && !dicomContext) {
      return {
        response: buildNoVitalDataResponse(),
        extractedData: null,
        source: 'legacy-context'
      };
    }

    if (requiresSymptoms && !hasSymptoms && hasHealthData && !dicomContext) {
      return {
        response: buildNoSymptomDataResponse(),
        extractedData: null,
        source: 'legacy-context'
      };
    }

    if (requiresTrendAnalysis && hasHealthData && !dicomContext) {
      // Check if there's enough data for trend analysis (need at least 2-3 data points)
      let hasEnoughData = false;
      if (requiresLabs && hasLabs) {
        const labWithMultipleValues = healthContext.labs.find(lab => 
          (lab.values && lab.values.length >= 2) || 
          (lab.data && lab.data.length >= 2)
        );
        hasEnoughData = !!labWithMultipleValues;
      } else if (requiresVitals && hasVitals) {
        const vitalWithMultipleValues = healthContext.vitals.find(vital => 
          (vital.values && vital.values.length >= 2) || 
          (vital.data && vital.data.length >= 2)
        );
        hasEnoughData = !!vitalWithMultipleValues;
      } else {
        // For general health questions, check if any category has enough data
        const hasMultipleLabs = healthContext.labs?.some(lab => 
          (lab.values && lab.values.length >= 2) || 
          (lab.data && lab.data.length >= 2)
        );
        const hasMultipleVitals = healthContext.vitals?.some(vital => 
          (vital.values && vital.values.length >= 2) || 
          (vital.data && vital.data.length >= 2)
        );
        hasEnoughData = hasMultipleLabs || hasMultipleVitals || (healthContext.symptoms && healthContext.symptoms.length >= 2);
      }
      
      if (!hasEnoughData) {
        return {
          response: buildInsufficientTrendDataResponse(),
          extractedData: null,
          source: 'legacy-context'
        };
      }
    }

    // Build context sections
    const patientDemographicsSection = buildPatientDemographicsContext(patientProfile);
    const trialContextSection = buildTrialContextSection(trialContext);
    // Only generate insights when patterns are specifically requested
    const shouldGenerateInsights = requiresPatternInsights || requiresTrendAnalysis;
    const healthContextResult = await buildHealthContextSection(healthContext, userId, patientProfile, shouldGenerateInsights);
    const healthContextSection = healthContextResult.contextString || '';
    const structuredInsights = healthContextResult.insights || [];
    const notebookContextSection = buildNotebookContextSection(notebookContext);

    // Build DICOM context section if provided
    let dicomContextSection = null;
    if (dicomContext) {
      const isMultiSlice = dicomContext.images && Array.isArray(dicomContext.images) && dicomContext.images.length > 1;
      const hasMeasurements = dicomContext.viewerState?.measurements && Array.isArray(dicomContext.viewerState.measurements) && dicomContext.viewerState.measurements.length > 0;

      dicomContextSection = buildDicomContext(
        dicomContext.metadata,
        dicomContext.currentIndex,
        dicomContext.totalFiles,
        dicomContext.viewerState
      );

      // Add DICOM-specific instructions (with multi-slice and measurement flags)
      dicomContextSection = getDicomChatInstructions(isMultiSlice, hasMeasurements) + '\n\n' + dicomContextSection;

      // If multi-slice, add note about which slices are being analyzed
      if (isMultiSlice) {
        const sliceNumbers = dicomContext.images.map(img => img.sliceIndex).join(', ');
        dicomContextSection += `\n\nMULTI-SLICE CONTEXT: You are viewing ${dicomContext.images.length} slices from this series (slices: ${sliceNumbers}).`;
      }
    }

    // Build prompt for extraction
    // Determine user role for personalized responses
    const isPatient = patientProfile?.isPatient !== false; // Default to true if not set
    const userRoleContext = isPatient 
      ? 'You are speaking directly with the patient. Address them in first person (e.g., "your", "you").'
      : 'You are speaking with a caregiver who is helping manage the patient\'s care. Address them as a caregiver (e.g., "the patient", "their", "they") and acknowledge their role in supporting the patient.';

    const prompt = buildChatPrompt({
      message,
      conversationHistory,
      patientProfile,
      patientDemographicsSection,
      trialContextSection,
      healthContextSection,
      notebookContextSection,
      userRoleContext,
      dicomContextSection
    });

    // Check if aborted before making API call
    if (abortSignal?.aborted) {
      throw new Error('Request aborted');
    }

    let text;

    // If image data is provided, use multimodal request
    if (hasImage) {
      const contentParts = [prompt];

      // Handle simple image attachment (from chat upload)
      if (imageAttachment?.base64) {
        const base64Image = imageAttachment.base64.includes('base64,')
          ? imageAttachment.base64.split('base64,')[1]
          : imageAttachment.base64;

        contentParts.push({
          inlineData: {
            data: base64Image,
            mimeType: imageAttachment.mimeType || 'image/jpeg'
          }
        });

        if (imageAttachment.fileName) {
          contentParts.push(`Attached image: ${imageAttachment.fileName}`);
        }

        text = await generateGeminiText({
          model: modelName,
          content: contentParts,
          abortSignal
        });
      }
      // Handle multi-slice images (array)
      else if (dicomContext?.images && Array.isArray(dicomContext.images)) {
        // Add each slice image to the content
        dicomContext.images.forEach((slice, index) => {
          const imageData = slice.imageData;
          const base64Image = imageData.includes('base64,')
            ? imageData.split('base64,')[1]
            : imageData;

          contentParts.push({
            inlineData: {
              data: base64Image,
              mimeType: 'image/jpeg'
            }
          });

          // Add a text label for each slice (helps AI understand sequence)
          if (index === 0) {
            contentParts.push(`Image 1: Slice ${slice.sliceIndex}/${slice.totalSlices}${slice.isCurrent ? ' (CURRENT SLICE)' : ''}`);
          } else {
            contentParts.push(`Image ${index + 1}: Slice ${slice.sliceIndex}/${slice.totalSlices}${slice.isCurrent ? ' (CURRENT SLICE)' : ''}`);
          }
        });

        text = await generateGeminiText({
          model: modelName,
          content: contentParts,
          abortSignal
        });
      }
      // Handle single DICOM image (legacy support)
      else if (dicomContext?.imageData && dicomContext.imageData.imageData) {
        const imageData = dicomContext.imageData.imageData;

        // Convert base64 to inline data format for Gemini
        // Remove "data:image/jpeg;base64," prefix if present
        const base64Image = imageData.includes('base64,')
          ? imageData.split('base64,')[1]
          : imageData;

        const imagePart = {
          inlineData: {
            data: base64Image,
            mimeType: 'image/jpeg'
          }
        };

        // Multimodal request: [text prompt, image]
        text = await generateGeminiText({
          model: modelName,
          content: [prompt, imagePart],
          abortSignal
        });
      }
    } else {
      // Text-only request
      try {
        text = await generateGeminiText({
          model: modelName,
          content: prompt,
          abortSignal
        });
      } catch (apiError) {
        logger.error('[chatProcessor] API call failed:', apiError);
        logger.error('[chatProcessor] API error details:', {
          name: apiError.name,
          message: apiError.message,
          stack: apiError.stack,
          status: apiError.status,
          statusText: apiError.statusText
        });
        throw apiError;
      }
    }

    // Check if aborted after API call
    if (abortSignal?.aborted) {
      throw new Error('Request aborted');
    }

    if (typeof text !== 'string' || text.length === 0) {
      throw new Error('Failed to read API response: Empty response from model');
    }
    
    // Check if aborted after getting response
    if (abortSignal?.aborted) {
      throw new Error('Request aborted');
    }

    // Parse JSON response
    let jsonMatch;
    let parsed;
    try {
      jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        // No JSON found, just return conversational response
        return {
          response: text,
          extractedData: null,
          source: 'legacy-context'
        };
      }

      parsed = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      logger.error('[chatProcessor] JSON parse error:', parseError);
      logger.error('[chatProcessor] Response text (first 500 chars):', text.substring(0, 500));
      // If JSON parsing fails, try to extract conversationalResponse from raw text (avoid showing raw JSON)
      const convMatch = text.match(/"conversationalResponse"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      const fallbackResponse = convMatch
        ? convMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"')
        : (text || 'I received a response but had trouble parsing it. Please try rephrasing your question.');
      return {
        response: fallbackResponse,
        extractedData: null,
        source: 'legacy-context'
      };
    }

    // Check if this is a question query - don't save data for search/discussion queries
    const isQuestionQuery = message.toLowerCase().includes('questions should i ask') || 
                           (message.toLowerCase().includes('discuss') && message.toLowerCase().includes('doctor')) ||
                           message.toLowerCase().includes('what questions');

    // Save extracted data to Firestore (only if not a question query)
    let savedData = null;
    if (parsed.extractedData && !isQuestionQuery) {
      savedData = await saveExtractedData(parsed.extractedData, userId);
    }

    // Structured insights are generated by deterministic pattern logic only.
    const insights = Array.isArray(structuredInsights) ? structuredInsights : [];
    const safeLegacyInsight = sanitizeLegacyInsight(parsed.insight);

    // Ensure we never return raw JSON - use conversationalResponse or extract from text
    let responseText = parsed.conversationalResponse ?? parsed.response;
    if (responseText == null || responseText === '') {
      const convMatch = text.match(/"conversationalResponse"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      responseText = convMatch
        ? convMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"')
        : 'I received a response but had trouble parsing it. Please try rephrasing your question.';
    }

    return {
      response: responseText,
      extractedData: parsed.extractedData,
      savedData,
      insight: safeLegacyInsight, // Legacy field kept for compatibility only
      insights, // Structured insights array for UI
      source: 'legacy-context'
    };

  } catch (error) {
    throw error;
  }
}

/**
 * Find existing lab value to update
 * Returns { labId, valueId } if found, null otherwise
 */
async function findLabValueToUpdate(labType, date, userId) {
  try {
    const { normalizeLabName } = await import('../utils/normalizationUtils');
    const normalizedLabType = normalizeLabName(labType) || labType.toLowerCase();
    
    // Get all labs for this user
    const allLabs = await labService.getLabs(userId);
    
    // Find labs matching the type
    const matchingLabs = allLabs.filter(lab => {
      const labNormalizedType = normalizeLabName(lab.labType) || normalizeLabName(lab.label) || lab.labType?.toLowerCase();
      return labNormalizedType === normalizedLabType;
    });
    
    if (matchingLabs.length === 0) {
      return null;
    }
    
    // If date is "last", find the most recent value
    if (date === 'last' || date === 'most recent') {
      let mostRecentValue = null;
      let mostRecentLab = null;
      let mostRecentDate = null;
      
      for (const lab of matchingLabs) {
        const values = await labService.getLabValues(lab.id);
        for (const value of values) {
          const valueDate = value.date?.toDate ? value.date.toDate() : new Date(value.date);
          if (!mostRecentDate || valueDate > mostRecentDate) {
            mostRecentDate = valueDate;
            mostRecentValue = value;
            mostRecentLab = lab;
          }
        }
      }
      
      if (mostRecentValue && mostRecentLab) {
        return { labId: mostRecentLab.id, valueId: mostRecentValue.id };
      }
      return null;
    }
    
    // Otherwise, find value matching the date
    const targetDate = parseLocalDate(date);
    if (!targetDate || isNaN(targetDate.getTime())) {
      return null;
    }
    
    // Compare dates by day (ignore time)
    const targetDateStr = targetDate.toISOString().split('T')[0];
    
    for (const lab of matchingLabs) {
      const values = await labService.getLabValues(lab.id);
      for (const value of values) {
        const valueDate = value.date?.toDate ? value.date.toDate() : new Date(value.date);
        const valueDateStr = valueDate.toISOString().split('T')[0];
        
        if (valueDateStr === targetDateStr) {
          return { labId: lab.id, valueId: value.id };
        }
      }
    }
    
    return null;
  } catch (error) {
    logger.error('Error finding lab value to update:', error);
    return null;
  }
}

/**
 * Find existing vital value to update
 * Returns { vitalId, valueId } if found, null otherwise
 */
async function findVitalValueToUpdate(vitalType, date, userId) {
  try {
    const normalizedVitalType = vitalType.toLowerCase();
    
    // Get all vitals for this user
    const allVitals = await vitalService.getVitals(userId);
    
    // Find vitals matching the type
    const matchingVitals = allVitals.filter(vital => {
      const vitalNormalizedType = vital.vitalType?.toLowerCase();
      return vitalNormalizedType === normalizedVitalType;
    });
    
    if (matchingVitals.length === 0) {
      return null;
    }
    
    // If date is "last", find the most recent value
    if (date === 'last' || date === 'most recent') {
      let mostRecentValue = null;
      let mostRecentVital = null;
      let mostRecentDate = null;
      
      for (const vital of matchingVitals) {
        const values = await vitalService.getVitalValues(vital.id);
        for (const value of values) {
          const valueDate = value.date?.toDate ? value.date.toDate() : new Date(value.date);
          if (!mostRecentDate || valueDate > mostRecentDate) {
            mostRecentDate = valueDate;
            mostRecentValue = value;
            mostRecentVital = vital;
          }
        }
      }
      
      if (mostRecentValue && mostRecentVital) {
        return { vitalId: mostRecentVital.id, valueId: mostRecentValue.id };
      }
      return null;
    }
    
    // Otherwise, find value matching the date
    const targetDate = parseLocalDate(date);
    if (!targetDate || isNaN(targetDate.getTime())) {
      return null;
    }
    
    // Compare dates by day (ignore time)
    const targetDateStr = targetDate.toISOString().split('T')[0];
    
    for (const vital of matchingVitals) {
      const values = await vitalService.getVitalValues(vital.id);
      for (const value of values) {
        const valueDate = value.date?.toDate ? value.date.toDate() : new Date(value.date);
        const valueDateStr = valueDate.toISOString().split('T')[0];
        
        if (valueDateStr === targetDateStr) {
          return { vitalId: vital.id, valueId: value.id };
        }
      }
    }
    
    return null;
  } catch (error) {
    logger.error('Error finding vital value to update:', error);
    return null;
  }
}

/**
 * Remove duplicate lab values (same lab type, same date, same value)
 * Keeps only one value per unique combination
 * CRITICAL: Only deletes if there are 2+ values with the exact same date AND value
 */
async function removeDuplicateLabValues(labType, userId) {
  try {
    const { normalizeLabName } = await import('../utils/normalizationUtils');
    const normalizedLabType = normalizeLabName(labType) || labType.toLowerCase();
    
    // Get all labs for this user
    const allLabs = await labService.getLabs(userId);
    
    // Find labs matching the type
    const matchingLabs = allLabs.filter(lab => {
      const labNormalizedType = normalizeLabName(lab.labType) || normalizeLabName(lab.label) || lab.labType?.toLowerCase();
      return labNormalizedType === normalizedLabType;
    });
    
    if (matchingLabs.length === 0) {
      return 0;
    }
    
    let totalDeleted = 0;
    let totalChecked = 0;
    
    // Process each matching lab
    for (const lab of matchingLabs) {
      const values = await labService.getLabValues(lab.id);
      totalChecked += values.length;
      
      if (values.length === 0) {
        continue;
      }
      
      // Group values by date and value (normalize value to string for comparison)
      const valueGroups = {};
      for (const value of values) {
        const valueDate = value.date?.toDate ? value.date.toDate() : new Date(value.date);
        const dateStr = valueDate.toISOString().split('T')[0];
        // Normalize value to string for comparison (handle floating point precision)
        // Use toFixed to handle floating point precision issues (e.g., 68.0 vs 68)
        const numValue = parseFloat(value.value);
        if (isNaN(numValue)) {
          // Skip invalid values
          continue;
        }
        // Round to 2 decimal places to handle floating point precision
        const normalizedValue = numValue.toFixed(2);
        const valueKey = `${dateStr}_${normalizedValue}`;
        
        if (!valueGroups[valueKey]) {
          valueGroups[valueKey] = [];
        }
        valueGroups[valueKey].push({ ...value, labId: lab.id });
      }
      
      // For each group with duplicates (2+ values), keep the first one and delete the rest
      for (const [key, group] of Object.entries(valueGroups)) {
        if (group.length > 1) {
          // CRITICAL: Only delete duplicates (keep first, delete rest)
          // Sort by creation time or ID to ensure consistent "first" value
          const sortedGroup = group.sort((a, b) => {
            const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
            const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
            if (aTime !== bTime) return aTime - bTime;
            // If no creation time, use ID as tiebreaker
            return (a.id || '').localeCompare(b.id || '');
          });
          
          // Keep the first one (oldest), delete the rest
          for (let i = 1; i < sortedGroup.length; i++) {
            try {
              await labService.deleteLabValue(sortedGroup[i].labId, sortedGroup[i].id);
              totalDeleted++;
            } catch (error) {
              logger.error(`Error deleting duplicate lab value ${sortedGroup[i].id}:`, error);
            }
          }
        }
      }
      
      // Update lab's current value after deletions
      const remainingValues = await labService.getLabValues(lab.id);
      if (remainingValues.length > 0) {
        const sortedValues = remainingValues.sort((a, b) => {
          const dateA = a.date?.toDate ? a.date.toDate().getTime() : new Date(a.date).getTime();
          const dateB = b.date?.toDate ? b.date.toDate().getTime() : new Date(b.date).getTime();
          return dateB - dateA;
        });
        await labService.saveLab({
          id: lab.id,
          currentValue: parseFloat(sortedValues[0].value)
        });
      } else {
        // No values left - clear current value
        await labService.saveLab({
          id: lab.id,
          currentValue: null
        });
      }
    }
    
    return totalDeleted;
  } catch (error) {
    logger.error('Error removing duplicate lab values:', error);
    throw error;
  }
}

/**
 * Delete specific lab values matching criteria
 */
async function deleteLabValues(labType, date, value, userId) {
  try {
    const { normalizeLabName } = await import('../utils/normalizationUtils');
    const normalizedLabType = normalizeLabName(labType) || labType.toLowerCase();
    
    // Get all labs for this user
    const allLabs = await labService.getLabs(userId);
    
    // Find labs matching the type
    const matchingLabs = allLabs.filter(lab => {
      const labNormalizedType = normalizeLabName(lab.labType) || normalizeLabName(lab.label) || lab.labType?.toLowerCase();
      return labNormalizedType === normalizedLabType;
    });
    
    let deletedCount = 0;
    const targetDate = date ? parseLocalDate(date) : null;
    const targetDateStr = targetDate && !isNaN(targetDate.getTime()) ? targetDate.toISOString().split('T')[0] : null;
    
    for (const lab of matchingLabs) {
      const values = await labService.getLabValues(lab.id);
      
      for (const val of values) {
        let shouldDelete = true;
        
        // Check date match if specified
        if (targetDateStr) {
          const valueDate = val.date?.toDate ? val.date.toDate() : new Date(val.date);
          const valueDateStr = valueDate.toISOString().split('T')[0];
          if (valueDateStr !== targetDateStr) {
            shouldDelete = false;
          }
        }
        
        // Check value match if specified
        if (value !== undefined && value !== null) {
          if (parseFloat(val.value) !== parseFloat(value)) {
            shouldDelete = false;
          }
        }
        
        if (shouldDelete) {
          try {
            await labService.deleteLabValue(lab.id, val.id);
            deletedCount++;
          } catch (error) {
            logger.error(`Error deleting lab value ${val.id}:`, error);
          }
        }
      }
      
      // Update lab's current value after deletions
      const remainingValues = await labService.getLabValues(lab.id);
      if (remainingValues.length > 0) {
        const sortedValues = remainingValues.sort((a, b) => {
          const dateA = a.date?.toDate ? a.date.toDate().getTime() : new Date(a.date).getTime();
          const dateB = b.date?.toDate ? b.date.toDate().getTime() : new Date(b.date).getTime();
          return dateB - dateA;
        });
        await labService.saveLab({
          id: lab.id,
          currentValue: parseFloat(sortedValues[0].value)
        });
      }
    }
    
    return deletedCount;
  } catch (error) {
    logger.error('Error deleting lab values:', error);
    throw error;
  }
}

/**
 * Save extracted data to Firestore
 */
async function saveExtractedData(extractedData, userId) {
  const saved = {
    labs: [],
    vitals: [],
    symptoms: [],
    medications: [],
    journalNotes: []
  };

  try {
    // Save Labs
    if (extractedData.labs?.length > 0) {
      for (const lab of extractedData.labs) {
        const isUpdate = lab.action === 'update';
        const isDelete = lab.action === 'delete';
        
        if (isDelete) {
          // Handle deletion
          if (lab.removeDuplicates) {
            // Remove duplicate values (same lab type, same date, same value)
            // IMPORTANT: Only delete if there are actual duplicates (2+ values with same date+value)
            const deletedCount = await removeDuplicateLabValues(lab.labType, userId);
            saved.labs.push({ ...lab, deleted: true, duplicatesRemoved: true, deletedCount });
          } else {
            // Delete specific value(s)
            const deleted = await deleteLabValues(lab.labType, lab.date, lab.value, userId);
            saved.labs.push({ ...lab, deleted: true, deletedCount: deleted });
          }
        } else if (isUpdate) {
          // Find existing value to update
          const existingValue = await findLabValueToUpdate(lab.labType, lab.date, userId);
          
          if (existingValue) {
            // Parse and validate date for update
            let updateDate = parseLocalDate(lab.date);
            if (!updateDate || isNaN(updateDate.getTime()) || lab.date === 'last' || lab.date === 'most recent') {
              // If date is "last" or invalid, keep the existing date
              const existingLab = await labService.getLab(existingValue.labId);
              const existingValues = await labService.getLabValues(existingValue.labId);
              const valueToUpdate = existingValues.find(v => v.id === existingValue.valueId);
              updateDate = valueToUpdate?.date?.toDate ? valueToUpdate.date.toDate() : new Date(valueToUpdate.date);
            }
            
            // Update existing value
            await labService.updateLabValue(existingValue.labId, existingValue.valueId, {
              value: parseFloat(lab.value),
              date: updateDate,
              notes: lab.notes || 'Updated via chat'
            });
            
            // Update lab's current value if this is the most recent
            const allValues = await labService.getLabValues(existingValue.labId);
            const sortedValues = allValues.sort((a, b) => {
              const dateA = a.date?.toDate ? a.date.toDate().getTime() : new Date(a.date).getTime();
              const dateB = b.date?.toDate ? b.date.toDate().getTime() : new Date(b.date).getTime();
              return dateB - dateA;
            });
            if (sortedValues.length > 0) {
              await labService.saveLab({
                id: existingValue.labId,
                currentValue: parseFloat(sortedValues[0].value)
              });
            }
            
            saved.labs.push({ labId: existingValue.labId, valueId: existingValue.valueId, ...lab, updated: true });
          } else {
            // Value not found, add as new value instead
            let labDate = parseLocalDate(lab.date);
            if (!labDate || isNaN(labDate.getTime()) || lab.date === 'last' || lab.date === 'most recent') {
              labDate = new Date();
            }
            
            const labId = await labService.saveLab({
              patientId: userId,
              labType: lab.labType,
              label: lab.label,
              currentValue: lab.value,
              unit: lab.unit,
              normalRange: lab.normalRange,
              createdAt: labDate
            });
            
            await labService.addLabValue(labId, {
              value: lab.value,
              date: labDate,
              notes: 'Added via chat (update requested but value not found)'
            });
            
            saved.labs.push({ labId, ...lab, updated: false, note: 'Value not found, added as new' });
          }
        } else {
          // Add new lab value
        let labDate = parseLocalDate(lab.date);
        if (!labDate || isNaN(labDate.getTime())) {
          labDate = new Date();
        }

        const labId = await labService.saveLab({
          patientId: userId,
          labType: lab.labType,
          label: lab.label,
          currentValue: lab.value,
          unit: lab.unit,
          normalRange: lab.normalRange,
          createdAt: labDate
        });

        await labService.addLabValue(labId, {
          value: lab.value,
          date: labDate,
          notes: 'Added via chat'
        });

        saved.labs.push({ labId, ...lab });
        }
      }
    }

    // Save Vitals
    if (extractedData.vitals?.length > 0) {
      for (const vital of extractedData.vitals) {
        const isUpdate = vital.action === 'update';
        const isDelete = vital.action === 'delete';
        
        if (isDelete) {
          // Handle deletion (similar to labs, but vitals deletion is less common)
          // For now, we'll handle specific deletions if needed
          saved.vitals.push({ ...vital, deleted: true, note: 'Vital deletion via chat not yet fully implemented' });
        } else if (isUpdate) {
          // Find existing value to update
          const existingValue = await findVitalValueToUpdate(vital.vitalType, vital.date, userId);
          
          if (existingValue) {
            // Parse and validate date for update
            let updateDate = parseLocalDate(vital.date);
            if (!updateDate || isNaN(updateDate.getTime()) || vital.date === 'last' || vital.date === 'most recent') {
              // If date is "last" or invalid, keep the existing date
              const existingVital = await vitalService.getVital(existingValue.vitalId);
              const existingValues = await vitalService.getVitalValues(existingValue.vitalId);
              const valueToUpdate = existingValues.find(v => v.id === existingValue.valueId);
              updateDate = valueToUpdate?.date?.toDate ? valueToUpdate.date.toDate() : new Date(valueToUpdate.date);
            }
            
            // Handle blood pressure specially
            let updateData = {
              date: updateDate,
              notes: vital.notes || 'Updated via chat'
            };
            
            if (vital.vitalType === 'bp' || vital.vitalType === 'bloodpressure') {
              // Parse blood pressure value (format: "130/85" or "130/85 mmHg")
              const bpMatch = vital.value.toString().match(/(\d+)\s*\/\s*(\d+)/);
              if (bpMatch) {
                updateData.systolic = parseFloat(bpMatch[1]);
                updateData.diastolic = parseFloat(bpMatch[2]);
                updateData.value = parseFloat(bpMatch[1]); // For charting
              } else {
                updateData.value = parseFloat(vital.value);
              }
            } else {
              updateData.value = parseFloat(vital.value);
            }
            
            // Update existing value
            await vitalService.updateVitalValue(existingValue.vitalId, existingValue.valueId, updateData);
            
            // Update vital's current value if this is the most recent
            const allValues = await vitalService.getVitalValues(existingValue.vitalId);
            const sortedValues = allValues.sort((a, b) => {
              const dateA = a.date?.toDate ? a.date.toDate().getTime() : new Date(a.date).getTime();
              const dateB = b.date?.toDate ? b.date.toDate().getTime() : new Date(b.date).getTime();
              return dateB - dateA;
            });
            if (sortedValues.length > 0) {
              const mostRecent = sortedValues[0];
              const currentValue = (mostRecent.systolic && mostRecent.diastolic) 
                ? `${mostRecent.systolic}/${mostRecent.diastolic}` 
                : mostRecent.value;
              await vitalService.saveVital({
                id: existingValue.vitalId,
                currentValue: currentValue
              });
            }
            
            saved.vitals.push({ vitalId: existingValue.vitalId, valueId: existingValue.valueId, ...vital, updated: true });
          } else {
            // Value not found, add as new value instead
            let vitalDate = parseLocalDate(vital.date);
            if (!vitalDate || isNaN(vitalDate.getTime()) || vital.date === 'last' || vital.date === 'most recent') {
              vitalDate = new Date();
            }
            
            const vitalId = await vitalService.saveVital({
              patientId: userId,
              vitalType: vital.vitalType,
              label: vital.label,
              currentValue: vital.value,
              unit: vital.unit,
              normalRange: vital.normalRange,
              createdAt: vitalDate
            });
            
            await vitalService.addVitalValue(vitalId, {
              value: vital.value,
              date: vitalDate,
              notes: 'Added via chat (update requested but value not found)'
            });
            
            saved.vitals.push({ vitalId, ...vital, updated: false, note: 'Value not found, added as new' });
          }
        } else {
          // Add new vital value
        let vitalDate = parseLocalDate(vital.date);
        if (!vitalDate || isNaN(vitalDate.getTime())) {
          vitalDate = new Date();
        }

        const vitalId = await vitalService.saveVital({
          patientId: userId,
          vitalType: vital.vitalType,
          label: vital.label,
          currentValue: vital.value,
          unit: vital.unit,
          normalRange: vital.normalRange,
          createdAt: vitalDate
        });

        await vitalService.addVitalValue(vitalId, {
          value: vital.value,
          date: vitalDate,
          notes: 'Added via chat'
        });

        saved.vitals.push({ vitalId, ...vital });
        }
      }
    }

    // Save Symptoms
    if (extractedData.symptoms?.length > 0) {
      for (const symptom of extractedData.symptoms) {
        // Build symptom data object, only including defined fields
        const symptomData = {
          patientId: userId,
          name: symptom.name,
          date: new Date(symptom.date),
          notes: symptom.notes || ''
        };
        
        // Only add severity if it's defined and not empty
        if (symptom.severity && symptom.severity.trim() !== '') {
          symptomData.severity = symptom.severity;
        }
        
        const symptomId = await symptomService.addSymptom(symptomData);

        saved.symptoms.push({ symptomId, ...symptom });
      }
    }

    // Save Medications
    if (extractedData.medications?.length > 0) {
      for (const med of extractedData.medications) {
        const medId = await medicationService.saveMedication({
          patientId: userId,
          name: med.name,
          dosage: med.dosage,
          frequency: med.frequency,
          active: med.action === 'started' || med.action === 'adjusted',
          startDate: new Date()
        });

        saved.medications.push({ medId, ...med });
      }
    }

    // Save Journal Notes
    if (extractedData.journalNotes?.length > 0) {
      for (const note of extractedData.journalNotes) {
        // Parse and validate date - use current date as fallback if invalid
        let noteDate = parseLocalDate(note.date);
        if (!noteDate || isNaN(noteDate.getTime())) {
          noteDate = new Date();
        }

        const noteId = await journalNoteService.addJournalNote({
          patientId: userId,
          content: note.content,
          date: noteDate,
          source: 'chat'
        });

        saved.journalNotes.push({ noteId, content: note.content, date: note.date });
      }
    }

    return saved;

  } catch (error) {
    throw error;
  }
}

/**
 * Generate summary of what was extracted
 */
function classifySavedItemChange(item = {}) {
  if (item.deleted === true) return 'deleted';
  if (item.updated === true) return 'updated';

  const action = typeof item.action === 'string' ? item.action.trim().toLowerCase() : '';
  if (['delete', 'deleted', 'remove', 'removed'].includes(action)) return 'deleted';
  if (['update', 'updated', 'adjust', 'adjusted', 'edit', 'edited', 'change', 'changed', 'modify', 'modified'].includes(action)) {
    return 'updated';
  }

  return 'added';
}

export function generateChatExtractionSummary(extractedData, savedData = null) {
  const sourceData = savedData || extractedData;
  if (!sourceData) return null;

  const summary = {
    journalNotes: sourceData.journalNotes || [],
    labs: sourceData.labs || [],
    vitals: sourceData.vitals || [],
    symptoms: sourceData.symptoms || [],
    medications: sourceData.medications || []
  };

  const hasData = summary.journalNotes.length > 0 ||
                  summary.labs.length > 0 ||
                  summary.vitals.length > 0 ||
                  summary.symptoms.length > 0 ||
                  summary.medications.length > 0;

  if (!hasData) return null;

  const byCategory = {};
  const changeBreakdown = { total: 0, added: 0, updated: 0, deleted: 0 };
  const categories = ['journalNotes', 'labs', 'vitals', 'symptoms', 'medications'];

  categories.forEach((category) => {
    const items = Array.isArray(summary[category]) ? summary[category] : [];
    const counts = { total: items.length, added: 0, updated: 0, deleted: 0 };

    items.forEach((item) => {
      const change = classifySavedItemChange(item);
      counts[change] += 1;
      changeBreakdown[change] += 1;
      changeBreakdown.total += 1;
    });

    byCategory[category] = counts;
  });

  return {
    ...summary,
    byCategory,
    changeBreakdown
  };
}
