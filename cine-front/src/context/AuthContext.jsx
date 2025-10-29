// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';

const AuthContext = createContext(null);
const LS_KEY = 'cine_auth_v1';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [ready, setReady] = useState(false);

  // Restaurar sesión desde localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.user) setUser(parsed.user);
        if (parsed?.token) setToken(parsed.token);
      }
    } catch { /* ignore */ }
    setReady(true);
  }, []);

  // Persistir
  useEffect(() => {
    const data = JSON.stringify({ user, token });
    localStorage.setItem(LS_KEY, data);
  }, [user, token]);

  async function login(username, password) {
    const { user: u, token: t } = await api.login({ username, password });
    setUser(u);
    setToken(t ?? null);
    return u;
  }

  function logout() {
    setUser(null);
    setToken(null);
    try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
  }

  const value = useMemo(() => ({
    user, token, authReady: ready, login, logout,
  }), [user, token, ready]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>.');
  return ctx;
}
