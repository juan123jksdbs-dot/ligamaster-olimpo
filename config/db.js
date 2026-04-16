// config/db.js
// ─────────────────────────────────────────────────────────
// Conexión a PostgreSQL usando el módulo 'pg' (node-postgres)
// Pool = grupo de conexiones reutilizables (más eficiente que
// abrir/cerrar una conexión por cada petición HTTP).
// ─────────────────────────────────────────────────────────
require('dotenv').config();
const { Pool } = require('pg');

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false // Requerido para Render/Heroku en niveles gratuitos
      }
    }
  : {
      host:     process.env.DB_HOST     || 'localhost',
      port:     process.env.DB_PORT     || 5432,
      database: process.env.DB_NAME     || 'ligamaster',
      user:     process.env.DB_USER     || 'postgres',
      password: process.env.DB_PASSWORD || '',
    };

const pool = new Pool(poolConfig);

// Verificar la conexión al iniciar
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Error conectando a PostgreSQL:', err.message);
  } else {
    console.log('✅ Conectado a PostgreSQL correctamente');
    release(); // Devolver la conexión al pool
  }
});

module.exports = pool;