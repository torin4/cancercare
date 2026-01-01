import React from 'react';
import ClinicalTrials from '../ClinicalTrials';

export default function TrialsTab({ onTabChange }) {
  // ClinicalTrials component manages its own state and uses contexts internally
  // When a trial is selected, switch to chat tab
  // Note: Trial context will be handled by ChatTab when it's extracted
  const handleTrialSelected = (trial) => {
    // Store trial context in sessionStorage temporarily for chat tab
    if (trial) {
      sessionStorage.setItem('currentTrialContext', JSON.stringify(trial));
    }
    // Switch to chat tab
    if (onTabChange) {
      onTabChange('chat');
    }
  };

  return (
    <ClinicalTrials onTrialSelected={handleTrialSelected} />
  );
}

