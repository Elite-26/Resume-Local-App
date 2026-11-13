import {
  decodeEntities,
  normalizeResumeMarkup,
  plainTextFromMarkup,
  stripInlineTags,
} from './richText.js';

export type ParsedExperience = {
  title: string;
  role: string;
  /** Markup may include <b>/<i> tags */
  content: string;
};

export type ParsedResumeContent = {
  /** Markup may include <b>/<i> tags */
  professionalSummary: string;
  /** Markup may include <b>/<i> tags */
  skillSet: string;
  /** Markup may include <b>/<i> tags */
  certification: string;
  experiences: ParsedExperience[];
};

const SECTION_STOPPERS = [
  /^PROFESSIONAL SUMMARY\s*$/im,
  /^Professional Summary\s*$/im,
  /^SKILL SET\s*$/im,
  /^Skill Set\s*$/im,
  /^CERTIFICATION[S]?\s*$/im,
  /^Certification[s]?\s*$/im,
  /^EXPERIENCE\s*$/im,
  /^Experience\s*$/im,
  /^EDUCATION\s*$/im,
  /^Education\s*$/im,
  /^TITLE:/im,
];

/**
 * Parses resume content sections:
 * - PROFESSIONAL SUMMARY → {{Summary}}
 * - SKILL SET → {{Skill Set}}
 * - CERTIFICATION → {{Certification}}
 * - EXPERIENCE / TITLE: [role] → {{Company Bullet}} per company
 *
 * Accepts plain text or rich HTML from the content editor (bold/italic kept as <b>/<i>).
 */
export function parseResumeContent(raw: string): ParsedResumeContent {
  const markup = normalizeResumeMarkup(raw);
  const plain = plainTextFromMarkup(markup);
  const experiences: ParsedExperience[] = [];
  const plainToMarkupOffset = buildPlainToMarkupMap(markup);

  const certRangeFull = findSectionRange(
    plain,
    [/^CERTIFICATION[S]?\s*$/im, /^Certification[s]?\s*$/im],
    SECTION_STOPPERS.filter(
      (re) => !/certification/i.test(re.source)
    )
  );
  const certPlainStart = certRangeFull
    ? (() => {
        // Start of the CERTIFICATION header line (not content) — used to clip experiences
        for (const re of [/^CERTIFICATION[S]?\s*$/im, /^Certification[s]?\s*$/im]) {
          const m = plain.match(re);
          if (m && m.index != null) return m.index;
        }
        return certRangeFull.start;
      })()
    : null;

  const titleRegex = /^TITLE:\s*(.+)$/gim;
  const titleMatches: { index: number; role: string; full: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = titleRegex.exec(plain)) !== null) {
    // Ignore TITLE lines that fall inside/after the certification header
    if (certPlainStart != null && m.index >= certPlainStart) continue;
    titleMatches.push({ index: m.index, role: m[1].trim(), full: m[0] });
  }

  let bodyBeforeExperiencesMarkup = markup;
  if (titleMatches.length) {
    const firstMarkupIdx = plainToMarkupOffset[titleMatches[0].index] ?? markup.length;
    bodyBeforeExperiencesMarkup = markup.slice(0, firstMarkupIdx).trim();

    for (let i = 0; i < titleMatches.length; i++) {
      const role = titleMatches[i].role;
      const contentPlainStart = titleMatches[i].index + titleMatches[i].full.length;
      let startPlain = contentPlainStart;
      if (plain[startPlain] === '\n') startPlain += 1;

      let endPlain =
        i + 1 < titleMatches.length ? titleMatches[i + 1].index : plain.length;
      if (certPlainStart != null && certPlainStart < endPlain && certPlainStart > startPlain) {
        endPlain = certPlainStart;
      }

      const startM = plainToMarkupOffset[startPlain] ?? markup.length;
      const endM = plainToMarkupOffset[endPlain] ?? markup.length;
      experiences.push({
        title: `TITLE: ${role}`,
        role,
        content: markup.slice(startM, endM).trim(),
      });
    }
  }

  // Certification may appear before or after experience — parse from full document.
  const fullMap = plainToMarkupOffset;
  const certification = sliceMarkup(markup, fullMap, certRangeFull);

  const bodyPlain = plainTextFromMarkup(bodyBeforeExperiencesMarkup);
  const bodyMap = buildPlainToMarkupMap(bodyBeforeExperiencesMarkup);

  const summaryRange = findSectionRange(
    bodyPlain,
    [/^PROFESSIONAL SUMMARY\s*$/im, /^Professional Summary\s*$/im],
    [
      /^SKILL SET\s*$/im,
      /^Skill Set\s*$/im,
      /^CERTIFICATION[S]?\s*$/im,
      /^Certification[s]?\s*$/im,
      /^EXPERIENCE\s*$/im,
      /^Experience\s*$/im,
      /^TITLE:/im,
    ]
  );

  const skillRange = findSectionRange(
    bodyPlain,
    [/^SKILL SET\s*$/im, /^Skill Set\s*$/im],
    [
      /^CERTIFICATION[S]?\s*$/im,
      /^Certification[s]?\s*$/im,
      /^EXPERIENCE\s*$/im,
      /^Experience\s*$/im,
      /^TITLE:/im,
      /^PROFESSIONAL SUMMARY\s*$/im,
    ]
  );

  // Also allow certification in the pre-experience body (if no TITLE blocks yet)
  let certificationFromBody = '';
  if (!certification) {
    const bodyCert = findSectionRange(
      bodyPlain,
      [/^CERTIFICATION[S]?\s*$/im, /^Certification[s]?\s*$/im],
      [
        /^SKILL SET\s*$/im,
        /^Skill Set\s*$/im,
        /^EXPERIENCE\s*$/im,
        /^Experience\s*$/im,
        /^TITLE:/im,
        /^PROFESSIONAL SUMMARY\s*$/im,
      ]
    );
    certificationFromBody = sliceMarkup(bodyBeforeExperiencesMarkup, bodyMap, bodyCert);
  }

  return {
    professionalSummary: sliceMarkup(bodyBeforeExperiencesMarkup, bodyMap, summaryRange),
    skillSet: sliceMarkup(bodyBeforeExperiencesMarkup, bodyMap, skillRange),
    certification: certification || certificationFromBody,
    experiences,
  };
}

export type DynamicProject = {
  title: string;
  /** Markup lines under this PROJECT, joined with newlines */
  details: string;
};

/**
 * Experience parsed from structure 2 resume content.
 * The first TITLE block is the latest company and may include PROJECT groups.
 * Later TITLE blocks are bullets only.
 */
export type DynamicExperience = {
  title: string;
  companyName: string;
  location: string;
  timeline: string;
  leadDetails: string;
  projects: DynamicProject[];
  trailingDetails: string;
  /** All bullet lines, used for companies after the latest one */
  details: string;
};

function unwrapFieldValue(raw: string): string {
  const trimmed = raw.trim();
  const wrapped = trimmed.match(/^\{([\s\S]*)\}$/);
  return (wrapped ? wrapped[1] : trimmed).trim();
}

function plainLine(line: string): string {
  return decodeEntities(stripInlineTags(line)).replace(/\s+/g, ' ').trim();
}

function joinMarkupLines(lines: string[]): string {
  return lines.map((line) => line.trim()).filter((line) => plainLine(line) !== '').join('\n');
}

/**
 * Structure 2 experience body:
 *   Company: … / Location: … / optional Timeline:
 *   summary lines
 *   PROJECT: name
 *   bullets
 *   PROJECT_END
 *   trailing bullets
 *   EXPERIENCE_END
 *
 * PROJECT_END and EXPERIENCE_END are markers only.
 * Project names keep the text after PROJECT:, and drop wrapping braces.
 */
function parseDynamicExperience(exp: ParsedExperience, latest: boolean): DynamicExperience {
  const lead: string[] = [];
  const trail: string[] = [];
  const flat: string[] = [];
  const projects: { title: string; lines: string[] }[] = [];
  let companyName = '';
  let location = '';
  let timeline = '';
  let phase: 'lead' | 'project' | 'trail' = 'lead';

  const lines = exp.content
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => plainLine(line) !== '');

  for (const line of lines) {
    const plain = plainLine(line);
    if (/^experience_end$/i.test(plain)) continue;
    if (/^project_end$/i.test(plain)) {
      phase = 'trail';
      continue;
    }

    const company = plain.match(/^company\s*:\s*(.*)$/i);
    if (company) {
      companyName = unwrapFieldValue(company[1]);
      continue;
    }
    const loc = plain.match(/^location\s*:\s*(.*)$/i);
    if (loc) {
      location = unwrapFieldValue(loc[1]);
      continue;
    }
    const period = plain.match(/^(?:timeline|work period|period)\s*:\s*(.*)$/i);
    if (period) {
      timeline = unwrapFieldValue(period[1]);
      continue;
    }

    const project = plain.match(/^project\s*:\s*(.*)$/i);
    if (project) {
      const title = unwrapFieldValue(project[1]);
      projects.push({ title, lines: [] });
      phase = 'project';
      if (!latest && title) flat.push(title);
      continue;
    }

    if (!latest) {
      flat.push(line);
      continue;
    }
    if (phase === 'project' && projects.length) {
      projects[projects.length - 1].lines.push(line);
    } else if (phase === 'trail') {
      trail.push(line);
    } else {
      lead.push(line);
    }
  }

  const parsedProjects = projects.map((project) => ({
    title: project.title,
    details: joinMarkupLines(project.lines),
  }));

  const flatDetails = latest
    ? joinMarkupLines([
        ...lead,
        ...parsedProjects.flatMap((project) =>
          [project.title, ...project.details.split('\n')].filter(Boolean)
        ),
        ...trail,
      ])
    : joinMarkupLines(flat);

  return {
    title: unwrapFieldValue(exp.role),
    companyName,
    location,
    timeline,
    leadDetails: joinMarkupLines(lead),
    projects: parsedProjects,
    trailingDetails: joinMarkupLines(trail),
    details: flatDetails,
  };
}

/** Parse structure 2 experiences. The first TITLE block is the latest company. */
export function parseDynamicExperiences(raw: string): DynamicExperience[] {
  return parseResumeContent(raw).experiences.map((exp, index) =>
    parseDynamicExperience(exp, index === 0)
  );
}

function findSectionRange(
  plain: string,
  headers: RegExp[],
  stoppers: RegExp[]
): { start: number; end: number } | null {
  let headerMatch: { index: number; length: number } | null = null;
  for (const re of headers) {
    const m = plain.match(re);
    if (m && m.index != null) {
      headerMatch = { index: m.index, length: m[0].length };
      break;
    }
  }
  if (!headerMatch) return null;

  let contentStart = headerMatch.index + headerMatch.length;
  if (plain[contentStart] === '\n') contentStart += 1;

  let contentEnd = plain.length;
  for (const re of stoppers) {
    re.lastIndex = 0;
    const flags = re.flags.includes('g') ? re.flags : re.flags + 'g';
    const global = new RegExp(re.source, flags);
    global.lastIndex = contentStart;
    const m = global.exec(plain);
    if (m && m.index != null && m.index < contentEnd) {
      contentEnd = m.index;
    }
  }

  return { start: contentStart, end: contentEnd };
}

function sliceMarkup(
  markup: string,
  map: number[],
  range: { start: number; end: number } | null
): string {
  if (!range) return '';
  const a = map[range.start] ?? markup.length;
  const b = map[range.end] ?? markup.length;
  return markup.slice(a, b).trim();
}

/** For each plain-text index, the corresponding index in markup. */
function buildPlainToMarkupMap(markup: string): number[] {
  const map: number[] = [];
  let plainIdx = 0;
  let i = 0;
  while (i < markup.length) {
    if (markup[i] === '<') {
      const close = markup.indexOf('>', i);
      if (close === -1) break;
      i = close + 1;
      continue;
    }
    map[plainIdx] = i;
    plainIdx += 1;
    i += 1;
  }
  map[plainIdx] = markup.length;
  return map;
}

export function companiesSimilar(a: string, b: string): boolean {
  const na = normalizeCompany(a);
  const nb = normalizeCompany(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

function normalizeCompany(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\b(inc|llc|ltd|corp|corporation|company|co)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sanitizePathSegment(value: string): string {
  return (
    value
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80) || 'untitled'
  );
}

