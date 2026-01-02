import React from 'react';
import { Activity, User, Home, MessageSquare, ClipboardList, FlaskConical, FolderOpen, HeartHandshake } from 'lucide-react';

export default function Navigation({ activeTab, setActiveTab, patientProfile }) {
  return (
    <>
      {/* Header - Responsive */}
      <div className="bg-medical-primary-600 border-b-2 border-medical-neutral-300 shadow-md px-4 sm:px-6 py-3 sm:py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white/20 rounded-full flex items-center justify-center shadow-sm">
              <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div>
              {activeTab === 'profile' ? (
                <>
                  <h1 className="text-lg sm:text-xl font-bold text-white">CancerCare</h1>
                  {(patientProfile?.diagnosis || patientProfile?.stage) && (
                    <p className="text-xs sm:text-sm text-white/90">
                      {patientProfile.diagnosis}
                      {patientProfile.diagnosis && patientProfile.stage && ' • '}
                      {patientProfile.stage}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <h1 className="text-lg sm:text-xl font-bold text-white">
                    {patientProfile?.name || patientProfile?.firstName || 'Patient'}
                  </h1>
                  {patientProfile?.isPatient === false && patientProfile?.caregiverName && (
                    <p className="text-xs text-white/80 flex items-center gap-1">
                      <HeartHandshake className="w-3 h-3" />
                      {patientProfile.caregiverName}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
          <button
            onClick={() => setActiveTab('profile')}
            className="p-2 hover:bg-white/20 rounded-lg transition-colors duration-200"
          >
            <User className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </button>
        </div>
      </div>

      {/* Bottom Navigation - Fixed */}
      <div className="bg-white border-t border-medical-neutral-200 shadow-lg px-2 sm:px-4 py-2 sm:py-3 flex-shrink-0 fixed bottom-0 left-0 right-0 z-10">
        <div className="flex justify-around items-center max-w-2xl mx-auto">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center gap-1 px-3 sm:px-4 py-2 rounded-lg transition-all duration-200 min-h-[44px] min-w-[44px] touch-manipulation ${
              activeTab === 'dashboard' 
                ? 'text-medical-primary-600 bg-medical-primary-50' 
                : 'text-medical-neutral-600 hover:text-medical-primary-600 hover:bg-medical-neutral-50'
            }`}
          >
            <Home className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-xs font-medium">Home</span>
          </button>

          <button
            onClick={() => setActiveTab('chat')}
            className={`flex flex-col items-center gap-1 px-3 sm:px-4 py-2 rounded-lg transition-all duration-200 min-h-[44px] min-w-[44px] touch-manipulation ${
              activeTab === 'chat' 
                ? 'text-medical-primary-600 bg-medical-primary-50' 
                : 'text-medical-neutral-600 hover:text-medical-primary-600 hover:bg-medical-neutral-50'
            }`}
          >
            <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-xs font-medium">Chat</span>
          </button>

          <button
            onClick={() => setActiveTab('health')}
            className={`flex flex-col items-center gap-1 px-3 sm:px-4 py-2 rounded-lg transition-all duration-200 min-h-[44px] min-w-[44px] touch-manipulation ${
              activeTab === 'health' 
                ? 'text-medical-primary-600 bg-medical-primary-50' 
                : 'text-medical-neutral-600 hover:text-medical-primary-600 hover:bg-medical-neutral-50'
            }`}
          >
            <ClipboardList className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-xs font-medium">Health</span>
          </button>

          <button
            onClick={() => setActiveTab('trials')}
            className={`flex flex-col items-center gap-1 px-3 sm:px-4 py-2 rounded-lg transition-all duration-200 min-h-[44px] min-w-[44px] touch-manipulation ${
              activeTab === 'trials' 
                ? 'text-medical-primary-600 bg-medical-primary-50' 
                : 'text-medical-neutral-600 hover:text-medical-primary-600 hover:bg-medical-neutral-50'
            }`}
          >
            <FlaskConical className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-xs font-medium">Trials</span>
          </button>

          <button
            onClick={() => setActiveTab('files')}
            className={`flex flex-col items-center gap-1 px-3 sm:px-4 py-2 rounded-lg transition-all duration-200 min-h-[44px] min-w-[44px] touch-manipulation ${
              activeTab === 'files' 
                ? 'text-medical-primary-600 bg-medical-primary-50' 
                : 'text-medical-neutral-600 hover:text-medical-primary-600 hover:bg-medical-neutral-50'
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

