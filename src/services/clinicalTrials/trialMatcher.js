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

  // 2. Age Match (20 points) - Also check eligibilityCriteria.text for exclusions with unit normalization
  maxPossibleScore += weights.age;
  if (patientProfile.age) {
    // First check structured eligibility data
    const minAge = trial.eligibility?.minAge || 0;
    const maxAge = trial.eligibility?.maxAge || 150;
    
    // Also check eligibilityCriteria.text for age exclusions (with unit handling)
    let ageExcluded = false;
    if (trial.eligibilityCriteria) {
      const eligibilityMatch = matchesTrialEligibility(trial, patientProfile, genomicProfile);
      if (eligibilityMatch.exclusionFound && eligibilityMatch.exclusionReasons.some(r => r.toLowerCase().includes('age'))) {
        ageExcluded = true;
        // Add issues from eligibility match
        eligibilityMatch.issues.forEach(issue => {
          if (issue.category === 'Age' || issue.detail.toLowerCase().includes('age')) {
            issues.push(issue);
          }
        });
      }
    }

    if (ageExcluded) {
      // Issue already added from eligibilityMatch
    } else if (patientProfile.age >= minAge && patientProfile.age <= maxAge) {
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

  // 4. Genomic Match (25 points) - Also check eligibilityCriteria.text for mutation mentions and negative matches
  maxPossibleScore += weights.genomic;
  if (genomicProfile) {
    // First check structured genomic criteria
    if (trial.genomicCriteria && trial.genomicCriteria.length > 0) {
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
    } else if (trial.eligibilityCriteria) {
      // No structured criteria, but check eligibilityCriteria.text for mutation mentions and negative matches
      const eligibilityMatch = matchesTrialEligibility(trial, patientProfile, genomicProfile);
      
      // Add any issues from negative matches
      eligibilityMatch.issues.forEach(issue => {
        issues.push(issue);
      });
      
      if (eligibilityMatch.negativeMatches.length > 0) {
        // Negative matches found - don't give points
        issues.push({
          category: 'Genomic',
          severity: 'high',
          detail: `Patient mutations found in exclusion criteria: ${eligibilityMatch.negativeMatches.join(', ')}`
        });
      } else if (eligibilityMatch.totalMutations > 0) {
        // Score based on how many mutations are mentioned in criteria
        const genomicScore = (eligibilityMatch.mutationMatches / eligibilityMatch.totalMutations) * weights.genomic;
        totalScore += genomicScore;
        
        matchDetails.push({
          category: 'Genomic',
          score: genomicScore,
          detail: `${eligibilityMatch.mutationMatches} of ${eligibilityMatch.totalMutations} mutations mentioned in criteria${eligibilityMatch.matchedMutations.length > 0 ? ` (${eligibilityMatch.matchedMutations.join(', ')})` : ''}`
        });
      } else {
        // No mutations to check, give full points
        totalScore += weights.genomic;
        matchDetails.push({
          category: 'Genomic',
          score: weights.genomic,
          detail: 'No specific genomic requirements'
        });
      }
    } else {
      // No genomic criteria required, give full points
      totalScore += weights.genomic;
      matchDetails.push({
        category: 'Genomic',
        score: weights.genomic,
        detail: 'No specific genomic requirements'
      });
    }
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
 * Check if a trial matches eligibility criteria based on eligibilityCriteria.text
 * Uses simple text-matching logic to check for exclusions and count mutation matches
 * Handles negative matches (mutations in exclusion sections or preceded by "negative")
 * @param {Object} trial - Trial data with eligibilityCriteria.text
 * @param {Object} patientProfile - Patient demographics (age, gender)
 * @param {Object} genomicProfile - Patient's genomic profile (mutations, cnvs)
 * @returns {Object} - Match result with matchScore, issues, and details
 */
export function matchesTrialEligibility(trial, patientProfile, genomicProfile = null) {
  const eligibilityText = trial.eligibilityCriteria || '';
  
  if (!eligibilityText || typeof eligibilityText !== 'string') {
    return {
      matchScore: 0,
      exclusionFound: false,
      mutationMatches: 0,
      totalMutations: 0,
      issues: [],
      details: 'No eligibility criteria text available'
    };
  }
  
  const textLower = eligibilityText.toLowerCase();
  let exclusionFound = false;
  const exclusionReasons = [];
  const issues = [];
  let mutationMatches = 0;
  const matchedMutations = [];
  const negativeMatches = []; // Mutations found in exclusion context
  const totalMutations = [];
  
  // Split text into inclusion and exclusion sections
  const exclusionSection = textLower.includes('exclusion criteria') 
    ? textLower.split('exclusion criteria')[1] || ''
    : '';
  const inclusionSection = textLower.includes('inclusion criteria')
    ? textLower.split('inclusion criteria')[1]?.split('exclusion criteria')[0] || textLower
    : textLower;
  
  // Helper function to normalize age with units
  function normalizeAge(ageText, patientAge) {
    // Extract number and unit
    const ageMatch = ageText.match(/\b(\d+)\s*(years?|months?|yrs?|mos?)\b/i);
    if (!ageMatch) return null;
    
    const ageValue = parseInt(ageMatch[1]);
    const unit = ageMatch[2].toLowerCase();
    
    // Convert to years if needed
    if (unit.includes('month')) {
      return ageValue / 12; // Convert months to years
    }
    return ageValue; // Already in years
  }
  
  // Check for exclusion keywords related to age (with unit normalization)
  if (patientProfile.age) {
    const ageExclusionPatterns = [
      /exclusion.*age.*\b(\d+)\s*(years?|months?|yrs?|mos?)?\b/i,
      /age.*\b(\d+)\s*(years?|months?|yrs?|mos?)?\b.*exclusion/i,
      /exclude.*age.*\b(\d+)\s*(years?|months?|yrs?|mos?)?\b/i,
      /age.*greater than.*\b(\d+)\s*(years?|months?|yrs?|mos?)?\b/i,
      /age.*less than.*\b(\d+)\s*(years?|months?|yrs?|mos?)?\b/i,
      /age.*over.*\b(\d+)\s*(years?|months?|yrs?|mos?)?\b/i,
      /age.*under.*\b(\d+)\s*(years?|months?|yrs?|mos?)?\b/i
    ];
    
    for (const pattern of ageExclusionPatterns) {
      const match = textLower.match(pattern);
      if (match) {
        const normalizedAge = normalizeAge(match[0], patientProfile.age);
        if (normalizedAge !== null) {
          // Check if patient age would be excluded
          if (textLower.includes('greater than') || textLower.includes('over')) {
            if (patientProfile.age > normalizedAge) {
              exclusionFound = true;
              exclusionReasons.push(`Age exclusion: over ${normalizedAge} years`);
            }
          } else if (textLower.includes('less than') || textLower.includes('under')) {
            if (patientProfile.age < normalizedAge) {
              exclusionFound = true;
              exclusionReasons.push(`Age exclusion: under ${normalizedAge} years`);
            }
          }
        }
      }
    }
    
    // Check for explicit age exclusions in exclusion section
    if (exclusionSection && exclusionSection.includes('age')) {
      const agePattern = new RegExp(`\\b${patientProfile.age}\\s*(years?|yrs?)\\b`, 'i');
      if (agePattern.test(exclusionSection)) {
        exclusionFound = true;
        exclusionReasons.push(`Age ${patientProfile.age} mentioned in exclusion criteria`);
      }
    }
  }
  
  // Check for exclusion keywords related to gender
  if (patientProfile.gender) {
    const genderLower = patientProfile.gender.toLowerCase();
    const genderExclusionPatterns = [
      new RegExp(`exclusion.*${genderLower}`, 'i'),
      new RegExp(`exclude.*${genderLower}`, 'i'),
      new RegExp(`${genderLower}.*exclusion`, 'i')
    ];
    
    for (const pattern of genderExclusionPatterns) {
      if (pattern.test(textLower)) {
        exclusionFound = true;
        exclusionReasons.push(`Gender exclusion: ${patientProfile.gender}`);
        break;
      }
    }
    
    // Check exclusion criteria section for gender
    if (exclusionSection) {
      if (exclusionSection.includes(genderLower) || 
          (genderLower === 'female' && exclusionSection.includes('women')) ||
          (genderLower === 'male' && exclusionSection.includes('men'))) {
        exclusionFound = true;
        exclusionReasons.push(`${patientProfile.gender} mentioned in exclusion criteria`);
      }
    }
  }
  
  // Count how many patient mutations are mentioned in eligibility criteria
  // Check for negative matches (preceded by "negative" or in exclusion section)
  if (genomicProfile) {
    // Check mutations
    if (genomicProfile.mutations && Array.isArray(genomicProfile.mutations)) {
      genomicProfile.mutations.forEach(mutation => {
        if (mutation.gene) {
          totalMutations.push(mutation.gene);
          const geneName = mutation.gene.toUpperCase();
          const genePattern = new RegExp(`\\b${geneName}\\b|\\b${mutation.gene}\\b`, 'i');
          
          // Check if gene is mentioned in exclusion section (negative match)
          if (exclusionSection && genePattern.test(exclusionSection)) {
            negativeMatches.push(mutation.gene);
            issues.push({
              category: 'Genomic',
              severity: 'high',
              detail: `${mutation.gene} mutation found in exclusion criteria - patient has this mutation`
            });
          }
          // Check if gene is preceded by "negative" (negative match)
          else if (/\bnegative\s+(?:for\s+)?(?:the\s+)?(?:presence\s+of\s+)?(?:a\s+)?(?:mutation\s+in\s+)?(?:mutation\s+of\s+)?/i.test(textLower)) {
            const negativeContext = textLower.match(new RegExp(`\\bnegative\\s+(?:for\\s+)?(?:the\\s+)?(?:presence\\s+of\\s+)?(?:a\\s+)?(?:mutation\\s+in\\s+)?(?:mutation\\s+of\\s+)?[^.]*?\\b${geneName}\\b|\\b${mutation.gene}\\b`, 'i'));
            if (negativeContext) {
              negativeMatches.push(mutation.gene);
              issues.push({
                category: 'Genomic',
                severity: 'high',
                detail: `${mutation.gene} mutation mentioned with "negative" context - patient has this mutation`
              });
            }
          }
          // Positive match (in inclusion section or general text, not in exclusion)
          else if (genePattern.test(inclusionSection) || (genePattern.test(textLower) && !exclusionSection)) {
            mutationMatches++;
            matchedMutations.push(mutation.gene);
          }
        }
      });
    }
    
    // Check CNVs (copy number variants)
    if (genomicProfile.cnvs && Array.isArray(genomicProfile.cnvs)) {
      genomicProfile.cnvs.forEach(cnv => {
        if (cnv.gene) {
          totalMutations.push(cnv.gene);
          const geneName = cnv.gene.toUpperCase();
          const genePattern = new RegExp(`\\b${geneName}\\b|\\b${cnv.gene}\\b`, 'i');
          
          // Check if CNV is mentioned in exclusion section (negative match)
          if (exclusionSection && genePattern.test(exclusionSection)) {
            negativeMatches.push(cnv.gene);
            issues.push({
              category: 'Genomic',
              severity: 'high',
              detail: `${cnv.gene} CNV found in exclusion criteria - patient has this CNV`
            });
          }
          // Check if CNV is preceded by "negative"
          else if (/\bnegative\s+(?:for\s+)?(?:the\s+)?(?:presence\s+of\s+)?(?:a\s+)?(?:amplification\s+of\s+)?(?:deletion\s+of\s+)?/i.test(textLower)) {
            const negativeContext = textLower.match(new RegExp(`\\bnegative\\s+(?:for\\s+)?(?:the\\s+)?(?:presence\\s+of\\s+)?(?:a\\s+)?(?:amplification\\s+of\\s+)?(?:deletion\\s+of\\s+)?[^.]*?\\b${geneName}\\b|\\b${cnv.gene}\\b`, 'i'));
            if (negativeContext) {
              negativeMatches.push(cnv.gene);
              issues.push({
                category: 'Genomic',
                severity: 'high',
                detail: `${cnv.gene} CNV mentioned with "negative" context - patient has this CNV`
              });
            }
          }
          // Positive match
          else if (genePattern.test(inclusionSection) || (genePattern.test(textLower) && !exclusionSection)) {
            mutationMatches++;
            matchedMutations.push(cnv.gene);
          }
        }
      });
    }
    
    // Check for biomarker mentions (BRCA, TMB, MSI, HRD) - handle negative matches
    if (genomicProfile.biomarkers) {
      // BRCA
      if (genomicProfile.mutations?.some(m => m.gene === 'BRCA1' || m.gene === 'BRCA2')) {
        if (exclusionSection && /\bbrca\b/i.test(exclusionSection)) {
          negativeMatches.push('BRCA');
          issues.push({
            category: 'Genomic',
            severity: 'high',
            detail: 'BRCA mutation found in exclusion criteria - patient has BRCA mutation'
          });
        } else if (/\bnegative\s+(?:for\s+)?(?:brca|brca1|brca2)\b/i.test(textLower)) {
          negativeMatches.push('BRCA');
          issues.push({
            category: 'Genomic',
            severity: 'high',
            detail: 'BRCA mentioned with "negative" context - patient has BRCA mutation'
          });
        } else if (/\bbrca\b/i.test(textLower)) {
          mutationMatches++;
          matchedMutations.push('BRCA');
        }
      }
      
      // TMB
      if (genomicProfile.biomarkers.tumorMutationalBurden?.interpretation === 'high') {
        if (exclusionSection && (/\btmb\b|\btumor.*mutational.*burden\b/i.test(exclusionSection))) {
          negativeMatches.push('TMB-high');
          issues.push({
            category: 'Genomic',
            severity: 'high',
            detail: 'TMB-high found in exclusion criteria - patient has high TMB'
          });
        } else if (/\btmb\b|\btumor.*mutational.*burden\b/i.test(textLower)) {
          mutationMatches++;
          matchedMutations.push('TMB-high');
        }
      }
      
      // MSI-H
      if (genomicProfile.biomarkers.microsatelliteInstability?.status === 'MSI-H') {
        if (exclusionSection && (/\bmsi-h\b|\bmicrosatellite.*instability\b/i.test(exclusionSection))) {
          negativeMatches.push('MSI-H');
          issues.push({
            category: 'Genomic',
            severity: 'high',
            detail: 'MSI-H found in exclusion criteria - patient has MSI-H'
          });
        } else if (/\bmsi-h\b|\bmicrosatellite.*instability\b/i.test(textLower)) {
          mutationMatches++;
          matchedMutations.push('MSI-H');
        }
      }
      
      // HRD
      if (genomicProfile.biomarkers.hrdScore?.interpretation === 'HRD-positive') {
        if (exclusionSection && (/\bhrd\b|\bhomologous.*recombination.*deficiency\b/i.test(exclusionSection))) {
          negativeMatches.push('HRD-positive');
          issues.push({
            category: 'Genomic',
            severity: 'high',
            detail: 'HRD-positive found in exclusion criteria - patient has HRD-positive'
          });
        } else if (/\bhrd\b|\bhomologous.*recombination.*deficiency\b/i.test(textLower)) {
          mutationMatches++;
          matchedMutations.push('HRD-positive');
        }
      }
    }
  }
  
  // Calculate matchScore based on mutation matches
  // Score: 0-100, where 100 = all mutations mentioned, 0 = exclusion found or no matches
  let matchScore = 0;
  
  if (exclusionFound || negativeMatches.length > 0) {
    matchScore = 0;
  } else if (totalMutations.length > 0) {
    // Score based on percentage of mutations mentioned
    matchScore = Math.round((mutationMatches / totalMutations.length) * 100);
  } else {
    // No mutations to check, give neutral score
    matchScore = 50;
  }
  
  return {
    matchScore,
    exclusionFound: exclusionFound || negativeMatches.length > 0,
    exclusionReasons,
    mutationMatches,
    totalMutations: totalMutations.length,
    matchedMutations,
    negativeMatches,
    issues,
    details: exclusionFound || negativeMatches.length > 0
      ? `Exclusion found: ${exclusionReasons.join('; ')}${negativeMatches.length > 0 ? `; Negative genomic matches: ${negativeMatches.join(', ')}` : ''}`
      : totalMutations.length > 0
        ? `${mutationMatches} of ${totalMutations.length} mutations mentioned in criteria${matchedMutations.length > 0 ? ` (${matchedMutations.join(', ')})` : ''}`
        : 'No mutations to check against criteria'
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
    // For unlikely_eligible, explicitly list all high severity issues
    if (highIssues.length > 0) {
      const issueList = highIssues.map((issue, idx) => {
        return `${idx + 1}. ${issue.detail}`;
      }).join(' ');
      return `❌ Unlikely eligible. The following high-severity issues disqualify this trial: ${issueList}. Consider exploring other trial options.`;
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
  matchesTrialEligibility,
  sortTrialsByMatch,
  filterTrialsByMatchThreshold,
  groupTrialsByEligibility
};
