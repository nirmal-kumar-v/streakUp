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
  points?: number;
  isEmailVerified?: boolean;
  emailLastChangedAt?: string | null;
  createdAt?: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  token?: string;
  user?: User;
  error?: string;
  pendingVerification?: boolean;
  requiresVerification?: boolean;
  email?: string;
  retryAfterSeconds?: number;
}

export async function registerUser(data: {
  name: string;
  username: string;
  email: string;
  password: string;
  confirmPassword?: string;
  timezone?: string;
  termsAccepted?: boolean;
  termsVersion?: string;
}): Promise<AuthResponse> {
  const res = await apiClient.post<AuthResponse>('/auth/register', data);
  return res.data;
}

export async function verifySignupOtp(data: {
  email: string;
  otp: string;
}): Promise<AuthResponse> {
  const res = await apiClient.post<AuthResponse>('/auth/verify-signup', data);
  return res.data;
}

export async function resendSignupOtp(email: string): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  retryAfterSeconds?: number;
}> {
  const res = await apiClient.post('/auth/resend-signup-otp', { email });
  return res.data;
}

export async function loginUser(data: {
  identifier: string;
  password: string;
}): Promise<AuthResponse> {
  const res = await apiClient.post<AuthResponse>('/auth/login', data);
  return res.data;
}

export async function forgotPassword(email: string): Promise<{
  success: boolean;
  message?: string;
  email?: string;
  error?: string;
}> {
  const res = await apiClient.post('/auth/forgot-password', { email });
  return res.data;
}

export async function resendPasswordResetOtp(email: string): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  retryAfterSeconds?: number;
}> {
  const res = await apiClient.post('/auth/resend-reset-otp', { email });
  return res.data;
}

export async function resetPassword(data: {
  email?: string;
  otp?: string;
  token?: string;
  newPassword: string;
  confirmPassword?: string;
}): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  maxAttemptsExceeded?: boolean;
}> {
  const res = await apiClient.post('/auth/reset-password', data);
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
