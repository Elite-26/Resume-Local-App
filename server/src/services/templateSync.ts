import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from '../db/pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Project-root templates/ folder (DOC/DOCX resume formats). */
export function getTemplatesDir(): string {
  return path.resolve(__dirname, '../../../templates');
}

const DOC_EXT = new Set(['.doc', '.docx']);

function displayName(filename: string): string {
  const base = path.basename(filename, path.extname(filename));
  return base
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export type TemplateFile = {
  name: string;
  filename: string;
  storagePath: string;
};

export function listTemplateFiles(): TemplateFile[] {
  const dir = getTemplatesDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    return [];
  }

  return fs
    .readdirSync(dir)
    .filter((f) => DOC_EXT.has(path.extname(f).toLowerCase()))
    .filter((f) => !f.startsWith('.') && !f.startsWith('~'))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    .map((filename) => ({
      name: displayName(filename),
      filename,
      storagePath: path.join(dir, filename),
    }));
}

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

/**
 * Sync DOC/DOCX files from templates/ into resume_formats (source = project).
 * Removes project formats whose files were deleted from the folder.
 */
export async function syncProjectTemplates(): Promise<{ synced: number; deactivated: number }> {
  const files = listTemplateFiles();
  const present = new Set(files.map((f) => f.filename.toLowerCase()));
  let synced = 0;

  for (const file of files) {
    const { rows } = await query<FormatRow>(
      `SELECT * FROM resume_formats
       WHERE source = 'project' AND lower(filename) = lower($1)
       LIMIT 1`,
      [file.filename]
    );

    if (rows[0]) {
      await query(
        `UPDATE resume_formats SET
          name = $1,
          filename = $2,
          storage_path = $3,
          is_active = true
         WHERE id = $4`,
        [file.name, file.filename, file.storagePath, rows[0].id]
      );
    } else {
      await query(
        `INSERT INTO resume_formats (name, filename, storage_path, source, is_active)
         VALUES ($1, $2, $3, 'project', true)`,
        [file.name, file.filename, file.storagePath]
      );
    }
    synced += 1;
  }

  const { rows: projectRows } = await query<FormatRow>(
    `SELECT * FROM resume_formats WHERE source = 'project'`
  );

  let deactivated = 0;
  for (const row of projectRows) {
    if (!present.has(row.filename.toLowerCase())) {
      await query(`UPDATE resume_formats SET is_active = false WHERE id = $1`, [row.id]);
      deactivated += 1;
    }
  }

  return { synced, deactivated };
}
