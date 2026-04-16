require('dotenv').config();
const { Client } = require('pg');

const clientConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'ligamaster',
    };

const client = new Client(clientConfig);

(async () => {
  try {
    await client.connect();
    console.log('✅ Conectado a PostgreSQL');

    // Crear tabla usuarios
    await client.query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id            SERIAL       PRIMARY KEY,
        nombre        VARCHAR(100) NOT NULL,
        email         VARCHAR(150) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        rol           VARCHAR(20)  NOT NULL CHECK (rol IN ('superadmin', 'organizador', 'capitan')),
        creado_en     TIMESTAMP    DEFAULT NOW()
      );
    `);
    console.log('✅ Tabla usuarios creada/verificada');

    // Crear tabla tenants
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id                SERIAL       PRIMARY KEY,
        nombre_liga       VARCHAR(150) NOT NULL,
        slug              VARCHAR(100) UNIQUE NOT NULL,
        email_contacto    VARCHAR(150) NOT NULL,
        telefono          VARCHAR(20),
        plan              VARCHAR(20)  NOT NULL DEFAULT '1 Año'
                          CHECK (plan IN ('3 Meses', '6 Meses', '1 Año')),
        estatus_pago      BOOLEAN      NOT NULL DEFAULT FALSE,
        fecha_registro    TIMESTAMP    DEFAULT NOW(),
        fecha_vencimiento DATE,
        organizador_id    INT          REFERENCES usuarios(id) ON DELETE SET NULL
      );
    `);
    console.log('✅ Tabla tenants creada/verificada');

    // Crear tabla suscripciones
    await client.query(`
      CREATE TABLE IF NOT EXISTS suscripciones (
        id             SERIAL        PRIMARY KEY,
        tenant_id      INT           NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        monto          DECIMAL(8,2)  NOT NULL,
        fecha_pago     TIMESTAMP     DEFAULT NOW(),
        metodo_pago    VARCHAR(50)   DEFAULT 'Simulado',
        confirmado     BOOLEAN       DEFAULT FALSE,
        periodo_inicio DATE,
        periodo_fin    DATE
      );
    `);
    console.log('✅ Tabla suscripciones creada/verificada');

    // Crear tabla recordatorios_pago
    await client.query(`
      CREATE TABLE IF NOT EXISTS recordatorios_pago (
        id         SERIAL    PRIMARY KEY,
        tenant_id  INT       NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        enviado_en TIMESTAMP DEFAULT NOW(),
        mensaje    TEXT,
        leido      BOOLEAN   DEFAULT FALSE
      );
    `);
    console.log('✅ Tabla recordatorios_pago creada/verificada');

    console.log('\n✅ Base de datos inicializada');

  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await client.end();
  }
})();
