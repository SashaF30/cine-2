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

// =============== unwrappers ===============
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
    if (typeof v === "object" && v) {
      const r = firstArrayDeep(v, depth + 1);
      if (Array.isArray(r)) return r;
    }
  }
  return null;
}

function unwrap(x) {
  if (x == null) return [];
  if (Array.isArray(x)) return x;
  if (x.ok === true && Array.isArray(x.data)) return x.data;
  if (Array.isArray(x.data)) return x.data;
  if (Array.isArray(x.result)) return x.result;
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
export async function postLogin({ email, password }) {
  const raw = await fetchJson("/login", { method: "POST", body: { email, password } });
  if (raw && raw.ok && raw.user) {
    return { ok: true, data: raw.user, token: raw.token };
  }
  return raw;
}

// =============== AUTH ===============


export function getMe(token) {
  return fetchJson("/me", { token });
}

// =============== PELÍCULAS ===============
export async function getPeliculas() {
  const raw = await fetchJson("/peliculas");
  if (raw && raw.ok === false) {
    const err = new Error(raw.error || "API /peliculas respondió ok:false");
    err.payload = raw;
    throw err;
  }
  return arr(raw).map((p) => ({
    id: p.id ?? p.pelicula_id ?? p.id_pelicula,
    titulo: p.titulo ?? p.nombre ?? p.title,
    duracion: p.duracion ?? p.duracion_min ?? p.minutos ?? null,
    poster_url: p.poster_url ?? p.poster ?? p.imagen ?? null,
  }));
}

export async function getPeliculaById(id) {
  const list = await getPeliculas();
  const numId = Number(id);
  return (
    list.find(
      (p) => (p.id === (Number.isNaN(numId) ? id : numId))
    ) || null
  );
}

export async function getPeliculasDetalles() {
  const raw = await fetchJson("/peliculas/detalles");
  return arr(raw);
}

export async function getPeliculaDetalleById(id) {
  const raw = await fetchJson(`/peliculas/${id}`);
  return raw?.data ?? raw;
}

export async function getPeliculaRichById(id) {
  const [peli, funcs] = await Promise.all([
    getPeliculaDetalleById(id),
    getFuncionesByPelicula(id),
  ]);
  return { ...peli, funciones: funcs };
}

// =============== FUNCIONES ===============
export async function getFuncionesByPelicula(idPelicula) {
  const raw = await fetchJson(`/peliculas/${idPelicula}/funciones`);
  return arr(raw).map((f) => ({
    id: f.id ?? f.funcion_id ?? f.id_funcion,
    id_pelicula:
      f.id_pelicula ?? f.pelicula_id ?? f.peli_id ?? Number(idPelicula),
    id_sala: f.id_sala ?? f.sala_id,
    inicio: f.inicio ?? f.fecha_hora ?? f.horario,
    precio: f.precio ?? f.costo ?? null,
    sala: f.sala ?? f.nombre_sala ?? null,
    asientos: f.asientos ?? f.capacidad ?? null,
  }));
}

// =============== RESERVAS ===============
export async function postReserva({ id_funcion, id_usuario, cantidad = 1, token }) {
  return fetchJson("/reservas", {
    method: "POST",
    token,
    body: { id_funcion, id_usuario, cantidad },
  });
}

export async function getReservas({ token, usuario_id, funcion_id, estado, desde, hasta } = {}) {
  const qs = new URLSearchParams();
  if (usuario_id) qs.set("usuario_id", usuario_id);
  if (funcion_id) qs.set("funcion_id", funcion_id);
  if (estado) qs.set("estado", estado);
  if (desde) qs.set("desde", desde);
  if (hasta) qs.set("hasta", hasta);
  const raw = await fetchJson(`/reservas?${qs.toString()}`, { token });
  return arr(raw);
}

export async function getReservaById(id, token) {
  const raw = await fetchJson(`/reservas/${id}`, { token });
  return raw?.data ?? raw;
}

// =============== BUTACAS / SALAS ===============
export async function getButacasSala(idSala) {
  const raw = await fetchJson(`/salas/${idSala}/butacas`);
  return arr(raw);
}

export async function postReservaButacas(idReserva, butacas, token) {
  return fetchJson(`/reservas/${idReserva}/butacas`, {
    method: "POST",
    token,
    body: { butacas },
  });
}

// =============== AUTH aliases (compat) ===============
export const login = postLogin;
export const me = getMe;

// =============== export agrupado ===============
export const api = {
  postLogin, getMe, login, me,
  getPeliculas, getPeliculasDetalles, getPeliculaDetalleById, getPeliculaById, getPeliculaRichById,
  getFuncionesByPelicula,
  postReserva, getReservas, getReservaById,
  getButacasSala, postReservaButacas,
};

export default api;

if (import.meta.env.DEV) {
  console.log(
    `API BASE => ${ENV_BASE !== "" ? ENV_BASE : "(using Vite proxy /api)"}`
  );
}
