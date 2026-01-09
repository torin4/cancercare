/**
 * Validate that extracted data has required date fields
 * Ensures every lab/vital has a date, and genomic testInfo has a testDate
 * @param {Object} parsed - Parsed data from AI
 * @returns {Object} - Validation results with any issues found
 */
export function validateExtractedData(parsed) {
  const validation = {
    isValid: true,
    issues: []
  };

  // Validate labs have dates
  if (parsed.data?.labs) {
    const labsWithoutDates = parsed.data.labs.filter(lab => !lab.date);
    if (labsWithoutDates.length > 0) {
      validation.isValid = false;
      validation.issues.push(`${labsWithoutDates.length} lab(s) missing date field`);
    }
  }

  // Validate vitals have dates
  if (parsed.data?.vitals) {
    const vitalsWithoutDates = parsed.data.vitals.filter(vital => !vital.date);
    if (vitalsWithoutDates.length > 0) {
      validation.isValid = false;
      validation.issues.push(`${vitalsWithoutDates.length} vital(s) missing date field`);
    }
  }

  // Validate genomic testInfo has testDate
  if (parsed.data?.genomic?.testInfo && !parsed.data.genomic.testInfo.testDate) {
    validation.isValid = false;
    validation.issues.push('Genomic testInfo missing testDate field');
  }

  return validation;
}
