import React, { useState, useEffect } from 'react';
import { DesignTokens, combineClasses } from '../design/designTokens';
import { Loader2 } from 'lucide-react';

export default function UploadProgressOverlay({ show, uploadProgress, aiStatus, documentType = null, extractedDataCounts = null }) {
  const [currentMessage, setCurrentMessage] = useState('');
  const [thinkingDots, setThinkingDots] = useState('');
  const [isFlashing, setIsFlashing] = useState(true);

  // Reset when overlay is shown
  useEffect(() => {
    if (show) {
      setCurrentMessage('');
      setThinkingDots('');
      setIsFlashing(true);
    }
  }, [show]);

  // Animate thinking dots
  useEffect(() => {
    if (!show) return;

    const interval = setInterval(() => {
      setThinkingDots(prev => {
        if (prev === '...') return '';
        return prev + '.';
      });
    }, 500);

    return () => clearInterval(interval);
  }, [show]);

  // Flash/pulse animation for status labels at 1 second interval
  useEffect(() => {
    if (!show) return;

    // Stop flashing if processing is complete
    const isComplete = currentMessage && (
      currentMessage.toLowerCase().includes('complete') || 
      currentMessage.toLowerCase().includes('saved')
    );

    if (isComplete) {
      setIsFlashing(true); // Reset to full opacity when complete
      return;
    }

    const flashInterval = setInterval(() => {
      setIsFlashing(prev => !prev);
    }, 1000); // Flash every 1 second

    return () => clearInterval(flashInterval);
  }, [show, currentMessage]);

  // Update current message based on progress and AI status
  useEffect(() => {
    if (!show) return;

    // Prioritize AI status if available (more specific)
    if (aiStatus) {
      setCurrentMessage(aiStatus);
      return;
    }

    // Otherwise use upload progress
    if (uploadProgress) {
      // Clean up progress messages to be more user-friendly
      let cleanMessage = uploadProgress;
      
      // Remove file prefixes like [File 1/3]
      cleanMessage = cleanMessage.replace(/\[File \d+\/\d+\]\s*/g, '');
      
      // Simplify technical messages
      cleanMessage = cleanMessage
        .replace(/Analyzing document with AI\.\.\./i, 'Analyzing document...')
        .replace(/Reading document\.\.\./i, 'Reading document...')
        .replace(/Uploading to secure storage\.\.\./i, 'Saving document...')
        .replace(/Linking data to document\.\.\./i, 'Organizing data...')
        .replace(/Refreshing your health data\.\.\./i, 'Updating records...')
        .replace(/Processing file \d+ of \d+:/i, 'Processing:');
      
      setCurrentMessage(cleanMessage);
      return;
    }

    // Default thinking message
    setCurrentMessage('Processing your document...');
  }, [show, uploadProgress, aiStatus]);

  if (!show) return null;

  // Show extracted data summary if available
  const showExtractedData = extractedDataCounts && (
    extractedDataCounts.labs > 0 ||
    extractedDataCounts.vitals > 0 ||
    extractedDataCounts.mutations > 0 ||
    extractedDataCounts.medications > 0 ||
    extractedDataCounts.hasGenomic
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
        <div className="text-center">
          {/* Thinking Animation */}
          <div className="mb-6 flex justify-center">
            <div className="relative">
              <Loader2 className={combineClasses('w-12 h-12 animate-spin', DesignTokens.colors.app.text[600])} />
            </div>
          </div>

          {/* Status Message */}
          <div className="mb-4">
            <h3 
              className={combineClasses(
                'text-xl font-semibold mb-2 transition-opacity duration-500',
                DesignTokens.colors.neutral.text[900],
                isFlashing ? 'opacity-100' : 'opacity-60'
              )}
            >
              {currentMessage || 'Processing...'}
            </h3>
            
            {/* Thinking indicator when processing */}
            {currentMessage && !currentMessage.toLowerCase().includes('complete') && !currentMessage.toLowerCase().includes('saved') && (
              <div className="flex items-center justify-center gap-1 mt-2">
                <span 
                  className={combineClasses(
                    'text-sm transition-opacity duration-500',
                    DesignTokens.colors.neutral.text[500],
                    isFlashing ? 'opacity-100' : 'opacity-60'
                  )}
                >
                  {thinkingDots || '.'}
                </span>
              </div>
            )}
          </div>

          {/* Extracted Data Summary - Show immediately when available */}
          {showExtractedData && (
            <div className={combineClasses(
              'mt-4 p-4 rounded-lg border',
              'bg-green-50',
              DesignTokens.borders.width.default,
              'border-green-200'
            )}>
              <p 
                className={combineClasses(
                  'text-sm font-medium mb-1 transition-opacity duration-500',
                  'text-green-800',
                  isFlashing ? 'opacity-100' : 'opacity-60'
                )}
              >
                Found:
              </p>
              <div className={combineClasses('text-xs space-y-1', 'text-green-700')}>
                {extractedDataCounts.labs > 0 && (
                  <p className={combineClasses('transition-opacity duration-500', isFlashing ? 'opacity-100' : 'opacity-70')}>
                    • {extractedDataCounts.labs} lab result{extractedDataCounts.labs !== 1 ? 's' : ''}
                  </p>
                )}
                {extractedDataCounts.vitals > 0 && (
                  <p className={combineClasses('transition-opacity duration-500', isFlashing ? 'opacity-100' : 'opacity-70')}>
                    • {extractedDataCounts.vitals} vital sign{extractedDataCounts.vitals !== 1 ? 's' : ''}
                  </p>
                )}
                {extractedDataCounts.mutations > 0 && (
                  <p className={combineClasses('transition-opacity duration-500', isFlashing ? 'opacity-100' : 'opacity-70')}>
                    • {extractedDataCounts.mutations} mutation{extractedDataCounts.mutations !== 1 ? 's' : ''}
                  </p>
                )}
                {extractedDataCounts.hasGenomic && extractedDataCounts.mutations === 0 && (
                  <p className={combineClasses('transition-opacity duration-500', isFlashing ? 'opacity-100' : 'opacity-70')}>
                    • Genomic profile
                  </p>
                )}
                {extractedDataCounts.medications > 0 && (
                  <p className={combineClasses('transition-opacity duration-500', isFlashing ? 'opacity-100' : 'opacity-70')}>
                    • {extractedDataCounts.medications} medication{extractedDataCounts.medications !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Helpful hint */}
          <p className={combineClasses('text-xs mt-6', DesignTokens.colors.neutral.text[500])}>
            Please don't close this window
          </p>
        </div>
      </div>
    </div>
  );
}