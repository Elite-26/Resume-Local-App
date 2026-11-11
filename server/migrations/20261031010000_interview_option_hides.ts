import type { PoolClient } from 'pg';

export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS interview_option_hides (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      field TEXT NOT NULL CHECK (field IN ('profile', 'interviewee', 'type', 'method', 'status', 'result')),
      label TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_interview_option_hides_field_label
      ON interview_option_hides (field, lower(label));
  `);
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`DROP TABLE IF EXISTS interview_option_hides;`);
}
