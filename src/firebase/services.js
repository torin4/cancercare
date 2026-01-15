// All Firebase operations are now handled by individual service files
// This file serves as a central export point for backwards compatibility

// Re-export extracted services
export { patientService } from './services/patientService';
export { labService } from './services/labService';
export { vitalService } from './services/vitalService';
export { medicationService } from './services/medicationService';
export { medicationLogService } from './services/medicationLogService';
export { symptomService } from './services/symptomService';
export { documentService } from './services/documentService';
export { messageService } from './services/messageService';
export { genomicProfileService } from './services/genomicProfileService';
export { journalNoteService } from './services/journalNoteService';
export { emergencyContactService } from './services/emergencyContactService';
export { clinicalTrialService } from './services/clinicalTrialService';
export { trialLocationService } from './services/trialLocationService';
export { accountService } from './services/accountService';

// ==================== SERVICE MIGRATION NOTES ====================
// All services have been moved to individual files in ./services/
// This file maintains backwards compatibility by re-exporting all services

// ==================== ADVANCED CLINICAL TRIAL SERVICES ====================
// Import advanced trial services (JRCT integration, matching, etc.)
export * as trialAggregator from '../services/clinicalTrials/trialSearchService';
export { default as trialMatcher } from '../services/clinicalTrials/trialMatcher';
export { default as clinicalTrialsService } from '../services/clinicalTrials/clinicalTrialsService';



