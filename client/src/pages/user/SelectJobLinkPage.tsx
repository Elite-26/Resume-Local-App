import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Download, RotateCcw } from 'lucide-react';
import { api, SELECTED_PROFILE_KEY, type ResumeBuild } from '../../lib/api';
import {
  applicationExportFilename,
  downloadApplicationsFile,
  normalizeJobLink,
  type ImportedApplication,
} from '../../lib/applicationImport';
import {
  clearSelectedJobLink,
  getImportedApplication,
  getJobSelectionResetAt,
  getParsedJobLinks,
  resetJobSelections,
  setParsedJobLinks,
  setSelectedApplication,
  setSelectedJobLink,
  takeGenerateSuccess,
} from '../../lib/jobFlow';

function jobLinkHref(link: string) {
  const trimmed = link.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function latestAppliedBuilds(builds: ResumeBuild[]) {
  const resetAt = getJobSelectionResetAt();
  const byLink = new Map<string, ResumeBuild>();
  for (const build of builds) {
    if (!build.job_link) continue;
    if (resetAt && !(new Date(build.created_at) > resetAt)) continue;
    const key = normalizeJobLink(build.job_link);
    const current = byLink.get(key);
    if (!current || new Date(build.created_at) > new Date(current.created_at)) {
      byLink.set(key, build);
    }
  }
  return byLink;
}

function applicationForLink(link: string, build: ResumeBuild | undefined): ImportedApplication {
  const imported = getImportedApplication(link);
  return {
    link: (build?.job_link || imported?.link || link).trim(),
    company: (build?.company || imported?.company || '').trim(),
    salary: (build?.salary || imported?.salary || '').trim(),
    title: (build?.role_title || imported?.title || '').trim(),
    jobDescription: (build?.description || imported?.jobDescription || '').trim(),
  };
}

export function SelectJobLinkPage() {
  const navigate = useNavigate();
  const [links, setLinks] = useState<string[]>(() => getParsedJobLinks());
  const [builds, setBuilds] = useState<ResumeBuild[]>([]);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);

  const appliedByLink = useMemo(() => latestAppliedBuilds(builds), [builds]);

  const availableCount = useMemo(
    () => links.filter((link) => !appliedByLink.has(normalizeJobLink(link))).length,
    [links, appliedByLink]
  );

  const appliedApplications = useMemo(() => {
    const seen = new Set<string>();
    const jobs: ImportedApplication[] = [];
    for (const link of links) {
      const key = normalizeJobLink(link);
      if (!appliedByLink.has(key) || seen.has(key)) continue;
      seen.add(key);
      jobs.push(applicationForLink(link, appliedByLink.get(key)));
    }
    return jobs;
  }, [links, appliedByLink]);

  const load = useCallback(
    async (opts?: { forceReloadLinks?: boolean; fromReset?: boolean }) => {
      setLoading(true);
      setError('');
      try {
        let parsed = opts?.forceReloadLinks ? [] : getParsedJobLinks();

        if (!parsed.length || opts?.forceReloadLinks) {
          const { links: text } = await api.getJobLinks();
          if (!text?.trim()) {
            navigate('/app/job-links', { replace: true });
            return;
          }
          const result = await api.parseLinks(text);
          parsed = result.links;
          if (!parsed.length) {
            navigate('/app/job-links', { replace: true });
            return;
          }
          setParsedJobLinks(parsed);
        }

        const { builds: history } = await api.getBuilds(
          undefined,
          localStorage.getItem(SELECTED_PROFILE_KEY) || undefined
        );

        setLinks(parsed);
        setBuilds(history);
        setSelected('');
        if (opts?.fromReset) {
          setSuccess('Job selections reset. Applied locks cleared — you can choose any link again.');
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load job links');
      } finally {
        setLoading(false);
      }
    },
    [navigate]
  );

  useEffect(() => {
    clearSelectedJobLink();
    const note = takeGenerateSuccess();
    if (note) setSuccess(note);

    if (!localStorage.getItem(SELECTED_PROFILE_KEY)) {
      navigate('/app/profile', { replace: true });
      return;
    }

    void load();
  }, [navigate, load]);

  useEffect(() => {
    if (selected) setError('');
  }, [selected]);

  function onReset() {
    resetJobSelections();
    void load({ forceReloadLinks: true, fromReset: true });
  }

  function onExportApplied() {
    if (!appliedApplications.length) {
      setError('No applied jobs to export.');
      return;
    }
    setError('');
    downloadApplicationsFile(appliedApplications, 'applied-applications.json');
  }

  function onExportOne(link: string) {
    const job = applicationForLink(link, appliedByLink.get(normalizeJobLink(link)));
    setError('');
    downloadApplicationsFile([job], applicationExportFilename(job));
  }

  function continueNext() {
    if (!selected) {
      setError('Select a job link to continue.');
      return;
    }
    if (appliedByLink.has(normalizeJobLink(selected))) {
      setError('That job was already applied. Choose another link.');
      return;
    }
    setSelectedJobLink(selected);
    setSelectedApplication(getImportedApplication(selected));
    navigate('/app/resume');
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-title">Select Job</h1>
          {/* <p className="page-lead">
            Choose one application, then continue to the Resume generator. Imported jobs show
            company and position. Pasted links leave those blank. Applied jobs stay listed but
            cannot be selected again. Export them as JSON to import again on Job Links.
          </p> */}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 shrink-0">
          <button
            type="button"
            className="btn-secondary w-full sm:w-auto"
            onClick={onExportApplied}
            disabled={loading || appliedApplications.length === 0}
          >
            <Download size={16} /> Export applied
          </button>
          <button
            type="button"
            className="btn-secondary w-full sm:w-auto"
            onClick={onReset}
            disabled={loading}
          >
            <RotateCcw size={16} /> Reset
          </button>
        </div>
      </div>

      <section className="surface p-4 sm:p-6 space-y-4">
        {!loading && links.length > 0 && availableCount === 0 && (
          <p className="text-sm text-muted bg-black/[0.03] dark:bg-white/5 rounded-xl px-3 py-2">
            All listed jobs have already been applied. Use Reset to unlock them, or add new links on
            Job Links.
          </p>
        )}

        {error && <p className="text-sm text-ember bg-ember/10 rounded-xl px-3 py-2">{error}</p>}
        {success && (
          <p className="text-sm text-sage bg-sage/10 rounded-xl px-3 py-2 whitespace-pre-wrap">
            {success}
          </p>
        )}

        {loading && links.length === 0 ? (
          <p className="text-sm text-muted">Loading links…</p>
        ) : (
          <div className="max-h-[32rem] overflow-y-auto">
            <div className="hidden sm:grid sm:grid-cols-[1.25rem_8rem_10rem_minmax(0,1fr)_auto] gap-3 px-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
              <span />
              <span>Company</span>
              <span>Position</span>
              <span>Job URL</span>
              <span />
            </div>
            <div className="space-y-2">
            {links.map((link, idx) => {
              const appliedBuild = appliedByLink.get(normalizeJobLink(link));
              const applied = Boolean(appliedBuild);
              const imported = getImportedApplication(link);
              const company = (appliedBuild?.company || imported?.company || '').trim();
              const position = (appliedBuild?.role_title || imported?.title || '').trim();
              return (
                <label
                  key={`${link}-${idx}`}
                  className={`grid grid-cols-1 sm:grid-cols-[1.25rem_8rem_10rem_minmax(0,1fr)_auto] gap-2 sm:gap-3 items-start sm:items-center rounded-xl border px-3 py-3 transition ${
                    applied
                      ? 'border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.03]'
                      : selected === link
                        ? 'cursor-pointer border-sage bg-sage/10'
                        : 'cursor-pointer border-black/5 dark:border-white/10 hover:bg-black/[0.03] dark:hover:bg-white/5'
                  }`}
                >
                  <input
                    type="radio"
                    name="joblink"
                    className="shrink-0 mt-0.5 sm:mt-0"
                    disabled={applied}
                    checked={!applied && selected === link}
                    onChange={() => {
                      if (!applied) setSelected(link);
                    }}
                  />
                  <span className="min-w-0">
                    <span className="sm:hidden block text-[11px] font-semibold uppercase tracking-wide text-muted">
                      Company
                    </span>
                    <span className={`block text-sm truncate ${company && !applied ? '' : 'text-muted'} ${applied ? 'line-through' : ''}`}>
                      {company || '—'}
                    </span>
                  </span>
                  <span className="min-w-0">
                    <span className="sm:hidden block text-[11px] font-semibold uppercase tracking-wide text-muted">
                      Position
                    </span>
                    <span className={`block text-sm truncate ${position && !applied ? '' : 'text-muted'} ${applied ? 'line-through' : ''}`}>
                      {position || '—'}
                    </span>
                  </span>
                  <span className="min-w-0">
                    <span className="sm:hidden block text-[11px] font-semibold uppercase tracking-wide text-muted">
                      Job URL
                    </span>
                    <a
                      href={jobLinkHref(link)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`block text-sm break-all hover:underline ${
                        applied ? 'line-through text-muted' : 'text-sage'
                      }`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {link}
                    </a>
                  </span>
                  {applied ? (
                    <span className="justify-self-start sm:justify-self-end flex items-center gap-2 shrink-0">
                      <span className="rounded-md bg-sage/15 text-sage px-2 py-0.5 text-xs font-medium">
                        Applied
                      </span>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          onExportOne(link);
                        }}
                      >
                        <Download size={14} /> Export
                      </button>
                    </span>
                  ) : (
                    <span className="hidden sm:block" />
                  )}
                </label>
              );
            })}
            </div>
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary w-full sm:w-auto"
            onClick={() => navigate('/app/job-links')}
          >
            <ArrowLeft size={16} /> Back to Job Links
          </button>
          <button
            type="button"
            className="btn-primary w-full sm:w-auto"
            onClick={continueNext}
            disabled={loading || availableCount === 0}
          >
            Next: Resume <ArrowRight size={16} />
          </button>
        </div>
      </section>
    </div>
  );
}
