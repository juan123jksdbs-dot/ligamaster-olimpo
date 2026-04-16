// migrations/apply-v2-full.js
// Aplica cada paso de la migración v2 de forma explícita y robusta
require('dotenv').config();
const pool = require('../config/db');

async function run() {
  const client = await pool.connect();

  const steps = [
    {
      name: 'Ampliar CHECK rol usuarios → incluir capitan',
      sql: `DO $$ BEGIN
        ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check;
        ALTER TABLE usuarios ADD CONSTRAINT usuarios_rol_check
          CHECK (rol IN ('superadmin', 'organizador', 'capitan'));
      EXCEPTION WHEN others THEN NULL; END $$;`
    },
    {
      name: 'Agregar foto_url a jugadores',
      sql: `ALTER TABLE jugadores ADD COLUMN IF NOT EXISTS foto_url VARCHAR(300);`
    },
    {
      name: 'Agregar ine_pdf_url a jugadores',
      sql: `ALTER TABLE jugadores ADD COLUMN IF NOT EXISTS ine_pdf_url VARCHAR(300);`
    },
    {
      name: 'Agregar acta_pdf_url a jugadores',
      sql: `ALTER TABLE jugadores ADD COLUMN IF NOT EXISTS acta_pdf_url VARCHAR(300);`
    },
    {
      name: 'Agregar telefono a jugadores',
      sql: `ALTER TABLE jugadores ADD COLUMN IF NOT EXISTS telefono VARCHAR(20);`
    },
    {
      name: 'Agregar peso_kg a jugadores',
      sql: `ALTER TABLE jugadores ADD COLUMN IF NOT EXISTS peso_kg DECIMAL(5,2);`
    },
    {
      name: 'Agregar talla_cm a jugadores',
      sql: `ALTER TABLE jugadores ADD COLUMN IF NOT EXISTS talla_cm INT;`
    },
    {
      name: 'Agregar curp a jugadores',
      sql: `ALTER TABLE jugadores ADD COLUMN IF NOT EXISTS curp VARCHAR(30);`
    },
    {
      name: 'Agregar domicilio a jugadores',
      sql: `ALTER TABLE jugadores ADD COLUMN IF NOT EXISTS domicilio TEXT;`
    },
    {
      name: 'Agregar capitan_id a equipos',
      sql: `ALTER TABLE equipos ADD COLUMN IF NOT EXISTS capitan_id INT REFERENCES usuarios(id) ON DELETE SET NULL;`
    },
    {
      name: 'Crear tabla capitanes',
      sql: `CREATE TABLE IF NOT EXISTS capitanes (
        id                 SERIAL   PRIMARY KEY,
        usuario_id         INT      NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        equipo_id          INT      REFERENCES equipos(id) ON DELETE SET NULL,
        tenant_id          INT      NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        suscripcion_activa BOOLEAN  DEFAULT FALSE,
        creado_en          TIMESTAMP DEFAULT NOW()
      );`
    },
    {
      name: 'Índice equipos por tenant+nombre',
      sql: `CREATE INDEX IF NOT EXISTS idx_equipos_nombre_tenant ON equipos(tenant_id, nombre);`
    }
  ];

  console.log('\n🔄 Aplicando migración v2 (completa)...\n');
  let ok = 0, fail = 0;

  for (const step of steps) {
    try {
      await client.query(step.sql);
      console.log(`✅ ${step.name}`);
      ok++;
    } catch (err) {
      console.error(`❌ ${step.name}: ${err.message}`);
      fail++;
    }
  }

  client.release();
  await pool.end();
  console.log(`\n✅ Completado: ${ok} pasos correctos | ❌ ${fail} errores\n`);
}

run().catch(err => {
  console.error('Error fatal:', err.message);
  process.exit(1);
});
