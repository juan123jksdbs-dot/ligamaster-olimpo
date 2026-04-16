// migrations/apply-v3.js
require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const pool = require('../config/db');

async function applyMigration() {
  const sql = fs.readFileSync(path.join(__dirname, 'v3-stats-campos.sql'), 'utf8');
  const client = await pool.connect();
  try {
    console.log('\n🔄 Aplicando migración v3...');

    // Hacemos un split por GO o directamente ejecutamos el string compelto 
    // PostgreSQL puede correr múltiples statements separados por ';'
    await client.query(sql);
    console.log('✅ Migración v3 aplicada correctamente ✓');

  } catch (err) {
    if (err.message.includes('already exists') || err.message.includes('ya existe')) {
      console.log('⚠️  Algunos elementos ya existían.');
    } else {
      console.error(`❌ Error en migración v3: ${err.message}`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

applyMigration();
