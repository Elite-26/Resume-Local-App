import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool, query } from '../db/pool.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import interviewRoutes from './interviews.js';

const router = Router();

router.use(requireAuth, requireAdmin);
router.use('/interviews', interviewRoutes);

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  created_at: Date;
  password_plain?: string | null;
};

function mapUser(u: UserRow) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    created_at: u.created_at,
    password: u.password_plain || '',
  };
}

// ── Users ──────────────────────────────────────────────
router.get('/users', async (_req, res) => {
  const { rows } = await query<UserRow>(
    `SELECT id, email, name, role, created_at, password_plain
     FROM users ORDER BY created_at DESC`
  );
  return res.json({ users: rows.map(mapUser) });
});

router.post('/users', async (req, res) => {
  try {
    const { email, password, name, role } = req.body as {
      email?: string;
      password?: string;
      name?: string;
      role?: 'admin' | 'user';
    };
    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await query<UserRow>(
      `INSERT INTO users (email, password_hash, password_plain, name, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, name, role, created_at, password_plain`,
      [
        email.toLowerCase().trim(),
        hash,
        password,
        name.trim(),
        role === 'admin' ? 'admin' : 'user',
      ]
    );
    await query(
      `INSERT INTO job_link_lists (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
      [rows[0].id]
    );
    return res.status(201).json({ user: mapUser(rows[0]) });
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    console.error(err);
    return res.status(500).json({ error: 'Failed to create user' });
  }
});

router.patch('/users/:id', async (req, res) => {
  const { name, email, role, password } = req.body as {
    name?: string;
    email?: string;
    role?: 'admin' | 'user';
    password?: string;
  };
  const sets: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (name !== undefined) {
    sets.push(`name = $${i++}`);
    params.push(name.trim());
  }
  if (email !== undefined) {
    const normalized = email.toLowerCase().trim();
    if (!normalized) {
      return res.status(400).json({ error: 'Email is required' });
    }
    sets.push(`email = $${i++}`);
    params.push(normalized);
  }
  if (role === 'admin' || role === 'user') {
    sets.push(`role = $${i++}`);
    params.push(role);
  }
  if (password) {
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    sets.push(`password_hash = $${i++}`);
    params.push(await bcrypt.hash(password, 10));
    sets.push(`password_plain = $${i++}`);
    params.push(password);
  }
  if (!sets.length) return res.status(400).json({ error: 'No changes' });

  sets.push('updated_at = NOW()');
  params.push(req.params.id);

  try {
    const { rows } = await query<UserRow>(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $${i}
       RETURNING id, email, name, role, created_at, password_plain`,
      params
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    return res.json({ user: mapUser(rows[0]) });
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    console.error(err);
    return res.status(500).json({ error: 'Failed to update user' });
  }
});

router.delete('/users/:id', async (req, res) => {
  if (req.params.id === req.user!.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  const { rowCount } = await query('DELETE FROM users WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'User not found' });
  return res.json({ ok: true });
});

// ── Profile assignments ────────────────────────────────
router.get('/users/:id/profiles', async (req, res) => {
  const { rows } = await query<{ id: string; name: string; full_name: string }>(
    `SELECT p.id, p.name, p.full_name
     FROM user_profile_assignments a
     JOIN profiles p ON p.id = a.profile_id
     WHERE a.user_id = $1
     ORDER BY p.name`,
    [req.params.id]
  );
  return res.json({ profiles: rows });
});

router.put('/users/:id/profiles', async (req, res) => {
  const profileIds = Array.isArray(req.body.profileIds) ? req.body.profileIds : [];
  const userId = req.params.id;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM user_profile_assignments WHERE user_id = $1', [userId]);
    for (const pid of profileIds) {
      await client.query(
        `INSERT INTO user_profile_assignments (user_id, profile_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [userId, pid]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const { rows } = await query<{ id: string; name: string; full_name: string }>(
    `SELECT p.id, p.name, p.full_name
     FROM user_profile_assignments a
     JOIN profiles p ON p.id = a.profile_id
     WHERE a.user_id = $1
     ORDER BY p.name`,
    [userId]
  );
  return res.json({ profiles: rows });
});

// ── Analytics ──────────────────────────────────────────
router.get('/analytics', async (_req, res) => {
  const [profilesCount, usersCount, assignmentsByUser, appsByProfileDay, profiles] =
    await Promise.all([
      query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM profiles`),
      query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM users WHERE role = 'user'`
      ),
      query<{
        user_id: string;
        user_name: string;
        user_email: string;
        profile_names: string | null;
      }>(
        `SELECT u.id AS user_id, u.name AS user_name, u.email AS user_email,
                string_agg(p.full_name, ', ' ORDER BY p.full_name) AS profile_names
         FROM users u
         LEFT JOIN user_profile_assignments a ON a.user_id = u.id
         LEFT JOIN profiles p ON p.id = a.profile_id
         WHERE u.role = 'user'
         GROUP BY u.id, u.name, u.email
         ORDER BY u.name`
      ),
      query<{
        profile_id: string;
        profile_name: string;
        day: string;
        count: string;
      }>(
        `SELECT p.id AS profile_id,
                p.full_name AS profile_name,
                TO_CHAR(b.created_at, 'YY-MM-DD') AS day,
                COUNT(*)::text AS count
         FROM resume_builds b
         JOIN profiles p ON p.id = b.profile_id
         WHERE b.created_at >= NOW() - INTERVAL '30 days'
           AND b.profile_id IS NOT NULL
         GROUP BY p.id, p.full_name, TO_CHAR(b.created_at, 'YY-MM-DD')
         ORDER BY day ASC, p.full_name ASC`
      ),
      query<{ id: string; full_name: string }>(
        `SELECT id, full_name FROM profiles ORDER BY full_name`
      ),
    ]);

  // Build continuous date range for last 30 days
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    days.push(`${yy}-${mm}-${dd}`);
  }

  const seriesMap = new Map<
    string,
    { profileId: string; profileName: string; points: Record<string, number> }
  >();
  for (const p of profiles.rows) {
    seriesMap.set(p.id, {
      profileId: p.id,
      profileName: p.full_name,
      points: Object.fromEntries(days.map((day) => [day, 0])),
    });
  }
  for (const row of appsByProfileDay.rows) {
    const series = seriesMap.get(row.profile_id);
    if (!series) continue;
    if (series.points[row.day] !== undefined) {
      series.points[row.day] = Number(row.count);
    }
  }

  return res.json({
    totalProfiles: Number(profilesCount.rows[0]?.count || 0),
    totalUsers: Number(usersCount.rows[0]?.count || 0),
    assignmentsByUser: assignmentsByUser.rows.map((r) => ({
      userId: r.user_id,
      userName: r.user_name,
      userEmail: r.user_email,
      profiles: r.profile_names
        ? r.profile_names.split(', ').filter(Boolean)
        : [],
    })),
    applicationTracks: {
      days,
      series: [...seriesMap.values()].map((s) => ({
        profileId: s.profileId,
        profileName: s.profileName,
        values: days.map((day) => s.points[day] || 0),
      })),
    },
  });
});

// ── Developers ─────────────────────────────────────────
type DeveloperRow = {
  id: string;
  developer_no: number;
  name: string;
  country: string;
  experience: string;
  whatsapp: string;
  emails: string[];
  linkedin: string;
  other: string;
  created_at: Date;
  updated_at: Date;
};

function parseEmails(value: unknown): string[] {
  const parts = Array.isArray(value)
    ? value.flatMap((item) => String(item).split(/[\n,;]+/))
    : String(value ?? '').split(/[\n,;]+/);
  const seen = new Set<string>();
  const emails: string[] = [];
  for (const part of parts) {
    const email = part.trim();
    if (!email) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error(`Invalid email: ${email}`);
    }
    seen.add(key);
    emails.push(email);
  }
  return emails;
}

function developerBody(body: Record<string, unknown>, developerNo: number) {
  return {
    developerNo,
    name: String(body.name ?? '').trim(),
    country: String(body.country ?? '').trim(),
    experience: String(body.experience ?? '').trim(),
    whatsapp: String(body.whatsapp ?? '').trim(),
    emails: parseEmails(body.emails),
    linkedin: String(body.linkedin ?? '').trim(),
    other: String(body.other ?? '').trim(),
  };
}

async function nextDeveloperNo(): Promise<number> {
  const { rows } = await query<{ n: string }>(
    `SELECT COALESCE(MAX(developer_no), 0)::text AS n FROM developers`
  );
  return Number(rows[0]?.n || 0) + 1;
}

router.get('/developers', async (_req, res) => {
  const { rows } = await query<DeveloperRow>(
    `SELECT * FROM developers ORDER BY developer_no ASC, created_at ASC`
  );
  return res.json({ developers: rows });
});

router.post('/developers', async (req, res) => {
  try {
    const requested = Number(req.body?.developerNo);
    const developerNo =
      Number.isInteger(requested) && requested > 0 ? requested : await nextDeveloperNo();
    const fields = developerBody(req.body || {}, developerNo);
    if (!fields.name) return res.status(400).json({ error: 'Name is required' });

    const { rows } = await query<DeveloperRow>(
      `INSERT INTO developers
        (developer_no, name, country, experience, whatsapp, emails, linkedin, other)
       VALUES ($1, $2, $3, $4, $5, $6::text[], $7, $8)
       RETURNING *`,
      [
        fields.developerNo,
        fields.name,
        fields.country,
        fields.experience,
        fields.whatsapp,
        fields.emails,
        fields.linkedin,
        fields.other,
      ]
    );
    return res.status(201).json({ developer: rows[0] });
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    if (e.message?.startsWith('Invalid email:')) {
      return res.status(400).json({ error: e.message });
    }
    if (e.code === '23505') return res.status(409).json({ error: 'That number is already used' });
    console.error(err);
    return res.status(500).json({ error: 'Failed to create developer' });
  }
});

router.put('/developers/:id', async (req, res) => {
  try {
    const requested = Number(req.body?.developerNo);
    if (!Number.isInteger(requested) || requested <= 0) {
      return res.status(400).json({ error: 'Number must be a positive whole number' });
    }
    const fields = developerBody(req.body || {}, requested);
    if (!fields.name) return res.status(400).json({ error: 'Name is required' });

    const { rows } = await query<DeveloperRow>(
      `UPDATE developers SET
        developer_no = $1,
        name = $2,
        country = $3,
        experience = $4,
        whatsapp = $5,
        emails = $6::text[],
        linkedin = $7,
        other = $8,
        updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
      [
        fields.developerNo,
        fields.name,
        fields.country,
        fields.experience,
        fields.whatsapp,
        fields.emails,
        fields.linkedin,
        fields.other,
        req.params.id,
      ]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Developer not found' });
    return res.json({ developer: rows[0] });
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string };
    if (e.message?.startsWith('Invalid email:')) {
      return res.status(400).json({ error: e.message });
    }
    if (e.code === '23505') return res.status(409).json({ error: 'That number is already used' });
    console.error(err);
    return res.status(500).json({ error: 'Failed to update developer' });
  }
});

router.delete('/developers/:id', async (req, res) => {
  const { rows } = await query<{ id: string }>(
    `DELETE FROM developers WHERE id = $1 RETURNING id`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Developer not found' });
  return res.json({ ok: true });
});

export default router;
