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
          {profiles.map((p) => (
            <label
              key={p.id}
              className={`surface px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-3 sm:gap-x-6 sm:gap-y-3 cursor-pointer transition ${
                selected === p.id ? 'ring-2 ring-sage/40 bg-sage/5' : ''
              }`}
            >
              <div className="flex items-start gap-3 w-full sm:w-auto min-w-0">
                <input
                  type="radio"
                  name="profile"
                  className="shrink-0 size-4 accent-[var(--color-sage)] mt-1"
                  checked={selected === p.id}
                  onChange={() => setSelected(p.id)}
                />
                <div className="min-w-0">
                  <p className="font-medium truncate">{p.full_name}</p>
                  <p className="text-sm text-muted truncate">
                    {p.role_title || 'No role set'}
                  </p>
                </div>
              </div>

              {p.contactLine && (
                <div className="text-xs text-muted break-words min-w-0 sm:max-w-xs pl-7 sm:pl-0">
                  {p.contactLine}
                </div>
              )}

              <div className="min-w-0 pl-7 sm:pl-0">
                <p className="label !mb-1">Resume format</p>
                <p className="text-sm truncate">{p.resumeFormatName || ''}</p>
              </div>

              <div className="flex flex-wrap items-center gap-3 pl-7 sm:pl-0 sm:ml-auto">
                <span
                  className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap ${
                    p.promptReady
                      ? 'bg-sage/15 text-sage'
                      : 'bg-ember/15 text-ember'
                  }`}
                >
                  {p.promptReady ? 'Prompt ready' : 'Prompt not ready'}
                </span>
                <div>
                  <p className="label !mb-1">Apply</p>
                  <p className="text-sm font-medium">{p.applicationCount ?? 0}</p>
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
