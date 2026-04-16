// middleware/authMiddleware.js
// ─────────────────────────────────────────────────────────
// Middleware de AUTENTICACIÓN y AUTORIZACIÓN (RBAC)
//
// Un middleware es una función que se ejecuta ANTES de llegar
// al controlador (la función que maneja la petición).
// Express las encadena así: petición → middleware → controlador
//
// Este archivo exporta DOS middlewares:
//   1. verificarToken   → ¿Estás autenticado? (tienes JWT válido)
//   2. soloSuperAdmin   → ¿Eres superadmin? (protege rutas admin)
// ─────────────────────────────────────────────────────────
const jwt = require('jsonwebtoken');

/**
 * Verifica que la petición incluya un JWT válido.
 * El token viaja en el header: Authorization: Bearer <token>
 */
const verificarToken = (req, res, next) => {
  // Leer el header Authorization
  const authHeader = req.headers['authorization'];

  // Si no hay header, rechazar con 401 (No autorizado)
  if (!authHeader) {
    return res.status(401).json({ error: 'Token requerido. Inicia sesión primero.' });
  }

  // El header tiene formato: "Bearer eyJhbGci..."
  // Con .split(' ')[1] extraemos solo el token
  const token = authHeader.split(' ')[1];

  try {
    // jwt.verify() decodifica el token y verifica que no haya expirado
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Guardar los datos del usuario en req.usuario para usarlos
    // en los controladores siguientes
    req.usuario = decoded;
    next(); // Continuar al siguiente middleware o controlador

  } catch (err) {
    return res.status(403).json({ error: 'Token inválido o expirado. Vuelve a iniciar sesión.' });
  }
};

/**
 * Verifica que el usuario autenticado tenga rol 'superadmin'.
 * SIEMPRE se usa DESPUÉS de verificarToken.
 * Ejemplo de uso en rutas: router.get('/ruta', verificarToken, soloSuperAdmin, controlador)
 */
const soloSuperAdmin = (req, res, next) => {
  if (req.usuario.rol !== 'superadmin') {
    return res.status(403).json({
      error: 'Acceso denegado. Se requiere rol SuperAdmin.'
    });
  }
  next();
};

module.exports = { verificarToken, soloSuperAdmin };