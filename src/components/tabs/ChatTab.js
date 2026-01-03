import React, { useState, useEffect, useRef } from 'react';
import { Bot, Trash2, Send, Paperclip, Activity, Dna, Zap } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '../../contexts/AuthContext';
import { usePatientContext } from '../../contexts/PatientContext';
import { useHealthContext } from '../../contexts/HealthContext';
import { useBanner } from '../../contexts/BannerContext';
import { messageService, labService, vitalService, symptomService } from '../../firebase/services';
import { getSavedTrials } from '../../services/clinicalTrials/clinicalTrialsService';
import { processChatMessage, generateChatExtractionSummary } from '../../services/chatProcessor';
import { processDocument, generateExtractionSummary } from '../../services/documentProcessor';
import { uploadDocument } from '../../firebase/storage';
import { chatSuggestions, trialSuggestions } from '../../constants/chatSuggestions';
import DocumentUploadOnboarding from '../DocumentUploadOnboarding';
import UploadProgressOverlay from '../UploadProgressOverlay';

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
        return text
          .replace(/\[patient\]/gi, 'I')
          .replace(/\[Patient\]/gi, 'I')
          .replace(/\bthe patient\b/gi, 'I')
          .replace(/\bThe patient\b/gi, 'I')
          .replace(/\btheir\b/gi, 'my')
          .replace(/\bTheir\b/gi, 'My')
          .replace(/\bthey\b/gi, 'I')
          .replace(/\bThey\b/gi, 'I');
      } else {
        // For caregivers, use patient name or "the patient"
        // Handle [patient] placeholder first
        let personalized = text.replace(/\[patient\]/gi, patientName);
        personalized = personalized.replace(/\[Patient\]/gi, patientName);

        // Then replace first-person references
        personalized = personalized.replace(/\bI had\b/gi, `${patientName} had`);
        personalized = personalized.replace(/\bI started\b/gi, `${patientName} started`);
        personalized = personalized.replace(/\bI'm\b/gi, `${patientName} is`);
        personalized = personalized.replace(/\bI \b/gi, `${patientName} `);
        personalized = personalized.replace(/\bmy \b/gi, `${patientName}'s `);
        personalized = personalized.replace(/\bMy \b/gi, `${patientName}'s `);

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
        // Caregiver mode - make third person
        return text
          .replace(/^Log a symptom$/i, `Log ${patientName}'s symptom`)
          .replace(/^Add lab value$/i, `Add ${patientName}'s lab value`)
          .replace(/^Add vital sign$/i, `Add ${patientName}'s vital sign`)
          .replace(/^Add medication$/i, `Add ${patientName}'s medication`)
          .replace(/What does my (.*) mean\?$/i, `What does ${patientName}'s $1 mean?`)
          .replace(/Explain my (.*)/i, `Explain ${patientName}'s $1`)
          .replace(/How is my (.*)/i, `How is ${patientName}'s $1`)
          .replace(/What are common (.*)/i, 'What are common $1') // Keep generic
          .replace(/Explain my symptoms/i, `Explain ${patientName}'s symptoms`)
          .replace(/What should I ask (.*)/i, `What should ${patientName} ask $1`)
          .replace(/Analyze my (.*)/i, `Analyze ${patientName}'s $1`)
          .replace(/What do my (.*)/i, `What do ${patientName}'s $1`);
      }
    };

    return chatSuggestions.map(suggestion => ({
      ...suggestion,
      populateText: personalizeText(suggestion.populateText || suggestion.text),
      text: personalizeButtonLabel(suggestion.text) // Personalize button text too!
    }));
  }, [patientProfile?.isPatient, patientProfile?.firstName, patientProfile?.name]); // Use specific fields from patientProfile

  // Chat state
  const [messages, setMessages] = useState([]);
  const [chatHistoryLoaded, setChatHistoryLoaded] = useState(false);
  const messagesEndRef = useRef(null);
  const [inputText, setInputText] = useState('');
  const [currentTrialContext, setCurrentTrialContext] = useState(null);
  const [currentHealthContext, setCurrentHealthContext] = useState(null);
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [profileImage, setProfileImage] = useState(null);
  const [suggestionsKey, setSuggestionsKey] = useState(0); // Force re-render when role changes

  // Document upload state
  const [showDocumentOnboarding, setShowDocumentOnboarding] = useState(false);
  const [documentOnboardingMethod, setDocumentOnboardingMethod] = useState('picker');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [pendingDocumentDate, setPendingDocumentDate] = useState(null);
  const [pendingDocumentNote, setPendingDocumentNote] = useState(null);
  const [documents, setDocuments] = useState([]);

  // Load profile image from user photoURL or patient profile
  useEffect(() => {
    if (user?.photoURL) {
      setProfileImage(user.photoURL);
    } else if (patientProfile?.photoURL) {
      setProfileImage(patientProfile.photoURL);
    } else {
      setProfileImage(null);
    }
  }, [user, patientProfile]);

  // Check sessionStorage for trial/health context when component mounts
  useEffect(() => {
    // Check for trial context from TrialsTab
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
        console.error('Error parsing trial context:', error);
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
        console.error('Error parsing health context:', error);
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
          console.error('Error loading chat history:', error);
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
          }).catch(err => console.error('Error saving upload summary:', err));
          
          // Auto-scroll to bottom to show the summary
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        }
      } catch (error) {
        console.error('Error processing upload summary:', error);
        sessionStorage.removeItem('uploadSummary');
      }
    }
  }, [user, chatHistoryLoaded]);

  // Process pending Quick Log message
  useEffect(() => {
    const pendingMessageStr = sessionStorage.getItem('pendingQuickLogMessage');
    if (pendingMessageStr && user) {
      try {
        const pendingMessage = JSON.parse(pendingMessageStr);
        if (pendingMessage.type === 'user') {
          sessionStorage.removeItem('pendingQuickLogMessage');
          // Process the message
          const processPendingMessage = async () => {
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
            }).catch(err => console.error('Error saving user message:', err));

            try {
              // Process message with AI
              const result = await processChatMessage(
                userMessage,
                user.uid,
                [],
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
              }).catch(err => console.error('Error saving AI message:', err));

              // Reload health data if values were extracted
              if (result.extractedData) {
                await reloadHealthData();
              }
            } catch (error) {
              console.error('Error processing pending message:', error);
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
        console.error('Error processing pending Quick Log message:', error);
        sessionStorage.removeItem('pendingQuickLogMessage');
      }
    }
  }, [user, patientProfile, reloadHealthData]);

  // Force re-render of suggestions when role changes or suggestions update
  useEffect(() => {
    // Force re-render by updating key whenever suggestions change
    setSuggestionsKey(prev => prev + 1);
  }, [personalizedSuggestions]); // Depend on personalizedSuggestions directly

  // Cycle suggestions when entering chat
  useEffect(() => {
    setSuggestionIndex(prev => (prev + 1) % Math.ceil(personalizedSuggestions.length / 4));
  }, [personalizedSuggestions]); // Re-calculate when role changes

  // Auto-scroll when messages change
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [messages.length]);

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
            console.error('Error deleting old message:', err);
          }
        }
      } catch (error) {
        console.error('Error cleaning up old messages:', error);
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
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);

    // Save user message to Firestore (async, don't wait)
    if (user) {
      messageService.addMessage({
        patientId: user.uid,
        type: 'user',
        text: userMessage,
        isAnalysis: false
      }).catch(err => console.error('Error saving user message:', err));
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
          healthContextToUse = {
            labs: labs,
            vitals: vitals,
            symptoms: symptoms
          };
          // Optionally set it for future messages
          setCurrentHealthContext(healthContextToUse);
        } catch (error) {
          console.error('Error loading health data for context:', error);
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
          console.error('Error loading saved trials for context:', error);
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

      // Add AI response
      const aiMsg = {
        type: 'ai',
        text: responseText,
        isAnalysis: !!result.extractedData
      };
      setMessages(prev => [...prev, aiMsg]);
      
      // Auto-scroll to bottom after AI response
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

      // Save AI message to Firestore (async, don't wait)
      if (user) {
        messageService.addMessage({
          patientId: user.uid,
          type: 'ai',
          text: responseText,
          isAnalysis: !!result.extractedData,
          extractedData: result.extractedData || null
        }).catch(err => console.error('Error saving AI message:', err));
      }

      // Reload health data if values were extracted
      if (result.extractedData) {
        await reloadHealthData();
      }

    } catch (error) {
      console.error('Error processing message:', error);
      const errorMsg = {
        type: 'ai',
        text: 'Sorry, I\'m having trouble processing your message right now. Please try again in a moment.'
      };
      setMessages(prev => [...prev, errorMsg]);
      
      // Auto-scroll to bottom after error message
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
      
      // Save error message to Firestore (async, don't wait)
      if (user) {
        messageService.addMessage({
          patientId: user.uid,
          type: 'ai',
          text: errorMsg.text,
          isAnalysis: false
        }).catch(err => console.error('Error saving error message:', err));
      }
    }
  };

  const openDocumentOnboarding = (docType = null, method = 'picker') => {
    console.log('openDocumentOnboarding called, hasUploadedDocument=', hasUploadedDocument, 'docType=', docType, 'method=', method);
    setDocumentOnboardingMethod(method || 'picker');
    setShowDocumentOnboarding(true);
  };

  const handleRealFileUpload = async (file, docType) => {
    console.log('handleRealFileUpload called', file?.name, docType);
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
      console.log('Document processing result:', processingResult);

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

      console.log('File uploaded successfully:', uploadResult);

      // Step 3: Link all extracted values to the document ID
      setUploadProgress('Linking data to document...');
      if (processingResult.extractedData && uploadResult.id) {
        try {
          const { linkValuesToDocument } = await import('../../services/documentProcessor');
          await linkValuesToDocument(processingResult.extractedData, uploadResult.id, user.uid);
          console.log('[ChatTab] Successfully linked all values to document', uploadResult.id);
        } catch (linkError) {
          console.error('[ChatTab] Error linking values to document:', linkError);
        }
      }

      setUploadProgress('Saving extracted data...');

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
      console.error('Upload error:', error);

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
    console.log('simulateDocumentUpload called, docType=', docType);
    // Create a file input element
    const input = document.createElement('input');
    input.type = 'file';
    // Accept common document and genomic data file types (vcf, maf, bed, txt, csv, tsv, compressed)
    input.accept = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.vcf,.vcf.gz,.maf,.bed,.txt,.csv,.tsv,.zip,.gz,.xlsx,.xls';

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        console.log('simulateDocumentUpload - file selected:', file.name, 'docType=', docType);
        await handleRealFileUpload(file, docType);
      }
    };

    console.log('simulateDocumentUpload invoking file picker');
    input.click();
  };

  const simulateCameraUpload = (docType) => {
    console.log('simulateCameraUpload called, docType=', docType);
    const input = document.createElement('input');
    input.type = 'file';
    // Accept common document types and images
    input.accept = '.pdf,.jpg,.jpeg,.png,.doc,.docx,.vcf,.vcf.gz,.maf,.bed,.txt,.csv,.tsv,.zip,.gz,.xlsx,.xls,image/*';
    // Hint mobile devices to open camera (this enables camera option in file picker)
    input.capture = 'environment';

    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        console.log('simulateCameraUpload - file selected:', file.name, 'docType=', docType);
        await handleRealFileUpload(file, docType);
      }
    };

    input.click();
  };

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Clear Chat History Button */}
        {messages.length > 0 && (
          <div className="px-3 sm:px-4 pt-2 sm:pt-3 pb-2 flex justify-end">
            <button
              onClick={async () => {
                if (!user) return;
                if (window.confirm('Are you sure you want to clear all chat history? This will remove the conversation but keep your health data context. This cannot be undone.')) {
                  try {
                    await messageService.deleteAllMessages(user.uid);
                    setMessages([]);
                    // Don't clear health/trial contexts - those represent the user's actual data, not conversation history
                    // The AI can still access health data and trials from the database when needed
                    setChatHistoryLoaded(false);
                  } catch (error) {
                    console.error('Error clearing chat history:', error);
                    showError('Error clearing chat history. Please try again.');
                  }
                }
              }}
              className="text-medical-neutral-500 hover:text-medical-neutral-700 text-xs sm:text-sm flex items-center gap-1.5 transition-colors min-h-[44px] min-w-[44px] px-2 touch-manipulation active:opacity-70"
              title="Clear chat history"
            >
              <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Clear History</span>
            </button>
          </div>
        )}
        <div 
          ref={messagesEndRef}
          className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 sm:space-y-3"
        >
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex items-start gap-2 sm:gap-3 ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.type === 'ai' && (
                <div className="flex-shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-medical-primary-500 to-medical-accent-500 flex items-center justify-center shadow-sm">
                  <Bot className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
              )}
              <div className={`max-w-[82%] sm:max-w-[70%] rounded-2xl px-3 py-2 sm:px-4 sm:py-2.5 ${msg.type === 'user'
                ? 'bg-medical-primary-500 text-white'
                : msg.isAnalysis
                  ? 'bg-medical-secondary-50 border border-medical-secondary-200 text-medical-neutral-800'
                  : 'bg-white border border-medical-neutral-200 text-medical-neutral-900'
                }`}>
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
                           <h3 className="text-sm font-semibold text-gray-700 mb-2">
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
                                   className="px-3 py-1.5 bg-purple-500 text-white text-xs rounded-full hover:bg-purple-600 transition-colors flex items-center gap-1"
                                 >
                                   <Dna className="w-3 h-3" />
                                   View Profile
                                 </button>
                                 <button
                                   onClick={() => onTabChange('trials')}
                                   className="px-3 py-1.5 bg-green-500 text-white text-xs rounded-full hover:bg-green-600 transition-colors flex items-center gap-1"
                                 >
                                   <Activity className="w-3 h-3" />
                                   Search Trials
                                 </button>
                               </>
                             ) : (
                               <>
                                 <button
                                   onClick={() => onTabChange('health')}
                                   className="px-3 py-1.5 bg-blue-500 text-white text-xs rounded-full hover:bg-blue-600 transition-colors flex items-center gap-1"
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
                                           healthContext = {
                                             labs: labs,
                                             vitals: vitals,
                                             symptoms: symptoms
                                           };
                                           setCurrentHealthContext(healthContext);
                                         } catch (error) {
                                           console.error('Error loading health data for quick analysis:', error);
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
                                     className="px-3 py-1.5 bg-green-500 text-white text-xs rounded-full hover:bg-green-600 transition-colors flex items-center gap-1"
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
                        a: ({node, ...props}) => <a className="text-medical-primary-600 underline hover:text-medical-primary-800" {...props} />,
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
                    <div className="w-full h-full bg-gradient-to-br from-medical-primary-500 to-medical-secondary-500 flex items-center justify-center text-white text-xs font-bold">
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
          ))}
        </div>

        {/* Trial Context Indicator */}
        {currentTrialContext && (
          <div className="p-2.5 sm:p-3 bg-medical-accent-50 border-b border-medical-accent-200 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
              <span className="text-medical-accent-600 text-xs sm:text-sm font-medium flex-shrink-0">Discussing:</span>
              <span className="text-medical-accent-800 text-xs sm:text-sm truncate">{currentTrialContext.title || 'Trial'}</span>
            </div>
            <button
              onClick={() => {
                setCurrentTrialContext(null);
                setMessages(prev => [...prev, {
                  type: 'ai',
                  text: 'Trial context cleared. You can now ask general questions or ask about a different trial.'
                }]);
              }}
              className="text-medical-accent-600 hover:text-medical-accent-800 text-xs sm:text-sm underline flex-shrink-0 min-h-[44px] min-w-[44px] px-2 touch-manipulation active:opacity-70"
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

        {/* Chat Suggestions */}
        <div
          className="px-3 sm:px-4 py-2.5 sm:py-3 bg-medical-neutral-50 border-t border-medical-neutral-200"
        >
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}>
            {(currentTrialContext ? trialSuggestions : personalizedSuggestions).map((suggestion, idx) => {
              // Store populateText in a const to ensure we capture the current value
              const currentPopulateText = suggestion.populateText || suggestion.text;

              // Create a unique key that includes a hash of the populateText to force re-render
              const textHash = currentPopulateText.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
              const suggestionKey = `suggestion-${suggestionsKey}-${patientProfile?.isPatient}-${idx}-${textHash}`;

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
                  className={`${suggestion.color} text-white px-3 py-2 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap hover:opacity-100 opacity-90 transition-opacity flex-shrink-0 flex items-center gap-1.5 sm:gap-2 min-h-[44px] touch-manipulation active:opacity-100`}
                >
                  {suggestion.icon && <suggestion.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                  {suggestion.text}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-3 sm:p-4 bg-white border-t">
          <div className="flex gap-2">
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
              className="flex-1 border border-medical-neutral-300 rounded-full px-3 py-2.5 sm:px-4 sm:py-2.5 text-sm sm:text-base focus:ring-2 focus:ring-medical-primary-500 focus:border-transparent transition-all duration-200 min-h-[44px]"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => openDocumentOnboarding(null, 'picker')}
                title="Attach file or take photo"
                className="bg-medical-neutral-100 text-medical-neutral-700 p-2.5 sm:p-2 rounded-full hover:bg-medical-neutral-200 transition flex-shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center touch-manipulation active:opacity-70"
              >
                <Paperclip className="w-5 h-5" />
              </button>
              <button
                onClick={handleSendMessage}
                className="bg-medical-primary-500 text-white w-11 h-11 sm:w-10 sm:h-10 rounded-full hover:bg-medical-primary-600 transition flex-shrink-0 shadow-sm flex items-center justify-center min-h-[44px] min-w-[44px] touch-manipulation active:opacity-90"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
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
    </>
  );
}

