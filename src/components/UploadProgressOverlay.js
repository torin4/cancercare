import React, { useState, useEffect } from 'react';
import { DesignTokens, combineClasses } from '../design/designTokens';

export default function UploadProgressOverlay({ show, uploadProgress, aiStatus }) {
  const [progressPercentage, setProgressPercentage] = useState(0);
  const [smoothProgress, setSmoothProgress] = useState(0);

  // Calculate progress percentage based on current step with more granular steps
  useEffect(() => {
    if (!show) return; // Don't run if not showing
    
    let percentage = 0;
    
    const progress = uploadProgress || '';
    const status = aiStatus || '';
    
    if (progress.includes('Reading') || progress.includes('Downloading')) {
      percentage = 15;
    } else if (progress.includes('Analyzing') || progress.includes('Re-processing')) {
      // During AI analysis, progress from 20% to 60% based on AI status
      if (status) {
        if (status.includes('Identifying document type')) percentage = 25;
        else if (status.includes('Extracting dates')) percentage = 30;
        else if (status.includes('Extracting labs')) percentage = 40;
        else if (status.includes('Extracting vitals')) percentage = 45;
        else if (status.includes('Extracting genomic')) percentage = 50;
        else if (status.includes('Validating data')) percentage = 55;
        else percentage = 35; // General analyzing
      } else {
        percentage = 20; // Starting analysis
      }
    } else if (progress.includes('Uploading')) {
      percentage = 70;
    } else if (progress.includes('Linking')) {
      percentage = 80;
    } else if (progress.includes('Saving')) {
      percentage = 85;
    } else if (progress.includes('Refreshing')) {
      percentage = 95;
    } else {
      percentage = 10;
    }
    
    // Only update if percentage actually changed to prevent infinite loops
    setProgressPercentage(prev => prev !== percentage ? percentage : prev);
  }, [show, uploadProgress, aiStatus]);

  // Smooth progress animation
  useEffect(() => {
    if (!show) return; // Don't run if not showing
    
    const interval = setInterval(() => {
      setSmoothProgress(prev => {
        if (prev < progressPercentage) {
          const diff = progressPercentage - prev;
          return Math.min(prev + Math.max(diff * 0.1, 0.5), progressPercentage);
        }
        return prev;
      });
    }, 50);

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

          {/* Progress text */}
          <p className={combineClasses('mb-4 text-lg font-medium', DesignTokens.colors.neutral.text[600])}>{uploadProgress}</p>
          
          {/* AI Status - Real-time processing info */}
          {aiStatus && (uploadProgress.includes('Analyzing') || uploadProgress.includes('Re-processing')) && (
            <div className={combineClasses('mb-4 p-3 rounded-lg', DesignTokens.colors.primary[50], DesignTokens.borders.width.default, DesignTokens.colors.primary.border[200])}>
              <p className={combineClasses('text-sm font-medium flex items-center gap-2', DesignTokens.colors.primary.text[700])}>
                <span className={combineClasses('w-2 h-2 rounded-full animate-pulse', DesignTokens.colors.primary[600])}></span>
                {aiStatus}
              </p>
            </div>
          )}

          {/* Progress steps */}
          <div className={combineClasses('space-y-2 text-left rounded-lg p-4', DesignTokens.colors.neutral[50])}>
            <div className="flex items-center gap-3 text-sm">
              <div className={combineClasses(
                'w-2 h-2 rounded-full',
                uploadProgress.includes('Reading') ? combineClasses('animate-pulse', DesignTokens.colors.primary[600]) :
                uploadProgress.includes('Analyzing') || uploadProgress.includes('Uploading') || uploadProgress.includes('Saving') || uploadProgress.includes('Refreshing') ? 'bg-green-600' :
                DesignTokens.colors.neutral[300]
              )}></div>
              <span className={combineClasses(
                'text-sm',
                uploadProgress.includes('Reading') || uploadProgress.includes('Analyzing') || uploadProgress.includes('Uploading') || uploadProgress.includes('Saving') || uploadProgress.includes('Refreshing') ? DesignTokens.colors.neutral.text[900] : DesignTokens.colors.neutral.text[500]
              )}>Reading document</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className={combineClasses(
                'w-2 h-2 rounded-full',
                uploadProgress.includes('Analyzing') ? combineClasses('animate-pulse', DesignTokens.colors.primary[600]) :
                uploadProgress.includes('Uploading') || uploadProgress.includes('Saving') || uploadProgress.includes('Refreshing') ? 'bg-green-600' :
                DesignTokens.colors.neutral[300]
              )}></div>
              <span className={combineClasses(
                'text-sm',
                uploadProgress.includes('Analyzing') || uploadProgress.includes('Uploading') || uploadProgress.includes('Saving') || uploadProgress.includes('Refreshing') ? DesignTokens.colors.neutral.text[900] : DesignTokens.colors.neutral.text[500]
              )}>Analyzing with AI</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className={combineClasses(
                'w-2 h-2 rounded-full',
                uploadProgress.includes('Uploading') ? combineClasses('animate-pulse', DesignTokens.colors.primary[600]) :
                uploadProgress.includes('Saving') || uploadProgress.includes('Refreshing') ? 'bg-green-600' :
                DesignTokens.colors.neutral[300]
              )}></div>
              <span className={combineClasses(
                'text-sm',
                uploadProgress.includes('Uploading') || uploadProgress.includes('Saving') || uploadProgress.includes('Refreshing') ? DesignTokens.colors.neutral.text[900] : DesignTokens.colors.neutral.text[500]
              )}>Uploading to storage</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className={combineClasses(
                'w-2 h-2 rounded-full',
                uploadProgress.includes('Saving') ? combineClasses('animate-pulse', DesignTokens.colors.primary[600]) :
                uploadProgress.includes('Refreshing') ? 'bg-green-600' :
                DesignTokens.colors.neutral[300]
              )}></div>
              <span className={combineClasses(
                'text-sm',
                uploadProgress.includes('Saving') || uploadProgress.includes('Refreshing') ? DesignTokens.colors.neutral.text[900] : DesignTokens.colors.neutral.text[500]
              )}>Saving extracted data</span>
            </div>
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

