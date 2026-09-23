'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import FinanceShell, { useFinance } from '@/components/finance/FinanceShell';
import {
  Card, StatCard, StatGrid, StatusPill, TableShell, money, shortDate, td,
  INVOICE_STATUS, PAYMENT_PROGRESS, PAYMENT_STATUS, RECONCILIATION_STATUS, METHOD_LABEL,
  inputStyle,
} from '@/components/finance/shared';
import { financeService, FinanceDashboard } from '@/lib/services/financeService';
import toast from 'react-hot-toast';
import { useAdminGuard } from '@/hooks/useAdminGuard';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Finance > Dashboard. Read-only: there is no action on this screen at all,
 * which is what the Finance Dashboard permission being view-only means.
 *
 * Every figure comes from GET /finance/dashboard, computed server-side from
 * live invoice and payment rows. Nothing is hardcoded — a company with no
 * invoices sees zeros and empty panels, which is the truthful state.
 */
function DashboardBody() {
  const { companies, root, can } = useFinance();
  const [data, setData]       = useState<FinanceDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    // The "refreshing" flag for a filter change — this IS the effect telling
    // the UI a fetch started, so the rule is suppressed here the same way the
    // rest of this codebase suppresses it for a load-on-mount effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    financeService.dashboard({ company_id: companyId || undefined, year })
      .then(d => setData(d.dashboard))
      .catch(() => toast.error('Failed to load the finance dashboard'))
      .finally(() => setLoading(false));
  }, [companyId, year]);

  if (loading && !data) {
    return <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>Loading finance overview…</div>;
  }
  if (!data) return null;

  const { overview, payments, revenue_trend: trend } = data;
  // The dashboard reports each currency as its own group and never sums
  // across them — see the note in App\Services\Finance\FinanceReportService.
  const currencies = overview.by_currency;
  const trendCurrencies = Array.from(new Set(trend.months.flatMap(m => m.by_currency.map(c => c.currency))));
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Filters. The company picker only ever lists companies the server
          already put in scope, so it can narrow the view but never widen it. */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {companies.length > 1 && (
          <select value={companyId} onChange={e => setCompanyId(e.target.value)} style={inputStyle}>
            <option value="">All my companies</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        <select value={year} onChange={e => setYear(Number(e.target.value))} style={inputStyle}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        {loading && <span style={{ fontSize: 12, color: '#94a3b8' }}>Refreshing…</span>}
      </div>

      {/* Invoice counts — unitless, so reported flat rather than per currency. */}
      <StatGrid>
        <StatCard label="Total Invoices" value={overview.counts.total} sub={`${overview.counts.draft} draft`} />
        <StatCard label="Paid" value={overview.counts.paid} color="#059669" accent="#ecfdf5" />
        <StatCard label="Pending" value={overview.counts.pending} color="#a16207" accent="#fefce8" />
        <StatCard label="Overdue" value={overview.counts.overdue} color="#dc2626" accent="#fef2f2" />
        <StatCard label="Payments Received" value={payments.counts.confirmed} sub={`${payments.counts.pending} awaiting confirmation`} color="#2563eb" />
        <StatCard
          label="Awaiting Reconciliation"
          value={payments.counts.unreconciled}
          sub={payments.counts.disputed > 0 ? `${payments.counts.disputed} disputed` : undefined}
          color="#7c3aed"
        />
      </StatGrid>

      {/* Money, grouped by currency. */}
      {currencies.length === 0 ? (
        <Card title="Finance Overview">
          <div style={{ color: '#94a3b8', fontSize: 13 }}>No invoices yet for this selection.</div>
        </Card>
      ) : currencies.map(c => (
        <Card key={c.currency} title={currencies.length > 1 ? `Finance Overview — ${c.currency}` : 'Finance Overview'}>
          <StatGrid min={200}>
            <StatCard label="Total Invoiced" value={money(c.total_invoiced, c.currency)} sub={`${c.invoice_count} invoices`} />
            <StatCard label="Total Paid" value={money(c.total_paid, c.currency)} color="#059669" />
            <StatCard label="Outstanding" value={money(c.total_outstanding, c.currency)} color="#ea580c" />
            <StatCard label="Overdue" value={money(c.overdue_amount, c.currency)} color="#dc2626" />
            {(() => {
              const received = payments.by_currency.find(p => p.currency === c.currency);
              return (
                <StatCard
                  label="Payments Received"
                  value={money(received?.total_received ?? 0, c.currency)}
                  sub={`${received?.count ?? 0} payments`}
                  color="#2563eb"
                />
              );
            })()}
          </StatGrid>
        </Card>
      ))}

      {/* Invoiced vs received, month by month. A plain bar pair rather than a
          charting dependency — this app ships none, and adding one for six
          bars would be the wrong trade. */}
      <Card title={`Payment & Revenue Overview — ${trend.year}`}>
        {trendCurrencies.length === 0 ? (
          <div style={{ color: '#94a3b8', fontSize: 13 }}>Nothing invoiced or received in {trend.year}.</div>
        ) : trendCurrencies.map(cur => {
          const series = trend.months.map(m => m.by_currency.find(c => c.currency === cur) ?? { currency: cur, invoiced: 0, received: 0 });
          const peak = Math.max(1, ...series.map(s => Math.max(s.invoiced, s.received)));
          return (
            <div key={cur} style={{ marginBottom: 18 }}>
              {trendCurrencies.length > 1 && (
                <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 10 }}>{cur}</div>
              )}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 150, overflowX: 'auto' }}>
                {series.map((s, i) => (
                  <div key={i} style={{ flex: '1 0 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div
                      style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 110 }}
                      title={`${MONTHS[i]}: invoiced ${money(s.invoiced, cur)}, received ${money(s.received, cur)}`}
                    >
                      <div style={{ width: 12, height: `${(s.invoiced / peak) * 100}%`, background: '#bfdbfe', borderRadius: '3px 3px 0 0', minHeight: s.invoiced > 0 ? 3 : 0 }} />
                      <div style={{ width: 12, height: `${(s.received / peak) * 100}%`, background: '#059669', borderRadius: '3px 3px 0 0', minHeight: s.received > 0 ? 3 : 0 }} />
                    </div>
                    <span style={{ fontSize: 10, color: '#94a3b8' }}>{MONTHS[i]}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        <div style={{ display: 'flex', gap: 16, fontSize: 11, color: '#64748b', marginTop: 4 }}>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#bfdbfe', borderRadius: 2, marginRight: 5 }} />Invoiced</span>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#059669', borderRadius: 2, marginRight: 5 }} />Received</span>
        </div>
      </Card>

      {/* Recent activity. Links only appear where the caller can actually
          open the target — Invoices/Payments each need their own view right. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 20 }}>
        <Card
          title="Recent Invoices"
          padded={false}
          action={can('invoices.view') ? <Link href={`${root}/invoices`} style={{ fontSize: 12, color: '#2563eb', fontWeight: 600 }}>View all →</Link> : undefined}
        >
          <TableShell
            headers={['Invoice', 'Customer', 'Amount', 'Outstanding', 'Status']}
            colCount={5}
            loading={false}
            empty="No invoices yet"
            emptyIcon="🧾"
          >
            {data.recent_invoices.map(inv => (
              <tr key={inv.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                <td style={td}>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{inv.invoice_number}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{shortDate(inv.invoice_date)}</div>
                </td>
                <td style={td}>{inv.customer_name}</td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>{money(inv.total_amount, inv.currency)}</td>
                <td style={{ ...td, whiteSpace: 'nowrap', color: inv.outstanding_amount > 0 ? '#ea580c' : '#059669', fontWeight: 600 }}>
                  {money(inv.outstanding_amount, inv.currency)}
                </td>
                <td style={td}><StatusPill map={PAYMENT_PROGRESS} value={inv.payment_status} /></td>
              </tr>
            ))}
          </TableShell>
        </Card>

        <Card
          title="Recent Payments"
          padded={false}
          action={can('payments.view') ? <Link href={`${root}/payments`} style={{ fontSize: 12, color: '#2563eb', fontWeight: 600 }}>View all →</Link> : undefined}
        >
          <TableShell
            headers={['Reference', 'Invoice', 'Amount', 'Status', 'Reconciliation']}
            colCount={5}
            loading={false}
            empty="No payments yet"
            emptyIcon="💳"
          >
            {data.recent_payments.map(p => (
              <tr key={p.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                <td style={td}>
                  <div style={{ fontWeight: 700, color: '#0f172a' }}>{p.reference}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{shortDate(p.payment_date)}</div>
                </td>
                <td style={td}>{p.invoice_number ?? '—'}</td>
                <td style={{ ...td, whiteSpace: 'nowrap', fontWeight: 600, color: '#059669' }}>{money(p.amount, p.currency)}</td>
                <td style={td}><StatusPill map={PAYMENT_STATUS} value={p.status} /></td>
                <td style={td}><StatusPill map={RECONCILIATION_STATUS} value={p.reconciliation_status} /></td>
              </tr>
            ))}
          </TableShell>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 20 }}>
        <Card title="Payment Methods" padded={false}>
          <TableShell headers={['Method', 'Payments', 'Received']} colCount={3} loading={false} empty="No payments received yet" emptyIcon="💳">
            {payments.by_method.map(m => (
              <tr key={m.key} style={{ borderBottom: '1px solid #f8fafc' }}>
                <td style={{ ...td, fontWeight: 600, color: '#0f172a' }}>{METHOD_LABEL[m.key] ?? m.key}</td>
                <td style={td}>{m.count}</td>
                <td style={td}>
                  {m.by_currency.map(c => <div key={c.currency}>{money(c.amount, c.currency)}</div>)}
                </td>
              </tr>
            ))}
          </TableShell>
        </Card>

        <Card title="Top Clients by Invoice Volume" padded={false}>
          <TableShell headers={['Client', 'Invoices', 'Outstanding']} colCount={3} loading={false} empty="No client invoices yet" emptyIcon="👥">
            {data.top_clients.map(c => (
              <tr key={c.client_id} style={{ borderBottom: '1px solid #f8fafc' }}>
                <td style={td}>
                  <div style={{ fontWeight: 600, color: '#0f172a' }}>{c.name}</div>
                  {c.company && <div style={{ fontSize: 11, color: '#94a3b8' }}>{c.company}</div>}
                </td>
                <td style={td}>{c.count}</td>
                <td style={td}>
                  {c.by_currency.map(cur => (
                    <div key={cur.currency} style={{ color: (cur.outstanding ?? 0) > 0 ? '#ea580c' : '#059669', fontWeight: 600 }}>
                      {money(cur.outstanding ?? 0, cur.currency)}
                    </div>
                  ))}
                </td>
              </tr>
            ))}
          </TableShell>
        </Card>
      </div>

      {/* Invoice status breakdown — counts include cancelled invoices, which
          the money figures above deliberately exclude as void. */}
      <Card title="Invoices by Status">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {overview.by_status.map(s => (
            <div key={s.status} style={{ padding: '10px 16px', background: '#f8fafc', borderRadius: 10, minWidth: 140 }}>
              <StatusPill map={INVOICE_STATUS} value={s.status} />
              <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginTop: 6 }}>{s.count}</div>
              {s.by_currency.map(c => (
                <div key={c.currency} style={{ fontSize: 11, color: '#94a3b8' }}>{money(c.amount, c.currency)}</div>
              ))}
            </div>
          ))}
        </div>
      </Card>

      <div style={{ fontSize: 11, color: '#cbd5e1', textAlign: 'right' }}>
        Live data · generated {new Date(data.generated_at).toLocaleString('en-GB')}
      </div>
    </div>
  );
}

export default function FinanceDashboardPage() {
  useAdminGuard();

  return (
    <FinanceShell title="Finance Dashboard" requires="dashboard.view">
      <DashboardBody />
    </FinanceShell>
  );
}
