import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Trash2 } from 'lucide-react';
import { api, SELECTED_PROFILE_KEY, type ResumeBuild } from '../../lib/api';

function formatDateOnly(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString();
}

function jobLinkHref(link: string) {
  const trimmed = link.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function UserHistoryPage() {
  const navigate = useNavigate();
  const profileId = localStorage.getItem(SELECTED_PROFILE_KEY) || '';
  const [builds, setBuilds] = useState<ResumeBuild[]>([]);
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!profileId) {
      navigate('/app/profile', { replace: true });
    }
  }, [profileId, navigate]);

  useEffect(() => {
    if (!profileId) return;

    let cancelled = false;
    setLoading(true);
    setError('');
    api
      .getBuilds(submittedQuery, profileId)
      .then((r) => {
        if (!cancelled) setBuilds(r.builds);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [submittedQuery, profileId]);

  const emptyLabel = useMemo(() => {
    if (submittedQuery.trim()) return `No generated resumes match “${submittedQuery.trim()}”.`;
    return 'No generated resumes yet for this profile.';
  }, [submittedQuery]);

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setSubmittedQuery(query.trim());
  }

  async function onDelete(id: string) {
    if (!window.confirm('Delete this history record? This cannot be undone.')) return;
    setDeletingId(id);
    setError('');
    try {
      await api.deleteBuild(id);
      setBuilds((prev) => prev.filter((b) => b.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    } finally {
      setDeletingId(null);
    }
  }

  if (!profileId) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">History</h1>
        <p className="page-lead">
          Applications for the current profile only. Search by #, company, role, salary, or job link.
        </p>
      </div>

      <form onSubmit={onSearch} className="flex flex-col sm:flex-row flex-wrap gap-2">
        <div className="relative flex-1 min-w-0 sm:min-w-[14rem]">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
          />
          <input
            className="input !pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search #, company, role, salary, link…"
            aria-label="Search history"
          />
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn-primary flex-1 sm:flex-none" disabled={loading}>
            Search
          </button>
          {submittedQuery && (
            <button
              type="button"
              className="btn-secondary flex-1 sm:flex-none"
              onClick={() => {
                setQuery('');
                setSubmittedQuery('');
              }}
            >
              Clear
            </button>
          )}
        </div>
      </form>

      {error && <p className="text-sm text-ember bg-ember/10 rounded-xl px-3 py-2">{error}</p>}

      <div className="surface overflow-hidden">
        <div className="table-scroll">
          <table className="data-table min-w-[36rem]">
            <thead className="bg-black/[0.03] dark:bg-white/5 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Company</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Salary</th>
                <th className="px-4 py-3">Job link</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted">
                    Loading history…
                  </td>
                </tr>
              ) : builds.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted">
                    {emptyLabel}
                  </td>
                </tr>
              ) : (
                builds.map((b) => (
                  <tr
                    key={b.id}
                    className="border-t border-black/5 dark:border-white/10 align-top"
                  >
                    <td className="px-4 py-3 font-medium tabular-nums whitespace-nowrap">
                      {b.unique_number ?? '—'}
                    </td>
                    <td className="px-4 py-3 font-medium">{b.company || '—'}</td>
                    <td className="px-4 py-3">{b.role_title || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{b.salary?.trim() || '—'}</td>
                    <td className="px-4 py-3 text-xs max-w-[14rem] sm:max-w-[18rem]">
                      {b.job_link ? (
                        <a
                          href={jobLinkHref(b.job_link)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={b.job_link}
                          className="block truncate text-sage hover:underline"
                        >
                          {b.job_link}
                        </a>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted whitespace-nowrap">
                      {formatDateOnly(b.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="btn-ghost !px-2 !py-1.5 text-ember hover:bg-ember/10"
                        title="Delete"
                        disabled={deletingId === b.id}
                        onClick={() => onDelete(b.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
