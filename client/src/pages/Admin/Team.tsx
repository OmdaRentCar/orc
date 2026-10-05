import { FormEvent, useCallback, useEffect, useState } from 'react';
import { apiJSON } from '../../services/api';
import { useToast } from '../../components/ui/Toast';
import { useAuth } from '../../context/AuthContext';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import type { AdminRole, AdminUser } from '../../types';

const inputClass = 'w-full bg-brand-surface border border-white/10 rounded-xl px-3 py-2 text-sm text-brand-text focus:outline-none focus:border-brand-red/50';

export default function Team() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ username: '', email: '', password: '', role: 'staff' as AdminRole });
  const [resetFor, setResetFor] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [deleting, setDeleting] = useState<AdminUser | null>(null);

  const load = useCallback(() => {
    apiJSON<AdminUser[]>('/admins').then(setAdmins).catch((e) => showToast((e as Error).message, 'error'));
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  async function add(e: FormEvent) {
    e.preventDefault();
    try {
      await apiJSON('/admins', { method: 'POST', body: JSON.stringify(form) });
      showToast(`${form.username} added`, 'success');
      setAdding(false);
      setForm({ username: '', email: '', password: '', role: 'staff' });
      load();
    } catch (err) {
      showToast((err as Error).message, 'error');
    }
  }

  async function changeRole(admin: AdminUser, role: AdminRole) {
    try {
      await apiJSON(`/admins/${admin.id}`, { method: 'PUT', body: JSON.stringify({ role }) });
      showToast(`${admin.username} is now ${role}`, 'success');
      load();
    } catch (err) {
      showToast((err as Error).message, 'error');
    }
  }

  async function resetPassword(e: FormEvent) {
    e.preventDefault();
    if (!resetFor) return;
    try {
      await apiJSON(`/admins/${resetFor.id}`, { method: 'PUT', body: JSON.stringify({ password: newPassword }) });
      showToast(`Password reset for ${resetFor.username}`, 'success');
      setResetFor(null);
      setNewPassword('');
    } catch (err) {
      showToast((err as Error).message, 'error');
    }
  }

  async function remove() {
    if (!deleting) return;
    try {
      await apiJSON(`/admins/${deleting.id}`, { method: 'DELETE' });
      showToast(`${deleting.username} removed`, 'success');
      setDeleting(null);
      load();
    } catch (err) {
      showToast((err as Error).message, 'error');
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-text">Team</h1>
          <p className="text-sm text-brand-muted mt-1">
            <strong className="text-brand-text">Owners</strong> can do everything. <strong className="text-brand-text">Staff</strong> handle bookings, cars and customers, but cannot delete cars or bookings, change business settings, or manage the team.
          </p>
        </div>
        <button onClick={() => setAdding(true)} className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-semibold bg-brand-red text-white hover:bg-red-500">+ Add admin</button>
      </div>

      <div className="glass-card divide-y divide-white/5">
        {admins.map((a) => (
          <div key={a.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-brand-text font-medium">{a.username}{a.id === user?.id && <span className="ms-2 text-xs text-brand-muted">(you)</span>}</p>
              <p className="text-xs text-brand-muted">{a.email} · since {a.createdAt ? new Date(a.createdAt).toLocaleDateString('en-GB') : '—'}</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={a.role}
                disabled={a.id === user?.id}
                onChange={(e) => changeRole(a, e.target.value as AdminRole)}
                aria-label={`Role for ${a.username}`}
                className="bg-brand-surface border border-white/10 rounded-lg px-2 py-1.5 text-xs text-brand-text disabled:opacity-50"
              >
                <option value="owner">Owner</option>
                <option value="staff">Staff</option>
              </select>
              {a.id !== user?.id && (
                <>
                  <button onClick={() => setResetFor(a)} className="px-2.5 py-1.5 rounded-lg text-xs bg-white/5 text-brand-muted hover:text-brand-text">Reset password</button>
                  <button onClick={() => setDeleting(a)} className="px-2.5 py-1.5 rounded-lg text-xs text-brand-muted hover:text-red-400 hover:bg-red-500/5">Remove</button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <Modal open={adding} onClose={() => setAdding(false)} maxWidth="max-w-md">
        <form onSubmit={add} className="space-y-3">
          <h3 className="text-lg font-bold text-brand-text mb-2">Add admin</h3>
          <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="Username" required minLength={3} className={inputClass} aria-label="Username" />
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" required className={inputClass} aria-label="Email" />
          <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Temporary password (min. 8 characters)" required minLength={8} autoComplete="new-password" className={inputClass} aria-label="Password" />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as AdminRole })} className={inputClass} aria-label="Role">
            <option value="staff">Staff</option>
            <option value="owner">Owner</option>
          </select>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setAdding(false)} className="px-4 py-2 rounded-xl text-sm text-brand-muted hover:text-brand-text">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-xl text-sm font-semibold bg-brand-red text-white hover:bg-red-500">Add</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!resetFor} onClose={() => setResetFor(null)} maxWidth="max-w-md">
        <form onSubmit={resetPassword} className="space-y-3">
          <h3 className="text-lg font-bold text-brand-text mb-2">Reset password for {resetFor?.username}</h3>
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password (min. 8 characters)" required minLength={8} autoComplete="new-password" className={inputClass} aria-label="New password" />
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setResetFor(null)} className="px-4 py-2 rounded-xl text-sm text-brand-muted hover:text-brand-text">Cancel</button>
            <button type="submit" className="px-4 py-2 rounded-xl text-sm font-semibold bg-brand-red text-white hover:bg-red-500">Reset</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title="Remove admin"
        message={`Remove ${deleting?.username}? They will be signed out immediately.`}
        confirmLabel="Remove"
        danger
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
