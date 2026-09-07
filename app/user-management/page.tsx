'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { staffUserService } from '@/lib/services/staffUserService';
import { can, getAuthUser } from '@/lib/auth';
import { User, CompanyOption } from '@/types';
import { roleDisplayLabel } from '@/lib/roleUtils';
import { lbl, card } from '@/components/admin/projects/shared';
import {
  HiUserPlus, HiPencilSquare, HiNoSymbol, HiPlay,
  HiCheckCircle, HiArrowPath, HiLockClosed,
} from 'react-icons/hi2';
import toast from 'react-hot-toast';

// Delegated User Management — the Company Admin's own Users screen, handed to
// a staff member who was granted the "User Management Permission"
// (account.canAddUsers). Add and Edit are the SAME pages the Company Admin
// uses (/users/new and /users/{id}/edit): userService switches to the
// /user/users/* API for a staff caller, so there is one set of screens rather
// than a second, drifting copy.
//
// Every action is bound to the companies this person is actually assigned to —
// the server decides that scope (UserManagementController::
// manageableCompanyIds()) and the company picker below is literally built
// from what it hands back.
//
// Two things a manager can never do, enforced on both sides:
//   • grant the User Management Permission to anyone (no minting more managers)
//   • touch someone who already holds it — those rows are listed by name only,
//     so the roster stays complete, and nothing else.

const STATUS_CFG: Record<string, { color: string; bg: string; label: string }> = {
  active:    { color: '#059669', bg: '#ecfdf5', label: 'Active'    },
  invited:   { color: '#d97706', bg: '#fffbeb', label: 'Invited'   },
  suspended: { color: '#dc2626', bg: '#fef2f2', label: 'Suspended' },
};

const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString('en-GB') : '—');

const errText = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;

const th: React.CSSProperties = {
  padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700,
  color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap',
};
const td: React.CSSProperties = { padding: '13px 16px', fontSize: 13, color: '#475569', verticalAlign: 'top' };

const btn = (bg: string, color: string, border: string): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 6,
  border: `1.5px solid ${border}`, background: bg, color, fontSize: 12, fontWeight: 500,
  cursor: 'pointer', whiteSpace: 'nowrap',
});

export default function UserManagementPage() {
  const router = useRouter();
  const me = getAuthUser() as { id?: number } | null;

  // can() reads cookies, which don't exist server-side — hold the gate behind
  // `mounted` so the first paint matches on both sides.
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMounted(true); }, []);
  const allowed = can('account', 'canAddUsers');

  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [companyId, setCompanyId] = useState<number | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [seats, setSeats] = useState<{ used: number; limit: number | null }>({ used: 0, limit: null });
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    if (mounted && !allowed) router.replace('/dashboard');
  }, [mounted, allowed, router]);

  useEffect(() => {
    if (!allowed) return;
    staffUserService.companyOptions()
      .then(list => { setCompanies(list); setCompanyId(prev => prev ?? list[0]?.id ?? null); })
      .catch(() => toast.error('Failed to load your companies'));
  }, [allowed]);

  const load = async (cid: number | null) => {
    setLoading(true);
    try {
      const data = await staffUserService.list(cid ?? undefined);
      setUsers(data.users);
      setSeats({ used: data.used, limit: data.limit });
    } catch (err) {
      toast.error(errText(err, 'Failed to load users'));
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (allowed && companyId !== null) load(companyId); }, [allowed, companyId]);

  const assignmentsOf = (u: User) => u.company_assignments ?? [];

  // Already a manager themselves — a peer, not staff to administer. Read off
  // the permissions the list already carries (scoped to this manager's own
  // companies), and refused server-side as well.
  const isPeerManager = (u: User) =>
    assignmentsOf(u).some(a => ((a.permissions?.account as string[] | undefined) ?? []).includes('canAddUsers'));

  // While one company is selected a row must report THAT company's status —
  // users.status is a rollup across every company, so someone suspended here
  // but active elsewhere would otherwise read "Active" with a Suspend button
  // that looked like it did nothing.
  const statusFor = (u: User): 'active' | 'invited' | 'suspended' => {
    if (u.status === 'invited') return 'invited';
    const here = assignmentsOf(u).find(a => a.company_id === companyId);
    return here ? here.status : u.status;
  };

  const toggleStatus = async (u: User) => {
    const next = statusFor(u) === 'active' ? 'suspended' : 'active';
    const companyName = companies.find(c => c.id === companyId)?.name ?? 'this company';
    if (!window.confirm(`${next === 'suspended' ? 'Suspend' : 'Reactivate'} ${u.name} in ${companyName}?`)) return;
    setBusyId(u.id);
    try {
      const updated = await staffUserService.toggleStatus(u.id, next, companyId ?? undefined);
      setUsers(prev => prev.map(x => (x.id === updated.id ? updated : x)));
      toast.success(next === 'suspended' ? 'User suspended' : 'User reactivated');
    } catch (err) {
      toast.error(errText(err, 'Failed to update status'));
    } finally {
      setBusyId(null);
    }
  };

  if (!mounted) {
    return (
      <DashboardLayout title="Users">
        <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
      </DashboardLayout>
    );
  }
  if (!allowed) return null;

  const seatText = seats.limit === null ? `${seats.used} users` : `${seats.used} of ${seats.limit} seats used`;

  return (
    <DashboardLayout title="Users">
      <div style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: '0 0 4px' }}>Users</h1>
            <div style={{ fontSize: 13, color: '#94a3b8' }}>
              Users you added to {companies.length === 1 ? companies[0]?.name ?? 'your company' : 'the companies you belong to'} · {seatText}
            </div>
          </div>
          {/* The Company Admin's own Add User wizard — same three steps, same
              permission editor, just capped to what this manager may grant. */}
          <button onClick={() => router.push('/users/new')} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: 8,
            border: 'none', background: '#2563eb', color: '#fff', fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
          }}>
            <HiUserPlus size={16} /> Add User
          </button>
        </div>

        {/* Company scope. Shown only when there's a real choice — a
            single-company manager has nothing to pick and the header already
            names their company. */}
        {companies.length > 1 && (
          <div style={{ ...card, padding: '14px 18px', marginBottom: 14 }}>
            <label style={lbl}>Company</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {companies.map(c => (
                <button key={c.id} onClick={() => setCompanyId(c.id)} style={{
                  padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  border: `1.5px solid ${c.id === companyId ? '#2563eb' : '#e2e8f0'}`,
                  background: c.id === companyId ? '#eff6ff' : '#fff',
                  color: c.id === companyId ? '#2563eb' : '#64748b',
                }}>{c.name}</button>
              ))}
            </div>
            <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 8 }}>
              Only the companies you are assigned to, and only the users you added yourself.
            </div>
          </div>
        )}

        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #f1f5f9', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 48, textAlign: 'center', color: '#94a3b8' }}>Loading users…</div>
          ) : users.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>👥</div>
              <div style={{ fontWeight: 600, color: '#64748b', marginBottom: 4 }}>You haven&apos;t added any users yet</div>
              <div style={{ fontSize: 13 }}>This list shows the accounts you create — not the whole company roster.</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                    {['User', 'Role', 'Companies', 'Status', 'Added', 'Actions'].map(h => (
                      <th key={h} style={th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map((u, i) => {
                    const status = statusFor(u);
                    const cfg = STATUS_CFG[status] ?? STATUS_CFG.active;
                    const isSelf = u.id === me?.id;
                    const peer = isPeerManager(u);
                    const locked = isSelf || peer;
                    const busy = busyId === u.id;
                    return (
                      <tr key={u.id} style={{ borderBottom: i < users.length - 1 ? '1px solid #f8fafc' : 'none', background: locked ? '#fcfcfd' : undefined }}>
                        <td style={td}>
                          <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 13 }}>
                            {u.name}
                            {isSelf && <span style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 600, marginLeft: 6 }}>(you)</span>}
                          </div>
                          <div style={{ fontSize: 11.5, color: '#94a3b8' }}>{u.email}</div>
                        </td>
                        <td style={td}>
                          {roleDisplayLabel(u)}
                          {peer && !isSelf && (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 4, padding: '2px 7px', borderRadius: 20, background: '#f1f5f9', color: '#64748b', fontSize: 10.5, fontWeight: 600 }}>
                              <HiLockClosed size={10} /> User Manager
                            </div>
                          )}
                        </td>
                        <td style={td}>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {assignmentsOf(u).map(a => (
                              <span key={a.company_id} title={a.status === 'suspended' ? 'Suspended here' : undefined} style={{
                                fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 500, whiteSpace: 'nowrap',
                                background: a.status === 'suspended' ? '#fef2f2' : '#eff6ff',
                                color: a.status === 'suspended' ? '#dc2626' : '#2563eb',
                              }}>{a.company_name}</span>
                            ))}
                          </div>
                        </td>
                        <td style={td}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 20,
                            fontSize: 11.5, fontWeight: 600, background: cfg.bg, color: cfg.color,
                          }}>
                            {status === 'suspended' ? <HiNoSymbol size={12} /> : status === 'invited' ? <HiArrowPath size={12} /> : <HiCheckCircle size={12} />}
                            {cfg.label}
                          </span>
                        </td>
                        <td style={{ ...td, whiteSpace: 'nowrap', fontSize: 12, color: '#64748b' }}>{fmtDate(u.created_at)}</td>
                        <td style={td}>
                          {/* Own account, and anyone who is a User Manager
                              themselves, are listed but not actionable — only
                              the Company Admin changes those. */}
                          {locked ? (
                            <span style={{ fontSize: 11.5, color: '#94a3b8' }}>
                              {isSelf ? 'Ask your Company Admin' : 'Managed by Company Admin'}
                            </span>
                          ) : (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {/* Same Edit User page the Company Admin gets —
                                  basic info, role and the per-company
                                  permission editor all live there. */}
                              <button disabled={busy} onClick={() => router.push(`/users/${u.id}/edit`)} style={btn('#eef2ff', '#4f46e5', '#e0e7ff')}>
                                <HiPencilSquare size={13} /> Edit &amp; Permissions
                              </button>
                              {status !== 'invited' && (
                                <button disabled={busy} onClick={() => toggleStatus(u)} style={btn(
                                  status === 'active' ? '#fff' : '#f0fdf4',
                                  status === 'active' ? '#dc2626' : '#059669',
                                  status === 'active' ? '#fecaca' : '#bbf7d0',
                                )}>
                                  {status === 'active' ? <HiNoSymbol size={13} /> : <HiPlay size={13} />}
                                  {status === 'active' ? 'Suspend' : 'Activate'}
                                </button>
                              )}
                              {/* No Remove: taking a user off a company stays
                                  Company Admin territory. The staff API still
                                  refuses it for a peer manager either way, and
                                  the same button is hidden on Edit User. */}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
