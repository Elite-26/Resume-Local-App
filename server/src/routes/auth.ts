import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { query } from '../db/pool.js';
import { config } from '../config/index.js';
import { requireAuth, signToken, type AuthUser } from '../middleware/auth.js';

const router = Router();
const googleClient = config.googleClientId
  ? new OAuth2Client(config.googleClientId)
  : null;

type UserRow = {
  id: string;
  email: string;
  password_hash: string | null;
  google_id: string | null;
  name: string;
  role: 'admin' | 'user';
};

function toAuthUser(row: UserRow): AuthUser {
  return { id: row.id, email: row.email, role: row.role, name: row.name };
}

async function ensureJobLinks(userId: string) {
  await query(
    `INSERT INTO job_link_lists (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
}

router.post('/register', async (req, res) => {
  try {
    const { email, password, name, role } = req.body as {
      email?: string;
      password?: string;
      name?: string;
      role?: string;
    };

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existing = await query('SELECT id FROM users WHERE email = $1', [
      email.toLowerCase().trim(),
    ]);
    if (existing.rows.length) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const { rows: countRows } = await query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM users'
    );
    const isFirstUser = Number(countRows[0].count) === 0;
    const assignedRole =
      isFirstUser || role === 'admin' ? (isFirstUser ? 'admin' : 'user') : 'user';
    // Only first user becomes admin automatically; ignore client-requested admin

    const passwordHash = await bcrypt.hash(password, 10);
    const { rows } = await query<UserRow>(
      `INSERT INTO users (email, password_hash, password_plain, name, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, password_hash, google_id, name, role`,
      [
        email.toLowerCase().trim(),
        passwordHash,
        password,
        (name || email.split('@')[0]).trim(),
        assignedRole,
      ]
    );

    const user = rows[0];
    await ensureJobLinks(user.id);
    const authUser = toAuthUser(user);
    const token = signToken(authUser);
    return res.status(201).json({ token, user: authUser });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { rows } = await query<UserRow>(
      'SELECT id, email, password_hash, google_id, name, role FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    const user = rows[0];
    if (!user?.password_hash) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const authUser = toAuthUser(user);
    return res.json({ token: signToken(authUser), user: authUser });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body as { credential?: string };
    if (!credential) {
      return res.status(400).json({ error: 'Google credential required' });
    }
    if (!googleClient || !config.googleClientId) {
      return res.status(503).json({ error: 'Google sign-in is not configured' });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: config.googleClientId,
    });
    const payload = ticket.getPayload();
    if (!payload?.email || !payload.sub) {
      return res.status(400).json({ error: 'Invalid Google token' });
    }

    const email = payload.email.toLowerCase();
    const googleId = payload.sub;
    const name = payload.name || email.split('@')[0];

    let { rows } = await query<UserRow>(
      `SELECT id, email, password_hash, google_id, name, role FROM users
       WHERE google_id = $1 OR email = $2`,
      [googleId, email]
    );

    let user = rows[0];
    if (!user) {
      const { rows: countRows } = await query<{ count: string }>(
        'SELECT COUNT(*)::text AS count FROM users'
      );
      const isFirstUser = Number(countRows[0].count) === 0;
      const result = await query<UserRow>(
        `INSERT INTO users (email, google_id, name, role)
         VALUES ($1, $2, $3, $4)
         RETURNING id, email, password_hash, google_id, name, role`,
        [email, googleId, name, isFirstUser ? 'admin' : 'user']
      );
      user = result.rows[0];
      await ensureJobLinks(user.id);
    } else if (!user.google_id) {
      const result = await query<UserRow>(
        `UPDATE users SET google_id = $1, updated_at = NOW()
         WHERE id = $2
         RETURNING id, email, password_hash, google_id, name, role`,
        [googleId, user.id]
      );
      user = result.rows[0];
    }

    const authUser = toAuthUser(user);
    return res.json({ token: signToken(authUser), user: authUser });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Google authentication failed' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  const { rows } = await query<UserRow>(
    'SELECT id, email, password_hash, google_id, name, role FROM users WHERE id = $1',
    [req.user!.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });
  return res.json({ user: toAuthUser(rows[0]) });
});

export default router;
