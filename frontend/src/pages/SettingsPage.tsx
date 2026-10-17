import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { updateProfileSettings, fetchTimezones, TimezoneOption } from '../api/user';
import { DateTime } from 'luxon';
import {
  Settings,
  User as UserIcon,
  Globe,
  CheckCircle2,
  AlertCircle,
  Save,
  Clock,
} from 'lucide-react';
import { extractErrorMessage } from '../utils/error';

const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80',
];

export const SettingsPage: React.FC = () => {
  const { user, updateUser } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [profileImage, setProfileImage] = useState(user?.profileImage || '');
  const [timezone, setTimezone] = useState(user?.timezone || 'Asia/Kolkata');
  const [timezones, setTimezones] = useState<TimezoneOption[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Live preview time in the selected timezone
  const [previewTime, setPreviewTime] = useState('');

  useEffect(() => {
    fetchTimezones().then((res) => {
      if (res.success) {
        setTimezones(res.timezones);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setProfileImage(user.profileImage || '');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      const res = await updateProfileSettings({
        name: name.trim(),
        profileImage: profileImage.trim() || null,
        timezone,
      });

      if (res.success && res.user) {
        updateUser({
          name: res.user.name,
          profileImage: res.user.profileImage,
          timezone: res.user.timezone,
        });
        setSuccessMessage('Profile and timezone settings updated successfully!');
      }
    } catch (err: any) {
      setErrorMessage(extractErrorMessage(err, 'Failed to update profile.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-zinc-100 tracking-tight flex items-center gap-2.5">
          <Settings className="w-7 h-7 text-flame-500" />
          Account Settings
        </h1>
        <p className="text-xs sm:text-sm text-dark-muted mt-1">
          Customize your display name, profile avatar, and local timezone
        </p>
      </div>

      {successMessage && (
        <div className="flex items-center gap-2 p-3.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold rounded-2xl">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="flex items-center gap-2 p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold rounded-2xl">
          <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-dark-card border border-dark-border rounded-3xl p-6 sm:p-8 shadow-panel space-y-6">
        {/* Avatar Section */}
        <div>
          <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-3">
            Profile Avatar
          </label>
          <div className="flex flex-col sm:flex-row items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-zinc-800 border-2 border-flame-500/40 flex items-center justify-center overflow-hidden shadow-md flex-shrink-0">
              {profileImage ? (
                <img src={profileImage} alt={name} className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="w-8 h-8 text-zinc-400" />
              )}
            </div>

            <div className="flex-1 w-full space-y-2">
              <input
                type="url"
                placeholder="Paste an image URL..."
                value={profileImage}
                onChange={(e) => setProfileImage(e.target.value)}
                className="w-full px-3.5 py-2 bg-dark-surface border border-dark-border rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-flame-500/80 font-mono"
              />
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] text-dark-muted">Or pick a preset:</span>
                <div className="flex items-center gap-1.5">
                  {AVATAR_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setProfileImage(preset)}
                      className={`w-7 h-7 rounded-lg overflow-hidden border transition-all ${
                        profileImage === preset ? 'ring-2 ring-flame-500 border-transparent scale-105' : 'border-dark-border opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={preset} alt={`Preset ${idx + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                  {profileImage && (
                    <button
                      type="button"
                      onClick={() => setProfileImage('')}
                      className="text-[10px] text-zinc-400 hover:text-rose-400 ml-1 underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

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

        {/* Username (Immutable) */}
        <div>
          <label className="block text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2">
            Username
          </label>
          <input
            type="text"
            disabled
            value={`@${user?.username}`}
            className="w-full px-3.5 py-2.5 bg-dark-surface/60 border border-dark-border rounded-xl text-sm text-dark-muted font-mono cursor-not-allowed"
          />
          <p className="text-[11px] text-dark-muted mt-1">Unique identifiers cannot be changed.</p>
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

        {/* Save Button */}
        <div className="pt-4 border-t border-dark-border flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 bg-flame-500 hover:bg-flame-400 active:scale-95 text-zinc-950 font-extrabold text-sm rounded-xl transition-all shadow-md shadow-flame-500/20 flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSubmitting ? 'Saving changes...' : 'Save Changes'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
