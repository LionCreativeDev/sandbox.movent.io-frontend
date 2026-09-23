'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import FinanceShell, { useFinance } from '@/components/finance/FinanceShell';
import {
  Pagination, StatusPill, TableShell, buttonStyle, inputStyle, money, shortDate, dateTime, td,
  PAYMENT_STATUS, RECONCILIATION_STATUS, METHOD_LABEL,
} from '@/components/finance/shared';
import RecordPaymentModal from '@/components/finance/RecordPaymentModal';
import ReconcileModal from '@/components/finance/ReconcileModal';
import { financeService, FinancePaymentRow } from '@/lib/services/financeService';
import { useAdminGuard } from '@/hooks/useAdminGuard';
import { HiMagnifyingGlass, HiArrowDownTray, HiPlus, HiCheckCircle, HiArrowUturnLeft } from 'react-icons/hi2';
import toast from 'react-hot-toast';

/**
 * Finance > Payments.
 *
 * Shows every payment attempt against the invoices this caller can see —
 * confirmed, pending, failed and refunded alike — with its reconciliation
 * state alongside. Those are two independent columns on purpose: `status` is
 * what the money did, `reconciliation_status` is whether a human has checked
 * it. See the migration note on payments.reconciliation_status.
 *
 * Recording a payment here goes to the Finance endpoint, which calls the
 * same InvoicePaymentService::record() the Company Admin's invoice screen
 * has always used — same Payment Policy, same receipt numbering, same
 * crediting.
 */
function PaymentsBody() {
  const { can, companies, invoiceRoot } = useFinance();

  const [rows, setRows]       = useState<FinancePaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage]       = useState(1);
  const [meta, setMeta]       = useState({ current_page: 1, last_page: 1, per_page: 25, total: 0 });

  const [search, setSearch]   = useState('');
  const [appliedSearch, setApplied] = useState('');
  const [status, setStatus]   = useState('');
  const [recon, setRecon]     = useState('');
  const [method, setMethod]   = useState('');
  const [companyId, setCompanyId] = useState('');
  const [from, setFrom]       = useState('');
  const [to, setTo]           = useState('');
  const [exporting, setExporting] = useState(false);

  const [recording, setRecording]   = useState(false);
  const [reconciling, setReconciling] = useState<FinancePaymentRow | null>(null);
  const [busyId, setBusyId]         = useState<number | null>(null);

  const filters = {
    search: appliedSearch || undefined,
    status: status || undefined,
    reconciliation_status: recon || undefined,
    method: method || undefined,
    company_id: companyId || undefined,
    from: from || undefined,
    to: to || undefined,
  };

  const load = () => {
    setLoading(true);
    financeService.payments({ ...filters, page })
      .then(d => { setRows(d.payments); setMeta(d.meta); })
      .catch(() => toast.error('Failed to load payments'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedSearch, status, recon, method, companyId, from, to, page]);

  const applyFilter = (fn: () => void) => { fn(); setPage(1); };

  const doExport = async () => {
    setExporting(true);
    try { await financeService.exportPayments(filters); }
    catch { toast.error('Export failed'); }
    finally { setExporting(false); }
  };

  const undoReconcile = async (p: FinancePaymentRow) => {
    if (!confirm(`Remove the reconciliation on ${p.reference}? The payment itself is not changed.`)) return;
    setBusyId(p.id);
    try {
      await financeService.unreconcilePayment(p.id);
      toast.success('Reconciliation removed');
      load();
    } catch { /* the axios interceptor already reports 403s */ }
    finally { setBusyId(null); }
  };

  const hasFilters = !!(appliedSearch || status || recon || method || companyId || from || to);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>Payments</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {can('payment_details.export') && (
            <button onClick={doExport} disabled={exporting} style={{ ...buttonStyle('ghost'), opacity: exporting ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
              <HiArrowDownTray size={14} /> {exporting ? 'Exporting…' : 'Export CSV'}
            </button>
          )}
          {can('payments.record') && (
            <button onClick={() => setRecording(true)} style={{ ...buttonStyle('primary'), display: 'flex', alignItems: 'center', gap: 6 }}>
              <HiPlus size={14} /> Record Payment
            </button>
          )}
        </div>
      </div>

      <form
        onSubmit={e => { e.preventDefault(); applyFilter(() => setApplied(search)); }}
        style={{ background: '#fff', borderRadius: 12, border: '1px solid #f1f5f9', padding: '16px 20px' }}
      >
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: '1 1 220px', position: 'relative' }}>
            <HiMagnifyingGlass size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search reference, invoice # or customer…"
              style={{ ...inputStyle, width: '100%', paddingLeft: 32 }}
            />
          </div>
          {companies.length > 1 && (
            <select value={companyId} onChange={e => applyFilter(() => setCompanyId(e.target.value))} style={inputStyle}>
              <option value="">All companies</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <select value={status} onChange={e => applyFilter(() => setStatus(e.target.value))} style={inputStyle}>
            <option value="">All payment statuses</option>
            {Object.entries(PAYMENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={recon} onChange={e => applyFilter(() => setRecon(e.target.value))} style={inputStyle}>
            <option value="">All reconciliation states</option>
            {Object.entries(RECONCILIATION_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={method} onChange={e => applyFilter(() => setMethod(e.target.value))} style={inputStyle}>
            <option value="">All methods</option>
            {Object.entries(METHOD_LABEL).filter(([k]) => k !== 'unspecified').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input type="date" value={from} onChange={e => applyFilter(() => setFrom(e.target.value))} style={inputStyle} title="Paid from" />
          <span style={{ color: '#94a3b8', fontSize: 13 }}>to</span>
          <input type="date" value={to} onChange={e => applyFilter(() => setTo(e.target.value))} style={inputStyle} title="Paid to" />
          <button type="submit" style={buttonStyle()}>Search</button>
          {hasFilters && (
            <button
              type="button"
              onClick={() => applyFilter(() => {
                setSearch(''); setApplied(''); setStatus(''); setRecon('');
                setMethod(''); setCompanyId(''); setFrom(''); setTo('');
              })}
              style={buttonStyle('ghost')}
            >
              Clear
            </button>
          )}
        </div>
      </form>

      <TableShell
        headers={[
          'Reference', 'Invoice', 'Customer', 'Company', 'Amount', 'Method',
          'Gateway / Transaction', 'Status', 'Reconciliation', 'Date', 'Recorded By', '',
        ]}
        colCount={12}
        loading={loading}
        empty={hasFilters ? 'No payments match these filters' : 'No payments yet'}
        emptyIcon="💳"
      >
        {rows.map(p => (
          <tr key={p.id} style={{ borderBottom: '1px solid #f8fafc' }}>
            <td style={{ ...td, whiteSpace: 'nowrap', fontWeight: 700, color: '#0f172a' }}>{p.reference}</td>
            <td style={td}>
              {p.invoice_number
                ? <Link href={`${invoiceRoot}/${p.invoice_id}`} style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>{p.invoice_number}</Link>
                : '—'}
            </td>
            <td style={td}>{p.customer_name}</td>
            <td style={{ ...td, fontSize: 12 }}>{p.company_name ?? '—'}</td>
            <td style={{ ...td, whiteSpace: 'nowrap', fontWeight: 700, color: '#059669' }}>{money(p.amount, p.currency)}</td>
            <td style={{ ...td, fontSize: 12 }}>{p.method ? (METHOD_LABEL[p.method] ?? p.method) : '—'}</td>
            <td style={{ ...td, fontSize: 12 }}>
              {p.gateway_name && <div style={{ color: '#0f172a', fontWeight: 600 }}>{p.gateway_name}</div>}
              {/* The gateway's own transaction reference — safe to show, and
                  the thing a finance person reconciles against. Never a key
                  or a card number; see FinancePresenter. */}
              {p.transaction_id && <div style={{ fontFamily: 'monospace', fontSize: 11 }}>{p.transaction_id}</div>}
              {!p.gateway_name && !p.transaction_id && '—'}
            </td>
            <td style={td}><StatusPill map={PAYMENT_STATUS} value={p.status} /></td>
            <td style={td}>
              <StatusPill map={RECONCILIATION_STATUS} value={p.reconciliation_status} />
              {p.reconciled_at && (
                <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 3 }}>
                  {dateTime(p.reconciled_at)}{p.reconciled_by ? ` · ${p.reconciled_by}` : ''}
                </div>
              )}
            </td>
            <td style={{ ...td, whiteSpace: 'nowrap', fontSize: 12 }}>{shortDate(p.payment_date)}</td>
            <td style={{ ...td, fontSize: 12 }}>{p.recorded_by ?? <span style={{ color: '#94a3b8' }}>System / Gateway</span>}</td>
            <td style={td}>
              {can('payments.reconcile') && (
                <div style={{ display: 'flex', gap: 6 }}>
                  {p.reconciliation_status !== 'reconciled' ? (
                    <button
                      onClick={() => setReconciling(p)}
                      disabled={busyId === p.id}
                      title="Reconcile this payment"
                      style={{ ...buttonStyle('ghost'), padding: '5px 8px', display: 'flex', alignItems: 'center', gap: 4, opacity: busyId === p.id ? 0.5 : 1 }}
                    >
                      <HiCheckCircle size={14} /> Reconcile
                    </button>
                  ) : (
                    <button
                      onClick={() => undoReconcile(p)}
                      disabled={busyId === p.id}
                      title="Undo reconciliation"
                      style={{ ...buttonStyle('ghost'), padding: '5px 8px', display: 'flex', alignItems: 'center', opacity: busyId === p.id ? 0.5 : 1 }}
                    >
                      <HiArrowUturnLeft size={14} />
                    </button>
                  )}
                </div>
              )}
            </td>
          </tr>
        ))}
      </TableShell>

      <Pagination page={meta.current_page} lastPage={meta.last_page} total={meta.total} onChange={setPage} />

      {recording && (
        <RecordPaymentModal
          onClose={() => setRecording(false)}
          onSaved={() => { setRecording(false); load(); }}
        />
      )}

      {reconciling && (
        <ReconcileModal
          paymentId={reconciling.id}
          reference={reconciling.reference}
          onClose={() => setReconciling(null)}
          onSaved={() => { setReconciling(null); load(); }}
        />
      )}
    </div>
  );
}

export default function FinancePaymentsPage() {
  useAdminGuard();

  return (
    <FinanceShell title="Finance Payments" requires="payments.view">
      <PaymentsBody />
    </FinanceShell>
  );
}
