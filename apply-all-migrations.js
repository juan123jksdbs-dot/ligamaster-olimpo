// apply-all-migrations.js
// Script to apply all migrations in order to the database
// Usage: node apply-all-migrations.js <DATABASE_URL>

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const dbUrl = process.argv[2] || process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('❌ Error: DATABASE_URL not provided as argument or in .env');
  process.exit(1);
}

const client = new Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

const migrationsDir = path.join(__dirname, 'migrations');

async function run() {
  try {
    await client.connect();
    console.log('✅ Connected to database');

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort(); // Apply in alphabetical order (v1, v2, v3...)

    console.log(`🚀 Found ${files.length} migrations to check.`);

    for (const file of files) {
      console.log(`📄 Applying ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      
      try {
        await client.query(sql);
        console.log(`✅ ${file} applied successfully.`);
      } catch (err) {
        // Some migrations might fail if they add columns that already exist
        // or if they have errors. We log and continue if it's "already exists"
        if (err.message.includes('already exists')) {
          console.warn(`⚠️  ${file} partially applied: ${err.message}`);
        } else {
          console.error(`❌ Error applying ${file}:`, err.message);
          // throw err; // Optional: stop on first error
        }
      }
    }

    console.log('\n✨ All migrations processed.');

  } catch (err) {
    console.error('❌ General Error:', err.message);
  } finally {
    await client.end();
  }
}

run();
