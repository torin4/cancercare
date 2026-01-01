import React from 'react';
import { Activity, User, Home, MessageSquare, ClipboardList, FlaskConical, FolderOpen } from 'lucide-react';

export default function Navigation({ activeTab, setActiveTab, patientProfile }) {
  return (
    <>
      {/* Header - Responsive */}
      <div className="bg-white border-b border-medical-neutral-200 shadow-sm px-4 sm:px-6 py-3 sm:py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-medical-primary-100 rounded-full flex items-center justify-center shadow-sm">
              <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-medical-primary-600" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-medical-neutral-900">CancerCare</h1>
              {(patientProfile?.diagnosis || patientProfile?.stage) && (
                <p className="text-xs sm:text-sm text-medical-neutral-600">
                  {patientProfile.diagnosis}
                  {patientProfile.diagnosis && patientProfile.stage && ' • '}
                  {patientProfile.stage}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => setActiveTab('profile')}
            className="p-2 hover:bg-medical-neutral-100 rounded-lg transition-colors duration-200"
          >
            <User className="w-5 h-5 sm:w-6 sm:h-6 text-medical-neutral-600" />
          </button>
        </div>
      </div>

      {/* Bottom Navigation - Fixed */}
      <div className="bg-white border-t px-2 sm:px-4 py-2 flex-shrink-0 fixed bottom-0 left-0 right-0 z-10">
        <div className="flex justify-around items-center">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all duration-200 ${activeTab === 'dashboard' ? 'text-medical-primary-600 bg-medical-primary-50' : 'text-medical-neutral-600 hover:text-medical-primary-600 hover:bg-medical-neutral-50'
              }`}
          >
            <Home className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-xs font-medium">Home</span>
          </button>

          <button
            onClick={() => setActiveTab('chat')}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all duration-200 ${activeTab === 'chat' ? 'text-medical-primary-600 bg-medical-primary-50' : 'text-medical-neutral-600 hover:text-medical-primary-600 hover:bg-medical-neutral-50'
              }`}
          >
            <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-xs font-medium">Chat</span>
          </button>

          <button
            onClick={() => setActiveTab('health')}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all duration-200 ${activeTab === 'health' ? 'text-medical-primary-600 bg-medical-primary-50' : 'text-medical-neutral-600 hover:text-medical-primary-600 hover:bg-medical-neutral-50'
              }`}
          >
            <ClipboardList className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-xs font-medium">Health</span>
          </button>

          <button
            onClick={() => setActiveTab('trials')}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all duration-200 ${activeTab === 'trials' ? 'text-medical-primary-600 bg-medical-primary-50' : 'text-medical-neutral-600 hover:text-medical-primary-600 hover:bg-medical-neutral-50'
              }`}
          >
            <FlaskConical className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-xs font-medium">Trials</span>
          </button>

          <button
            onClick={() => setActiveTab('files')}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all duration-200 ${activeTab === 'files' ? 'text-medical-primary-600 bg-medical-primary-50' : 'text-medical-neutral-600 hover:text-medical-primary-600 hover:bg-medical-neutral-50'
              }`}
          >
            <FolderOpen className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-xs font-medium">Files</span>
          </button>
        </div>
      </div>
    </>
  );
}

