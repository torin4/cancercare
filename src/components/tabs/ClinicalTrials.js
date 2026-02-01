import React, { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { CheckCircle, AlertTriangle, XCircle, Search as SearchIcon, MapPin, Globe, X, MessageSquare, Bookmark, FlaskConical, FileText, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

const IRIS_ICON_SRC = '/icons/iris_logo.svg';
import ReactMarkdown from 'react-markdown';
import { auth } from '../../firebase/config';
import { patientService, genomicProfileService, clinicalTrialsService, trialLocationService } from '../../firebase/services';
import { useBanner } from '../../contexts/BannerContext';
import { getTrialDetails } from '../../services/clinicalTrials/trialSearchService';
import { calculateTrialMatchScore } from '../../services/clinicalTrials/trialMatcher';
import { DesignTokens, Layouts, combineClasses } from '../../design/designTokens';
import EditLocationModal from '../modals/EditLocationModal';

const ClinicalTrials = ({ onTrialSelected, resetKey, onOpenMobileChat }) => {
  const { showSuccess, showError } = useBanner();
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [activeTab, setActiveTab] = useState('search'); // 'search' or 'saved'

  const [searchResults, setSearchResults] = useState(() => {
    // Load persisted search results from localStorage
    try {
      const saved = localStorage.getItem('clinicalTrials_searchResults');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [searchSources, setSearchSources] = useState(() => {
    try {
      const saved = localStorage.getItem('clinicalTrials_searchSources');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [searchProgress, setSearchProgress] = useState(null);
  const [savedTrials, setSavedTrials] = useState([]);
  const [savedTrialIds, setSavedTrialIds] = useState(new Set()); // Track which trial IDs are saved
  const [selectedTrial, setSelectedTrial] = useState(null);
  const [loadingTrialDetails, setLoadingTrialDetails] = useState(false);
  const [pagination, setPagination] = useState(() => {
    try {
      const saved = localStorage.getItem('clinicalTrials_pagination');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loadingMore, setLoadingMore] = useState(false);

  const [patientProfile, setPatientProfile] = useState(null);
  const [genomicProfile, setGenomicProfile] = useState(null);
  const [trialLocation, setTrialLocation] = useState(null);
  const [showEditLocation, setShowEditLocation] = useState(false);
  const [loadingDetailsInBackground, setLoadingDetailsInBackground] = useState(false);

  const [error, setError] = useState(null);
  
  // Track expanded conditions/interventions per trial
  const [expandedSections, setExpandedSections] = useState(() => new Set());
  
  // Sort search results: excluded trials (0% match) go to bottom, others sorted by match percentage (highest first)
  const sortedSearchResults = useMemo(() => {
    if (!searchResults || searchResults.length === 0) return [];
    
    return [...searchResults].sort((a, b) => {
      const aMatch = a.matchResult?.matchPercentage || 0;
      const bMatch = b.matchResult?.matchPercentage || 0;
      
      // Excluded trials (0% match) go to bottom
      if (aMatch === 0 && bMatch !== 0) return 1; // a goes to bottom
      if (aMatch !== 0 && bMatch === 0) return -1; // b goes to bottom
      
      // If both are excluded or both are not excluded, sort by match percentage (highest first)
      return bMatch - aMatch;
    });
  }, [searchResults]);

  useEffect(() => {
    loadPatientData();
    // Always load saved trials to get accurate count (silently in background)
    loadSavedTrials(false);
    
    // Restore saved trial IDs from persisted search results
    if (searchResults.length > 0) {
      checkSavedStatus(searchResults);
    }
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
      // Clear persisted search state
      try {
        localStorage.removeItem('clinicalTrials_searchResults');
        localStorage.removeItem('clinicalTrials_searchSources');
        localStorage.removeItem('clinicalTrials_pagination');
      } catch (error) {
      }
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
        setTrialLocation({
          country: 'United States',
          includeAllLocations: false
        });
      }
    } catch (error) {
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
      // Sort by match percentage (highest first), then by savedAt (most recent first) for ties
      const sortedTrials = trials.sort((a, b) => {
        const aMatch = a.matchResult?.matchPercentage || 0;
        const bMatch = b.matchResult?.matchPercentage || 0;
        if (bMatch !== aMatch) {
          return bMatch - aMatch; // Higher match percentage first
        }
        // If match percentages are equal, sort by savedAt (most recent first)
        const aTime = a.savedAt?.toMillis?.() || a.savedAt?.seconds * 1000 || a.savedAt || 0;
        const bTime = b.savedAt?.toMillis?.() || b.savedAt?.seconds * 1000 || b.savedAt || 0;
        return bTime - aTime;
      });
      setSavedTrials(sortedTrials);
      // Update saved trial IDs set
      const savedIds = new Set(sortedTrials.map(t => t.trialId || t.id));
      setSavedTrialIds(savedIds);
    } catch (error) {
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
        
        // Persist search state to localStorage
        try {
          localStorage.setItem('clinicalTrials_searchResults', JSON.stringify(results.trials));
          localStorage.setItem('clinicalTrials_searchSources', JSON.stringify(sources));
          if (results.pagination) {
            localStorage.setItem('clinicalTrials_pagination', JSON.stringify(results.pagination));
          }
        } catch (error) {
        }
        
        // Check saved status for search results
        if (results.trials && results.trials.length > 0) {
          checkSavedStatus(results.trials);
          
          // For JRCT trials, fetch details in background to enable exclusion detection
          // This allows match scores to be updated with full eligibility criteria automatically
          const jrctTrials = results.trials.filter(t => t.source === 'JRCT' && !t.eligibilityCriteria);
          if (jrctTrials.length > 0 && patientProfile) {
            // Fetch details asynchronously for JRCT trials (don't block UI)
            (async () => {
              try {
                for (const trial of jrctTrials.slice(0, 10)) { // Limit to first 10 to avoid too many requests
                  try {
                    let searchQueryOrTrial = trial._tokenData ? trial : (trial._searchQuery || trial.conditions?.[0] || 'cancer');
                    const details = await getTrialDetails(trial.id, trial.source, searchQueryOrTrial);
                    
                    if (details.success && details.eligibilityCriteria && patientProfile) {
                      // Merge details and recalculate match
                      const updatedTrial = {
                        ...trial,
                        ...details,
                        eligibilityCriteria: details.eligibilityCriteria,
                        eligibility: details.eligibility || (details.eligibilityCriteria ? { criteria: details.eligibilityCriteria } : undefined)
                      };
                      
                      const recalculatedMatch = calculateTrialMatchScore(updatedTrial, patientProfile, genomicProfile);
                      const initialMatchPercentage = trial.matchResult?.matchPercentage || 0;
                      
                      // Update the trial in searchResults
                      setSearchResults(prevResults =>
                        prevResults.map(t =>
                          t.id === trial.id
                            ? { ...t, ...updatedTrial, matchResult: recalculatedMatch, _initialMatchPercentage: initialMatchPercentage }
                            : t
                        )
                      );
                      // Small delay to avoid overwhelming the server
                      await new Promise(resolve => setTimeout(resolve, 200));
                    }
                  } catch (err) {
                    // Silently fail - background fetch is optional
                  }
                }
              } catch (error) {
                // Silently fail - background fetch is optional
              }
            })();
          }
        }
      } else {
        setError(results.error || 'No trials found');
        setSearchSources(results.searchSources || []);
        setPagination(null);
      }
    } catch (error) {
      setError('Failed to search trials');
    } finally {
      setTimeout(() => setSearchProgress(null), 600);
      setSearching(false);
    }
  };

  const handleClearSearch = () => {
    setSearchResults([]);
    setSearchSources([]);
    setPagination(null);
    setError(null);
    setSearchProgress(null);
    // Clear persisted search state
    try {
      localStorage.removeItem('clinicalTrials_searchResults');
      localStorage.removeItem('clinicalTrials_searchSources');
      localStorage.removeItem('clinicalTrials_pagination');
    } catch (error) {
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
      showSuccess('Trial saved successfully!');
    } catch (error) {
      showError('Failed to save trial');
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
      showSuccess('Trial removed successfully!');
    } catch (error) {
      showError('Failed to remove trial');
    }
  };


  const getEligibilityBadge = (level) => {
    switch (level) {
      case 'highly_eligible':
        return <span className={combineClasses('px-2 sm:px-3 py-0.5 sm:py-1', DesignTokens.borders.radius.full, DesignTokens.typography.body.sm, 'font-medium flex items-center', DesignTokens.spacing.gap.xs, DesignTokens.moduleAccent.trials.bg, DesignTokens.moduleAccent.trials.text)}><CheckCircle className={DesignTokens.icons.small.size.full} /> <span className="whitespace-nowrap">Highly Eligible</span></span>;
      case 'potentially_eligible':
        return <span className={combineClasses('px-2 sm:px-3 py-0.5 sm:py-1', DesignTokens.borders.radius.full, DesignTokens.typography.body.sm, 'font-medium flex items-center', DesignTokens.spacing.gap.xs, DesignTokens.components.status.low.bg, DesignTokens.components.alert.text.warning)}><AlertTriangle className={DesignTokens.icons.small.size.full} /> <span className="whitespace-nowrap">Potentially Eligible</span></span>;
      case 'unlikely_eligible':
        return <span className={combineClasses('px-2 sm:px-3 py-0.5 sm:py-1', DesignTokens.borders.radius.full, DesignTokens.typography.body.sm, 'font-medium flex items-center', DesignTokens.spacing.gap.xs, DesignTokens.components.status.high.bg, DesignTokens.components.alert.text.error)}><XCircle className={DesignTokens.icons.small.size.full} /> <span className="whitespace-nowrap">Unlikely Eligible</span></span>;
      default:
        return <span className={combineClasses('px-2 sm:px-3 py-0.5 sm:py-1', DesignTokens.borders.radius.full, DesignTokens.typography.body.sm, 'font-medium', DesignTokens.colors.neutral[100], DesignTokens.colors.neutral.text[700])}>Unknown</span>;
    }
  };

  const toggleSection = (trialId, sectionType) => {
    const key = `${trialId}-${sectionType}`;
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const isSectionExpanded = (trialId, sectionType) => {
    return expandedSections.has(`${trialId}-${sectionType}`);
  };

  const renderExpandableBadges = (items, trialId, sectionType, badgeColorClass) => {
    if (!items || items.length === 0) return null;
    
    const expanded = isSectionExpanded(trialId, sectionType);
    // Estimate if more than one row: typically 3-4 badges fit in one row on mobile, 5-6 on desktop
    // Use a more conservative estimate to ensure we catch cases that wrap
    const needsTruncation = items.length > 4;
    
    return (
      <div className={combineClasses('mb-2 sm:mb-3', DesignTokens.spacing.header.mobile)}>
        <div className={combineClasses('flex items-center justify-between', 'mb-1')}>
          <span className={combineClasses(DesignTokens.typography.h3.weight, DesignTokens.colors.neutral.text[700], DesignTokens.typography.body.sm)}>
            {sectionType === 'conditions' ? 'Conditions:' : 'Interventions:'}
          </span>
          {needsTruncation && (
            <button
              onClick={() => toggleSection(trialId, sectionType)}
              className={combineClasses('flex items-center', DesignTokens.spacing.gap.xs, DesignTokens.typography.body.xs, DesignTokens.colors.primary.text[600], `hover:${DesignTokens.colors.primary.text[700]}`, DesignTokens.transitions.default, 'min-h-[32px] min-w-[32px] sm:min-h-[44px] sm:min-w-[44px]', DesignTokens.spacing.touchTarget, 'px-1')}
              aria-label={expanded ? 'Collapse' : 'Expand'}
            >
              {expanded ? (
                <>
                  <span className="hidden sm:inline">Show less</span>
                  <ChevronUp className={DesignTokens.icons.small.size.full} />
                </>
              ) : (
                <>
                  <span className="hidden sm:inline">Show more</span>
                  <ChevronDown className={DesignTokens.icons.small.size.full} />
                </>
              )}
            </button>
          )}
        </div>
        <div className="relative">
          <div 
            className={combineClasses('flex flex-wrap', DesignTokens.spacing.gap.sm, 'mt-1', DesignTokens.transitions.all, !expanded && needsTruncation ? 'max-h-[1.75rem] sm:max-h-[2rem] overflow-hidden' : '')}
          >
            {items.map((item, idx) => (
              <span key={idx} className={combineClasses('px-2 py-0.5 sm:py-1', DesignTokens.borders.radius.sm, DesignTokens.typography.body.xs, 'break-words', badgeColorClass)}>
                {item}
              </span>
            ))}
          </div>
          {!expanded && needsTruncation && (
            <div className="absolute bottom-0 left-0 right-0 h-3 sm:h-4 bg-gradient-to-t from-white to-transparent pointer-events-none" />
          )}
        </div>
      </div>
    );
  };

  const renderTrialCard = (trial, isSaved = false) => {
    return (
      <div key={trial.id} className={combineClasses(DesignTokens.components.card.container, DesignTokens.shadows.sm, DesignTokens.spacing.card.full, 'mb-3 sm:mb-4', DesignTokens.components.card.hover)}>
        {/* Header */}
        <div className={combineClasses('flex justify-between items-start', DesignTokens.spacing.header.mobile, DesignTokens.spacing.gap.sm)}>
          <div className="flex-1 min-w-0">
            <div className={combineClasses('flex items-start', DesignTokens.spacing.gap.sm, 'flex-wrap')}>
              <h3 
                className={combineClasses(DesignTokens.typography.h3.full, DesignTokens.typography.h3.weight, DesignTokens.typography.h3.color, 'mb-1 line-clamp-2')} 
                title={trial.title || trial.titleJa || ''}
              >
                {trial.title || trial.titleJa}
              </h3>
              {trial.source && (
                <span className={combineClasses(DesignTokens.typography.body.xs, 'px-2 py-0.5', DesignTokens.colors.neutral[100], DesignTokens.colors.neutral.text[700], DesignTokens.borders.radius.full, 'flex-shrink-0')}>{trial.source}</span>
              )}
            </div>
            {trial.titleJa && trial.title !== trial.titleJa && (
              <p className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.colors.neutral.text[600], 'mb-2 break-words')}>{trial.titleJa}</p>
            )}
          </div>
          <div className={combineClasses('flex items-center', DesignTokens.spacing.gap.sm, 'flex-shrink-0')}>
            {!isSaved && !savedTrialIds.has(trial.id) ? (
              <button
                onClick={() => handleSaveTrial(trial)}
                className={combineClasses('p-1.5 sm:p-1.5', `hover:${DesignTokens.colors.accent[50]}`, DesignTokens.borders.radius.sm, DesignTokens.transitions.default, 'relative group cursor-pointer', DesignTokens.spacing.touchTarget, 'min-w-[44px] flex items-center justify-center', 'active:opacity-70')}
                title="Save Trial"
              >
                <Bookmark className={combineClasses(DesignTokens.icons.button.size.full, DesignTokens.colors.accent.text[600])} />
                <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-medical-neutral-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 hidden sm:block">
                  Save Trial
                </span>
              </button>
            ) : !isSaved ? (
              <button
                disabled
                className={combineClasses('p-1.5 sm:p-1.5', DesignTokens.borders.radius.sm, 'cursor-default relative group', DesignTokens.spacing.touchTarget, 'min-w-[44px] flex items-center justify-center')}
                title="Trial saved"
              >
                <Bookmark className={combineClasses(DesignTokens.icons.button.size.full, DesignTokens.colors.accent.text[600], DesignTokens.colors.accent.text[600].replace('text-', 'fill-'))} />
                <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-medical-neutral-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 hidden sm:block">
                  Trial saved
                </span>
              </button>
            ) : (
              <button
                onClick={() => handleRemoveTrial(trial.id)}
                className={combineClasses('p-1.5 sm:p-1.5', DesignTokens.borders.radius.sm, DesignTokens.transitions.default, 'relative group cursor-pointer', DesignTokens.spacing.touchTarget, 'min-w-[44px] flex items-center justify-center', 'active:opacity-70', `hover:${DesignTokens.components.status.high.bg}`)}
                title="Remove from saved"
              >
                <Bookmark className={combineClasses(DesignTokens.icons.button.size.full, DesignTokens.components.status.high.text, DesignTokens.components.status.high.text.replace('text-', 'fill-'))} />
                <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-medical-neutral-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 hidden sm:block">
                  Remove from saved
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Eligibility Badge */}
            {trial.matchResult && (
          <div className={combineClasses('mb-2 sm:mb-3', DesignTokens.spacing.header.mobile, 'flex flex-wrap items-center', DesignTokens.spacing.gap.sm)}>
            {getEligibilityBadge(trial.matchResult.eligibilityLevel)}
            <div className="flex items-center gap-1.5">
              <span className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.colors.neutral.text[600])}>
                Match: {trial.matchResult.matchPercentage}%
              </span>
              {trial._initialMatchPercentage !== undefined && 
               trial._initialMatchPercentage !== trial.matchResult.matchPercentage && 
               trial.matchResult.matchPercentage === 0 && (
                <span className={combineClasses(DesignTokens.typography.body.xs, 'text-red-600 font-medium', 'px-1.5 py-0.5 rounded', 'bg-red-50')}>
                  EXCLUDED
                </span>
              )}
            </div>
          </div>
        )}

        {/* Trial Details */}
        <div className={combineClasses('grid grid-cols-1 sm:grid-cols-2', DesignTokens.spacing.gap.md, 'mb-2 sm:mb-3', DesignTokens.typography.body.sm, DesignTokens.spacing.header.mobile)}>
          <div>
            <span className={combineClasses(DesignTokens.typography.h3.weight, DesignTokens.colors.neutral.text[700])}>Phase:</span>
            <span className={combineClasses('ml-1 sm:ml-2', DesignTokens.colors.neutral.text[600])}>{trial.phase || 'Not specified'}</span>
          </div>
          <div>
            <span className={combineClasses(DesignTokens.typography.h3.weight, DesignTokens.colors.neutral.text[700])}>Status:</span>
            <span className={combineClasses('ml-1 sm:ml-2', DesignTokens.colors.neutral.text[600])}>{trial.status || 'Unknown'}</span>
          </div>
          <div>
            <span className={combineClasses(DesignTokens.typography.h3.weight, DesignTokens.colors.neutral.text[700])}>Location:</span>
            <span className={combineClasses('ml-1 sm:ml-2', DesignTokens.colors.neutral.text[600], 'break-words')}>
              {trial.countriesOfRecruitment && trial.countriesOfRecruitment.length > 0 ? (
                trial.countriesOfRecruitment.length === 1 
                  ? trial.countriesOfRecruitment[0]
                  : trial.countriesOfRecruitment.join(', ')
              ) : trial.locations && trial.locations.length > 0 ? (() => {
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
        {renderExpandableBadges(trial.conditions, trial.id, 'conditions', 'bg-medical-primary-50 text-medical-primary-700')}

        {/* Interventions */}
        {renderExpandableBadges(trial.interventions, trial.id, 'interventions', 'bg-purple-50 text-purple-700')}

        {/* Match Details */}
        {trial.matchResult && trial.matchResult.matchDetails && (
          <div className={combineClasses('mb-2 sm:mb-3', DesignTokens.spacing.card.mobile, DesignTokens.colors.accent[50], DesignTokens.borders.radius.sm, DesignTokens.spacing.header.mobile)}>
            <p className={combineClasses(DesignTokens.typography.h3.weight, DesignTokens.colors.app.text[900], DesignTokens.typography.body.sm, 'mb-1.5 sm:mb-2')}>Why this matches:</p>
            <ul className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.colors.app.text[700], 'space-y-0.5 sm:space-y-1')}>
              {trial.matchResult.matchDetails.map((detail, idx) => (
                <li key={idx}>• {detail.detail}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Issues */}
        {trial.matchResult && trial.matchResult.issues && trial.matchResult.issues.length > 0 && (
          <div className={combineClasses('mb-2 sm:mb-3 p-2.5 sm:p-3 rounded-lg', DesignTokens.components.status.low.bg)}>
            <p className={combineClasses(DesignTokens.typography.h3.weight, DesignTokens.typography.body.sm, 'mb-1.5 sm:mb-2', DesignTokens.components.alert.text.warning)}>Considerations:</p>
            <ul className={combineClasses(DesignTokens.typography.body.sm, 'space-y-0.5 sm:space-y-1', DesignTokens.components.alert.text.warning)}>
              {trial.matchResult.issues.map((issue, idx) => (
                <li key={idx}>• {issue.detail}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommendation */}
        {trial.matchResult && trial.matchResult.recommendation && (
          <div className={combineClasses(DesignTokens.components.card.nestedSubtle, 'mb-3 sm:mb-4')}>
            <p className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.colors.neutral.text[700])}>{trial.matchResult.recommendation}</p>
          </div>
        )}

        {/* Actions */}
        <div className={combineClasses('flex flex-col', DesignTokens.spacing.gap.sm)}>
          <div className={combineClasses('flex', DesignTokens.spacing.gap.sm)}>
            <button
              onClick={async () => {
                setSelectedTrial(trial);
                // If summary is missing, try to fetch it (works for both ClinicalTrials.gov and JRCT)
                if (!trial.summary && trial.id) {
                  setLoadingTrialDetails(true);
                  try {
                    // Pass source and searchQuery/tokenData for JRCT trials
                    // For JRCT: If we have stored tokenData, pass the trial object so getTrialDetails can use it
                    // Otherwise, use the original search query that returned this trial
                    let searchQueryOrTrial = '';
                    if (trial.source === 'JRCT') {
                      // If we have tokenData from search results, pass the trial object
                      if (trial._tokenData) {
                        searchQueryOrTrial = trial; // Pass entire trial object so getTrialDetails can extract tokenData
                      } else {
                        // Fallback to search query method
                        searchQueryOrTrial = trial._searchQuery || trial.conditions?.[0] || trial.title || 'cancer';
                      }
                    }
                    const details = await getTrialDetails(trial.id, trial.source, searchQueryOrTrial);
                    if (details.success) {
                      // Merge all details into the trial object
                      const updatedTrial = { 
                        ...trial, 
                        ...details,
                        summary: details.summary || trial.summary,
                        eligibilityCriteria: details.eligibilityCriteria || trial.eligibilityCriteria,
                        eligibility: details.eligibility || trial.eligibility,
                        title: details.title || trial.title, // Use full Public Title from details
                        titleJa: details.titleJa || trial.titleJa || details.title || trial.title
                      };
                      
                      // Recalculate match score now that we have eligibility criteria
                      // This is important because exclusion detection requires eligibility criteria
                      if (patientProfile && updatedTrial.eligibilityCriteria) {
                        const initialMatchPercentage = trial.matchResult?.matchPercentage || 0;
                        const recalculatedMatch = calculateTrialMatchScore(updatedTrial, patientProfile, genomicProfile);
                        updatedTrial.matchResult = recalculatedMatch;
                        updatedTrial._initialMatchPercentage = initialMatchPercentage; // Store initial for comparison
                        
                        // Also update the trial in searchResults so the card shows the updated match
                        setSearchResults(prevResults => 
                          prevResults.map(t => 
                            t.id === trial.id 
                              ? { ...t, ...updatedTrial, matchResult: recalculatedMatch, _initialMatchPercentage: initialMatchPercentage }
                              : t
                          )
                        );
                      }
                      
                      setSelectedTrial(updatedTrial);
                    } else {
                      // Show trial anyway, even if details fetch failed
                      // The modal will show whatever data we have from search results
                      setSelectedTrial(trial);
                    }
                  } catch (error) {
                    console.error('Error fetching trial details:', error);
                    // Fallback: show trial without additional details
                    // The trial from search results should still have basic info
                    setSelectedTrial(trial);
                  } finally {
                    setLoadingTrialDetails(false);
                  }
                } else {
                  // Trial already has summary, just show it
                  setSelectedTrial(trial);
                }
              }}
              className={combineClasses(DesignTokens.components.button.outline.primary, DesignTokens.spacing.button.mobile, 'flex-1 text-xs sm:text-sm font-medium gap-1.5 sm:gap-2')}
            >
              <FileText className={DesignTokens.icons.small.size.full} />
              <span>View Details</span>
            </button>
            {onTrialSelected && (
              <button
                onClick={() => {
                  // Store individual trial context in sessionStorage
                  sessionStorage.setItem('currentTrialContext', JSON.stringify(trial));
                  // Clear search results context - individual trial takes precedence
                  sessionStorage.removeItem('currentSearchResultsContext');
                  
                  if (onOpenMobileChat) {
                    // On mobile, just open overlay - don't navigate
                    onOpenMobileChat();
                  } else {
                    // On desktop, switch to chat tab
                    if (onTrialSelected) {
                      onTrialSelected(trial);
                    }
                  }
                }}
                className={combineClasses('border-2 border-medical-secondary-500 text-medical-secondary-600 rounded-lg hover:bg-medical-secondary-50 transition font-medium min-h-[44px] touch-manipulation active:opacity-70 flex items-center justify-center gap-2 lg:hidden', DesignTokens.spacing.button.mobile, 'flex-1', DesignTokens.typography.body.sm, 'font-medium', DesignTokens.spacing.gap.sm)}
              >
                <img src={IRIS_ICON_SRC} alt="" className={DesignTokens.icons.small.size.full} />
                <span className="hidden sm:inline">Ask About This Trial</span>
                <span className="sm:hidden">Ask About</span>
              </button>
            )}
            <a
              href={trial.source === 'JRCT' 
                ? (trial.url || trial.detailUrl || `https://jrct.mhlw.go.jp/en-latest-detail/${trial.id}`)
                : (trial.url || (trial.id ? `https://clinicaltrials.gov/study/${trial.id}` : '#'))}
              target="_blank"
              rel="noopener noreferrer"
              className={combineClasses(DesignTokens.components.button.outline.neutral, DesignTokens.spacing.button.mobile, 'hidden sm:flex flex-1 text-xs sm:text-sm font-medium gap-1.5 sm:gap-2')}
            >
              <Globe className={DesignTokens.icons.small.size.full} />
              <span>{trial.source === 'JRCT' ? 'View on JRCT' : 'View on ClinicalTrials.gov'}</span>
            </a>
          </div>
          <a
            href={trial.source === 'JRCT'
              ? (trial.url || trial.detailUrl || `https://jrct.mhlw.go.jp/en-latest-detail/${trial.id}`)
              : (trial.url || (trial.id ? `https://clinicaltrials.gov/study/${trial.id}` : '#'))}
            target="_blank"
            rel="noopener noreferrer"
            className={combineClasses(DesignTokens.components.button.outline.neutral, 'sm:hidden w-full', DesignTokens.spacing.button.mobile, DesignTokens.typography.body.xs, 'font-medium text-center', DesignTokens.spacing.gap.sm)}
          >
            <Globe className={DesignTokens.icons.small.size.full} />
            <span>{trial.source === 'JRCT' ? 'View on JRCT' : 'View on CT.gov'}</span>
          </a>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Loading overlay for trial search */}
      {searching && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl">
            <div className="text-center">
              <div className={combineClasses('w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4', DesignTokens.moduleAccent.trials.bg)}>
                <Loader2 className={combineClasses('w-8 h-8 animate-spin', DesignTokens.moduleAccent.trials.text)} />
              </div>
              <h3 className={combineClasses('text-xl font-bold mb-4', DesignTokens.colors.neutral.text[900])}>Searching Clinical Trials</h3>
              <div className="space-y-2">
                <p className={combineClasses('text-sm', DesignTokens.colors.neutral.text[600])}>
                  ClinicalTrials.gov
                </p>
                <p className={combineClasses('text-sm', DesignTokens.colors.neutral.text[600])}>
                  JRCT
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Header */}
      <div className={combineClasses(
        DesignTokens.spacing.container.mobile,
        'sm:px-4 md:px-6',
        'py-2 sm:py-3',
        'flex items-center justify-between'
      )}>
        <div className={combineClasses('flex items-center', DesignTokens.spacing.gap.sm, 'sm:gap-3')}>
          <div className={combineClasses(DesignTokens.moduleAccent.trials.bg, 'p-2 sm:p-2.5 rounded-lg')}>
            <FlaskConical className={combineClasses('w-5 h-5 sm:w-6 sm:h-6', DesignTokens.moduleAccent.trials.text)} />
          </div>
          <div>
            <h1 className={combineClasses(DesignTokens.components.header.title, 'mb-0')}>Clinical Trials</h1>
          </div>
        </div>
        {/* Mobile Ask Button */}
        {onOpenMobileChat && (
          <button
            onClick={() => {
              // Store search results as context (if available) instead of individual trial
              if (searchResults && searchResults.length > 0) {
                // Store search results as context for ChatSidebar to use
                sessionStorage.setItem('currentSearchResultsContext', JSON.stringify(searchResults));
                // Clear individual trial context to use search results instead
                sessionStorage.removeItem('currentTrialContext');
              } else {
                // No search results - store instruction message for user
                sessionStorage.setItem('trialsNoResultsMessage', JSON.stringify({
                  type: 'ai',
                  text: "I'd be happy to help you with clinical trials! To get started, please search for clinical trials using the \"Search Clinical Trials\" button. Once you have search results, I can answer questions about them, help you understand eligibility criteria, compare different trials, or explain what the treatments involve."
                }));
                // Clear any existing context
                sessionStorage.removeItem('currentSearchResultsContext');
                sessionStorage.removeItem('currentTrialContext');
              }
              onOpenMobileChat();
            }}
            className="lg:hidden text-medical-neutral-600 hover:text-medical-neutral-900 min-h-[44px] min-w-[44px] px-2 touch-manipulation active:opacity-70 flex items-center justify-center transition-colors"
            title="Ask about trials"
          >
            <img src={IRIS_ICON_SRC} alt="" className="w-6 h-6" />
          </button>
        )}
      </div>
      <div className={Layouts.container}>

      {/* Tabs */}
      <div className={Layouts.tabsContainer}>
        <button
          onClick={() => setActiveTab('search')}
          className={combineClasses(
            DesignTokens.components.tabs.button.base,
            activeTab === 'search'
              ? DesignTokens.components.tabs.button.active
              : DesignTokens.components.tabs.button.inactive
          )}
        >
          <SearchIcon className={DesignTokens.icons.standard.size.mobile} />
          <span className="whitespace-nowrap">Search Trials</span>
        </button>
        <button
          onClick={() => setActiveTab('saved')}
          className={combineClasses(
            DesignTokens.components.tabs.button.base,
            activeTab === 'saved'
              ? DesignTokens.components.tabs.button.active
              : DesignTokens.components.tabs.button.inactive
          )}
        >
          <Bookmark className={DesignTokens.icons.standard.size.mobile} />
          <span className="whitespace-nowrap">Saved <span className="hidden sm:inline">Trials</span> ({savedTrials.length})</span>
        </button>
      </div>

      {/* Search Tab */}
      {activeTab === 'search' && (
        <div>
          {/* Search Info */}
          <div className={combineClasses(
            DesignTokens.components.card.withColoredBorder(DesignTokens.moduleAccent.trials.border),
            Layouts.section
          )}>
            <h3 className={combineClasses(
              DesignTokens.typography.h3.full,
              DesignTokens.typography.h3.weight,
              DesignTokens.moduleAccent.trials.text,
              'mb-2'
            )}>Search Criteria</h3>
            <div className={combineClasses(
              DesignTokens.typography.body.sm,
              DesignTokens.colors.neutral.text[700],
              'space-y-1'
            )}>
              <div>
                <p><strong>Diagnosis:</strong> {patientProfile?.diagnosis || 'Not set'}</p>
                {(patientProfile?.currentStatus?.subtype || patientProfile?.cancerType) && (
                  <p className={combineClasses('ml-4 sm:ml-6 mt-0.5', DesignTokens.colors.neutral.text[600], 'text-xs sm:text-sm')}>
                    <strong>Subtype:</strong> {patientProfile?.currentStatus?.subtype || patientProfile?.cancerType || ''}
                  </p>
                )}
              </div>
              <p><strong>Age:</strong> {patientProfile?.age || 'Not set'}</p>
              <p><strong>Gender:</strong> {patientProfile?.gender || 'Not set'}</p>
              {genomicProfile && (
                <p className="flex items-center gap-1 flex-wrap"><strong>Genomic Profile:</strong> <CheckCircle className={combineClasses('w-3.5 h-3.5 sm:w-4 sm:h-4', DesignTokens.colors.app.text[600], 'flex-shrink-0')} /> <span className="text-xs sm:text-sm">Available (will be used for matching)</span></p>
              )}
              {trialLocation && (
                <button
                  onClick={() => {
                    setShowEditLocation(true);
                  }}
                  className="flex items-center gap-1.5 sm:gap-2 text-left hover:opacity-80 transition-opacity cursor-pointer min-h-[44px] touch-manipulation active:opacity-70 w-full"
                >
                  <strong className="text-xs sm:text-sm">Search Location:</strong> {
                    trialLocation.includeAllLocations 
                      ? (
                        <span className={combineClasses('flex items-center gap-1', DesignTokens.colors.app.text[700], 'text-xs sm:text-sm')}>
                          <Globe className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" /> <span className="truncate">Global (All Countries)</span>
                        </span>
                      )
                      : (
                        <span className={combineClasses('flex items-center gap-1', DesignTokens.colors.app.text[700], 'text-xs sm:text-sm')}>
                          <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" /> <span className="truncate">{trialLocation.country}</span>
                        </span>
                      )
                  }
                  <span className={combineClasses('text-xs', DesignTokens.colors.app.text[500], 'ml-1 flex-shrink-0')}>(Click to change)</span>
                </button>
              )}
            </div>
          </div>

          {/* Search Button and Clear Button */}
          <div className={combineClasses('flex', DesignTokens.spacing.gap.responsive.sm, Layouts.section)}>
            <button
              onClick={handleSearchTrials}
              disabled={searching || !patientProfile?.diagnosis}
              className={combineClasses(DesignTokens.components.button.primary, DesignTokens.spacing.button.full, 'py-2.5 sm:py-3.5', DesignTokens.spacing.gap.sm, 'text-sm sm:text-base md:text-lg disabled:opacity-50 disabled:cursor-not-allowed')}
            >
              {searching ? (
                <span className="flex items-center gap-2"><SearchIcon className="w-4 h-4 sm:w-5 sm:h-5" /> <span className="hidden sm:inline">Searching sources...</span><span className="sm:hidden">Searching...</span></span>
              ) : (
                <span className="flex items-center gap-2"><SearchIcon className="w-4 h-4 sm:w-5 sm:h-5" /> <span className="hidden sm:inline">Search Clinical Trials</span><span className="sm:hidden">Search</span></span>
              )}
            </button>
            {searchResults.length > 0 && (
              <button
                onClick={handleClearSearch}
                className={combineClasses(DesignTokens.components.button.outline.neutral, DesignTokens.spacing.button.full, 'text-sm sm:text-base md:text-lg min-w-[44px]')}
                title="Clear search results"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            )}
          </div>
          {/* Search Results */}
          {searchResults.length > 0 && (
            <div>
              {searchSources && searchSources.length > 0 && (
                <div className="mb-3 flex items-center gap-2 flex-wrap">
                  <span className="text-xs sm:text-sm text-medical-neutral-600">Sources used:</span>
                  {searchSources.map((s, idx) => (
                    <span key={idx} className="text-xs px-2 py-0.5 bg-medical-neutral-100 text-medical-neutral-700 rounded-full">{s}</span>
                  ))}
                </div>
              )}
              {searchProgress && (
                <div className="mb-2 text-xs sm:text-sm text-medical-neutral-500">{searchProgress}</div>
              )}

              <h2 className={combineClasses(DesignTokens.typography.h2.full, DesignTokens.typography.h2.weight, 'text-medical-neutral-900 mb-3 sm:mb-4')}>
                Found {searchResults.length} Matching Trials
                {pagination && pagination.totalResults && (
                  <span className="text-xs sm:text-sm md:text-base font-normal text-medical-neutral-600 ml-1 sm:ml-2">
                    (of {pagination.totalResults} total)
                  </span>
                )}
              </h2>
              <div className="space-y-4">
                {sortedSearchResults.map(trial => renderTrialCard(trial, false))}
                
                {/* Load More Button */}
                {pagination && pagination.hasMore && (
                  <div className="flex justify-center pt-4 sm:pt-6">
                    <button
                      onClick={handleLoadMore}
                      disabled={loadingMore || searching}
                      className={combineClasses(DesignTokens.components.button.outline.primary, DesignTokens.spacing.button.full, 'py-2.5 sm:py-3', DesignTokens.spacing.gap.sm, 'text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed')}
                    >
                      {loadingMore ? (
                        <>
                          <svg className="animate-spin h-4 w-4 sm:h-5 sm:w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <span>Loading...</span>
                        </>
                      ) : (
                        <>
                          <span>Load More</span>
                          {pagination.totalResults && (
                            <span className="text-xs sm:text-sm opacity-75">
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
            <div className={combineClasses(DesignTokens.components.alert.error, DesignTokens.borders.radius.sm, DesignTokens.spacing.card.full, Layouts.section)}>
              <p className={combineClasses(DesignTokens.components.alert.text.error, 'font-medium flex items-center', DesignTokens.spacing.gap.sm, DesignTokens.typography.body.base)}>
                <AlertTriangle className={combineClasses(DesignTokens.icons.standard.size.full, 'flex-shrink-0')} /> {error}
              </p>
              {searchSources && searchSources.length > 0 && (
                <p className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.components.alert.text.error, 'mt-2')}>
                  Sources attempted: {searchSources.join(', ')}
                </p>
              )}
            </div>
          )}

          {!searching && searchResults.length === 0 && !error && (
            <div className={combineClasses(DesignTokens.components.emptyState.container, 'text-medical-neutral-500')}>
              <p className={combineClasses(DesignTokens.typography.body.lg)}>Click "Search Clinical Trials" to find matching trials</p>
              <p className={combineClasses(DesignTokens.typography.body.sm, 'mt-2')}>Results will appear here after searching</p>
            </div>
          )}
        </div>
      )}

      {/* Saved Tab */}
      {activeTab === 'saved' && (
        <div>
            {loading ? (
            <div className={combineClasses(DesignTokens.components.emptyState.container)}>
              <p className={combineClasses('text-medical-neutral-500', DesignTokens.typography.body.base)}>Loading saved trials...</p>
            </div>
          ) : error ? (
            <div className={combineClasses(DesignTokens.components.alert.warning, DesignTokens.borders.radius.sm, DesignTokens.spacing.card.mobile, Layouts.section)}>
              <p className={combineClasses(DesignTokens.components.alert.text.warning, 'font-medium flex items-center', DesignTokens.spacing.gap.sm, 'mb-2', DesignTokens.typography.body.base)}>
                <AlertTriangle className={combineClasses(DesignTokens.icons.standard.size.full, 'flex-shrink-0')} /> Index Required
              </p>
              <p className={combineClasses('text-xs sm:text-sm mb-2', DesignTokens.components.alert.text.warning)}>
                {error.includes('https://') 
                  ? 'A Firestore index is required. Click the link below to create it:'
                  : 'A Firestore index is required. Please create an index for matchedTrials (patientId + savedAt) in Firebase Console.'}
              </p>
              {error.includes('https://') && (
                <a 
                  href={error.match(/https:\/\/[^\s]+/)?.[0]} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-medical-primary-600 hover:underline text-xs sm:text-sm block mb-2 break-all"
                >
                  Click here to create the required index →
                </a>
              )}
              <p className={combineClasses('text-xs mt-2', DesignTokens.components.status.low.text)}>
                Once the index is created (usually takes 1-2 minutes), refresh this page.
              </p>
            </div>
          ) : savedTrials.length > 0 ? (
            <div>
              <h2 className={combineClasses(DesignTokens.typography.h2.full, DesignTokens.typography.h2.weight, 'text-medical-neutral-900 mb-3 sm:mb-4')}>
                Your Saved Trials ({savedTrials.length})
              </h2>
              {savedTrials.map(trial => renderTrialCard(trial, true))}
            </div>
          ) : (
            <div className="text-center text-medical-neutral-500 py-8 sm:py-12">
              <p className="text-sm sm:text-base md:text-lg">No saved trials yet</p>
              <p className="text-xs sm:text-sm mt-2">Search for trials and save the ones you're interested in</p>
            </div>
          )}
        </div>
      )}

      {/* Trial Detail Modal */}
      {selectedTrial && (
        <div className={DesignTokens.components.modal.backdrop}>
          <div className={combineClasses('bg-white w-full h-full sm:h-auto sm:max-w-3xl sm:rounded-xl sm:max-h-[85vh] overflow-hidden flex flex-col animate-slide-up', DesignTokens.shadows.lg, DesignTokens.borders.card)}>
            {/* Header */}
            <div className={combineClasses(DesignTokens.components.modal.header, DesignTokens.spacing.card.full)}>
              <h2 
                className="text-base sm:text-xl md:text-2xl font-bold text-medical-neutral-900 pr-2 sm:pr-4 line-clamp-2"
                title={selectedTrial.title || selectedTrial.titleJa || 'Trial Details'}
              >
                {selectedTrial.title || selectedTrial.titleJa || 'Trial Details'}
              </h2>
              <button
                onClick={() => setSelectedTrial(null)}
                className="p-2 hover:bg-medical-neutral-100 rounded-lg transition flex-shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation active:opacity-70"
                type="button"
              >
                <X className="w-5 h-5 text-medical-neutral-600" />
              </button>
            </div>

            {/* Content */}
            <div className={combineClasses(DesignTokens.components.modal.body, DesignTokens.spacing.card.full, 'space-y-4 sm:space-y-6')}>
              {selectedTrial.titleJa && selectedTrial.title !== selectedTrial.titleJa && (
                <div className={combineClasses(DesignTokens.colors.accent[50], 'border', DesignTokens.colors.accent.border[200], DesignTokens.borders.radius.sm, 'p-2.5 sm:p-3')}>
                  <p className={combineClasses('text-xs sm:text-sm', DesignTokens.colors.app.text[900], 'break-words')}>{selectedTrial.titleJa}</p>
                </div>
              )}

              {/* Summary - Hide for JRCT if no summary (they only have eligibility criteria) */}
              {(selectedTrial.source !== 'JRCT' || (selectedTrial.summary && selectedTrial.summary.trim().length > 0)) && (
                <div className={combineClasses(DesignTokens.components.card.container, DesignTokens.shadows.sm)}>
                  <h3 className="font-semibold text-medical-neutral-900 mb-2 sm:mb-3 flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base">
                    <SearchIcon className={combineClasses('w-4 h-4 sm:w-5 sm:h-5', DesignTokens.colors.app.text[600], 'flex-shrink-0')} />
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
                    <div className="text-medical-neutral-700 leading-relaxed prose prose-sm max-w-none">
                      <ReactMarkdown
                        components={{
                          p: ({node, ...props}) => <p className="mb-2 last:mb-0 whitespace-pre-line" {...props} />,
                          ul: ({node, ...props}) => <ul className="list-disc list-inside mb-2 space-y-1" {...props} />,
                          ol: ({node, ...props}) => <ol className="list-decimal list-outside mb-2 space-y-1 ml-5" {...props} />,
                          li: ({node, ...props}) => <li className="ml-2" {...props} />,
                          strong: ({node, ...props}) => <strong className="font-semibold" {...props} />,
                          em: ({node, ...props}) => <em className="italic" {...props} />,
                          code: ({node, ...props}) => <code className="bg-medical-neutral-100 px-1.5 py-0.5 rounded text-xs font-mono" {...props} />,
                          h1: ({node, ...props}) => <h1 className="text-lg font-bold mb-2 mt-3 first:mt-0" {...props} />,
                          h2: ({node, ...props}) => <h2 className="text-base font-bold mb-2 mt-3 first:mt-0" {...props} />,
                          h3: ({node, ...props}) => <h3 className="text-sm font-bold mb-1 mt-2 first:mt-0" {...props} />,
                          blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-medical-neutral-300 pl-3 italic my-2" {...props} />,
                          a: ({node, ...props}) => <a className="text-medical-primary-600 underline hover:text-medical-primary-800" {...props} />,
                        }}
                      >
                        {selectedTrial.summary || selectedTrial.summaryJa || 'No summary available. Please visit the trial page for more information.'}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              )}

              {/* Eligibility Criteria */}
              {(selectedTrial.eligibilityCriteria || selectedTrial.eligibility || selectedTrial.inclusionCriteria || selectedTrial.exclusionCriteria) && (
                <div className={combineClasses(DesignTokens.components.card.container, DesignTokens.shadows.sm)}>
                  <h3 className={combineClasses('font-semibold', DesignTokens.colors.app.text[900], 'mb-2 sm:mb-3 flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base')}>
                    <CheckCircle className={combineClasses('w-4 h-4 sm:w-5 sm:h-5', DesignTokens.colors.app.text[600], 'flex-shrink-0')} />
                    Eligibility Criteria
                  </h3>
                  <div className={DesignTokens.components.card.nestedSubtle}>
                    <div className="text-sm text-medical-neutral-700 leading-relaxed prose prose-sm max-w-none whitespace-pre-line">
                      <ReactMarkdown
                        components={{
                          p: ({node, ...props}) => <p className="mb-0.5 last:mb-0 whitespace-pre-line" {...props} />,
                          ul: ({node, ...props}) => <ul className="list-disc list-inside mb-0.5 space-y-0" {...props} />,
                          ol: ({node, ...props}) => <ol className="list-decimal list-outside mb-0.5 space-y-0 ml-5" {...props} />,
                          li: ({node, ...props}) => <li className="ml-2 whitespace-normal leading-relaxed" {...props} />,
                          strong: ({node, ...props}) => <strong className="font-semibold" {...props} />,
                          em: ({node, ...props}) => <em className="italic" {...props} />,
                          code: ({node, ...props}) => <code className="bg-medical-neutral-100 px-1.5 py-0.5 rounded text-xs font-mono" {...props} />,
                          h1: ({node, ...props}) => <h1 className="text-lg font-bold mb-0.5 mt-1.5 first:mt-0" {...props} />,
                          h2: ({node, ...props}) => <h2 className="text-base font-bold mb-0.5 mt-1.5 first:mt-0" {...props} />,
                          h3: ({node, ...props}) => <h3 className="text-sm font-bold mb-0 mt-0 first:mt-0 whitespace-normal" {...props} />,
                          blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-medical-neutral-300 pl-3 italic my-0.5" {...props} />,
                          a: ({node, ...props}) => <a className="text-medical-primary-600 underline hover:text-medical-primary-800" {...props} />,
                        }}
                      >
                        {selectedTrial.eligibilityCriteria || 
                         (typeof selectedTrial.eligibility === 'string' 
                           ? selectedTrial.eligibility
                           : (selectedTrial.eligibility?.criteria || selectedTrial.eligibility?.criteriaJa || '')) ||
                         (selectedTrial.inclusionCriteria && selectedTrial.exclusionCriteria
                           ? `**Inclusion Criteria:**\n${selectedTrial.inclusionCriteria}\n\n**Exclusion Criteria:**\n${selectedTrial.exclusionCriteria}`
                           : selectedTrial.inclusionCriteria || selectedTrial.exclusionCriteria || 'Not specified')}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Additional Trial Information */}
              {(selectedTrial.phase || selectedTrial.enrollment || selectedTrial.studyType || selectedTrial.intervention || selectedTrial.contactName || selectedTrial.contactAffiliation || selectedTrial.contactAddress || selectedTrial.contactPhone || selectedTrial.contactEmail) && (
                <div className={combineClasses(DesignTokens.components.card.container, DesignTokens.shadows.sm)}>
                  <h3 className={combineClasses('font-semibold', DesignTokens.colors.app.text[900], 'mb-2 sm:mb-3 flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base')}>
                    <FlaskConical className={combineClasses('w-4 h-4 sm:w-5 sm:h-5', DesignTokens.colors.app.text[600], 'flex-shrink-0')} />
                    Additional Information
                  </h3>
                  <div className={combineClasses('grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4', DesignTokens.typography.body.sm)}>
                    {selectedTrial.phase && (
                      <div>
                        <span className={combineClasses(DesignTokens.typography.h3.weight, DesignTokens.colors.neutral.text[700])}>Phase:</span>
                        <span className={combineClasses('ml-2', DesignTokens.colors.neutral.text[600])}>{selectedTrial.phase}</span>
                      </div>
                    )}
                    {selectedTrial.enrollment && (
                      <div>
                        <span className={combineClasses(DesignTokens.typography.h3.weight, DesignTokens.colors.neutral.text[700])}>Enrollment:</span>
                        <span className={combineClasses('ml-2', DesignTokens.colors.neutral.text[600])}>{selectedTrial.enrollment}</span>
                      </div>
                    )}
                    {selectedTrial.studyType && (
                      <div>
                        <span className={combineClasses(DesignTokens.typography.h3.weight, DesignTokens.colors.neutral.text[700])}>Study Type:</span>
                        <span className={combineClasses('ml-2', DesignTokens.colors.neutral.text[600])}>{selectedTrial.studyType}</span>
                      </div>
                    )}
                    {selectedTrial.intervention && (
                      <div className="sm:col-span-2">
                        <span className={combineClasses(DesignTokens.typography.h3.weight, DesignTokens.colors.neutral.text[700])}>Intervention:</span>
                        <span className={combineClasses('ml-2', DesignTokens.colors.neutral.text[600])}>{selectedTrial.intervention}</span>
                      </div>
                    )}
                    {(selectedTrial.contactName || selectedTrial.contactAffiliation || selectedTrial.contactAddress || selectedTrial.contactPhone || selectedTrial.contactEmail) && (
                      <div className="sm:col-span-2 border-t pt-3 mt-1">
                        <div className={combineClasses('font-semibold mb-2', DesignTokens.colors.neutral.text[700])}>Contact (Public Queries):</div>
                        {selectedTrial.contactAffiliation && (
                          <div className="mb-1">
                            <span className={DesignTokens.colors.neutral.text[600]}>Name: </span>
                            <span className={DesignTokens.colors.neutral.text[700]}>{selectedTrial.contactAffiliation}</span>
                          </div>
                        )}
                        {!selectedTrial.contactAffiliation && selectedTrial.contactName && (
                          <div className="mb-1">
                            <span className={DesignTokens.colors.neutral.text[600]}>Name: </span>
                            <span className={DesignTokens.colors.neutral.text[700]}>{selectedTrial.contactName}</span>
                          </div>
                        )}
                        {selectedTrial.contactAddress && (
                          <div className="mb-1">
                            <span className={DesignTokens.colors.neutral.text[600]}>Address: </span>
                            <span className={DesignTokens.colors.neutral.text[700]}>{selectedTrial.contactAddress}</span>
                          </div>
                        )}
                        {selectedTrial.contactPhone && (
                          <div className="mb-1">
                            <span className={DesignTokens.colors.neutral.text[600]}>Phone: </span>
                            <span className={DesignTokens.colors.neutral.text[700]}>{selectedTrial.contactPhone}</span>
                          </div>
                        )}
                        {selectedTrial.contactEmail && (
                          <div>
                            <span className={DesignTokens.colors.neutral.text[600]}>Email: </span>
                            <a href={`mailto:${selectedTrial.contactEmail}`} className={combineClasses('text-medical-primary-600 hover:text-medical-primary-800 underline', DesignTokens.transitions.all)}>
                              {selectedTrial.contactEmail}
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Study Locations */}
              {((selectedTrial.countriesOfRecruitment && selectedTrial.countriesOfRecruitment.length > 0) || (selectedTrial.locations && selectedTrial.locations.length > 0)) && (() => {
                // Helper function to extract country from location
                const getLocationCountry = (location) => {
                  if (typeof location === 'string') {
                    const parts = location.split(',').map(s => s.trim());
                    return parts[parts.length - 1] || '';
                  } else if (location && typeof location === 'object') {
                    return location.country || '';
                  }
                  return '';
                };

                // If countriesOfRecruitment exists, use that instead of locations for display
                // Sort to show Japan first, then others
                const displayCountries = selectedTrial.countriesOfRecruitment && selectedTrial.countriesOfRecruitment.length > 0
                  ? [...selectedTrial.countriesOfRecruitment].sort((a, b) => {
                      const aIsJapan = a.toLowerCase().includes('japan');
                      const bIsJapan = b.toLowerCase().includes('japan');
                      if (aIsJapan && !bIsJapan) return -1;
                      if (!aIsJapan && bIsJapan) return 1;
                      return 0; // Keep original order for non-Japan countries
                    })
                  : null;
                
                // Sort locations: selected country first, then others (only if not using countriesOfRecruitment)
                const selectedCountry = trialLocation?.country || '';
                const sortedLocations = displayCountries ? [] : [...(selectedTrial.locations || [])].sort((a, b) => {
                  const countryA = getLocationCountry(a);
                  const countryB = getLocationCountry(b);
                  const matchesA = selectedCountry && countryA.toLowerCase().includes(selectedCountry.toLowerCase());
                  const matchesB = selectedCountry && countryB.toLowerCase().includes(selectedCountry.toLowerCase());
                  
                  if (matchesA && !matchesB) return -1;
                  if (!matchesA && matchesB) return 1;
                  return 0;
                });

                return (
                  <div className={combineClasses(DesignTokens.components.card.container, DesignTokens.shadows.sm, 'p-4')}>
                    <h3 className="font-semibold text-medical-neutral-900 mb-3 flex items-center gap-2">
                      <MapPin className={combineClasses('w-5 h-5', DesignTokens.colors.app.text[600])} />
                      Study Locations
                    </h3>
                    <ul className="space-y-3">
                      {displayCountries ? (
                        // Display countries of recruitment as a list
                        displayCountries.map((country, idx) => {
                          const isSelectedLocation = selectedCountry && 
                            country.toLowerCase().includes(selectedCountry.toLowerCase());
                          
                          return (
                            <li 
                              key={idx} 
                              className={combineClasses('rounded-lg p-3 border', isSelectedLocation
                                  ? combineClasses(DesignTokens.colors.accent[50], DesignTokens.colors.accent.border[300], 'border-2')
                                  : combineClasses(DesignTokens.colors.app[50], DesignTokens.colors.app.border[200])
                              )}
                            >
                              {isSelectedLocation && (
                                <div className="flex items-center gap-2 mb-2">
                                  <CheckCircle className={combineClasses('w-4 h-4', DesignTokens.colors.accent.text[600])} />
                                  <span className={combineClasses('text-xs font-semibold', DesignTokens.colors.accent.text[700], 'uppercase tracking-wide')}>
                                    Your Selected Location
                                  </span>
                                </div>
                              )}
                              <div className={combineClasses('text-sm font-semibold', DesignTokens.colors.app.text[900])}>
                                {country}
                              </div>
                            </li>
                          );
                        })
                      ) : (
                        // Fall back to displaying locations
                        sortedLocations.map((location, idx) => {
                        // Handle both string and object location formats
                        let locationText = '';
                        let facilityName = '';
                        let locationCountry = '';
                        
                        if (typeof location === 'string') {
                          locationText = location;
                          const parts = location.split(',').map(s => s.trim());
                          locationCountry = parts[parts.length - 1] || '';
                        } else if (location && typeof location === 'object') {
                          // Extract facility name if available
                          facilityName = location.facility || '';
                          locationCountry = location.country || '';
                          
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
                        
                        // Check if this location matches the selected country
                        const isSelectedLocation = selectedCountry && 
                          locationCountry.toLowerCase().includes(selectedCountry.toLowerCase());
                        
                        return (
                          <li 
                            key={idx} 
                            className={combineClasses('rounded-lg p-3 border', isSelectedLocation
                                ? combineClasses(DesignTokens.colors.accent[50], DesignTokens.colors.accent.border[300], 'border-2')
                                : combineClasses(DesignTokens.colors.app[50], DesignTokens.colors.app.border[200])
                            )}
                          >
                            {isSelectedLocation && (
                              <div className="flex items-center gap-2 mb-2">
                                <CheckCircle className={combineClasses('w-4 h-4', DesignTokens.colors.accent.text[600])} />
                                <span className={combineClasses('text-xs font-semibold', DesignTokens.colors.accent.text[700], 'uppercase tracking-wide')}>
                                  Your Selected Location
                                </span>
                              </div>
                            )}
                            {facilityName && (
                              <div className={combineClasses('font-semibold mb-1', DesignTokens.colors.app.text[900])}>
                                {facilityName}
                              </div>
                            )}
                            <div className={combineClasses('text-sm', DesignTokens.colors.app.text[700])}>
                              {locationText}
                            </div>
                          </li>
                        );
                      })
                      )}
                    </ul>
                  </div>
                );
              })()}
            </div>

            {/* Footer Actions */}
            <div className={combineClasses(DesignTokens.components.modal.footer, DesignTokens.spacing.card.full, 'flex flex-col sm:flex-row', DesignTokens.spacing.gap.responsive.sm)}>
              {onTrialSelected && (
                <button
                  onClick={() => {
                    // Store individual trial context in sessionStorage
                    if (selectedTrial) {
                      sessionStorage.setItem('currentTrialContext', JSON.stringify(selectedTrial));
                    }
                    // Clear search results context - individual trial takes precedence
                    sessionStorage.removeItem('currentSearchResultsContext');
                    setSelectedTrial(null);
                    
                    if (onOpenMobileChat) {
                      // On mobile, just open overlay - don't navigate
                      onOpenMobileChat();
                    } else {
                      // On desktop, switch to chat tab
                      if (onTrialSelected) {
                        onTrialSelected(selectedTrial);
                      }
                    }
                  }}
                  className={combineClasses('border-2 border-medical-secondary-500 text-medical-secondary-600 rounded-lg hover:bg-medical-secondary-50 transition font-medium min-h-[44px] touch-manipulation active:opacity-70 flex items-center justify-center gap-2 lg:hidden', DesignTokens.spacing.button.desktop, 'flex-1 font-semibold gap-1.5 sm:gap-2 text-sm sm:text-base', DesignTokens.transitions.all)}
                >
                  <img src={IRIS_ICON_SRC} alt="" className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">Ask About This Trial</span>
                  <span className="sm:hidden">Ask About</span>
                </button>
              )}
              <a
                href={selectedTrial.url || selectedTrial.urlJa || (selectedTrial.source === 'JRCT' 
                  ? `https://jrct.mhlw.go.jp/latest-detail/${selectedTrial.id}`
                  : selectedTrial.id ? `https://clinicaltrials.gov/study/${selectedTrial.id}` : '#')}
                target="_blank"
                rel="noopener noreferrer"
                className={combineClasses(DesignTokens.components.button.outline.neutral, DesignTokens.spacing.button.desktop, 'flex-1 text-center font-semibold gap-1.5 sm:gap-2 text-sm sm:text-base', DesignTokens.transitions.all)}
              >
                <Globe className="w-4 h-4 sm:w-5 sm:h-5" />
                {selectedTrial.source === 'JRCT' ? (
                  <>
                    <span className="hidden sm:inline">View on JRCT</span>
                    <span className="sm:hidden">View JRCT</span>
                  </>
                ) : (
                  <>
                    <span className="hidden sm:inline">View on ClinicalTrials.gov</span>
                    <span className="sm:hidden">View on CT.gov</span>
                  </>
                )}
              </a>
            </div>
          </div>
        </div>
      )}

      <EditLocationModal
        show={showEditLocation}
        onClose={() => setShowEditLocation(false)}
        user={auth.currentUser}
        trialLocation={trialLocation}
        setTrialLocation={setTrialLocation}
        onSave={(savedLocation) => {
          setTrialLocation(savedLocation);
          loadPatientData();
        }}
      />
      </div>
    </>
  );
};

export default ClinicalTrials;


ClinicalTrials.propTypes = {
  onTrialSelected: PropTypes.func,
  resetKey: PropTypes.any,
  onOpenMobileChat: PropTypes.func
};
