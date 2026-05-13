require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { pool } = require('../src/lib/db');

async function migrate() {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).sort();

  for (const file of files) {
    if (!file.endsWith('.sql')) continue;
    console.log(`Running migration: ${file}`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    try {
      await pool.query(sql);
    } catch (err) {
      console.error(`Failed on ${file}:`, JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
      throw err;
    }
    console.log(`  Done: ${file}`);
  }

  console.log('All migrations complete.');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message, err.detail || '', err.hint || '');
  process.exit(1);
});
