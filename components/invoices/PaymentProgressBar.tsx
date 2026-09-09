'use client';
import { PaymentProgress, paymentStatusStyle } from '@/lib/paymentStatus';

// "Paid X of Y — Z remaining", with a bar and the status pill.
//
// One component for every screen that shows payment progress, so the figures
// and the wording can't drift between the invoice list, the detail page, the
// public share link and the client portal. It renders what the backend already
// computed (Invoice::paymentProgress()) and works nothing out itself.
export default function PaymentProgressBar({
  progress,
  currency,
  // The list needs a single compact row; the detail and payment screens have
  // room for the full three-figure breakdown.
  compact = false,
  showStatus = true,
}: {
  progress: PaymentProgress;
  currency: string;
  compact?: boolean;
  showStatus?: boolean;
}) {
  const cfg = paymentStatusStyle(progress.payment_status);
  const fmt = (n: number) => `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // A cancelled or unsent invoice has no payment to be "0% through" — the
  // pill alone is the honest answer, so the bar and figures are dropped.
  const isMoneyState = !['draft', 'cancelled'].includes(progress.payment_status);

  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: isMoneyState ? 6 : 0, flexWrap: 'wrap' }}>
        {showStatus && (
          <span style={{
            padding: '3px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 700,
            background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap',
          }}>
            {cfg.label}
          </span>
        )}
        {isMoneyState && (
          <span style={{ fontSize: 11.5, color: '#64748b', whiteSpace: 'nowrap' }}>
            {progress.payment_percentage}% paid
          </span>
        )}
      </div>

      {isMoneyState && (
        <>
          <div
            style={{ height: compact ? 5 : 8, borderRadius: 20, background: '#f1f5f9', overflow: 'hidden' }}
            role="progressbar"
            aria-valuenow={progress.payment_percentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Payment progress"
          >
            <div style={{
              // Never below 0 or above 100 — the backend clamps it, and a
              // clamped width here means a rogue value can't overflow the bar.
              width: `${Math.min(100, Math.max(0, progress.payment_percentage))}%`,
              height: '100%',
              background: cfg.bar,
              borderRadius: 20,
              transition: 'width .25s',
            }} />
          </div>

          {!compact && (
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
              <span style={{ fontSize: 12, color: '#64748b' }}>
                Paid <strong style={{ color: '#0f172a' }}>{fmt(progress.paid_amount)}</strong> of {fmt(progress.total_amount)}
              </span>
              {progress.remaining_amount > 0 && (
                <span style={{ fontSize: 12, color: '#64748b' }}>
                  Remaining <strong style={{ color: cfg.color }}>{fmt(progress.remaining_amount)}</strong>
                </span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
