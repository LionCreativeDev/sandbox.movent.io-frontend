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
      await clientApi.post('/forgot-password', { email });
      // Always the same success state — never reveal whether the address is
      // registered. Matches the API, which returns one message either way.
      setSent(true);
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { message?: string } } };
      setError(ex.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 50%, #f8fafc 100%)',
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
            background: 'linear-gradient(135deg, #10b981, #059669)',
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

        {error && (
          <div style={{
            background: '#fef2f2', border: '1px solid #fecaca',
            borderRadius: 8, padding: '10px 14px',
            color: '#dc2626', fontSize: 13, marginBottom: 20,
          }}>
            {error}
          </div>
        )}

        {sent ? (
          <div style={{
            background: '#ecfdf5', border: '1px solid #a7f3d0',
            borderRadius: 8, padding: '14px 16px',
            color: '#047857', fontSize: 13, lineHeight: 1.6, marginBottom: 22,
          }}>
            If that email is registered, a password reset link has been sent.
            The link is valid for one hour.
          </div>
        ) : (
          <form onSubmit={submit}>
            <div style={{ marginBottom: 22 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 6 }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
                placeholder="you@company.com"
                style={{
                  width: '100%', padding: '10px 12px',
                  border: '1px solid #e2e8f0', borderRadius: 8,
                  fontSize: 14, outline: 'none', boxSizing: 'border-box',
                }}
                onFocus={e => (e.target.style.borderColor = '#10b981')}
                onBlur={e => (e.target.style.borderColor = '#e2e8f0')}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '11px',
                background: loading ? '#a7f3d0' : '#10b981',
                color: '#fff', fontWeight: 600, fontSize: 14,
                border: 'none', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s',
              }}>
              {loading ? 'Sending…' : 'Send Reset Link'}
            </button>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <Link href="/client/login" style={{ fontSize: 13, color: '#10b981', fontWeight: 600, textDecoration: 'none' }}>
            ← Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
