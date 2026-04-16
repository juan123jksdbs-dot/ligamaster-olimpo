// routes/tenantRoutes.js
// ─────────────────────────────────────────────────────────
// Rutas PÚBLICAS del tenant (Módulo Público y Organizador)
// Usa el tenantMiddleware para verificar estatus de pago.
// ─────────────────────────────────────────────────────────
const express = require('express');
const router  = express.Router();
const pool    = require('../config/db');
const { verificarTenant } = require('../middleware/tenantMiddleware');

/**
 * GET /api/tenant/:slug/info
 * Verifica si la liga existe y tiene pago activo.
 * El tenantMiddleware ya hace la verificación; si llega aquí = activa.
 */
router.get('/:slug/info', verificarTenant, (req, res) => {
  res.json({
    mensaje: 'Liga activa',
    tenant: req.tenant
  });
});

/**
 * GET /api/tenant/:slug/posiciones
 * Tabla de posiciones pública (sin login)
 */
router.get('/:slug/posiciones', verificarTenant, async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT * FROM vista_posiciones WHERE tenant_id = $1`,
      [req.tenant.id]
    );
    res.json(resultado.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener posiciones.' });
  }
});

/**
 * GET /api/tenant/:slug/goleadores
 * Tabla de goleadores pública
 */
router.get('/:slug/goleadores', verificarTenant, async (req, res) => {
  try {
    const resultado = await pool.query(
      `SELECT * FROM vista_goleadores WHERE tenant_id = $1`,
      [req.tenant.id]
    );
    res.json(resultado.rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener goleadores.' });
  }
});

module.exports = router;