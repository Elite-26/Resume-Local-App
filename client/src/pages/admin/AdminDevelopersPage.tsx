import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api, type Developer } from '../../lib/api';

type DeveloperForm = {
  developerNo: string;
  name: string;
  country: string;
  experience: string;
  whatsapp: string;
  emails: string;
  linkedin: string;
  other: string;
};

const emptyForm = (developerNo = ''): DeveloperForm => ({
  developerNo,
  name: '',
  country: '',
  experience: '',
  whatsapp: '',
  emails: '',
  linkedin: '',
  other: '',
});

function formFromDeveloper(d: Developer): DeveloperForm {
  return {
    developerNo: String(d.developer_no),
    name: d.name,
    country: d.country,
    experience: d.experience,
    whatsapp: d.whatsapp,
    emails: d.emails.join('\n'),
    linkedin: d.linkedin,
    other: d.other,
  };
}

const th =
  'sticky top-0 z-20 bg-[#f7f4ee] px-3 py-3 border-b border-black/5 shadow-[0_4px_8px_-6px_rgba(15,28,24,0.45)] dark:bg-[#182922] dark:border-white/10';
const td = 'px-3 py-3 align-top border-b border-black/5 dark:border-white/10';

function linkedInHref(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^www\./i.test(trimmed) || /linkedin\.com/i.test(trimmed)) {
    return `https://${trimmed.replace(/^\/+/, '')}`;
  }
  return '';
}

export function AdminDevelopersPage() {
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Developer | null>(null);
  const [form, setForm] = useState<DeveloperForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  async function load() {
    const { developers: rows } = await api.adminDevelopers();
    setDevelopers(rows);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const fit = () => {
      const top = scroller.getBoundingClientRect().top;
      scroller.style.maxHeight = `${Math.max(280, window.innerHeight - top - 40)}px`;
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [error, message]);

  function startEdit(d: Developer) {
    setDraft(null);
    setEditingId(d.id);
    setForm(formFromDeveloper(d));
    setError('');
    setMessage('');
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
    setForm(emptyForm());
  }

  function startAdd() {
    const next =
      developers.reduce((max, d) => Math.max(max, d.developer_no), 0) + 1;
    const row: Developer = {
      id: 'new',
      developer_no: next,
      name: '',
      country: '',
      experience: '',
      whatsapp: '',
      emails: [],
      linkedin: '',
      other: '',
    };
    setDraft(row);
    setEditingId('new');
    setForm(emptyForm(String(next)));
    setError('');
    setMessage('');
  }

  function setField(key: keyof DeveloperForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save(id: string) {
    setError('');
    setMessage('');
    const name = form.name.trim();
    if (!name) {
      setError('Name is required.');
      return;
    }
    const developerNo = Number(form.developerNo);
    if (!Number.isInteger(developerNo) || developerNo <= 0) {
      setError('No must be a positive whole number.');
      return;
    }
    const emails = form.emails
      .split(/[\n,;]+/)
      .map((email) => email.trim())
      .filter(Boolean);

    setSaving(true);
    try {
      const body = {
        developerNo,
        name,
        country: form.country.trim(),
        experience: form.experience.trim(),
        whatsapp: form.whatsapp.trim(),
        emails,
        linkedin: form.linkedin.trim(),
        other: form.other.trim(),
      };
      if (id === 'new') {
        await api.adminCreateDeveloper(body);
        setMessage('Developer added.');
      } else {
        await api.adminUpdateDeveloper(id, body);
        setMessage('Developer saved.');
      }
      cancelEdit();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function remove(d: Developer) {
    if (!window.confirm(`Delete ${d.name}?`)) return;
    setError('');
    setMessage('');
    try {
      await api.adminDeleteDeveloper(d.id);
      if (editingId === d.id) cancelEdit();
      setMessage('Developer deleted.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  const rows = draft ? [...developers, draft] : developers;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl tracking-tight">Developers</h1>
          <p className="text-sm text-muted mt-1">
            Manage developer records. Enter several emails on separate lines.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary w-full sm:w-auto"
          onClick={startAdd}
          disabled={editingId === 'new'}
        >
          Add developer
        </button>
      </div>

      {error && <p className="text-sm text-ember bg-ember/10 rounded-xl px-3 py-2">{error}</p>}
      {message && <p className="text-sm text-sage bg-sage/10 rounded-xl px-3 py-2">{message}</p>}

      <div className="surface overflow-hidden">
        <div ref={scrollerRef} className="table-scroll max-h-[70dvh] !overflow-auto">
          <table className="data-table min-w-[72rem] border-separate border-spacing-0">
            <thead className="text-left text-xs uppercase text-muted">
              <tr>
                <th className={`${th} w-16`}>No</th>
                <th className={th}>Name</th>
                <th className={th}>Country</th>
                <th className={th}>Experience</th>
                <th className={th}>WhatsApp</th>
                <th className={th}>Email</th>
                <th className={th}>LinkedIn</th>
                <th className={th}>Other</th>
                <th className={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-muted">
                    No developers yet.
                  </td>
                </tr>
              )}
              {rows.map((d) => {
                const isEditing = editingId === d.id;
                return (
                  <tr
                    key={d.id}
                    className={isEditing ? 'bg-sage/5' : ''}
                  >
                    <td className={td}>
                      {isEditing ? (
                        <input
                          className="input !py-1.5 !px-2"
                          inputMode="numeric"
                          value={form.developerNo}
                          onChange={(e) => setField('developerNo', e.target.value)}
                        />
                      ) : (
                        d.developer_no
                      )}
                    </td>
                    <td className={`${td} min-w-[9rem]`}>
                      {isEditing ? (
                        <input
                          className="input !py-1.5 !px-2"
                          value={form.name}
                          onChange={(e) => setField('name', e.target.value)}
                        />
                      ) : (
                        <span className="font-medium">{d.name}</span>
                      )}
                    </td>
                    <td className={`${td} min-w-[8rem]`}>
                      {isEditing ? (
                        <input
                          className="input !py-1.5 !px-2"
                          value={form.country}
                          onChange={(e) => setField('country', e.target.value)}
                        />
                      ) : (
                        d.country || '—'
                      )}
                    </td>
                    <td className={`${td} min-w-[8rem]`}>
                      {isEditing ? (
                        <input
                          className="input !py-1.5 !px-2"
                          value={form.experience}
                          onChange={(e) => setField('experience', e.target.value)}
                        />
                      ) : (
                        d.experience || '—'
                      )}
                    </td>
                    <td className={`${td} min-w-[9rem]`}>
                      {isEditing ? (
                        <input
                          className="input !py-1.5 !px-2"
                          value={form.whatsapp}
                          onChange={(e) => setField('whatsapp', e.target.value)}
                        />
                      ) : (
                        d.whatsapp || '—'
                      )}
                    </td>
                    <td className={`${td} min-w-[12rem]`}>
                      {isEditing ? (
                        <textarea
                          className="input !py-1.5 !px-2 min-h-[4.5rem]"
                          value={form.emails}
                          placeholder="one email per line"
                          onChange={(e) => setField('emails', e.target.value)}
                        />
                      ) : d.emails.length ? (
                        <div className="space-y-0.5">
                          {d.emails.map((email) => (
                            <div key={email}>{email}</div>
                          ))}
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className={`${td} min-w-[10rem]`}>
                      {isEditing ? (
                        <input
                          className="input !py-1.5 !px-2"
                          value={form.linkedin}
                          onChange={(e) => setField('linkedin', e.target.value)}
                        />
                      ) : d.linkedin ? (
                        linkedInHref(d.linkedin) ? (
                          <a
                            href={linkedInHref(d.linkedin)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sage underline break-all"
                          >
                            {d.linkedin}
                          </a>
                        ) : (
                          <span className="break-all">{d.linkedin}</span>
                        )
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className={`${td} min-w-[10rem]`}>
                      {isEditing ? (
                        <textarea
                          className="input !py-1.5 !px-2 min-h-[4.5rem]"
                          value={form.other}
                          onChange={(e) => setField('other', e.target.value)}
                        />
                      ) : (
                        <span className="whitespace-pre-wrap">{d.other || '—'}</span>
                      )}
                    </td>
                    <td className={`${td} whitespace-nowrap`}>
                      {isEditing ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="btn-primary !px-3 !py-1.5"
                            disabled={saving}
                            onClick={() => save(d.id)}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="btn-secondary !px-3 !py-1.5"
                            disabled={saving}
                            onClick={cancelEdit}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="btn-secondary !px-3 !py-1.5"
                            onClick={() => startEdit(d)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn-danger !px-3 !py-1.5"
                            onClick={() => remove(d)}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
