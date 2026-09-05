'use client';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminClientService } from '@/lib/services/adminClientService';
import { userClientService } from '@/lib/services/userClientService';
import { ClientDeleteSummary } from '@/types';

// Deleting a client is permanent and cascades — its projects, tasks,
// invoices, payments and compliance records all go with it (see
// App\Services\ClientDeletionService). So the admin gets the full tally
// before committing, never a bare confirm(). Shared by /clients and
// /admin/clients so both list pages warn identically.

const errorMessage = (err: unknown, fallback: string) => {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const response = (err as { response?: { data?: { message?: unknown } } }).response;
    if (typeof response?.data?.message === 'string') return response.data.message;
  }
  return fallback;
};

const fmtAmount = (amount: string) =>
  Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// A count worth pausing over — unpaid/overdue money, work still in flight.
const DANGER = { label: '#b91c1c', value: '#dc2626' };
const NEUTRAL = { label: '#64748b', value: '#1e293b' };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: '#94a3b8',
        textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 7,
      }}>{title}</div>
      <div style={{ border: '1px solid #f1f5f9', borderRadius: 10, overflow: 'hidden' }}>{children}</div>
    </div>
  );
}

function Row({ label, value, danger }: { label: string; value: string | number; danger?: boolean }) {
  const c = danger ? DANGER : NEUTRAL;
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
      padding: '8px 12px', borderBottom: '1px solid #f8fafc', background: danger ? '#fffbfb' : '#fff',
    }}>
      <span style={{ fontSize: 12.5, color: c.label }}>{label}</span>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: c.value, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

export default function DeleteClientModal({
  clientId,
  clientName,
  base,
  onCancel,
  onDeleted,
}: {
  clientId: number;
  clientName: string;
  /** Which API the caller is authenticated against. */
  base: 'admin' | 'user';
  onCancel: () => void;
  onDeleted: () => void;
}) {
  const service = base === 'admin' ? adminClientService : userClientService;

  const [summary, setSummary] = useState<ClientDeleteSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    service.deleteSummary(clientId)
      .then(data => { if (!cancelled) setSummary(data); })
      .catch(err => {
        if (cancelled) return;
        toast.error(errorMessage(err, 'Failed to load what this delete would remove'));
        onCancel();
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Escape cancels — but not mid-delete, where there's nothing to back out of.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !deleting) onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deleting, onCancel]);

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await service.remove(clientId);
      toast.success(`"${clientName}" and all linked records deleted`);
      onDeleted();
    } catch (err: unknown) {
      toast.error(errorMessage(err, 'Failed to delete client'));
      setDeleting(false);
    }
  };

  const c = summary?.client;

  return (
    <div
      onClick={() => { if (!deleting) onCancel(); }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16,
      }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 14, width: '100%', maxWidth: 520,
          maxHeight: '88vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
        }}>

        {/* Header */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          gap: 12, padding: '20px 24px 14px', borderBottom: '1px solid #f1f5f9',
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e293b' }}>
              Delete client
            </h3>
            <p style={{ fontSize: 12.5, color: '#64748b', margin: '4px 0 0' }}>
              Review everything this will remove before you confirm.
            </p>
          </div>
          <button
            onClick={onCancel}
            disabled={deleting}
            aria-label="Close"
            style={{
              background: 'none', border: 'none', fontSize: 22, color: '#94a3b8',
              cursor: deleting ? 'not-allowed' : 'pointer', lineHeight: 1, padding: 0,
            }}>×</button>
        </div>

        {/* Summary */}
        <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>
          {loading || !summary || !c ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
              Loading linked records…
            </div>
          ) : (
            <>
              <Section title="Client">
                <Row label="Name" value={c.name} />
                <Row label="Email" value={c.email || '—'} />
                <Row label="Phone" value={c.phone || '—'} />
                <Row label="Company" value={c.company_name || '—'} />
                <Row label="Status" value={c.status} />
                <Row
                  label="Portal login"
                  value={c.has_portal_login ? `${c.portal_email || 'Enabled'} — will be deactivated` : 'None'}
                />
              </Section>

              <Section title="Projects">
                <Row label="Total projects" value={summary.projects.total} danger={summary.projects.total > 0} />
                <Row label="Ongoing" value={summary.projects.ongoing} danger={summary.projects.ongoing > 0} />
                <Row label="Completed" value={summary.projects.completed} />
                <Row label="Cancelled" value={summary.projects.cancelled} />
              </Section>

              <Section title="Invoices">
                <Row label="Total invoices" value={summary.invoices.total} danger={summary.invoices.total > 0} />
                <Row label="Paid" value={summary.invoices.paid} />
                <Row label="Unpaid" value={summary.invoices.unpaid} danger={summary.invoices.unpaid > 0} />
                <Row label="Overdue" value={summary.invoices.overdue} danger={summary.invoices.overdue > 0} />
                <Row label="Cancelled" value={summary.invoices.cancelled} />
              </Section>

              <Section title="Payments">
                <Row label="Payment records" value={summary.payments.total} danger={summary.payments.total > 0} />
                {summary.payments.received.length === 0 ? (
                  <Row label="Total received" value="—" />
                ) : (
                  summary.payments.received.map(r => (
                    <Row
                      key={r.currency}
                      label={`Total received (${r.currency})`}
                      value={`${r.currency} ${fmtAmount(r.amount)}`}
                      danger
                    />
                  ))
                )}
              </Section>

              <Section title="Other linked records">
                <Row label="Tasks" value={summary.other.tasks} />
                <Row label="Timesheet entries" value={summary.other.timesheets} />
                <Row label="Deliverables" value={summary.other.deliverables} />
                <Row label="Compliance cases" value={summary.other.compliance_cases} />
                <Row label="Chat conversations" value={summary.other.chat_threads} />
                <Row label="Portal permissions" value={summary.other.portal_permissions} />
              </Section>

              {/* Warning */}
              <div style={{
                background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10,
                padding: '12px 14px', marginTop: 4,
              }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#b91c1c', marginBottom: 4 }}>
                  Deleting this client will permanently remove all of the records above.
                </div>
                <div style={{ fontSize: 12, color: '#dc2626', lineHeight: 1.5 }}>
                  This action cannot be undone — the projects, invoices and payment history
                  listed here will be gone for good, including from reports.
                </div>
              </div>

              <p style={{ fontSize: 13.5, fontWeight: 600, color: '#1e293b', margin: '14px 0 0' }}>
                Are you sure you want to permanently delete{' '}
                <span style={{ color: '#dc2626' }}>&ldquo;{c.name}&rdquo;</span>?
              </p>
            </>
          )}
        </div>

        {/* Actions */}
        <div style={{
          display: 'flex', justifyContent: 'flex-end', gap: 10,
          padding: '14px 24px 20px', borderTop: '1px solid #f1f5f9',
        }}>
          <button
            onClick={onCancel}
            disabled={deleting}
            style={{
              padding: '9px 18px', borderRadius: 8, border: '1.5px solid #e2e8f0',
              background: '#fff', color: '#475569', fontSize: 13, fontWeight: 600,
              cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.6 : 1,
            }}>Cancel</button>
          <button
            onClick={confirmDelete}
            disabled={loading || deleting || !summary}
            style={{
              padding: '9px 18px', borderRadius: 8, border: 'none',
              background: '#dc2626', color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: loading || deleting ? 'wait' : 'pointer',
              opacity: loading || deleting || !summary ? 0.6 : 1,
            }}>{deleting ? 'Deleting…' : 'Delete Client'}</button>
        </div>
      </div>
    </div>
  );
}
