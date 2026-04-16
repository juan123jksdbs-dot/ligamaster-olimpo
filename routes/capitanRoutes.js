// routes/capitanRoutes.js
// ─────────────────────────────────────────────────────────
// Rutas del Panel del Capitán
// PROTEGIDAS: verificarToken + soloCapitan
// ─────────────────────────────────────────────────────────
const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');

const { verificarToken } = require('../middleware/authMiddleware');
const ctrl = require('../controllers/capitanController');

// ── Middleware: solo capitanes ────────────────────────────
const soloCapitan = (req, res, next) => {
  if (req.usuario.rol !== 'capitan')
    return res.status(403).json({ error: 'Acceso denegado. Se requiere rol Capitán.' });
  next();
};

// ── Configuración de Multer (subida de archivos) ──────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../public/uploads'));
  },
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-z0-9]/gi, '_');
    cb(null, `${Date.now()}-${base}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.pdf'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error(`Tipo de archivo no permitido: ${ext}`), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10 MB
});

const archivosJugador = upload.fields([
  { name: 'foto', maxCount: 1 },
  { name: 'ine',  maxCount: 1 },
  { name: 'acta', maxCount: 1 }
]);

// ── Aplicar autenticación a todas las rutas ───────────────
router.use(verificarToken, soloCapitan);

// ── Rutas ─────────────────────────────────────────────────
router.get('/perfil',            ctrl.getPerfil);
router.get('/mi-equipo',         ctrl.getMiEquipo);
router.get('/jugadores',         ctrl.getJugadores);
router.post('/jugadores',        archivosJugador, ctrl.crearJugador);
router.put('/jugadores/:id',     archivosJugador, ctrl.actualizarJugador);
router.put('/jugadores/:id/baja', ctrl.solicitarBaja);
router.put('/mi-equipo/categoria', ctrl.actualizarCategoria);

module.exports = router;
