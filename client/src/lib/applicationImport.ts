/** Fields kept from an imported application JSON file. */
export type ImportedApplication = {
  link: string;
  company: string;
  salary: string;
  title: string;
  jobDescription: string;
};

export function normalizeJobLink(link: string): string {
  return link.trim().replace(/\/+$/, '');
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function textValue(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (Array.isArray(value)) return value.map(textValue).filter(Boolean).join('\n');
  return '';
}

function salaryValue(value: unknown): string {
  const plain = textValue(value);
  if (plain) return plain;
  const record = asRecord(value);
  if (!record) return '';
  const min = textValue(record.min ?? record.minimum ?? record.from);
  const max = textValue(record.max ?? record.maximum ?? record.to);
  if (min && max) return `${min} – ${max}`;
  return min || max || textValue(record.text ?? record.display);
}

function readJob(record: Record<string, unknown>): ImportedApplication | null {
  const companyInfo = asRecord(record.company_info) || asRecord(record.companyInfo);
  const link = textValue(record.link ?? record.url ?? record.job_link);
  if (!link) return null;
  const title = textValue(record.title ?? record.position ?? record.role);
  const company = textValue(companyInfo?.name ?? record.company);
  const salary = salaryValue(companyInfo?.salary ?? record.salary);
  const jobDescription = textValue(
    record.job_description ?? record.jobDescription ?? record.description
  );
  if (!title && !company && !jobDescription && !salary) return null;
  return { link, company, salary, title, jobDescription };
}

function collectJobs(node: unknown, out: ImportedApplication[]) {
  if (Array.isArray(node)) {
    for (const item of node) collectJobs(item, out);
    return;
  }
  const record = asRecord(node);
  if (!record) return;
  const job = readJob(record);
  if (job) {
    out.push(job);
    return;
  }
  for (const value of Object.values(record)) collectJobs(value, out);
}

/** JSON written by Select Job export. Job Links import reads these same fields. */
export function serializeApplications(jobs: ImportedApplication[]): string {
  return JSON.stringify(
    jobs.map((job) => ({
      link: job.link.trim(),
      company: job.company.trim(),
      salary: job.salary.trim(),
      title: job.title.trim(),
      jobDescription: job.jobDescription.trim(),
    })),
    null,
    2
  );
}

export function applicationExportFilename(job: ImportedApplication): string {
  const slug = [job.company, job.title]
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .join('-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${slug || 'application'}.json`;
}

export function downloadApplicationsFile(jobs: ImportedApplication[], filename: string) {
  const blob = new Blob([serializeApplications(jobs)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename.toLowerCase().endsWith('.json') ? filename : `${filename}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Pull company, salary, title, link, and job description from an applications JSON file. */
export function parseApplicationsJson(text: string): ImportedApplication[] {
  let data: unknown;
  try {
    data = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  const found: ImportedApplication[] = [];
  collectJobs(data, found);
  const byLink = new Map<string, ImportedApplication>();
  for (const job of found) byLink.set(normalizeJobLink(job.link), job);
  return [...byLink.values()];
}
