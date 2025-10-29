import { Routes, Route, Link } from 'react-router-dom'
import PeliculasScreen from './screens/PeliculasScreen.jsx'
import PeliculaDetalle from './screens/PeliculaDetalle.jsx'

export default function App() {
  return (
    <div style={{ minHeight: '100vh', background: '#0b1220', color: '#fff' }}>
      <header style={{ padding: '12px 16px', borderBottom: '1px solid #1f2a44' }}>
        <Link to="/" style={{ color: '#fff', textDecoration: 'none', fontWeight: 700 }}>
          Cine AR
        </Link>
      </header>
      <main style={{ padding: 16, maxWidth: 1200, margin: '0 auto' }}>
        <Routes>
          <Route path="/" element={<PeliculasScreen />} />
          <Route path="/pelicula/:id" element={<PeliculaDetalle />} />
        </Routes>
      </main>
    </div>
  )
}
