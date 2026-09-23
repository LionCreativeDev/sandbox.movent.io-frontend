'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import FinanceShell, { useFinance } from '@/components/finance/FinanceShell';
import {
  Pagination, StatusPill, TableShell, buttonStyle, inputStyle, money, shortDate, td,
  INVOICE_STATUS, PAYMENT_PROGRESS,
} from '@/components/finance/shared';
import { financeService, FinanceInvoiceRow } from '@/lib/services/financeService';
import { useAdminGuard } from '@/hooks/useAdminGuard';
import { HiMagnifyingGlass, HiArrowDownTray, HiPlus, HiPencilSquare, HiEye } from 'react-icons/hi2';
import toast from 'react-hot-toast';

const STATUSES = ['draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled'];

/**
 * Finance > Invoices.
 *
 * Lists the same invoices the Invoice module manages — there is no second
 * invoice store — with the columns a finance person needs. Create and Edit
 * hand off to the existing invoice screens (/invoices/new,
 * /invoices/{id}/edit) rather than duplicating that form: those endpoints
 * now accept the Finance permissions alongside the Invoice ones, so a
 * Finance user reaches the ordinary flow.
 *
 * Buttons are rendered from the server's capability map. Hiding them is a
 * courtesy, not the control — every endpoint behind them re-checks.
 */
function InvoicesBody() {
  const { can, companies, invoiceRoot } = useFinance();

  const [rows, setRows]       = useState<FinanceInvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage]       = useState(1);
  const [meta, setMeta]       = useState({ current_page: 1, last_page: 1, per_page: 25, total: 0 });

  const [search, setSearch]       = useState('');
  const [appliedSearch, setApplied] = useState('');
  const [status, setStatus]       = useState('');
  const [companyId, setCompanyId] = useState('');
  const [currency, setCurrency]   = useState('');
  const [from, setFrom]           = useState('');
  const [to, setTo]               = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [currencies, setCurrencies]   = useState<string[]>([]);
  const [exporting, setExporting]     = useState(false);

  const filters = {
    search: appliedSearch || undefined,
    status: status || undefined,
    company_id: companyId || undefined,
    currency: currency || undefined,
    from: from || undefined,
    to: to || undefined,
    overdue_only: overdueOnly || undefined,
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    financeService.invoices({ ...filters, page })
      .then(d => {
        setRows(d.invoices);
        setMeta(d.meta);
        setCurrencies((d.filters?.currencies as string[]) ?? []);
      })
      .catch(() => toast.error('Failed to load invoices'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedSearch, status, companyId, currency, from, to, overdueOnly, page]);

  const applyFilter = (fn: () => void) => { fn(); setPage(1); };

  const doExport = async () => {
    setExporting(true);
    try {
      // Exports exactly what is on screen — same filters go to the server,
      // which re-applies the same scope.
      await financeService.exportInvoices(filters);
    } catch {
      toast.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const clearAll = () => applyFilter(() => {
    setSearch(''); setApplied(''); setStatus(''); setCompanyId('');
    setCurrency(''); setFrom(''); setTo(''); setOverdueOnly(false);
  });

  const hasFilters = !!(appliedSearch || status || companyId || currency || from || to || overdueOnly);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: 0 }}>Invoices</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {can('invoices.export') && (
            <button onClick={doExport} disabled={exporting} style={{ ...buttonStyle('ghost'), opacity: exporting ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
              <HiArrowDownTray size={14} /> {exporting ? 'Exporting…' : 'Export CSV'}
            </button>
          )}
          {can('invoices.create') && (
            <Link href={`${invoiceRoot}/new`} style={{ ...buttonStyle('primary'), display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
              <HiPlus size={14} /> Create Invoice
            </Link>
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
              placeholder="Search invoice # or customer…"
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
            <option value="">All statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{INVOICE_STATUS[s]?.label ?? s}</option>)}
          </select>
          {currencies.length > 1 && (
            <select value={currency} onChange={e => applyFilter(() => setCurrency(e.target.value))} style={inputStyle}>
              <option value="">All currencies</option>
              {currencies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          <input type="date" value={from} onChange={e => applyFilter(() => setFrom(e.target.value))} style={inputStyle} title="Invoiced from" />
          <span style={{ color: '#94a3b8', fontSize: 13 }}>to</span>
          <input type="date" value={to} onChange={e => applyFilter(() => setTo(e.target.value))} style={inputStyle} title="Invoiced to" />
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#475569', cursor: 'pointer' }}>
            <input type="checkbox" checked={overdueOnly} onChange={e => applyFilter(() => setOverdueOnly(e.target.checked))} />
            Overdue only
          </label>
          <button type="submit" style={buttonStyle()}>Search</button>
          {hasFilters && <button type="button" onClick={clearAll} style={buttonStyle('ghost')}>Clear</button>}
        </div>
      </form>

      <TableShell
        headers={[
          'Invoice #', 'Customer', 'Company', 'Invoice Date', 'Due Date',
          'Amount', 'Paid', 'Outstanding', 'Status', 'Payment', 'Created By', '',
        ]}
        colCount={12}
        loading={loading}
        empty={hasFilters ? 'No invoices match these filters' : 'No invoices yet'}
        emptyIcon="🧾"
      >
        {rows.map(inv => (
          <tr key={inv.id} style={{ borderBottom: '1px solid #f8fafc' }}>
            <td style={{ ...td, whiteSpace: 'nowrap' }}>
              <span style={{ fontWeight: 700, color: '#0f172a' }}>{inv.invoice_number}</span>
            </td>
            <td style={td}>
              <div style={{ color: '#0f172a' }}>{inv.customer_name}</div>
              {inv.customer_company && <div style={{ fontSize: 11, color: '#94a3b8' }}>{inv.customer_company}</div>}
            </td>
            <td style={{ ...td, fontSize: 12 }}>{inv.company_name ?? '—'}</td>
            <td style={{ ...td, whiteSpace: 'nowrap', fontSize: 12 }}>{shortDate(inv.invoice_date)}</td>
            <td style={{ ...td, whiteSpace: 'nowrap', fontSize: 12, color: inv.is_overdue ? '#dc2626' : '#475569', fontWeight: inv.is_overdue ? 700 : 400 }}>
              {shortDate(inv.due_date)}
            </td>
            <td style={{ ...td, whiteSpace: 'nowrap', fontWeight: 600, color: '#0f172a' }}>{money(inv.total_amount, inv.currency)}</td>
            <td style={{ ...td, whiteSpace: 'nowrap', color: '#059669' }}>{money(inv.paid_amount, inv.currency)}</td>
            <td style={{ ...td, whiteSpace: 'nowrap', fontWeight: 700, color: inv.outstanding_amount > 0 ? '#ea580c' : '#059669' }}>
              {money(inv.outstanding_amount, inv.currency)}
            </td>
            <td style={td}><StatusPill map={INVOICE_STATUS} value={inv.status} /></td>
            <td style={td}><StatusPill map={PAYMENT_PROGRESS} value={inv.payment_status} /></td>
            <td style={{ ...td, fontSize: 12 }}>{inv.created_by ?? '—'}</td>
            <td style={td}>
              <div style={{ display: 'flex', gap: 6 }}>
                {/* The shared invoice detail screen — same page the Invoice
                    module links to, so there is one invoice view in the app. */}
                <Link href={`${invoiceRoot}/${inv.id}`} title="View invoice" style={{ ...buttonStyle('ghost'), padding: '5px 8px', display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
                  <HiEye size={14} />
                </Link>
                {can('invoices.update') && !['paid', 'cancelled'].includes(inv.status) && (
                  <Link href={`${invoiceRoot}/${inv.id}/edit`} title="Edit invoice" style={{ ...buttonStyle('ghost'), padding: '5px 8px', display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
                    <HiPencilSquare size={14} />
                  </Link>
                )}
              </div>
            </td>
          </tr>
        ))}
      </TableShell>

      <Pagination page={meta.current_page} lastPage={meta.last_page} total={meta.total} onChange={setPage} />

      {!can('invoices.export') && (
        <div style={{ fontSize: 11, color: '#cbd5e1' }}>
          Export is available to accounts granted the Finance → Invoices → Export permission.
        </div>
      )}
    </div>
  );
}

export default function FinanceInvoicesPage() {
  useAdminGuard();

  return (
    <FinanceShell title="Finance Invoices" requires="invoices.view">
      <InvoicesBody />
    </FinanceShell>
  );
}
