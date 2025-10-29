import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getPeliculaRichById } from "../api";

export default function PeliculaDetalle() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr("");
    getPeliculaRichById(id)
      .then((d) => alive && setData(d))
      .catch((e) => alive && setErr(e?.message || "No se pudo cargar la película."))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [id]);

  if (loading) {
    return (
      <div className="page">
        <div className="card" style={{ padding: 16 }}>Cargando…</div>
      </div>
    );
  }

  if (err || !data) {
    return (
      <div className="page">
        <div className="card alert error">{err || "Película no encontrada"}</div>
        <div style={{ marginTop: 12 }}>
          <Link to="/" className="btn">Volver</Link>
        </div>
      </div>
    );
  }

  const { titulo, duracion, poster_url, sinopsis, funciones = [] } = data;

  return (
    <div className="page">
      <div className="card movie-hero">
        <div className="movie-hero__poster">
          {poster_url ? (
            <img src={poster_url} alt={titulo} />
          ) : (
            <div className="poster center">🎬</div>
          )}
        </div>
        <div className="movie-hero__body">
          <h2 style={{ marginTop: 0 }}>{titulo}</h2>
          {duracion ? <div className="muted" style={{ marginBottom: 8 }}>{duracion} min</div> : null}
          {sinopsis ? (
            <p className="synopsis">{sinopsis}</p>
          ) : (
            <p className="muted">Sin sinopsis.</p>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ marginTop: 0 }}>Funciones</h3>
        {funciones.length === 0 ? (
          <div className="muted">No hay funciones disponibles.</div>
        ) : (
          <ul className="funciones-grid">
            {funciones.map((f) => {
              const fecha = new Date(f.inicio);
              const hora = fecha.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
              return (
                <li key={f.id} className="card funcion-item">
                  <div><strong>{f.sala || "Sala"}</strong></div>
                  <div className="muted">{hora}</div>
                  {f.precio != null && <div className="precio">${Number(f.precio).toLocaleString("es-AR")}</div>}
                  {/* Botón para continuar flujo de reserva (a integrar luego) */}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <Link to="/" className="btn">Volver</Link>
      </div>
    </div>
  );
}
