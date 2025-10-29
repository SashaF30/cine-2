import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'

export default function PeliculasScreen() {
  const [pelis, setPelis] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    (async () => {
      try {
        const r = await api.getPeliculas()
        setPelis(r.data || [])
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  if (loading) return <div>Cargando…</div>
  if (error) return <div style={{ color: 'salmon' }}>{error}</div>

  return (
    <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
      {pelis.map(p => (
        <Link key={p.id} to={`/pelicula/${p.id}`} style={{ textDecoration: 'none', color: '#fff' }}>
          <div style={{ background: '#0f1830', border: '1px solid #1f2a44', borderRadius: 12, overflow: 'hidden' }}>
            {p.poster_url ? (
              <img
                src={p.poster_url}
                alt={p.titulo}
                style={{ width: '100%', height: 260, objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#12204a' }}>
                🎬
              </div>
            )}
            <div style={{ padding: 12, fontWeight: 600 }}>{p.titulo}</div>
          </div>
        </Link>
      ))}
    </div>
  )
}
