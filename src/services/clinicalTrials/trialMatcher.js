/**
 * Clinical Trial Matching Logic
 * Matches patient profiles with clinical trial eligibility criteria
 */

/**
 * Medical term synonyms for better matching
 * Maps common medical term variations to canonical forms
 */
const MEDICAL_TERM_SYNONYMS = {
  // Cancer type synonyms
  'cancer': ['neoplasm', 'neoplasms', 'carcinoma', 'carcinomas', 'tumor', 'tumors', 'tumour', 'tumours', 'malignancy', 'malignancies'],
  'neoplasm': ['cancer', 'carcinoma', 'tumor', 'tumour', 'malignancy'],
  'neoplasms': ['cancer', 'carcinoma', 'tumor', 'tumour', 'malignancy'],
  'carcinoma': ['cancer', 'neoplasm', 'tumor', 'tumour', 'malignancy'],
  'tumor': ['cancer', 'neoplasm', 'carcinoma', 'tumour', 'malignancy'],
  'tumour': ['cancer', 'neoplasm', 'carcinoma', 'tumor', 'malignancy'],
  
  // Specific cancer type synonyms
  'ovarian cancer': ['ovarian neoplasm', 'ovarian neoplasms', 'ovarian carcinoma', 'ovarian tumor', 'ovarian tumour', 'ovarian malignancy'],
  'ovarian neoplasm': ['ovarian cancer', 'ovarian carcinoma', 'ovarian tumor', 'ovarian tumour'],
  'ovarian neoplasms': ['ovarian cancer', 'ovarian carcinoma', 'ovarian tumor', 'ovarian tumour'],
  'ovarian carcinoma': ['ovarian cancer', 'ovarian neoplasm', 'ovarian neoplasms'],
  
  'breast cancer': ['breast neoplasm', 'breast neoplasms', 'breast carcinoma', 'breast tumor', 'breast tumour'],
  'lung cancer': ['lung neoplasm', 'lung neoplasms', 'lung carcinoma', 'lung tumor', 'lung tumour'],
  'colorectal cancer': ['colorectal neoplasm', 'colorectal neoplasms', 'colorectal carcinoma', 'colorectal tumor', 'colorectal tumour'],
  
  // Subtype synonyms
  'clear cell': ['clear cell carcinoma', 'clear cell cancer', 'clear cell neoplasm'],
  'clear cell carcinoma': ['clear cell', 'clear cell cancer', 'clear cell neoplasm'],
  'clear cell sarcoma': ['clear cell', 'clear cell cancer', 'clear cell neoplasm'],
  'clear cell cancer': ['clear cell', 'clear cell carcinoma', 'clear cell sarcoma', 'clear cell neoplasm'],
  
  'serous': ['serous carcinoma', 'serous cancer', 'serous neoplasm'],
  'endometrioid': ['endometrioid carcinoma', 'endometrioid cancer', 'endometrioid neoplasm'],
  'mucinous': ['mucinous carcinoma', 'mucinous cancer', 'mucinous neoplasm'],
};

/**
 * Normalize a medical term by checking synonyms
 * @param {string} term - Medical term to normalize
 * @returns {Array<string>} - Array of normalized terms (original + synonyms)
 */
function normalizeMedicalTerm(term) {
  if (!term) return [];
  
  const termLower = term.toLowerCase().trim();
  const normalized = [termLower];
  
  // Check if term is exactly a key in synonyms
  if (MEDICAL_TERM_SYNONYMS[termLower]) {
    normalized.push(...MEDICAL_TERM_SYNONYMS[termLower].map(s => s.toLowerCase()));
    // Also add the key itself
    normalized.push(termLower);
    // Also add all synonyms of the synonyms (transitive closure)
    MEDICAL_TERM_SYNONYMS[termLower].forEach(synonym => {
      const synonymLower = synonym.toLowerCase();
      if (MEDICAL_TERM_SYNONYMS[synonymLower]) {
        normalized.push(...MEDICAL_TERM_SYNONYMS[synonymLower].map(s => s.toLowerCase()));
      }
    });
  }
  
  // Check if any synonym key matches the term (exact or contains)
  for (const [key, synonyms] of Object.entries(MEDICAL_TERM_SYNONYMS)) {
    const keyLower = key.toLowerCase();
    // Exact match
    if (termLower === keyLower) {
      normalized.push(keyLower, ...synonyms.map(s => s.toLowerCase()));
    }
    // Term contains key or key contains term (for multi-word terms)
    else if (termLower.includes(keyLower) || keyLower.includes(termLower)) {
      normalized.push(keyLower, ...synonyms.map(s => s.toLowerCase()));
    }
    // Special case: if term is "ovarian neoplasms" and key is "ovarian cancer", they should match
    // This handles cases where the full term matches a synonym key
    else if ((termLower.includes('ovarian') && keyLower.includes('ovarian')) ||
             (termLower.includes('clear cell') && keyLower.includes('clear cell'))) {
      // Check if the non-ovarian/clear-cell parts are synonyms
      const termParts = termLower.split(/\s+/);
      const keyParts = keyLower.split(/\s+/);
      if (termParts.length === keyParts.length) {
        let matchingParts = 0;
        for (let i = 0; i < termParts.length; i++) {
          if (termParts[i] === keyParts[i]) {
            matchingParts++;
          } else {
            // Check if these parts are synonyms
            const part1Norm = normalizeMedicalTerm(termParts[i]);
            const part2Norm = normalizeMedicalTerm(keyParts[i]);
            if (part1Norm.some(p1 => part2Norm.some(p2 => p1 === p2 || p1.includes(p2) || p2.includes(p1)))) {
              matchingParts++;
            }
          }
        }
        if (matchingParts >= termParts.length - 1) {
          normalized.push(keyLower, ...synonyms.map(s => s.toLowerCase()));
        }
      }
    }
    // Check if term contains key as a whole word (better matching)
    else {
      const keyWords = keyLower.split(/\s+/);
      const termWords = termLower.split(/\s+/);
      // If all words of key are in term, or vice versa
      if (keyWords.every(word => termWords.some(tw => tw === word || tw.includes(word) || word.includes(tw))) ||
          termWords.every(word => keyWords.some(kw => kw === word || kw.includes(word) || word.includes(kw)))) {
        normalized.push(keyLower, ...synonyms.map(s => s.toLowerCase()));
      }
    }
  }
  
  // Also check reverse - if term contains any synonym value
  for (const [key, synonyms] of Object.entries(MEDICAL_TERM_SYNONYMS)) {
    synonyms.forEach(synonym => {
      const synonymLower = synonym.toLowerCase();
      if (termLower === synonymLower) {
        normalized.push(key.toLowerCase(), ...synonyms.map(s => s.toLowerCase()));
      } else if (termLower.includes(synonymLower) || synonymLower.includes(termLower)) {
        normalized.push(key.toLowerCase(), ...synonyms.map(s => s.toLowerCase()));
      } else {
        // Check word-by-word matching
        const synonymWords = synonymLower.split(/\s+/);
        const termWords = termLower.split(/\s+/);
        if (synonymWords.every(word => termWords.some(tw => tw === word || tw.includes(word) || word.includes(tw))) ||
            termWords.every(word => synonymWords.some(sw => sw === word || sw.includes(word) || word.includes(sw)))) {
          normalized.push(key.toLowerCase(), ...synonyms.map(s => s.toLowerCase()));
        }
      }
    });
  }
  
  return [...new Set(normalized)]; // Remove duplicates
}

/**
 * Check if a term is generic (too broad to match specific subtypes)
 * @param {string} term - Medical term to check
 * @returns {boolean} - True if term is generic
 */
function isGenericTerm(term) {
  if (!term) return false;
  const termLower = term.toLowerCase().trim();
  const genericTerms = [
    'solid tumor', 'solid tumour', 'solid tumors', 'solid tumours',
    'tumor', 'tumour', 'tumors', 'tumours',
    'cancer', 'cancers',
    'neoplasm', 'neoplasms',
    'malignancy', 'malignancies'
  ];
  return genericTerms.includes(termLower);
}

/**
 * Check if two medical terms match (using synonyms)
 * @param {string} term1 - First term
 * @param {string} term2 - Second term
 * @returns {boolean} - True if terms match
 */
function medicalTermsMatch(term1, term2) {
  if (!term1 || !term2) return false;
  
  const term1Lower = term1.toLowerCase().trim();
  const term2Lower = term2.toLowerCase().trim();
  
  // Direct match
  if (term1Lower === term2Lower) return true;
  
  // Prevent generic terms from matching specific terms
  // If one is generic and the other is specific, don't match at all (except exact match above)
  const term1IsGeneric = isGenericTerm(term1);
  const term2IsGeneric = isGenericTerm(term2);
  
  // Early exit: if one is generic and the other is specific, don't match
  // Generic terms like "Solid Tumors" should NOT match specific terms like "Ovarian Cancer"
  if (term1IsGeneric && !term2IsGeneric) {
    return false; // Generic term should never match specific term
  }
  if (!term1IsGeneric && term2IsGeneric) {
    return false; // Specific term should never match generic term
  }
  
  // CRITICAL: Prevent different specific carcinoma types from matching each other
  // "Carcinoma, Non-Small-Cell Lung" should NOT match "Clear Cell Carcinoma"
  // "Head and Neck Squamous Cell Carcinoma" should NOT match "Clear Cell Carcinoma"
  if (!term1IsGeneric && !term2IsGeneric) {
    // Both are specific terms - check if they're different carcinoma types
    const hasCarcinoma1 = term1Lower.includes('carcinoma');
    const hasCarcinoma2 = term2Lower.includes('carcinoma');
    
    if (hasCarcinoma1 && hasCarcinoma2) {
      // Both contain "carcinoma" - extract the specific descriptors
      const genericWords = ['carcinoma', 'carcinomas', 'cancer', 'cancers', 'neoplasm', 'neoplasms', 'tumor', 'tumors', 'tumour', 'tumours'];
      
      // Remove commas and split
      const term1Words = term1Lower.replace(/,/g, '').split(/\s+/).filter(w => w.length >= 2);
      const term2Words = term2Lower.replace(/,/g, '').split(/\s+/).filter(w => w.length >= 2);
      
      // Get specific (non-generic) words
      const term1Specific = term1Words.filter(w => !genericWords.includes(w)).join(' ').toLowerCase().trim();
      const term2Specific = term2Words.filter(w => !genericWords.includes(w)).join(' ').toLowerCase().trim();
      
      // If they have different specific descriptors, don't match via substring
      // E.g., "non-small-cell lung" vs "clear cell" - these are different
      if (term1Specific && term2Specific && term1Specific !== term2Specific) {
        // Check if one contains the other as a complete phrase
        // "clear cell" should match "clear cell carcinoma" but NOT "non-small-cell lung"
        const term1ContainsTerm2 = term1Specific.includes(term2Specific);
        const term2ContainsTerm1 = term2Specific.includes(term1Specific);
        
        if (!term1ContainsTerm2 && !term2ContainsTerm1) {
          // They have different specific descriptors - prevent substring matching
          // But still allow exact matches and synonym matches (checked later)
          // Skip the simple substring check below
        } else {
          // One contains the other - this is okay (e.g., "clear cell" in "clear cell carcinoma")
          // Allow substring matching
          if (term1Lower.includes(term2Lower) || term2Lower.includes(term1Lower)) return true;
        }
      } else {
        // Same specific descriptors or one has no specific words - allow substring matching
        if (term1Lower.includes(term2Lower) || term2Lower.includes(term1Lower)) return true;
      }
    } else {
      // Not both carcinoma types - allow substring matching
      if (term1Lower.includes(term2Lower) || term2Lower.includes(term1Lower)) return true;
    }
  } else {
    // Both are generic - allow substring matching
    if (term1Lower.includes(term2Lower) || term2Lower.includes(term1Lower)) return true;
  }
  
  // Check if terms match via synonym map (exact key match)
  if (MEDICAL_TERM_SYNONYMS[term1Lower]) {
    const synonyms1 = MEDICAL_TERM_SYNONYMS[term1Lower].map(s => s.toLowerCase());
    if (synonyms1.includes(term2Lower)) return true;
    // Only allow substring matching if both terms are not generic
    if (!term1IsGeneric && !term2IsGeneric) {
      if (synonyms1.some(s => s.includes(term2Lower) || term2Lower.includes(s))) return true;
    }
  }
  if (MEDICAL_TERM_SYNONYMS[term2Lower]) {
    const synonyms2 = MEDICAL_TERM_SYNONYMS[term2Lower].map(s => s.toLowerCase());
    if (synonyms2.includes(term1Lower)) return true;
    // Only allow substring matching if both terms are not generic
    if (!term1IsGeneric && !term2IsGeneric) {
      if (synonyms2.some(s => s.includes(term1Lower) || term1Lower.includes(s))) return true;
    }
  }
  
  // Direct synonym check: "Ovarian Neoplasms" should match "Ovarian Cancer"
  // Check all keys in synonym map to see if either term matches a key and the other matches a synonym
  // Be more strict: require exact matches or word-by-word matching, not substring matching for generic terms
  for (const [key, synonyms] of Object.entries(MEDICAL_TERM_SYNONYMS)) {
    const keyLower = key.toLowerCase();
    const synonymsLower = synonyms.map(s => s.toLowerCase());
    const keyIsGeneric = isGenericTerm(key);
    
    // If term1 matches key and term2 matches a synonym (or vice versa)
    // Use exact matching for generic terms, allow substring for specific terms
    const term1MatchesKey = term1Lower === keyLower || 
                           (!keyIsGeneric && !term1IsGeneric && (term1Lower.includes(keyLower) || keyLower.includes(term1Lower)));
    const term2MatchesSynonym = synonymsLower.some(s => {
      const sIsGeneric = isGenericTerm(s);
      if (term2Lower === s) return true;
      // Only allow substring matching if both are specific terms
      if (!sIsGeneric && !term2IsGeneric) {
        return term2Lower.includes(s) || s.includes(term2Lower);
      }
      return false;
    });
    
    if (term1MatchesKey && term2MatchesSynonym) {
      return true;
    }
    
    // Reverse check
    const term2MatchesKey = term2Lower === keyLower || 
                           (!keyIsGeneric && !term2IsGeneric && (term2Lower.includes(keyLower) || keyLower.includes(term2Lower)));
    const term1MatchesSynonym = synonymsLower.some(s => {
      const sIsGeneric = isGenericTerm(s);
      if (term1Lower === s) return true;
      // Only allow substring matching if both are specific terms
      if (!sIsGeneric && !term1IsGeneric) {
        return term1Lower.includes(s) || s.includes(term1Lower);
      }
      return false;
    });
    
    if (term2MatchesKey && term1MatchesSynonym) {
      return true;
    }
  }
  
  // Special case: Check if both terms share the same base word and the other parts are synonyms
  // E.g., "Ovarian Neoplasms" vs "Ovarian Cancer" - both have "Ovarian", and "Neoplasms" is synonym of "Cancer"
  const term1Words = term1Lower.split(/\s+/);
  const term2Words = term2Lower.split(/\s+/);
  
  if (term1Words.length === term2Words.length && term1Words.length >= 2) {
    // Check if all words match (directly or via synonyms)
    let matchingWords = 0;
    for (let i = 0; i < term1Words.length; i++) {
      const w1 = term1Words[i];
      const w2 = term2Words[i];
      
      if (w1 === w2) {
        matchingWords++;
      } else {
        // Check if words are synonyms (direct check first for speed)
        // But prevent generic words from matching specific words
        const w1IsGeneric = isGenericTerm(w1);
        const w2IsGeneric = isGenericTerm(w2);
        
        if (w1IsGeneric && !w2IsGeneric) {
          // Generic word should not match specific word - skip this word
          continue;
        } else if (!w1IsGeneric && w2IsGeneric) {
          // Specific word should not match generic word - skip this word
          continue;
        } else {
          // Both are generic or both are specific - allow synonym matching
          if (MEDICAL_TERM_SYNONYMS[w1] && MEDICAL_TERM_SYNONYMS[w1].map(s => s.toLowerCase()).includes(w2)) {
            matchingWords++;
          } else if (MEDICAL_TERM_SYNONYMS[w2] && MEDICAL_TERM_SYNONYMS[w2].map(s => s.toLowerCase()).includes(w1)) {
            matchingWords++;
          } else {
            // Use normalization for more complex cases, but still check for generic terms
            const w1Norm = normalizeMedicalTerm(w1);
            const w2Norm = normalizeMedicalTerm(w2);
            const hasMatch = w1Norm.some(n1 => {
              const n1IsGeneric = isGenericTerm(n1);
              return w2Norm.some(n2 => {
                const n2IsGeneric = isGenericTerm(n2);
                if (n1 === n2) return true;
                // Only allow substring matching if both are not generic
                if (!(n1IsGeneric && !n2IsGeneric) && !(!n1IsGeneric && n2IsGeneric)) {
                  return n1.includes(n2) || n2.includes(n1);
                }
                return false;
              });
            });
            if (hasMatch) {
              matchingWords++;
            }
          }
        }
      }
    }
    
    // If all words match, it's a match
    if (matchingWords === term1Words.length) return true;
  }
  
  // Normalize both terms to get all synonyms
  // BUT: Skip normalization if one is generic and the other is specific (already checked above)
  // This prevents generic terms from matching through normalized synonyms
  if (!((term1IsGeneric && !term2IsGeneric) || (!term1IsGeneric && term2IsGeneric))) {
    const normalized1 = normalizeMedicalTerm(term1);
    const normalized2 = normalizeMedicalTerm(term2);
    
    // Check if any normalized versions match exactly
    for (const norm1 of normalized1) {
      for (const norm2 of normalized2) {
        if (norm1 === norm2) return true;
        // Check if one contains the other (for partial matches)
        // But prevent generic terms from matching specific subtypes
        const norm1IsGeneric = isGenericTerm(norm1);
        const norm2IsGeneric = isGenericTerm(norm2);
        if (!(norm1IsGeneric && !norm2IsGeneric) && !(!norm1IsGeneric && norm2IsGeneric)) {
          // Both are generic or both are specific
          // For specific terms, be more strict - don't match just because they share "carcinoma"
          // Only allow substring matching if:
          // 1. One is a complete substring of the other (e.g., "ovarian" in "ovarian cancer")
          // 2. OR they're both single words that are synonyms
          // 3. OR one contains the other as a complete phrase (not just a word)
          if (norm1IsGeneric || norm2IsGeneric) {
            // If either is generic, allow substring matching
            if (norm1.includes(norm2) || norm2.includes(norm1)) return true;
          } else {
            // Both are specific - require more strict matching
            // Don't match if they only share generic words like "carcinoma", "cancer", etc.
            const genericWords = ['carcinoma', 'carcinomas', 'cancer', 'cancers', 'neoplasm', 'neoplasms', 'tumor', 'tumors', 'tumour', 'tumours'];
            const norm1Words = norm1.split(/\s+/);
            const norm2Words = norm2.split(/\s+/);
            
            // Check if they share non-generic words
            const norm1SpecificWords = norm1Words.filter(w => !genericWords.includes(w));
            const norm2SpecificWords = norm2Words.filter(w => !genericWords.includes(w));
            
            // If both have specific words, they must match on the meaningful parts
            if (norm1SpecificWords.length > 0 && norm2SpecificWords.length > 0) {
              // For carcinoma types, require that the specific descriptors match
              // "Clear Cell Carcinoma" should match "Clear Cell" but NOT "Non-Small-Cell Lung"
              // Join the specific words to compare the meaningful parts
              const norm1Specific = norm1SpecificWords.join(' ').toLowerCase();
              const norm2Specific = norm2SpecificWords.join(' ').toLowerCase();
              
              // They must share the same specific descriptor (e.g., "clear cell", "ovarian")
              // Not just any word (e.g., "cell" in both "clear cell" and "non-small-cell")
              if (norm1Specific === norm2Specific || 
                  norm1Specific.includes(norm2Specific) || 
                  norm2Specific.includes(norm1Specific)) {
                // They share the same specific descriptor, allow the match
                if (norm1.includes(norm2) || norm2.includes(norm1)) return true;
              } else {
                // Check if they're synonyms in the MEDICAL_TERM_SYNONYMS map
                // This handles cases like "ovarian cancer" vs "ovarian neoplasm"
                const isSynonymPair = Object.entries(MEDICAL_TERM_SYNONYMS).some(([key, synonyms]) => {
                  const keyLower = key.toLowerCase();
                  const synonymsLower = synonyms.map(s => s.toLowerCase());
                  return (norm1 === keyLower && synonymsLower.includes(norm2)) ||
                         (norm2 === keyLower && synonymsLower.includes(norm1));
                });
                if (isSynonymPair) {
                  return true;
                }
              }
            } else {
              // No specific words in one or both - only match if exact or one is contained as complete phrase
              if (norm1 === norm2 || norm1.includes(norm2) || norm2.includes(norm1)) {
                // But check if it's just matching on generic words
                const onlyGenericMatch = norm1Words.every(w => genericWords.includes(w)) || 
                                        norm2Words.every(w => genericWords.includes(w));
                if (!onlyGenericMatch) {
                  return true;
                }
              }
            }
          }
        }
      }
    }
  }
  
  // Word-by-word matching for multi-word terms like "Ovarian Neoplasms" vs "Ovarian Cancer"
  // BUT: Skip if one is generic and the other is specific
  if (!((term1IsGeneric && !term2IsGeneric) || (!term1IsGeneric && term2IsGeneric))) {
    const filteredWords1 = term1Lower.split(/\s+/).filter(w => w.length >= 3); // Filter out short words
    const filteredWords2 = term2Lower.split(/\s+/).filter(w => w.length >= 3);
    
    // If both terms have the same number of words, check if they match word-by-word
    if (filteredWords1.length === filteredWords2.length && filteredWords1.length > 1) {
      let matchingWords = 0;
      for (let i = 0; i < filteredWords1.length; i++) {
        const word1 = filteredWords1[i];
        const word2 = filteredWords2[i];
        
        // Direct word match
        if (word1 === word2) {
          matchingWords++;
          continue;
        }
        
        // Check if words match via synonyms, but prevent generic words from matching specific words
        const w1IsGeneric = isGenericTerm(word1);
        const w2IsGeneric = isGenericTerm(word2);
        if (w1IsGeneric && !w2IsGeneric) continue;
        if (!w1IsGeneric && w2IsGeneric) continue;
        
        const word1Normalized = normalizeMedicalTerm(word1);
        const word2Normalized = normalizeMedicalTerm(word2);
        const wordsMatch = word1Normalized.some(n1 => {
          const n1IsGeneric = isGenericTerm(n1);
          return word2Normalized.some(n2 => {
            const n2IsGeneric = isGenericTerm(n2);
            if (n1IsGeneric && !n2IsGeneric) return false;
            if (!n1IsGeneric && n2IsGeneric) return false;
            return n1 === n2 || n1.includes(n2) || n2.includes(n1);
          });
        });
        
        if (wordsMatch) {
          matchingWords++;
        }
      }
      
      // If all words match (or all but one), consider it a match
      if (matchingWords >= filteredWords1.length - 1) {
        return true;
      }
    }
  }
  
  // Check if all significant words from term1 are in term2 (or their synonyms)
  // BUT: Skip if one is generic and the other is specific
  if (!((term1IsGeneric && !term2IsGeneric) || (!term1IsGeneric && term2IsGeneric))) {
    const filteredWords1 = term1Lower.split(/\s+/).filter(w => w.length >= 3);
    const filteredWords2 = term2Lower.split(/\s+/).filter(w => w.length >= 3);
    const normalized1 = normalizeMedicalTerm(term1);
    const normalized2 = normalizeMedicalTerm(term2);
    
    const normalized2Flat = normalized2.join(' ');
    const allWords1Match = filteredWords1.every(word => {
      const wordNormalized = normalizeMedicalTerm(word);
      const wordIsGeneric = isGenericTerm(word);
      return wordNormalized.some(norm => {
        const normIsGeneric = isGenericTerm(norm);
        if (wordIsGeneric && !normIsGeneric) return false;
        if (!wordIsGeneric && normIsGeneric) return false;
        return normalized2Flat.includes(norm);
      });
    });
    
    if (allWords1Match && filteredWords1.length > 0) return true;
    
    // Check reverse
    const normalized1Flat = normalized1.join(' ');
    const allWords2Match = filteredWords2.every(word => {
      const wordNormalized = normalizeMedicalTerm(word);
      const wordIsGeneric = isGenericTerm(word);
      return wordNormalized.some(norm => {
        const normIsGeneric = isGenericTerm(norm);
        if (wordIsGeneric && !normIsGeneric) return false;
        if (!wordIsGeneric && normIsGeneric) return false;
        return normalized1Flat.includes(norm);
      });
    });
    
    if (allWords2Match && filteredWords2.length > 0) return true;
  }
  
  return false;
}

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

  // 1. Diagnosis Match (30 points) - Using medical term synonyms
  maxPossibleScore += weights.diagnosis;
  if (trial.conditions && patientProfile.diagnosis) {
    const diagnosisLower = patientProfile.diagnosis.toLowerCase().trim();
    
    // First check for exact match (case-insensitive) - gives full points
    const exactMatch = trial.conditions.find(condition => {
      const conditionLower = condition.toLowerCase().trim();
      return conditionLower === diagnosisLower;
    });
    
    let diagnosisMatch = false;
    let isExactMatch = false;
    
    if (exactMatch) {
      diagnosisMatch = true;
      isExactMatch = true;
    } else {
      // Check if any trial condition matches patient diagnosis (using synonyms)
      // But don't match generic terms - they should get reduced scoring
      diagnosisMatch = trial.conditions.some(condition => {
        // Allow generic terms to match, but we'll give them reduced points later
        return medicalTermsMatch(condition, patientProfile.diagnosis);
      });
    }
    
    // If no direct match, check if trial has the cancer type in one condition and subtype in another
    // This handles cases like: Trial has "Ovarian Neoplasms" + "Clear Cell Carcinoma", Patient has "Ovarian Cancer" with "Clear Cell" subtype
    const subtype = patientProfile.currentStatus?.diagnosis !== patientProfile.diagnosis 
      ? patientProfile.currentStatus?.diagnosis 
      : (patientProfile.cancerType || null);
    
    if (!diagnosisMatch && subtype) {
      // Check if one condition matches the main diagnosis and another matches the subtype
      const hasMainDiagnosis = trial.conditions.some(condition =>
        medicalTermsMatch(condition, patientProfile.diagnosis)
      );
      const hasSubtype = trial.conditions.some(condition =>
        medicalTermsMatch(condition, subtype)
      );
      
      // If trial has both the main cancer type and the subtype, consider it a match
      if (hasMainDiagnosis && hasSubtype) {
        diagnosisMatch = true;
      }
    }
    
    // Additional check: If trial has a condition that contains the cancer type word (e.g., "Ovarian" in "Ovarian Neoplasms")
    // and the rest is a synonym of "Cancer", consider it a match
    if (!diagnosisMatch) {
      const diagnosisWords = patientProfile.diagnosis.toLowerCase().split(/\s+/);
      const cancerTypeWord = diagnosisWords.find(w => 
        ['ovarian', 'breast', 'lung', 'colorectal', 'endometrial', 'cervical'].includes(w)
      );
      
      if (cancerTypeWord) {
        // Check if any trial condition contains the cancer type word
        const hasCancerType = trial.conditions.some(condition => {
          const conditionLower = condition.toLowerCase();
          if (conditionLower.includes(cancerTypeWord)) {
            // Check if the rest of the condition is a synonym of "cancer"
            // But prevent generic terms from matching
            const restOfCondition = conditionLower.replace(cancerTypeWord, '').trim();
            const restOfDiagnosis = patientProfile.diagnosis.toLowerCase().replace(cancerTypeWord, '').trim();
            // Don't match if restOfCondition is generic (like "tumors" in "Solid Tumors")
            if (isGenericTerm(restOfCondition)) {
              return false;
            }
            return medicalTermsMatch(restOfCondition, restOfDiagnosis) || 
                   medicalTermsMatch(restOfCondition, 'cancer') ||
                   medicalTermsMatch(restOfDiagnosis, restOfCondition);
          }
          return false;
        });
        
        if (hasCancerType) {
          diagnosisMatch = true;
        }
      }
    }

    if (diagnosisMatch) {
      // Check if the match is with a generic term - give lower score
      const matchedCondition = isExactMatch ? exactMatch : 
        (trial.conditions.find(condition =>
          medicalTermsMatch(condition, patientProfile.diagnosis)
        ) || null);
      
      const isGenericMatch = matchedCondition && isGenericTerm(matchedCondition);
      
      if (isExactMatch && !isGenericMatch) {
        // Exact match with specific term - full points
        totalScore += weights.diagnosis;
        matchDetails.push({
          category: 'Diagnosis',
          score: weights.diagnosis,
          detail: `Exact match for diagnosis: ${exactMatch}`
        });
      } else if (isGenericMatch) {
        // Generic term match - give reduced score (40% of diagnosis weight)
        // Also reduce maxPossibleScore proportionally so percentage is accurate
        const genericScore = Math.round(weights.diagnosis * 0.4);
        totalScore += genericScore;
        // Reduce max score by the difference to keep percentage accurate
        maxPossibleScore -= (weights.diagnosis - genericScore);
        matchDetails.push({
          category: 'Diagnosis',
          score: genericScore,
          detail: `Matches generic trial condition: ${matchedCondition} (reduced score - trial is for all solid tumors, not specific to ${patientProfile.diagnosis})`
        });
      } else {
        // Synonym match with specific term - full points
        totalScore += weights.diagnosis;
        matchDetails.push({
          category: 'Diagnosis',
          score: weights.diagnosis,
          detail: matchedCondition 
            ? `Matches trial condition: ${matchedCondition} (synonym of ${patientProfile.diagnosis})`
            : `Matches trial conditions (cancer type and subtype found)`
        });
      }
    } else {
      issues.push({
        category: 'Diagnosis',
        severity: 'high',
        detail: `Trial conditions (${trial.conditions.join(', ')}) may not match patient diagnosis (${patientProfile.diagnosis})`
      });
    }
  }

  // 1a. Cancer Subtype Match (additional points if subtype matches) - Using medical term synonyms
  // Check both currentStatus.diagnosis and cancerType for subtype
  const subtype = patientProfile.currentStatus?.diagnosis !== patientProfile.diagnosis 
    ? patientProfile.currentStatus?.diagnosis 
    : (patientProfile.cancerType || null);
  
  if (trial.conditions && subtype) {
    const subtypeLower = subtype.toLowerCase().trim();
    
    // First check for exact match (case-insensitive) - gives higher score
    const exactMatch = trial.conditions.find(condition => {
      const conditionLower = condition.toLowerCase().trim();
      return conditionLower === subtypeLower;
    });
    
    if (exactMatch) {
      // Exact match gets higher score (15 points)
      const subtypeScore = 15;
      totalScore += subtypeScore;
      maxPossibleScore += subtypeScore;
      matchDetails.push({
        category: 'Subtype',
        score: subtypeScore,
        detail: `Exact match for cancer subtype: ${exactMatch}`
      });
    } else {
      // Check for synonym match - but exclude generic terms
      const subtypeMatch = trial.conditions.some(condition => {
        // Don't match generic terms with specific subtypes
        if (isGenericTerm(condition)) {
          return false;
        }
        return medicalTermsMatch(condition, subtype);
      });

      if (subtypeMatch) {
        const subtypeScore = 10;
        totalScore += subtypeScore;
        maxPossibleScore += subtypeScore;
        // Find which condition matched
        const matchedCondition = trial.conditions.find(condition => {
          if (isGenericTerm(condition)) return false;
          return medicalTermsMatch(condition, subtype);
        });
        matchDetails.push({
          category: 'Subtype',
          score: subtypeScore,
          detail: `Matches cancer subtype: ${matchedCondition} (synonym of ${subtype})`
        });
      }
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

  // 3. Gender Match (15 points) - Only count if trial specifies gender requirements
  if (trial.eligibility?.gender && patientProfile.gender) {
    maxPossibleScore += weights.gender;
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

  // 4. Genomic Match (25 points) - Only count if genomic profile exists or trial has genomic requirements
  // Check if trial has genomic requirements first
  const hasGenomicRequirements = (trial.genomicCriteria && trial.genomicCriteria.length > 0) || 
                                  (trial.eligibilityCriteria && genomicProfile);
  
  if (genomicProfile || hasGenomicRequirements) {
    maxPossibleScore += weights.genomic;
  }
  
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
        // Changed from high to medium severity - don't filter out trials, just note the mismatch
        issues.push({
          category: 'Genomic',
          severity: 'medium',
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
        // Negative matches found - don't give points, but keep as high severity (exclusions are important)
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
        // No mutations to check, give full points (we're already counting genomic in maxPossibleScore)
        totalScore += weights.genomic;
        matchDetails.push({
          category: 'Genomic',
          score: weights.genomic,
          detail: 'No specific genomic requirements'
        });
      }
    } else {
      // No genomic criteria required, give full points (we're already counting genomic in maxPossibleScore)
      totalScore += weights.genomic;
      matchDetails.push({
        category: 'Genomic',
        score: weights.genomic,
        detail: 'No specific genomic requirements'
      });
    }
  } else if (hasGenomicRequirements && !genomicProfile) {
    // Trial has genomic requirements but patient has no genomic profile
    // Don't give points, but don't penalize either (already counted in maxPossibleScore)
    issues.push({
      category: 'Genomic',
      severity: 'medium',
      detail: 'Trial has genomic requirements but patient genomic profile not available'
    });
  }

  // 4b. Bonus Genomic Match - Award bonus points for matching mutations/CNVs even if trial doesn't require them
  // This increases match percentage when patient's genomic profile aligns with trial focus
  if (genomicProfile && trial.eligibilityCriteria) {
    const bonusMatches = findBonusGenomicMatches(trial, genomicProfile);
    
    if (bonusMatches.mutationMatches > 0 || bonusMatches.cnvMatches > 0) {
      // Award bonus points: 2 points per mutation match, 3 points per CNV match (amplifications are more significant)
      const bonusScore = (bonusMatches.mutationMatches * 2) + (bonusMatches.cnvMatches * 3);
      totalScore += bonusScore;
      maxPossibleScore += bonusScore; // Increase max score so percentage calculation includes bonus
      
      const bonusDetails = [];
      if (bonusMatches.mutationMatches > 0) {
        bonusDetails.push(`${bonusMatches.mutationMatches} mutation${bonusMatches.mutationMatches > 1 ? 's' : ''} (${bonusMatches.matchedMutations.join(', ')})`);
      }
      if (bonusMatches.cnvMatches > 0) {
        bonusDetails.push(`${bonusMatches.cnvMatches} amplification${bonusMatches.cnvMatches > 1 ? 's' : ''} (${bonusMatches.matchedCnvs.join(', ')})`);
      }
      
      matchDetails.push({
        category: 'Genomic Bonus',
        score: bonusScore,
        detail: `Patient genomic profile matches trial focus: ${bonusDetails.join(', ')}`
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

  // 6. Post-scoring: Disease Status Keyword Matching (bonus points)
  // Search trial text for keywords related to patient's disease status and treatment line
  const diseaseStatusBonus = findDiseaseStatusMatches(trial, patientProfile);
  if (diseaseStatusBonus.score > 0) {
    totalScore += diseaseStatusBonus.score;
    maxPossibleScore += diseaseStatusBonus.score; // Increase max score for percentage calculation
    matchDetails.push({
      category: 'Disease Status',
      score: diseaseStatusBonus.score,
      detail: diseaseStatusBonus.detail
    });
  }

  // 7. Trial Specificity Penalty/Bonus
  // Penalize trials that are too broad (many different cancer types)
  // Reward trials that are specific (few related conditions)
  if (trial.conditions && trial.conditions.length > 0) {
    const numConditions = trial.conditions.length;
    
    // Check if trial is very broad (10+ different cancer types)
    if (numConditions >= 10) {
      // Penalize broad trials - they're less specific to the patient's condition
      // Only reduce totalScore, not maxPossibleScore, so percentage actually decreases
      const broadnessPenalty = Math.min(15, Math.floor((numConditions - 9) * 2)); // Max 15 point penalty
      totalScore -= broadnessPenalty;
      // Don't reduce maxPossibleScore - this makes the percentage go down
      matchDetails.push({
        category: 'Specificity',
        score: -broadnessPenalty,
        detail: `Trial includes ${numConditions} different cancer types (broad trial, less specific to patient's condition)`
      });
    } else if (numConditions <= 6) {
      // Reward specific trials (6 or fewer conditions, likely all related)
      // Check if conditions are related (e.g., all gynecological, all lung cancers, etc.)
      const isRelated = checkIfConditionsAreRelated(trial.conditions, patientProfile.diagnosis);
      if (isRelated) {
        const specificityBonus = 5;
        totalScore += specificityBonus;
        maxPossibleScore += specificityBonus;
        matchDetails.push({
          category: 'Specificity',
          score: specificityBonus,
          detail: `Trial is highly specific with ${numConditions} related conditions (better match for patient)`
        });
      }
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
 * Disease status keyword synonyms for matching
 */
const DISEASE_STATUS_KEYWORDS = {
  'recurrent disease': ['recurrent', 'recurrence', 'recurred', 'relapsed', 'relapse', 'recurring', 'recur'],
  'progressive disease': ['progressive', 'progression', 'progressing', 'advancing', 'advanced disease', 'worsening'],
  'stable disease': ['stable', 'stable disease', 'sd', 'unchanged'],
  'in remission': ['remission', 'remitted', 'no evidence of disease', 'ned', 'complete response', 'cr', 'partial response', 'pr'],
  'newly diagnosed': ['newly diagnosed', 'new diagnosis', 'newly', 'initial diagnosis', 'first diagnosis', 'de novo'],
  'first-line': ['first-line', 'first line', '1l', '1st line', 'initial treatment', 'frontline', 'front-line'],
  'second-line': ['second-line', 'second line', '2l', '2nd line', 'second-line treatment'],
  'third-line': ['third-line', 'third line', '3l', '3rd line', 'third-line treatment'],
  'fourth-line or later': ['fourth-line', 'fourth line', '4l', '4th line', 'fourth-line or later', 'later line', 'multiple lines', 'heavily pretreated'],
  'maintenance': ['maintenance', 'maintenance therapy', 'maintenance treatment'],
  'adjuvant': ['adjuvant', 'adjuvant therapy', 'adjuvant treatment'],
  'neoadjuvant': ['neoadjuvant', 'neoadjuvant therapy', 'neoadjuvant treatment'],
  'palliative': ['palliative', 'palliative care', 'palliative treatment']
};

/**
 * Check if trial conditions are related to each other and to patient's diagnosis
 * @param {Array<string>} conditions - Trial conditions
 * @param {string} patientDiagnosis - Patient's diagnosis
 * @returns {boolean} - True if conditions are related
 */
function checkIfConditionsAreRelated(conditions, patientDiagnosis) {
  if (!conditions || conditions.length === 0) return false;
  
  // Define cancer type groups
  const cancerGroups = {
    gynecological: ['ovarian', 'endometrial', 'cervical', 'uterine', 'vulvar', 'vagina', 'vaginal', 'gynecological', 'gyn'],
    lung: ['lung', 'pulmonary', 'non-small-cell', 'nsclc', 'small cell', 'sclc'],
    breast: ['breast', 'mammary'],
    gastrointestinal: ['colorectal', 'colon', 'rectal', 'gastric', 'stomach', 'esophageal', 'esophagogastric', 'pancreatic', 'biliary', 'liver', 'hepatic'],
    headneck: ['head and neck', 'nasopharyngeal', 'oropharyngeal', 'squamous cell carcinoma of head and neck', 'hnscc'],
    urological: ['renal', 'kidney', 'prostate', 'bladder', 'urothelial'],
    skin: ['melanoma', 'cutaneous', 'skin'],
    hematological: ['lymphoma', 'leukemia', 'myeloma', 'blood cancer']
  };
  
  // Find which group the patient's diagnosis belongs to
  const patientDiagnosisLower = patientDiagnosis.toLowerCase();
  let patientGroup = null;
  for (const [groupName, keywords] of Object.entries(cancerGroups)) {
    if (keywords.some(keyword => patientDiagnosisLower.includes(keyword))) {
      patientGroup = groupName;
      break;
    }
  }
  
  // If we can't determine patient's group, check if all conditions share a common theme
  if (!patientGroup) {
    // Check if all conditions share a common word (e.g., all have "carcinoma")
    const commonWords = {};
    conditions.forEach(condition => {
      const words = condition.toLowerCase().split(/\s+/);
      words.forEach(word => {
        if (word.length >= 4) { // Only count meaningful words
          commonWords[word] = (commonWords[word] || 0) + 1;
        }
      });
    });
    
    // If there's a word that appears in at least 50% of conditions, they're related
    const threshold = Math.ceil(conditions.length * 0.5);
    const hasCommonWord = Object.values(commonWords).some(count => count >= threshold);
    return hasCommonWord;
  }
  
  // Check if most conditions belong to the same group as patient's diagnosis
  const matchingConditions = conditions.filter(condition => {
    const conditionLower = condition.toLowerCase();
    return cancerGroups[patientGroup].some(keyword => conditionLower.includes(keyword));
  });
  
  // If at least 50% of conditions match the patient's group, they're related
  return matchingConditions.length >= Math.ceil(conditions.length * 0.5);
}

/**
 * Find disease status keyword matches in trial text
 * Searches eligibilityCriteria, summary, and title for keywords related to patient's disease status
 * @param {Object} trial - Trial data
 * @param {Object} patientProfile - Patient profile with currentStatus
 * @returns {Object} - Bonus score and detail
 */
function findDiseaseStatusMatches(trial, patientProfile) {
  const currentStatus = patientProfile.currentStatus || {};
  const diseaseStatus = currentStatus.diseaseStatus || '';
  const treatmentLine = currentStatus.treatmentLine || '';
  
  if (!diseaseStatus && !treatmentLine) {
    return { score: 0, detail: '' };
  }
  
  // Combine all trial text to search
  const searchText = [
    trial.eligibilityCriteria || '',
    trial.summary || '',
    trial.title || ''
  ].join(' ').toLowerCase();
  
  if (!searchText || searchText.trim().length === 0) {
    return { score: 0, detail: '' };
  }
  
  let bonusScore = 0;
  const matchedKeywords = [];
  
  // Check disease status keywords
  if (diseaseStatus && diseaseStatus !== 'Unknown') {
    const statusLower = diseaseStatus.toLowerCase();
    const keywords = DISEASE_STATUS_KEYWORDS[statusLower] || [statusLower];
    
    // Check if any keyword is found in trial text
    const foundKeywords = keywords.filter(keyword => {
      // Use word boundary matching for better accuracy
      const pattern = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      return pattern.test(searchText);
    });
    
    if (foundKeywords.length > 0) {
      bonusScore += 5; // 5 bonus points for disease status match
      matchedKeywords.push(`Disease status: ${diseaseStatus} (found: ${foundKeywords[0]})`);
    }
  }
  
  // Check treatment line keywords
  if (treatmentLine && treatmentLine !== 'Other (specify)') {
    const treatmentLower = treatmentLine.toLowerCase();
    const keywords = DISEASE_STATUS_KEYWORDS[treatmentLower] || [treatmentLower];
    
    // Check if any keyword is found in trial text
    const foundKeywords = keywords.filter(keyword => {
      const pattern = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      return pattern.test(searchText);
    });
    
    if (foundKeywords.length > 0) {
      bonusScore += 5; // 5 bonus points for treatment line match
      matchedKeywords.push(`Treatment line: ${treatmentLine} (found: ${foundKeywords[0]})`);
    }
  }
  
  // Additional bonus for multiple matches
  if (matchedKeywords.length >= 2) {
    bonusScore += 2; // Extra 2 points for multiple matches
  }
  
  return {
    score: bonusScore,
    detail: matchedKeywords.length > 0 
      ? `Trial mentions patient's disease status/treatment: ${matchedKeywords.join('; ')}`
      : ''
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
 * Find bonus genomic matches - mutations/CNVs mentioned in eligibility text (even if not required)
 * This gives bonus points when patient's genomic profile aligns with trial focus
 * @param {Object} trial - Trial data with eligibilityCriteria.text
 * @param {Object} genomicProfile - Patient's genomic profile (mutations, cnvs)
 * @returns {Object} - Bonus match counts and matched genes
 */
function findBonusGenomicMatches(trial, genomicProfile) {
  const eligibilityText = trial.eligibilityCriteria || '';
  
  if (!eligibilityText || typeof eligibilityText !== 'string') {
    return {
      mutationMatches: 0,
      cnvMatches: 0,
      matchedMutations: [],
      matchedCnvs: []
    };
  }
  
  const textLower = eligibilityText.toLowerCase();
  
  // Split text into inclusion and exclusion sections
  const exclusionSection = textLower.includes('exclusion criteria') 
    ? textLower.split('exclusion criteria')[1] || ''
    : '';
  const inclusionSection = textLower.includes('inclusion criteria')
    ? textLower.split('inclusion criteria')[1]?.split('exclusion criteria')[0] || textLower
    : textLower;
  
  const matchedMutations = [];
  const matchedCnvs = [];
  
  // Check mutations for positive mentions (not in exclusion)
  if (genomicProfile.mutations && Array.isArray(genomicProfile.mutations)) {
    genomicProfile.mutations.forEach(mutation => {
      if (mutation.gene) {
        const geneName = mutation.gene.toUpperCase();
        const genePattern = new RegExp(`\\b${geneName}\\b|\\b${mutation.gene}\\b`, 'i');
        
        // Check if gene is mentioned in inclusion section or general text (not in exclusion)
        // Only count if it's a positive mention (not preceded by "negative" or "exclude")
        const isInExclusion = exclusionSection && genePattern.test(exclusionSection);
        const isNegativeContext = /\b(?:negative|exclude|exclusion)\s+(?:for\s+)?(?:the\s+)?(?:presence\s+of\s+)?(?:a\s+)?(?:mutation\s+in\s+)?(?:mutation\s+of\s+)?[^.]*?/i.test(textLower);
        
        if (!isInExclusion && !isNegativeContext) {
          // Check if gene is mentioned in inclusion section or general eligibility text
          if (genePattern.test(inclusionSection) || (genePattern.test(textLower) && !exclusionSection)) {
            matchedMutations.push(mutation.gene);
          }
        }
      }
    });
  }
  
  // Check CNVs/amplifications for positive mentions (not in exclusion)
  if (genomicProfile.cnvs && Array.isArray(genomicProfile.cnvs)) {
    genomicProfile.cnvs.forEach(cnv => {
      if (cnv.gene) {
        const geneName = cnv.gene.toUpperCase();
        const genePattern = new RegExp(`\\b${geneName}\\b|\\b${cnv.gene}\\b`, 'i');
        
        // Also check for amplification-specific terms
        const amplificationTerms = ['amplification', 'amplified', 'copy number gain', 'cnv', 'copy number variant'];
        const hasAmplificationTerm = amplificationTerms.some(term => 
          textLower.includes(term) && genePattern.test(textLower)
        );
        
        // Check if CNV is mentioned in inclusion section or general text (not in exclusion)
        const isInExclusion = exclusionSection && genePattern.test(exclusionSection);
        const isNegativeContext = /\b(?:negative|exclude|exclusion)\s+(?:for\s+)?(?:the\s+)?(?:presence\s+of\s+)?(?:a\s+)?(?:amplification\s+of\s+)?(?:deletion\s+of\s+)?/i.test(textLower);
        
        if (!isInExclusion && !isNegativeContext) {
          // Check if gene/amplification is mentioned in inclusion section or general eligibility text
          if (hasAmplificationTerm || genePattern.test(inclusionSection) || (genePattern.test(textLower) && !exclusionSection)) {
            matchedCnvs.push(cnv.gene);
          }
        }
      }
    });
  }
  
  return {
    mutationMatches: matchedMutations.length,
    cnvMatches: matchedCnvs.length,
    matchedMutations: [...new Set(matchedMutations)], // Remove duplicates
    matchedCnvs: [...new Set(matchedCnvs)] // Remove duplicates
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
    return `Highly recommended. Patient meets all major eligibility criteria with ${matchDetails.length} strong matches. Consider discussing with oncologist.`;
  } else if (eligibilityLevel === 'potentially_eligible') {
    if (highIssues.length === 0) {
      return `Potentially eligible. Patient meets most criteria but has minor considerations. Review eligibility details with medical team.`;
    } else {
      return `Potentially eligible with considerations. ${highIssues[0].detail}. Consult with oncologist to determine if exceptions apply.`;
    }
  } else {
    // For unlikely_eligible, explicitly list all high severity issues
    if (highIssues.length > 0) {
      const issueList = highIssues.map((issue, idx) => {
        return `${idx + 1}. ${issue.detail}`;
      }).join(' ');
      return `Unlikely eligible. The following high-severity issues disqualify this trial: ${issueList}. Consider exploring other trial options.`;
    } else {
      return `Not recommended. Patient does not meet sufficient eligibility criteria for this trial.`;
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
