/**
 * Patient demographics context template
 */

export function buildPatientDemographicsContext(patientProfile) {
  if (!patientProfile) return '';
  
  return `

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
