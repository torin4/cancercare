import React from 'react';
import Lottie from 'lottie-react';

export default function UploadProgressOverlay({ show, uploadProgress, documentScanAnimation }) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 animate-fade-scale">
        <div className="text-center">
          {/* Lottie Animation */}
          {documentScanAnimation ? (
            <div className="inline-flex items-center justify-center mb-6">
              <Lottie 
                animationData={documentScanAnimation}
                loop={true}
                style={{ width: 200, height: 200 }}
              />
            </div>
          ) : (
            <div className="inline-flex items-center justify-center w-20 h-20 mb-6">
              <div className="relative">
                <div className="w-20 h-20 border-4 border-blue-200 rounded-full"></div>
                <div className="w-20 h-20 border-4 border-blue-600 rounded-full absolute top-0 left-0 animate-spin border-t-transparent"></div>
              </div>
            </div>
          )}

          {/* Progress text */}
          <h3 className="text-xl font-bold text-gray-900 mb-2">Processing Document</h3>
          <p className="text-gray-600 mb-6">{uploadProgress}</p>

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

