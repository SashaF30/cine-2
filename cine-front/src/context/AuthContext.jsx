// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';

const AuthContext = createContext(null);
const LS_KEY = 'cine_auth_v1';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  // Restaurar sesión desde localStorage y validar opcionalmente con /api/me
  useEffect(() => {
    (async () => {
      try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.token) setToken(parsed.token);
          if (parsed?.user) setUser(parsed.user);
          // Verificación opcional del token en el back:
          if (parsed?.token) {
            try {
              const r = await api.me(parsed.token);
              if (r?.ok && r?.data) {
                // Si el back devuelve datos del usuario, los sincronizamos
                setUser((prev) => ({ ...prev, ...r.data }));
              }
            } catch {
              // Token inválido/expirado: limpiamos sesión
              setUser(null);
              setToken(null);
              localStorage.removeItem(LS_KEY);
            }
          }
        }
      } catch {
        // Ignorar errores de parseo y continuar
      } finally {
        setAuthReady(true);
      }
    })();
  }, []);

  // Persistir cambios de sesión
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ user, token }));
    } catch {
      // ignorar
    }
  }, [user, token]);

  // === Acciones ===
  async function login(email, password) {
    const r = await api.login({ email, password }); // { ok, data, token }
    if (!r?.ok) {
      throw new Error(r?.error || 'Credenciales inválidas');
    }
    setUser(r.data);
    setToken(r.token || null);
    return r.data;
  }

  function logout() {
    setUser(null);
    setToken(null);
    try { localStorage.removeItem(LS_KEY); } catch {}
  }

  const value = useMemo(() => ({
    user,
    token,
    authReady,
    login,
    logout,
  }), [user, token, authReady]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>.');
  return ctx;
}
