import apiClient from './client';

export interface PublicProfile {
  id: string;
  name: string;
  username: string;
  profileImage: string | null;
  currentStreak: number;
  longestStreak: number;
  totalCompletedTasks: number;
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
  const res = await apiClient.put<{ success: boolean; user: any; message: string }>(
    '/users/profile',
    data
  );
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
