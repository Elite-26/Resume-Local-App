import type { PoolClient } from 'pg';

export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE interview_steps
      ALTER COLUMN interview_date TYPE TEXT
      USING COALESCE(interview_date::text, '');
  `);
  await client.query(`
    ALTER TABLE interview_steps
      ALTER COLUMN interview_date SET DEFAULT '';
  `);
  await client.query(`
    ALTER TABLE interview_steps
      ALTER COLUMN interview_date SET NOT NULL;
  `);
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE interview_steps
      ALTER COLUMN interview_date DROP NOT NULL,
      ALTER COLUMN interview_date DROP DEFAULT,
      ALTER COLUMN interview_date TYPE DATE
      USING NULLIF(interview_date, '')::date;
  `);
}
