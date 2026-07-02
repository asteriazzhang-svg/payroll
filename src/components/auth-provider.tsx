'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

export interface CurrentUser {
  id: string;
  username: string;
  role: 'ADMIN' | 'EMPLOYEE';
  employeeId: string | null;
  employeeName: string | null;
  department: string | null;
  mustChangePwd: boolean;
}

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const HARDCODED_ADMIN: CurrentUser = {
  id: 'cm_admin',
  username: 'admin',
  role: 'ADMIN',
  employeeId: null,
  employeeName: '管理员',
  department: null,
  mustChangePwd: false,
};

const AuthContext = createContext<AuthContextValue>({
  user: HARDCODED_ADMIN,
  loading: false,
  refresh: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user] = useState<CurrentUser | null>(HARDCODED_ADMIN);
  const [loading] = useState(false);

  const refresh = useCallback(async () => {}, []);

  const logout = useCallback(async () => {
    window.location.href = '/login';
  }, []);

  useEffect(() => {
    // Auth bypassed — admin is always logged in.
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
