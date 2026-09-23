'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import FinanceShell, { useFinance } from '@/components/finance/FinanceShell';
import {
  Pagination, StatusPill, TableShell, buttonStyle, inputStyle, money, shortDate, dateTime, td,
  REMINDER_STATUS,
} from '@/components/finance/shared';
import CreateReminderModal from '@/components/finance/CreateReminderModal';
import { financeService, FinanceReminderRow } from '@/lib/services/financeService';
import { useAdminGuard } from '@/hooks/useAdminGuard';
import { HiPlus, HiPaperAirplane, HiXMark } from 'react-icons/hi2';
import toast from 'react-hot-toast';

/**
 * Finance > Invoice Reminders — create, send, track.
 *
 * A reminder is a record of intent first and a delivery second, which is why
 * `status` and `reminder_date` live alongside `sent_at`: you can queue a
 * chase for Friday and release it yourself, or let the daily
 * `invoices:send-due-reminders` command send it when the date arrives.
 * Leaving the date blank means "I will send this myself" — the scheduler
 * never picks those up.
 *
 * Delivery uses the app's existing mail stack (an App\Mail Mailable and a
 * blade template, plus the in-app Notification bell), not a separate email
 * system.
 */
function RemindersBody() {
  const { can, companies, invoiceRoot } = useFinance();

  const [rows, setRows]       = useState<FinanceReminderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage]       = useState(1);
  const [meta, setMeta]       = useState({ current_page: 1, last_page: 1, per_page: 25, total: 0 });

  const [status, setStatus]       = useState('');
  const [companyId, setCompanyId] = useState('');
  const [from, setFrom]           = useState('');
  const [to, setTo]               = useState('');
  const [creating, setCreating]   = useState(false);
  const [busyId, setBusyId]       = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    financeService.reminders({
      status: status || undefined,
      company_id: companyId || undefined,
      from: from || undefined,
      to: to || undefined,
      page,
    })
      .then(d => { setRows(d.reminders); setMeta(d.meta); })
      .catch(() => toast.error('Failed to load reminders'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, companyId, from, to, page]);

  const applyFilter = (fn: () => void) => { fn(); setPage(1); };

  const sendNow = async (r: FinanceReminderRow) => {
    if (!confirm(`Send this reminder for invoice ${r.invoice_number} now?`)) return;
    setBusyId(r.id);
    try {
      await financeService.sendReminder(r.id);
      toast.success('Reminder sent');
    } catch (err: unknown) {
      // A delivery failure is a recorded outcome — the row now says why.
      // Surface the server's reason rather than a generic message.
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      toast.error(msg ?? 'Reminder could not be sent');
    } finally {
      setBusyId(null);
      load();
    }
  };

  const cancel = async (r: FinanceReminderRow) => {
    if (!confirm('Cancel this reminder? It will not be sent.')) return;
    setBusyId(r.id);
    try {
      await financeService.cancelReminder(r.id);
      toast.success('Reminder cancelled');
      load();
    } catch { /* interceptor reports it */ }
    finally { setBusyId(null); }
  };

  const hasFilters = !!(status || companyId || from || to);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>Invoice Reminders</h2>
          <p style={{ margin: '3px 0 0', fontSize: 12.5, color: '#94a3b8' }}>
            Chase unpaid invoices by email, now or on a date. Dated reminders go out automatically each morning.
          </p>
        </div>
        {can('reminders.create') && (
          <button onClick={() => setCreating(true)} style={{ ...buttonStyle('primary'), display: 'flex', alignItems: 'center', gap: 6 }}>
            <HiPlus size={14} /> Create Reminder
          </button>
        )}
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #f1f5f9', padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={status} onChange={e => applyFilter(() => setStatus(e.target.value))} style={inputStyle}>
            <option value="">All statuses</option>
            {Object.entries(REMINDER_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          {companies.length > 1 && (
            <select value={companyId} onChange={e => applyFilter(() => setCompanyId(e.target.value))} style={inputStyle}>
              <option value="">All companies</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <input type="date" value={from} onChange={e => applyFilter(() => setFrom(e.target.value))} style={inputStyle} title="Reminder date from" />
          <span style={{ color: '#94a3b8', fontSize: 13 }}>to</span>
          <input type="date" value={to} onChange={e => applyFilter(() => setTo(e.target.value))} style={inputStyle} title="Reminder date to" />
          {hasFilters && (
            <button onClick={() => applyFilter(() => { setStatus(''); setCompanyId(''); setFrom(''); setTo(''); })} style={buttonStyle('ghost')}>
              Clear
            </button>
          )}
        </div>
      </div>

      <TableShell
        headers={['Invoice', 'Customer', 'Type', 'Reminder Date', 'Invoice Due', 'Outstanding', 'Status', 'Sent', 'Created By', '']}
        colCount={10}
        loading={loading}
        empty={hasFilters ? 'No reminders match these filters' : 'No reminders yet'}
        emptyIcon="🔔"
      >
        {rows.map(r => (
          <tr key={r.id} style={{ borderBottom: '1px solid #f8fafc' }}>
            <td style={td}>
              {r.invoice_number
                ? <Link href={`${invoiceRoot}/${r.invoice_id}`} style={{ color: '#2563eb', fontWeight: 700, textDecoration: 'none' }}>{r.invoice_number}</Link>
                : '—'}
              {r.company_name && companies.length > 1 && (
                <div style={{ fontSize: 11, color: '#94a3b8' }}>{r.company_name}</div>
              )}
            </td>
            <td style={td}>{r.customer_name}</td>
            <td style={{ ...td, fontSize: 12, textTransform: 'capitalize' }}>{r.type}</td>
            <td style={{ ...td, whiteSpace: 'nowrap', fontSize: 12 }}>
              {r.reminder_date
                ? shortDate(r.reminder_date)
                : <span style={{ color: '#94a3b8' }}>Manual send</span>}
            </td>
            <td style={{ ...td, whiteSpace: 'nowrap', fontSize: 12 }}>{shortDate(r.due_date)}</td>
            <td style={{ ...td, whiteSpace: 'nowrap', fontWeight: 600, color: (r.invoice_outstanding ?? 0) > 0 ? '#ea580c' : '#059669' }}>
              {r.invoice_outstanding != null ? money(r.invoice_outstanding, r.invoice_currency) : '—'}
            </td>
            <td style={td}>
              <StatusPill map={REMINDER_STATUS} value={r.status} />
              {r.status === 'failed' && r.failure_reason && (
                <div style={{ fontSize: 10.5, color: '#dc2626', marginTop: 3, maxWidth: 220 }}>{r.failure_reason}</div>
              )}
            </td>
            <td style={{ ...td, fontSize: 11.5 }}>
              {r.sent_at ? (
                <>
                  <div>{dateTime(r.sent_at)}</div>
                  {r.sent_to && <div style={{ color: '#94a3b8' }}>{r.sent_to}</div>}
                  {r.sent_by && <div style={{ color: '#94a3b8' }}>by {r.sent_by}</div>}
                </>
              ) : <span style={{ color: '#94a3b8' }}>—</span>}
            </td>
            <td style={{ ...td, fontSize: 12 }}>
              <div>{r.created_by ?? '—'}</div>
              <div style={{ fontSize: 10.5, color: '#94a3b8' }}>{shortDate(r.created_at)}</div>
            </td>
            <td style={td}>
              <div style={{ display: 'flex', gap: 6 }}>
                {can('reminders.send') && (r.status === 'scheduled' || r.status === 'failed') && (
                  <button
                    onClick={() => sendNow(r)}
                    disabled={busyId === r.id}
                    title="Send now"
                    style={{ ...buttonStyle('ghost'), padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 5, opacity: busyId === r.id ? 0.5 : 1 }}
                  >
                    <HiPaperAirplane size={13} /> Send
                  </button>
                )}
                {can('reminders.create') && r.status === 'scheduled' && (
                  <button
                    onClick={() => cancel(r)}
                    disabled={busyId === r.id}
                    title="Cancel reminder"
                    style={{ ...buttonStyle('ghost'), padding: '5px 8px', display: 'flex', alignItems: 'center', color: '#dc2626', opacity: busyId === r.id ? 0.5 : 1 }}
                  >
                    <HiXMark size={14} />
                  </button>
                )}
              </div>
            </td>
          </tr>
        ))}
      </TableShell>

      <Pagination page={meta.current_page} lastPage={meta.last_page} total={meta.total} onChange={setPage} />

      {!can('reminders.track') && (
        <div style={{ fontSize: 11.5, color: '#94a3b8' }}>
          You are seeing only the reminders you created. Full history needs the
          Finance → Invoice Reminders → Track permission.
        </div>
      )}

      {creating && (
        <CreateReminderModal
          canSend={can('reminders.send')}
          onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); load(); }}
        />
      )}
    </div>
  );
}

export default function FinanceRemindersPage() {
  useAdminGuard();

  return (
    <FinanceShell
      title="Invoice Reminders"
      requiresAny={['reminders.track', 'reminders.create', 'reminders.send']}
    >
      <RemindersBody />
    </FinanceShell>
  );
}
