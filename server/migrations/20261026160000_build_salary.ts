import type { PoolClient } from 'pg';

export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE resume_builds
      ADD COLUMN IF NOT EXISTS salary TEXT NOT NULL DEFAULT '';
  `);
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE resume_builds
      DROP COLUMN IF EXISTS salary;
  `);
}
