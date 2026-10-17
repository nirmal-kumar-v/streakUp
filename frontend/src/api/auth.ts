import apiClient from './client';

export interface User {
  id: string;
  name: string;
  username: string;
  email: string;
  timezone: string;
  profileImage: string | null;
  currentStreak: number;
  longestStreak: number;
  createdAt?: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  token?: string;
  user?: User;
  error?: string;
}

export async function registerUser(data: {
  name: string;
  username: string;
  email: string;
  password: string;
  confirmPassword?: string;
  timezone?: string;
}): Promise<AuthResponse> {
  const res = await apiClient.post<AuthResponse>('/auth/register', data);
  return res.data;
}

export async function loginUser(data: {
  identifier: string;
  password: string;
}): Promise<AuthResponse> {
  const res = await apiClient.post<AuthResponse>('/auth/login', data);
  return res.data;
}

export async function getMe(): Promise<{ success: boolean; user: User }> {
  const res = await apiClient.get('/auth/me');
  return res.data;
}

export async function logoutUser(): Promise<{ success: boolean; message: string }> {
  const res = await apiClient.post('/auth/logout');
  return res.data;
}
