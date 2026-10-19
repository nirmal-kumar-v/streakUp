import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  updateProfileSettings,
  uploadProfileImage,
  removeProfileImage,
  changePassword,
  changeUsername,
  fetchUsernameStatus,
  fetchTimezones,
  fetchEmailChangeStatus,
  requestChangeEmailOtp,
  verifyChangeEmailOtp,
  deleteAccount,
  TimezoneOption,
} from '../api/user';
import { InitialsAvatar } from '../components/InitialsAvatar';
import { CustomSelect } from '../components/CustomSelect';
import { DateTime } from 'luxon';
import {
  Settings,
  Globe,
  CheckCircle2,
  AlertCircle,
  Save,
  Clock,
  Upload,
  Trash2,
  KeyRound,
  AtSign,
  ShieldAlert,
  Bell,
  ArrowRight,
  Mail,
  RotateCw,
  Lock,
  X,
  FileText,
  Shield,
  ChevronRight,
  HelpCircle,
  Crop,
  MessageSquare,
  Send,
} from 'lucide-react';
import { extractErrorMessage } from '../utils/error';
import { useAppLock } from '../context/AppLockContext';
import { submitUserRequest, UserRequestCategory } from '../api/userRequests';
import { DEFAULT_SECURITY_QUESTIONS } from '../utils/pinSecurity';
import { ImageCropModal } from '../components/ImageCropModal';
import { useBodyScrollLock } from '../utils/scrollLock';

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, updateUser, logout } = useAuth();

  // App Lock Context & State
  const {
    isAppLockEnabled,
    securityQuestion,
    setupPin,
    changePin,
    disableAppLock,
  } = useAppLock();

  const [appLockModal, setAppLockModal] = useState<'none' | 'setup' | 'change' | 'disable'>('none');
  useBodyScrollLock(appLockModal !== 'none');
  const [appLockPin, setAppLockPin] = useState('');
  const [appLockConfirmPin, setAppLockConfirmPin] = useState('');
  const [appLockCurrentPin, setAppLockCurrentPin] = useState('');
  const [appLockSecQuestion, setAppLockSecQuestion] = useState<string>(DEFAULT_SECURITY_QUESTIONS[0]);
  const [appLockSecAnswer, setAppLockSecAnswer] = useState<string>('');
  const [appLockModalError, setAppLockModalError] = useState('');
  const [appLockModalLoading, setAppLockModalLoading] = useState(false);
  const [appLockSuccessMsg, setAppLockSuccessMsg] = useState('');

  // Requests & Feedback State
  const [feedbackCategory, setFeedbackCategory] = useState<UserRequestCategory>('FEATURE_REQUEST');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState('');
  const [feedbackError, setFeedbackError] = useState('');

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackMessage.trim() || feedbackMessage.trim().length < 5) {
      setFeedbackError('Please enter a message with at least 5 characters.');
      return;
    }
    setIsSubmittingFeedback(true);
    setFeedbackSuccess('');
    setFeedbackError('');
    try {
      const res = await submitUserRequest({
        category: feedbackCategory,
        message: feedbackMessage.trim(),
      });
      if (res.success) {
        setFeedbackMessage('');
        setFeedbackSuccess('Your request has been submitted. Thank you for your feedback.');
        setTimeout(() => setFeedbackSuccess(''), 5000);
      }
    } catch (err: any) {
      // Preserve the user's message on failure as explicitly required!
      setFeedbackError(extractErrorMessage(err, 'Failed to submit request. Please try again.'));
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const handleOpenSetupModal = () => {
    setAppLockPin('');
    setAppLockConfirmPin('');
    setAppLockSecQuestion(DEFAULT_SECURITY_QUESTIONS[0]);
    setAppLockSecAnswer('');
    setAppLockModalError('');
    setAppLockModal('setup');
  };

  const handleOpenChangePinModal = () => {
    setAppLockCurrentPin('');
    setAppLockPin('');
    setAppLockConfirmPin('');
    setAppLockSecQuestion(securityQuestion || DEFAULT_SECURITY_QUESTIONS[0]);
    setAppLockSecAnswer('');
    setAppLockModalError('');
    setAppLockModal('change');
  };

  const handleOpenDisableModal = () => {
    setAppLockCurrentPin('');
    setAppLockModalError('');
    setAppLockModal('disable');
  };

  const handleSetupPinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (appLockPin.length !== 4 || !/^\d{4}$/.test(appLockPin)) {
      setAppLockModalError('PIN must be exactly 4 numeric digits.');
      return;
    }
    if (appLockPin !== appLockConfirmPin) {
      setAppLockModalError('PINs do not match. Please verify.');
      return;
    }

    if (!appLockSecAnswer.trim()) {
      setAppLockModalError('Please enter an answer to your recovery security question.');
      return;
    }

    setAppLockModalLoading(true);
    setAppLockModalError('');
    try {
      const success = await setupPin(appLockPin, appLockSecQuestion, appLockSecAnswer.trim());
      if (success) {
        setAppLockModal('none');
        setAppLockSuccessMsg('App Lock enabled successfully!');
        setTimeout(() => setAppLockSuccessMsg(''), 4000);
      } else {
        setAppLockModalError('Failed to setup PIN. Please try again.');
      }
    } catch {
      setAppLockModalError('An unexpected error occurred.');
    } finally {
      setAppLockModalLoading(false);
    }
  };

  const handleChangePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (appLockCurrentPin.length < 4) {
      setAppLockModalError('Please enter your current PIN.');
      return;
    }
    if (appLockPin.length !== 4 || !/^\d{4}$/.test(appLockPin)) {
      setAppLockModalError('New PIN must be exactly 4 numeric digits.');
      return;
    }
    if (appLockPin !== appLockConfirmPin) {
      setAppLockModalError('New PINs do not match.');
      return;
    }

    setAppLockModalLoading(true);
    setAppLockModalError('');
    try {
      const res = await changePin(
        appLockCurrentPin,
        appLockPin,
        appLockSecQuestion,
        appLockSecAnswer.trim() || undefined
      );
      if (res.success) {
        setAppLockModal('none');
        setAppLockSuccessMsg('PIN updated successfully!');
        setTimeout(() => setAppLockSuccessMsg(''), 4000);
      } else {
        setAppLockModalError(res.error || 'Failed to update PIN.');
      }
    } catch {
      setAppLockModalError('An unexpected error occurred.');
    } finally {
      setAppLockModalLoading(false);
    }
  };

  const handleDisableSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (appLockCurrentPin.length < 4) {
      setAppLockModalError('Please enter your current PIN to confirm.');
      return;
    }

    setAppLockModalLoading(true);
    setAppLockModalError('');
    try {
      const res = await disableAppLock(appLockCurrentPin);
      if (res.success) {
        setAppLockModal('none');
        setAppLockSuccessMsg('App Lock has been disabled.');
        setTimeout(() => setAppLockSuccessMsg(''), 4000);
      } else {
        setAppLockModalError(res.error || 'Incorrect PIN.');
      }
    } catch {
      setAppLockModalError('An unexpected error occurred.');
    } finally {
      setAppLockModalLoading(false);
    }
  };

  // Delete Account State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Basic Profile & Timezone
  const [name, setName] = useState(user?.name || '');
  const [timezone, setTimezone] = useState(user?.timezone || 'Asia/Kolkata');
  const [timezones, setTimezones] = useState<TimezoneOption[]>([]);
  const [isSubmittingProfile, setIsSubmittingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');

  // Image Upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [rawImageForCrop, setRawImageForCrop] = useState<string | null>(null);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [confirmRemoveImage, setConfirmRemoveImage] = useState(false);
  const [imageSuccess, setImageSuccess] = useState('');
  const [imageError, setImageError] = useState('');

  // Change Username state
  const [newUsername, setNewUsername] = useState('');
  const [isChangingUsername, setIsChangingUsername] = useState(false);
  const [usernameSuccess, setUsernameSuccess] = useState('');
  const [usernameError, setUsernameError] = useState('');

  // Change Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Username Change (14-day restriction)
  const [usernameStatus, setUsernameStatus] = useState<{
    currentUsername: string;
    lastUsernameChangeAt: string | null;
    canChangeNow: boolean;
    nextAllowedChangeDate: string | null;
    daysRemaining: number;
  } | null>(null);

  const loadUsernameStatus = () => {
    fetchUsernameStatus()
      .then((res) => {
        if (res.success) setUsernameStatus(res);
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadUsernameStatus();
  }, []);

  // Registered Email Change (14-day restriction & OTP)
  const [emailStatus, setEmailStatus] = useState<{
    currentEmail: string;
    emailLastChangedAt: string | null;
    canChangeNow: boolean;
    nextAllowedChangeDate: string | null;
    daysRemaining: number;
  } | null>(null);
  const [emailChangeStep, setEmailChangeStep] = useState<'idle' | 'request' | 'verify'>('idle');
  const [newEmailInput, setNewEmailInput] = useState('');
  const [emailOtpInput, setEmailOtpInput] = useState('');
  const [isEmailChanging, setIsEmailChanging] = useState(false);
  const [emailChangeSuccess, setEmailChangeSuccess] = useState('');
  const [emailChangeError, setEmailChangeError] = useState('');
  const [emailOtpCooldown, setEmailOtpCooldown] = useState(0);

  const loadEmailStatus = () => {
    fetchEmailChangeStatus()
      .then((res) => {
        if (res.success) setEmailStatus(res);
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadEmailStatus();
  }, []);

  useEffect(() => {
    if (emailOtpCooldown <= 0) return;
    const timer = setInterval(() => {
      setEmailOtpCooldown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [emailOtpCooldown]);

  const handleRequestEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmailInput.trim()) return;
    setIsEmailChanging(true);
    setEmailChangeSuccess('');
    setEmailChangeError('');

    try {
      const res = await requestChangeEmailOtp(newEmailInput.trim());
      if (res.success) {
        setEmailChangeStep('verify');
        setEmailOtpCooldown(60);
        setEmailChangeSuccess(res.message);
      } else {
        setEmailChangeError(res.error || 'Failed to request email change.');
      }
    } catch (err: any) {
      setEmailChangeError(extractErrorMessage(err, 'Failed to request email change.'));
    } finally {
      setIsEmailChanging(false);
    }
  };

  const handleVerifyEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (emailOtpInput.trim().length !== 6) {
      setEmailChangeError('Please enter the 6-digit verification code.');
      return;
    }
    setIsEmailChanging(true);
    setEmailChangeSuccess('');
    setEmailChangeError('');

    try {
      const res = await verifyChangeEmailOtp(newEmailInput.trim(), emailOtpInput.trim());
      if (res.success && res.user) {
        updateUser(
          {
            email: res.user.email,
            emailLastChangedAt: res.user.emailLastChangedAt,
          },
          res.token
        );
        setEmailChangeSuccess('Registered login email updated successfully!');
        setEmailChangeStep('idle');
        setNewEmailInput('');
        setEmailOtpInput('');
        loadEmailStatus();
      } else {
        setEmailChangeError(res.error || 'Verification failed. Please check the code.');
      }
    } catch (err: any) {
      setEmailChangeError(extractErrorMessage(err, 'Failed to verify email change code.'));
    } finally {
      setIsEmailChanging(false);
    }
  };

  const handleResendEmailOtp = async () => {
    if (emailOtpCooldown > 0 || isEmailChanging) return;
    setIsEmailChanging(true);
    setEmailChangeError('');
    try {
      const res = await requestChangeEmailOtp(newEmailInput.trim());
      if (res.success) {
        setEmailOtpCooldown(60);
        setEmailChangeSuccess(`A new verification code has been sent to ${newEmailInput.trim()}`);
      } else {
        setEmailChangeError(res.error || 'Failed to resend code.');
      }
    } catch (err: any) {
      setEmailChangeError(extractErrorMessage(err, 'Failed to resend code.'));
    } finally {
      setIsEmailChanging(false);
    }
  };

  // Live preview time in the selected timezone
  const [previewTime, setPreviewTime] = useState('');

  useEffect(() => {
    fetchTimezones()
      .then((res) => {
        if (res.success) setTimezones(res.timezones);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setTimezone(user.timezone || 'Asia/Kolkata');
    }
  }, [user]);

  // Update live preview time when timezone changes
  useEffect(() => {
    const updatePreview = () => {
      try {
        const dt = DateTime.now().setZone(timezone);
        if (dt.isValid) {
          setPreviewTime(`${dt.toFormat('hh:mm:ss a')} (${dt.toFormat('ccc, MMM d')})`);
        }
      } catch {
        setPreviewTime('');
      }
    };
    updatePreview();
    const interval = setInterval(updatePreview, 1000);
    return () => clearInterval(interval);
  }, [timezone]);

  // Profile info & Timezone submit
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingProfile(true);
    setProfileSuccess('');
    setProfileError('');

    try {
      const res = await updateProfileSettings({
        name: name.trim(),
        timezone,
      });

      if (res.success && res.user) {
        updateUser({
          name: res.user.name,
          timezone: res.user.timezone,
        });
        setProfileSuccess('Profile settings updated successfully!');
      }
    } catch (err: any) {
      setProfileError(extractErrorMessage(err, 'Failed to update profile.'));
    } finally {
      setIsSubmittingProfile(false);
    }
  };

  // Image Selection Handler (Device file picker)
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImageError('');
    setImageSuccess('');
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate MIME type: JPEG, PNG, WebP
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setImageError('Unsupported file type. Please choose a JPEG, PNG, or WebP image.');
      return;
    }

    // Validate size: max dynamic MB (default 5 MB, or custom user quota from admin)
    const allowedMb = (user as any)?.profileImageLimitMb || 5;
    const maxBytes = allowedMb * 1024 * 1024;
    if (file.size > maxBytes) {
      setImageError(
        `File is too large (${(file.size / (1024 * 1024)).toFixed(2)} MB). Maximum allowed size is ${allowedMb} MB.`
      );
      return;
    }

    // Read as Base64 Data URI and open the Crop modal
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setRawImageForCrop(dataUrl);
      setIsCropModalOpen(true);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.onerror = () => {
      setImageError('Failed to read image file.');
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = (croppedBase64: string) => {
    setImagePreview(croppedBase64);
    setIsCropModalOpen(false);
  };

  const handleSkipCrop = () => {
    if (rawImageForCrop) {
      setImagePreview(rawImageForCrop);
    }
    setIsCropModalOpen(false);
  };

  const handleUploadImage = async () => {
    if (!imagePreview) return;
    setIsUploadingImage(true);
    setImageError('');
    setImageSuccess('');

    try {
      const res = await uploadProfileImage(imagePreview);
      if (res.success) {
        updateUser({ profileImage: res.profileImage });
        setImageSuccess('Profile image updated successfully!');
        setImagePreview(null);
        setRawImageForCrop(null);
      }
    } catch (err: any) {
      setImageError(extractErrorMessage(err, 'Failed to upload profile image.'));
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleRemoveImage = async () => {
    setConfirmRemoveImage(false);
    setIsUploadingImage(true);
    setImageError('');
    setImageSuccess('');

    try {
      const res = await removeProfileImage();
      if (res.success) {
        updateUser({ profileImage: null });
        setImagePreview(null);
        setRawImageForCrop(null);
        setImageSuccess('Profile image removed.');
      }
    } catch (err: any) {
      setImageError(extractErrorMessage(err, 'Failed to remove image.'));
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Change Username Handler
  const handleChangeUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim()) return;
    if (usernameStatus && !usernameStatus.canChangeNow) {
      setUsernameError(`Username can only be changed once every 14 days. You can next change it on ${new Date(usernameStatus.nextAllowedChangeDate || '').toLocaleDateString()}.`);
      return;
    }
    setIsChangingUsername(true);
    setUsernameSuccess('');
    setUsernameError('');

    try {
      const res = await changeUsername(newUsername.trim());
      if (res.success) {
        updateUser(
          {
            username: res.user.username,
            lastUsernameChangeAt: res.user.lastUsernameChangeAt,
          },
          res.token
        );
        setUsernameSuccess(`Username successfully updated to @${res.user.username}!`);
        setNewUsername('');
        loadUsernameStatus();
      }
    } catch (err: any) {
      setUsernameError(extractErrorMessage(err, 'Failed to change username.'));
      loadUsernameStatus();
    } finally {
      setIsChangingUsername(false);
    }
  };

  // Change Password Handler
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSuccess('');
    setPasswordError('');

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await changePassword(currentPassword, newPassword);
      if (res.success) {
        setPasswordSuccess('Password changed successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      setPasswordError(extractErrorMessage(err, 'Failed to change password.'));
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-20">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-zinc-100 tracking-tight flex items-center gap-2.5">
          <Settings className="w-7 h-7 text-flame-500" />
          Account Settings
        </h1>
        <p className="text-xs sm:text-sm text-dark-muted mt-1">
          Manage your device avatar, security credentials, and timezone
        </p>
      </div>

      {/* Quick link to Notification Settings & Email Reminders */}
      <Link
        to="/settings/notifications"
        className="block bg-gradient-to-r from-flame-500/15 via-dark-card to-dark-card border border-flame-500/30 hover:border-flame-500/60 rounded-2xl p-4 transition-all group shadow-panel"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-flame-500/20 text-flame-400 border border-flame-500/30 flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-zinc-100 group-hover:text-flame-400 transition-colors flex items-center gap-2">
                Notification Preferences & Email Reminders
                <span className="text-[10px] bg-flame-500 text-zinc-950 font-black px-1.5 py-0.2 rounded-full">
                  NEW
                </span>
              </div>
              <div className="text-xs text-dark-muted mt-0.5">
                Configure daily reminder times, friend alerts, and destination email
              </div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-flame-400 group-hover:translate-x-1 transition-transform shrink-0" />
        </div>
      </Link>

      {/* SECTION 1: PROFILE IMAGE UPLOAD */}
      <div className="bg-dark-card border border-dark-border rounded-3xl p-6 sm:p-8 shadow-panel space-y-6">
        <div>
          <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
            <Upload className="w-4 h-4 text-flame-400" />
            Profile Picture
          </h2>
          <p className="text-xs text-dark-muted mt-0.5">
            Upload a picture from your device (JPEG, PNG, WebP up to {(user as any)?.profileImageLimitMb || 5} MB).
          </p>
        </div>

        {imageSuccess && (
          <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold rounded-xl">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{imageSuccess}</span>
          </div>
        )}

        {imageError && (
          <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold rounded-xl">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{imageError}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center gap-5">
          {/* Avatar / Preview Display */}
          <div className="relative">
            <InitialsAvatar
              name={user?.name || 'User'}
              image={imagePreview || user?.profileImage}
              size="2xl"
              className="border-2 border-flame-500/30 shadow-lg"
            />
            {imagePreview && (
              <span className="absolute -top-1 -right-1 bg-flame-500 text-zinc-950 text-[10px] font-black px-1.5 py-0.2 rounded-full shadow">
                Preview
              </span>
            )}
          </div>

          <div className="flex-1 space-y-3 w-full">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
            />

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-dark-surface hover:bg-dark-hover border border-dark-border text-zinc-200 hover:text-zinc-100 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2"
              >
                <Upload className="w-3.5 h-3.5 text-flame-400" />
                <span>Choose from Device</span>
              </button>

              {imagePreview && (
                <>
                  <button
                    type="button"
                    onClick={handleUploadImage}
                    disabled={isUploadingImage}
                    className="px-4 py-2 bg-flame-500 hover:bg-flame-600 text-zinc-950 rounded-xl text-xs font-bold transition-all shadow-md shadow-flame-500/20 flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isUploadingImage ? (
                      <div className="w-3.5 h-3.5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>Save Picture</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsCropModalOpen(true)}
                    disabled={isUploadingImage}
                    className="px-3.5 py-2 bg-dark-surface hover:bg-dark-hover border border-dark-border text-zinc-200 hover:text-zinc-100 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                  >
                    <Crop className="w-3.5 h-3.5 text-flame-400" />
                    <span>Adjust Crop</span>
                  </button>
                </>
              )}

              {user?.profileImage && !imagePreview && (
                confirmRemoveImage ? (
                  <div className="flex items-center gap-1.5 p-1 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs">
                    <span className="text-rose-300 text-[11px] px-1 font-medium">Remove image?</span>
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      disabled={isUploadingImage}
                      className="px-2 py-0.5 bg-rose-500 hover:bg-rose-400 text-white font-bold rounded-lg text-xs"
                    >
                      {isUploadingImage ? '...' : 'Yes'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmRemoveImage(false)}
                      className="px-1.5 py-0.5 text-zinc-400 hover:text-zinc-200 text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmRemoveImage(true)}
                    disabled={isUploadingImage}
                    className="px-3 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove Picture</span>
                  </button>
                )
              )}

              {imagePreview && (
                <button
                  type="button"
                  onClick={() => {
                    setImagePreview(null);
                    setRawImageForCrop(null);
                  }}
                  className="px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </button>
              )}
            </div>

            <p className="text-[11px] text-zinc-500">
              When no picture is set, your stylish initials avatar will automatically be shown throughout the app.
            </p>
          </div>
        </div>

        {/* Image Crop Modal */}
        <ImageCropModal
          isOpen={isCropModalOpen}
          imageSrc={rawImageForCrop || imagePreview || ''}
          onCropComplete={handleCropComplete}
          onSkipCrop={handleSkipCrop}
          onClose={() => setIsCropModalOpen(false)}
        />
      </div>

      {/* SECTION 2: DISPLAY NAME & TIMEZONE */}
      <form
        onSubmit={handleProfileSubmit}
        className="bg-dark-card border border-dark-border rounded-3xl p-6 sm:p-8 shadow-panel space-y-6"
      >
        <div>
          <h2 className="text-base font-bold text-zinc-100">Display Profile</h2>
          <p className="text-xs text-dark-muted mt-0.5">Update your visible name and local timezone.</p>
        </div>

        {profileSuccess && (
          <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold rounded-xl">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{profileSuccess}</span>
          </div>
        )}

        {profileError && (
          <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold rounded-xl">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{profileError}</span>
          </div>
        )}

        {/* Display Name */}
        <div>
          <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2">
            Display Name
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-sm text-zinc-100 focus:outline-none focus:border-flame-500/80 font-medium"
          />
        </div>

        {/* Timezone Configuration */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-flame-500" />
              Configured Timezone
            </label>
            {previewTime && (
              <span className="text-[11px] text-flame-400 font-mono font-medium flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {previewTime}
              </span>
            )}
          </div>
          <CustomSelect
            value={timezone}
            onChange={(val) => setTimezone(val)}
            options={
              timezones.length > 0
                ? timezones.map((tz) => ({ value: tz.value, label: tz.label }))
                : [{ value: 'Asia/Kolkata', label: 'India Standard Time (IST) - Asia/Kolkata' }]
            }
            searchable={true}
          />
          <p className="text-[11px] text-dark-muted mt-1.5 leading-relaxed">
            Changing your timezone immediately updates your local day boundary and reverse midnight countdown timer.
          </p>
        </div>

        <div className="pt-2 border-t border-dark-border flex justify-end">
          <button
            type="submit"
            disabled={isSubmittingProfile}
            className="px-6 py-2.5 bg-flame-500 hover:bg-flame-400 active:scale-95 text-zinc-950 font-extrabold text-sm rounded-xl transition-all shadow-md shadow-flame-500/20 flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSubmittingProfile ? 'Saving...' : 'Save Profile'}</span>
          </button>
        </div>
      </form>

      {/* SECTION 3: CHANGE USERNAME */}
      <form
        onSubmit={handleChangeUsername}
        className="bg-dark-card border border-dark-border rounded-3xl p-6 sm:p-8 shadow-panel space-y-5"
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              <AtSign className="w-4 h-4 text-flame-400" />
              Change Username
            </h2>
            <p className="text-xs text-dark-muted mt-0.5">
              Your unique handle. Can only be changed once every 14 days.
            </p>
          </div>
          <span
            className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
              usernameStatus?.canChangeNow
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
            }`}
          >
            {usernameStatus?.canChangeNow
              ? 'Available to Change'
              : `Cooldown Active (${usernameStatus?.daysRemaining}d left)`}
          </span>
        </div>

        {usernameSuccess && (
          <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold rounded-xl">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{usernameSuccess}</span>
          </div>
        )}

        {usernameError && (
          <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold rounded-xl">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{usernameError}</span>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-zinc-300 uppercase tracking-wider">
            <span>Current: @{user?.username}</span>
            {usernameStatus?.nextAllowedChangeDate && !usernameStatus.canChangeNow && (
              <span className="text-amber-400 normal-case font-medium">
                Next change: {new Date(usernameStatus.nextAllowedChangeDate).toLocaleDateString()}
              </span>
            )}
          </div>

          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 font-mono text-sm">
              @
            </span>
            <input
              type="text"
              required
              disabled={usernameStatus !== null && !usernameStatus.canChangeNow}
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
              placeholder={usernameStatus !== null && !usernameStatus.canChangeNow ? 'Cooldown active...' : 'new_username'}
              maxLength={30}
              className="w-full pl-8 pr-3.5 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-sm text-zinc-100 font-mono focus:outline-none focus:border-flame-500/80 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          <div className="p-3 bg-zinc-900/80 rounded-xl border border-zinc-800 text-[11px] text-zinc-400 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              All your habit streaks, friend connections, completions, and history remain intact when you change your username.
            </span>
          </div>
        </div>

        <div className="pt-2 border-t border-dark-border flex justify-end">
          <button
            type="submit"
            disabled={isChangingUsername || !newUsername.trim() || (usernameStatus !== null && !usernameStatus.canChangeNow)}
            className="px-5 py-2 bg-dark-surface hover:bg-dark-hover border border-dark-border text-zinc-100 rounded-xl text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isChangingUsername ? 'Updating...' : 'Update Username'}
          </button>
        </div>
      </form>

      {/* SECTION 4: REGISTERED LOGIN EMAIL (14-Day Rate Limit) */}
      <div className="bg-dark-card border border-dark-border rounded-3xl p-6 sm:p-8 shadow-panel space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              <Mail className="w-4 h-4 text-flame-400" />
              Registered Login Email
            </h2>
            <p className="text-xs text-dark-muted mt-0.5">
              Your primary login email address. For account security, this can only be changed once every 14 days.
            </p>
          </div>
          <span
            className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
              emailStatus?.canChangeNow
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
            }`}
          >
            {emailStatus?.canChangeNow ? 'Available to Change' : `Cooldown Active (${emailStatus?.daysRemaining}d left)`}
          </span>
        </div>

        {emailChangeSuccess && (
          <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold rounded-xl">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{emailChangeSuccess}</span>
          </div>
        )}

        {emailChangeError && (
          <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold rounded-xl">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{emailChangeError}</span>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-zinc-300 uppercase tracking-wider">
            <span>Current Email: {user?.email}</span>
            {emailStatus?.nextAllowedChangeDate && !emailStatus.canChangeNow && (
              <span className="text-amber-400 normal-case font-medium">
                Next change: {new Date(emailStatus.nextAllowedChangeDate).toLocaleDateString()}
              </span>
            )}
          </div>

          {emailChangeStep === 'idle' ? (
            <div className="flex items-center justify-between p-3.5 bg-dark-surface/60 rounded-xl border border-dark-border gap-3">
              <div className="text-xs text-zinc-400 flex items-center gap-2">
                <span className="font-mono text-zinc-200">{user?.email}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (emailStatus && !emailStatus.canChangeNow) {
                    setEmailChangeError(`You can change your registered email once every 14 days. You can next change it on ${new Date(emailStatus.nextAllowedChangeDate || '').toLocaleDateString()}.`);
                    return;
                  }
                  setEmailChangeStep('request');
                  setEmailChangeError('');
                  setEmailChangeSuccess('');
                }}
                disabled={emailStatus !== null && !emailStatus.canChangeNow}
                className="px-3.5 py-1.5 bg-dark-surface hover:bg-dark-hover border border-dark-border text-xs font-bold text-zinc-200 hover:text-flame-400 rounded-lg transition-colors disabled:opacity-40 disabled:hover:text-zinc-200"
              >
                Change Email
              </button>
            </div>
          ) : emailChangeStep === 'request' ? (
            <form onSubmit={handleRequestEmailChange} className="space-y-3 p-4 bg-dark-surface/40 rounded-2xl border border-dark-border">
              <label className="block text-xs font-semibold text-zinc-300">
                New Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-muted" />
                <input
                  type="email"
                  required
                  placeholder="new-email@example.com"
                  value={newEmailInput}
                  onChange={(e) => setNewEmailInput(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-flame-500/80"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setEmailChangeStep('idle')}
                  className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isEmailChanging || !newEmailInput.trim()}
                  className="px-4 py-1.5 bg-flame-500 hover:bg-flame-400 text-zinc-950 font-bold text-xs rounded-xl shadow-sm disabled:opacity-50"
                >
                  {isEmailChanging ? 'Sending code...' : 'Send Verification Code'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleVerifyEmailChange} className="space-y-4 p-4 bg-dark-surface/40 rounded-2xl border border-dark-border">
              <div className="flex items-center justify-between text-xs text-zinc-300">
                <span>Enter 6-digit code sent to <strong className="font-mono text-zinc-100">{newEmailInput}</strong>:</span>
                <button
                  type="button"
                  onClick={() => setEmailChangeStep('request')}
                  className="text-flame-400 hover:text-flame-300 text-xs font-semibold"
                >
                  Change email
                </button>
              </div>

              <input
                type="text"
                required
                maxLength={6}
                placeholder="000000"
                autoFocus
                value={emailOtpInput}
                onChange={(e) => setEmailOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full py-2.5 text-center text-xl font-mono tracking-[0.4em] bg-dark-surface border border-dark-border rounded-xl text-zinc-100 font-bold focus:outline-none focus:border-flame-500"
              />

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  disabled={emailOtpCooldown > 0 || isEmailChanging}
                  onClick={handleResendEmailOtp}
                  className="text-xs text-zinc-400 hover:text-flame-400 disabled:opacity-40 inline-flex items-center gap-1"
                >
                  <RotateCw className="w-3 h-3" />
                  {emailOtpCooldown > 0 ? `Resend in ${emailOtpCooldown}s` : 'Resend code'}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEmailChangeStep('idle')}
                    className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isEmailChanging || emailOtpInput.length !== 6}
                    className="px-4 py-1.5 bg-flame-500 hover:bg-flame-400 text-zinc-950 font-bold text-xs rounded-xl shadow-sm disabled:opacity-50"
                  >
                    {isEmailChanging ? 'Verifying...' : 'Confirm & Update Email'}
                  </button>
                </div>
              </div>
            </form>
          )}

          <div className="p-3 bg-zinc-900/80 rounded-xl border border-zinc-800 text-[11px] text-zinc-400 flex items-start justify-between gap-2">
            <div className="flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                Want to change where streak reminders and alerts are delivered without changing your login email?
              </span>
            </div>
            <Link
              to="/settings/notifications"
              className="text-flame-400 hover:text-flame-300 font-semibold shrink-0 hover:underline flex items-center gap-1"
            >
              <span>Notification Settings</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* SECTION 5: CHANGE PASSWORD */}
      <form
        onSubmit={handleChangePassword}
        className="bg-dark-card border border-dark-border rounded-3xl p-6 sm:p-8 shadow-panel space-y-5"
      >
        <div>
          <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-flame-400" />
            Change Password
          </h2>
          <p className="text-xs text-dark-muted mt-0.5">
            Ensure your account is using a secure, unique password (minimum 8 characters).
          </p>
        </div>

        {passwordSuccess && (
          <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold rounded-xl">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{passwordSuccess}</span>
          </div>
        )}

        {passwordError && (
          <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold rounded-xl">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{passwordError}</span>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
              Current Password
            </label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-sm text-zinc-100 focus:outline-none focus:border-flame-500/80"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                New Password
              </label>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                minLength={8}
                className="w-full px-3.5 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-sm text-zinc-100 focus:outline-none focus:border-flame-500/80"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-type new password"
                minLength={8}
                className="w-full px-3.5 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-sm text-zinc-100 focus:outline-none focus:border-flame-500/80"
              />
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-dark-border flex justify-end">
          <button
            type="submit"
            disabled={isChangingPassword}
            className="px-5 py-2 bg-dark-surface hover:bg-dark-hover border border-dark-border text-zinc-100 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
          >
            {isChangingPassword ? 'Updating...' : 'Update Password'}
          </button>
        </div>
      </form>

      {/* SECTION: APP LOCK (OPTIONAL) */}
      <div className="bg-dark-card border border-dark-border rounded-3xl p-6 sm:p-8 shadow-panel space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-flame-400" />
              <h2 className="text-base font-bold text-zinc-100">App Lock</h2>
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                  isAppLockEnabled
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-zinc-800 text-zinc-400 border border-zinc-700/60'
                }`}
              >
                {isAppLockEnabled ? 'Active' : 'Disabled'}
              </span>
            </div>
            <p className="text-xs text-dark-muted mt-1">
              Protect your StreakUp session with a 4-digit PIN. App lock automatically activates after 10 seconds of coming out of the app.
            </p>
          </div>

          <button
            type="button"
            onClick={isAppLockEnabled ? handleOpenDisableModal : handleOpenSetupModal}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0 ${
              isAppLockEnabled
                ? 'bg-rose-500/10 text-rose-300 border border-rose-500/25 hover:bg-rose-500/20'
                : 'bg-flame-500 hover:bg-flame-400 text-zinc-950 shadow-sm shadow-flame-500/20'
            }`}
          >
            {isAppLockEnabled ? 'Disable App Lock' : 'Enable App Lock'}
          </button>
        </div>

        {appLockSuccessMsg && (
          <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold rounded-xl animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{appLockSuccessMsg}</span>
          </div>
        )}

        {isAppLockEnabled && (
          <div className="space-y-4 pt-2 border-t border-dark-border/60">
            {/* PIN Settings */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-dark-surface/50 border border-dark-border rounded-2xl">
              <div>
                <div className="text-xs font-bold text-zinc-200 flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-flame-500" />
                  <span>Security PIN</span>
                </div>
                <p className="text-[11px] text-dark-muted mt-0.5">
                  Salted cryptographic hash stored locally. Your plaintext PIN is never saved.
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenChangePinModal}
                className="px-3 py-1.5 bg-dark-surface hover:bg-dark-hover border border-dark-border text-xs font-semibold text-zinc-200 hover:text-flame-400 rounded-lg transition-colors shrink-0"
              >
                Change PIN
              </button>
            </div>

            {/* Lock Policy Info */}
            <div className="flex items-center justify-between p-4 bg-dark-surface/50 border border-dark-border rounded-2xl">
              <div>
                <div className="text-xs font-bold text-zinc-200 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span>Lock Policy</span>
                </div>
                <p className="text-[11px] text-dark-muted mt-0.5">
                  App automatically locks after 10 seconds of leaving the app or returning from the background.
                </p>
              </div>
              <span className="text-xs font-semibold text-amber-400/90 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                10 seconds
              </span>
            </div>

            {/* Recovery Question Info */}
            <div className="flex items-center justify-between p-4 bg-dark-surface/50 border border-dark-border rounded-2xl">
              <div>
                <div className="text-xs font-bold text-zinc-200 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-flame-400" />
                  <span>Recovery Security Question</span>
                </div>
                <p className="text-[11px] text-dark-muted mt-0.5">
                  {securityQuestion || 'Configured during PIN setup for PIN recovery'}
                </p>
              </div>
              <span className="text-[11px] font-semibold text-emerald-400/90 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg">
                Active
              </span>
            </div>
          </div>
        )}
      </div>

      {/* SECTION: REQUESTS & FEEDBACK */}
      <div className="bg-dark-card border border-dark-border rounded-3xl p-6 sm:p-8 shadow-panel space-y-5">
        <div>
          <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-flame-500" />
            <span>Requests & Feedback</span>
          </h2>
          <p className="text-xs text-dark-muted mt-0.5">
            Share feature suggestions, report bugs, or send us your feedback.
          </p>
        </div>

        {feedbackSuccess && (
          <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold rounded-xl">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{feedbackSuccess}</span>
          </div>
        )}

        {feedbackError && (
          <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold rounded-xl">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{feedbackError}</span>
          </div>
        )}

        <form onSubmit={handleFeedbackSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
              Category
            </label>
            <select
              value={feedbackCategory}
              onChange={(e) => setFeedbackCategory(e.target.value as UserRequestCategory)}
              disabled={isSubmittingFeedback}
              className="w-full px-3.5 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 font-medium focus:outline-none focus:border-flame-500/80 transition-colors"
            >
              <option value="FEATURE_REQUEST">Feature Request</option>
              <option value="BUG_REPORT">Bug Report</option>
              <option value="ACCOUNT_SUPPORT">Account Support</option>
              <option value="GENERAL_FEEDBACK">General Feedback</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-zinc-300">
                Your Message
              </label>
              <span className="text-[11px] text-dark-muted font-mono">
                {feedbackMessage.length} / 3000
              </span>
            </div>
            <textarea
              rows={4}
              value={feedbackMessage}
              onChange={(e) => setFeedbackMessage(e.target.value)}
              placeholder="Describe your suggestion, issue, or feedback in detail..."
              disabled={isSubmittingFeedback}
              maxLength={3000}
              required
              className="w-full px-3.5 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 font-normal focus:outline-none focus:border-flame-500/80 transition-colors placeholder:text-zinc-600 resize-y min-h-[96px]"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmittingFeedback || feedbackMessage.trim().length < 5}
              className="px-5 py-2.5 bg-flame-500 hover:bg-flame-600 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-950 font-bold text-xs rounded-xl shadow-md shadow-flame-500/20 flex items-center gap-2 transition-all active:scale-95"
            >
              {isSubmittingFeedback ? (
                <div className="w-3.5 h-3.5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>{isSubmittingFeedback ? 'Submitting...' : 'Submit Feedback'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* SECTION: LEGAL & PRIVACY */}
      <div className="bg-dark-card border border-dark-border rounded-3xl p-6 sm:p-8 shadow-panel space-y-4">
        <div>
          <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
            <Shield className="w-5 h-5 text-flame-500" />
            <span>Legal & Privacy</span>
          </h2>
          <p className="text-xs text-dark-muted mt-0.5">
            Review StreakUp platform agreements, community terms, and data protection practices.
          </p>
        </div>

        <div className="divide-y divide-dark-border/60 rounded-2xl border border-dark-border overflow-hidden bg-dark-surface/40">
          <Link
            to="/terms"
            className="flex items-center justify-between p-4 hover:bg-dark-hover transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-flame-500/10 border border-flame-500/20 text-flame-400 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-zinc-200 group-hover:text-flame-400 transition-colors">
                  Terms & Conditions
                </div>
                <div className="text-[11px] text-dark-muted">
                  Account responsibilities, streak rules, points, and service terms
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-zinc-200 group-hover:translate-x-0.5 transition-all shrink-0" />
          </Link>

          <Link
            to="/privacy"
            className="flex items-center justify-between p-4 hover:bg-dark-hover transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-zinc-200 group-hover:text-emerald-400 transition-colors">
                  Privacy Policy
                </div>
                <div className="text-[11px] text-dark-muted">
                  What data we collect, zero ad-brokerage guarantee, and deletion rights
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-zinc-200 group-hover:translate-x-0.5 transition-all shrink-0" />
          </Link>
        </div>
      </div>

      {/* Danger Zone: Permanent Account Deletion (Requirement 4 & 8) */}
      <div className="bg-rose-950/10 border border-rose-500/20 rounded-3xl p-6 sm:p-8 shadow-panel">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-rose-400 font-bold text-base">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <span>Danger Zone: Permanent Account Deletion</span>
            </div>
            <p className="text-xs text-zinc-400 mt-1 max-w-xl">
              Permanently delete your StreakUp account and all associated data including habits, completion history, streaks, points, study notes, group memberships, and friendships. This action is irreversible.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setDeleteConfirmationText('');
              setDeletePassword('');
              setDeleteError('');
              setIsDeleteModalOpen(true);
            }}
            className="px-4 py-2.5 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 rounded-xl text-xs font-bold transition-all shrink-0 active:scale-95 flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete Account</span>
          </button>
        </div>
      </div>

      {/* Delete Account Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto overscroll-contain">
          <div className="bg-dark-card border border-rose-500/30 rounded-3xl max-w-md w-full p-5 sm:p-7 shadow-2xl relative my-auto max-h-[92vh] flex flex-col">
            <div className="flex items-center gap-3 text-rose-400 mb-4 shrink-0 pb-3 border-b border-rose-500/20">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-zinc-100">Permanent Account Deletion</h3>
                <p className="text-xs text-rose-400 font-medium">Irreversible action</p>
              </div>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (deleteConfirmationText !== 'DELETE') {
                  setDeleteError('Please type "DELETE" exactly to confirm.');
                  return;
                }
                setIsDeletingAccount(true);
                setDeleteError('');
                try {
                  const res = await deleteAccount({
                    confirmation: deleteConfirmationText,
                    password: deletePassword || undefined,
                  });
                  if (res.success) {
                    setIsDeleteModalOpen(false);
                    await logout();
                    navigate('/login?deleted=true');
                  }
                } catch (err: any) {
                  setDeleteError(
                    extractErrorMessage(err, 'Failed to delete account. Please verify your password.')
                  );
                } finally {
                  setIsDeletingAccount(false);
                }
              }}
              className="flex-1 flex flex-col min-h-0"
            >
              <div className="space-y-4 flex-1 overflow-y-auto min-h-0 pr-1">
                <div className="p-4 bg-rose-950/20 border border-rose-500/20 rounded-xl text-xs text-zinc-300 leading-relaxed">
                  <p className="font-semibold text-rose-300 mb-1">Are you absolutely sure?</p>
                  This will permanently delete your user profile, habits, completion logs, streaks, points, study notes, friend relationships, and group memberships. Any groups you own with active members will transfer ownership to the next earliest member.
                </div>

                {deleteError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{deleteError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                    Type <span className="text-rose-400 font-mono font-black">DELETE</span> to confirm
                  </label>
                  <input
                    type="text"
                    required
                    value={deleteConfirmationText}
                    onChange={(e) => setDeleteConfirmationText(e.target.value)}
                    placeholder="DELETE"
                    className="w-full px-3.5 py-2.5 bg-dark-surface border border-rose-500/30 rounded-xl text-sm text-zinc-100 focus:outline-none focus:border-rose-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-1.5">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    required
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-sm text-zinc-100 focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-dark-border flex items-center justify-end gap-3 shrink-0 mt-3">
                <button
                  type="button"
                  disabled={isDeletingAccount}
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="px-4 py-2 bg-dark-surface hover:bg-dark-hover border border-dark-border text-zinc-300 rounded-xl text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deleteConfirmationText !== 'DELETE' || isDeletingAccount}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-rose-600/30 flex items-center gap-2"
                >
                  {isDeletingAccount ? (
                    <>
                      <RotateCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <span>Permanently Delete</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* App Lock: Setup PIN Modal */}
      {appLockModal === 'setup' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn overflow-y-auto overscroll-contain">
          <div className="bg-dark-card border border-dark-border rounded-3xl p-5 sm:p-7 w-full max-w-sm shadow-2xl my-auto max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-dark-border shrink-0">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-flame-400" />
                <h3 className="text-sm font-bold text-zinc-100">Setup App Lock PIN</h3>
              </div>
              <button
                type="button"
                onClick={() => setAppLockModal('none')}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-dark-hover"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSetupPinSubmit} className="flex-1 flex flex-col min-h-0">
              <div className="space-y-4 flex-1 overflow-y-auto min-h-0 pr-1 pt-3">
                {appLockModalError && (
                  <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl">
                    {appLockModalError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Enter 4-Digit PIN
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    required
                    autoFocus
                    placeholder="••••"
                    value={appLockPin}
                    onChange={(e) => setAppLockPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="w-full text-center tracking-[0.5em] font-mono text-xl py-2.5 bg-dark-surface border border-dark-border rounded-xl text-zinc-100 focus:outline-none focus:border-flame-500/80"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Confirm 4-Digit PIN
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    required
                    placeholder="••••"
                    value={appLockConfirmPin}
                    onChange={(e) => setAppLockConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="w-full text-center tracking-[0.5em] font-mono text-xl py-2.5 bg-dark-surface border border-dark-border rounded-xl text-zinc-100 focus:outline-none focus:border-flame-500/80"
                  />
                </div>

                {/* Security Question for Recovery */}
                <div className="pt-2 border-t border-dark-border/60 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-flame-400">
                    <HelpCircle className="w-3.5 h-3.5" />
                    <span>PIN Recovery Security Question</span>
                  </div>
                  <p className="text-[11px] text-dark-muted">
                    Used to reset your PIN if forgotten, without requiring email or SMS OTP.
                  </p>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      Select Question
                    </label>
                    <CustomSelect
                      value={appLockSecQuestion}
                      onChange={(val) => setAppLockSecQuestion(val)}
                      options={DEFAULT_SECURITY_QUESTIONS.map((q) => ({ value: q, label: q }))}
                      size="sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      Your Answer
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Enter memorable answer"
                      value={appLockSecAnswer}
                      onChange={(e) => setAppLockSecAnswer(e.target.value)}
                      className="w-full px-3.5 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500/80"
                    />
                    <p className="text-[10px] text-zinc-500 mt-1">
                      Your answer is cryptographically hashed with salt and never stored in plain text.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-dark-border shrink-0 mt-3">
                <button
                  type="button"
                  onClick={() => setAppLockModal('none')}
                  className="px-3.5 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={appLockModalLoading || appLockPin.length !== 4 || appLockConfirmPin.length !== 4 || !appLockSecAnswer.trim()}
                  className="px-5 py-2 bg-flame-500 hover:bg-flame-400 disabled:opacity-40 text-zinc-950 font-bold text-xs rounded-xl shadow-sm transition-all"
                >
                  {appLockModalLoading ? 'Saving...' : 'Set PIN & Enable'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* App Lock: Change PIN Modal */}
      {appLockModal === 'change' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn overflow-y-auto overscroll-contain">
          <div className="bg-dark-card border border-dark-border rounded-3xl p-5 sm:p-7 w-full max-w-sm shadow-2xl my-auto max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-dark-border shrink-0">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-flame-400" />
                <h3 className="text-sm font-bold text-zinc-100">Change Security PIN</h3>
              </div>
              <button
                type="button"
                onClick={() => setAppLockModal('none')}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-dark-hover"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleChangePinSubmit} className="flex-1 flex flex-col min-h-0">
              <div className="space-y-4 flex-1 overflow-y-auto min-h-0 pr-1 pt-3">
                {appLockModalError && (
                  <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl">
                    {appLockModalError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Current PIN
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    required
                    autoFocus
                    placeholder="••••"
                    value={appLockCurrentPin}
                    onChange={(e) => setAppLockCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="w-full text-center tracking-[0.5em] font-mono text-xl py-2.5 bg-dark-surface border border-dark-border rounded-xl text-zinc-100 focus:outline-none focus:border-flame-500/80"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    New 4-Digit PIN
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    required
                    placeholder="••••"
                    value={appLockPin}
                    onChange={(e) => setAppLockPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="w-full text-center tracking-[0.5em] font-mono text-xl py-2.5 bg-dark-surface border border-dark-border rounded-xl text-zinc-100 focus:outline-none focus:border-flame-500/80"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Confirm New PIN
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    required
                    placeholder="••••"
                    value={appLockConfirmPin}
                    onChange={(e) => setAppLockConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="w-full text-center tracking-[0.5em] font-mono text-xl py-2.5 bg-dark-surface border border-dark-border rounded-xl text-zinc-100 focus:outline-none focus:border-flame-500/80"
                  />
                </div>

                {/* Optional Security Question update */}
                <div className="pt-2 border-t border-dark-border/60 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-300">
                    <HelpCircle className="w-3.5 h-3.5 text-flame-400" />
                    <span>Update Security Question (Optional)</span>
                  </div>
                  <CustomSelect
                    value={appLockSecQuestion}
                    onChange={(val) => setAppLockSecQuestion(val)}
                    options={DEFAULT_SECURITY_QUESTIONS.map((q) => ({ value: q, label: q }))}
                    size="sm"
                  />
                  <input
                    type="text"
                    placeholder="New answer (leave blank to keep existing)"
                    value={appLockSecAnswer}
                    onChange={(e) => setAppLockSecAnswer(e.target.value)}
                    className="w-full px-3.5 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 focus:outline-none focus:border-flame-500/80"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-dark-border shrink-0 mt-3">
                <button
                  type="button"
                  onClick={() => setAppLockModal('none')}
                  className="px-3.5 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={appLockModalLoading || appLockCurrentPin.length !== 4 || appLockPin.length !== 4 || appLockConfirmPin.length !== 4}
                  className="px-5 py-2 bg-flame-500 hover:bg-flame-400 disabled:opacity-40 text-zinc-950 font-bold text-xs rounded-xl shadow-sm transition-all"
                >
                  {appLockModalLoading ? 'Updating...' : 'Update PIN'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* App Lock: Disable Confirmation Modal */}
      {appLockModal === 'disable' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn overflow-y-auto overscroll-contain">
          <div className="bg-dark-card border border-dark-border rounded-3xl p-6 sm:p-7 w-full max-w-sm shadow-2xl space-y-5 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-dark-border">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-rose-400" />
                <h3 className="text-sm font-bold text-zinc-100">Disable App Lock</h3>
              </div>
              <button
                type="button"
                onClick={() => setAppLockModal('none')}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-dark-hover"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-dark-muted leading-relaxed">
              To disable App Lock, please verify your current 4-digit PIN.
            </p>

            {appLockModalError && (
              <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-xl">
                {appLockModalError}
              </div>
            )}

            <form onSubmit={handleDisableSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Current PIN
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  required
                  autoFocus
                  placeholder="••••"
                  value={appLockCurrentPin}
                  onChange={(e) => setAppLockCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="w-full text-center tracking-[0.5em] font-mono text-xl py-2.5 bg-dark-surface border border-dark-border rounded-xl text-zinc-100 focus:outline-none focus:border-flame-500/80"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-dark-border">
                <button
                  type="button"
                  onClick={() => setAppLockModal('none')}
                  className="px-3.5 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={appLockModalLoading || appLockCurrentPin.length !== 4}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-sm transition-all"
                >
                  {appLockModalLoading ? 'Verifying...' : 'Disable'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
