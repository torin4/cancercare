import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { Camera, User, Calendar, MapPin, TrendingUp, Activity, Edit2, Dna, Upload, AlertCircle, Users, Phone, Plus, Settings, Link2, Loader2, Unlink, LogOut, Trash2, Sliders, Shield, HeartHandshake, Copy, MoreVertical, HardDrive, Download, Cloud, FileText } from 'lucide-react';
import { DesignTokens, Layouts, combineClasses } from '../../design/designTokens';
import { signOut, linkWithPopup, unlink, GoogleAuthProvider, deleteUser, EmailAuthProvider, linkWithCredential, reauthenticateWithCredential, reauthenticateWithPopup, updatePassword } from 'firebase/auth';
import { auth } from '../../firebase/config';
import { useAuth } from '../../contexts/AuthContext';
import { usePatientContext } from '../../contexts/PatientContext';
import { useHealthContext } from '../../contexts/HealthContext';
import { useBanner } from '../../contexts/BannerContext';
import { emergencyContactService, accountService, documentService } from '../../firebase/services';
import { exportUserBackup, downloadBackup, createBackupZip } from '../../services/backupExportService';
import { uploadBackupToDrive, isGoogleDriveConfigured } from '../../services/googleDriveBackupService';
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
import ShareForDoctorModal from '../modals/ShareForDoctorModal';

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
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef(null);
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

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    };

    if (showProfileMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showProfileMenu]);
  
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
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [includeDocuments, setIncludeDocuments] = useState(false);
  const [showShareForDoctorModal, setShowShareForDoctorModal] = useState(false);
  
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
      
      // Load profile image: prioritize uploaded profileImage, then Google photoURL
      if (patientProfile.profileImage) {
        setProfileImage(patientProfile.profileImage);
      } else if (user?.photoURL) {
        setProfileImage(user.photoURL);
      } else {
        setProfileImage(null);
      }
    }
  }, [patientProfile, user]);

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

  const handleTogglePasswordForm = () => {
    setShowPasswordForm(prev => !prev);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleChangePassword = async () => {
    if (!user || isUpdatingPassword) return;

    const hasEmailPassword = user.providerData?.some(p => p.providerId === 'password');
    const hasGoogle = user.providerData?.some(p => p.providerId === 'google.com');

    if (!newPassword || newPassword.length < 8) {
      showError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      showError('New password and confirmation do not match.');
      return;
    }
    if (hasEmailPassword && !currentPassword) {
      showError('Please enter your current password to continue.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        showError('No user found. Please log in and try again.');
        return;
      }

      if (hasEmailPassword) {
        const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
        await reauthenticateWithCredential(currentUser, credential);
        await updatePassword(currentUser, newPassword);
      } else if (hasGoogle) {
        const provider = new GoogleAuthProvider();
        await reauthenticateWithPopup(currentUser, provider);
        const credential = EmailAuthProvider.credential(currentUser.email, newPassword);
        await linkWithCredential(currentUser, credential);
      } else {
        showError('Password changes are not available for your sign-in method.');
        return;
      }

      showSuccess('Password updated successfully.');
      handleTogglePasswordForm();
    } catch (error) {
      if (error.code === 'auth/requires-recent-login') {
        showError('Please re-authenticate and try again.');
      } else if (error.code === 'auth/wrong-password') {
        showError('Current password is incorrect.');
      } else {
        showError(`Failed to update password: ${error.message}`);
      }
    } finally {
      setIsUpdatingPassword(false);
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
        <div className={combineClasses('flex flex-row items-center', DesignTokens.spacing.gap.md)}>
          {/* Profile Picture */}
          <div className="relative flex-shrink-0">
            {profileImage ? (
              <img 
                src={profileImage} 
                alt="Profile" 
                className={combineClasses('w-20 h-20 sm:w-32 sm:h-32', DesignTokens.borders.radius.full, 'object-cover border-4 border-white')} 
              />
            ) : (
              <div className={combineClasses('w-20 h-20 sm:w-32 sm:h-32 bg-gradient-to-br from-gray-800 to-gray-600', DesignTokens.borders.radius.full, 'flex items-center justify-center text-white text-2xl sm:text-4xl font-bold border-4 border-white')}>
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
            {/* Three-dot menu button */}
            <div className="absolute bottom-0 right-0" ref={profileMenuRef}>
            <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className={combineClasses('w-8 h-8 sm:w-12 sm:h-12', DesignTokens.colors.app[900], DesignTokens.borders.radius.full, 'flex items-center justify-center text-white', DesignTokens.shadows.lg, 'hover:' + DesignTokens.colors.app[800], 'active:' + DesignTokens.colors.app[800], DesignTokens.transitions.all, 'transform active:scale-95', DesignTokens.spacing.touchTarget)}
                title="Profile options"
                aria-label="Profile options"
              >
                <MoreVertical className={DesignTokens.icons.button.size.full} />
              </button>
              
              {/* Dropdown menu */}
              {showProfileMenu && (
                <div className={combineClasses('absolute bottom-full right-0 mb-2 min-w-[160px]', DesignTokens.colors.app[50], DesignTokens.borders.width.default, DesignTokens.colors.app.border[200], DesignTokens.borders.radius.md, DesignTokens.shadows.lg, 'py-1 z-50')}>
                  <button
                    onClick={async () => {
                      setShowProfileMenu(false);
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                      input.onchange = async (e) => {
                  const file = e.target.files[0];
                        if (file && user) {
                          try {
                            let fileToUpload = file;
                            let previewDataUrl = null;
                            
                            // Check if file is HEIC/HEIF and convert to JPEG
                            const fileName = file.name.toLowerCase();
                            const isHeic = fileName.endsWith('.heic') || fileName.endsWith('.heif') || 
                                          file.type === 'image/heic' || file.type === 'image/heif';
                            
                            if (isHeic) {
                              try {
                                // Convert HEIC to JPEG using heic-to (better format support)
                                const { heicTo } = await import('heic-to');
                                const convertedBlob = await heicTo({ blob: file });
                                
                                // heic-to returns a Blob directly
                                fileToUpload = convertedBlob;
                                
                                // Create preview from converted blob
                    const reader = new FileReader();
                                previewDataUrl = await new Promise((resolve) => {
                                  reader.onload = (e) => resolve(e.target.result);
                                  reader.readAsDataURL(fileToUpload);
                                });
                              } catch (heicError) {
                                console.error('HEIC conversion error:', heicError);
                                // If conversion fails, show helpful error message
                                showError('Unable to convert HEIC image. Please convert it to JPEG or PNG first, or try a different image.');
                                return;
                              }
                            } else {
                              // For non-HEIC files, create preview normally
                              const reader = new FileReader();
                              previewDataUrl = await new Promise((resolve) => {
                                reader.onload = (e) => resolve(e.target.result);
                    reader.readAsDataURL(file);
                              });
                            }
                            
                            // Show preview immediately
                            setProfileImage(previewDataUrl);
                            
                            // Upload to Firebase Storage (always use .jpg for converted HEIC files)
                            const { ref, uploadBytesResumable, getDownloadURL } = await import('firebase/storage');
                            const { storage } = await import('../../firebase/config');
                            
                            const timestamp = Date.now();
                            // Use .jpg for HEIC conversions, otherwise use original extension
                            const fileExtension = isHeic ? '.jpg' : (file.name.includes('.') 
                              ? file.name.substring(file.name.lastIndexOf('.'))
                              : '.jpg');
                            const storagePath = `profile-images/${user.uid}/profile_${timestamp}${fileExtension}`;
                            const storageRef = ref(storage, storagePath);
                            
                            // Convert blob to File if needed and ensure correct MIME type
                            // Firebase Storage uses the File's type property for content type validation
                            if (fileToUpload instanceof Blob && !(fileToUpload instanceof File)) {
                              fileToUpload = new File([fileToUpload], `profile_${timestamp}.jpg`, { 
                                type: 'image/jpeg',
                                lastModified: Date.now()
                              });
                            } else if (fileToUpload instanceof File) {
                              // Ensure the File has the correct MIME type for JPEG
                              if (isHeic && fileToUpload.type !== 'image/jpeg') {
                                fileToUpload = new File([fileToUpload], `profile_${timestamp}.jpg`, { 
                                  type: 'image/jpeg',
                                  lastModified: fileToUpload.lastModified
                                });
                              }
                            }
                            
                            // Ensure file type is set correctly (critical for storage rules validation)
                            if (!fileToUpload.type || fileToUpload.type === '') {
                              fileToUpload = new File([fileToUpload], fileToUpload.name, { 
                                type: 'image/jpeg',
                                lastModified: fileToUpload.lastModified || Date.now()
                              });
                            }
                            
                            // Upload with explicit metadata to ensure content type is set correctly
                            const uploadTask = uploadBytesResumable(storageRef, fileToUpload, {
                              contentType: 'image/jpeg'
                            });
                            
                            // Wait for upload to complete
                            const snapshot = await new Promise((resolve, reject) => {
                              uploadTask.on('state_changed',
                                (snapshot) => {
                                  // Progress tracking (optional)
                                },
                                (error) => {
                                  reject(error);
                                },
                                () => {
                                  resolve(uploadTask.snapshot);
                                }
                              );
                            });
                            const downloadURL = await getDownloadURL(snapshot.ref);
                            
                            // Save URL to patient profile
                            const { patientService } = await import('../../firebase/services');
                            await patientService.updatePatient(user.uid, { profileImage: downloadURL });
                            
                            // Update local state with the URL (not the data URL)
                            setProfileImage(downloadURL);
                            
                            // Refresh patient profile
                            await refreshPatient();
                            
                            showSuccess('Profile image updated successfully');
                          } catch (error) {
                            console.error('Error uploading profile image:', error);
                            showError('Failed to upload profile image. Please try again.');
                          }
                  }
                };
                input.click();
              }}
                    className={combineClasses('w-full px-4 py-2 text-left', DesignTokens.typography.body.sm, DesignTokens.colors.app.text[900], 'hover:' + DesignTokens.colors.app[100], DesignTokens.transitions.all, 'flex items-center gap-2')}
            >
                    <Camera className="w-4 h-4" />
                    <span>Change photo</span>
            </button>
                  
                  {patientProfile?.profileImage && (
                    <button
                      onClick={async () => {
                        setShowProfileMenu(false);
                        if (!user) return;
                        
                        try {
                          // Delete from Firebase Storage if it's an uploaded image
                          const profileImageUrl = patientProfile.profileImage;
                          if (profileImageUrl && profileImageUrl.includes('profile-images/')) {
                            // Extract storage path from URL
                            // URL format: https://firebasestorage.googleapis.com/v0/b/.../o/profile-images%2FuserId%2Ffilename?alt=media&token=...
                            try {
                              const { ref, deleteObject } = await import('firebase/storage');
                              const { storage } = await import('../../firebase/config');
                              
                              // Extract the path from the URL
                              const urlParts = profileImageUrl.split('/o/');
                              if (urlParts.length > 1) {
                                const pathWithParams = urlParts[1].split('?')[0];
                                const storagePath = decodeURIComponent(pathWithParams);
                                const storageRef = ref(storage, storagePath);
                                await deleteObject(storageRef);
                              }
                            } catch (storageError) {
                              // If storage deletion fails, continue anyway (might already be deleted)
                              console.warn('Could not delete from storage:', storageError);
                            }
                          }
                          
                          // Clear profileImage from patient profile
                          const { patientService } = await import('../../firebase/services');
                          await patientService.updatePatient(user.uid, { profileImage: null });
                          
                          // Update local state
                          setProfileImage(null);
                          
                          // Refresh patient profile
                          await refreshPatient();
                          
                          showSuccess('Profile image removed successfully');
                        } catch (error) {
                          console.error('Error removing profile image:', error);
                          showError('Failed to remove profile image. Please try again.');
                        }
                      }}
                      className={combineClasses('w-full px-4 py-2 text-left', DesignTokens.typography.body.sm, 'text-red-600 hover:bg-red-50', DesignTokens.transitions.all, 'flex items-center gap-2')}
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Remove photo</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Profile Information */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 sm:gap-4 mb-0 sm:mb-3">
              <div className="flex-1 min-w-0">
                <h2 className={combineClasses(DesignTokens.typography.h1.full, DesignTokens.typography.h1.weight, DesignTokens.typography.h1.color, 'mb-0 sm:mb-0.5')}>
                  {patientProfile.firstName || patientProfile.lastName 
                    ? `${patientProfile.firstName || ''} ${patientProfile.lastName || ''}`.trim()
                    : patientProfile.name || user?.displayName || 'Patient'}
                </h2>
                {patientProfile?.isPatient === false && patientProfile?.caregiverName && (
                  <p className={combineClasses('text-xs sm:text-sm mb-0 sm:mb-1 flex items-center gap-1', DesignTokens.colors.neutral.text[600])}>
                    <HeartHandshake className={combineClasses('w-3 h-3 sm:w-4 sm:h-4')} />
                    {getFirstAndLastName(patientProfile.caregiverName)}
                  </p>
                )}
                {patientProfile.gender && (
                  <span className={combineClasses('text-xs sm:text-sm', DesignTokens.colors.neutral.text[600])}>
                    {patientProfile.gender}
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowEditInfo(true)}
                className={combineClasses('p-2 -mr-2', DesignTokens.spacing.touchTarget, 'flex items-center justify-center', DesignTokens.colors.app.text[900], 'hover:' + DesignTokens.colors.app.text[900], 'active:' + DesignTokens.colors.app.text[900], DesignTokens.transitions.default)}
                aria-label="Edit patient information"
              >
                <Edit2 className={DesignTokens.icons.standard.size.full} />
              </button>
            </div>
          </div>
        </div>

        {/* Key Information Grid */}
        <div className={combineClasses('grid grid-cols-2', DesignTokens.spacing.gap.md, 'mt-4')}>
              {patientProfile.age && (
                <div className={combineClasses('flex items-center', DesignTokens.spacing.gap.sm, DesignTokens.typography.body.sm)}>
                  <div className={combineClasses(DesignTokens.spacing.iconContainer.mobile, DesignTokens.colors.primary[50], DesignTokens.borders.radius.sm, 'flex items-center justify-center flex-shrink-0')}>
                    <User className={combineClasses(DesignTokens.icons.standard.size.full, DesignTokens.colors.primary.text[600])} />
                  </div>
                  <div>
                    <p className={combineClasses('text-xs', DesignTokens.colors.neutral.text[500])}>Age</p>
                    <p className={combineClasses('font-semibold', DesignTokens.colors.neutral.text[900])}>{patientProfile.age} years</p>
                  </div>
                </div>
              )}
              {patientProfile.dateOfBirth && (
                <div className={combineClasses('flex items-center', DesignTokens.spacing.gap.sm, DesignTokens.typography.body.sm)}>
                  <div className={combineClasses(DesignTokens.spacing.iconContainer.mobile, DesignTokens.colors.accent[50], DesignTokens.borders.radius.sm, 'flex items-center justify-center flex-shrink-0')}>
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
                  <div className={combineClasses(DesignTokens.spacing.iconContainer.mobile, DesignTokens.moduleAccent.files.bg, DesignTokens.borders.radius.sm, 'flex items-center justify-center flex-shrink-0')}>
                    <MapPin className={combineClasses(DesignTokens.icons.standard.size.full, DesignTokens.moduleAccent.files.text)} />
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
                  <div className={combineClasses(DesignTokens.spacing.iconContainer.mobile, DesignTokens.moduleAccent.health.bg, DesignTokens.borders.radius.sm, 'flex items-center justify-center flex-shrink-0')}>
                    <Activity className={combineClasses(DesignTokens.icons.standard.size.full, DesignTokens.moduleAccent.health.text)} />
                  </div>
                  <div>
                    <p className={combineClasses('text-xs', DesignTokens.colors.neutral.text[500])}>Weight</p>
                    <p className={combineClasses('font-semibold', DesignTokens.colors.neutral.text[900])}>{patientProfile.weight} kg</p>
                  </div>
                </div>
              )}
            </div>
      </div>

      {/* Current Status - Full Width */}
      <div className={DesignTokens.components.card.containerLarge}>
        <div className={combineClasses('flex items-center justify-between', DesignTokens.spacing.header.mobile)}>
          <div className={combineClasses('flex items-center', DesignTokens.spacing.gap.md)}>
            <div className={combineClasses(DesignTokens.components.header.iconContainer)}>
              <Activity className={combineClasses(DesignTokens.icons.header.size.full, DesignTokens.components.header.icon)} />
            </div>
            <h2 className={combineClasses(DesignTokens.typography.h3.full, DesignTokens.typography.h3.weight, DesignTokens.colors.neutral.text[800])}>Current Status</h2>
          </div>
          <button
            onClick={() => setShowUpdateStatus(true)}
            className={combineClasses('p-2 -mr-2', DesignTokens.colors.app.text[900], 'hover:' + DesignTokens.colors.app.text[900], 'active:' + DesignTokens.colors.app.text[900], DesignTokens.spacing.touchTarget, 'flex items-center justify-center', DesignTokens.transitions.default)}
            aria-label="Update current status"
          >
            <Edit2 className={DesignTokens.icons.standard.size.full} />
          </button>
        </div>
        <div className={combineClasses('flex flex-wrap sm:grid sm:grid-cols-2 lg:grid-cols-3', DesignTokens.spacing.gap.lg)}>
          <div className="flex flex-col flex-1 min-w-[140px] sm:min-w-0">
            <span className={combineClasses('mb-1 text-sm', DesignTokens.colors.neutral.text[600])}>Diagnosis</span>
            <span className={combineClasses('font-medium', DesignTokens.colors.neutral.text[900])}>{currentStatus?.diagnosis || patientProfile?.diagnosis || 'No diagnosis yet'}</span>
          </div>
          {(currentStatus?.subtype || patientProfile?.cancerType) && (
            <div className="flex flex-col flex-1 min-w-[140px] sm:min-w-0">
              <span className={combineClasses('mb-1 text-sm', DesignTokens.colors.neutral.text[600])}>Cancer Subtype</span>
              <span className={combineClasses('font-medium', DesignTokens.colors.neutral.text[900])}>{currentStatus?.subtype || patientProfile?.cancerType || '—'}</span>
            </div>
          )}
          {(currentStatus?.stage || patientProfile?.stage) && (
            <div className="flex flex-col flex-1 min-w-[140px] sm:min-w-0">
              <span className={combineClasses('mb-1 text-sm', DesignTokens.colors.neutral.text[600])}>Stage</span>
              <span className={combineClasses('font-medium', DesignTokens.colors.neutral.text[900])}>{currentStatus?.stage || patientProfile?.stage || '—'}</span>
            </div>
          )}
          <div className="flex flex-col flex-1 min-w-[140px] sm:min-w-0">
            <span className={combineClasses('mb-1 text-sm', DesignTokens.colors.neutral.text[600])}>Treatment Status</span>
            <span className={combineClasses('font-medium', DesignTokens.colors.neutral.text[900])}>{currentStatus?.treatmentLine || currentStatus?.currentRegimen || '—'}</span>
          </div>
          <div className="flex flex-col flex-1 min-w-[140px] sm:min-w-0">
            <span className={combineClasses('mb-1 text-sm', DesignTokens.colors.neutral.text[600])}>ECOG Performance</span>
            <span className={combineClasses('font-medium', DesignTokens.colors.neutral.text[900])}>{currentStatus?.performanceStatus || '—'}</span>
          </div>
          <div className="flex flex-col flex-1 min-w-[140px] sm:min-w-0">
            <span className={combineClasses('mb-1 text-sm', DesignTokens.colors.neutral.text[600])}>Disease Status</span>
            <span className={combineClasses('font-medium', DesignTokens.colors.neutral.text[900])}>{currentStatus?.diseaseStatus || '—'}</span>
          </div>
          {currentStatus?.baselineCa125 != null && currentStatus?.baselineCa125 !== '' && (
            <div className="flex flex-col flex-1 min-w-[140px] sm:min-w-0">
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
                <span className={combineClasses('px-3 py-1', DesignTokens.borders.radius.full, DesignTokens.typography.body.xs, 'font-medium', DesignTokens.colors.app[100], DesignTokens.colors.app.text[900])}>
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
                  <div className={combineClasses('p-2 border rounded', DesignTokens.colors.app[50], DesignTokens.colors.app.border[200])}>
                    <p className={combineClasses('text-xs mb-1', DesignTokens.colors.neutral.text[600])}>TMB</p>
                    <p className={combineClasses('text-lg font-bold', DesignTokens.colors.app.text[900])}>{genomicProfile.tmb}</p>
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
        <div className={combineClasses(DesignTokens.components.card.container, 'flex-1')}>
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
                className={combineClasses('p-2 -mr-2', DesignTokens.colors.app.text[900], 'hover:' + DesignTokens.colors.app.text[900], 'active:' + DesignTokens.colors.app.text[900], 'touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center', DesignTokens.transitions.default)}
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
                  className={combineClasses(DesignTokens.components.button.primary, DesignTokens.spacing.button.full, 'py-3', DesignTokens.spacing.gap.sm)}
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
              <div className={combineClasses(DesignTokens.components.card.nestedSubtleLarge, 'mb-4')}>
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
                      patientProfile?.isPatient !== false ? DesignTokens.colors.app[700] : DesignTokens.colors.app[300]
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

              {/* Response Complexity Slider */}
              <div className={DesignTokens.components.card.nestedSubtleLarge}>
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-medical-neutral-900">
                      Response Complexity
                    </p>
                    <span className="text-xs text-medical-neutral-500">
                      {patientProfile?.responseComplexity === 'simple' ? 'Simple' : 
                       patientProfile?.responseComplexity === 'detailed' ? 'Detailed' : 
                       'Standard'}
                    </span>
                  </div>
                  <p className="text-xs text-medical-neutral-500 mb-3">
                    Adjust response detail and insight depth: Simple = brief answers and basic insights, Advanced = comprehensive explanations and expert analysis
                  </p>
                  <input
                    type="range"
                    min="0"
                    max="4"
                    step="1"
                    value={patientProfile?.responseComplexity === 'simple' ? 0 : 
                           patientProfile?.responseComplexity === 'basic' ? 1 :
                           patientProfile?.responseComplexity === 'standard' ? 2 :
                           patientProfile?.responseComplexity === 'detailed' ? 3 :
                           patientProfile?.responseComplexity === 'advanced' ? 4 : 2}
                    onChange={async (e) => {
                      const values = ['simple', 'basic', 'standard', 'detailed', 'advanced'];
                      const newComplexity = values[parseInt(e.target.value)];
                      const previousComplexity = patientProfile?.responseComplexity || 'standard';
                      
                      // Update local state first
                      setPatientProfile(prev => {
                        if (!prev) return prev;
                        return { ...prev, responseComplexity: newComplexity };
                      });
                      
                      try {
                        const { patientService } = await import('../../firebase/services');
                        const updatedProfile = patientProfile ? {
                          ...patientProfile,
                          responseComplexity: newComplexity
                        } : {
                          responseComplexity: newComplexity
                        };
                        
                        await patientService.savePatient(user.uid, updatedProfile);
                        await refreshPatient();
                      } catch (error) {
                        // Revert on error
                        setPatientProfile(prev => {
                          if (!prev) return prev;
                          return { ...prev, responseComplexity: previousComplexity };
                        });
                        showError('Failed to update complexity setting');
                      }
                    }}
                    className="w-full h-2 bg-medical-neutral-200 rounded-lg appearance-none cursor-pointer slider"
                    style={{
                      background: `linear-gradient(to right, ${DesignTokens.colors.app[500]} 0%, ${DesignTokens.colors.app[500]} ${((patientProfile?.responseComplexity === 'simple' ? 0 : 
                                                                                                                                    patientProfile?.responseComplexity === 'basic' ? 1 :
                                                                                                                                    patientProfile?.responseComplexity === 'standard' ? 2 :
                                                                                                                                    patientProfile?.responseComplexity === 'detailed' ? 3 :
                                                                                                                                    patientProfile?.responseComplexity === 'advanced' ? 4 : 2) / 4) * 100}%, ${DesignTokens.colors.app[200]} ${((patientProfile?.responseComplexity === 'simple' ? 0 : 
                                                                                                                                    patientProfile?.responseComplexity === 'basic' ? 1 :
                                                                                                                                    patientProfile?.responseComplexity === 'standard' ? 2 :
                                                                                                                                    patientProfile?.responseComplexity === 'detailed' ? 3 :
                                                                                                                                    patientProfile?.responseComplexity === 'advanced' ? 4 : 2) / 4) * 100}%, ${DesignTokens.colors.app[200]} 100%)`
                    }}
                  />
                  <div className="flex justify-between mt-1">
                    <span className="text-xs text-medical-neutral-500">Simple</span>
                    <span className="text-xs text-medical-neutral-500">Basic</span>
                    <span className="text-xs text-medical-neutral-500">Standard</span>
                    <span className="text-xs text-medical-neutral-500">Detailed</span>
                    <span className="text-xs text-medical-neutral-500">Advanced</span>
                  </div>
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
                  <button
                    onClick={handleTogglePasswordForm}
                    className="flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] bg-white border border-medical-neutral-300 text-medical-neutral-700 rounded-lg text-sm font-medium hover:bg-medical-neutral-50 active:bg-medical-neutral-100 transition touch-manipulation"
                  >
                    <Shield className="w-4 h-4" />
                    {showPasswordForm ? 'Cancel password change' : 'Change password'}
                  </button>
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

                {showPasswordForm && (
                  <div className="mt-3 p-4 border border-medical-neutral-200 rounded-lg bg-white space-y-3">
                    <p className="text-xs text-medical-neutral-600">
                      {user.providerData?.some(p => p.providerId === 'google.com')
                        ? 'We will verify your Google sign-in before setting a password.'
                        : 'Enter your current password to update it.'}
                    </p>
                    {user.providerData?.some(p => p.providerId === 'password') && (
                      <div>
                        <label className="block text-xs font-medium text-medical-neutral-700 mb-1">Current password</label>
                        <input
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className={combineClasses(DesignTokens.components.input.base, 'w-full')}
                          placeholder="••••••••"
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-medium text-medical-neutral-700 mb-1">New password</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className={combineClasses(DesignTokens.components.input.base, 'w-full')}
                        placeholder="At least 8 characters"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-medical-neutral-700 mb-1">Confirm new password</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={combineClasses(DesignTokens.components.input.base, 'w-full')}
                        placeholder="Repeat new password"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={handleChangePassword}
                        disabled={isUpdatingPassword}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 min-h-[40px] bg-medical-primary-600 text-white rounded-lg text-sm font-medium hover:bg-medical-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isUpdatingPassword ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Updating...
                          </>
                        ) : (
                          'Update password'
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Share with your doctor */}
            <div className="pt-4 border-t border-medical-neutral-200">
              <h3 className="text-sm font-semibold text-medical-neutral-900 mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4 text-medical-primary-600" />
                Share with your doctor
              </h3>
              <p className="text-xs text-medical-neutral-600 mb-3">
                Create a PDF summary of your health data to bring to appointments or send to your care team.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setShowShareForDoctorModal(true)}
                  className={combineClasses('flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] bg-white border rounded-lg text-sm font-medium transition touch-manipulation', DesignTokens.colors.app.border[200], DesignTokens.colors.app.text[800], 'hover:bg-medical-neutral-50', 'active:bg-medical-neutral-100')}
                >
                  <FileText className="w-4 h-4" />
                  Create summary
                </button>
              </div>
            </div>

            {/* Backup Section */}
            <div className="pt-4 border-t border-medical-neutral-200">
              <h3 className="text-sm font-semibold text-medical-neutral-900 mb-2 flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-medical-primary-600" />
                Backup Your Data
              </h3>
              <p className="text-xs text-medical-neutral-600 mb-3">
                Save a copy of your health data (labs, vitals, medications, symptoms, journal notes, documents metadata) to keep it safe.
              </p>
              <label className="flex items-center gap-2 mb-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeDocuments}
                  onChange={(e) => setIncludeDocuments(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-medical-neutral-700">Include document files (PDFs, images, scans) — creates a ZIP file</span>
              </label>
              {includeDocuments && (
                <p className="text-xs text-medical-neutral-500 mb-3 -mt-1">
                  Local dev: run <code className="bg-medical-neutral-100 px-1 rounded">npm run start:all</code> so documents can be downloaded.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={async () => {
                    if (!user) return;
                    setIsBackingUp(true);
                    try {
                      const result = await downloadBackup(user.uid, { includeDocuments });
                      if (includeDocuments && result.documentsSkipped > 0) {
                        showSuccess(`Backup downloaded. ${result.documentsIncluded} documents included. ${result.documentsSkipped} could not be included — run \`npm run start:all\` for local dev.`);
                      } else if (includeDocuments) {
                        showSuccess(`Backup downloaded. ${result.documentsIncluded} documents included. Save it somewhere safe.`);
                      } else {
                        showSuccess('Backup downloaded. Save the file somewhere safe.');
                      }
                    } catch (err) {
                      showError(err.message || 'Failed to download backup.');
                    } finally {
                      setIsBackingUp(false);
                    }
                  }}
                  disabled={isBackingUp}
                  className={combineClasses('flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] bg-white border rounded-lg text-sm font-medium transition touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed', DesignTokens.colors.app.border[200], DesignTokens.colors.app.text[800], 'hover:bg-medical-neutral-50', 'active:bg-medical-neutral-100')}
                >
                  {isBackingUp ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  Download backup
                </button>
                {isGoogleDriveConfigured() && (
                  <button
                    onClick={async () => {
                      if (!user) return;
                      setIsBackingUp(true);
                      try {
                        let backupOrZip;
                        let zipResult = null;
                        if (includeDocuments) {
                          zipResult = await createBackupZip(user.uid);
                          backupOrZip = zipResult.zip;
                        } else {
                          backupOrZip = await exportUserBackup(user.uid);
                        }
                        const result = await uploadBackupToDrive(backupOrZip);
                        if (zipResult && zipResult.documentsSkipped > 0) {
                          showSuccess(`Backup saved to Google Drive. ${zipResult.documentsIncluded} documents included. ${zipResult.documentsSkipped} could not be included — run \`npm run start:all\` for local dev.`);
                        } else if (zipResult) {
                          showSuccess(`Backup saved to Google Drive. ${zipResult.documentsIncluded} documents included.`);
                        } else {
                          showSuccess('Backup saved to Google Drive.');
                        }
                        if (result.webViewLink) {
                          window.open(result.webViewLink, '_blank');
                        }
                      } catch (err) {
                        showError(err.message || 'Failed to backup to Google Drive.');
                      } finally {
                        setIsBackingUp(false);
                      }
                    }}
                    disabled={isBackingUp}
                    className={combineClasses('flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] bg-white border rounded-lg text-sm font-medium transition touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed', DesignTokens.colors.app.border[200], DesignTokens.colors.app.text[800], 'hover:bg-blue-50 hover:border-blue-200', 'active:bg-blue-100')}
                  >
                    {isBackingUp ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Cloud className="w-4 h-4" />
                    )}
                    Backup to Google Drive
                  </button>
                )}
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

      <ShareForDoctorModal
        show={showShareForDoctorModal}
        onClose={() => setShowShareForDoctorModal(false)}
        user={user}
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



ProfileTab.propTypes = {
  onTabChange: PropTypes.func.isRequired
};
