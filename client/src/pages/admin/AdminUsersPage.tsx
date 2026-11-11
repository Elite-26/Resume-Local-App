import { useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { api, type User } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { Select } from '../../components/Select';

type UserForm = {
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'user';
};

const emptyForm = (): UserForm => ({
  name: '',
  email: '',
  password: '',
  role: 'user',
});

const roleOptions = [
  { value: 'user', label: 'User' },
  { value: 'admin', label: 'Admin' },
];

export function AdminUsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [form, setForm] = useState<UserForm>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user' as 'admin' | 'user',
  });
  const [saving, setSaving] = useState(false);

  async function load() {
    const { users } = await api.adminUsers();
    setUsers(users);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');

    const name = form.name.trim();
    const email = form.email.trim();
    const password = form.password;
    if (!name || !email || !password) {
      setError('Name, email, and password are required.');
      return;
    }

    try {
      await api.adminCreateUser({ ...form, name, email, password });
      setForm(emptyForm());
      setShowPassword(false);
      setMessage('User created.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    }
  }

  function startEdit(u: User) {
    setEditingId(u.id);
    setEditForm({
      name: u.name,
      email: u.email,
      password: u.password || '',
      role: u.role,
    });
    setShowEditPassword(true);
    setError('');
    setMessage('');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm({ name: '', email: '', password: '', role: 'user' });
    setShowEditPassword(false);
  }

  async function saveEdit(id: string) {
    setError('');
    setMessage('');

    const name = editForm.name.trim();
    const email = editForm.email.trim();
    if (!name || !email) {
      setError('Name and email are required.');
      return;
    }
    if (editForm.password && editForm.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name,
        email,
        role: editForm.role,
      };
      if (editForm.password) body.password = editForm.password;
      await api.adminUpdateUser(id, body);
      setMessage('User updated.');
      cancelEdit();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this user?')) return;
    try {
      await api.adminDeleteUser(id);
      if (editingId === id) cancelEdit();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">User management</h1>
        <p className="page-lead">Create accounts and manage roles.</p>
      </div>

      <form onSubmit={createUser} className="surface p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <h2 className="font-display text-xl sm:col-span-2 xl:col-span-4">Add user</h2>
        <div className="field">
          <label className="label">Name *</label>
          <input
            className="input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            autoComplete="name"
          />
        </div>
        <div className="field">
          <label className="label">Email *</label>
          <input
            className="input"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
            autoComplete="email"
          />
        </div>
        <div className="field">
          <label className="label">Password *</label>
          <div className="relative">
            <input
              className="input pr-11"
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={6}
              autoComplete="new-password"
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 btn-ghost !px-2 !py-1.5 text-muted"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <div className="field">
          <label className="label">Role</label>
          <Select
            value={form.role}
            onChange={(role) => setForm({ ...form, role: role as 'admin' | 'user' })}
            options={roleOptions}
            aria-label="Role"
          />
        </div>
        <button type="submit" className="btn-primary sm:col-span-2 xl:col-span-4 w-full sm:w-fit">
          Create user
        </button>
      </form>

      {error && <p className="text-sm text-ember bg-ember/10 rounded-xl px-3 py-2">{error}</p>}
      {message && <p className="text-sm text-sage bg-sage/10 rounded-xl px-3 py-2">{message}</p>}

      <div className="surface overflow-hidden">
        <div className="table-scroll">
          <table className="data-table min-w-[48rem]">
            <thead className="bg-black/[0.03] dark:bg-white/5 text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Password</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isEditing = editingId === u.id;
                return (
                  <tr
                    key={u.id}
                    className={`border-t border-black/5 dark:border-white/10 ${
                      isEditing ? 'bg-sage/5' : ''
                    }`}
                  >
                    <td className="px-4 py-3 align-middle">
                      {isEditing ? (
                        <input
                          className="input !py-1.5"
                          value={editForm.name}
                          onChange={(e) =>
                            setEditForm({ ...editForm, name: e.target.value })
                          }
                          required
                        />
                      ) : (
                        <span className="font-medium">{u.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      {isEditing ? (
                        <input
                          className="input !py-1.5"
                          type="email"
                          value={editForm.email}
                          onChange={(e) =>
                            setEditForm({ ...editForm, email: e.target.value })
                          }
                          required
                        />
                      ) : (
                        u.email
                      )}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      {isEditing ? (
                        <div className="relative min-w-[10rem]">
                          <input
                            className="input !py-1.5 pr-10"
                            type={showEditPassword ? 'text' : 'password'}
                            value={editForm.password}
                            onChange={(e) =>
                              setEditForm({ ...editForm, password: e.target.value })
                            }
                            placeholder="Password"
                            minLength={6}
                            autoComplete="new-password"
                          />
                          <button
                            type="button"
                            className="absolute right-1 top-1/2 -translate-y-1/2 btn-ghost !px-1.5 !py-1 text-muted"
                            onClick={() => setShowEditPassword((v) => !v)}
                            aria-label={
                              showEditPassword ? 'Hide password' : 'Show password'
                            }
                          >
                            {showEditPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                      ) : (
                        <span className="font-mono tracking-widest text-muted">
                          ••••••••
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      {isEditing ? (
                        <Select
                          size="sm"
                          className="min-w-[7.5rem]"
                          value={editForm.role}
                          disabled={u.id === me?.id}
                          onChange={(role) =>
                            setEditForm({
                              ...editForm,
                              role: role as 'admin' | 'user',
                            })
                          }
                          options={[
                            { value: 'user', label: 'user' },
                            { value: 'admin', label: 'admin' },
                          ]}
                          aria-label="Role"
                        />
                      ) : (
                        <span
                          className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${
                            u.role === 'admin'
                              ? 'bg-ember/15 text-ember'
                              : 'bg-sage/15 text-sage'
                          }`}
                        >
                          {u.role}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      {isEditing ? (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="btn-primary !py-1.5"
                            disabled={saving}
                            onClick={() => saveEdit(u.id)}
                          >
                            {saving ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            type="button"
                            className="btn-secondary !py-1.5"
                            disabled={saving}
                            onClick={cancelEdit}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="btn-secondary !py-1.5"
                            onClick={() => startEdit(u)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn-ghost text-ember !px-2"
                            disabled={u.id === me?.id}
                            onClick={() => remove(u.id)}
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
