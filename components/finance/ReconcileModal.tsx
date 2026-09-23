'use client';
import { useEffect, useState } from 'react';
import { financeService, FinancePaymentDetail } from '@/lib/services/financeService';
import { Overlay, Field } from './RecordPaymentModal';
import { buttonStyle, inputStyle, money, shortDate, StatusPill, PAYMENT_STATUS } from './shared';
import toast from 'react-hot-toast';

/**
 * Compare a payment against its invoice, then sign it off.
 *
 * This is the whole of reconciliation as a person experiences it: see what
 * arrived, see what was owed, see whether the two line up, record the
 * decision. The comparison block comes from the server
 * (FinancePresenter::comparison()) rather than being re-derived here, so the
 * verdict is identical in the modal, the payment-details table and the CSV
 * export.
 *
 * Nothing here moves money. Reconciling does not change the payment's
 * status, the invoice's balance or anything a client can see — it records
 * that a human checked. Confirming a customer's pending claim is a separate
 * action on a separate permission.
 */
export default function ReconcileModal({
  paymentId,
  reference,
  /** Use the payment-details endpoint (narrower permission) instead of the payments one. */
  viaPaymentDetails = false,
  onClose,
  onSaved,
}: {
  paymentId: number;
  reference: string;
  viaPaymentDetails?: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [detail, setDetail]   = useState<FinancePaymentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus]   = useState<'reconciled' | 'disputed'>('reconciled');
  const [note, setNote]       = useState('');
  const [saving, setSaving]   = useState(false);

  useEffect(() => {
    const fetch = viaPaymentDetails ? financeService.paymentDetail : financeService.payment;
    fetch(paymentId)
      .then(d => setDetail(d.payment))
      .catch(() => toast.error('Failed to load this payment'))
      .finally(() => setLoading(false));
  }, [paymentId, viaPaymentDetails]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const call = viaPaymentDetails ? financeService.reconcilePaymentDetail : financeService.reconcilePayment;
      await call(paymentId, { status, note: note || undefined });
      toast.success(status === 'disputed' ? 'Payment marked disputed' : 'Payment reconciled');
      onSaved();
    } catch {
      // 403/422 are surfaced by the axios interceptor.
    } finally {
      setSaving(false);
    }
  };

  const c = detail?.comparison;
  // Advisory only — a legitimate part payment is "less than the invoice
  // total" and must never be blocked, so these are prompts to look, not
  // reasons to refuse.
  const flags = c ? [
    !c.currency_matches ? { tone: 'bad',  text: 'The payment currency does not match the invoice currency.' } : null,
    c.overpaid          ? { tone: 'warn', text: 'This invoice has been paid more than its total.' } : null,
    !c.covers_full_invoice && !c.invoice_settled
      ? { tone: 'info', text: 'This is a part payment — a balance remains on the invoice.' } : null,
    c.invoice_settled   ? { tone: 'good', text: 'The invoice is fully settled.' } : null,
  ].filter(Boolean) as { tone: string; text: string }[] : [];

  const toneStyle: Record<string, React.CSSProperties> = {
    good: { background: '#ecfdf5', borderColor: '#a7f3d0', color: '#047857' },
    info: { background: '#eff6ff', borderColor: '#bfdbfe', color: '#1d4ed8' },
    warn: { background: '#fffbeb', borderColor: '#fde68a', color: '#b45309' },
    bad:  { background: '#fef2f2', borderColor: '#fecaca', color: '#b91c1c' },
  };

  return (
    <Overlay title={`Reconcile ${reference}`} onClose={onClose}>
      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>Loading payment…</div>
      ) : !detail ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>This payment is not available.</div>
      ) : (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Payment vs invoice, side by side — the comparison the decision
              is actually made on. */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14 }}>
            <Panel title="Payment">
              <Row label="Reference" value={detail.reference} />
              <Row label="Amount" value={money(detail.amount, detail.currency)} strong />
              <Row label="Date" value={shortDate(detail.payment_date)} />
              <Row label="Method" value={detail.method ?? '—'} />
              {detail.gateway_name && <Row label="Gateway" value={detail.gateway_name} />}
              {detail.transaction_id && <Row label="Transaction ID" value={detail.transaction_id} mono />}
              <Row label="Status" value={<StatusPill map={PAYMENT_STATUS} value={detail.status} />} />
              <Row label="Recorded by" value={detail.recorded_by ?? 'System / Gateway'} />
            </Panel>

            <Panel title="Invoice">
              {detail.invoice ? (
                <>
                  <Row label="Invoice #" value={detail.invoice.invoice_number} />
                  <Row label="Customer" value={detail.customer_name} />
                  <Row label="Invoice total" value={money(detail.invoice.total_amount, detail.invoice.currency)} strong />
                  <Row label="Paid to date" value={money(detail.invoice.paid_amount, detail.invoice.currency)} />
                  <Row label="Outstanding" value={money(detail.invoice.outstanding_amount, detail.invoice.currency)} />
                  <Row label="Due" value={shortDate(detail.invoice.due_date)} />
                </>
              ) : <div style={{ color: '#94a3b8', fontSize: 13 }}>The linked invoice is no longer available.</div>}
            </Panel>
          </div>

          {flags.map((f, i) => (
            <div key={i} style={{
              border: '1px solid', borderRadius: 9, padding: '10px 14px', fontSize: 13, ...toneStyle[f.tone],
            }}>
              {f.text}
            </div>
          ))}

          <Field label="Decision">
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {([
                { v: 'reconciled', label: 'Reconcile — verified against the invoice' },
                { v: 'disputed',   label: 'Dispute — something does not add up' },
              ] as const).map(opt => (
                <label key={opt.v} style={{
                  display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer',
                  padding: '10px 14px', borderRadius: 9, flex: '1 1 220px',
                  border: `1.5px solid ${status === opt.v ? '#2563eb' : '#e2e8f0'}`,
                  background: status === opt.v ? '#eff6ff' : '#fff',
                  color: status === opt.v ? '#1d4ed8' : '#475569',
                }}>
                  <input type="radio" checked={status === opt.v} onChange={() => setStatus(opt.v)} />
                  {opt.label}
                </label>
              ))}
            </div>
          </Field>

          <Field label="Note (optional)">
            <textarea
              value={note} onChange={e => setNote(e.target.value)} rows={2} maxLength={500}
              placeholder="What you checked, or why this is disputed"
              style={{ ...inputStyle, width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
            />
          </Field>

          <div style={{ fontSize: 11.5, color: '#94a3b8', lineHeight: 1.5 }}>
            Reconciling records that you checked this payment. It does not change the payment&apos;s
            status, the invoice balance, or anything the client sees. Your name and the time are saved
            with it, and the action is written to the company audit log.
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" onClick={onClose} style={buttonStyle('ghost')}>Cancel</button>
            <button type="submit" disabled={saving} style={{ ...buttonStyle('primary'), opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving…' : status === 'disputed' ? 'Mark Disputed' : 'Reconcile'}
            </button>
          </div>
        </form>
      )}
    </Overlay>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#f8fafc', borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
    </div>
  );
}

function Row({ label, value, strong, mono }: { label: string; value: React.ReactNode; strong?: boolean; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12.5 }}>
      <span style={{ color: '#94a3b8' }}>{label}</span>
      <span style={{
        color: '#0f172a', fontWeight: strong ? 700 : 500, textAlign: 'right',
        fontFamily: mono ? 'monospace' : 'inherit', fontSize: mono ? 11.5 : undefined, wordBreak: 'break-all',
      }}>{value}</span>
    </div>
  );
}
