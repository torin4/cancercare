import { GoogleGenerativeAI } from '@google/generative-ai';
import { labService, vitalService, medicationService, symptomService } from '../firebase/services';
import { getSavedTrials } from '../services/clinicalTrials/clinicalTrialsService';

const genAI = new GoogleGenerativeAI(process.env.REACT_APP_GEMINI_API_KEY || process.env.GEMINI_API_KEY);

/**
 * Process a chat message to extract and save medical data
 * @param {string} message - User's message
 * @param {string} userId - User ID
 * @param {Array} conversationHistory - Previous conversation messages
 * @param {Object} trialContext - Optional trial context (when asking about a specific trial)
 * @param {Object} healthContext - Optional health context (labs, vitals, symptoms)
 * @param {Object} patientProfile - Patient demographics (age, gender, weight) for normal range adjustments
 */
export async function processChatMessage(message, userId, conversationHistory = [], trialContext = null, healthContext = null, patientProfile = null) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Detect if message requires trial data (but not if trialContext is already provided)
    const requiresTrialData = !trialContext && /(saved trial|saved trials|my trial|my trials|clinical trial|clinical trials|trial i saved|trials i saved|what trials|which trials|show me trials|tell me about trials)/i.test(message);
    
    // Check if saved trials exist (only if question requires trial data)
    if (requiresTrialData && userId) {
      try {
        const savedTrials = await getSavedTrials(userId);
        if (!savedTrials || savedTrials.length === 0) {
          const noTrialDataResponse = `I'd be happy to help you with your saved clinical trials! However, I don't see any saved trials in your profile yet.

To get started, you can:
- **Search for clinical trials** on the Clinical Trials tab
- **Save trials** that match your profile by clicking the bookmark icon
- **Ask about specific trials** after you've saved them

Once you have saved trials, I can help you:
- Understand what each trial involves
- Explain the drugs and treatments being tested
- Discuss eligibility criteria
- Answer questions about trial phases, side effects, and locations

Would you like to search for clinical trials now?`;

          return {
            response: noTrialDataResponse,
            extractedData: null
          };
        }
      } catch (error) {
        console.error('Error checking saved trials:', error);
        // Continue with normal processing if there's an error
      }
    }

    // Detect if user is ADDING data (not asking about it)
    // These patterns indicate the user is providing new data to be saved
    const isAddingData = /(my (ca-125|hemoglobin|wbc|platelets|blood pressure|heart rate|temperature|temp|weight|bp|hr) (was|is)|i (had|have|started|am taking|took)|i'm (experiencing|taking)|my (symptom|symptoms)|started taking|taking [a-z]+ (mg|ml|units?)|log|add|record)/i.test(message);
    
    // Detect if message requires health data ANALYSIS (asking about existing data, not adding)
    // Only trigger if user is asking questions, not adding data
    const requiresHealthData = !isAddingData && /(explain|analyze|what does|how is|trend|progress|mean|interpret|show me|tell me about|what are|what is|why is|when did|where is|my (lab|labs|vital|vitals|symptom|symptoms|health|treatment|medication|medications) (mean|show|indicate|tell|say)|what do my|how are my|how's my)/i.test(message);
    
    // Check if health data is available
    const hasLabs = healthContext?.labs && healthContext.labs.length > 0;
    const hasVitals = healthContext?.vitals && healthContext.vitals.length > 0;
    const hasSymptoms = healthContext?.symptoms && healthContext.symptoms.length > 0;
    const hasHealthData = hasLabs || hasVitals || hasSymptoms;
    
    // If question requires health data analysis but none is available, provide helpful response
    // BUT skip this if user is adding data (they're providing it now)
    if (requiresHealthData && !hasHealthData) {
      const noDataResponse = `I'd be happy to help you understand your health data! However, I don't see any health data tracked yet in your profile.

To get started, you can:
- **Upload lab reports** or **add lab values** via chat (e.g., "My CA-125 was 68 on December 15")
- **Log vital signs** like blood pressure, heart rate, or weight
- **Track symptoms** you're experiencing
- **Add medications** you're taking

Once you have data, I can help you:
- Understand what your values mean
- Analyze trends over time
- Explain how your treatment is progressing
- Identify patterns in your health data

Would you like to start by adding some health data?`;

      return {
        response: noDataResponse,
        extractedData: null
      };
    }
    
    // Check if question requires specific data type that isn't available
    // Only check if user is asking about data, not adding it
    const requiresLabs = !isAddingData && /(lab|labs|ca-125|hemoglobin|wbc|platelets|blood test|test result)/i.test(message);
    const requiresVitals = !isAddingData && /(vital|vitals|blood pressure|heart rate|pulse|temperature|temp|weight|oxygen|spo2)/i.test(message);
    const requiresSymptoms = !isAddingData && /(symptom|symptoms|feeling|pain|nausea|fatigue)/i.test(message);
    
    if (requiresLabs && !hasLabs && hasHealthData) {
      const noLabDataResponse = `I'd be happy to explain your lab results! However, I don't see any lab values tracked in your profile yet.

You can add lab values by:
- **Uploading lab reports** through the Files tab
- **Telling me in chat** (e.g., "My CA-125 was 68 on December 15")
- **Using the Health tab** to manually enter values

Once you have lab data, I can help explain what the values mean and track trends over time.`;

      return {
        response: noLabDataResponse,
        extractedData: null
      };
    }
    
    if (requiresVitals && !hasVitals && hasHealthData) {
      const noVitalDataResponse = `I'd be happy to help with your vital signs! However, I don't see any vital signs tracked in your profile yet.

You can add vital signs by:
- **Telling me in chat** (e.g., "My blood pressure was 125/80 this morning")
- **Using the Health tab** to manually enter values

Once you have vital sign data, I can help you understand what the values mean and track changes over time.`;

      return {
        response: noVitalDataResponse,
        extractedData: null
      };
    }
    
    if (requiresSymptoms && !hasSymptoms && hasHealthData) {
      const noSymptomDataResponse = `I'd be happy to help with your symptoms! However, I don't see any symptoms tracked in your profile yet.

You can log symptoms by:
- **Telling me in chat** (e.g., "I had mild nausea yesterday")
- **Using the Health tab** to manually log symptoms
- **Using the quick log** feature on the dashboard

Once you have symptom data, I can help identify patterns and correlations with your other health data.`;

      return {
        response: noSymptomDataResponse,
        extractedData: null
      };
    }

    // Check for insufficient data for trend analysis
    // Only check if user is asking about trends, not adding data
    const requiresTrendAnalysis = !isAddingData && /(trend|progress|over time|changing|increasing|decreasing|pattern)/i.test(message);
    if (requiresTrendAnalysis && hasHealthData) {
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
        const insufficientDataResponse = `I'd be happy to analyze trends in your health data! However, I need more data points to identify meaningful trends and patterns.

To analyze trends effectively, I typically need:
- **At least 2-3 measurements over time** for labs or vitals
- **Multiple symptom entries** to identify patterns

You can add more data by:
- **Uploading additional lab reports** through the Files tab
- **Telling me in chat** (e.g., "My CA-125 was 68 on December 15, and 72 on January 1")
- **Using the Health tab** to manually enter values over time

Once you have more data points, I can help you see trends, identify patterns, and understand how your values are changing over time.`;

        return {
          response: insufficientDataResponse,
          extractedData: null
        };
      }
    }

    // Build patient demographics section if provided
    let patientDemographicsSection = '';
    if (patientProfile) {
      patientDemographicsSection = `

═══════════════════════════════════════════════════════════════════════════════
PATIENT DEMOGRAPHICS: Use these for normal range adjustments
═══════════════════════════════════════════════════════════════════════════════

- Age: ${patientProfile.age || patientProfile.dateOfBirth ? (new Date().getFullYear() - new Date(patientProfile.dateOfBirth).getFullYear()) : 'Not specified'}
- Gender: ${patientProfile.gender || 'Not specified'}
- Weight: ${patientProfile.weight ? `${patientProfile.weight} ${patientProfile.weightUnit || 'kg'}` : 'Not specified'}
- Height: ${patientProfile.height ? `${patientProfile.height} ${patientProfile.heightUnit || 'cm'}` : 'Not specified'}
- Diagnosis: ${patientProfile.diagnosis || 'Not specified'}
- Cancer Type: ${patientProfile.cancerType || 'Not specified'}
- Cancer Subtype: ${patientProfile.cancerSubtype || 'Not specified'}
- Stage: ${patientProfile.stage || 'Not specified'}

When interpreting lab values, adjust normal ranges based on these demographics (e.g., age and gender affect normal ranges for many tests).

═══════════════════════════════════════════════════════════════════════════════`;
    }

    // Build trial context section if provided
    let trialContextSection = '';
    if (trialContext) {
      const interventions = trialContext.interventions || [];
      const drugs = interventions.map(int => {
        if (typeof int === 'string') return int;
        return int.name || int.description || JSON.stringify(int);
      }).filter(Boolean).join(', ');

      const trialUrl = trialContext.url || (trialContext.id ? `https://clinicaltrials.gov/study/${trialContext.id}` : null);
      
      trialContextSection = `

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

When answering questions about this trial, you should:
1. Explain the drugs/interventions being used, their mechanisms of action, and how they work
2. Explain what the trial phase means (Phase I = safety, Phase II = efficacy, Phase III = comparison, Phase IV = post-marketing)
3. Discuss the trial's eligibility criteria and what they mean
4. Provide information about the drugs' properties, side effects, and typical usage
5. Explain how the trial design works and what it's testing
6. Be helpful and educational while being clear that you're providing general information, not medical advice
7. Keep responses VERY CONCISE - aim for 1-2 short paragraphs maximum (3-5 sentences total). Be direct and to the point.
8. Use MARKDOWN formatting: **bold** for drug names and key terms, bullet points for lists, \`code\` for dosages/values
9. ALWAYS include links to authoritative sources:
   - For trial information: Include the trial study link: ${trialUrl ? `[View trial on ClinicalTrials.gov](${trialUrl})` : 'Trial link not available'}
   - For drug information: Provide links to FDA labels, prescribing information, or medical databases (e.g., FDA.gov, Drugs.com, PubMed)
   - Format links as markdown: [Link Text](URL)
10. You can discuss drugs beyond the information provided in the trial context - use your knowledge and provide links to FDA labels, prescribing information, or medical literature
11. When discussing specific drugs, search for and provide links to:
    - FDA-approved labels: https://www.accessdata.fda.gov/scripts/cder/daf/
    - Prescribing information (package inserts)
    - Medical literature (PubMed, clinical trials)
    - Drug information databases (Drugs.com, MedlinePlus)

═══════════════════════════════════════════════════════════════════════════════`;
    }

    // Build health context section if provided
    let healthContextSection = '';
    if (healthContext) {
      // Format labs data - show summary with latest values and notes
      const labsCount = healthContext.labs ? healthContext.labs.length : 0;
      const labsSummary = labsCount > 0
        ? healthContext.labs.map(lab => {
            const latestValue = lab.values && lab.values.length > 0 
              ? lab.values[lab.values.length - 1] 
              : null;
            const valueStr = latestValue ? `${latestValue.value} ${lab.unit || ''}` : lab.currentValue || 'N/A';
            const noteStr = latestValue?.notes && latestValue.notes !== 'Extracted from document' 
              ? ` (Note: ${latestValue.notes})` 
              : '';
            return `${lab.label || lab.labType}: ${valueStr} ${lab.unit || ''} (${lab.status || 'unknown'})${noteStr}`;
          }).join(', ')
        : 'No lab data available';

      // Format vitals data - show summary with latest values and notes
      const vitalsCount = healthContext.vitals ? healthContext.vitals.length : 0;
      const vitalsSummary = vitalsCount > 0
        ? healthContext.vitals.map(vital => {
            const latestValue = vital.values && vital.values.length > 0 
              ? vital.values[vital.values.length - 1] 
              : null;
            const valueStr = latestValue ? latestValue.value : vital.currentValue || 'N/A';
            const noteStr = latestValue?.notes && latestValue.notes !== 'Extracted from document' 
              ? ` (Note: ${latestValue.notes})` 
              : '';
            return `${vital.label || vital.vitalType}: ${valueStr} ${vital.unit || ''}${noteStr}`;
          }).join(', ')
        : 'No vital signs data available';

      // Format symptoms data - show count and recent ones only
      const symptomsCount = healthContext.symptoms ? healthContext.symptoms.length : 0;
      const recentSymptoms = healthContext.symptoms && healthContext.symptoms.length > 0
        ? healthContext.symptoms.slice(-5).map(symptom => {
            return `${symptom.name} (${symptom.severity || 'Not specified'})`;
          }).join(', ')
        : 'No symptoms recorded';

      healthContextSection = `

═══════════════════════════════════════════════════════════════════════════════
HEALTH CONTEXT: The user is asking about their health data (labs, vitals, symptoms)
═══════════════════════════════════════════════════════════════════════════════

LAB VALUES (${labsCount} tracked): ${labsSummary}

VITAL SIGNS (${vitalsCount} tracked): ${vitalsSummary}

SYMPTOMS (${symptomsCount} total, recent: ${recentSymptoms})

When answering questions about the user's health data, you should:
1. Analyze trends and patterns in the data (e.g., "CA-125 has been increasing over time")
2. Explain what values mean in the context of cancer treatment
3. Use any notes/context provided with the values (e.g., "Before starting treatment", "After cycle 2") to provide more relevant and contextualized insights
4. Identify concerning patterns or values that may need medical attention
5. Provide context about normal ranges and what deviations might indicate
6. Be supportive and educational while being clear that you're providing general information, not medical advice
7. Keep responses VERY CONCISE - aim for 1-2 short paragraphs maximum (3-5 sentences total). Be direct and to the point.
8. Use MARKDOWN formatting: **bold** for important values and key terms, bullet points for lists
9. If values are outside normal ranges, explain what this might mean but emphasize consulting with their medical team
10. Look for patterns across different data types (e.g., low hemoglobin + fatigue symptoms)

═══════════════════════════════════════════════════════════════════════════════`;
    }

    // Build prompt for extraction
    // Determine user role for personalized responses
    const isPatient = patientProfile?.isPatient !== false; // Default to true if not set
    const userRoleContext = isPatient 
      ? 'You are speaking directly with the patient. Address them in first person (e.g., "your", "you").'
      : 'You are speaking with a caregiver who is helping manage the patient\'s care. Address them as a caregiver (e.g., "the patient", "their", "they") and acknowledge their role in supporting the patient.';

    const prompt = `You are CancerCare's AI health assistant helping track medical data for a patient${patientProfile?.diagnosis ? ` with ${patientProfile.diagnosis}` : ''}.

${userRoleContext}

TASK: Analyze the user's message and extract any medical values they mentioned.${trialContext ? ' The user is asking about a specific clinical trial - provide detailed information about the trial, its drugs, phase, and eligibility.' : ''}${healthContext ? ' The user is asking about their health data - analyze their labs, vitals, and symptoms to provide insights and answer questions.' : ''}

USER MESSAGE: "${message}"
${patientDemographicsSection}
${trialContextSection}
${healthContextSection}

Extract any medical data and return a JSON object with this structure:

{
  "conversationalResponse": "Your friendly, empathetic response to the user",
  "extractedData": {
    "labs": [
      {
        "labType": "ca125|cea|wbc|hemoglobin|platelets|etc",
        "label": "CA-125",
        "value": 68,
        "unit": "U/mL",
        "date": "2024-12-29",
        "normalRange": "0-35"  // CRITICAL: Adjust based on patient demographics (age, gender) if applicable
      }
    ],
    "vitals": [
      {
        "vitalType": "bp|hr|temp|weight|oxygen",
        "label": "Blood Pressure",
        "value": "125/80",
        "unit": "mmHg",
        "date": "2024-12-29",
        "normalRange": "90-120/60-80"
      }
    ],
    "symptoms": [
      {
        "name": "Nausea",
        "severity": "mild|moderate|severe",
        "date": "2024-12-29",
        "notes": "After chemotherapy"
      }
    ],
    "medications": [
      {
        "name": "Paclitaxel",
        "dosage": "175 mg/m²",
        "frequency": "Every 3 weeks",
        "action": "started|stopped|adjusted"
      }
    ]
  }
}

IMPORTANT:
- Only include sections with actual extracted data (omit empty sections)
- CAREFULLY extract the date from the user's message (e.g., "on December 14", "two weeks ago", "last Monday", "yesterday")
- Calculate dates relative to today if needed: ${new Date().toISOString().split('T')[0]}
- If NO date is mentioned at all, use today's date
- Be conversational and supportive in your response
- Keep responses VERY CONCISE - aim for 1-2 short paragraphs maximum (3-5 sentences total). Be direct and to the point. Prioritize the most important information only.
- Use MARKDOWN formatting for better readability:
  * Use **bold** for important terms, drug names, and key concepts
  * Use *italics* for emphasis
  * Use bullet points (- or *) for lists
  * Use numbered lists (1. 2. 3.) for step-by-step information
  * Use \`code\` formatting for technical terms, dosages, or specific values
  * Use headers (##) sparingly for major sections if needed
  * Use line breaks to separate ideas clearly
  * Use links: [Link Text](URL) for references and authoritative sources
- If trial context is provided, prioritize answering trial-related questions with detailed, educational information about drugs, phases, eligibility, and trial design
- ALWAYS include authoritative links when discussing:
  * Drugs: FDA labels (https://www.accessdata.fda.gov/scripts/cder/daf/), prescribing information, medical literature
  * Trials: ClinicalTrials.gov study link (provided in trial context)
  * Medical information: PubMed, medical databases, official health organization sites
- You can discuss drugs beyond the information provided - use your knowledge and provide links to authoritative sources (FDA, medical literature, prescribing information)
- If no medical data is mentioned, just respond conversationally (or about the trial if trial context is provided)
- If the user asks about analyzing or explaining their health data but there is NO data available or INSUFFICIENT data (e.g., only 1-2 data points when trends require more), acknowledge this clearly in your response and suggest how they can add more data. Be helpful and guide them on what data would be useful.
- Return ONLY valid JSON

DATE RECOGNITION EXAMPLES:
- "My CA-125 on December 14 was 70" → use "2024-12-14"
- "Two weeks ago my CA-125 was 70" → calculate date 14 days before today
- "Last Monday my CA-125 was 70" → calculate the date of last Monday
- "Yesterday my CA-125 was 70" → use yesterday's date
- "My CA-125 was 70" (no date mentioned) → use today's date

CONVERSATION CONTEXT:
${conversationHistory.slice(-5).map(msg => `${msg.role}: ${msg.content}`).join('\n')}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // No JSON found, just return conversational response
      return {
        response: text,
        extractedData: null
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Save extracted data to Firestore
    if (parsed.extractedData) {
      await saveExtractedData(parsed.extractedData, userId);
    }

    return {
      response: parsed.conversationalResponse,
      extractedData: parsed.extractedData
    };

  } catch (error) {
    console.error('Error processing chat message:', error);
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
    medications: []
  };

  try {
    // Save Labs
    if (extractedData.labs?.length > 0) {
      for (const lab of extractedData.labs) {
        const labId = await labService.saveLab({
          patientId: userId,
          labType: lab.labType,
          label: lab.label,
          currentValue: lab.value,
          unit: lab.unit,
          normalRange: lab.normalRange,
          createdAt: new Date(lab.date)
        });

        await labService.addLabValue(labId, {
          value: lab.value,
          date: new Date(lab.date),
          notes: 'Added via chat'
        });

        saved.labs.push({ labId, ...lab });
      }
    }

    // Save Vitals
    if (extractedData.vitals?.length > 0) {
      for (const vital of extractedData.vitals) {
        const vitalId = await vitalService.saveVital({
          patientId: userId,
          vitalType: vital.vitalType,
          label: vital.label,
          currentValue: vital.value,
          unit: vital.unit,
          normalRange: vital.normalRange,
          createdAt: new Date(vital.date)
        });

        await vitalService.addVitalValue(vitalId, {
          value: vital.value,
          date: new Date(vital.date),
          notes: 'Added via chat'
        });

        saved.vitals.push({ vitalId, ...vital });
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

    return saved;

  } catch (error) {
    console.error('Error saving extracted data:', error);
    throw error;
  }
}

/**
 * Generate summary of what was extracted
 */
export function generateChatExtractionSummary(extractedData) {
  if (!extractedData) return '';

  const parts = [];

  if (extractedData.labs?.length > 0) {
    parts.push(`\n\nLogged ${extractedData.labs.length} lab value(s):`);
    extractedData.labs.forEach(lab => {
      parts.push(`• ${lab.label}: ${lab.value} ${lab.unit}`);
    });
  }

  if (extractedData.vitals?.length > 0) {
    parts.push(`\nLogged ${extractedData.vitals.length} vital sign(s):`);
    extractedData.vitals.forEach(vital => {
      parts.push(`• ${vital.label}: ${vital.value} ${vital.unit}`);
    });
  }

  if (extractedData.symptoms?.length > 0) {
    parts.push(`\nLogged ${extractedData.symptoms.length} symptom(s):`);
    extractedData.symptoms.forEach(symptom => {
      parts.push(`• ${symptom.name} (${symptom.severity})`);
    });
  }

  if (extractedData.medications?.length > 0) {
    parts.push(`\nUpdated ${extractedData.medications.length} medication(s):`);
    extractedData.medications.forEach(med => {
      parts.push(`• ${med.name} - ${med.action}`);
    });
  }

  return parts.join('\n');
}
