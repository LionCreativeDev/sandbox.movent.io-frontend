'use client';

import { useEffect, useState } from 'react';
import { clientService, ClientProfile } from '@/lib/services/clientService';

const GREEN = '#081B2D';

/**
 * The client's own details.
 *
 * Contact Email is the only email on this form that can be typed into. The
 * Login Email is shown beside it but never edited directly — saving a new
 * Contact Email moves the login with it, which is the whole rule this screen
 * exists to make visible. Two separately-editable addresses is how someone ends
 * up locked out of an account whose contact details still look correct.
 *
 * Changing it therefore asks for the current password: it is a credential
 * change, and the field only appears once the address actually differs, so an
 * ordinary name/phone edit never has to reach for it.
 */
export default function ClientProfilePage() {
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', current_password: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    clientService.profile()
      .then(p => {
        setProfile(p);
        setForm({
          name: p.name ?? '',
          email: p.email ?? '',
          phone: p.phone ?? '',
          address: p.address ?? '',
          current_password: '',
        });
      })
      .catch(() => setError('Could not load your details.'))
      .finally(() => setLoading(false));
  }, []);

  // Compared against the LOGIN email, not the contact one: that is the address
  // about to change, and the server applies the same test.
  const emailChanging =
    !!profile && form.email.trim().toLowerCase() !== (profile.login_email ?? '').toLowerCase();

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const res = await clientService.updateProfile({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        ...(emailChanging ? { current_password: form.current_password } : {}),
      });

      setProfile(res.data);
      setForm(f => ({ ...f, current_password: '' }));
      setNotice(res.message ?? 'Your details have been saved.');
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      const firstFieldError = Object.values(ex.response?.data?.errors ?? {})[0]?.[0];
      setError(firstFieldError || ex.response?.data?.message || 'Could not save your details.');
    } finally {
      setSaving(false);
    }
  };

  const label: React.CSSProperties = {
    display: 'block', fontSize: 12.5, fontWeight: 600, color: '#374151', marginBottom: 6,
  };
  const input: React.CSSProperties = {
    width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8,
    fontSize: 14, outline: 'none', boxSizing: 'border-box', background: '#fff',
  };

  if (loading) {
    return <div style={{ padding: 40, color: '#94a3b8', fontSize: 14 }}>Loading your details…</div>;
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>My Profile</h1>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>
        Your contact details. Changing your email address also changes how you sign in.
      </p>

      {notice && (
        <div style={{ marginBottom: 18, padding: '10px 14px', background: '#E9EDF2', border: '1px solid #E6E2D9', borderRadius: 8, color: '#15283C', fontSize: 13, fontWeight: 600 }}>
          {notice}
        </div>
      )}
      {error && (
        <div style={{ marginBottom: 18, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#dc2626', fontSize: 13 }}>
          {error}
        </div>
      )}

      <form onSubmit={save} style={{ background: '#fff', border: '1px solid #f1f5f9', borderRadius: 14, padding: 24 }}>
        <div style={{ marginBottom: 18 }}>
          <label style={label}>Full Name *</label>
          <input style={input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required maxLength={200} />
        </div>

        {profile?.company_name && (
          <div style={{ marginBottom: 18 }}>
            <label style={label}>Company</label>
            <input style={{ ...input, background: '#f8fafc', color: '#64748b' }} value={profile.company_name} readOnly />
          </div>
        )}

        <div style={{ marginBottom: 18 }}>
          <label style={label}>Contact Email *</label>
          <input
            style={input}
            type="email"
            value={form.email}
            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            required
            maxLength={255}
          />
          <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 5 }}>
            This is also the email you sign in with.
          </div>
        </div>

        {/* Read-only, and shown for one reason: so the consequence of editing
            the field above is visible before it is saved, not discovered at the
            next sign-in. */}
        <div style={{ marginBottom: 18 }}>
          <label style={label}>Login Email</label>
          {/* disabled, not readOnly: readOnly still focuses and looks live, so
              it reads as a field someone forgot to make editable. This one is
              never typed into by design — it follows the Contact Email above.
              Safe to disable because its value is display-only and is not part
              of what the form submits. */}
          <input
            style={{ ...input, background: '#f1f5f9', color: '#64748b', cursor: 'not-allowed' }}
            value={profile?.login_email ?? ''}
            disabled
          />
          {emailChanging && (
            <div style={{ marginTop: 8, padding: '9px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: 12.5, color: '#92400e' }}>
              After saving, sign in with <strong>{form.email.trim()}</strong> instead of{' '}
              <strong>{profile?.login_email}</strong>. Your password stays the same.
            </div>
          )}
        </div>

        {/* Only asked for when a credential is actually changing — an ordinary
            name or phone edit never sees this field. */}
        {emailChanging && (
          <div style={{ marginBottom: 18 }}>
            <label style={label}>Current Password *</label>
            <input
              style={input}
              type="password"
              value={form.current_password}
              onChange={e => setForm(f => ({ ...f, current_password: e.target.value }))}
              required
              placeholder="••••••••"
              autoComplete="current-password"
            />
            <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 5 }}>
              Confirms it is you before your sign-in email changes.
            </div>
          </div>
        )}

        <div style={{ marginBottom: 18 }}>
          <label style={label}>Phone</label>
          <input style={input} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} maxLength={30} />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={label}>Address</label>
          <textarea
            style={{ ...input, minHeight: 80, resize: 'vertical', fontFamily: 'inherit' }}
            value={form.address}
            onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
            maxLength={500}
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          style={{
            padding: '10px 22px', borderRadius: 8, border: 'none',
            background: saving ? '#203750' : GREEN, color: '#fff',
            fontWeight: 600, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}
