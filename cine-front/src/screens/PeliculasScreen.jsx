import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

/** Normaliza para comparar por “primeras letras” sin acentos */
const norm = (s = '') =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();

export default function PeliculasScreen() {
  const [pelis, setPelis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const r = await api.getPeliculas();
        setPelis(r.data || []);
      } catch (e) {
        setError(e?.message || 'No se pudieron cargar las películas.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtradas = useMemo(() => {
    if (!q) return pelis;
    const nq = norm(q);
    return pelis.filter(p => norm(p.titulo || p.nombre || '').startsWith(nq));
  }, [pelis, q]);

  if (loading) {
    return <section className="center-grid"><div>Cargando…</div></section>;
  }
  if (error) {
    return <section className="center-grid"><div style={{ opacity: 0.85 }}>{error}</div></section>;
  }

  return (
    <section>
      <div className="search-row">
        <input
          className="search-input"
          placeholder="Buscar por título (primeras letras)…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="grid-pelis">
        {filtradas.map((p) => (
          <Link key={p.id} to={`/pelicula/${p.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <article className="card">
              {p.poster_url ? (
                <img className="card-poster" src={p.poster_url} alt={p.titulo || p.nombre || 'Póster'} />
              ) : (
                <div className="card-poster" style={{
                  display: 'grid', placeItems: 'center', background: '#0f1b36', color: '#9fb2e0'
                }}>
                  🎞️
                </div>
              )}
              <div className="card-body">
                <div style={{ fontWeight: 700, lineHeight: 1.2, fontSize: 16 }}>
                  {p.titulo || p.nombre}
                </div>
                {p.duracion && (
                  <div style={{ opacity: 0.8, fontSize: 13, marginTop: 4 }}>
                    {p.duracion} min
                  </div>
                )}
              </div>
            </article>
          </Link>
        ))}
      </div>

      {/* Reserva espacio para que no se mueva la grilla si no hay resultados */}
      {filtradas.length === 0 && (
        <div className="empty-hint-wrap">
          <div className="empty-hint">
            No hay películas que comiencen con “{q}”.
          </div>
        </div>
      )}
    </section>
  );
}
