import type { PoolClient } from 'pg';

export async function up(client: PoolClient): Promise<void> {
  await client.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

  await client.query(`
    CREATE TYPE user_role AS ENUM ('admin', 'user');
  `);

  await client.query(`
    CREATE TABLE users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      google_id TEXT UNIQUE,
      name TEXT NOT NULL DEFAULT '',
      role user_role NOT NULL DEFAULT 'user',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE TABLE profiles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      full_name TEXT NOT NULL DEFAULT '',
      role_title TEXT,
      contact_location TEXT NOT NULL DEFAULT '',
      contact_phone TEXT NOT NULL DEFAULT '',
      contact_email TEXT NOT NULL DEFAULT '',
      contact_linkedin TEXT NOT NULL DEFAULT '',
      experiences JSONB NOT NULL DEFAULT '[]'::jsonb,
      education JSONB NOT NULL DEFAULT '{}'::jsonb,
      prompt TEXT NOT NULL DEFAULT '',
      output_path TEXT NOT NULL DEFAULT '',
      resume_format_id UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE TABLE resume_formats (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      filename TEXT NOT NULL,
      storage_path TEXT NOT NULL,
      uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    ALTER TABLE profiles
    ADD CONSTRAINT profiles_resume_format_id_fkey
    FOREIGN KEY (resume_format_id) REFERENCES resume_formats(id) ON DELETE SET NULL;
  `);

  await client.query(`
    CREATE TABLE job_link_lists (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      links TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE TABLE resume_builds (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      job_link TEXT,
      company TEXT NOT NULL DEFAULT '',
      role_title TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      resume_content TEXT NOT NULL DEFAULT '',
      output_dir TEXT,
      pdf_path TEXT,
      doc_path TEXT,
      jd_path TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE INDEX idx_resume_builds_user ON resume_builds(user_id);
    CREATE INDEX idx_resume_builds_company ON resume_builds(user_id, lower(company));
  `);

  }

export async function down(client: PoolClient): Promise<void> {
  await client.query(`DROP TABLE IF EXISTS resume_builds CASCADE;`);
  await client.query(`DROP TABLE IF EXISTS job_link_lists CASCADE;`);
  await client.query(`ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_resume_format_id_fkey;`);
  await client.query(`DROP TABLE IF EXISTS profiles CASCADE;`);
  await client.query(`DROP TABLE IF EXISTS resume_formats CASCADE;`);
  await client.query(`DROP TABLE IF EXISTS users CASCADE;`);
  await client.query(`DROP TYPE IF EXISTS user_role;`);
}
