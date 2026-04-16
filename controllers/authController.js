// controllers/authController.js
// ─────────────────────────────────────────────────────────
// Controlador de AUTENTICACIÓN
// Maneja el login, registro de organizadores y registro de capitanes
// ─────────────────────────────────────────────────────────
const pool   = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');

// ── Helpers ──────────────────────────────────────────────
function slugify(text) {
  return text.toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-').replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
}

// ── LOGIN ─────────────────────────────────────────────────
/**
 * POST /api/auth/login
 * Body: { email, password }
 */
const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email y contraseña son requeridos.' });

  try {
    const resultado = await pool.query(
      'SELECT id, nombre, email, password_hash, rol FROM usuarios WHERE email = $1',
      [email]
    );
    if (resultado.rows.length === 0)
      return res.status(401).json({ error: 'Credenciales incorrectas.' });

    const usuario = resultado.rows[0];

    // Organizador → obtener tenant
    if (usuario.rol === 'organizador') {
      const tRes = await pool.query(
        `SELECT t.id AS tenant_id, t.nombre_liga, t.estatus_pago
         FROM tenants t WHERE t.organizador_id = $1 LIMIT 1`,
        [usuario.id]
      );
      if (tRes.rows.length > 0) {
        usuario.tenant_id    = tRes.rows[0].tenant_id;
        usuario.nombre_liga  = tRes.rows[0].nombre_liga;
        usuario.estatus_pago = tRes.rows[0].estatus_pago;
      }
    }

    // Capitán → obtener equipo y tenant
    if (usuario.rol === 'capitan') {
      const cRes = await pool.query(
        `SELECT c.tenant_id, c.equipo_id, c.suscripcion_activa, c.torneo_pagado_id,
                e.nombre AS nombre_equipo, e.categoria, e.torneo_id, t.nombre_liga
         FROM capitanes c
         LEFT JOIN equipos e ON c.equipo_id = e.id
         LEFT JOIN tenants t ON c.tenant_id  = t.id
         WHERE c.usuario_id = $1 LIMIT 1`,
        [usuario.id]
      );
      if (cRes.rows.length > 0) {
        const c = cRes.rows[0];
        usuario.tenant_id         = c.tenant_id;
        usuario.equipo_id         = c.equipo_id;
        usuario.nombre_equipo     = c.nombre_equipo;
        usuario.nombre_liga       = c.nombre_liga;
        usuario.categoria         = c.categoria;
        
        // La suscripción es válida solo si es activa Y coincide con el torneo actual pagado
        const esMismoTorneo = c.torneo_id && (c.torneo_pagado_id === c.torneo_id);
        usuario.suscripcion_activa = c.suscripcion_activa && esMismoTorneo;
      }
    }

    const passwordValida = await bcrypt.compare(password, usuario.password_hash);
    if (!passwordValida)
      return res.status(401).json({ error: 'Credenciales incorrectas.' });

    if (!process.env.JWT_SECRET)
      return res.status(500).json({ error: 'Error en configuración del servidor.' });

    const payload = { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol };
    if (usuario.rol === 'organizador') {
      payload.tenant_id   = usuario.tenant_id;
      payload.nombre_liga = usuario.nombre_liga;
    }
    if (usuario.rol === 'capitan') {
      payload.tenant_id   = usuario.tenant_id;
      payload.equipo_id   = usuario.equipo_id;
      payload.nombre_liga = usuario.nombre_liga;
    }

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });

    const respuesta = {
      mensaje: `Bienvenido, ${usuario.nombre}`,
      token,
      usuario: { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol }
    };

    if (usuario.rol === 'organizador') {
      respuesta.usuario.tenant_id    = usuario.tenant_id;
      respuesta.usuario.nombre_liga  = usuario.nombre_liga;
      respuesta.usuario.estatus_pago = usuario.estatus_pago;
    }
    if (usuario.rol === 'capitan') {
      respuesta.usuario.tenant_id          = usuario.tenant_id;
      respuesta.usuario.equipo_id          = usuario.equipo_id;
      respuesta.usuario.nombre_equipo      = usuario.nombre_equipo;
      respuesta.usuario.nombre_liga        = usuario.nombre_liga;
      respuesta.usuario.categoria          = usuario.categoria;
      respuesta.usuario.suscripcion_activa = usuario.suscripcion_activa;
    }

    res.json(respuesta);
  } catch (err) {
    console.error('Error en login:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

// ── REGISTRO ORGANIZADOR ──────────────────────────────────
/**
 * POST /api/auth/registro-organizador
 * Crea usuario organizador + tenant (pendiente de pago)
 */
const registroOrganizador = async (req, res) => {
  const { nombre, email, password, nombre_liga, telefono, plan } = req.body;

  if (!nombre || !email || !password || !nombre_liga)
    return res.status(400).json({ error: 'Faltan campos obligatorios.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verificar email único
    const existe = await client.query('SELECT id FROM usuarios WHERE email = $1', [email]);
    if (existe.rows.length > 0)
      return res.status(409).json({ error: 'Ya existe una cuenta con ese correo.' });

    // Hash de contraseña
    const hash = await bcrypt.hash(password, 10);

    // Crear usuario organizador
    const uRes = await client.query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol)
       VALUES ($1, $2, $3, 'organizador') RETURNING id`,
      [nombre.trim(), email.trim().toLowerCase(), hash]
    );
    const usuarioId = uRes.rows[0].id;

    // Crear tenant (liga) — estatus_pago = FALSE hasta que pague
    const slug = slugify(nombre_liga) + '-' + Date.now().toString().slice(-4);
    const tRes = await client.query(
      `INSERT INTO tenants (nombre_liga, slug, email_contacto, telefono, plan, estatus_pago, organizador_id)
       VALUES ($1, $2, $3, $4, $5, FALSE, $6) RETURNING id, nombre_liga, slug`,
      [nombre_liga.trim(), slug, email.trim().toLowerCase(), telefono || null, plan || 'Bronce', usuarioId]
    );
    const tenant = tRes.rows[0];

    await client.query('COMMIT');

    // Generar token temporal para el flujo de pago
    const token = jwt.sign(
      { id: usuarioId, rol: 'organizador', tenant_id: tenant.id, pendiente_pago: true },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.status(201).json({
      mensaje: 'Cuenta creada. Completa el pago para activar tu liga.',
      tenant_id: tenant.id,
      nombre_liga: tenant.nombre_liga,
      usuario_id: usuarioId,
      token
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error en registro organizador:', err.message);
    if (err.code === '23505')
      return res.status(409).json({ error: 'El correo o nombre de liga ya está registrado.' });
    res.status(500).json({ error: 'Error interno del servidor.' });
  } finally {
    client.release();
  }
};

// ── REGISTRO CAPITÁN ──────────────────────────────────────
/**
 * POST /api/auth/registro-capitan
 * Crea usuario capitán + equipo en la liga elegida
 */
const registroCapitan = async (req, res) => {
  const { nombre, email, password, nombre_equipo, tenant_id, categoria } = req.body;

  if (!nombre || !email || !password || !nombre_equipo || !tenant_id)
    return res.status(400).json({ error: 'Faltan campos obligatorios.' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verificar email único
    const existe = await client.query('SELECT id FROM usuarios WHERE email = $1', [email]);
    if (existe.rows.length > 0)
      return res.status(409).json({ error: 'Ya existe una cuenta con ese correo.' });

    // Verificar que el tenant existe y está activo
    const tRes = await client.query(
      'SELECT id, nombre_liga, estatus_pago FROM tenants WHERE id = $1',
      [tenant_id]
    );
    if (tRes.rows.length === 0)
      return res.status(404).json({ error: 'Liga no encontrada.' });
    if (!tRes.rows[0].estatus_pago)
      return res.status(403).json({ error: 'La liga no está activa actualmente.' });

    // Verificar nombre único de equipo en esa liga
    const eqExiste = await client.query(
      `SELECT id FROM equipos WHERE tenant_id = $1 AND LOWER(nombre) = LOWER($2)`,
      [tenant_id, nombre_equipo.trim()]
    );
    if (eqExiste.rows.length > 0)
      return res.status(409).json({ error: 'Ya existe un equipo con ese nombre en esta liga.' });

    // Hash contraseña
    const hash = await bcrypt.hash(password, 10);

    // Crear usuario capitán
    const uRes = await client.query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol)
       VALUES ($1, $2, $3, 'capitan') RETURNING id`,
      [nombre.trim(), email.trim().toLowerCase(), hash]
    );
    const usuarioId = uRes.rows[0].id;

    // Obtener torneo activo de la liga (si hay)
    const torRes = await client.query(
      `SELECT id FROM torneos WHERE tenant_id = $1 AND estatus = 'Activo' LIMIT 1`,
      [tenant_id]
    );
    
    let equipoId = null;
    if (torRes.rows.length > 0) {
      const torneoId = torRes.rows[0].id;
      // Crear equipo en el torneo activo con categoría
      const eqRes = await client.query(
        `INSERT INTO equipos (tenant_id, torneo_id, nombre, capitan_id, categoria)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [tenant_id, torneoId, nombre_equipo.trim(), usuarioId, categoria || null]
      );
      equipoId = eqRes.rows[0].id;
    }

    // Crear registro capitán (suscripcion_activa = FALSE hasta que pague)
    await client.query(
      `INSERT INTO capitanes (usuario_id, equipo_id, tenant_id, suscripcion_activa)
       VALUES ($1, $2, $3, FALSE)`,
      [usuarioId, equipoId, tenant_id]
    );

    await client.query('COMMIT');

    // Token temporal para flujo de pago
    const token = jwt.sign(
      { id: usuarioId, rol: 'capitan', tenant_id: parseInt(tenant_id), equipo_id: equipoId, pendiente_pago: true },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.status(201).json({
      mensaje: 'Cuenta creada. Completa el pago para acceder a tu equipo.',
      usuario_id: usuarioId,
      equipo_id:  equipoId,
      nombre_equipo: nombre_equipo.trim(),
      nombre_liga:   tRes.rows[0].nombre_liga,
      token
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error en registro capitán:', err.message);
    if (err.code === '23505')
      return res.status(409).json({ error: 'El correo ya está registrado.' });
    res.status(500).json({ error: 'Error interno del servidor.' });
  } finally {
    client.release();
  }
};

// ── SIMULAR PAGO ──────────────────────────────────────────
/**
 * POST /api/auth/simular-pago
 * Body: { tipo: 'organizador'|'capitan', id, tenant_id, equipo_id }
 * Activa la suscripción del organizador o capitán
 */
const simularPago = async (req, res) => {
  const { tipo, tenant_id, equipo_id, usuario_id } = req.body;

  try {
    if (tipo === 'organizador' && tenant_id) {
      // Activar tenant
      await pool.query(
        `UPDATE tenants SET estatus_pago = TRUE, fecha_vencimiento = CURRENT_DATE + 30 WHERE id = $1`,
        [tenant_id]
      );
      // Registrar suscripción
      await pool.query(
        `INSERT INTO suscripciones (tenant_id, monto, metodo_pago, confirmado, periodo_inicio, periodo_fin)
         VALUES ($1, 299.00, 'Simulado', TRUE, CURRENT_DATE, CURRENT_DATE + 30)`,
        [tenant_id]
      );
      return res.json({ mensaje: '¡Pago confirmado! Tu liga está activa.', activado: true });
    }

    if (tipo === 'capitan' && usuario_id) {
      // Obtener el equipo y tenant para saber el precio
      const infoRes = await pool.query(
        `SELECT c.tenant_id, c.equipo_id, e.categoria, e.torneo_id, t.categorias_soccer, t.categorias_fut7
         FROM capitanes c
         JOIN equipos e ON c.equipo_id = e.id
         JOIN tenants t ON c.tenant_id = t.id
         WHERE c.usuario_id = $1`,
        [usuario_id]
      );

      if (infoRes.rows.length > 0) {
        const info = infoRes.rows[0];
        const cats = [...JSON.parse(info.categorias_soccer || '[]'), ...JSON.parse(info.categorias_fut7 || '[]')];
        const catConfig = cats.find(c => c.name === info.categoria);
        const monto = catConfig ? catConfig.price : 99.00;

        await pool.query(
          `UPDATE capitanes SET suscripcion_activa = TRUE, torneo_pagado_id = $2 WHERE usuario_id = $1`,
          [usuario_id, info.torneo_id]
        );

        // Registrar suscripción
        await pool.query(
          `INSERT INTO suscripciones (tenant_id, monto, metodo_pago, confirmado, periodo_inicio)
           VALUES ($1, $2, 'Simulado', TRUE, CURRENT_DATE)`,
          [info.tenant_id, monto]
        );
      } else {
        await pool.query(
          `UPDATE capitanes SET suscripcion_activa = TRUE WHERE usuario_id = $1`,
          [usuario_id]
        );
      }

      return res.json({ mensaje: '¡Pago confirmado! Tu equipo está activo.', activado: true });
    }

    res.status(400).json({ error: 'Parámetros inválidos.' });
  } catch (err) {
    console.error('Error en simular pago:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

module.exports = { login, registroOrganizador, registroCapitan, simularPago };