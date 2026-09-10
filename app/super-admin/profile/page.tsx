'use client';
import { useEffect, useState } from 'react';
import SuperAdminLayout from '@/components/super-admin/SuperAdminLayout';
import { superAdminProfileService, SuperAdminProfile } from '@/lib/services/superAdminProfileService';
import { HiEye, HiEyeSlash, HiLockClosed, HiShieldCheck, HiInformationCircle } from 'react-icons/hi2';
import toast from 'react-hot-toast';

// Super Admin → Account Settings. Password only.
//
// Name and email are shown read-only on purpose: login matches the submitted
// email against SUPER_ADMIN_EMAIL (Api\Auth\SuperAdminAuthController), so
// letting either be edited here would lock the console's only account out of
// itself. The backend refuses them too — this just explains why.

const inp: React.CSSProperties = {
  width: '100%', padding: '10px 13px',
  border: '1.5px solid #e2e8f0', borderRadius: 8,
  fontSize: 14, outline: 'none', background: '#fafafa', color: '#0f172a',
  boxSizing: 'border-box',
};
const lbl: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600,
  color: '#475569', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em',
};
const card: React.CSSProperties = {
  background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14,
  padding: 24, marginBottom: 20,
};
const sectionTitle: React.CSSProperties = {
  fontSize: 13, fontWeight: 700, color: '#7c3aed',
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 16,
};

const MIN_LENGTH = 8;

function errorMessage(err: unknown, fallback: string): string {
  const ex = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
  // Laravel's own validator answers with `errors`; ApiResponse::error (the
  // wrong-current-password case) answers with `message` alone.
  const first = ex.response?.data?.errors
    ? Object.values(ex.response.data.errors)[0]?.[0]
    : undefined;
  return first ?? ex.response?.data?.message ?? fallback;
}

// One field + its own show/hide toggle, so a mistyped password can be checked
// without retyping all three.
function PasswordField({ label, value, onChange, autoComplete }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label style={lbl}>{label} *</label>
      <div style={{ position: 'relative' }}>
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{ ...inp, paddingRight: 42 }}
          autoComplete={autoComplete}
          required
        />
        <button
          type="button"
          onClick={() => setVisible(v => !v)}
          aria-label={visible ? `Hide ${label}` : `Show ${label}`}
          style={{
            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: '#94a3b8', display: 'flex', padding: 4,
          }}
        >
          {visible ? <HiEyeSlash size={17} /> : <HiEye size={17} />}
        </button>
      </div>
    </div>
  );
}

export default function SuperAdminProfilePage() {
  const [profile, setProfile] = useState<SuperAdminProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    superAdminProfileService.get()
      .then(setProfile)
      .catch(() => toast.error('Failed to load account details'))
      .finally(() => setLoading(false));
  }, []);

  // Same rules the server enforces, checked here first so the common mistakes
  // never cost a round trip. The server is still the one that decides.
  const validate = (): string | null => {
    if (!currentPassword || !newPassword || !confirmPassword) return 'All password fields are required.';
    if (newPassword.length < MIN_LENGTH) return `New password must be at least ${MIN_LENGTH} characters.`;
    if (newPassword !== confirmPassword) return 'New password and confirm password do not match.';
    if (newPassword === currentPassword) return 'New password must be different from your current password.';
    return null;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    const problem = validate();
    if (problem) { setError(problem); toast.error(problem); return; }

    setError('');
    setSaving(true);
    try {
      await superAdminProfileService.changePassword({
        current_password: currentPassword,
        password: newPassword,
        password_confirmation: confirmPassword,
      });
      toast.success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      // Re-read so the environment-password notice below flips over to "your
      // own password is in use" straight away.
      superAdminProfileService.get().then(setProfile).catch(() => {});
    } catch (err) {
      const msg = errorMessage(err, 'Failed to change password');
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SuperAdminLayout>
      <div style={{ maxWidth: 720 }}>
        <div style={{ marginBottom: 22 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#0f172a' }}>Account Settings</h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#94a3b8' }}>
            Your own Super Admin login — change your password here, no database access needed.
          </p>
        </div>

        <div style={card}>
          <div style={sectionTitle}>My Profile</div>
          {loading ? (
            <div style={{ fontSize: 13, color: '#94a3b8' }}>Loading…</div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
                <div>
                  <label style={lbl}>Name</label>
                  <input value={profile?.name ?? ''} style={{ ...inp, background: '#f1f5f9', color: '#64748b' }} readOnly />
                </div>
                <div>
                  <label style={lbl}>Email</label>
                  <input value={profile?.email ?? ''} style={{ ...inp, background: '#f1f5f9', color: '#64748b' }} readOnly />
                </div>
              </div>
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 14,
                padding: '10px 12px', borderRadius: 8, background: '#f5f3ff', border: '1px solid #ddd6fe',
              }}>
                <HiInformationCircle size={16} color="#7c3aed" style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 12, color: '#5b21b6', lineHeight: 1.5 }}>
                  Name and email are fixed to the server configuration (<code>SUPER_ADMIN_EMAIL</code>) — the
                  console signs in with that email, so it can only be changed in the environment file.
                </div>
              </div>
              {profile?.last_login_at && (
                <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 12 }}>
                  Last sign-in: {new Date(profile.last_login_at).toLocaleString()}
                </div>
              )}
            </>
          )}
        </div>

        <div style={card}>
          <div style={{ ...sectionTitle, display: 'flex', alignItems: 'center', gap: 7 }}>
            <HiLockClosed size={14} /> Change Password
          </div>

          <form onSubmit={submit}>
            <div style={{ marginBottom: 14 }}>
              <PasswordField
                label="Current Password"
                value={currentPassword}
                onChange={setCurrentPassword}
                autoComplete="current-password"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
              <PasswordField
                label="New Password"
                value={newPassword}
                onChange={setNewPassword}
                autoComplete="new-password"
              />
              <PasswordField
                label="Confirm New Password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                autoComplete="new-password"
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#94a3b8', marginTop: 10 }}>
              <HiShieldCheck size={14} />
              At least {MIN_LENGTH} characters, and different from your current password.
            </div>

            {/* Until the first change here, the environment's password is still
                a working way in — say so, since that is exactly what this form
                is for. Afterwards, say that it no longer is. */}
            {profile && (
              <div style={{
                marginTop: 14, padding: '10px 12px', borderRadius: 8,
                background: profile.uses_env_password ? '#fffbeb' : '#f0fdf4',
                border: `1px solid ${profile.uses_env_password ? '#fde68a' : '#bbf7d0'}`,
                color: profile.uses_env_password ? '#92400e' : '#166534',
                fontSize: 12, lineHeight: 1.5,
              }}>
                {profile.uses_env_password
                  ? 'This account still accepts the password set in the server environment (SUPER_ADMIN_PASSWORD). Changing it here replaces it — after that, only your new password will sign you in.'
                  : `Your own password is in use — the server environment password no longer works${
                      profile.password_changed_at
                        ? `. Last changed ${new Date(profile.password_changed_at).toLocaleString()}`
                        : ''
                    }.`}
              </div>
            )}

            {error && (
              <div style={{
                marginTop: 14, padding: '10px 12px', borderRadius: 8,
                background: '#fef2f2', border: '1px solid #fecaca',
                color: '#b91c1c', fontSize: 12.5,
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              style={{
                marginTop: 18, padding: '10px 22px', borderRadius: 8, border: 'none',
                background: saving ? '#c4b5fd' : '#7c3aed', color: '#fff',
                fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? 'Updating…' : 'Update Password'}
            </button>

            <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 12 }}>
              Changing your password signs out every other device. This one stays signed in.
            </div>
          </form>
        </div>
      </div>
    </SuperAdminLayout>
  );
}
