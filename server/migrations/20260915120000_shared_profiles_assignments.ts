import type { PoolClient } from 'pg';

/**
 * Profiles become admin-managed templates assignable to many users.
 * Users no longer own a single private profile row.
 */
export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    ALTER TABLE profiles
      ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'Untitled Profile',
      ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS user_profile_assignments (
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, profile_id)
    );
  `);

  // Preserve existing 1:1 profiles as assignments
  await client.query(`
    INSERT INTO user_profile_assignments (user_id, profile_id)
    SELECT user_id, id FROM profiles
    WHERE user_id IS NOT NULL
    ON CONFLICT DO NOTHING;
  `);

  await client.query(`
    UPDATE profiles p
    SET created_by = p.user_id,
        name = COALESCE(NULLIF(TRIM(p.full_name), ''), 'Profile') || ' Profile'
    WHERE p.user_id IS NOT NULL;
  `);

  await client.query(`
    ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_user_id_key;
  `);

  await client.query(`
    ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;
  `);

  await client.query(`
    ALTER TABLE profiles DROP COLUMN IF EXISTS user_id;
  `);

  await client.query(`
    ALTER TABLE resume_builds
      ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_assignments_user ON user_profile_assignments(user_id);
    CREATE INDEX IF NOT EXISTS idx_assignments_profile ON user_profile_assignments(profile_id);
    CREATE INDEX IF NOT EXISTS idx_builds_created ON resume_builds(created_at);
  `);
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`ALTER TABLE resume_builds DROP COLUMN IF EXISTS profile_id;`);
  await client.query(`DROP TABLE IF EXISTS user_profile_assignments;`);

  await client.query(`
    ALTER TABLE profiles
      ADD COLUMN IF NOT EXISTS user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE;
  `);

  await client.query(`
    ALTER TABLE profiles DROP COLUMN IF EXISTS name;
    ALTER TABLE profiles DROP COLUMN IF EXISTS created_by;
  `);
}
