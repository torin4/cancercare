import { GoogleGenerativeAI } from '@google/generative-ai';
import { labService, vitalService, medicationService, symptomService } from '../firebase/services';

const genAI = new GoogleGenerativeAI(process.env.REACT_APP_GEMINI_API_KEY || process.env.GEMINI_API_KEY);

/**
 * Process a chat message to extract and save medical data
 */
export async function processChatMessage(message, userId, conversationHistory = []) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Build prompt for extraction
    const prompt = `You are CancerCare's AI health assistant helping track medical data for a patient with ovarian cancer.

TASK: Analyze the user's message and extract any medical values they mentioned.

USER MESSAGE: "${message}"

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
- Use today's date if not specified: ${new Date().toISOString().split('T')[0]}
- Be conversational and supportive in your response
- If no medical data is mentioned, just respond conversationally
- Return ONLY valid JSON

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
        const symptomId = await symptomService.addSymptom({
          patientId: userId,
          name: symptom.name,
          severity: symptom.severity,
          date: new Date(symptom.date),
          notes: symptom.notes || ''
        });

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
    parts.push(`\n\n✅ Logged ${extractedData.labs.length} lab value(s):`);
    extractedData.labs.forEach(lab => {
      parts.push(`• ${lab.label}: ${lab.value} ${lab.unit}`);
    });
  }

  if (extractedData.vitals?.length > 0) {
    parts.push(`\n✅ Logged ${extractedData.vitals.length} vital sign(s):`);
    extractedData.vitals.forEach(vital => {
      parts.push(`• ${vital.label}: ${vital.value} ${vital.unit}`);
    });
  }

  if (extractedData.symptoms?.length > 0) {
    parts.push(`\n✅ Logged ${extractedData.symptoms.length} symptom(s):`);
    extractedData.symptoms.forEach(symptom => {
      parts.push(`• ${symptom.name} (${symptom.severity})`);
    });
  }

  if (extractedData.medications?.length > 0) {
    parts.push(`\n✅ Updated ${extractedData.medications.length} medication(s):`);
    extractedData.medications.forEach(med => {
      parts.push(`• ${med.name} - ${med.action}`);
    });
  }

  return parts.join('\n');
}
