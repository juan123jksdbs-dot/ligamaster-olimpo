// routes/publicRoutes.js
// ─────────────────────────────────────────────────────────
// Rutas PÚBLICAS — no requieren autenticación
// Usadas por el Landing Page
// ─────────────────────────────────────────────────────────
const express = require('express');
const router  = express.Router();
const { getLigasActivas, checkNombreEquipo } = require('../controllers/publicController');

// GET /api/public/ligas?q=tijuana
router.get('/ligas', getLigasActivas);

// GET /api/public/check-equipo?tenant_id=1&nombre=Tigres
router.get('/check-equipo', checkNombreEquipo);

// GET /api/public/liga-config?tenant_id=1
router.get('/liga-config', require('../controllers/publicController').getLigaConfig);

module.exports = router;
