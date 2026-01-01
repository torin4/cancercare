import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertTriangle, XCircle, Star, Search as SearchIcon, MapPin, Globe, X, AlertCircle } from 'lucide-react';
import { auth } from '../firebase/config';
import { patientService, genomicProfileService, clinicalTrialsService, trialLocationService } from '../firebase/services';
import { getTrialDetails } from '../services/clinicalTrials/trialSearchService';

// Comprehensive list of countries for dropdowns
const COUNTRIES = [
  "United States", "Canada", "United Kingdom", "Australia", "Germany", "France", "India", "China", "Japan",
  "Brazil", "Mexico", "Italy", "Spain", "South Africa", "Nigeria", "Egypt", "Argentina", "Colombia",
  "Indonesia", "Pakistan", "Bangladesh", "Russia", "South Korea", "Vietnam", "Philippines", "Turkey",
  "Iran", "Thailand", "Myanmar", "Kenya", "Ukraine", "Poland", "Algeria", "Morocco", "Peru",
  "Venezuela", "Malaysia", "Uzbekistan", "Saudi Arabia", "Yemen", "Ghana", "Nepal", "Madagascar",
  "Cameroon", "Chile", "Netherlands", "Belgium", "Greece", "Portugal", "Sweden", "Switzerland",
  "Austria", "Israel", "United Arab Emirates", "Singapore", "Ireland", "New Zealand", "Denmark",
  "Finland", "Norway", "Cuba", "Dominican Republic", "Haiti", "Guatemala", "Ecuador", "Bolivia",
  "Paraguay", "Uruguay", "Honduras", "Nicaragua", "El Salvador", "Costa Rica", "Panama", "Jamaica",
  "Trinidad and Tobago", "Ethiopia", "Sudan", "Angola", "Mozambique", "Uganda", "Tanzania", "Democratic Republic of the Congo",
  "Afghanistan", "Iraq", "Syria", "Kazakhstan", "Sri Lanka", "Romania", "Hungary", "Czech Republic",
  "Bulgaria", "Serbia", "Croatia", "Bosnia and Herzegovina", "Albania", "North Macedonia", "Slovenia",
  "Estonia", "Latvia", "Lithuania", "Belarus", "Moldova", "Cyprus", "Malta", "Luxembourg", "Iceland",
  "Greenland", "Fiji", "Papua New Guinea", "Solomon Islands", "Vanuatu", "Samoa", "Tonga", "Kiribati",
  "Micronesia", "Marshall Islands", "Palau", "Nauru", "Tuvalu", "San Marino", "Monaco", "Liechtenstein",
  "Andorra", "Vatican City"
].sort();

const ClinicalTrials = ({ onTrialSelected, resetKey }) => {
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [activeTab, setActiveTab] = useState('search'); // 'search' or 'saved'

  const [searchResults, setSearchResults] = useState([]);
  const [searchSources, setSearchSources] = useState([]);
  const [searchProgress, setSearchProgress] = useState(null);
  const [savedTrials, setSavedTrials] = useState([]);
  const [savedTrialIds, setSavedTrialIds] = useState(new Set()); // Track which trial IDs are saved
  const [selectedTrial, setSelectedTrial] = useState(null);
  const [loadingTrialDetails, setLoadingTrialDetails] = useState(false);
  const [pagination, setPagination] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const [patientProfile, setPatientProfile] = useState(null);
  const [genomicProfile, setGenomicProfile] = useState(null);
  const [trialLocation, setTrialLocation] = useState(null);
  const [showEditLocation, setShowEditLocation] = useState(false);
  const [localTrialLocation, setLocalTrialLocation] = useState(null);

  const [error, setError] = useState(null);

  useEffect(() => {
    loadPatientData();
    // Always load saved trials to get accurate count (silently in background)
    loadSavedTrials(false);
  }, []); // Load once on mount

  // Reset search results when health data is cleared (resetKey changes)
  useEffect(() => {
    if (resetKey) {
      setSearchResults([]);
      setSearchSources([]);
      setSearchProgress(null);
      setPagination(null);
      setSelectedTrial(null);
      setError(null);
      // Reload patient data to get updated profile
      loadPatientData();
      // Reload saved trials (they should be empty after clearHealthData)
      loadSavedTrials(false);
    }
  }, [resetKey]);

  useEffect(() => {
    // Reload saved trials when switching to saved tab to ensure fresh data
    if (activeTab === 'saved') {
      loadSavedTrials(true); // Show loading state when on saved tab
    }
  }, [activeTab]);

  const loadPatientData = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const patient = await patientService.getPatient(userId);
      setPatientProfile(patient);

      const genomic = await genomicProfileService.getGenomicProfile(userId);
      setGenomicProfile(genomic);

      // Load trial location preferences
      try {
        const location = await trialLocationService.getTrialLocation(userId);
        if (location) {
          setTrialLocation({
            country: location.country || 'United States',
            includeAllLocations: location.includeAllLocations || false
          });
        }
      } catch (error) {
        console.log('No trial location preferences found');
        setTrialLocation({
          country: 'United States',
          includeAllLocations: false
        });
      }
    } catch (error) {
      console.error('Error loading patient data:', error);
    }
  };

  const loadSavedTrials = async (showLoading = false) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      setError(null); // Clear previous errors
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      const trials = await clinicalTrialsService.getSavedTrials(userId);
      setSavedTrials(trials);
      // Update saved trial IDs set
      const savedIds = new Set(trials.map(t => t.trialId || t.id));
      setSavedTrialIds(savedIds);
    } catch (error) {
      console.error('Error loading saved trials:', error);
      // Check if it's an index error
      if (error.code === 'failed-precondition' || error.message?.includes('index')) {
        const indexUrl = error.message?.match(/https:\/\/[^\s]+/)?.[0];
        // Only show error if on saved tab
        if (activeTab === 'saved') {
          setError(
            indexUrl 
              ? `Index required. Click here to create it: ${indexUrl}`
              : 'Firestore index required. Please create an index for matchedTrials (patientId + savedAt) in Firebase Console.'
          );
        }
      } else {
        // Only show error if on saved tab
        if (activeTab === 'saved') {
          setError('Failed to load saved trials. Please try again.');
        }
      }
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  // Check saved status for search results
  const checkSavedStatus = async (trials) => {
    const userId = auth.currentUser?.uid;
    if (!userId || !trials || trials.length === 0) return;

    try {
      // Check saved status for all trials in parallel
      const savedChecks = await Promise.all(
        trials.map(trial => 
          clinicalTrialsService.isTrialSaved(userId, trial.id)
            .then(isSaved => ({ trialId: trial.id, isSaved }))
            .catch(() => ({ trialId: trial.id, isSaved: false }))
        )
      );

      // Update saved trial IDs set
      const newSavedIds = new Set(savedTrialIds);
      savedChecks.forEach(({ trialId, isSaved }) => {
        if (isSaved) {
          newSavedIds.add(trialId);
        } else {
          newSavedIds.delete(trialId);
        }
      });
      setSavedTrialIds(newSavedIds);
    } catch (error) {
      console.error('Error checking saved status:', error);
    }
  };

  const handleSearchTrials = async () => {
    try {
      setSearching(true);
      setError(null);
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      setSearchProgress('Starting trial search');
      const results = await clinicalTrialsService.searchAndMatchTrials(
        userId,
        patientProfile,
        genomicProfile,
        (msg) => setSearchProgress(msg)
      );

      if (results.success) {
        setSearchResults(results.trials);
        setPagination(results.pagination || null);
        // prefer explicit searchSources from service, fallback to trial.source
        const sources = results.searchSources && results.searchSources.length > 0
          ? results.searchSources
          : Array.from(new Set((results.trials || []).map(t => t.source || t.sourceName).filter(Boolean)));
        setSearchSources(sources);
        // Check saved status for search results
        if (results.trials && results.trials.length > 0) {
          checkSavedStatus(results.trials);
        }
      } else {
        setError(results.error || 'No trials found');
        setSearchSources(results.searchSources || []);
        setPagination(null);
      }
    } catch (error) {
      console.error('Error searching trials:', error);
      setError('Failed to search trials');
    } finally {
      setTimeout(() => setSearchProgress(null), 600);
      setSearching(false);
    }
  };

  const handleSaveTrial = async (trial) => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;

      // Check if already saved
      const isSaved = await clinicalTrialsService.isTrialSaved(userId, trial.id);
      if (isSaved) {
        return; // Already saved, button should be disabled
      }

      // include search-level source attribution when saving
      const trialToSave = { ...trial, attemptedSources: searchSources || [] };
      await clinicalTrialsService.saveMatchedTrial(userId, trialToSave);
      
      // Update saved trial IDs set
      setSavedTrialIds(prev => new Set([...prev, trial.id]));

      // Reload saved trials to update count (silently if not on saved tab)
      loadSavedTrials(activeTab === 'saved');
    } catch (error) {
      console.error('Error saving trial:', error);
      alert('Failed to save trial');
    }
  };

  const handleRemoveTrial = async (trialDocId) => {
    if (!window.confirm('Remove this trial from your saved list?')) return;

    try {
      // Get the trial to find its trialId before removing
      const trial = savedTrials.find(t => t.id === trialDocId);
      await clinicalTrialsService.removeSavedTrial(trialDocId);
      
      // Update saved trial IDs set
      if (trial && (trial.trialId || trial.id)) {
        setSavedTrialIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(trial.trialId || trial.id);
          return newSet;
        });
      }
      
      // Reload saved trials to update count (silently if not on saved tab)
      loadSavedTrials(activeTab === 'saved');
    } catch (error) {
      console.error('Error removing trial:', error);
      alert('Failed to remove trial');
    }
  };

  const handleToggleFavorite = async (trialDocId, currentStatus) => {
    try {
      await clinicalTrialsService.toggleTrialFavorite(trialDocId, !currentStatus);
      loadSavedTrials();
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const getEligibilityBadge = (level) => {
    switch (level) {
      case 'highly_eligible':
        return <span className="px-3 py-1 bg-medical-accent-100 text-medical-accent-700 rounded-full text-sm font-medium flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Highly Eligible</span>;
      case 'potentially_eligible':
        return <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> Potentially Eligible</span>;
      case 'unlikely_eligible':
        return <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium flex items-center gap-1"><XCircle className="w-4 h-4" /> Unlikely Eligible</span>;
      default:
        return <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">Unknown</span>;
    }
  };

  const renderTrialCard = (trial, isSaved = false) => {
    return (
      <div key={trial.id} className="bg-white rounded-lg shadow-md p-6 mb-4 hover:shadow-lg transition">
        {/* Header */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-bold text-gray-900 mb-1">{trial.title || trial.titleJa}</h3>
              {trial.source && (
                <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full">{trial.source}</span>
              )}
            </div>
            {trial.titleJa && trial.title !== trial.titleJa && (
              <p className="text-sm text-gray-600 mb-2">{trial.titleJa}</p>
            )}
          </div>
          {isSaved && (
            <button
              onClick={() => handleToggleFavorite(trial.id, trial.isFavorite)}
              className="text-2xl ml-3"
            >
              <Star className={`w-5 h-5 ${trial.isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
            </button>
          )}
        </div>

        {/* Eligibility Badge */}
        {trial.matchResult && (
          <div className="mb-3">
            {getEligibilityBadge(trial.matchResult.eligibilityLevel)}
            <span className="ml-3 text-sm text-gray-600">
              Match: {trial.matchResult.matchPercentage}%
            </span>
          </div>
        )}

        {/* Trial Details */}
        <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
          <div>
            <span className="font-medium text-gray-700">Phase:</span>
            <span className="ml-2 text-gray-600">{trial.phase || 'Not specified'}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Status:</span>
            <span className="ml-2 text-gray-600">{trial.status || 'Unknown'}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Sponsor:</span>
            <span className="ml-2 text-gray-600">{trial.sponsor || 'N/A'}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">Location:</span>
            <span className="ml-2 text-gray-600">
              {trial.locations && trial.locations.length > 0 ? (() => {
                // Get unique countries from all locations
                const countries = [...new Set(trial.locations.map(loc => {
                  if (typeof loc === 'string') {
                    const parts = loc.split(',').map(s => s.trim());
                    return parts[parts.length - 1] || '';
                  }
                  return loc.country || '';
                }).filter(Boolean))];
                if (countries.length === 0) {
                  return trial.country || 'Not specified';
                } else if (countries.length === 1) {
                  return countries[0];
                } else {
                  return `${countries.length} countries (${countries.slice(0, 3).join(', ')}${countries.length > 3 ? '...' : ''})`;
                }
              })() : (trial.country || 'Not specified')}
            </span>
          </div>
        </div>

        {/* Conditions */}
        {trial.conditions && trial.conditions.length > 0 && (
          <div className="mb-3">
            <span className="font-medium text-gray-700 text-sm">Conditions:</span>
            <div className="flex flex-wrap gap-2 mt-1">
              {trial.conditions.map((condition, idx) => (
                <span key={idx} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                  {condition}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Interventions */}
        {trial.interventions && trial.interventions.length > 0 && (
          <div className="mb-3">
            <span className="font-medium text-gray-700 text-sm">Interventions:</span>
            <div className="flex flex-wrap gap-2 mt-1">
              {trial.interventions.map((intervention, idx) => (
                <span key={idx} className="px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs">
                  {intervention}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Match Details */}
        {trial.matchResult && trial.matchResult.matchDetails && (
          <div className="mb-3 p-3 bg-medical-accent-50 rounded-lg">
            <p className="font-medium text-medical-accent-800 text-sm mb-2">Why this matches:</p>
            <ul className="text-sm text-medical-accent-700 space-y-1">
              {trial.matchResult.matchDetails.map((detail, idx) => (
                <li key={idx}>• {detail.detail}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Issues */}
        {trial.matchResult && trial.matchResult.issues && trial.matchResult.issues.length > 0 && (
          <div className="mb-3 p-3 bg-yellow-50 rounded-lg">
            <p className="font-medium text-yellow-800 text-sm mb-2">Considerations:</p>
            <ul className="text-sm text-yellow-700 space-y-1">
              {trial.matchResult.issues.map((issue, idx) => (
                <li key={idx}>• {issue.detail}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommendation */}
        {trial.matchResult && trial.matchResult.recommendation && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-700">{trial.matchResult.recommendation}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={async () => {
              setSelectedTrial(trial);
              // If summary is missing, try to fetch it
              if (!trial.summary && trial.id && trial.source === 'ClinicalTrials.gov') {
                setLoadingTrialDetails(true);
                try {
                  const details = await getTrialDetails(trial.id);
                  if (details.success && details.summary) {
                    setSelectedTrial({ ...trial, summary: details.summary });
                  }
                } catch (error) {
                  console.error('Error fetching trial details:', error);
                } finally {
                  setLoadingTrialDetails(false);
                }
              }
            }}
            className="flex-1 bg-medical-primary-500 text-white px-4 py-2 rounded-lg hover:bg-medical-primary-600 transition text-sm font-medium shadow-sm"
          >
            View Details
          </button>
          {!isSaved && !savedTrialIds.has(trial.id) ? (
            <button
              onClick={() => handleSaveTrial(trial)}
              className="flex-1 bg-medical-accent-500 text-white px-4 py-2 rounded-lg hover:bg-medical-accent-600 transition text-sm font-medium shadow-sm"
            >
              Save Trial
            </button>
          ) : !isSaved ? (
            <button
              disabled
              className="flex-1 bg-gray-400 text-white px-4 py-2 rounded-lg cursor-not-allowed text-sm font-medium"
            >
              Saved
            </button>
          ) : (
            <button
              onClick={() => handleRemoveTrial(trial.id)}
              className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition text-sm font-medium"
            >
              Remove
            </button>
          )}
          <a
            href={trial.url || (trial.id ? `https://clinicaltrials.gov/study/${trial.id}` : '#')}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition text-sm font-medium text-center"
          >
            View on ClinicalTrials.gov
          </a>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-4">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-medical-neutral-900 mb-2">Clinical Trials</h1>
        <p className="text-medical-neutral-600">Search and save clinical trials from ClinicalTrials.gov</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-medical-neutral-200">
        <button
          onClick={() => setActiveTab('search')}
          className={`pb-3 px-4 font-medium transition-all duration-200 ${
            activeTab === 'search'
              ? 'text-medical-primary-600 border-b-2 border-medical-primary-600'
              : 'text-medical-neutral-600 hover:text-medical-primary-600'
          }`}
        >
          Search Trials
        </button>
        <button
          onClick={() => setActiveTab('saved')}
          className={`pb-3 px-4 font-medium transition-all duration-200 ${
            activeTab === 'saved'
              ? 'text-medical-primary-600 border-b-2 border-medical-primary-600'
              : 'text-medical-neutral-600 hover:text-medical-primary-600'
          }`}
        >
          Saved Trials ({savedTrials.length})
        </button>
      </div>

      {/* Search Tab */}
      {activeTab === 'search' && (
        <div>
          {/* Search Info */}
          <div className="bg-medical-primary-50 border border-medical-primary-200 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-medical-primary-900 mb-2">Search Criteria</h3>
            <div className="text-sm text-medical-primary-800 space-y-1">
              <p><strong>Diagnosis:</strong> {patientProfile?.diagnosis || 'Not set'}</p>
              <p><strong>Age:</strong> {patientProfile?.age || 'Not set'}</p>
              <p><strong>Gender:</strong> {patientProfile?.gender || 'Not set'}</p>
              {genomicProfile && (
                <p className="flex items-center gap-1"><strong>Genomic Profile:</strong> <CheckCircle className="w-4 h-4 text-medical-accent-600" /> Available (will be used for matching)</p>
              )}
              {trialLocation && (
                <button
                  onClick={() => {
                    setLocalTrialLocation({ ...trialLocation });
                    setShowEditLocation(true);
                  }}
                  className="flex items-center gap-2 text-left hover:opacity-80 transition-opacity cursor-pointer"
                >
                  <strong>Search Location:</strong> {
                    trialLocation.includeAllLocations 
                      ? (
                        <span className="flex items-center gap-1 text-medical-primary-600">
                          <Globe className="w-4 h-4" /> Global (All Countries)
                        </span>
                      )
                      : (
                        <span className="flex items-center gap-1 text-medical-primary-600">
                          <MapPin className="w-4 h-4" /> {trialLocation.country}
                        </span>
                      )
                  }
                  <span className="text-xs text-medical-primary-500 ml-1">(Click to change)</span>
                </button>
              )}
            </div>
          </div>

          {/* Search Button */}
          <button
            onClick={handleSearchTrials}
            disabled={searching || !patientProfile?.diagnosis}
            className="w-full bg-medical-primary-500 text-white px-6 py-4 rounded-lg hover:bg-medical-primary-600 transition font-medium text-lg mb-6 disabled:bg-medical-neutral-400 disabled:cursor-not-allowed shadow-sm"
          >
            {searching ? (
              <span className="flex items-center gap-2"><SearchIcon className="w-5 h-5" /> Searching sources...</span>
            ) : (
              <span className="flex items-center gap-2"><SearchIcon className="w-5 h-5" /> Search Clinical Trials</span>
            )}
          </button>
          {/* Search Results */}
          {searchResults.length > 0 && (
            <div>
              {searchSources && searchSources.length > 0 && (
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-sm text-gray-600">Sources used:</span>
                  {searchSources.map((s, idx) => (
                    <span key={idx} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full">{s}</span>
                  ))}
                </div>
              )}
              {searchProgress && (
                <div className="mb-2 text-sm text-gray-500">{searchProgress}</div>
              )}

              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Found {searchResults.length} Matching Trials
                {pagination && pagination.totalResults && (
                  <span className="text-base font-normal text-gray-600 ml-2">
                    (of {pagination.totalResults} total)
                  </span>
                )}
              </h2>
              <div className="space-y-4">
                {searchResults.map(trial => renderTrialCard(trial, false))}
                
                {/* Load More Button */}
                {pagination && pagination.hasMore && (
                  <div className="flex justify-center pt-6">
                    <button
                      onClick={handleLoadMore}
                      disabled={loadingMore || searching}
                      className="px-6 py-3 bg-medical-primary-500 text-white rounded-lg font-medium hover:bg-medical-primary-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
                    >
                      {loadingMore ? (
                        <>
                          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Loading...
                        </>
                      ) : (
                        <>
                          Load More
                          {pagination.totalResults && (
                            <span className="text-sm opacity-75">
                              ({searchResults.length} of {pagination.totalResults})
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-800 font-medium flex items-center gap-2"><AlertTriangle className="w-5 h-5" /> {error}</p>
              {searchSources && searchSources.length > 0 && (
                <p className="text-sm text-red-600 mt-2">
                  Sources attempted: {searchSources.join(', ')}
                </p>
              )}
            </div>
          )}

          {!searching && searchResults.length === 0 && !error && (
            <div className="text-center text-gray-500 py-12">
              <p className="text-lg">Click "Search Clinical Trials" to find matching trials</p>
              <p className="text-sm mt-2">Results will appear here after searching</p>
            </div>
          )}
        </div>
      )}

      {/* Saved Tab */}
      {activeTab === 'saved' && (
        <div>
          {loading ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Loading saved trials...</p>
            </div>
          ) : error ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <p className="text-yellow-800 font-medium flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5" /> Index Required
              </p>
              <p className="text-sm text-yellow-700 mb-2">
                {error.includes('https://') 
                  ? 'A Firestore index is required. Click the link below to create it:'
                  : 'A Firestore index is required. Please create an index for matchedTrials (patientId + savedAt) in Firebase Console.'}
              </p>
              {error.includes('https://') && (
                <a 
                  href={error.match(/https:\/\/[^\s]+/)?.[0]} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-medical-primary-600 hover:underline text-sm block mb-2"
                >
                  Click here to create the required index →
                </a>
              )}
              <p className="text-xs text-yellow-600 mt-2">
                Once the index is created (usually takes 1-2 minutes), refresh this page.
              </p>
            </div>
          ) : savedTrials.length > 0 ? (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Your Saved Trials ({savedTrials.length})
              </h2>
              {savedTrials.map(trial => renderTrialCard(trial, true))}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-12">
              <p className="text-lg">No saved trials yet</p>
              <p className="text-sm mt-2">Search for trials and save the ones you're interested in</p>
            </div>
          )}
        </div>
      )}

      {/* Trial Detail Modal */}
      {selectedTrial && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white w-full h-full sm:h-auto sm:max-w-3xl sm:rounded-xl sm:max-h-[85vh] flex flex-col animate-slide-up shadow-lg border border-medical-neutral-200">
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-medical-neutral-200 flex-shrink-0">
              <h2 className="text-xl sm:text-2xl font-bold text-medical-neutral-900 pr-4">
                {selectedTrial.title || selectedTrial.titleJa || 'Trial Details'}
              </h2>
              <button
                onClick={() => setSelectedTrial(null)}
                className="p-2 hover:bg-medical-neutral-100 rounded-lg transition flex-shrink-0"
                type="button"
              >
                <X className="w-5 h-5 text-medical-neutral-600" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              {selectedTrial.titleJa && selectedTrial.title !== selectedTrial.titleJa && (
                <div className="bg-medical-primary-50 border border-medical-primary-200 rounded-lg p-3">
                  <p className="text-sm text-medical-primary-800">{selectedTrial.titleJa}</p>
                </div>
              )}

              {/* Summary */}
              <div className="bg-white rounded-lg border border-medical-neutral-200 p-4">
                <h3 className="font-semibold text-medical-neutral-900 mb-3 flex items-center gap-2">
                  <SearchIcon className="w-5 h-5 text-medical-primary-600" />
                  Summary
                </h3>
                {loadingTrialDetails ? (
                  <div className="flex items-center gap-2 text-medical-neutral-600">
                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-sm">Loading summary...</span>
                  </div>
                ) : (
                  <p className="text-medical-neutral-700 whitespace-pre-line leading-relaxed">
                    {selectedTrial.summary || selectedTrial.summaryJa || 'No summary available. Please visit the trial page for more information.'}
                  </p>
                )}
              </div>

              {/* Eligibility Criteria */}
              {selectedTrial.eligibility && (
                <div className="bg-white rounded-lg border border-medical-neutral-200 p-4">
                  <h3 className="font-semibold text-medical-neutral-900 mb-3 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-medical-accent-600" />
                    Eligibility Criteria
                  </h3>
                  <div className="bg-medical-neutral-50 rounded-lg p-3 border border-medical-neutral-200">
                    <p className="text-sm text-medical-neutral-700 whitespace-pre-line leading-relaxed">
                      {typeof selectedTrial.eligibility === 'string' 
                        ? selectedTrial.eligibility
                        : (selectedTrial.eligibility.criteria || selectedTrial.eligibility.criteriaJa || 'Not specified')}
                    </p>
                  </div>
                </div>
              )}

              {/* Study Locations */}
              {selectedTrial.locations && selectedTrial.locations.length > 0 && (
                <div className="bg-white rounded-lg border border-medical-neutral-200 p-4">
                  <h3 className="font-semibold text-medical-neutral-900 mb-3 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-medical-primary-600" />
                    Study Locations
                  </h3>
                  <ul className="space-y-3">
                    {selectedTrial.locations.map((location, idx) => {
                      // Handle both string and object location formats
                      let locationText = '';
                      let facilityName = '';
                      
                      if (typeof location === 'string') {
                        locationText = location;
                      } else if (location && typeof location === 'object') {
                        // Extract facility name if available
                        facilityName = location.facility || '';
                        
                        // Format object location: "Facility, City, State, Country" or "City, Country"
                        const parts = [];
                        if (facilityName) parts.push(facilityName);
                        if (location.city) parts.push(location.city);
                        if (location.state) parts.push(location.state);
                        if (location.country) parts.push(location.country);
                        locationText = parts.length > 0 ? parts.join(', ') : JSON.stringify(location);
                      } else {
                        locationText = String(location || 'Unknown location');
                      }
                      
                      return (
                        <li key={idx} className="bg-medical-neutral-50 rounded-lg p-3 border border-medical-neutral-200">
                          {facilityName && (
                            <div className="font-semibold text-medical-neutral-900 mb-1">{facilityName}</div>
                          )}
                          <div className="text-sm text-medical-neutral-700">{locationText}</div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="border-t border-medical-neutral-200 p-4 sm:p-6 flex flex-col sm:flex-row gap-3 flex-shrink-0">
              {onTrialSelected && (
                <button
                  onClick={() => {
                    onTrialSelected(selectedTrial);
                    setSelectedTrial(null);
                  }}
                  className="flex-1 bg-medical-accent-500 text-white px-4 py-2.5 rounded-lg hover:bg-medical-accent-600 transition font-medium shadow-sm"
                >
                  Ask About This Trial
                </button>
              )}
              <a
                href={selectedTrial.url || (selectedTrial.id ? `https://clinicaltrials.gov/study/${selectedTrial.id}` : '#')}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-medical-primary-500 text-white px-4 py-2.5 rounded-lg hover:bg-medical-primary-600 transition text-center font-medium shadow-sm"
              >
                View on ClinicalTrials.gov
              </a>
              <button
                onClick={() => setSelectedTrial(null)}
                className="flex-1 bg-medical-neutral-200 text-medical-neutral-700 px-4 py-2.5 rounded-lg hover:bg-medical-neutral-300 transition font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Location Modal */}
      {showEditLocation && localTrialLocation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white w-full h-full sm:h-auto sm:max-w-lg sm:rounded-xl sm:max-h-[85vh] flex flex-col animate-slide-up">
            <div className="flex items-center justify-between p-4 border-b border-medical-neutral-200 flex-shrink-0">
              <h3 className="text-lg font-semibold text-medical-neutral-900">Trial Search Location</h3>
              <button
                onClick={() => setShowEditLocation(false)}
                className="p-2 hover:bg-medical-neutral-100 rounded-lg transition"
              >
                <X className="w-5 h-5 text-medical-neutral-600" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="bg-medical-accent-50 border border-medical-accent-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-medical-accent-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-medical-accent-900">Trial Matching</p>
                    <p className="text-xs text-medical-accent-700 mt-0.5">
                      Your location helps us find clinical trials nearby. You can also enable global search to include international trials.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-medical-primary-50 border border-medical-primary-200 rounded-lg p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localTrialLocation.includeAllLocations}
                    onChange={(e) => setLocalTrialLocation({ ...localTrialLocation, includeAllLocations: e.target.checked })}
                    className="mt-1 w-4 h-4 text-medical-primary-600 rounded focus:ring-medical-primary-500"
                  />
                  <div>
                    <p className="font-semibold text-medical-neutral-800">Include Global Locations</p>
                    <p className="text-xs text-medical-neutral-600 mt-1">
                      Search international databases for all available clinical trials worldwide
                    </p>
                  </div>
                </label>
              </div>

              <div className={localTrialLocation.includeAllLocations ? 'opacity-50' : ''}>
                <h4 className="font-semibold text-medical-neutral-800 mb-3">Search Country</h4>
                <div>
                  <label className="block text-sm font-medium text-medical-neutral-700 mb-1">Country</label>
                  <select
                    value={localTrialLocation.country}
                    onChange={(e) => setLocalTrialLocation({ ...localTrialLocation, country: e.target.value })}
                    disabled={localTrialLocation.includeAllLocations}
                    className="w-full border border-medical-neutral-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-medical-primary-500 focus:border-transparent disabled:bg-medical-neutral-100 transition-all duration-200"
                  >
                    {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <p className="text-xs text-medical-neutral-500 mt-1">
                    {localTrialLocation.includeAllLocations 
                      ? 'Global search is enabled - country selection disabled'
                      : 'Trials will be searched within this country'}
                  </p>
                </div>
              </div>

              <div className="bg-medical-neutral-50 rounded-lg p-3">
                <h5 className="text-sm font-semibold text-medical-neutral-800 mb-2">What databases will be searched?</h5>
                <div className="space-y-1 text-xs text-medical-neutral-600">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-medical-primary-600 rounded-full"></div>
                    <span>ClinicalTrials.gov (US federal database)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-medical-primary-600 rounded-full"></div>
                    <span>NCI Clinical Trials Search</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-medical-primary-600 rounded-full"></div>
                    <span>Major cancer center databases</span>
                  </div>
                  {localTrialLocation.includeAllLocations && (
                    <>
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-1 bg-medical-primary-600 rounded-full"></div>
                        <span className="font-medium">EU Clinical Trials Register</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-1 bg-medical-primary-600 rounded-full"></div>
                        <span className="font-medium">WHO International Registry</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-medical-neutral-200 p-4 flex gap-3 flex-shrink-0">
              <button
                onClick={() => setShowEditLocation(false)}
                className="flex-1 bg-medical-neutral-200 text-medical-neutral-700 py-2.5 rounded-lg font-medium hover:bg-medical-neutral-300 transition"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    const userId = auth.currentUser?.uid;
                    if (!userId) return;
                    
                    await trialLocationService.saveTrialLocation(userId, localTrialLocation);
                    setTrialLocation(localTrialLocation);
                    setShowEditLocation(false);
                    // Reload patient data to get updated location
                    loadPatientData();
                  } catch (error) {
                    console.error('Error saving trial location:', error);
                    alert('Failed to save location settings. Please try again.');
                  }
                }}
                className="flex-1 bg-medical-primary-500 text-white py-2.5 rounded-lg font-medium hover:bg-medical-primary-600 transition shadow-sm"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClinicalTrials;
