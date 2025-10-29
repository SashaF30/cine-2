// src/screens/PaySimScreen.jsx
import { useNavigate, useParams } from "react-router-dom";
import { useState } from "react";

export default function PaySimScreen() {
  const { id } = useParams(); // id de la reserva
  const navigate = useNavigate();
  const [paying, setPaying] = useState(false);

  async function confirmarPago() {
    // Simulación: podrías llamar a /api/pagos si existiera.
    setPaying(true);
    await new Promise((r) => setTimeout(r, 800));
    alert("¡Pago simulado con éxito! 🎟️");
    navigate("/", { replace: true });
  }

  return (
    <div className="inner max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-3">Pago de tu reserva</h1>
      <div className="opacity-70 mb-4">Reserva #{id}</div>

      <div className="rounded-2xl border border-white/40 bg-white/90 shadow p-4">
        <div className="font-semibold mb-2">Métodos de pago</div>
        <div className="space-y-2">
          <div className="rounded-lg border p-3">💳 Tarjeta de crédito</div>
          <div className="rounded-lg border p-3">💳 Tarjeta de débito</div>
          <div className="rounded-lg border p-3">🏦 Transferencia</div>
          <div className="rounded-lg border p-3">💸 Efectivo (simulado)</div>
        </div>

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
            onClick={confirmarPago}
            disabled={paying}
            className="px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {paying ? "Procesando…" : "Confirmar pago"}
          </button>
        </div>
      </div>
    </div>
  );
}
