import fs from 'fs';
import JSZip from 'jszip';
import { markupToParagraphs, type RichSegment } from './richText.js';

const PLACEHOLDER_NAMES = [
  'Full Name',
  'Role',
  'Location',
  'Phone',
  'Email',
  'LinkedIn',
  'Summary',
  'Skill Set',
  'Certification',
  'Company Role',
  'Company Name',
  'Company Bullet',
  'Work Period',
  'University',
  'Degree',
  'University Location',
  'Education Period',
  'TIMELINE',
  'COMPANY_LOCATION',
  '@DETAILS',
  '@PROJECT',
  '@PROJECT_DETAILS',
] as const;

export type TemplateExperienceFill = {
  companyRole: string;
  companyName: string;
  workPeriod: string;
  /** Markup with optional <b>/<i> */
  companyBullet: string;
};

/** Structure 2 experience. Latest company uses projects; earlier ones use details only. */
export type DynamicExperienceFill = {
  companyName: string;
  timeline: string;
  title: string;
  location: string;
  leadDetails: string;
  projects: { title: string; details: string }[];
  trailingDetails: string;
  details: string;
};

export type TemplateEducationFill = {
  university: string;
  degree: string;
  universityLocation: string;
  educationPeriod: string;
};

export type ResumeStructureMode = 'static' | 'dynamic';

export type TemplateFillData = {
  fullName: string;
  role: string;
  location: string;
  phone: string;
  email: string;
  linkedin: string;
  /** Markup with optional <b>/<i> */
  summary: string;
  /** Markup with optional <b>/<i> */
  skillSet: string;
  /** Markup with optional <b>/<i> */
  certification: string;
  experiences: TemplateExperienceFill[];
  structure: ResumeStructureMode;
  dynamicExperiences: DynamicExperienceFill[];
  educations: TemplateEducationFill[];
};

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Join two runs only when they are pieces of one known {{placeholder}}. */
function continuesPlaceholder(left: string, right: string): boolean {
  const joined = left + right;
  for (const name of PLACEHOLDER_NAMES) {
    const token = `{{${name}}}`;
    if (joined.includes(token) && !left.includes(token) && !right.includes(token)) return true;
    if (!left.includes('{{') || left.includes('}}')) continue;
    const partial = left.slice(left.lastIndexOf('{{')) + right;
    if (token.startsWith(partial) || partial.startsWith(token)) return true;
  }
  return false;
}

/**
 * Merge split w:t runs so {{Placeholders}} that Word split are reconstituted.
 * A failed pair must not skip the next run, or a token broken into 3+ runs
 * ({{COMPANY_ | L | OCATION | }}) is never rebuilt.
 */
function mergeSplitPlaceholders(xml: string): string {
  const pair =
    /(<w:t[^>]*>)([^<]*)(<\/w:t>)(\s*<\/w:r>\s*<w:r[^>]*>\s*(?:<w:rPr>(?:(?!<\/w:rPr>)[\s\S])*<\/w:rPr>\s*)?<w:t[^>]*>)([^<]*)(<\/w:t>)/g;
  let result = xml;
  let changed = true;
  while (changed) {
    changed = false;
    let out = '';
    let cursor = 0;
    pair.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pair.exec(result))) {
      const [full, open, left, close, mid, right] = match;
      if (!continuesPlaceholder(left, right)) {
        const secondOpen = mid.match(/<w:t[^>]*>$/)?.[0].length ?? 0;
        pair.lastIndex =
          match.index + open.length + left.length + close.length + mid.length - secondOpen;
        continue;
      }
      out += result.slice(cursor, match.index) + open + left + right + close;
      cursor = match.index + full.length;
      changed = true;
    }
    out += result.slice(cursor);
    result = out;
  }
  return result;
}

function extractParagraphs(xml: string): string[] {
  return xml.match(/<w:p\b[\s\S]*?<\/w:p>/g) || [];
}

function paragraphPlainText(pXml: string): string {
  const parts = [...pXml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)].map((m) => m[1]);
  return parts.join('');
}

function paragraphContainsPlaceholder(pXml: string, names: string[]): boolean {
  const text = paragraphPlainText(pXml);
  return names.some((n) => text.includes(`{{${n}}}`));
}

function getPPr(pXml: string): string {
  const m = pXml.match(/<w:pPr\b[\s\S]*?<\/w:pPr>/);
  return m ? m[0] : '';
}

/** rPr of the first run that contains the placeholder, else first run's rPr. */
function getPlaceholderRPr(pXml: string, placeholder: string): string {
  const runs = pXml.match(/<w:r\b[\s\S]*?<\/w:r>/g) || [];
  for (const run of runs) {
    if (run.includes(placeholder)) {
      const m = run.match(/<w:rPr\b[\s\S]*?<\/w:rPr>/);
      return m ? m[0] : '';
    }
  }
  for (const run of runs) {
    const m = run.match(/<w:rPr\b[\s\S]*?<\/w:rPr>/);
    if (m) return m[0];
  }
  return '';
}

function mergeRPr(baseRPr: string, segment: RichSegment): string {
  let rPr = baseRPr || '<w:rPr></w:rPr>';
  if (segment.bold && !/<w:b\b/.test(rPr)) {
    rPr = rPr.replace(/<\/w:rPr>/, '<w:b/></w:rPr>');
  }
  if (segment.italic && !/<w:i\b/.test(rPr)) {
    rPr = rPr.replace(/<\/w:rPr>/, '<w:i/></w:rPr>');
  }
  if (rPr === '<w:rPr></w:rPr>') return '';
  return rPr;
}

function runsFromSegments(segments: RichSegment[], baseRPr: string): string {
  return segments
    .filter((s) => s.text.length > 0)
    .map((seg) => {
      const rPr = mergeRPr(baseRPr, seg);
      const space = /^\s|\s$/.test(seg.text) ? ' xml:space="preserve"' : '';
      return `<w:r>${rPr}<w:t${space}>${escapeXml(seg.text)}</w:t></w:r>`;
    })
    .join('');
}

function buildParagraph(pPr: string, segments: RichSegment[], baseRPr: string): string {
  const runs = runsFromSegments(segments, baseRPr);
  if (!runs) {
    return `<w:p>${pPr}<w:r>${baseRPr}<w:t></w:t></w:r></w:p>`;
  }
  return `<w:p>${pPr}${runs}</w:p>`;
}

function runPlainText(runXml: string): string {
  return [...runXml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)].map((m) => m[1]).join('');
}

function isSeparatorOnlyText(text: string): boolean {
  return /^[\s•●·.]*$/.test(text) && text.length > 0;
}

/**
 * When an optional field (e.g. LinkedIn) is empty, drop the placeholder and the
 * preceding " • " separator runs so the contact line does not end with a bullet.
 */
function removePlaceholderWithPrecedingSeparator(
  xml: string,
  placeholder: string
): string {
  const token = `{{${placeholder}}}`;
  const paras = extractParagraphs(xml);
  const idx = paras.findIndex((p) => paragraphPlainText(p).includes(token));
  if (idx === -1) return replacePlainInXml(xml, placeholder, '');

  const sample = paras[idx];
  const runs = sample.match(/<w:r\b[\s\S]*?<\/w:r>/g) || [];
  const tokenIdx = runs.findIndex((r) => r.includes(token));
  if (tokenIdx === -1) return replacePlainInXml(xml, placeholder, '');

  const remove = new Set<number>([tokenIdx]);
  for (let i = tokenIdx - 1; i >= 0; i--) {
    const text = runPlainText(runs[i]);
    if (isSeparatorOnlyText(text)) {
      remove.add(i);
      if (/[•●·]/.test(text)) {
        // Also drop any whitespace-only run immediately before the bullet.
        if (i - 1 >= 0 && /^[\s]*$/.test(runPlainText(runs[i - 1]))) {
          remove.add(i - 1);
        }
        break;
      }
      continue;
    }
    break;
  }

  let runI = 0;
  const cleaned = sample.replace(/<w:r\b[\s\S]*?<\/w:r>/g, (run) => {
    const keep = !remove.has(runI);
    runI += 1;
    return keep ? run : '';
  });
  return xml.replace(sample, () => cleaned);
}

/** Template ListBullet paragraphs already show a bullet — strip pasted markers. */
function stripLeadingBulletFromSegments(segs: RichSegment[]): RichSegment[] {
  if (!segs.length) return segs;
  const next = segs.map((s) => ({ ...s }));
  for (const seg of next) {
    if (!seg.text) continue;
    const stripped = seg.text.replace(/^\s*[-•*◦▪▸➤]+\s*/, '');
    if (stripped !== seg.text) {
      seg.text = stripped;
    }
    break;
  }
  return next;
}

function nonEmptyParagraphs(markup: string): RichSegment[][] {
  return markupToParagraphs(markup)
    .map(stripLeadingBulletFromSegments)
    .filter((segs) => segs.some((s) => s.text.trim().length > 0));
}

/** Drop ListBullet style so an empty placeholder does not render a lone bullet. */
function pPrWithoutListBullet(pPr: string): string {
  return pPr
    .replace(/<w:pStyle\b[^/]*\/>/g, '')
    .replace(/<w:numPr\b[\s\S]*?<\/w:numPr>/g, '');
}

function paragraphsFromMarkup(
  markup: string,
  sampleParagraphXml: string,
  placeholder: string
): string {
  const pPr = getPPr(sampleParagraphXml);
  const rPr = getPlaceholderRPr(sampleParagraphXml, placeholder);
  const paras = nonEmptyParagraphs(markup);
  if (!paras.length) {
    return buildParagraph(pPrWithoutListBullet(pPr), [{ text: '' }], rPr);
  }
  return paras.map((segs) => buildParagraph(pPr, segs, rPr)).join('');
}

function replacePlainInXml(xml: string, placeholder: string, value: string): string {
  const token = `{{${placeholder}}}`;
  if (!xml.includes(token)) return xml;
  return xml.split(token).join(escapeXml(value ?? ''));
}

function plainFallback(markup: string): string {
  return markup.replace(/<\/?[bi]>/gi, '').replace(/^\s*[-•*◦▪▸➤]+\s*/gm, '');
}

function replaceRichParagraphPlaceholder(
  xml: string,
  placeholder: string,
  markup: string
): string {
  const token = `{{${placeholder}}}`;
  const paras = extractParagraphs(xml);
  const idx = paras.findIndex((p) => paragraphPlainText(p).includes(token));
  if (idx === -1) {
    return replacePlainInXml(xml, placeholder, plainFallback(markup));
  }

  const sample = paras[idx];
  const text = paragraphPlainText(sample).trim();
  const onlyPh = text === token;
  if (onlyPh) {
    const replacement = paragraphsFromMarkup(markup, sample, token);
    return xml.replace(sample, () => replacement);
  }

  const aside = text.split(token).join('').trim();
  if (!aside || /^[\s•●·\-–—*◦▪▸➤]+$/.test(aside)) {
    const replacement = expandTokenLines(sample, markup, token);
    return xml.replace(sample, () => replacement);
  }

  const rPr = getPlaceholderRPr(sample, token);
  const lines = nonEmptyParagraphs(markup);
  const withBreaks: RichSegment[] = [];
  lines.forEach((line, i) => {
    if (i > 0) withBreaks.push({ text: '\n' });
    withBreaks.push(...line);
  });
  const richRuns = runsFromSegments(withBreaks.length ? withBreaks : [{ text: '' }], rPr);
  const newPara = sample.replace(/<w:r\b[\s\S]*?<\/w:r>/g, (run) =>
    run.includes(token) ? richRuns : run
  );
  const cleaned = newPara.includes(token)
    ? replacePlainInXml(newPara, placeholder, plainFallback(markup))
    : newPara;
  return xml.replace(sample, () => cleaned);
}

function fillExperienceBlock(blockXml: string, exp: TemplateExperienceFill): string {
  let out = blockXml;
  out = out.replace(/<w:bookmarkStart\b[^/]*\/>/g, '');
  out = out.replace(/<w:bookmarkEnd\b[^/]*\/>/g, '');
  out = replacePlainInXml(out, 'Company Role', exp.companyRole);
  out = replacePlainInXml(out, 'Company Name', exp.companyName);
  out = replacePlainInXml(out, 'Work Period', exp.workPeriod);
  out = replaceRichParagraphPlaceholder(out, 'Company Bullet', exp.companyBullet);
  return out;
}

/**
 * Duplicate the experience paragraph block once per experience, then fill each copy.
 */
function expandAndFillExperiences(xml: string, experiences: TemplateExperienceFill[]): string {
  const expNames = ['Company Role', 'Company Name', 'Work Period', 'Company Bullet'];
  const paras = extractParagraphs(xml);
  const expIndexes: number[] = [];
  paras.forEach((p, i) => {
    if (paragraphContainsPlaceholder(p, expNames)) expIndexes.push(i);
  });

  if (!expIndexes.length) return xml;

  const first = expIndexes[0];
  const last = expIndexes[expIndexes.length - 1];
  const blockXml = paras.slice(first, last + 1).join('');

  const list =
    experiences.length > 0
      ? experiences
      : [{ companyRole: '', companyName: '', workPeriod: '', companyBullet: '' }];

  const filledBlocks = list.map((exp) => fillExperienceBlock(blockXml, exp));

  if (!xml.includes(blockXml)) {
    const exp = list[0];
    let out = xml;
    out = replacePlainInXml(out, 'Company Role', exp.companyRole);
    out = replacePlainInXml(out, 'Company Name', exp.companyName);
    out = replacePlainInXml(out, 'Work Period', exp.workPeriod);
    out = replaceRichParagraphPlaceholder(out, 'Company Bullet', exp.companyBullet);
    return out;
  }

  return xml.replace(blockXml, () => filledBlocks.join(''));
}

function fillEducationBlock(blockXml: string, edu: TemplateEducationFill): string {
  let out = blockXml;
  out = out.replace(/<w:bookmarkStart\b[^/]*\/>/g, '');
  out = out.replace(/<w:bookmarkEnd\b[^/]*\/>/g, '');
  out = replacePlainInXml(out, 'University Location', edu.universityLocation);
  out = replacePlainInXml(out, 'Education Period', edu.educationPeriod);
  out = replacePlainInXml(out, 'University', edu.university);
  out = replacePlainInXml(out, 'Degree', edu.degree);
  return out;
}

/** Duplicate the education paragraph block once per education entry, then fill each copy. */
function expandAndFillEducations(xml: string, educations: TemplateEducationFill[]): string {
  const names = ['University', 'Degree', 'University Location', 'Education Period'];
  const paras = extractParagraphs(xml);
  const indexes: number[] = [];
  paras.forEach((paragraph, index) => {
    if (paragraphContainsPlaceholder(paragraph, names)) indexes.push(index);
  });
  if (!indexes.length) return xml;

  const blockXml = paras.slice(indexes[0], indexes[indexes.length - 1] + 1).join('');
  const list = educations.length
    ? educations
    : [{ university: '', degree: '', universityLocation: '', educationPeriod: '' }];
  const filled = list.map((edu) => fillEducationBlock(blockXml, edu));
  if (!xml.includes(blockXml)) return fillEducationBlock(xml, list[0]);
  return xml.replace(blockXml, () => filled.join(''));
}

function fillDynamicHeader(xml: string, exp: DynamicExperienceFill): string {
  let out = xml;
  out = replacePlainInXml(out, 'Company Name', exp.companyName);
  out = replacePlainInXml(out, 'Work Period', exp.timeline);
  out = replacePlainInXml(out, 'TIMELINE', exp.timeline);
  out = replacePlainInXml(out, 'Company Role', exp.title);
  out = replacePlainInXml(out, 'COMPANY_LOCATION', exp.location);
  return out;
}

function prefixRunXml(prefix: string, rPr: string): string {
  if (!prefix) return '';
  const space = /^\s|\s$/.test(prefix) ? ' xml:space="preserve"' : '';
  return `<w:r>${rPr}<w:t${space}>${escapeXml(prefix)}</w:t></w:r>`;
}

/** Keep a literal bullet that sits in front of a placeholder; list numbering already lives in pPr. */
function bulletPrefixXml(sample: string, token: string, rPr: string): string {
  const pPr = getPPr(sample);
  if (/<w:numPr\b/.test(pPr)) return '';

  const runs = sample.match(/<w:r\b[\s\S]*?<\/w:r>/g) || [];
  const kept: string[] = [];
  for (const run of runs) {
    if (run.includes(token)) break;
    const text = runPlainText(run);
    if (!text) continue;
    if (/^[\s•●·\-–—*◦▪▸➤]+$/.test(text)) {
      kept.push(run);
      continue;
    }
    break;
  }
  if (kept.length) return kept.join('');

  const text = paragraphPlainText(sample);
  const idx = text.indexOf(token);
  if (idx <= 0) return '';
  const prefix = text.slice(0, idx);
  if (!/^[\s•●·\-–—*◦▪▸➤]+$/.test(prefix)) return '';
  return prefixRunXml(prefix, rPr);
}

/** One template paragraph per content line, keeping that paragraph's bullet style. */
function expandTokenLines(sample: string, markup: string, token: string): string {
  const lines = nonEmptyParagraphs(markup);
  if (!lines.length) return '';
  const pPr = getPPr(sample);
  const rPr = getPlaceholderRPr(sample, token);
  const prefix = bulletPrefixXml(sample, token, rPr);
  return lines
    .map((segs) => {
      const runs = runsFromSegments(segs, rPr);
      if (!runs) return '';
      return `<w:p>${pPr}${prefix}${runs}</w:p>`;
    })
    .join('');
}

function withoutProjectParagraphs(paras: string[]): string[] {
  return paras.filter((para) => {
    const text = paragraphPlainText(para);
    return !text.includes('{{@PROJECT_DETAILS}}') && !text.includes('{{@PROJECT}}');
  });
}

/**
 * Latest company: summary line and post-PROJECT_END lines use {{@DETAILS}}.
 * Each PROJECT name uses {{@PROJECT}}; its bullets use {{@PROJECT_DETAILS}}.
 * Markers are not written into the document.
 */
function fillLatestExperience(paras: string[], exp: DynamicExperienceFill): string {
  const detailsIdx = paras.findIndex((p) => paragraphPlainText(p).includes('{{@DETAILS}}'));
  if (detailsIdx === -1) return fillSimpleExperience(paras, exp);

  const projectIdx = paras.findIndex((p) => paragraphPlainText(p).includes('{{@PROJECT}}'));
  const projectDetailsIdx = paras.findIndex((p) =>
    paragraphPlainText(p).includes('{{@PROJECT_DETAILS}}')
  );
  const detailsPara = paras[detailsIdx];
  let out = fillDynamicHeader(paras.slice(0, detailsIdx).join(''), exp);
  out += expandTokenLines(detailsPara, exp.leadDetails, '{{@DETAILS}}');

  const projectStart = projectIdx === -1 ? projectDetailsIdx : projectIdx;
  if (exp.projects.length && projectStart > detailsIdx) {
    out += fillDynamicHeader(paras.slice(detailsIdx + 1, projectStart).join(''), exp);
  }

  const projectPara = projectIdx === -1 ? '' : paras[projectIdx];
  const projectDetailsPara = projectDetailsIdx === -1 ? '' : paras[projectDetailsIdx];
  const between =
    projectIdx !== -1 && projectDetailsIdx > projectIdx
      ? paras.slice(projectIdx + 1, projectDetailsIdx).join('')
      : '';

  for (const project of exp.projects) {
    if (projectPara) out += expandTokenLines(projectPara, project.title, '{{@PROJECT}}');
    if (between) out += fillDynamicHeader(between, exp);
    if (projectDetailsPara) {
      out += expandTokenLines(projectDetailsPara, project.details, '{{@PROJECT_DETAILS}}');
    }
  }

  out += expandTokenLines(detailsPara, exp.trailingDetails, '{{@DETAILS}}');
  return out;
}

/** Earlier companies: bullets only, into {{@DETAILS}}. */
function fillSimpleExperience(paras: string[], exp: DynamicExperienceFill): string {
  const detailsIdx = paras.findIndex((p) => paragraphPlainText(p).includes('{{@DETAILS}}'));
  if (detailsIdx === -1) return fillDynamicHeader(paras.join(''), exp);
  return (
    fillDynamicHeader(paras.slice(0, detailsIdx).join(''), exp) +
    expandTokenLines(paras[detailsIdx], exp.details, '{{@DETAILS}}') +
    fillDynamicHeader(paras.slice(detailsIdx + 1).join(''), exp)
  );
}

/** Locate each paragraph in document order, including repeated placeholder paragraphs. */
function paragraphOffsets(xml: string, paras: string[]): { start: number; end: number }[] {
  const offsets: { start: number; end: number }[] = [];
  let cursor = 0;
  for (const para of paras) {
    const start = xml.indexOf(para, cursor);
    if (start === -1) return [];
    offsets.push({ start, end: start + para.length });
    cursor = start + para.length;
  }
  return offsets;
}

function findDynamicBlock(paras: string[]): { start: number; end: number } | null {
  const names = [
    'Company Name',
    'Company Role',
    'Work Period',
    'TIMELINE',
    'COMPANY_LOCATION',
    '@DETAILS',
    '@PROJECT',
    '@PROJECT_DETAILS',
  ];
  const indexes: number[] = [];
  paras.forEach((para, index) => {
    if (paragraphContainsPlaceholder(para, names)) indexes.push(index);
  });
  if (!indexes.length) return null;
  return { start: indexes[0], end: indexes[indexes.length - 1] };
}

function hasDynamicExperienceTokens(xml: string): boolean {
  return (
    xml.includes('{{@DETAILS}}') ||
    xml.includes('{{@PROJECT}}') ||
    xml.includes('{{TIMELINE}}') ||
    xml.includes('{{COMPANY_LOCATION}}')
  );
}

/**
 * Structure 2: duplicate the latest-company block once, then the simpler block
 * once per earlier company.
 */
function expandAndFillDynamicExperiences(
  xml: string,
  experiences: DynamicExperienceFill[]
): string {
  const paras = extractParagraphs(xml);
  const range = findDynamicBlock(paras);
  if (!range) return xml;

  const offsets = paragraphOffsets(xml, paras);
  const span = offsets[range.start];
  const spanLast = offsets[range.end];
  if (!span || !spanLast) return xml;
  const spanStart = span.start;
  const spanEnd = spanLast.end;

  const inner = paras.slice(range.start, range.end + 1);
  const projectCut = (() => {
    const detailsAt = inner.findIndex((p) =>
      paragraphPlainText(p).includes('{{@PROJECT_DETAILS}}')
    );
    if (detailsAt !== -1) return detailsAt + 1;
    const projectAt = inner.findIndex((p) => paragraphPlainText(p).includes('{{@PROJECT}}'));
    if (projectAt !== -1) return projectAt + 1;
    return inner.length;
  })();
  const structureA = inner.slice(0, projectCut);
  const structureB = inner.slice(projectCut);
  const useProjects = structureA.some((p) => {
    const text = paragraphPlainText(p);
    return text.includes('{{@PROJECT}}') || text.includes('{{@PROJECT_DETAILS}}');
  });
  const simpleFromA = useProjects ? withoutProjectParagraphs(structureA) : structureA;

  if (!experiences.length) {
    return xml.slice(0, spanStart) + xml.slice(spanEnd);
  }

  const filled = experiences.map((exp, index) => {
    const block = stripBookmarks(
      index === 0 && useProjects
        ? fillLatestExperience(structureA, exp)
        : fillSimpleExperience(index === 0 ? simpleFromA : structureB.length ? structureB : simpleFromA, exp)
    );
    return block;
  });

  return xml.slice(0, spanStart) + filled.join('') + xml.slice(spanEnd);
}

function stripBookmarks(xml: string): string {
  return xml
    .replace(/<w:bookmarkStart\b[^/]*\/>/g, '')
    .replace(/<w:bookmarkEnd\b[^/]*\/>/g, '');
}

/** Profile role is optional. An empty value removes the {{Role}} line instead of leaving a blank paragraph. */
function fillOptionalRole(xml: string, role: string): string {
  const value = role.trim();
  if (value) return replacePlainInXml(xml, 'Role', value);

  const token = '{{Role}}';
  let out = xml;
  for (const para of extractParagraphs(xml)) {
    const text = paragraphPlainText(para);
    if (!text.includes(token)) continue;
    if (!text.split(token).join('').trim()) out = out.replace(para, '');
  }
  if (out.includes(token)) out = removePlaceholderWithPrecedingSeparator(out, 'Role');
  return out;
}

function fillDocumentXml(xml: string, data: TemplateFillData, strict: boolean): string {
  let out = mergeSplitPlaceholders(xml);
  if (data.structure === 'dynamic') {
    if (strict && !hasDynamicExperienceTokens(out)) {
      throw new Error(
        'This profile uses resume structure 2. The selected format needs an experience block with {{Company Name}}, {{Work Period}}, {{Company Role}}, {{COMPANY_LOCATION}}, {{@DETAILS}}, {{@PROJECT}}, and {{@PROJECT_DETAILS}}.'
      );
    }
    if (hasDynamicExperienceTokens(out)) {
      out = expandAndFillDynamicExperiences(out, data.dynamicExperiences);
    }
  } else {
    out = expandAndFillExperiences(out, data.experiences);
  }

  out = expandAndFillEducations(out, data.educations);

  out = replacePlainInXml(out, 'Full Name', data.fullName);
  out = fillOptionalRole(out, data.role);
  out = replacePlainInXml(out, 'Location', data.location);
  out = replacePlainInXml(out, 'Phone', data.phone);
  out = replacePlainInXml(out, 'Email', data.email);
  if (data.linkedin?.trim()) {
    out = replacePlainInXml(out, 'LinkedIn', data.linkedin.trim());
  } else {
    out = removePlaceholderWithPrecedingSeparator(out, 'LinkedIn');
  }

  out = replaceRichParagraphPlaceholder(out, 'Summary', data.summary);
  out = replaceRichParagraphPlaceholder(out, 'Skill Set', data.skillSet);
  out = replaceRichParagraphPlaceholder(out, 'Certification', data.certification);
  // Also accept lowercase token if a template uses it
  if (out.includes('{{certification}}')) {
    out = replaceRichParagraphPlaceholder(out, 'certification', data.certification);
  }

  return out;
}

export async function fillDocxTemplate(
  templatePath: string,
  outputPath: string,
  data: TemplateFillData
): Promise<void> {
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Resume template not found: ${templatePath}`);
  }
  if (!templatePath.toLowerCase().endsWith('.docx')) {
    throw new Error('Only .docx resume templates are supported for placeholder filling');
  }

  const binary = fs.readFileSync(templatePath);
  const zip = await JSZip.loadAsync(binary);
  const docFile = zip.file('word/document.xml');
  if (!docFile) {
    throw new Error('Invalid DOCX: missing word/document.xml');
  }

  let documentXml = await docFile.async('string');
  documentXml = fillDocumentXml(documentXml, data, true);
  zip.file('word/document.xml', documentXml);

  const extras = Object.keys(zip.files).filter((n) =>
    /^word\/(header|footer)\d*\.xml$/i.test(n)
  );
  for (const name of extras) {
    const f = zip.file(name);
    if (!f) continue;
    let xml = await f.async('string');
    xml = fillDocumentXml(xml, data, false);
    zip.file(name, xml);
  }

  const out = await zip.generateAsync({ type: 'nodebuffer' });
  fs.writeFileSync(outputPath, out);
}
