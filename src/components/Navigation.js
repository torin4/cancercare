import React, { useState } from 'react';
import { Activity, User, Home, MessageSquare, ClipboardList, FlaskConical, FileText, HeartHandshake } from 'lucide-react';
import { DesignTokens, combineClasses } from '../design/designTokens';

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
    { id: 'files', label: 'Docs', icon: FileText },
  ];

  return (
    <>
      {/* Header - Mobile Only */}
      <div className={combineClasses('bg-gray-800', DesignTokens.shadows.md, DesignTokens.spacing.container.full, 'flex-shrink-0 md:hidden')}>
        <div className="flex items-center justify-between">
          <div className={combineClasses('flex items-center', DesignTokens.spacing.gap.md)}>
            <div className={combineClasses('w-10 h-10 sm:w-12 sm:h-12 bg-white/20', DesignTokens.borders.radius.full, 'flex items-center justify-center', DesignTokens.shadows.sm)}>
              <Activity className={combineClasses(DesignTokens.icons.button.size.full, 'text-white')} />
            </div>
            <div>
              {activeTab === 'profile' ? (
                <>
                  <h1 className={combineClasses(DesignTokens.typography.h2.full, DesignTokens.typography.h2.weight, 'text-white')}>CancerCare</h1>
                  {(patientProfile?.diagnosis || patientProfile?.stage) && (
                    <p className={combineClasses(DesignTokens.typography.body.sm, 'text-white/90')}>
                      {patientProfile.diagnosis}
                      {patientProfile.diagnosis && patientProfile.stage && ' • '}
                      {patientProfile.stage}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <h1 className={combineClasses(DesignTokens.typography.h2.full, DesignTokens.typography.h2.weight, 'text-white')}>
                    {patientProfile?.firstName || patientProfile?.lastName 
                      ? `${patientProfile.firstName || ''} ${patientProfile.lastName || ''}`.trim()
                      : patientProfile?.name || 'Patient'}
                  </h1>
                  {patientProfile?.isPatient === false && patientProfile?.caregiverName && (
                    <p className={combineClasses(DesignTokens.typography.body.xs, 'text-white/80 flex items-center', DesignTokens.spacing.gap.xs)}>
                      <HeartHandshake className={DesignTokens.icons.small.size.full} />
                      {getFirstAndLastName(patientProfile.caregiverName)}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
          <button
            onClick={() => setActiveTab('profile')}
            className={combineClasses('p-2 hover:bg-white/20', DesignTokens.borders.radius.sm, DesignTokens.transitions.all)}
          >
            <User className="w-6 h-6 sm:w-6 sm:h-6 text-white" />
          </button>
        </div>
      </div>

      {/* Side Menu - Desktop Only - Collapsible */}
      <div 
        className={`hidden md:flex fixed left-0 top-0 bottom-0 bg-gray-800 border-r border-medical-neutral-300 shadow-lg z-20 flex-col transition-all duration-300 ${
          isExpanded ? 'w-64' : 'w-20'
        }`}
        style={{ overflow: 'visible' }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Sidebar Header */}
        <div className={combineClasses('bg-gray-800', DesignTokens.spacing.card.mobile, 'py-5')} style={{ minHeight: '100px' }}>
          <div className={combineClasses('flex items-center', DesignTokens.spacing.gap.md, activeTab === 'profile' ? 'justify-center' : '')}>
            {/* Icon - Always in same position */}
            <div className={combineClasses('w-12 h-12 bg-white/20', DesignTokens.borders.radius.full, 'flex items-center justify-center', DesignTokens.shadows.sm, 'flex-shrink-0')}>
              <Activity className={combineClasses(DesignTokens.icons.header.size.full, 'text-white')} />
            </div>
            {/* Text - Slides in from right */}
            <div className={`flex-1 min-w-0 transition-all duration-300 overflow-hidden ${
              isExpanded ? 'opacity-100 max-w-full' : 'opacity-0 max-w-0'
            }`}>
              <h1 className={combineClasses(DesignTokens.typography.h2.full, DesignTokens.typography.h2.weight, 'text-white whitespace-nowrap')}>CancerCare</h1>
              {patientProfile && activeTab !== 'profile' && (
                <div className="text-white/90">
                  <p className={combineClasses(DesignTokens.typography.body.sm, DesignTokens.typography.h3.weight, 'whitespace-nowrap')}>
                    {patientProfile?.firstName || patientProfile?.lastName 
                      ? `${patientProfile.firstName || ''} ${patientProfile.lastName || ''}`.trim()
                      : patientProfile?.name || 'Patient'}
                  </p>
                  {patientProfile?.isPatient === false && patientProfile?.caregiverName && (
                    <p className={combineClasses(DesignTokens.typography.body.xs, 'text-white/80 flex items-center', DesignTokens.spacing.gap.xs, 'mt-1 whitespace-nowrap')}>
                      <HeartHandshake className={combineClasses(DesignTokens.icons.small.size.full, 'flex-shrink-0')} />
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
                className={combineClasses('w-full flex items-center py-3', DesignTokens.transitions.all, 'group', isActive ? 'text-white bg-white/20 border-r-4 border-white' : 'text-white/80 hover:text-white hover:bg-white/10')}
                title={!isExpanded ? item.label : ''}
              >
                <div className="flex-shrink-0 w-20 flex justify-center">
                  <Icon className={DesignTokens.icons.button.size.full} />
                </div>
                <span className={combineClasses(DesignTokens.typography.h3.weight, 'whitespace-nowrap', DesignTokens.transitions.slow, 'overflow-hidden', DesignTokens.spacing.gap.md, isExpanded ? 'opacity-100 max-w-full' : 'opacity-0 max-w-0')}>
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
            className={combineClasses('w-full flex items-center py-3', DesignTokens.borders.radius.sm, DesignTokens.transitions.all, 'group', activeTab === 'profile' ? 'text-white bg-white/20' : 'text-white/80 hover:text-white hover:bg-white/10')}
            title={!isExpanded ? 'Profile' : ''}
          >
            <div className="flex-shrink-0 w-20 flex justify-center">
              <User className={DesignTokens.icons.button.size.full} />
            </div>
            <span className={combineClasses(DesignTokens.typography.h3.weight, 'whitespace-nowrap', DesignTokens.transitions.slow, 'overflow-hidden', DesignTokens.spacing.gap.md, isExpanded ? 'opacity-100 max-w-full' : 'opacity-0 max-w-0')}>
              Profile & Settings
            </span>
          </button>
        </div>
      </div>

      {/* Bottom Navigation - Mobile Only */}
      <div className={combineClasses('bg-white', 'border-t', DesignTokens.borders.color.default, DesignTokens.shadows.lg, DesignTokens.spacing.card.mobile, 'flex-shrink-0 fixed bottom-0 left-0 right-0 z-10 md:hidden')}>
        <div className="flex justify-evenly items-center max-w-2xl mx-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
          <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
            className={combineClasses('flex flex-col items-center justify-center', DesignTokens.spacing.gap.xs, 'px-2.5 py-2.5', DesignTokens.borders.radius.md, DesignTokens.transitions.all, 'min-h-[44px] flex-1', isActive ? combineClasses('text-gray-800', 'bg-gray-100') : combineClasses(DesignTokens.colors.neutral.text[600], 'hover:text-gray-800', `hover:${DesignTokens.colors.neutral[50]}`))}
          >
                <Icon className="w-5 h-5 sm:w-5 sm:h-5" />
                <span className={combineClasses(DesignTokens.typography.body.xs, DesignTokens.typography.h3.weight)}>{item.label}</span>
          </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

