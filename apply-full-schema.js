require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const clientConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    }
  : {
      host:     process.env.DB_HOST     || 'localhost',
      port:     process.env.DB_PORT     || 5432,
      user:     process.env.DB_USER     || 'postgres',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME     || 'ligamaster',
    };

const client = new Client(clientConfig);

(async () => {
  try {
    console.log('⏳ Leyendo schema.sql...');
    const dbPath = path.join(__dirname, 'schema.sql');
    const sql = fs.readFileSync(dbPath, 'utf8');

    console.log('⏳ Conectando a la base de datos...');
    await client.connect();
    console.log('✅ Conectado a PostgreSQL');

    console.log('⏳ Aplicando esquema completo...');
    await client.query(sql);
    console.log('✅ Esquema aplicado correctamente');

  } catch (err) {
    console.error('❌ Error aplicando esquema:', err.message);
  } finally {
    await client.end();
  }
})();
