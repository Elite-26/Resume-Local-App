import type { PoolClient } from 'pg';

export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS developers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      developer_no INTEGER NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      country TEXT NOT NULL DEFAULT '',
      experience TEXT NOT NULL DEFAULT '',
      whatsapp TEXT NOT NULL DEFAULT '',
      emails TEXT[] NOT NULL DEFAULT '{}',
      linkedin TEXT NOT NULL DEFAULT '',
      other TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_developers_no
      ON developers (developer_no);
  `);
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`DROP TABLE IF EXISTS developers;`);
}
