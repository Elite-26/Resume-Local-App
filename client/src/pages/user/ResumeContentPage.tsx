import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Sparkles, X } from 'lucide-react';
import { api, SELECTED_PROFILE_KEY } from '../../lib/api';
import { normalizeJobLink } from '../../lib/applicationImport';
import {
  clearSelectedJobLink,
  getSelectedApplication,
  getSelectedJobLink,
  setGenerateSuccess,
} from '../../lib/jobFlow';
import { RichTextEditor } from '../../components/RichTextEditor';

export function ResumeContentPage() {
  const navigate = useNavigate();
  const profileId = localStorage.getItem(SELECTED_PROFILE_KEY) || '';
  // Snapshot once so clearing session after generate cannot re-trigger redirects.
  const [jobLink] = useState(() => getSelectedJobLink());
  const [imported] = useState(() => {
    const job = getSelectedApplication();
    if (!job || normalizeJobLink(job.link) !== normalizeJobLink(jobLink)) return null;
    return job;
  });

  const [company, setCompany] = useState(imported?.company || '');
  const [role, setRole] = useState(imported?.title || '');
  const [salary, setSalary] = useState(imported?.salary || '');
  const [description, setDescription] = useState(imported?.jobDescription || '');
  const [resumeContent, setResumeContent] = useState('');
  const [similar, setSimilar] = useState<string[]>([]);
  const [alreadyApplied, setAlreadyApplied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copyNote, setCopyNote] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pendingSuccess, setPendingSuccess] = useState('');
  const [resumeStructure, setResumeStructure] = useState<'static' | 'dynamic'>('static');

  const contentPlaceholder =
    resumeStructure === 'dynamic'
      ? `PROFESSIONAL SUMMARY
…
SKILL SET
…
EXPERIENCE
TITLE: Title at latest company
Company: Company name
Location: City, ST
Delivered …
PROJECT: First project name
• bullet
PROJECT: Second project name
• bullet
PROJECT_END
• bullet
EXPERIENCE_END
TITLE: Title at earlier company
Company: Company name
Location: City, ST
• bullet
CERTIFICATION
…`
      : `PROFESSIONAL SUMMARY
…
SKILL SET
…
EXPERIENCE
TITLE: Role Name
• bullet
CERTIFICATION
…`;

  useEffect(() => {
    if (!profileId) {
      navigate('/app/profile', { replace: true });
      return;
    }
    if (!jobLink) {
      navigate('/app/select-job', { replace: true });
    }
  }, [profileId, jobLink, navigate]);

  useEffect(() => {
    if (!profileId) return;
    api
      .getProfile(profileId)
      .then(({ profile }) => {
        setResumeStructure(profile.resume_structure === 'dynamic' ? 'dynamic' : 'static');
      })
      .catch(() => {});
  }, [profileId]);

  useEffect(() => {
    if (!company.trim() || !profileId) {
      setSimilar([]);
      setAlreadyApplied(false);
      return;
    }
    const t = setTimeout(() => {
      api
        .checkCompany(company, role, profileId)
        .then((r) => {
          setSimilar(r.similarCompanies);
          setAlreadyApplied(r.alreadyApplied);
        })
        .catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [company, role, profileId]);

  useEffect(() => {
    if (company.trim() && role.trim() && error === 'Company and role are required.') {
      setError('');
    }
  }, [company, role, error]);

  useEffect(() => {
    return () => {
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
    };
  }, [pdfPreviewUrl]);

  function requireCompanyRole() {
    if (!company.trim() || !role.trim()) {
      setError('Company and role are required.');
      return false;
    }
    setError('');
    return true;
  }

  async function copyPromptAndJd() {
    setCopyNote('');
    if (!requireCompanyRole()) return;
    try {
      const { bundled } = await api.promptBundle(
        company,
        role,
        description,
        profileId,
        salary
      );
      await navigator.clipboard.writeText(bundled);
      setCopyNote('Prompt & JD copied to clipboard.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Copy failed');
    }
  }

  function finishAfterPreview() {
    if (pdfPreviewUrl) {
      URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(null);
    }
    if (pendingSuccess) {
      setGenerateSuccess(pendingSuccess);
      setPendingSuccess('');
    }
    clearSelectedJobLink();
    navigate('/app/select-job', { replace: true });
  }

  async function generate() {
    if (!requireCompanyRole()) return;
    setBusy(true);
    setError('');
    setMessage('');
    setCopyNote('');
    try {
      const { build, paths } = await api.generateBuild({
        jobLink,
        profileId,
        company: company.trim(),
        roleTitle: role.trim(),
        salary: salary.trim(),
        description,
        resumeContent,
      });
      const successMsg = `Generated PDF, DOC, and JD.\n${paths.outputDir || ''}`;
      setPendingSuccess(successMsg);

      try {
        const blob = await api.getBuildPdfBlob(build.id);
        const url = URL.createObjectURL(blob);
        if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
        setPdfPreviewUrl(url);
      } catch {
        // If preview fails, still complete the flow with the success note.
        setGenerateSuccess(successMsg);
        setPendingSuccess('');
        clearSelectedJobLink();
        navigate('/app/select-job', { replace: true });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6 flex-1 min-h-0 lg:h-[calc(100dvh-8.5rem)]">
      <div className="shrink-0">
        <h1 className="page-title">Resume</h1>
        <p className="page-lead break-all">
          Job link:{' '}
          <a
            href={/^https?:\/\//i.test(jobLink.trim()) ? jobLink.trim() : `https://${jobLink.trim()}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sage hover:underline"
          >
            {jobLink}
          </a>
        </p>
      </div>

      {error && (
        <p className="text-sm text-ember bg-ember/10 rounded-xl px-3 py-2 whitespace-pre-wrap shrink-0">
          {error}
        </p>
      )}

      {similar.length > 0 && (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-sm shrink-0">
          <p className="font-medium text-amber-800 dark:text-amber-200">
            Similar companies already applied:
          </p>
          <p className="mt-1">{similar.join(', ')}</p>
        </div>
      )}
      {alreadyApplied && (
        <div className="rounded-xl bg-ember/10 border border-ember/20 px-3 py-2 text-sm text-ember shrink-0">
          Warning: you already applied to this company&apos;s <strong>{role}</strong> role.
        </div>
      )}

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2 flex-1 min-h-0 auto-rows-fr">
        <section className="surface p-4 sm:p-6 flex flex-col gap-4 min-w-0 min-h-[24rem] lg:min-h-0 lg:h-full">
          <h2 className="font-display text-lg sm:text-xl shrink-0">Job description</h2>
          <div className="grid sm:grid-cols-2 gap-4 shrink-0">
            <div className="field">
              <label className="label">
                Company <span className="text-ember">*</span>
              </label>
              <input
                className="input"
                value={company}
                required
                onChange={(e) => setCompany(e.target.value)}
              />
            </div>
            <div className="field">
              <label className="label">
                Role <span className="text-ember">*</span>
              </label>
              <input
                className="input"
                value={role}
                required
                onChange={(e) => setRole(e.target.value)}
              />
            </div>
          </div>
          <div className="field shrink-0">
            <label className="label">Salary</label>
            <input
              className="input"
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
              placeholder="e.g. $140,000 – $160,000"
            />
          </div>
          <div className="field flex-1 flex flex-col min-h-0 gap-1.5">
            <label className="label shrink-0">Description</label>
            <textarea
              className="input flex-1 min-h-0 resize-none font-mono text-xs leading-relaxed"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2 shrink-0">
            <button type="button" className="btn-secondary w-full sm:w-auto" onClick={copyPromptAndJd}>
              <Copy size={16} /> Copy prompt & JD
            </button>
            {copyNote && (
              <p className="text-sm text-sage bg-sage/10 rounded-xl px-3 py-2">{copyNote}</p>
            )}
          </div>
        </section>

        <section className="surface p-4 sm:p-6 flex flex-col gap-4 min-w-0 min-h-[24rem] lg:min-h-0 lg:h-full">
          <div className="flex flex-col-reverse sm:flex-row sm:items-start sm:justify-between gap-2 shrink-0">
            <div className="min-w-0">
              <h2 className="font-display text-lg sm:text-xl">Resume content</h2>
              {resumeStructure === 'dynamic' && (
                <p className="text-xs text-muted mt-1">
                  Header, summary, skills, education, and certification match structure 1. For
                  experience, the latest company includes projects; earlier companies are bullets
                  only. Company, role, and location come from the content.
                </p>
              )}
            </div>
            <button
              type="button"
              className="btn-primary w-full sm:w-auto shrink-0"
              disabled={busy}
              onClick={generate}
            >
              <Sparkles size={16} />
              {busy ? 'Generating…' : 'Generate PDF & DOC'}
            </button>
          </div>
          <div className="field flex-1 flex flex-col min-h-0">
            <RichTextEditor
              className="flex-1 min-h-0"
              value={resumeContent}
              onChange={setResumeContent}
              placeholder={contentPlaceholder}
            />
          </div>
          <div className="flex flex-col-reverse sm:flex-row flex-wrap gap-2 shrink-0">
            <button
              type="button"
              className="btn-secondary w-full sm:w-auto"
              onClick={() => {
                clearSelectedJobLink();
                navigate('/app/select-job');
              }}
            >
              <ArrowLeft size={16} /> Back to Select Job
            </button>
            <button type="button" className="btn-primary w-full sm:w-auto" disabled={busy} onClick={generate}>
              <Sparkles size={16} />
              {busy ? 'Generating…' : 'Generate PDF & DOC'}
            </button>
          </div>
        </section>
      </div>

      {message && (
        <p className="text-sm text-sage bg-sage/10 rounded-xl px-3 py-2 whitespace-pre-wrap shrink-0">
          {message}
        </p>
      )}

      {pdfPreviewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-ink/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Generated resume PDF preview"
        >
          <div className="surface w-full max-w-5xl h-[min(90dvh,52rem)] flex flex-col overflow-hidden shadow-xl">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-black/5 dark:border-white/10 shrink-0">
              <div className="min-w-0">
                <h2 className="font-display text-lg truncate">Resume preview</h2>
                <p className="text-xs text-muted truncate">
                  {company} · {role}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={pdfPreviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary !py-2"
                >
                  Open PDF
                </a>
                <button type="button" className="btn-primary !py-2" onClick={finishAfterPreview}>
                  Done
                </button>
                <button
                  type="button"
                  className="btn-ghost !px-2.5"
                  aria-label="Close preview"
                  onClick={finishAfterPreview}
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <iframe
              title="Generated resume PDF"
              src={pdfPreviewUrl}
              className="flex-1 w-full min-h-0 bg-white"
            />
          </div>
        </div>
      )}
    </div>
  );
}
