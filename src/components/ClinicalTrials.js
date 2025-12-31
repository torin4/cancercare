import React, { useState, useEffect } from 'react';
import { CheckCircle, AlertTriangle, XCircle, Star, Search as SearchIcon } from 'lucide-react';
import { auth } from '../firebase/config';
import { patientService, genomicProfileService, clinicalTrialsService, trialLocationService } from '../firebase/services';

const ClinicalTrials = () => {
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [activeTab, setActiveTab] = useState('search'); // 'search' or 'saved'

  const [searchResults, setSearchResults] = useState([]);
  const [searchSources, setSearchSources] = useState([]);
  const [searchProgress, setSearchProgress] = useState(null);
  const [savedTrials, setSavedTrials] = useState([]);
  const [savedTrialIds, setSavedTrialIds] = useState(new Set()); // Track which trial IDs are saved
  const [selectedTrial, setSelectedTrial] = useState(null);
  const [pagination, setPagination] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const [patientProfile, setPatientProfile] = useState(null);
  const [genomicProfile, setGenomicProfile] = useState(null);
  const [trialLocation, setTrialLocation] = useState(null);

  const [error, setError] = useState(null);

  useEffect(() => {
    loadPatientData();
    // Always load saved trials to get accurate count (silently in background)
    loadSavedTrials(false);
  }, []); // Load once on mount

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
        return <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Highly Eligible</span>;
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
          <div className="mb-3 p-3 bg-green-50 rounded-lg">
            <p className="font-medium text-green-800 text-sm mb-2">Why this matches:</p>
            <ul className="text-sm text-green-700 space-y-1">
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
            onClick={() => setSelectedTrial(trial)}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm font-medium"
          >
            View Details
          </button>
          {!isSaved && !savedTrialIds.has(trial.id) ? (
            <button
              onClick={() => handleSaveTrial(trial)}
              className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition text-sm font-medium"
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Clinical Trials</h1>
        <p className="text-gray-600">Search and save clinical trials from ClinicalTrials.gov</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('search')}
          className={`pb-3 px-4 font-medium transition ${
            activeTab === 'search'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Search Trials
        </button>
        <button
          onClick={() => setActiveTab('saved')}
          className={`pb-3 px-4 font-medium transition ${
            activeTab === 'saved'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Saved Trials ({savedTrials.length})
        </button>
      </div>

      {/* Search Tab */}
      {activeTab === 'search' && (
        <div>
          {/* Search Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-blue-900 mb-2">Search Criteria</h3>
            <div className="text-sm text-blue-800 space-y-1">
              <p><strong>Diagnosis:</strong> {patientProfile?.diagnosis || 'Not set'}</p>
              <p><strong>Age:</strong> {patientProfile?.age || 'Not set'}</p>
              <p><strong>Gender:</strong> {patientProfile?.gender || 'Not set'}</p>
              {genomicProfile && (
                <p className="flex items-center gap-1"><strong>Genomic Profile:</strong> <CheckCircle className="w-4 h-4 text-green-600" /> Available (will be used for matching)</p>
              )}
              {trialLocation && (
                <p>
                  <strong>Search Location:</strong> {
                    trialLocation.includeAllLocations 
                      ? '🌍 Global (All Countries)' 
                      : `📍 ${trialLocation.country}`
                  }
                </p>
              )}
            </div>
          </div>

          {/* Search Button */}
          <button
            onClick={handleSearchTrials}
            disabled={searching || !patientProfile?.diagnosis}
            className="w-full bg-green-600 text-white px-6 py-4 rounded-lg hover:bg-green-700 transition font-medium text-lg mb-6 disabled:bg-gray-400 disabled:cursor-not-allowed"
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
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
                  className="text-blue-600 hover:underline text-sm block mb-2"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold text-gray-900">{selectedTrial.title || selectedTrial.titleJa || 'Trial Details'}</h2>
              <button
                onClick={() => setSelectedTrial(null)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>

            {selectedTrial.titleJa && selectedTrial.title !== selectedTrial.titleJa && (
              <p className="text-gray-600 mb-4">{selectedTrial.titleJa}</p>
            )}

            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-gray-900 mb-2">Summary</h3>
                <p className="text-gray-700">{selectedTrial.summary || selectedTrial.summaryJa || 'No summary available'}</p>
              </div>

              {selectedTrial.eligibility && (
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">Eligibility Criteria</h3>
                  <p className="text-gray-700 whitespace-pre-line">
                    {typeof selectedTrial.eligibility === 'string' 
                      ? selectedTrial.eligibility
                      : (selectedTrial.eligibility.criteria || selectedTrial.eligibility.criteriaJa || 'Not specified')}
                  </p>
                </div>
              )}

              {selectedTrial.locations && selectedTrial.locations.length > 0 && (
                <div>
                  <h3 className="font-bold text-gray-900 mb-2">Locations</h3>
                  <ul className="list-disc list-inside text-gray-700">
                    {selectedTrial.locations.map((location, idx) => {
                      // Handle both string and object location formats
                      let locationText = '';
                      if (typeof location === 'string') {
                        locationText = location;
                      } else if (location && typeof location === 'object') {
                        // Format object location: "City, Country" or just "Country"
                        const parts = [];
                        if (location.city) parts.push(location.city);
                        if (location.country) parts.push(location.country);
                        locationText = parts.length > 0 ? parts.join(', ') : JSON.stringify(location);
                      } else {
                        locationText = String(location || 'Unknown location');
                      }
                      return <li key={idx}>{locationText}</li>;
                    })}
                  </ul>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <a
                  href={selectedTrial.url || (selectedTrial.id ? `https://clinicaltrials.gov/study/${selectedTrial.id}` : '#')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-center font-medium"
                >
                  View on ClinicalTrials.gov
                </a>
                <button
                  onClick={() => setSelectedTrial(null)}
                  className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClinicalTrials;
