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

export async function fetchTimezones() {
  const res = await apiClient.get<{
    success: boolean;
    timezones: TimezoneOption[];
    defaultTimezone: string;
  }>('/users/timezones');
  return res.data;
}
