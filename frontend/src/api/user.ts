import apiClient from './client';
import { compressProfileImage } from '../utils/imageCompressor';

export interface PublicProfile {
  id: string;
  name: string;
  username: string;
  profileImage: string | null;
  currentStreak: number;
  longestStreak: number;
  points?: number;
  totalCompletedTasks: number;
  connectionsCount?: number;
  memberSince: string;
  relationshipStatus: 'SELF' | 'FRIENDS' | 'REQUEST_SENT' | 'REQUEST_RECEIVED' | 'NONE';
  requestId: string | null;
}

export interface TimezoneOption {
  value: string;
  label: string;
}

export async function fetchPublicProfile(username: string) {
  const res = await apiClient.get<{ success: boolean; profile: PublicProfile }>(
    `/users/profile/${username}`
  );
  return res.data;
}

export async function updateProfileSettings(data: {
  name?: string;
  profileImage?: string | null;
  timezone?: string;
}) {
  const payload = { ...data };
  if (payload.profileImage && payload.profileImage.startsWith('data:image/')) {
    payload.profileImage = await compressProfileImage(payload.profileImage);
  }
  const res = await apiClient.put<{ success: boolean; user: any; message: string }>(
    '/users/profile',
    payload
  );
  return res.data;
}

export async function uploadProfileImage(imageBase64: string) {
  const compressed = await compressProfileImage(imageBase64);
  const res = await apiClient.post<{
    success: boolean;
    message: string;
    profileImage: string;
    user: any;
  }>('/users/profile-image', { imageBase64: compressed });
  return res.data;
}

export async function removeProfileImage() {
  const res = await apiClient.delete<{
    success: boolean;
    message: string;
    profileImage: null;
    user: any;
  }>('/users/profile-image');
  return res.data;
}

export async function changePassword(currentPassword: string, newPassword: string) {
  const res = await apiClient.post<{ success: boolean; message: string }>('/users/change-password', {
    currentPassword,
    newPassword,
  });
  return res.data;
}

export async function changeUsername(newUsername: string) {
  const res = await apiClient.post<{
    success: boolean;
    message: string;
    user: any;
    token?: string;
    nextAllowedChangeDate?: string;
    daysRemaining?: number;
    error?: string;
  }>('/users/change-username', {
    newUsername,
  });
  return res.data;
}

export async function fetchUsernameStatus() {
  const res = await apiClient.get<{
    success: boolean;
    currentUsername: string;
    lastUsernameChangeAt: string | null;
    canChangeNow: boolean;
    nextAllowedChangeDate: string | null;
    daysRemaining: number;
    error?: string;
  }>('/users/username-status');
  return res.data;
}

export const DEFAULT_FALLBACK_TIMEZONES: TimezoneOption[] = [
  { value: 'Asia/Kolkata', label: 'India Standard Time (IST) - Asia/Kolkata' },
  { value: 'UTC', label: 'Coordinated Universal Time (UTC)' },
  { value: 'America/New_York', label: 'Eastern Time (ET) - America/New_York' },
  { value: 'America/Chicago', label: 'Central Time (CT) - America/Chicago' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT) - America/Los_Angeles' },
  { value: 'Europe/London', label: 'Greenwich Mean Time (GMT) - Europe/London' },
  { value: 'Europe/Paris', label: 'Central European Time (CET) - Europe/Paris' },
  { value: 'Asia/Dubai', label: 'Gulf Standard Time (GST) - Asia/Dubai' },
  { value: 'Asia/Singapore', label: 'Singapore Time (SGT) - Asia/Singapore' },
  { value: 'Asia/Tokyo', label: 'Japan Standard Time (JST) - Asia/Tokyo' },
  { value: 'Australia/Sydney', label: 'Australian Eastern Time (AET) - Australia/Sydney' },
];

export async function fetchTimezones() {
  try {
    const res = await apiClient.get<{
      success: boolean;
      timezones: TimezoneOption[];
      defaultTimezone: string;
    }>('/users/timezones');
    return res.data;
  } catch (err) {
    console.warn('Could not load timezones from API, using fallback timezones list:', err);
    return {
      success: true,
      timezones: DEFAULT_FALLBACK_TIMEZONES,
      defaultTimezone: 'Asia/Kolkata'
    };
  }
}

export async function fetchEmailChangeStatus() {
  const res = await apiClient.get<{
    success: boolean;
    currentEmail: string;
    emailLastChangedAt: string | null;
    canChangeNow: boolean;
    nextAllowedChangeDate: string | null;
    daysRemaining: number;
    error?: string;
  }>('/users/email-change-status');
  return res.data;
}

export async function requestChangeEmailOtp(newEmail: string) {
  const res = await apiClient.post<{
    success: boolean;
    message: string;
    newEmail: string;
    error?: string;
    nextAllowedChangeDate?: string;
    daysRemaining?: number;
  }>('/users/change-email/request', { newEmail });
  return res.data;
}

export async function verifyChangeEmailOtp(newEmail: string, otp: string) {
  const res = await apiClient.post<{
    success: boolean;
    message: string;
    user: any;
    token?: string;
    error?: string;
  }>('/users/change-email/verify', { newEmail, otp });
  return res.data;
}

export async function deleteAccount(data: { confirmation: string; password?: string }) {
  const res = await apiClient.delete<{
    success: boolean;
    message: string;
    error?: string;
  }>('/users/account', { data });
  return res.data;
}



