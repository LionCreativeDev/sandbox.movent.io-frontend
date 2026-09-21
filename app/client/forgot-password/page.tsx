'use client';

import { useState } from 'react';
import Link from 'next/link';
import clientApi from '@/lib/clientAxios';

/**
 * The Client Portal's own "send me a reset link" screen.
 *
 * Deliberately NOT the staff /forgot-password page. That one is wrapped in the
 * marketing navbar/footer and the MOVENT.io blue brand — a portal client has no
 * account on that side of the product and every link on it leads somewhere they
 * cannot go. This mirrors /client/login instead: same green, same card, same
 * logo mark, no landing chrome.
 *
 * It posts to the SAME endpoint as the staff page. There is only one reset flow
 * in the app (Auth\ForgotPasswordController, which never filtered by role and
 * so always handled portal clients) — this is a second front door onto it, not
 * a second flow.
 */
export default function ClientForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // The PORTAL endpoint, not the staff /forgot-password: this one verifies
      // the address really is a registered portal client and says so when it
      // is not, instead of promising an email that will never arrive. Same
      // underlying reset flow either way.
      await clientApi.post('/client/forgot-password', { email });
      setSent(true);
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      // A 422 puts the reason under `errors.email` — that is the unregistered
      // case, and it belongs against the field rather than in a banner.
      setError(
        ex.response?.data?.errors?.email?.[0]
          || ex.response?.data?.message
          || 'Something went wrong. Please try again.'
      );
    } finally {
      setLoading(false);
    }
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
        background: '#fff',
        borderRadius: 16,
        boxShadow: '0 4px 32px rgba(0,0,0,0.08)',
        padding: 40,
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
            Reset your password
          </h1>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: '6px 0 0' }}>
            {sent
              ? 'Check your inbox for the link'
              : 'Enter your email and we’ll send you a reset link'}
          </p>
        </div>

        {/* Success sits where the form was and the page never navigates — the
            address stays on screen so it is obvious which inbox to check. */}
        {sent ? (
          <>
            <div style={{
              background: '#E9EDF2', border: '1px solid #E6E2D9',
              borderRadius: 8, padding: '14px 16px',
              color: '#15283C', fontSize: 13, lineHeight: 1.6,
            }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Reset link sent</div>
              We&apos;ve emailed a password reset link to <strong>{email}</strong>.
            </div>

            <button
              type="button"
              onClick={() => { setSent(false); setError(''); }}
              style={{
                width: '100%', marginTop: 16, padding: '11px',
                background: '#fff', color: '#081B2D',
                fontWeight: 600, fontSize: 14,
                border: '1.5px solid #E6E2D9', borderRadius: 8, cursor: 'pointer',
              }}>
              Send to a different email
            </button>
          </>
        ) : (
          <form onSubmit={submit}>
            <div style={{ marginBottom: 22 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                // Clear the error as soon as they start correcting it —
                // otherwise a stale "not registered" sits under an address
                // that is no longer the one being submitted.
                onChange={e => { setEmail(e.target.value); if (error) setError(''); }}
                required
                autoFocus
                placeholder="you@company.com"
                aria-invalid={!!error}
                aria-describedby={error ? 'email-error' : undefined}
                style={{
                  width: '100%', padding: '10px 12px',
                  border: `1px solid ${error ? '#fca5a5' : '#e2e8f0'}`,
                  borderRadius: 8,
                  fontSize: 14, outline: 'none', boxSizing: 'border-box',
                }}
                onFocus={e => (e.target.style.borderColor = error ? '#fca5a5' : '#081B2D')}
                onBlur={e => (e.target.style.borderColor = error ? '#fca5a5' : '#e2e8f0')}
              />

              {/* Directly under the field it belongs to, which is where the
                  "this address isn't registered" answer is actionable. */}
              {error && (
                <div id="email-error" role="alert" style={{ fontSize: 12.5, color: '#dc2626', marginTop: 6, lineHeight: 1.5 }}>
                  {error}
                </div>
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
                transition: 'background 0.15s',
              }}>
              {loading ? 'Sending…' : 'Send Reset Link'}
            </button>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <Link href="/client/login" style={{ fontSize: 13, color: '#081B2D', fontWeight: 600, textDecoration: 'none' }}>
            ← Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
