'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { clientService } from '@/lib/services/clientService';

const GREEN = '#10b981';

/**
 * Where the gateway sends the client back after they add a card.
 *
 * It hands the session id to the API, which reads the card back from the
 * gateway and stores the token against the AUTHENTICATED client — this page is
 * only the courier, and a tampered session id can do no more than fail.
 */
function AddedContent() {
  const params = useSearchParams();
  const router = useRouter();
  const sessionId = params.get('session_id') ?? '';

  const [status, setStatus] = useState<'saving' | 'done' | 'failed'>('saving');
  const [label, setLabel] = useState('');
  // Strict Mode runs effects twice in dev; the POST is not idempotent enough to
  // want two of them racing.
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    let companyId = 0;
    try { companyId = Number(sessionStorage.getItem('pm_company_id') ?? 0); } catch { /* private mode */ }

    if (!sessionId || !companyId) {
      setStatus('failed');
      return;
    }

    clientService.paymentMethods.complete(companyId, sessionId)
      .then(res => { setLabel(res.payment_method.label); setStatus('done'); })
      .catch(() => setStatus('failed'))
      .finally(() => { try { sessionStorage.removeItem('pm_company_id'); } catch { /* ignore */ } });
  }, [sessionId]);

  const box: React.CSSProperties = {
    maxWidth: 480, background: '#fff', border: '1px solid #f1f5f9',
    borderRadius: 14, padding: 28,
  };

  return (
    <div style={{ maxWidth: 680 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', marginBottom: 20 }}>Payment Method</h1>

      <div style={box}>
        {status === 'saving' && (
          <div style={{ fontSize: 14, color: '#64748b' }}>Saving your payment method…</div>
        )}

        {status === 'done' && (
          <>
            <div style={{
              background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 8,
              padding: '14px 16px', color: '#047857', fontSize: 13.5, lineHeight: 1.6, marginBottom: 20,
            }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Payment method added</div>
              {label} is ready to use.
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                onClick={() => router.push('/client/payment-assistant')}
                style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: GREEN, color: '#fff', fontWeight: 600, fontSize: 13.5, cursor: 'pointer' }}>
                Continue to Payment Assistant
              </button>
              <Link
                href="/client/payment-methods"
                style={{ padding: '10px 20px', borderRadius: 8, border: '1.5px solid #e2e8f0', color: '#64748b', fontWeight: 600, fontSize: 13.5, textDecoration: 'none' }}>
                Payment Methods
              </Link>
            </div>
          </>
        )}

        {status === 'failed' && (
          <>
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
              padding: '14px 16px', color: '#dc2626', fontSize: 13.5, lineHeight: 1.6, marginBottom: 20,
            }}>
              We couldn&apos;t save that payment method. No charge was made — please try adding it again.
            </div>
            <Link
              href="/client/payment-methods"
              style={{ padding: '10px 20px', borderRadius: 8, border: 'none', background: GREEN, color: '#fff', fontWeight: 600, fontSize: 13.5, textDecoration: 'none' }}>
              Back to Payment Methods
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function PaymentMethodAddedPage() {
  // useSearchParams() needs a Suspense boundary.
  return (
    <Suspense fallback={null}>
      <AddedContent />
    </Suspense>
  );
}
