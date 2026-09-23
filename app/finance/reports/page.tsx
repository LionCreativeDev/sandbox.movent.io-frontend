'use client';
import { useEffect, useMemo, useState } from 'react';
import FinanceShell, { useFinance } from '@/components/finance/FinanceShell';
import {
  Card, StatCard, StatGrid, StatusPill, TableShell, buttonStyle, inputStyle,
  money, td, INVOICE_STATUS, PAYMENT_STATUS, METHOD_LABEL,
} from '@/components/finance/shared';
import { financeService, FinanceReport, RevenueSummaryEntry, Breakdown, TopClient } from '@/lib/services/financeService';
import { FinanceCapabilityKey } from '@/lib/services/financeService';
import { useAdminGuard } from '@/hooks/useAdminGuard';
import { HiArrowDownTray } from 'react-icons/hi2';
import toast from 'react-hot-toast';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type Kind = 'finance' | 'revenue' | 'payments';

const TABS: { kind: Kind; label: string; view: FinanceCapabilityKey; exportKey: FinanceCapabilityKey }[] = [
  { kind: 'finance',  label: 'Finance',  view: 'reports.finance',  exportKey: 'reports.finance.export' },
  { kind: 'revenue',  label: 'Revenue',  view: 'reports.revenue',  exportKey: 'reports.revenue.export' },
  { kind: 'payments', label: 'Payments', view: 'reports.payments', exportKey: 'reports.payments.export' },
];

/**
 * Finance > Reports — Finance, Revenue and Payments.
 *
 * Three independently-granted reports behind one screen. The sub-tabs, the
 * Export buttons and the report itself are all driven by the server's
 * capability map, and each report's endpoint re-checks its own permission
 * (and, for export, both the view and export permissions).
 *
 * Everything is computed server-side from live invoice and payment rows and
 * grouped by currency rather than summed across currencies — see
 * App\Services\Finance\FinanceReportService for why.
 */
function ReportsBody() {
  const { can, companies } = useFinance();

  const available = useMemo(() => TABS.filter(t => can(t.view)), [can]);
  const [kind, setKind] = useState<Kind | null>(null);
  const [report, setReport] = useState<FinanceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [companyId, setCompanyId] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [from, setFrom] = useState('');
  const [to, setTo]     = useState('');
  const [currency, setCurrency] = useState('');

  // Land on the first report this caller may actually read — which of the
  // three that is depends entirely on their permissions.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (kind === null && available.length > 0) setKind(available[0].kind);
  }, [available, kind]);

  const filters = {
    company_id: companyId || undefined,
    year,
    from: from || undefined,
    to: to || undefined,
    currency: currency || undefined,
  };

  useEffect(() => {
    if (!kind) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    financeService.report(kind, filters)
      .then(d => setReport(d.report))
      .catch(() => toast.error('Failed to load this report'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, companyId, year, from, to, currency]);

  const doExport = async () => {
    if (!kind) return;
    setExporting(true);
    try { await financeService.exportReport(kind, filters); }
    catch { toast.error('Export failed'); }
    finally { setExporting(false); }
  };

  if (available.length === 0) return null;

  const activeTab = TABS.find(t => t.kind === kind);
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);
  const currencies = Array.from(new Set([
    ...(report?.invoices?.by_currency ?? []).map(c => c.currency),
    ...(report?.payments?.by_currency ?? []).map(c => c.currency),
  ]));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {available.map(t => (
            <button
              key={t.kind}
              onClick={() => setKind(t.kind)}
              style={{
                ...buttonStyle(kind === t.kind ? 'primary' : 'ghost'),
                padding: '8px 18px',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        {activeTab && can(activeTab.exportKey) && (
          <button onClick={doExport} disabled={exporting} style={{ ...buttonStyle('ghost'), opacity: exporting ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
            <HiArrowDownTray size={14} /> {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        )}
      </div>

      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #f1f5f9', padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {companies.length > 1 && (
            <select value={companyId} onChange={e => setCompanyId(e.target.value)} style={inputStyle}>
              <option value="">All companies</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <select value={year} onChange={e => setYear(Number(e.target.value))} style={inputStyle} title="Year for the monthly trend">
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {currencies.length > 1 && (
            <select value={currency} onChange={e => setCurrency(e.target.value)} style={inputStyle}>
              <option value="">All currencies</option>
              {currencies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={inputStyle} title="From" />
          <span style={{ color: '#94a3b8', fontSize: 13 }}>to</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} style={inputStyle} title="To" />
          {(companyId || from || to || currency) && (
            <button onClick={() => { setCompanyId(''); setFrom(''); setTo(''); setCurrency(''); }} style={buttonStyle('ghost')}>Clear</button>
          )}
          {loading && <span style={{ fontSize: 12, color: '#94a3b8' }}>Loading…</span>}
        </div>
      </div>

      {!report ? (
        <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>Loading report…</div>
      ) : (
        <>
          {kind === 'finance'  && <FinanceReportView report={report} />}
          {kind === 'revenue'  && <RevenueReportView report={report} />}
          {kind === 'payments' && <PaymentsReportView report={report} />}

          <MonthlyTrendCard report={report} />

          <div style={{ fontSize: 11, color: '#cbd5e1', textAlign: 'right' }}>
            Live data · generated {new Date(report.generated_at).toLocaleString('en-GB')}
          </div>
        </>
      )}
    </div>
  );
}

function FinanceReportView({ report }: { report: FinanceReport }) {
  const inv = report.invoices;
  const pay = report.payments;
  if (!inv) return null;

  return (
    <>
      <StatGrid>
        <StatCard label="Invoices" value={inv.counts.total} sub={`${inv.counts.draft} draft`} />
        <StatCard label="Paid" value={inv.counts.paid} color="#059669" accent="#ecfdf5" />
        <StatCard label="Pending" value={inv.counts.pending} color="#a16207" accent="#fefce8" />
        <StatCard label="Overdue" value={inv.counts.overdue} color="#dc2626" accent="#fef2f2" />
        <StatCard label="Cancelled" value={inv.counts.cancelled} color="#94a3b8" />
      </StatGrid>

      {inv.by_currency.map(c => (
        <Card key={c.currency} title={`Totals — ${c.currency}`}>
          <StatGrid min={190}>
            <StatCard label="Invoice Total" value={money(c.total_invoiced, c.currency)} sub={`${c.invoice_count} invoices`} />
            <StatCard label="Paid Amount" value={money(c.total_paid, c.currency)} color="#059669" />
            <StatCard label="Outstanding" value={money(c.total_outstanding, c.currency)} color="#ea580c" />
            <StatCard label="Overdue Amount" value={money(c.overdue_amount, c.currency)} color="#dc2626" />
            {(() => {
              const received = pay?.by_currency.find(p => p.currency === c.currency);
              return <StatCard label="Payments Received" value={money(received?.total_received ?? 0, c.currency)} color="#2563eb" sub={`${received?.count ?? 0} payments`} />;
            })()}
          </StatGrid>
        </Card>
      ))}

      <Card title="Invoices by Status" padded={false}>
        <TableShell headers={['Status', 'Count', 'Amount']} colCount={3} loading={false} empty="No invoices">
          {inv.by_status.map(s => (
            <tr key={s.status} style={{ borderBottom: '1px solid #f8fafc' }}>
              <td style={td}><StatusPill map={INVOICE_STATUS} value={s.status} /></td>
              <td style={td}>{s.count}</td>
              <td style={td}>{s.by_currency.map(c => <div key={c.currency}>{money(c.amount, c.currency)}</div>)}</td>
            </tr>
          ))}
        </TableShell>
      </Card>

      {report.top_clients && report.top_clients.length > 0 && <TopClientsCard clients={report.top_clients} metric="outstanding" />}
    </>
  );
}

function RevenueReportView({ report }: { report: FinanceReport }) {
  const summary = (Array.isArray(report.summary) ? report.summary : []) as RevenueSummaryEntry[];

  return (
    <>
      {summary.length === 0 ? (
        <Card title="Revenue Summary"><div style={{ color: '#94a3b8', fontSize: 13 }}>No payments received for this selection.</div></Card>
      ) : summary.map(s => (
        <Card key={s.currency} title={`Revenue — ${s.currency}`}>
          <StatGrid min={190}>
            <StatCard label="Revenue Received" value={money(s.revenue, s.currency)} color="#059669" sub={`${s.payment_count} payments`} />
            <StatCard label="Total Invoiced" value={money(s.invoiced, s.currency)} />
            <StatCard
              label="Collection Rate"
              value={`${s.collection_rate}%`}
              color={s.collection_rate >= 80 ? '#059669' : s.collection_rate >= 50 ? '#ea580c' : '#dc2626'}
              sub="of everything invoiced"
            />
            <StatCard label="Still Outstanding" value={money(Math.max(0, s.invoiced - s.revenue), s.currency)} color="#ea580c" />
          </StatGrid>
        </Card>
      ))}

      {report.by_method && <BreakdownCard title="Revenue by Payment Method" rows={report.by_method} labels={METHOD_LABEL} />}
      {report.by_gateway && report.by_gateway.length > 0 && <BreakdownCard title="Revenue by Gateway" rows={report.by_gateway} />}
      {report.by_client && report.by_client.length > 0 && <TopClientsCard clients={report.by_client} metric="revenue" />}
    </>
  );
}

function PaymentsReportView({ report }: { report: FinanceReport }) {
  const summary = report.summary as { total_count: number; by_status: { status: string; count: number; by_currency: { currency: string; amount: number }[] }[] } | undefined;
  const rec = report.reconciliation;

  return (
    <>
      <StatGrid>
        <StatCard label="Total Payments" value={summary?.total_count ?? 0} />
        {summary?.by_status.map(s => (
          <StatCard
            key={s.status}
            label={PAYMENT_STATUS[s.status]?.label ?? s.status}
            value={s.count}
            color={s.status === 'confirmed' ? '#059669' : s.status === 'failed' ? '#dc2626' : s.status === 'refunded' ? '#7c3aed' : '#a16207'}
            sub={s.by_currency.map(c => money(c.amount, c.currency)).join(' · ') || undefined}
          />
        ))}
      </StatGrid>

      {rec && (
        <Card title="Reconciliation">
          <StatGrid min={190}>
            <StatCard label="Reconciled" value={rec.reconciled} color="#059669" accent="#ecfdf5" />
            <StatCard label="Unreconciled" value={rec.unreconciled} color="#64748b" />
            <StatCard label="Disputed" value={rec.disputed} color="#c2410c" accent="#fff7ed" />
            <StatCard
              label="Awaiting Sign-off"
              value={rec.pending_amount_by_currency.length === 0
                ? money(0)
                : rec.pending_amount_by_currency.map(c => money(c.amount, c.currency)).join(' · ')}
              color="#7c3aed"
              sub="received but not yet reconciled"
            />
          </StatGrid>
        </Card>
      )}

      {report.by_method && <BreakdownCard title="Payments by Method" rows={report.by_method} labels={METHOD_LABEL} />}
      {report.by_gateway && report.by_gateway.length > 0 && <BreakdownCard title="Payments by Gateway" rows={report.by_gateway} />}
    </>
  );
}

function BreakdownCard({ title, rows, labels }: { title: string; rows: Breakdown[]; labels?: Record<string, string> }) {
  return (
    <Card title={title} padded={false}>
      <TableShell headers={['', 'Payments', 'Amount']} colCount={3} loading={false} empty="Nothing recorded yet" emptyIcon="💳">
        {rows.map(r => (
          <tr key={r.key} style={{ borderBottom: '1px solid #f8fafc' }}>
            <td style={{ ...td, fontWeight: 600, color: '#0f172a', textTransform: 'capitalize' }}>
              {labels?.[r.key] ?? r.key.replace(/_/g, ' ')}
            </td>
            <td style={td}>{r.count}</td>
            <td style={td}>{r.by_currency.map(c => <div key={c.currency}>{money(c.amount, c.currency)}</div>)}</td>
          </tr>
        ))}
      </TableShell>
    </Card>
  );
}

function TopClientsCard({ clients, metric }: { clients: TopClient[]; metric: 'outstanding' | 'revenue' }) {
  return (
    <Card title={metric === 'revenue' ? 'Revenue by Client' : 'Top Clients'} padded={false}>
      <TableShell
        headers={['Client', metric === 'revenue' ? 'Payments' : 'Invoices', metric === 'revenue' ? 'Revenue' : 'Outstanding']}
        colCount={3}
        loading={false}
        empty="No client data"
        emptyIcon="👥"
      >
        {clients.map(c => (
          <tr key={c.client_id} style={{ borderBottom: '1px solid #f8fafc' }}>
            <td style={td}>
              <div style={{ fontWeight: 600, color: '#0f172a' }}>{c.name}</div>
              {c.company && <div style={{ fontSize: 11, color: '#94a3b8' }}>{c.company}</div>}
            </td>
            <td style={td}>{c.count}</td>
            <td style={td}>
              {c.by_currency.map(cur => (
                <div key={cur.currency} style={{ fontWeight: 600, color: metric === 'revenue' ? '#059669' : '#ea580c' }}>
                  {money(metric === 'revenue' ? (cur.revenue ?? 0) : (cur.outstanding ?? 0), cur.currency)}
                </div>
              ))}
            </td>
          </tr>
        ))}
      </TableShell>
    </Card>
  );
}

function MonthlyTrendCard({ report }: { report: FinanceReport }) {
  const trend = report.monthly;
  if (!trend) return null;

  const currencies = Array.from(new Set(trend.months.flatMap(m => m.by_currency.map(c => c.currency))));
  if (currencies.length === 0) {
    return <Card title={`Monthly Breakdown — ${trend.year}`}><div style={{ color: '#94a3b8', fontSize: 13 }}>Nothing invoiced or received in {trend.year}.</div></Card>;
  }

  return (
    <Card title={`Monthly Breakdown — ${trend.year}`} padded={false}>
      {currencies.map(cur => (
        <div key={cur}>
          {currencies.length > 1 && (
            <div style={{ padding: '10px 20px 0', fontSize: 12, fontWeight: 700, color: '#64748b' }}>{cur}</div>
          )}
          <TableShell headers={['Month', 'Invoiced', 'Received', 'Collected']} colCount={4} loading={false} empty="No activity">
            {trend.months.map((m, i) => {
              const e = m.by_currency.find(c => c.currency === cur);
              if (!e || (e.invoiced === 0 && e.received === 0)) return null;
              const rate = e.invoiced > 0 ? Math.round((e.received / e.invoiced) * 100) : null;
              return (
                <tr key={`${cur}-${m.month}`} style={{ borderBottom: '1px solid #f8fafc' }}>
                  <td style={{ ...td, fontWeight: 600, color: '#0f172a' }}>{MONTHS[i]}</td>
                  <td style={td}>{money(e.invoiced, cur)}</td>
                  <td style={{ ...td, color: '#059669', fontWeight: 600 }}>{money(e.received, cur)}</td>
                  <td style={td}>{rate === null ? '—' : `${rate}%`}</td>
                </tr>
              );
            }).filter(Boolean)}
          </TableShell>
        </div>
      ))}
    </Card>
  );
}

export default function FinanceReportsPage() {
  useAdminGuard();

  return (
    <FinanceShell
      title="Finance Reports"
      requiresAny={['reports.finance', 'reports.revenue', 'reports.payments']}
    >
      <ReportsBody />
    </FinanceShell>
  );
}
