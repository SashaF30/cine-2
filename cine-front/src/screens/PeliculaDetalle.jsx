import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api.js'

export default function PeliculaDetalle() {
  const { id } = useParams()
  const [detalles, setDetalles] = useState([])
  const [funciones, setFunciones] = useState([])
  const [selFuncion, setSelFuncion] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [error, setError] = useState('')

  const peli = useMemo(() => (detalles.find(p => String(p.id) === String(id)) || null), [detalles, id])

  useEffect(() => {
    (async () => {
      try {
        const [d, f] = await Promise.all([
          api.getPeliculasDetalles(),
          api.getFunciones({ pelicula_id: id }),
        ])
        setDetalles(d.data || [])
        setFunciones(f.data || [])
      } catch (e) {
        setError(e.message)
      }
    })()
  }, [id])

  const reservar = async () => {
    setError(''); setMensaje('')
    if (!selFuncion) { setError('Elegí una función'); return }
    try {
      // ⚠️ id_usuario: para pruebas, usa uno existente (ajustar cuando tengas login)
      const demoUsuarioId = 1
      const r = await api.postReserva({ id_usuario: demoUsuarioId, id_funcion: Number(selFuncion), cantidad: 1 })
      setMensaje(`Reserva creada #${r.data.id} (pendiente, vence en ${r.data.vencimiento_min} min)`)
    } catch (e) {
      setError(e.message)
    }
  }

  if (error) return <div style={{ color: 'salmon' }}>{error}</div>
  if (!peli) return <div>Cargando…</div>

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 24 }}>
      <div>
        {peli.poster_url ? (
          <img src={peli.poster_url} alt={peli.titulo} style={{ width: '100%', borderRadius: 12, objectFit: 'cover' }} />
        ) : <div style={{ height: 360, background: '#12204a', borderRadius: 12 }} />}
      </div>
      <div>
        <h1 style={{ margin: 0 }}>{peli.titulo}</h1>
        <div style={{ opacity: 0.8, marginBottom: 12 }}>
          Duración: {peli.duracion ? `${peli.duracion} min` : 's/d'}
        </div>
        <p style={{ whiteSpace: 'pre-wrap' }}>{peli.sinopsis || 'Sin sinopsis'}</p>

        <div style={{ marginTop: 24 }}>
          <h3>Funciones</h3>
          <select
            value={selFuncion}
            onChange={e => setSelFuncion(e.target.value)}
            style={{ padding: 8, borderRadius: 8, background: '#0f1830', color: '#fff', border: '1px solid #1f2a44' }}
          >
            <option value="">Selecciona una función…</option>
            {funciones.map(f => (
              <option key={f.id} value={f.id}>
                {new Date(f.inicio).toLocaleString()} — {f.idioma} {f.formato} — ${Number(f.precio).toLocaleString('es-AR')}
              </option>
            ))}
          </select>

          <div style={{ marginTop: 12 }}>
            <button
              onClick={reservar}
              style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #1f2a44', background: '#1a2650', color: '#fff', cursor: 'pointer' }}
            >
              Crear reserva
            </button>
          </div>

          {mensaje && <div style={{ marginTop: 12, color: '#8ef5a7' }}>{mensaje}</div>}
          {error && !mensaje && <div style={{ marginTop: 12, color: 'salmon' }}>{error}</div>}
        </div>
      </div>
    </div>
  )
}
