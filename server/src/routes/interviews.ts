import { Router } from 'express';
import type { PoolClient } from 'pg';
import { pool, query } from '../db/pool.js';

const router = Router();

const OPTION_FIELDS = ['profile', 'interviewee', 'type', 'method', 'status', 'result'] as const;
type OptionField = (typeof OPTION_FIELDS)[number];

type OptionRow = {
  id: string;
  field: OptionField;
  label: string;
  color_index: number;
  sort_order: number;
};

type ProcessRow = {
  id: string;
  profile_label: string;
  developer_label: string;
  company: string;
  position: string;
  result_label: string;
  note: string;
};

type StepRow = {
  process_id: string;
  step_no: number;
  type_label: string;
  method_label: string;
  interviewer: string;
  interview_date: string;
  status_label: string;
};

type StepInput = {
  type: string;
  method: string;
  interviewer: string;
  date: string;
  status: string;
};

type ProcessInput = {
  profile: string;
  developer: string;
  company: string;
  position: string;
  result: string;
  note: string;
  steps: StepInput[];
};

function clip(value: unknown, max: number) {
  return String(value ?? '').trim().slice(0, max);
}

function formatDate(value: unknown): string {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${value.getFullYear()}-${month}-${day}`;
  }
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
}

function emptyStep(): StepInput {
  return { type: '', method: '', interviewer: '', date: '', status: '' };
}

function normalizeDate(value: unknown): string {
  const date = clip(value, 10);
  if (!date) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Date must be a calendar date');
  }
  return date;
}

function normalizeSteps(value: unknown): StepInput[] {
  const source = Array.isArray(value) && value.length > 0 ? value : [emptyStep()];
  if (source.length > 20) throw new Error('A process can have at most 20 steps');
  return source.map((step) => {
    const row = (step || {}) as Record<string, unknown>;
    return {
      type: clip(row.type, 80),
      method: clip(row.method, 80),
      interviewer: clip(row.interviewer, 200),
      date: normalizeDate(row.date),
      status: clip(row.status, 80),
    };
  });
}

function normalizeProcess(body: Record<string, unknown>): ProcessInput {
  return {
    profile: clip(body.profile, 200),
    developer: clip(body.developer, 200),
    company: clip(body.company, 200),
    position: clip(body.position, 200),
    result: clip(body.result, 80),
    note: clip(body.note, 4000),
    steps: normalizeSteps(body.steps),
  };
}

function isOptionField(value: string): value is OptionField {
  return (OPTION_FIELDS as readonly string[]).includes(value);
}

function hashColor(label: string) {
  let hash = 0;
  for (const char of label) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % 10;
}

function mapOption(row: { id: string | null; label: string; color_index: number }) {
  return { id: row.id, label: row.label, colorIndex: row.color_index };
}

async function loadBoard(db: { query: PoolClient['query'] } = pool) {
  const [processes, steps, options, profiles, developers, hides] = await Promise.all([
    db.query<ProcessRow>(
      `SELECT id, profile_label, developer_label, company, position, result_label, note
       FROM interview_processes
       ORDER BY created_at ASC`
    ),
    db.query<StepRow>(
      `SELECT process_id, step_no, type_label, method_label, interviewer, interview_date, status_label
       FROM interview_steps
       ORDER BY step_no ASC`
    ),
    db.query<OptionRow>(
      `SELECT id, field, label, color_index, sort_order
       FROM interview_options
       ORDER BY sort_order ASC, label ASC`
    ),
    db.query<{ label: string }>(
      `SELECT full_name AS label FROM profiles WHERE btrim(full_name) <> '' ORDER BY full_name ASC`
    ),
    db.query<{ label: string }>(
      `SELECT name AS label FROM developers WHERE btrim(name) <> '' ORDER BY name ASC`
    ),
    db.query<{ field: string; label: string }>(
      `SELECT field, label FROM interview_option_hides`
    ),
  ]);

  const stepsByProcess = new Map<string, StepRow[]>();
  for (const step of steps.rows) {
    const list = stepsByProcess.get(step.process_id) || [];
    list.push(step);
    stepsByProcess.set(step.process_id, list);
  }

  const stored = new Map<OptionField, OptionRow[]>();
  for (const field of OPTION_FIELDS) stored.set(field, []);
  for (const option of options.rows) stored.get(option.field)?.push(option);

  const hidden = new Set(hides.rows.map((row) => `${row.field}:${row.label.toLowerCase()}`));

  function merge(field: OptionField, linked: string[]) {
    const rows = (stored.get(field) || []).filter(
      (row) => !hidden.has(`${field}:${row.label.toLowerCase()}`)
    );
    const seen = new Set(rows.map((row) => row.label.toLowerCase()));
    const merged = rows.map((row) => mapOption(row));
    const extras = linked
      .filter((label) => {
        const trimmed = label.trim();
        if (!trimmed) return false;
        const key = trimmed.toLowerCase();
        return !seen.has(key) && !hidden.has(`${field}:${key}`);
      })
      .map((label) => ({ id: null, label: label.trim(), colorIndex: hashColor(label.trim()) }))
      .sort((a, b) => a.label.localeCompare(b.label));
    const combined = [...merged, ...extras];
    if (field === 'profile' || field === 'interviewee') {
      combined.sort((a, b) => a.label.localeCompare(b.label));
    }
    return combined;
  }

  return {
    processes: processes.rows.map((row) => ({
      id: row.id,
      profile: row.profile_label,
      developer: row.developer_label,
      company: row.company,
      position: row.position,
      result: row.result_label,
      note: row.note,
      steps: (stepsByProcess.get(row.id) || []).map((step) => ({
        type: step.type_label,
        method: step.method_label,
        interviewer: step.interviewer,
        date: formatDate(step.interview_date),
        status: step.status_label,
      })),
    })).map((row) => ({
      ...row,
      steps: row.steps.length > 0 ? row.steps : [emptyStep()],
    })),
    options: {
      profile: merge('profile', profiles.rows.map((row) => row.label)),
      interviewee: merge('interviewee', developers.rows.map((row) => row.label)),
      type: merge('type', []),
      method: merge('method', []),
      status: merge('status', []),
      result: merge('result', []),
    },
  };
}

async function insertProcess(client: PoolClient, input: ProcessInput) {
  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO interview_processes
      (profile_label, developer_label, company, position, result_label, note)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [input.profile, input.developer, input.company, input.position, input.result, input.note]
  );
  const id = rows[0].id;
  for (let i = 0; i < input.steps.length; i++) {
    const step = input.steps[i];
    await client.query(
      `INSERT INTO interview_steps
        (process_id, step_no, type_label, method_label, interviewer, interview_date, status_label)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, i + 1, step.type, step.method, step.interviewer, step.date, step.status]
    );
  }
  return id;
}

router.get('/', async (_req, res) => {
  const board = await loadBoard();
  return res.json(board);
});

router.post('/', async (req, res) => {
  const client = await pool.connect();
  try {
    const input = normalizeProcess((req.body || {}) as Record<string, unknown>);
    await client.query('BEGIN');
    const id = await insertProcess(client, input);
    await client.query('COMMIT');
    const board = await loadBoard();
    const process = board.processes.find((row) => row.id === id);
    return res.status(201).json({ process });
  } catch (err) {
    await client.query('ROLLBACK');
    const message = err instanceof Error ? err.message : 'Failed to add interview';
    if (message.startsWith('Date') || message.startsWith('A process')) {
      return res.status(400).json({ error: message });
    }
    console.error(err);
    return res.status(500).json({ error: 'Failed to add interview' });
  } finally {
    client.release();
  }
});

router.put('/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    const input = normalizeProcess((req.body || {}) as Record<string, unknown>);
    await client.query('BEGIN');
    const updated = await client.query(
      `UPDATE interview_processes SET
        profile_label = $1,
        developer_label = $2,
        company = $3,
        position = $4,
        result_label = $5,
        note = $6,
        updated_at = NOW()
       WHERE id = $7`,
      [
        input.profile,
        input.developer,
        input.company,
        input.position,
        input.result,
        input.note,
        req.params.id,
      ]
    );
    if (!updated.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Interview not found' });
    }
    await client.query(`DELETE FROM interview_steps WHERE process_id = $1`, [req.params.id]);
    for (let i = 0; i < input.steps.length; i++) {
      const step = input.steps[i];
      await client.query(
        `INSERT INTO interview_steps
          (process_id, step_no, type_label, method_label, interviewer, interview_date, status_label)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [req.params.id, i + 1, step.type, step.method, step.interviewer, step.date, step.status]
      );
    }
    await client.query('COMMIT');
    return res.json({ ok: true });
  } catch (err) {
    await client.query('ROLLBACK');
    const message = err instanceof Error ? err.message : 'Failed to save interview';
    if (message.startsWith('Date') || message.startsWith('A process')) {
      return res.status(400).json({ error: message });
    }
    console.error(err);
    return res.status(500).json({ error: 'Failed to save interview' });
  } finally {
    client.release();
  }
});

router.delete('/:id', async (req, res) => {
  const { rowCount } = await query(`DELETE FROM interview_processes WHERE id = $1`, [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Interview not found' });
  return res.json({ ok: true });
});

router.post('/options', async (req, res) => {
  const field = String(req.body?.field || '');
  const label = clip(req.body?.label, 80);
  if (!isOptionField(field)) return res.status(400).json({ error: 'Unknown option list' });
  if (!label) return res.status(400).json({ error: 'Label is required' });

  await query(
    `DELETE FROM interview_option_hides WHERE field = $1 AND lower(label) = lower($2)`,
    [field, label]
  );

  const existing = await query<OptionRow>(
    `SELECT id, field, label, color_index, sort_order
     FROM interview_options
     WHERE field = $1 AND lower(label) = lower($2)`,
    [field, label]
  );
  if (existing.rows[0]) return res.json({ option: mapOption(existing.rows[0]) });

  const { rows } = await query<OptionRow>(
    `INSERT INTO interview_options (field, label, color_index, sort_order)
     VALUES (
       $1,
       $2,
       (SELECT COUNT(*) FROM interview_options WHERE field = $1) % 10,
       (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM interview_options WHERE field = $1)
     )
     RETURNING id, field, label, color_index, sort_order`,
    [field, label]
  );
  return res.status(201).json({ option: mapOption(rows[0]) });
});

router.post('/options/remove', async (req, res) => {
  const field = String(req.body?.field || '');
  const label = clip(req.body?.label, 80);
  if (!isOptionField(field)) return res.status(400).json({ error: 'Unknown option list' });
  if (!label) return res.status(400).json({ error: 'Label is required' });

  await query(
    `DELETE FROM interview_options WHERE field = $1 AND lower(label) = lower($2)`,
    [field, label]
  );
  await query(
    `INSERT INTO interview_option_hides (field, label)
     VALUES ($1, $2)
     ON CONFLICT (field, lower(label)) DO NOTHING`,
    [field, label]
  );
  return res.json({ ok: true });
});

export default router;
