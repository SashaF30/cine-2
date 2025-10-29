import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  getPeliculaRichById,
  getFuncionesByPelicula,
  postReserva,
} from "../api";
import { useAuth } from "../context/AuthContext";

export default function PeliculaDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, token } = useAuth();

  const [pelicula, setPelicula] = useState(null);
  const [funciones, setFunciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [funcionSel, setFuncionSel] = useState(null);
  const [cantidad, setCantidad] = useState(1);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErrorMsg("");

    Promise.all([getPeliculaRichById(id), getFuncionesByPelicula(id)])
      .then(([peli, funs]) => {
        if (!alive) return;
        setPelicula(peli);
        setFunciones(Array.isArray(funs) ? funs : []);
      })
      .catch((e) => {
        if (!alive) return;
        setErrorMsg(e?.message || "No se pudo cargar la información.");
      })
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, [id]);

  const poster = useMemo(() => {
    return (
      pelicula?.poster_url ||
      pelicula?.posterUrl ||
      pelicula?.poster ||
      pelicula?.imagen ||
      ""
    );
  }, [pelicula]);

  const titulo =
    pelicula?.titulo ?? pelicula?.nombre ?? pelicula?.title ?? "Sin título";
  const duracion = pelicula?.duracion ? `${pelicula.duracion} min` : null;
  const sinopsis =
    pelicula?.sinopsis ?? pelicula?.descripcion ?? pelicula?.overview ?? "";

  function requireLogin() {
    navigate("/login", { state: { from: location.pathname } });
  }

  async function handleReservar() {
    setErrorMsg("");

    if (!user || !token) {
      requireLogin();
      return;
    }
    if (!funcionSel) {
      setErrorMsg("Elegí una función antes de reservar.");
      return;
    }
    if (!cantidad || cantidad < 1) {
      setErrorMsg("La cantidad debe ser al menos 1.");
      return;
    }

    try {
      setSaving(true);

      // si tu back toma el usuario del JWT, dejalo false
      const NEED_USER_ID_IN_BODY = false;

      const idFuncion =
        funcionSel?.id ??
        funcionSel?.id_funcion ??
        funcionSel?.funcion_id ??
        funcionSel;

      const reserva = await postReserva(
        {
          idPelicula: id,
          idFuncion,
          cantidad: Number(cantidad),
        },
        token,
        NEED_USER_ID_IN_BODY ? user?.id : undefined
      );

      const idSala =
        funcionSel?.id_sala ?? funcionSel?.sala_id ?? funcionSel?.idSala ?? null;

      navigate(
        `/reserva/${reserva.id || reserva.id_reserva || reserva.reservaId}`,
        {
          state: {
            from: location.pathname,
            idSala,
            cantidad: Number(cantidad),
          },
          replace: true,
        }
      );
    } catch (e) {
      if (e?.status === 401) {
        setErrorMsg(
          "El servidor no aceptó la sesión (401). Podés reintentar o iniciar sesión nuevamente."
        );
      } else {
        setErrorMsg(e?.message || "No se pudo crear la reserva.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="inner" style={{ maxWidth: 1100, margin: "0 auto" }}>
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 12,
          alignItems: "center",
        }}
      >
        <button className="btn" onClick={() => navigate(-1)}>
          ← Volver
        </button>

        {user ? (
          <button className="btn" onClick={() => navigate("/")}>
            Hola, <b style={{ marginLeft: 6 }}>{user.nombre ?? user.email}</b>
          </button>
        ) : (
          <button className="btn btn-primary" onClick={requireLogin}>
            Iniciar sesión
          </button>
        )}
      </div>

      {/* Contenido */}
      {loading ? (
        <div className="detail-grid">
          <div
            className="skeleton"
            style={{ aspectRatio: "2 / 3", borderRadius: 16 }}
          />
          <div>
            <div
              className="skeleton"
              style={{
                height: 28,
                width: "60%",
                borderRadius: 12,
                marginBottom: 12,
              }}
            />
            <div
              className="skeleton"
              style={{ height: 16, width: "30%", borderRadius: 12 }}
            />
            <div
              className="skeleton"
              style={{
                height: 120,
                width: "100%",
                borderRadius: 12,
                marginTop: 16,
              }}
            />
          </div>
        </div>
      ) : pelicula ? (
        <div className="detail-grid">
          {/* Poster */}
          <div>
            {poster ? (
              <img src={poster} alt={titulo} className="poster-lg" />
            ) : (
              <div
                className="poster center"
                style={{ borderRadius: 16, fontSize: 48 }}
              >
                🎬
              </div>
            )}
          </div>

          {/* Info */}
          <div>
            <h1 className="h1" style={{ marginBottom: 6 }}>
              {titulo}
            </h1>
            {duracion && (
              <div className="muted" style={{ marginBottom: 10 }}>
                {duracion}
              </div>
            )}

            {/* Sinopsis (ahora sí) */}
            {sinopsis && (
              <div
                className="card"
                style={{
                  padding: 14,
                  marginTop: 8,
                  marginBottom: 12,
                }}
              >
                <div className="title" style={{ fontSize: 16, marginBottom: 6 }}>
                  Sinopsis
                </div>
                <div
                  style={{
                    color: "rgba(238,242,255,0.9)",
                    lineHeight: 1.55,
                    whiteSpace: "pre-line",
                  }}
                >
                  {sinopsis}
                </div>
              </div>
            )}

            {/* Funciones */}
            <div style={{ marginTop: 14 }}>
              <div className="title" style={{ marginBottom: 8, fontSize: 16 }}>
                Funciones
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {funciones.length === 0 && (
                  <div className="muted">No hay funciones disponibles.</div>
                )}
                {funciones.map((f) => {
                  const idF = f.id ?? f.id_funcion ?? f.funcion_id;
                  const label =
                    f.inicio_fmt || f.inicio || f.horario || `Función ${idF}`;
                  const selected =
                    (funcionSel?.id ??
                      funcionSel?.id_funcion ??
                      funcionSel?.funcion_id) === idF;
                  return (
                    <button
                      key={idF}
                      className="btn"
                      onClick={() => setFuncionSel(f)}
                      style={
                        selected
                          ? {
                              background: "#fff",
                              color: "#0b1225",
                              borderColor: "#fff",
                            }
                          : undefined
                      }
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cantidad */}
            <div
              style={{
                marginTop: 14,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <label className="muted">Entradas:</label>
              <input
                type="number"
                min={1}
                value={cantidad}
                onChange={(e) =>
                  setCantidad(parseInt(e.target.value || "1", 10))
                }
                className="search"
                style={{ width: 120, maxWidth: "40vw" }}
              />
            </div>

            {/* Acciones */}
            <div
              style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}
            >
              <button
                className="btn btn-primary"
                onClick={handleReservar}
                disabled={saving}
              >
                {saving ? "Creando reserva..." : "Reservar"}
              </button>

              {!user && (
                <button className="btn" onClick={requireLogin}>
                  Iniciar sesión para reservar
                </button>
              )}
            </div>

            {/* Error */}
            {errorMsg && (
              <div
                className="card"
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderColor: "rgba(248,113,113,0.35)",
                  background: "rgba(127,29,29,0.25)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <span>{errorMsg}</span>
                  {!user && (
                    <button className="btn" onClick={requireLogin}>
                      Iniciar sesión
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="center" style={{ height: 180 }}>
          <div className="muted">Película no encontrada.</div>
        </div>
      )}
    </div>
  );
}
