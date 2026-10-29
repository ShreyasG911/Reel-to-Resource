import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../api/client';

export interface AdminProfile {
  id: string;
  username: string;
  role: string;
}

interface AuthContextType {
  admin: AdminProfile | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (admin: AdminProfile) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  admin: null,
  loading: true,
  isAuthenticated: false,
  login: () => {},
  logout: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active HttpOnly cookie session with server
    api.getMe()
      .then((res) => {
        setAdmin(res.admin);
      })
      .catch(() => {
        setAdmin(null);
      })
      .finally(() => {
        setLoading(false);
      });

    const handleUnauthorized = () => {
      setAdmin(null);
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const login = (adminProfile: AdminProfile) => {
    setAdmin(adminProfile);
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {
      // Ignore network failure on logout
    } finally {
      setAdmin(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        admin,
        loading,
        isAuthenticated: Boolean(admin),
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

