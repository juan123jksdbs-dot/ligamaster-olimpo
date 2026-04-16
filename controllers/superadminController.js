// controllers/superadminController.js
// ─────────────────────────────────────────────────────────
// Controlador del módulo SUPERADMIN
// Cada función aquí corresponde a una ruta de la API.
// Todas las funciones ya vienen protegidas por authMiddleware.
// ─────────────────────────────────────────────────────────
const pool   = require('../config/db');
const bcrypt = require('bcryptjs');

// ══════════════════════════════════════════════════════════
// DASHBOARD — Métricas generales
// ══════════════════════════════════════════════════════════

/**
 * GET /api/superadmin/dashboard
 * Devuelve: total activas, inactivas, ingresos simulados,
 *           últimas 5 ligas registradas.
 */
const getDashboard = async (req, res) => {
  try {
    // Total de ligas activas e inactivas
    const totales = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE estatus_pago = true)  AS activas,
        COUNT(*) FILTER (WHERE estatus_pago = false) AS inactivas,
        COUNT(*) AS total
      FROM tenants
    `);

    // Ingresos mensuales simulados: suma de suscripciones confirmadas del mes actual
    const ingresos = await pool.query(`
      SELECT COALESCE(SUM(monto), 0) AS ingresos_mes
      FROM suscripciones
      WHERE confirmado = true
        AND DATE_TRUNC('month', fecha_pago) = DATE_TRUNC('month', NOW())
    `);

    // Últimas 5 ligas registradas con nombre del organizador
    const ultimasLigas = await pool.query(`
      SELECT t.id, t.nombre_liga, t.slug, t.plan,
             t.estatus_pago, t.fecha_registro,
             t.fecha_vencimiento,
             u.nombre AS organizador
      FROM tenants t
      LEFT JOIN usuarios u ON t.organizador_id = u.id
      ORDER BY t.fecha_registro DESC
      LIMIT 5
    `);

    // Distribución por plan (para gráfica)
    const porPlan = await pool.query(`
      SELECT plan, COUNT(*) AS cantidad
      FROM tenants
      GROUP BY plan
    `);

    res.json({
      metricas: totales.rows[0],
      ingresos_mes: ingresos.rows[0].ingresos_mes,
      ultimas_ligas: ultimasLigas.rows,
      por_plan: porPlan.rows
    });

  } catch (err) {
    console.error('Error en getDashboard:', err.message);
    res.status(500).json({ error: 'Error al obtener métricas del dashboard.' });
  }
};

// ══════════════════════════════════════════════════════════
// TENANTS — CRUD completo
// ══════════════════════════════════════════════════════════

/**
 * GET /api/superadmin/tenants
 * Lista TODOS los tenants con su organizador
 */
const getTenants = async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT t.*, u.nombre AS nombre_organizador,
             (t.fecha_vencimiento - CURRENT_DATE) AS dias_restantes
      FROM tenants t
      LEFT JOIN usuarios u ON t.organizador_id = u.id
      ORDER BY t.fecha_registro DESC
    `);
    res.json(resultado.rows);
  } catch (err) {
    console.error('Error en getTenants:', err.message);
    res.status(500).json({ error: 'Error al obtener ligas.' });
  }
};

/**
 * GET /api/superadmin/tenants/:id
 * Detalle de un tenant específico
 */
const getTenantById = async (req, res) => {
  const { id } = req.params;
  try {
    const resultado = await pool.query(
      `SELECT t.*, u.nombre AS nombre_organizador, u.email AS email_organizador
       FROM tenants t
       LEFT JOIN usuarios u ON t.organizador_id = u.id
       WHERE t.id = $1`,
      [id]
    );
    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Liga no encontrada.' });
    }
    res.json(resultado.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener la liga.' });
  }
};

/**
 * POST /api/superadmin/tenants
 * Crea una nueva liga (tenant) + usuario organizador
 * Body: { nombre_liga, slug, email_contacto, telefono, plan,
 *         nombre_organizador, email_org, password_org }
 */
const crearTenant = async (req, res) => {
  const {
    nombre_liga, slug, email_contacto, telefono, plan,
    nombre_organizador, email_org, password_org
  } = req.body;

  // Validaciones básicas
  if (!nombre_liga || !slug || !email_contacto || !plan) {
    return res.status(400).json({ error: 'Faltan campos obligatorios: nombre_liga, slug, email_contacto, plan.' });
  }

  // El slug solo puede tener letras minúsculas, números y guiones
  const slugValido = /^[a-z0-9-]+$/.test(slug);
  if (!slugValido) {
    return res.status(400).json({ error: 'El slug solo puede contener letras minúsculas, números y guiones.' });
  }

  try {
    // Verificar que el slug no exista ya
    const slugExiste = await pool.query('SELECT id FROM tenants WHERE slug = $1', [slug]);
    if (slugExiste.rows.length > 0) {
      return res.status(409).json({ error: `El slug "${slug}" ya está en uso. Elige otro.` });
    }

    let organizador_id = null;

    // Si se proporcionan datos del organizador, crear el usuario
    if (nombre_organizador && email_org && password_org) {
      // Verificar que el email no exista
      const emailExiste = await pool.query('SELECT id FROM usuarios WHERE email = $1', [email_org]);
      if (emailExiste.rows.length > 0) {
        return res.status(409).json({ error: `El email "${email_org}" ya está registrado.` });
      }

      // Encriptar la contraseña (10 rondas de salt = balance seguridad/velocidad)
      const hash = await bcrypt.hash(password_org, 10);

      const nuevoOrg = await pool.query(
        `INSERT INTO usuarios (nombre, email, password_hash, rol)
         VALUES ($1, $2, $3, 'organizador') RETURNING id`,
        [nombre_organizador, email_org, hash]
      );
      organizador_id = nuevoOrg.rows[0].id;
    }

    // Calcular fecha de vencimiento: 30 días desde hoy
    const fechaVencimiento = new Date();
    fechaVencimiento.setDate(fechaVencimiento.getDate() + 30);

    // Insertar el tenant
    const nuevoTenant = await pool.query(
      `INSERT INTO tenants
         (nombre_liga, slug, email_contacto, telefono, plan, estatus_pago, fecha_vencimiento, organizador_id)
       VALUES ($1, $2, $3, $4, $5, true, $6, $7)
       RETURNING *`,
      [nombre_liga, slug, email_contacto, telefono || null, plan, fechaVencimiento, organizador_id]
    );

    res.status(201).json({
      mensaje: `Liga "${nombre_liga}" creada exitosamente.`,
      tenant: nuevoTenant.rows[0]
    });

  } catch (err) {
    console.error('Error en crearTenant:', err.message);
    res.status(500).json({ error: 'Error al crear la liga.' });
  }
};

/**
 * PUT /api/superadmin/tenants/:id
 * Edita datos de contacto o plan de una liga
 * Body: { nombre_liga, email_contacto, telefono, plan }
 */
const editarTenant = async (req, res) => {
  const { id } = req.params;
  const { nombre_liga, email_contacto, telefono, plan } = req.body;

  if (!nombre_liga || !email_contacto || !plan) {
    return res.status(400).json({ error: 'Faltan campos obligatorios.' });
  }

  try {
    const resultado = await pool.query(
      `UPDATE tenants
       SET nombre_liga = $1, email_contacto = $2, telefono = $3, plan = $4
       WHERE id = $5
       RETURNING *`,
      [nombre_liga, email_contacto, telefono || null, plan, id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Liga no encontrada.' });
    }

    res.json({
      mensaje: 'Liga actualizada correctamente.',
      tenant: resultado.rows[0]
    });

  } catch (err) {
    console.error('Error en editarTenant:', err.message);
    res.status(500).json({ error: 'Error al editar la liga.' });
  }
};

/**
 * PATCH /api/superadmin/tenants/:id/estatus
 * Activa o suspende una liga (cambia estatus_pago)
 * Body: { estatus_pago: true/false }
 */
const cambiarEstatus = async (req, res) => {
  const { id } = req.params;
  const { estatus_pago } = req.body;

  if (typeof estatus_pago !== 'boolean') {
    return res.status(400).json({ error: 'estatus_pago debe ser true o false.' });
  }

  try {
    const resultado = await pool.query(
      `UPDATE tenants SET estatus_pago = $1 WHERE id = $2 RETURNING nombre_liga, estatus_pago`,
      [estatus_pago, id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Liga no encontrada.' });
    }

    const accion = estatus_pago ? 'activada' : 'suspendida';
    res.json({
      mensaje: `Liga "${resultado.rows[0].nombre_liga}" ${accion} correctamente.`,
      tenant: resultado.rows[0]
    });

  } catch (err) {
    console.error('Error en cambiarEstatus:', err.message);
    res.status(500).json({ error: 'Error al cambiar estatus.' });
  }
};

/**
 * DELETE /api/superadmin/tenants/:id
 * Elimina permanentemente una liga y todos sus datos (CASCADE)
 */
const eliminarTenant = async (req, res) => {
  const { id } = req.params;
  try {
    const resultado = await pool.query(
      'DELETE FROM tenants WHERE id = $1 RETURNING nombre_liga',
      [id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Liga no encontrada.' });
    }

    res.json({ mensaje: `Liga "${resultado.rows[0].nombre_liga}" eliminada permanentemente.` });

  } catch (err) {
    console.error('Error en eliminarTenant:', err.message);
    res.status(500).json({ error: 'Error al eliminar la liga.' });
  }
};

// ══════════════════════════════════════════════════════════
// SUSCRIPCIONES — Simulación de pagos
// ══════════════════════════════════════════════════════════

/**
 * GET /api/superadmin/tenants/:id/suscripciones
 * Historial de pagos de una liga
 */
const getSuscripciones = async (req, res) => {
  const { id } = req.params;
  try {
    const resultado = await pool.query(
      `SELECT * FROM suscripciones WHERE tenant_id = $1 ORDER BY fecha_pago DESC`,
      [id]
    );
    res.json(resultado.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener suscripciones.' });
  }
};

/**
 * POST /api/superadmin/tenants/:id/pago
 * Simula confirmar un pago:
 *   1. Inserta en suscripciones
 *   2. Activa estatus_pago = true
 *   3. Extiende fecha_vencimiento +30 días
 */
const confirmarPago = async (req, res) => {
  const { id } = req.params;
  const { monto, metodo_pago } = req.body;

  if (!monto) {
    return res.status(400).json({ error: 'El monto es requerido.' });
  }

  try {
    const hoy = new Date();
    const periodoFin = new Date();
    periodoFin.setDate(periodoFin.getDate() + 30);

    // 1. Registrar el pago en suscripciones
    await pool.query(
      `INSERT INTO suscripciones
         (tenant_id, monto, metodo_pago, confirmado, periodo_inicio, periodo_fin)
       VALUES ($1, $2, $3, true, $4, $5)`,
      [id, monto, metodo_pago || 'Simulado', hoy, periodoFin]
    );

    // 2 y 3. Activar y extender vencimiento
    const resultado = await pool.query(
      `UPDATE tenants
       SET estatus_pago = true, fecha_vencimiento = $1
       WHERE id = $2
       RETURNING nombre_liga, estatus_pago, fecha_vencimiento`,
      [periodoFin, id]
    );

    if (resultado.rows.length === 0) {
      return res.status(404).json({ error: 'Liga no encontrada.' });
    }

    res.json({
      mensaje: `Pago confirmado. Liga "${resultado.rows[0].nombre_liga}" activada hasta ${periodoFin.toLocaleDateString('es-MX')}.`,
      tenant: resultado.rows[0]
    });

  } catch (err) {
    console.error('Error en confirmarPago:', err.message);
    res.status(500).json({ error: 'Error al confirmar el pago.' });
  }
};

/**
 * POST /api/superadmin/tenants/:id/recordatorio
 * Envía (registra) un recordatorio de pago al organizador
 */
const enviarRecordatorio = async (req, res) => {
  const { id } = req.params;
  const { mensaje } = req.body;

  const mensajePorDefecto = 'Tu suscripción está por vencer o ya venció. Por favor realiza tu pago para continuar usando LigaMaster.';

  try {
    await pool.query(
      `INSERT INTO recordatorios_pago (tenant_id, mensaje) VALUES ($1, $2)`,
      [id, mensaje || mensajePorDefecto]
    );

    res.json({ mensaje: 'Recordatorio de pago enviado correctamente.' });
  } catch (err) {
    console.error('Error en enviarRecordatorio:', err.message);
    res.status(500).json({ error: 'Error al enviar recordatorio.' });
  }
};

// ══════════════════════════════════════════════════════════
// USUARIOS — Lista de organizadores
// ══════════════════════════════════════════════════════════

/**
 * GET /api/superadmin/usuarios
 * Lista todos los organizadores (para asignar a una liga)
 */
const getOrganizadores = async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT id, nombre, email, creado_en
       FROM usuarios
       WHERE rol = 'organizador'
       ORDER BY nombre`
    );
    res.json(resultado.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener organizadores.' });
  }
};

module.exports = {
  getDashboard,
  getTenants,
  getTenantById,
  crearTenant,
  editarTenant,
  cambiarEstatus,
  eliminarTenant,
  getSuscripciones,
  confirmarPago,
  enviarRecordatorio,
  getOrganizadores
};