import { Router } from 'express';
import { query } from '../db/pool.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

export type Experience = {
  companyName: string;
  role: string;
  location: string;
  period: string;
};

export type Education = {
  universityName: string;
  degreeMajor: string;
  location: string;
  period: string;
};

/** Stored JSON may be one education object from older profiles, or a list. */
export function normalizeEducation(value: unknown): Education[] {
  const one = (item: unknown): Education | null => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const row = item as Partial<Education>;
    return {
      universityName: String(row.universityName || ''),
      degreeMajor: String(row.degreeMajor || ''),
      location: String(row.location || ''),
      period: String(row.period || ''),
    };
  };
  if (Array.isArray(value)) {
    return value.map(one).filter((item): item is Education => item !== null);
  }
  const single = one(value);
  return single ? [single] : [];
}

export type ResumeStructure = 'static' | 'dynamic';

export type ProfileRow = {
  id: string;
  name: string;
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
  resume_structure: ResumeStructure;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
};

export function normalizeResumeStructure(value: unknown): ResumeStructure {
  return String(value || '').trim().toLowerCase() === 'dynamic' ? 'dynamic' : 'static';
}

function formatContactLine(p: ProfileRow): string {
  return [p.contact_location, p.contact_phone, p.contact_email, p.contact_linkedin]
    .filter(Boolean)
    .join(' ● ');
}

function validateProfileBody(body: Record<string, unknown>) {
  const fullName = String(body.fullName || '').trim();
  const contactLocation = String(body.contactLocation || '').trim();
  const contactPhone = String(body.contactPhone || '').trim();
  const contactEmail = String(body.contactEmail || '').trim();
  const experiences = body.experiences as Experience[] | undefined;
  const education = normalizeEducation(body.education);
  const resumeStructure = normalizeResumeStructure(body.resumeStructure);

  if (!fullName) return 'Full name is required';
  if (!contactLocation || !contactPhone || !contactEmail) {
    return 'Contact location, phone, and email are required';
  }
  if (!Array.isArray(experiences) || experiences.length === 0) {
    return 'At least one company experience is required';
  }
  for (const exp of experiences) {
    if (resumeStructure === 'dynamic') {
      if (!exp.period?.trim()) {
        return 'Each experience needs a work period';
      }
      continue;
    }
    if (!exp.companyName?.trim() || !exp.role?.trim() || !exp.period?.trim()) {
      return 'Each experience needs company name, role, and work period';
    }
  }
  if (education.length === 0) {
    return 'At least one education entry is required';
  }
  for (const edu of education) {
    if (!edu.universityName.trim() || !edu.degreeMajor.trim() || !edu.period.trim()) {
      return 'Each education entry needs a university, degree & major, and period';
    }
  }
  return null;
}

/** Profiles assigned to the current user (user workflow). */
router.get('/assigned', requireAuth, async (req, res) => {
  const { rows } = await query<
    ProfileRow & { application_count: string; format_name: string | null }
  >(
    `SELECT p.*,
            rf.name AS format_name,
            (
              SELECT COUNT(*)::text
              FROM resume_builds b
              WHERE b.profile_id = p.id AND b.user_id = $1
            ) AS application_count
     FROM profiles p
     JOIN user_profile_assignments a ON a.profile_id = p.id
     LEFT JOIN resume_formats rf ON rf.id = p.resume_format_id
     WHERE a.user_id = $1
     ORDER BY p.full_name ASC`,
    [req.user!.id]
  );
  return res.json({
    profiles: rows.map((p) => ({
      ...p,
      education: normalizeEducation(p.education),
      contactLine: formatContactLine(p),
      promptReady: Boolean(p.prompt?.trim()),
      applicationCount: Number(p.application_count || 0),
      resumeFormatName: p.format_name || '',
    })),
  });
});

/** Admin: list all profiles */
router.get('/', requireAuth, requireAdmin, async (_req, res) => {
  const { rows } = await query<
    ProfileRow & {
      assignee_names: string | null;
      format_name: string | null;
      application_count: string;
    }
  >(
    `SELECT p.*,
            rf.name AS format_name,
            (
              SELECT string_agg(u.name, ', ' ORDER BY u.name)
              FROM user_profile_assignments a
              JOIN users u ON u.id = a.user_id
              WHERE a.profile_id = p.id
            ) AS assignee_names,
            (
              SELECT COUNT(*)::text
              FROM resume_builds b
              WHERE b.profile_id = p.id
            ) AS application_count
     FROM profiles p
     LEFT JOIN resume_formats rf ON rf.id = p.resume_format_id
     ORDER BY p.updated_at DESC`
  );
  return res.json({
    profiles: rows.map((p) => ({
      ...p,
      education: normalizeEducation(p.education),
      contactLine: formatContactLine(p),
      assignees: p.assignee_names
        ? p.assignee_names.split(', ').filter(Boolean)
        : [],
      resumeFormatName: p.format_name || '',
      applicationCount: Number(p.application_count || 0),
      promptReady: Boolean(p.prompt?.trim()),
    })),
  });
});

/** Single assigned profile (user) or any profile (admin). */
router.get('/:id', requireAuth, async (req, res) => {
  const { rows } = await query<ProfileRow>('SELECT * FROM profiles WHERE id = $1', [
    req.params.id,
  ]);
  const profile = rows[0];
  if (!profile) return res.status(404).json({ error: 'Profile not found' });

  if (req.user!.role !== 'admin') {
    const access = await query(
      `SELECT 1 FROM user_profile_assignments WHERE user_id = $1 AND profile_id = $2`,
      [req.user!.id, profile.id]
    );
    if (!access.rows.length) {
      return res.status(403).json({ error: 'Profile not assigned to you' });
    }
  }

  return res.json({
    profile: {
      ...profile,
      education: normalizeEducation(profile.education),
      contactLine: formatContactLine(profile),
    },
  });
});

/** Admin: create profile */
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const err = validateProfileBody(req.body);
    if (err) return res.status(400).json({ error: err });

    const {
      fullName,
      roleTitle,
      contactLocation,
      contactPhone,
      contactEmail,
      contactLinkedin,
      experiences,
      education,
      prompt,
      outputPath,
      resumeFormatId,
      resumeStructure,
    } = req.body;

    const structure = normalizeResumeStructure(resumeStructure);

    const { rows } = await query<ProfileRow>(
      `INSERT INTO profiles (
        name, full_name, role_title, contact_location, contact_phone, contact_email,
        contact_linkedin, experiences, education, prompt, output_path, resume_format_id,
        resume_structure, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11,$12,$13,$14)
      RETURNING *`,
      [
        fullName.trim(),
        fullName.trim(),
        roleTitle?.trim() || null,
        contactLocation.trim(),
        contactPhone.trim(),
        contactEmail.trim(),
        (contactLinkedin || '').trim(),
        JSON.stringify(experiences),
        JSON.stringify(normalizeEducation(education)),
        prompt || '',
        outputPath || '',
        resumeFormatId || null,
        structure,
        req.user!.id,
      ]
    );
    return res.status(201).json({
      profile: {
        ...rows[0],
        education: normalizeEducation(rows[0].education),
        contactLine: formatContactLine(rows[0]),
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to create profile' });
  }
});

/** Admin: update profile */
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const err = validateProfileBody(req.body);
    if (err) return res.status(400).json({ error: err });

    const {
      fullName,
      roleTitle,
      contactLocation,
      contactPhone,
      contactEmail,
      contactLinkedin,
      experiences,
      education,
      prompt,
      outputPath,
      resumeFormatId,
      resumeStructure,
    } = req.body;

    const structure = normalizeResumeStructure(resumeStructure);

    const { rows } = await query<ProfileRow>(
      `UPDATE profiles SET
        name = $1,
        full_name = $2,
        role_title = $3,
        contact_location = $4,
        contact_phone = $5,
        contact_email = $6,
        contact_linkedin = $7,
        experiences = $8::jsonb,
        education = $9::jsonb,
        prompt = $10,
        output_path = $11,
        resume_format_id = $12,
        resume_structure = $13,
        updated_at = NOW()
       WHERE id = $14
       RETURNING *`,
      [
        fullName.trim(),
        fullName.trim(),
        roleTitle?.trim() || null,
        contactLocation.trim(),
        contactPhone.trim(),
        contactEmail.trim(),
        (contactLinkedin || '').trim(),
        JSON.stringify(experiences),
        JSON.stringify(normalizeEducation(education)),
        prompt || '',
        outputPath || '',
        resumeFormatId || null,
        structure,
        req.params.id,
      ]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Profile not found' });
    return res.json({
      profile: {
        ...rows[0],
        education: normalizeEducation(rows[0].education),
        contactLine: formatContactLine(rows[0]),
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { rowCount } = await query('DELETE FROM profiles WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Profile not found' });
  return res.json({ ok: true });
});

export default router;
