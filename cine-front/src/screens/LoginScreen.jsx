import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    const mail = email.trim();
    const pass = password;
    if (!mail || !pass) {
      setErr("Email y contraseña requeridos");
      return;
    }
    setLoading(true);
    try {
      const r = await login({ email: mail, password: pass });
      if (!r?.ok) {
        setErr(r?.error || "Credenciales inválidas");
      } else {
        const to = (loc.state && loc.state.from) || "/";
        nav(to, { replace: true });
      }
    } catch (e2) {
      setErr(e2?.message || "Error interno");
    } finally {
      setLoading(false);
    }
  }

  // Si ya estás autenticado, redirigí
  if (isAuthenticated) {
    nav("/", { replace: true });
    return null;
  }

  return (
    <div className="page auth-page">
      <form className="card auth-card" onSubmit={onSubmit}>
        <h2 className="auth-title">Iniciar sesión</h2>
        <p className="muted" style={{ marginTop: -6 }}>Ingresá tus credenciales para continuar.</p>

        <label className="label">Usuario</label>
        <input
          className="input"
          type="email"
          placeholder="admin@cine.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
        />

        <label className="label" style={{ marginTop: 10 }}>Contraseña</label>
        <input
          className="input"
          type="password"
          placeholder="••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />

        {err && (
          <div className="alert error" role="alert">
            {err}
          </div>
        )}

        <button className="btn primary" type="submit" disabled={loading}>
          {loading ? "Ingresando…" : "Ingresar"}
        </button>
      </form>
    </div>
  );
}
