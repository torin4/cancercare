import React from 'react';
import Lottie from 'lottie-react';

export default function UploadProgressOverlay({ show, uploadProgress, documentScanAnimation }) {
  if (!show) return null;

  // Calculate progress percentage based on current step
  const getProgressPercentage = () => {
    if (uploadProgress.includes('Reading') || uploadProgress.includes('Downloading')) return 20;
    if (uploadProgress.includes('Analyzing') || uploadProgress.includes('Re-processing')) return 50;
    if (uploadProgress.includes('Uploading')) return 70;
    if (uploadProgress.includes('Saving')) return 85;
    if (uploadProgress.includes('Refreshing')) return 95;
    return 10;
  };

  const progressPercentage = getProgressPercentage();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 animate-fade-scale">
        <div className="text-center">
          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xl font-bold text-gray-900">Processing Document</h3>
              <span className="text-sm font-medium text-gray-600">{progressPercentage}%</span>
            </div>
            <div className="w-full bg-gray-200 h-3 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500 ease-out rounded-full"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>

          {/* Progress text */}
          <p className="text-gray-600 mb-6 text-lg">{uploadProgress}</p>

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

