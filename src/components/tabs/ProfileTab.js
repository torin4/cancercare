import React, { useState, useEffect, useRef } from 'react';
import { Camera, User, Calendar, MapPin, TrendingUp, Activity, Edit2, Dna, Upload, AlertCircle, Users, Phone, Plus, Settings, Link2, Loader2, Unlink, LogOut, Trash2, Sliders, Shield, HeartHandshake, Copy } from 'lucide-react';
import { DesignTokens, Layouts, combineClasses } from '../../design/designTokens';
import { signOut, linkWithPopup, unlink, GoogleAuthProvider, deleteUser } from 'firebase/auth';
import { auth } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import { usePatientContext } from '../../contexts/PatientContext';
import { useHealthContext } from '../../contexts/HealthContext';
import { useBanner } from '../../contexts/BannerContext';
import { emergencyContactService, accountService, documentService } from '../../firebase/services';
import { deleteUserDirectory } from '../../firebase/storage';
import { formatLabel, formatSignificance, significanceExplanation } from '../../utils/formatters';
import { parseMutation } from '../../utils/helpers';
import { IMPORTANT_GENES } from '../../config/importantGenes';
import EditPatientInfoModal from '../modals/EditPatientInfoModal';
import EditGenomicModal from '../modals/EditGenomicModal';
import EditContactsModal from '../modals/EditContactsModal';
import EditMedicalTeamModal from '../modals/EditMedicalTeamModal';
import UpdateStatusModal from '../modals/UpdateStatusModal';
import DeletionConfirmationModal from '../modals/DeletionConfirmationModal';
import DocumentUploadOnboarding from '../modals/DocumentUploadOnboarding';

export default function ProfileTab({ onTabChange }) {
  // Use contexts for shared state
  const { user, setUser } = useAuth();
  const { patientProfile, setPatientProfile, refreshPatient } = usePatientContext();
  const { genomicProfile, setGenomicProfile, reloadHealthData } = useHealthContext();
  const { showSuccess, showError } = useBanner();
  
  // Helper to get first and last name only (no middle name)
  const getFirstAndLastName = (fullName) => {
    if (!fullName) return '';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0];
    // Return first and last name only
    return `${parts[0]} ${parts[parts.length - 1]}`;
  };

  // Tab-specific state
  const [profileImage, setProfileImage] = useState(null);
  const [currentStatus, setCurrentStatus] = useState({
    diagnosis: '',
    diagnosisDate: '',
    subtype: '',
    stage: '',
    treatmentLine: '',
    currentRegimen: '',
    performanceStatus: '',
    diseaseStatus: '',
    baselineCa125: ''
  });
  const [genomicExpanded, setGenomicExpanded] = useState(false);
  
  // Track if component is mounted to prevent setState after unmount
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  // Check if we should expand genomic profile (e.g., after genomic upload)
  useEffect(() => {
    const shouldExpand = sessionStorage.getItem('expandGenomicProfile');
    if (shouldExpand === 'true') {
      setGenomicExpanded(true);
      sessionStorage.removeItem('expandGenomicProfile');
    }
  }, []);
  const [emergencyContacts, setEmergencyContacts] = useState([]);
  const [editContacts, setEditContacts] = useState([]);
  
  // Modal state
  const [showEditInfo, setShowEditInfo] = useState(false);
  const [showEditGenomic, setShowEditGenomic] = useState(false);
  const [editingGenomicProfile, setEditingGenomicProfile] = useState(null);
  const [showEditContacts, setShowEditContacts] = useState(false);
  const [showEditMedicalTeam, setShowEditMedicalTeam] = useState(false);
  const [showUpdateStatus, setShowUpdateStatus] = useState(false);
  const [updateStatusSubtypeCustom, setUpdateStatusSubtypeCustom] = useState(false);
  const [updateStatusTreatmentCustom, setUpdateStatusTreatmentCustom] = useState(false);
  const [showDeletionConfirm, setShowDeletionConfirm] = useState(false);
  const [deletionType, setDeletionType] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLinkingGoogle, setIsLinkingGoogle] = useState(false);
  const [isUnlinkingGoogle, setIsUnlinkingGoogle] = useState(false);
  
  // Document onboarding state
  const [showDocumentOnboarding, setShowDocumentOnboarding] = useState(false);
  const [documentOnboardingMethod, setDocumentOnboardingMethod] = useState('picker');
  const [hasUploadedDocument, setHasUploadedDocument] = useState(false);
  const [pendingDocumentDate, setPendingDocumentDate] = useState(null);
  const [pendingDocumentNote, setPendingDocumentNote] = useState(null);

  // Initialize currentStatus from patientProfile
  useEffect(() => {
    if (patientProfile) {
      if (patientProfile.currentStatus) {
        setCurrentStatus({
          diagnosis: patientProfile.currentStatus.diagnosis || patientProfile.diagnosis || '',
          diagnosisDate: patientProfile.currentStatus.diagnosisDate || patientProfile.diagnosisDate || '',
          subtype: patientProfile.currentStatus.subtype || patientProfile.cancerType || '',
          stage: patientProfile.currentStatus.stage || patientProfile.stage || '',
          treatmentLine: patientProfile.currentStatus.treatmentLine || '',
          currentRegimen: patientProfile.currentStatus.currentRegimen || '',
          performanceStatus: patientProfile.currentStatus.performanceStatus || '',
          diseaseStatus: patientProfile.currentStatus.diseaseStatus || '',
          baselineCa125: patientProfile.currentStatus.baselineCa125 || ''
        });
      } else if (patientProfile.cancerType || patientProfile.stage || patientProfile.diagnosis) {
        setCurrentStatus({
          diagnosis: patientProfile.diagnosis || '',
          diagnosisDate: patientProfile.diagnosisDate || '',
          subtype: patientProfile.cancerType || '',
          stage: patientProfile.stage || '',
          treatmentLine: '',
          currentRegimen: '',
          performanceStatus: '',
          diseaseStatus: '',
          baselineCa125: ''
        });
      }
    }
  }, [patientProfile]);

  // Load emergency contacts
  useEffect(() => {
    const loadContacts = async () => {
      if (user && isMountedRef.current) {
        try {
          const contacts = await emergencyContactService.getEmergencyContacts(user.uid);
          const filteredContacts = contacts.filter(c => 
            (c.name && c.name.trim()) || (c.phone && c.phone.trim())
          );
          if (isMountedRef.current) {
            setEmergencyContacts(filteredContacts);
          }
        } catch (error) {
          // Log error for debugging; emergency contacts are not critical for app functionality
          // Error is silently handled to avoid disrupting user experience
        }
      }
    };
    loadContacts();
  }, [user]);

  // Check if user has uploaded documents
  useEffect(() => {
    const checkDocuments = async () => {
      if (user && isMountedRef.current) {
        try {
          const docs = await documentService.getDocuments(user.uid);
          if (isMountedRef.current) {
            setHasUploadedDocument(docs.length > 0);
          }
        } catch (error) {
          // Error is silently handled; document check is not critical for app functionality
        }
      }
    };
    checkDocuments();
  }, [user]);

  const openDocumentOnboarding = (docType = null, method = 'picker') => {
    setDocumentOnboardingMethod(method || 'picker');
    setShowDocumentOnboarding(true);
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (error) {
      showError('Failed to sign out: ' + error.message);
    }
  };

  const handleLinkGoogleAccount = async () => {
    if (!user || isLinkingGoogle) return;
    
    setIsLinkingGoogle(true);
    try {
      const provider = new GoogleAuthProvider();
      await linkWithPopup(user, provider);
      showSuccess('Google account linked successfully! You can now sign in with either email/password or Google.');
    } catch (error) {
      if (error.code === 'auth/credential-already-in-use') {
        showError('This Google account is already linked to another account. Please use a different Google account.');
      } else if (error.code === 'auth/provider-already-linked') {
        showError('Google account is already linked to this account.');
      } else if (error.code !== 'auth/popup-closed-by-user') {
        showError('Failed to link Google account: ' + error.message);
      }
    } finally {
      setIsLinkingGoogle(false);
    }
  };

  const handleUnlinkGoogleAccount = async () => {
    if (!user || isUnlinkingGoogle) return;
    
    const hasEmailPassword = user.providerData?.some(p => p.providerId === 'password');
    if (!hasEmailPassword) {
      showError('Cannot unlink Google account. You must have at least one sign-in method. Please add an email/password account first.');
      return;
    }

    if (!confirm('Are you sure you want to unlink your Google account? You will only be able to sign in with email/password.')) {
      return;
    }

    setIsUnlinkingGoogle(true);
    try {
      await unlink(user, 'google.com');
      showSuccess('Google account unlinked successfully.');
    } catch (error) {
      if (error.code === 'auth/no-such-provider') {
        showError('Google account is not linked to this account.');
      } else if (error.code === 'auth/cannot-unlink-provider') {
        showError('Cannot unlink this provider. You must have at least one sign-in method.');
      } else {
        showError('Failed to unlink Google account: ' + error.message);
      }
    } finally {
      setIsUnlinkingGoogle(false);
    }
  };

  const handleDeleteData = async (type) => {
    if (!user) return;

    if (isMountedRef.current) {
      setIsDeleting(true);
    }

    try {
      if (type === 'data') {
        await accountService.clearHealthData(user.uid);
        await deleteUserDirectory(user.uid);
        // Explicitly clear genomic profile from UI state
        if (isMountedRef.current) {
          setGenomicProfile(null);
          await reloadHealthData();
          showSuccess('Your health data has been successfully cleared.');
          setShowDeletionConfirm(false);
        }
      } else if (type === 'account') {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          if (isMountedRef.current) {
            showError('No user found. Please log in and try again.');
            setIsDeleting(false);
          }
          return;
        }

        const userId = currentUser.uid;

        try {
          await accountService.deleteFullUserData(userId);
          await deleteUserDirectory(userId);
          await deleteUser(currentUser);
          await signOut(auth);
          // Only setState if still mounted (though user will be logged out)
          if (isMountedRef.current) {
            setUser(null);
            setCurrentStatus({
              diagnosis: '',
              diagnosisDate: '',
              treatmentLine: '',
              currentRegimen: '',
              performanceStatus: '',
              diseaseStatus: '',
              baselineCa125: '',
              stage: '',
              subtype: ''
            });
            setShowDeletionConfirm(false);
            showSuccess('Your account and all associated data have been permanently deleted.');
          }
        } catch (authError) {
          if (authError.code === 'auth/requires-recent-login') {
            if (isMountedRef.current) {
              showError('For security, account deletion requires a recent login. Please log out and log back in, then try again.');
              setIsDeleting(false);
              setShowDeletionConfirm(false);
            }
            return;
          }
          if (authError.code && !authError.code.includes('requires-recent-login')) {
            try {
              await signOut(auth);
              if (isMountedRef.current) {
                setUser(null);
              }
            } catch (signOutError) {
            }
          }
          throw authError;
        }
      }
    } catch (error) {
      if (isMountedRef.current) {
        showError('An error occurred during deletion. Please try again.');
      }
    } finally {
      if (isMountedRef.current) {
        setIsDeleting(false);
      }
    }
  };

  if (!user || !patientProfile) {
    return null;
  }

  return (
    <div className={combineClasses(Layouts.container, 'flex flex-col', DesignTokens.spacing.gap.md, 'pb-24')}>
      {/* Patient Info */}
      <div className={combineClasses(DesignTokens.spacing.card.full, 'md:p-8')}>
        <div className={combineClasses('flex flex-col sm:flex-row items-start sm:items-center', DesignTokens.spacing.gap.lg)}>
          {/* Profile Picture */}
          <div className="relative flex-shrink-0">
            {profileImage ? (
              <img 
                src={profileImage} 
                alt="Profile" 
                className={combineClasses('w-28 h-28 sm:w-32 sm:h-32', DesignTokens.borders.radius.full, 'object-cover border-4 border-white')} 
              />
            ) : (
              <div className={combineClasses('w-28 h-28 sm:w-32 sm:h-32 bg-gradient-to-br from-gray-800 to-gray-600', DesignTokens.borders.radius.full, 'flex items-center justify-center text-white text-3xl sm:text-4xl font-bold border-4 border-white')}>
                {(() => {
                  // If caregiver mode, use caregiver name for initials
                  let name;
                  if (patientProfile?.isPatient === false && patientProfile?.caregiverName) {
                    name = patientProfile.caregiverName;
                  } else {
                    name = patientProfile.firstName || patientProfile.lastName 
                      ? `${patientProfile.firstName || ''} ${patientProfile.lastName || ''}`.trim()
                      : patientProfile.name || user?.displayName || 'Patient';
                  }
                  const parts = name.trim().split(/\s+/);
                  if (parts.length >= 2) {
                    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
                  }
                  return name.substring(0, 2).toUpperCase();
                })()}
              </div>
            )}
            <button
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = (e) => {
                  const file = e.target.files[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => setProfileImage(e.target.result);
                    reader.readAsDataURL(file);
                  }
                };
                input.click();
              }}
              className={combineClasses('absolute bottom-0 right-0 w-11 h-11 sm:w-12 sm:h-12', 'bg-gray-800', DesignTokens.borders.radius.full, 'flex items-center justify-center text-white', DesignTokens.shadows.lg, 'hover:bg-gray-700', 'active:bg-gray-700', DesignTokens.transitions.all, 'transform active:scale-95', DesignTokens.spacing.touchTarget)}
              title="Change profile picture"
              aria-label="Change profile picture"
            >
              <Camera className={DesignTokens.icons.button.size.full} />
            </button>
          </div>

          {/* Profile Information */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <h2 className={combineClasses(DesignTokens.typography.h1.full, DesignTokens.typography.h1.weight, DesignTokens.typography.h1.color, DesignTokens.typography.h1.marginBottom)}>
                  {patientProfile.firstName || patientProfile.lastName 
                    ? `${patientProfile.firstName || ''} ${patientProfile.lastName || ''}`.trim()
                    : patientProfile.name || user?.displayName || 'Patient'}
                </h2>
                {patientProfile?.isPatient === false && patientProfile?.caregiverName && (
                  <p className={combineClasses('text-sm mb-1 flex items-center gap-1', DesignTokens.colors.neutral.text[600])}>
                    <HeartHandshake className={DesignTokens.icons.small.size.full} />
                    {getFirstAndLastName(patientProfile.caregiverName)}
                  </p>
                )}
                {patientProfile.gender && (
                  <span className={combineClasses('text-sm', DesignTokens.colors.neutral.text[600])}>
                    {patientProfile.gender}
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowEditInfo(true)}
                className={combineClasses('p-2 -mr-2', DesignTokens.spacing.touchTarget, 'flex items-center justify-center', 'text-gray-800', 'hover:text-gray-900', 'active:text-gray-900', DesignTokens.transitions.default)}
                aria-label="Edit patient information"
              >
                <Edit2 className={DesignTokens.icons.standard.size.full} />
              </button>
            </div>

            {/* Key Information Grid */}
            <div className={combineClasses('grid grid-cols-2', DesignTokens.spacing.gap.md, 'mt-4')}>
              {patientProfile.age && (
                <div className={combineClasses('flex items-center', DesignTokens.spacing.gap.sm, DesignTokens.typography.body.sm)}>
                  <div className={combineClasses(DesignTokens.spacing.iconContainer.mobile, 'bg-gray-100', DesignTokens.borders.radius.sm, 'flex items-center justify-center flex-shrink-0')}>
                    <User className={combineClasses(DesignTokens.icons.standard.size.full, 'text-gray-800')} />
                  </div>
                  <div>
                    <p className={combineClasses('text-xs', DesignTokens.colors.neutral.text[500])}>Age</p>
                    <p className={combineClasses('font-semibold', DesignTokens.colors.neutral.text[900])}>{patientProfile.age} years</p>
                  </div>
                </div>
              )}
              {patientProfile.dateOfBirth && (
                <div className={combineClasses('flex items-center', DesignTokens.spacing.gap.sm, DesignTokens.typography.body.sm)}>
                  <div className={combineClasses(DesignTokens.spacing.iconContainer.mobile, DesignTokens.colors.accent[100], DesignTokens.borders.radius.sm, 'flex items-center justify-center flex-shrink-0')}>
                    <Calendar className={combineClasses(DesignTokens.icons.standard.size.full, DesignTokens.colors.accent.text[600])} />
                  </div>
                  <div>
                    <p className={combineClasses('text-xs', DesignTokens.colors.neutral.text[500])}>Date of Birth</p>
                    <p className={combineClasses('font-semibold', DesignTokens.colors.neutral.text[900])}>
                      {new Date(patientProfile.dateOfBirth).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </p>
                  </div>
                </div>
              )}
              {patientProfile.country && (
                <div className={combineClasses('flex items-center', DesignTokens.spacing.gap.sm, DesignTokens.typography.body.sm)}>
                  <div className={combineClasses(DesignTokens.spacing.iconContainer.mobile, 'bg-medical-secondary-100', DesignTokens.borders.radius.sm, 'flex items-center justify-center flex-shrink-0')}>
                    <MapPin className={combineClasses(DesignTokens.icons.standard.size.full, 'text-medical-secondary-600')} />
                  </div>
                  <div>
                    <p className={combineClasses('text-xs', DesignTokens.colors.neutral.text[500])}>Location</p>
                    <p className={combineClasses('font-semibold', DesignTokens.colors.neutral.text[900])}>{patientProfile.country}</p>
                  </div>
                </div>
              )}
              {patientProfile.gender && (
                <div className={combineClasses('flex items-center', DesignTokens.spacing.gap.sm, DesignTokens.typography.body.sm)}>
                  <div className={combineClasses(DesignTokens.spacing.iconContainer.mobile, 'bg-pink-100', DesignTokens.borders.radius.sm, 'flex items-center justify-center flex-shrink-0')}>
                    <User className={combineClasses(DesignTokens.icons.standard.size.full, 'text-pink-600')} />
                  </div>
                  <div>
                    <p className={combineClasses('text-xs', DesignTokens.colors.neutral.text[500])}>Gender</p>
                    <p className={combineClasses('font-semibold', DesignTokens.colors.neutral.text[900])}>{patientProfile.gender}</p>
                  </div>
                </div>
              )}
              {patientProfile.height && (
                <div className={combineClasses('flex items-center', DesignTokens.spacing.gap.sm, DesignTokens.typography.body.sm)}>
                  <div className={combineClasses(DesignTokens.spacing.iconContainer.mobile, DesignTokens.borders.radius.sm, 'flex items-center justify-center flex-shrink-0', DesignTokens.components.status.normal.bg)}>
                    <TrendingUp className={combineClasses(DesignTokens.icons.standard.size.full, DesignTokens.components.status.normal.text)} />
                  </div>
                  <div>
                    <p className={combineClasses('text-xs', DesignTokens.colors.neutral.text[500])}>Height</p>
                    <p className={combineClasses('font-semibold', DesignTokens.colors.neutral.text[900])}>{patientProfile.height} cm</p>
                  </div>
                </div>
              )}
              {patientProfile.weight && (
                <div className={combineClasses('flex items-center', DesignTokens.spacing.gap.sm, DesignTokens.typography.body.sm)}>
                  <div className={combineClasses(DesignTokens.spacing.iconContainer.mobile, DesignTokens.borders.radius.sm, 'flex items-center justify-center flex-shrink-0', 'bg-gray-100')}>
                    <Activity className={combineClasses(DesignTokens.icons.standard.size.full, 'text-gray-800')} />
                  </div>
                  <div>
                    <p className={combineClasses('text-xs', DesignTokens.colors.neutral.text[500])}>Weight</p>
                    <p className={combineClasses('font-semibold', DesignTokens.colors.neutral.text[900])}>{patientProfile.weight} kg</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Current Status - Full Width */}
      <div className={combineClasses(DesignTokens.components.card.containerLarge, 'border-medical-accent-200')}>
        <div className={combineClasses('flex items-center justify-between', DesignTokens.spacing.header.mobile)}>
          <div className={combineClasses('flex items-center', DesignTokens.spacing.gap.md)}>
            <div className={combineClasses(DesignTokens.colors.accent[50], DesignTokens.spacing.iconContainer.full, DesignTokens.borders.radius.sm)}>
              <Activity className={combineClasses(DesignTokens.icons.header.size.full, DesignTokens.colors.accent.text[600])} />
            </div>
            <h2 className={combineClasses(DesignTokens.typography.h3.full, DesignTokens.typography.h3.weight, DesignTokens.colors.neutral.text[800])}>Current Status</h2>
          </div>
          <button
            onClick={() => setShowUpdateStatus(true)}
            className={combineClasses('p-2 -mr-2', DesignTokens.colors.accent.text[600], `hover:${DesignTokens.colors.accent.text[700]}`, `active:${DesignTokens.colors.accent.text[700]}`, DesignTokens.spacing.touchTarget, 'flex items-center justify-center', DesignTokens.transitions.default)}
            aria-label="Update current status"
          >
            <Edit2 className={DesignTokens.icons.standard.size.full} />
          </button>
        </div>
        <div className={combineClasses('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3', DesignTokens.spacing.gap.lg)}>
          <div className="flex flex-col">
            <span className={combineClasses('mb-1 text-sm', DesignTokens.colors.neutral.text[600])}>Diagnosis</span>
            <span className={combineClasses('font-medium', DesignTokens.colors.neutral.text[900])}>{currentStatus?.diagnosis || patientProfile?.diagnosis || 'No diagnosis yet'}</span>
          </div>
          {(currentStatus?.subtype || patientProfile?.cancerType) && (
            <div className="flex flex-col">
              <span className={combineClasses('mb-1 text-sm', DesignTokens.colors.neutral.text[600])}>Cancer Subtype</span>
              <span className={combineClasses('font-medium', DesignTokens.colors.neutral.text[900])}>{currentStatus?.subtype || patientProfile?.cancerType || '—'}</span>
            </div>
          )}
          {(currentStatus?.stage || patientProfile?.stage) && (
            <div className="flex flex-col">
              <span className={combineClasses('mb-1 text-sm', DesignTokens.colors.neutral.text[600])}>Stage</span>
              <span className={combineClasses('font-medium', DesignTokens.colors.neutral.text[900])}>{currentStatus?.stage || patientProfile?.stage || '—'}</span>
            </div>
          )}
          <div className="flex flex-col">
            <span className={combineClasses('mb-1 text-sm', DesignTokens.colors.neutral.text[600])}>Treatment Status</span>
            <span className={combineClasses('font-medium', DesignTokens.colors.neutral.text[900])}>{currentStatus?.treatmentLine || currentStatus?.currentRegimen || '—'}</span>
          </div>
          <div className="flex flex-col">
            <span className={combineClasses('mb-1 text-sm', DesignTokens.colors.neutral.text[600])}>ECOG Performance</span>
            <span className={combineClasses('font-medium', DesignTokens.colors.neutral.text[900])}>{currentStatus?.performanceStatus || '—'}</span>
          </div>
          <div className="flex flex-col">
            <span className={combineClasses('mb-1 text-sm', DesignTokens.colors.neutral.text[600])}>Disease Status</span>
            <span className={combineClasses('font-medium', DesignTokens.colors.neutral.text[900])}>{currentStatus?.diseaseStatus || '—'}</span>
          </div>
          {currentStatus?.baselineCa125 != null && currentStatus?.baselineCa125 !== '' && (
            <div className="flex flex-col">
              <span className={combineClasses('mb-1 text-sm', DesignTokens.colors.neutral.text[600])}>Baseline CA-125</span>
              <span className={combineClasses('font-medium', DesignTokens.colors.neutral.text[900])}>{currentStatus.baselineCa125}</span>
            </div>
          )}
        </div>
      </div>

      {/* Genomic Profile */}
      <div className={combineClasses(DesignTokens.components.card.containerLarge, 'border-purple-200')}>
        {genomicProfile && genomicProfile.mutations && genomicProfile.mutations.length > 0 && (
          <div className={combineClasses('flex items-center justify-between', DesignTokens.spacing.header.mobile)}>
            <div className={combineClasses('flex items-center', DesignTokens.spacing.gap.md)}>
              <div className={combineClasses('bg-gradient-to-br from-purple-50 to-pink-50', DesignTokens.spacing.iconContainer.full, DesignTokens.borders.radius.sm)}>
                <Dna className={combineClasses(DesignTokens.icons.header.size.full, 'text-purple-600')} />
              </div>
              <h2 className={combineClasses(DesignTokens.typography.h3.full, DesignTokens.typography.h3.weight, DesignTokens.colors.neutral.text[800])}>Genomic Profile</h2>
            </div>
            <div className={combineClasses('flex items-center', DesignTokens.spacing.gap.sm)}>
              <button
                onClick={() => setGenomicExpanded(!genomicExpanded)}
                className={combineClasses('text-purple-600 hover:text-purple-700 flex items-center', DesignTokens.spacing.gap.xs, DesignTokens.typography.body.sm, 'font-medium', DesignTokens.transitions.default)}
              >
                {genomicExpanded ? (
                  <>
                    <svg className={DesignTokens.icons.small.size.full} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                    Collapse
                  </>
                ) : (
                  <>
                    <svg className={DesignTokens.icons.small.size.full} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                    Expand
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setEditingGenomicProfile(genomicProfile ? {
                    mutations: genomicProfile.mutations || [],
                    biomarkers: genomicProfile.biomarkers || {},
                    testName: genomicProfile.testName || '',
                    testDate: genomicProfile.testDate ? (typeof genomicProfile.testDate === 'string' ? genomicProfile.testDate.split('T')[0] : new Date(genomicProfile.testDate).toISOString().split('T')[0]) : '',
                    laboratoryName: genomicProfile.laboratoryName || '',
                    specimenType: genomicProfile.specimenType || '',
                    tumorPurity: genomicProfile.tumorPurity || '',
                    tmb: genomicProfile.tmb || genomicProfile.biomarkers?.tumorMutationalBurden?.value || '',
                    msi: genomicProfile.msi || genomicProfile.biomarkers?.microsatelliteInstability?.status || '',
                    hrdScore: genomicProfile.hrdScore || genomicProfile.biomarkers?.hrdScore?.value || '',
                    cnvs: genomicProfile.cnvs || [],
                    fusions: genomicProfile.fusions || [],
                    germlineFindings: genomicProfile.germlineFindings || []
                  } : {
                    mutations: [],
                    biomarkers: {},
                    testName: '',
                    testDate: '',
                    laboratoryName: '',
                    specimenType: '',
                    tumorPurity: '',
                    tmb: '',
                    msi: '',
                    hrdScore: '',
                    cnvs: [],
                    fusions: [],
                    germlineFindings: []
                  });
                  setShowEditGenomic(true);
                }}
                className={combineClasses('p-2 -mr-2 text-purple-600 hover:text-purple-700 active:text-purple-800', DesignTokens.spacing.touchTarget, 'flex items-center justify-center', DesignTokens.transitions.default)}
                aria-label="Edit genomic profile"
              >
                <Edit2 className={DesignTokens.icons.standard.size.full} />
              </button>
            </div>
          </div>
        )}

        {/* Summary View - Always Visible */}
        {genomicProfile && ((genomicProfile.mutations && genomicProfile.mutations.length > 0) || (genomicProfile.cnvs && genomicProfile.cnvs.length > 0)) ? (
          <div className={combineClasses(DesignTokens.components.card.nested, 'mb-3')}>
            <div className={combineClasses('flex flex-wrap', DesignTokens.spacing.gap.sm)}>
              {genomicProfile.mutations && genomicProfile.mutations.slice(0, 5).map((mutation, idx) => (
                <span key={idx} className={combineClasses('px-3 py-1 bg-purple-100 text-purple-800', DesignTokens.borders.radius.full, DesignTokens.typography.body.xs, 'font-medium')}>
                  {mutation.gene} {formatLabel(mutation.variant || mutation.type)}
                </span>
              ))}
              {genomicProfile.cnvs && genomicProfile.cnvs.slice(0, 3).map((cnv, idx) => {
                const cnvType = cnv.type === 'amplification' || cnv.type === 'gain' || (cnv.copyNumber && cnv.copyNumber > 2) ? 'Amp' : 'Del';
                return (
                  <span key={`cnv-${idx}`} className={combineClasses('px-3 py-1 bg-orange-100 text-orange-800', DesignTokens.borders.radius.full, DesignTokens.typography.body.xs, 'font-medium')}>
                    {cnv.gene} {cnvType}
                  </span>
                );
              })}
              {genomicProfile.tmb && (
                <span className={combineClasses('px-3 py-1', DesignTokens.borders.radius.full, DesignTokens.typography.body.xs, 'font-medium', 'bg-gray-100', 'text-gray-800')}>
                  TMB: {genomicProfile.tmb}
                </span>
              )}
              {genomicProfile.msi && (
                <span className={combineClasses('px-3 py-1', DesignTokens.borders.radius.full, DesignTokens.typography.body.xs, 'font-medium', DesignTokens.components.status.normal.bg, DesignTokens.components.status.normal.text.replace('600', '800'))}>
                  MSI: {genomicProfile.msi}
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className={combineClasses(DesignTokens.components.emptyState.container)}>
            <div className={combineClasses(DesignTokens.components.emptyState.iconContainer, 'bg-gradient-to-br from-purple-100 to-pink-100')}>
              <Dna className={combineClasses(DesignTokens.components.emptyState.icon, 'text-purple-600')} />
            </div>
            <h3 className={combineClasses(DesignTokens.components.emptyState.title, DesignTokens.typography.h3.full)}>No genomic data yet</h3>
            <p className={combineClasses(DesignTokens.components.emptyState.message, DesignTokens.typography.body.sm)}>Upload your genomic test report to match with targeted therapies and clinical trials</p>
            <div className={DesignTokens.components.emptyState.actions}>
                <button
                  onClick={() => openDocumentOnboarding('genomic')}
                  className={combineClasses(DesignTokens.spacing.button.full, DesignTokens.spacing.touchTarget, 'bg-purple-600 text-white', DesignTokens.borders.radius.sm, 'hover:bg-purple-700 active:bg-purple-800', DesignTokens.transitions.all, DesignTokens.typography.body.sm, 'font-semibold', DesignTokens.shadows.sm, DesignTokens.shadows.hover, 'flex items-center justify-center', DesignTokens.spacing.gap.sm)}
                >
                <Upload className={DesignTokens.icons.standard.size.full} />
                Upload Genomic Report
              </button>
            </div>
          </div>
        )}

        {/* Expanded Details */}
        {genomicExpanded && genomicProfile && ((genomicProfile.mutations && genomicProfile.mutations.length > 0) || (genomicProfile.cnvs && genomicProfile.cnvs.length > 0) || genomicProfile.tmb || genomicProfile.msi || genomicProfile.hrd) && (
          <div className={combineClasses('space-y-3', DesignTokens.spacing.gap.md, 'animate-fade-scale')}>
            {/* Key Mutations */}
            <div className={DesignTokens.components.card.nestedLarge}>
              <h3 className={combineClasses(DesignTokens.typography.h3.weight, 'mb-3', DesignTokens.typography.body.sm, 'flex items-center', DesignTokens.spacing.gap.sm, DesignTokens.colors.neutral.text[800])}>
                <svg className={combineClasses(DesignTokens.icons.standard.size.full, 'text-purple-600')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
                Germline & Somatic Mutations
              </h3>
              <div className={combineClasses('space-y-2', DesignTokens.spacing.gap.sm)}>
                {genomicProfile.mutations.map((mutation, idx) => {
                  const { dna, protein, kind } = parseMutation(mutation);
                  
                  // Get VAF from multiple possible sources
                  const vaf = mutation.variantAlleleFrequency ?? mutation.vaf ?? mutation.VAF ?? mutation.frequency ?? null;
                  
                  return (
                    <div key={idx} className={combineClasses('flex items-start justify-between', DesignTokens.spacing.card.mobile, 'bg-purple-50 border border-purple-200', DesignTokens.borders.radius.sm)}>
                      <div className="flex-1">
                        <div className={combineClasses('flex items-center', DesignTokens.spacing.gap.sm)}>
                          <span className={combineClasses(DesignTokens.typography.h3.weight, DesignTokens.typography.body.sm, DesignTokens.colors.neutral.text[900], IMPORTANT_GENES.includes((mutation.gene||'').toUpperCase()) ? 'text-yellow-700' : '')}>{mutation.gene}</span>
                          <span className={combineClasses('px-2 py-0.5', IMPORTANT_GENES.includes((mutation.gene||'').toUpperCase()) ? 'bg-yellow-100 text-yellow-800' : 'bg-purple-100 text-purple-800', DesignTokens.borders.radius.sm, DesignTokens.typography.body.xs, 'font-medium')}>
                            {formatLabel(kind || mutation.type || 'Mutation')}
                          </span>
                        </div>
                        {dna && (
                          <p className={combineClasses('text-xs mt-1', DesignTokens.colors.neutral.text[700])}>
                            <span className="font-medium">DNA:</span> {dna}
                            {vaf !== null && vaf !== undefined && (
                              <span className={combineClasses('ml-2', DesignTokens.colors.neutral.text[600])}>({typeof vaf === 'number' ? vaf.toFixed(1) : vaf}% VAF)</span>
                            )}
                          </p>
                        )}
                        {protein && (
                          <p className={combineClasses('text-xs mt-1', DesignTokens.colors.neutral.text[700])}>
                            <span className="font-medium">Protein:</span> {protein}
                          </p>
                        )}
                        {!dna && !protein && mutation.variant && (
                          <p className={combineClasses('text-xs mt-1', DesignTokens.colors.neutral.text[700])}>
                            {mutation.variant}
                            {vaf !== null && vaf !== undefined && (
                              <span className={combineClasses('ml-2', DesignTokens.colors.neutral.text[600])}>({typeof vaf === 'number' ? vaf.toFixed(1) : vaf}% VAF)</span>
                            )}
                          </p>
                        )}
                        {mutation.significance && (
                          <div className="mt-1">
                            <p className={combineClasses('text-xs font-medium', DesignTokens.colors.neutral.text[600])}>{formatSignificance(mutation.significance)}</p>
                            {significanceExplanation(mutation.significance) && (
                              <p className={combineClasses('text-xs mt-0.5', DesignTokens.colors.neutral.text[500])}>{significanceExplanation(mutation.significance)}</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Copy Number Variants (CNVs) */}
            {genomicProfile.cnvs && genomicProfile.cnvs.length > 0 && (
              <div className={DesignTokens.components.card.nestedLarge}>
                <h3 className={combineClasses('font-semibold mb-3 text-sm flex items-center gap-2', DesignTokens.colors.neutral.text[800])}>
                  <Copy className={combineClasses(DesignTokens.icons.standard.size.full, 'text-orange-600')} />
                  Copy Number Variants (CNVs)
                </h3>
                <div className={combineClasses('space-y-2', DesignTokens.spacing.gap.sm)}>
                  {genomicProfile.cnvs.map((cnv, idx) => (
                    <div key={idx} className={combineClasses('flex items-start justify-between', DesignTokens.spacing.card.mobile, 'bg-orange-50 border border-orange-200', DesignTokens.borders.radius.sm)}>
                      <div className="flex-1">
                        <div className={combineClasses('flex items-center', DesignTokens.spacing.gap.sm)}>
                          <span className={combineClasses('font-semibold text-sm', DesignTokens.colors.neutral.text[900], IMPORTANT_GENES.includes((cnv.gene||'').toUpperCase()) ? 'text-yellow-700' : '')}>
                            {cnv.gene}
                          </span>
                          <span className={combineClasses('px-2 py-0.5 bg-orange-100 text-orange-800', DesignTokens.borders.radius.sm, DesignTokens.typography.body.xs, 'font-medium')}>
                            {cnv.type === 'amplification' || cnv.type === 'gain' || (cnv.copyNumber && cnv.copyNumber > 2) ? 'Amplification' : 'Deletion'}
                          </span>
                          {IMPORTANT_GENES.includes((cnv.gene||'').toUpperCase()) && (
                            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">
                              Important
                            </span>
                          )}
                        </div>
                        {cnv.copyNumber && (
                          <p className={combineClasses('text-xs mt-1', DesignTokens.colors.neutral.text[700])}>
                            <span className="font-medium">Copy Number:</span> {cnv.copyNumber}
                          </p>
                        )}
                        {cnv.note && (
                          <p className={combineClasses('text-xs mt-1', DesignTokens.colors.neutral.text[600])}>{cnv.note}</p>
                        )}
                        {cnv.gene === 'CCNE1' && (
                          <p className="text-xs text-orange-700 font-medium mt-1 flex items-center gap-1">
                            <AlertCircle className="w-4 h-4" /> Platinum resistance marker - important for treatment planning
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Biomarkers */}
            <div className={DesignTokens.components.card.nestedLarge}>
              <h3 className={combineClasses('font-semibold mb-3 text-sm flex items-center gap-2', DesignTokens.colors.neutral.text[800])}>
                <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Biomarkers
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {genomicProfile.hrd && (
                  <div className="p-2 bg-purple-50 border border-purple-200 rounded">
                    <p className={combineClasses('text-xs mb-1', DesignTokens.colors.neutral.text[600])}>HRD Score</p>
                    <p className="text-lg font-bold text-purple-900">{genomicProfile.hrd}</p>
                    <p className="text-xs text-purple-700 font-medium">
                      {genomicProfile.hrd >= 42 ? 'Positive (≥42)' : 'Negative (<42)'}
                    </p>
                  </div>
                )}

                {genomicProfile.tmb && (
                  <div className={combineClasses('p-2 border rounded', 'bg-gray-50', 'border-gray-200')}>
                    <p className={combineClasses('text-xs mb-1', DesignTokens.colors.neutral.text[600])}>TMB</p>
                    <p className={combineClasses('text-lg font-bold', 'text-gray-800')}>{genomicProfile.tmb}</p>
                    <p className={combineClasses('text-xs font-medium', DesignTokens.colors.primary.text[700])}>
                      {parseFloat(genomicProfile.tmb) >= 10 ? 'High (≥10 mut/Mb)' : 'Low (<10 mut/Mb)'}
                    </p>
                  </div>
                )}

                {genomicProfile.msi && (
                  <div className={combineClasses('p-2 border rounded', DesignTokens.components.status.normal.bg, DesignTokens.components.status.normal.border)}>
                    <p className={combineClasses('text-xs mb-1', DesignTokens.colors.neutral.text[600])}>MSI Status</p>
                    <p className={combineClasses('text-sm font-bold', DesignTokens.components.status.normal.text.replace('600', '900'))}>{genomicProfile.msi}</p>
                    <p className={combineClasses('text-xs font-medium', DesignTokens.components.status.normal.text.replace('600', '700'))}>Microsatellite status</p>
                  </div>
                )}

                {genomicProfile.pdl1 && (
                  <div className="p-2 bg-teal-50 border border-teal-200 rounded">
                    <p className={combineClasses('text-xs mb-1', DesignTokens.colors.neutral.text[600])}>PD-L1</p>
                    <p className="text-sm font-bold text-teal-900">{genomicProfile.pdl1}</p>
                    <p className="text-xs text-teal-700 font-medium">Expression level</p>
                  </div>
                )}
              </div>
            </div>

            {/* Test Information */}
            {(genomicProfile.testType || genomicProfile.testDate || genomicProfile.sampleType) && (
              <div className={DesignTokens.components.card.nested}>
                <h3 className={combineClasses('font-semibold mb-2 text-sm', DesignTokens.colors.neutral.text[800])}>Test Information</h3>
                <div className="space-y-1 text-xs">
                  {genomicProfile.testType && (
                    <div className="flex justify-between">
                      <span className={DesignTokens.colors.neutral.text[600]}>Test Type:</span>
                      <span className={combineClasses('font-medium', DesignTokens.colors.neutral.text[900])}>{genomicProfile.testType}</span>
                    </div>
                  )}
                  {genomicProfile.sampleType && (
                    <div className="flex justify-between">
                      <span className={DesignTokens.colors.neutral.text[600]}>Sample:</span>
                      <span className={combineClasses('font-medium', DesignTokens.colors.neutral.text[900])}>{genomicProfile.sampleType}</span>
                    </div>
                  )}
                  {genomicProfile.testDate && (
                    <div className="flex justify-between">
                      <span className={DesignTokens.colors.neutral.text[600]}>Test Date:</span>
                      <span className={combineClasses('font-medium', DesignTokens.colors.neutral.text[900])}>
                        {genomicProfile.testDate instanceof Date 
                          ? genomicProfile.testDate.toLocaleDateString() 
                          : typeof genomicProfile.testDate === 'string' 
                            ? genomicProfile.testDate 
                            : new Date(genomicProfile.testDate).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  {genomicProfile.genesAnalyzed && (
                    <div className="flex justify-between">
                      <span className={DesignTokens.colors.neutral.text[600]}>Genes Analyzed:</span>
                      <span className={combineClasses('font-medium', DesignTokens.colors.neutral.text[900])}>{genomicProfile.genesAnalyzed}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Treatment Implications */}
            {(() => {
              const implications = [];
              
              // Check for BRCA mutations
              const hasBRCA = genomicProfile.mutations?.some(m => 
                (m.gene || '').toUpperCase() === 'BRCA1' || (m.gene || '').toUpperCase() === 'BRCA2'
              );
              if (hasBRCA) {
                implications.push('BRCA mutation indicates high sensitivity to PARP inhibitors (Olaparib, Niraparib, Rucaparib).');
              }
              
              // Check for HRD-positive
              const hrdScore = genomicProfile.hrdScore || (typeof genomicProfile.hrd === 'number' ? genomicProfile.hrd : null);
              if (hrdScore && hrdScore >= 42) {
                implications.push('HRD-positive status supports platinum-based chemotherapy and PARP inhibitors.');
              }
              
              // Check for MSI-H
              if (genomicProfile.msi && (genomicProfile.msi.includes('MSI-H') || genomicProfile.msi.includes('MSI-High'))) {
                implications.push('MSI-High status indicates potential benefit from immunotherapy (Pembrolizumab, Nivolumab).');
              }
              
              // Check for TMB-High
              const tmbValue = genomicProfile.tmbValue || (typeof genomicProfile.tmb === 'string' && genomicProfile.tmb.match(/[0-9.]+/) ? parseFloat(genomicProfile.tmb.match(/[0-9.]+/)[0]) : null);
              if (tmbValue && tmbValue >= 10) {
                implications.push('TMB-High (≥10 mut/Mb) indicates potential benefit from immunotherapy.');
              }
              
              // Check for PIK3CA mutations
              const hasPIK3CA = genomicProfile.mutations?.some(m => 
                (m.gene || '').toUpperCase() === 'PIK3CA'
              );
              if (hasPIK3CA) {
                implications.push('PIK3CA mutation may indicate benefit from PI3K inhibitors (Alpelisib for breast cancer).');
              }
              
              // Check for FDA approved therapies from extracted data
              if (genomicProfile.fdaApprovedTherapies && Array.isArray(genomicProfile.fdaApprovedTherapies) && genomicProfile.fdaApprovedTherapies.length > 0) {
                implications.push(`FDA-approved therapies available: ${genomicProfile.fdaApprovedTherapies.join(', ')}.`);
              }
              
              // If no specific implications, don't show the card
              if (implications.length === 0) {
                return null;
              }
              
              return (
                <div className="bg-purple-100 border border-purple-300 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-purple-700 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-xs font-semibold text-purple-900">Treatment Implications</p>
                      <div className="text-xs text-purple-800 mt-1 space-y-1">
                        {implications.map((implication, idx) => (
                          <p key={idx}>{implication}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Medical Team & Emergency Contacts - Side by Side */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Medical Team */}
        <div className="flex-1 bg-white rounded-lg sm:rounded-xl shadow-sm p-4 border-2 border-medical-primary-200">
          {(patientProfile.oncologist || patientProfile.hospital || patientProfile.clinicalTrialCoordinator || patientProfile.caregiverName) && (
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="bg-medical-primary-50 p-2.5 rounded-lg">
                  <Users className="w-5 h-5 text-medical-primary-600" />
                </div>
                <h2 className={combineClasses('font-semibold', DesignTokens.colors.neutral.text[800])}>Medical Team</h2>
              </div>
              <button
                onClick={() => setShowEditMedicalTeam(true)}
                className="p-2 -mr-2 text-medical-primary-600 hover:text-medical-primary-700 active:text-medical-primary-800 touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Edit medical team"
              >
                <Edit2 size={20} />
              </button>
            </div>
          )}
          {(patientProfile.oncologist || patientProfile.hospital || patientProfile.clinicalTrialCoordinator || patientProfile.caregiverName) ? (
            <div className={combineClasses('text-sm space-y-2', DesignTokens.colors.neutral.text[700])}>
              {patientProfile.oncologist && (
                <div>
                  <p><strong>Oncologist:</strong> {patientProfile.oncologist}</p>
                  {patientProfile.oncologistPhone && <p className={combineClasses('text-xs ml-4', DesignTokens.colors.neutral.text[600])}>Phone: {patientProfile.oncologistPhone}</p>}
                  {patientProfile.oncologistEmail && <p className={combineClasses('text-xs ml-4', DesignTokens.colors.neutral.text[600])}>Email: {patientProfile.oncologistEmail}</p>}
                </div>
              )}
              {patientProfile.hospital && (
                <p><strong>Hospital/Clinic:</strong> {patientProfile.hospital}</p>
              )}
              {patientProfile.clinicalTrialCoordinator && (
                <div>
                  <p><strong>Clinical Trial Coordinator:</strong> {patientProfile.clinicalTrialCoordinator}</p>
                  {patientProfile.clinicalTrialCoordinatorPhone && <p className={combineClasses('text-xs ml-4', DesignTokens.colors.neutral.text[600])}>Phone: {patientProfile.clinicalTrialCoordinatorPhone}</p>}
                  {patientProfile.clinicalTrialCoordinatorEmail && <p className={combineClasses('text-xs ml-4', DesignTokens.colors.neutral.text[600])}>Email: {patientProfile.clinicalTrialCoordinatorEmail}</p>}
                </div>
              )}
              {patientProfile.caregiverName && (
                <div>
                  <p><strong>Caregiver:</strong> {patientProfile.caregiverName}</p>
                  {patientProfile.caregiverPhone && <p className={combineClasses('text-xs ml-4', DesignTokens.colors.neutral.text[600])}>Phone: {patientProfile.caregiverPhone}</p>}
                  {patientProfile.caregiverEmail && <p className={combineClasses('text-xs ml-4', DesignTokens.colors.neutral.text[600])}>Email: {patientProfile.caregiverEmail}</p>}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg sm:rounded-xl p-6 sm:p-8 text-center">
              <div className="w-16 h-16 bg-medical-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-medical-primary-600" />
              </div>
              <h3 className="text-lg font-semibold text-medical-neutral-900 mb-2">No medical team added yet</h3>
              <p className="text-sm text-medical-neutral-600 mb-6">Add your oncologist, hospital, and clinical trial coordinator</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => setShowEditMedicalTeam(true)}
                  className="px-6 py-3 min-h-[44px] bg-medical-primary-500 text-white rounded-lg hover:bg-medical-primary-600 active:bg-medical-primary-700 transition-all duration-200 text-sm font-semibold shadow-sm hover:shadow-md flex items-center justify-center gap-2 touch-manipulation"
                >
                  <Plus className="w-4 h-4" />
                  Add Medical Team
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Emergency Contacts */}
        <div className="flex-1 bg-white rounded-lg sm:rounded-xl shadow-sm p-4 border-2 border-amber-200">
          {emergencyContacts.length > 0 && (
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="bg-amber-50 p-2.5 rounded-lg">
                  <Phone className="w-5 h-5 text-amber-600" />
                </div>
                <h2 className={combineClasses('font-semibold', DesignTokens.colors.neutral.text[800])}>Emergency Contacts</h2>
              </div>
              <button
                onClick={async () => { 
                  const contacts = await emergencyContactService.getEmergencyContacts(user.uid);
                  const filteredContacts = contacts.filter(c => 
                    (c.name && c.name.trim()) || (c.phone && c.phone.trim())
                  );
                  setEditContacts(filteredContacts.length ? [...filteredContacts] : []);
                  setEmergencyContacts(filteredContacts);
                  setShowEditContacts(true); 
                }}
                className="p-2 -mr-2 text-amber-600 hover:text-amber-700 active:text-amber-800 touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Edit emergency contacts"
              >
                <Edit2 size={20} />
              </button>
            </div>
          )}
          {emergencyContacts.length > 0 ? (
            <div className="space-y-2">
              {emergencyContacts.map((contact) => {
                return (
                  <div key={contact.id} className="bg-amber-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <User size={14} className="text-amber-600" />
                      <p className={combineClasses('text-xs font-medium', DesignTokens.colors.neutral.text[600])}>{contact.relationship}</p>
                    </div>
                    <p className={combineClasses('text-sm font-semibold', DesignTokens.colors.neutral.text[900])}>{contact.name}</p>
                    <p className={combineClasses('text-xs mt-0.5', DesignTokens.colors.neutral.text[600])}>{contact.phone}</p>
                    {contact.email && (
                      <p className={combineClasses('text-xs', DesignTokens.colors.neutral.text[600])}>{contact.email}</p>
                    )}
                    {contact.address && (
                      <p className={combineClasses('text-xs', DesignTokens.colors.neutral.text[600])}>{contact.address}{contact.city ? `, ${contact.city}` : ''}{contact.state ? ` ${contact.state}` : ''}{contact.zip ? ` ${contact.zip}` : ''}</p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-lg sm:rounded-xl p-6 sm:p-8 text-center">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Phone className="w-8 h-8 text-amber-600" />
              </div>
              <h3 className="text-lg font-semibold text-medical-neutral-900 mb-2">No emergency contacts added</h3>
              <p className="text-sm text-medical-neutral-600 mb-6">Add emergency contacts for quick access</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={async () => { 
                    const contacts = await emergencyContactService.getEmergencyContacts(user.uid);
                    const filteredContacts = contacts.filter(c => 
                      (c.name && c.name.trim()) || (c.phone && c.phone.trim())
                    );
                    setEditContacts(filteredContacts.length ? [...filteredContacts] : []);
                    setEmergencyContacts(filteredContacts);
                    setShowEditContacts(true); 
                  }}
                  className="px-6 py-3 min-h-[44px] bg-amber-600 text-white rounded-lg hover:bg-amber-700 active:bg-amber-800 transition-all duration-200 text-sm font-semibold shadow-sm hover:shadow-md flex items-center justify-center gap-2 touch-manipulation"
                >
                  <Plus className="w-4 h-4" />
                  Add Emergency Contact
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Settings Section */}
      {user && (
        <div className="bg-white rounded-lg sm:rounded-xl shadow-sm p-4 sm:p-5 md:p-6 border-2 border-medical-neutral-300">
          <div className="flex items-center gap-2 mb-6">
            <Settings className="w-5 h-5 text-medical-neutral-600" />
            <h2 className="font-semibold text-medical-neutral-900">Settings</h2>
          </div>

          <div className="space-y-6">
            {/* Preferences Section */}
            <div>
              <h3 className="text-sm font-semibold text-medical-neutral-900 mb-4 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-medical-neutral-500" />
                Preferences
              </h3>
              
              {/* User Role Toggle */}
              <div className={DesignTokens.components.card.nestedSubtleLarge}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-medical-neutral-900 mb-1">
                      {patientProfile?.isPatient !== false ? 'I am the patient' : 'I am a caregiver'}
                    </p>
                    <p className="text-xs text-medical-neutral-500">
                      {patientProfile?.isPatient !== false 
                        ? 'Chatbot will address you directly as the patient'
                        : 'Chatbot will address you as a caregiver helping the patient'}
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      const newIsPatient = !(patientProfile?.isPatient !== false);
                      const previousIsPatient = patientProfile?.isPatient !== false;
                      
                      // Update local state first for immediate UI feedback
                      setPatientProfile(prev => {
                        if (!prev) return prev; // Safety check
                        return { ...prev, isPatient: newIsPatient };
                      });
                      
                      try {
                        // Then save to database using updated state
                        const { patientService } = await import('../../firebase/services');
                        const updatedProfile = patientProfile ? {
                          ...patientProfile,
                          isPatient: newIsPatient
                        } : {
                          isPatient: newIsPatient
                        };
                        
                        await patientService.savePatient(user.uid, updatedProfile);
                        
                        // Refresh to ensure sync (but local state already updated)
                        await refreshPatient();
                      } catch (error) {
                        // Revert on error
                        setPatientProfile(prev => {
                          if (!prev) return prev;
                          return { ...prev, isPatient: previousIsPatient };
                        });
                      }
                    }}
                    className={`relative inline-flex h-7 w-12 sm:h-6 sm:w-11 items-center rounded-full transition-colors flex-shrink-0 ml-4 touch-manipulation ${
                      patientProfile?.isPatient !== false ? 'bg-medical-primary-600' : 'bg-gray-300'
                    }`}
                    aria-label={patientProfile?.isPatient !== false ? 'Switch to caregiver mode' : 'Switch to patient mode'}
                  >
                    <span
                      className={`inline-block h-5 w-5 sm:h-4 sm:w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                        patientProfile?.isPatient !== false ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Account & Security Section */}
            <div>
              <h3 className="text-sm font-semibold text-medical-neutral-900 mb-4 flex items-center gap-2">
                <Shield className="w-4 h-4 text-medical-neutral-500" />
                Account & Security
              </h3>
              
              <div className="space-y-4">
                {/* Account Info */}
                <div className={DesignTokens.components.card.nestedSubtleLarge}>
                  <p className="text-xs text-medical-neutral-500 mb-1">Email</p>
                  <p className="text-sm font-medium text-medical-neutral-900">{user.email}</p>
                  {user.providerData && user.providerData.length > 0 && (
                    <p className="text-xs text-medical-neutral-500 mt-2">
                      Sign-in method: {user.providerData.map(p => p.providerId === 'password' ? 'Email/Password' : p.providerId === 'google.com' ? 'Google' : p.providerId).join(', ')}
                    </p>
                  )}
                </div>

                {/* Account Actions */}
                <div className="flex flex-wrap gap-2">
                  {user.providerData && !user.providerData.some(p => p.providerId === 'google.com') && (
                    <button
                      onClick={handleLinkGoogleAccount}
                      disabled={isLinkingGoogle}
                      className="flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] bg-white border border-medical-neutral-300 text-medical-neutral-700 rounded-lg text-sm font-medium hover:bg-medical-neutral-50 active:bg-medical-neutral-100 transition disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                    >
                      {isLinkingGoogle ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Linking...
                        </>
                      ) : (
                        <>
                          <Link2 className="w-4 h-4" />
                          Link Google Account
                        </>
                      )}
                    </button>
                  )}
                  {user.providerData && user.providerData.some(p => p.providerId === 'google.com') && user.providerData.some(p => p.providerId === 'password') && (
                    <button
                      onClick={handleUnlinkGoogleAccount}
                      disabled={isUnlinkingGoogle}
                      className="flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] bg-white border border-medical-neutral-300 text-medical-neutral-700 rounded-lg text-sm font-medium hover:bg-medical-neutral-50 active:bg-medical-neutral-100 transition disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                    >
                      {isUnlinkingGoogle ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Unlinking...
                        </>
                      ) : (
                        <>
                          <Unlink className="w-4 h-4" />
                          Unlink Google
                        </>
                      )}
                    </button>
                  )}
                  <button
                    onClick={handleSignOut}
                    className="flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] bg-white border border-medical-neutral-300 text-medical-neutral-700 rounded-lg text-sm font-medium hover:bg-medical-neutral-50 active:bg-medical-neutral-100 transition touch-manipulation"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              </div>
            </div>

            {/* Data Management Section */}
            <div className="pt-4 border-t border-medical-neutral-200">
              <h3 className="text-sm font-semibold text-medical-neutral-900 mb-4 flex items-center gap-2">
                <Trash2 className={combineClasses('w-4 h-4', DesignTokens.components.status.high.icon)} />
                <span className={DesignTokens.components.status.high.text}>Data Management</span>
              </h3>
              
              <div className={combineClasses('border rounded-lg p-4 space-y-3', DesignTokens.components.status.high.bg, DesignTokens.components.status.high.border)}>
                <p className={combineClasses('text-xs font-medium', DesignTokens.components.alert.text.error)}>
                  Warning: These actions cannot be undone.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setDeletionType('data');
                      setShowDeletionConfirm(true);
                    }}
                    disabled={isDeleting}
                    className={combineClasses('flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] bg-white border rounded-lg text-sm font-medium transition touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed', DesignTokens.components.status.high.border.replace('200', '300'), DesignTokens.components.alert.text.error, `hover:${DesignTokens.components.status.high.bg}`, `active:${DesignTokens.components.status.high.bg.replace('50', '100')}`)}
                  >
                    {isDeleting ? (
                      <>
                        <Activity className="w-4 h-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        Clear Health Data
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setDeletionType('account');
                      setShowDeletionConfirm(true);
                    }}
                    disabled={isDeleting}
                    className={combineClasses('flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] text-white rounded-lg text-sm font-medium transition touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed', DesignTokens.components.status.high.text.replace('text-', 'bg-').replace('600', '600'), `hover:${DesignTokens.components.status.high.text.replace('text-', 'bg-').replace('600', '700')}`, 'active:bg-red-800')}
                  >
                    {isDeleting ? (
                      <>
                        <Activity className="w-4 h-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        Delete Account
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <EditPatientInfoModal
        show={showEditInfo}
        onClose={() => setShowEditInfo(false)}
        user={user}
        patientProfile={patientProfile}
        setPatientProfile={setPatientProfile}
        refreshPatient={refreshPatient}
      />

      <EditGenomicModal
        show={showEditGenomic}
        editingGenomicProfile={editingGenomicProfile}
        setEditingGenomicProfile={setEditingGenomicProfile}
        onClose={() => {
          setShowEditGenomic(false);
          setEditingGenomicProfile(null);
        }}
        user={user}
        setGenomicProfile={setGenomicProfile}
        setMessages={() => {}} // Not used in ProfileTab
      />

      <EditContactsModal
        show={showEditContacts}
        onClose={() => setShowEditContacts(false)}
        user={user}
        editContacts={editContacts}
        setEditContacts={setEditContacts}
        setEmergencyContacts={setEmergencyContacts}
      />

      <EditMedicalTeamModal
        show={showEditMedicalTeam}
        onClose={() => setShowEditMedicalTeam(false)}
        user={user}
        patientProfile={patientProfile}
        setPatientProfile={setPatientProfile}
        refreshPatient={refreshPatient}
        emergencyContacts={emergencyContacts}
      />

      <UpdateStatusModal
        show={showUpdateStatus}
        onClose={() => {
          setShowUpdateStatus(false);
          // Refresh patient data to ensure UI is in sync
          refreshPatient();
        }}
        user={user}
        currentStatus={currentStatus}
        setCurrentStatus={setCurrentStatus}
        updateStatusSubtypeCustom={updateStatusSubtypeCustom}
        setUpdateStatusSubtypeCustom={setUpdateStatusSubtypeCustom}
        updateStatusTreatmentCustom={updateStatusTreatmentCustom}
        setUpdateStatusTreatmentCustom={setUpdateStatusTreatmentCustom}
        setPatientProfile={setPatientProfile}
        setMessages={undefined}
      />

      <DeletionConfirmationModal
        show={showDeletionConfirm}
        onClose={() => setShowDeletionConfirm(false)}
        deletionType={deletionType}
        isDeleting={isDeleting}
        onConfirm={() => handleDeleteData(deletionType)}
      />

      {showDocumentOnboarding && (
        <DocumentUploadOnboarding
          isOnboarding={!hasUploadedDocument}
          onClose={() => setShowDocumentOnboarding(false)}
          onUploadClick={(documentType, documentDate = null, documentNote = null) => {
            setShowDocumentOnboarding(false);
            setPendingDocumentDate(documentDate);
            setPendingDocumentNote(documentNote);
            // Note: Actual upload logic would need to be handled here or passed via callback
            // For now, this is a placeholder - the full upload flow is in App.js
            showError('Document upload functionality needs to be connected');
          }}
        />
      )}
    </div>
  );
}

