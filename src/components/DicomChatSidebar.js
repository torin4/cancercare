import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, X, Loader2, MessageSquare } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { DesignTokens, combineClasses } from '../design/designTokens';
import { useAuth } from '../contexts/AuthContext';
import { usePatientContext } from '../contexts/PatientContext';
import { processChatMessage } from '../services/chatProcessor';

/**
 * DICOM Chat Sidebar
 *
 * A specialized chat interface for the DICOM viewer.
 * Sends DICOM metadata + optional image data to AI for vision analysis.
 */
export default function DicomChatSidebar({
  metadata,
  currentIndex,
  totalFiles,
  viewerState,
  onCaptureImage,
  onCaptureMultipleSlices,
  onClose
}) {
  const { user } = useAuth();
  const { patientProfile } = usePatientContext();

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  /**
   * Detect if message requires image analysis
   * Auto-captures image for visual questions
   */
  const shouldCaptureImage = (message) => {
    const lowerMsg = message.toLowerCase();
    const visualKeywords = [
      'see', 'look', 'show', 'visible', 'appear', 'image',
      'what am i looking at', 'what is this', 'what does this show',
      'analyze', 'examine', 'view', 'displayed', 'on screen',
      'abnormal', 'finding', 'structure', 'density', 'opacity',
      'spot', 'mass', 'lesion', 'nodule', 'area', 'region',
      'bright', 'dark', 'white', 'black', 'gray',
      'can you see', 'do you see', 'is there', 'are there'
    ];

    return visualKeywords.some(keyword => lowerMsg.includes(keyword));
  };

  /**
   * Detect if message requires multi-slice context analysis
   * Questions about progression, comparison, or patterns need multiple slices
   */
  const shouldCaptureMultipleSlices = (message) => {
    const lowerMsg = message.toLowerCase();
    const multiSliceKeywords = [
      'compare', 'comparison', 'different slices', 'other slices',
      'through', 'throughout', 'across', 'progression', 'pattern',
      'changing', 'changes', 'change', 'varies', 'variation',
      'before', 'after', 'adjacent', 'nearby', 'surrounding',
      'series', 'sequence', 'multiple', 'all slices', 'entire',
      'tumor', 'lesion', 'mass', 'abnormality', 'pathology'
    ];

    return multiSliceKeywords.some(keyword => lowerMsg.includes(keyword));
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage = inputText.trim();
    setInputText('');

    // Add user message to chat
    setMessages(prev => [...prev, {
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    }]);

    setIsLoading(true);

    try {
      // Detect if image analysis is needed
      const needsImage = shouldCaptureImage(userMessage);
      const needsMultiSlice = shouldCaptureMultipleSlices(userMessage);

      // If multi-slice is needed, image is automatically needed too
      const requiresImageCapture = needsImage || needsMultiSlice;

      let capturedImages = null; // Can be single image object or array of images

      // Prioritize multi-slice capture if requested
      if (requiresImageCapture && needsMultiSlice && onCaptureMultipleSlices) {
        capturedImages = await onCaptureMultipleSlices();
        if (capturedImages && Array.isArray(capturedImages)) {
        } else {
          console.warn('[DicomChat] Multi-slice capture requested but failed, falling back to single slice');
          // Fallback to single slice
          capturedImages = onCaptureImage ? onCaptureImage() : null;
        }
      } else if (requiresImageCapture && onCaptureImage) {
        capturedImages = onCaptureImage();
        if (capturedImages) {
        } else {
          console.warn('[DicomChat] Image capture requested but failed');
        }
      }

      // Build DICOM context for AI
      // Handle both single image and multi-slice arrays
      const isMultiSlice = Array.isArray(capturedImages);
      const dicomContext = {
        metadata,
        currentIndex,
        totalFiles,
        viewerState,
        imageData: !isMultiSlice ? capturedImages : null, // Single image (legacy support)
        images: isMultiSlice ? capturedImages : null // Multiple images (new multi-slice feature)
      };

      // Build conversation history
      const conversationHistory = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Send to chat processor with DICOM context
      const result = await processChatMessage(
        userMessage,
        user?.uid,
        conversationHistory,
        null, // trialContext
        null, // healthContext
        null, // notebookContext
        patientProfile,
        null, // abortSignal
        dicomContext // DICOM context (with optional image)
      );

      // Add AI response to chat
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: result.response || 'Error: No response content received',
        timestamp: new Date()
      }]);
    } catch (error) {
      console.error('[DicomChat] Error:', error);

      // Add error message to chat
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your question. Please try again.',
        timestamp: new Date(),
        isError: true
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex-shrink-0 bg-gray-900 text-white px-4 py-3 flex items-center justify-between border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-blue-400" />
          <div>
            <h3 className="text-sm font-semibold">Scan Assistant</h3>
            <p className="text-xs text-gray-400">Ask about this scan</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-gray-800 rounded-md transition-colors"
          aria-label="Close chat"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Educational Disclaimer Banner */}
      <div className="flex-shrink-0 bg-yellow-50 border-b border-yellow-200 px-4 py-2">
        <p className="text-xs text-yellow-800">
          <strong>Educational Only:</strong> This AI provides information about medical imaging, not diagnosis or medical advice.
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 mb-2">Ask me about this scan</p>
            <div className="space-y-1 text-xs text-gray-400">
              <p>• "What am I looking at?"</p>
              <p>• "What does this modality mean?"</p>
              <p>• "Explain the scan parameters"</p>
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={combineClasses(
              'flex gap-3',
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            {msg.role === 'assistant' && (
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <Bot className="w-5 h-5 text-blue-600" />
                </div>
              </div>
            )}

            <div
              className={combineClasses(
                'max-w-[80%] rounded-lg px-4 py-2',
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : msg.isError
                  ? 'bg-red-50 border border-red-200 text-red-800'
                  : 'bg-gray-100 text-gray-900'
              )}
            >
              {msg.role === 'assistant' ? (
                <div className={combineClasses(
                  DesignTokens.typography.body.base.sm,
                  'prose prose-sm max-w-none'
                )}>
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <p className={DesignTokens.typography.body.base.sm}>{msg.content}</p>
              )}
            </div>

            {msg.role === 'user' && (
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                  {patientProfile?.firstName?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
                </div>
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3 justify-start">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <Bot className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <div className="bg-gray-100 rounded-lg px-4 py-2">
              <Loader2 className="w-5 h-5 text-gray-500 animate-spin" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-gray-200 bg-white px-4 py-3">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about this scan..."
            disabled={isLoading}
            className={combineClasses(
              'flex-1 px-4 py-2 border border-gray-300 rounded-lg',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
              'disabled:bg-gray-100 disabled:cursor-not-allowed',
              DesignTokens.typography.body.base
            )}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputText.trim() || isLoading}
            className={combineClasses(
              'px-4 py-2 bg-blue-600 text-white rounded-lg',
              'hover:bg-blue-700 transition-colors',
              'disabled:bg-gray-300 disabled:cursor-not-allowed',
              'flex items-center gap-2'
            )}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Educational information only. Consult your healthcare provider for medical interpretation.
        </p>
      </div>
    </div>
  );
}
