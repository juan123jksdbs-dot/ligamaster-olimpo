require('dotenv').config();
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const client = new Client({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ligamaster',
});

(async () => {
  try {
    await client.connect();
    console.log('✅ Conectado a PostgreSQL');

    // Crear tabla usuarios si no existe
    await client.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id            SERIAL       PRIMARY KEY,
        nombre        VARCHAR(100) NOT NULL,
        email         VARCHAR(150) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        rol           VARCHAR(20)  NOT NULL CHECK (rol IN ('superadmin', 'organizador')),
        creado_en     TIMESTAMP    DEFAULT NOW()
      );
    `);
    console.log('✅ Tabla usuarios creada/verificada');

    // Hashear contraseña
    const passwordHash = await bcrypt.hash('admin123', 10);

    // Insertar o actualizar superadmin
    await client.query(`
      INSERT INTO usuarios (nombre, email, password_hash, rol)
      VALUES ('Super Administrador', 'superadmin@ligamaster.com', $1, 'superadmin')
      ON CONFLICT (email) DO UPDATE SET 
        nombre = 'Super Administrador',
        password_hash = $1,
        rol = 'superadmin';
    `, [passwordHash]);
    console.log('✅ SuperAdmin insertado/actualizado');

    // Insertar o actualizar organizador
    await client.query(`
      INSERT INTO usuarios (nombre, email, password_hash, rol)
      VALUES ('Carlos Mendoza', 'carlos@ligatijuana.com', $1, 'organizador')
      ON CONFLICT (email) DO UPDATE SET 
        nombre = 'Carlos Mendoza',
        password_hash = $1,
        rol = 'organizador';
    `, [passwordHash]);
    console.log('✅ Organizador insertado/actualizado');

    console.log('\n✅ Base de datos lista para usar');
    console.log('Credenciales de prueba:');
    console.log('  SuperAdmin: superadmin@ligamaster.com / admin123');
    console.log('  Organizador: carlos@ligatijuana.com / admin123');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
