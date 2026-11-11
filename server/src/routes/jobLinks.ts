import { Router } from 'express';
import { query } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  const { rows } = await query<{ id: string; links: string; updated_at: Date }>(
    'SELECT * FROM job_link_lists WHERE user_id = $1',
    [req.user!.id]
  );
  return res.json({ links: rows[0]?.links || '', updatedAt: rows[0]?.updated_at });
});

router.put('/', requireAuth, async (req, res) => {
  const links = typeof req.body.links === 'string' ? req.body.links : '';
  const { rows } = await query<{ id: string; links: string; updated_at: Date }>(
    `INSERT INTO job_link_lists (user_id, links, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (user_id) DO UPDATE SET links = $2, updated_at = NOW()
     RETURNING *`,
    [req.user!.id, links]
  );
  return res.json({ links: rows[0].links, updatedAt: rows[0].updated_at });
});

export default router;
