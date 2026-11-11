import type { PoolClient } from 'pg';

/**
 * Store a recoverable plain password for admin user management UI.
 * Auth still uses password_hash for login verification.
 */
export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS password_plain TEXT;
  `);
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE users
      DROP COLUMN IF EXISTS password_plain;
  `);
}
