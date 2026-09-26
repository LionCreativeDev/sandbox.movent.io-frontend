'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/layout/DashboardLayout';
import toast from 'react-hot-toast';
import { getActiveCompany } from '@/lib/auth';
import { adminClientService, ManagedCompany } from '@/lib/services/adminClientService';

function errorMessage(error: unknown, fallback: string): string {
  return (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;
}

export default function AdminCompaniesPage() {
  const [allCompanies, setAllCompanies] = useState<ManagedCompany[]>([]);
  const [loading, setLoading] = useState(true);

  // Inline confirmation panel state — same "no modal component in this app"
  // convention as admin/attendance's Correct panel: the row itself expands
  // to show Cancel/Confirm rather than an overlay.
  const [suspendingId, setSuspendingId] = useState<number | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [reactivatingId, setReactivatingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    adminClientService.manageCompanies()
      .then(setAllCompanies)
      .catch(() => toast.error('Failed to load companies'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // GET /admin/companies/manage itself must stay unfiltered by the topbar
  // Company Selector — same reasoning as this page always had for
  // /admin/companies: this IS the screen that must keep showing every
  // company (including a suspended one, and regardless of which single
  // company the switcher currently has selected) so Reactivate is always
  // reachable. 'all'/no selection shows everything; a specific selection
  // still narrows the list to match every other Company-Wise-filtered admin
  // page's convention.
  const activeCompany = getActiveCompany();
  const companies = typeof activeCompany === 'number'
    ? allCompanies.filter(c => c.id === activeCompany)
    : allCompanies;

  const startSuspend = (id: number) => {
    setReactivatingId(null);
    setSuspendingId(id);
    setSuspendReason('');
  };

  const confirmSuspend = async (id: number) => {
    if (!suspendReason.trim()) { toast.error('A reason is required to suspend a company'); return; }
    setSubmitting(true);
    try {
      await adminClientService.suspendCompany(id, suspendReason.trim());
      toast.success('Company suspended successfully');
      setSuspendingId(null);
      load();
    } catch (error: unknown) {
      toast.error(errorMessage(error, 'Failed to suspend company'));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmReactivate = async (id: number) => {
    setSubmitting(true);
    try {
      const result = await adminClientService.reactivateCompany(id);
      if (result.fully_active) {
        toast.success('Company reactivated successfully');
      } else if (result.remaining_restriction === 'subscription') {
        toast.error('Company reactivated, but your subscription still needs to be renewed before normal access resumes.');
      } else if (result.remaining_restriction === 'deactivated_by_super_admin') {
        toast.error('Company reactivated, but it is also deactivated by Super Admin — contact Super Admin to fully restore access.');
      } else {
        toast.success('Company reactivated successfully');
      }
      setReactivatingId(null);
      load();
    } catch (error: unknown) {
      toast.error(errorMessage(error, 'Failed to reactivate company'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout title="Companies">
      <div style={{ width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0 }}>Companies</h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>Manage the companies under this admin account.</p>
          </div>
          <Link
            href="/admin/companies/create"
            style={{
              padding: '10px 14px', borderRadius: 8, background: '#2563eb',
              color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 700,
            }}
          >
            Add Company
          </Link>
        </div>

        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 130px 200px', gap: 12, padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            <div>Company Name</div>
            <div>Currency</div>
            <div>Status</div>
            <div style={{ textAlign: 'right' }}>Action</div>
          </div>

          {loading ? (
            <div style={{ padding: 28, textAlign: 'center', color: '#94a3b8' }}>Loading...</div>
          ) : companies.length ? companies.map(company => {
            const suspended = !!company.suspended_at;
            const isSuspendingThis = suspendingId === company.id;
            const isReactivatingThis = reactivatingId === company.id;

            return (
              <div key={company.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 130px 200px', gap: 12, alignItems: 'center', padding: '14px 16px' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: '#0f172a', fontSize: 14, fontWeight: 700, overflowWrap: 'anywhere' }}>{company.name}</div>
                    {suspended && company.suspension_reason && (
                      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Reason: {company.suspension_reason}</div>
                    )}
                  </div>
                  <div style={{ color: '#64748b', fontSize: 13 }}>{company.currency ?? '—'}</div>
                  <div>
                    {suspended ? (
                      <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: '#fef2f2', color: '#dc2626', fontWeight: 600 }}>
                        Suspended{company.suspended_at ? ` · ${new Date(company.suspended_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                      </span>
                    ) : !company.is_active ? (
                      <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: '#f1f5f9', color: '#64748b', fontWeight: 600 }}>
                        Deactivated
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: '#ecfdf5', color: '#059669', fontWeight: 600 }}>
                        Active
                      </span>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', gap: 12, justifyContent: 'flex-end', alignItems: 'center' }}>
                    <Link href={`/admin/companies/${company.id}/edit`} style={{ color: '#2563eb', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                      Edit
                    </Link>
                    {suspended ? (
                      <button
                        onClick={() => { setSuspendingId(null); setReactivatingId(company.id); }}
                        style={{ padding: '6px 12px', fontSize: 12, fontWeight: 700, borderRadius: 6, border: '1px solid #bbf7d0', background: '#fff', color: '#059669', cursor: 'pointer' }}
                      >
                        Reactivate Company
                      </button>
                    ) : (
                      <button
                        onClick={() => startSuspend(company.id)}
                        style={{ padding: '6px 12px', fontSize: 12, fontWeight: 700, borderRadius: 6, border: '1px solid #fecaca', background: '#fff', color: '#dc2626', cursor: 'pointer' }}
                      >
                        Suspend Company
                      </button>
                    )}
                  </div>
                </div>

                {isSuspendingThis && (
                  <div style={{ padding: '0 16px 16px', background: '#fef2f2' }}>
                    <div style={{ padding: 16, background: '#fff', border: '1px solid #fecaca', borderRadius: 10 }}>
                      <p style={{ margin: '0 0 4px', fontSize: 13.5, fontWeight: 700, color: '#0f172a' }}>Suspend this company?</p>
                      <p style={{ margin: '0 0 12px', fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
                        Its users will lose normal access, and new business operations will stop. Existing data will remain saved.
                      </p>
                      <textarea
                        value={suspendReason}
                        onChange={e => setSuspendReason(e.target.value)}
                        placeholder="Reason for suspension (required)"
                        rows={2}
                        style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid #e2e8f0', borderRadius: 8, resize: 'vertical', marginBottom: 12, boxSizing: 'border-box' }}
                      />
                      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          onClick={() => setSuspendingId(null)}
                          disabled={submitting}
                          style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 13, fontWeight: 600, cursor: submitting ? 'wait' : 'pointer' }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => confirmSuspend(company.id)}
                          disabled={submitting}
                          style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: submitting ? '#fca5a5' : '#dc2626', color: '#fff', fontSize: 13, fontWeight: 700, cursor: submitting ? 'wait' : 'pointer' }}
                        >
                          {submitting ? 'Suspending…' : 'Suspend Company'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {isReactivatingThis && (
                  <div style={{ padding: '0 16px 16px', background: '#ecfdf5' }}>
                    <div style={{ padding: 16, background: '#fff', border: '1px solid #bbf7d0', borderRadius: 10 }}>
                      <p style={{ margin: '0 0 4px', fontSize: 13.5, fontWeight: 700, color: '#0f172a' }}>Reactivate this company?</p>
                      <p style={{ margin: '0 0 12px', fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
                        Normal access will resume if its subscription and other access requirements are valid.
                      </p>
                      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          onClick={() => setReactivatingId(null)}
                          disabled={submitting}
                          style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', color: '#64748b', fontSize: 13, fontWeight: 600, cursor: submitting ? 'wait' : 'pointer' }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => confirmReactivate(company.id)}
                          disabled={submitting}
                          style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: submitting ? '#86efac' : '#059669', color: '#fff', fontSize: 13, fontWeight: 700, cursor: submitting ? 'wait' : 'pointer' }}
                        >
                          {submitting ? 'Reactivating…' : 'Reactivate Company'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          }) : (
            <div style={{ padding: 28, textAlign: 'center', color: '#94a3b8' }}>No companies found.</div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
