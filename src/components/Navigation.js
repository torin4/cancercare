import React, { useState } from 'react';
import { Activity, User, Home, MessageSquare, ClipboardList, FlaskConical, FileText, HeartHandshake, Bot } from 'lucide-react';
import { DesignTokens, combineClasses } from '../design/designTokens';
import logoPrimary from '../assets/logo_primary.svg';
import logoSecondary from '../assets/logo_secondary.svg';
import { useAuth } from '../contexts/AuthContext';

export default function Navigation({ activeTab, setActiveTab, patientProfile, onSidebarHover }) {
  const { user } = useAuth();
  
  // Helper to get profile image URL: prioritize uploaded profileImage, then Google photoURL
  const getProfileImageUrl = () => {
    if (patientProfile?.profileImage) {
      return patientProfile.profileImage;
    } else if (user?.photoURL) {
      return user.photoURL;
    }
    return null;
  };
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
    { id: 'chat', label: 'Iris', icon: Bot },
    { id: 'health', label: 'Health', icon: ClipboardList },
    { id: 'trials', label: 'Trials', icon: FlaskConical },
    { id: 'files', label: 'Docs', icon: FileText },
  ];

  return (
    <>
      {/* Header - Mobile Only */}
      <div className={combineClasses(DesignTokens.colors.app[900], DesignTokens.shadows.md, DesignTokens.spacing.container.full, 'flex-shrink-0 md:hidden')}>
        <div className="flex items-center justify-between">
          <div className={combineClasses('flex items-center', DesignTokens.spacing.gap.md)}>
            <div className={combineClasses('w-10 h-10 sm:w-12 sm:h-12 bg-white/20', DesignTokens.borders.radius.full, 'flex items-center justify-center', DesignTokens.shadows.sm)}>
              <img src={logoSecondary} alt="CancerCare" className="w-6 h-6 sm:w-8 sm:h-8" />
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
            {getProfileImageUrl() ? (
              <img 
                src={getProfileImageUrl()} 
                alt="Profile" 
                className="w-6 h-6 sm:w-6 sm:h-6 rounded-full object-cover"
              />
            ) : (
            <User className="w-6 h-6 sm:w-6 sm:h-6 text-white" />
            )}
          </button>
        </div>
      </div>

      {/* Side Menu - Desktop Only - Collapsible */}
      <div 
        className={combineClasses('hidden md:flex fixed left-0 top-0 bottom-0', DesignTokens.colors.app[900], 'border-r', DesignTokens.colors.app.border[300], DesignTokens.shadows.lg, 'z-20 flex-col', isExpanded ? 'w-64' : 'w-20')}
        style={{ overflow: 'visible' }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Sidebar Header */}
        <div className={combineClasses(DesignTokens.colors.app[900], DesignTokens.spacing.card.mobile, 'py-4')} style={{ minHeight: '80px' }}>
          {activeTab === 'profile' ? (
            /* Profile page - primary logo on expand, same position */
            <div className="w-full relative" style={{ height: '40px' }}>
              <img
                src={logoPrimary}
                alt="CancerCare"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: '0px',
                  display: 'block',
                  height: '40px',
                  width: 'auto',
                  opacity: isExpanded ? 1 : 0,
                  pointerEvents: 'none'
                }}
              />
              <img
                src={logoSecondary}
                alt="CancerCare"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: '0px',
                  display: 'block',
                  height: '40px',
                  width: 'auto',
                  opacity: isExpanded ? 0 : 1,
                  pointerEvents: 'none'
                }}
              />
            </div>
          ) : (
            /* All other pages - secondary logo + patient info on expand */
            <div className="w-full flex items-center gap-3">
              <div className="flex-shrink-0" style={{ width: '40px', height: '40px', position: 'relative' }}>
                <img
                  src={logoSecondary}
                  alt="CancerCare"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    display: 'block',
                    height: '40px',
                    width: 'auto',
                    pointerEvents: 'none'
                  }}
                />
              </div>
              
              {/* Patient & Caregiver Info - Only visible when expanded */}
              {isExpanded && patientProfile && (
                <div className="flex items-center flex-1 min-w-0">
                  <div className={combineClasses('h-6 w-px', DesignTokens.colors.app[700], 'mr-3 flex-shrink-0')} />
                  <div className="flex-1 min-w-0 pr-2">
                    <p className={combineClasses(DesignTokens.typography.body.xs, 'font-medium text-white truncate leading-tight')}>
                    {patientProfile?.firstName || patientProfile?.lastName 
                      ? `${patientProfile.firstName || ''} ${patientProfile.lastName || ''}`.trim()
                      : patientProfile?.name || 'Patient'}
                  </p>
                  {patientProfile?.isPatient === false && patientProfile?.caregiverName && (
                      <p className={combineClasses(DesignTokens.typography.body.xs, 'text-white/70 truncate flex items-center', DesignTokens.spacing.gap.xs, 'mt-0.5 leading-tight')}>
                        <HeartHandshake className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{getFirstAndLastName(patientProfile.caregiverName)}</span>
                    </p>
                  )}
                  </div>
                </div>
              )}
            </div>
          )}
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
                  <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <span className={combineClasses('text-sm sm:text-[15px]', 'font-semibold', 'whitespace-nowrap', DesignTokens.transitions.slow, 'overflow-hidden', DesignTokens.spacing.gap.md, isExpanded ? 'opacity-100 max-w-full' : 'opacity-0 max-w-0')}>
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
              {getProfileImageUrl() ? (
                <img 
                  src={getProfileImageUrl()} 
                  alt="Profile" 
                  className="w-5 h-5 sm:w-6 sm:h-6 rounded-full object-cover"
                />
              ) : (
              <User className="w-5 h-5 sm:w-6 sm:h-6" />
              )}
            </div>
            <span className={combineClasses('text-sm sm:text-[15px]', 'font-semibold', 'whitespace-nowrap', DesignTokens.transitions.slow, 'overflow-hidden', DesignTokens.spacing.gap.md, isExpanded ? 'opacity-100 max-w-full' : 'opacity-0 max-w-0')}>
              Profile
            </span>
          </button>
        </div>
      </div>

      {/* Bottom Navigation - Mobile Only (hidden on chat) */}
      {activeTab !== 'chat' && (
        <div className={combineClasses(DesignTokens.colors.app[50], 'border-t', DesignTokens.colors.app.border[200], DesignTokens.shadows.lg, 'flex-shrink-0 fixed bottom-0 left-0 right-0 z-10 md:hidden py-2 px-2')}
          style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))' }}>
          <div className="flex justify-evenly items-center max-w-2xl mx-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
            <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
              className={combineClasses('flex flex-col items-center justify-center', DesignTokens.spacing.gap.xs, 'px-1.5 py-1.5', DesignTokens.transitions.all, 'min-h-[36px] flex-1 relative touch-manipulation', isActive ? DesignTokens.colors.app.text[900] : combineClasses(DesignTokens.colors.app.text[600], 'hover:' + DesignTokens.colors.app.text[900]))}
            >
                  <div className={combineClasses('relative flex items-center justify-center', isActive ? combineClasses(DesignTokens.colors.app[200], DesignTokens.borders.radius.full, 'px-2 py-1') : '')}>
                  <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-[11px] font-medium">{item.label}</span>
            </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

