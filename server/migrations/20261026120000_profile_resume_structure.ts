import type { PoolClient } from 'pg';

/**
 * static: company, role, and location come from the profile.
 * dynamic: those fields are read from the resume content.
 */
export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE profiles
      ADD COLUMN IF NOT EXISTS resume_structure TEXT NOT NULL DEFAULT 'static';
  `);

  await client.query(`
    ALTER TABLE profiles
      DROP CONSTRAINT IF EXISTS profiles_resume_structure_check;
  `);

  await client.query(`
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_resume_structure_check
      CHECK (resume_structure IN ('static', 'dynamic'));
  `);
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE profiles
      DROP CONSTRAINT IF EXISTS profiles_resume_structure_check;
  `);
  await client.query(`
    ALTER TABLE profiles
      DROP COLUMN IF EXISTS resume_structure;
  `);
}
