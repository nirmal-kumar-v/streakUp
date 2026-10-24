import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, getMe, logoutUser } from '../api/auth';

export interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => Promise<void>;
  updateUser: (updatedFields: Partial<User>, newToken?: string) => void;
  refreshUser: () => Promise<void>;
}

const defaultAuthContext: AuthContextType = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: false,
  login: () => {},
  logout: async () => {},
  updateUser: () => {},
  refreshUser: async () => {},
};

declare global {
  interface Window {
    __STREAKUP_AUTH_CONTEXT__?: React.Context<AuthContextType>;
  }
}

const AuthContext: React.Context<AuthContextType> =
  (typeof window !== 'undefined' && window.__STREAKUP_AUTH_CONTEXT__) ||
  createContext<AuthContextType>(defaultAuthContext);

if (typeof window !== 'undefined') {
  window.__STREAKUP_AUTH_CONTEXT__ = AuthContext;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('streakup_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('streakup_token');
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => !localStorage.getItem('streakup_token'));

  const refreshUser = useCallback(async () => {
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    try {
      const res = await getMe();
      if (res.success && res.user) {
        setUser(res.user);
        localStorage.setItem('streakup_user', JSON.stringify(res.user));
      }
    } catch (err: any) {
      console.warn('Failed to refresh user profile:', err);
      // Only clear credentials if the server explicitly rejects the token with 401 Unauthorized.
      // If there is a network error, offline state, or cold start, keep user logged in using cached profile.
      if (err?.response?.status === 401) {
        localStorage.removeItem('streakup_token');
        localStorage.removeItem('streakup_user');
        setUser(null);
        setToken(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback((newToken: string, newUser: User) => {
    localStorage.setItem('streakup_token', newToken);
    localStorage.setItem('streakup_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutUser();
    } catch {
      // Ignore network errors on logout
    } finally {
      localStorage.removeItem('streakup_token');
      localStorage.removeItem('streakup_user');
      setUser(null);
      setToken(null);
    }
  }, []);

  const updateUser = useCallback((updatedFields: Partial<User>, newToken?: string) => {
    if (newToken) {
      localStorage.setItem('streakup_token', newToken);
      setToken(newToken);
    }
    setUser((prevUser) => {
      if (!prevUser) return null;
      const merged = { ...prevUser, ...updatedFields };
      localStorage.setItem('streakup_user', JSON.stringify(merged));
      return merged;
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user && !!token,
        isLoading,
        login,
        logout,
        updateUser,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  return context || defaultAuthContext;
}
