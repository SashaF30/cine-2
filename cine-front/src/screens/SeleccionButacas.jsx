// src/screens/SeleccionButacas.jsx
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getButacasSala, postReservaButacas, getReservaById } from "../api";
import { useAuth } from "../context/AuthContext";

export default function SeleccionButacas() {
  const { id: idReservaParam } = useParams(); // id de la reserva
  const location = useLocation();
  const navigate = useNavigate();
  const { token } = useAuth();

  // state opcional pasado desde PeliculaDetalle
  const stateIdSala = location.state?.idSala ?? null;
  const stateCantidad = Number(location.state?.cantidad ?? 1);

  const [idSala, setIdSala] = useState(stateIdSala);
  const [cantidad, setCantidad] = useState(stateCantidad);
  const [butacas, setButacas] = useState([]); // lista raw del back
  const [sel, setSel] = useState([]); // ids de butacas seleccionadas
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const idReserva = useMemo(
    () => Number(idReservaParam) || idReservaParam,
    [idReservaParam]
  );

  // Si no vino idSala por state, intentamos obtenerlo desde la reserva
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setErr("");
        if (!idSala) {
          const r = await getReservaById(idReserva, token);
          const sala =
            r?.id_sala ?? r?.sala_id ?? r?.funcion?.id_sala ?? r?.funcion?.sala_id;
          if (alive) setIdSala(sala || null);
          // Si tu back también devuelve cantidad, la usamos
          const cant =
            r?.cantidad ?? r?.qty ?? r?.entradas ?? stateCantidad ?? 1;
          if (alive) setCantidad(Number(cant) || 1);
        }
      } catch (e) {
        if (alive) setErr(e?.message || "No se pudo obtener la reserva.");
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idReserva, token]);

  // Cargar butacas de la sala
  useEffect(() => {
    if (!idSala) return;
    let alive = true;
    setLoading(true);
    setErr("");
    getButacasSala(idSala)
      .then((data) => {
        if (!alive) return;
        setButacas(Array.isArray(data) ? data : []);
      })
      .catch((e) => {
        if (!alive) return;
        setErr(e?.message || "No se pudieron cargar las butacas.");
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [idSala]);

  function toggleButaca(b) {
    if (b.ocupada || b.estado === "ocupada") return;

    const idB = b.id ?? b.id_butaca ?? `${b.fila}-${b.numero}`;
    const exists = sel.includes(idB);

    if (!exists && sel.length >= cantidad) return; // límite

    setSel((prev) =>
      exists ? prev.filter((x) => x !== idB) : [...prev, idB]
    );
  }

  async function confirmar() {
    if (sel.length !== Number(cantidad)) {
      setErr(`Debes seleccionar exactamente ${cantidad} butaca(s).`);
      return;
    }
    try {
      setSaving(true);
      await postReservaButacas(idReserva, sel, token);
      navigate(`/pago/${idReserva}`, { replace: true });
    } catch (e) {
      setErr(e?.message || "No se pudieron registrar las butacas.");
    } finally {
      setSaving(false);
    }
  }

  // Construimos grilla simple agrupando por fila (si viene info)
  const filas = useMemo(() => {
    const byRow = new Map();
    for (const b of butacas) {
      const row = b.fila ?? b.row ?? "Única";
      if (!byRow.has(row)) byRow.set(row, []);
      byRow.get(row).push(b);
    }
    // ordenar por número si existe
    for (const [k, arr] of byRow) {
      arr.sort((a, z) => (a.numero ?? 0) - (z.numero ?? 0));
      byRow.set(k, arr);
    }
    return Array.from(byRow.entries()).sort(([a], [z]) =>
      String(a).localeCompare(String(z))
    );
  }, [butacas]);

  if (!idSala && !loading) {
    return (
      <div className="inner max-w-3xl mx-auto">
        <div className="text-red-600">
          No se pudo determinar la sala de la reserva.
        </div>
      </div>
    );
  }

  return (
    <div className="inner max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-3">Seleccioná tus butacas</h1>
      <div className="opacity-70 mb-2">
        Reserva #{idReserva} — Sala {idSala ?? "?"} — Cantidad: {cantidad}
      </div>

      {loading ? (
        <div className="opacity-70">Cargando butacas…</div>
      ) : (
        <>
          {filas.length === 0 ? (
            <div className="opacity-70">No hay datos de butacas.</div>
          ) : (
            <div className="space-y-4">
              {filas.map(([rowName, items]) => (
                <div key={rowName}>
                  <div className="mb-1 font-medium">Fila {rowName}</div>
                  <div className="grid grid-cols-8 gap-2">
                    {items.map((b) => {
                      const idB =
                        b.id ?? b.id_butaca ?? `${b.fila}-${b.numero}`;
                      const isTaken =
                        b.ocupada || b.estado === "ocupada" || b.taken === true;
                      const isSel = sel.includes(idB);
                      return (
                        <button
                          key={idB}
                          type="button"
                          onClick={() => toggleButaca(b)}
                          disabled={isTaken}
                          className={[
                            "h-10 rounded-md border text-sm",
                            isTaken
                              ? "bg-gray-300 border-gray-300 cursor-not-allowed"
                              : isSel
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-white border-gray-300 hover:bg-gray-50",
                          ].join(" ")}
                          title={`Fila ${b.fila ?? "?"} - N° ${b.numero ?? "?"}`}
                        >
                          {b.numero ?? "•"}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {err && <div className="mt-3 text-red-600 text-sm">{err}</div>}

      <div className="mt-5 flex gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="px-4 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50"
        >
          Volver
        </button>
        <button
          type="button"
          onClick={confirmar}
          disabled={saving || sel.length !== Number(cantidad)}
          className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? "Confirmando…" : `Confirmar (${sel.length}/${cantidad})`}
        </button>
      </div>
    </div>
  );
}
