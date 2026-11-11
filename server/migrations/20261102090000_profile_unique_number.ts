import type { PoolClient } from 'pg';

/**
 * Output numbers are per profile. Each profile starts at 1 instead of
 * continuing the last number used by another profile.
 */
export async function up(client: PoolClient): Promise<void> {
  await client.query(`DROP INDEX IF EXISTS idx_resume_builds_user_unique_number;`);

  await client.query(`
    WITH numbered AS (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY user_id, profile_id
          ORDER BY created_at ASC, id ASC
        ) AS n
      FROM resume_builds
      WHERE status = 'generated' AND profile_id IS NOT NULL
    )
    UPDATE resume_builds b
    SET unique_number = numbered.n
    FROM numbered
    WHERE b.id = numbered.id;
  `);

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_resume_builds_user_profile_unique_number
      ON resume_builds (user_id, profile_id, unique_number)
      WHERE unique_number IS NOT NULL AND profile_id IS NOT NULL;
  `);
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`DROP INDEX IF EXISTS idx_resume_builds_user_profile_unique_number;`);

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
    WHERE b.id = numbered.id;
  `);

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_resume_builds_user_unique_number
      ON resume_builds (user_id, unique_number)
      WHERE unique_number IS NOT NULL;
  `);
}
