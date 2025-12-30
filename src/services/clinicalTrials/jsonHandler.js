
// Handles parsing JSON response as per /api/v2/studies/{nctId} schema

export function parseClinicalTrialJSON(jsonData) {
    // Some basic transformation or checks can be added here
    // For now, return JSON as is
    return jsonData;
}

// Example utility: validate keys exist 
export function validateClinicalTrialJSON(jsonData) {
    if (!jsonData || !jsonData.study) {
        throw new Error('Invalid Clinical Trial JSON data: Missing study root');
    }
    // Additional validations can be added here based on schema
}
