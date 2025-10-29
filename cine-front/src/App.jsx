import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import PeliculasScreen from './screens/PeliculasScreen.jsx';
import PeliculaDetalle from './screens/PeliculaDetalle.jsx';
import LoginScreen from './screens/LoginScreen.jsx';
import { useAuth } from './context/AuthContext.jsx';

export default function App() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const onLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0b1220', color: '#fff' }}>
      <header style={{
        padding: '12px 16px',
        borderBottom: '1px solid #1f2a44',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap'
      }}>
        <Link to="/" style={{ color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: 18 }}>
          Cine AR
        </Link>

        <nav style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {user ? (
            <>
              <span style={{ opacity: 0.85, fontSize: 14 }}>Hola, {user.nombre || user.email}</span>
              <button
                onClick={onLogout}
                style={{
                  padding: '8px 12px', borderRadius: 8, border: '1px solid #1f2a44',
                  background: '#121c3a', color: '#fff', cursor: 'pointer'
                }}
              >
                Cerrar sesión
              </button>
            </>
          ) : (
            <Link
              to="/login"
              style={{
                padding: '8px 12px', borderRadius: 8, border: '1px solid #1f2a44',
                background: '#121c3a', color: '#fff', textDecoration: 'none'
              }}
            >
              Iniciar sesión
            </Link>
          )}
        </nav>
      </header>

      <main style={{ padding: 16, maxWidth: 1200, margin: '0 auto' }}>
        <Routes>
          <Route path="/" element={<PeliculasScreen />} />
          <Route path="/pelicula/:id" element={<PeliculaDetalle />} />
          <Route path="/login" element={<LoginScreen />} />
        </Routes>
      </main>
    </div>
  );
}
