// Payment status and progress, in one place.
//
// The backend resolves every invoice's money state once
// (App\Models\Invoice::paymentProgress()) and sends it as `payment_progress`
// on every invoice-shaped response. This module is the display half: the
// labels and colours those states are shown with, so the invoice list, the
// detail screen, the public share link, the client portal, the dashboard and
// the reports all read the same — the whole point being that one invoice can
// never look "Partial" on one screen and "Overdue" on the next.
//
// Six money states, plus the two lifecycle values that pass straight through
// because forcing them into a money state would be wrong: an unsent draft is
// not "pending payment", and a cancelled invoice is not "overdue".

export type PaymentStatus =
  | 'full_paid'
  | 'partially_paid'
  | 'pending'
  | 'overdue'
  | 'failed'
  | 'refunded'
  | 'draft'
  | 'cancelled';

export interface PaymentProgress {
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  /** 0–100, one decimal. A zero-total invoice reads as 100. */
  payment_percentage: number;
  payment_status: PaymentStatus;
}

export interface PaymentStatusStyle {
  label: string;
  bg: string;
  color: string;
  /** The progress bar's fill. Deliberately the same hue as the text. */
  bar: string;
}

export const PAYMENT_STATUS_CFG: Record<PaymentStatus, PaymentStatusStyle> = {
  full_paid:      { label: 'Paid in Full',   bg: '#ecfdf5', color: '#059669', bar: '#10b981' },
  partially_paid: { label: 'Partially Paid', bg: '#fff7ed', color: '#ea580c', bar: '#f97316' },
  pending:        { label: 'Pending',        bg: '#eff6ff', color: '#2563eb', bar: '#3b82f6' },
  overdue:        { label: 'Overdue',        bg: '#fef2f2', color: '#dc2626', bar: '#ef4444' },
  failed:         { label: 'Failed',         bg: '#fef2f2', color: '#b91c1c', bar: '#b91c1c' },
  refunded:       { label: 'Refunded',       bg: '#f5f3ff', color: '#7c3aed', bar: '#8b5cf6' },
  draft:          { label: 'Draft',          bg: '#f8fafc', color: '#64748b', bar: '#94a3b8' },
  cancelled:      { label: 'Cancelled',      bg: '#f1f5f9', color: '#94a3b8', bar: '#cbd5e1' },
};

export const paymentStatusStyle = (status?: string | null): PaymentStatusStyle =>
  PAYMENT_STATUS_CFG[(status ?? 'pending') as PaymentStatus] ?? PAYMENT_STATUS_CFG.pending;

// Some screens group by the LIFECYCLE column (`invoices.status`) rather than
// the money state — the reports breakdown and the dashboard counts both come
// back from SQL grouped that way, and must keep doing so: you cannot GROUP BY
// a value that is computed per invoice.
//
// These two names differ between the two vocabularies, so they are mapped
// rather than looked up directly — otherwise a lifecycle 'paid' would fall
// through to the "Pending" default and a report would contradict the invoice
// it is counting. Every other value ('partially_paid', 'overdue', 'draft',
// 'cancelled') is spelled the same in both.
const LIFECYCLE_ALIAS: Record<string, PaymentStatus> = {
  paid: 'full_paid',
  sent: 'pending',
};

export const lifecycleStatusStyle = (status?: string | null): PaymentStatusStyle => {
  const key = status ?? '';

  return PAYMENT_STATUS_CFG[LIFECYCLE_ALIAS[key] ?? (key as PaymentStatus)]
    ?? PAYMENT_STATUS_CFG.draft;
};

// Older responses (and any endpoint that hand-builds its payload and hasn't
// been given the block yet) can arrive without payment_progress. Rather than
// rendering nothing, derive the same figures from the amounts that have always
// been there — the status is then the lifecycle value, which is what those
// screens showed before.
export const progressOf = (invoice: {
  payment_progress?: PaymentProgress | null;
  total_amount?: number | string | null;
  paid_amount?: number | string | null;
  status?: string | null;
}): PaymentProgress => {
  if (invoice.payment_progress) return invoice.payment_progress;

  const total = Number(invoice.total_amount ?? 0);
  const paid  = Number(invoice.paid_amount ?? 0);

  return {
    total_amount: total,
    paid_amount: paid,
    remaining_amount: Math.max(0, Number((total - paid).toFixed(2))),
    payment_percentage: total > 0 ? Math.min(100, Number(((paid / total) * 100).toFixed(1))) : 100,
    payment_status: (invoice.status as PaymentStatus) ?? 'pending',
  };
};
