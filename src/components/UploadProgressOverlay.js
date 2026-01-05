import React, { useState, useEffect } from 'react';
import { DesignTokens, combineClasses } from '../design/designTokens';

export default function UploadProgressOverlay({ show, uploadProgress, aiStatus }) {
  const [progressPercentage, setProgressPercentage] = useState(0);
  const [smoothProgress, setSmoothProgress] = useState(0);
  const [progressStartTime, setProgressStartTime] = useState(null);
  const [currentStep, setCurrentStep] = useState('');
  const [stepStartTime, setStepStartTime] = useState(null);
  const [stepTargetProgress, setStepTargetProgress] = useState(0);

  // Reset when overlay is shown
  useEffect(() => {
    if (show) {
      setProgressStartTime(Date.now());
      setSmoothProgress(0);
      setProgressPercentage(0);
      setCurrentStep('');
      setStepStartTime(null);
      setStepTargetProgress(0);
    }
  }, [show]);

  // Calculate progress percentage based on current step with time-based progression
  useEffect(() => {
    if (!show) return;
    
    const progress = uploadProgress || '';
    const status = aiStatus || '';
    const now = Date.now();
    
    // Determine current step and target progress
    let step = '';
    let targetProgress = 0;
    let stepMin = 0;
    let stepMax = 0;
    
    if (progress.includes('Reading') || progress.includes('Downloading')) {
      step = 'reading';
      stepMin = 5;
      stepMax = 15;
      targetProgress = 15;
    } else if (progress.includes('Analyzing') || progress.includes('Re-processing')) {
      step = 'analyzing';
      stepMin = 20;
      stepMax = 60;
      // During AI analysis, progress from 20% to 60% based on AI status
      if (status) {
        if (status.includes('Identifying document type')) targetProgress = 30;
        else if (status.includes('Extracting dates')) targetProgress = 40;
        else if (status.includes('Extracting labs')) targetProgress = 50;
        else if (status.includes('Extracting vitals')) targetProgress = 55;
        else if (status.includes('Extracting genomic')) targetProgress = 58;
        else if (status.includes('Validating data')) targetProgress = 60;
        else targetProgress = 35; // General analyzing
      } else {
        targetProgress = 25; // Starting analysis
      }
    } else if (progress.includes('Uploading')) {
      step = 'uploading';
      stepMin = 65;
      stepMax = 75;
      targetProgress = 75;
    } else if (progress.includes('Linking')) {
      step = 'linking';
      stepMin = 75;
      stepMax = 80;
      targetProgress = 80;
    } else if (progress.includes('Saving')) {
      step = 'saving';
      stepMin = 80;
      stepMax = 90;
      targetProgress = 90;
    } else if (progress.includes('Refreshing')) {
      step = 'refreshing';
      stepMin = 90;
      stepMax = 100;
      targetProgress = 100;
    } else {
      step = 'initializing';
      stepMin = 0;
      stepMax = 10;
      targetProgress = 10;
    }
    
    // If step changed, reset step timer
    if (step !== currentStep) {
      setCurrentStep(step);
      setStepStartTime(now);
      setStepTargetProgress(targetProgress);
    }
    
    // Calculate time-based progress within current step
    const stepElapsed = stepStartTime ? (now - stepStartTime) / 1000 : 0; // seconds
    const stepDuration = step === 'analyzing' ? 30 : // AI analysis can take 30+ seconds
                        step === 'saving' ? 10 : // Saving can take 10 seconds
                        step === 'reading' ? 3 : // Reading/downloading usually quick
                        step === 'uploading' ? 5 : // Upload usually quick
                        step === 'linking' ? 2 : // Linking is quick
                        step === 'refreshing' ? 3 : // Refreshing is quick
                        2; // Default 2 seconds
    
    // Gradually increase progress within step bounds, but don't exceed target
    let timeBasedProgress = stepMin + (stepMax - stepMin) * Math.min(stepElapsed / stepDuration, 0.9); // Cap at 90% of step range
    timeBasedProgress = Math.min(timeBasedProgress, targetProgress);
    
    // Use the higher of time-based or target progress (target takes precedence when reached)
    const finalProgress = Math.max(timeBasedProgress, progressPercentage);
    
    // Only update if progress actually increased
    if (finalProgress > progressPercentage) {
      setProgressPercentage(finalProgress);
    }
  }, [show, uploadProgress, aiStatus, currentStep, stepStartTime, progressPercentage]);

  // Smooth progress animation with gradual increase
  useEffect(() => {
    if (!show) return;
    
    const interval = setInterval(() => {
      setSmoothProgress(prev => {
        if (prev < progressPercentage) {
          // Calculate smooth increment - faster when far behind, slower when close
          const diff = progressPercentage - prev;
          const increment = Math.max(diff * 0.15, 0.3); // At least 0.3% per frame, up to 15% of remaining
          return Math.min(prev + increment, progressPercentage);
        }
        // If we're ahead (shouldn't happen), gradually catch up
        if (prev > progressPercentage) {
          const diff = prev - progressPercentage;
          return Math.max(prev - diff * 0.2, progressPercentage);
        }
        return prev;
      });
    }, 50); // Update every 50ms for smooth animation

    return () => clearInterval(interval);
  }, [show, progressPercentage]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 animate-fade-scale">
        <div className="text-center">
          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className={combineClasses('text-xl font-bold', DesignTokens.colors.neutral.text[900])}>
                {uploadProgress.includes('[File') 
                  ? uploadProgress.match(/\[File \d+\/\d+\]/)?.[0] || 'Processing Documents'
                  : 'Processing Document'}
              </h3>
              <span className={combineClasses('text-sm font-medium', DesignTokens.colors.neutral.text[600])}>{Math.round(smoothProgress)}%</span>
            </div>
            <div className={combineClasses('w-full h-3 rounded-full overflow-hidden', DesignTokens.colors.neutral[200])}>
              <div 
                className={combineClasses('h-full transition-all duration-300 ease-out rounded-full bg-gradient-to-r', 'from-medical-primary-500', 'to-medical-primary-600')}
                style={{ width: `${smoothProgress}%` }}
              />
            </div>
          </div>

          {/* Progress text - Show aiStatus if available (more specific), otherwise show uploadProgress */}
          {aiStatus && (uploadProgress.includes('Saving') || uploadProgress.includes('Analyzing') || uploadProgress.includes('Re-processing')) ? (
            <div className={combineClasses('mb-4 p-3 rounded-lg', DesignTokens.colors.primary[50], DesignTokens.borders.width.default, DesignTokens.colors.primary.border[200])}>
              <p className={combineClasses('text-lg font-medium flex items-center gap-2', DesignTokens.colors.primary.text[700])}>
                <span className={combineClasses('w-2 h-2 rounded-full animate-pulse', DesignTokens.colors.primary[600])}></span>
                {aiStatus}
              </p>
            </div>
          ) : (
            <p className={combineClasses('mb-4 text-lg font-medium', DesignTokens.colors.neutral.text[600])}>{uploadProgress}</p>
          )}

          {/* Progress steps */}
          <div className={combineClasses('space-y-2 text-left rounded-lg p-4', DesignTokens.colors.neutral[50])}>
            {/* Step 1: Reading/Downloading */}
            <div className="flex items-center gap-3 text-sm">
              <div className={combineClasses(
                'w-2 h-2 rounded-full',
                uploadProgress.includes('Reading') || uploadProgress.includes('Downloading') ? combineClasses('animate-pulse', DesignTokens.colors.primary[600]) :
                uploadProgress.includes('Analyzing') || uploadProgress.includes('Re-processing') || uploadProgress.includes('Uploading') || uploadProgress.includes('Saving') || uploadProgress.includes('Refreshing') ? 'bg-green-600' :
                DesignTokens.colors.neutral[300]
              )}></div>
              <span className={combineClasses(
                'text-sm',
                uploadProgress.includes('Reading') || uploadProgress.includes('Downloading') || uploadProgress.includes('Analyzing') || uploadProgress.includes('Re-processing') || uploadProgress.includes('Uploading') || uploadProgress.includes('Saving') || uploadProgress.includes('Refreshing') ? DesignTokens.colors.neutral.text[900] : DesignTokens.colors.neutral.text[500]
              )}>Reading document</span>
            </div>
            {/* Step 2: Analyzing/Re-processing */}
            <div className="flex items-center gap-3 text-sm">
              <div className={combineClasses(
                'w-2 h-2 rounded-full',
                uploadProgress.includes('Analyzing') || uploadProgress.includes('Re-processing') ? combineClasses('animate-pulse', DesignTokens.colors.primary[600]) :
                uploadProgress.includes('Uploading') || uploadProgress.includes('Saving') || uploadProgress.includes('Refreshing') ? 'bg-green-600' :
                DesignTokens.colors.neutral[300]
              )}></div>
              <span className={combineClasses(
                'text-sm',
                uploadProgress.includes('Analyzing') || uploadProgress.includes('Re-processing') || uploadProgress.includes('Uploading') || uploadProgress.includes('Saving') || uploadProgress.includes('Refreshing') ? DesignTokens.colors.neutral.text[900] : DesignTokens.colors.neutral.text[500]
              )}>Analyzing with AI</span>
            </div>
            {/* Step 3: Uploading (skipped for rescan) */}
            <div className="flex items-center gap-3 text-sm">
              <div className={combineClasses(
                'w-2 h-2 rounded-full',
                uploadProgress.includes('Uploading') ? combineClasses('animate-pulse', DesignTokens.colors.primary[600]) :
                uploadProgress.includes('Saving') || uploadProgress.includes('Refreshing') || uploadProgress.includes('Re-processing') ? 'bg-green-600' :
                DesignTokens.colors.neutral[300]
              )}></div>
              <span className={combineClasses(
                'text-sm',
                uploadProgress.includes('Uploading') || uploadProgress.includes('Saving') || uploadProgress.includes('Refreshing') || uploadProgress.includes('Re-processing') ? DesignTokens.colors.neutral.text[900] : DesignTokens.colors.neutral.text[500]
              )}>Uploading to storage</span>
            </div>
            {/* Step 4: Saving */}
            <div className="flex items-center gap-3 text-sm">
              <div className={combineClasses(
                'w-2 h-2 rounded-full',
                uploadProgress.includes('Saving') || (uploadProgress.includes('Re-processing') && !uploadProgress.includes('Refreshing')) ? combineClasses('animate-pulse', DesignTokens.colors.primary[600]) :
                uploadProgress.includes('Refreshing') ? 'bg-green-600' :
                DesignTokens.colors.neutral[300]
              )}></div>
              <span className={combineClasses(
                'text-sm',
                uploadProgress.includes('Saving') || uploadProgress.includes('Refreshing') || uploadProgress.includes('Re-processing') ? DesignTokens.colors.neutral.text[900] : DesignTokens.colors.neutral.text[500]
              )}>Saving extracted data</span>
            </div>
            {/* Step 5: Refreshing */}
            <div className="flex items-center gap-3 text-sm">
              <div className={combineClasses(
                'w-2 h-2 rounded-full',
                uploadProgress.includes('Refreshing') ? combineClasses('animate-pulse', DesignTokens.colors.primary[600]) :
                DesignTokens.colors.neutral[300]
              )}></div>
              <span className={combineClasses(
                'text-sm',
                uploadProgress.includes('Refreshing') ? DesignTokens.colors.neutral.text[900] : DesignTokens.colors.neutral.text[500]
              )}>Updating dashboard</span>
            </div>
          </div>

          <p className={combineClasses('text-xs mt-4', DesignTokens.colors.neutral.text[500])}>
            Please don't close this window
          </p>
        </div>
      </div>
    </div>
  );
}

