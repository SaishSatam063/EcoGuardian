import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface UserData {
  id: string;
  name: string;
  email: string;
  institution: string;
  avatar?: string;
  totalCashback: number;
  totalReports: number;
  solvedReports: number;
  certificates: number;
  joinedDate: string;
}

interface AuthContextValue {
  user: UserData | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  signup: (name: string, email: string, institution: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  updateUser: (data: Partial<UserData>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  async function loadUser() {
    try {
      const stored = await AsyncStorage.getItem('ecotrack_user');
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load user', e);
    } finally {
      setIsLoading(false);
    }
  }

  async function login(email: string, _password: string): Promise<boolean> {
    try {
      const stored = await AsyncStorage.getItem('ecotrack_users');
      const users: UserData[] = stored ? JSON.parse(stored) : [];
      const found = users.find((u) => u.email === email);
      if (found) {
        setUser(found);
        await AsyncStorage.setItem('ecotrack_user', JSON.stringify(found));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  async function signup(name: string, email: string, institution: string, _password: string): Promise<boolean> {
    try {
      const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      const newUser: UserData = {
        id,
        name,
        email,
        institution,
        totalCashback: 0,
        totalReports: 0,
        solvedReports: 0,
        certificates: 0,
        joinedDate: new Date().toISOString(),
      };
      const stored = await AsyncStorage.getItem('ecotrack_users');
      const users: UserData[] = stored ? JSON.parse(stored) : [];
      users.push(newUser);
      await AsyncStorage.setItem('ecotrack_users', JSON.stringify(users));
      setUser(newUser);
      await AsyncStorage.setItem('ecotrack_user', JSON.stringify(newUser));
      return true;
    } catch {
      return false;
    }
  }

  async function logout() {
    setUser(null);
    await AsyncStorage.removeItem('ecotrack_user');
  }

  async function updateUser(data: Partial<UserData>) {
    if (!user) return;
    const updated = { ...user, ...data };
    setUser(updated);
    await AsyncStorage.setItem('ecotrack_user', JSON.stringify(updated));
    const stored = await AsyncStorage.getItem('ecotrack_users');
    const users: UserData[] = stored ? JSON.parse(stored) : [];
    const idx = users.findIndex((u) => u.id === user.id);
    if (idx >= 0) {
      users[idx] = updated;
      await AsyncStorage.setItem('ecotrack_users', JSON.stringify(users));
    }
  }

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      login,
      signup,
      logout,
      updateUser,
    }),
    [user, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
