# JRCT (Japan Registry of Clinical Trials) Integration

## Overview

Integration with JRCT (jRCT) - Japan's primary clinical trial registry - to enable Japanese clinical trial searching and matching for patients.

---

## JRCT Information

**Official Website:** https://jrct.niph.go.jp/

**Registry Details:**
- **Name:** Japan Registry of Clinical Trials (jRCT)
- **Organization:** Japan Agency for Medical Research and Development (AMED)
- **Coverage:** All clinical trials conducted in Japan
- **Languages:** Japanese and English
- **Unique Feature:** Includes trials specific to Japanese populations and Asian-focused research

---

## API Access

### JRCT API Endpoint

**Base URL:** `https://jrct.niph.go.jp/api/2.0/`

**API Documentation:** https://jrct.niph.go.jp/api

**Search Endpoint:**
```
GET https://jrct.niph.go.jp/api/2.0/trials
```

**Parameters:**
- `condition` - Disease/condition (e.g., "ovarian cancer")
- `intervention` - Treatment/drug name
- `status` - Trial status (recruiting, active, completed)
- `phase` - Clinical trial phase (Phase I, II, III, IV)
- `age` - Age criteria
- `gender` - Gender criteria
- `location` - Prefecture/city in Japan
- `format` - Response format (json, xml)

---

## Trial Data Structure

### JRCT Trial Record Format

```json
{
  "jrctId": "jRCT2031220123",
  "title": {
    "ja": "卵巣癌に対するPARP阻害剤の第III相試験",
    "en": "Phase III Study of PARP Inhibitor for Ovarian Cancer"
  },
  "condition": {
    "ja": "卵巣癌",
    "en": "Ovarian Cancer"
  },
  "status": "recruiting",
  "phase": "Phase III",
  "sponsor": {
    "name": "Japanese Foundation for Cancer Research",
    "type": "academic"
  },
  "principalInvestigator": {
    "name": "Dr. Tanaka Yuki",
    "affiliation": "Tokyo Medical University Hospital"
  },
  "locations": [
    {
      "facility": "Tokyo Medical University Hospital",
      "city": "Tokyo",
      "prefecture": "Tokyo",
      "country": "Japan"
    },
    {
      "facility": "Osaka University Hospital",
      "city": "Osaka",
      "prefecture": "Osaka",
      "country": "Japan"
    }
  ],
  "eligibilityCriteria": {
    "age": {
      "min": 20,
      "max": 75
    },
    "gender": "female",
    "conditions": [
      "Diagnosed with ovarian cancer",
      "BRCA1 or BRCA2 mutation positive",
      "Platinum-sensitive disease"
    ],
    "exclusions": [
      "Previous PARP inhibitor treatment",
      "Severe hepatic dysfunction"
    ]
  },
  "interventions": [
    {
      "type": "drug",
      "name": "Olaparib",
      "description": "PARP inhibitor 300mg twice daily"
    }
  ],
  "primaryOutcome": "Progression-free survival",
  "enrollmentTarget": 200,
  "enrollmentCurrent": 85,
  "startDate": "2024-01-15",
  "completionDate": "2026-12-31",
  "contacts": [
    {
      "name": "Clinical Trial Coordinator",
      "email": "trial-contact@tokyo-med.ac.jp",
      "phone": "+81-3-1234-5678"
    }
  ],
  "urls": {
    "jrct": "https://jrct.niph.go.jp/latest-detail/jRCT2031220123",
    "studyWebsite": "https://www.tokyo-med.ac.jp/trials/ovarian-parp"
  }
}
```

---

## Integration Architecture

### Service Layer Structure

```
src/services/
├── clinicalTrials/
│   ├── jrctService.js          # JRCT API integration
│   ├── clinicalTrialsService.js # Main trials service (aggregates all sources)
│   ├── trialMatcher.js          # Patient-trial matching logic
│   └── trialUtils.js            # Utility functions
```

---

## Implementation

### 1. JRCT Service

Create `src/services/clinicalTrials/jrctService.js`:

```javascript
import axios from 'axios';

const JRCT_API_BASE = 'https://jrct.niph.go.jp/api/2.0';

/**
 * Search JRCT for clinical trials
 */
export async function searchJRCT(params) {
  const {
    condition,
    intervention,
    phase,
    status = 'recruiting',
    location,
    age,
    gender,
    biomarkers
  } = params;

  try {
    const searchParams = new URLSearchParams();

    if (condition) searchParams.append('condition', condition);
    if (intervention) searchParams.append('intervention', intervention);
    if (phase) searchParams.append('phase', phase);
    if (status) searchParams.append('status', status);
    if (location) searchParams.append('location', location);
    if (age) searchParams.append('age', age);
    if (gender) searchParams.append('gender', gender);

    searchParams.append('format', 'json');
    searchParams.append('lang', 'en'); // Request English translations

    const response = await axios.get(`${JRCT_API_BASE}/trials?${searchParams}`);

    return {
      source: 'JRCT',
      totalResults: response.data.totalCount,
      trials: response.data.trials.map(trial => normalizeJRCTTrial(trial))
    };
  } catch (error) {
    console.error('JRCT API error:', error);
    throw new Error('Failed to search JRCT database');
  }
}

/**
 * Get specific trial details from JRCT
 */
export async function getJRCTTrial(jrctId) {
  try {
    const response = await axios.get(`${JRCT_API_BASE}/trials/${jrctId}`, {
      params: { format: 'json', lang: 'en' }
    });

    return normalizeJRCTTrial(response.data);
  } catch (error) {
    console.error('JRCT trial fetch error:', error);
    throw new Error(`Failed to fetch trial ${jrctId}`);
  }
}

/**
 * Normalize JRCT trial format to standard format
 */
function normalizeJRCTTrial(jrctTrial) {
  return {
    // Standard fields
    id: jrctTrial.jrctId,
    source: 'JRCT',
    title: jrctTrial.title.en || jrctTrial.title.ja,
    titleJapanese: jrctTrial.title.ja,
    condition: jrctTrial.condition.en || jrctTrial.condition.ja,
    conditionJapanese: jrctTrial.condition.ja,
    status: jrctTrial.status,
    phase: jrctTrial.phase,

    // Sponsor info
    sponsor: jrctTrial.sponsor.name,
    sponsorType: jrctTrial.sponsor.type,

    // Location info
    locations: jrctTrial.locations.map(loc => ({
      facility: loc.facility,
      city: loc.city,
      prefecture: loc.prefecture,
      country: 'Japan'
    })),

    // Eligibility
    eligibility: {
      ageMin: jrctTrial.eligibilityCriteria?.age?.min,
      ageMax: jrctTrial.eligibilityCriteria?.age?.max,
      gender: jrctTrial.eligibilityCriteria?.gender,
      criteria: jrctTrial.eligibilityCriteria?.conditions || [],
      exclusions: jrctTrial.eligibilityCriteria?.exclusions || []
    },

    // Interventions
    interventions: jrctTrial.interventions.map(int => ({
      type: int.type,
      name: int.name,
      description: int.description
    })),

    // Study info
    primaryOutcome: jrctTrial.primaryOutcome,
    enrollmentTarget: jrctTrial.enrollmentTarget,
    enrollmentCurrent: jrctTrial.enrollmentCurrent,
    startDate: jrctTrial.startDate,
    completionDate: jrctTrial.completionDate,

    // Contact info
    contacts: jrctTrial.contacts,

    // URLs
    url: jrctTrial.urls.jrct,
    studyWebsite: jrctTrial.urls.studyWebsite,

    // JRCT-specific
    jrctId: jrctTrial.jrctId,
    principalInvestigator: jrctTrial.principalInvestigator
  };
}

/**
 * Search JRCT by genomic profile
 */
export async function searchJRCTByGenomicProfile(genomicProfile, patientInfo) {
  const searchPromises = [];

  // Search by mutations
  if (genomicProfile.mutations && genomicProfile.mutations.length > 0) {
    genomicProfile.mutations.forEach(mutation => {
      searchPromises.push(
        searchJRCT({
          condition: patientInfo.diagnosis,
          intervention: mutation.gene, // Search for gene-targeted trials
          status: 'recruiting',
          age: patientInfo.age,
          gender: patientInfo.gender
        })
      );
    });
  }

  // Search by biomarkers (TMB-high, MSI-H, HRD-positive)
  if (genomicProfile.biomarkers) {
    const biomarkers = genomicProfile.biomarkers;

    if (biomarkers.tumorMutationalBurden?.interpretation === 'high') {
      searchPromises.push(
        searchJRCT({
          condition: patientInfo.diagnosis,
          intervention: 'immunotherapy',
          status: 'recruiting'
        })
      );
    }

    if (biomarkers.microsatelliteInstability?.status === 'MSI-H') {
      searchPromises.push(
        searchJRCT({
          condition: patientInfo.diagnosis,
          intervention: 'pembrolizumab',
          status: 'recruiting'
        })
      );
    }

    if (biomarkers.hrdScore?.interpretation === 'HRD-positive') {
      searchPromises.push(
        searchJRCT({
          condition: patientInfo.diagnosis,
          intervention: 'PARP inhibitor',
          status: 'recruiting'
        })
      );
    }
  }

  // Execute all searches
  const results = await Promise.all(searchPromises);

  // Deduplicate trials
  const uniqueTrials = new Map();
  results.forEach(result => {
    result.trials.forEach(trial => {
      if (!uniqueTrials.has(trial.id)) {
        uniqueTrials.set(trial.id, trial);
      }
    });
  });

  return Array.from(uniqueTrials.values());
}

/**
 * Check if patient matches trial eligibility
 */
export function matchesJRCTEligibility(trial, patientProfile, genomicProfile) {
  const matches = {
    eligible: true,
    reasons: [],
    warnings: []
  };

  // Age check
  if (trial.eligibility.ageMin && patientProfile.age < trial.eligibility.ageMin) {
    matches.eligible = false;
    matches.reasons.push(`Age below minimum (${trial.eligibility.ageMin})`);
  }
  if (trial.eligibility.ageMax && patientProfile.age > trial.eligibility.ageMax) {
    matches.eligible = false;
    matches.reasons.push(`Age above maximum (${trial.eligibility.ageMax})`);
  }

  // Gender check
  if (trial.eligibility.gender && trial.eligibility.gender !== 'all') {
    if (trial.eligibility.gender !== patientProfile.gender) {
      matches.eligible = false;
      matches.reasons.push(`Gender mismatch (trial requires ${trial.eligibility.gender})`);
    }
  }

  // Diagnosis check
  if (trial.condition) {
    const conditionMatch =
      trial.condition.toLowerCase().includes(patientProfile.diagnosis.toLowerCase()) ||
      patientProfile.diagnosis.toLowerCase().includes(trial.condition.toLowerCase());

    if (!conditionMatch) {
      matches.eligible = false;
      matches.reasons.push('Diagnosis does not match trial condition');
    }
  }

  // Genomic biomarker checks
  if (trial.eligibility.biomarkers) {
    trial.eligibility.biomarkers.forEach(requiredBiomarker => {
      // Check for specific mutations
      if (requiredBiomarker.type === 'mutation') {
        const hasRequiredMutation = genomicProfile.mutations?.some(
          mut => mut.gene.toUpperCase() === requiredBiomarker.gene.toUpperCase()
        );

        if (!hasRequiredMutation) {
          matches.eligible = false;
          matches.reasons.push(`Missing required ${requiredBiomarker.gene} mutation`);
        }
      }

      // Check for TMB
      if (requiredBiomarker.type === 'TMB-high') {
        if (genomicProfile.biomarkers?.tumorMutationalBurden?.interpretation !== 'high') {
          matches.eligible = false;
          matches.reasons.push('TMB not high enough');
        }
      }

      // Check for MSI
      if (requiredBiomarker.type === 'MSI-H') {
        if (genomicProfile.biomarkers?.microsatelliteInstability?.status !== 'MSI-H') {
          matches.eligible = false;
          matches.reasons.push('Not MSI-high');
        }
      }

      // Check for HRD
      if (requiredBiomarker.type === 'HRD-positive') {
        if (genomicProfile.biomarkers?.hrdScore?.interpretation !== 'HRD-positive') {
          matches.eligible = false;
          matches.reasons.push('Not HRD-positive');
        }
      }
    });
  }

  return matches;
}

export default {
  searchJRCT,
  getJRCTTrial,
  searchJRCTByGenomicProfile,
  matchesJRCTEligibility
};
```

---

## Firestore Integration

### Store Matched Trials

```javascript
// src/firebase/services.js - Add clinical trials service

export const clinicalTrialsService = {
  // Save matched trial
  async saveMatchedTrial(userId, trialData) {
    const docRef = await addDoc(collection(db, COLLECTIONS.CLINICAL_TRIALS), {
      patientId: userId,
      source: trialData.source,
      trialId: trialData.id,
      jrctId: trialData.jrctId,
      title: trialData.title,
      titleJapanese: trialData.titleJapanese,
      condition: trialData.condition,
      phase: trialData.phase,
      status: trialData.status,
      locations: trialData.locations,
      eligibility: trialData.eligibility,
      interventions: trialData.interventions,
      url: trialData.url,
      matchScore: trialData.matchScore || 0,
      matchReasons: trialData.matchReasons || [],
      savedAt: serverTimestamp(),
      createdAt: serverTimestamp()
    });

    return docRef.id;
  },

  // Get saved trials for patient
  async getSavedTrials(userId) {
    const q = query(
      collection(db, COLLECTIONS.CLINICAL_TRIALS),
      where('patientId', '==', userId),
      orderBy('savedAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...convertTimestamps(doc.data())
    }));
  },

  // Search and match trials
  async searchAndMatchTrials(userId, patientProfile, genomicProfile) {
    // Search JRCT
    const jrctTrials = await searchJRCTByGenomicProfile(genomicProfile, patientProfile);

    // Match trials to patient
    const matchedTrials = jrctTrials.map(trial => {
      const match = matchesJRCTEligibility(trial, patientProfile, genomicProfile);
      return {
        ...trial,
        matchScore: match.eligible ? 100 : 0,
        matchReasons: match.reasons,
        eligible: match.eligible
      };
    });

    // Sort by match score
    return matchedTrials.sort((a, b) => b.matchScore - a.matchScore);
  }
};
```

---

## UI Component

### Clinical Trials Screen

Create `src/components/ClinicalTrials.js`:

```javascript
import React, { useState, useEffect } from 'react';
import { Search, MapPin, Users, Calendar, ExternalLink } from 'lucide-react';
import { clinicalTrialsService } from '../firebase/services';
import { searchJRCTByGenomicProfile } from '../services/clinicalTrials/jrctService';

export default function ClinicalTrials({ user, patientProfile, genomicProfile }) {
  const [trials, setTrials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTrial, setSelectedTrial] = useState(null);

  // Load matched trials
  useEffect(() => {
    loadTrials();
  }, [user]);

  const loadTrials = async () => {
    setLoading(true);
    try {
      const saved = await clinicalTrialsService.getSavedTrials(user.uid);
      setTrials(saved);
    } catch (error) {
      console.error('Error loading trials:', error);
    }
    setLoading(false);
  };

  // Search for new trials
  const handleSearch = async () => {
    setLoading(true);
    try {
      const matched = await clinicalTrialsService.searchAndMatchTrials(
        user.uid,
        patientProfile,
        genomicProfile
      );
      setTrials(matched);
    } catch (error) {
      console.error('Error searching trials:', error);
    }
    setLoading(false);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Clinical Trials</h2>
          <p className="text-sm text-gray-600">Find matching trials in Japan (JRCT)</p>
        </div>
        <button
          onClick={handleSearch}
          disabled={loading}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <Search className="w-4 h-4" />
          Search Trials
        </button>
      </div>

      {/* Trials List */}
      <div className="space-y-4">
        {trials.map(trial => (
          <TrialCard
            key={trial.id}
            trial={trial}
            onSelect={() => setSelectedTrial(trial)}
          />
        ))}
      </div>

      {/* Trial Detail Modal */}
      {selectedTrial && (
        <TrialDetailModal
          trial={selectedTrial}
          onClose={() => setSelectedTrial(null)}
        />
      )}
    </div>
  );
}

function TrialCard({ trial, onSelect }) {
  return (
    <div className="bg-white border rounded-lg p-4 hover:shadow-md transition cursor-pointer" onClick={onSelect}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
              {trial.phase}
            </span>
            <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
              {trial.status}
            </span>
            {trial.eligible && (
              <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded">
                ✓ Eligible
              </span>
            )}
          </div>

          <h3 className="text-lg font-semibold text-gray-900 mb-1">{trial.title}</h3>
          {trial.titleJapanese && (
            <p className="text-sm text-gray-600 mb-2">{trial.titleJapanese}</p>
          )}

          <p className="text-sm text-gray-700 mb-3">{trial.condition}</p>

          <div className="flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              {trial.locations[0]?.city}, {trial.locations[0]?.prefecture}
            </div>
            <div className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              {trial.enrollmentCurrent}/{trial.enrollmentTarget} enrolled
            </div>
          </div>
        </div>

        <ExternalLink className="w-5 h-5 text-gray-400" />
      </div>
    </div>
  );
}
```

---

## Testing

### Test JRCT Integration

```javascript
// Test search
const results = await searchJRCT({
  condition: 'Ovarian Cancer',
  status: 'recruiting',
  location: 'Tokyo'
});

console.log(`Found ${results.totalResults} trials`);
console.log(results.trials[0]);

// Test genomic matching
const genomicProfile = {
  mutations: [
    { gene: 'BRCA1', significance: 'pathogenic' }
  ],
  biomarkers: {
    hrdScore: { value: 54, interpretation: 'HRD-positive' }
  }
};

const patientProfile = {
  diagnosis: 'Ovarian Cancer',
  age: 58,
  gender: 'female'
};

const matched = await searchJRCTByGenomicProfile(genomicProfile, patientProfile);
console.log(`Matched ${matched.length} trials`);
```

---

## Summary

✅ **JRCT API Integration** - Search Japanese clinical trials
✅ **Genomic Matching** - Match by BRCA, TMB, MSI, HRD
✅ **Eligibility Checking** - Age, gender, biomarker validation
✅ **Firestore Storage** - Save matched trials
✅ **UI Component** - Browse and view trial details
✅ **Bilingual Support** - English and Japanese titles

**Next Steps:**
1. Implement jrctService.js
2. Add clinicalTrialsService to Firebase services
3. Create ClinicalTrials UI component
4. Test with real JRCT API
5. Add to main app navigation
