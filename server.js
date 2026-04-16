// server.js
// ─────────────────────────────────────────────────────────
// PUNTO DE ENTRADA PRINCIPAL de LigaMaster SaaS
//
// Este archivo configura Express y monta todas las rutas.
// Para correr: node server.js  (o npm run dev con nodemon)
// ─────────────────────────────────────────────────────────
require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');
const bcrypt  = require('bcryptjs');
const pool    = require('./config/db');

const app = express();

// ── Crear carpeta uploads si no existe ────────────────────
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('📁 Carpeta uploads creada en public/uploads');
}

// ── Middlewares globales ───────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Archivos estáticos ────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── Rutas de la API ───────────────────────────────────────
app.use('/api/auth',       require('./routes/authRoutes'));
app.use('/api/public',     require('./routes/publicRoutes'));
app.use('/api/superadmin', require('./routes/superadminRoutes'));
app.use('/api/organizador',require('./routes/organizadorRoutes'));
app.use('/api/tenant',     require('./routes/tenantRoutes'));
app.use('/api/capitan',    require('./routes/capitanRoutes'));

// ── Ruta raíz → Landing Page ──────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── 404 ───────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Ruta ${req.method} ${req.path} no encontrada.` });
});

// ── Sincronizar usuarios por defecto ──────────────────────
async function syncDefaultUsers() {
  try {
    console.log('\n🔄 Sincronizando usuarios por defecto...');
    const passwordHash = await bcrypt.hash('admin123', 10);

    const usuarios = [
      { nombre: 'Super Administrador', email: 'superadmin@ligamaster.com', rol: 'superadmin' },
      { nombre: 'Carlos Mendoza',      email: 'carlos@ligatijuana.com',    rol: 'organizador' }
    ];

    for (const user of usuarios) {
      await pool.query(`
        INSERT INTO usuarios (nombre, email, password_hash, rol)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (email) DO UPDATE SET
          nombre = $1,
          password_hash = $3,
          rol = $4;
      `, [user.nombre, user.email, passwordHash, user.rol]);
    }

    console.log('✅ Usuarios sincronizados correctamente\n');
  } catch (err) {
    console.error('⚠️  Advertencia al sincronizar usuarios:', err.message);
  }
}

// ── Iniciar servidor ──────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`\n🚀 LigaMaster SaaS corriendo en http://localhost:${PORT}`);
  console.log(`🌐 Landing Page:    http://localhost:${PORT}/`);
  console.log(`🔑 Login:           http://localhost:${PORT}/login.html`);
  console.log(`📋 Panel Admin:     http://localhost:${PORT}/dashboard.html`);
  console.log(`⚽ Panel Capitán:   http://localhost:${PORT}/captain-dashboard.html\n`);

  await syncDefaultUsers();
});