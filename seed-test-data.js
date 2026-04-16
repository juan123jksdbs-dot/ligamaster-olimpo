require('dotenv').config();
const { Client } = require('pg');

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

    // Obtener usuario organizador (carlos)
    const userRes = await client.query(
      "SELECT id FROM usuarios WHERE email = 'carlos@ligatijuana.com'"
    );
    
    if (userRes.rows.length === 0) {
      console.log('❌ Usuario organizador no encontrado');
      process.exit(1);
    }

    const organizador_id = userRes.rows[0].id;

    // Verificar si la liga ya existe
    const existRes = await client.query(
      "SELECT id FROM tenants WHERE organizador_id = $1 LIMIT 1",
      [organizador_id]
    );

    let tenant_id;
    if (existRes.rows.length > 0) {
      tenant_id = existRes.rows[0].id;
      console.log(`✅ Liga existente encontrada con ID: ${tenant_id}`);
    } else {
      // Crear tenant (liga) activo
      const tenantRes = await client.query(
        `INSERT INTO tenants (organizador_id, nombre_liga, slug, email_contacto, telefono, plan, estatus_pago)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [organizador_id, 'Liga Tijuana Profesional', 'liga-tijuana-' + Date.now(), 'carlos@ligatijuana.com', '+525551234567', '3 Meses', true]
      );
      tenant_id = tenantRes.rows[0].id;
      console.log(`✅ Tenant/Liga creado con ID: ${tenant_id}`);
    }

    // Crear torneo activo para esa liga
    const torneoRes = await client.query(
      `SELECT id FROM torneos WHERE tenant_id = $1 AND estatus = 'Activo' LIMIT 1`,
      [tenant_id]
    );

    if (torneoRes.rows.length === 0) {
      const newTorneoRes = await client.query(
        `INSERT INTO torneos (tenant_id, nombre, estatus)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [tenant_id, 'Torneo 2026', 'Activo']
      );
      console.log(`✅ Torneo creado con ID: ${newTorneoRes.rows[0].id}`);
    } else {
      console.log(`✅ Torneo activo ya existe con ID: ${torneoRes.rows[0].id}`);
    }

    console.log('\n✅ Datos de prueba listos');
    console.log(`  Liga ID: ${tenant_id}`);
    console.log(`  Nombre: Liga Tijuana Profesional`);
    console.log(`  Estatus: Activo (listo para capítanes)`);

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
