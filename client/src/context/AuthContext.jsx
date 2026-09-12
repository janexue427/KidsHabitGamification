import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [family, setFamily] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setFamily(null);
      setLoading(false);
      return;
    }
    try {
      const data = await api.get('/auth/me');
      setUser(data.user);
      setFamily(data.family);
    } catch {
      setToken(null);
      setUser(null);
      setFamily(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function login({ token, user, family }) {
    setToken(token);
    setUser(user);
    if (family) setFamily(family);
  }

  function logout() {
    setToken(null);
    setUser(null);
    setFamily(null);
  }

  function updateUser(patch) {
    setUser((u) => (u ? { ...u, ...patch } : u));
  }

  return (
    <AuthContext.Provider value={{ user, family, loading, login, logout, refresh, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
