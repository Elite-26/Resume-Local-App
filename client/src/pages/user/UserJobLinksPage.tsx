import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Upload } from 'lucide-react';
import { api, SELECTED_PROFILE_KEY } from '../../lib/api';
import { normalizeJobLink, parseApplicationsJson } from '../../lib/applicationImport';
import { rememberImportedApplications, setParsedJobLinks } from '../../lib/jobFlow';

export function UserJobLinksPage() {
  const navigate = useNavigate();
  const [links, setLinks] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const profileId = localStorage.getItem(SELECTED_PROFILE_KEY);

  useEffect(() => {
    if (!profileId) {
      navigate('/app/profile', { replace: true });
      return;
    }
    api
      .getJobLinks()
      .then((r) => setLinks(r.links || ''))
      .catch(() => {});
  }, [profileId, navigate]);

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setMessage('');
    try {
      const jobs = parseApplicationsJson(await file.text());
      if (!jobs.length) {
        setError('No job postings with a link were found in that file.');
        return;
      }
      rememberImportedApplications(jobs);
      const seen = new Set(
        links
          .split(/\r?\n/)
          .map((line) => normalizeJobLink(line))
          .filter(Boolean)
      );
      const additions = jobs
        .map((job) => job.link.trim())
        .filter((link) => !seen.has(normalizeJobLink(link)));
      const nextLinks = [links.trim(), ...additions].filter(Boolean).join('\n');
      setLinks(nextLinks);
      await api.saveJobLinks(nextLinks);
      const parsed = nextLinks
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      setParsedJobLinks(parsed);
      setMessage(`Imported ${jobs.length} application${jobs.length === 1 ? '' : 's'}.`);
      navigate('/app/select-job');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import applications');
    }
  }

  async function onNext() {
    setError('');
    try {
      const { links: parsed } = await api.parseLinks(links);
      if (!parsed.length) {
        setError('Enter at least one job link (one per line).');
        return;
      }
      await api.saveJobLinks(links);
      setParsedJobLinks(parsed);
      navigate('/app/select-job');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse links');
    }
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6 min-h-[calc(100dvh-8.5rem)]">
      <div className="shrink-0">
        <h1 className="page-title">Job Links</h1>
        <p className="page-lead">
          Paste job links separated by line breaks, or import an applications JSON file, then go to Select Job.
        </p>
      </div>

      <section className="surface p-4 sm:p-6 flex flex-col gap-4 flex-1 min-h-0">
        <textarea
          className="input flex-1 min-h-48 sm:min-h-64 font-mono text-xs leading-relaxed resize-none"
          value={links}
          onChange={(e) => setLinks(e.target.value)}
          placeholder={'https://jobs.example.com/role-a\nhttps://jobs.example.com/role-b'}
        />
        {error && (
          <p className="text-sm text-ember bg-ember/10 rounded-xl px-3 py-2 shrink-0">{error}</p>
        )}
        {message && (
          <p className="text-sm text-sage bg-sage/10 rounded-xl px-3 py-2 shrink-0">{message}</p>
        )}
        <div className="flex flex-col-reverse sm:flex-row flex-wrap gap-2 shrink-0">
          <label className="btn-secondary cursor-pointer w-full sm:w-auto">
            <Upload size={16} /> Import applications
            <input
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={onImport}
            />
          </label>
          <button type="button" className="btn-primary w-full sm:w-auto" onClick={onNext}>
            Next: Select Job <ArrowRight size={16} />
          </button>
        </div>
      </section>
    </div>
  );
}
