/**
 * Clinical Trial Matching Logic
 * Matches patient profiles with clinical trial eligibility criteria
 */

/**
 * Calculate match score between patient and trial
 * @param {Object} trial - Trial data
 * @param {Object} patientProfile - Patient demographics and medical info
 * @param {Object} genomicProfile - Patient's genomic profile (optional)
 * @returns {Object} - Match result with score and reasoning
 */
export function calculateTrialMatchScore(trial, patientProfile, genomicProfile = null) {
  const weights = {
    diagnosis: 30,
    age: 20,
    gender: 15,
    genomic: 25,
    status: 10
  };

  let totalScore = 0;
  let maxPossibleScore = 0;
  const matchDetails = [];
  const issues = [];

  // 1. Diagnosis Match (30 points)
  maxPossibleScore += weights.diagnosis;
  if (trial.conditions && patientProfile.diagnosis) {
    const diagnosisMatch = trial.conditions.some(condition =>
      condition.toLowerCase().includes(patientProfile.diagnosis.toLowerCase()) ||
      patientProfile.diagnosis.toLowerCase().includes(condition.toLowerCase())
    );

    if (diagnosisMatch) {
      totalScore += weights.diagnosis;
      matchDetails.push({
        category: 'Diagnosis',
        score: weights.diagnosis,
        detail: `Matches trial condition: ${patientProfile.diagnosis}`
      });
    } else {
      issues.push({
        category: 'Diagnosis',
        severity: 'high',
        detail: `Trial conditions (${trial.conditions.join(', ')}) may not match patient diagnosis (${patientProfile.diagnosis})`
      });
    }
  }

  // 2. Age Match (20 points)
  maxPossibleScore += weights.age;
  if (patientProfile.age) {
    const minAge = trial.eligibility?.minAge || 0;
    const maxAge = trial.eligibility?.maxAge || 150;

    if (patientProfile.age >= minAge && patientProfile.age <= maxAge) {
      totalScore += weights.age;
      matchDetails.push({
        category: 'Age',
        score: weights.age,
        detail: `Age ${patientProfile.age} within range (${minAge}-${maxAge})`
      });
    } else {
      issues.push({
        category: 'Age',
        severity: 'high',
        detail: `Patient age (${patientProfile.age}) outside trial range (${minAge}-${maxAge})`
      });
    }
  }

  // 3. Gender Match (15 points)
  maxPossibleScore += weights.gender;
  if (trial.eligibility?.gender && patientProfile.gender) {
    const trialGender = trial.eligibility.gender.toLowerCase();
    const patientGender = patientProfile.gender.toLowerCase();

    if (trialGender === 'all' || trialGender === patientGender) {
      totalScore += weights.gender;
      matchDetails.push({
        category: 'Gender',
        score: weights.gender,
        detail: `Gender matches: ${patientProfile.gender}`
      });
    } else {
      issues.push({
        category: 'Gender',
        severity: 'high',
        detail: `Trial requires ${trial.eligibility.gender}, patient is ${patientProfile.gender}`
      });
    }
  }

  // 4. Genomic Match (25 points)
  maxPossibleScore += weights.genomic;
  if (genomicProfile && trial.genomicCriteria && trial.genomicCriteria.length > 0) {
    const genomicMatches = checkGenomicMatches(trial.genomicCriteria, genomicProfile);

    if (genomicMatches.matches.length > 0) {
      // Partial credit based on how many genomic criteria are met
      const genomicScore = (genomicMatches.matches.length / genomicMatches.total) * weights.genomic;
      totalScore += genomicScore;

      matchDetails.push({
        category: 'Genomic',
        score: genomicScore,
        detail: `Genomic matches: ${genomicMatches.matches.join(', ')}`
      });

      if (genomicMatches.mismatches.length > 0) {
        issues.push({
          category: 'Genomic',
          severity: 'medium',
          detail: `Some genomic criteria not met: ${genomicMatches.mismatches.join(', ')}`
        });
      }
    } else {
      issues.push({
        category: 'Genomic',
        severity: 'high',
        detail: `No genomic criteria match. Trial requires: ${trial.genomicCriteria.join(', ')}`
      });
    }
  } else if (genomicProfile && (!trial.genomicCriteria || trial.genomicCriteria.length === 0)) {
    // No genomic criteria required, give full points
    totalScore += weights.genomic;
    matchDetails.push({
      category: 'Genomic',
      score: weights.genomic,
      detail: 'No specific genomic requirements'
    });
  }

  // 5. Trial Status (10 points)
  maxPossibleScore += weights.status;
  if (trial.status) {
    const status = trial.status.toLowerCase();
    if (status.includes('recruiting') || status.includes('active')) {
      totalScore += weights.status;
      matchDetails.push({
        category: 'Status',
        score: weights.status,
        detail: `Trial is actively recruiting`
      });
    } else {
      issues.push({
        category: 'Status',
        severity: 'medium',
        detail: `Trial status: ${trial.status} (not actively recruiting)`
      });
    }
  }

  // Calculate final match percentage
  const matchPercentage = Math.round((totalScore / maxPossibleScore) * 100);

  // Determine eligibility level
  let eligibilityLevel;
  if (matchPercentage >= 80 && issues.filter(i => i.severity === 'high').length === 0) {
    eligibilityLevel = 'highly_eligible';
  } else if (matchPercentage >= 60 && issues.filter(i => i.severity === 'high').length <= 1) {
    eligibilityLevel = 'potentially_eligible';
  } else {
    eligibilityLevel = 'unlikely_eligible';
  }

  return {
    matchPercentage,
    eligibilityLevel,
    totalScore,
    maxPossibleScore,
    matchDetails,
    issues,
    recommendation: generateRecommendation(eligibilityLevel, matchDetails, issues)
  };
}

/**
 * Check which genomic criteria match the patient's profile
 * @param {Array<string>} trialCriteria - Trial's genomic requirements
 * @param {Object} genomicProfile - Patient's genomic profile
 * @returns {Object} - Matches and mismatches
 */
function checkGenomicMatches(trialCriteria, genomicProfile) {
  const matches = [];
  const mismatches = [];

  trialCriteria.forEach(criterion => {
    const criterionLower = criterion.toLowerCase();

    // BRCA mutations
    if (criterionLower.includes('brca')) {
      const hasBRCA = genomicProfile.mutations?.some(
        m => m.gene === 'BRCA1' || m.gene === 'BRCA2'
      );
      if (hasBRCA) {
        matches.push('BRCA mutation');
      } else {
        mismatches.push('BRCA mutation');
      }
    }

    // TMB-high
    else if (criterionLower.includes('tmb')) {
      const isTMBHigh = genomicProfile.biomarkers?.tumorMutationalBurden?.interpretation === 'high';
      if (isTMBHigh) {
        matches.push('TMB-high');
      } else {
        mismatches.push('TMB-high');
      }
    }

    // MSI-H
    else if (criterionLower.includes('msi')) {
      const isMSIHigh = genomicProfile.biomarkers?.microsatelliteInstability?.status === 'MSI-H';
      if (isMSIHigh) {
        matches.push('MSI-H');
      } else {
        mismatches.push('MSI-H');
      }
    }

    // HRD-positive
    else if (criterionLower.includes('hrd')) {
      const isHRDPositive = genomicProfile.biomarkers?.hrdScore?.interpretation === 'HRD-positive';
      if (isHRDPositive) {
        matches.push('HRD-positive');
      } else {
        mismatches.push('HRD-positive');
      }
    }

    // PD-L1 expression
    else if (criterionLower.includes('pd-l1') || criterionLower.includes('pdl1')) {
      const hasPDL1 = genomicProfile.biomarkers?.pdl1Expression?.interpretation === 'high';
      if (hasPDL1) {
        matches.push('PD-L1 high');
      } else {
        mismatches.push('PD-L1 high');
      }
    }

    // Specific gene mutations
    else {
      const hasGeneMutation = genomicProfile.mutations?.some(
        m => m.gene.toLowerCase() === criterionLower
      );
      if (hasGeneMutation) {
        matches.push(`${criterion} mutation`);
      } else {
        mismatches.push(`${criterion} mutation`);
      }
    }
  });

  return {
    matches,
    mismatches,
    total: trialCriteria.length
  };
}

/**
 * Generate recommendation text based on match results
 * @param {string} eligibilityLevel - Eligibility level
 * @param {Array} matchDetails - Details of matches
 * @param {Array} issues - Issues found
 * @returns {string} - Recommendation text
 */
function generateRecommendation(eligibilityLevel, matchDetails, issues) {
  const highIssues = issues.filter(i => i.severity === 'high');

  if (eligibilityLevel === 'highly_eligible') {
    return `✅ Highly recommended. Patient meets all major eligibility criteria with ${matchDetails.length} strong matches. Consider discussing with oncologist.`;
  } else if (eligibilityLevel === 'potentially_eligible') {
    if (highIssues.length === 0) {
      return `⚠️ Potentially eligible. Patient meets most criteria but has minor considerations. Review eligibility details with medical team.`;
    } else {
      return `⚠️ Potentially eligible with considerations. ${highIssues[0].detail}. Consult with oncologist to determine if exceptions apply.`;
    }
  } else {
    if (highIssues.length > 0) {
      return `❌ Unlikely eligible. ${highIssues[0].detail}. Consider exploring other trial options.`;
    } else {
      return `❌ Not recommended. Patient does not meet sufficient eligibility criteria for this trial.`;
    }
  }
}

/**
 * Sort trials by match score
 * @param {Array} trials - Array of trials with match results
 * @returns {Array} - Sorted trials (highest match first)
 */
export function sortTrialsByMatch(trials) {
  return trials.sort((a, b) => {
    // Sort by eligibility level first
    const eligibilityOrder = {
      'highly_eligible': 3,
      'potentially_eligible': 2,
      'unlikely_eligible': 1
    };

    const aLevel = eligibilityOrder[a.matchResult?.eligibilityLevel] || 0;
    const bLevel = eligibilityOrder[b.matchResult?.eligibilityLevel] || 0;

    if (aLevel !== bLevel) {
      return bLevel - aLevel; // Higher level first
    }

    // Then sort by match percentage
    const aScore = a.matchResult?.matchPercentage || 0;
    const bScore = b.matchResult?.matchPercentage || 0;

    return bScore - aScore; // Higher score first
  });
}

/**
 * Filter trials by minimum match threshold
 * @param {Array} trials - Array of trials with match results
 * @param {number} minMatchPercentage - Minimum match percentage (0-100)
 * @returns {Array} - Filtered trials
 */
export function filterTrialsByMatchThreshold(trials, minMatchPercentage = 50) {
  return trials.filter(trial =>
    trial.matchResult?.matchPercentage >= minMatchPercentage
  );
}

/**
 * Group trials by eligibility level
 * @param {Array} trials - Array of trials with match results
 * @returns {Object} - Trials grouped by eligibility level
 */
export function groupTrialsByEligibility(trials) {
  return {
    highly_eligible: trials.filter(t => t.matchResult?.eligibilityLevel === 'highly_eligible'),
    potentially_eligible: trials.filter(t => t.matchResult?.eligibilityLevel === 'potentially_eligible'),
    unlikely_eligible: trials.filter(t => t.matchResult?.eligibilityLevel === 'unlikely_eligible')
  };
}

export default {
  calculateTrialMatchScore,
  sortTrialsByMatch,
  filterTrialsByMatchThreshold,
  groupTrialsByEligibility
};
