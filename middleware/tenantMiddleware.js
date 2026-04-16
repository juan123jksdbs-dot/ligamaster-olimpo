// middleware/tenantMiddleware.js
// ─────────────────────────────────────────────────────────
// Middleware de VERIFICACIÓN DEL TENANT
//
// Este middleware se usa para rutas públicas del tenant y para
// rutas del organizador donde el tenant se obtiene desde el token.
// ─────────────────────────────────────────────────────────
const pool = require('../config/db');

const verificarTenant = async (req, res, next) => {
  let tenantId = null;
  let slug = req.params.slug;

  try {
    if (slug) {
      const resultado = await pool.query(
        'SELECT id, nombre_liga, estatus_pago, fecha_vencimiento, slug FROM tenants WHERE slug = $1',
        [slug]
      );

      if (resultado.rows.length === 0) {
        return res.status(404).json({ error: `La liga "${slug}" no existe en la plataforma.` });
      }

      const tenant = resultado.rows[0];
      tenantId = tenant.id;
      req.tenant = tenant;
    } else if (req.usuario && req.usuario.tenant_id) {
      tenantId = req.usuario.tenant_id;
    } else {
      return res.status(400).json({ error: 'Tenant no especificado. Inicia sesión primero.' });
    }

    const resultadoTenant = await pool.query(
      'SELECT id, nombre_liga, estatus_pago, fecha_vencimiento, slug FROM tenants WHERE id = $1',
      [tenantId]
    );

    if (resultadoTenant.rows.length === 0) {
      return res.status(404).json({ error: 'La liga no existe o no está asignada.' });
    }

    const tenant = resultadoTenant.rows[0];

    if (!tenant.estatus_pago) {
      return res.status(402).json({
        error: 'Servicio suspendido',
        mensaje: `La liga "${tenant.nombre_liga}" tiene su suscripción suspendida. Contacta al administrador.`,
        tenant_id: tenant.id,
        nombre_liga: tenant.nombre_liga
      });
    }

    if (tenant.fecha_vencimiento && new Date(tenant.fecha_vencimiento) < new Date()) {
      await pool.query('UPDATE tenants SET estatus_pago = false WHERE id = $1', [tenant.id]);
      return res.status(402).json({
        error: 'Suscripción vencida',
        mensaje: `La liga "${tenant.nombre_liga}" tiene su suscripción vencida. Renueva para continuar.`,
      });
    }

    req.tenant = tenant;
    next();
  } catch (err) {
    console.error('Error en tenantMiddleware:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

module.exports = { verificarTenant };