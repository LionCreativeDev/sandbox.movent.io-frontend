'use client';
import { useEffect, useMemo, useState } from 'react';
import { financeService, FinanceInvoiceRow } from '@/lib/services/financeService';
import { buttonStyle, inputStyle, money } from './shared';
import { METHOD_LABEL } from './shared';
import toast from 'react-hot-toast';

/**
 * Record a payment that arrived off-platform — a bank transfer, cash, a
 * cheque, or a gateway charge being captured after the fact.
 *
 * NO CARD FIELDS, deliberately. Every gateway in this product is hosted
 * checkout: the customer enters their card on Stripe's / PayPal's / the
 * gateway's own page and this server never sees it. A card-number field here
 * would be the one place card data entered the system, so there is none —
 * only the gateway's transaction reference, which is what a finance person
 * actually reconciles against.
 *
 * The amount is bounded by the invoice's outstanding balance, and the
 * server re-applies the company's Payment Policy (part payments are refused
 * outright under "Full Payment Only"). This form mirrors that so the user
 * finds out before submitting, not after.
 */
export default function RecordPaymentModal({
  invoice: fixedInvoice,
  onClose,
  onSaved,
}: {
  /** Pre-selected invoice, when opened from a specific one. */
  invoice?: FinanceInvoiceRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [invoices, setInvoices] = useState<FinanceInvoiceRow[]>([]);
  const [loading, setLoading]   = useState(!fixedInvoice);
  const [invoiceId, setInvoiceId] = useState<number | ''>(fixedInvoice?.id ?? '');

  const [amount, setAmount]   = useState('');
  const [method, setMethod]   = useState('bank_transfer');
  const [date, setDate]       = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState('');
  const [notes, setNotes]     = useState('');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (fixedInvoice) return;
    // Only invoices with something still owed — recording against a settled
    // invoice is refused server-side anyway, so offering it would just be a
    // dead end.
    financeService.invoices({ per_page: 200 })
      .then(d => setInvoices(d.invoices.filter(i => i.outstanding_amount > 0 && !['cancelled'].includes(i.status))))
      .catch(() => toast.error('Failed to load invoices'))
      .finally(() => setLoading(false));
  }, [fixedInvoice]);

  const selected = useMemo(
    () => fixedInvoice ?? invoices.find(i => i.id === invoiceId) ?? null,
    [fixedInvoice, invoices, invoiceId]
  );

  const outstanding = selected?.outstanding_amount ?? 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selected) { setError('Select an invoice first.'); return; }

    const value = Number(amount);
    if (!value || value <= 0) { setError('Enter an amount greater than 0.'); return; }
    if (value > outstanding + 0.005) {
      setError(`That is more than the ${money(outstanding, selected.currency)} still outstanding on this invoice.`);
      return;
    }

    setSaving(true);
    try {
      await financeService.recordPayment(selected.id, {
        amount: value,
        method,
        payment_date: date || undefined,
        gateway_ref: reference || undefined,
        notes: notes || undefined,
      });
      toast.success('Payment recorded');
      onSaved();
    } catch (err: unknown) {
      // The server's own message carries the real reason — most often the
      // company's Payment Policy refusing a part payment.
      const res = (err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } }).response;
      setError(res?.data?.errors?.amount?.[0] ?? res?.data?.message ?? 'Could not record this payment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Overlay onClose={onClose} title="Record Payment">
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {!fixedInvoice && (
          <Field label="Invoice">
            <select
              value={invoiceId}
              onChange={e => { setInvoiceId(e.target.value ? Number(e.target.value) : ''); setAmount(''); }}
              style={{ ...inputStyle, width: '100%' }}
              required
            >
              <option value="">{loading ? 'Loading invoices…' : 'Select an invoice'}</option>
              {invoices.map(i => (
                <option key={i.id} value={i.id}>
                  {i.invoice_number} — {i.customer_name} — {money(i.outstanding_amount, i.currency)} due
                </option>
              ))}
            </select>
            {!loading && invoices.length === 0 && (
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>
                No invoices with an outstanding balance.
              </div>
            )}
          </Field>
        )}

        {selected && (
          <div style={{ background: '#f8fafc', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#475569' }}>
            <div style={{ fontWeight: 700, color: '#0f172a' }}>{selected.invoice_number} · {selected.customer_name}</div>
            <div style={{ marginTop: 4 }}>
              Invoice total {money(selected.total_amount, selected.currency)} ·
              paid {money(selected.paid_amount, selected.currency)} ·
              <strong style={{ color: '#ea580c' }}> {money(outstanding, selected.currency)} outstanding</strong>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
          <Field label={`Amount${selected?.currency ? ` (${selected.currency})` : ''}`}>
            <input
              type="number" step="0.01" min="0.01" max={outstanding || undefined}
              value={amount} onChange={e => setAmount(e.target.value)}
              placeholder={selected ? outstanding.toFixed(2) : '0.00'}
              style={{ ...inputStyle, width: '100%' }} required
            />
          </Field>

          <Field label="Method">
            <select value={method} onChange={e => setMethod(e.target.value)} style={{ ...inputStyle, width: '100%' }} required>
              {['bank_transfer', 'cash', 'cheque', 'card', 'gateway'].map(m => (
                <option key={m} value={m}>{METHOD_LABEL[m]}</option>
              ))}
            </select>
          </Field>

          <Field label="Payment date">
            <input
              type="date" value={date} max={new Date().toISOString().slice(0, 10)}
              onChange={e => setDate(e.target.value)} style={{ ...inputStyle, width: '100%' }}
            />
          </Field>

          <Field label="Transaction / reference">
            <input
              value={reference} onChange={e => setReference(e.target.value)}
              placeholder="Bank reference, cheque no., gateway txn id"
              style={{ ...inputStyle, width: '100%' }}
            />
          </Field>
        </div>

        <Field label="Notes">
          <textarea
            value={notes} onChange={e => setNotes(e.target.value)} rows={2} maxLength={500}
            placeholder="Anything worth recording about this payment"
            style={{ ...inputStyle, width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
          />
        </Field>

        <div style={{ fontSize: 11.5, color: '#94a3b8', lineHeight: 1.5 }}>
          Card details are never entered or stored here — online payments are taken on the
          gateway&apos;s own hosted checkout. Only the transaction reference is recorded.
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#b91c1c', fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onClose} style={buttonStyle('ghost')}>Cancel</button>
          <button type="submit" disabled={saving || !selected} style={{ ...buttonStyle('primary'), opacity: saving || !selected ? 0.6 : 1 }}>
            {saving ? 'Recording…' : 'Record Payment'}
          </button>
        </div>
      </form>
    </Overlay>
  );
}

export function Overlay({ title, onClose, children, width = 620 }: {
  title: string; onClose: () => void; children: React.ReactNode; width?: number;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 1000,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 24, overflowY: 'auto',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 14, width: '100%', maxWidth: width,
          marginTop: 40, boxShadow: '0 20px 60px rgba(15,23,42,0.25)',
        }}
      >
        <div style={{ padding: '18px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: 22, color: '#94a3b8', cursor: 'pointer', lineHeight: 1 }}>&times;</button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
        {label}
      </span>
      {children}
    </label>
  );
}
