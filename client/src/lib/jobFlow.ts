import {
  normalizeJobLink,
  type ImportedApplication,
} from './applicationImport';

/** Session keys for the profile → links → select → resume flow. */

const PARSED_JOB_LINKS_KEY = 'parsedJobLinks';
const SELECTED_JOB_LINK_KEY = 'selectedJobLink';
const GENERATE_SUCCESS_KEY = 'generateSuccess';
const JOB_SELECTION_RESET_AT_KEY = 'jobSelectionResetAt';
const IMPORTED_APPLICATIONS_KEY = 'importedApplications';
const SELECTED_APPLICATION_KEY = 'selectedApplication';

export function getParsedJobLinks(): string[] {
  try {
    const raw = sessionStorage.getItem(PARSED_JOB_LINKS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function setParsedJobLinks(links: string[]) {
  sessionStorage.setItem(PARSED_JOB_LINKS_KEY, JSON.stringify(links));
}

export function getSelectedJobLink(): string {
  return sessionStorage.getItem(SELECTED_JOB_LINK_KEY) || '';
}

export function setSelectedJobLink(link: string) {
  sessionStorage.setItem(SELECTED_JOB_LINK_KEY, link);
}

export function clearSelectedJobLink() {
  sessionStorage.removeItem(SELECTED_JOB_LINK_KEY);
  sessionStorage.removeItem(SELECTED_APPLICATION_KEY);
}

function readImportedMap(): Record<string, ImportedApplication> {
  try {
    const raw = sessionStorage.getItem(IMPORTED_APPLICATIONS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as Record<string, ImportedApplication>;
  } catch {
    return {};
  }
}

export function rememberImportedApplications(jobs: ImportedApplication[]) {
  const map = readImportedMap();
  for (const job of jobs) {
    map[normalizeJobLink(job.link)] = job;
  }
  sessionStorage.setItem(IMPORTED_APPLICATIONS_KEY, JSON.stringify(map));
}

export function getImportedApplication(link: string): ImportedApplication | null {
  const job = readImportedMap()[normalizeJobLink(link)];
  return job?.link ? job : null;
}

export function setSelectedApplication(job: ImportedApplication | null) {
  if (!job) {
    sessionStorage.removeItem(SELECTED_APPLICATION_KEY);
    return;
  }
  sessionStorage.setItem(SELECTED_APPLICATION_KEY, JSON.stringify(job));
}

export function getSelectedApplication(): ImportedApplication | null {
  try {
    const raw = sessionStorage.getItem(SELECTED_APPLICATION_KEY);
    if (!raw) return null;
    const job = JSON.parse(raw) as ImportedApplication;
    return job?.link ? job : null;
  } catch {
    return null;
  }
}

export function takeGenerateSuccess(): string {
  const note = sessionStorage.getItem(GENERATE_SUCCESS_KEY) || '';
  if (note) sessionStorage.removeItem(GENERATE_SUCCESS_KEY);
  return note;
}

export function setGenerateSuccess(message: string) {
  sessionStorage.setItem(GENERATE_SUCCESS_KEY, message);
}

export function getJobSelectionResetAt(): Date | null {
  const raw = localStorage.getItem(JOB_SELECTION_RESET_AT_KEY);
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Marks prior applied jobs as selectable again; history is unchanged. */
export function resetJobSelections() {
  localStorage.setItem(JOB_SELECTION_RESET_AT_KEY, new Date().toISOString());
  clearSelectedJobLink();
}
