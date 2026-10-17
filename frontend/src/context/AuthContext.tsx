import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, getMe, logoutUser } from '../api/auth';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: User) => void;
  logout: () => Promise<void>;
  updateUser: (updatedFields: Partial<User>) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('streakup_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('streakup_token');
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

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
    } catch (err) {
      console.warn('Failed to refresh user profile:', err);
      // If token expired, clear
      localStorage.removeItem('streakup_token');
      localStorage.removeItem('streakup_user');
      setUser(null);
      setToken(null);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('streakup_token', newToken);
    localStorage.setItem('streakup_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const logout = async () => {
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
  };

  const updateUser = (updatedFields: Partial<User>) => {
    if (!user) return;
    const merged = { ...user, ...updatedFields };
    setUser(merged);
    localStorage.setItem('streakup_user', JSON.stringify(merged));
  };

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

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
