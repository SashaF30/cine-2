import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../api";

const AuthCtx = createContext(null);
const LS_KEY = "cine_auth_v1";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // hidratar desde localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.token) {
          setToken(parsed.token);
          setUser(parsed.user || null);
        }
      }
    } catch {}
    setLoading(false);
  }, []);

  // persistir cambios
  useEffect(() => {
    try {
      if (token && user) {
        localStorage.setItem(LS_KEY, JSON.stringify({ token, user }));
      } else {
        localStorage.removeItem(LS_KEY);
      }
    } catch {}
  }, [token, user]);

  // validar token (opcional, si querés refrescar user)
  useEffect(() => {
    let cancel = false;
    async function check() {
      if (!token) return;
      try {
        const r = await api.me(token);
        if (!cancel && r?.ok && r?.user) {
          setUser(r.user);
        }
      } catch {
        // token inválido => limpiar
        if (!cancel) {
          setUser(null);
          setToken(null);
        }
      }
    }
    check();
    return () => { cancel = true; };
  }, [token]);

  async function login({ email, password }) {
    const r = await api.login({ email, password }); // normalizado en api.js
    if (r?.ok && r?.token && r?.data) {
      setUser(r.data);
      setToken(r.token);
      return { ok: true };
    }
    const message =
      r?.error || r?.message || "No se pudo iniciar sesión";
    return { ok: false, error: message };
  }

  function logout() {
    try {
      localStorage.removeItem(LS_KEY);
    } catch {}
    setUser(null);
    setToken(null);
  }

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      isAuthenticated: !!user && !!token,
      login,
      logout,
    }),
    [user, token, loading]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  return useContext(AuthCtx);
}
