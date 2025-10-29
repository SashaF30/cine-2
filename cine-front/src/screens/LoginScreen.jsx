// src/screens/LoginScreen.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function LoginScreen() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    setErr('');
    if (!username.trim() || !password.trim()) {
      setErr('Completá usuario y contraseña.');
      return;
    }
    setLoading(true);
    try {
      await login(username.trim(), password);
      // Volver a la home o a la anterior
      nav('/', { replace: true });
    } catch (e) {
      setErr(e?.message || 'Usuario o contraseña inválidos.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="center-grid">
      <form
        onSubmit={onSubmit}
        className="card"
        style={{ width: 'min(420px, 100%)', padding: 16 }}
      >
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Iniciar sesión</h1>
        <p style={{ opacity: 0.8, marginTop: 6, marginBottom: 16 }}>
          Ingresá tus credenciales para continuar.
        </p>

        <label style={{ display: 'block', fontSize: 13, opacity: 0.85, marginBottom: 6 }}>
          Usuario
        </label>
        <input
          className="search-input"
          placeholder="tu_usuario"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <div style={{ height: 10 }} />

        <label style={{ display: 'block', fontSize: 13, opacity: 0.85, marginBottom: 6 }}>
          Contraseña
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="search-input"
            placeholder="••••••••"
            type={showPass ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowPass(s => !s)}
            className="card"
            style={{
              padding: '0 12px',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10,
              cursor: 'pointer',
            }}
            title={showPass ? 'Ocultar' : 'Mostrar'}
          >
            {showPass ? '🙈' : '👀'}
          </button>
        </div>

        {err && (
          <div
            className="card"
            style={{
              marginTop: 12,
              padding: 10,
              border: '1px solid rgba(255,100,100,0.35)',
              background: 'rgba(200,40,40,0.14)',
              color: '#ffd7d7',
            }}
          >
            {err}
          </div>
        )}

        <div style={{ height: 14 }} />

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px 14px',
            borderRadius: 12,
            border: '1px solid #1f2a44',
            background: loading ? '#0f1b36' : '#12204a',
            color: '#fff',
            cursor: loading ? 'default' : 'pointer',
            fontWeight: 700,
          }}
        >
          {loading ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
    </section>
  );
}
