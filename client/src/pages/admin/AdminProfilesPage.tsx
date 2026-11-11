import { useEffect, useState } from 'react';
import { Plus, Trash2, Upload } from 'lucide-react';
import { api, type Education, type Experience, type Profile, type ResumeFormat } from '../../lib/api';
import { Select } from '../../components/Select';

const emptyExp = (): Experience => ({
  companyName: '',
  role: '',
  location: '',
  period: '',
});

const emptyEdu = (): Education => ({
  universityName: '',
  degreeMajor: '',
  location: '',
  period: '',
});

function educationEntries(value: Education | Education[] | null | undefined): Education[] {
  if (Array.isArray(value)) {
    return value.length ? value.map((item) => ({ ...emptyEdu(), ...item })) : [emptyEdu()];
  }
  if (value && typeof value === 'object') return [{ ...emptyEdu(), ...value }];
  return [emptyEdu()];
}

function blankForm() {
  return {
    fullName: '',
    roleTitle: '',
    contactLocation: '',
    contactPhone: '',
    contactEmail: '',
    contactLinkedin: '',
    experiences: [emptyExp()],
    education: [emptyEdu()],
    prompt: '',
    outputPath: 'C:\\',
    resumeFormatId: '',
    resumeStructure: 'static' as 'static' | 'dynamic',
  };
}

export function AdminProfilesPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [formats, setFormats] = useState<ResumeFormat[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(blankForm());
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);

  async function load() {
    const [p, f] = await Promise.all([api.listProfiles(), api.getFormats()]);
    setProfiles(p.profiles);
    setFormats(f.formats);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  function startCreate() {
    setEditingId(null);
    setForm(blankForm());
    setShowForm(true);
  }

  function startEdit(p: Profile) {
    setEditingId(p.id);
    setForm({
      fullName: p.full_name || '',
      roleTitle: p.role_title || '',
      contactLocation: p.contact_location || '',
      contactPhone: p.contact_phone || '',
      contactEmail: p.contact_email || '',
      contactLinkedin: p.contact_linkedin || '',
      experiences:
        Array.isArray(p.experiences) && p.experiences.length ? p.experiences : [emptyExp()],
      education: educationEntries(p.education),
      prompt: p.prompt || '',
      outputPath: p.output_path || 'C:\\',
      resumeFormatId: p.resume_format_id || '',
      resumeStructure: p.resume_structure === 'dynamic' ? 'dynamic' : 'static',
    });
    setShowForm(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const body = {
        ...form,
        resumeFormatId: form.resumeFormatId || null,
      };
      if (editingId) await api.updateProfile(editingId, body);
      else await api.createProfile(body);
      setMessage(editingId ? 'Profile updated.' : 'Profile created.');
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this profile?')) return;
    try {
      await api.deleteProfile(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  async function onUploadFormat(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { format } = await api.uploadFormat(file, file.name);
      setFormats((prev) => [format, ...prev]);
      setForm((f) => ({ ...f, resumeFormatId: format.id }));
      setMessage('Resume format uploaded.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="page-title">Profile management</h1>
          <p className="page-lead">
            Create resume profiles, then assign them to users.
          </p>
        </div>
        <button type="button" className="btn-primary w-full sm:w-auto" onClick={startCreate}>
          <Plus size={16} /> New profile
        </button>
      </div>

      {error && <p className="text-sm text-ember bg-ember/10 rounded-xl px-3 py-2">{error}</p>}
      {message && <p className="text-sm text-sage bg-sage/10 rounded-xl px-3 py-2">{message}</p>}

      {profiles.length === 0 ? (
        <div className="surface p-8 text-center text-muted text-sm">No profiles yet.</div>
      ) : (
        <div className="space-y-3">
          {profiles.map((p) => (
            <article
              key={p.id}
              className="surface px-4 sm:px-5 py-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto_auto_auto] gap-4 xl:gap-6 xl:items-center"
            >
              <div className="min-w-0">
                <p className="font-medium truncate">{p.full_name || '—'}</p>
                <p className="text-sm text-muted truncate">{p.role_title || 'No role'}</p>
              </div>

              <div className="min-w-0 text-sm space-y-0.5">
                <p className="truncate">{p.contact_location || '—'}</p>
                <p className="truncate text-muted">{p.contact_email || '—'}</p>
                <p className="truncate text-muted">{p.contact_phone || '—'}</p>
              </div>

              <div className="min-w-0">
                <p className="label !mb-1">Resume format</p>
                <p className="text-sm truncate">{p.resumeFormatName || '—'}</p>
                <p className="text-xs text-muted">
                  {p.resume_structure === 'dynamic' ? 'Structure 2' : 'Structure 1'}
                </p>
              </div>

              <div className="min-w-0">
                <p className="label !mb-1">Assignees</p>
                {(p.assignees?.length ?? 0) === 0 ? (
                  <p className="text-sm text-muted">—</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {p.assignees!.map((name, idx) => (
                      <span
                        key={`${name}-${idx}`}
                        className="inline-flex rounded-md bg-sage/15 text-sage px-2 py-0.5 text-xs font-medium"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
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

              <div>
                <p className="label !mb-1">Apply</p>
                <p className="text-sm font-medium">{p.applicationCount ?? 0}</p>
              </div>

              <div className="flex flex-row items-center gap-2 sm:col-span-2 xl:col-span-1 pt-1 xl:pt-0 border-t border-black/5 dark:border-white/10 xl:border-0">
                <button
                  type="button"
                  className="btn-secondary !py-1.5 flex-1 xl:flex-none"
                  onClick={() => startEdit(p)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="btn-ghost text-ember !px-2"
                  onClick={() => remove(p.id)}
                  aria-label="Delete profile"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {showForm && (
        <form onSubmit={save} className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-xl sm:text-2xl">
              {editingId ? 'Edit profile' : 'Create profile'}
            </h2>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <button type="button" className="btn-secondary flex-1 sm:flex-none" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary flex-1 sm:flex-none">
                Save profile
              </button>
            </div>
          </div>

          {/* Part 1 — identity & experience */}
          <section className="surface p-4 sm:p-6 space-y-5">
            <div>
              <h3 className="font-display text-xl">Personal & experience</h3>
              <p className="text-xs text-muted mt-1">
                Identity, contact, work history, and education for the resume.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              <div className="field">
                <label className="label">Full name *</label>
                <input
                  className="input"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label className="label">Role</label>
                <input
                  className="input"
                  value={form.roleTitle}
                  onChange={(e) => setForm({ ...form, roleTitle: e.target.value })}
                  placeholder="e.g. Senior Software Engineer"
                />
              </div>
              <div className="field">
                <label className="label">Location *</label>
                <input
                  className="input"
                  value={form.contactLocation}
                  onChange={(e) => setForm({ ...form, contactLocation: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label className="label">Phone *</label>
                <input
                  className="input"
                  value={form.contactPhone}
                  onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label className="label">Email *</label>
                <input
                  className="input"
                  type="email"
                  value={form.contactEmail}
                  onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label className="label">LinkedIn</label>
                <input
                  className="input"
                  value={form.contactLinkedin}
                  onChange={(e) => setForm({ ...form, contactLinkedin: e.target.value })}
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-muted">
                Company experience *
              </h4>
              <button
                type="button"
                className="btn-secondary"
                onClick={() =>
                  setForm({ ...form, experiences: [...form.experiences, emptyExp()] })
                }
              >
                <Plus size={16} /> Add
              </button>
            </div>
            {form.experiences.map((exp, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 rounded-xl border border-black/5 dark:border-white/10 p-4"
              >
                <div className="sm:col-span-2 xl:col-span-4 flex justify-between items-center">
                  <span className="text-sm font-medium">Experience {idx + 1}</span>
                  {form.experiences.length > 1 && (
                    <button
                      type="button"
                      className="btn-ghost text-ember !px-2"
                      onClick={() =>
                        setForm({
                          ...form,
                          experiences: form.experiences.filter((_, i) => i !== idx),
                        })
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                {(
                  [
                    ['companyName', 'Company name'],
                    ['role', 'Role'],
                    ['location', 'Location / Remote'],
                    ['period', 'Work period'],
                  ] as const
                ).map(([key, label]) => (
                  <div className="field" key={key}>
                    <label className="label">{label}</label>
                    <input
                      className="input"
                      value={exp[key]}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          experiences: form.experiences.map((item, i) =>
                            i === idx ? { ...item, [key]: e.target.value } : item
                          ),
                        })
                      }
                      required={
                        form.resumeStructure === 'dynamic' ? key === 'period' : key !== 'location'
                      }
                      placeholder={key === 'period' ? 'Aug 2012 - Dec 2018' : undefined}
                    />
                  </div>
                ))}
              </div>
            ))}
            {form.resumeStructure === 'dynamic' && (
              <p className="text-xs text-muted">
                Work period is copied into the resume in this order, latest company first. Company
                name, role, and location on the resume come from the content.
              </p>
            )}

            <div className="flex items-center justify-between pt-2">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-muted">
                Education *
              </h4>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setForm({ ...form, education: [...form.education, emptyEdu()] })}
              >
                <Plus size={16} /> Add
              </button>
            </div>
            {form.education.map((edu, idx) => (
              <div
                key={idx}
                className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 rounded-xl border border-black/5 dark:border-white/10 p-4"
              >
                <div className="sm:col-span-2 xl:col-span-4 flex justify-between items-center">
                  <span className="text-sm font-medium">Education {idx + 1}</span>
                  {form.education.length > 1 && (
                    <button
                      type="button"
                      className="btn-ghost text-ember !px-2"
                      onClick={() =>
                        setForm({
                          ...form,
                          education: form.education.filter((_, i) => i !== idx),
                        })
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                {(
                  [
                    ['universityName', 'University name'],
                    ['degreeMajor', 'Degree & major'],
                    ['location', 'University location'],
                    ['period', 'Period / graduate date'],
                  ] as const
                ).map(([key, label]) => (
                  <div className="field" key={key}>
                    <label className="label">{label}</label>
                    <input
                      className="input"
                      value={edu[key]}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          education: form.education.map((item, i) =>
                            i === idx ? { ...item, [key]: e.target.value } : item
                          ),
                        })
                      }
                      required={key !== 'location'}
                      placeholder={
                        key === 'period' ? 'Aug 2012 - Jun 2016 / Jun 2016' : undefined
                      }
                    />
                  </div>
                ))}
              </div>
            ))}
          </section>

          {/* Part 2 — generation settings */}
          <section className="surface p-4 sm:p-6 space-y-5">
            <div>
              <h3 className="font-display text-xl">Output & prompt</h3>
              <p className="text-xs text-muted mt-1">
                Where files are saved, which DOC format to use, and the generation prompt.
              </p>
            </div>

            <div className="field">
              <label className="label">Output path</label>
              <input
                className="input"
                value={form.outputPath}
                onChange={(e) => setForm({ ...form, outputPath: e.target.value })}
                placeholder="C:\"
              />
              <p className="text-xs text-muted mt-1">
                Results land in <code>yy-mm-dd/[n].[company]-[role]/</code>
              </p>
            </div>

            <div className="field">
              <label className="label">Resume structure</label>
              <Select
                value={form.resumeStructure}
                onChange={(resumeStructure) =>
                  setForm({
                    ...form,
                    resumeStructure: resumeStructure === 'dynamic' ? 'dynamic' : 'static',
                    experiences:
                      form.experiences.length === 0 ? [emptyExp()] : form.experiences,
                  })
                }
                aria-label="Resume structure"
                options={[
                  {
                    value: 'static',
                    label: 'Structure 1 — Company, role, and location from profile',
                  },
                  {
                    value: 'dynamic',
                    label: 'Structure 2 — Company, role, and location from resume content',
                  },
                ]}
              />
              <p className="text-xs text-muted mt-1">
                {form.resumeStructure === 'dynamic'
                  ? 'Header, summary, skills, education, and certification are unchanged. Company, role, and location come from the resume content. Work period comes from company experience above, in the same order.'
                  : 'Each TITLE in the resume content is matched to a company, role, and location saved on this profile.'}
              </p>
            </div>

            <div className="field">
              <label className="label">Resume format</label>
              <Select
                value={form.resumeFormatId}
                onChange={(resumeFormatId) => setForm({ ...form, resumeFormatId })}
                placeholder="None"
                aria-label="Resume format"
                options={[
                  { value: '', label: 'None' },
                  ...formats.map((f) => ({
                    value: f.id,
                    label:
                      f.source === 'project'
                        ? `${f.name} (template)`
                        : f.name,
                  })),
                ]}
              />
              <p className="text-xs text-muted mt-1">
                Formats are loaded from the project <code>templates/</code> folder. Drop DOC/DOCX
                files there to add more.
              </p>
            </div>
            <label className="btn-secondary cursor-pointer w-fit">
              <Upload size={16} /> Upload extra DOC
              <input type="file" accept=".doc,.docx" className="hidden" onChange={onUploadFormat} />
            </label>

            <div className="field">
              <label className="label">Prompt</label>
              <textarea
                className="input min-h-32"
                value={form.prompt}
                onChange={(e) => setForm({ ...form, prompt: e.target.value })}
                placeholder="Prompt copied with JD during resume build…"
              />
            </div>
          </section>

          <div className="flex gap-2">
            <button type="submit" className="btn-primary">
              Save profile
            </button>
            <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
