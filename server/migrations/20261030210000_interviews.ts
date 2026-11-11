import type { PoolClient } from 'pg';

export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS interview_options (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      field TEXT NOT NULL CHECK (field IN ('profile', 'interviewee', 'type', 'method', 'status', 'result')),
      label TEXT NOT NULL,
      color_index INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_interview_options_field_label
      ON interview_options (field, lower(label));
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS interview_processes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      profile_label TEXT NOT NULL DEFAULT '',
      developer_label TEXT NOT NULL DEFAULT '',
      company TEXT NOT NULL DEFAULT '',
      position TEXT NOT NULL DEFAULT '',
      result_label TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS interview_steps (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      process_id UUID NOT NULL REFERENCES interview_processes(id) ON DELETE CASCADE,
      step_no INTEGER NOT NULL,
      type_label TEXT NOT NULL DEFAULT '',
      method_label TEXT NOT NULL DEFAULT '',
      interviewer TEXT NOT NULL DEFAULT '',
      interview_date TEXT NOT NULL DEFAULT '',
      status_label TEXT NOT NULL DEFAULT '',
      UNIQUE (process_id, step_no)
    );
  `);

  await client.query(`
    INSERT INTO interview_options (field, label, color_index, sort_order)
    VALUES
      ('type', 'HR', 0, 0),
      ('type', 'Technical', 1, 1),
      ('type', 'Behavioral', 4, 2),
      ('type', 'Manager', 6, 3),
      ('type', 'Final', 2, 4),
      ('method', 'Phone', 5, 0),
      ('method', 'Video', 0, 1),
      ('method', 'Onsite', 6, 2),
      ('status', 'Scheduled', 0, 0),
      ('status', 'Pending', 2, 1),
      ('status', 'Passed', 1, 2),
      ('status', 'Failed', 3, 3),
      ('result', 'In progress', 2, 0),
      ('result', 'Offer', 1, 1),
      ('result', 'Rejected', 3, 2),
      ('result', 'Withdrawn', 7, 3)
  `);
}

export async function down(client: PoolClient): Promise<void> {
  await client.query(`DROP TABLE IF EXISTS interview_steps;`);
  await client.query(`DROP TABLE IF EXISTS interview_processes;`);
  await client.query(`DROP TABLE IF EXISTS interview_options;`);
}
