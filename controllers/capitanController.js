// controllers/capitanController.js
// ─────────────────────────────────────────────────────────
// Controlador del Panel del Capitán
// Gestión de jugadores con documentos (foto, INE, acta)
// ─────────────────────────────────────────────────────────
const pool = require('../config/db');
const path = require('path');
const fs   = require('fs');

// ── GET /api/capitan/mi-equipo ────────────────────────────
const getMiEquipo = async (req, res) => {
  const { equipo_id, tenant_id } = req.usuario;
  try {
    const result = await pool.query(
      `SELECT e.id, e.nombre, e.escudo_url, e.entrenador,
              t.nombre_liga, t.plan,
              tor.nombre AS torneo_nombre, tor.estatus AS torneo_estatus
       FROM equipos e
       JOIN tenants  t   ON e.tenant_id  = t.id
       LEFT JOIN torneos tor ON e.torneo_id = tor.id
       WHERE e.id = $1 AND e.tenant_id = $2`,
      [equipo_id, tenant_id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Equipo no encontrado.' });
    res.json({ equipo: result.rows[0] });
  } catch (err) {
    console.error('Error getMiEquipo:', err.message);
    res.status(500).json({ error: 'Error interno.' });
  }
};

// ── GET /api/capitan/jugadores ───────────────────────────
const getJugadores = async (req, res) => {
  const { equipo_id } = req.usuario;
  try {
    const result = await pool.query(
      `SELECT id, nombre, numero_camiseta, posicion, fecha_nacimiento,
              foto_url, ine_pdf_url, acta_pdf_url, telefono, peso_kg, talla_cm, curp, domicilio, estatus, observaciones
       FROM jugadores WHERE equipo_id = $1 ORDER BY nombre`,
      [equipo_id]
    );
    res.json({ jugadores: result.rows });
  } catch (err) {
    console.error('Error getJugadores:', err.message);
    res.status(500).json({ error: 'Error interno.' });
  }
};

// ── POST /api/capitan/jugadores ──────────────────────────
const crearJugador = async (req, res) => {
  const { equipo_id, tenant_id } = req.usuario;
  const {
    nombre, numero_camiseta, posicion,
    fecha_nacimiento, telefono, peso_kg, talla_cm, curp, domicilio
  } = req.body;

  if (!nombre) return res.status(400).json({ error: 'El nombre del jugador es requerido.' });

  // Rutas de los archivos subidos
  const foto_url    = req.files?.foto?.[0]    ? `/uploads/${req.files.foto[0].filename}`    : null;
  const ine_pdf_url  = req.files?.ine?.[0]    ? `/uploads/${req.files.ine[0].filename}`     : null;
  const acta_pdf_url = req.files?.acta?.[0]   ? `/uploads/${req.files.acta[0].filename}`    : null;

  try {
    const result = await pool.query(
      `INSERT INTO jugadores
         (tenant_id, equipo_id, nombre, numero_camiseta, posicion, fecha_nacimiento,
          foto_url, ine_pdf_url, acta_pdf_url, telefono, peso_kg, talla_cm, curp, domicilio, estatus)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, 'pendiente')
       RETURNING *`,
      [tenant_id, equipo_id, nombre.trim(),
       numero_camiseta || null, posicion || null, fecha_nacimiento || null,
       foto_url, ine_pdf_url, acta_pdf_url,
       telefono || null, peso_kg || null, talla_cm || null,
       curp || null, domicilio || null]
    );
    res.status(201).json({ jugador: result.rows[0], mensaje: 'Jugador registrado correctamente.' });
  } catch (err) {
    console.error('Error crearJugador:', err.message);
    res.status(500).json({ error: 'Error interno.' });
  }
};

// ── PUT /api/capitan/jugadores/:id ───────────────────────
const actualizarJugador = async (req, res) => {
  const { equipo_id } = req.usuario;
  const { id } = req.params;
  const {
    nombre, numero_camiseta, posicion,
    fecha_nacimiento, telefono, peso_kg, talla_cm, curp, domicilio
  } = req.body;

  try {
    // Verificar que el jugador pertenece al equipo del capitán
    const check = await pool.query(
      'SELECT id FROM jugadores WHERE id = $1 AND equipo_id = $2', [id, equipo_id]
    );
    if (check.rows.length === 0)
      return res.status(404).json({ error: 'Jugador no encontrado.' });

    // Archivos nuevos (si los subieron)
    const foto_url    = req.files?.foto?.[0]  ? `/uploads/${req.files.foto[0].filename}`  : undefined;
    const ine_pdf_url  = req.files?.ine?.[0]  ? `/uploads/${req.files.ine[0].filename}`   : undefined;
    const acta_pdf_url = req.files?.acta?.[0] ? `/uploads/${req.files.acta[0].filename}`  : undefined;

    const sets = [];
    const vals = [];
    let i = 1;
    const add = (col, val) => { if (val !== undefined) { sets.push(`${col}=$${i++}`); vals.push(val); } };

    add('nombre',           nombre?.trim());
    add('numero_camiseta',  numero_camiseta);
    add('posicion',         posicion);
    add('fecha_nacimiento', fecha_nacimiento);
    add('telefono',         telefono);
    add('peso_kg',          peso_kg);
    add('talla_cm',         talla_cm);
    add('curp',             curp);
    add('domicilio',        domicilio);
    add('foto_url',         foto_url);
    add('ine_pdf_url',      ine_pdf_url);
    add('acta_pdf_url',     acta_pdf_url);

    if (sets.length === 0)
      return res.status(400).json({ error: 'No hay datos para actualizar.' });

    vals.push(id);
    const query = `UPDATE jugadores SET ${sets.join(', ')} WHERE id=$${i} RETURNING *`;
    const result = await pool.query(query, vals);
    res.json({ jugador: result.rows[0], mensaje: 'Jugador actualizado.' });
  } catch (err) {
    console.error('Error actualizarJugador:', err.message);
    res.status(500).json({ error: 'Error interno.' });
  }
};

// ── GET /api/capitan/perfil ───────────────────────────────
const getPerfil = async (req, res) => {
  const { id } = req.usuario;
  try {
    const result = await pool.query(
      `SELECT u.nombre, u.email, c.suscripcion_activa,
              e.nombre AS nombre_equipo, t.nombre_liga, t.plan
       FROM usuarios u
       JOIN capitanes c ON c.usuario_id = u.id
       LEFT JOIN equipos e ON c.equipo_id = e.id
       LEFT JOIN tenants t ON c.tenant_id  = t.id
       WHERE u.id = $1`,
      [id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Perfil no encontrado.' });
    res.json({ perfil: result.rows[0] });
  } catch (err) {
    console.error('Error getPerfil:', err.message);
    res.status(500).json({ error: 'Error interno.' });
  }
};

// ── PUT /api/capitan/jugadores/:id/baja ─────────────────
const solicitarBaja = async (req, res) => {
  const { equipo_id } = req.usuario;
  const { id } = req.params;

  try {
    const check = await pool.query(
      'SELECT id FROM jugadores WHERE id = $1 AND equipo_id = $2', [id, equipo_id]
    );
    if (check.rows.length === 0)
      return res.status(404).json({ error: 'Jugador no encontrado.' });

    const result = await pool.query(
      "UPDATE jugadores SET estatus = 'Baja Solicitada' WHERE id = $1 RETURNING *",
      [id]
    );
    res.json({ jugador: result.rows[0], mensaje: 'Baja del jugador solicitada.' });
  } catch (err) {
    console.error('Error solicitarBaja:', err.message);
    res.status(500).json({ error: 'Error interno.' });
  }
};

// ── PUT /api/capitan/mi-equipo/categoria ──────────────────
const actualizarCategoria = async (req, res) => {
  const { equipo_id, tenant_id } = req.usuario;
  const { categoria } = req.body;

  if (!categoria) return res.status(400).json({ error: 'La categoría es requerida.' });

  try {
    const result = await pool.query(
      `UPDATE equipos SET categoria = $1 WHERE id = $2 AND tenant_id = $3 RETURNING categoria`,
      [categoria, equipo_id, tenant_id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Equipo no encontrado.' });
    
    res.json({ mensaje: 'Categoría actualizada correctamente.', categoria: result.rows[0].categoria });
  } catch (err) {
    console.error('Error actualizarCategoria:', err.message);
    res.status(500).json({ error: 'Error interno.' });
  }
};

module.exports = { getMiEquipo, getJugadores, crearJugador, actualizarJugador, getPerfil, solicitarBaja, actualizarCategoria };
