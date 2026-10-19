import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// Normalize base URL (strip trailing slash)
const rawBaseUrl = import.meta.env.VITE_API_URL || '/api';
const API_BASE_URL = rawBaseUrl.replace(/\/+$/, '');

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30s timeout handles Render cold starts gracefully without hanging indefinitely
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach token (prioritizes streakup_admin_token for /admin endpoints)
apiClient.interceptors.request.use((config) => {
  const isAdminEndpoint = config.url && (config.url.startsWith('/admin') || config.url.includes('/admin/'));
  const token = isAdminEndpoint
    ? localStorage.getItem('streakup_admin_token')
    : localStorage.getItem('streakup_token');

  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Guard against multiple simultaneous redirect loops
let isRedirectingToLogin = false;

// Response interceptor: handle token expiry & single safe retry for idempotent cold starts
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

    // Render free-tier cold start resilience:
    // If an idempotent GET request fails with 502/503/504 (bad gateway while container starts)
    // or timeout, retry once after a 1.5s delay. Never retry POST/PUT/DELETE.
    if (
      config &&
      config.method?.toUpperCase() === 'GET' &&
      !config._retry &&
      (error.code === 'ECONNABORTED' ||
        (error.response?.status && [502, 503, 504].includes(error.response.status)))
    ) {
      config._retry = true;
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return apiClient(config);
    }

    if (error.response?.status === 401) {
      // If unauthorized and we had a token, remove it safely
      const hasToken = Boolean(localStorage.getItem('streakup_token'));
      const isLoginOrAuth =
        window.location.pathname.includes('/login') ||
        window.location.pathname.includes('/register') ||
        window.location.pathname.includes('/streakup-karo') ||
        window.location.pathname.includes('/admin');

      if (hasToken && !isLoginOrAuth && !isRedirectingToLogin) {
        isRedirectingToLogin = true;
        localStorage.removeItem('streakup_token');
        localStorage.removeItem('streakup_user');
        window.location.href = '/login?expired=true';
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
