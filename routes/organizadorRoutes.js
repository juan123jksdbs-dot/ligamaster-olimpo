// routes/organizadorRoutes.js
// ─────────────────────────────────────────────────────────
// Rutas del panel Organizador (tenant).
// PROTEGIDAS: verificarToken + verificarTenant (pago activo)
// ─────────────────────────────────────────────────────────
const express = require('express');
const router  = express.Router();

const { verificarToken } = require('../middleware/authMiddleware');
const { verificarTenant } = require('../middleware/tenantMiddleware');
const ctrl = require('../controllers/organizadorController');

// Aplicar middlewares de autenticación y verificación de tenant
router.use(verificarToken, verificarTenant);

// ── Dashboard ──────────────────────────────────────────
router.get('/dashboard', (req, res) => {
  res.json({
    mensaje: 'Dashboard del organizador',
    tenant: req.tenant,
    usuario: req.usuario
  });
});

// ── Partidos ───────────────────────────────────────────
router.get   ('/partidos',           ctrl.getPartidos);
router.post  ('/partidos',           ctrl.crearPartido);
router.put   ('/partidos/:id',       ctrl.actualizarPartido);
router.delete('/partidos/:id',       ctrl.eliminarPartido);

// ── Jugadores ──────────────────────────────────────────
router.get   ('/jugadores',          ctrl.getJugadores);
router.post  ('/jugadores',          ctrl.crearJugador);
router.put   ('/jugadores/:id',      ctrl.actualizarJugador);
router.put   ('/jugadores/:id/estatus', ctrl.cambiarEstatusJugador);
router.delete('/jugadores/:id',      ctrl.eliminarJugador);

// ── Equipos ────────────────────────────────────────────
router.get   ('/equipos',            ctrl.getEquipos);
router.post  ('/equipos',            ctrl.crearEquipo);
router.put   ('/equipos/:id',        ctrl.actualizarEquipo);
router.delete('/equipos/:id',        ctrl.eliminarEquipo);

// ── Árbitros ─────────────────────────────────────────
router.get   ('/arbitros',           ctrl.getArbitros);
router.post  ('/arbitros',           ctrl.crearArbitro);
router.put   ('/arbitros/:id',       ctrl.actualizarArbitro);
router.delete('/arbitros/:id',       ctrl.eliminarArbitro);

// ── Posiciones y goleadores ─────────────────────────
router.get('/posiciones',            ctrl.getPosiciones);
router.get('/goleadores',            ctrl.getGoleadores);

// ── Generación de rol de partidos ────────────────────
router.post('/jornadas/generar',     ctrl.generarRol);
router.get ('/jornadas',             ctrl.getJornadas);
router.post('/torneo/finalizar',      ctrl.finalizarTorneo);

// ── Goles (edición de goleadores) ───────────────────
router.post('/goles',                ctrl.registrarGol);
router.patch('/goles/:id',           ctrl.actualizarGol);
router.delete('/goles/:id',          ctrl.eliminarGol);

// ── Campos (Canchas) ────────────────────────────────
router.get   ('/campos',             ctrl.getCampos);
router.post  ('/campos',             ctrl.crearCampo);
router.put   ('/campos/:id',         ctrl.actualizarCampo);
router.delete('/campos/:id',         ctrl.eliminarCampo);

// ── Estadísticas de Partido (Lineups + Eventos) ─────
router.post('/partidos/:partidoId/estadisticas', ctrl.registrarEstadisticasPartido);
router.get ('/partidos/:partidoId/estadisticas', ctrl.getEstadisticasPartido);


// ── Configuración de Liga (tipo + categorías) ──────────
router.get ('/config',                       ctrl.getConfiguracionLiga);
router.put ('/config',                       ctrl.updateConfiguracionLiga);

// ── Jugadores por equipo (para aprobación) ────────────
router.get ('/jugadores/pendientes-equipo',  ctrl.getJugadoresPendientesPorEquipo);
router.get ('/jugadores/por-equipo',         ctrl.getJugadoresPorEquipo);
router.put ('/jugadores/:id/baja',           ctrl.darDeBajaJugador);

module.exports = router;