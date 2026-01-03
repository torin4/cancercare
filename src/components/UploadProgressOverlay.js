import React, { useState, useEffect } from 'react';

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
              <h3 className="text-xl font-bold text-gray-900">
                {uploadProgress.includes('[File') 
                  ? uploadProgress.match(/\[File \d+\/\d+\]/)?.[0] || 'Processing Documents'
                  : 'Processing Document'}
              </h3>
              <span className="text-sm font-medium text-gray-600">{Math.round(smoothProgress)}%</span>
            </div>
            <div className="w-full bg-gray-200 h-3 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300 ease-out rounded-full"
                style={{ width: `${smoothProgress}%` }}
              />
            </div>
          </div>

          {/* Progress text */}
          <p className="text-gray-600 mb-4 text-lg font-medium">{uploadProgress}</p>
          
          {/* AI Status - Real-time processing info */}
          {aiStatus && (uploadProgress.includes('Analyzing') || uploadProgress.includes('Re-processing')) && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800 font-medium flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></span>
                {aiStatus}
              </p>
            </div>
          )}

          {/* Progress steps */}
          <div className="space-y-2 text-left bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-3 text-sm">
              <div className={`w-2 h-2 rounded-full ${uploadProgress.includes('Reading') ? 'bg-blue-600 animate-pulse' : uploadProgress.includes('Analyzing') || uploadProgress.includes('Uploading') || uploadProgress.includes('Saving') || uploadProgress.includes('Refreshing') ? 'bg-green-600' : 'bg-gray-300'}`}></div>
              <span className={uploadProgress.includes('Reading') || uploadProgress.includes('Analyzing') || uploadProgress.includes('Uploading') || uploadProgress.includes('Saving') || uploadProgress.includes('Refreshing') ? 'text-gray-900' : 'text-gray-500'}>Reading document</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className={`w-2 h-2 rounded-full ${uploadProgress.includes('Analyzing') ? 'bg-blue-600 animate-pulse' : uploadProgress.includes('Uploading') || uploadProgress.includes('Saving') || uploadProgress.includes('Refreshing') ? 'bg-green-600' : 'bg-gray-300'}`}></div>
              <span className={uploadProgress.includes('Analyzing') || uploadProgress.includes('Uploading') || uploadProgress.includes('Saving') || uploadProgress.includes('Refreshing') ? 'text-gray-900' : 'text-gray-500'}>Analyzing with AI</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className={`w-2 h-2 rounded-full ${uploadProgress.includes('Uploading') ? 'bg-blue-600 animate-pulse' : uploadProgress.includes('Saving') || uploadProgress.includes('Refreshing') ? 'bg-green-600' : 'bg-gray-300'}`}></div>
              <span className={uploadProgress.includes('Uploading') || uploadProgress.includes('Saving') || uploadProgress.includes('Refreshing') ? 'text-gray-900' : 'text-gray-500'}>Uploading to storage</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className={`w-2 h-2 rounded-full ${uploadProgress.includes('Saving') ? 'bg-blue-600 animate-pulse' : uploadProgress.includes('Refreshing') ? 'bg-green-600' : 'bg-gray-300'}`}></div>
              <span className={uploadProgress.includes('Saving') || uploadProgress.includes('Refreshing') ? 'text-gray-900' : 'text-gray-500'}>Saving extracted data</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className={`w-2 h-2 rounded-full ${uploadProgress.includes('Refreshing') ? 'bg-blue-600 animate-pulse' : 'bg-gray-300'}`}></div>
              <span className={uploadProgress.includes('Refreshing') ? 'text-gray-900' : 'text-gray-500'}>Updating dashboard</span>
            </div>
          </div>

          <p className="text-xs text-gray-500 mt-4">
            Please don't close this window
          </p>
        </div>
      </div>
    </div>
  );
}

