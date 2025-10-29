// src/api.js
const BASE = import.meta.env.VITE_API_BASE || '';

async function request(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    credentials: 'include', // por si tu back setea cookies
  });

  let data = null;
  try { data = await res.json(); } catch { /* ignore */ }

  if (!res.ok) {
    const msg = data?.message || data?.error || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  // === Películas ===
  getPeliculas() { return request('/api/peliculas'); },
  getPelicula(id) { return request(`/api/peliculas/${id}`); },

  // === Auth ===
  /**
   * Login “inteligente”:
   * 1) Intenta POST contra varias rutas comunes.
   * 2) Si todo devuelve 404, hace fallback a GET de usuarios y valida en el front.
   */
  async login({ username, password }) {
    const payload = { username, password };

    // 1) Candidatos más comunes en TPs / Node-Express
    const candidates = [
      '/api/login',
      '/login',
      '/auth/login',
      '/api/auth/login',
      '/usuarios/login',
      '/api/usuarios/login',
      '/api/usuario/login',
      '/users/login',
      '/api/users/login',
    ];

    let lastErr = null;
    for (const path of candidates) {
      try {
        const data = await request(path, { method: 'POST', body: payload });
        // Normalizamos salida
        const user = data?.user ?? data?.usuario ?? data?.data ?? data;
        const token = data?.token ?? data?.accessToken ?? null;
        if (!user) throw new Error('Respuesta de login sin usuario.');
        return { user, token };
      } catch (e) {
        lastErr = e;
        if (e?.status !== 404) {
          // Si no es 404, es un error real de credenciales/servidor
          throw e;
        }
      }
    }

    // 2) Fallback: listar usuarios y validar localmente (para cuando no hay endpoint de login)
    // Intenta rutas típicas de listados
    const listCandidates = [
      '/api/usuarios',
      '/usuarios',
      '/api/users',
      '/users',
    ];
    let lista = [];
    let gotList = false;

    for (const lp of listCandidates) {
      try {
        const data = await request(lp);
        // Normalizamos a array
        lista = Array.isArray(data?.data) ? data.data
             : Array.isArray(data?.usuarios) ? data.usuarios
             : Array.isArray(data) ? data
             : [];
        if (lista.length) { gotList = true; break; }
      } catch (e) {
        // si es 404, probamos siguiente
        if (e?.status !== 404) { lastErr = e; break; }
      }
    }

    if (!gotList) {
      // No hay endpoint de login ni listado de usuarios público
      throw lastErr || new Error('No encontré una ruta de login ni un listado de usuarios en el backend.');
    }

    // Normalizadores de campos (usuario y password pueden llamarse distinto)
    const norm = (s = '') => s.toString().trim().toLowerCase();
    const getUserName = (u) =>
      u?.username ?? u?.usuario ?? u?.nombre_usuario ?? u?.user ?? u?.email ?? u?.correo ?? u?.mail ?? '';
    const getPass = (u) =>
      u?.password ?? u?.pass ?? u?.clave ?? u?.contrasena ?? u?.contraseña ?? '';

    const nx = norm(username);
    const matched = lista.find((u) => norm(getUserName(u)) === nx && String(getPass(u)) === String(password));

    if (!matched) {
      const e = new Error('Usuario o contraseña inválidos.');
      e.status = 401;
      throw e;
    }

    // Simulamos estructura {user, token?}
    return { user: matched, token: null };
  },

  me(token) { return request('/api/me', { token }); },
};
