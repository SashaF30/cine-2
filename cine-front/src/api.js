// src/api.js
const BASE = '/api';

async function http(method, url, body) {
  const res = await fetch(`${BASE}${url}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) {
    const msg = data?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

export const api = {
  // Películas
  getPeliculas: () => http('GET', '/peliculas'), // id, titulo, poster_url
  getPeliculasDetalles: () => http('GET', '/peliculas/detalles'), // id, titulo, duracion, poster_url, sinopsis

  // Funciones
  getFunciones: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return http('GET', `/funciones${q ? `?${q}` : ''}`);
  },

  // Reservas
  postReserva: ({ id_usuario, id_funcion, cantidad = 1 }) =>
    http('POST', '/reservas', { id_usuario, id_funcion, cantidad }),

  patchReserva: (id, estado) =>
    http('PATCH', `/reservas/${id}`, { estado }),

  // Butacas (más adelante las unimos a la UI)
  getButacasSala: (idSala) => http('GET', `/salas/${idSala}/butacas`),
  postReservaButacas: (idReserva, butacas) =>
    http('POST', `/reservas/${idReserva}/butacas`, { butacas }),
};
