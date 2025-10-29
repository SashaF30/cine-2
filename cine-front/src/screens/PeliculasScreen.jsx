import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  const { user, logout } = useAuth?.() ?? { user: null, logout: null };
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr("");
    getPeliculas()
      .then((list) => alive && setItems(Array.isArray(list) ? list : []))
      .catch((e) => alive && setErr(e?.message || "No se pudieron cargar las películas."))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    const n = norm(q);
    if (!n) return items;
    return items.filter((p) => norm(p.titulo ?? p.nombre ?? p.title ?? "").startsWith(n));
  }, [items, q]);

  function onLoginClick() {
    navigate("/login");
  }
  function onLogoutClick() {
    if (typeof logout === "function") logout();
    else {
      // fallback defensivo por si el contexto no expone logout
      try { localStorage.clear(); } catch {}
      location.reload();
    }
  }

  return (
    <div className="inner" style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* Topbar */}
      <div className="topbar">
        <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
          <h1 className="h1">Cartelera</h1>
          <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0, flex: 1, justifyContent: "flex-end" }}>
            <div style={{ width: "100%", maxWidth: 420 }}>
              <input
                className="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por título (primeras letras)…"
              />
            </div>
            {user ? (
              <button className="btn" onClick={onLogoutClick} title="Cerrar sesión">
                Cerrar sesión
              </button>
            ) : (
              <button className="btn btn-primary" onClick={onLoginClick} title="Iniciar sesión">
                Iniciar sesión
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error */}
      {err && !loading && (
        <div className="card" style={{ padding: 14, borderColor: "rgba(248,113,113,0.35)", background: "rgba(127,29,29,0.25)", marginTop: 12 }}>
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
                  <div className="skeleton" style={{ height: 18, width: "75%", marginBottom: 8 }} />
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
              const poster = p.poster_url ?? p.posterUrl ?? p.poster ?? p.imagen ?? "";
              const dur = p.duracion ? `${p.duracion} min` : null;

              return (
                <Link key={id} to={`/pelicula/${id}`} className="card">
                  {poster ? (
                    <img src={poster} alt={title} className="poster" />
                  ) : (
                    <div className="poster center" style={{ fontSize: 42 }}>🎬</div>
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
            <div className="muted">No hay películas que comiencen con “{q}”.</div>
          </div>
        )}
      </div>
    </div>
  );
}
