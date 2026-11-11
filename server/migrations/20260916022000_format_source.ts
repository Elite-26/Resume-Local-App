import type { PoolClient } from 'pg';

/**
 * Track whether a resume format came from the project templates/ folder
 * or an admin upload.
 */
export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE resume_formats
      ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'upload';
  `);

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_resume_formats_project_filename
      ON resume_formats (lower(filename))
      WHERE source = 'project';
  `);
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`DROP INDEX IF EXISTS idx_resume_formats_project_filename;`);
  await client.query(`ALTER TABLE resume_formats DROP COLUMN IF EXISTS source;`);
}
