import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { query } from '../db/pool.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { syncProjectTemplates } from '../services/templateSync.js';

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.resolve(__dirname, '../../uploads/formats');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.doc' || ext === '.docx') cb(null, true);
    else cb(new Error('Only DOC/DOCX files are allowed'));
  },
});

type FormatRow = {
  id: string;
  name: string;
  filename: string;
  storage_path: string;
  uploaded_by: string | null;
  is_active: boolean;
  source: string;
  created_at: Date;
};

router.get('/', requireAuth, async (_req, res) => {
  try {
    await syncProjectTemplates();
  } catch (err) {
    console.error('Template sync failed:', err);
  }

  const { rows } = await query<FormatRow>(
    `SELECT * FROM resume_formats
     WHERE is_active = true
     ORDER BY
       CASE WHEN source = 'project' THEN 0 ELSE 1 END,
       name ASC,
       created_at DESC`
  );
  return res.json({ formats: rows });
});

router.post('/', requireAuth, requireAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'DOC file is required' });
    }
    const name = (req.body.name as string) || req.file.originalname;
    const { rows } = await query<FormatRow>(
      `INSERT INTO resume_formats (name, filename, storage_path, uploaded_by, source)
       VALUES ($1, $2, $3, $4, 'upload')
       RETURNING *`,
      [name, req.file.originalname, req.file.path, req.user!.id]
    );
    return res.status(201).json({ format: rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to upload resume format' });
  }
});

export default router;
