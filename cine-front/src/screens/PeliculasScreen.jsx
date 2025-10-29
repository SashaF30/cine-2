import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

export default function PeliculasScreen() {
  const [pelis, setPelis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState(''); // búsqueda

  useEffect(() => {
    (async () => {
      try {
        const r = await api.getPeliculas();
        setPelis(r.data || []);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtradas = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return pelis;
    return pelis.filter(p => (p.titulo || '').toLowerCase().startsWith(s));
  }, [pelis, q]);

  if (loading) return <div style={{ textAlign: 'center' }}>Cargando…</div>;
  if (error) return <div style={{ color: 'salmon', textAlign: 'center' }}>{error}</div>;

  return (
    <div style={{ width: 'min(1200px, 100%)', margin: '0 auto' }}>
      {/* Buscador */}
      <div style={{ marginBottom: 12, display: 'flex', gap: 8 }}>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Buscar película…"
          style={{
            flex: 1,
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid #1f2a44',
            background: '#121c3a',
            color: '#fff',
            outline: 'none'
          }}
        />
      </div>

      {/* Grilla */}
      <div
        style={{
          display: 'grid',
          gap: 16,
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          alignItems: 'start'
        }}
      >
        {filtradas.map(p => (
          <Link key={p.id} to={`/pelicula/${p.id}`} style={{ textDecoration: 'none', color: '#fff' }}>
            <div
              style={{
                background: '#0f1830',
                border: '1px solid #1f2a44',
                borderRadius: 14,
                overflow: 'hidden',
                transition: 'transform .15s ease'
              }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              {/* Imagen completa, sin recortes */}
              <div
                style={{
                  width: '100%',
                  aspectRatio: '16 / 9', // cambiá a '2 / 3' si querés póster vertical
                  background: '#0e1733',
                  display: 'grid',
                  placeItems: 'center'
                }}
              >
                {p.poster_url ? (
                  <img
                    src={p.poster_url}
                    alt={p.titulo}
                    style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }}
                  />
                ) : (
                  <div style={{ opacity: 0.6, fontSize: 42 }}>🎬</div>
                )}
              </div>

              <div style={{ padding: 12 }}>
                <div
                  title={p.titulo}
                  style={{
                    fontWeight: 700,
                    lineHeight: 1.2,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}
                >
                  {p.titulo}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Sin resultados */}
      {filtradas.length === 0 && (
        <div style={{ opacity: 0.8, textAlign: 'center', marginTop: 16 }}>
          No hay películas que comiencen con “{q}”.
        </div>
      )}
    </div>
  );
}
