'use client';

import { useEffect, useRef, useState } from 'react';
import type { Stripe, StripeCardElement } from '@stripe/stripe-js';
import { clientService, SavedCard } from '@/lib/services/clientService';

/**
 * "Add a card" without leaving the Client Portal.
 *
 * WHAT THIS IS NOT: a card form. The inputs below belong to Stripe Elements —
 * they are rendered by Stripe's script inside a cross-origin iframe that this
 * page cannot read. The number, expiry and CVC go from that frame straight to
 * Stripe. They never enter this component's state, this app's DOM, its network
 * traffic or its logs, and there is deliberately no React state here that could
 * hold them.
 *
 * All this component ever handles is a publishable key (public by definition)
 * and a single-use client secret scoped to one card setup, which cannot charge
 * anything. On success Stripe returns a payment-method id, and the SERVER then
 * asks Stripe whether that setup really succeeded before saving the card — so
 * nothing is stored on the browser's say-so.
 *
 * confirmCardSetup() also handles 3-D Secure in place, in Stripe's own modal,
 * so a bank challenge does not send the client away either.
 *
 * The same component serves both places a card can be added: the Payment
 * Methods page and the AI Assistance widget. It is a parameterized port of the
 * approach in components/payments/InlineGatewayPayment.tsx — that one charges
 * an invoice, this one only saves a card — rather than a second copy of the
 * Stripe wiring that could drift from it.
 */
export default function AddCardInline({
  companyId,
  onSaved,
  onCancel,
  compact = false,
}: {
  companyId: number;
  onSaved: (card: SavedCard) => void;
  onCancel?: () => void;
  /** Tighter spacing and type, for inside the assistant widget. */
  compact?: boolean;
}) {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');

  const stripeRef = useRef<Stripe | null>(null);
  const cardRef = useRef<StripeCardElement | null>(null);
  const secretRef = useRef<string>('');
  const mountRef = useRef<HTMLDivElement>(null);
  // The in-flight setup request, so Strict Mode's second mount reuses it
  // instead of opening a second SetupIntent — see the effect below for why a
  // plain "already started" flag cannot be used here.
  const setupPromiseRef = useRef<ReturnType<typeof clientService.paymentMethods.inlineSetup> | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // Cached in a ref rather than guarded by a "started once" flag.
        //
        // React Strict Mode mounts, unmounts and remounts in development. A
        // start-once flag deadlocks that: the FIRST run gets cancelled by its
        // own cleanup, the second is skipped by the flag, and the form sits on
        // "Loading secure card form…" forever. Reusing the in-flight promise
        // instead lets the second run finish the job while still creating only
        // one SetupIntent.
        setupPromiseRef.current ??= clientService.paymentMethods.inlineSetup(companyId);
        const setup = await setupPromiseRef.current;
        if (cancelled) return;

        secretRef.current = setup.client_secret;

        // Every failure below is SURFACED rather than returned from silently.
        // A silent return leaves the form looking like it is still loading,
        // which is indistinguishable from a hang and tells nobody what to fix.
        if (!setup.publishable_key) {
          setLoadError('Card payments are not fully set up for this company yet. Please contact us and we will sort it out.');
          return;
        }

        const { loadStripe } = await import('@stripe/stripe-js');
        const stripe = await loadStripe(setup.publishable_key);
        if (cancelled) return;

        if (!stripe) {
          setLoadError('The secure card form could not be loaded. Please refresh and try again.');
          return;
        }

        if (!mountRef.current) {
          setLoadError('The secure card form could not be loaded. Please refresh and try again.');
          return;
        }

        stripeRef.current = stripe;
        const element = stripe.elements().create('card', {
          // No billing address is collected anywhere in this portal, so
          // Stripe's default postal field would ask for something nothing
          // uses. Same choice as InlineGatewayPayment.
          hidePostalCode: true,
          style: {
            base: {
              fontSize: compact ? '14px' : '15px',
              color: '#0f172a',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              '::placeholder': { color: '#94a3b8' },
            },
            invalid: { color: '#dc2626' },
          },
        });

        element.mount(mountRef.current);
        // Stripe reports validation as you type; surfacing it here means the
        // client learns about a bad number before pressing Save.
        element.on('change', e => setError(e.error?.message ?? ''));

        cardRef.current = element;
        if (!cancelled) setReady(true);
      } catch (err: unknown) {
        if (cancelled) return;
        const ex = err as { response?: { data?: { message?: string } } };
        setLoadError(ex.response?.data?.message ?? 'The secure card form could not be loaded. Please try again.');
      }
    })();

    return () => {
      cancelled = true;
      cardRef.current?.destroy();
      cardRef.current = null;
      stripeRef.current = null;
    };
    // One setup per mount — companyId does not change within a mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    if (!stripeRef.current || !cardRef.current || !secretRef.current || busy) return;

    setBusy(true);
    setError('');

    try {
      // Stripe confirms the card and, when the bank asks for it, runs 3-D
      // Secure in its own modal — still without leaving the portal.
      const { setupIntent, error: stripeError } = await stripeRef.current.confirmCardSetup(
        secretRef.current,
        { payment_method: { card: cardRef.current } },
      );

      if (stripeError) {
        setError(stripeError.message ?? 'That card could not be verified. Please check the details and try again.');
        return;
      }

      if (!setupIntent?.id) {
        setError('That card could not be verified. Please try again.');
        return;
      }

      // The server re-checks with Stripe before saving anything, so this is a
      // request to confirm, not an assertion that it worked.
      const { payment_method } = await clientService.paymentMethods.inlineComplete(companyId, setupIntent.id);
      onSaved(payment_method);
    } catch (err: unknown) {
      const ex = err as { response?: { data?: { message?: string } } };
      setError(ex.response?.data?.message ?? 'We could not save that card. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const pad = compact ? 10 : 13;

  if (loadError) {
    return (
      <div style={{
        background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
        padding: '10px 14px', fontSize: 13, color: '#dc2626',
      }}>
        {loadError}
      </div>
    );
  }

  return (
    <div>
      <div
        ref={mountRef}
        style={{
          padding: `${pad}px 12px`,
          border: '1.5px solid #e2e8f0',
          borderRadius: 10,
          background: '#fff',
          minHeight: compact ? 40 : 44,
        }}
      />

      {!ready && (
        <div style={{ marginTop: 8, fontSize: 12, color: '#94a3b8' }}>Loading secure card form…</div>
      )}

      {error && (
        <div role="alert" style={{ marginTop: 8, fontSize: 12.5, color: '#dc2626' }}>{error}</div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={save}
          disabled={!ready || busy}
          style={{
            padding: compact ? '9px 16px' : '10px 20px',
            borderRadius: 8, border: 'none',
            background: !ready || busy ? '#a7f3d0' : '#10b981',
            color: '#fff', fontWeight: 600, fontSize: 13.5,
            cursor: !ready || busy ? 'not-allowed' : 'pointer',
          }}
        >
          {busy ? 'Saving…' : 'Save card'}
        </button>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={{
              padding: compact ? '9px 16px' : '10px 20px',
              borderRadius: 8, border: '1.5px solid #e2e8f0',
              background: '#fff', color: '#64748b', fontWeight: 600, fontSize: 13.5,
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
        )}
      </div>

      <div style={{ marginTop: 10, fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>
        🔒 Your card is entered directly into our payment provider&apos;s secure form and stored by them.
        We only ever see the card type and last four digits. Nothing is charged for adding a card.
      </div>
    </div>
  );
}
