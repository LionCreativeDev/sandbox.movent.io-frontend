import React from 'react';
export { fmtDate } from '@/lib/date';

export const inp: React.CSSProperties = {
  padding: '9px 12px', border: '1px solid #e2e8f0', borderRadius: 8,
  fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box', background: '#fff',
};
export const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 };
export const card: React.CSSProperties = { background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '24px 28px', marginBottom: 20 };

// Compliance case statuses — see App\Models\ComplianceCase.
export const CASE_STATUS_SC: Record<string, { bg: string; color: string }> = {
  not_started:  { bg: '#f1f5f9', color: '#64748b' },
  pending:      { bg: '#fffbeb', color: '#b45309' },
  under_review: { bg: '#eff6ff', color: '#2563eb' },
  compliant:    { bg: '#ecfdf5', color: '#059669' },
  on_hold:      { bg: '#fff7ed', color: '#ea580c' },
  rejected:     { bg: '#fef2f2', color: '#dc2626' },
};

// Compliance document statuses — see App\Models\ComplianceDocument.
export const DOCUMENT_STATUS_SC: Record<string, { bg: string; color: string }> = {
  pending_review:         { bg: '#fffbeb', color: '#b45309' },
  approved:                { bg: '#ecfdf5', color: '#059669' },
  rejected:                { bg: '#fef2f2', color: '#dc2626' },
  resubmission_requested:  { bg: '#eff6ff', color: '#2563eb' },
  expired:                 { bg: '#f1f5f9', color: '#64748b' },
};

// Compliance requirement statuses — a superset of the document statuses
// above plus 'submitted'/'waived', so this gets its own map rather than
// reusing DOCUMENT_STATUS_SC.
export const REQUIREMENT_STATUS_SC: Record<string, { bg: string; color: string }> = {
  pending:                 { bg: '#f1f5f9', color: '#64748b' },
  submitted:               { bg: '#fffbeb', color: '#b45309' },
  under_review:            { bg: '#eff6ff', color: '#2563eb' },
  approved:                { bg: '#ecfdf5', color: '#059669' },
  rejected:                { bg: '#fef2f2', color: '#dc2626' },
  resubmission_requested:  { bg: '#eff6ff', color: '#2563eb' },
  expired:                 { bg: '#f1f5f9', color: '#64748b' },
  waived:                  { bg: '#f5f3ff', color: '#7c3aed' },
};

// Task statuses — see App\Models\Task::ALL_STATUSES. Local copy (not
// imported from components/admin/projects/shared.tsx) — this feature's
// read-only Task Status card only needs the color map, not the rest of
// that file's full task-management UI.
export const TASK_SC: Record<string, { bg: string; color: string }> = {
  todo:                    { bg: '#f1f5f9', color: '#64748b' },
  in_progress:             { bg: '#eff6ff', color: '#2563eb' },
  blocked:                 { bg: '#fef2f2', color: '#dc2626' },
  ready_for_production:    { bg: '#fffbeb', color: '#b45309' },
  in_production:           { bg: '#eff6ff', color: '#2563eb' },
  review:                  { bg: '#f5f3ff', color: '#7c3aed' },
  completed:               { bg: '#ecfdf5', color: '#059669' },
  cancelled:               { bg: '#f1f5f9', color: '#64748b' },
};

// Deliverable statuses — see App\Models\Deliverable. Same local-copy
// rationale as TASK_SC above.
export const DELIVERABLE_SC: Record<string, { bg: string; color: string }> = {
  draft:                { bg: '#f1f5f9', color: '#64748b' },
  submitted:            { bg: '#fffbeb', color: '#b45309' },
  delivered:            { bg: '#eff6ff', color: '#2563eb' },
  approved:             { bg: '#ecfdf5', color: '#059669' },
  revision_requested:   { bg: '#fff7ed', color: '#ea580c' },
  rejected:             { bg: '#fef2f2', color: '#dc2626' },
};

// Invoice statuses — see invoices.status enum.
export const INVOICE_SC: Record<string, { bg: string; color: string }> = {
  draft:            { bg: '#f1f5f9', color: '#64748b' },
  sent:             { bg: '#eff6ff', color: '#2563eb' },
  partially_paid:   { bg: '#fffbeb', color: '#b45309' },
  paid:             { bg: '#ecfdf5', color: '#059669' },
  overdue:          { bg: '#fef2f2', color: '#dc2626' },
  cancelled:        { bg: '#f1f5f9', color: '#64748b' },
};

// Lead statuses — see leads.status enum.
export const LEAD_SC: Record<string, { bg: string; color: string }> = {
  new:          { bg: '#f1f5f9', color: '#64748b' },
  contacted:    { bg: '#eff6ff', color: '#2563eb' },
  qualified:    { bg: '#f5f3ff', color: '#7c3aed' },
  proposal:     { bg: '#fffbeb', color: '#b45309' },
  negotiation:  { bg: '#fff7ed', color: '#ea580c' },
  won:          { bg: '#ecfdf5', color: '#059669' },
  lost:         { bg: '#fef2f2', color: '#dc2626' },
};

// Timesheet statuses — see App\Models\Timesheet.
export const TIMESHEET_SC: Record<string, { bg: string; color: string }> = {
  pending:   { bg: '#fffbeb', color: '#b45309' },
  approved:  { bg: '#ecfdf5', color: '#059669' },
  rejected:  { bg: '#fef2f2', color: '#dc2626' },
};

// Follow-up statuses — see App\Models\FollowUp.
export const FOLLOWUP_SC: Record<string, { bg: string; color: string }> = {
  pending:    { bg: '#fffbeb', color: '#b45309' },
  completed:  { bg: '#ecfdf5', color: '#059669' },
  missed:     { bg: '#fef2f2', color: '#dc2626' },
  cancelled:  { bg: '#f1f5f9', color: '#64748b' },
};

export function Badge({ label, sc }: { label: string; sc?: { bg: string; color: string } }) {
  const s = sc ?? { bg: '#f1f5f9', color: '#64748b' };
  const text = label.replace(/_/g, ' ');
  return (
    <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: s.bg, color: s.color, fontWeight: 500, textTransform: 'capitalize' }}>
      {text}
    </span>
  );
}

export function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', padding: '18px 20px' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

export function fmtFileSize(bytes?: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function errorMessage(err: unknown, fallback: string): string {
  const ex = err as { response?: { data?: { message?: string } } };
  return ex.response?.data?.message ?? fallback;
}
