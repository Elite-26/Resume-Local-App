import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { pool } from './pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, '../../migrations');

export type Migration = {
  id: string;
  name: string;
  up: (client: import('pg').PoolClient) => Promise<void>;
  down: (client: import('pg').PoolClient) => Promise<void>;
};

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function loadMigrations(): Promise<Migration[]> {
  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.ts') || f.endsWith('.js'))
    .sort();

  const migrations: Migration[] = [];
  for (const file of files) {
    const mod = await import(pathToFileURL(path.join(migrationsDir, file)).href);
    migrations.push({
      id: file.replace(/\.(ts|js)$/, ''),
      name: file,
      up: mod.up,
      down: mod.down,
    });
  }
  return migrations;
}

async function getApplied(): Promise<Set<string>> {
  const { rows } = await pool.query<{ id: string }>('SELECT id FROM schema_migrations');
  return new Set(rows.map((r) => r.id));
}

async function migrateUp() {
  await ensureMigrationsTable();
  const migrations = await loadMigrations();
  const applied = await getApplied();

  for (const migration of migrations) {
    if (applied.has(migration.id)) continue;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      console.log(`↑ Applying ${migration.name}`);
      await migration.up(client);
      await client.query(
        'INSERT INTO schema_migrations (id, name) VALUES ($1, $2)',
        [migration.id, migration.name]
      );
      await client.query('COMMIT');
      console.log(`✓ Applied ${migration.name}`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
  console.log('Migrations complete.');
}

async function migrateDown() {
  await ensureMigrationsTable();
  const migrations = await loadMigrations();
  const { rows } = await pool.query<{ id: string }>(
    'SELECT id FROM schema_migrations ORDER BY applied_at DESC LIMIT 1'
  );
  if (!rows.length) {
    console.log('No migrations to roll back.');
    return;
  }
  const lastId = rows[0].id;
  const migration = migrations.find((m) => m.id === lastId);
  if (!migration) {
    throw new Error(`Migration file for ${lastId} not found`);
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log(`↓ Rolling back ${migration.name}`);
    await migration.down(client);
    await client.query('DELETE FROM schema_migrations WHERE id = $1', [lastId]);
    await client.query('COMMIT');
    console.log(`✓ Rolled back ${migration.name}`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function createMigration(name?: string) {
  const slug = (name || 'migration')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  const stamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, '')
    .slice(0, 14);
  const filename = `${stamp}_${slug}.ts`;
  const filepath = path.join(migrationsDir, filename);
  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
  }
  const template = `import type { PoolClient } from 'pg';

export async function up(client: PoolClient): Promise<void> {
  // await client.query(\`\`);
}

export async function down(client: PoolClient): Promise<void> {
  // await client.query(\`\`);
}
`;
  fs.writeFileSync(filepath, template);
  console.log(`Created ${filepath}`);
}

const command = process.argv[2];
const arg = process.argv[3];

try {
  if (command === 'up') await migrateUp();
  else if (command === 'down') await migrateDown();
  else if (command === 'create') await createMigration(arg);
  else {
    console.log('Usage: migrate.ts [up|down|create <name>]');
    process.exit(1);
  }
} catch (err) {
  console.error(err);
  process.exit(1);
} finally {
  await pool.end();
}
