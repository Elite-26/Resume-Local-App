import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { query } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { companiesSimilar } from '../services/resumeParser.js';
import { generateResumeFiles } from '../services/resumeGenerator.js';
import { config } from '../config/index.js';
import type { Experience, Education } from './profile.js';

const router = Router();

type BuildRow = {
  id: string;
  user_id: string;
  profile_id: string | null;
  job_link: string | null;
  company: string;
  role_title: string;
  salary: string;
  description: string;
  resume_content: string;
  output_dir: string | null;
  pdf_path: string | null;
  doc_path: string | null;
  jd_path: string | null;
  status: string;
  unique_number: number | null;
  created_at: Date;
  updated_at: Date;
};

type ProfileRow = {
  id: string;
  full_name: string;
  role_title: string | null;
  contact_location: string;
  contact_phone: string;
  contact_email: string;
  contact_linkedin: string;
  experiences: Experience[];
  education: Education | Education[];
  prompt: string;
  output_path: string;
  resume_format_id: string | null;
  resume_structure?: string | null;
  template_path: string | null;
};

async function assertProfileAccess(userId: string, role: string, profileId: string) {
  const select = `SELECT p.*, rf.storage_path AS template_path
     FROM profiles p
     LEFT JOIN resume_formats rf ON rf.id = p.resume_format_id AND rf.is_active = true`;

  if (role === 'admin') {
    const { rows } = await query<ProfileRow>(`${select} WHERE p.id = $1`, [profileId]);
    return rows[0] || null;
  }
  const { rows } = await query<ProfileRow>(
    `${select}
     JOIN user_profile_assignments a ON a.profile_id = p.id
     WHERE a.user_id = $1 AND p.id = $2`,
    [userId, profileId]
  );
  return rows[0] || null;
}

async function nextUniqueNumber(userId: string, profileId: string) {
  const { rows } = await query<{ n: string }>(
    `SELECT COALESCE(MAX(unique_number), 0)::text AS n
     FROM resume_builds
     WHERE user_id = $1 AND profile_id = $2`,
    [userId, profileId]
  );
  return Number(rows[0]?.n || 0) + 1;
}

router.get('/', requireAuth, async (req, res) => {
  if (req.user!.role === 'admin') {
    return res.status(403).json({ error: 'Build history is for users only' });
  }

  // Drop incomplete drafts so history only keeps generated resumes.
  await query(`DELETE FROM resume_builds WHERE user_id = $1 AND status <> 'generated'`, [
    req.user!.id,
  ]);

  const q = String(req.query.q || '').trim();
  const profileId = String(req.query.profileId || '').trim();
  const params: unknown[] = [req.user!.id];
  let sql = `SELECT * FROM resume_builds WHERE user_id = $1 AND status = 'generated'`;

  if (profileId) {
    params.push(profileId);
    sql += ` AND profile_id = $${params.length}`;
  }

  if (q) {
    params.push(`%${q}%`);
    const likeIdx = params.length;
    const asNumber = Number(q);
    if (Number.isInteger(asNumber) && asNumber > 0) {
      params.push(asNumber);
      sql += ` AND (
        company ILIKE $${likeIdx} OR
        role_title ILIKE $${likeIdx} OR
        COALESCE(salary, '') ILIKE $${likeIdx} OR
        COALESCE(job_link, '') ILIKE $${likeIdx} OR
        COALESCE(description, '') ILIKE $${likeIdx} OR
        unique_number = $${params.length}
      )`;
    } else {
      sql += ` AND (
        company ILIKE $${likeIdx} OR
        role_title ILIKE $${likeIdx} OR
        COALESCE(salary, '') ILIKE $${likeIdx} OR
        COALESCE(job_link, '') ILIKE $${likeIdx} OR
        COALESCE(description, '') ILIKE $${likeIdx} OR
        CAST(unique_number AS TEXT) ILIKE $${likeIdx}
      )`;
    }
  }

  sql += ' ORDER BY created_at DESC';
  const { rows } = await query<BuildRow>(sql, params);
  return res.json({ builds: rows });
});

router.get('/prompt-bundle', requireAuth, async (req, res) => {
  const company = String(req.query.company || '');
  const role = String(req.query.role || '');
  const salary = String(req.query.salary || '');
  const description = String(req.query.description || '');
  const profileId = String(req.query.profileId || '');

  let prompt = '';
  if (profileId) {
    const profile = await assertProfileAccess(req.user!.id, req.user!.role, profileId);
    prompt = profile?.prompt || '';
  }

  const jd = [
    `Company: ${company}`,
    `Role: ${role}`,
    ...(salary.trim() ? [`Salary: ${salary.trim()}`] : []),
    '',
    'Description:',
    description,
  ].join('\n');
  const bundled = `${prompt}\n\n--- Job Description ---\n${jd}`.trim();
  return res.json({ prompt, jd, bundled });
});

router.get('/check-company', requireAuth, async (req, res) => {
  const company = String(req.query.company || '').trim();
  const role = String(req.query.role || '').trim();
  const profileId = String(req.query.profileId || '').trim();
  const profileIdOk = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    profileId
  );
  if (!company || !profileIdOk) {
    return res.json({ similarCompanies: [], alreadyApplied: false });
  }

  try {
    const profile = await assertProfileAccess(req.user!.id, req.user!.role, profileId);
    if (!profile) {
      return res.status(403).json({ error: 'Profile not assigned to you' });
    }

    const { rows } = await query<{ company: string; role_title: string }>(
      `SELECT DISTINCT company, role_title FROM resume_builds
       WHERE user_id = $1 AND profile_id = $2 AND status = 'generated' AND company <> ''`,
      [req.user!.id, profileId]
    );

    const similarCompanies = [
      ...new Set(
        rows
          .filter((r) => companiesSimilar(r.company, company))
          .map((r) => r.company)
      ),
    ];

    const alreadyApplied = rows.some(
      (r) =>
        companiesSimilar(r.company, company) &&
        r.role_title.toLowerCase().trim() === role.toLowerCase().trim() &&
        role.length > 0
    );

    return res.json({ similarCompanies, alreadyApplied });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not check company history' });
  }
});

router.post('/parse-links', requireAuth, async (req, res) => {
  const text = typeof req.body.links === 'string' ? req.body.links : '';
  const links = text
    .split(/\r?\n/)
    .map((l: string) => l.trim())
    .filter(Boolean);
  return res.json({ links });
});

router.post('/generate', requireAuth, async (req, res) => {
  try {
    if (req.user!.role === 'admin') {
      return res.status(403).json({ error: 'Admins do not create resume builds' });
    }

    const jobLink = (req.body.jobLink || '') as string;
    const company = (req.body.company || '') as string;
    const roleTitle = (req.body.roleTitle || '') as string;
    const salary = (req.body.salary || '') as string;
    const description = (req.body.description || '') as string;
    const resumeContent = (req.body.resumeContent || '') as string;
    const profileId = (req.body.profileId || '') as string;

    if (!profileId) {
      return res.status(400).json({ error: 'Profile is required' });
    }
    if (!company?.trim() || !roleTitle?.trim()) {
      return res.status(400).json({ error: 'Company and role are required' });
    }
    if (!resumeContent?.trim()) {
      return res.status(400).json({ error: 'Resume content is required' });
    }

    const profile = await assertProfileAccess(req.user!.id, req.user!.role, profileId);
    if (!profile?.full_name) {
      return res.status(400).json({ error: 'Selected profile is incomplete or unavailable' });
    }
    if (!profile.template_path) {
      return res.status(400).json({
        error: 'Selected profile has no resume format. Ask an admin to set one on the profile.',
      });
    }

    const uniqueNumber = await nextUniqueNumber(req.user!.id, profileId);
    const outputBase = profile.output_path?.trim() || config.defaultOutputPath;

    const result = await generateResumeFiles({
      outputBasePath: outputBase,
      uniqueNumber,
      company: company.trim(),
      role: roleTitle.trim(),
      salary: salary.trim(),
      description: description || '',
      resumeContent,
      jobLink: jobLink || '',
      templatePath: profile.template_path,
      profile: {
        fullName: profile.full_name,
        roleTitle: profile.role_title,
        contactLocation: profile.contact_location,
        contactPhone: profile.contact_phone,
        contactEmail: profile.contact_email,
        contactLinkedin: profile.contact_linkedin,
        experiences: profile.experiences,
        education: profile.education,
        resumeStructure: profile.resume_structure,
      },
    });

    const { rows } = await query<BuildRow>(
      `INSERT INTO resume_builds
        (user_id, profile_id, job_link, company, role_title, salary, description, resume_content,
         output_dir, pdf_path, doc_path, jd_path, status, unique_number)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'generated', $13)
       RETURNING *`,
      [
        req.user!.id,
        profileId,
        jobLink || null,
        company.trim(),
        roleTitle.trim(),
        salary.trim(),
        description || '',
        resumeContent,
        result.outputDir,
        result.pdfPath,
        result.docPath,
        result.jdPath,
        uniqueNumber,
      ]
    );

    return res.json({ build: rows[0], paths: result });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : 'Resume generation failed';
    return res.status(500).json({ error: message });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  if (req.user!.role === 'admin') {
    return res.status(403).json({ error: 'Build history is for users only' });
  }

  const { rows } = await query<BuildRow>(
    `DELETE FROM resume_builds
     WHERE id = $1 AND user_id = $2 AND status = 'generated'
     RETURNING *`,
    [req.params.id, req.user!.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Build not found' });
  return res.json({ ok: true });
});

router.get('/:id/pdf', requireAuth, async (req, res) => {
  if (req.user!.role === 'admin') {
    return res.status(403).json({ error: 'Build history is for users only' });
  }

  const { rows } = await query<BuildRow>(
    `SELECT * FROM resume_builds
     WHERE id = $1 AND user_id = $2 AND status = 'generated'`,
    [req.params.id, req.user!.id]
  );
  const build = rows[0];
  if (!build?.pdf_path) {
    return res.status(404).json({ error: 'PDF not found' });
  }

  const pdfPath = path.resolve(build.pdf_path);
  if (!fs.existsSync(pdfPath)) {
    return res.status(404).json({ error: 'PDF file is missing on disk' });
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `inline; filename="${path.basename(pdfPath).replace(/"/g, '')}"`
  );
  fs.createReadStream(pdfPath).pipe(res);
});

export default router;
