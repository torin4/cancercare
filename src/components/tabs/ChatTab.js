import React, { useState, useEffect, useRef } from 'react';
import { Bot, Trash2, Send, Paperclip, Activity, Dna, Zap, Loader2, BarChart, FlaskConical, BookOpen, MessageSquare, Search, X, Filter } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { DesignTokens, Layouts, combineClasses } from '../../design/designTokens';
import { useAuth } from '../../contexts/AuthContext';
import { usePatientContext } from '../../contexts/PatientContext';
import { useHealthContext } from '../../contexts/HealthContext';
import { useBanner } from '../../contexts/BannerContext';
import { messageService, labService, vitalService, symptomService } from '../../firebase/services';
import { getSavedTrials } from '../../services/clinicalTrials/clinicalTrialsService';
import { getNotebookEntries } from '../../services/notebookService';
import { processChatMessage, generateChatExtractionSummary } from '../../services/chatProcessor';
import { processDocument, generateExtractionSummary } from '../../services/documentProcessor';
import { uploadDocument } from '../../firebase/storage';
import { generalSuggestions, trialSuggestions, healthSuggestions, timelineSuggestions } from '../../constants/chatSuggestions';
import DocumentUploadOnboarding from '../modals/DocumentUploadOnboarding';
import UploadProgressOverlay from '../UploadProgressOverlay';
import DeletionConfirmationModal from '../modals/DeletionConfirmationModal';

export default function ChatTab({ onTabChange }) {
  const { user } = useAuth();
  const { patientProfile, hasUploadedDocument } = usePatientContext();
  const { reloadHealthData } = useHealthContext();
  const { showSuccess, showError } = useBanner();

  // Get personalized suggestions based on user role
  const personalizedSuggestions = React.useMemo(() => {
    const isPatient = patientProfile?.isPatient !== false; // Default to patient
    const patientName = patientProfile?.firstName || patientProfile?.name?.split(' ')[0] || 'the patient';

    // Create personalized versions of suggestions
    const personalizeText = (text) => {
      if (!text) return text;

      if (isPatient) {
        // For patients, use "I" and "my"
        // First handle special cases where [patient] should become "my" (possessive)
        let personalized = text
          .replace(/\[patient\] doctor/gi, 'my doctor')
          .replace(/\[Patient\] doctor/gi, 'my doctor')
          .replace(/\[patient\] diagnosis/gi, 'my diagnosis')
          .replace(/\[Patient\] diagnosis/gi, 'my diagnosis')
          .replace(/\[patient\] condition/gi, 'my condition')
          .replace(/\[Patient\] condition/gi, 'my condition');
        
        // Then replace remaining [patient] with "I" (subject)
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
        // For caregivers, the question is asked BY the caregiver (use "I"), but about the PATIENT
        // First handle possessive cases where we want patient name + 's
        let personalized = text
          .replace(/\[patient\] doctor/gi, `${patientName}'s doctor`)
          .replace(/\[Patient\] doctor/gi, `${patientName}'s doctor`)
          .replace(/\[patient\] diagnosis/gi, `${patientName}'s diagnosis`)
          .replace(/\[Patient\] diagnosis/gi, `${patientName}'s diagnosis`)
          .replace(/\[patient\] condition/gi, `${patientName}'s condition`)
          .replace(/\[Patient\] condition/gi, `${patientName}'s condition`);
        
        // Then replace [patient] as subject with "I" (caregiver is asking)
        personalized = personalized.replace(/\[patient\]/gi, 'I');
        personalized = personalized.replace(/\[Patient\]/gi, 'I');
        personalized = personalized.replace(/\[condition\]/gi, `${patientName}'s condition`);

        return personalized;
      }
    };

    // Personalize button labels for caregiver mode
    const personalizeButtonLabel = (text) => {
      if (!text) return text;

      if (isPatient) {
        // Patient mode - keep as is (first person)
        return text;
      } else {
        // Caregiver mode - personalize possessive forms, but keep "I" for questions the caregiver asks
        return text
          .replace(/Tell me about my (.*)/i, `Tell me about ${patientName}'s $1`)
          .replace(/my doctor/gi, `${patientName}'s doctor`)
          .replace(/my diagnosis/gi, `${patientName}'s diagnosis`)
          .replace(/my condition/gi, `${patientName}'s condition`)
          .replace(/What should I expect (.*)/i, `What should ${patientName} expect $1`)
          .replace(/What (.*) are available/i, `What $1 are available`); // Keep generic for "what X are available"
        // Note: "What questions should I ask" stays as "I" because caregiver is asking
      }
    };

    return generalSuggestions.map(suggestion => ({
      ...suggestion,
      populateText: personalizeText(suggestion.populateText || suggestion.text),
      text: personalizeButtonLabel(suggestion.text) // Personalize button text too!
    }));
  }, [patientProfile?.isPatient, patientProfile?.firstName, patientProfile?.name]); // Use specific fields from patientProfile

  // Get personalized health suggestions
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
        // For caregivers, keep "I" (caregiver is asking), but replace patient references
        // First handle possessive cases
        let personalized = text
          .replace(/\[patient\] (latest lab results|health data|treatment|symptoms|vitals)/gi, `${patientName}'s $1`)
          .replace(/\[Patient\] (latest lab results|health data|treatment|symptoms|vitals)/gi, `${patientName}'s $1`);
        
        // Then replace [patient] with patientName for other cases
        personalized = personalized.replace(/\[patient\]/gi, patientName);
        personalized = personalized.replace(/\[Patient\]/gi, patientName);
        
        // DON'T replace "I" - caregiver is asking (first person)
        // DON'T replace "my" - it should already be handled in populateText as patientName's
        
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
        .replace(/What do my (.*)/i, `What do ${patientName}'s $1`)
        .replace(/Explain my (.*)/i, `Explain ${patientName}'s $1`);
    };

    return healthSuggestions.map(suggestion => ({
      ...suggestion,
      populateText: personalizeText(suggestion.populateText || suggestion.text),
      text: personalizeButtonLabel(suggestion.text)
    }));
  }, [patientProfile?.isPatient, patientProfile?.firstName, patientProfile?.name]);

  // Get personalized trial suggestions
  const personalizedTrialSuggestions = React.useMemo(() => {
    const isPatient = patientProfile?.isPatient !== false;
    const patientName = patientProfile?.firstName || patientProfile?.name?.split(' ')[0] || 'the patient';

    const personalizeText = (text) => {
      if (!text) return text;
      if (isPatient) {
        // Patient mode - keep as is (first person)
        return text;
      } else {
        // Caregiver mode - replace "I" with patientName, "my" with patientName's
        let personalized = text.replace(/\bAm I\b/gi, `Is ${patientName}`);
        personalized = personalized.replace(/\bam I\b/gi, `is ${patientName}`);
        personalized = personalized.replace(/\bI\b/g, patientName);
        personalized = personalized.replace(/\bmy\b/gi, `${patientName}'s`);
        return personalized;
      }
    };

    const personalizeButtonLabel = (text) => {
      if (!text || isPatient) return text;
      // Caregiver mode - replace "I" with patientName
      return text.replace(/\bAm I\b/gi, `Is ${patientName}`);
    };

    return trialSuggestions.map(suggestion => ({
      ...suggestion,
      populateText: personalizeText(suggestion.populateText || suggestion.text),
      text: personalizeButtonLabel(suggestion.text)
    }));
  }, [patientProfile?.isPatient, patientProfile?.firstName, patientProfile?.name]);

  // Get personalized timeline suggestions
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
        // For caregivers, replace patient references with patientName, but keep structure
        let personalized = text.replace(/\[patient\]/gi, patientName);
        personalized = personalized.replace(/\[Patient\]/gi, patientName);
        personalized = personalized.replace(/\[date\]/gi, 'January 3rd');
        // For timeline questions, "I" becomes patientName (third person)
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
  const [suggestionsKey, setSuggestionsKey] = useState(0); // Force re-render when role changes
  const [isBotProcessing, setIsBotProcessing] = useState(false);

  // Document upload state
  const [showDocumentOnboarding, setShowDocumentOnboarding] = useState(false);
  const [documentOnboardingMethod, setDocumentOnboardingMethod] = useState('picker');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [pendingDocumentDate, setPendingDocumentDate] = useState(null);
  const [pendingDocumentNote, setPendingDocumentNote] = useState(null);
  const [documents, setDocuments] = useState([]);

  // Load profile image: prioritize uploaded profileImage, then Google photoURL
  useEffect(() => {
    if (patientProfile?.profileImage) {
      setProfileImage(patientProfile.profileImage);
    } else if (user?.photoURL) {
      setProfileImage(user.photoURL);
    } else {
      setProfileImage(null);
    }
  }, [user, patientProfile]);

  // Check sessionStorage for trial/health context when component mounts
  useEffect(() => {
    // Check for trial context from ClinicalTrials component
    const trialContextStr = sessionStorage.getItem('currentTrialContext');
    if (trialContextStr) {
      try {
        const trialContext = JSON.parse(trialContextStr);
        setCurrentTrialContext(trialContext);
        sessionStorage.removeItem('currentTrialContext');
        
        // Check for trial context message
        const trialMessageStr = sessionStorage.getItem('trialContextMessage');
        if (trialMessageStr) {
          const trialMessage = JSON.parse(trialMessageStr);
          setMessages(prev => [...prev, trialMessage]);
          sessionStorage.removeItem('trialContextMessage');
        }
      } catch (error) {
      }
    }

    // Check for health context from HealthTab
    const healthContextStr = sessionStorage.getItem('currentHealthContext');
    if (healthContextStr) {
      try {
        const healthContext = JSON.parse(healthContextStr);
        setCurrentHealthContext(healthContext);
        sessionStorage.removeItem('currentHealthContext');
      } catch (error) {
      }
    }

    // Check for notebook context from FilesTab
    const notebookContextStr = sessionStorage.getItem('currentNotebookContext');
    if (notebookContextStr) {
      try {
        const notebookContext = JSON.parse(notebookContextStr);
        setCurrentNotebookContext(notebookContext);
        sessionStorage.removeItem('currentNotebookContext');
      } catch (error) {
      }
    }

    // Pending Quick Log messages are handled in a separate useEffect below
  }, []);

  // Load chat history when chat tab is opened (only once per session)
  useEffect(() => {
    const loadChatHistory = async () => {
      if (user && !chatHistoryLoaded) {
        try {
          const savedMessages = await messageService.getMessages(user.uid, 100);
          if (savedMessages.length > 0) {
            setMessages(savedMessages.map(msg => ({
              type: msg.type,
              text: msg.text,
              isAnalysis: msg.isAnalysis || false
            })));
          }
          setChatHistoryLoaded(true);
        } catch (error) {
          setChatHistoryLoaded(true); // Mark as loaded even on error to prevent retry loops
        }
      }
    };
    loadChatHistory();
  }, [user, chatHistoryLoaded]);

  // Process upload summary from document upload
  useEffect(() => {
    const uploadSummaryStr = sessionStorage.getItem('uploadSummary');
    if (uploadSummaryStr && user) {
      try {
        const uploadSummaryData = JSON.parse(uploadSummaryStr);
        // Only process if it's from the last 30 seconds (to avoid showing old summaries)
        const thirtySecondsAgo = Date.now() - 30000;
        if (uploadSummaryData.timestamp > thirtySecondsAgo) {
          sessionStorage.removeItem('uploadSummary');
          
          // Add the upload summary as an assistant message
          const summaryMessage = {
            type: 'assistant',
            text: uploadSummaryData.summary,
            isAnalysis: false,
            documentType: uploadSummaryData.documentType // Store documentType in message for button logic
          };
          
          setMessages(prev => [...prev, summaryMessage]);
          
          // Save the summary message to Firestore
          messageService.addMessage({
            patientId: user.uid,
            type: 'assistant',
            text: uploadSummaryData.summary,
            isAnalysis: false
          });
          
          // Auto-scroll to bottom to show the summary
          setTimeout(() => {
            scrollToBottom();
          }, 100);
        }
      } catch (error) {
        sessionStorage.removeItem('uploadSummary');
      }
    }
  }, [user, chatHistoryLoaded]);

  // Track processing state to prevent race conditions
  const isProcessingPendingRef = useRef(false);

  // Process pending Quick Log message
  useEffect(() => {
    if (isProcessingPendingRef.current) return;
    
    const pendingMessageStr = sessionStorage.getItem('pendingQuickLogMessage');
    if (pendingMessageStr && user) {
      try {
        const pendingMessage = JSON.parse(pendingMessageStr);
        if (pendingMessage.type === 'user') {
          sessionStorage.removeItem('pendingQuickLogMessage');
          // Process the message
          const processPendingMessage = async () => {
            if (isProcessingPendingRef.current) return;
            isProcessingPendingRef.current = true;
            
            const userMessage = pendingMessage.text;
            
            // Add user message immediately
            const userMsg = { type: 'user', text: userMessage };
            setMessages(prev => [...prev, userMsg]);
            
            // Save user message to Firestore
            messageService.addMessage({
              patientId: user.uid,
              type: 'user',
              text: userMessage,
              isAnalysis: false
            });

            try {
              // Process message with AI
              const result = await processChatMessage(
                userMessage,
                user.uid,
                [],
                null,
                null,
                null,
                patientProfile
              );

              let responseText = result.response;
              if (result.extractedData) {
                const summary = generateChatExtractionSummary(result.extractedData);
                if (summary) {
                  responseText += summary;
                }
              }

              const aiMsg = {
                type: 'ai',
                text: responseText,
                isAnalysis: !!result.extractedData
              };
              setMessages(prev => [...prev, aiMsg]);

              // Save AI message to Firestore
              messageService.addMessage({
                patientId: user.uid,
                type: 'ai',
                text: responseText,
                isAnalysis: !!result.extractedData,
                extractedData: result.extractedData || null
              });

              // Clear loading state
              setIsBotProcessing(false);
              isProcessingPendingRef.current = false;
              
              // Reload health data if values were extracted
              if (result.extractedData) {
                await reloadHealthData();
              }
            } catch (error) {
              
              // Clear loading state
              setIsBotProcessing(false);
              isProcessingPendingRef.current = false;
              
              const errorMsg = {
                type: 'ai',
                text: 'Sorry, I\'m having trouble processing your message right now. Please try again in a moment.'
              };
              setMessages(prev => [...prev, errorMsg]);
            }
          };
          
          // Process after a brief delay to ensure component is ready
          setTimeout(processPendingMessage, 200);
        }
      } catch (error) {
        // Error parsing or processing pending message; cleanup and continue
        // Error is silently handled to avoid disrupting user experience
        isProcessingPendingRef.current = false;
        sessionStorage.removeItem('pendingQuickLogMessage');
      }
    }
  }, [user, patientProfile, reloadHealthData]);

  // Force re-render of suggestions when role changes or suggestions update
  useEffect(() => {
    // Force re-render by updating key whenever suggestions change
    setSuggestionsKey(prev => prev + 1);
  }, [personalizedSuggestions, personalizedHealthSuggestions, personalizedTimelineSuggestions]); // Depend on all personalized suggestions

  // Cycle suggestions when entering chat
  useEffect(() => {
    setSuggestionIndex(prev => (prev + 1) % Math.ceil(personalizedSuggestions.length / 4));
  }, [personalizedSuggestions]); // Re-calculate when role changes

  // Auto-scroll to bottom when messages change (including content updates)
  const scrollToBottom = React.useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, []);

  // Auto-scroll when messages change (length or content)
  useEffect(() => {
    if (messages.length > 0) {
      // Use a small delay to ensure DOM is updated
      const timeoutId = setTimeout(() => {
        scrollToBottom();
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [messages, scrollToBottom]);

  // Auto-scroll when navigating to chat tab (component becomes visible)
  useEffect(() => {
    // Scroll to bottom when component mounts or when messages are loaded
    if (chatHistoryLoaded && messages.length > 0) {
      const timeoutId = setTimeout(() => {
        scrollToBottom();
      }, 200);
      return () => clearTimeout(timeoutId);
    }
  }, [chatHistoryLoaded, scrollToBottom]);

  // Cleanup old messages (older than 90 days) - run once per day
  useEffect(() => {
    if (!user) return;

    const cleanupOldMessages = async () => {
      try {
        const allMessages = await messageService.getMessages(user.uid, 1000);
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        
        const oldMessages = allMessages.filter(msg => {
          const msgDate = msg.createdAt?.toDate ? msg.createdAt.toDate() : new Date(msg.createdAt);
          return msgDate < ninetyDaysAgo;
        });

        // Delete old messages (limit to 50 at a time to avoid rate limits)
        for (const msg of oldMessages.slice(0, 50)) {
          try {
            await messageService.deleteMessage(msg.id);
          } catch (err) {
          }
        }
      } catch (error) {
      }
    };

    // Run cleanup once per day (check localStorage for last cleanup time)
    const lastCleanup = localStorage.getItem(`chatCleanup_${user.uid}`);
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    if (!lastCleanup || (now - parseInt(lastCleanup)) > oneDay) {
      cleanupOldMessages();
      localStorage.setItem(`chatCleanup_${user.uid}`, now.toString());
    }
  }, [user]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || !user) return;

    const userMessage = inputText;
    setInputText('');

    // Add user message immediately
    const userMsg = { type: 'user', text: userMessage };
    setMessages(prev => [...prev, userMsg]);
    
    // Auto-scroll to bottom after user message
    setTimeout(() => {
      scrollToBottom();
    }, 50);

    // Save user message to Firestore (async, don't wait)
    if (user) {
      messageService.addMessage({
        patientId: user.uid,
        type: 'user',
        text: userMessage,
        isAnalysis: false
      });
    
    // Set loading state
    setIsBotProcessing(true);
    }

    try {
      // Auto-load health context if user asks about health data but context isn't set
      let healthContextToUse = currentHealthContext;
      const requiresHealthData = /(explain|analyze|what does|how is|trend|progress|mean|interpret|my (lab|labs|vital|vitals|symptom|symptoms|health|treatment|medication|medications)|ca-125|hemoglobin|blood pressure|heart rate|temperature|weight)/i.test(userMessage);
      
      if (requiresHealthData && !healthContextToUse && user) {
        try {
          const labs = await labService.getLabs(user.uid);
          const vitals = await vitalService.getVitals(user.uid);
          const symptoms = await symptomService.getSymptoms(user.uid);
          
          // Load ALL values for each lab and vital (with dates and notes)
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
          // Optionally set it for future messages
          setCurrentHealthContext(healthContextToUse);
        } catch (error) {
        }
      }

      // Auto-load notebook context if user asks about history/timeline but context isn't set
      // Detect if user is ADDING data (not asking about it) - these patterns indicate the user is providing new data
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

      // Auto-load trial context if user asks about trials but context isn't set
      const requiresTrialData = !currentTrialContext && /(saved trial|saved trials|my trial|my trials|clinical trial|clinical trials|trial i saved|trials i saved|what trials|which trials|show me trials|tell me about trials|ask about trial)/i.test(userMessage);
      
      if (requiresTrialData && user) {
        try {
          const savedTrials = await getSavedTrials(user.uid);
          if (savedTrials && savedTrials.length > 0) {
            // Set the first saved trial as context, or the most recent one
            // Handle Firestore Timestamp objects properly
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
            
            // Ensure trial has required fields for context
            if (trialToUse) {
              setCurrentTrialContext(trialToUse);
              setMessages(prev => [...prev, {
                type: 'ai',
                text: `I'm ready to answer questions about "${trialToUse.title || 'your saved trials'}". You can ask me about the drugs being used, what phase the study is in, eligibility criteria, or anything else about the trial.`
              }]);
            }
          }
        } catch (error) {
          // Don't block message processing if trial loading fails
        }
      }

      // Process message with AI to extract and save medical data
      const result = await processChatMessage(
        userMessage,
        user.uid,
        messages.slice(-10).map(msg => ({
          role: msg.type === 'user' ? 'user' : 'assistant',
          content: msg.text
        })),
        currentTrialContext, // Pass trial context if available
        healthContextToUse, // Pass health context (auto-loaded if needed)
        notebookContextToUse, // Pass notebook context (auto-loaded if needed)
        patientProfile // Pass patient profile for demographic-based normal ranges
      );

      // Build response text
      let responseText = result.response;

      // Add extraction summary if data was extracted
      if (result.extractedData) {
        const summary = generateChatExtractionSummary(result.extractedData);
        if (summary) {
          responseText += summary;
        }
      }

      // Clear loading state
      setIsBotProcessing(false);
      
      // Add AI response
      const aiMsg = {
        type: 'ai',
        text: responseText,
        isAnalysis: !!result.extractedData
      };
      setMessages(prev => [...prev, aiMsg]);
      
      // Auto-scroll to bottom after AI response
      setTimeout(() => {
        scrollToBottom();
      }, 100);

      // Save AI message to Firestore (async, don't wait)
      if (user) {
        messageService.addMessage({
          patientId: user.uid,
          type: 'ai',
          text: responseText,
          isAnalysis: !!result.extractedData,
          extractedData: result.extractedData || null
        });
      }

      // Reload health data if values were extracted
      if (result.extractedData) {
        await reloadHealthData();
      }

    } catch (error) {
      
      // Clear loading state
      setIsBotProcessing(false);
      
      const errorMsg = {
        type: 'ai',
        text: 'Sorry, I\'m having trouble processing your message right now. Please try again in a moment.'
      };
      setMessages(prev => [...prev, errorMsg]);
      
      // Auto-scroll to bottom after error message
      setTimeout(() => {
        scrollToBottom();
      }, 100);
      
      // Save error message to Firestore (async, don't wait)
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

  const handleRealFileUpload = async (file, docType) => {
    if (!user) {
      showError('Please log in to upload files');
      return;
    }

    try {
      // Ensure we're on the chat tab before starting
      onTabChange('chat');

      // Show loading overlay
      setIsUploading(true);
      setUploadProgress('Reading document...');

      // Get document date and note (user-provided or null)
      const providedDate = pendingDocumentDate;
      const providedNote = pendingDocumentNote;
      // Clear pending date and note after use
      setPendingDocumentDate(null);
      setPendingDocumentNote(null);

      // Show processing message
      setMessages(prev => [...prev,
        { type: 'user', text: `Uploading: ${file.name}`, isUpload: true },
        { type: 'ai', text: `Processing document... This may take a moment.`, isAnalysis: true }
      ]);

      // Step 1: Process document with AI to extract medical data
      setUploadProgress('Analyzing document with AI...');
      // Note: documentId will be null for new uploads, set after document is saved
      const processingResult = await processDocument(file, user.uid, patientProfile, providedDate, providedNote, null);

      // Step 2: Upload file to Firebase Storage
      setUploadProgress('Uploading to secure storage...');
      // Use user-provided date, or AI-extracted date, or null (will default to today)
      const dateForFilename = providedDate || processingResult.extractedDate || null;
      
      const uploadResult = await uploadDocument(file, user.uid, {
        category: processingResult.documentType || docType,
        documentType: processingResult.documentType || docType,
        date: dateForFilename, // Pass the date (user-provided or AI-extracted) for filename
        note: providedNote || null // Store note with document record
      });


      // Step 3: Link all extracted values to the document ID
      setUploadProgress('Linking data to document...');
      if (processingResult.extractedData && uploadResult.id) {
        try {
          const { linkValuesToDocument } = await import('../../services/documentProcessor');
          await linkValuesToDocument(processingResult.extractedData, uploadResult.id, user.uid);
        } catch (linkError) {
        }
      }

      // Don't set generic "Saving extracted data" - let the specific aiStatus messages show instead
      // setUploadProgress('Saving extracted data...');

      // Step 4: Add to local documents state
      // Use user-provided date or today
      const docDate = providedDate || new Date().toISOString().split('T')[0];
      const newDoc = {
        id: uploadResult.id,
        name: file.name,
        type: processingResult.documentType || docType,
        date: docDate,
        fileUrl: uploadResult.fileUrl,
        storagePath: uploadResult.storagePath,
        icon: (processingResult.documentType || docType).toLowerCase(),
        note: providedNote || null // Include note in local state
      };

      setDocuments(prev => [newDoc, ...prev]);

      // Step 4: Generate summary of extracted data
      const summary = generateExtractionSummary(
        processingResult.extractedData,
        processingResult.extractedData
      );

      // Update messages with extraction results
      setMessages(prev => [
        ...prev.slice(0, -1), // Remove "Processing..." message
        {
          type: 'ai',
          text: `Document processed successfully!\n\nDocument Type: ${processingResult.documentType}\n\n${summary}\n\nAll data has been automatically saved to your health records.`,
          isAnalysis: true
        }
      ]);

      // Reload health data to show new values
      setUploadProgress('Refreshing your health data...');
      await reloadHealthData();

      onTabChange('chat');
      setIsUploading(false);
      setUploadProgress('');
    } catch (error) {

      // Update messages with error
      setMessages(prev => [
        ...prev.slice(0, -1), // Remove "Processing..." message
        {
          type: 'ai',
          text: `Failed to process document: ${error.message}\n\nThe file was not uploaded. Please try again or contact support if the issue persists.`
        }
      ]);

      setIsUploading(false);
      setUploadProgress('');
    }
  };

  const simulateDocumentUpload = (docType) => {
    // Create a file input element
    const input = document.createElement('input');
    input.type = 'file';
    // Accept common document and genomic data file types (vcf, maf, bed, txt, csv, tsv, compressed)
    input.accept = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.vcf,.vcf.gz,.maf,.bed,.txt,.csv,.tsv,.zip,.gz,.xlsx,.xls';

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        await handleRealFileUpload(file, docType);
      }
    };

    input.click();
  };

  const simulateCameraUpload = (docType) => {
    const input = document.createElement('input');
    input.type = 'file';
    // Accept common document types and images
    input.accept = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.vcf,.vcf.gz,.maf,.bed,.txt,.csv,.tsv,.zip,.gz,.xlsx,.xls,image/*';
    // Hint mobile devices to open camera (this enables camera option in file picker)
    input.capture = 'environment';

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        await handleRealFileUpload(file, docType);
      }
    };

    input.click();
  };

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className={combineClasses(
          DesignTokens.spacing.container.mobile,
          'sm:px-4 md:px-6',
          'py-2 sm:py-3',
          'border-b',
          DesignTokens.borders.color.default,
          'flex items-center'
        )}>
          <div className={combineClasses('flex items-center justify-between w-full', DesignTokens.spacing.gap.sm)}>
            <div className={combineClasses('flex items-center', DesignTokens.spacing.gap.sm, 'sm:gap-3')}>
              <div className={combineClasses(DesignTokens.components.header.iconContainer)}>
                <MessageSquare className={combineClasses(DesignTokens.icons.header.size.full, DesignTokens.components.header.icon)} />
              </div>
              <div>
                <h1 className={combineClasses(DesignTokens.components.header.title, 'mb-0')}>Chat</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {messages.length > 0 && (
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
                      <Search className="w-5 h-5 sm:w-5 sm:h-5" />
                  </button>
                  <button
                    onClick={() => {
                      if (!user) return;
                      setDeleteConfirm({
                        show: true,
                        title: 'Clear All Chat History?',
                        message: 'This will remove all conversation history but keep your health data context. The AI can still access your health data and trials from the database when needed.',
                        itemName: 'all chat history',
                        confirmText: 'Yes, Clear History',
                        onConfirm: async () => {
                          setIsDeleting(true);
                          try {
                            await messageService.deleteAllMessages(user.uid);
                            setMessages([]);
                            // Don't clear health/trial contexts - those represent the user's actual data, not conversation history
                            // The AI can still access health data and trials from the database when needed
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
                    <Trash2 className="w-5 h-5 sm:w-5 sm:h-5" />
                    <span className="hidden sm:inline">Clear History</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
        {/* Search Bar */}
        {isSearchActive && (
          <div className={combineClasses(
            DesignTokens.spacing.container.mobile,
            'sm:px-4 md:px-6',
            'py-3',
            'border-b',
            DesignTokens.borders.color.default,
            'bg-white'
          )}>
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
        <div 
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 sm:space-y-3 pb-48 md:pb-3"
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
            
            return filteredMessages.map((msg, idx) => {
            // Find original index for key
            const originalIdx = messages.indexOf(msg);
            return (
            <div key={originalIdx} className={`flex items-start gap-2 sm:gap-3 ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.type === 'ai' && (
                <div className={combineClasses('flex-shrink-0 flex items-center justify-center', DesignTokens.components.chat.avatar)}>
                  <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
              )}
              <div className={combineClasses(
                'max-w-[82%] sm:max-w-[70%]',
                msg.type === 'user'
                  ? DesignTokens.components.chat.userBubble
                  : msg.isAnalysis
                    ? DesignTokens.components.chat.analysisBubble
                    : DesignTokens.components.chat.aiBubble
              )}>
                {msg.type === 'user' ? (
                  <p className="text-sm sm:text-base whitespace-pre-wrap">{msg.text}</p>
                ) : (
                  <div className="text-sm sm:text-base prose prose-sm max-w-none">
                     {/* Check if this is an upload summary and add action buttons */}
                     {msg.text.includes('**Document uploaded successfully!**') && (() => {
                       // Check if this is a genomic upload
                       // First check if documentType is stored in the message object
                       const docType = msg.documentType || '';
                       let isGenomicUpload = docType === 'Genomic' || docType === 'genomic-profile' || docType.toLowerCase().includes('genomic');
                       
                       // Fallback: check message text if documentType not available
                       if (!isGenomicUpload) {
                         isGenomicUpload = msg.text.includes('Genomic Profile Updated') || msg.text.toLowerCase().includes('genomic');
                       }
                       
                       // Check if this is a labs/vitals upload
                       const isLabsVitalsUpload = msg.text.includes('Lab Results') || msg.text.includes('Vital Signs') || msg.text.includes('Medications');
                       
                       return (
                         <div className="mb-4">
                           <h3 className={combineClasses('text-sm font-semibold mb-2', DesignTokens.colors.neutral.text[700])}>
                             {isGenomicUpload ? 'Quick Actions' : 'Quick Actions'}
                           </h3>
                           <div className="flex flex-wrap gap-2">
                             {isGenomicUpload ? (
                               <>
                                 <button
                                   onClick={() => {
                                     // Store flag to expand genomic profile
                                     sessionStorage.setItem('expandGenomicProfile', 'true');
                                     onTabChange('profile');
                                   }}
                                   className={combineClasses(DesignTokens.components.button.chip.base, DesignTokens.components.button.chip.purple)}
                                 >
                                   <Dna className="w-3 h-3" />
                                   View Profile
                                 </button>
                                 <button
                                   onClick={() => onTabChange('trials')}
                                   className={combineClasses(DesignTokens.components.button.chip.base, DesignTokens.components.button.chip.success)}
                                 >
                                   <Activity className="w-3 h-3" />
                                   Search Trials
                                 </button>
                               </>
                             ) : (
                               <>
                                 <button
                                   onClick={() => onTabChange('health')}
                                   className={combineClasses(DesignTokens.components.button.chip.base, DesignTokens.components.button.chip.primary)}
                                 >
                                   <Activity className="w-3 h-3" />
                                   View Health Data
                                 </button>
                                 {isLabsVitalsUpload && (
                                   <button
                                     onClick={async () => {
                                       // Pre-load health context before sending the message
                                       let healthContext = null;
                                       if (user && !currentHealthContext) {
                                         try {
                                           const labs = await labService.getLabs(user.uid);
                                           const vitals = await vitalService.getVitals(user.uid);
                                           const symptoms = await symptomService.getSymptoms(user.uid);
                                           
                                           // Load ALL values for each lab and vital (with dates and notes)
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
                                           
                                           healthContext = {
                                             labs: labsWithValues,
                                             vitals: vitalsWithValues,
                                             symptoms: symptoms
                                           };
                                           setCurrentHealthContext(healthContext);
                                         } catch (error) {
                                         }
                                       } else {
                                         healthContext = currentHealthContext;
                                       }

                                       // Build a smart prompt based on what data is available
                                       const hasLabs = healthContext?.labs?.length > 0;
                                       const hasVitals = healthContext?.vitals?.length > 0;
                                       const hasSymptoms = healthContext?.symptoms?.length > 0;

                                       let analysisPrompt = 'Analyze my ';
                                       const dataTypes = [];
                                       if (hasLabs) dataTypes.push('latest lab results');
                                       if (hasVitals) dataTypes.push('vitals');
                                       if (hasSymptoms) dataTypes.push('symptoms');

                                       if (dataTypes.length === 0) {
                                         analysisPrompt = 'What should I know about the data you just extracted?';
                                       } else if (dataTypes.length === 1) {
                                         analysisPrompt += dataTypes[0] + '. What\'s most important?';
                                       } else if (dataTypes.length === 2) {
                                         analysisPrompt += dataTypes.join(' and ') + '. What\'s most important?';
                                       } else {
                                         analysisPrompt += dataTypes.slice(0, -1).join(', ') + ', and ' + dataTypes[dataTypes.length - 1] + '. What\'s most important?';
                                       }

                                       setInputText(analysisPrompt);
                                       setTimeout(() => handleSendMessage(), 150);
                                     }}
                                    className={combineClasses(DesignTokens.components.button.chip.base, DesignTokens.components.button.chip.primary)}
                                  >
                                    <Zap className="w-3 h-3" />
                                    Quick Analysis
                                   </button>
                                 )}
                               </>
                             )}
                           </div>
                         </div>
                       );
                     })()}
                    <ReactMarkdown
                      components={{
                        p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                        ul: ({node, ...props}) => <ul className="list-disc list-inside mb-2 space-y-1" {...props} />,
                        ol: ({node, ...props}) => <ol className="list-decimal list-inside mb-2 space-y-1" {...props} />,
                        li: ({node, ...props}) => <li className="ml-2" {...props} />,
                        strong: ({node, ...props}) => <strong className="font-semibold" {...props} />,
                        em: ({node, ...props}) => <em className="italic" {...props} />,
                        code: ({node, ...props}) => <code className="bg-medical-neutral-100 px-1.5 py-0.5 rounded text-xs font-mono" {...props} />,
                        h1: ({node, ...props}) => <h1 className="text-lg font-bold mb-2 mt-3 first:mt-0" {...props} />,
                        h2: ({node, ...props}) => <h2 className="text-base font-bold mb-2 mt-3 first:mt-0" {...props} />,
                        h3: ({node, ...props}) => <h3 className="text-sm font-bold mb-1 mt-2 first:mt-0" {...props} />,
                        blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-medical-neutral-300 pl-3 italic my-2" {...props} />,
                        a: ({node, ...props}) => <a className="text-gray-800 underline hover:text-gray-900" {...props} />,
                      }}
                    >
                      {msg.text}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
              {msg.type === 'user' && (
                <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden shadow-sm">
                  {profileImage ? (
                    <img 
                      src={profileImage} 
                      alt="Profile" 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-600 flex items-center justify-center text-white text-xs font-bold">
                      {(() => {
                        // If caregiver mode, use caregiver name for initials
                        let name;
                        if (patientProfile?.isPatient === false && patientProfile?.caregiverName) {
                          name = patientProfile.caregiverName;
                        } else {
                          name = patientProfile.firstName || patientProfile.lastName 
                            ? `${patientProfile.firstName || ''} ${patientProfile.lastName || ''}`.trim()
                            : patientProfile.name || user?.displayName || 'U';
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
            );
            });
          })()}
          
          {/* Loading indicator when bot is processing */}
          {isBotProcessing && (
            <div className="flex items-start gap-2 sm:gap-3 justify-start">
              <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-gray-800 to-gray-600 flex items-center justify-center shadow-sm">
                <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div className="max-w-[82%] sm:max-w-[70%] rounded-2xl px-3 py-2 sm:px-4 sm:py-2.5 bg-white border border-medical-neutral-200 text-medical-neutral-900">
                <div className="flex items-center gap-2 text-sm sm:text-base">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-800" />
                  <span className="text-medical-neutral-600">Analyzing...</span>
                </div>
              </div>
            </div>
          )}
          
          {/* Scroll target - invisible element at the end of messages */}
          <div ref={messagesEndRef} className="h-1" />
        </div>

        {/* Trial Context Indicator */}
        {currentTrialContext && (
          <div className={combineClasses('p-2.5 sm:p-3 border-b flex items-center justify-between gap-2', DesignTokens.moduleAccent.trials.bg, DesignTokens.moduleAccent.trials.border)}>
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
              <span className={combineClasses('text-xs sm:text-sm font-medium flex-shrink-0', DesignTokens.moduleAccent.trials.text)}>Discussing:</span>
              <span className={combineClasses('text-xs sm:text-sm truncate', DesignTokens.moduleAccent.trials.text)}>{currentTrialContext.title || 'Trial'}</span>
            </div>
            <button
              onClick={() => {
                setCurrentTrialContext(null);
                setMessages(prev => [...prev, {
                  type: 'ai',
                  text: 'Trial context cleared. You can now ask general questions or ask about a different trial.'
                }]);
              }}
              className={combineClasses('text-xs sm:text-sm underline flex-shrink-0 min-h-[44px] min-w-[44px] px-2 touch-manipulation active:opacity-70', DesignTokens.moduleAccent.trials.text, `hover:${DesignTokens.moduleAccent.trials.text.replace('text-', 'text-').replace('600', '800')}`)}
            >
              Clear
            </button>
          </div>
        )}

        {/* Health Context Indicator */}
        {currentHealthContext && (
          <div className="p-2.5 sm:p-3 bg-medical-primary-50 border-b border-medical-primary-200 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
              <span className="text-medical-primary-600 text-xs sm:text-sm font-medium flex-shrink-0">Discussing:</span>
              <span className="text-medical-primary-800 text-xs sm:text-sm truncate">Your Health Data (Labs, Vitals, Symptoms)</span>
            </div>
            <button
              onClick={() => {
                setCurrentHealthContext(null);
                setMessages(prev => [...prev, {
                  type: 'ai',
                  text: 'Health context cleared. You can now ask general questions or ask about different health data.'
                }]);
              }}
              className="text-medical-primary-600 hover:text-medical-primary-800 text-xs sm:text-sm underline flex-shrink-0 min-h-[44px] min-w-[44px] px-2 touch-manipulation active:opacity-70"
            >
              Clear
            </button>
          </div>
        )}

        {/* Notebook Context Indicator */}
        {currentNotebookContext && (
          <div className="p-2.5 sm:p-3 bg-yellow-50 border-b border-yellow-200 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
              <span className="text-yellow-600 text-xs sm:text-sm font-medium flex-shrink-0">Discussing:</span>
              <span className="text-yellow-800 text-xs sm:text-sm truncate">Your Health History & Timeline</span>
            </div>
            <button
              onClick={() => {
                setCurrentNotebookContext(null);
                setMessages(prev => [...prev, {
                  type: 'ai',
                  text: 'History/timeline context cleared. You can now ask general questions or ask about different topics.'
                }]);
              }}
              className="text-yellow-600 hover:text-yellow-700 text-xs sm:text-sm underline flex-shrink-0 min-h-[44px] min-w-[44px] px-2 touch-manipulation active:opacity-70"
            >
              Clear
            </button>
          </div>
        )}

        {/* Chat Suggestions - Mobile Only */}
        <div
          className="px-3 sm:px-4 py-1.5 sm:py-2 bg-white border-t border-medical-neutral-200 md:hidden"
        >
          <div className="flex gap-2 overflow-x-auto -mx-1 px-1 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {(() => {
              // Determine which suggestions to show based on active context
              let suggestionsToShow = personalizedSuggestions;
              if (currentTrialContext) {
                suggestionsToShow = personalizedTrialSuggestions;
              } else if (currentHealthContext && !currentTrialContext && !currentNotebookContext) {
                suggestionsToShow = personalizedHealthSuggestions;
              } else if (currentNotebookContext && !currentHealthContext && !currentTrialContext) {
                suggestionsToShow = personalizedTimelineSuggestions;
              }
              
              return suggestionsToShow.map((suggestion, idx) => {
                // Store populateText in a const to ensure we capture the current value
                const currentPopulateText = suggestion.populateText || suggestion.text;

                // Create a unique key that includes a hash of the populateText to force re-render
                const textHash = currentPopulateText.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                const suggestionKey = `suggestion-${suggestionsKey}-${patientProfile?.isPatient}-${idx}-${textHash}`;

                // Map background colors to text colors
                const getTextColor = (bgColor) => {
                  if (bgColor.includes('medical-secondary')) return DesignTokens.colors.app.text[900];
                  if (bgColor.includes('medical-primary')) return 'text-medical-primary-600';
                  if (bgColor.includes('yellow')) return 'text-yellow-600';
                  if (bgColor.includes('care')) return 'text-care-600';
                  if (bgColor.includes('medical-accent')) return 'text-medical-accent-600';
                  if (bgColor.includes('anchor')) return DesignTokens.colors.app.text[900];
                  return DesignTokens.colors.app.text[700];
                };

                return (
                  <button
                    key={suggestionKey}
                    onClick={() => {
                      setInputText(currentPopulateText);
                      // Focus on input after setting text
                      setTimeout(() => {
                        const input = document.querySelector('input[type="text"]');
                        if (input) input.focus();
                      }, 0);
                    }}
                    className={combineClasses('px-2 py-1 sm:px-3 sm:py-1 text-xs sm:text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 flex items-center gap-1.5 sm:gap-2 touch-manipulation', getTextColor(suggestion.color), 'hover:opacity-80')}
                  >
                    {suggestion.icon && <suggestion.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                    {suggestion.text}
                  </button>
                );
              });
            })()}
          </div>
        </div>

        <div className="fixed bottom-20 left-0 right-0 z-20 md:relative md:bottom-auto md:z-auto px-3 sm:px-4 pt-3 md:pt-2 lg:pt-3 pb-2 sm:pb-3 bg-white border-t border-medical-neutral-200 md:border-t-0 md:border-t">
          {/* Context Selector - Compact */}
          <div className="flex gap-2 items-center">
            <div className={combineClasses('flex items-center gap-1.5', DesignTokens.colors.neutral.text[600], 'whitespace-nowrap flex-shrink-0')}>
              <Filter className={combineClasses('w-3.5 h-3.5', DesignTokens.colors.neutral.text[500])} />
              <span className={combineClasses('text-xs font-medium')}>Context:</span>
            </div>
            <button
              onClick={async () => {
                if (!user) return;
                
                // If already active, disable it
                if (currentHealthContext && !currentTrialContext && !currentNotebookContext) {
                  setCurrentHealthContext(null);
                  return;
                }
                
                try {
                  // Clear other contexts and set health context optimistically
                  setCurrentTrialContext(null);
                  setCurrentNotebookContext(null);
                  setCurrentHealthContext({ labs: [], vitals: [], symptoms: [] }); // Optimistic update
                  
                  // Load health context
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
                } catch (error) {
                  showError('Error loading health data');
                  setCurrentHealthContext(null); // Reset on error
                }
              }}
              className={combineClasses(
                'px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 flex items-center gap-1.5 touch-manipulation',
                currentHealthContext && !currentTrialContext && !currentNotebookContext
                  ? combineClasses(DesignTokens.colors.primary[500], 'text-white')
                  : combineClasses('border-2 border-medical-primary-300', DesignTokens.colors.primary.text[600], `hover:bg-medical-primary-50`, `hover:border-medical-primary-400`)
              )}
            >
              <BarChart className="w-3.5 h-3.5" />
              <span>Health Data</span>
            </button>
            
            <button
              onClick={async () => {
                if (!user) return;
                
                // If already active, disable it
                if (currentNotebookContext && !currentHealthContext && !currentTrialContext) {
                  setCurrentNotebookContext(null);
                  return;
                }
                
                try {
                  // Clear other contexts and set notebook context optimistically
                  setCurrentHealthContext(null);
                  setCurrentTrialContext(null);
                  setCurrentNotebookContext({ entries: [] }); // Optimistic update
                  
                  // Load notebook context
                  const entries = await getNotebookEntries(user.uid, { limit: 50 });
                  setCurrentNotebookContext({ entries });
                } catch (error) {
                  showError('Error loading timeline');
                  setCurrentNotebookContext(null); // Reset on error
                }
              }}
              className={combineClasses(
                'px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 flex items-center gap-1.5 touch-manipulation',
                currentNotebookContext && !currentHealthContext && !currentTrialContext
                  ? combineClasses('bg-yellow-500', 'text-white')
                  : combineClasses('border-2 border-yellow-300', 'text-yellow-600', `hover:bg-yellow-50`, `hover:border-yellow-400`)
              )}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Notebook</span>
            </button>

            {/* Vertical Divider - Between Notebook and suggestions/upload */}
            <div className="h-6 w-px bg-medical-neutral-300 flex-shrink-0" />
            
            {/* Suggestions - Desktop Only, scrolls in this space */}
            <div className="hidden md:flex flex-1 gap-2 overflow-x-auto scrollbar-hide items-center min-w-0 px-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {(() => {
              // Determine which suggestions to show based on active context
              let suggestionsToShow = personalizedSuggestions;
              if (currentTrialContext) {
                suggestionsToShow = personalizedTrialSuggestions;
              } else if (currentHealthContext && !currentTrialContext && !currentNotebookContext) {
                suggestionsToShow = personalizedHealthSuggestions;
              } else if (currentNotebookContext && !currentHealthContext && !currentTrialContext) {
                suggestionsToShow = personalizedTimelineSuggestions;
              }
              
              return suggestionsToShow.map((suggestion, idx) => {
                // Store populateText in a const to ensure we capture the current value
                const currentPopulateText = suggestion.populateText || suggestion.text;

                // Create a unique key that includes a hash of the populateText to force re-render
                const textHash = currentPopulateText.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                  const suggestionKey = `suggestion-desktop-${suggestionsKey}-${patientProfile?.isPatient}-${idx}-${textHash}`;

                  // Map background colors to text colors
                  const getTextColor = (bgColor) => {
                    if (bgColor.includes('medical-secondary')) return DesignTokens.colors.app.text[900];
                    if (bgColor.includes('medical-primary')) return 'text-medical-primary-600';
                    if (bgColor.includes('yellow')) return 'text-yellow-600';
                    if (bgColor.includes('care')) return 'text-care-600';
                    if (bgColor.includes('medical-accent')) return 'text-medical-accent-600';
                    return DesignTokens.colors.app.text[700];
                  };

                return (
                  <button
                    key={suggestionKey}
                    onClick={() => {
                      setInputText(currentPopulateText);
                      // Focus on input after setting text
                      setTimeout(() => {
                        const input = document.querySelector('input[type="text"]');
                        if (input) input.focus();
                      }, 0);
                    }}
                      className={combineClasses('px-2 py-1 text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 flex items-center gap-1.5 touch-manipulation', getTextColor(suggestion.color), 'hover:opacity-80')}
                  >
                      {suggestion.icon && <suggestion.icon className="w-3.5 h-3.5" />}
                    {suggestion.text}
                  </button>
                );
              });
            })()}
          </div>
            
            {/* Vertical Divider - Before Upload (desktop only) */}
            <div className="h-6 w-px bg-medical-neutral-300 flex-shrink-0 hidden md:block" />
            
            <button
              onClick={() => openDocumentOnboarding(null, 'picker')}
              title="Attach file or take photo"
              className={combineClasses(
                'px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 flex items-center gap-1.5 touch-manipulation',
                'border-2 border-gray-300',
                'text-gray-600',
                'hover:bg-gray-50',
                'hover:border-gray-400'
              )}
            >
              <Paperclip className="w-3.5 h-3.5" />
              <span>Upload</span>
            </button>
        </div>

          <div className="flex gap-2 mt-3">
            <div className="relative flex-1">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder={
                currentTrialContext 
                  ? `Ask about ${currentTrialContext.title || 'this trial'}...` 
                  : currentHealthContext 
                    ? "Ask about your labs, vitals, or symptoms..." 
                    : "Ask about symptoms, treatments, or upload results..."
              }
              className={combineClasses(
                  'w-full rounded-full px-3 py-2.5 sm:px-4 sm:py-2.5 text-sm sm:text-base transition-all duration-200 min-h-[44px]',
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
                  <X className={DesignTokens.icons.standard.size.full} />
              </button>
              )}
            </div>
              <button
                onClick={handleSendMessage}
                className={combineClasses(
                  'w-11 h-11 sm:w-10 sm:h-10 rounded-full transition flex-shrink-0 flex items-center justify-center min-h-[44px] min-w-[44px] touch-manipulation active:opacity-90',
                DesignTokens.components.button.primary,
                  DesignTokens.shadows.sm
                )}
              >
                <Send className="w-5 h-5" />
              </button>
          </div>
        </div>
      </div>

      {/* Document Upload Onboarding Modal */}
      {showDocumentOnboarding && (
        <DocumentUploadOnboarding
          show={showDocumentOnboarding}
          onClose={() => {
            setShowDocumentOnboarding(false);
            setDocumentOnboardingMethod('picker');
          }}
          onFileSelect={async (file, docType, date, note) => {
            setPendingDocumentDate(date);
            setPendingDocumentNote(note);
            if (documentOnboardingMethod === 'camera') {
              await handleRealFileUpload(file, docType);
            } else {
              await handleRealFileUpload(file, docType);
            }
            setShowDocumentOnboarding(false);
          }}
          method={documentOnboardingMethod}
          hasUploadedDocument={hasUploadedDocument}
        />
      )}

      {/* Upload Progress Overlay */}
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
          // Close modal after deletion completes (isDeleting will be false in finally block)
          setDeleteConfirm({ show: false, title: '', message: '', onConfirm: null, itemName: '', confirmText: 'Yes, Delete Permanently' });
        }}
        title={deleteConfirm.title}
        message={deleteConfirm.message}
        itemName={deleteConfirm.itemName}
        confirmText={deleteConfirm.confirmText}
        isDeleting={isDeleting}
      />
    </>
  );
}

