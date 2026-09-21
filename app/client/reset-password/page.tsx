'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { HiEye, HiEyeSlash } from 'react-icons/hi2';
import clientApi from '@/lib/clientAxios';

/**
 * Where a Client Portal reset link lands.
 *
 * Auth\ForgotPasswordController points a client's emailed link here rather than
 * at the staff /reset-password page, so the whole journey — login, forgot,
 * reset, back to login — stays inside the portal's own green theme with no
 * marketing chrome and no links into the staff app.
 *
 * Posts to the same /user/reset-password endpoint the staff page uses: one
 * token table, one expiry, one set of guards.
 */
function ClientResetPasswordContent() {
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const email = params.get('email') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setError('');
    setLoading(true);
    try {
      await clientApi.post('/user/reset-password', {
        email, token, password, password_confirmation: confirm,
      });
      setDone(true);
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { message?: string } } };
      setError(ex.response?.data?.message || 'This password reset link is invalid or has expired.');
    } finally {
      setLoading(false);
    }
  };

  const input: React.CSSProperties = {
    width: '100%', padding: '10px 34px 10px 12px',
    border: '1px solid #e2e8f0', borderRadius: 8,
    fontSize: 14, outline: 'none', boxSizing: 'border-box',
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #E9EDF2 0%, #E9EDF2 50%, #f8fafc 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 420,
        background: '#fff', borderRadius: 16,
        boxShadow: '0 4px 32px rgba(0,0,0,0.08)', padding: 40,
      }}>
        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'linear-gradient(135deg, #081B2D, #203750)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px',
          }}>
            <span style={{ color: '#fff', fontWeight: 800, fontSize: 24 }}>C</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b', margin: 0 }}>
            Choose a new password
          </h1>
          {email && !done && (
            <p style={{ fontSize: 13, color: '#94a3b8', margin: '6px 0 0' }}>
              for {email}
            </p>
          )}
        </div>

        {!token || !email ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
              padding: '12px 16px', color: '#dc2626', fontSize: 13, marginBottom: 20,
            }}>
              This password reset link is invalid.
            </div>
            <Link href="/client/forgot-password" style={{ fontSize: 13, color: '#081B2D', fontWeight: 600, textDecoration: 'none' }}>
              Request a new link
            </Link>
          </div>
        ) : done ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              background: '#E9EDF2', border: '1px solid #E6E2D9', borderRadius: 8,
              padding: '14px 16px', color: '#15283C', fontSize: 13, lineHeight: 1.6, marginBottom: 22,
            }}>
              Your password has been reset. You can sign in now.
            </div>
            <Link href="/client/login" style={{
              display: 'inline-block', padding: '10px 22px', borderRadius: 8,
              background: '#081B2D', color: '#fff', fontWeight: 600, fontSize: 14, textDecoration: 'none',
            }}>
              Go to Sign In →
            </Link>
          </div>
        ) : (
          <form onSubmit={submit}>
            {error && (
              <div style={{
                background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
                padding: '10px 14px', color: '#dc2626', fontSize: 13, marginBottom: 20,
              }}>
                {error}
              </div>
            )}

            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>
                New Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoFocus
                  placeholder="Min 8 characters"
                  style={input}
                  onFocus={e => (e.target.style.borderColor = '#081B2D')}
                  onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
                />
                <button
                  type="button"
                  onClick={() => setShow(v => !v)}
                  tabIndex={-1}
                  aria-label={show ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af',
                    display: 'flex', alignItems: 'center', padding: 2,
                  }}>
                  {show ? <HiEyeSlash size={16} /> : <HiEye size={16} />}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 22 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>
                Confirm Password
              </label>
              <input
                type={show ? 'text' : 'password'}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                placeholder="Repeat password"
                style={{
                  ...input,
                  paddingRight: 12,
                  borderColor: confirm && password !== confirm ? '#fecaca' : '#e2e8f0',
                }}
              />
              {confirm && password !== confirm && (
                <div style={{ fontSize: 12, color: '#dc2626', marginTop: 5 }}>Passwords do not match</div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '11px',
                background: loading ? '#E6E2D9' : '#081B2D',
                color: '#fff', fontWeight: 600, fontSize: 14,
                border: 'none', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
              }}>
              {loading ? 'Saving…' : 'Reset Password'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 18 }}>
              <Link href="/client/login" style={{ fontSize: 13, color: '#081B2D', fontWeight: 600, textDecoration: 'none' }}>
                ← Back to Sign In
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default function ClientResetPasswordPage() {
  // useSearchParams() needs a Suspense boundary — same reason the staff
  // reset-password page wraps its own content component.
  return (
    <Suspense fallback={null}>
      <ClientResetPasswordContent />
    </Suspense>
  );
}
