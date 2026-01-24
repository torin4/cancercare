import React, { useState, useEffect, useRef } from 'react';
import { Bot, Trash2, Send, Paperclip, Activity, Dna, Zap, Loader2, BarChart, FlaskConical, BookOpen, MessageSquare, Search, X, Filter, Sliders, Lightbulb, Square, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';
import ExtractionSummary from './ExtractionSummary';
import QuestionCards, { removeQuestionsFromText } from './QuestionCards';
import InsightStack from './InsightStack';
import ReactMarkdown from 'react-markdown';
import { DesignTokens, combineClasses } from '../design/designTokens';
import { useAuth } from '../contexts/AuthContext';
import { usePatientContext } from '../contexts/PatientContext';
import { useHealthContext } from '../contexts/HealthContext';
import { useBanner } from '../contexts/BannerContext';
import { messageService, labService, vitalService, symptomService } from '../firebase/services';
import { getSavedTrials } from '../services/clinicalTrials/clinicalTrialsService';
import { getNotebookEntries } from '../services/notebookService';
import { processChatMessage, generateChatExtractionSummary } from '../services/chatProcessor';
import { processDocument, generateExtractionSummary } from '../services/documentProcessor';
import { uploadDocument } from '../firebase/storage';
import { generalSuggestions, trialSuggestions, healthSuggestions, timelineSuggestions } from '../constants/chatSuggestions';
import DocumentUploadOnboarding from './modals/DocumentUploadOnboarding';
import DicomImportFlow from './modals/DicomImportFlow';
import UploadProgressOverlay from './UploadProgressOverlay';
import DeletionConfirmationModal from './modals/DeletionConfirmationModal';

export default function ChatSidebar({ activeTab, onTabChange, isMobileOverlay = false, onCloseOverlay = null, isCollapsed = false, onToggleCollapse = null }) {
  const { user } = useAuth();
  const { patientProfile, hasUploadedDocument, setPatientProfile, refreshPatient } = usePatientContext();
  const { reloadHealthData } = useHealthContext();
  const { showSuccess, showError } = useBanner();
  
  // Local collapsed state if not controlled from parent
  const [localCollapsed, setLocalCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('chatSidebarCollapsed');
      return saved === 'true';
    }
    return false;
  });
  
  const collapsed = isCollapsed !== undefined ? isCollapsed : localCollapsed;
  
  const handleToggleCollapse = () => {
    const newCollapsed = !collapsed;
    if (onToggleCollapse) {
      onToggleCollapse(newCollapsed);
    } else {
      setLocalCollapsed(newCollapsed);
      localStorage.setItem('chatSidebarCollapsed', String(newCollapsed));
    }
  };

  // Get personalized suggestions based on user role
  const personalizedSuggestions = React.useMemo(() => {
    const isPatient = patientProfile?.isPatient !== false;
    const patientName = patientProfile?.firstName || patientProfile?.name?.split(' ')[0] || 'the patient';

    const personalizeText = (text) => {
      if (!text) return text;

      if (isPatient) {
        let personalized = text
          .replace(/\[patient\] doctor/gi, 'my doctor')
          .replace(/\[Patient\] doctor/gi, 'my doctor')
          .replace(/\[patient\] diagnosis/gi, 'my diagnosis')
          .replace(/\[Patient\] diagnosis/gi, 'my diagnosis')
          .replace(/\[patient\] condition/gi, 'my condition')
          .replace(/\[Patient\] condition/gi, 'my condition');
        
        personalized = personalized
          .replace(/\[patient\]/gi, 'I')
          .replace(/\[Patient\]/gi, 'I')
          .replace(/\bthe patient\b/gi, 'I')
          .replace(/\bThe patient\b/gi, 'I')
          .replace(/\btheir\b/gi, 'my')
          .replace(/\bTheir\b/gi, 'My')
          .replace(/\bthey\b/gi, 'I')
          .replace(/\bThey\b/gi, 'I')
          .replace(/\[condition\]/gi, 'my condition');
        
        return personalized;
      } else {
        let personalized = text
          .replace(/\[patient\] doctor/gi, `${patientName}'s doctor`)
          .replace(/\[Patient\] doctor/gi, `${patientName}'s doctor`)
          .replace(/\[patient\] diagnosis/gi, `${patientName}'s diagnosis`)
          .replace(/\[Patient\] diagnosis/gi, `${patientName}'s diagnosis`)
          .replace(/\[patient\] condition/gi, `${patientName}'s condition`)
          .replace(/\[Patient\] condition/gi, `${patientName}'s condition`);
        
        personalized = personalized.replace(/\[patient\]/gi, 'I');
        personalized = personalized.replace(/\[Patient\]/gi, 'I');
        personalized = personalized.replace(/\[condition\]/gi, `${patientName}'s condition`);

        return personalized;
      }
    };

    const personalizeButtonLabel = (text) => {
      if (!text) return text;

      if (isPatient) {
        return text;
      } else {
        return text
          .replace(/Tell me about my (.*)/i, `Tell me about ${patientName}'s $1`)
          .replace(/my doctor/gi, `${patientName}'s doctor`)
          .replace(/my diagnosis/gi, `${patientName}'s diagnosis`)
          .replace(/my condition/gi, `${patientName}'s condition`)
          .replace(/What should I expect (.*)/i, `What should ${patientName} expect $1`);
      }
    };

    return generalSuggestions.map(suggestion => ({
      ...suggestion,
      populateText: personalizeText(suggestion.populateText || suggestion.text),
      text: personalizeButtonLabel(suggestion.text)
    }));
  }, [patientProfile?.isPatient, patientProfile?.firstName, patientProfile?.name]);

  const personalizedHealthSuggestions = React.useMemo(() => {
    const isPatient = patientProfile?.isPatient !== false;
    const patientName = patientProfile?.firstName || patientProfile?.name?.split(' ')[0] || 'the patient';

    const personalizeText = (text) => {
      if (!text) return text;
      if (isPatient) {
        return text
          .replace(/\[patient\]/gi, 'I')
          .replace(/\[Patient\]/gi, 'I')
          .replace(/\bthe patient\b/gi, 'I')
          .replace(/\btheir\b/gi, 'my')
          .replace(/\bthey\b/gi, 'I');
      } else {
        let personalized = text
          .replace(/\[patient\] (latest lab results|health data|treatment|symptoms|vitals)/gi, `${patientName}'s $1`)
          .replace(/\[Patient\] (latest lab results|health data|treatment|symptoms|vitals)/gi, `${patientName}'s $1`);
        
        personalized = personalized.replace(/\[patient\]/gi, patientName);
        personalized = personalized.replace(/\[Patient\]/gi, patientName);
        
        return personalized;
      }
    };

    const personalizeButtonLabel = (text) => {
      if (!text || isPatient) return text;
      return text
        .replace(/Explain my (.*)/i, `Explain ${patientName}'s $1`)
        .replace(/What does my (.*)/i, `What does ${patientName}'s $1`)
        .replace(/Analyze my (.*)/i, `Analyze ${patientName}'s $1`)
        .replace(/How is my (.*)/i, `How is ${patientName}'s $1`)
        .replace(/What do my (.*)/i, `What do ${patientName}'s $1`);
    };

    return healthSuggestions.map(suggestion => ({
      ...suggestion,
      populateText: personalizeText(suggestion.populateText || suggestion.text),
      text: personalizeButtonLabel(suggestion.text)
    }));
  }, [patientProfile?.isPatient, patientProfile?.firstName, patientProfile?.name]);

  const personalizedTrialSuggestions = React.useMemo(() => {
    const isPatient = patientProfile?.isPatient !== false;
    const patientName = patientProfile?.firstName || patientProfile?.name?.split(' ')[0] || 'the patient';

    const personalizeText = (text) => {
      if (!text) return text;
      if (isPatient) {
        return text;
      } else {
        let personalized = text.replace(/\bAm I\b/gi, `Is ${patientName}`);
        personalized = personalized.replace(/\bam I\b/gi, `is ${patientName}`);
        personalized = personalized.replace(/\bI\b/g, patientName);
        personalized = personalized.replace(/\bmy\b/gi, `${patientName}'s`);
        return personalized;
      }
    };

    const personalizeButtonLabel = (text) => {
      if (!text || isPatient) return text;
      return text.replace(/\bAm I\b/gi, `Is ${patientName}`);
    };

    return trialSuggestions.map(suggestion => ({
      ...suggestion,
      populateText: personalizeText(suggestion.populateText || suggestion.text),
      text: personalizeButtonLabel(suggestion.text)
    }));
  }, [patientProfile?.isPatient, patientProfile?.firstName, patientProfile?.name]);

  const personalizedTimelineSuggestions = React.useMemo(() => {
    const isPatient = patientProfile?.isPatient !== false;
    const patientName = patientProfile?.firstName || patientProfile?.name?.split(' ')[0] || 'the patient';

    const personalizeText = (text) => {
      if (!text) return text;
      if (isPatient) {
        return text
          .replace(/\[patient\]/gi, 'I')
          .replace(/\[Patient\]/gi, 'I')
          .replace(/\[date\]/gi, 'January 3rd')
          .replace(/\bthe patient\b/gi, 'I')
          .replace(/\btheir\b/gi, 'my')
          .replace(/\bthey\b/gi, 'I');
      } else {
        let personalized = text.replace(/\[patient\]/gi, patientName);
        personalized = personalized.replace(/\[Patient\]/gi, patientName);
        personalized = personalized.replace(/\[date\]/gi, 'January 3rd');
        personalized = personalized.replace(/\bI \b/gi, `${patientName} `);
        personalized = personalized.replace(/\bmy \b/gi, `${patientName}'s `);
        personalized = personalized.replace(/\bdo I\b/gi, `does ${patientName}`);
        personalized = personalized.replace(/\bdoes I\b/gi, `does ${patientName}`);
        personalized = personalized.replace(/\bdid I\b/gi, `did ${patientName}`);
        return personalized;
      }
    };

    const personalizeButtonLabel = (text) => {
      if (!text || isPatient) return text;
      return text
        .replace(/Tell me about my (.*)/i, `Tell me about ${patientName}'s $1`)
        .replace(/Show me my (.*)/i, `Show me ${patientName}'s $1`)
        .replace(/What notes do I have/i, `What notes does ${patientName} have`)
        .replace(/What documents did I upload/i, `What documents did ${patientName} upload`);
    };

    return timelineSuggestions.map(suggestion => ({
      ...suggestion,
      populateText: personalizeText(suggestion.populateText || suggestion.text),
      text: personalizeButtonLabel(suggestion.text)
    }));
  }, [patientProfile?.isPatient, patientProfile?.firstName, patientProfile?.name]);

  // Chat state
  const [messages, setMessages] = useState([]);
  const [chatHistoryLoaded, setChatHistoryLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, title: '', message: '', onConfirm: null, itemName: '', confirmText: 'Yes, Delete Permanently' });
  const [isDeleting, setIsDeleting] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const searchInputRef = useRef(null);
  const [inputText, setInputText] = useState('');
  const [currentTrialContext, setCurrentTrialContext] = useState(null);
  const [currentHealthContext, setCurrentHealthContext] = useState(null);
  const [currentNotebookContext, setCurrentNotebookContext] = useState(null);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [profileImage, setProfileImage] = useState(null);
  const [suggestionsKey, setSuggestionsKey] = useState(0);
  const [isBotProcessing, setIsBotProcessing] = useState(false);
  const [showIrisTooltip, setShowIrisTooltip] = useState(false);
  const tooltipRef = useRef(null);
  const tooltipButtonRef = useRef(null);

  // Position tooltip within viewport
  useEffect(() => {
    if (showIrisTooltip && tooltipRef.current && tooltipButtonRef.current) {
      const tooltip = tooltipRef.current;
      const button = tooltipButtonRef.current;
      const buttonRect = button.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      // Try to position above the button first
      let top = buttonRect.top - tooltipRect.height - 8;
      let left = buttonRect.left + (buttonRect.width / 2) - (tooltipRect.width / 2);
      
      // If tooltip goes above viewport, position below
      if (top < 10) {
        top = buttonRect.bottom + 8;
      }
      
      // If tooltip goes below viewport, position at bottom with margin
      if (top + tooltipRect.height > viewportHeight - 10) {
        top = viewportHeight - tooltipRect.height - 10;
      }
      
      // If tooltip goes off left edge, align to left
      if (left < 10) {
        left = 10;
      }
      
      // If tooltip goes off right edge, align to right
      if (left + tooltipRect.width > viewportWidth - 10) {
        left = viewportWidth - tooltipRect.width - 10;
      }
      
      tooltip.style.top = `${top}px`;
      tooltip.style.left = `${left}px`;
      tooltip.style.bottom = 'auto';
      tooltip.style.right = 'auto';
    }
  }, [showIrisTooltip]);
  const [showComplexityControl, setShowComplexityControl] = useState(false);
  const hasProcessedNoResultsRef = useRef(false); // Track if we've processed no-results message
  const abortControllerRef = useRef(null);

  // Document upload state
  const [showDocumentOnboarding, setShowDocumentOnboarding] = useState(false);
  const [documentOnboardingMethod, setDocumentOnboardingMethod] = useState('picker');
  const [isUploading, setIsUploading] = useState(false);
  const [showDicomImportFlow, setShowDicomImportFlow] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [pendingDocumentDate, setPendingDocumentDate] = useState(null);
  const [pendingDocumentNote, setPendingDocumentNote] = useState(null);
  const [documents, setDocuments] = useState([]);

  // Load profile image
  useEffect(() => {
    if (patientProfile?.profileImage) {
      setProfileImage(patientProfile.profileImage);
    } else if (user?.photoURL) {
      setProfileImage(user.photoURL);
    } else {
      setProfileImage(null);
    }
  }, [user, patientProfile]);

  // Check for context from sessionStorage (search results, individual trial, etc.)
  useEffect(() => {
    console.log('[ChatSidebar] Checking for context from sessionStorage');
    // Check for no-results message first (from header button when no search results)
    const noResultsMessageStr = sessionStorage.getItem('trialsNoResultsMessage');
    console.log('[ChatSidebar] trialsNoResultsMessage:', noResultsMessageStr ? 'FOUND' : 'not found');
    if (noResultsMessageStr) {
      console.log('[ChatSidebar] Found trialsNoResultsMessage - clearing context and setting flag');
      // Clear any context - we'll show the instruction message instead
      setCurrentTrialContext(null);
      setCurrentHealthContext(null);
      setCurrentNotebookContext(null);
      // Set flag to prevent auto-load even after message is removed from sessionStorage
      hasProcessedNoResultsRef.current = true;
      // Don't clear the message here - let the other useEffect process it
      return; // Don't auto-load if we have no-results message
    }

    // Check for search results context first (from header button on trials page)
    const searchResultsContextStr = sessionStorage.getItem('currentSearchResultsContext');
    if (searchResultsContextStr) {
      try {
        const searchResults = JSON.parse(searchResultsContextStr);
        // Store all search results in a special context format
        // The buildTrialContextSection will handle multiple trials
        if (searchResults && searchResults.length > 0) {
          // Reset the no-results flag since we have actual context now
          hasProcessedNoResultsRef.current = false;
          setCurrentTrialContext({
            _isSearchResults: true,
            _searchResults: searchResults,
            _searchResultsCount: searchResults.length,
            // Include first trial details for backward compatibility
            title: `Search Results (${searchResults.length} trials found)`,
            id: 'search-results',
            phase: searchResults.map(t => t.phase).filter(Boolean).join(', '),
            status: 'Active',
            summary: `${searchResults.length} clinical trials matching your search criteria. I can answer questions about any of these trials or help you compare them.`
          });
          setCurrentHealthContext(null);
          setCurrentNotebookContext(null);
          // Clear the sessionStorage after using it
          sessionStorage.removeItem('currentSearchResultsContext');
        }
      } catch (error) {
        sessionStorage.removeItem('currentSearchResultsContext');
      }
      return; // Don't auto-load if we found search results context
    }

    // Check for individual trial context (from trial card/modal button)
    const trialContextStr = sessionStorage.getItem('currentTrialContext');
    if (trialContextStr) {
      try {
        // Reset the no-results flag since we have actual context now
        hasProcessedNoResultsRef.current = false;
        const trialContext = JSON.parse(trialContextStr);
        setCurrentTrialContext(trialContext);
        setCurrentHealthContext(null);
        setCurrentNotebookContext(null);
        // Clear the sessionStorage after using it
        sessionStorage.removeItem('currentTrialContext');
      } catch (error) {
        sessionStorage.removeItem('currentTrialContext');
      }
      return; // Don't auto-load if we found trial context
    }
  }, []);

  // Auto-load context based on active tab
  useEffect(() => {
    console.log('[ChatSidebar] Auto-load useEffect - user:', !!user, 'chatHistoryLoaded:', chatHistoryLoaded, 'activeTab:', activeTab, 'hasProcessedNoResults:', hasProcessedNoResultsRef.current);
    if (!user || !chatHistoryLoaded) {
      console.log('[ChatSidebar] Auto-load skipped - waiting for user or chat history');
      return;
    }

    // Skip auto-loading if we already have context from sessionStorage
    // Also skip if there's a no-results message (button was clicked but no search results)
    // OR if we've already processed a no-results message (using ref to persist across re-renders)
    // CRITICAL: Check sessionStorage synchronously at the start to prevent race conditions
    const hasSearchResultsContext = sessionStorage.getItem('currentSearchResultsContext');
    const hasTrialContext = sessionStorage.getItem('currentTrialContext');
    const hasNoResultsMessage = sessionStorage.getItem('trialsNoResultsMessage');
    const hasContextFromStorage = hasSearchResultsContext || hasTrialContext || hasNoResultsMessage || hasProcessedNoResultsRef.current;

    console.log('[ChatSidebar] Context check:', {
      hasSearchResultsContext: !!hasSearchResultsContext,
      hasTrialContext: !!hasTrialContext,
      hasNoResultsMessage: !!hasNoResultsMessage,
      hasProcessedNoResults: hasProcessedNoResultsRef.current,
      hasContextFromStorage
    });

    const loadContextForTab = async () => {
      // Double-check sessionStorage before loading - in case it was set during this effect
      // Also check the ref to see if we've already processed no-results
      const stillHasSearchResults = sessionStorage.getItem('currentSearchResultsContext');
      const stillHasTrial = sessionStorage.getItem('currentTrialContext');
      const stillHasNoResults = sessionStorage.getItem('trialsNoResultsMessage');
      const stillHasContextFromStorage = stillHasSearchResults || stillHasTrial || stillHasNoResults || hasProcessedNoResultsRef.current;
      
      console.log('[ChatSidebar] loadContextForTab - Double-check before loading:', {
        stillHasSearchResults: !!stillHasSearchResults,
        stillHasTrial: !!stillHasTrial,
        stillHasNoResults: !!stillHasNoResults,
        hasProcessedNoResults: hasProcessedNoResultsRef.current,
        stillHasContextFromStorage
      });

      if (stillHasContextFromStorage) {
        console.log('[ChatSidebar] loadContextForTab - Context from storage detected, skipping auto-load');
        return; // Don't auto-load if context was set from sessionStorage
      }

      console.log('[ChatSidebar] loadContextForTab - Starting auto-load for tab:', activeTab);

      try {
        if (activeTab === 'health') {
          // Load health context automatically
          const labs = await labService.getLabs(user.uid);
          const vitals = await vitalService.getVitals(user.uid);
          const symptoms = await symptomService.getSymptoms(user.uid);
          
          const labsWithValues = await Promise.all(labs.map(async (lab) => {
            if (lab.id) {
              const values = await labService.getLabValues(lab.id);
              return { ...lab, values: values || [] };
            }
            return lab;
          }));
          
          const vitalsWithValues = await Promise.all(vitals.map(async (vital) => {
            if (vital.id) {
              const values = await vitalService.getVitalValues(vital.id);
              return { ...vital, values: values || [] };
            }
            return vital;
          }));
          
          setCurrentHealthContext({
            labs: labsWithValues,
            vitals: vitalsWithValues,
            symptoms: symptoms
          });
          setCurrentTrialContext(null);
          setCurrentNotebookContext(null);
        } else if (activeTab === 'files') {
          // Load notebook context automatically
          const entries = await getNotebookEntries(user.uid, { limit: 50 });
          setCurrentNotebookContext({ entries });
          setCurrentHealthContext(null);
          setCurrentTrialContext(null);
        } else if (activeTab === 'trials') {
          // NEVER auto-load saved trials - when on trials tab, we should only use context from button clicks
          // If no context is provided, show general trials context (not saved trials)
          console.log('[ChatSidebar] loadContextForTab - Trials tab - NOT loading saved trials (only use context from button clicks)');
          setCurrentTrialContext(null);
          setCurrentHealthContext(null);
          setCurrentNotebookContext(null);
        } else {
          // Dashboard or other tabs - clear context
          setCurrentHealthContext(null);
          setCurrentTrialContext(null);
          setCurrentNotebookContext(null);
        }
      } catch (error) {
        // Silently handle errors - don't block the UI
      }
    };

    // For trials tab, NEVER auto-load saved trials - only use context from button clicks
    // For other tabs, auto-load if no context from sessionStorage
    if (activeTab === 'trials') {
      console.log('[ChatSidebar] Trials tab - NEVER auto-load saved trials, only use context from button clicks');
      // Don't call loadContextForTab for trials tab - context comes from button clicks only
      return;
    }
    
    // Only auto-load if no context was set from sessionStorage (for non-trials tabs)
    if (!hasContextFromStorage) {
      console.log('[ChatSidebar] No context from storage - calling loadContextForTab');
      loadContextForTab();
    } else {
      console.log('[ChatSidebar] Context from storage detected - skipping auto-load');
    }
  }, [activeTab, user, chatHistoryLoaded]);

  // Load chat history when component mounts
  useEffect(() => {
    const loadChatHistory = async () => {
      if (user && !chatHistoryLoaded) {
        try {
          const savedMessages = await messageService.getMessages(user.uid, 100);
          if (savedMessages.length > 0) {
            setMessages(savedMessages.map(msg => ({
              type: msg.type,
              text: msg.text,
              isAnalysis: msg.isAnalysis || false,
              insight: msg.insight || null
            })));
          }
          setChatHistoryLoaded(true);
        } catch (error) {
          setChatHistoryLoaded(true);
        }
      }
    };
    loadChatHistory();
  }, [user, chatHistoryLoaded]);

  // Check for instruction message when no search results (from trials page)
  useEffect(() => {
    const noResultsMessageStr = sessionStorage.getItem('trialsNoResultsMessage');
    if (noResultsMessageStr) {
      try {
        const noResultsMessage = JSON.parse(noResultsMessageStr);
        if (noResultsMessage.type === 'ai') {
          // Clear any trial context when showing no-results message
          setCurrentTrialContext(null);
          setCurrentHealthContext(null);
          setCurrentNotebookContext(null);
          // Add the message
          setMessages(prev => [...prev, noResultsMessage]);
        }
        sessionStorage.removeItem('trialsNoResultsMessage');
      } catch (error) {
        sessionStorage.removeItem('trialsNoResultsMessage');
      }
    }
  }, []);

  // Auto-scroll to bottom
  const scrollToBottom = React.useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      const timeoutId = setTimeout(() => {
        scrollToBottom();
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [messages, scrollToBottom]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || !user) return;

    const userMessage = inputText;
    setInputText('');

    const userMsg = { type: 'user', text: userMessage };
    setMessages(prev => [...prev, userMsg]);
    
    setTimeout(() => {
      scrollToBottom();
    }, 50);

    if (user) {
      messageService.addMessage({
        patientId: user.uid,
        type: 'user',
        text: userMessage,
        isAnalysis: false
      });
      setIsBotProcessing(true);
      abortControllerRef.current = new AbortController();
    }

    try {
      let healthContextToUse = currentHealthContext;
      // Detect if question would benefit from health data - expanded patterns to catch more health-related questions
      const requiresHealthData = /(explain|analyze|what does|how is|why is|why are|why does|why do|trend|progress|mean|interpret|tell me about|what about|what are|what is|my (lab|labs|vital|vitals|symptom|symptoms|health|treatment|medication|medications|data|results|values|numbers|test|tests)|ca-125|hemoglobin|blood pressure|heart rate|temperature|weight|tired|fatigue|energy|feeling|feels|symptom|pain|nausea|dizzy|weak|weakness|anemia|blood|cbc|wbc|rbc|platelet|anxiety|depression|sleep|appetite|nauseous)/i.test(userMessage);
      
      if (requiresHealthData && !healthContextToUse && user) {
        try {
          const labs = await labService.getLabs(user.uid);
          const vitals = await vitalService.getVitals(user.uid);
          const symptoms = await symptomService.getSymptoms(user.uid);
          
          const labsWithValues = await Promise.all(labs.map(async (lab) => {
            if (lab.id) {
              const values = await labService.getLabValues(lab.id);
              return { ...lab, values: values || [] };
            }
            return lab;
          }));
          
          const vitalsWithValues = await Promise.all(vitals.map(async (vital) => {
            if (vital.id) {
              const values = await vitalService.getVitalValues(vital.id);
              return { ...vital, values: values || [] };
            }
            return vital;
          }));
          
          healthContextToUse = {
            labs: labsWithValues,
            vitals: vitalsWithValues,
            symptoms: symptoms
          };
          setCurrentHealthContext(healthContextToUse);
        } catch (error) {
        }
      }

      const isAddingData = /(my (ca-125|hemoglobin|wbc|platelets|blood pressure|heart rate|temperature|temp|weight|bp|hr) (was|is)|i (had|have|started|am taking|took)|i'm (experiencing|taking)|my (symptom|symptoms)|started taking|taking [a-z]+ (mg|ml|units?)|log|add|record)/i.test(userMessage);
      const requiresNotebookData = !currentNotebookContext && !isAddingData && /(history|timeline|journal|notebook|what happened|on (date|day|december|january|february|march|april|may|june|july|august|september|october|november)|tell me about (date|day|december|january|february|march|april|may|june|july|august|september|october|november)|my history|health journal|journal entries|notes|documents from|symptoms from)/i.test(userMessage);
      
      let notebookContextToUse = currentNotebookContext;
      if (requiresNotebookData && user) {
        try {
          const entries = await getNotebookEntries(user.uid, { limit: 50 });
          notebookContextToUse = { entries };
          setCurrentNotebookContext(notebookContextToUse);
        } catch (error) {
        }
      }

      const requiresTrialData = !currentTrialContext && /(saved trial|saved trials|my trial|my trials|clinical trial|clinical trials|trial i saved|trials i saved|what trials|which trials|show me trials|tell me about trials|ask about trial)/i.test(userMessage);
      
      if (requiresTrialData && user) {
        try {
          const savedTrials = await getSavedTrials(user.uid);
          if (savedTrials && savedTrials.length > 0) {
            const trialToUse = savedTrials.sort((a, b) => {
              let aTime = 0;
              let bTime = 0;
              
              if (a.savedAt) {
                if (typeof a.savedAt.toMillis === 'function') {
                  aTime = a.savedAt.toMillis();
                } else if (typeof a.savedAt === 'number') {
                  aTime = a.savedAt;
                } else if (a.savedAt.seconds) {
                  aTime = a.savedAt.seconds * 1000;
                }
              }
              
              if (b.savedAt) {
                if (typeof b.savedAt.toMillis === 'function') {
                  bTime = b.savedAt.toMillis();
                } else if (typeof b.savedAt === 'number') {
                  bTime = b.savedAt;
                } else if (b.savedAt.seconds) {
                  bTime = b.savedAt.seconds * 1000;
                }
              }
              
              return bTime - aTime;
            })[0];
            
            if (trialToUse) {
              setCurrentTrialContext(trialToUse);
            }
          }
        } catch (error) {
        }
      }

      // Check if request was aborted before processing
      if (abortControllerRef.current?.signal.aborted) {
        setIsBotProcessing(false);
        return;
      }
      
      const result = await processChatMessage(
        userMessage,
        user.uid,
        messages.slice(-10).map(msg => ({
          role: msg.type === 'user' ? 'user' : 'assistant',
          content: msg.text
        })),
        currentTrialContext,
        healthContextToUse,
        notebookContextToUse,
        patientProfile,
        abortControllerRef.current?.signal // Pass abort signal
      );
      
      // Check if request was aborted after processing
      if (abortControllerRef.current?.signal.aborted) {
        setIsBotProcessing(false);
        return;
      }

      let responseText = result.response;

      // Check if request was aborted after processing
      if (abortControllerRef.current?.signal.aborted) {
        setIsBotProcessing(false);
        abortControllerRef.current = null;
        return;
      }
      
      // Get extraction summary (separate from response text)
      const extractionSummary = result.extractedData ? generateChatExtractionSummary(result.extractedData) : null;

      setIsBotProcessing(false);
      abortControllerRef.current = null;
      
      const aiMsg = {
        type: 'ai',
        text: responseText,
        isAnalysis: !!result.extractedData,
        insight: result.insight || null,
        extractionSummary: extractionSummary || null
      };
      setMessages(prev => [...prev, aiMsg]);
      
      setTimeout(() => {
        scrollToBottom();
      }, 100);

      if (user) {
        messageService.addMessage({
          patientId: user.uid,
          type: 'ai',
          text: responseText,
          isAnalysis: !!result.extractedData,
          extractedData: result.extractedData || null,
          insight: result.insight || null,
          extractionSummary: extractionSummary || null
        });
      }

      if (result.extractedData) {
        await reloadHealthData();
      }

    } catch (error) {
      // Don't show error if request was aborted
      if (error.name === 'AbortError' || abortControllerRef.current?.signal.aborted) {
        setIsBotProcessing(false);
        abortControllerRef.current = null;
        return;
      }
      setIsBotProcessing(false);
      abortControllerRef.current = null;
      
      const errorMsg = {
        type: 'ai',
        text: 'Sorry, I\'m having trouble processing your message right now. Please try again in a moment.'
      };
      setMessages(prev => [...prev, errorMsg]);
      
      setTimeout(() => {
        scrollToBottom();
      }, 100);
      
      if (user) {
        messageService.addMessage({
          patientId: user.uid,
          type: 'ai',
          text: errorMsg.text,
          isAnalysis: false
        });
      }
    }
  };

  const openDocumentOnboarding = (docType = null, method = 'picker') => {
    setDocumentOnboardingMethod(method || 'picker');
    setShowDocumentOnboarding(true);
  };
  
  // If collapsed and not mobile overlay, show just a floating icon button
  if (collapsed && !isMobileOverlay) {
    return (
      <button
        onClick={handleToggleCollapse}
        className="hidden lg:flex fixed right-4 bottom-4 z-40 w-16 h-16 rounded-full bg-anchor-900 hover:bg-anchor-800 shadow-lg hover:shadow-xl text-white touch-manipulation active:opacity-70 flex items-center justify-center transition-all flex-shrink-0"
        title="Open chat sidebar"
      >
        <div className="relative">
          <Bot className="w-7 h-7" />
          {messages.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-anchor-600 rounded-full border-2 border-anchor-900"></span>
          )}
        </div>
      </button>
    );
  }

  return (
    <div 
      className={`${isMobileOverlay ? 'lg:hidden fixed left-0 right-0 w-full z-50 rounded-t-2xl shadow-2xl' : `hidden lg:flex fixed top-0 bottom-0 z-40 transition-all duration-300 w-[512px]`} bg-white border-l border-medical-neutral-200 shadow-xl flex flex-col`}
      style={
        isMobileOverlay
          ? {
              bottom: 'calc(env(safe-area-inset-bottom, 0px) + 72px)',
              height: 'calc(75vh - 72px)'
            }
          : { right: 0, left: 'auto' }
      }
    >
      {/* Collapse Button - Positioned outside sidebar */}
      {!isMobileOverlay && (
        <button
          onClick={handleToggleCollapse}
          className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white border-2 border-medical-neutral-200 hover:border-medical-neutral-300 text-medical-neutral-600 hover:text-medical-neutral-800 touch-manipulation active:opacity-70 flex items-center justify-center transition-all flex-shrink-0"
          title="Collapse sidebar"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
      
      {/* Header */}
      <div className={combineClasses(
        DesignTokens.spacing.container.mobile,
        'sm:px-4 md:px-6',
        'py-2 sm:py-3',
        'border-b',
        DesignTokens.borders.color.default,
        'flex items-center justify-between',
        isMobileOverlay ? 'rounded-t-2xl' : ''
      )}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className={combineClasses('flex items-center', DesignTokens.spacing.gap.sm, 'sm:gap-3', 'flex-1 min-w-0')}>
            <div className={combineClasses(DesignTokens.components.header.iconContainer, 'flex-shrink-0')}>
              <Bot className={combineClasses(DesignTokens.icons.header.size.full, DesignTokens.components.header.icon)} />
            </div>
            <div className="min-w-0">
              <h2 className={combineClasses(DesignTokens.components.header.title, 'mb-0 text-base flex items-end gap-1.5')}>
                <span className="text-anchor-900">Iris</span> <span className="text-xs font-normal text-medical-neutral-500 flex items-center gap-1 leading-none pb-0.5">
                  Health Assistant
                  <div className="relative">
                    <button
                      ref={tooltipButtonRef}
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowIrisTooltip(!showIrisTooltip);
                      }}
                      className="flex items-center justify-center"
                      aria-label="About Iris"
                    >
                      <HelpCircle className="w-3.5 h-3.5 text-medical-neutral-400 hover:text-medical-neutral-600 cursor-pointer transition-colors" />
                    </button>
                    {showIrisTooltip && (
                      <>
                        <div 
                          ref={tooltipRef}
                          className="fixed z-[100] w-72 p-3 bg-anchor-900 text-white text-xs rounded-lg shadow-xl"
                          style={{
                            maxHeight: 'calc(100vh - 20px)',
                            overflowY: 'auto',
                            top: 'auto',
                            bottom: 'auto',
                            left: 'auto',
                            right: 'auto'
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="mb-2 font-semibold">About Iris</div>
                          <div className="space-y-1.5 leading-relaxed">
                            <p>Iris is your AI health assistant that helps you understand your health data, identify patterns, and prepare for discussions with your healthcare team.</p>
                            <p className="pt-1.5 border-t border-anchor-700 italic">
                              This assistant provides general health information only and does not provide medical advice. Please consult with qualified healthcare professionals for medical decisions.
                            </p>
                          </div>
                        </div>
                        <div 
                          className="fixed inset-0 z-[99]"
                          onClick={() => setShowIrisTooltip(false)}
                        />
                      </>
                    )}
                  </div>
                </span>
              </h2>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isMobileOverlay && onCloseOverlay && (
            <button
              onClick={onCloseOverlay}
              className="text-medical-neutral-500 hover:text-medical-neutral-700 min-h-[44px] min-w-[44px] px-2 touch-manipulation active:opacity-70 flex items-center justify-center"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}
          {!collapsed && messages.length > 0 && (
            <>
              <button
                onClick={() => {
                  if (isSearchActive) {
                    setSearchQuery('');
                    setIsSearchActive(false);
                  } else {
                    setIsSearchActive(true);
                    setTimeout(() => searchInputRef.current?.focus(), 100);
                  }
                }}
                className={combineClasses('text-medical-neutral-500 hover:text-medical-neutral-700 transition-colors min-h-[44px] min-w-[44px] px-2 touch-manipulation active:opacity-70 flex items-center justify-center', isSearchActive ? 'text-gray-800' : '')}
                title={isSearchActive ? "Close search" : "Search chats"}
              >
                <Search className="w-5 h-5" />
              </button>
              <button
                onClick={() => {
                  if (!user) return;
                  setDeleteConfirm({
                    show: true,
                    title: 'Clear All Chat History?',
                    message: 'This will remove all conversation history but keep your health data context.',
                    itemName: 'all chat history',
                    confirmText: 'Yes, Clear History',
                    onConfirm: async () => {
                      setIsDeleting(true);
                      try {
                        await messageService.deleteAllMessages(user.uid);
                        setMessages([]);
                        setChatHistoryLoaded(false);
                        showSuccess('Chat history cleared');
                      } catch (error) {
                        showError('Error clearing chat history. Please try again.');
                      } finally {
                        setIsDeleting(false);
                      }
                    }
                  });
                }}
                className="text-medical-neutral-500 hover:text-medical-neutral-700 text-xs sm:text-sm flex items-center gap-1.5 transition-colors min-h-[44px] min-w-[44px] px-2 touch-manipulation active:opacity-70"
                title="Clear chat history"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Search Bar */}
      {!collapsed && isSearchActive && (
        <div className={combineClasses('px-3 py-2 border-b border-medical-neutral-200 bg-white')}>
          <div className={combineClasses('flex items-center', 'w-full px-3 py-1.5 border border-medical-neutral-200 rounded-xl focus-within:ring-2 focus-within:ring-offset-0 focus-within:ring-gray-800 focus-within:border-gray-800 transition-all duration-200')}>
            <Search className="w-5 h-5 text-medical-neutral-400 flex-shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats..."
              className="flex-1 bg-transparent border-0 outline-0 text-sm px-2"
              autoFocus
            />
            <button
              onClick={() => {
                setSearchQuery('');
                setIsSearchActive(false);
              }}
              className="text-medical-neutral-400 hover:text-medical-neutral-600 transition-colors flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center touch-manipulation active:opacity-70"
              title="Close search"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Messages Container */}
      {!collapsed && (
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-3 space-y-2"
      >
        {(() => {
          const filteredMessages = searchQuery.trim() 
            ? messages.filter(msg => 
                msg.text.toLowerCase().includes(searchQuery.toLowerCase())
              )
            : messages;
          
          if (searchQuery.trim() && filteredMessages.length === 0) {
            return (
              <div className="flex items-center justify-center h-full text-medical-neutral-500">
                <div className="text-center">
                  <Search className="w-12 h-12 mx-auto mb-3 text-medical-neutral-300" />
                  <p className="text-sm">No messages found matching "{searchQuery}"</p>
                </div>
              </div>
            );
          }
          
          if (filteredMessages.length === 0) {
            return (
              <div className="flex items-center justify-center h-full text-medical-neutral-500">
                <div className="text-center">
                  <Bot className="w-12 h-12 mx-auto mb-3 text-medical-neutral-300" />
                  <p className="text-sm">Start a conversation to get help with your health data.</p>
                </div>
              </div>
            );
          }
          
          return (
            <>
              {filteredMessages.map((msg, idx) => {
            const originalIdx = messages.indexOf(msg);
            return (
              <div key={originalIdx} className="space-y-2">
                <div className={`flex items-start gap-2 ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.type === 'ai' && (
                    <div className={combineClasses('flex-shrink-0 flex items-center justify-center', DesignTokens.components.chat.avatar)}>
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div className={combineClasses(
                    'max-w-[85%] text-xs',
                    msg.type === 'user'
                      ? DesignTokens.components.chat.userBubble
                      : msg.isAnalysis
                        ? DesignTokens.components.chat.analysisBubble
                        : DesignTokens.components.chat.aiBubble
                  )}>
                    {msg.type === 'user' ? (
                      <p className="text-xs whitespace-pre-wrap">{msg.text}</p>
                    ) : (
                      <div className="text-xs prose prose-xs max-w-none">
                        <ReactMarkdown
                          components={{
                            p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                            ul: ({node, ...props}) => <ul className="list-disc list-inside mb-2 space-y-1" {...props} />,
                            ol: ({node, ...props}) => <ol className="list-decimal list-inside mb-2 space-y-1" {...props} />,
                            li: ({node, ...props}) => <li className="ml-2" {...props} />,
                            strong: ({node, ...props}) => <strong className="font-semibold" {...props} />,
                            em: ({node, ...props}) => <em className="italic" {...props} />,
                            code: ({node, ...props}) => <code className="bg-medical-neutral-100 px-1.5 py-0.5 rounded text-xs font-mono" {...props} />,
                            h1: ({node, ...props}) => <h1 className="text-base font-bold mb-2 mt-3 first:mt-0" {...props} />,
                            h2: ({node, ...props}) => <h2 className="text-sm font-bold mb-2 mt-3 first:mt-0" {...props} />,
                            h3: ({node, ...props}) => <h3 className="text-xs font-bold mb-1 mt-2 first:mt-0" {...props} />,
                            blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-medical-neutral-300 pl-3 italic my-2" {...props} />,
                            a: ({node, ...props}) => <a className="text-gray-800 underline hover:text-gray-900" {...props} />,
                          }}
                        >
                          {removeQuestionsFromText(msg.text)}
                        </ReactMarkdown>
                        <QuestionCards text={msg.text} />
                      </div>
                    )}
                </div>
                {msg.type === 'user' && (
                  <div className="flex-shrink-0 w-6 h-6 rounded-full overflow-hidden shadow-sm">
                    {profileImage ? (
                      <img 
                        src={profileImage} 
                        alt="Profile" 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-600 flex items-center justify-center text-white text-xs font-bold">
                        {(() => {
                          let name;
                          if (patientProfile?.isPatient === false && patientProfile?.caregiverName) {
                            name = patientProfile.caregiverName;
                          } else {
                            name = patientProfile?.firstName || patientProfile?.lastName 
                              ? `${patientProfile?.firstName || ''} ${patientProfile?.lastName || ''}`.trim()
                              : patientProfile?.name || user?.displayName || 'U';
                          }
                          const parts = name.trim().split(/\s+/);
                          if (parts.length >= 2) {
                            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
                          }
                          return name.substring(0, 2).toUpperCase();
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {msg.type === 'ai' && (msg.insights || msg.insight) && (() => {
                // Don't show insight card for doctor discussion queries
                const isDoctorDiscussion = msg.text.toLowerCase().includes('questions should i ask') || 
                                         (msg.text.toLowerCase().includes('discuss') && msg.text.toLowerCase().includes('doctor')) ||
                                         msg.text.toLowerCase().includes('what questions');
                
                if (isDoctorDiscussion) return null;
                
                // Use new structured insights array if available, otherwise fall back to legacy single insight
                const insights = msg.insights || (msg.insight ? [{
                  type: 'general',
                  priority: 3,
                  headline: msg.insight,
                  explanation: msg.insight,
                  actionable: null,
                  confidence: null,
                  doctorQuestions: null
                }] : []);
                
                if (insights.length === 0) return null;
                
                return (
                  <InsightStack
                    insights={insights}
                    onDiscussWithDoctor={(insight) => {
                      const contextPrompt = insight.headline || insight.explanation
                        ? `What questions should I ask my doctor about: ${insight.headline || insight.explanation}`
                        : 'What questions should I ask my doctor?';
                      setInputText(contextPrompt);
                      setTimeout(() => {
                        const textarea = document.querySelector('textarea');
                        if (textarea) {
                          textarea.focus();
                        }
                      }, 100);
                    }}
                  />
                );
              })()}
              {msg.type === 'ai' && msg.extractionSummary && (
                <div className="flex justify-start mt-1">
                  <div className="max-w-[85%]">
                    <ExtractionSummary summary={msg.extractionSummary} />
                  </div>
                </div>
              )}
            </div>
                );
              })}
            </>
          );
        })()}
        
        {isBotProcessing && (
          <div className="flex items-start gap-2 justify-start">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-gray-800 to-gray-600 flex items-center justify-center shadow-sm">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="max-w-[85%] rounded-2xl px-3 py-2 bg-white border border-medical-neutral-200 text-medical-neutral-900">
              <div className="flex items-center gap-2 text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-gray-800" />
                <span className="text-medical-neutral-600">Analyzing...</span>
              </div>
            </div>
          </div>
        )}
        
        {/* Scroll target */}
        <div ref={messagesEndRef} className="h-1" />
      </div>
      )}

      {/* Context Indicators - Hidden to save space, context is set automatically when needed */}
      {/* 
      {currentTrialContext && (
        <div className={combineClasses('p-2 border-b text-xs flex items-center justify-between gap-2', DesignTokens.moduleAccent.trials.bg, DesignTokens.moduleAccent.trials.border)}>
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className={combineClasses('text-xs font-medium flex-shrink-0', DesignTokens.moduleAccent.trials.text)}>Discussing:</span>
            <span className={combineClasses('text-xs truncate', DesignTokens.moduleAccent.trials.text)}>
              {currentTrialContext._isSearchResults 
                ? `Search Results (${currentTrialContext._searchResultsCount} trials)`
                : (currentTrialContext.title || 'Trial')}
            </span>
          </div>
          <button
            onClick={() => setCurrentTrialContext(null)}
            className={combineClasses('text-xs underline flex-shrink-0 min-h-[44px] min-w-[44px] px-2 touch-manipulation active:opacity-70', DesignTokens.moduleAccent.trials.text)}
          >
            Clear
          </button>
        </div>
      )}

      {currentHealthContext && (
        <div className="p-2 bg-medical-primary-50 border-b border-medical-primary-200 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="text-medical-primary-600 text-xs font-medium flex-shrink-0">Discussing:</span>
            <span className="text-medical-primary-800 text-xs truncate">Health Data</span>
          </div>
          <button
            onClick={() => setCurrentHealthContext(null)}
            className="text-medical-primary-600 hover:text-medical-primary-800 text-xs underline flex-shrink-0 min-h-[44px] min-w-[44px] px-2 touch-manipulation active:opacity-70"
          >
            Clear
          </button>
        </div>
      )}

      {currentNotebookContext && (
        <div className="p-2 bg-yellow-50 border-b border-yellow-200 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className="text-yellow-600 text-xs font-medium flex-shrink-0">Discussing:</span>
            <span className="text-yellow-800 text-xs truncate">Notebook</span>
          </div>
          <button
            onClick={() => setCurrentNotebookContext(null)}
            className="text-yellow-600 hover:text-yellow-700 text-xs underline flex-shrink-0 min-h-[44px] min-w-[44px] px-2 touch-manipulation active:opacity-70"
          >
            Clear
          </button>
        </div>
      )}
      */}

      {/* AI Response Settings - Collapsible */}
      {!collapsed && (
      <div className="border-t border-medical-neutral-200 bg-white">
        {!showComplexityControl ? (
          <button
            onClick={() => setShowComplexityControl(true)}
            className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-medical-neutral-100 transition-colors"
            title="Adjust AI response settings"
          >
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-medical-neutral-500" />
              <span className="text-xs font-medium text-medical-neutral-700">
                AI Response Settings
              </span>
            </div>
            <ChevronDown className="w-4 h-4 text-medical-neutral-400" />
          </button>
        ) : (
          <div className="px-3 pt-3 pb-3 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-medical-neutral-500" />
                <label className="text-xs font-medium text-medical-neutral-700">
                  AI Response Settings
                </label>
              </div>
              <button
                onClick={() => setShowComplexityControl(false)}
                className="text-medical-neutral-400 hover:text-medical-neutral-600 transition-colors min-h-[44px] min-w-[44px] px-2 flex items-center justify-center"
                title="Collapse"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>

            {/* Response Complexity Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-medical-neutral-700">
                  Response Complexity
                </label>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                  patientProfile?.responseComplexity === 'simple' ? 'bg-blue-100 text-blue-700' :
                  patientProfile?.responseComplexity === 'detailed' ? 'bg-purple-100 text-purple-700' :
                  'bg-anchor-100 text-anchor-700'
                }`}>
                  {patientProfile?.responseComplexity === 'simple' ? 'Simple' : 
                   patientProfile?.responseComplexity === 'detailed' ? 'Detailed' : 
                   'Standard'}
                </span>
              </div>
              <div className="relative">
                <div className="flex items-center gap-3">
                  <span className={`text-xs whitespace-nowrap ${
                    patientProfile?.responseComplexity === 'simple' ? 'font-semibold text-blue-700' : 'text-medical-neutral-500'
                  }`}>Simple</span>
                  <div className="flex-1 relative">
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="1"
                      value={patientProfile?.responseComplexity === 'simple' ? 0 : 
                             patientProfile?.responseComplexity === 'detailed' ? 2 : 1}
                      onChange={async (e) => {
                        const values = ['simple', 'standard', 'detailed'];
                        const newComplexity = values[parseInt(e.target.value)];
                        const previousComplexity = patientProfile?.responseComplexity || 'standard';
                        
                        console.log('[ChatSidebar] Complexity change:', { from: previousComplexity, to: newComplexity, sliderValue: e.target.value });
                        
                        // Update local state first
                        let updatedProfileState = null;
                        setPatientProfile(prev => {
                          if (!prev) {
                            updatedProfileState = { responseComplexity: newComplexity };
                            return updatedProfileState;
                          }
                          updatedProfileState = { ...prev, responseComplexity: newComplexity };
                          return updatedProfileState;
                        });
                        
                        try {
                          const { patientService } = await import('../firebase/services');
                          // Use the updated state we just set, or fall back to merging with current
                          const profileToSave = updatedProfileState || (patientProfile ? { ...patientProfile, responseComplexity: newComplexity } : { responseComplexity: newComplexity });
                          console.log('[ChatSidebar] Saving complexity to Firebase:', newComplexity);
                          await patientService.savePatient(user.uid, profileToSave);
                          // Refresh to ensure sync
                          const refreshed = await refreshPatient();
                          console.log('[ChatSidebar] Complexity saved, refreshed profile:', refreshed || 'refreshPatient does not return');
                        } catch (error) {
                          console.error('[ChatSidebar] Error saving complexity:', error);
                          setPatientProfile(prev => {
                            if (!prev) return prev;
                            return { ...prev, responseComplexity: previousComplexity };
                          });
                        }
                      }}
                      className="w-full h-2 bg-medical-neutral-200 rounded-lg appearance-none cursor-pointer relative z-10"
                      style={{
                        background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((patientProfile?.responseComplexity === 'simple' ? 0 : patientProfile?.responseComplexity === 'detailed' ? 2 : 1) / 2) * 100}%, #e5e7eb ${((patientProfile?.responseComplexity === 'simple' ? 0 : patientProfile?.responseComplexity === 'detailed' ? 2 : 1) / 2) * 100}%, #e5e7eb 100%)`
                      }}
                      title="Adjust response complexity: Simple = plain language, Detailed = comprehensive explanations"
                    />
                    {/* Step markers */}
                    <div className="absolute top-0 left-0 right-0 h-2 flex items-center justify-between pointer-events-none z-0">
                      <div className="w-1 h-1 rounded-full bg-white"></div>
                      <div className="w-1 h-1 rounded-full bg-white"></div>
                      <div className="w-1 h-1 rounded-full bg-white"></div>
                    </div>
                  </div>
                  <span className={`text-xs whitespace-nowrap ${
                    patientProfile?.responseComplexity === 'detailed' ? 'font-semibold text-purple-700' : 'text-medical-neutral-500'
                  }`}>Detailed</span>
                </div>
              </div>
            </div>

            {/* Insight Depth Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-medical-neutral-700">
                  Insight Depth
                </label>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                  patientProfile?.insightDepth === 'basic' ? 'bg-gray-100 text-gray-700' :
                  patientProfile?.insightDepth === 'advanced' ? 'bg-orange-100 text-orange-700' :
                  patientProfile?.insightDepth === 'expert' ? 'bg-red-100 text-red-700' :
                  'bg-anchor-100 text-anchor-700'
                }`}>
                  {patientProfile?.insightDepth === 'basic' ? 'Basic' : 
                   patientProfile?.insightDepth === 'advanced' ? 'Advanced' : 
                   patientProfile?.insightDepth === 'expert' ? 'Expert' : 
                   'Standard'}
                </span>
              </div>
              <div className="relative">
                <div className="flex items-center gap-3">
                  <span className={`text-xs whitespace-nowrap ${
                    patientProfile?.insightDepth === 'basic' ? 'font-semibold text-gray-700' : 'text-medical-neutral-500'
                  }`}>Basic</span>
                  <div className="flex-1 relative">
                    <input
                      type="range"
                      min="0"
                      max="3"
                      step="1"
                      value={patientProfile?.insightDepth === 'basic' ? 0 : 
                             patientProfile?.insightDepth === 'advanced' ? 2 : 
                             patientProfile?.insightDepth === 'expert' ? 3 : 1}
                      onChange={async (e) => {
                        const value = parseInt(e.target.value);
                        const insightDepth = value === 0 ? 'basic' : value === 1 ? 'standard' : value === 2 ? 'advanced' : 'expert';
                        const previousDepth = patientProfile?.insightDepth || 'standard';
                        
                        // Update local state first
                        let updatedProfileState = null;
                        setPatientProfile(prev => {
                          if (!prev) {
                            updatedProfileState = { insightDepth };
                            return updatedProfileState;
                          }
                          updatedProfileState = { ...prev, insightDepth };
                          return updatedProfileState;
                        });
                        
                        try {
                          const { patientService } = await import('../firebase/services');
                          const profileToSave = updatedProfileState || (patientProfile ? { ...patientProfile, insightDepth } : { insightDepth });
                          console.log('[ChatSidebar] Saving insight depth to Firebase:', insightDepth);
                          await patientService.savePatient(user.uid, profileToSave);
                          // Refresh to ensure sync
                          const refreshed = await refreshPatient();
                          console.log('[ChatSidebar] Insight depth saved, refreshed profile:', refreshed || 'refreshPatient does not return');
                        } catch (error) {
                          console.error('[ChatSidebar] Error saving insight depth:', error);
                          setPatientProfile(prev => {
                            if (!prev) return prev;
                            return { ...prev, insightDepth: previousDepth };
                          });
                        }
                      }}
                      className="w-full h-2 bg-medical-neutral-200 rounded-lg appearance-none cursor-pointer relative z-10"
                      style={{
                        background: `linear-gradient(to right, #6366f1 0%, #6366f1 ${((patientProfile?.insightDepth === 'basic' ? 0 : patientProfile?.insightDepth === 'advanced' ? 2 : patientProfile?.insightDepth === 'expert' ? 3 : 1) / 3) * 100}%, #e5e7eb ${((patientProfile?.insightDepth === 'basic' ? 0 : patientProfile?.insightDepth === 'advanced' ? 2 : patientProfile?.insightDepth === 'expert' ? 3 : 1) / 3) * 100}%, #e5e7eb 100%)`
                      }}
                      title="Adjust insight depth: Basic = simple insights, Expert = full statistical analysis"
                    />
                    {/* Step markers */}
                    <div className="absolute top-0 left-0 right-0 h-2 flex items-center justify-between pointer-events-none z-0">
                      <div className="w-1 h-1 rounded-full bg-white"></div>
                      <div className="w-1 h-1 rounded-full bg-white"></div>
                      <div className="w-1 h-1 rounded-full bg-white"></div>
                      <div className="w-1 h-1 rounded-full bg-white"></div>
                    </div>
                  </div>
                  <span className={`text-xs whitespace-nowrap ${
                    patientProfile?.insightDepth === 'expert' ? 'font-semibold text-red-700' : 'text-medical-neutral-500'
                  }`}>Expert</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Input Area */}
      {!collapsed && (
      <div className={`px-3 pt-0 pb-0 bg-white ${isMobileOverlay ? 'border-t border-medical-neutral-200' : ''}`} style={{ paddingBottom: isMobileOverlay ? 'max(1rem, env(safe-area-inset-bottom, 1rem))' : '0.5rem' }}>
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder={
                currentTrialContext 
                  ? (currentTrialContext._isSearchResults
                      ? `Ask about these ${currentTrialContext._searchResultsCount} trials...`
                      : `Ask about ${currentTrialContext.title || 'this trial'}...`)
                  : currentHealthContext 
                    ? "Ask about health data..." 
                    : "Ask a question..."
              }
              className={combineClasses(
                'w-full rounded-full px-3 py-2 text-xs transition-all duration-200 min-h-[44px]',
                'border border-medical-neutral-200',
                inputText && 'pr-10',
                'focus:outline-none focus:ring-2 focus:ring-anchor-900 focus:border-anchor-900'
              )}
            />
            {inputText && (
              <button
                onClick={() => setInputText('')}
                className={combineClasses('absolute right-3 top-1/2 -translate-y-1/2', DesignTokens.colors.neutral.text[400], 'hover:text-gray-600', DesignTokens.transitions.default)}
                aria-label="Clear input"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            onClick={isBotProcessing ? () => {
              if (abortControllerRef.current) {
                abortControllerRef.current.abort();
                setIsBotProcessing(false);
                setMessages(prev => [...prev, {
                  type: 'ai',
                  text: 'Response cancelled.',
                  isAnalysis: false
                }]);
                abortControllerRef.current = null;
              }
            } : handleSendMessage}
            className={combineClasses(
              'w-10 h-10 rounded-full transition flex-shrink-0 flex items-center justify-center min-h-[44px] min-w-[44px] touch-manipulation active:opacity-90',
              isBotProcessing 
                ? 'bg-red-500 hover:bg-red-600 text-white' 
                : DesignTokens.components.button.primary,
              DesignTokens.shadows.sm
            )}
            disabled={!inputText.trim() && !isBotProcessing}
          >
            {isBotProcessing ? (
              <Square className="w-4 h-4" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
      )}

      {/* Modals */}
      {showDocumentOnboarding && (
        <DocumentUploadOnboarding
          show={showDocumentOnboarding}
          onClose={() => {
            setShowDocumentOnboarding(false);
            setDocumentOnboardingMethod('picker');
          }}
          onImportDicom={() => setShowDicomImportFlow(true)}
          onFileSelect={async (file, docType, date, note) => {
            setPendingDocumentDate(date);
            setPendingDocumentNote(note);
            // For sidebar, we'll handle uploads in a simplified way
            // Full upload functionality can be added later if needed
            setShowDocumentOnboarding(false);
          }}
          method={documentOnboardingMethod}
          hasUploadedDocument={hasUploadedDocument}
        />
      )}

      {/* DICOM Import Flow Modal */}
      {showDicomImportFlow && (
        <DicomImportFlow
          show={showDicomImportFlow}
          onClose={() => setShowDicomImportFlow(false)}
          onViewNow={null} // ChatSidebar doesn't have DICOM viewer access
          onSaveToLibrary={async (files, note) => {
            setShowDicomImportFlow(false);
            // Navigate to Files tab for full upload functionality
            if (onTabChange) {
              onTabChange('files');
            }
            // Show message that they can import from Files tab
            showSuccess('Please use the Files tab to view CT/MRI/PET scans with full functionality.');
          }}
          userId={user?.uid}
        />
      )}

      <UploadProgressOverlay
        show={isUploading}
        uploadProgress={uploadProgress}
      />

      <DeletionConfirmationModal
        show={deleteConfirm.show}
        onClose={() => {
          if (!isDeleting) {
            setDeleteConfirm({ show: false, title: '', message: '', onConfirm: null, itemName: '', confirmText: 'Yes, Delete Permanently' });
            setIsDeleting(false);
          }
        }}
        onConfirm={async () => {
          if (deleteConfirm.onConfirm) {
            await deleteConfirm.onConfirm();
          }
          setDeleteConfirm({ show: false, title: '', message: '', onConfirm: null, itemName: '', confirmText: 'Yes, Delete Permanently' });
        }}
        title={deleteConfirm.title}
        message={deleteConfirm.message}
        itemName={deleteConfirm.itemName}
        confirmText={deleteConfirm.confirmText}
        isDeleting={isDeleting}
      />
    </div>
  );
}
