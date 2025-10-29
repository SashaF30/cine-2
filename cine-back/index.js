// ─── Cabecera segura ─────────────────────────
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const mysql = require("mysql2/promise");

const app = express();

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS PERMISIVO para LAN / pruebas
// (No uses origin:"*" con credentials:true: usamos callback)
app.use(cors({
  origin: (_origin, cb) => cb(null, true),
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "x-token"]
}));
// Preflight global


// ─────────────── Conexión a MySQL (pool) ─────────
const DB_CONFIG = {
  host: process.env.DB_HOST || "127.0.0.1",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "cine",
  port: Number(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

let pool;
(async () => {
  pool = await mysql.createPool(DB_CONFIG);
  console.log("✅ MySQL pool OK:", DB_CONFIG.host, DB_CONFIG.database);
})().catch((e) => {
  console.error("DB POOL ERROR:", e);
  process.exit(1);
});

// ─────────────── Helpers comunes ────────────────
const ok = (res, data, meta) => res.json({ ok: true, data, meta });
const err = (res, status, message, details) =>
  res.status(status).json({
    ok: false,
    error: message,
    ...(process.env.NODE_ENV !== "production" && details ? { details } : {}),
  });

// JWT
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const JWT_EXPIRES = process.env.JWT_EXPIRES || "7d";
const signToken = (payload) => jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });

function requireAuth(req, res, next) {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : req.headers["x-token"];
    if (!token) return res.status(401).json({ ok: false, error: "Token requerido" });
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { uid, email, nombre }
    next();
  } catch (e) {
    return res.status(401).json({ ok: false, error: "Token inválido o vencido" });
  }
}

// Asegura pool listo
function ensurePoolReady(req, res, next) {
  if (!pool) return res.status(503).json({ ok: false, error: "DB inicializando" });
  next();
}
app.use(ensurePoolReady);

// ───────────────── Rutas utilitarias ────────────
app.get("/", (_req, res) => res.send("Cine API OK"));

app.get("/api/health", async (_req, res) => {
  try {
    const [rows] = await pool.query("SELECT 1 AS ok");
    ok(res, { http: "up", db: rows[0]?.ok === 1, db_name: process.env.DB_NAME });
  } catch (e) {
    console.error("HEALTH DB ERROR:", e);
    err(res, 500, "DB not reachable", { code: e.code, errno: e.errno, message: e.message });
  }
});

// === util: detectar columna de password una sola vez ===
let PW_COL = null;
async function getPasswordColumn() {
  if (PW_COL !== null) return PW_COL; // cache
  const [cols] = await pool.query("SHOW COLUMNS FROM usuarios");
  const names = cols.map(c => c.Field);
  const candidates = ["password_hash", "password", "clave", "contrasena", "contrasenia", "pass"];
  PW_COL = candidates.find(n => names.includes(n)) || null;
  if (!PW_COL) {
    console.error("LOGIN WARN: no se encontró ninguna columna de password entre", candidates);
  }
  return PW_COL;
}

// === LOGIN (responde token + user) ===
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ ok: false, error: "Email y contraseña requeridos" });
    }

    const pwCol = await getPasswordColumn();
    const selectPw = pwCol ? `${pwCol} AS pw` : `NULL AS pw`;

    const [rows] = await pool.query(
      `
      SELECT id, email, nombre, ${selectPw}
      FROM usuarios
      WHERE email = ? LIMIT 1
    `,
      [email]
    );

    const user = rows && rows[0];
    if (!user) return res.status(401).json({ ok: false, error: "Credenciales inválidas" });

    if (!pwCol) {
      return res.status(500).json({ ok: false, error: "Config de usuarios incompleta (sin columna de password)" });
    }

    const stored = user.pw || "";
    const passOk = String(stored).startsWith("$2")
      ? await bcrypt.compare(password, stored) // bcrypt hash
      : password === stored;                  // texto plano

    if (!passOk) return res.status(401).json({ ok: false, error: "Credenciales inválidas" });

    const token = signToken({ uid: user.id, email: user.email, nombre: user.nombre });

    return res.json({
      ok: true,
      token,
      user: { id: user.id, email: user.email, nombre: user.nombre },
    });
  } catch (e) {
    console.error("LOGIN ERROR:", {
      message: e.message,
      code: e.code,
      errno: e.errno,
      sqlState: e.sqlState,
      stack: e.stack?.split("\n").slice(0, 4).join("\n"),
    });
    return res.status(500).json({ ok: false, error: "Error interno" });
  }
});

// GET /api/me → valida token y devuelve user básico
app.get("/api/me", requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, email, nombre FROM usuarios WHERE id = ? LIMIT 1`,
      [req.user.uid]
    );
    const u = rows && rows[0];
    if (!u) return res.status(404).json({ ok: false, error: "Usuario no encontrado" });
    return res.json({ ok: true, user: u });
  } catch (err) {
    console.error("GET /api/me error:", err);
    return res.status(500).json({ ok: false, error: "Error interno" });
  }
});

// ─────────────────── Películas ──────────────────
app.get("/api/peliculas", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, titulo, poster_url FROM peliculas ORDER BY titulo ASC"
    );
    ok(res, rows, { count: rows.length });
  } catch (e) {
    console.error("PELIS ERROR:", e);
    err(res, 500, "Error obteniendo películas", { code: e.code, errno: e.errno, message: e.message });
  }
});

// Detalle por id (incluye sinopsis si existe la columna)
app.get("/api/peliculas/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [rows] = await pool.query(`
    SELECT 
      id,
      titulo,
      duracion_min AS duracion,
      poster_url,
      IFNULL(sinopsis, '') AS sinopsis
    FROM peliculas
    WHERE id = ?
    LIMIT 1
  `, [id]);
  if (!rows.length) return res.status(404).json({ ok:false, error:"Película no encontrada" });
  res.json({ ok:true, data: rows[0] });
});

/// Funciones por película (alias que tu front espera)
app.get("/api/peliculas/:id/funciones", async (req, res) => {
  const id = Number(req.params.id);
  const [rows] = await pool.query(`
    SELECT f.id, f.id_pelicula, f.id_sala, f.inicio, f.precio,
           s.nombre AS sala, s.capacidad AS asientos
    FROM funciones f
    LEFT JOIN salas s ON s.id = f.id_sala
    WHERE f.id_pelicula = ?
    ORDER BY f.inicio ASC
  `, [id]);
  res.json({ ok:true, data: rows });
});

// ───────────── Funciones / Reservas / Butacas ─────────────
app.get("/api/funciones", async (req, res) => {
  try {
    const peliculaId = req.query.pelicula_id ? Number(req.query.pelicula_id) : null;
    const salaId = req.query.sala_id ? Number(req.query.sala_id) : null;
    const desde = req.query.desde || null;
    const hasta = req.query.hasta || null;

    const params = [];
    let where = "WHERE 1=1 ";
    if (peliculaId) { where += "AND id_pelicula = ? "; params.push(peliculaId); }
    if (salaId) { where += "AND id_sala = ? "; params.push(salaId); }
    if (desde) { where += "AND inicio >= ? "; params.push(desde); }
    if (hasta) { where += "AND inicio <= ? "; params.push(hasta); }

    const [rows] = await pool.query(
      `
      SELECT id, id_pelicula, id_sala, inicio, idioma, formato, precio
      FROM funciones
      ${where}
      ORDER BY inicio ASC
      LIMIT 500
    `,
      params
    );
    ok(res, rows, { count: rows.length });
  } catch (e) {
    console.error("FUNCIONES ERROR:", e);
    err(res, 500, "Error obteniendo funciones", { code: e.code, errno: e.errno, message: e.message });
  }
});

app.get("/api/reservas", async (req, res) => {
  try {
    const usuarioId = req.query.usuario_id ? Number(req.query.usuario_id) : null;
    const funcionId = req.query.funcion_id ? Number(req.query.funcion_id) : null;
    const estado = req.query.estado ? String(req.query.estado) : null;
    const desde = req.query.desde || null;
    const hasta = req.query.hasta || null;

    const params = [];
    let where = "WHERE 1=1 ";
    if (usuarioId) { where += "AND id_usuario = ? "; params.push(usuarioId); }
    if (funcionId) { where += "AND id_funcion = ? "; params.push(funcionId); }
    if (estado) { where += "AND estado = ? "; params.push(estado); }
    if (desde) { where += "AND vencimiento >= ? "; params.push(desde); }
    if (hasta) { where += "AND vencimiento <= ? "; params.push(hasta); }

    const [rows] = await pool.query(
      `
      SELECT id, id_usuario, id_funcion, estado, total, vencimiento
      FROM reservas
      ${where}
      ORDER BY id DESC
      LIMIT 500
    `,
      params
    );
    ok(res, rows, { count: rows.length });
  } catch (e) {
    console.error("RESERVAS ERROR:", e);
    err(res, 500, "Error obteniendo reservas", { code: e.code, errno: e.errno, message: e.message });
  }
});

// POST /api/reservas { id_usuario, id_funcion, cantidad }
app.post("/api/reservas", async (req, res) => {
  const idUsuario = Number(req.body?.id_usuario);
  const idFuncion = Number(req.body?.id_funcion);
  const cantidad = req.body?.cantidad ? Number(req.body.cantidad) : 1;

  if (!Number.isInteger(idUsuario) || idUsuario <= 0) return err(res, 400, "id_usuario inválido");
  if (!Number.isInteger(idFuncion) || idFuncion <= 0) return err(res, 400, "id_funcion inválido");
  if (!Number.isInteger(cantidad) || cantidad <= 0 || cantidad > 10) return err(res, 400, "cantidad inválida (1-10)");

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [u] = await conn.query("SELECT id FROM usuarios WHERE id = ? LIMIT 1", [idUsuario]);
    if (!u.length) { await conn.rollback(); return err(res, 400, "Usuario no existe"); }

    const [f] = await conn.query("SELECT id, precio, inicio, id_sala FROM funciones WHERE id = ? LIMIT 1", [idFuncion]);
    if (!f.length) { await conn.rollback(); return err(res, 400, "Función no existe"); }

    const inicio = new Date(f[0].inicio);
    if (!(inicio > new Date())) { await conn.rollback(); return err(res, 400, "La función ya comenzó o finalizó"); }

    const precioUnit = Number(f[0].precio);
    if (Number.isNaN(precioUnit)) { await conn.rollback(); return err(res, 500, "Precio de función inválido"); }
    const total = precioUnit * cantidad;

    const [ins] = await conn.query(
      `
      INSERT INTO reservas (id_usuario, id_funcion, estado, total, vencimiento)
      VALUES (?, ?, 'PENDIENTE', ?, DATE_ADD(NOW(), INTERVAL 15 MINUTE))
    `,
      [idUsuario, idFuncion, total]
    );

    await conn.commit();

    return res.status(201).json({
      ok: true,
      data: { id: ins.insertId, id_usuario: idUsuario, id_funcion: idFuncion, estado: "PENDIENTE", total },
      meta: { cantidad, vencimiento_min: 15 },
    });
  } catch (e) {
    try { await conn.rollback(); } catch {}
    console.error("RESERVAS POST ERROR:", e);
    return err(res, 500, "No se pudo crear la reserva", { code: e.code, errno: e.errno, message: e.message });
  } finally {
    conn.release();
  }
});

// Butacas por sala
app.get("/api/salas/:id/butacas", async (req, res) => {
  try {
    const salaId = Number(req.params.id);
    if (!Number.isInteger(salaId) || salaId <= 0) return err(res, 400, "ID de sala inválido");
    const [rows] = await pool.query(
      `
      SELECT id, id_sala, fila, numero, etiqueta
      FROM butacas
      WHERE id_sala = ?
      ORDER BY fila ASC, numero ASC
    `,
      [salaId]
    );
    res.json({ ok: true, data: rows, meta: { count: rows.length } });
  } catch (e) {
    console.error("SALAS BUTACAS ERROR:", e);
    res.status(500).json({ ok: false, error: "Error obteniendo butacas de la sala" });
  }
});

// 404 final
app.use((_req, res) => res.status(404).json({ ok: false, error: "Not Found" }));

// ─────────────── Arranque / Shutdown ───────────
const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || "0.0.0.0";

const server = app.listen(PORT, HOST, () => {
  console.log(`✅ API escuchando en http://${HOST}:${PORT} (DB=${process.env.DB_NAME || "cine"})`);
});

async function shutdown() {
  try {
    server.close(() => console.log("HTTP cerrado"));
    if (pool) await pool.end();
    process.exit(0);
  } catch (e) {
    console.error("Shutdown error", e);
    process.exit(1);
  }
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
