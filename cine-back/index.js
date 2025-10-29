// ─────────────────────────────────────────────────────────────────────────────
// Cine API - index.js (versión corregida)
// ─────────────────────────────────────────────────────────────────────────────
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

const app = express();

// ─────────────────────────────── Config y Pool DB ────────────────────────────
const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || '0.0.0.0';

const DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'cine',
  port: Number(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

let pool;
(async () => {
  pool = mysql.createPool(DB_CONFIG);
})().catch((e) => {
  console.error('DB POOL ERROR:', e);
  process.exit(1);
});

// ────────────────────────────── JWT helpers ──────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '2h';

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function authRequired(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    const token = (auth.startsWith('Bearer ') && auth.slice(7)) || null;
    if (!token) return res.status(401).json({ ok: false, error: 'Token requerido' });
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, email, nombre }
    next();
  } catch (e) {
    return res.status(401).json({ ok: false, error: 'Token inválido o expirado' });
  }
}

// ────────────────────────────── Middlewares base ─────────────────────────────
app.use(express.json());

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://192.168.56.1:5173',   // host (si lo usás)
  'http://192.168.0.59:5173',   // ajustá a la IP real de tu front si hace falta
];
app.use(cors({
  origin(origin, cb) {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error('CORS blocked: ' + origin));
  },
  credentials: true,
}));

// Helpers de respuesta
const ok  = (res, data, meta) => res.json({ ok: true, data, meta });
const err = (res, status, message, details) =>
  res.status(status).json({
    ok: false,
    error: message,
    ...(process.env.NODE_ENV !== 'production' && details ? { details } : {}),
  });

// ──────────────────────────────── Rutas core ────────────────────────────────
app.get('/', (_req, res) => res.send('Cine API OK'));

app.get('/api/health', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 AS ok');
    ok(res, { http: 'up', db: rows[0]?.ok === 1, db_name: process.env.DB_NAME });
  } catch (e) {
    console.error('HEALTH DB ERROR:', e);
    err(res, 500, 'DB not reachable', { code: e.code, errno: e.errno, message: e.message });
  }
});

app.post('/api/debug/echo', (req, res) => {
  res.json({ ok: true, body: req.body, type: req.headers['content-type'] });
});

// ─────────────────────────────── Autenticación ──────────────────────────────
// POST /api/login  -> { email, password }  => { ok, data:{id,email,nombre}, token }
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return err(res, 400, 'Faltan credenciales');

    const [rows] = await pool.query(
      'SELECT id, email, nombre, password_hash FROM usuarios WHERE email = ? LIMIT 1',
      [email]
    );
    const u = rows?.[0];
    if (!u) return err(res, 401, 'Usuario o contraseña inválidos');

    const okPass = await bcrypt.compare(String(password), String(u.password_hash || ''));
    if (!okPass) return err(res, 401, 'Usuario o contraseña inválidos');

    const userPayload = { id: u.id, email: u.email, nombre: u.nombre };
    const token = signToken(userPayload);

    return ok(res, userPayload, { token });
  } catch (e) {
    console.error('POST /api/login error:', e);
    return err(res, 500, 'Error en el servidor', { code: e.code, errno: e.errno, message: e.message });
  }
});

// GET /api/me  -> requiere Authorization: Bearer <token>
app.get('/api/me', authRequired, (req, res) => ok(res, req.user));

// ───────────────────────────── Películas / Usuarios ─────────────────────────
app.get('/api/peliculas', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, titulo, poster_url FROM peliculas ORDER BY titulo ASC'
    );
    ok(res, rows, { count: rows.length });
  } catch (e) {
    console.error('PELIS ERROR:', e);
    err(res, 500, 'Error obteniendo películas', { code: e.code, errno: e.errno, message: e.message });
  }
});

// Detalles (ajustá nombres de columnas a tu esquema real)
app.get('/api/peliculas/detalles', async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        id,
        titulo,
        duracion_min AS duracion,  -- ajustá si tu columna se llama distinto
        poster_url,
        IFNULL(sinopsis, '') AS sinopsis
      FROM peliculas
      ORDER BY titulo ASC
    `);
    ok(res, rows, { count: rows.length });
  } catch (e) {
    console.error('PELIS DETALLES ERROR:', e);
    err(res, 500, 'Error obteniendo películas (detalles)', { code: e.code, errno: e.errno, message: e.message });
  }
});

app.get('/api/usuarios', async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT id, email, password_hash, nombre
      FROM usuarios
      ORDER BY id ASC
    `);
    ok(res, rows, { count: rows.length });
  } catch (e) {
    console.error('USUARIOS ERROR:', e);
    err(res, 500, 'Error obteniendo usuarios', { code: e.code, errno: e.errno, message: e.message });
  }
});

// ─────────────────────────────── Funciones/Reservas ─────────────────────────
// GET /api/funciones  (filtros ?pelicula_id=&sala_id=&desde=&hasta=)
app.get('/api/funciones', async (req, res) => {
  try {
    const peliculaId = req.query.pelicula_id ? Number(req.query.pelicula_id) : null;
    const salaId     = req.query.sala_id ? Number(req.query.sala_id) : null;
    const desde      = req.query.desde || null;
    const hasta      = req.query.hasta || null;

    const params = [];
    let where = 'WHERE 1=1 ';
    if (peliculaId) { where += 'AND id_pelicula = ? '; params.push(peliculaId); }
    if (salaId)     { where += 'AND id_sala = ? ';     params.push(salaId); }
    if (desde)      { where += 'AND inicio >= ? ';     params.push(desde); }
    if (hasta)      { where += 'AND inicio <= ? ';     params.push(hasta); }

    const [rows] = await pool.query(`
      SELECT id, id_pelicula, id_sala, inicio, idioma, formato, precio
      FROM funciones
      ${where}
      ORDER BY inicio ASC
      LIMIT 500
    `, params);

    ok(res, rows, { count: rows.length });
  } catch (e) {
    console.error('FUNCIONES ERROR:', e);
    err(res, 500, 'Error obteniendo funciones', { code: e.code, errno: e.errno, message: e.message });
  }
});

// GET /api/reservas  (filtros ?usuario_id=&funcion_id=&estado=&desde=&hasta=)
app.get('/api/reservas', async (req, res) => {
  try {
    const usuarioId = req.query.usuario_id ? Number(req.query.usuario_id) : null;
    const funcionId = req.query.funcion_id ? Number(req.query.funcion_id) : null;
    const estado    = req.query.estado ? String(req.query.estado) : null;
    const desde     = req.query.desde || null;
    const hasta     = req.query.hasta || null;

    const params = [];
    let where = 'WHERE 1=1 ';
    if (usuarioId) { where += 'AND id_usuario = ? ';   params.push(usuarioId); }
    if (funcionId) { where += 'AND id_funcion = ? ';   params.push(funcionId); }
    if (estado)    { where += 'AND estado = ? ';       params.push(estado); }
    if (desde)     { where += 'AND vencimiento >= ? '; params.push(desde); }
    if (hasta)     { where += 'AND vencimiento <= ? '; params.push(hasta); }

    const [rows] = await pool.query(`
      SELECT id, id_usuario, id_funcion, estado, total, vencimiento
      FROM reservas
      ${where}
      ORDER BY id DESC
      LIMIT 500
    `, params);

    ok(res, rows, { count: rows.length });
  } catch (e) {
    console.error('RESERVAS ERROR:', e);
    err(res, 500, 'Error obteniendo reservas', { code: e.code, errno: e.errno, message: e.message });
  }
});

// POST /api/reservas  { id_usuario, id_funcion, cantidad?=1 }
app.post('/api/reservas', async (req, res) => {
  const idUsuario = Number(req.body?.id_usuario);
  const idFuncion = Number(req.body?.id_funcion);
  const cantidad  = req.body?.cantidad ? Number(req.body.cantidad) : 1;

  if (!Number.isInteger(idUsuario) || idUsuario <= 0) return err(res, 400, 'id_usuario inválido');
  if (!Number.isInteger(idFuncion) || idFuncion <= 0) return err(res, 400, 'id_funcion inválido');
  if (!Number.isInteger(cantidad) || cantidad <= 0 || cantidad > 10) return err(res, 400, 'cantidad inválida (1-10)');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [u] = await conn.query('SELECT id FROM usuarios WHERE id = ? LIMIT 1', [idUsuario]);
    if (!u.length) { await conn.rollback(); return err(res, 400, 'Usuario no existe'); }

    const [f] = await conn.query('SELECT id, precio, inicio, id_sala FROM funciones WHERE id = ? LIMIT 1', [idFuncion]);
    if (!f.length) { await conn.rollback(); return err(res, 400, 'Función no existe'); }

    const inicio = new Date(f[0].inicio);
    if (!(inicio > new Date())) { await conn.rollback(); return err(res, 400, 'La función ya comenzó o finalizó'); }

    const precioUnit = Number(f[0].precio);
    if (Number.isNaN(precioUnit)) { await conn.rollback(); return err(res, 500, 'Precio de función inválido'); }
    const total = precioUnit * cantidad;

    const [ins] = await conn.query(`
      INSERT INTO reservas (id_usuario, id_funcion, estado, total, vencimiento)
      VALUES (?, ?, 'PENDIENTE', ?, DATE_ADD(NOW(), INTERVAL 15 MINUTE))
    `, [idUsuario, idFuncion, total]);

    await conn.commit();

    return res.status(201).json({
      ok: true,
      data: { id: ins.insertId, id_usuario: idUsuario, id_funcion: idFuncion, estado: 'PENDIENTE', total },
      meta: { cantidad, vencimiento_min: 15 }
    });
  } catch (e) {
    try { await conn.rollback(); } catch {}
    console.error('RESERVAS POST ERROR:', e);
    return err(res, 500, 'No se pudo crear la reserva', { code: e.code, errno: e.errno, message: e.message });
  } finally {
    conn.release();
  }
});

// GET /api/butacas  (paginado y filtros)
app.get('/api/butacas', async (req, res) => {
  try {
    const salaId   = req.query.sala_id ? Number(req.query.sala_id) : null;
    const fila     = req.query.fila ? String(req.query.fila) : null;
    const numero   = req.query.numero ? Number(req.query.numero) : null;
    const etiqueta = req.query.etiqueta ? String(req.query.etiqueta) : null;

    const page  = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 200, 1), 1000);
    const offset = (page - 1) * limit;

    const params = [];
    let where = 'WHERE 1=1 ';
    if (salaId)   { where += 'AND b.id_sala = ? '; params.push(salaId); }
    if (fila)     { where += 'AND b.fila = ? ';    params.push(fila); }
    if (Number.isInteger(numero)) { where += 'AND b.numero = ? '; params.push(numero); }
    if (etiqueta) { where += 'AND b.etiqueta = ? '; params.push(etiqueta); }

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM butacas b ${where}`, params);

    const [rows] = await pool.query(`
      SELECT b.id, b.id_sala, b.fila, b.numero, b.etiqueta
      FROM butacas b
      ${where}
      ORDER BY b.fila ASC, b.numero ASC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    res.json({ ok: true, data: rows, meta: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (e) {
    console.error('BUTACAS ERROR:', e);
    res.status(500).json({ ok: false, error: 'Error obteniendo butacas' });
  }
});

app.get('/api/salas/:id/butacas', async (req, res) => {
  try {
    const salaId = Number(req.params.id);
    if (!Number.isInteger(salaId) || salaId <= 0) return err(res, 400, 'ID de sala inválido');

    const [rows] = await pool.query(`
      SELECT id, id_sala, fila, numero, etiqueta
      FROM butacas
      WHERE id_sala = ?
      ORDER BY fila ASC, numero ASC
    `, [salaId]);

    res.json({ ok: true, data: rows, meta: { count: rows.length } });
  } catch (e) {
    console.error('SALAS BUTACAS ERROR:', e);
    res.status(500).json({ ok: false, error: 'Error obteniendo butacas de la sala' });
  }
});

app.get('/api/reservas/:id/butacas', async (req, res) => {
  const idReserva = Number(req.params.id);
  if (!Number.isInteger(idReserva) || idReserva <= 0) return err(res, 400, 'ID de reserva inválido');

  try {
    const [rows] = await pool.query(`
      SELECT
        rb.id_reserva, rb.id_funcion, rb.id_butaca, rb.precio,
        b.id_sala, b.fila, b.numero, b.etiqueta
      FROM reservas_butacas rb
      INNER JOIN butacas b ON b.id = rb.id_butaca
      WHERE rb.id_reserva = ?
      ORDER BY b.fila ASC, b.numero ASC
    `, [idReserva]);

    return res.json({ ok: true, data: rows, meta: { count: rows.length } });
  } catch (e) {
    console.error('RESERVA BUTACAS GET ERROR:', e);
    return res.status(500).json({ ok: false, error: 'Error obteniendo butacas de la reserva' });
  }
});

// POST /api/reservas/:id/butacas  { butacas: [ids] }
app.post('/api/reservas/:id/butacas', async (req, res) => {
  const idReserva = Number(req.params.id);
  const butacas = Array.isArray(req.body?.butacas) ? req.body.butacas : [];
  if (!Number.isInteger(idReserva) || idReserva <= 0) return err(res, 400, 'ID de reserva inválido');
  if (!butacas.length) return err(res, 400, 'Debe enviar butacas (array de IDs)');

  const seatIds = [...new Set(butacas.map(n => Number(n)).filter(n => Number.isInteger(n) && n > 0))];
  if (!seatIds.length) return err(res, 400, 'Butacas inválidas');
  if (seatIds.length > 20) return err(res, 400, 'Máximo 20 butacas por operación');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [r] = await conn.query(`
      SELECT r.id, r.estado, r.total, r.vencimiento, r.id_funcion,
             f.id_sala, f.inicio, f.precio
      FROM reservas r
      INNER JOIN funciones f ON f.id = r.id_funcion
      WHERE r.id = ? LIMIT 1
    `, [idReserva]);
    if (!r.length) { await conn.rollback(); return err(res, 404, 'Reserva no existe'); }

    const reserva = r[0];
    const estadoReserva = String(reserva.estado || '').toLowerCase().trim();
    if (estadoReserva !== 'pendiente') { await conn.rollback(); return err(res, 400, 'La reserva no está en estado pendiente'); }
    if (reserva.vencimiento && new Date(reserva.vencimiento) <= new Date()) { await conn.rollback(); return err(res, 400, 'La reserva está vencida'); }
    if (new Date(reserva.inicio) <= new Date()) { await conn.rollback(); return err(res, 400, 'La función ya comenzó o finalizó'); }

    const idFuncion = reserva.id_funcion;
    const idSalaDeFuncion = reserva.id_sala;
    const precioUnit = Number(reserva.precio);
    if (Number.isNaN(precioUnit)) { await conn.rollback(); return err(res, 500, 'Precio de función inválido'); }

    const [validSeats] = await conn.query(`
      SELECT id, id_sala, fila, numero, etiqueta
      FROM butacas
      WHERE id IN (${seatIds.map(() => '?').join(',')})
    `, seatIds);
    if (validSeats.length !== seatIds.length) { await conn.rollback(); return err(res, 400, 'Alguna butaca no existe'); }
    const wrong = validSeats.find(b => b.id_sala !== idSalaDeFuncion);
    if (wrong) { await conn.rollback(); return err(res, 400, `La butaca ${wrong.id} no pertenece a la sala de la función`); }

    const [taken] = await conn.query(`
      SELECT id_butaca
      FROM reservas_butacas
      WHERE id_funcion = ?
        AND id_butaca IN (${seatIds.map(() => '?').join(',')})
    `, [idFuncion, ...seatIds]);
    if (taken.length) { await conn.rollback(); return err(res, 409, 'Una o más butacas ya están ocupadas', { ocupadas: taken.map(t => t.id_butaca) }); }

    const values = seatIds.map(idB => [idReserva, idFuncion, idB, precioUnit]);
    await conn.query(
      `INSERT INTO reservas_butacas (id_reserva, id_funcion, id_butaca, precio)
       VALUES ${values.map(() => '(?,?,?,?)').join(',')}`,
      values.flat()
    );

    const [[{ total }]] = await conn.query(
      `SELECT COALESCE(SUM(precio), 0) AS total FROM reservas_butacas WHERE id_reserva = ?`,
      [idReserva]
    );
    await conn.query(`UPDATE reservas SET total = ? WHERE id = ?`, [total, idReserva]);

    await conn.commit();

    const [rows] = await pool.query(`
      SELECT rb.id_reserva, rb.id_funcion, rb.id_butaca, rb.precio,
             b.id_sala, b.fila, b.numero, b.etiqueta
      FROM reservas_butacas rb
      INNER JOIN butacas b ON b.id = rb.id_butaca
      WHERE rb.id_reserva = ?
      ORDER BY b.fila ASC, b.numero ASC
    `, [idReserva]);

    return res.status(201).json({ ok: true, data: rows, meta: { cantidad: rows.length, total } });
  } catch (e) {
    try { await conn.rollback(); } catch {}
    if (e && e.code === 'ER_DUP_ENTRY') return err(res, 409, 'Alguna butaca ya estaba ocupada (índice único)');
    console.error('RESERVA BUTACAS POST ERROR:', e);
    return err(res, 500, 'No se pudieron agregar las butacas');
  } finally {
    conn.release();
  }
});

// PATCH /api/reservas/:id  { estado: "pendiente"|"pagada"|"cancelada" }
app.patch('/api/reservas/:id', async (req, res) => {
  const id = Number(req.params.id);
  const nuevoEstadoIn = String(req.body?.estado || '').toLowerCase().trim();
  const permitidos = new Set(['pendiente', 'pagada', 'cancelada']);
  const DB_ESTADO = { pendiente: 'PENDIENTE', pagada: 'PAGADA', cancelada: 'CANCELADA' };

  if (!Number.isInteger(id) || id <= 0) return err(res, 400, 'ID inválido');
  if (!permitidos.has(nuevoEstadoIn)) return err(res, 400, 'Estado inválido');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(`
      SELECT r.id, r.estado, r.total, r.vencimiento, r.id_funcion, f.inicio
      FROM reservas r
      INNER JOIN funciones f ON f.id = r.id_funcion
      WHERE r.id = ? LIMIT 1
    `, [id]);
    if (!rows.length) { await conn.rollback(); return err(res, 404, 'Reserva no encontrada'); }

    const r = rows[0];
    const estadoActual = String(r.estado || '').toLowerCase().trim();
    const ahora = new Date();
    const inicioFuncion = new Date(r.inicio);

    if (estadoActual === nuevoEstadoIn) {
      await conn.rollback();
      return ok(res, { id, estado: r.estado, total: r.total, vencimiento: r.vencimiento });
    }

    if (nuevoEstadoIn === 'pendiente') {
      if (!(inicioFuncion > ahora)) { await conn.rollback(); return err(res, 400, 'La función ya comenzó o finalizó'); }
      await conn.query(`
        UPDATE reservas
        SET estado = 'PENDIENTE',
            vencimiento = DATE_ADD(NOW(), INTERVAL 15 MINUTE)
        WHERE id = ?
      `, [id]);
    }

    if (nuevoEstadoIn === 'pagada') {
      if (estadoActual !== 'pendiente') { await conn.rollback(); return err(res, 400, 'Solo se puede pagar una reserva pendiente'); }
      if (r.vencimiento && new Date(r.vencimiento) <= ahora) { await conn.rollback(); return err(res, 400, 'La reserva está vencida'); }
      if (!(inicioFuncion > ahora)) { await conn.rollback(); return err(res, 400, 'La función ya comenzó o finalizó'); }
      const [[{ cant }]] = await conn.query(
        `SELECT COUNT(*) AS cant FROM reservas_butacas WHERE id_reserva = ?`, [id]
      );
      if (cant === 0) { await conn.rollback(); return err(res, 400, 'No hay butacas seleccionadas'); }
      await conn.query(`UPDATE reservas SET estado = 'PAGADA' WHERE id = ?`, [id]);
    }

    if (nuevoEstadoIn === 'cancelada') {
      await conn.query(`DELETE FROM reservas_butacas WHERE id_reserva = ?`, [id]);
      await conn.query(`UPDATE reservas SET estado = 'CANCELADA', total = 0 WHERE id = ?`, [id]);
    }

    const [out] = await conn.query(
      `SELECT r.id, r.estado, r.total, r.vencimiento, r.id_funcion FROM reservas r WHERE r.id = ? LIMIT 1`,
      [id]
    );

    await conn.commit();
    return ok(res, out[0]);
  } catch (e) {
    try { await conn.rollback(); } catch {}
    console.error('RESERVA PATCH ERROR:', e);
    return err(res, 500, 'No se pudo actualizar la reserva', { code: e.code, errno: e.errno, message: e.message, sqlState: e.sqlState });
  } finally {
    conn.release();
  }
});

// 404
app.use((_req, res) => res.status(404).json({ ok: false, error: 'Not Found' }));

// ──────────────────────────────── Arranque y cierre ─────────────────────────
const server = app.listen(PORT, HOST, () => {
  console.log(`API escuchando en http://${HOST}:${PORT} (DB=${process.env.DB_NAME})`);
});

async function shutdown() {
  try {
    server.close(() => console.log('HTTP cerrado'));
    if (pool) await pool.end();
    process.exit(0);
  } catch (e) {
    console.error('Shutdown error', e);
    process.exit(1);
  }
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
