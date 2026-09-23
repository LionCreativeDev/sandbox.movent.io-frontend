'use client';
import React from 'react';

/**
 * The bits every Finance screen shares: money formatting, the status pills,
 * stat tiles, the filter bar chrome and the table shell.
 *
 * Styling follows the rest of this app rather than introducing anything new
 * — inline styles, the same slate palette, the same 12px radius cards and
 * 11px uppercase table headers used by app/payments/page.tsx and
 * app/invoices/page.tsx — so the Finance Area reads as part of the product
 * and not as a bolted-on module.
 */

/**
 * Money, always with its currency beside it.
 *
 * Two decimals, never rounded away: this is a finance screen and "1,200"
 * where the figure is 1,200.49 is simply a wrong number. Different from the
 * existing payments page (which rounds to whole units) on purpose.
 */
export const money = (n: number | null | undefined, currency?: string | null): string => {
  const value = Number(n ?? 0);
  return `${currency ?? ''} ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();
};

export const shortDate = (d: string | null | undefined): string =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export const dateTime = (d: string | null | undefined): string =>
  d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

type Pill = { bg: string; color: string; label: string };

// Invoice lifecycle — mirrors the labels used on the invoice list/detail.
export const INVOICE_STATUS: Record<string, Pill> = {
  draft:          { bg: '#f1f5f9', color: '#64748b', label: 'Draft' },
  sent:           { bg: '#eff6ff', color: '#2563eb', label: 'Sent' },
  partially_paid: { bg: '#fff7ed', color: '#ea580c', label: 'Partially Paid' },
  paid:           { bg: '#ecfdf5', color: '#059669', label: 'Paid' },
  overdue:        { bg: '#fef2f2', color: '#dc2626', label: 'Overdue' },
  cancelled:      { bg: '#f8fafc', color: '#94a3b8', label: 'Cancelled' },
};

// What the payment ATTEMPTS did — a separate axis from the lifecycle above.
// See App\Models\Invoice::paymentStatus() for why the two never merge.
export const PAYMENT_PROGRESS: Record<string, Pill> = {
  full_paid:      { bg: '#ecfdf5', color: '#059669', label: 'Paid in Full' },
  partially_paid: { bg: '#fff7ed', color: '#ea580c', label: 'Partially Paid' },
  pending:        { bg: '#fefce8', color: '#a16207', label: 'Pending' },
  overdue:        { bg: '#fef2f2', color: '#dc2626', label: 'Overdue' },
  failed:         { bg: '#fef2f2', color: '#dc2626', label: 'Failed' },
  refunded:       { bg: '#f5f3ff', color: '#7c3aed', label: 'Refunded' },
  draft:          { bg: '#f1f5f9', color: '#64748b', label: 'Draft' },
  cancelled:      { bg: '#f8fafc', color: '#94a3b8', label: 'Cancelled' },
};

export const PAYMENT_STATUS: Record<string, Pill> = {
  pending:   { bg: '#fefce8', color: '#a16207', label: 'Pending' },
  confirmed: { bg: '#ecfdf5', color: '#059669', label: 'Confirmed' },
  failed:    { bg: '#fef2f2', color: '#dc2626', label: 'Failed / Rejected' },
  refunded:  { bg: '#f5f3ff', color: '#7c3aed', label: 'Refunded' },
};

export const RECONCILIATION_STATUS: Record<string, Pill> = {
  unreconciled: { bg: '#f8fafc', color: '#64748b', label: 'Unreconciled' },
  reconciled:   { bg: '#ecfdf5', color: '#059669', label: 'Reconciled' },
  disputed:     { bg: '#fff7ed', color: '#c2410c', label: 'Disputed' },
};

export const METHOD_LABEL: Record<string, string> = {
  bank_transfer: 'Bank Transfer',
  cash:          'Cash',
  card:          'Card',
  cheque:        'Cheque',
  gateway:       'Online Gateway',
  unspecified:   'Unspecified',
};

export const REMINDER_STATUS: Record<string, Pill> = {
  scheduled: { bg: '#eff6ff', color: '#2563eb', label: 'Scheduled' },
  sent:      { bg: '#ecfdf5', color: '#059669', label: 'Sent' },
  failed:    { bg: '#fef2f2', color: '#dc2626', label: 'Failed' },
  cancelled: { bg: '#f8fafc', color: '#94a3b8', label: 'Cancelled' },
};

export function StatusPill({ map, value }: { map: Record<string, Pill>; value: string | null | undefined }) {
  if (!value) return <span style={{ color: '#94a3b8' }}>—</span>;
  const p = map[value] ?? { bg: '#f8fafc', color: '#64748b', label: value.replace(/_/g, ' ') };
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 50, fontSize: 11, fontWeight: 600,
      background: p.bg, color: p.color, whiteSpace: 'nowrap', textTransform: 'capitalize',
    }}>
      {p.label}
    </span>
  );
}

export function StatCard({
  label, value, sub, color = '#0f172a', accent,
}: { label: string; value: React.ReactNode; sub?: React.ReactNode; color?: string; accent?: string }) {
  return (
    <div style={{
      background: accent ?? '#fff',
      borderRadius: 12,
      border: `1px solid ${accent ? `${color}22` : '#f1f5f9'}`,
      padding: '16px 20px',
      minWidth: 0,
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: accent ? color : '#94a3b8',
        textTransform: 'uppercase', letterSpacing: '0.06em',
      }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color, marginTop: 4, lineHeight: 1.2, wordBreak: 'break-word' }}>{value}</div>
      {sub != null && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export function StatGrid({ children, min = 180 }: { children: React.ReactNode; min?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: 12 }}>
      {children}
    </div>
  );
}

export function Card({ title, action, children, padded = true }: {
  title?: string; action?: React.ReactNode; children: React.ReactNode; padded?: boolean;
}) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #f1f5f9', overflow: 'hidden' }}>
      {(title || action) && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderBottom: '1px solid #f8fafc', gap: 12, flexWrap: 'wrap',
        }}>
          {title && <h2 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: 0 }}>{title}</h2>}
          {action}
        </div>
      )}
      <div style={padded ? { padding: 20 } : undefined}>{children}</div>
    </div>
  );
}

export const inputStyle: React.CSSProperties = {
  padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: 7,
  fontSize: 13, outline: 'none', background: '#fafafa', color: '#0f172a',
  boxSizing: 'border-box', minWidth: 0,
};

export const buttonStyle = (variant: 'primary' | 'ghost' | 'subtle' = 'subtle'): React.CSSProperties => ({
  padding: '9px 18px', borderRadius: 7, fontSize: 13, fontWeight: 600,
  cursor: 'pointer', whiteSpace: 'nowrap',
  ...(variant === 'primary'
    ? { border: 'none', background: '#2563eb', color: '#fff' }
    : variant === 'ghost'
      ? { border: '1.5px solid #e2e8f0', background: '#fff', color: '#2563eb' }
      : { border: 'none', background: '#f1f5f9', color: '#475569' }),
});

export function TableShell({
  headers, empty, emptyIcon = '📄', loading, children, colCount,
}: {
  headers: string[];
  empty: string;
  emptyIcon?: string;
  loading: boolean;
  children: React.ReactNode;
  colCount: number;
}) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #f1f5f9', overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
              {headers.map((h, i) => (
                <th key={`${h}-${i}`} style={{
                  padding: '11px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700,
                  color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={colCount} style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>Loading…</td></tr>
            ) : React.Children.count(children) === 0 ? (
              <tr><td colSpan={colCount} style={{ padding: 56, textAlign: 'center', color: '#94a3b8' }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>{emptyIcon}</div>
                <div style={{ fontWeight: 600, color: '#64748b' }}>{empty}</div>
              </td></tr>
            ) : children}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const td: React.CSSProperties = { padding: '13px 14px', fontSize: 13, color: '#475569', verticalAlign: 'middle' };

export function Pagination({ page, lastPage, total, onChange }: {
  page: number; lastPage: number; total: number; onChange: (p: number) => void;
}) {
  if (lastPage <= 1) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 4px', gap: 12, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, color: '#94a3b8' }}>Page {page} of {lastPage} · {total} record{total === 1 ? '' : 's'}</span>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onChange(page - 1)} disabled={page <= 1} style={{ ...buttonStyle('ghost'), opacity: page <= 1 ? 0.45 : 1 }}>Previous</button>
        <button onClick={() => onChange(page + 1)} disabled={page >= lastPage} style={{ ...buttonStyle('ghost'), opacity: page >= lastPage ? 0.45 : 1 }}>Next</button>
      </div>
    </div>
  );
}

/**
 * The block shown instead of a screen the caller may not open.
 *
 * Says what is missing and who can grant it, rather than bouncing to the
 * dashboard — a silent redirect reads as a broken link, and the one thing
 * someone in this position needs to know is who to ask.
 */
export function NoAccess({ what }: { what: string }) {
  return (
    <div style={{ padding: '64px 24px', textAlign: 'center', color: '#94a3b8' }}>
      <div style={{ fontSize: 44, marginBottom: 12 }}>🔒</div>
      <div style={{ fontWeight: 700, color: '#64748b', marginBottom: 6, fontSize: 15 }}>No access to {what}</div>
      <div style={{ fontSize: 13, maxWidth: 420, margin: '0 auto', lineHeight: 1.6 }}>
        Ask your Company Admin to enable this Finance permission for your account.
      </div>
    </div>
  );
}
