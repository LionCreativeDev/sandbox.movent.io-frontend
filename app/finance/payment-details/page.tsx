'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import FinanceShell, { useFinance } from '@/components/finance/FinanceShell';
import {
  Pagination, StatusPill, TableShell, buttonStyle, inputStyle, money, shortDate, dateTime, td,
  PAYMENT_STATUS, RECONCILIATION_STATUS, METHOD_LABEL,
} from '@/components/finance/shared';
import ReconcileModal from '@/components/finance/ReconcileModal';
import { financeService, FinancePaymentDetail } from '@/lib/services/financeService';
import { useAdminGuard } from '@/hooks/useAdminGuard';
import { HiMagnifyingGlass, HiArrowDownTray, HiCheckCircle, HiChevronDown, HiChevronRight } from 'react-icons/hi2';
import toast from 'react-hot-toast';

/**
 * Finance > Payment Details.
 *
 * The audit view of each payment: everything the record carries, the invoice
 * it is checked against, the related client / lead / project, and the full
 * reconciliation trail (status, who, when, note).
 *
 * What is NOT here, and cannot be: card numbers, CVV, expiry, gateway API
 * keys. Not filtered out — never serialised. Every gateway in this product
 * is hosted checkout, so no card data reaches this server at all, and
 * App\Services\Finance\FinancePresenter is an allow-list of named fields, so
 * nothing can slip in later either. The gateway transaction reference IS
 * shown: it is the merchant-side id printed on the company's own statement,
 * which is exactly what reconciliation needs.
 */
function PaymentDetailsBody() {
  const { can, companies, invoiceRoot } = useFinance();

  const [rows, setRows]       = useState<FinancePaymentDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage]       = useState(1);
  const [meta, setMeta]       = useState({ current_page: 1, last_page: 1, per_page: 25, total: 0 });
  const [expanded, setExpanded] = useState<number | null>(null);

  const [search, setSearch]   = useState('');
  const [appliedSearch, setApplied] = useState('');
  const [status, setStatus]   = useState('');
  const [recon, setRecon]     = useState('');
  const [companyId, setCompanyId] = useState('');
  const [from, setFrom]       = useState('');
  const [to, setTo]           = useState('');
  const [exporting, setExporting] = useState(false);
  const [reconciling, setReconciling] = useState<FinancePaymentDetail | null>(null);

  const filters = {
    search: appliedSearch || undefined,
    status: status || undefined,
    reconciliation_status: recon || undefined,
    company_id: companyId || undefined,
    from: from || undefined,
    to: to || undefined,
  };

  const load = () => {
    setLoading(true);
    financeService.paymentDetails({ ...filters, page })
      .then(d => { setRows(d.payments); setMeta(d.meta); })
      .catch(() => toast.error('Failed to load payment details'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedSearch, status, recon, companyId, from, to, page]);

  const applyFilter = (fn: () => void) => { fn(); setPage(1); };

  const doExport = async () => {
    setExporting(true);
    try { await financeService.exportPaymentDetails(filters); }
    catch { toast.error('Export failed'); }
    finally { setExporting(false); }
  };

  const hasFilters = !!(appliedSearch || status || recon || companyId || from || to);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>Payment Details</h2>
          <p style={{ margin: '3px 0 0', fontSize: 12.5, color: '#94a3b8' }}>
            Full record for each payment, and the reconciliation trail behind it
          </p>
        </div>
        {can('payment_details.export') && (
          <button onClick={doExport} disabled={exporting} style={{ ...buttonStyle('ghost'), opacity: exporting ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
            <HiArrowDownTray size={14} /> {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        )}
      </div>

      <form
        onSubmit={e => { e.preventDefault(); applyFilter(() => setApplied(search)); }}
        style={{ background: '#fff', borderRadius: 12, border: '1px solid #f1f5f9', padding: '16px 20px' }}
      >
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: '1 1 220px', position: 'relative' }}>
            <HiMagnifyingGlass size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search reference, transaction id, invoice…"
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
          <input type="date" value={from} onChange={e => applyFilter(() => setFrom(e.target.value))} style={inputStyle} title="Paid from" />
          <span style={{ color: '#94a3b8', fontSize: 13 }}>to</span>
          <input type="date" value={to} onChange={e => applyFilter(() => setTo(e.target.value))} style={inputStyle} title="Paid to" />
          <button type="submit" style={buttonStyle()}>Search</button>
          {hasFilters && (
            <button
              type="button"
              onClick={() => applyFilter(() => {
                setSearch(''); setApplied(''); setStatus(''); setRecon(''); setCompanyId(''); setFrom(''); setTo('');
              })}
              style={buttonStyle('ghost')}
            >
              Clear
            </button>
          )}
        </div>
      </form>

      <TableShell
        headers={['', 'Reference', 'Invoice', 'Customer', 'Amount', 'Status', 'Reconciliation', 'Date', '']}
        colCount={9}
        loading={loading}
        empty={hasFilters ? 'No payments match these filters' : 'No payments yet'}
        emptyIcon="🔍"
      >
        {rows.flatMap(p => {
          const open = expanded === p.id;
          const rowsOut = [
            <tr key={p.id} style={{ borderBottom: open ? 'none' : '1px solid #f8fafc' }}>
              <td style={{ ...td, width: 34, paddingRight: 0 }}>
                <button
                  onClick={() => setExpanded(open ? null : p.id)}
                  aria-label={open ? 'Collapse details' : 'Expand details'}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8', display: 'flex' }}
                >
                  {open ? <HiChevronDown size={16} /> : <HiChevronRight size={16} />}
                </button>
              </td>
              <td style={{ ...td, whiteSpace: 'nowrap', fontWeight: 700, color: '#0f172a' }}>{p.reference}</td>
              <td style={td}>
                {p.invoice_number
                  ? <Link href={`${invoiceRoot}/${p.invoice_id}`} style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>{p.invoice_number}</Link>
                  : '—'}
              </td>
              <td style={td}>{p.customer_name}</td>
              <td style={{ ...td, whiteSpace: 'nowrap', fontWeight: 700, color: '#059669' }}>{money(p.amount, p.currency)}</td>
              <td style={td}><StatusPill map={PAYMENT_STATUS} value={p.status} /></td>
              <td style={td}><StatusPill map={RECONCILIATION_STATUS} value={p.reconciliation_status} /></td>
              <td style={{ ...td, whiteSpace: 'nowrap', fontSize: 12 }}>{shortDate(p.payment_date)}</td>
              <td style={td}>
                {can('payment_details.reconcile') && p.reconciliation_status !== 'reconciled' && (
                  <button
                    onClick={() => setReconciling(p)}
                    style={{ ...buttonStyle('ghost'), padding: '5px 10px', display: 'flex', alignItems: 'center', gap: 5 }}
                  >
                    <HiCheckCircle size={14} /> Reconcile
                  </button>
                )}
              </td>
            </tr>,
          ];

          if (open) {
            rowsOut.push(
              <tr key={`${p.id}-detail`} style={{ borderBottom: '1px solid #f8fafc', background: '#fcfdff' }}>
                <td colSpan={9} style={{ padding: '4px 18px 20px 48px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18 }}>
                    <DetailBlock title="Payment">
                      <Detail label="Reference" value={p.reference} />
                      <Detail label="Receipt no." value={p.receipt_number ?? '—'} />
                      <Detail label="Amount" value={money(p.amount, p.currency)} />
                      <Detail label="Currency" value={p.currency ?? '—'} />
                      <Detail label="Method" value={p.method ? (METHOD_LABEL[p.method] ?? p.method) : '—'} />
                      <Detail label="Gateway" value={p.gateway_name ?? '—'} />
                      <Detail label="Transaction ID" value={p.transaction_id ?? '—'} mono />
                      <Detail label="Payment date" value={shortDate(p.payment_date)} />
                      <Detail label="Recorded by" value={p.recorded_by ?? 'System / Gateway'} />
                      {p.converted_amount != null && (
                        <Detail label="Charged as" value={`${p.converted_currency} ${p.converted_amount.toFixed(2)}`} />
                      )}
                      {p.notes && <Detail label="Notes" value={p.notes} />}
                    </DetailBlock>

                    <DetailBlock title="Invoice">
                      {p.invoice ? (
                        <>
                          <Detail label="Invoice #" value={p.invoice.invoice_number} />
                          <Detail label="Company" value={p.company_name ?? '—'} />
                          <Detail label="Invoice total" value={money(p.invoice.total_amount, p.invoice.currency)} />
                          <Detail label="Paid to date" value={money(p.invoice.paid_amount, p.invoice.currency)} />
                          <Detail label="Outstanding" value={money(p.invoice.outstanding_amount, p.invoice.currency)} />
                          <Detail label="Invoice date" value={shortDate(p.invoice.invoice_date)} />
                          <Detail label="Due date" value={shortDate(p.invoice.due_date)} />
                          {p.invoice.purpose && <Detail label="Purpose" value={p.invoice.purpose} />}
                        </>
                      ) : <span style={{ color: '#94a3b8', fontSize: 12.5 }}>Not available</span>}
                    </DetailBlock>

                    <DetailBlock title="Reconciliation">
                      <Detail label="Status" value={<StatusPill map={RECONCILIATION_STATUS} value={p.reconciliation_status} />} />
                      <Detail label="Reconciled at" value={p.reconciled_at ? dateTime(p.reconciled_at) : '—'} />
                      <Detail label="Reconciled by" value={p.reconciled_by ?? '—'} />
                      <Detail label="Note" value={p.reconciliation_note ?? '—'} />
                      {p.comparison && (
                        <>
                          <Detail label="Covers invoice in full" value={p.comparison.covers_full_invoice ? 'Yes' : 'No'} />
                          <Detail label="Invoice settled" value={p.comparison.invoice_settled ? 'Yes' : 'No'} />
                          <Detail label="Currency matches" value={p.comparison.currency_matches ? 'Yes' : 'No'} />
                          {p.comparison.overpaid && <Detail label="Overpaid" value="Yes" />}
                        </>
                      )}
                    </DetailBlock>

                    <DetailBlock title="Related">
                      <Detail label="Client" value={p.related.client?.name ?? '—'} />
                      <Detail label="Client company" value={p.related.client?.company_name ?? '—'} />
                      <Detail label="Lead" value={p.related.lead?.name ?? '—'} />
                      <Detail label="Project" value={p.related.project?.name ?? '—'} />
                      {p.related.project && <Detail label="Project status" value={p.related.project.status} />}
                    </DetailBlock>
                  </div>
                </td>
              </tr>
            );
          }

          return rowsOut;
        })}
      </TableShell>

      <Pagination page={meta.current_page} lastPage={meta.last_page} total={meta.total} onChange={setPage} />

      {reconciling && (
        <ReconcileModal
          paymentId={reconciling.id}
          reference={reconciling.reference}
          viaPaymentDetails
          onClose={() => setReconciling(null)}
          onSaved={() => { setReconciling(null); load(); }}
        />
      )}
    </div>
  );
}

function DetailBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>{children}</div>
    </div>
  );
}

function Detail({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12.5 }}>
      <span style={{ color: '#94a3b8', flexShrink: 0 }}>{label}</span>
      <span style={{
        color: '#0f172a', textAlign: 'right', wordBreak: 'break-word',
        fontFamily: mono ? 'monospace' : 'inherit', fontSize: mono ? 11.5 : undefined,
      }}>{value}</span>
    </div>
  );
}

export default function FinancePaymentDetailsPage() {
  useAdminGuard();

  return (
    <FinanceShell title="Payment Details" requires="payment_details.view">
      <PaymentDetailsBody />
    </FinanceShell>
  );
}
