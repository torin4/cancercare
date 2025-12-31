import { GoogleGenerativeAI } from '@google/generative-ai';
import { labService, vitalService, medicationService, symptomService } from '../firebase/services';

const genAI = new GoogleGenerativeAI(process.env.REACT_APP_GEMINI_API_KEY || process.env.GEMINI_API_KEY);

/**
 * Process a chat message to extract and save medical data
 * @param {string} message - User's message
 * @param {string} userId - User ID
 * @param {Array} conversationHistory - Previous conversation messages
 * @param {Object} trialContext - Optional trial context (when asking about a specific trial)
 */
export async function processChatMessage(message, userId, conversationHistory = [], trialContext = null) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Build trial context section if provided
    let trialContextSection = '';
    if (trialContext) {
      const interventions = trialContext.interventions || [];
      const drugs = interventions.map(int => {
        if (typeof int === 'string') return int;
        return int.name || int.description || JSON.stringify(int);
      }).filter(Boolean).join(', ');

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
${trialContext.eligibility ? `- Eligibility Criteria: ${typeof trialContext.eligibility === 'string' ? trialContext.eligibility : JSON.stringify(trialContext.eligibility)}` : ''}
${trialContext.matchResult ? `- Match Score: ${trialContext.matchResult.matchScore || 'Not calculated'}` : ''}

When answering questions about this trial, you should:
1. Explain the drugs/interventions being used, their mechanisms of action, and how they work
2. Explain what the trial phase means (Phase I = safety, Phase II = efficacy, Phase III = comparison, Phase IV = post-marketing)
3. Discuss the trial's eligibility criteria and what they mean
4. Provide information about the drugs' properties, side effects, and typical usage
5. Explain how the trial design works and what it's testing
6. Be helpful and educational while being clear that you're providing general information, not medical advice

═══════════════════════════════════════════════════════════════════════════════`;
    }

    // Build prompt for extraction
    const prompt = `You are CancerCare's AI health assistant helping track medical data for a patient with ovarian cancer.

TASK: Analyze the user's message and extract any medical values they mentioned.${trialContext ? ' The user is asking about a specific clinical trial - provide detailed information about the trial, its drugs, phase, and eligibility.' : ''}

USER MESSAGE: "${message}"
${trialContextSection}

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
        "normalRange": "0-35"
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
- If trial context is provided, prioritize answering trial-related questions with detailed, educational information about drugs, phases, eligibility, and trial design
- If no medical data is mentioned, just respond conversationally (or about the trial if trial context is provided)
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
