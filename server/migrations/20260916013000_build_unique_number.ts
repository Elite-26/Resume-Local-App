import type { PoolClient } from 'pg';

/**
 * Persist the per-user application sequence number used in output folder names.
 */
export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE resume_builds
      ADD COLUMN IF NOT EXISTS unique_number INTEGER;
  `);

  await client.query(`
    WITH numbered AS (
      SELECT
        id,
        ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at ASC, id ASC) AS n
      FROM resume_builds
      WHERE status = 'generated'
    )
    UPDATE resume_builds b
    SET unique_number = numbered.n
    FROM numbered
    WHERE b.id = numbered.id
      AND b.unique_number IS NULL;
  `);

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_resume_builds_user_unique_number
      ON resume_builds (user_id, unique_number)
      WHERE unique_number IS NOT NULL;
  `);
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`DROP INDEX IF EXISTS idx_resume_builds_user_unique_number;`);
  await client.query(`ALTER TABLE resume_builds DROP COLUMN IF EXISTS unique_number;`);
}
