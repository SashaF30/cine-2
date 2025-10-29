// src/api.js
const ENV_BASE = (import.meta.env.VITE_API_BASE || "").trim();
const API_BASE = ENV_BASE !== "" ? ENV_BASE : "/api";

// =============== helpers HTTP ===============
function withAuth(headers = {}, token) {
  if (!token) return headers;
  return { ...headers, Authorization: `Bearer ${token}` };
}

async function fetchJson(path, { method = "GET", body, token, headers } = {}) {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const finalHeaders = withAuth(
    {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(headers || {}),
    },
    token
  );

  const res = await fetch(url, {
    method,
    headers: finalHeaders,
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  let data = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const message =
      (data && (data.message || data.error)) ||
      `HTTP ${res.status} - ${res.statusText}`;
    const err = new Error(message);
    err.status = res.status;
    err.payload = data;
    throw err;
  }

  return data;
}

// =============== unwrappers robustos ===============
function firstArrayDeep(obj, depth = 0) {
  if (obj == null || depth > 3) return null;
  if (Array.isArray(obj)) return obj;
  if (typeof obj !== "object") return null;

  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (Array.isArray(v)) return v;
  }
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    const found = firstArrayDeep(v, depth + 1);
    if (found) return found;
  }
  return null;
}

function unwrap(x) {
  if (x == null) return x;
  if (Array.isArray(x)) return x;
  if (x && typeof x === "object" && x.ok === false) return x;
  if (Array.isArray(x.data)) return x.data;
  if (x.data && typeof x.data === "object") {
    const arr = firstArrayDeep(x.data);
    if (arr) return arr;
  }
  if (Array.isArray(x.rows)) return x.rows;
  if (Array.isArray(x.results)) return x.results;
  if (Array.isArray(x.items)) return x.items;
  if (Array.isArray(x.list)) return x.list;
  const arr = firstArrayDeep(x);
  return arr ?? x;
}

function arr(x) {
  const u = unwrap(x);
  return Array.isArray(u) ? u : [];
}

// =============== AUTH ===============
export async function postLogin({ email, password }) {
  return fetchJson("/login", { method: "POST", body: { email, password } });
}
export function getMe(token) {
  return fetchJson("/me", { token });
}

// =============== PELÍCULAS (lista básica) ===============
export async function getPeliculas() {
  const raw = await fetchJson("/peliculas");
  if (import.meta.env.DEV) console.log("[API] /peliculas RAW →", raw);
  if (raw && raw.ok === false) {
    const err = new Error(raw.error || "API /peliculas respondió ok:false");
    err.payload = raw;
    throw err;
  }
  return arr(raw);
}

// =============== PELÍCULAS DETALLES (sinopsis, etc.) ===============
export async function getPeliculasDetalles() {
  const raw = await fetchJson("/peliculas/detalles");
  if (import.meta.env.DEV) console.log("[API] /peliculas/detalles RAW →", raw);
  return arr(raw);
}

export async function getPeliculaDetalleById(id) {
  const detalles = await getPeliculasDetalles();
  const numId = Number(id);
  return (
    detalles.find(
      (d) =>
        (d.id ?? d.id_pelicula ?? d.pelicula_id) ===
        (Number.isNaN(numId) ? id : numId)
    ) || null
  );
}

// Básico por id (solo lista principal)
export async function getPeliculaById(id) {
  const peliculas = await getPeliculas();
  const numId = Number(id);
  const found =
    peliculas.find(
      (p) =>
        (p.id ?? p.id_pelicula ?? p.pelicula_id) ===
        (Number.isNaN(numId) ? id : numId)
    ) || null;

  if (import.meta.env.DEV)
    console.log("[API] getPeliculaById(", id, ") →", found);
  return found;
}

// Enriquecido: mergea lista + detalles (trae sinopsis si existe)
export async function getPeliculaRichById(id) {
  const [base, det] = await Promise.all([
    getPeliculaById(id),
    getPeliculaDetalleById(id).catch(() => null),
  ]);
  if (!base && det) return det;
  if (!det) return base;
  return { ...base, ...det };
}

// =============== FUNCIONES ===============
export async function getFuncionesByPelicula(idPelicula) {
  const data = await fetchJson("/funciones");
  const todas = arr(data);
  const pid = Number(idPelicula);
  return todas.filter((f) => {
    const fk = f.id_pelicula ?? f.pelicula_id ?? f.idPelicula;
    return fk === (Number.isNaN(pid) ? idPelicula : pid);
  });
}

// =============== RESERVAS ===============
export function postReserva({ idPelicula, idFuncion, cantidad }, token, userId) {
  const body = { id_pelicula: idPelicula, id_funcion: idFuncion, cantidad };
  if (userId != null) body.id_usuario = userId;
  return fetchJson("/reservas", { method: "POST", token, body });
}

export async function getReservas(token) {
  const data = await fetchJson("/reservas", { token });
  return arr(data);
}

export async function getReservaById(idReserva, token) {
  const lista = await getReservas(token);
  const rid = Number(idReserva);
  return (
    lista.find(
      (r) =>
        (r.id ?? r.id_reserva ?? r.reserva_id) ===
        (Number.isNaN(rid) ? idReserva : rid)
    ) || null
  );
}

// =============== BUTACAS / SALAS ===============
export async function getButacasSala(idSala) {
  const data = await fetchJson(`/salas/${idSala}/butacas`);
  return arr(data);
}

export function postReservaButacas(idReserva, butacas, token) {
  return fetchJson(`/reservas/${idReserva}/butacas`, {
    method: "POST",
    token,
    body: { butacas },
  });
}

// =============== export agrupado (compat) ===============
export const api = {
  // auth
  postLogin,
  getMe,
  // películas
  getPeliculas,
  getPeliculasDetalles,
  getPeliculaDetalleById,
  getPeliculaById,
  getPeliculaRichById,
  // funciones
  getFuncionesByPelicula,
  // reservas
  postReserva,
  getReservas,
  getReservaById,
  // butacas / salas
  getButacasSala,
  postReservaButacas,
};

export default api;

if (import.meta.env.DEV) {
  console.log(
    `API BASE => ${ENV_BASE !== "" ? ENV_BASE : "(using Vite proxy /api)"}`
  );
}
