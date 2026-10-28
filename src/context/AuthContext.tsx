import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, UserRole, RegisterData } from '../types';

interface AuthResponse {
  success: boolean;
  message?: string;
}

interface AuthContextType {
  currentUser: User | null;
  activeRole: UserRole;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (rollNumber: string, password: string) => Promise<AuthResponse>;
  register: (data: RegisterData) => Promise<AuthResponse>;
  logout: () => void;
  backendStatus: 'connected' | 'connecting' | 'offline';
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'bidnest_auth_session';
const TOKEN_KEY = 'bidnest_auth_token';
const API_BASE_URL = 'http://localhost:5000/api';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Failed to load session:', e);
    }
    return null;
  });

  const activeRole = currentUser?.role ?? 'buyer';

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [backendStatus, setBackendStatus] = useState<'connected' | 'connecting' | 'offline'>('connecting');

  // Check backend server and MongoDB status on mount
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/health`, { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          setBackendStatus('connected');
        } else {
          setBackendStatus('offline');
        }
      } catch {
        setBackendStatus('offline');
      }
    };

    checkBackend();
  }, []);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;

    fetch(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Session expired');
        const data = await res.json();
        setCurrentUser({ ...data.user, token });
      })
      .catch(() => {
        setCurrentUser(null);
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(TOKEN_KEY);
      });
  }, []);

  // Sync session state to localStorage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(TOKEN_KEY);
    }
  }, [currentUser]);

  // Real backend LOGIN
  const login = async (rollNumber: string, password: string): Promise<AuthResponse> => {
    setIsLoading(true);
    const cleanRollNumber = rollNumber.trim().toUpperCase();

    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rollNumber: cleanRollNumber,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setIsLoading(false);
        return { success: false, message: data.message || 'Login failed' };
      }

      // Save token and user
      if (data.token) {
        localStorage.setItem(TOKEN_KEY, data.token);
      }

      const loggedInUser: User = {
        ...data.user,
        token: data.token,
      };

      setCurrentUser(loggedInUser);
      setBackendStatus('connected');
      setIsLoading(false);

      return { success: true, message: data.message || 'Login successful' };
    } catch {
      setIsLoading(false);
      setBackendStatus('offline');
      return { success: false, message: 'Could not connect to the authentication server.' };
    }
  };

  // Real backend REGISTER (Sign Up)
  const register = async (data: RegisterData): Promise<AuthResponse> => {
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const resData = await res.json();

      if (!res.ok) {
        setIsLoading(false);
        return { success: false, message: resData.message || 'Registration failed' };
      }

      if (resData.token) {
        localStorage.setItem(TOKEN_KEY, resData.token);
      }

      const registeredUser: User = {
        ...resData.user,
        token: resData.token,
      };

      setCurrentUser(registeredUser);
      setBackendStatus('connected');
      setIsLoading(false);

      return { success: true, message: resData.message || 'Account created successfully in MongoDB!' };
    } catch (err: any) {
      setIsLoading(false);
      return {
        success: false,
        message: 'Could not connect to backend server at http://localhost:5000. Please ensure the backend is running.',
      };
    }
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TOKEN_KEY);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        activeRole,
        isAuthenticated: !!currentUser,
        isLoading,
        login,
        register,
        logout,
        backendStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
