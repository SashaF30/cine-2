import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import PeliculasScreen from './screens/PeliculasScreen.jsx';
import PeliculaDetalle from './screens/PeliculaDetalle.jsx';
import LoginScreen from './screens/LoginScreen.jsx';
import { useAuth } from './context/AuthContext.jsx';

export default function App() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const onLogout = () => { logout(); navigate('/'); };

  return (
    <div className="page">
      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 10,
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(6px)',
        background: 'linear-gradient(180deg,rgba(10,20,45,0.8),rgba(10,20,45,0.6))'
      }}>
        <div className="inner navbar" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64
        }}>
          <Link to="/" style={{ fontWeight: 800, fontSize: 20, letterSpacing: 0.4 }}>🎬 Cine AR</Link>

          <nav style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {user ? (
              <>
                <span style={{ opacity: 0.8, fontSize: 14 }}>Hola, {user.username}</span>
                <button
                  onClick={onLogout}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 10,
                    border: '1px solid #1f2a44',
                    background: '#12204a',
                    color: '#fff',
                    cursor: 'pointer'
                  }}
                >
                  Cerrar sesión
                </button>
              </>
            ) : (
              <Link to="/login">Iniciar sesión</Link>
            )}
          </nav>
        </div>
      </header>

      {/* Main */}
      <main className="page-main">
        <div className="inner">
          <Routes>
            <Route path="/" element={<PeliculasScreen />} />
            <Route path="/pelicula/:id" element={<PeliculaDetalle />} />
            <Route path="/login" element={<LoginScreen />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
