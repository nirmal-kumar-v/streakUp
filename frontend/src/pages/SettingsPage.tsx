import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  updateProfileSettings,
  uploadProfileImage,
  removeProfileImage,
  changePassword,
  changeUsername,
  fetchTimezones,
  TimezoneOption,
} from '../api/user';
import { InitialsAvatar } from '../components/InitialsAvatar';
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
} from 'lucide-react';
import { extractErrorMessage } from '../utils/error';

export const SettingsPage: React.FC = () => {
  const { user, updateUser } = useAuth();

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
  const [isUploadingImage, setIsUploadingImage] = useState(false);
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

    // Validate size: max 5 MB
    const maxBytes = 5 * 1024 * 1024;
    if (file.size > maxBytes) {
      setImageError(
        `File is too large (${(file.size / (1024 * 1024)).toFixed(2)} MB). Maximum allowed size is 5 MB.`
      );
      return;
    }

    // Read as Base64 Data URI for preview and persistent cloud storage
    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
    };
    reader.onerror = () => {
      setImageError('Failed to read image file.');
    };
    reader.readAsDataURL(file);
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
      }
    } catch (err: any) {
      setImageError(extractErrorMessage(err, 'Failed to upload profile image.'));
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleRemoveImage = async () => {
    if (!window.confirm('Are you sure you want to remove your profile image?')) return;
    setIsUploadingImage(true);
    setImageError('');
    setImageSuccess('');

    try {
      const res = await removeProfileImage();
      if (res.success) {
        updateUser({ profileImage: null });
        setImagePreview(null);
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
    setIsChangingUsername(true);
    setUsernameSuccess('');
    setUsernameError('');

    try {
      const res = await changeUsername(newUsername.trim());
      if (res.success) {
        updateUser({ username: res.user.username });
        setUsernameSuccess(`Username successfully updated to @${res.user.username}!`);
        setNewUsername('');
      }
    } catch (err: any) {
      setUsernameError(extractErrorMessage(err, 'Failed to change username.'));
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

      {/* SECTION 1: PROFILE IMAGE UPLOAD */}
      <div className="bg-dark-card border border-dark-border rounded-3xl p-6 sm:p-8 shadow-panel space-y-6">
        <div>
          <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
            <Upload className="w-4 h-4 text-flame-400" />
            Profile Picture
          </h2>
          <p className="text-xs text-dark-muted mt-0.5">
            Upload a picture from your device (JPEG, PNG, WebP up to 5 MB).
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
              )}

              {user?.profileImage && !imagePreview && (
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  disabled={isUploadingImage}
                  className="px-3 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Picture</span>
                </button>
              )}

              {imagePreview && (
                <button
                  type="button"
                  onClick={() => setImagePreview(null)}
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
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-flame-500/80"
          >
            {timezones.length > 0 ? (
              timezones.map((tz) => (
                <option key={tz.value} value={tz.value} className="bg-dark-card text-zinc-200">
                  {tz.label}
                </option>
              ))
            ) : (
              <option value="Asia/Kolkata">India Standard Time (IST) - Asia/Kolkata</option>
            )}
          </select>
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
        <div>
          <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
            <AtSign className="w-4 h-4 text-flame-400" />
            Change Username
          </h2>
          <p className="text-xs text-dark-muted mt-0.5">
            Your unique handle. Can only be changed once every 14 days.
          </p>
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
          </div>

          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 font-mono text-sm">
              @
            </span>
            <input
              type="text"
              required
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
              placeholder="new_username"
              maxLength={30}
              className="w-full pl-8 pr-3.5 py-2.5 bg-dark-surface border border-dark-border rounded-xl text-sm text-zinc-100 font-mono focus:outline-none focus:border-flame-500/80"
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
            disabled={isChangingUsername || !newUsername.trim()}
            className="px-5 py-2 bg-dark-surface hover:bg-dark-hover border border-dark-border text-zinc-100 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
          >
            {isChangingUsername ? 'Updating...' : 'Update Username'}
          </button>
        </div>
      </form>

      {/* SECTION 4: CHANGE PASSWORD */}
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
    </div>
  );
};
