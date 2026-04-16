// migrations/apply-v2.js
// Aplica la migración v2 (rol capitán, tabla capitanes, campos jugadores)
require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const pool = require('../config/db');

async function applyMigration() {
  const sql = fs.readFileSync(path.join(__dirname, 'v2-capitan.sql'), 'utf8');
  const client = await pool.connect();
  try {
    console.log('\n🔄 Aplicando migración v2-capitan...\n');
    // Ejecutar cada statement de forma segura
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('SELECT'));

    for (const stmt of statements) {
      try {
        await client.query(stmt);
        const firstLine = stmt.split('\n').find(l => l.trim()) || stmt.substring(0, 60);
        console.log(`✅ ${firstLine.trim().substring(0, 80)}...`);
      } catch (err) {
        // Ignorar errores de "ya existe"
        if (err.message.includes('already exists') || err.message.includes('ya existe')) {
          console.log(`⚠️  Ya existe (omitido): ${err.message.substring(0, 60)}`);
        } else {
          console.error(`❌ Error: ${err.message}`);
        }
      }
    }

    // El SELECT final de confirmación
    const res = await client.query("SELECT 'Migración v2 aplicada correctamente ✓' AS resultado");
    console.log('\n' + res.rows[0].resultado);
  } finally {
    client.release();
    await pool.end();
  }
}

applyMigration().catch(err => {
  console.error('Error fatal en migración:', err.message);
  process.exit(1);
});
