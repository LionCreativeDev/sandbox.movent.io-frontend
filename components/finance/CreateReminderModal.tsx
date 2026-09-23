'use client';
import { useEffect, useState } from 'react';
import { financeService } from '@/lib/services/financeService';
import { Overlay, Field } from './RecordPaymentModal';
import { buttonStyle, inputStyle, money, shortDate } from './shared';
import toast from 'react-hot-toast';

interface ChaseableInvoice {
  id: number;
  invoice_number: string;
  customer_name: string;
  currency: string | null;
  outstanding: number;
  due_date: string | null;
  status: string;
  is_overdue: boolean;
}

interface VerifyResult {
  invoice: {
    id: number; invoice_number: string; company_id: number; status: string;
    payment_status: string; currency: string | null; total_amount: number;
    paid_amount: number; outstanding: number; due_date: string | null; is_overdue: boolean;
  };
  client: { id: number | null; name: string | null; email: string | null };
  can_send: boolean;
  warnings: string[];
}

/**
 * Create Reminder, following the flow the Finance spec describes:
 *
 *   select invoice → verify the client → configure → save → send when
 *   authorized
 *
 * The verify step is a real server round trip, not a local lookup: it comes
 * back with the invoice's live balance, the address the reminder would
 * actually reach, and any warnings (already settled, no email on file, still
 * a draft). Those are shown as facts rather than enforced as refusals — a
 * reminder for a settled invoice is a mistake worth warning about, and the
 * send itself is refused server-side at the moment of sending, when the
 * balance is checked again.
 */
export default function CreateReminderModal({
  canSend,
  onClose,
  onSaved,
}: {
  canSend: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [invoices, setInvoices] = useState<ChaseableInvoice[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [invoiceId, setInvoiceId] = useState<number | ''>('');

  const [verify, setVerify]       = useState<VerifyResult | null>(null);
  const [verifying, setVerifying] = useState(false);

  const [reminderDate, setReminderDate] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sendNow, setSendNow] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    financeService.verifyReminder()
      .then(d => setInvoices(d.invoices ?? []))
      .catch(() => toast.error('Failed to load invoices'))
      .finally(() => setLoadingList(false));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!invoiceId) { setVerify(null); return; }
    setVerifying(true);
    financeService.verifyReminder(Number(invoiceId))
      .then(setVerify)
      .catch(() => { setVerify(null); toast.error('Could not verify this invoice'); })
      .finally(() => setVerifying(false));
  }, [invoiceId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!invoiceId) { setError('Select an invoice first.'); return; }

    setSaving(true);
    try {
      const res = await financeService.createReminder({
        invoice_id: Number(invoiceId),
        type: 'email',
        reminder_date: reminderDate || undefined,
        subject: subject || undefined,
        message: message || undefined,
        send_now: sendNow || undefined,
      });
      toast.success(res?.message ?? 'Reminder created');
      onSaved();
    } catch (err: unknown) {
      const res = (err as { response?: { data?: { message?: string } } }).response;
      setError(res?.data?.message ?? 'Could not create this reminder.');
    } finally {
      setSaving(false);
    }
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Overlay title="Create Invoice Reminder" onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="1 · Select invoice">
          <select
            value={invoiceId}
            onChange={e => setInvoiceId(e.target.value ? Number(e.target.value) : '')}
            style={{ ...inputStyle, width: '100%' }}
            required
          >
            <option value="">{loadingList ? 'Loading invoices…' : 'Select an unpaid invoice'}</option>
            {invoices.map(i => (
              <option key={i.id} value={i.id}>
                {i.invoice_number} — {i.customer_name} — {money(i.outstanding, i.currency)} due
                {i.is_overdue ? ' (overdue)' : ''}
              </option>
            ))}
          </select>
          {!loadingList && invoices.length === 0 && (
            <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>
              Nothing to chase — every invoice you can see is settled, cancelled or still a draft.
            </div>
          )}
        </Field>

        {/* 2 · Verify client — server-resolved, so what is shown here is
            exactly where the email would go. */}
        {verifying && <div style={{ fontSize: 13, color: '#94a3b8' }}>Verifying invoice and client…</div>}

        {verify && (
          <div style={{ background: '#f8fafc', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
              2 · Verify client
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12.5, color: '#475569' }}>
              <Line label="Invoice" value={verify.invoice.invoice_number} />
              <Line label="Client" value={verify.client.name ?? '—'} />
              <Line
                label="Reminder goes to"
                value={verify.client.email ?? <span style={{ color: '#dc2626' }}>No email on file</span>}
              />
              <Line label="Invoice total" value={money(verify.invoice.total_amount, verify.invoice.currency)} />
              <Line label="Outstanding" value={<strong style={{ color: '#ea580c' }}>{money(verify.invoice.outstanding, verify.invoice.currency)}</strong>} />
              <Line label="Due date" value={shortDate(verify.invoice.due_date)} />
            </div>

            {verify.warnings.map((w, i) => (
              <div key={i} style={{
                marginTop: 10, background: '#fffbeb', border: '1px solid #fde68a',
                borderRadius: 8, padding: '9px 12px', color: '#b45309', fontSize: 12.5,
              }}>
                {w}
              </div>
            ))}
          </div>
        )}

        <div>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
            3 · Configure
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Send on (leave blank to send manually)">
              <input
                type="date" value={reminderDate} min={today}
                onChange={e => setReminderDate(e.target.value)}
                style={{ ...inputStyle, width: '100%' }}
              />
              <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 5 }}>
                Dated reminders are sent automatically each morning. With no date, it waits for
                someone to press Send.
              </div>
            </Field>

            <Field label="Subject (optional)">
              <input
                value={subject} onChange={e => setSubject(e.target.value)} maxLength={255}
                placeholder={verify ? `Payment reminder: invoice ${verify.invoice.invoice_number}` : 'Payment reminder'}
                style={{ ...inputStyle, width: '100%' }}
              />
            </Field>

            <Field label="Message (optional)">
              <textarea
                value={message} onChange={e => setMessage(e.target.value)} rows={4} maxLength={2000}
                placeholder="Anything you want to add above the invoice summary. The amount due, dates and payment link are included automatically."
                style={{ ...inputStyle, width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
              />
            </Field>

            {canSend && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#475569', cursor: 'pointer' }}>
                <input type="checkbox" checked={sendNow} onChange={e => setSendNow(e.target.checked)} />
                Send it immediately after saving
              </label>
            )}
            {!canSend && (
              <div style={{ fontSize: 11.5, color: '#94a3b8' }}>
                You can create reminders but not send them — this one will be saved for someone with
                the Send permission to release.
              </div>
            )}
          </div>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#b91c1c', fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onClose} style={buttonStyle('ghost')}>Cancel</button>
          <button type="submit" disabled={saving || !invoiceId} style={{ ...buttonStyle('primary'), opacity: saving || !invoiceId ? 0.6 : 1 }}>
            {saving ? 'Saving…' : sendNow ? 'Save & Send' : 'Save Reminder'}
          </button>
        </div>
      </form>
    </Overlay>
  );
}

function Line({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ color: '#94a3b8' }}>{label}</span>
      <span style={{ color: '#0f172a', textAlign: 'right', wordBreak: 'break-word' }}>{value}</span>
    </div>
  );
}
