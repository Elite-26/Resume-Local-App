import { useEffect, useState } from 'react';
import { api, type Profile, type User } from '../../lib/api';
import { Select } from '../../components/Select';

export function AdminAssignmentsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [assignedIds, setAssignedIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([api.adminUsers(), api.listProfiles()])
      .then(([u, p]) => {
        setUsers(u.users.filter((x) => x.role === 'user'));
        setProfiles(p.profiles);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!selectedUserId) {
      setAssignedIds([]);
      return;
    }
    api
      .adminUserProfiles(selectedUserId)
      .then((r) => setAssignedIds(r.profiles.map((p) => p.id)))
      .catch((e) => setError(e.message));
  }, [selectedUserId]);

  function toggle(id: string) {
    setAssignedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function save() {
    if (!selectedUserId) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api.adminSetUserProfiles(selectedUserId, assignedIds);
      setMessage('Assignments saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Profile assignment</h1>
        <p className="page-lead">
          Choose which profiles each user may use when building resumes.
        </p>
      </div>

      <div className="field w-full max-w-md">
        <label className="label">User</label>
        <Select
          value={selectedUserId}
          onChange={setSelectedUserId}
          placeholder="Select a user…"
          aria-label="User"
          options={users.map((u) => ({
            value: u.id,
            label: `${u.name} (${u.email})`,
          }))}
        />
      </div>

      {selectedUserId && (
        <div className="space-y-3">
          <div className="flex flex-col-reverse sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-between gap-3">
            <p className="text-sm font-medium">Available profiles</p>
            <button type="button" className="btn-primary w-full sm:w-auto" disabled={busy} onClick={save}>
              {busy ? 'Saving…' : 'Save assignments'}
            </button>
          </div>

          {profiles.length === 0 ? (
            <div className="surface p-6 sm:p-8 text-center text-muted text-sm">
              Create profiles first.
            </div>
          ) : (
            profiles.map((p) => {
              const checked = assignedIds.includes(p.id);
              return (
                <label
                  key={p.id}
                  className={`surface px-4 sm:px-5 py-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1.5fr)_minmax(0,1fr)_auto] gap-4 xl:gap-6 xl:items-center cursor-pointer transition ${
                    checked ? 'ring-2 ring-sage/40 bg-sage/5' : ''
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <input
                      type="checkbox"
                      className="shrink-0 size-4 accent-[var(--color-sage)] mt-1"
                      checked={checked}
                      onChange={() => toggle(p.id)}
                    />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{p.full_name || '—'}</p>
                      <p className="text-sm text-muted truncate">
                        {p.role_title || 'No role'}
                      </p>
                    </div>
                  </div>

                  <div className="min-w-0 text-sm space-y-0.5 pl-7 sm:pl-0">
                    <p className="truncate">{p.contact_location || '—'}</p>
                    <p className="truncate text-muted">{p.contact_email || '—'}</p>
                    <p className="truncate text-muted">{p.contact_phone || '—'}</p>
                  </div>

                  <div className="min-w-0 pl-7 sm:pl-0">
                    <p className="label !mb-1">Resume format</p>
                    <p className="text-sm truncate">{p.resumeFormatName || '—'}</p>
                  </div>

                  <div className="pl-7 sm:pl-0">
                    <span
                      className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap ${
                        p.promptReady
                          ? 'bg-sage/15 text-sage'
                          : 'bg-ember/15 text-ember'
                      }`}
                    >
                      {p.promptReady ? 'Prompt ready' : 'Prompt not ready'}
                    </span>
                  </div>
                </label>
              );
            })
          )}
        </div>
      )}

      {error && <p className="text-sm text-ember bg-ember/10 rounded-xl px-3 py-2">{error}</p>}
      {message && <p className="text-sm text-sage bg-sage/10 rounded-xl px-3 py-2">{message}</p>}
    </div>
  );
}
