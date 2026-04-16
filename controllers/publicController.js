// controllers/publicController.js
// ─────────────────────────────────────────────────────────
// Rutas PÚBLICAS (sin JWT) para el Landing Page
// ─────────────────────────────────────────────────────────
const pool = require('../config/db');

/**
 * GET /api/public/ligas
 * Devuelve ligas activas (con pago activo) para el buscador
 */
const getLigasActivas = async (req, res) => {
  try {
    const { q } = req.query; // término de búsqueda opcional
    let query = `
      SELECT id, nombre_liga, slug, email_contacto, plan, telefono
      FROM tenants
      WHERE estatus_pago = true
    `;
    const params = [];
    if (q && q.trim()) {
      params.push(`%${q.trim()}%`);
      query += ` AND nombre_liga ILIKE $1`;
    }
    query += ` ORDER BY nombre_liga ASC LIMIT 20`;

    const result = await pool.query(query, params);
    res.json({ ligas: result.rows });
  } catch (err) {
    console.error('Error al obtener ligas:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

/**
 * GET /api/public/check-equipo?tenant_id=X&nombre=Y
 * Verifica si el nombre del equipo ya existe en esa liga
 */
const checkNombreEquipo = async (req, res) => {
  const { tenant_id, nombre } = req.query;
  if (!tenant_id || !nombre) {
    return res.status(400).json({ error: 'Faltan parámetros.' });
  }
  try {
    const result = await pool.query(
      `SELECT id FROM equipos WHERE tenant_id = $1 AND LOWER(nombre) = LOWER($2)`,
      [tenant_id, nombre.trim()]
    );
    res.json({ disponible: result.rows.length === 0 });
  } catch (err) {
    console.error('Error al verificar nombre de equipo:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

/**
 * GET /api/public/liga-config?tenant_id=X
 * Devuelve categorías y precios de la liga
 */
const getLigaConfig = async (req, res) => {
  const { tenant_id } = req.query;
  if (!tenant_id) return res.status(400).json({ error: 'Faltan parámetros.' });
  try {
    const result = await pool.query(
      `SELECT categorias_soccer, categorias_fut7, tipo_liga FROM tenants WHERE id = $1`,
      [tenant_id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Liga no encontrada.' });
    
    const row = result.rows[0];
    const parse = (s) => {
      try {
        const data = JSON.parse(s || '[]');
        return data.map(c => typeof c === 'string' ? { name: c, price: 0 } : c);
      } catch(e) { return []; }
    };

    res.json({
      tipo_liga: row.tipo_liga,
      categorias_soccer: parse(row.categorias_soccer),
      categorias_fut7: parse(row.categorias_fut7)
    });
  } catch (err) {
    console.error('Error al obtener config liga:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

module.exports = { getLigasActivas, checkNombreEquipo, getLigaConfig };
