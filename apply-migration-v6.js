// apply-migration.js
const pool = require('./config/db');
const fs = require('fs');
const path = require('path');

async function run() {
  const sqlFile = path.join(__dirname, 'migrations', 'v6-precios-categorias.sql');
  const sql = fs.readFileSync(sqlFile, 'utf8');

  const client = await pool.connect();
  try {
    console.log('Applying migration v6...');
    await client.query(sql);
    console.log('Migration v6 applied successfully!');
  } catch (err) {
    console.error('Error applying migration:', err.message);
  } finally {
    client.release();
    process.exit();
  }
}

run();
