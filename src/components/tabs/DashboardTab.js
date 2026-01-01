import React, { useState, useEffect } from 'react';
import { Zap, Activity, TrendingUp, Upload, AlertCircle, ClipboardList, Info, Dna, Bookmark, Star, ChevronRight, Search, MessageSquare, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePatientContext } from '../../contexts/PatientContext';
import { useHealthContext } from '../../contexts/HealthContext';
import { getSavedTrials } from '../../services/clinicalTrials/clinicalTrialsService';
import { parseMutation, getTodayLocalDate } from '../../utils/helpers';
import { formatLabel } from '../../utils/formatters';
import { normalizeLabName, getLabDisplayName, labValueDescriptions, normalizeVitalName, getVitalDisplayName, vitalDescriptions } from '../../utils/normalizationUtils';
import AddSymptomModal from '../modals/AddSymptomModal';
import DocumentUploadOnboarding from '../DocumentUploadOnboarding';

export default function DashboardTab({ onTabChange }) {
  const { user } = useAuth();
  const { hasUploadedDocument } = usePatientContext();
  const { labsData, vitalsData, hasRealLabData, hasRealVitalData, genomicProfile, reloadHealthData } = useHealthContext();

  // Tab-specific state
  const [savedTrials, setSavedTrials] = useState([]);
  const [loadingSavedTrials, setLoadingSavedTrials] = useState(false);
  const [labTooltip, setLabTooltip] = useState(null);
  const [showAddSymptomModal, setShowAddSymptomModal] = useState(false);
  const [showDocumentOnboarding, setShowDocumentOnboarding] = useState(false);
  const [documentOnboardingMethod, setDocumentOnboardingMethod] = useState('picker');
  const [symptomForm, setSymptomForm] = useState({
    name: '',
    severity: '',
    date: getTodayLocalDate(),
    time: new Date().toTimeString().slice(0, 5),
    notes: '',
    customSymptomName: '',
    tags: []
  });

  // Load saved trials when component mounts
  useEffect(() => {
    const loadSavedTrials = async () => {
      if (user?.uid) {
        setLoadingSavedTrials(true);
        try {
          const trials = await getSavedTrials(user.uid);
          // Sort by match percentage (highest first) and limit to top 5
          const sortedTrials = trials
            .filter(trial => trial.matchResult?.matchPercentage)
            .sort((a, b) => (b.matchResult?.matchPercentage || 0) - (a.matchResult?.matchPercentage || 0))
            .slice(0, 5);
          setSavedTrials(sortedTrials);
        } catch (error) {
          console.error('Error loading saved trials:', error);
          setSavedTrials([]);
        } finally {
          setLoadingSavedTrials(false);
        }
      }
    };
    loadSavedTrials();
  }, [user]);

  // Helper function to open document onboarding
  const openDocumentOnboarding = (docType = null, method = 'picker') => {
    setDocumentOnboardingMethod(method || 'picker');
    setShowDocumentOnboarding(true);
  };

  // Helper function to parse date strings like "Oct 15"
  const parseDateString = (dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') return new Date();
    // Try to parse "Oct 15" format - assume current year
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const parts = dateStr.trim().split(' ');
    if (parts.length === 2) {
      const monthIndex = months.indexOf(parts[0]);
      const day = parseInt(parts[1]);
      if (monthIndex !== -1 && !isNaN(day)) {
        const year = new Date().getFullYear();
        return new Date(year, monthIndex, day);
      }
    }
    return new Date(dateStr);
  };

  // Calculate CA-125 trend dynamically
  const ca125Data = labsData.ca125;
  let ca125Alert = null;

  if (ca125Data && ca125Data.data && ca125Data.data.length >= 2) {
    const dataPoints = ca125Data.data
      .map(d => ({
        date: d.timestamp ? new Date(d.timestamp) : (typeof d.date === 'string' ? parseDateString(d.date) : new Date(d.date)),
        value: typeof d.value === 'number' ? d.value : parseFloat(d.value)
      }))
      .filter(d => !isNaN(d.value) && d.date instanceof Date && !isNaN(d.date.getTime()))
      .sort((a, b) => a.date - b.date);

    if (dataPoints.length >= 2) {
      const latest = dataPoints[dataPoints.length - 1];
      const previous = dataPoints[dataPoints.length - 2];
      const change = latest.value - previous.value;
      const percentChange = ((change / previous.value) * 100).toFixed(1);
      const daysDiff = Math.round((latest.date - previous.date) / (1000 * 60 * 60 * 24));

      // Show alert if significant increase (>10%) or decrease (>15%)
      if (change > 0 && percentChange > 10) {
        ca125Alert = {
          type: 'up',
          message: `Rose from ${previous.value} → ${latest.value}${ca125Data.unit ? ` ${ca125Data.unit}` : ''} in ${daysDiff} day${daysDiff !== 1 ? 's' : ''} (${percentChange}% increase). Consider discussing with oncologist.`
        };
      } else if (change < 0 && Math.abs(percentChange) > 15) {
        ca125Alert = {
          type: 'down',
          message: `Decreased from ${previous.value} → ${latest.value}${ca125Data.unit ? ` ${ca125Data.unit}` : ''} in ${daysDiff} day${daysDiff !== 1 ? 's' : ''} (${Math.abs(percentChange)}% decrease).`
        };
      }
    }
  }

  return (
    <>
      {/* Quick Action Buttons */}
      <div className="bg-white border-b border-medical-neutral-200 px-4 sm:px-6 py-4 sm:py-5">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-base sm:text-lg font-semibold text-medical-neutral-900 mb-3 sm:mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-medical-primary-600" />
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <button
              onClick={() => {
                setShowAddSymptomModal(true);
              }}
              className="group relative flex flex-row items-center justify-center gap-2 sm:gap-3 px-3 sm:px-5 py-3 sm:py-3.5 flex-1 border-2 border-medical-primary-500 hover:bg-medical-primary-50 rounded-xl transition-all duration-200"
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 bg-medical-primary-50 rounded-lg flex items-center justify-center transition-colors duration-200 flex-shrink-0">
                <Activity className="w-4 h-4 sm:w-4 sm:h-4 text-medical-primary-600" />
              </div>
              <div className="flex flex-col items-start min-w-0">
                <span className="text-xs sm:text-sm font-semibold text-medical-primary-600 whitespace-nowrap">Log Symptom</span>
                <span className="text-xs text-medical-primary-500/80 hidden sm:block">Track how you're feeling</span>
              </div>
            </button>

            <button
              onClick={() => {
                onTabChange('health');
                // Note: Health tab will need to handle showing add lab modal
                // We'll use a small delay to ensure tab switch happens first
                setTimeout(() => {
                  // Store flag in sessionStorage for HealthTab to check
                  sessionStorage.setItem('showAddLab', 'true');
                }, 300);
              }}
              className="group relative flex flex-row items-center justify-center gap-2 sm:gap-3 px-3 sm:px-5 py-3 sm:py-3.5 flex-1 border-2 border-medical-accent-500 hover:bg-medical-accent-50 rounded-xl transition-all duration-200"
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 bg-medical-accent-50 rounded-lg flex items-center justify-center transition-colors duration-200 flex-shrink-0">
                <TrendingUp className="w-4 h-4 sm:w-4 sm:h-4 text-medical-accent-600" />
              </div>
              <div className="flex flex-col items-start min-w-0">
                <span className="text-xs sm:text-sm font-semibold text-medical-accent-600 whitespace-nowrap">Add Lab Value</span>
                <span className="text-xs text-medical-accent-500/80 hidden sm:block">Record test results</span>
              </div>
            </button>

            <button
              onClick={() => {
                openDocumentOnboarding('general');
              }}
              className="group relative flex flex-row items-center justify-center gap-2 sm:gap-3 px-3 sm:px-5 py-3 sm:py-3.5 flex-1 border-2 border-medical-secondary-500 hover:bg-medical-secondary-50 rounded-xl transition-all duration-200"
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 bg-medical-secondary-50 rounded-lg flex items-center justify-center transition-colors duration-200 flex-shrink-0">
                <Upload className="w-4 h-4 sm:w-4 sm:h-4 text-medical-secondary-600" />
              </div>
              <div className="flex flex-col items-start min-w-0">
                <span className="text-xs sm:text-sm font-semibold text-medical-secondary-600 whitespace-nowrap">Smart Scan</span>
                <span className="text-xs text-medical-secondary-500/80 hidden sm:block">Upload & extract data</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Dynamic CA-125 Alert */}
        {ca125Alert && (
          <div className={`bg-white rounded-lg sm:rounded-xl border-2 p-4 sm:p-5 shadow-sm ${
            ca125Alert.type === 'up' 
              ? 'border-amber-300 bg-amber-50' 
              : 'border-medical-accent-300 bg-medical-accent-50'
          }`}>
            <div className="flex items-start gap-3">
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                ca125Alert.type === 'up' 
                  ? 'bg-amber-100' 
                  : 'bg-medical-accent-100'
              }`}>
                <AlertCircle className={`w-5 h-5 ${
                  ca125Alert.type === 'up' 
                    ? 'text-amber-600' 
                    : 'text-medical-accent-600'
                }`} />
              </div>
              <div className="flex-1">
                <h3 className={`text-base font-semibold mb-1 ${
                  ca125Alert.type === 'up' 
                    ? 'text-amber-900' 
                    : 'text-medical-accent-900'
                }`}>
                  CA-125 {ca125Alert.type === 'up' ? 'Trending Up' : 'Trending Down'}
                </h3>
                <p className={`text-sm ${
                  ca125Alert.type === 'up' 
                    ? 'text-amber-700' 
                    : 'text-medical-accent-700'
                }`}>
                  {ca125Alert.message}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Most Important Labs & Vitals - Single Row */}
        {hasRealLabData || hasRealVitalData ? (() => {
          // Get most important labs (prioritize by relevance score, then by critical list)
          const importantLabKeys = Object.keys(labsData)
            .filter(key => {
              const lab = labsData[key];
              return lab && ((lab.data && lab.data.length > 0) || lab.current) && lab.relevanceScore >= 1;
            })
            .sort((a, b) => {
              const labA = labsData[a];
              const labB = labsData[b];
              // Sort by relevance score (higher first), then by critical list order
              if (labB.relevanceScore !== labA.relevanceScore) {
                return labB.relevanceScore - labA.relevanceScore;
              }
              const criticalOrder = ['ca125', 'cea', 'wbc', 'hemoglobin', 'platelets', 'creatinine', 'alt', 'ast', 'albumin', 'ldh'];
              const idxA = criticalOrder.indexOf(a.toLowerCase());
              const idxB = criticalOrder.indexOf(b.toLowerCase());
              if (idxA !== -1 && idxB !== -1) return idxA - idxB;
              if (idxA !== -1) return -1;
              if (idxB !== -1) return 1;
              return 0;
            })
            .slice(0, 5); // Top 5 labs

          // Get most important vitals (weight, blood pressure, temperature, heart rate)
          const importantVitalKeys = Object.keys(vitalsData)
            .filter(key => {
              const vital = vitalsData[key];
              return vital && ((vital.data && vital.data.length > 0) || vital.current);
            })
            .filter(key => ['weight', 'bp', 'bloodpressure', 'temperature', 'temp', 'heartrate', 'hr', 'pulse'].includes(key.toLowerCase()))
            .slice(0, 3); // Top 3 vitals

          const allImportantItems = [
            ...importantLabKeys.map(key => ({ type: 'lab', key, data: labsData[key] })),
            ...importantVitalKeys.map(key => ({ type: 'vital', key, data: vitalsData[key] }))
          ].slice(0, 5); // Max 5 items in the row

          // If no important items found, try to show any available data
          if (allImportantItems.length === 0) {
            // Fallback: show any labs or vitals with data
            const anyLabKeys = Object.keys(labsData)
              .filter(key => {
                const lab = labsData[key];
                return lab && ((lab.data && lab.data.length > 0) || lab.current);
              })
              .slice(0, 3);
            
            const anyVitalKeys = Object.keys(vitalsData)
              .filter(key => {
                const vital = vitalsData[key];
                return vital && ((vital.data && vital.data.length > 0) || vital.current);
              })
              .slice(0, 2);
            
            const fallbackItems = [
              ...anyLabKeys.map(key => ({ type: 'lab', key, data: labsData[key] })),
              ...anyVitalKeys.map(key => ({ type: 'vital', key, data: vitalsData[key] }))
            ].slice(0, 5);
            
            if (fallbackItems.length === 0) return null;
            
            // Use fallback items
            return (
              <div className="bg-white rounded-lg sm:rounded-xl p-4 sm:p-5 border-2 border-medical-primary-200 shadow-sm">
                <h3 className="text-base sm:text-lg font-semibold text-medical-neutral-900 mb-4 flex items-center gap-2">
                  <div className="bg-medical-primary-50 p-2 rounded-lg">
                    <ClipboardList className="w-5 h-5 text-medical-primary-600" />
                  </div>
                  Key Metrics
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                  {fallbackItems.map((item) => {
                    const data = item.data;
                    let latestValue = (data.data && data.data.length > 0)
                      ? data.data[data.data.length - 1]?.value
                      : data.current;
                    const status = data.status || 'normal';
                    
                    // Get description using normalized system (for labs and vitals)
                    let description = '';
                    let displayName = data.name;
                    if (item.type === 'lab') {
                      const canonicalKey = normalizeLabName(data.name || item.key);
                      if (canonicalKey && labValueDescriptions[canonicalKey]) {
                        description = labValueDescriptions[canonicalKey];
                        displayName = getLabDisplayName(data.name || item.key);
                      }
                    } else if (item.type === 'vital') {
                      const canonicalKey = normalizeVitalName(data.name || item.key);
                      if (canonicalKey && vitalDescriptions[canonicalKey]) {
                        description = vitalDescriptions[canonicalKey];
                        displayName = getVitalDisplayName(data.name || item.key);
                      }
                    }
                    
                    return (
                      <div key={`${item.type}-${item.key}`} className="text-center p-4 bg-white rounded-lg border border-medical-neutral-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-center gap-1.5 mb-2">
                          <span className="text-xs font-medium text-medical-neutral-700">{displayName}</span>
                          <div className="flex items-center gap-1">
                            <Activity className={`w-3.5 h-3.5 ${status === 'warning' ? 'text-orange-500' : status === 'danger' ? 'text-red-500' : 'text-medical-accent-500'}`} />
                            {description && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setLabTooltip({
                                    labName: displayName,
                                    description: description
                                  });
                                }}
                                className="text-medical-primary-500 hover:text-medical-primary-700 transition-colors"
                                title="Learn more about this value"
                              >
                                <Info className="w-3.5 h-3.5" />
                              </button>
                            )}
                        </div>
                        </div>
                        <p className="text-lg sm:text-xl font-bold text-medical-neutral-900">{latestValue}{data.unit ? ` ${data.unit}` : ''}</p>
                        {status !== 'normal' && (
                          <p className={`text-xs mt-1 font-medium ${status === 'warning' ? 'text-orange-600' : 'text-red-600'}`}>
                            {status === 'warning' ? 'Above normal' : 'High'}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          }

          return (
            <div className="bg-white rounded-lg sm:rounded-xl p-4 sm:p-5 border-2 border-medical-primary-200 shadow-sm">
              <h3 className="text-base sm:text-lg font-semibold text-medical-neutral-900 mb-4 flex items-center gap-2">
                <div className="bg-medical-primary-50 p-2 rounded-lg">
                  <ClipboardList className="w-5 h-5 text-medical-primary-600" />
                </div>
                Key Metrics
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                {allImportantItems.map((item) => {
                  const data = item.data;
                  // Get latest value - labs and vitals both have data array or current
                  let latestValue;
                  if (item.type === 'lab') {
                    latestValue = (data.data && data.data.length > 0)
                      ? data.data[data.data.length - 1]?.value
                      : data.current;
                  } else {
                    // Vitals structure
                    latestValue = (data.data && data.data.length > 0)
                      ? data.data[data.data.length - 1]?.value
                      : data.current;
                  }
                  const status = data.status || 'normal';
                  
                  // Get description using normalized system (for labs and vitals)
                  let description = '';
                  let displayName = data.name;
                  if (item.type === 'lab') {
                    const canonicalKey = normalizeLabName(data.name || item.key);
                    if (canonicalKey && labValueDescriptions[canonicalKey]) {
                      description = labValueDescriptions[canonicalKey];
                      displayName = getLabDisplayName(data.name || item.key);
                    }
                  } else if (item.type === 'vital') {
                    const canonicalKey = normalizeVitalName(data.name || item.key);
                    if (canonicalKey && vitalDescriptions[canonicalKey]) {
                      description = vitalDescriptions[canonicalKey];
                      displayName = getVitalDisplayName(data.name || item.key);
                    }
                  }
                  
                  return (
                    <div key={`${item.type}-${item.key}`} className="text-center p-4 bg-white rounded-lg border border-medical-neutral-200 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-center gap-1.5 mb-2">
                        <span className="text-xs font-medium text-medical-neutral-700">{displayName}</span>
                        <div className="flex items-center gap-1">
                          <Activity className={`w-3.5 h-3.5 ${status === 'warning' ? 'text-orange-500' : status === 'danger' ? 'text-red-500' : 'text-medical-accent-500'}`} />
                          {description && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setLabTooltip({
                                  labName: displayName,
                                  description: description
                                });
                              }}
                              className="text-medical-primary-500 hover:text-medical-primary-700 transition-colors"
                              title="Learn more about this value"
                            >
                              <Info className="w-3.5 h-3.5" />
                            </button>
                          )}
                      </div>
                      </div>
                      <p className="text-lg sm:text-xl font-bold text-medical-neutral-900">{latestValue}{data.unit ? ` ${data.unit}` : ''}</p>
                      {status !== 'normal' && (
                        <p className={`text-xs mt-1 font-medium ${status === 'warning' ? 'text-orange-600' : 'text-red-600'}`}>
                          {status === 'warning' ? 'Above normal' : 'High'}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })() : (
          <div className="bg-white rounded-lg sm:rounded-xl p-6 sm:p-8 text-center border-2 border-medical-primary-200 shadow-sm">
            <div className="w-16 h-16 bg-medical-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ClipboardList className="w-8 h-8 text-medical-primary-600" />
            </div>
            <h3 className="text-lg font-semibold text-medical-neutral-900 mb-2">No health data tracked yet</h3>
            <p className="text-sm text-medical-neutral-600 mb-6">Start by uploading lab results or chatting with the AI assistant</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => onTabChange('chat')}
                className="px-6 py-3 bg-white border-2 border-medical-primary-500 text-medical-primary-600 rounded-lg hover:bg-medical-primary-50 transition-all duration-200 text-sm font-semibold shadow-sm hover:shadow-md flex items-center justify-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                Chat with AI
              </button>
              <button
                onClick={() => {
                  if (!hasUploadedDocument) {
                    openDocumentOnboarding('labs');
                  } else {
                    onTabChange('files');
                  }
                }}
                className="px-6 py-3 bg-medical-primary-500 text-white rounded-lg hover:bg-medical-primary-600 transition-all duration-200 text-sm font-semibold shadow-sm hover:shadow-md flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Upload Labs
              </button>
            </div>
          </div>
        )}

        {/* Two Column Layout on larger screens */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Genomic Profile Card */}
          <div className="w-full bg-white rounded-lg sm:rounded-xl p-4 sm:p-5 border-2 border-purple-200 shadow-sm lg:col-span-2">
            {genomicProfile && genomicProfile.mutations && genomicProfile.mutations.length > 0 && (
              <h3 className="text-base sm:text-lg font-semibold text-medical-neutral-900 mb-4 flex items-center gap-2">
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-2 rounded-lg">
                  <Dna className="w-5 h-5 text-purple-600" />
                </div>
                Genomic Profile
              </h3>
            )}
            {genomicProfile && genomicProfile.mutations && genomicProfile.mutations.length > 0 ? (
              <>
                <div className="flex flex-wrap gap-2 mb-4">
                  {genomicProfile.mutations.slice(0, 5).map((mutation, idx) => {
                    const { dna, protein, kind } = parseMutation(mutation);
                    return (
                      <span key={idx} className="px-3 py-1.5 bg-medical-secondary-100 text-medical-secondary-800 rounded-lg text-xs font-medium">
                        <span className="font-semibold mr-1">{mutation.gene}</span>
                        <span>{formatLabel(dna || protein || kind || mutation.type)}</span>
                      </span>
                    );
                  })}
                  {genomicProfile.tmb && (
                    <span className="px-3 py-1.5 bg-medical-primary-100 text-medical-primary-800 rounded-lg text-xs font-medium">
                      TMB: {genomicProfile.tmb}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => onTabChange('profile')}
                  className="text-medical-secondary-600 text-sm font-medium hover:text-medical-secondary-700 transition-colors"
                >
                  View Full Profile →
                </button>
              </>
            ) : (
              <div className="bg-white rounded-lg sm:rounded-xl p-6 sm:p-8 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Dna className="w-8 h-8 text-purple-600" />
                </div>
                <h3 className="text-lg font-semibold text-medical-neutral-900 mb-2">No genomic data yet</h3>
                <p className="text-sm text-medical-neutral-600 mb-6">Upload your genomic test report to match with targeted therapies and clinical trials</p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={() => {
                      if (!hasUploadedDocument) {
                        openDocumentOnboarding('genomic');
                      } else {
                        onTabChange('files');
                      }
                    }}
                    className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all duration-200 text-sm font-semibold shadow-sm hover:shadow-md flex items-center justify-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    Upload Genomic Report
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Saved Trials */}
        <div className="bg-white rounded-lg sm:rounded-xl p-4 sm:p-5 border-2 border-medical-accent-200 shadow-sm">
          {!loadingSavedTrials && savedTrials.length > 0 && (
            <h3 className="text-base sm:text-lg font-semibold text-medical-neutral-900 mb-4 flex items-center gap-2">
              <div className="bg-medical-accent-50 p-2 rounded-lg">
                <Bookmark className="w-5 h-5 text-medical-accent-600" />
              </div>
              Saved Trials
            </h3>
          )}
          {loadingSavedTrials ? (
            <div className="text-center py-8">
              <p className="text-medical-neutral-600 text-sm">Loading saved trials...</p>
            </div>
          ) : savedTrials.length > 0 ? (
            <div className="space-y-3">
              {savedTrials.map((trial) => (
                <div
                  key={trial.id}
                  className="border border-medical-neutral-200 rounded-lg p-3 sm:p-4 hover:border-medical-accent-300 hover:shadow-sm transition-all cursor-pointer bg-medical-neutral-50/50"
                  onClick={() => onTabChange('trials')}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-medical-neutral-900 text-sm sm:text-base mb-1.5 truncate">
                        {trial.title || trial.titleJa || 'Untitled Trial'}
                      </h4>
                      {trial.matchResult && (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-medical-neutral-600 font-medium">
                            Match: {trial.matchResult.matchPercentage}%
                          </span>
                          {trial.isFavorite && (
                            <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                          )}
                        </div>
                      )}
                    </div>
                    <ChevronRight className="w-5 h-5 text-medical-neutral-400 ml-2 flex-shrink-0" />
                  </div>
                </div>
              ))}
              <button
                onClick={() => onTabChange('trials')}
                className="w-full text-center text-medical-accent-600 text-sm font-medium hover:text-medical-accent-700 transition-colors mt-3"
              >
                View All Saved Trials →
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-lg sm:rounded-xl p-6 sm:p-8 text-center">
              <div className="w-16 h-16 bg-medical-accent-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Bookmark className="w-8 h-8 text-medical-accent-600" />
              </div>
              <h3 className="text-lg font-semibold text-medical-neutral-900 mb-2">No saved trials yet</h3>
              <p className="text-sm text-medical-neutral-600 mb-6">Search and save clinical trials that match your profile</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => onTabChange('trials')}
                  className="px-6 py-3 bg-medical-accent-500 text-white rounded-lg hover:bg-medical-accent-600 transition-all duration-200 text-sm font-semibold shadow-sm hover:shadow-md flex items-center justify-center gap-2"
                >
                  <Search className="w-4 h-4" />
                  Search Clinical Trials
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lab Tooltip Modal */}
      {labTooltip && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[70] bg-black/20 backdrop-blur-sm"
            onClick={() => setLabTooltip(null)}
          />
          {/* Tooltip */}
          <div
            className="fixed z-[71] bg-white rounded-xl shadow-2xl border border-medical-neutral-200 max-w-sm w-[90vw] sm:w-96 p-5 animate-fade-scale"
            style={{
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              maxHeight: '80vh',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-lg font-bold text-medical-neutral-900 pr-2">{labTooltip.labName}</h3>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setLabTooltip(null);
                }}
                className="text-medical-neutral-400 hover:text-medical-neutral-600 transition-colors flex-shrink-0"
                aria-label="Close"
                type="button"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-medical-neutral-700 leading-relaxed">{labTooltip.description}</p>
          </div>
        </>
      )}

      {/* Modals */}
      <AddSymptomModal
        show={showAddSymptomModal}
        onClose={() => {
          setShowAddSymptomModal(false);
          // Reset form when closing
          setSymptomForm({
            name: '',
            severity: '',
            date: getTodayLocalDate(),
            time: new Date().toTimeString().slice(0, 5),
            notes: '',
            customSymptomName: '',
            tags: []
          });
        }}
        symptomForm={symptomForm}
        setSymptomForm={setSymptomForm}
        user={user}
      />

      {showDocumentOnboarding && (
        <DocumentUploadOnboarding
          isOnboarding={!hasUploadedDocument}
          onClose={() => setShowDocumentOnboarding(false)}
          onUploadClick={(documentType, documentDate = null, documentNote = null) => {
            setShowDocumentOnboarding(false);
            // Note: Document upload is handled by FilesTab, so we'll switch to files tab
            // The FilesTab will handle the actual upload
            onTabChange('files');
          }}
        />
      )}
    </>
  );
}

