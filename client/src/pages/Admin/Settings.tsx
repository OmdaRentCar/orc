import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/ui/Toast';

export default function Settings() {
  const { user, token, updateUser } = useAuth();
  const { showToast } = useToast();

  const [username, setUsername] = useState(user?.username ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (newPassword && newPassword !== confirmPassword) {
      showToast('New passwords do not match', 'error');
      return;
    }
    if (newPassword && newPassword.length < 8) {
      showToast('New password must be at least 8 characters', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/auth/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username,
          email,
          currentPassword,
          ...(newPassword ? { newPassword } : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? 'Update failed', 'error');
        return;
      }

      updateUser(data.token, data.user);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast('Settings saved successfully', 'success');
    } catch {
      showToast('Network error', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold text-brand-text mb-1">Settings</h1>
      <p className="text-sm text-brand-muted mb-8">Update your admin account credentials.</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-brand-surface border border-white/5 rounded-2xl p-6 space-y-5">
          <p className="text-sm font-semibold text-brand-text">Account Info</p>

          <div>
            <label className="block text-xs font-medium text-brand-muted mb-1.5">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-brand-text placeholder-brand-muted focus:outline-none focus:border-brand-red/50 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-brand-muted mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-brand-text placeholder-brand-muted focus:outline-none focus:border-brand-red/50 transition-colors"
            />
          </div>
        </div>

        <div className="bg-brand-surface border border-white/5 rounded-2xl p-6 space-y-5">
          <p className="text-sm font-semibold text-brand-text">Change Password</p>
          <p className="text-xs text-brand-muted -mt-3">Leave new password blank to keep current password.</p>

          <div>
            <label className="block text-xs font-medium text-brand-muted mb-1.5">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min. 8 characters"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-brand-text placeholder-brand-muted focus:outline-none focus:border-brand-red/50 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-brand-muted mb-1.5">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat new password"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-brand-text placeholder-brand-muted focus:outline-none focus:border-brand-red/50 transition-colors"
            />
          </div>
        </div>

        <div className="bg-brand-surface border border-white/5 rounded-2xl p-6 space-y-5">
          <p className="text-sm font-semibold text-brand-text">Confirm Changes</p>

          <div>
            <label className="block text-xs font-medium text-brand-muted mb-1.5">Current Password <span className="text-brand-red">*</span></label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              placeholder="Required to save any changes"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-brand-text placeholder-brand-muted focus:outline-none focus:border-brand-red/50 transition-colors"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-brand-red hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors text-sm"
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}
