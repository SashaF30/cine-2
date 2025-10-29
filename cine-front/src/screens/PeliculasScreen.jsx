import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getPeliculas } from "../api";
import { useAuth } from "../context/AuthContext";

function norm(s = "") {
  return String(s).toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

export default function PeliculasScreen() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // 👇 sesión directa (sin componente externo)
  const { user, isAuthenticated, logout } = useAuth();

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr("");
    getPeliculas()
      .then((list) => alive && setItems(Array.isArray(list) ? list : []))
      .catch((e) => alive && setErr(e?.message || "No se pudieron cargar las películas."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const n = norm(q);
    if (!n) return items;
    return items.filter((p) =>
      norm(p.titulo ?? p.nombre ?? p.title ?? "").startsWith(n)
    );
  }, [items, q]);

  return (
    <div className="page page-peliculas">
      {/* Header: título + buscador + sesión */}
      <div
        className="page-header"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <h1 className="page-title" style={{ margin: 0 }}>
          Películas
        </h1>

        <div
          className="toolbar"
          style={{ display: "flex", alignItems: "center", gap: 12 }}
        >
          {/* Buscador */}
          <input
            className="search-input"
            type="search"
            placeholder="Buscar por inicio del título…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoComplete="off"
            style={{
              height: 34,
              padding: "6px 10px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(0,0,0,0.2)",
              color: "inherit",
              minWidth: 220,
            }}
          />

          {/* Controles de sesión inline */}
          {!isAuthenticated ? (
            <Link to="/login" className="btn btn-primary">
              Iniciar sesión
            </Link>
          ) : (
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <span style={{ color: "#cbd5e1", fontWeight: 600 }}>
                Hola, {user?.nombre || user?.email}
              </span>
              <button
                type="button"
                onClick={logout}
                className="btn btn-outline"
                style={{ cursor: "pointer" }}
                title="Cerrar sesión"
              >
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {err && !loading && (
        <div
          className="card"
          style={{
            padding: 14,
            borderColor: "rgba(248,113,113,0.35)",
            background: "rgba(127,29,29,0.25)",
            marginTop: 12,
          }}
        >
          {err}
        </div>
      )}

      {/* Grid */}
      <div style={{ marginTop: 16 }}>
        {loading ? (
          <div className="grid-cards">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="card">
                <div className="poster skeleton" />
                <div className="card-body">
                  <div
                    className="skeleton"
                    style={{ height: 18, width: "75%", marginBottom: 8 }}
                  />
                  <div className="skeleton" style={{ height: 14, width: "35%" }} />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid-cards">
            {filtered.map((p) => {
              const id = p.id ?? p.id_pelicula ?? p.pelicula_id;
              const title = p.titulo ?? p.nombre ?? p.title ?? "Sin título";
              const poster =
                p.poster_url ?? p.posterUrl ?? p.poster ?? p.imagen ?? "";
              const dur = p.duracion ? `${p.duracion} min` : null;

              return (
                <Link key={id} to={`/pelicula/${id}`} className="card">
                  {poster ? (
                    <img src={poster} alt={title} className="poster" />
                  ) : (
                    <div className="poster center" style={{ fontSize: 42 }}>
                      🎬
                    </div>
                  )}
                  <div className="card-body">
                    <div className="title line-clamp-2">{title}</div>
                    {dur && <div className="muted" style={{ marginTop: 4 }}>{dur}</div>}
                    <div style={{ marginTop: 10 }}>
                      <span className="btn">Ver detalle ➜</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="center" style={{ height: 240 }}>
            <div className="muted">
              No hay películas que comiencen con “{q}”.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
