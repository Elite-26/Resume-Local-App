import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { api, SELECTED_PROFILE_KEY, type Profile } from '../../lib/api';

export function SelectProfilePage() {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selected, setSelected] = useState(localStorage.getItem(SELECTED_PROFILE_KEY) || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getAssignedProfiles()
      .then((r) => {
        setProfiles(r.profiles);
        if (
          r.profiles.length &&
          !r.profiles.some((p) => p.id === localStorage.getItem(SELECTED_PROFILE_KEY))
        ) {
          setSelected('');
          localStorage.removeItem(SELECTED_PROFILE_KEY);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function continueNext() {
    if (!selected) {
      setError('Select a profile to continue.');
      return;
    }
    localStorage.setItem(SELECTED_PROFILE_KEY, selected);
    navigate('/app/job-links');
  }

  if (loading) return <p className="text-muted">Loading profiles…</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Choose profile</h1>
        <p className="page-lead">
          Select which profile you will use for this application session.
        </p>
      </div>

      {profiles.length === 0 ? (
        <div className="surface p-4 sm:p-6 text-sm text-muted">
          No profiles assigned yet. Ask an admin to assign a profile to your account.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="hidden xl:grid xl:grid-cols-[1.25rem_minmax(0,1.15fr)_minmax(0,1.35fr)_minmax(0,0.95fr)_13rem] gap-x-6 px-5 border border-transparent text-[11px] font-semibold uppercase tracking-wide text-muted">
            <span />
            <span>Profile</span>
            <span>Contact</span>
            <span>Resume format</span>
            <span className="grid grid-cols-[9rem_3rem] gap-4">
              <span>Status</span>
              <span>Apply</span>
            </span>
          </div>
          {profiles.map((p) => (
            <label
              key={p.id}
              className={`surface px-4 sm:px-5 py-4 grid grid-cols-[1.25rem_minmax(0,1fr)] md:grid-cols-[1.25rem_minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[1.25rem_minmax(0,1.15fr)_minmax(0,1.35fr)_minmax(0,0.95fr)_13rem] gap-x-3 gap-y-3 md:gap-x-6 xl:items-center cursor-pointer transition ${
                selected === p.id ? 'ring-2 ring-sage/40 bg-sage/5' : ''
              }`}
            >
              <input
                type="radio"
                name="profile"
                className="col-start-1 row-start-1 row-span-1 md:row-span-2 xl:row-span-1 self-start md:self-center mt-1 md:mt-0 size-4 accent-[var(--color-sage)]"
                checked={selected === p.id}
                onChange={() => setSelected(p.id)}
              />
              <div className="col-start-2 row-start-1 min-w-0">
                <p className="font-medium truncate">{p.full_name || '—'}</p>
                <p className="text-sm text-muted truncate">{p.role_title || 'No role set'}</p>
              </div>

              <div className="col-start-2 row-start-2 md:col-start-3 md:row-start-1 xl:col-start-3 xl:row-start-1 min-w-0">
                <p className="label !mb-1 xl:hidden">Contact</p>
                <p className="text-sm text-muted truncate" title={p.contactLine || undefined}>
                  {p.contactLine || '—'}
                </p>
              </div>

              <div className="col-start-2 row-start-3 md:col-start-2 md:row-start-2 xl:col-start-4 xl:row-start-1 min-w-0">
                <p className="label !mb-1 xl:hidden">Resume format</p>
                <p className="text-sm truncate" title={p.resumeFormatName || undefined}>
                  {p.resumeFormatName || '—'}
                </p>
              </div>

              <div className="col-start-2 row-start-4 md:col-start-3 md:row-start-2 xl:col-start-5 xl:row-start-1 grid grid-cols-[9rem_3rem] items-center gap-4">
                <span
                  className={`inline-flex w-full justify-center rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap ${
                    p.promptReady ? 'bg-sage/15 text-sage' : 'bg-ember/15 text-ember'
                  }`}
                >
                  {p.promptReady ? 'Prompt ready' : 'Prompt not ready'}
                </span>
                <div>
                  <p className="label !mb-1 xl:hidden">Apply</p>
                  <p className="text-sm font-medium tabular-nums">{p.applicationCount ?? 0}</p>
                </div>
              </div>
            </label>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-ember bg-ember/10 rounded-xl px-3 py-2">{error}</p>}

      <button
        type="button"
        className="btn-primary w-full sm:w-auto"
        disabled={!profiles.length}
        onClick={continueNext}
      >
        Next: Job Links <ArrowRight size={16} />
      </button>
    </div>
  );
}
