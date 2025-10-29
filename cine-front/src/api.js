// src/api.js
//
// Helper HTTP con BASE configurable. Si usás proxy de Vite para /api,
// podés dejar VITE_API_BASE vacío.
const BASE = import.meta.env.VITE_API_BASE || '';
console.log('API BASE =>', import.meta.env.VITE_API_BASE || '(using Vite proxy)');

async function http(method, path, { body, token } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    credentials: 'include',
  });

  // Intentar parsear JSON siempre
  let data = null;
  try { data = await res.json(); } catch (_) { data = null; }

  // Normalizamos: si backend devuelve {ok:false,error}, tratamos como error
  if (!res.ok || (data && data.ok === false)) {
    const msg = data?.error || data?.message || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  // Si backend no envía {ok:true}, igualmente devolvemos algo útil
  return data ?? { ok: true };
}

export const api = {
  // ===== Películas =====
  getPeliculas() {
    return http('GET', '/api/peliculas');
  },
  getPelicula(id) {
    return http('GET', `/api/peliculas/${id}`);
  },
  getPeliculasDetalles() {
    // si tu back tiene este endpoint extra
    return http('GET', '/api/peliculas/detalles');
  },

  // ===== Funciones / Reservas / Butacas =====
  getFunciones(params = {}) {
    const q = new URLSearchParams(params).toString();
    return http('GET', `/api/funciones${q ? `?${q}` : ''}`);
  },
  postReserva({ id_usuario, id_funcion, cantidad = 1 }, token) {
    return http('POST', '/api/reservas', {
      body: { id_usuario, id_funcion, cantidad },
      token,
    });
  },
  patchReserva(id, estado, token) {
    return http('PATCH', `/api/reservas/${id}`, { body: { estado }, token });
  },
  getButacasSala(idSala) {
    return http('GET', `/api/salas/${idSala}/butacas`);
  },
  postReservaButacas(idReserva, butacas, token) {
    return http('POST', `/api/reservas/${idReserva}/butacas`, {
      body: { butacas },
      token,
    });
  },

  // ===== Auth con JWT =====
  /**
   * POST /api/login
   * Body: { email, password }
   * Respuesta esperada: { ok:true, data:{id,email,nombre}, token:"..." }
   */
  async login({ email, password }) {
    return http('POST', '/api/login', { body: { email, password } });
  },

  /**
   * GET /api/me con Authorization: Bearer <token>
   */
  async me(token) {
    return http('GET', '/api/me', { token });
  },
};
