// routes/superadminRoutes.js
// ─────────────────────────────────────────────────────────
// Todas las rutas del panel SuperAdmin.
// PROTEGIDAS: verificarToken + soloSuperAdmin
// ─────────────────────────────────────────────────────────
const express = require('express');
const router  = express.Router();

const { verificarToken, soloSuperAdmin } = require('../middleware/authMiddleware');
const ctrl = require('../controllers/superadminController');

// Aplicar ambos middlewares a TODAS las rutas de este router
// Esto significa: "Solo superadmins autenticados pueden acceder"
router.use(verificarToken, soloSuperAdmin);

// ── Dashboard ──────────────────────────────────────────
router.get('/dashboard', ctrl.getDashboard);

// ── Tenants (ligas) ────────────────────────────────────
router.get   ('/tenants',              ctrl.getTenants);
router.get   ('/tenants/:id',          ctrl.getTenantById);
router.post  ('/tenants',              ctrl.crearTenant);
router.put   ('/tenants/:id',          ctrl.editarTenant);
router.patch ('/tenants/:id/estatus',  ctrl.cambiarEstatus);
router.delete('/tenants/:id',          ctrl.eliminarTenant);

// ── Suscripciones / Pagos ──────────────────────────────
router.get ('/tenants/:id/suscripciones', ctrl.getSuscripciones);
router.post('/tenants/:id/pago',          ctrl.confirmarPago);
router.post('/tenants/:id/recordatorio',  ctrl.enviarRecordatorio);

// ── Usuarios ───────────────────────────────────────────
router.get('/organizadores', ctrl.getOrganizadores);

module.exports = router;