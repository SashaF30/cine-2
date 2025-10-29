// index.js
// Requisitos: npm i express mysql2 dotenv
require('dotenv').config();

const express = require('express');
const { createPool } = require('mysql2/promise');

const app = express();
const PORT = Number(process.env.PORT || 3001);

// --- DB desde .env ---
const pool = createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'cine_ar',
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL || 10),
  queueLimit: 0,
});

// helpers
const ok  = (res, data, meta) => res.json({ ok: true, data, meta });
const err = (res, status, message, details) =>
  res.status(status).json({ ok: false, error: message, ...(process.env.NODE_ENV!=='production' && details ? { details } : {}) });
app.use(express.json());

// root
app.get('/', (_req, res) => res.send('Cine API OK'));

// health (sin DB y con DB)
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


// /api/peliculas -> SOLO id, titulo, poster_url
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
// GET /api/peliculas/detalles
// Devuelve: id, titulo, duracion, poster_url, sinopsis (ordenado por título)
app.get('/api/peliculas/detalles', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT 
        id,
        titulo,
        duracion_min AS duracion,   -- 👈 usa el nombre real de tu columna
        poster_url,
        IFNULL(sinopsis, '') AS sinopsis
      FROM peliculas
      ORDER BY titulo ASC
      `
    );
    ok(res, rows, { count: rows.length });
  } catch (e) {
    console.error('PELIS DETALLES ERROR:', e);
    err(res, 500, 'Error obteniendo películas (detalles)', { code: e.code, errno: e.errno, message: e.message });
  }
});

// GET /api/usuarios
// Devuelve: id, email, password_hash, nombre
app.get('/api/usuarios', async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT
        id,
        email,
        password_hash,
        nombre
      FROM usuarios
      ORDER BY id ASC
      `
    );
    ok(res, rows, { count: rows.length });
  } catch (e) {
    console.error('USUARIOS ERROR:', e);
    err(res, 500, 'Error obteniendo usuarios', {
      code: e.code,
      errno: e.errno,
      message: e.message
    });
  }
});


// GET /api/funciones
// Devuelve: id, id_pelicula, id_sala, inicio, idioma, formato, precio
// Filtros opcionales por query: ?pelicula_id= &sala_id= &desde=YYYY-MM-DD &hasta=YYYY-MM-DD
app.get('/api/funciones', async (req, res) => {
  try {
    const peliculaId = req.query.pelicula_id ? Number(req.query.pelicula_id) : null;
    const salaId     = req.query.sala_id ? Number(req.query.sala_id) : null;
    const desde      = req.query.desde || null; // ISO date/datetime
    const hasta      = req.query.hasta || null;

    const params = [];
    let where = 'WHERE 1=1 ';

    if (peliculaId) { where += 'AND id_pelicula = ? '; params.push(peliculaId); }
    if (salaId)     { where += 'AND id_sala = ? ';     params.push(salaId); }
    if (desde)      { where += 'AND inicio >= ? ';     params.push(desde); }
    if (hasta)      { where += 'AND inicio <= ? ';     params.push(hasta); }

    const [rows] = await pool.query(
      `
      SELECT
        id,
        id_pelicula,
        id_sala,
        inicio,
        idioma,
        formato,
        precio
      FROM funciones
      ${where}
      ORDER BY inicio ASC
      LIMIT 500
      `,
      params
    );

    ok(res, rows, { count: rows.length });
  } catch (e) {
    console.error('FUNCIONES ERROR:', e);
    err(res, 500, 'Error obteniendo funciones', {
      code: e.code,
      errno: e.errno,
      message: e.message
    });
  }
});

// GET /api/reservas
// Devuelve: id, id_usuario, id_funcion, estado, total, vencimiento
// Filtros opcionales por query:
//   ?usuario_id=      (num)
//   ?funcion_id=      (num)
//   ?estado=          (texto exacto: ej "pendiente","pagada","cancelada")
//   ?desde=YYYY-MM-DD (filtra vencimiento >= desde)
//   ?hasta=YYYY-MM-DD (filtra vencimiento <= hasta)
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

    const [rows] = await pool.query(
      `
      SELECT
        id,
        id_usuario,
        id_funcion,
        estado,
        total,
        vencimiento
      FROM reservas
      ${where}
      ORDER BY id DESC
      LIMIT 500
      `,
      params
    );

    ok(res, rows, { count: rows.length });
  } catch (e) {
    console.error('RESERVAS ERROR:', e);
    err(res, 500, 'Error obteniendo reservas', {
      code: e.code,
      errno: e.errno,
      message: e.message
    });
  }
});

// POST /api/reservas
// Body JSON: { "id_usuario": number, "id_funcion": number, "cantidad": number (opcional, default 1) }
app.post('/api/reservas', async (req, res) => {
  const idUsuario = Number(req.body?.id_usuario);
  const idFuncion = Number(req.body?.id_funcion);
  const cantidad  = req.body?.cantidad ? Number(req.body.cantidad) : 1;

  // Validaciones básicas
  if (!Number.isInteger(idUsuario) || idUsuario <= 0) {
    return res.status(400).json({ ok: false, error: 'id_usuario inválido' });
  }
  if (!Number.isInteger(idFuncion) || idFuncion <= 0) {
    return res.status(400).json({ ok: false, error: 'id_funcion inválido' });
  }
  if (!Number.isInteger(cantidad) || cantidad <= 0 || cantidad > 10) {
    return res.status(400).json({ ok: false, error: 'cantidad inválida (1-10)' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1) Usuario existe
    const [u] = await conn.query('SELECT id FROM usuarios WHERE id = ? LIMIT 1', [idUsuario]);
    if (!u.length) {
      await conn.rollback();
      return res.status(400).json({ ok: false, error: 'Usuario no existe' });
    }

    // 2) Función existe y no empezó
    const [f] = await conn.query(
      'SELECT id, precio, inicio FROM funciones WHERE id = ? LIMIT 1',
      [idFuncion]
    );
    if (!f.length) {
      await conn.rollback();
      return res.status(400).json({ ok: false, error: 'Función no existe' });
    }

    const inicio = new Date(f[0].inicio);
    if (isNaN(inicio.getTime())) {
      await conn.rollback();
      return res.status(400).json({ ok: false, error: 'Fecha de función inválida' });
    }
    if (inicio <= new Date()) {
      await conn.rollback();
      return res.status(400).json({ ok: false, error: 'La función ya comenzó o finalizó' });
    }

    // 3) Total calculado en server
    const precioUnit = Number(f[0].precio);
    if (Number.isNaN(precioUnit)) {
      await conn.rollback();
      return res.status(500).json({ ok: false, error: 'Precio de función inválido' });
    }
    const total = precioUnit * cantidad;

    // 4) Insert en reservas (estado=pendiente, vencimiento=NOW()+15m)
    const [ins] = await conn.query(
      `
      INSERT INTO reservas (id_usuario, id_funcion, estado, total, vencimiento)
      VALUES (?, ?, 'pendiente', ?, DATE_ADD(NOW(), INTERVAL 15 MINUTE))
      `,
      [idUsuario, idFuncion, total]
    );

    await conn.commit();

    // 5) Respuesta
    return res.status(201).json({
      ok: true,
      data: {
        id: ins.insertId,
        id_usuario: idUsuario,
        id_funcion: idFuncion,
        estado: 'pendiente',
        total,
        vencimiento_min: 15
      },
      meta: { cantidad } // la informamos pero no se guarda en la tabla
    });
  } catch (e) {
    try { await conn.rollback(); } catch {}
    console.error('RESERVAS POST ERROR:', e);
    return res.status(500).json({
      ok: false,
      error: 'No se pudo crear la reserva',
      ...(process.env.NODE_ENV !== 'production' ? { details: { code: e.code, errno: e.errno, message: e.message } } : {})
    });
  } finally {
    conn.release();
  }
});

// GET /api/butacas
// Devuelve: id, id_sala, fila, numero, etiqueta
// Filtros opcionales por query:
//   ?sala_id= (recomendado)  | ?fila= | ?numero= | ?etiqueta=
//   ?page=1&limit=200         | ?orderBy=fila:asc (permitidos: id, fila, numero, id_sala)
app.get('/api/butacas', async (req, res) => {
  try {
    const salaId   = req.query.sala_id ? Number(req.query.sala_id) : null;
    const fila     = req.query.fila ? String(req.query.fila) : null;
    const numero   = req.query.numero ? Number(req.query.numero) : null;
    const etiqueta = req.query.etiqueta ? String(req.query.etiqueta) : null;

    const page  = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 200, 1), 1000);
    const offset = (page - 1) * limit;

    const allowedOrder = new Map([
      ['id', 'b.id'],
      ['id_sala', 'b.id_sala'],
      ['fila', 'b.fila'],
      ['numero', 'b.numero'],
    ]);
    const [ordColRaw, ordDirRaw] = (req.query.orderBy || '').toString().split(':');
    const ordCol = allowedOrder.get((ordColRaw || '').trim()) || 'b.fila';
    const ordDir = ((ordDirRaw || 'asc').toUpperCase() === 'DESC') ? 'DESC' : 'ASC';
    const orderBy = `${ordCol} ${ordDir}, b.numero ASC`; // dentro de fila, ordená por número

    const params = [];
    let where = 'WHERE 1=1 ';
    if (salaId)   { where += 'AND b.id_sala = ? '; params.push(salaId); }
    if (fila)     { where += 'AND b.fila = ? ';    params.push(fila); }
    if (Number.isInteger(numero)) { where += 'AND b.numero = ? '; params.push(numero); }
    if (etiqueta) { where += 'AND b.etiqueta = ? '; params.push(etiqueta); }

    // total
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM butacas b ${where}`,
      params
    );

    // data
    const [rows] = await pool.query(
      `
      SELECT
        b.id,
        b.id_sala,
        b.fila,
        b.numero,
        b.etiqueta
      FROM butacas b
      ${where}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    res.json({
      ok: true,
      data: rows,
      meta: { page, limit, total, pages: Math.ceil(total / limit), orderBy }
    });
  } catch (e) {
    console.error('BUTACAS ERROR:', e);
    res.status(500).json({
      ok: false,
      error: 'Error obteniendo butacas',
      ...(process.env.NODE_ENV !== 'production' ? { details: { code: e.code, errno: e.errno, message: e.message } } : {})
    });
  }
});

// Conveniencia: GET /api/salas/:id/butacas  (alias filtrando por sala)
app.get('/api/salas/:id/butacas', async (req, res) => {
  try {
    const salaId = Number(req.params.id);
    if (!Number.isInteger(salaId) || salaId <= 0) {
      return res.status(400).json({ ok: false, error: 'ID de sala inválido' });
    }
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
    console.error('SALAS BUTACAS ERROR:', e);
    res.status(500).json({ ok: false, error: 'Error obteniendo butacas de la sala' });
  }
});

// GET /api/reservas/:id/butacas
app.get('/api/reservas/:id/butacas', async (req, res) => {
  const idReserva = Number(req.params.id);
  if (!Number.isInteger(idReserva) || idReserva <= 0) {
    return res.status(400).json({ ok: false, error: 'ID de reserva inválido' });
  }
  try {
    const [rows] = await pool.query(
      `
      SELECT
        rb.id_reserva,
        rb.id_funcion,
        rb.id_butaca,
        rb.precio,
        b.id_sala,
        b.fila,
        b.numero,
        b.etiqueta
      FROM reservas_butacas rb
      INNER JOIN butacas b ON b.id = rb.id_butaca
      WHERE rb.id_reserva = ?
      ORDER BY b.fila ASC, b.numero ASC
      `,
      [idReserva]
    );
    return res.json({ ok: true, data: rows, meta: { count: rows.length } });
  } catch (e) {
    console.error('RESERVA BUTACAS GET ERROR:', e);
    return res.status(500).json({ ok: false, error: 'Error obteniendo butacas de la reserva' });
  }
});


// POST /api/reservas/:id/butacas
// Body: { "butacas": [ id_butaca1, id_butaca2, ... ] }
app.post('/api/reservas/:id/butacas', async (req, res) => {
  const idReserva = Number(req.params.id);
  const butacas = Array.isArray(req.body?.butacas) ? req.body.butacas : [];

  if (!Number.isInteger(idReserva) || idReserva <= 0) {
    return res.status(400).json({ ok: false, error: 'ID de reserva inválido' });
  }
  if (!butacas.length) {
    return res.status(400).json({ ok: false, error: 'Debe enviar butacas (array de IDs)' });
  }

  // normalizamos IDs y quitamos repetidos
  const seatIds = [...new Set(butacas.map(n => Number(n)).filter(n => Number.isInteger(n) && n > 0))];
  if (!seatIds.length) return res.status(400).json({ ok: false, error: 'Butacas inválidas' });
  if (seatIds.length > 20) return res.status(400).json({ ok: false, error: 'Máximo 20 butacas por operación' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1) Traer reserva + función
    const [r] = await conn.query(
      `SELECT r.id, r.estado, r.total, r.vencimiento, r.id_funcion,
              f.id_sala, f.inicio, f.precio
       FROM reservas r
       INNER JOIN funciones f ON f.id = r.id_funcion
       WHERE r.id = ? LIMIT 1`,
      [idReserva]
    );
    if (!r.length) {
      await conn.rollback();
      return res.status(404).json({ ok: false, error: 'Reserva no existe' });
    }
    const reserva = r[0];

    // >>> Validaciones de estado/tiempo (tolerante a mayúsculas/espacios)
    const estadoReserva = String(reserva.estado || '').toLowerCase().trim();
    if (estadoReserva !== 'pendiente') {
      await conn.rollback();
      return res.status(400).json({
        ok: false,
        error: 'La reserva no está en estado pendiente'
      });
    }
    if (reserva.vencimiento && new Date(reserva.vencimiento) <= new Date()) {
      await conn.rollback();
      return res.status(400).json({ ok: false, error: 'La reserva está vencida' });
    }
    if (new Date(reserva.inicio) <= new Date()) {
      await conn.rollback();
      return res.status(400).json({ ok: false, error: 'La función ya comenzó o finalizó' });
    }

    const idFuncion = reserva.id_funcion;
    const idSalaDeFuncion = reserva.id_sala;
    const precioUnit = Number(reserva.precio);
    if (Number.isNaN(precioUnit)) {
      await conn.rollback();
      return res.status(500).json({ ok: false, error: 'Precio de función inválido' });
    }

    // 2) Validar que las butacas existan y sean de la misma sala
    const [validSeats] = await conn.query(
      `SELECT id, id_sala, fila, numero, etiqueta
       FROM butacas
       WHERE id IN (${seatIds.map(() => '?').join(',')})`,
      seatIds
    );
    if (validSeats.length !== seatIds.length) {
      await conn.rollback();
      return res.status(400).json({ ok: false, error: 'Alguna butaca no existe' });
    }
    const wrong = validSeats.find(b => b.id_sala !== idSalaDeFuncion);
    if (wrong) {
      await conn.rollback();
      return res.status(400).json({ ok: false, error: `La butaca ${wrong.id} no pertenece a la sala de la función` });
    }

    // 3) Verificar ocupación previa (misma función)
    const [taken] = await conn.query(
      `SELECT id_butaca
       FROM reservas_butacas
       WHERE id_funcion = ?
         AND id_butaca IN (${seatIds.map(() => '?').join(',')})`,
      [idFuncion, ...seatIds]
    );
    if (taken.length) {
      await conn.rollback();
      return res.status(409).json({
        ok: false,
        error: 'Una o más butacas ya están ocupadas',
        ocupadas: taken.map(t => t.id_butaca)
      });
    }

    // 4) Insert masivo en tu esquema (id_reserva, id_funcion, id_butaca, precio)
    const values = seatIds.map(idB => [idReserva, idFuncion, idB, precioUnit]);
    await conn.query(
      `INSERT INTO reservas_butacas (id_reserva, id_funcion, id_butaca, precio)
       VALUES ${values.map(() => '(?,?,?,?)').join(',')}`,
      values.flat()
    );

    // 5) Recalcular total = SUM(precio) de la reserva
    const [[{ total }]] = await conn.query(
      `SELECT COALESCE(SUM(precio), 0) AS total
       FROM reservas_butacas
       WHERE id_reserva = ?`,
      [idReserva]
    );
    await conn.query(`UPDATE reservas SET total = ? WHERE id = ?`, [total, idReserva]);

    await conn.commit();

    // 6) Devolver listado actualizado
    const [rows] = await pool.query(
      `
      SELECT
        rb.id_reserva,
        rb.id_funcion,
        rb.id_butaca,
        rb.precio,
        b.id_sala, b.fila, b.numero, b.etiqueta
      FROM reservas_butacas rb
      INNER JOIN butacas b ON b.id = rb.id_butaca
      WHERE rb.id_reserva = ?
      ORDER BY b.fila ASC, b.numero ASC
      `,
      [idReserva]
    );

    return res.status(201).json({
      ok: true,
      data: rows,
      meta: { cantidad: rows.length, total }
    });
  } catch (e) {
    try { await conn.rollback(); } catch {}
    if (e && e.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ ok: false, error: 'Alguna butaca ya estaba ocupada (índice único)' });
    }
    console.error('RESERVA BUTACAS POST ERROR:', e);
    return res.status(500).json({ ok: false, error: 'No se pudieron agregar las butacas' });
  } finally {
    conn.release();
  }
});

// PATCH /api/reservas/:id
// Body: { "estado": "pendiente" | "pagada" | "cancelada" }
app.patch('/api/reservas/:id', async (req, res) => {
  const id = Number(req.params.id);
  const nuevoEstadoIn = String(req.body?.estado || '').toLowerCase().trim();
  const permitidos = new Set(['pendiente', 'pagada', 'cancelada']);

  // Mapeo a ENUM en MAYÚSCULAS de tu BD
  const DB_ESTADO = { pendiente: 'PENDIENTE', pagada: 'PAGADA', cancelada: 'CANCELADA' };

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ ok: false, error: 'ID inválido' });
  }
  if (!permitidos.has(nuevoEstadoIn)) {
    return res.status(400).json({ ok: false, error: 'Estado inválido' });
  }
  const nuevoEstadoDB = DB_ESTADO[nuevoEstadoIn];

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Traer reserva + función
    const [rows] = await conn.query(
      `SELECT r.id, r.estado, r.total, r.vencimiento, r.id_funcion,
              f.inicio
       FROM reservas r
       INNER JOIN funciones f ON f.id = r.id_funcion
       WHERE r.id = ? LIMIT 1`,
      [id]
    );
    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ ok: false, error: 'Reserva no encontrada' });
    }

    const r = rows[0];
    const estadoActual = String(r.estado || '').toLowerCase().trim(); // PENDIENTE -> pendiente
    const ahora = new Date();
    const inicioFuncion = new Date(r.inicio);

    // Idempotente
    if (estadoActual === nuevoEstadoIn) {
      await conn.rollback();
      return res.json({ ok: true, data: { id, estado: r.estado, total: r.total, vencimiento: r.vencimiento } });
    }

    if (nuevoEstadoIn === 'pendiente') {
      if (!(inicioFuncion > ahora)) {
        await conn.rollback();
        return res.status(400).json({ ok: false, error: 'La función ya comenzó o finalizó' });
      }
      await conn.query(
        `UPDATE reservas
         SET estado = 'PENDIENTE',
             vencimiento = DATE_ADD(NOW(), INTERVAL 15 MINUTE)
         WHERE id = ?`,
        [id]
      );
    }

    if (nuevoEstadoIn === 'pagada') {
      if (estadoActual !== 'pendiente') {
        await conn.rollback();
        return res.status(400).json({ ok: false, error: 'Solo se puede pagar una reserva pendiente' });
      }
      if (r.vencimiento && new Date(r.vencimiento) <= ahora) {
        await conn.rollback();
        return res.status(400).json({ ok: false, error: 'La reserva está vencida' });
      }
      if (!(inicioFuncion > ahora)) {
        await conn.rollback();
        return res.status(400).json({ ok: false, error: 'La función ya comenzó o finalizó' });
      }
      const [[{ cant }]] = await conn.query(
        `SELECT COUNT(*) AS cant FROM reservas_butacas WHERE id_reserva = ?`,
        [id]
      );
      if (cant === 0) {
        await conn.rollback();
        return res.status(400).json({ ok: false, error: 'No hay butacas seleccionadas' });
      }
      await conn.query(`UPDATE reservas SET estado = 'PAGADA' WHERE id = ?`, [id]);
    }

    if (nuevoEstadoIn === 'cancelada') {
      // Liberar butacas (si no hay, no pasa nada) y marcar CANCELADA + total 0
      await conn.query(`DELETE FROM reservas_butacas WHERE id_reserva = ?`, [id]);
      await conn.query(`UPDATE reservas SET estado = 'CANCELADA', total = 0 WHERE id = ?`, [id]);
    }

    const [out] = await conn.query(
      `SELECT r.id, r.estado, r.total, r.vencimiento, r.id_funcion
       FROM reservas r
       WHERE r.id = ? LIMIT 1`,
      [id]
    );

    await conn.commit();
    return res.json({ ok: true, data: out[0] });
  } catch (e) {
    try { await conn.rollback(); } catch {}
    console.error('RESERVA PATCH ERROR:', e);
    return res.status(500).json({
      ok: false,
      error: 'No se pudo actualizar la reserva',
      details: { code: e.code, errno: e.errno, message: e.message, sqlState: e.sqlState }
    });
  } finally {
    conn.release();
  }
});


// 404
app.use((_req, res) => res.status(404).json({ ok: false, error: 'Not Found' }));

// start
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`API escuchando en http://0.0.0.0:${PORT} (DB=${process.env.DB_NAME})`);
});

// graceful shutdown
async function shutdown() {
  try {
    server.close(() => console.log('HTTP cerrado'));
    await pool.end();
    process.exit(0);
  } catch (e) {
    console.error('Shutdown error', e);
    process.exit(1);
  }
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
