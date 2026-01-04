import React, { useState } from 'react';
import { Activity, User, Home, MessageSquare, ClipboardList, FlaskConical, FileText, HeartHandshake } from 'lucide-react';

export default function Navigation({ activeTab, setActiveTab, patientProfile, onSidebarHover }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Helper to get first name from full name
  const getFirstName = (fullName) => {
    if (!fullName) return '';
    return fullName.split(' ')[0];
  };
  
  // Helper to get first and last name only (no middle name)
  const getFirstAndLastName = (fullName) => {
    if (!fullName) return '';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0];
    // Return first and last name only
    return `${parts[0]} ${parts[parts.length - 1]}`;
  };
  
  const handleMouseEnter = () => {
    setIsExpanded(true);
    if (onSidebarHover) onSidebarHover(true);
  };
  
  const handleMouseLeave = () => {
    setIsExpanded(false);
    if (onSidebarHover) onSidebarHover(false);
  };
  
  const navItems = [
    { id: 'dashboard', label: 'Home', icon: Home },
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'health', label: 'Health', icon: ClipboardList },
    { id: 'trials', label: 'Trials', icon: FlaskConical },
    { id: 'files', label: 'Files', icon: FileText },
  ];

  return (
    <>
      {/* Header - Mobile Only */}
      <div className="bg-medical-primary-600 border-b-2 border-medical-neutral-300 shadow-md px-4 sm:px-6 py-3 sm:py-4 flex-shrink-0 md:hidden">
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
                    {patientProfile?.firstName || patientProfile?.lastName 
                      ? `${patientProfile.firstName || ''} ${patientProfile.lastName || ''}`.trim()
                      : patientProfile?.name || 'Patient'}
                  </h1>
                  {patientProfile?.isPatient === false && patientProfile?.caregiverName && (
                    <p className="text-xs text-white/80 flex items-center gap-1">
                      <HeartHandshake className="w-3 h-3" />
                      {getFirstAndLastName(patientProfile.caregiverName)}
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

      {/* Side Menu - Desktop Only - Collapsible */}
      <div 
        className={`hidden md:flex fixed left-0 top-0 bottom-0 bg-medical-primary-600 border-r border-medical-neutral-300 shadow-lg z-20 flex-col transition-all duration-300 ${
          isExpanded ? 'w-64' : 'w-20'
        }`}
        style={{ overflow: 'visible' }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Sidebar Header */}
        <div className="bg-medical-primary-600 px-4 py-5" style={{ minHeight: '100px' }}>
          <div className={`flex items-center gap-3 ${activeTab === 'profile' ? 'justify-center' : ''}`}>
            {/* Icon - Always in same position */}
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center shadow-sm flex-shrink-0">
              <Activity className="w-6 h-6 text-white" />
            </div>
            {/* Text - Slides in from right */}
            <div className={`flex-1 min-w-0 transition-all duration-300 overflow-hidden ${
              isExpanded ? 'opacity-100 max-w-full' : 'opacity-0 max-w-0'
            }`}>
              <h1 className="text-xl font-bold text-white whitespace-nowrap">CancerCare</h1>
              {patientProfile && activeTab !== 'profile' && (
                <div className="text-white/90">
                  <p className="text-sm font-medium whitespace-nowrap">
                    {patientProfile?.firstName || patientProfile?.lastName 
                      ? `${patientProfile.firstName || ''} ${patientProfile.lastName || ''}`.trim()
                      : patientProfile?.name || 'Patient'}
                  </p>
                  {patientProfile?.isPatient === false && patientProfile?.caregiverName && (
                    <p className="text-xs text-white/80 flex items-center gap-1 mt-1 whitespace-nowrap">
                      <HeartHandshake className="w-3 h-3 flex-shrink-0" />
                      {getFirstAndLastName(patientProfile.caregiverName)}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
          <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center py-3 transition-all duration-200 group ${
                  isActive
                    ? 'text-white bg-white/20 border-r-4 border-white'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
            }`}
                title={!isExpanded ? item.label : ''}
              >
                <div className="flex-shrink-0 w-20 flex justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <span className={`font-medium whitespace-nowrap transition-all duration-300 overflow-hidden gap-3 ${
                  isExpanded ? 'opacity-100 max-w-full' : 'opacity-0 max-w-0'
                }`}>
                  {item.label}
                </span>
          </button>
            );
          })}
        </nav>

        {/* Profile Button at Bottom */}
        <div>
          <button
            onClick={() => setActiveTab('profile')}
            className={`w-full flex items-center py-3 rounded-lg transition-all duration-200 group ${
              activeTab === 'profile'
                ? 'text-white bg-white/20'
                : 'text-white/80 hover:text-white hover:bg-white/10'
            }`}
            title={!isExpanded ? 'Profile' : ''}
          >
            <div className="flex-shrink-0 w-20 flex justify-center">
              <User className="w-5 h-5" />
            </div>
            <span className={`font-medium whitespace-nowrap transition-all duration-300 overflow-hidden gap-3 ${
              isExpanded ? 'opacity-100 max-w-full' : 'opacity-0 max-w-0'
            }`}>
              Profile & Settings
            </span>
          </button>
        </div>
      </div>

      {/* Bottom Navigation - Mobile Only */}
      <div className="bg-white border-t border-medical-neutral-200 shadow-lg px-2 sm:px-4 py-2 sm:py-3 flex-shrink-0 fixed bottom-0 left-0 right-0 z-10 md:hidden">
        <div className="flex justify-around items-center max-w-2xl mx-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
          <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center gap-1 px-3 sm:px-4 py-2 rounded-lg transition-all duration-200 min-h-[44px] min-w-[44px] touch-manipulation ${
                  isActive
                ? 'text-medical-primary-600 bg-medical-primary-50' 
                : 'text-medical-neutral-600 hover:text-medical-primary-600 hover:bg-medical-neutral-50'
            }`}
          >
                <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                <span className="text-xs font-medium">{item.label}</span>
          </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

