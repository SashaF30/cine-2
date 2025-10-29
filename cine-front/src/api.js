// src/api.js
// Base URL:
// - Si VITE_API_BASE está definida => se usa (ej: http://192.168.56.1:3001/api)
// - Si NO está definida => usa '/api' (proxy de Vite en dev)

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

  // busca arrays en el primer nivel
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (Array.isArray(v)) return v;
  }
  // baja recursivamente hasta 3 niveles
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

  // si la API devolvió ok:false lo respetamos para que el caller lo maneje
  if (x && typeof x === "object" && x.ok === false) return x;

  // formatos comunes
  if (Array.isArray(x.data)) return x.data;
  if (x.data && typeof x.data === "object") {
    const arr = firstArrayDeep(x.data);
    if (arr) return arr;
  }
  if (Array.isArray(x.rows)) return x.rows;
  if (Array.isArray(x.results)) return x.results;
  if (Array.isArray(x.items)) return x.items;
  if (Array.isArray(x.list)) return x.list;

  // fallback: primer array que encontremos en el objeto
  const arr = firstArrayDeep(x);
  return arr ?? x;
}

function arr(x) {
  const u = unwrap(x);
  return Array.isArray(u) ? u : [];
}

// =============== AUTH ===============
export async function postLogin({ email, password }) {
  // Backend: POST /api/login  ->  { user, token }
  return fetchJson("/login", { method: "POST", body: { email, password } });
}

export function getMe(token) {
  // Backend: GET /api/me (Auth: Bearer)
  return fetchJson("/me", { token });
}

// =============== PELÍCULAS ===============
export async function getPeliculas() {
  const raw = await fetchJson("/peliculas");
  if (import.meta.env.DEV) console.log("[API] /peliculas RAW →", raw);
  if (raw && raw.ok === false) {
    const err = new Error(raw.error || "API /peliculas respondió ok:false");
    err.payload = raw;
    throw err;
  }
  const list = arr(raw);
  if (!Array.isArray(list) || list.length === 0) {
    if (import.meta.env.DEV) {
      console.warn(
        "[API] /peliculas NO devolvió un array con datos. Keys:",
        raw && typeof raw === "object" ? Object.keys(raw) : raw
      );
    }
  }
  return list;
}

// Tu back NO tiene /api/peliculas/:id → resolvemos el detalle buscando en la lista
export async function getPeliculaById(id) {
  const peliculas = await getPeliculas(); // array garantizado (o vacío)
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

// =============== FUNCIONES ===============
// Tu back NO tiene /api/peliculas/:id/funciones → traemos /api/funciones y filtramos por id_pelicula
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
  // Si tu backend toma el userId del JWT, pasá userId como undefined.
  const body = { id_pelicula: idPelicula, id_funcion: idFuncion, cantidad };
  if (userId != null) body.id_usuario = userId; // opcional según back
  return fetchJson("/reservas", { method: "POST", token, body });
}

export async function getReservas(token) {
  const data = await fetchJson("/reservas", { token });
  return arr(data);
}

// Tu back NO tiene /api/reservas/:id → buscamos en la lista
export async function getReservaById(idReserva, token) {
  const lista = await getReservas(token); // array
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
  getPeliculaById,
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

// compat: import api from "./api"
export default api;

// =============== debug ===============
if (import.meta.env.DEV) {
  console.log(
    `API BASE => ${ENV_BASE !== "" ? ENV_BASE : "(using Vite proxy /api)"}`
  );
}
