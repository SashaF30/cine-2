import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function LoginScreen() {
  const { loginLocal } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const from = location.state?.from || '/';

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (!email.trim()) return setError('Ingresá tu email');
    if (!password.trim()) return setError('Ingresá tu contraseña');

    setLoading(true);
    try {
      // Llama al backend: POST /api/login { email, password }
      const r = await api.login({ email, password });
      // Esperamos algo como: { ok:true, data:{ id, email, nombre, token? } }
      loginLocal(r.data);
      navigate(from, { replace: true });
    } catch (e) {
      setError(e.message || 'No se pudo iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={outer()}>
      <div style={card()}>
        <div style={brand()}>
          <div style={{ fontWeight: 800, fontSize: 22 }}>Cine AR</div>
          <div style={{ opacity: 0.7, fontSize: 14 }}>Iniciar sesión</div>
        </div>

        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
          <label style={label()}>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tucorreo@ejemplo.com"
              autoComplete="email"
              style={input()}
            />
          </label>

          <label style={label()}>
            <span>Contraseña</span>
            <div style={{ position: 'relative' }}>
              <input
                type={show ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                style={{ ...input(), paddingRight: 44 }}
              />
              <button
                type="button"
                onClick={() => setShow(s => !s)}
                style={eyeBtn()}
                aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {show ? '🙈' : '👁️'}
              </button>
            </div>
          </label>

          {error && <div style={{ color: 'salmon', fontSize: 14 }}>{error}</div>}

          <button type="submit" disabled={loading} style={submitBtn(loading)}>
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>

          <div style={{ fontSize: 12, opacity: 0.7, textAlign: 'center' }}>
            * Esta versión usa sesión local. Cuando agreguemos JWT/cookies, esto quedará transparente.
          </div>
        </form>
      </div>
    </div>
  );
}

/* ==== estilos inline responsivos ==== */
const outer = () => ({
  minHeight: 'calc(100vh - 64px)',
  display: 'grid',
  placeItems: 'center',
  padding: 16,
});

const card = () => ({
  width: '100%',
  maxWidth: 420,
  background: '#0f1830',
  border: '1px solid #1f2a44',
  borderRadius: 16,
  padding: 20,
  boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
});

const brand = () => ({
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  marginBottom: 12,
  textAlign: 'center',
});

const label = () => ({
  display: 'grid',
  gap: 6,
  fontSize: 14,
});

const input = () => ({
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid #1f2a44',
  background: '#121c3a',
  color: '#fff',
  outline: 'none',
  width: '100%',
});

const eyeBtn = () => ({
  position: 'absolute',
  right: 6,
  top: '50%',
  transform: 'translateY(-50%)',
  padding: '6px 8px',
  borderRadius: 8,
  border: '1px solid #1f2a44',
  background: '#12204a',
  color: '#fff',
  cursor: 'pointer',
});

const submitBtn = (loading) => ({
  marginTop: 4,
  padding: '10px 12px',
  borderRadius: 12,
  border: '1px solid #1f2a44',
  background: loading ? '#1a2650aa' : '#1a2650',
  color: '#fff',
  cursor: loading ? 'default' : 'pointer',
  width: '100%',
  fontWeight: 600,
});
