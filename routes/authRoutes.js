// routes/authRoutes.js
// ─────────────────────────────────────────────────────────
// Rutas de autenticación (públicas, no requieren token)
// ─────────────────────────────────────────────────────────
const express = require('express');
const router  = express.Router();
const {
  login,
  registroOrganizador,
  registroCapitan,
  simularPago
} = require('../controllers/authController');

// POST /api/auth/login
router.post('/login', login);

// POST /api/auth/registro-organizador
router.post('/registro-organizador', registroOrganizador);

// POST /api/auth/registro-capitan
router.post('/registro-capitan', registroCapitan);

// POST /api/auth/simular-pago
router.post('/simular-pago', simularPago);

module.exports = router;