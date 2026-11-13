import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import PDFDocument from 'pdfkit';
import {
  parseDynamicExperiences,
  parseResumeContent,
  sanitizePathSegment,
} from './resumeParser.js';
import {
  fillDocxTemplate,
  type DynamicExperienceFill,
  type ResumeStructureMode,
  type TemplateFillData,
} from './docxTemplateFiller.js';
import {
  boldSkillCategoryHeads,
  markupToParagraphs,
  type RichSegment,
} from './richText.js';
import { normalizeEducation, type Education, type Experience } from '../routes/profile.js';

export type GenerateInput = {
  outputBasePath: string;
  uniqueNumber: number;
  company: string;
  role: string;
  salary?: string;
  description: string;
  resumeContent: string;
  /** Selected job URL — written into JD.txt */
  jobLink?: string;
  /** Absolute path to the selected .docx resume format */
  templatePath: string;
  profile: {
    fullName: string;
    roleTitle: string | null;
    contactLocation: string;
    contactPhone: string;
    contactEmail: string;
    contactLinkedin: string;
    experiences: Experience[];
    education: Education | Education[];
    /** static: company, role, location from the profile. dynamic: from resume content. */
    resumeStructure?: ResumeStructureMode | string | null;
  };
};

export type GenerateResult = {
  outputDir: string;
  pdfPath: string;
  docPath: string;
  jdPath: string;
};

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function matchProfileExperience(
  experiences: Experience[],
  role: string
): Experience | undefined {
  const needle = role.toLowerCase().trim();
  return (
    experiences.find((p) => p.role.toLowerCase().trim() === needle) ||
    experiences.find(
      (p) =>
        p.role.toLowerCase().includes(needle) || needle.includes(p.role.toLowerCase())
    )
  );
}

function toDynamicFills(raw: string, profileExperiences: Experience[]): DynamicExperienceFill[] {
  return parseDynamicExperiences(raw).map((exp, index) => ({
    companyName: exp.companyName,
    timeline: profileExperiences[index]?.period?.trim() || exp.timeline,
    title: exp.title,
    location: exp.location,
    leadDetails: exp.leadDetails,
    projects: exp.projects,
    trailingDetails: exp.trailingDetails,
    details: exp.details,
  }));
}

function buildTemplateData(input: GenerateInput): TemplateFillData {
  const { profile } = input;
  const parsed = parseResumeContent(input.resumeContent);
  const structure: ResumeStructureMode =
    profile.resumeStructure === 'dynamic' ? 'dynamic' : 'static';

  const experiences =
    structure === 'dynamic'
      ? []
      : parsed.experiences.length > 0
        ? parsed.experiences.map((exp) => {
            const profileExp = matchProfileExperience(profile.experiences, exp.role);
            return {
              companyRole: profileExp?.role || exp.role,
              companyName: profileExp?.companyName || '',
              workPeriod: profileExp?.period || '',
              companyBullet: exp.content,
            };
          })
        : profile.experiences.map((exp) => ({
            companyRole: exp.role,
            companyName: exp.companyName,
            workPeriod: exp.period,
            companyBullet: '',
          }));

  return {
    fullName: profile.fullName || '',
    role: profile.roleTitle || '',
    location: profile.contactLocation || '',
    phone: profile.contactPhone || '',
    email: profile.contactEmail || '',
    linkedin: profile.contactLinkedin || '',
    summary: parsed.professionalSummary,
    skillSet: boldSkillCategoryHeads(parsed.skillSet),
    certification: parsed.certification,
    experiences,
    structure,
    dynamicExperiences:
      structure === 'dynamic' ? toDynamicFills(input.resumeContent, profile.experiences) : [],
    educations: normalizeEducation(profile.education).map((edu) => ({
      university: edu.universityName || '',
      degree: edu.degreeMajor || '',
      universityLocation: edu.location || '',
      educationPeriod: edu.period || '',
    })),
  };
}

function stripLeadingBullet(text: string): string {
  return text.replace(/^\s*[-•*◦▪▸➤]+\s*/, '');
}

function skillLines(markup: string): RichSegment[][] {
  return markupToParagraphs(markup)
    .map((segs) => {
      const next = segs.map((s) => ({ ...s }));
      for (const seg of next) {
        if (!seg.text) continue;
        const stripped = stripLeadingBullet(seg.text);
        if (stripped !== seg.text) seg.text = stripped;
        break;
      }
      return next;
    })
    .filter((segs) => segs.some((s) => s.text.trim()));
}

function pdfFontFor(seg: RichSegment): string {
  if (seg.bold && seg.italic) return 'Helvetica-BoldOblique';
  if (seg.bold) return 'Helvetica-Bold';
  if (seg.italic) return 'Helvetica-Oblique';
  return 'Helvetica';
}

function writeRichLine(
  doc: InstanceType<typeof PDFDocument>,
  segs: RichSegment[],
  opts: { fontSize?: number; indent?: number; bullet?: boolean } = {}
) {
  const fontSize = opts.fontSize ?? 10;
  const indent = opts.indent ?? 0;
  const parts = segs.filter((s) => s.text.length > 0);
  if (!parts.length && !opts.bullet) return;

  const x = doc.page.margins.left + indent;
  doc.x = x;
  if (opts.bullet) {
    doc.font('Helvetica').fontSize(fontSize).text('•  ', { continued: true, lineBreak: false });
  }
  parts.forEach((seg, i) => {
    const last = i === parts.length - 1;
    doc.font(pdfFontFor(seg)).fontSize(fontSize).text(seg.text, {
      continued: !last,
      lineBreak: last,
      align: 'left',
    });
  });
  if (!parts.length && opts.bullet) {
    doc.text('');
  }
}

/**
 * Prefer converting the filled DOCX with Microsoft Word so PDF matches DOC layout.
 * Falls back to a structured PDFKit render of the same content.
 */
async function writePdfFromDocx(docxPath: string, pdfPath: string): Promise<boolean> {
  if (process.platform !== 'win32') return false;

  const docxEsc = docxPath.replace(/'/g, "''");
  const pdfEsc = pdfPath.replace(/'/g, "''");
  const script = `
$ErrorActionPreference = 'Stop'
$word = $null
$doc = $null
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0
  $doc = $word.Documents.Open('${docxEsc}', $false, $true)
  $out = '${pdfEsc}'
  if (Test-Path $out) { Remove-Item -Force $out }
  # 17 = wdExportFormatPDF
  $doc.ExportAsFixedFormat($out, 17)
  if (-not (Test-Path $out)) { throw 'PDF was not created' }
  exit 0
} catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  exit 1
} finally {
  if ($doc -ne $null) { $doc.Close([ref]$false) | Out-Null }
  if ($word -ne $null) { $word.Quit() | Out-Null }
  [System.GC]::Collect()
  [System.GC]::WaitForPendingFinalizers()
}
`;

  const ps1 = `${pdfPath}.convert.ps1`;
  fs.writeFileSync(ps1, script, 'utf8');
  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1],
        { windowsHide: true }
      );
      let err = '';
      child.stderr.on('data', (d) => {
        err += String(d);
      });
      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0 && fs.existsSync(pdfPath)) resolve();
        else reject(new Error(err || `Word PDF conversion failed (${code})`));
      });
    });
    return true;
  } catch {
    return false;
  } finally {
    try {
      fs.unlinkSync(ps1);
    } catch {
      /* ignore */
    }
  }
}

function writePdfFallback(filePath: string, data: TemplateFillData): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'LETTER' });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    doc.font('Helvetica-Bold').fontSize(16).text(data.fullName, { align: 'center' });

    if (data.role) {
      doc.moveDown(0.25);
      doc.font('Helvetica').fontSize(11).text(data.role, { align: 'center' });
    }

    doc.moveDown(0.25);
    const contact = [data.location, data.phone, data.email, data.linkedin]
      .filter((v) => Boolean(v?.trim()))
      .join(' • ');
    doc.font('Helvetica').fontSize(9).text(contact, { align: 'center' });

    const section = (title: string) => {
      doc.moveDown(0.7);
      doc.font('Helvetica-Bold').fontSize(11).text(title, { align: 'center' });
      doc.moveDown(0.25);
    };

    if (data.summary) {
      section('Summary');
      for (const segs of markupToParagraphs(data.summary)) {
        if (!segs.some((s) => s.text.trim())) continue;
        writeRichLine(doc, segs, { fontSize: 10 });
        doc.moveDown(0.15);
      }
    }

    if (data.skillSet) {
      section('Skills');
      for (const segs of skillLines(data.skillSet)) {
        writeRichLine(doc, segs, { fontSize: 10, bullet: true, indent: 8 });
        doc.moveDown(0.08);
      }
    }

    if (data.structure === 'dynamic' && data.dynamicExperiences.length) {
      section('Experience');
      data.dynamicExperiences.forEach((exp, index) => {
        doc.moveDown(0.2);
        const company = exp.companyName || '';
        const timeline = exp.timeline || '';
        if (company || timeline) {
          doc.font('Helvetica-Bold').fontSize(10).text([company, timeline].filter(Boolean).join('    '));
        }
        const titleLine = [exp.title, exp.location].filter(Boolean).join('    ');
        if (titleLine) doc.font('Helvetica').fontSize(10).text(titleLine);

        const chunks: { markup: string; project?: boolean }[] = [];
        if (index === 0) {
          if (exp.leadDetails.trim()) chunks.push({ markup: exp.leadDetails });
          for (const project of exp.projects) {
            if (project.title.trim()) chunks.push({ markup: project.title, project: true });
            if (project.details.trim()) chunks.push({ markup: project.details });
          }
          if (exp.trailingDetails.trim()) chunks.push({ markup: exp.trailingDetails });
        } else if (exp.details.trim()) {
          chunks.push({ markup: exp.details });
        }

        for (const chunk of chunks) {
          if (chunk.project) {
            writeRichLine(doc, [{ text: chunk.markup, bold: true }], {
              fontSize: 10,
              bullet: true,
              indent: 8,
            });
            doc.moveDown(0.08);
            continue;
          }
          for (const segs of skillLines(chunk.markup)) {
            writeRichLine(doc, segs, { fontSize: 10, bullet: true, indent: 8 });
            doc.moveDown(0.08);
          }
        }
      });
    } else if (data.experiences.length) {
      section('Experience');
      for (const exp of data.experiences) {
        doc.moveDown(0.2);
        const left = [exp.companyRole, exp.companyName].filter(Boolean).join(' - ');
        const period = exp.workPeriod || '';
        if (period) {
          doc.font('Helvetica-Bold').fontSize(10).text(`${left}    ${period}`);
        } else {
          doc.font('Helvetica-Bold').fontSize(10).text(left);
        }
        for (const segs of skillLines(exp.companyBullet)) {
          writeRichLine(doc, segs, { fontSize: 10, bullet: true, indent: 8 });
          doc.moveDown(0.08);
        }
      }
    }

    section('Education');
    for (const edu of data.educations) {
      const eduLine = [edu.university, edu.universityLocation].filter(Boolean).join('    ');
      if (eduLine) doc.font('Helvetica-Bold').fontSize(10).text(eduLine);
      if (edu.degree || edu.educationPeriod) {
        const deg = edu.degree || '';
        const period = edu.educationPeriod || '';
        if (deg && period) {
          doc.font('Helvetica-Oblique').fontSize(10).text(deg, { continued: true });
          doc.font('Helvetica-Bold').fontSize(10).text(`    ${period}`);
        } else if (deg) {
          doc.font('Helvetica-Oblique').fontSize(10).text(deg);
        } else {
          doc.font('Helvetica-Bold').fontSize(10).text(period);
        }
      }
      doc.moveDown(0.15);
    }

    if (data.certification) {
      section('Certification');
      for (const segs of markupToParagraphs(data.certification)) {
        if (!segs.some((s) => s.text.trim())) continue;
        writeRichLine(doc, segs, { fontSize: 10 });
        doc.moveDown(0.12);
      }
    }

    doc.end();
    stream.on('finish', () => resolve());
    stream.on('error', reject);
  });
}

async function writePdf(docxPath: string, pdfPath: string, data: TemplateFillData) {
  const converted = await writePdfFromDocx(docxPath, pdfPath);
  if (converted) return;
  await writePdfFallback(pdfPath, data);
}

function writeJd(filePath: string, input: GenerateInput) {
  const content = [
    `Company: ${input.company}`,
    `Role: ${input.role}`,
    ...(input.salary?.trim() ? [`Salary: ${input.salary.trim()}`] : []),
    ...(input.jobLink?.trim() ? [`Job link: ${input.jobLink.trim()}`] : []),
    '',
    'Description:',
    input.description,
    '',
  ].join('\n');
  fs.writeFileSync(filePath, content, 'utf8');
}

export async function generateResumeFiles(
  input: GenerateInput
): Promise<GenerateResult> {
  if (!input.templatePath?.trim()) {
    throw new Error('Profile has no resume format selected');
  }

  const folderName = `${input.uniqueNumber}.${sanitizePathSegment(input.company)}-${sanitizePathSegment(input.role)}`;
  const outputDir = path.resolve(input.outputBasePath, folderName);
  ensureDir(outputDir);

  const resumeFileName = sanitizePathSegment(input.profile.fullName) || 'resume';
  const pdfPath = path.join(outputDir, `${resumeFileName}.pdf`);
  const docPath = path.join(outputDir, `${resumeFileName}.docx`);
  const jdPath = path.join(outputDir, 'JD.txt');

  const data = buildTemplateData(input);

  await fillDocxTemplate(input.templatePath, docPath, data);
  await writePdf(docPath, pdfPath, data);
  writeJd(jdPath, input);

  return { outputDir, pdfPath, docPath, jdPath };
}
